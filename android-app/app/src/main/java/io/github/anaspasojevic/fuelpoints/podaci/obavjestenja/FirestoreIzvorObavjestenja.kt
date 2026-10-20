package io.github.anaspasojevic.fuelpoints.podaci.obavjestenja

import com.google.firebase.firestore.DocumentSnapshot.ServerTimestampBehavior
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Query
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.tasks.await

class FirestoreIzvorObavjestenja(private val baza: FirebaseFirestore) : IzvorObavjestenja {

    override fun posmatraj(uid: String): Flow<StanjeDokumenta<List<Obavjestenje>>> = callbackFlow {
        val upit = baza.collection("notifications")
            .whereEqualTo("uid", uid)
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(50)
        val registracija = upit.addSnapshotListener(MetadataChanges.INCLUDE) { snimak, greska ->
            if (greska != null || snimak == null) {
                trySend(StanjeDokumenta.Greska)
            } else {
                // ESTIMATE: lokalni pending upis readAt odmah izgleda pročitano.
                val lista = snimak.documents.mapNotNull {
                    mapirajObavjestenje(it.id, it.data ?: emptyMap(), it.getTimestamp("readAt", ServerTimestampBehavior.ESTIMATE))
                }
                trySend(StanjeDokumenta.Postoji(lista, snimak.metadata.isFromCache))
            }
        }
        awaitClose { registracija.remove() }
    }.distinctUntilChanged()

    // Jedino polje readAt (RULE-T10); poziva se samo kad je readAt == null (ponovni upis Rules odbijaju).
    override suspend fun oznaciProcitano(id: String): Boolean = try {
        baza.collection("notifications").document(id).update("readAt", FieldValue.serverTimestamp()).await()
        true
    } catch (_: Exception) {
        false
    }
}
