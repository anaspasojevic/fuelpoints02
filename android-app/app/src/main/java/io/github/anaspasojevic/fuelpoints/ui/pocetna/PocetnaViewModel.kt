package io.github.anaspasojevic.fuelpoints.ui.pocetna

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.ZastavicaBrisanja
import io.github.anaspasojevic.fuelpoints.podaci.api.BackendApi
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface IzlazSaPocetne {
    // AUTH-03 tok preko ekrana pokretanja.
    data object Pokretanje : IzlazSaPocetne
    data object Prijava : IzlazSaPocetne
    data object BrisanjeUToku : IzlazSaPocetne
}

data class StanjePocetne(
    val ime: String? = null,
    val bodovi: Long? = null,
    val rezervisano: Long? = null,
    val stanjeNedostupno: Boolean = false,
    // NFR-08: metadata.isFromCache snimka loyaltyAccounts/{uid}.
    val izKesa: Boolean = false,
    val izlaz: IzlazSaPocetne? = null,
) {
    val prikaziRezervisano: Boolean get() = (rezervisano ?: 0) > 0
}

// UI-03, §18, O-41, O-43, NFR-08. Bodovi dolaze samo iz Firestore snimka; ništa se ne računa lokalno.
class PocetnaViewModel(
    private val auth: IzvorAutentikacije,
    private val nalog: IzvorNaloga,
    private val api: BackendApi,
    private val zastavica: ZastavicaBrisanja = ZastavicaBrisanja(),
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjePocetne())
    val stanje: StateFlow<StanjePocetne> = _stanje.asStateFlow()

    init {
        val uid = auth.trenutniUid()
        if (uid == null) {
            izadji(IzlazSaPocetne.Prijava)
        } else {
            viewModelScope.launch {
                auth.posmatrajSesiju().collect { if (it == null) izadji(IzlazSaPocetne.Prijava) }
            }
            viewModelScope.launch {
                nalog.posmatrajKorisnika(uid).collect { snimak ->
                    when (snimak) {
                        is StanjeDokumenta.Postoji -> {
                            _stanje.update { it.copy(ime = snimak.podaci.displayName) }
                            // (v): dok traje tok brisanja naloga, Home ne navigira na „Nalog se briše”.
                            if (snimak.podaci.accountStatus == "DELETION_IN_PROGRESS" && !zastavica.jeUkljucena()) izadji(IzlazSaPocetne.BrisanjeUToku)
                        }
                        is StanjeDokumenta.NePostoji -> if (!snimak.izKesa) izadji(IzlazSaPocetne.Pokretanje)
                        StanjeDokumenta.Greska -> Unit
                    }
                }
            }
            viewModelScope.launch {
                nalog.posmatrajLoyaltyNalog(uid).collect { snimak ->
                    when (snimak) {
                        is StanjeDokumenta.Postoji -> {
                            val dostupni = snimak.podaci.availablePoints?.takeIf { it >= 0 }
                            val rezervisani = snimak.podaci.reservedPoints?.takeIf { it >= 0 }
                            _stanje.update {
                                it.copy(
                                    bodovi = dostupni,
                                    rezervisano = rezervisani,
                                    stanjeNedostupno = dostupni == null || rezervisani == null,
                                    izKesa = snimak.izKesa,
                                )
                            }
                        }
                        is StanjeDokumenta.NePostoji -> {
                            _stanje.update { it.copy(izKesa = snimak.izKesa) }
                            if (!snimak.izKesa) izadji(IzlazSaPocetne.Pokretanje)
                        }
                        StanjeDokumenta.Greska -> _stanje.update { it.copy(stanjeNedostupno = true) }
                    }
                }
            }
        }
    }

    // O-43: API-06 pri svakom otvaranju Home-a; greška ne blokira prikaz i ne prikazuje se.
    fun priOtvaranju() {
        // (v): za vrijeme brisanja naloga nema drugih poziva.
        if (zastavica.jeUkljucena()) return
        viewModelScope.launch {
            val rezultat = api.uskladiVaucere()
            if (rezultat is RezultatApi.GreskaBackenda) {
                when (rezultat.kod) {
                    "ACCOUNT_NOT_INITIALIZED" -> izadji(IzlazSaPocetne.Pokretanje)
                    "ACCOUNT_DELETION_IN_PROGRESS" -> izadji(IzlazSaPocetne.BrisanjeUToku)
                }
            }
        }
    }

    fun izlazObradjen() = _stanje.update { it.copy(izlaz = null) }

    private fun izadji(izlaz: IzlazSaPocetne) = _stanje.update { it.copy(izlaz = izlaz) }
}
