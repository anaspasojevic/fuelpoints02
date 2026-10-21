package io.github.anaspasojevic.fuelpoints.ui.istorija

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.IshodStranice
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.IzvorKupovina
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Kupovina
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Kursor
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StanjeIstorije(
    val kupovine: List<Kupovina> = emptyList(),
    // „Učitaj starije kupovine” je vidljivo samo kad postoji kursor.
    val sljedeciKursor: Kursor? = null,
    val ucitava: Boolean = false,
    // Prva stranica je stigla (razlikuje „još se učitava” od „nema kupovina”).
    val ucitano: Boolean = false,
    val greska: String? = null,
)

// UI-05, §8.3, §25.4, (e): stranice od po 20, nova stranica = startAfter(posljednji snimak). Samo čitanje.
class IstorijaViewModel(
    private val auth: IzvorAutentikacije,
    private val izvor: IzvorKupovina,
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeIstorije())
    val stanje: StateFlow<StanjeIstorije> = _stanje.asStateFlow()

    // Kursor stranice koja se posljednja tražila (za „Pokušaj ponovo” poslije greške).
    private var kursorZahtjeva: Kursor? = null

    // Otvaranje taba: prva stranica iznova (zamjenjuje učitano).
    fun priOtvaranju() {
        if (_stanje.value.ucitava) return
        ucitaj(kursor = null, zamijeni = true)
    }

    fun ucitajStarije() {
        val s = _stanje.value
        val kursor = s.sljedeciKursor ?: return
        if (s.ucitava) return
        ucitaj(kursor, zamijeni = false)
    }

    // Ista stranica kao ona koja je pala.
    fun ponovi() {
        if (_stanje.value.ucitava) return
        ucitaj(kursorZahtjeva, zamijeni = kursorZahtjeva == null)
    }

    private fun ucitaj(kursor: Kursor?, zamijeni: Boolean) {
        val uid = auth.trenutniUid() ?: return
        kursorZahtjeva = kursor
        _stanje.update { it.copy(ucitava = true, greska = null) }
        viewModelScope.launch {
            when (val ishod = izvor.stranica(uid, kursor)) {
                is IshodStranice.Uspjeh -> _stanje.update {
                    val ranije = if (zamijeni) emptyList() else it.kupovine
                    val poznati = ranije.map { k -> k.id }.toSet()
                    it.copy(
                        kupovine = ranije + ishod.stranica.kupovine.filter { k -> k.id !in poznati },
                        sljedeciKursor = ishod.stranica.sljedeciKursor,
                        ucitava = false,
                        ucitano = true,
                    )
                }
                // Već učitane stavke ostaju.
                IshodStranice.Greska -> _stanje.update { it.copy(ucitava = false, greska = PorukeGresaka.OPSTA) }
            }
        }
    }
}
