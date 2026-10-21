package io.github.anaspasojevic.fuelpoints.podaci.nagrade

import com.google.firebase.Timestamp
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.flow.Flow

// UI-06, §12, §14, §25.5, §25.6: Android samo čita katalog i vlastite aktivne voucher-e; izdavanje i otkazivanje rade Backend API-ji.
interface IzvorNagrada {
    // Aktivne definicije nagrada, redom po costPoints pa ID.
    fun posmatrajKatalog(): Flow<StanjeDokumenta<List<Nagrada>>>

    // where uid == auth.uid, status == ACTIVE, orderBy expiresAt asc, limit 20 (ODLUKE (i), i10/P-9).
    fun posmatrajAktivneVouchere(uid: String): Flow<StanjeDokumenta<List<AktivniVoucher>>>
}

data class Nagrada(val rewardId: String, val displayName: String, val costPoints: Long)

data class AktivniVoucher(val voucherId: String, val rewardId: String, val costPoints: Long, val expiresAtMs: Long)

// i04/P-12: neispravna definicija (active nije true, displayName nije string, costPoints nije cijeli broj ≥ 1) se ne prikazuje.
fun mapirajNagradu(id: String, polja: Map<String, Any?>): Nagrada? {
    if (polja["active"] != true) return null
    val naziv = polja["displayName"] as? String ?: return null
    val cijena = (polja["costPoints"] as? Long)?.takeIf { it >= 1 } ?: return null
    return Nagrada(id, naziv, cijena)
}

// Samo dokument sa status == ACTIVE, ispravnim expiresAt (Timestamp) i costPoints.
fun mapirajVoucher(id: String, polja: Map<String, Any?>): AktivniVoucher? {
    if (polja["status"] != "ACTIVE") return null
    val rewardId = polja["rewardId"] as? String ?: return null
    val cijena = (polja["costPoints"] as? Long)?.takeIf { it >= 0 } ?: return null
    val istice = (polja["expiresAt"] as? Timestamp)?.toDate()?.time ?: return null
    return AktivniVoucher(id, rewardId, cijena, istice)
}
