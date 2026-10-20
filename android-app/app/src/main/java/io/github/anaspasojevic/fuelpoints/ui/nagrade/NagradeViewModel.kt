package io.github.anaspasojevic.fuelpoints.ui.nagrade

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.Dostupnost
import io.github.anaspasojevic.fuelpoints.domen.GeneratorZahtjeva
import io.github.anaspasojevic.fuelpoints.domen.Odbrojavanje
import io.github.anaspasojevic.fuelpoints.domen.PokusajIzdavanja
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.Preostalo
import io.github.anaspasojevic.fuelpoints.domen.dostupnost
import io.github.anaspasojevic.fuelpoints.podaci.api.BackendApi
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nagrade.AktivniVoucher
import io.github.anaspasojevic.fuelpoints.podaci.nagrade.IzvorNagrada
import io.github.anaspasojevic.fuelpoints.podaci.nagrade.Nagrada
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StavkaNagrade(
    val rewardId: String,
    val naziv: String,
    val costPoints: Long,
    val dostupna: Boolean,
    // Samo prikaz (cost − available); 0 kad je nagrada dostupna ili je stanje nepoznato.
    val nedostaje: Long,
)

data class StavkaVouchera(
    val voucherId: String,
    val rewardId: String,
    val naziv: String,
    val costPoints: Long,
    val preostalo: Preostalo,
)

sealed interface DijalogNagrada {
    data class Izdavanje(val nagrada: StavkaNagrade) : DijalogNagrada
    data class Otkazivanje(val voucherId: String) : DijalogNagrada
}

data class PorukaNagrada(val tekst: String, val uspjeh: Boolean, val mozePonoviti: Boolean)

sealed interface IzlazSaNagrada {
    data object Pokretanje : IzlazSaNagrada
    data object Prijava : IzlazSaNagrada
    data object BrisanjeUToku : IzlazSaNagrada
}

data class StanjeNagrada(
    val bodovi: Long? = null,
    val stanjeNedostupno: Boolean = false,
    val katalog: List<StavkaNagrade> = emptyList(),
    val katalogNedostupan: Boolean = false,
    val vauceri: List<StavkaVouchera> = emptyList(),
    val dijalog: DijalogNagrada? = null,
    val radi: Boolean = false,
    val poruka: PorukaNagrada? = null,
    val izlaz: IzlazSaNagrada? = null,
)

private sealed interface PonovnaAkcija {
    data class Izdavanje(val rewardId: String) : PonovnaAkcija
    data class Otkazivanje(val voucherId: String) : PonovnaAkcija
}

