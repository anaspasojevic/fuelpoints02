package io.github.anaspasojevic.fuelpoints.podaci.api

import io.github.anaspasojevic.fuelpoints.domen.ZastavicaBrisanja
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

// I10-T11 (API-03, API-05, API-07, §3.3, O-15, O-21, O-33, (s), R-04): ugovor Android klijenta sa Backend-om nad MockWebServer-om.
class I10T11BackendApiTest {

    private lateinit var server: MockWebServer
    private val zatrazenoOsvjezavanje = mutableListOf<Boolean>()
    private val pauze = mutableListOf<Long>()
    private val zastavica = ZastavicaBrisanja()

    private val requestId = "3f2b8c1e-5a4d-4e6f-9a0b-1c2d3e4f5a6b"
    private val voucherId = "ab".repeat(32)
    private val odgovorVouchera = """{"voucherId":"$voucherId","rewardId":"CAR_WASH","costPoints":50,"status":"ACTIVE","issuedAt":"2026-10-20T10:00:00.000Z","expiresAt":"2026-10-20T10:15:00.000Z"}"""

    @Before
    fun pripremi() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun ugasi() {
        server.shutdown()
    }

    private fun api() = OkHttpBackendApi(
        baznaAdresa = server.url("/api/v1/").toString(),
        dobaviToken = { osvjezi -> zatrazenoOsvjezavanje += osvjezi; "token-${zatrazenoOsvjezavanje.size}" },
        pauza = { pauze += it },
        zastavica = zastavica,
    )

    private fun greska(status: Int, kod: String) = MockResponse().setResponseCode(status)
        .setHeader("Content-Type", "application/json")
        .setBody("""{"error":{"code":"$kod","message":"poruka","correlationId":"c-1"}}""")

    @Test
    fun `I10-T11 API-03 salje POST, Bearer, application json i tijelo tacno requestId`() = runTest {
        server.enqueue(MockResponse().setResponseCode(201).setBody(odgovorVouchera))
        val rezultat = api().izdajNagradu("CAR_WASH", requestId)

        val zahtjev = server.takeRequest()
        assertEquals("POST", zahtjev.method)
        assertEquals("/api/v1/rewards/CAR_WASH/issue", zahtjev.path)
        assertEquals("Bearer token-1", zahtjev.getHeader("Authorization"))
        assertTrue(zahtjev.getHeader("Content-Type")!!.startsWith("application/json"))
        val tijelo = Json.parseToJsonElement(zahtjev.body.readUtf8()).jsonObject
        assertEquals(setOf("requestId"), tijelo.keys)
        assertEquals(requestId, tijelo["requestId"]!!.jsonPrimitive.content)
        assertEquals(listOf(false), zatrazenoOsvjezavanje)
        val voucher = (rezultat as RezultatApi.Uspjeh).tijelo
        assertEquals(OdgovorVouchera(voucherId, "CAR_WASH", 50, "ACTIVE", "2026-10-20T10:00:00.000Z", "2026-10-20T10:15:00.000Z"), voucher)
    }

