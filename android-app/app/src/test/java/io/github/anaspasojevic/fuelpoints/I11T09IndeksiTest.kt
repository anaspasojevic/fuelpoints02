package io.github.anaspasojevic.fuelpoints

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

// I11-T09 (§31, ODLUKE (e), K6): svaki Android upit sa orderBy ima odgovarajući composite indeks u firestore.indexes.json.
// Poklapanje oblika je automatski provjereno; ponašanje nad pravim projektom je ručni dokaz (i11_smoke.md).
class I11T09IndeksiTest {

    private val modul = File(".").absoluteFile
    private val izvori = File(modul, "src/main").walkTopDown()
        .filter { it.isFile && it.extension == "kt" && it.readText().contains("com.google.firebase.firestore") }
        .toList()

    private data class Polje(val naziv: String, val smjer: String)

    // Upit: kolekcija, jednakosti (where uid ==, status ==) pa orderBy; indeks = jednakosti ASC + orderBy polje sa smjerom.
    private data class Upit(val kolekcija: String, val jednakosti: Set<String>, val poredak: Polje)

    private fun upitiSaPoretkom(): List<Pair<String, Upit>> = izvori.flatMap { fajl ->
        val tekst = fajl.readText()
        Regex("""collection\("(\w+)"\)""").findAll(tekst).mapNotNull { m ->
            // Lanac upita traje do prvog .limit( ili do sljedećeg collection(, šta god dođe prvo.
            val lanac = tekst.substring(m.range.last + 1).substringBefore(".limit(").substringBefore("collection(")
            val poredak = Regex("""\.orderBy\("(\w+)",\s*Query\.Direction\.(ASCENDING|DESCENDING)\)""").find(lanac) ?: return@mapNotNull null
            val jednakosti = Regex("""\.whereEqualTo\("(\w+)"""").findAll(lanac).map { it.groupValues[1] }.toSet()
            fajl.name to Upit(m.groupValues[1], jednakosti, Polje(poredak.groupValues[1], poredak.groupValues[2]))
        }.toList()
    }

    private fun indeksi(): List<Pair<String, List<Polje>>> {
        val korijen = Json.parseToJsonElement(File(modul, "../../firebase/firestore.indexes.json").readText()).jsonObject
        return korijen["indexes"]!!.jsonArray.map { indeks ->
            val o = indeks.jsonObject
            o["collectionGroup"]!!.jsonPrimitive.content to o["fields"]!!.jsonArray.map {
                Polje(it.jsonObject["fieldPath"]!!.jsonPrimitive.content, it.jsonObject["order"]!!.jsonPrimitive.content)
            }
        }
    }

    private fun imaIndeks(upit: Upit, postojeci: List<Pair<String, List<Polje>>> = indeksi()): Boolean =
        postojeci.any { (kolekcija, polja) ->
            kolekcija == upit.kolekcija &&
                polja.size == upit.jednakosti.size + 1 &&
                polja.dropLast(1).all { it.smjer == "ASCENDING" }.and(polja.dropLast(1).map { it.naziv }.toSet() == upit.jednakosti) &&
                polja.last() == Polje(upit.poredak.naziv, if (upit.poredak.smjer == "ASCENDING") "ASCENDING" else "DESCENDING")
        }

    @Test
    fun `I11-T09 pronadjena su tri upita sa orderBy`() {
        val upiti = upitiSaPoretkom().map { it.second }
        assertEquals(
            setOf(
                Upit("purchases", setOf("uid"), Polje("occurredAt", "DESCENDING")),
                Upit("notifications", setOf("uid"), Polje("createdAt", "DESCENDING")),
                Upit("vouchers", setOf("uid", "status"), Polje("expiresAt", "ASCENDING")),
            ),
            upiti.toSet(),
        )
    }

    @Test
    fun `I11-T09 svaki upit sa orderBy ima composite indeks`() {
        for ((fajl, upit) in upitiSaPoretkom()) {
            assertTrue("$fajl: nema indeksa za $upit", imaIndeks(upit))
        }
    }

    @Test
    fun `I11-T09 bez jednog indeksa test pada (kontrola)`() {
        val upit = Upit("vouchers", setOf("uid", "status"), Polje("expiresAt", "ASCENDING"))
        val bezVaucera = indeksi().filterNot { it.first == "vouchers" }
        assertTrue(imaIndeks(upit))
        assertTrue(!imaIndeks(upit, bezVaucera))
        assertTrue(!imaIndeks(upit.copy(poredak = Polje("expiresAt", "DESCENDING"))))
    }
}
