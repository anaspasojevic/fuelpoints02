@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.obavjestenja

import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorObavjestenja
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import io.github.anaspasojevic.fuelpoints.podaci.obavjestenja.Obavjestenje
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

// I10-T09 (UI-07, §21.2, RULE-T10, i10/P-3).
class I10T09ObavjestenjaViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije()
    private val izvor = LazniIzvorObavjestenja()

    private fun obavjestenje(n: Int, procitano: Boolean) = Obavjestenje("n$n", "Naslov $n", "Tekst $n", 1_000L - n, procitano)

    @Test
    fun `I10-T09 tap na nepročitanu salje tacno 1 upis, dvostruki tap takodje 1`() = runTest {
        izvor.lista.value = StanjeDokumenta.Postoji(listOf(obavjestenje(1, false), obavjestenje(2, true)), false)
        val vm = ObavjestenjaViewModel(auth, izvor)
        advanceUntilIdle()
        vm.otvori("n1")
        vm.otvori("n1")
        advanceUntilIdle()
        assertEquals(listOf("n1"), izvor.oznacena)
    }

    @Test
    fun `I10-T09 tap na procitanu ne pise ništa`() = runTest {
        izvor.lista.value = StanjeDokumenta.Postoji(listOf(obavjestenje(2, true)), false)
        val vm = ObavjestenjaViewModel(auth, izvor)
        advanceUntilIdle()
        vm.otvori("n2")
        advanceUntilIdle()
        assertTrue(izvor.oznacena.isEmpty())
    }

    @Test
    fun `I10-T09 neuspjeli upis dozvoljava novi tap`() = runTest {
        izvor.lista.value = StanjeDokumenta.Postoji(listOf(obavjestenje(1, false)), false)
        val vm = ObavjestenjaViewModel(auth, izvor)
        advanceUntilIdle()
        izvor.uspjehUpisa = false
        vm.otvori("n1")
        advanceUntilIdle()
        vm.otvori("n1")
        advanceUntilIdle()
        assertEquals(listOf("n1", "n1"), izvor.oznacena)
    }

    @Test
    fun `I10-T09 redoslijed i broj stavki prati izvor (do 50), a prikaz prati readAt`() = runTest {
        val pedeset = (1..50).map { obavjestenje(it, false) }
        izvor.lista.value = StanjeDokumenta.Postoji(pedeset, false)
        val vm = ObavjestenjaViewModel(auth, izvor)
        advanceUntilIdle()
        assertEquals(pedeset.map { it.id }, vm.stanje.value.obavjestenja.map { it.id })
        assertTrue(vm.stanje.value.obavjestenja.none { it.procitano })
        izvor.lista.value = StanjeDokumenta.Postoji(pedeset.map { if (it.id == "n3") it.copy(procitano = true) else it }, false)
        advanceUntilIdle()
        assertEquals(listOf("n3"), vm.stanje.value.obavjestenja.filter { it.procitano }.map { it.id })
    }
}
