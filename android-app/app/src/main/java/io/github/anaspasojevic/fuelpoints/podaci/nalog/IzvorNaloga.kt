package io.github.anaspasojevic.fuelpoints.podaci.nalog

import kotlinx.coroutines.flow.Flow

// Android čita users/{uid} i loyaltyAccounts/{uid} (§2.2, §25.2, §25.3); jedini upis je promijeniIme (RULE-T04).
interface IzvorNaloga {
    suspend fun procitajKorisnika(uid: String): StanjeDokumenta<Korisnik>
    fun posmatrajKorisnika(uid: String): Flow<StanjeDokumenta<Korisnik>>
    fun posmatrajLoyaltyNalog(uid: String): Flow<StanjeDokumenta<LoyaltyNalog>>

    // UI-08, §25.2: users/{uid}.update({ displayName, updatedAt: serverTimestamp() }) i ništa drugo.
    suspend fun promijeniIme(uid: String, displayName: String): IshodUpisaImena
}

sealed interface IshodUpisaImena {
    data object Uspjeh : IshodUpisaImena

    // Rules su odbile upis (PERMISSION_DENIED).
    data object Odbijeno : IshodUpisaImena

    // Rok od 10 s ili greška veze: upis ostaje u redu i šalje se kasnije.
    data object NemaVeze : IshodUpisaImena
}

// izKesa = metadata.isFromCache (NFR-08).
sealed interface StanjeDokumenta<out T> {
    data class Postoji<T>(val podaci: T, val izKesa: Boolean) : StanjeDokumenta<T>
    data class NePostoji(val izKesa: Boolean) : StanjeDokumenta<Nothing>
    data object Greska : StanjeDokumenta<Nothing>
}

data class Korisnik(val displayName: String?, val accountStatus: String?)

// Vrijednost je null kad polje nije cijeli broj; bodovi se nikad ne računaju lokalno.
data class LoyaltyNalog(val availablePoints: Long?, val reservedPoints: Long?)
