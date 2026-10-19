package io.github.anaspasojevic.fuelpoints.podaci.api

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.io.IOException

// I09-T07 (API-01, API-06, §3.3, §27, O-21, O-43, R-04): ugovor Android klijenta sa Backend-om nad MockWebServer-om.
class I09T07BackendApiTest {

    private lateinit var server: MockWebServer
    private var brojTrazenjaTokena = 0
    private val pauze = mutableListOf<Long>()
    private var token: () -> String? = { "token-${brojTrazenjaTokena}" }

    private val odgovorInita = """{"displayName":"Ana","accountStatus":"ACTIVE","acceptedTermsVersion":"1.0","availablePoints":0,"reservedPoints":0}"""

    @Before
    fun pripremi() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun ugasi() {
        server.shutdown()
    }

    private fun api(adresa: String = server.url("/api/v1/").toString()) = OkHttpBackendApi(
        baznaAdresa = adresa,
        dobaviToken = { brojTrazenjaTokena++; token() },
        pauza = { pauze += it },
    )

    private fun greska(status: Int, kod: String) = MockResponse().setResponseCode(status)
        .setHeader("Content-Type", "application/json")
        .setBody("""{"error":{"code":"$kod","message":"poruka","correlationId":"c-1"}}""")

    @Test
    fun `I09-T07 init salje Bearer token i tijelo tacno displayName i acceptedTermsVersion`() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody(odgovorInita))
        val rezultat = api().inicijalizujNalog("Ana", "1.0")

        val zahtjev = server.takeRequest()
        assertEquals("POST", zahtjev.method)
        assertEquals("/api/v1/account/init", zahtjev.path)
        assertEquals("Bearer token-1", zahtjev.getHeader("Authorization"))
        assertTrue(zahtjev.getHeader("Content-Type")!!.startsWith("application/json"))
        val tijelo = Json.parseToJsonElement(zahtjev.body.readUtf8()).jsonObject
        assertEquals(setOf("displayName", "acceptedTermsVersion"), tijelo.keys)
        assertEquals("Ana", tijelo["displayName"]!!.jsonPrimitive.content)
        assertEquals("1.0", tijelo["acceptedTermsVersion"]!!.jsonPrimitive.content)
        assertFalse(tijelo.containsKey("uid"))

        val uspjeh = rezultat as RezultatApi.Uspjeh
        assertEquals(OdgovorInita("Ana", "ACTIVE", "1.0", 0, 0), uspjeh.tijelo)
    }

    @Test
    fun `I09-T07 init 200 (ponovljeni init) se parsira`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(odgovorInita))
        val rezultat = api().inicijalizujNalog("Ana", "1.0")
        assertTrue(rezultat is RezultatApi.Uspjeh)
    }

    @Test
    fun `I09-T07 API-06 je POST bez tijela, Content-Length 0 i bez Content-Type`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"reconciledCount":0}"""))
        val rezultat = api().uskladiVaucere()

        val zahtjev = server.takeRequest()
        assertEquals("POST", zahtjev.method)
        assertEquals("/api/v1/account/vouchers/reconcile", zahtjev.path)
        assertEquals("Bearer token-1", zahtjev.getHeader("Authorization"))
        assertEquals("0", zahtjev.getHeader("Content-Length"))
        assertNull(zahtjev.getHeader("Content-Type"))
        assertEquals(0L, zahtjev.bodySize)
        assertEquals(OdgovorUskladjivanja(0), (rezultat as RezultatApi.Uspjeh).tijelo)
    }

    @Test
    fun `I09-T07 greska po §27 se parsira u kod i status`() = runTest {
        server.enqueue(greska(409, "ACCOUNT_NOT_INITIALIZED"))
        assertEquals(RezultatApi.GreskaBackenda("ACCOUNT_NOT_INITIALIZED", 409), api().uskladiVaucere())
        server.enqueue(greska(422, "INVALID_DISPLAY_NAME"))
        assertEquals(RezultatApi.GreskaBackenda("INVALID_DISPLAY_NAME", 422), api().inicijalizujNalog("x", "1.0"))
    }

    @Test
    fun `I09-T07 tijelo koje nije JSON daje kod null`() = runTest {
        server.enqueue(MockResponse().setResponseCode(502).setBody("<html>Bad Gateway</html>"))
        assertEquals(RezultatApi.GreskaBackenda(null, 502), api().uskladiVaucere())
    }

    @Test
    fun `I09-T07 503 pa uspjeh - tacno 2 zahtjeva i pauza 1000 ms`() = runTest {
        server.enqueue(greska(503, "SERVICE_UNAVAILABLE"))
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"reconciledCount":2}"""))
        val rezultat = api().uskladiVaucere()
        assertEquals(OdgovorUskladjivanja(2), (rezultat as RezultatApi.Uspjeh).tijelo)
        assertEquals(2, server.requestCount)
        assertEquals(listOf(1000L), pauze)
    }

    @Test
    fun `I09-T07 503 i 503 - tacno 2 zahtjeva i SERVICE_UNAVAILABLE`() = runTest {
        server.enqueue(greska(503, "SERVICE_UNAVAILABLE"))
        server.enqueue(greska(503, "SERVICE_UNAVAILABLE"))
        server.enqueue(MockResponse().setResponseCode(200).setBody(odgovorInita))
        assertEquals(RezultatApi.GreskaBackenda("SERVICE_UNAVAILABLE", 503), api().inicijalizujNalog("Ana", "1.0"))
        assertEquals(2, server.requestCount)
        assertEquals(listOf(1000L), pauze)
    }

    @Test
    fun `I09-T07 500 - jedan zahtjev, bez ponavljanja`() = runTest {
        server.enqueue(greska(500, "INTERNAL_ERROR"))
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"reconciledCount":0}"""))
        assertEquals(RezultatApi.GreskaBackenda("INTERNAL_ERROR", 500), api().uskladiVaucere())
        assertEquals(1, server.requestCount)
        assertTrue(pauze.isEmpty())
    }

    @Test
    fun `I09-T07 ugasen server daje MreznaGreska`() = runTest {
        val adresa = server.url("/api/v1/").toString()
        server.shutdown()
        assertEquals(RezultatApi.MreznaGreska, api(adresa).uskladiVaucere())
    }

    @Test
    fun `I09-T07 token se trazi za svaki poziv`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"reconciledCount":0}"""))
        server.enqueue(MockResponse().setResponseCode(200).setBody("""{"reconciledCount":0}"""))
        val klijent = api()
        klijent.uskladiVaucere()
        klijent.uskladiVaucere()
        assertEquals(2, brojTrazenjaTokena)
        assertEquals("Bearer token-1", server.takeRequest().getHeader("Authorization"))
        assertEquals("Bearer token-2", server.takeRequest().getHeader("Authorization"))
    }

    @Test
    fun `I09-T07 bez tokena nema zahtjeva (UNAUTHENTICATED)`() = runTest {
        token = { null }
        assertEquals(RezultatApi.GreskaBackenda("UNAUTHENTICATED", 401), api().uskladiVaucere())
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `I09-T07 mrezna greska pri dobijanju tokena daje MreznaGreska bez zahtjeva`() = runTest {
        token = { throw IOException("mreža") }
        assertEquals(RezultatApi.MreznaGreska, api().uskladiVaucere())
        assertEquals(0, server.requestCount)
    }

    @Test
    fun `I09-T07 prazna bazna adresa (release bez konfiguracije) ne poziva mrezu`() = runTest {
        assertEquals(RezultatApi.GreskaBackenda(null, 0), api("").uskladiVaucere())
        assertEquals(0, brojTrazenjaTokena)
    }
}
