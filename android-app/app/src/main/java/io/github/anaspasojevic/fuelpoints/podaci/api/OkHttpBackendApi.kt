package io.github.anaspasojevic.fuelpoints.podaci.api

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

// OkHttp + kotlinx.serialization klijent (O-45). Svaki poziv nosi svjež ID token (§3.3, NFR-01); nema logovanja.
// dobaviToken vraća null kad nema sesije, a baca IOException kad token ne može da se dobije zbog mreže.
class OkHttpBackendApi(
    private val baznaAdresa: String,
    private val dobaviToken: suspend () -> String?,
    private val pauza: suspend (Long) -> Unit = { delay(it) },
    private val ioDispecer: CoroutineDispatcher = Dispatchers.IO,
    private val klijent: OkHttpClient = OkHttpClient.Builder().callTimeout(15, TimeUnit.SECONDS).build(),
) : BackendApi {

    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun inicijalizujNalog(displayName: String, acceptedTermsVersion: String): RezultatApi<OdgovorInita> {
        val tijelo = json.encodeToString(TijeloInita.serializer(), TijeloInita(displayName, acceptedTermsVersion))
        return posalji("account/init", { tijelo.toRequestBody(JSON_TIP) }, OdgovorInita.serializer())
    }

    // API-06: POST bez tijela — Content-Length: 0 i bez Content-Type (O-43, ODLUKE (s)).
    override suspend fun uskladiVaucere(): RezultatApi<OdgovorUskladjivanja> =
        posalji("account/vouchers/reconcile", { ByteArray(0).toRequestBody(null) }, OdgovorUskladjivanja.serializer())

    // R-04, O-43: na 503 jedan ponovni pokušaj poslije 1 000 ms (oba endpointa su idempotentna).
    private suspend fun <T> posalji(
        putanja: String,
        tijelo: () -> RequestBody,
        deserijalizator: DeserializationStrategy<T>,
    ): RezultatApi<T> {
        // Release bez konfiguracije (i09/P-7): fail closed, bez mrežnog poziva.
        if (baznaAdresa.isEmpty()) return RezultatApi.GreskaBackenda(null, 0)
        val prvi = jedanPokusaj(putanja, tijelo(), deserijalizator)
        if (prvi !is RezultatApi.GreskaBackenda || prvi.status != 503) return prvi
        pauza(PAUZA_503_MS)
        return jedanPokusaj(putanja, tijelo(), deserijalizator)
    }

    private suspend fun <T> jedanPokusaj(
        putanja: String,
        tijelo: RequestBody,
        deserijalizator: DeserializationStrategy<T>,
    ): RezultatApi<T> {
        val token = try {
            dobaviToken()
        } catch (_: IOException) {
            return RezultatApi.MreznaGreska
        } ?: return RezultatApi.GreskaBackenda("UNAUTHENTICATED", 401)

        val zahtjev = Request.Builder()
            .url(baznaAdresa + putanja)
            .header("Authorization", "Bearer $token")
            .post(tijelo)
            .build()
        return withContext(ioDispecer) {
            try {
                klijent.newCall(zahtjev).execute().use { odgovor ->
                    val tekst = odgovor.body.string()
                    if (odgovor.isSuccessful) {
                        try {
                            RezultatApi.Uspjeh(json.decodeFromString(deserijalizator, tekst))
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
