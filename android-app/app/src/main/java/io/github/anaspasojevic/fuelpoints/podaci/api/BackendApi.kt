package io.github.anaspasojevic.fuelpoints.podaci.api

import kotlinx.serialization.Serializable

// Backend API koji koristi i09 (README, §26): API-01 i API-06.
interface BackendApi {
    suspend fun inicijalizujNalog(displayName: String, acceptedTermsVersion: String): RezultatApi<OdgovorInita>
    suspend fun uskladiVaucere(): RezultatApi<OdgovorUskladjivanja>
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

// §27.
@Serializable
data class TijeloGreske(val error: OpisGreske)

@Serializable
data class OpisGreske(val code: String)
