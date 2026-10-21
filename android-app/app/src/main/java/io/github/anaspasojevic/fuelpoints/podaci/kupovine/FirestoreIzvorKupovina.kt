package io.github.anaspasojevic.fuelpoints.podaci.kupovine

import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import kotlinx.coroutines.tasks.await

// Samo get() (§25.4); upit tačno po §31: uid == auth.uid, orderBy occurredAt desc, limit 20 (ODLUKE (e)).
class FirestoreIzvorKupovina(private val baza: FirebaseFirestore) : IzvorKupovina {

    override suspend fun stranica(uid: String, kursor: Kursor?): IshodStranice = try {
        var upit: Query = baza.collection("purchases")
            .whereEqualTo("uid", uid)
            .orderBy("occurredAt", Query.Direction.DESCENDING)
        if (kursor != null) upit = upit.startAfter(kursor.snimak as DocumentSnapshot)
        val snimci = upit.limit(20).get().await().documents
        val kupovine = snimci.mapNotNull { mapirajKupovinu(it.id, it.data ?: emptyMap()) }
        // Kursor ide od sirovog posljednjeg snimka, i kad je neki dokument preskočen.
        val sljedeci = if (snimci.size == 20) Kursor(snimci.last()) else null
        IshodStranice.Uspjeh(Stranica(kupovine, sljedeci))
    } catch (_: Exception) {
        IshodStranice.Greska
    }
}
