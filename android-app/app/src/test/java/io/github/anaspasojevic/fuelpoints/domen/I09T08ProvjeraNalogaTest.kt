package io.github.anaspasojevic.fuelpoints.domen

import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.nalog.Korisnik
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test

// I09-T08 (AUTH-06, AUTH-03, AUTH-05, (v), O-42, i09/P-3): odluka poslije pokretanja, prijave i registracije.
class I09T08ProvjeraNalogaTest {

    private val auth = LazniIzvorAutentikacije()
    private val nalog = LazniIzvorNaloga()
    private val api = LazniBackendApi()
    private val provjera = ProvjeraNaloga(auth, nalog, api)

    @Test
    fun `I09-T08 bez Auth sesije - Prijava`() = runTest {
        auth.sesija.value = null
        assertEquals(OdredisteNaloga.Prijava, provjera.odredi())
        assertEquals(0, nalog.brojCitanja)
    }

    @Test
    fun `I09-T08 AUTH-06 ACTIVE - Pocetna bez prijave i bez init-a`() = runTest {
        assertEquals(OdredisteNaloga.Pocetna, provjera.odredi())
        assertEquals(0, api.brojInita)
        assertEquals(emptyList<String>(), auth.pozivi)
    }

    @Test
    fun `I09-T08 AUTH-06 ACTIVE iz kesa - Pocetna`() = runTest {
        nalog.citanje = StanjeDokumenta.Postoji(Korisnik("Ana", "ACTIVE"), izKesa = true)
        assertEquals(OdredisteNaloga.Pocetna, provjera.odredi())
    }

    @Test
    fun `I09-T08 AUTH-03 nema users na serveru, ime iz Auth profila - init(Ana, 1_0) i Pocetna`() = runTest {
        nalog.citanje = StanjeDokumenta.NePostoji(izKesa = false)
        assertEquals(OdredisteNaloga.Pocetna, provjera.odredi())
        assertEquals(listOf("init:Ana:1.0"), api.pozivi)
    }

    @Test
    fun `I09-T08 AUTH-03 bez imena u profilu - DovrsetakRegistracije bez init-a`() = runTest {
        nalog.citanje = StanjeDokumenta.NePostoji(izKesa = false)
        auth.ime = null
        assertEquals(OdredisteNaloga.DovrsetakRegistracije, provjera.odredi())
        auth.ime = "a".repeat(101)
        assertEquals(OdredisteNaloga.DovrsetakRegistracije, provjera.odredi())
        assertEquals(0, api.brojInita)
    }

    @Test
    fun `I09-T08 DELETION_IN_PROGRESS - BrisanjeUToku bez init-a`() = runTest {
        nalog.citanje = StanjeDokumenta.Postoji(Korisnik("Ana", "DELETION_IN_PROGRESS"), izKesa = false)
        assertEquals(OdredisteNaloga.BrisanjeUToku, provjera.odredi())
        assertEquals(0, api.brojInita)
    }

    @Test
    fun `I09-T08 init 409 ACCOUNT_DELETION_IN_PROGRESS - BrisanjeUToku`() = runTest {
        nalog.citanje = StanjeDokumenta.NePostoji(izKesa = false)
        api.odgovoriInita += RezultatApi.GreskaBackenda("ACCOUNT_DELETION_IN_PROGRESS", 409)
        assertEquals(OdredisteNaloga.BrisanjeUToku, provjera.odredi())
    }

    @Test
    fun `I09-T08 init 422 INVALID_DISPLAY_NAME - DovrsetakRegistracije`() = runTest {
        nalog.citanje = StanjeDokumenta.NePostoji(izKesa = false)
        api.odgovoriInita += RezultatApi.GreskaBackenda("INVALID_DISPLAY_NAME", 422)
        assertEquals(OdredisteNaloga.DovrsetakRegistracije, provjera.odredi())
    }

    @Test
    fun `I09-T08 init 503 ili mreza - Greska sa porukom`() = runTest {
        nalog.citanje = StanjeDokumenta.NePostoji(izKesa = false)
        api.odgovoriInita += RezultatApi.GreskaBackenda("SERVICE_UNAVAILABLE", 503)
        assertEquals(OdredisteNaloga.Greska(PorukeGresaka.SERVIS_NEDOSTUPAN), provjera.odredi())
        api.odgovoriInita += RezultatApi.MreznaGreska
        assertEquals(OdredisteNaloga.Greska(PorukeGresaka.MREZA), provjera.odredi())
    }

    @Test
    fun `I09-T08 offline bez kesa - BezMreze`() = runTest {
        nalog.citanje = StanjeDokumenta.Greska
        assertEquals(OdredisteNaloga.BezMreze, provjera.odredi())
        nalog.citanje = StanjeDokumenta.NePostoji(izKesa = true)
        assertEquals(OdredisteNaloga.BezMreze, provjera.odredi())
        assertEquals(0, api.brojInita)
    }

    @Test
    fun `I09-T08 accountStatus van enum-a - Greska`() = runTest {
        nalog.citanje = StanjeDokumenta.Postoji(Korisnik("Ana", "NEPOZNAT"), izKesa = false)
        assertEquals(OdredisteNaloga.Greska(PorukeGresaka.OPSTA), provjera.odredi())
        assertEquals(0, api.brojInita)
    }
}
