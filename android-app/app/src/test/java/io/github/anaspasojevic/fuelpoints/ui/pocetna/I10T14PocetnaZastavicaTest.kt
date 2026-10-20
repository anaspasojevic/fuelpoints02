@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.pocetna

import io.github.anaspasojevic.fuelpoints.domen.ZastavicaBrisanja
import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.Korisnik
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test

// I10-T14 (UI-03, O-43, O-46, (v)): Home za vrijeme toka brisanja naloga (regresija I09-T09).
class I10T14PocetnaZastavicaTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije()
    private val nalog = LazniIzvorNaloga()
    private val api = LazniBackendApi()
    private val zastavica = ZastavicaBrisanja()

    @Test
    fun `I10-T14 zastavica ukljucena - 0 API-06 i DELETION_IN_PROGRESS ne emituje BrisanjeUToku`() = runTest {
        zastavica.ukljuci()
        val vm = PocetnaViewModel(auth, nalog, api, zastavica)
        advanceUntilIdle()
        vm.priOtvaranju()
        nalog.korisnik.value = StanjeDokumenta.Postoji(Korisnik("Ana", "DELETION_IN_PROGRESS"), false)
        advanceUntilIdle()
        assertEquals(0, api.pozivi.size)
        assertNull(vm.stanje.value.izlaz)
    }

    @Test
    fun `I10-T14 zastavica iskljucena - ponasanje i09 (1 API-06 po otvaranju, BrisanjeUToku)`() = runTest {
        val vm = PocetnaViewModel(auth, nalog, api, zastavica)
        advanceUntilIdle()
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(listOf("reconcile"), api.pozivi)
        nalog.korisnik.value = StanjeDokumenta.Postoji(Korisnik("Ana", "DELETION_IN_PROGRESS"), false)
        advanceUntilIdle()
        assertEquals(IzlazSaPocetne.BrisanjeUToku, vm.stanje.value.izlaz)
    }
}
