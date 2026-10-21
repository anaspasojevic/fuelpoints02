package io.github.anaspasojevic.fuelpoints.podaci.api

import kotlinx.serialization.Serializable

// Backend API koji koristi Android: API-01, API-03, API-05, API-06 i API-07 (README, §26).
interface BackendApi {
    suspend fun inicijalizujNalog(displayName: String, acceptedTermsVersion: String): RezultatApi<OdgovorInita>
    suspend fun uskladiVaucere(): RezultatApi<OdgovorUskladjivanja>

    // API-03 (§13): tijelo je tačno { requestId }; 503 klijent ponavlja ISTIM requestId (O-16, O-50).
    suspend fun izdajNagradu(rewardId: String, requestId: String): RezultatApi<OdgovorVouchera>

    // API-05 (§19): POST bez tijela.
    suspend fun otkaziVoucher(voucherId: String): RezultatApi<OdgovorVouchera>

    // API-07 (§23): DELETE bez tijela, 204 bez tijela (O-33); traži svjež ID token (O-35).
    suspend fun obrisiNalog(): RezultatApi<Unit>
}

sealed interface RezultatApi<out T> {
    data class Uspjeh<T>(val tijelo: T) : RezultatApi<T>

    // kod je §27 error.code; null kad tijelo nije §27 JSON (sirov odgovor se nikad ne prosljeđuje UI-ju).
    data class GreskaBackenda(val kod: String?, val status: Int) : RezultatApi<Nothing>

    data object MreznaGreska : RezultatApi<Nothing>
}

// API-01 tijelo: tačno dva polja; UID se nikad ne šalje (§3.3).
@Serializable
data class TijeloInita(val displayName: String, val acceptedTermsVersion: String)

// i02/P-1.
@Serializable
data class OdgovorInita(
    val displayName: String,
    val accountStatus: String,
    val acceptedTermsVersion: String,
    val availablePoints: Long,
    val reservedPoints: Long,
)

// i05/P-1.
@Serializable
data class OdgovorUskladjivanja(val reconciledCount: Int)

// API-03 tijelo: tačno jedno polje (§13); UID, costPoints i stationId se nikad ne šalju.
@Serializable
data class TijeloIzdavanja(val requestId: String)

// i04/P-1 (API-03), i05/P-1 (API-05, dodatno cancelledAt koji se ignoriše). Tijelo se ne koristi za stanje (README).
@Serializable
data class OdgovorVouchera(
    val voucherId: String,
    val rewardId: String,
    val costPoints: Long,
    val status: String,
    val issuedAt: String,
    val expiresAt: String,
)

// §27.
@Serializable
data class TijeloGreske(val error: OpisGreske)

@Serializable
data class OpisGreske(val code: String)