// UI-06, §12–§14, §17, §19, O-15, O-16, O-49, O-50, (s). Voucher-i i bodovi dolaze samo iz Firestore snimaka; ništa se ne mijenja lokalno.
class NagradeViewModel(
    private val auth: IzvorAutentikacije,
    nalog: IzvorNaloga,
    izvor: IzvorNagrada,
    private val api: BackendApi,
    generator: GeneratorZahtjeva,
    private val sat: () -> Long,
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeNagrada())
    val stanje: StateFlow<StanjeNagrada> = _stanje.asStateFlow()

    private val pokusaj = PokusajIzdavanja(generator)
    private var ponovnaAkcija: PonovnaAkcija? = null

    private var bodovi: Long? = null
    private var bodoviStigli = false
    private var katalog: List<Nagrada> = emptyList()
    private var vauceri: List<AktivniVoucher> = emptyList()

    // API-06 se za isti voucherId šalje najviše jednom po prelasku u „istekao” (O-49).
    private val prijavljeniIstekli = mutableSetOf<String>()
    private var tikanje: Job? = null

    init {
        val uid = auth.trenutniUid()
        if (uid == null) {
            _stanje.update { it.copy(izlaz = IzlazSaNagrada.Prijava) }
        } else {
            viewModelScope.launch {
                auth.posmatrajSesiju().collect { if (it == null) _stanje.update { s -> s.copy(izlaz = IzlazSaNagrada.Prijava) } }
            }
            viewModelScope.launch {
                nalog.posmatrajLoyaltyNalog(uid).collect { snimak ->
                    bodovi = (snimak as? StanjeDokumenta.Postoji)?.podaci?.availablePoints?.takeIf { it >= 0 }
                    bodoviStigli = true
                    osvjezi()
                }
            }
            viewModelScope.launch {
                izvor.posmatrajKatalog().collect { snimak ->
                    when (snimak) {
                        is StanjeDokumenta.Postoji -> {
                            katalog = snimak.podaci
                            _stanje.update { it.copy(katalogNedostupan = false) }
                        }
                        else -> _stanje.update { it.copy(katalogNedostupan = true) }
                    }
                    osvjezi()
                }
            }
            viewModelScope.launch {
                izvor.posmatrajAktivneVouchere(uid).collect { snimak ->
                    if (snimak is StanjeDokumenta.Postoji) vauceri = snimak.podaci
                    osvjezi()
                    uskladiTikanje()
                }
            }
        }
    }

    // ON_START ekrana: ako je neki voucher prikazan kao istekao, API-06 (greška se ne prikazuje, kao O-43).
    fun priOtvaranju() {
        if (_stanje.value.vauceri.any { it.preostalo == Preostalo.Istekao }) uskladi()
    }

    fun izlazObradjen() = _stanje.update { it.copy(izlaz = null) }

    fun zatvoriPoruku() = _stanje.update { it.copy(poruka = null) }

    // --- Izdavanje (API-03) ---

    fun dodirniNagradu(rewardId: String) {
        val s = _stanje.value
        if (s.radi) return
        val stavka = s.katalog.firstOrNull { it.rewardId == rewardId } ?: return
        if (!stavka.dostupna) return
        _stanje.update { it.copy(dijalog = DijalogNagrada.Izdavanje(stavka), poruka = null) }
    }

    fun odustani() = _stanje.update { it.copy(dijalog = null) }

    fun potvrdiDijalog() {
        when (val dijalog = _stanje.value.dijalog) {
            is DijalogNagrada.Izdavanje -> {
                _stanje.update { it.copy(dijalog = null) }
                izdaj(dijalog.nagrada.rewardId)
            }
            is DijalogNagrada.Otkazivanje -> {
                _stanje.update { it.copy(dijalog = null) }
                otkazi(dijalog.voucherId)
            }
            null -> Unit
        }
    }

    // „Pokušaj ponovo” u poruci: izdavanje ISTIM requestId-em (O-16, O-50) ili ponovljen cancel.
    fun ponovi() {
        when (val akcija = ponovnaAkcija) {
            is PonovnaAkcija.Izdavanje -> izdaj(akcija.rewardId)
            is PonovnaAkcija.Otkazivanje -> otkazi(akcija.voucherId)
            null -> Unit
        }
    }

    private fun izdaj(rewardId: String) {
        if (_stanje.value.radi) return
        val requestId = pokusaj.pocni(rewardId)
        _stanje.update { it.copy(radi = true, poruka = null) }
        viewModelScope.launch {
            val rezultat = api.izdajNagradu(rewardId, requestId)
            _stanje.update { it.copy(radi = false) }
            when (rezultat) {
                is RezultatApi.Uspjeh -> {
                    pokusaj.zatvori()
                    ponovnaAkcija = null
                    prikaziPoruku(PorukeGresaka.VOUCHER_IZDAT, uspjeh = true)
                }
                RezultatApi.MreznaGreska -> nezavrsenoIzdavanje(rewardId, PorukeGresaka.MREZA)
                is RezultatApi.GreskaBackenda -> {
                    if (!kojiIzlaz(rezultat.kod)) {
                        // i10/P-2: 500 i odgovor bez čitljivog §27 tijela ostavljaju pokušaj otvoren.
                        if (PokusajIzdavanja.jeKonacan(rezultat.kod, rezultat.status)) {
                            pokusaj.zatvori()
                            ponovnaAkcija = null
                            prikaziPoruku(PorukeGresaka.zaKod(rezultat.kod), uspjeh = false)
                        } else {
                            nezavrsenoIzdavanje(rewardId, PorukeGresaka.zaKod(rezultat.kod))
                        }
                    } else {
                        pokusaj.zatvori()
                        ponovnaAkcija = null
                    }
                }
            }
        }
    }

    private fun nezavrsenoIzdavanje(rewardId: String, tekst: String) {
        ponovnaAkcija = PonovnaAkcija.Izdavanje(rewardId)
        prikaziPoruku(tekst, uspjeh = false, mozePonoviti = true)
    }

    // --- Otkazivanje (API-05) ---

    fun dodirniOtkazi(voucherId: String) {
        if (_stanje.value.radi) return
        if (_stanje.value.vauceri.none { it.voucherId == voucherId }) return
        _stanje.update { it.copy(dijalog = DijalogNagrada.Otkazivanje(voucherId), poruka = null) }
    }

    private fun otkazi(voucherId: String) {
        if (_stanje.value.radi) return
        _stanje.update { it.copy(radi = true, poruka = null) }
        viewModelScope.launch {
            val rezultat = api.otkaziVoucher(voucherId)
            _stanje.update { it.copy(radi = false) }
            when (rezultat) {
                is RezultatApi.Uspjeh -> {
                    ponovnaAkcija = null
                    prikaziPoruku(PorukeGresaka.VOUCHER_OTKAZAN, uspjeh = true)
                }
                RezultatApi.MreznaGreska -> nezavrsenoOtkazivanje(voucherId, PorukeGresaka.MREZA)
                is RezultatApi.GreskaBackenda -> {
                    when {
                        kojiIzlaz(rezultat.kod) -> ponovnaAkcija = null
                        // §19, (s): istekao voucher — Backend ga je zatvorio; osvježavanje stanja preko API-06.
                        rezultat.kod == "VOUCHER_EXPIRED" -> {
                            ponovnaAkcija = null
                            if (prijavljeniIstekli.add(voucherId)) uskladi()
                            prikaziPoruku(PorukeGresaka.VOUCHER_ISTEKAO, uspjeh = false)
                        }
                        // Cancel je state-idempotentan (§19.2): 503, mreža, 500 i nečitljiv odgovor se mogu ponoviti.
                        !PokusajIzdavanja.jeKonacan(rezultat.kod, rezultat.status) ->
                            nezavrsenoOtkazivanje(voucherId, PorukeGresaka.zaKod(rezultat.kod))
                        else -> {
                            ponovnaAkcija = null
                            prikaziPoruku(PorukeGresaka.zaKod(rezultat.kod), uspjeh = false)
                        }
                    }
                }
            }
        }
    }

    private fun nezavrsenoOtkazivanje(voucherId: String, tekst: String) {
        ponovnaAkcija = PonovnaAkcija.Otkazivanje(voucherId)
        prikaziPoruku(tekst, uspjeh = false, mozePonoviti = true)
    }

    // --- Zajedničko ---

    // ACCOUNT_* i UNAUTHENTICATED vode van ekrana (isti prelazi kao Home); vraća true kad je izlaz postavljen.
    private fun kojiIzlaz(kod: String?): Boolean {
        val izlaz = when (kod) {
            "ACCOUNT_DELETION_IN_PROGRESS" -> IzlazSaNagrada.BrisanjeUToku
            "ACCOUNT_NOT_INITIALIZED" -> IzlazSaNagrada.Pokretanje
            "UNAUTHENTICATED" -> IzlazSaNagrada.Prijava
            else -> return false
        }
        _stanje.update { it.copy(izlaz = izlaz) }
        return true
    }

    private fun prikaziPoruku(tekst: String, uspjeh: Boolean, mozePonoviti: Boolean = false) =
        _stanje.update { it.copy(poruka = PorukaNagrada(tekst, uspjeh, mozePonoviti)) }

    private fun uskladi() {
        viewModelScope.launch {
            val rezultat = api.uskladiVaucere()
            if (rezultat is RezultatApi.GreskaBackenda) kojiIzlaz(rezultat.kod.takeIf { it != "UNAUTHENTICATED" })
        }
    }

    // Preračunava prikaz iz posljednjih snimaka i sata; novi „istekao” voucher dobija tačno jedan API-06.
    private fun osvjezi() {
        val sada = sat()
        val stavke = katalog.map {
            val d = dostupnost(bodovi, it.costPoints)
            StavkaNagrade(it.rewardId, it.displayName, it.costPoints, d == Dostupnost.Dostupna, (d as? Dostupnost.Nedostaje)?.bodova ?: 0)
        }
        val nazivi = katalog.associate { it.rewardId to it.displayName }
        val kartice = vauceri.map {
            StavkaVouchera(it.voucherId, it.rewardId, nazivi[it.rewardId] ?: it.rewardId, it.costPoints, Odbrojavanje.preostalo(it.expiresAtMs, sada))
        }
        _stanje.update { it.copy(bodovi = bodovi, stanjeNedostupno = bodoviStigli && bodovi == null, katalog = stavke, vauceri = kartice) }
        val noviIstekli = kartice.filter { it.preostalo == Preostalo.Istekao && prijavljeniIstekli.add(it.voucherId) }
        if (noviIstekli.isNotEmpty()) uskladi()
    }

    // Otkucaj svake sekunde samo dok postoji aktivni voucher.
    private fun uskladiTikanje() {
        if (vauceri.isEmpty()) {
            tikanje?.cancel()
            tikanje = null
        } else if (tikanje == null) {
            tikanje = viewModelScope.launch {
                while (true) {
                    delay(1_000)
                    osvjezi()
                }
            }
        }
    }
}
