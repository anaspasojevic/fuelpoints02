package io.github.anaspasojevic.fuelpoints

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// I09-T12 (NFR-07, O-40, O-45, §2.6): statička provjera fajlova modula app (radni direktorijum testa je app/).
class I09T12StatickaProvjeraTest {

    private val modul = File(".").absoluteFile
    private val glavniManifest = File(modul, "src/main/AndroidManifest.xml")
    private val debugManifest = File(modul, "src/debug/AndroidManifest.xml")
    private val debugNsc = File(modul, "src/debug/res/xml/network_security_config.xml")

    private val zabranjeniIzrazi = listOf(
        "android.util.Log",
        "Log.",
        "println",
        "printStackTrace",
        "HttpLoggingInterceptor",
    )

    @Test
    fun `I09-T12 kod aplikacije ne loguje (token, UID i e-mail ne idu u Logcat)`() {
        val izvori = File(modul, "src/main").walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java") }.toList()
        assertTrue("nema izvornih fajlova u src/main", izvori.isNotEmpty())
        val pogoci = izvori.flatMap { fajl ->
            zabranjeniIzrazi.filter { izraz -> fajl.readText().contains(izraz) }.map { "${fajl.name}: $it" }
        }
        assertEquals(emptyList<String>(), pogoci)
    }

    @Test
    fun `I09-T12 main manifest ima samo INTERNET dozvolu i nema cleartext`() {
        val tekst = glavniManifest.readText()
        val dozvole = Regex("""<uses-permission[^>]*android:name="([^"]+)"""").findAll(tekst).map { it.groupValues[1] }.toList()
        assertEquals(listOf("android.permission.INTERNET"), dozvole)
        assertFalse(tekst.contains("usesCleartextTraffic"))
        assertFalse(tekst.contains("networkSecurityConfig"))
        assertFalse(tekst.contains("CAMERA"))
    }

    @Test
    fun `I09-T12 debug dozvoljava cleartext samo za 10_0_2_2`() {
        assertTrue(debugManifest.readText().contains("@xml/network_security_config"))
        val nsc = debugNsc.readText()
        val domeni = Regex("""<domain[^>]*>([^<]+)</domain>""").findAll(nsc).map { it.groupValues[1].trim() }.toList()
        assertEquals(listOf("10.0.2.2"), domeni)
        assertTrue(nsc.contains("""includeSubdomains="false""""))
        val bazna = Regex("""<base-config[^>]*>""").find(nsc)?.value
        assertTrue("base-config mora zabraniti cleartext", bazna != null && bazna.contains("""cleartextTrafficPermitted="false""""))
        assertEquals(1, Regex("""cleartextTrafficPermitted="true"""").findAll(nsc).count())
    }

    @Test
    fun `I09-T12 nema google-services json ni google-services plugin-a`() {
        assertFalse(File(modul, "google-services.json").exists())
        assertFalse(File(modul, "src/debug/google-services.json").exists())
        assertFalse(File(modul, "build.gradle.kts").readText().contains("com.google.gms"))
        assertFalse(File(modul, "../build.gradle.kts").readText().contains("com.google.gms"))
        assertFalse(File(modul, "../gradle/libs.versions.toml").readText().contains("com.google.gms"))
    }
}
