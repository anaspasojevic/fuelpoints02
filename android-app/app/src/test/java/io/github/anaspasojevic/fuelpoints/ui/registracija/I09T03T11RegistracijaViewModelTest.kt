@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.registracija

import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import java.lang.reflect.Modifier

class I09T03T11RegistracijaViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije(uid = null, ime = null)
    private val api = LazniBackendApi()
    private val vm = RegistracijaViewModel(auth, ProvjeraNaloga(auth, LazniIzvorNaloga(), api))

    private fun unesi(
        ime: String = "Ana",
        email: String = "ana@primjer.ba",
        lozinka: String = "Lozinka1",
        ponovljena: String = lozinka,
        uslovi: Boolean = true,
    ) {
        vm.promijeniIme(ime)
        vm.promijeniEmail(email)
        vm.promijeniLozinku(lozinka)
        vm.promijeniPonovljenuLozinku(ponovljena)
        vm.promijeniUslove(uslovi)
    }

    // I09-T03 (UI-02, AUTH-10, §3.6): lokalna validacija zaustavlja tok prije Firebase-a i Backend-a.
    @Test
    fun `I09-T03 neispravan unos - poruke ispod polja i 0 poziva createUser i init`() = runTest {
        unesi(ime = "a".repeat(101), email = "", lozinka = "Lozinka", ponovljena = "Lozinka2", uslovi = false)
        vm.napraviNalog()
        advanceUntilIdle()
        val greske = vm.stanje.value.greske
        assertEquals(PorukeGresaka.IME, greske.ime)
        assertEquals(PorukeGresaka.EMAIL_PRAZAN, greske.email)
        assertEquals(PorukeGresaka.LOZINKA, greske.lozinka)
        assertEquals(PorukeGresaka.LOZINKE_SE_NE_POKLAPAJU, greske.ponovljenaLozinka)
        assertEquals(PorukeGresaka.USLOVI, greske.uslovi)
        assertEquals(emptyList<String>(), auth.pozivi)
        assertEquals(0, api.brojInita)
    }

    @Test
    fun `I09-T03 svaka greska pojedinacno zaustavlja tok`() = runTest {
        val slucajevi = listOf(
            { unesi(ponovljena = "Lozinka2") },
            { unesi(uslovi = false) },
            { unesi(lozinka = "lozinka1") },
            { unesi(ime = "a".repeat(101)) },
        )
        for (slucaj in slucajevi) {
            slucaj()
            vm.napraviNalog()
            advanceUntilIdle()
        }
        assertEquals(emptyList<String>(), auth.pozivi)
        assertEquals(0, api.brojInita)
    }

    @Test
    fun `I09-T03 forma ima tacno 5 ulaza, bez telefona i datuma rodjenja`() {
        val polja = UnosRegistracije::class.java.declaredFields.filter { !Modifier.isStatic(it.modifiers) }.map { it.name }.toSet()
        assertEquals(setOf("displayName", "email", "lozinka", "ponovljenaLozinka", "prihvaceniUslovi"), polja)
    }

    // I09-T11 (AUTH-01): createUser → postaviIme → init(ime, "1.0").
    @Test
    fun `I09-T11 redoslijed createUser, postaviIme, init`() = runTest {
        unesi()
        vm.napraviNalog()
        advanceUntilIdle()
        assertEquals(listOf("registruj", "postaviIme:Ana"), auth.pozivi)
        assertEquals(listOf("init:Ana:1.0"), api.pozivi)
        assertEquals(OdredisteNaloga.Pocetna, vm.stanje.value.odrediste)
    }

    @Test
    fun `I09-T11 kolizija e-maila - neutralna poruka i-09 P-4 i 0 init-a`() = runTest {
        auth.ishodRegistracije = IshodAutentikacije.EmailZauzet
        unesi()
        vm.napraviNalog()
        advanceUntilIdle()
        assertEquals(
            "Registracija nije uspjela. Ako već imate nalog, prijavite se ili zatražite novu lozinku.",
            vm.stanje.value.greska,
        )
        assertEquals(0, api.brojInita)
        assertNull(vm.stanje.value.odrediste)
    }

    @Test
    fun `I09-T11 init mreza - greska, pa ponovni pokusaj zove samo init`() = runTest {
        api.odgovoriInita += RezultatApi.MreznaGreska
        unesi()
        vm.napraviNalog()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.MREZA, vm.stanje.value.greska)
        assertNull(vm.stanje.value.odrediste)

        vm.napraviNalog()
        advanceUntilIdle()
        assertEquals(listOf("registruj", "postaviIme:Ana"), auth.pozivi)
        assertEquals(2, api.brojInita)
        assertEquals(OdredisteNaloga.Pocetna, vm.stanje.value.odrediste)
    }

    @Test
    fun `I09-T11 slaba lozinka i neispravan e-mail od Firebase-a`() = runTest {
        auth.ishodRegistracije = IshodAutentikacije.SlabaLozinka
        unesi()
        vm.napraviNalog()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.LOZINKA, vm.stanje.value.greske.lozinka)
        auth.ishodRegistracije = IshodAutentikacije.NeispravanEmail
        vm.napraviNalog()
        advanceUntilIdle()
        assertEquals(PorukeGresaka.EMAIL_NEISPRAVAN, vm.stanje.value.greske.email)
        assertEquals(0, api.brojInita)
    }
}