    @Test
    fun `I10-T11 API-03 200 (retry) se parsira`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(odgovorVouchera))
        assertTrue(api().izdajNagradu("SHOWER", requestId) is RezultatApi.Uspjeh)
    }

    @Test
    fun `I10-T11 API-03 503 pa 201 - 2 zahtjeva sa ISTIM tijelom`() = runTest {
        server.enqueue(greska(503, "SERVICE_UNAVAILABLE"))
        server.enqueue(MockResponse().setResponseCode(201).setBody(odgovorVouchera))
        assertTrue(api().izdajNagradu("CAR_WASH", requestId) is RezultatApi.Uspjeh)
        assertEquals(2, server.requestCount)
        val prvi = server.takeRequest().body.readUtf8()
        val drugi = server.takeRequest().body.readUtf8()
        assertEquals(prvi, drugi)
        assertEquals("""{"requestId":"$requestId"}""", prvi)
        assertEquals(listOf(1000L), pauze)
    }

    @Test
    fun `I10-T11 API-03 greska po 27 se parsira`() = runTest {
        server.enqueue(greska(409, "INSUFFICIENT_POINTS"))
        assertEquals(RezultatApi.GreskaBackenda("INSUFFICIENT_POINTS", 409), api().izdajNagradu("CAR_WASH", requestId))
    }

    @Test
    fun `I10-T11 rewardId sa kosom crtom je kodiran kao jedan segment putanje`() = runTest {
        server.enqueue(greska(404, "REWARD_NOT_FOUND"))
        api().izdajNagradu("A/B", requestId)
        assertEquals("/api/v1/rewards/A%2FB/issue", server.takeRequest().path)
    }

    @Test
    fun `I10-T11 API-05 je POST bez tijela, Content-Length 0 i bez Content-Type`() = runTest {
        server.enqueue(MockResponse().setResponseCode(200).setBody(odgovorVouchera.dropLast(1) + ""","cancelledAt":"2026-10-20T10:05:00.000Z"}"""))
        val rezultat = api().otkaziVoucher(voucherId)

        val zahtjev = server.takeRequest()
        assertEquals("POST", zahtjev.method)
        assertEquals("/api/v1/vouchers/$voucherId/cancel", zahtjev.path)
        assertEquals("Bearer token-1", zahtjev.getHeader("Authorization"))
        assertEquals("0", zahtjev.getHeader("Content-Length"))
        assertNull(zahtjev.getHeader("Content-Type"))
        assertEquals(0L, zahtjev.bodySize)
        assertEquals(voucherId, (rezultat as RezultatApi.Uspjeh).tijelo.voucherId)
    }

    @Test
    fun `I10-T11 API-05 greske 409 VOUCHER_EXPIRED i 404 VOUCHER_NOT_FOUND`() = runTest {
        server.enqueue(greska(409, "VOUCHER_EXPIRED"))
        server.enqueue(greska(404, "VOUCHER_NOT_FOUND"))
        assertEquals(RezultatApi.GreskaBackenda("VOUCHER_EXPIRED", 409), api().otkaziVoucher(voucherId))
        assertEquals(RezultatApi.GreskaBackenda("VOUCHER_NOT_FOUND", 404), api().otkaziVoucher(voucherId))
    }

    @Test
    fun `I10-T11 API-07 je DELETE bez tijela, Bearer, sa svjezim tokenom`() = runTest {
        server.enqueue(MockResponse().setResponseCode(204))
        val rezultat = api().obrisiNalog()

        val zahtjev = server.takeRequest()
        assertEquals("DELETE", zahtjev.method)
        assertEquals("/api/v1/account", zahtjev.path)
        assertEquals("Bearer token-1", zahtjev.getHeader("Authorization"))
        assertEquals(0L, zahtjev.bodySize)
        assertNull(zahtjev.getHeader("Content-Type"))
        assertEquals(RezultatApi.Uspjeh(Unit), rezultat)
        assertEquals(listOf(true), zatrazenoOsvjezavanje)
    }

    @Test
    fun `I10-T11 API-07 409 REAUTHENTICATION_REQUIRED i 401`() = runTest {
        server.enqueue(greska(409, "REAUTHENTICATION_REQUIRED"))
        server.enqueue(greska(401, "UNAUTHENTICATED"))
        assertEquals(RezultatApi.GreskaBackenda("REAUTHENTICATION_REQUIRED", 409), api().obrisiNalog())
        assertEquals(RezultatApi.GreskaBackenda("UNAUTHENTICATED", 401), api().obrisiNalog())
        assertEquals(listOf(true, true), zatrazenoOsvjezavanje)
    }

    @Test
    fun `I10-T11 API-07 503 pa 204 - 2 DELETE zahtjeva`() = runTest {
        server.enqueue(greska(503, "SERVICE_UNAVAILABLE"))
        server.enqueue(MockResponse().setResponseCode(204))
        assertEquals(RezultatApi.Uspjeh(Unit), api().obrisiNalog())
        assertEquals(2, server.requestCount)
    }

    @Test
    fun `I10-T11 zastavica brisanja - zabranjeni pozivi ne salju nijedan zahtjev`() = runTest {
        zastavica.ukljuci()
        val klijent = api()
        val ocekivano = RezultatApi.GreskaBackenda("ACCOUNT_DELETION_IN_PROGRESS", 0)
        assertEquals(ocekivano, klijent.izdajNagradu("CAR_WASH", requestId))
        assertEquals(ocekivano, klijent.otkaziVoucher(voucherId))
        assertEquals(ocekivano, klijent.inicijalizujNalog("Ana", "1.0"))
        assertEquals(ocekivano, klijent.uskladiVaucere())
        assertEquals(0, server.requestCount)
        assertTrue(zatrazenoOsvjezavanje.isEmpty())
    }

    @Test
    fun `I10-T11 zastavica brisanja ne blokira DELETE`() = runTest {
        zastavica.ukljuci()
        server.enqueue(MockResponse().setResponseCode(204))
        assertEquals(RezultatApi.Uspjeh(Unit), api().obrisiNalog())
        assertEquals(1, server.requestCount)
    }
}
