package io.github.anaspasojevic.fuelpoints.ui.pokretanje

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import io.github.anaspasojevic.fuelpoints.domen.jeIspravnoIme
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StanjeDovrsetka(
    val ime: String = "",
    val prihvaceniUslovi: Boolean = false,
    val greskaImena: String? = null,
    val greskaUslova: String? = null,
    val greska: String? = null,
    val radi: Boolean = false,
    val odrediste: OdredisteNaloga? = null,
)

// i09/P-3 rezerva: forma „Dovršite registraciju” (ime + prihvatanje uslova) → API-01.
class DovrsetakRegistracijeViewModel(private val provjera: ProvjeraNaloga) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeDovrsetka())
    val stanje: StateFlow<StanjeDovrsetka> = _stanje.asStateFlow()

    fun promijeniIme(ime: String) = _stanje.update { it.copy(ime = ime) }

    fun promijeniUslove(prihvaceni: Boolean) = _stanje.update { it.copy(prihvaceniUslovi = prihvaceni) }

    fun navigacijaObradjena() = _stanje.update { it.copy(odrediste = null) }

    fun potvrdi() {
        val trenutno = _stanje.value
        val greskaImena = if (jeIspravnoIme(trenutno.ime)) null else PorukeGresaka.IME
        val greskaUslova = if (trenutno.prihvaceniUslovi) null else PorukeGresaka.USLOVI
        _stanje.update { it.copy(greskaImena = greskaImena, greskaUslova = greskaUslova, greska = null) }
        if (greskaImena != null || greskaUslova != null || trenutno.radi) return
        _stanje.update { it.copy(radi = true) }
        viewModelScope.launch {
            val odrediste = provjera.inicijalizuj(trenutno.ime)
            _stanje.update {
                when (odrediste) {
                    is OdredisteNaloga.Greska -> it.copy(radi = false, greska = odrediste.poruka)
                    OdredisteNaloga.DovrsetakRegistracije -> it.copy(radi = false, greskaImena = PorukeGresaka.IME_NEISPRAVNO)
                    else -> it.copy(radi = false, odrediste = odrediste)
                }
            }
        }
    }
}
