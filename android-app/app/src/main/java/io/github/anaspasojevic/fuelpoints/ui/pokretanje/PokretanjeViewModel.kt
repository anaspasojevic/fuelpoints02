package io.github.anaspasojevic.fuelpoints.ui.pokretanje

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StanjePokretanja(
    val radi: Boolean = true,
    val poruka: String? = null,
    val odrediste: OdredisteNaloga? = null,
)

// AUTH-06 (obnova sesije) i AUTH-03 pri pokretanju; BezMreze i Greska ostaju na ovom ekranu sa „Pokušaj ponovo”.
class PokretanjeViewModel(private val provjera: ProvjeraNaloga) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjePokretanja())
    val stanje: StateFlow<StanjePokretanja> = _stanje.asStateFlow()

    init {
        provjeri()
    }

    fun provjeri() {
        _stanje.value = StanjePokretanja()
        viewModelScope.launch {
            _stanje.value = when (val odrediste = provjera.odredi()) {
                OdredisteNaloga.BezMreze -> StanjePokretanja(radi = false, poruka = PorukeGresaka.MREZA)
                is OdredisteNaloga.Greska -> StanjePokretanja(radi = false, poruka = odrediste.poruka)
                else -> StanjePokretanja(radi = false, odrediste = odrediste)
            }
        }
    }

    fun navigacijaObradjena() = _stanje.update { it.copy(odrediste = null) }
}
