package io.github.anaspasojevic.fuelpoints

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// I10-T15 (NFR-07, (h), §2.2, AC-02, (e), (i), O-45): statička provjera Firestore upisa, upita, indeksa i zavisnosti.
class I10T15StatickaProvjeraTest {

    private val modul = File(".").absoluteFile
    private val izvori = File(modul, "src/main").walkTopDown().filter { it.isFile && it.extension == "kt" }.toList()
    private val firestoreFajlovi = izvori.filter { it.readText().contains("com.google.firebase.firestore") }

    private val izrazUpisa = Regex("""\.(set|update|delete|add)\(|runTransaction|\bbatch\(|WriteBatch""")

    @Test
    fun `I10-T15 Firestore upisi postoje samo u promijeniIme i oznaciProcitano`() {
        val saUpisima = firestoreFajlovi.filter { izrazUpisa.containsMatchIn(it.readText()) }.map { it.name }.sorted()
        assertEquals(listOf("FirestoreIzvorNaloga.kt", "FirestoreIzvorObavjestenja.kt"), saUpisima)

        val nalog = firestoreFajlovi.first { it.name == "FirestoreIzvorNaloga.kt" }.readText()
        assertEquals(1, izrazUpisa.findAll(nalog).count())
        assertTrue(
            Regex("""\.update\(\s*mapOf\(\s*"displayName" to \w+,\s*"updatedAt" to FieldValue\.serverTimestamp\(\)\s*\)\s*\)""").containsMatchIn(nalog),
        )

        val obavjestenja = firestoreFajlovi.first { it.name == "FirestoreIzvorObavjestenja.kt" }.readText()
        assertEquals(1, izrazUpisa.findAll(obavjestenja).count())
        assertTrue(Regex("""\.update\(\s*"readAt",\s*FieldValue\.serverTimestamp\(\)\s*\)""").containsMatchIn(obavjestenja))
    }

    @Test
    fun `I10-T15 upiti nad purchases, notifications i vouchers imaju where uid i limit`() {
        val granice = mapOf("purchases" to 20, "notifications" to 50, "vouchers" to 20)
        for ((kolekcija, najvise) in granice) {
            val fajlovi = firestoreFajlovi.filter { it.readText().contains("""collection("$kolekcija")""") }
            assertTrue("nema upita nad $kolekcija", fajlovi.isNotEmpty())
            for (fajl in fajlovi) {
                val tekst = fajl.readText()
                assertTrue("${fajl.name}: nema whereEqualTo(\"uid\"", tekst.contains("""whereEqualTo("uid""""))
                val limiti = Regex("""\.limit\((\d+)\)""").findAll(tekst).map { it.groupValues[1].toInt() }.toList()
                assertTrue("${fajl.name}: nema limit(", limiti.isNotEmpty())
                assertTrue("${fajl.name}: limit > $najvise", limiti.all { it <= najvise })
            }
        }
    }

    @Test
    fun `I10-T15 firestore indexes json sadrzi tacno tri indeksa iz plana`() {
        val tekst = File(modul, "../../firebase/firestore.indexes.json").readText()
        val korijen = Json.parseToJsonElement(tekst).jsonObject
        val indeksi = korijen["indexes"]!!.jsonArray
        val opisi = indeksi.map { indeks ->
            val o = indeks.jsonObject
            val polja = (o["fields"] as JsonArray).map {
                it.jsonObject["fieldPath"]!!.jsonPrimitive.content + ":" + it.jsonObject["order"]!!.jsonPrimitive.content
            }
            o["collectionGroup"]!!.jsonPrimitive.content + "/" + o["queryScope"]!!.jsonPrimitive.content + "/" + polja.joinToString(",")
        }
        assertEquals(
            listOf(
                "purchases/COLLECTION/uid:ASCENDING,occurredAt:DESCENDING",
                "notifications/COLLECTION/uid:ASCENDING,createdAt:DESCENDING",
                "vouchers/COLLECTION/uid:ASCENDING,status:ASCENDING,expiresAt:ASCENDING",
            ),
            opisi,
        )
        assertEquals(0, korijen["fieldOverrides"]!!.jsonArray.size)
    }

    @Test
    fun `I10-T15 Gradle zavisnosti su nepromijenjene u odnosu na i09`() {
        val toml = File(modul, "../gradle/libs.versions.toml").readText()
        val biblioteke = toml.substringAfter("[libraries]").substringBefore("[plugins]")
            .lines().filter { it.contains(" = {") }.map { it.substringBefore(" =").trim() }.sorted()
        val ocekivano = listOf(
            "androidx-core-ktx", "junit", "androidx-junit", "androidx-espresso-core", "androidx-lifecycle-runtime-ktx",
            "androidx-lifecycle-viewmodel-compose", "androidx-activity-compose", "androidx-navigation-compose",
            "androidx-compose-bom", "androidx-ui", "androidx-ui-graphics", "androidx-ui-tooling", "androidx-ui-tooling-preview",
            "androidx-ui-test-manifest", "androidx-ui-test-junit4", "androidx-material3", "firebase-bom", "firebase-auth",
            "firebase-firestore", "kotlinx-coroutines-play-services", "kotlinx-coroutines-test", "kotlinx-serialization-json",
            "okhttp", "okhttp-mockwebserver", "zxing-core",
        ).sorted()
        assertEquals(ocekivano, biblioteke)
    }
}
