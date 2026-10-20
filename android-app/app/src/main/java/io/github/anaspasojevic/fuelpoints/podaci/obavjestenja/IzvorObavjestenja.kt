package io.github.anaspasojevic.fuelpoints.podaci.obavjestenja

import com.google.firebase.Timestamp
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.flow.Flow

// UI-07, §21, §25.8: do 50 najnovijih vlastitih obavještenja (where uid == auth.uid, orderBy createdAt desc, limit 50).
interface IzvorObavjestenja {
    fun posmatraj(uid: String): Flow<StanjeDokumenta<List<Obavjestenje>>>

    // Jedini upis u notifications (RULE-T10): readAt = serverTimestamp(). false kad Rules ili veza odbiju upis.
    suspend fun oznaciProcitano(id: String): Boolean
}

data class Obavjestenje(
    val id: String,
    val title: String,
    val body: String,
    val createdAtMs: Long,
    val procitano: Boolean,
)

// readAt je Timestamp (ili procjena lokalnog pending upisa, ESTIMATE) kad je pročitano, inače null.
fun mapirajObavjestenje(id: String, polja: Map<String, Any?>, readAt: Timestamp?): Obavjestenje? {
    val naslov = polja["title"] as? String ?: return null
    val tekst = polja["body"] as? String ?: return null
    val kreirano = (polja["createdAt"] as? Timestamp)?.toDate()?.time ?: return null
    return Obavjestenje(id, naslov, tekst, kreirano, procitano = readAt != null)
}
