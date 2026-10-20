package io.github.anaspasojevic.fuelpoints.ui.obavjestenja

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import io.github.anaspasojevic.fuelpoints.podaci.obavjestenja.IzvorObavjestenja
import io.github.anaspasojevic.fuelpoints.podaci.obavjestenja.Obavjestenje
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class StanjeObavjestenja(
    val obavjestenja: List<Obavjestenje> = emptyList(),
    val ucitano: Boolean = false,
    val greska: Boolean = false,
    val izlazNaPrijavu: Boolean = false,
)

// UI-07, §21, §25.8, RULE-T10, i10/P-3: lista do 50 najnovijih bez paginacije i grupisanja. Jedini upis: readAt na pojedinačnoj stavci.
class ObavjestenjaViewModel(
    private val auth: IzvorAutentikacije,
    private val izvor: IzvorObavjestenja,
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeObavjestenja())
    val stanje: StateFlow<StanjeObavjestenja> = _stanje.asStateFlow()

    // ID-evi za koje je upis readAt poslat (dvostruki tap pravi tačno jedan upis).
    private val poslata = mutableSetOf<String>()

    init {
        val uid = auth.trenutniUid()
        if (uid == null) {
            _stanje.update { it.copy(izlazNaPrijavu = true) }
        } else {
            viewModelScope.launch {
                auth.posmatrajSesiju().collect { if (it == null) _stanje.update { s -> s.copy(izlazNaPrijavu = true) } }
            }
            viewModelScope.launch {
                izvor.posmatraj(uid).collect { snimak ->
                    when (snimak) {
                        is StanjeDokumenta.Postoji -> _stanje.update { it.copy(obavjestenja = snimak.podaci, ucitano = true, greska = false) }
                        StanjeDokumenta.Greska -> _stanje.update { it.copy(greska = true) }
                        is StanjeDokumenta.NePostoji -> Unit
                    }
                }
            }
        }
    }

    // „Otvaranje” stavke (§21.2): readAt samo za nju i samo kad je readAt == null.
    fun otvori(id: String) {
        val stavka = _stanje.value.obavjestenja.firstOrNull { it.id == id } ?: return
        if (stavka.procitano || !poslata.add(id)) return
        viewModelScope.launch {
            // Greška upisa se ne prikazuje; stavka ostaje nepročitana do sljedećeg tapa.
            if (!izvor.oznaciProcitano(id)) poslata.remove(id)
        }
    }
}
