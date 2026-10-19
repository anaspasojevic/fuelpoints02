@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.qr

import com.google.zxing.common.BitMatrix
import io.github.anaspasojevic.fuelpoints.domen.napraviQr
import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

// I09-T06 (b), (c) (QR-01 … QR-05, AC-04).
class I09T06QrViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val sadrzaji = mutableListOf<String>()
    private val generator: (String) -> BitMatrix = { sadrzaji += it; napraviQr(it) }

    @Test
    fun `I09-T06 sa sesijom - sadrzaj QR-a i tekst su tacno UID`() = runTest {
        val vm = QrViewModel(LazniIzvorAutentikacije(uid = "kX9fQ2mT7bWc4rLpA1sD3fG5hJ6k"), generator)
        advanceUntilIdle()
        val stanje = vm.stanje.value as StanjeQr.Prikaz
        assertEquals(listOf("kX9fQ2mT7bWc4rLpA1sD3fG5hJ6k"), sadrzaji)
        assertEquals("kX9fQ2mT7bWc4rLpA1sD3fG5hJ6k", stanje.uid)
    }

    @Test
    fun `I09-T06 bez sesije - BezSesije i generator se ne poziva (nema guest QR-a)`() = runTest {
        val vm = QrViewModel(LazniIzvorAutentikacije(uid = null), generator)
        advanceUntilIdle()
        assertEquals(StanjeQr.BezSesije, vm.stanje.value)
        assertTrue(sadrzaji.isEmpty())
    }

    @Test
    fun `I09-T06 gubitak sesije dok je QR otvoren - BezSesije`() = runTest {
        val auth = LazniIzvorAutentikacije(uid = "uid-ana")
        val vm = QrViewModel(auth, generator)
        advanceUntilIdle()
        auth.sesija.value = null
        advanceUntilIdle()
        assertEquals(StanjeQr.BezSesije, vm.stanje.value)
    }
}
