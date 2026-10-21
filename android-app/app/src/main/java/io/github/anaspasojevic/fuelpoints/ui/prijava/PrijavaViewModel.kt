package io.github.anaspasojevic.fuelpoints.ui.prijava

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.PorukaZaPrijavu
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StanjePrijave(
    val email: String = "",
    val lozinka: String = "",
    val greska: String? = null,
    val obavjestenje: String? = null,
    val radi: Boolean = false,
    val odrediste: OdredisteNaloga? = null,
)

// UI-01, §3.5, AUTH-09.
class PrijavaViewModel(
    private val auth: IzvorAutentikacije,
    private val provjera: ProvjeraNaloga,
    porukaZaPrijavu: PorukaZaPrijavu? = null,
) : ViewModel() {

    // Jednokratna poruka poslije brisanja naloga ili isteka sesije (i10).
    private val _stanje = MutableStateFlow(StanjePrijave(obavjestenje = porukaZaPrijavu?.preuzmi()))
    val stanje: StateFlow<StanjePrijave> = _stanje.asStateFlow()

    fun promijeniEmail(email: String) = _stanje.update { it.copy(email = email) }

    fun promijeniLozinku(lozinka: String) = _stanje.update { it.copy(lozinka = lozinka) }

    fun navigacijaObradjena() = _stanje.update { it.copy(odrediste = null) }

    fun prijavi() {
        val (email, lozinka) = _stanje.value.let { it.email.trim() to it.lozinka }
        // Prazno polje je ishod prijave kao i svaki drugi (§3.5), bez poziva Firebase-a.
        if (email.isEmpty() || lozinka.isEmpty()) {
            _stanje.update { it.copy(greska = PorukeGresaka.NEISPRAVNA_PRIJAVA, obavjestenje = null) }
            return
        }
        _stanje.update { it.copy(radi = true, greska = null, obavjestenje = null) }
        viewModelScope.launch {
            when (auth.prijavi(email, lozinka)) {
                IshodAutentikacije.Uspjeh -> poslijePrijave(provjera.odredi())
                IshodAutentikacije.MreznaGreska -> _stanje.update { it.copy(radi = false, greska = PorukeGresaka.MREZA) }
                else -> _stanje.update { it.copy(radi = false, greska = PorukeGresaka.NEISPRAVNA_PRIJAVA) }
            }
        }
    }

    private fun poslijePrijave(odrediste: OdredisteNaloga) = _stanje.update {
        when (odrediste) {
            is OdredisteNaloga.Greska -> it.copy(radi = false, greska = odrediste.poruka)
            OdredisteNaloga.BezMreze -> it.copy(radi = false, greska = PorukeGresaka.MREZA)
            else -> it.copy(radi = false, odrediste = odrediste)
        }
    }

    // AUTH-09: ista poruka bez obzira na to da li nalog postoji; Backend ne učestvuje.
    fun zaboravljenaLozinka() {
        val email = _stanje.value.email.trim()
        if (email.isEmpty()) {
            _stanje.update { it.copy(greska = PorukeGresaka.RESET_PRAZAN_EMAIL, obavjestenje = null) }
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
}
