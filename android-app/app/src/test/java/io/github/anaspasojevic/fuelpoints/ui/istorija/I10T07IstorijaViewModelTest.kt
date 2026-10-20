@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.istorija

import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorKupovina
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.IshodStranice
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Kupovina
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Kursor
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Stranica
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

// I10-T07 (UI-05, §25.4, (e)): paginacija istorije kupovina.
class I10T07IstorijaViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije()
    private val izvor = LazniIzvorKupovina()

    private fun kupovina(n: Int) = Kupovina("p$n", 1_000L - n, 1_000L, 100L, "EUR", 1L)
    private fun stranica(od: Int, do_: Int, kursor: Kursor?) =
        IshodStranice.Uspjeh(Stranica((od..do_).map(::kupovina), kursor))

    @Test
    fun `I10-T07 prva stranica ide sa kursorom null, a dugme postoji tacno kad izvor vrati kursor`() = runTest {
        val kursor1 = Kursor("k1")
        izvor.ishodi += stranica(1, 20, kursor1)
        val vm = IstorijaViewModel(auth, izvor)
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(listOf<Kursor?>(null), izvor.kursori)
        assertEquals(20, vm.stanje.value.kupovine.size)
        assertSame(kursor1, vm.stanje.value.sljedeciKursor)

        izvor.ishodi += stranica(21, 22, null)
        vm.ucitajStarije()
        advanceUntilIdle()
        assertSame(kursor1, izvor.kursori[1])
        assertNull(vm.stanje.value.sljedeciKursor)
        assertEquals((1..22).map { "p$it" }, vm.stanje.value.kupovine.map { it.id })
    }

    @Test
    fun `I10-T07 stranice se nadovezuju bez duplikata`() = runTest {
        izvor.ishodi += stranica(1, 3, Kursor("k1"))
        val vm = IstorijaViewModel(auth, izvor)
        vm.priOtvaranju()
        advanceUntilIdle()
        izvor.ishodi += stranica(3, 5, null)
        vm.ucitajStarije()
        advanceUntilIdle()
        assertEquals(listOf("p1", "p2", "p3", "p4", "p5"), vm.stanje.value.kupovine.map { it.id })
    }

    @Test
    fun `I10-T07 dvostruki tap dok traje ucitavanje salje 1 poziv`() = runTest {
        izvor.ishodi += stranica(1, 20, Kursor("k1"))
        val vm = IstorijaViewModel(auth, izvor)
        vm.priOtvaranju()
        advanceUntilIdle()
        izvor.kapija = CompletableDeferred()
        izvor.ishodi += stranica(21, 22, null)
        vm.ucitajStarije()
        vm.ucitajStarije()
        advanceUntilIdle()
        assertEquals(2, izvor.kursori.size)
        assertTrue(vm.stanje.value.ucitava)
        izvor.kapija!!.complete(Unit)
        advanceUntilIdle()
        assertEquals(2, izvor.kursori.size)
        assertFalse(vm.stanje.value.ucitava)
    }

    @Test
    fun `I10-T07 greska druge stranice cuva prvu, Pokusaj ponovo salje isti kursor`() = runTest {
        val kursor1 = Kursor("k1")
        izvor.ishodi += stranica(1, 20, kursor1)
        val vm = IstorijaViewModel(auth, izvor)
        vm.priOtvaranju()
        advanceUntilIdle()
        izvor.ishodi += IshodStranice.Greska
        vm.ucitajStarije()
        advanceUntilIdle()
        assertEquals(20, vm.stanje.value.kupovine.size)
        assertNotNull(vm.stanje.value.greska)
        assertSame(kursor1, vm.stanje.value.sljedeciKursor)

        izvor.ishodi += stranica(21, 22, null)
        vm.ponovi()
        advanceUntilIdle()
        assertSame(kursor1, izvor.kursori[2])
        assertEquals(22, vm.stanje.value.kupovine.size)
        assertNull(vm.stanje.value.greska)
    }

    @Test
    fun `I10-T07 prazna stranica - dugme nestaje`() = runTest {
        izvor.ishodi += stranica(1, 20, Kursor("k1"))
        val vm = IstorijaViewModel(auth, izvor)
        vm.priOtvaranju()
        advanceUntilIdle()
        izvor.ishodi += IshodStranice.Uspjeh(Stranica(emptyList(), null))
        vm.ucitajStarije()
        advanceUntilIdle()
        assertNull(vm.stanje.value.sljedeciKursor)
        assertEquals(20, vm.stanje.value.kupovine.size)
    }

    @Test
    fun `I10-T07 ponovno otvaranje taba osvjezava prvu stranicu`() = runTest {
        izvor.ishodi += stranica(1, 2, null)
        val vm = IstorijaViewModel(auth, izvor)
        vm.priOtvaranju()
        advanceUntilIdle()
        izvor.ishodi += stranica(9, 10, null)
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(listOf("p9", "p10"), vm.stanje.value.kupovine.map { it.id })
    }
}
