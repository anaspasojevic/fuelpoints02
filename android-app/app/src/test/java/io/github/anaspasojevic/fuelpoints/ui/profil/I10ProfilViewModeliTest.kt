@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.profil

import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IshodUpisaImena
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.BrisanjeUTokuViewModel
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

// I10-T10 (UI-08, §25.2, RULE-T04, AUTH-08, AUTH-09) i I10-T13 (AUTH-07, AC-01, AC-02).
class I10ProfilViewModeliTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije()
    private val nalog = LazniIzvorNaloga()

    // --- Ime ---

    @Test
    fun `I10-T10 neispravno ime - poruka i 0 upisa`() = runTest {
        val vm = ImeViewModel(auth, nalog)
        advanceUntilIdle()
        for (ime in listOf("", "x".repeat(101), "Ana\uD800")) {
            vm.promijeniIme(ime)
            vm.sacuvaj()
            advanceUntilIdle()
            assertEquals(PorukeGresaka.IME, vm.stanje.value.greska)
        }
        assertTrue(nalog.upisanaImena.isEmpty())
    }

    @Test
    fun `I10-T10 ispravno ime - tacno 1 upis za uid`() = runTest {
        val vm = ImeViewModel(auth, nalog)
        advanceUntilIdle()
        vm.promijeniIme("Ana S.")
        vm.sacuvaj()
        advanceUntilIdle()
        assertEquals(listOf("uid-ana" to "Ana S."), nalog.upisanaImena)
        assertEquals(PorukeGresaka.IME_SACUVANO, vm.stanje.value.obavjestenje)
        assertTrue(vm.stanje.value.gotovo)
    }

    @Test
    fun `I10-T10 odbijeno daje IME_NEISPRAVNO, rok daje poruku o vezi`() = runTest {
        val vm = ImeViewModel(auth, nalog)
        advanceUntilIdle()
        vm.promijeniIme("Ana S.")
        nalog.ishodImena = IshodUpisaImena.Odbijeno
        vm.sacuvaj()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.IME_NEISPRAVNO, vm.stanje.value.greska)
        nalog.ishodImena = IshodUpisaImena.NemaVeze
        vm.sacuvaj()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.IME_NA_CEKANJU, vm.stanje.value.obavjestenje)
        assertFalse(vm.stanje.value.gotovo)
    }

    @Test
    fun `I10-T10 ime se predpopunjava iz users`() = runTest {
        val vm = ImeViewModel(auth, nalog)
        advanceUntilIdle()
        assertEquals("Ana", vm.stanje.value.ime)
    }

    // --- Lozinka ---

    private fun LozinkaViewModel.unesi(trenutna: String, nova: String, ponovljena: String) {
        promijeniTrenutnu(trenutna)
        promijeniNovu(nova)
        promijeniPonovljenu(ponovljena)
        promijeni()
    }

    @Test
    fun `I10-T10 neispravan unos lozinke - poruka i 0 Auth poziva`() = runTest {
        val vm = LozinkaViewModel(auth)
        vm.unesi("", "Lozinka2", "Lozinka2")
        assertEquals(PorukeGresaka.UNESITE_TRENUTNU_LOZINKU, vm.stanje.value.greska)
        for (nova in listOf("lozinka2", "Lozinkaa", "Loz1", "Lozink1")) {
            vm.unesi("Lozinka1", nova, nova)
            assertEquals(nova, PorukeGresaka.LOZINKA, vm.stanje.value.greska)
        }
        vm.unesi("Lozinka1", "Lozinka2", "Lozinka3")
        assertEquals(PorukeGresaka.LOZINKE_SE_NE_POKLAPAJU, vm.stanje.value.greska)
        advanceUntilIdle()
        assertTrue(auth.pozivi.isEmpty())
    }

    @Test
    fun `I10-T10 ispravan unos - reauth pa promjena, sesija ostaje`() = runTest {
        val vm = LozinkaViewModel(auth)
        vm.unesi("Lozinka1", "Lozinka2", "Lozinka2")
        advanceUntilIdle()
        assertEquals(listOf("potvrdiLozinku:Lozinka1", "promijeniLozinku:Lozinka2"), auth.pozivi)
        assertEquals(PorukeGresaka.LOZINKA_PROMIJENJENA, vm.stanje.value.obavjestenje)
        assertEquals("uid-ana", auth.trenutniUid())
    }

    @Test
    fun `I10-T10 pogresna trenutna lozinka - poruka i 0 promijeniLozinku`() = runTest {
        auth.ishodPotvrde = IshodAutentikacije.NeispravnaLozinka
        val vm = LozinkaViewModel(auth)
        vm.unesi("Pogresna1", "Lozinka2", "Lozinka2")
        advanceUntilIdle()
        assertEquals(PorukeGresaka.TRENUTNA_LOZINKA_NEISPRAVNA, vm.stanje.value.greska)
        assertEquals(listOf("potvrdiLozinku:Pogresna1"), auth.pozivi)
    }

    @Test
    fun `I10-T10 slaba lozinka (Firebase) daje LOZINKA, previse pokusaja i mreza imaju poruke`() = runTest {
        val vm = LozinkaViewModel(auth)
        auth.ishodPromjeneLozinke = IshodAutentikacije.SlabaLozinka
        vm.unesi("Lozinka1", "Lozinka2", "Lozinka2")
        advanceUntilIdle()
        assertEquals(PorukeGresaka.LOZINKA, vm.stanje.value.greska)
        auth.ishodPotvrde = IshodAutentikacije.PrevisePokusaja
        vm.promijeni()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.PREVISE_POKUSAJA, vm.stanje.value.greska)
        auth.ishodPotvrde = IshodAutentikacije.MreznaGreska
        vm.promijeni()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.MREZA, vm.stanje.value.greska)
    }

    @Test
    fun `I10-T10 reset link koristi Auth e-mail, neutralna poruka za uspjeh i ne-mreznu gresku`() = runTest {
        val vm = LozinkaViewModel(auth)
        vm.posaljiReset()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.RESET_POSLAN, vm.stanje.value.obavjestenje)
        auth.ishodReseta = IshodAutentikacije.NepostojeciKorisnik
        vm.posaljiReset()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.RESET_POSLAN, vm.stanje.value.obavjestenje)
        auth.ishodReseta = IshodAutentikacije.MreznaGreska
        vm.posaljiReset()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.MREZA, vm.stanje.value.greska)
        assertEquals(3, auth.pozivi.count { it == "posaljiReset" })
    }

    // --- Odjava (I10-T13) ---

    @Test
    fun `I10-T13 odjava iz Profila - signOut 1x, 0 Backend poziva, 0 upisa`() = runTest {
        val api = LazniBackendApi()
        val vm = ProfilViewModel(auth, nalog)
        advanceUntilIdle()
        assertEquals("ana@primjer.ba", vm.stanje.value.email)
        vm.odjavi()
        advanceUntilIdle()
        assertEquals(1, auth.pozivi.count { it == "odjavi" })
        assertTrue(api.pozivi.isEmpty())
        assertTrue(nalog.upisanaImena.isEmpty())
        assertTrue(vm.stanje.value.izlazNaPrijavu)
        assertNull(auth.trenutniUid())
    }

    @Test
    fun `I10-T13 odjava iz ekrana Nalog se brise - signOut 1x i izlaz na prijavu`() = runTest {
        val vm = BrisanjeUTokuViewModel(auth)
        vm.odjavi()
        assertEquals(1, auth.pozivi.count { it == "odjavi" })
        assertTrue(vm.izlazNaPrijavu.value)
    }
}
