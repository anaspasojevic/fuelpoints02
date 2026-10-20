package io.github.anaspasojevic.fuelpoints.podaci.nalog

import kotlinx.coroutines.flow.Flow

// Android samo čita users/{uid} i loyaltyAccounts/{uid} (§2.2, §25.2, §25.3); upisa nema.
interface IzvorNaloga {
    suspend fun procitajKorisnika(uid: String): StanjeDokumenta<Korisnik>
    fun posmatrajKorisnika(uid: String): Flow<StanjeDokumenta<Korisnik>>
    fun posmatrajLoyaltyNalog(uid: String): Flow<StanjeDokumenta<LoyaltyNalog>>
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
