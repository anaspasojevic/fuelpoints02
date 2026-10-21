package io.github.anaspasojevic.fuelpoints

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// I11-T05 (NFR-07, i09/K-3, i11/P-2) i I11-T06 (NFR-01, O-2, O-39, O-40, i11/P-3): statička provjera release konfiguracije.
class I11T05ReleaseProvjeraTest {

    private val modul = File(".").absoluteFile
    private val gradle = File(modul, "build.gradle.kts").readText()
    private val pravila = File(modul, "proguard-rules.pro").readText()

    // Tijelo bloka `naziv {` ili `create("naziv") {` unutar buildTypes (uparene vitičaste zagrade).
    private fun blok(pocetak: String): String {
        val i = gradle.indexOf(pocetak)
        assertTrue("nema bloka $pocetak", i >= 0)
        val otvaranje = gradle.indexOf('{', i)
        var dubina = 0
        for (k in otvaranje until gradle.length) {
            if (gradle[k] == '{') dubina++
            if (gradle[k] == '}') dubina--
            if (dubina == 0) return gradle.substring(otvaranje, k + 1)
        }
        error("neuparene zagrade u $pocetak")
    }

    private val release get() = blok("        release {")
    private val releaseProba get() = blok("""create("releaseProba")""")
    private val debug get() = blok("        debug {")

    private fun bezKomentara(tekst: String) = tekst.lines().filterNot { it.trimStart().startsWith("#") }.joinToString("\n")

    @Test
    fun `I11-T05 release ima R8 minifikaciju`() {
        assertTrue(Regex("""isMinifyEnabled\s*=\s*true""").containsMatchIn(release))
        assertTrue(Regex("""isShrinkResources\s*=\s*true""").containsMatchIn(release))
        assertTrue(release.contains("proguard-rules.pro"))
        assertFalse(Regex("""isMinifyEnabled\s*=\s*false""").containsMatchIn(release))
    }

    @Test
    fun `I11-T05 pravilo uklanja Log v d i, a ne w i e`() {
        val aktivna = bezKomentara(pravila)
        val m = Regex("""-assumenosideeffects\s+class\s+android\.util\.Log\s*\{([^}]*)\}""").find(aktivna)
        assertTrue("nema -assumenosideeffects za android.util.Log", m != null)
        val metode = Regex("""public static int (\w+)\(\.\.\.\);""").findAll(m!!.groupValues[1]).map { it.groupValues[1] }.toList()
        assertEquals(listOf("v", "d", "i"), metode)
        assertFalse(aktivna.contains("-dontwarn android.util.Log"))
    }

    @Test
    fun `I11-T06 release nema demo vrijednosti ni emulator`() {
        val tekst = release
        assertFalse(tekst.contains("demo-"))
        assertTrue(tekst.contains("""buildConfigField("boolean", "KORISTI_EMULATOR", "false")"""))
        assertTrue(tekst.contains("""buildConfigField("String", "EMULATOR_HOST", "\"\"")"""))
        assertTrue(tekst.contains("""lokalno("firebase.projectId")"""))
        assertTrue(tekst.contains("""lokalno("firebase.applicationId")"""))
        assertTrue(tekst.contains("""lokalno("firebase.apiKey")"""))
        assertTrue(debug.contains("demo-fuelpoints"))
        assertFalse(File(modul, "src/release").exists())
    }

    @Test
    fun `I11-T06 backend URL za release dolazi iz lokalne konfiguracije i mora biti https`() {
        val tekst = release
        assertTrue(tekst.contains("""lokalno("backend.baseUrl")"""))
        assertTrue(tekst.contains("""startsWith("https://")"""))
        assertFalse(Regex("""BACKEND_BAZNI_URL",\s*"\\"http://""").containsMatchIn(tekst))
        // Lokalna konfiguracija se čita iz fajla van repozitorijuma.
        assertTrue(gradle.contains("firebase.local.properties"))
    }

    @Test
    fun `I11-T06 releaseProba je jedini osim debug sa cleartext-om, samo za 10_0_2_2`() {
        val proba = releaseProba
        assertTrue(proba.contains("""initWith(getByName("release"))"""))
        assertTrue(proba.contains("""signingConfigs.getByName("debug")"""))
        assertTrue(proba.contains("http://10.0.2.2:3000/api/v1/"))

        val konfiguracije = File(modul, "src").walkTopDown().filter { it.isFile && it.name == "network_security_config.xml" }.toList()
        assertEquals(setOf("debug", "releaseProba"), konfiguracije.map { it.relativeTo(File(modul, "src")).path.substringBefore(File.separatorChar) }.toSet())
        for (nsc in konfiguracije) {
            val tekst = nsc.readText()
            assertEquals(listOf("10.0.2.2"), Regex("""<domain[^>]*>([^<]+)</domain>""").findAll(tekst).map { it.groupValues[1].trim() }.toList())
            assertEquals(1, Regex("""cleartextTrafficPermitted="true"""").findAll(tekst).count())
        }
        assertTrue(File(modul, "src/releaseProba/AndroidManifest.xml").readText().contains("@xml/network_security_config"))

        val main = File(modul, "src/main/AndroidManifest.xml").readText()
        assertFalse(main.contains("usesCleartextTraffic"))
        assertFalse(main.contains("networkSecurityConfig"))
    }
}
