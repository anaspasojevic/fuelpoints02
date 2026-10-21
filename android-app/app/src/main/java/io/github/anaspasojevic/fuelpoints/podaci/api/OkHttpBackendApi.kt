package io.github.anaspasojevic.fuelpoints.podaci.api

import io.github.anaspasojevic.fuelpoints.domen.ZastavicaBrisanja
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

// OkHttp + kotlinx.serialization klijent (O-45). Svaki poziv nosi svjež ID token (§3.3, NFR-01); nema logovanja.
// dobaviToken(osvjezi) vraća null kad nema sesije, a baca IOException kad token ne može da se dobije zbog mreže.
class OkHttpBackendApi(
    private val baznaAdresa: String,
    private val dobaviToken: suspend (osvjezi: Boolean) -> String?,
    private val pauza: suspend (Long) -> Unit = { delay(it) },
    private val ioDispecer: CoroutineDispatcher = Dispatchers.IO,
    private val klijent: OkHttpClient = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build(),
    private val zastavica: ZastavicaBrisanja = ZastavicaBrisanja(),
) : BackendApi {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun inicijalizujNalog(displayName: String, acceptedTermsVersion: String): RezultatApi<OdgovorInita> {
        val tijelo = json.encodeToString(TijeloInita.serializer(), TijeloInita(displayName, acceptedTermsVersion))
        return posalji("POST", listOf("account", "init"), { tijelo.toRequestBody(JSON_TIP) }) {
            json.decodeFromString(OdgovorInita.serializer(), it)
        }
    }

    // API-06: POST bez tijela — Content-Length: 0 i bez Content-Type (O-43, ODLUKE (s)).
    override suspend fun uskladiVaucere(): RezultatApi<OdgovorUskladjivanja> =
        posalji("POST", listOf("account", "vouchers", "reconcile"), { praznoTijelo() }) {
            json.decodeFromString(OdgovorUskladjivanja.serializer(), it)
        }

    override suspend fun izdajNagradu(rewardId: String, requestId: String): RezultatApi<OdgovorVouchera> {
        val tijelo = json.encodeToString(TijeloIzdavanja.serializer(), TijeloIzdavanja(requestId))
        return posalji("POST", listOf("rewards", rewardId, "issue"), { tijelo.toRequestBody(JSON_TIP) }) {
            json.decodeFromString(OdgovorVouchera.serializer(), it)
        }
    }

    // API-05: kao API-06, bez tijela i bez Content-Type (ODLUKE (s)).
    override suspend fun otkaziVoucher(voucherId: String): RezultatApi<OdgovorVouchera> =
        posalji("POST", listOf("vouchers", voucherId, "cancel"), { praznoTijelo() }) {
            json.decodeFromString(OdgovorVouchera.serializer(), it)
        }

    // API-07: DELETE bez tijela; svjež token (O-35); dozvoljen i dok je zastavica brisanja uključena, jer je to sam tok brisanja.
    override suspend fun obrisiNalog(): RezultatApi<Unit> =
        posalji("DELETE", listOf("account"), null, osvjeziToken = true, dozvoljenoUBrisanju = true) { }

    private fun praznoTijelo(): RequestBody = ByteArray(0).toRequestBody(null)

    // R-04: na 503 jedan ponovni pokušaj poslije 1 000 ms (svi endpointi su idempotentni: API-03 istim requestId-em).
    private suspend fun <T> posalji(
        metod: String,
        segmenti: List<String>,
        tijelo: (() -> RequestBody)?,
        osvjeziToken: Boolean = false,
        dozvoljenoUBrisanju: Boolean = false,
        parsiraj: (String) -> T,
    ): RezultatApi<T> {
        // Release bez konfiguracije (i09/P-7): fail closed, bez mrežnog poziva.
        if (baznaAdresa.isEmpty()) return RezultatApi.GreskaBackenda(null, 0)
        // (v): za vrijeme brisanja naloga nema drugih poziva.
        if (zastavica.jeUkljucena() && !dozvoljenoUBrisanju) return RezultatApi.GreskaBackenda("ACCOUNT_DELETION_IN_PROGRESS", 0)
        val prvi = jedanPokusaj(metod, segmenti, tijelo, osvjeziToken, parsiraj)
        if (prvi !is RezultatApi.GreskaBackenda || prvi.status != 503) return prvi
        pauza(PAUZA_503_MS)
        return jedanPokusaj(metod, segmenti, tijelo, osvjeziToken, parsiraj)
    }

    private suspend fun <T> jedanPokusaj(
        metod: String,
        segmenti: List<String>,
        tijelo: (() -> RequestBody)?,
        osvjeziToken: Boolean,
        parsiraj: (String) -> T,
    ): RezultatApi<T> {
        val token = try {
            dobaviToken(osvjeziToken)
        } catch (_: IOException) {
            return RezultatApi.MreznaGreska
        } ?: return RezultatApi.GreskaBackenda("UNAUTHENTICATED", 401)

        // Segmenti putanje (rewardId, voucherId) se kodiraju; ništa se ne umeće u URL nekodirano.
        val adresa = baznaAdresa.toHttpUrl().newBuilder().apply { segmenti.forEach { addPathSegment(it) } }.build()
        val graditelj = Request.Builder().url(adresa).header("Authorization", "Bearer $token")
        val zahtjev = when (metod) {
            "DELETE" -> graditelj.delete().build()
            else -> graditelj.post(tijelo!!()).build()
        }
        return withContext(ioDispecer) {
            try {
                klijent.newCall(zahtjev).execute().use { odgovor ->
                    val tekst = odgovor.body.string()
                    if (odgovor.isSuccessful) {
                        try {
                            RezultatApi.Uspjeh(parsiraj(tekst))
                        } catch (_: IllegalArgumentException) {
                            RezultatApi.GreskaBackenda(null, odgovor.code)
                        }
                    } else {
                        RezultatApi.GreskaBackenda(procitajKod(tekst), odgovor.code)
                    }
                }
            } catch (_: IOException) {
                RezultatApi.MreznaGreska
            }
        }
    }

    private fun procitajKod(tekst: String): String? = try {
        json.decodeFromString(TijeloGreske.serializer(), tekst).error.code
    } catch (_: IllegalArgumentException) {
        null
    }

    private companion object {
        val JSON_TIP = "application/json; charset=utf-8".toMediaType()
        const val PAUZA_503_MS = 1_000L
    }
}
