package io.github.anaspasojevic.fuelpoints.domen

import io.github.anaspasojevic.fuelpoints.podaci.api.BackendApi
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta

sealed interface OdredisteNaloga {
    data object Prijava : OdredisteNaloga
    data object Pocetna : OdredisteNaloga
    data object DovrsetakRegistracije : OdredisteNaloga
    data object BrisanjeUToku : OdredisteNaloga
    data object BezMreze : OdredisteNaloga
    data class Greska(val poruka: String) : OdredisteNaloga
}

// AUTH-06, AUTH-03 (O-42, i09/P-3), AUTH-05 (O-43, (v)): kuda poslije pokretanja, prijave ili registracije.
class ProvjeraNaloga(
    private val auth: IzvorAutentikacije,
    private val nalog: IzvorNaloga,
    private val api: BackendApi,
    private val verzijaUslova: String = VERZIJA_USLOVA,
) {

    suspend fun odredi(): OdredisteNaloga {
        val uid = auth.trenutniUid() ?: return OdredisteNaloga.Prijava
        return when (val korisnik = nalog.procitajKorisnika(uid)) {
            is StanjeDokumenta.Postoji -> when (korisnik.podaci.accountStatus) {
                "ACTIVE" -> OdredisteNaloga.Pocetna
                // (v): za vrijeme brisanja init se ne poziva.
                "DELETION_IN_PROGRESS" -> OdredisteNaloga.BrisanjeUToku
                else -> OdredisteNaloga.Greska(PorukeGresaka.OPSTA)
            }
            // AUTH-03 samo kad je odsustvo potvrdio server; keš ili greška znače da se ne zna.
            is StanjeDokumenta.NePostoji -> if (korisnik.izKesa) OdredisteNaloga.BezMreze else ponovniInit()
            StanjeDokumenta.Greska -> OdredisteNaloga.BezMreze
        }
    }

    // AUTH-03: ime iz Auth profila (upisano pri registraciji sa prihvaćenim uslovima); inače forma „Dovršite registraciju”.
    private suspend fun ponovniInit(): OdredisteNaloga {
        val ime = auth.imeIzProfila()
        if (ime == null || !jeIspravnoIme(ime)) return OdredisteNaloga.DovrsetakRegistracije
        return inicijalizuj(ime)
    }

    // API-01 (AUTH-01, AUTH-10); 503 ponavlja već API klijent (R-04).
    suspend fun inicijalizuj(displayName: String): OdredisteNaloga =
        when (val rezultat = api.inicijalizujNalog(displayName, verzijaUslova)) {
            is RezultatApi.Uspjeh -> OdredisteNaloga.Pocetna
            RezultatApi.MreznaGreska -> OdredisteNaloga.Greska(PorukeGresaka.MREZA)
            is RezultatApi.GreskaBackenda -> when (rezultat.kod) {
                "ACCOUNT_DELETION_IN_PROGRESS" -> OdredisteNaloga.BrisanjeUToku
                "INVALID_DISPLAY_NAME" -> OdredisteNaloga.DovrsetakRegistracije
                else -> OdredisteNaloga.Greska(PorukeGresaka.zaKod(rezultat.kod))
            }
        }

    companion object {
        // O-11; isto kao BuildConfig.VERZIJA_USLOVA.
        const val VERZIJA_USLOVA = "1.0"
    }
}
