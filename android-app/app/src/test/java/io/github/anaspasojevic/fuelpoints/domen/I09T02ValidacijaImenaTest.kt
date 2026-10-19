package io.github.anaspasojevic.fuelpoints.domen

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// I09-T02 (UI-02, i02/P-3): displayName 1–100 UTF-16 jedinica, ispravan UTF-16, bez trim-a (isto kao Backend jeIspravnoIme).
class I09T02ValidacijaImenaTest {

    private val emoji = "😀"

    @Test
    fun `I09-T02 granice duzine 0, 1, 100, 101`() {
        assertFalse(jeIspravnoIme(""))
        assertTrue(jeIspravnoIme("A"))
        assertTrue(jeIspravnoIme("a".repeat(100)))
        assertFalse(jeIspravnoIme("a".repeat(101)))
    }

    @Test
    fun `I09-T02 duzina se broji u UTF-16 jedinicama`() {
        assertTrue(jeIspravnoIme(emoji.repeat(50)))
        assertFalse(jeIspravnoIme(emoji.repeat(51)))
    }

    @Test
    fun `I09-T02 usamljeni surogat nije ispravan`() {
        assertFalse(jeIspravnoIme("Ana\uD83D"))
        assertFalse(jeIspravnoIme("\uDE00Ana"))
    }

    @Test
    fun `I09-T02 razmaci se ne skracuju`() {
        assertTrue(jeIspravnoIme("  "))
    }
}
