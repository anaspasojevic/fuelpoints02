package io.github.anaspasojevic.fuelpoints.domen

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// I09-T01 (§3.6, i09/P-2): isto pravilo kao Firebase policy — String.length ≥ 8, bar jedan A–Z, bar jedna 0–9.
class I09T01ValidacijaLozinkeTest {

    @Test
    fun `I09-T01 ispravne lozinke`() {
        assertTrue(jeIspravnaLozinka("Lozinka1"))
        assertTrue(jeIspravnaLozinka("čokoladA1"))
        // 7 kodnih tačaka = 8 UTF-16 jedinica (emoji je surogatni par).
        assertTrue(jeIspravnaLozinka("Lozi😀n1"))
    }

    @Test
    fun `I09-T01 granica duzine 7 i 8 znakova`() {
        assertFalse(jeIspravnaLozinka("Lozink1"))
        assertTrue(jeIspravnaLozinka("Lozink12"))
    }

    @Test
    fun `I09-T01 bez velikog slova A-Z`() {
        assertFalse(jeIspravnaLozinka("lozinka1"))
        // Č nije A–Z (i09/P-2 A).
        assertFalse(jeIspravnaLozinka("čokolada1"))
        assertFalse(jeIspravnaLozinka("Čokolada1"))
    }

    @Test
    fun `I09-T01 bez cifre 0-9`() {
        assertFalse(jeIspravnaLozinka("Lozinkaa"))
        // Arapsko-indijska cifra nije 0–9.
        assertFalse(jeIspravnaLozinka("Lozinka١"))
    }

    @Test
    fun `I09-T01 prazna lozinka`() {
        assertFalse(jeIspravnaLozinka(""))
    }

    @Test
    fun `I09-T01 pojedinacna pravila za LCD trake`() {
        assertEquals(PravilaLozinke(duzina = false, velikoSlovo = true, cifra = true), provjeriLozinku("Benzin7"))
        assertEquals(PravilaLozinke(duzina = true, velikoSlovo = false, cifra = false), provjeriLozinku("benzinnn"))
        assertTrue(provjeriLozinku("Benzin77").ispunjena)
    }
}
