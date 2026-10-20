@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.prijava

import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

class I09T04T05PrijavaViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije(uid = null)
    private val vm = PrijavaViewModel(auth, ProvjeraNaloga(auth, LazniIzvorNaloga(), LazniBackendApi()))

    private fun unesi(email: String, lozinka: String) {
        vm.promijeniEmail(email)
        vm.promijeniLozinku(lozinka)
    }

    // I09-T04 (UI-01, §3.5): svaki ishod prijave osim mrežne greške daje TAČNO istu poruku.
    @Test
    fun `I09-T04 svaki neuspjeh prijave osim mreze daje poruku §3_5`() = runTest {
        val ishodi = listOf(
            IshodAutentikacije.NeispravnaLozinka,
            IshodAutentikacije.NepostojeciKorisnik,
            IshodAutentikacije.OnemogucenKorisnik,
            IshodAutentikacije.PrevisePokusaja,
            IshodAutentikacije.NeispravanEmail,
            IshodAutentikacije.NepoznataGreska,
        )
        for (ishod in ishodi) {
            auth.ishodPrijave = ishod
            unesi("ana@primjer.ba", "Lozinka1")
            vm.prijavi()
            advanceUntilIdle()
            assertEquals("ishod $ishod", "E-mail adresa ili lozinka nisu ispravni.", vm.stanje.value.greska)
            assertNull(vm.stanje.value.odrediste)
        }
    }

    @Test
    fun `I09-T04 prazno polje - poruka §3_5 bez Firebase poziva`() = runTest {
        unesi("", "Lozinka1")
        vm.prijavi()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.NEISPRAVNA_PRIJAVA, vm.stanje.value.greska)
        unesi("ana@primjer.ba", "")
        vm.prijavi()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.NEISPRAVNA_PRIJAVA, vm.stanje.value.greska)
        assertEquals(emptyList<String>(), auth.pozivi)
    }

    @Test
    fun `I09-T04 mrezna greska ima posebnu poruku`() = runTest {
        auth.ishodPrijave = IshodAutentikacije.MreznaGreska
        unesi("ana@primjer.ba", "Lozinka1")
        vm.prijavi()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.MREZA, vm.stanje.value.greska)
        assertNotEquals(PorukeGresaka.NEISPRAVNA_PRIJAVA, vm.stanje.value.greska)
    }

    @Test
    fun `I09-T04 uspjesna prijava vodi kroz provjeru naloga na Pocetnu`() = runTest {
        auth.ishodPrijave = IshodAutentikacije.Uspjeh
        auth.sesija.value = "uid-ana"
        unesi("ana@primjer.ba", "Lozinka1")
        vm.prijavi()
        advanceUntilIdle()
        assertEquals(OdredisteNaloga.Pocetna, vm.stanje.value.odrediste)
        assertNull(vm.stanje.value.greska)
    }

    // I09-T05 (AUTH-09): odgovor ne otkriva da li e-mail postoji.
    @Test
    fun `I09-T05 reset daje istu neutralnu poruku za svaki ne-mrezni ishod`() = runTest {
        val ishodi = listOf(
            IshodAutentikacije.Uspjeh,
            IshodAutentikacije.NepostojeciKorisnik,
            IshodAutentikacije.NeispravanEmail,
            IshodAutentikacije.NepoznataGreska,
        )
        for (ishod in ishodi) {
            auth.ishodReseta = ishod
            unesi("ana@primjer.ba", "")
            vm.zaboravljenaLozinka()
            advanceUntilIdle()
            assertEquals("ishod $ishod", PorukeGresaka.RESET_POSLAN, vm.stanje.value.obavjestenje)
            assertNull(vm.stanje.value.greska)
        }
    }

    @Test
    fun `I09-T05 reset - mreza daje mreznu poruku, prazno polje 0 poziva`() = runTest {
        auth.ishodReseta = IshodAutentikacije.MreznaGreska
        unesi("ana@primjer.ba", "")
        vm.zaboravljenaLozinka()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.MREZA, vm.stanje.value.greska)

        auth.pozivi.clear()
        unesi("", "")
        vm.zaboravljenaLozinka()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.RESET_PRAZAN_EMAIL, vm.stanje.value.greska)
        assertEquals(emptyList<String>(), auth.pozivi)
    }
}
