package io.github.anaspasojevic.fuelpoints.domen

import io.github.anaspasojevic.fuelpoints.podaci.api.BackendApi
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

sealed interface StanjeBrisanja {
    // Dijalog upozorenja (korak 1).
    data object Upozorenje : StanjeBrisanja

    // Korak 2 (i TraziPonovnuLozinku sa porukom „Potvrdite lozinku još jednom.”).
    data class UnosLozinke(val poruka: String? = null) : StanjeBrisanja

    data object URadu : StanjeBrisanja

    // Korak 4: Auth nalog je odjavljen; Login prikazuje poruku.
    data class Zavrseno(val porukaZaPrijavu: String) : StanjeBrisanja

    data class MozePonoviti(val poruka: String) : StanjeBrisanja

    // Odustajanje u koracima 1–2: nazad na Profil.
    data object Odustao : StanjeBrisanja
}

// AUTH-05, §23, §23.4, API-07, O-33, O-35, O-48, (v), i10/P-6, i10/P-7. nastavak = true kad tok počinje iz „Nalog se briše”
// (status je već DELETION_IN_PROGRESS, pa je brisanje već pokrenuto).
class TokBrisanja(
    private val auth: IzvorAutentikacije,
    private val api: BackendApi,
    private val zastavica: ZastavicaBrisanja,
    private val porukaZaPrijavu: PorukaZaPrijavu,
    val nastavak: Boolean = false,
) {
    // true kad je DELETE u ovom toku već poslat (ili je tok nastavak): 401 tada znači da Auth nalog više ne postoji.
    private var pokrenut = nastavak

    private val _stanje = MutableStateFlow<StanjeBrisanja>(if (nastavak) StanjeBrisanja.URadu else StanjeBrisanja.Upozorenje)
    val stanje: StateFlow<StanjeBrisanja> = _stanje.asStateFlow()

    // Nastavak već pokrenutog brisanja (i10/P-6): odmah DELETE sa svježim tokenom, bez ponovnog unosa lozinke.
    // 409 REAUTHENTICATION_REQUIRED (prošlo > 5 min) tek tada traži lozinku.
    suspend fun pokreniNastavak() {
        if (nastavak && _stanje.value == StanjeBrisanja.URadu) obrisi()
    }

    fun nastavi() {
        if (_stanje.value == StanjeBrisanja.Upozorenje) _stanje.value = StanjeBrisanja.UnosLozinke()
    }

    // Odustajanje gasi zastavicu (ako je uključena, npr. poslije 409 REAUTHENTICATION_REQUIRED).
    fun odustani() {
        zastavica.iskljuci()
        _stanje.value = StanjeBrisanja.Odustao
    }

    suspend fun potvrdi(lozinka: String) {
        if (lozinka.isEmpty()) {
            _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.UNESITE_LOZINKU)
            return
        }
        _stanje.value = StanjeBrisanja.URadu
        when (auth.potvrdiLozinku(lozinka)) {
            IshodAutentikacije.Uspjeh -> obrisi()
            IshodAutentikacije.NeispravnaLozinka, IshodAutentikacije.NeispravanEmail ->
                _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.LOZINKA_NIJE_ISPRAVNA)
            IshodAutentikacije.MreznaGreska -> _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.MREZA)
            IshodAutentikacije.PrevisePokusaja -> _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.PREVISE_POKUSAJA)
            // i10/P-7: u nastavku brisanja Auth nalog više ne postoji → brisanje je završeno.
            IshodAutentikacije.NepostojeciKorisnik, IshodAutentikacije.OnemogucenKorisnik ->
                if (pokrenut) zavrsi(PorukeGresaka.NALOG_OBRISAN) else _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.OPSTA)
            else -> _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.OPSTA)
        }
    }

    // „Pokušaj ponovo” poslije 503 / mreže / 500: ponovo korak 3 sa svježim tokenom (API klijent traži osvjezi = true).
    suspend fun ponovi() {
        if (_stanje.value is StanjeBrisanja.MozePonoviti) obrisi()
    }

    private suspend fun obrisi() {
        _stanje.value = StanjeBrisanja.URadu
        // Od ovog trenutka API klijent odbija sve druge pozive, a Home ne zove API-06 (v).
        zastavica.ukljuci()
        val bioPokrenut = pokrenut
        when (val rezultat = api.obrisiNalog()) {
            is RezultatApi.Uspjeh -> zavrsi(PorukeGresaka.NALOG_OBRISAN)
            is RezultatApi.GreskaBackenda -> when {
                // O-35: Backend nije ništa pokrenuo; traži se lozinka iznova.
                rezultat.status == 409 && rezultat.kod == "REAUTHENTICATION_REQUIRED" ->
                    _stanje.value = StanjeBrisanja.UnosLozinke(PorukeGresaka.POTVRDITE_LOZINKU)
                rezultat.status == 401 ->
                    if (bioPokrenut) zavrsi(PorukeGresaka.NALOG_OBRISAN) else zavrsi(PorukeGresaka.SESIJA_ISTEKLA)
                else -> {
                    pokrenut = true
                    _stanje.value = StanjeBrisanja.MozePonoviti(PorukeGresaka.BRISANJE_NIJE_ZAVRSENO)
                }
            }
            RezultatApi.MreznaGreska -> {
                pokrenut = true
                _stanje.value = StanjeBrisanja.MozePonoviti(PorukeGresaka.BRISANJE_NIJE_ZAVRSENO)
            }
        }
    }

    // Zastavica se gasi tek poslije odjave.
    private fun zavrsi(poruka: String) {
        porukaZaPrijavu.postavi(poruka)
        auth.odjavi()
        zastavica.iskljuci()
        _stanje.value = StanjeBrisanja.Zavrseno(poruka)
    }
}
