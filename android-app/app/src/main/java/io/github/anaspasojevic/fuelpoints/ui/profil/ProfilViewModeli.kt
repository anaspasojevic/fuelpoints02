package io.github.anaspasojevic.fuelpoints.ui.profil

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.StanjeBrisanja
import io.github.anaspasojevic.fuelpoints.domen.TokBrisanja
import io.github.anaspasojevic.fuelpoints.domen.jeIspravnaLozinka
import io.github.anaspasojevic.fuelpoints.domen.jeIspravnoIme
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IshodUpisaImena
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StanjeProfila(
    val ime: String? = null,
    val email: String? = null,
    val izlazNaPrijavu: Boolean = false,
)

// UI-08, AUTH-07: ime iz users/{uid}, Auth e-mail samo za prikaz. Odjava = FirebaseAuth.signOut(), bez Backend poziva i Firestore upisa.
class ProfilViewModel(
    private val auth: IzvorAutentikacije,
    nalog: IzvorNaloga,
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeProfila(email = auth.email()))
    val stanje: StateFlow<StanjeProfila> = _stanje.asStateFlow()

    init {
        val uid = auth.trenutniUid()
        if (uid != null) {
            viewModelScope.launch {
                nalog.posmatrajKorisnika(uid).collect { snimak ->
                    if (snimak is StanjeDokumenta.Postoji) _stanje.update { it.copy(ime = snimak.podaci.displayName) }
                }
            }
        }
    }

    fun odjavi() {
        auth.odjavi()
        _stanje.update { it.copy(izlazNaPrijavu = true) }
    }
}

data class StanjeImena(
    val ime: String = "",
    val greska: String? = null,
    val obavjestenje: String? = null,
    val radi: Boolean = false,
    val gotovo: Boolean = false,
)

// UI-08, §25.2, RULE-T04, i10/P-10: users/{uid}.update({ displayName, updatedAt }); validacija 1–100 UTF-16 bez trim-a.
class ImeViewModel(
    private val auth: IzvorAutentikacije,
    private val nalog: IzvorNaloga,
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeImena())
    val stanje: StateFlow<StanjeImena> = _stanje.asStateFlow()

    private var korisnikMijenjao = false

    init {
        val uid = auth.trenutniUid()
        if (uid != null) {
            viewModelScope.launch {
                val trenutno = (nalog.procitajKorisnika(uid) as? StanjeDokumenta.Postoji)?.podaci?.displayName
                if (trenutno != null && !korisnikMijenjao) _stanje.update { it.copy(ime = trenutno) }
            }
        }
    }

    fun promijeniIme(ime: String) {
        korisnikMijenjao = true
        _stanje.update { it.copy(ime = ime, greska = null, obavjestenje = null) }
    }

    fun sacuvaj() {
        val s = _stanje.value
        if (s.radi) return
        val uid = auth.trenutniUid() ?: return
        if (!jeIspravnoIme(s.ime)) {
            _stanje.update { it.copy(greska = PorukeGresaka.IME, obavjestenje = null) }
            return
        }
        _stanje.update { it.copy(radi = true, greska = null, obavjestenje = null) }
        viewModelScope.launch {
            when (nalog.promijeniIme(uid, s.ime)) {
                IshodUpisaImena.Uspjeh -> {
                    // Poruka ostaje kratko vidljiva prije zatvaranja ekrana.
                    _stanje.update { it.copy(radi = false, obavjestenje = PorukeGresaka.IME_SACUVANO) }
                    delay(1_200)
                    _stanje.update { it.copy(gotovo = true) }
                }
                IshodUpisaImena.Odbijeno -> _stanje.update { it.copy(radi = false, greska = PorukeGresaka.IME_NEISPRAVNO) }
                IshodUpisaImena.NemaVeze -> _stanje.update { it.copy(radi = false, obavjestenje = PorukeGresaka.IME_NA_CEKANJU) }
            }
        }
    }
}

data class StanjeLozinke(
    val trenutna: String = "",
    val nova: String = "",
    val ponovljena: String = "",
    val greska: String? = null,
    val obavjestenje: String? = null,
    val radi: Boolean = false,
)

