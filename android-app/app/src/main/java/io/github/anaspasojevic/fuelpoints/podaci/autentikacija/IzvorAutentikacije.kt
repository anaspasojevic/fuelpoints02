package io.github.anaspasojevic.fuelpoints.podaci.autentikacija

import kotlinx.coroutines.flow.Flow

// Firebase Auth iza interfejsa, da bi tokovi AUTH-01/03/06/09 bili testabilni na JVM-u.
interface IzvorAutentikacije {
    fun trenutniUid(): String?

    // displayName iz Auth profila, upisan pri registraciji (i09/P-3).
    fun imeIzProfila(): String?

    // UID dok sesija postoji, null kad je nema (QR-03).
    fun posmatrajSesiju(): Flow<String?>

    suspend fun prijavi(email: String, lozinka: String): IshodAutentikacije
    suspend fun registruj(email: String, lozinka: String): IshodAutentikacije
    suspend fun postaviIme(displayName: String): IshodAutentikacije
    suspend fun posaljiReset(email: String): IshodAutentikacije

    // Svjež ID token (§3.3); null bez sesije; IOException kad mreža nije dostupna.
    suspend fun dobaviToken(): String?
}

sealed interface IshodAutentikacije {
    data object Uspjeh : IshodAutentikacije
    data object MreznaGreska : IshodAutentikacije
    data object NeispravnaLozinka : IshodAutentikacije
    data object NepostojeciKorisnik : IshodAutentikacije
    data object OnemogucenKorisnik : IshodAutentikacije
    data object PrevisePokusaja : IshodAutentikacije
    data object NeispravanEmail : IshodAutentikacije
    data object EmailZauzet : IshodAutentikacije
    data object SlabaLozinka : IshodAutentikacije
    data object NepoznataGreska : IshodAutentikacije
}
