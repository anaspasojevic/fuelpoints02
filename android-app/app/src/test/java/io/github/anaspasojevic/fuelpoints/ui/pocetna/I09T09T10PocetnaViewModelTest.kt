@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.pocetna

import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.nalog.Korisnik
import io.github.anaspasojevic.fuelpoints.podaci.nalog.LoyaltyNalog
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

class I09T09T10PocetnaViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije()
    private val nalog = LazniIzvorNaloga()
    private val api = LazniBackendApi()

    private fun TestScope.napravi(): PocetnaViewModel {
        val vm = PocetnaViewModel(auth, nalog, api)
        advanceUntilIdle()
        return vm
    }

    // I09-T09 (UI-03, §18, O-43).
    @Test
    fun `I09-T09 svako otvaranje Home-a poziva API-06 tacno jednom`() = runTest {
        val vm = napravi()
        assertEquals(0, api.pozivi.size)
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(listOf("reconcile"), api.pozivi)
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(listOf("reconcile", "reconcile"), api.pozivi)
    }

    @Test
    fun `I09-T09 greska API-06 ne blokira prikaz stanja i nema poruke`() = runTest {
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(42, 0), false)
        val vm = napravi()
        for (odgovor in listOf(RezultatApi.GreskaBackenda("INTERNAL_ERROR", 500), RezultatApi.MreznaGreska)) {
            api.odgovorUskladjivanja = odgovor
            vm.priOtvaranju()
            advanceUntilIdle()
            assertEquals(42L, vm.stanje.value.bodovi)
            assertFalse(vm.stanje.value.stanjeNedostupno)
            assertNull(vm.stanje.value.izlaz)
        }
    }

    @Test
    fun `I09-T09 409 ACCOUNT_NOT_INITIALIZED - AUTH-03 tok`() = runTest {
        api.odgovorUskladjivanja = RezultatApi.GreskaBackenda("ACCOUNT_NOT_INITIALIZED", 409)
        val vm = napravi()
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(IzlazSaPocetne.Pokretanje, vm.stanje.value.izlaz)
    }

    @Test
    fun `I09-T09 409 ACCOUNT_DELETION_IN_PROGRESS - BrisanjeUToku`() = runTest {
        api.odgovorUskladjivanja = RezultatApi.GreskaBackenda("ACCOUNT_DELETION_IN_PROGRESS", 409)
        val vm = napravi()
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(IzlazSaPocetne.BrisanjeUToku, vm.stanje.value.izlaz)
    }

    @Test
    fun `I09-T09 users DELETION_IN_PROGRESS u snapshot-u - BrisanjeUToku`() = runTest {
        val vm = napravi()
        nalog.korisnik.value = StanjeDokumenta.Postoji(Korisnik("Ana", "DELETION_IN_PROGRESS"), false)
        advanceUntilIdle()
        assertEquals(IzlazSaPocetne.BrisanjeUToku, vm.stanje.value.izlaz)
    }

    @Test
    fun `I09-T09 loyaltyAccounts ne postoji na serveru - Pokretanje`() = runTest {
        nalog.loyalty.value = StanjeDokumenta.NePostoji(izKesa = false)
        val vm = napravi()
        assertEquals(IzlazSaPocetne.Pokretanje, vm.stanje.value.izlaz)
    }

    @Test
    fun `I09-T09 reservedPoints vidljivo samo kad je vece od 0`() = runTest {
        val vm = napravi()
        assertFalse(vm.stanje.value.prikaziRezervisano)
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(12, 30), false)
        advanceUntilIdle()
        assertTrue(vm.stanje.value.prikaziRezervisano)
        assertEquals(30L, vm.stanje.value.rezervisano)
    }

    @Test
    fun `I09-T09 snapshot 0 pa 42 mijenja prikaz bez novog poziva`() = runTest {
        val vm = napravi()
        assertEquals("Ana", vm.stanje.value.ime)
        assertEquals(0L, vm.stanje.value.bodovi)
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(42, 0), false)
        advanceUntilIdle()
        assertEquals(42L, vm.stanje.value.bodovi)
        assertEquals(emptyList<String>(), api.pozivi)
    }

    @Test
    fun `I09-T09 vrijednost koja nije nenegativan cijeli broj - stanje nedostupno`() = runTest {
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(null, 0), false)
        val vm = napravi()
        assertTrue(vm.stanje.value.stanjeNedostupno)
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(-1, 0), false)
        advanceUntilIdle()
        assertTrue(vm.stanje.value.stanjeNedostupno)
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(5, 0), false)
        advanceUntilIdle()
        assertFalse(vm.stanje.value.stanjeNedostupno)
    }

    @Test
    fun `I09-T09 gubitak sesije - Prijava`() = runTest {
        val vm = napravi()
        auth.sesija.value = null
        advanceUntilIdle()
        assertEquals(IzlazSaPocetne.Prijava, vm.stanje.value.izlaz)
    }

    // I09-T10 (NFR-08): marker prati metadata.isFromCache snimka loyaltyAccounts/{uid}.
    @Test
    fun `I09-T10 marker prati izKesa true, false, true`() = runTest {
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(42, 0), izKesa = true)
        val vm = napravi()
        assertTrue(vm.stanje.value.izKesa)
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(42, 0), izKesa = false)
        advanceUntilIdle()
        assertFalse(vm.stanje.value.izKesa)
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(42, 0), izKesa = true)
        advanceUntilIdle()
        assertTrue(vm.stanje.value.izKesa)
        assertEquals(42L, vm.stanje.value.bodovi)
    }
}
