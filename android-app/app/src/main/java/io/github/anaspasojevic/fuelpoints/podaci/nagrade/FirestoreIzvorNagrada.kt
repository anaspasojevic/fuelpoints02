package io.github.anaspasojevic.fuelpoints.podaci.nagrade

import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.MetadataChanges
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.flow.distinctUntilChanged

// Samo snapshot listener-i (§25.5, §25.6); nema upisa. Indeks za vouchers: firebase/firestore.indexes.json.
class FirestoreIzvorNagrada(private val baza: FirebaseFirestore) : IzvorNagrada {

    // rewardDefinitions: cijela kolekcija (2 dokumenta), čita je samo prijavljen korisnik (§31).
    override fun posmatrajKatalog(): Flow<StanjeDokumenta<List<Nagrada>>> = posmatraj(baza.collection("rewardDefinitions")) { snimak ->
        snimak.documents.mapNotNull { mapirajNagradu(it.id, it.data ?: emptyMap()) }
            .sortedWith(compareBy({ it.costPoints }, { it.rewardId }))
    }

    override fun posmatrajAktivneVouchere(uid: String): Flow<StanjeDokumenta<List<AktivniVoucher>>> {
        val upit = baza.collection("vouchers")
            .whereEqualTo("uid", uid)
            .whereEqualTo("status", "ACTIVE")
            .orderBy("expiresAt", Query.Direction.ASCENDING)
            .limit(20)
        return posmatraj(upit) { snimak -> snimak.documents.mapNotNull { mapirajVoucher(it.id, it.data ?: emptyMap()) } }
    }

    private fun <T> posmatraj(upit: Query, mapiraj: (QuerySnapshot) -> List<T>): Flow<StanjeDokumenta<List<T>>> = callbackFlow {
        val registracija = upit.addSnapshotListener(MetadataChanges.INCLUDE) { snimak, greska ->
            trySend(
                if (greska != null || snimak == null) StanjeDokumenta.Greska
                else StanjeDokumenta.Postoji(mapiraj(snimak), snimak.metadata.isFromCache),
            )
        }
        awaitClose { registracija.remove() }
    }.distinctUntilChanged()
}
