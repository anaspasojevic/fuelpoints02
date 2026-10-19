package io.github.anaspasojevic.fuelpoints.ui.registracija

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import io.github.anaspasojevic.fuelpoints.domen.jeIspravnaLozinka
import io.github.anaspasojevic.fuelpoints.domen.jeIspravnoIme
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

// UI-02: tačno pet ulaza; telefon i datum rođenja se ne prikupljaju.
data class UnosRegistracije(
    val displayName: String = "",
    val email: String = "",
    val lozinka: String = "",
    val ponovljenaLozinka: String = "",
    val prihvaceniUslovi: Boolean = false,
)

data class GreskeRegistracije(
    val ime: String? = null,
    val email: String? = null,
    val lozinka: String? = null,
    val ponovljenaLozinka: String? = null,
    val uslovi: String? = null,
) {
    val postoje: Boolean get() = listOf(ime, email, lozinka, ponovljenaLozinka, uslovi).any { it != null }
}

data class StanjeRegistracije(
    val unos: UnosRegistracije = UnosRegistracije(),
    val greske: GreskeRegistracije = GreskeRegistracije(),
    val greska: String? = null,
    val radi: Boolean = false,
    // Poslije kreiranja Auth naloga polja se zaključavaju; ponovni pokušaj radi samo preostale korake.
    val nalogKreiran: Boolean = false,
    val odrediste: OdredisteNaloga? = null,
)

// UI-02, AUTH-01, AUTH-10, §3.6: validacija → createUser → Auth profil (i09/P-3) → API-01.
class RegistracijaViewModel(
    private val auth: IzvorAutentikacije,
    private val provjera: ProvjeraNaloga,
) : ViewModel() {

    private val _stanje = MutableStateFlow(StanjeRegistracije())
    val stanje: StateFlow<StanjeRegistracije> = _stanje.asStateFlow()

    private var imePostavljeno = false

    private fun promijeni(izmjena: (UnosRegistracije) -> UnosRegistracije) {
        if (!_stanje.value.nalogKreiran) _stanje.update { it.copy(unos = izmjena(it.unos)) }
    }

    fun promijeniIme(ime: String) = promijeni { it.copy(displayName = ime) }
    fun promijeniEmail(email: String) = promijeni { it.copy(email = email) }
    fun promijeniLozinku(lozinka: String) = promijeni { it.copy(lozinka = lozinka) }
    fun promijeniPonovljenuLozinku(lozinka: String) = promijeni { it.copy(ponovljenaLozinka = lozinka) }
    fun promijeniUslove(prihvaceni: Boolean) = promijeni { it.copy(prihvaceniUslovi = prihvaceni) }

    fun navigacijaObradjena() = _stanje.update { it.copy(odrediste = null) }

    fun napraviNalog() {
        val unos = _stanje.value.unos
        val greske = provjeri(unos)
        _stanje.update { it.copy(greske = greske, greska = null) }
        if (greske.postoje || _stanje.value.radi) return
        _stanje.update { it.copy(radi = true) }
        viewModelScope.launch { izvrsi(unos) }
    }

    private suspend fun izvrsi(unos: UnosRegistracije) {
        if (!_stanje.value.nalogKreiran) {
            when (auth.registruj(unos.email.trim(), unos.lozinka)) {
                IshodAutentikacije.Uspjeh -> _stanje.update { it.copy(nalogKreiran = true) }
                IshodAutentikacije.EmailZauzet -> return zavrsi(greska = PorukeGresaka.REGISTRACIJA_NIJE_USPJELA)
                IshodAutentikacije.SlabaLozinka -> return zavrsi(greske = GreskeRegistracije(lozinka = PorukeGresaka.LOZINKA))
                IshodAutentikacije.NeispravanEmail -> return zavrsi(greske = GreskeRegistracije(email = PorukeGresaka.EMAIL_NEISPRAVAN))
                IshodAutentikacije.MreznaGreska -> return zavrsi(greska = PorukeGresaka.MREZA)
                else -> return zavrsi(greska = PorukeGresaka.OPSTA)
            }
        }
        if (!imePostavljeno) {
            when (auth.postaviIme(unos.displayName)) {
                IshodAutentikacije.Uspjeh -> imePostavljeno = true
                IshodAutentikacije.MreznaGreska -> return zavrsi(greska = PorukeGresaka.MREZA)
                else -> return zavrsi(greska = PorukeGresaka.OPSTA)
            }
        }
        when (val odrediste = provjera.inicijalizuj(unos.displayName)) {
            is OdredisteNaloga.Greska -> zavrsi(greska = odrediste.poruka)
            else -> _stanje.update { it.copy(radi = false, odrediste = odrediste) }
        }
    }

    private fun zavrsi(greska: String? = null, greske: GreskeRegistracije = GreskeRegistracije()) =
        _stanje.update { it.copy(radi = false, greska = greska, greske = greske) }

    private fun provjeri(unos: UnosRegistracije) = GreskeRegistracije(
        ime = if (jeIspravnoIme(unos.displayName)) null else PorukeGresaka.IME,
        email = if (unos.email.isBlank()) PorukeGresaka.EMAIL_PRAZAN else null,
        lozinka = if (jeIspravnaLozinka(unos.lozinka)) null else PorukeGresaka.LOZINKA,
        ponovljenaLozinka = if (unos.ponovljenaLozinka == unos.lozinka) null else PorukeGresaka.LOZINKE_SE_NE_POKLAPAJU,
        uslovi = if (unos.prihvaceniUslovi) null else PorukeGresaka.USLOVI,
    )
}
