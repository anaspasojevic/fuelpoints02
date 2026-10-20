package io.github.anaspasojevic.fuelpoints.podaci.nalog

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.tasks.await

// Samo get() i snapshot listener-i (owner get, §25.2, §25.3); nema set/update/delete.
class FirestoreIzvorNaloga(private val baza: FirebaseFirestore) : IzvorNaloga {

    override suspend fun procitajKorisnika(uid: String): StanjeDokumenta<Korisnik> = try {
        // Podrazumijevani izvor: server, a offline keš.
        stanje(baza.collection("users").document(uid).get().await(), ::uKorisnika)
    } catch (_: Exception) {
        StanjeDokumenta.Greska
    }

    override fun posmatrajKorisnika(uid: String) = posmatraj("users", uid, ::uKorisnika)

    override fun posmatrajLoyaltyNalog(uid: String) = posmatraj("loyaltyAccounts", uid) { snimak ->
        LoyaltyNalog(
            availablePoints = snimak.get("availablePoints") as? Long,
            reservedPoints = snimak.get("reservedPoints") as? Long,
        )
    }

    // MetadataChanges.INCLUDE: novi snimak stiže i kad se promijeni samo isFromCache (NFR-08).
    private fun <T> posmatraj(kolekcija: String, uid: String, mapiraj: (DocumentSnapshot) -> T): Flow<StanjeDokumenta<T>> =
        callbackFlow {
            val registracija = baza.collection(kolekcija).document(uid)
                .addSnapshotListener(MetadataChanges.INCLUDE) { snimak, greska ->
                    trySend(if (greska != null || snimak == null) StanjeDokumenta.Greska else stanje(snimak, mapiraj))
                }
            awaitClose { registracija.remove() }
        }.distinctUntilChanged()

    private fun <T> stanje(snimak: DocumentSnapshot, mapiraj: (DocumentSnapshot) -> T): StanjeDokumenta<T> {
        val izKesa = snimak.metadata.isFromCache
        return if (snimak.exists()) StanjeDokumenta.Postoji(mapiraj(snimak), izKesa) else StanjeDokumenta.NePostoji(izKesa)
    }

    private fun uKorisnika(snimak: DocumentSnapshot) = Korisnik(
        displayName = snimak.getString("displayName"),
        accountStatus = snimak.getString("accountStatus"),
    )
}
