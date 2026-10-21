package io.github.anaspasojevic.fuelpoints

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// I11-T07 (O-47, i10/P-1, i11/P-6): Pomoć i česta pitanja su strukturisana u parove pitanje/odgovor, a tekst je
// identičan onom koji je Ana odobrila u i10 (OČEKIVANI_TEKST je doslovno `pomoc_cesta_pitanja` iz taga i10).
class I11T07PomocTekstTest {

    private val strings = File(File(".").absoluteFile, "src/main/res/values/strings.xml").readText()

    private fun vrijednost(naziv: String): String {
        val m = Regex("""<string name="$naziv">(.*?)</string>""", RegexOption.DOT_MATCHES_ALL).find(strings)
        assertTrue("nema stringa $naziv", m != null)
        return m!!.groupValues[1]
    }

    @Test
    fun `I11-T07 sest pitanja sa odgovorima i kontakt`() {
        for (i in 1..6) {
            assertTrue("pitanje $i ne zavrsava sa ?", vrijednost("pomoc_p$i").endsWith("?"))
            assertTrue("odgovor $i je prazan", vrijednost("pomoc_o$i").isNotBlank())
        }
        assertFalse(strings.contains("name=\"pomoc_p7\""))
        assertEquals("Kontakt", vrijednost("pomoc_kontakt_naslov"))
        assertTrue(vrijednost("pomoc_kontakt").isNotBlank())
        assertFalse(strings.contains("pomoc_cesta_pitanja"))
        assertFalse(strings.contains("TODO"))
    }

    @Test
    fun `I11-T07 tekst je identican odobrenom u i10`() {
        val sastavljen = (1..6).joinToString("\n\n") { "${vrijednost("pomoc_p$it")}\n${vrijednost("pomoc_o$it")}" } +
            "\n\n${vrijednost("pomoc_kontakt_naslov")}\n${vrijednost("pomoc_kontakt")}"
        assertEquals(OCEKIVANI_TEKST, sastavljen)
    }

    private companion object {
        const val OCEKIVANI_TEKST = """Kako dobijam bodove?
Za svaki pun litar goriva dobijate jedan bod (42,73 l = 42 boda). Pokažite svoj QR kod na kasi prije plaćanja.

Kada bodovi stižu?
Odmah po evidentiranju kupovine na kasi. Obavještenje o bodovima vidite u odjeljku Obavještenja.

Kako uzimam nagradu?
U odjeljku Nagrade izaberite dostupnu nagradu. Dobijate voucher sa posebnim QR kodom; bodovi se rezervišu.

Koliko važi voucher?
15 minuta. Ako ga ne iskoristite ili ga otkažete, rezervisani bodovi se vraćaju.

Koja je razlika između dva QR koda?
QR kod naloga služi samo za sakupljanje bodova. Voucher QR služi samo za preuzimanje jedne nagrade.

Šta se dešava kad obrišem nalog?
Bodovi, voucher-i i obavještenja se brišu. Istorija kupovina ostaje bez veze sa vama. Brisanje se ne može poništiti.

Kontakt
FuelPoints je diplomski projekat (PMF Banja Luka) i nema korisničku podršku."""
    }
}