// AUTH-08 (§3.6), AUTH-09: reauthenticate sa trenutnom lozinkom, pa updatePassword; sesija ostaje.
class LozinkaViewModel(private val auth: IzvorAutentikacije) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeLozinke())
    val stanje: StateFlow<StanjeLozinke> = _stanje.asStateFlow()

    fun promijeniTrenutnu(v: String) = _stanje.update { it.copy(trenutna = v, greska = null, obavjestenje = null) }
    fun promijeniNovu(v: String) = _stanje.update { it.copy(nova = v, greska = null, obavjestenje = null) }
    fun promijeniPonovljenu(v: String) = _stanje.update { it.copy(ponovljena = v, greska = null, obavjestenje = null) }

    fun promijeni() {
        val s = _stanje.value
        if (s.radi) return
        val greska = when {
            s.trenutna.isEmpty() -> PorukeGresaka.UNESITE_TRENUTNU_LOZINKU
            !jeIspravnaLozinka(s.nova) -> PorukeGresaka.LOZINKA
            s.ponovljena != s.nova -> PorukeGresaka.LOZINKE_SE_NE_POKLAPAJU
            else -> null
        }
        if (greska != null) {
            _stanje.update { it.copy(greska = greska, obavjestenje = null) }
            return
        }
        _stanje.update { it.copy(radi = true, greska = null, obavjestenje = null) }
        viewModelScope.launch {
            val reauth = auth.potvrdiLozinku(s.trenutna)
            if (reauth != IshodAutentikacije.Uspjeh) {
                _stanje.update { it.copy(radi = false, greska = porukaReautha(reauth)) }
                return@launch
            }
            when (val ishod = auth.promijeniLozinku(s.nova)) {
                IshodAutentikacije.Uspjeh ->
                    _stanje.value = StanjeLozinke(obavjestenje = PorukeGresaka.LOZINKA_PROMIJENJENA)
                IshodAutentikacije.SlabaLozinka -> _stanje.update { it.copy(radi = false, greska = PorukeGresaka.LOZINKA) }
                else -> _stanje.update { it.copy(radi = false, greska = porukaOpsta(ishod)) }
            }
        }
    }

    // AUTH-09: ista neutralna poruka za uspjeh i svaku ne-mrežnu grešku; Backend ne učestvuje.
    fun posaljiReset() {
        val email = auth.email()
        if (email == null) {
            _stanje.update { it.copy(greska = PorukeGresaka.OPSTA, obavjestenje = null) }
            return
        }
        _stanje.update { it.copy(radi = true, greska = null, obavjestenje = null) }
        viewModelScope.launch {
            val ishod = auth.posaljiReset(email)
            _stanje.update {
                if (ishod == IshodAutentikacije.MreznaGreska) it.copy(radi = false, greska = PorukeGresaka.MREZA)
                else it.copy(radi = false, obavjestenje = PorukeGresaka.RESET_POSLAN)
            }
        }
    }

    private fun porukaReautha(ishod: IshodAutentikacije) = when (ishod) {
        IshodAutentikacije.NeispravnaLozinka, IshodAutentikacije.NeispravanEmail -> PorukeGresaka.TRENUTNA_LOZINKA_NEISPRAVNA
        else -> porukaOpsta(ishod)
    }

    private fun porukaOpsta(ishod: IshodAutentikacije) = when (ishod) {
        IshodAutentikacije.MreznaGreska -> PorukeGresaka.MREZA
        IshodAutentikacije.PrevisePokusaja -> PorukeGresaka.PREVISE_POKUSAJA
        else -> PorukeGresaka.OPSTA
    }
}

// AUTH-05 / API-07: ViewModel oko TokBrisanja (stanje i akcije).
class BrisanjeNalogaViewModel(private val tok: TokBrisanja) : ViewModel() {
    val stanje: StateFlow<StanjeBrisanja> = tok.stanje

    init {
        if (tok.nastavak) viewModelScope.launch { tok.pokreniNastavak() }
    }

    fun nastavi() = tok.nastavi()
    fun odustani() = tok.odustani()
    fun potvrdi(lozinka: String) {
        viewModelScope.launch { tok.potvrdi(lozinka) }
    }

    fun ponovi() {
        viewModelScope.launch { tok.ponovi() }
    }
}
