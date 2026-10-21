package io.github.anaspasojevic.fuelpoints.podaci.kupovine

import com.google.firebase.Timestamp

// UI-05, §8.3, §25.4: Android samo čita vlastite kupovine (where uid == auth.uid, orderBy occurredAt desc, limit 20).
interface IzvorKupovina {
    // kursor == null: prva stranica; inače startAfter(posljednji snimak prethodne stranice).
    suspend fun stranica(uid: String, kursor: Kursor?): IshodStranice
}

// Neprozirni omotač (u aplikaciji DocumentSnapshot) da ViewModel ostane testabilan na JVM-u.
class Kursor(val snimak: Any)

data class Stranica(val kupovine: List<Kupovina>, val sljedeciKursor: Kursor?)

sealed interface IshodStranice {
    data class Uspjeh(val stranica: Stranica) : IshodStranice
    data object Greska : IshodStranice
}

data class Kupovina(
    val id: String,
    val occurredAtMs: Long,
    val volumeMl: Long,
    val amountMinor: Long,
    val currency: String,
    val earnedPoints: Long,
)

// §8.3: dokument kome nešto od polja nedostaje ili ima pogrešan tip se preskače (vraća null), a ne ruši stranicu.
fun mapirajKupovinu(id: String, polja: Map<String, Any?>): Kupovina? {
    val vrijeme = (polja["occurredAt"] as? Timestamp)?.toDate()?.time ?: return null
    val volumeMl = (polja["volumeMl"] as? Long)?.takeIf { it >= 0 } ?: return null
    val amountMinor = (polja["amountMinor"] as? Long)?.takeIf { it >= 0 } ?: return null
    val earnedPoints = (polja["earnedPoints"] as? Long)?.takeIf { it >= 0 } ?: return null
    val currency = (polja["currency"] as? String)?.takeIf { it.isNotEmpty() } ?: return null
    return Kupovina(id, vrijeme, volumeMl, amountMinor, currency, earnedPoints)
}
