package io.github.anaspasojevic.fuelpoints.domen

import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// I10-T12 (AUTH-05, §23.4, API-07, O-48, (v), i10/P-6, i10/P-7).
class I10T12TokBrisanjaTest {

    private val auth = LazniIzvorAutentikacije()
    private val api = LazniBackendApi()
    private val zastavica = ZastavicaBrisanja()
    private val poruka = PorukaZaPrijavu()

    private fun tok(nastavak: Boolean = false) = TokBrisanja(auth, api, zastavica, poruka, nastavak)

    private fun greska(kod: String?, status: Int) = RezultatApi.GreskaBackenda(kod, status)

    private fun brojObrisi() = api.pozivi.count { it == "obrisi" }

    private fun nijedanDrugiPoziv() = api.pozivi.none { it == "reconcile" || it.startsWith("init:") }

    @Test
    fun `I10-T12 Odustani na upozorenju - 0 poziva`() = runTest {
        val t = tok()
        assertEquals(StanjeBrisanja.Upozorenje, t.stanje.value)
        t.odustani()
        assertEquals(StanjeBrisanja.Odustao, t.stanje.value)
        assertTrue(auth.pozivi.isEmpty())
        assertTrue(api.pozivi.isEmpty())
        assertFalse(zastavica.jeUkljucena())
    }

    @Test
    fun `I10-T12 prazna lozinka - poruka i 0 reauth poziva`() = runTest {
        val t = tok()
        t.nastavi()
        t.potvrdi("")
        assertEquals(StanjeBrisanja.UnosLozinke(PorukeGresaka.UNESITE_LOZINKU), t.stanje.value)
        assertTrue(auth.pozivi.isEmpty())
    }

    @Test
    fun `I10-T12 pogresna lozinka - poruka i 0 DELETE`() = runTest {
        auth.ishodPotvrde = IshodAutentikacije.NeispravnaLozinka
        val t = tok()
        t.nastavi()
        t.potvrdi("Pogresna1")
        assertEquals(StanjeBrisanja.UnosLozinke(PorukeGresaka.LOZINKA_NIJE_ISPRAVNA), t.stanje.value)
        assertEquals(0, brojObrisi())
        assertFalse(zastavica.jeUkljucena())
    }

    @Test
    fun `I10-T12 204 - odjava 1x pa Zavrseno, zastavica se gasi tek poslije odjave`() = runTest {
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.Zavrseno(PorukeGresaka.NALOG_OBRISAN), t.stanje.value)
        assertEquals(1, auth.pozivi.count { it == "odjavi" })
        assertFalse(zastavica.jeUkljucena())
        assertEquals(PorukeGresaka.NALOG_OBRISAN, poruka.preuzmi())
        assertEquals(1, brojObrisi())
        assertTrue(nijedanDrugiPoziv())
    }

    @Test
    fun `I10-T12 409 REAUTHENTICATION_REQUIRED - nova lozinka, drugi DELETE, 204`() = runTest {
        api.odgovoriBrisanja += greska("REAUTHENTICATION_REQUIRED", 409)
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.UnosLozinke(PorukeGresaka.POTVRDITE_LOZINKU), t.stanje.value)
        assertTrue(zastavica.jeUkljucena())
        t.potvrdi("Lozinka1")
        assertEquals(2, brojObrisi())
        assertTrue(t.stanje.value is StanjeBrisanja.Zavrseno)
        assertTrue(nijedanDrugiPoziv())
    }

    @Test
    fun `I10-T12 503 - MozePonoviti, ponavljanje pravi drugi DELETE`() = runTest {
        api.odgovoriBrisanja += greska("SERVICE_UNAVAILABLE", 503)
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.MozePonoviti(PorukeGresaka.BRISANJE_NIJE_ZAVRSENO), t.stanje.value)
        assertTrue(zastavica.jeUkljucena())
        t.ponovi()
        assertEquals(2, brojObrisi())
        assertTrue(t.stanje.value is StanjeBrisanja.Zavrseno)
    }

    @Test
    fun `I10-T12 mreza pa 401 - Zavrseno (DELETE je vec bio poslat)`() = runTest {
        api.odgovoriBrisanja += RezultatApi.MreznaGreska
        api.odgovoriBrisanja += greska("UNAUTHENTICATED", 401)
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertTrue(t.stanje.value is StanjeBrisanja.MozePonoviti)
        t.ponovi()
        assertEquals(StanjeBrisanja.Zavrseno(PorukeGresaka.NALOG_OBRISAN), t.stanje.value)
        assertEquals(1, auth.pozivi.count { it == "odjavi" })
    }

    @Test
    fun `I10-T12 401 na prvom DELETE-u - istekla sesija`() = runTest {
        api.odgovoriBrisanja += greska("UNAUTHENTICATED", 401)
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.Zavrseno(PorukeGresaka.SESIJA_ISTEKLA), t.stanje.value)
        assertEquals(1, auth.pozivi.count { it == "odjavi" })
        assertFalse(zastavica.jeUkljucena())
    }

    @Test
    fun `I10-T12 nastavak iz BrisanjeUToku sa 401 - Zavrseno`() = runTest {
        api.odgovoriBrisanja += greska("UNAUTHENTICATED", 401)
        val t = tok(nastavak = true)
        assertEquals(StanjeBrisanja.UnosLozinke(), t.stanje.value)
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.Zavrseno(PorukeGresaka.NALOG_OBRISAN), t.stanje.value)
    }

    @Test
    fun `I10-T12 nastavak sa reauth NepostojeciKorisnik - Zavrseno, 0 DELETE`() = runTest {
        auth.ishodPotvrde = IshodAutentikacije.NepostojeciKorisnik
        val t = tok(nastavak = true)
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.Zavrseno(PorukeGresaka.NALOG_OBRISAN), t.stanje.value)
        assertEquals(0, brojObrisi())
        assertEquals(1, auth.pozivi.count { it == "odjavi" })
    }

    @Test
    fun `I10-T12 reauth NepostojeciKorisnik u svjezem toku nije Zavrseno`() = runTest {
        auth.ishodPotvrde = IshodAutentikacije.NepostojeciKorisnik
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertEquals(StanjeBrisanja.UnosLozinke(PorukeGresaka.OPSTA), t.stanje.value)
        assertEquals(0, auth.pozivi.count { it == "odjavi" })
    }

    @Test
    fun `I10-T12 500 i ostali kodovi - MozePonoviti`() = runTest {
        api.odgovoriBrisanja += greska("INTERNAL_ERROR", 500)
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertTrue(t.stanje.value is StanjeBrisanja.MozePonoviti)
    }

    @Test
    fun `I10-T12 odustajanje poslije 409 gasi zastavicu`() = runTest {
        api.odgovoriBrisanja += greska("REAUTHENTICATION_REQUIRED", 409)
        val t = tok()
        t.nastavi()
        t.potvrdi("Lozinka1")
        assertTrue(zastavica.jeUkljucena())
        t.odustani()
        assertFalse(zastavica.jeUkljucena())
        assertEquals(StanjeBrisanja.Odustao, t.stanje.value)
    }
}
