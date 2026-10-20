package io.github.anaspasojevic.fuelpoints

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import io.github.anaspasojevic.fuelpoints.domen.ProvjeraNaloga
import io.github.anaspasojevic.fuelpoints.podaci.api.BackendApi
import io.github.anaspasojevic.fuelpoints.podaci.api.OkHttpBackendApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.FirebaseIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.FirestoreIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IzvorNaloga

// Ručni kontejner zavisnosti (bez DI biblioteke, O-45).
class Zavisnosti(auth: FirebaseAuth, baza: FirebaseFirestore) {
    private val firebaseAutentikacija = FirebaseIzvorAutentikacije(auth)
    val izvorAutentikacije: IzvorAutentikacije = firebaseAutentikacija
    val izvorNaloga: IzvorNaloga = FirestoreIzvorNaloga(baza)
    val backendApi: BackendApi = OkHttpBackendApi(BuildConfig.BACKEND_BAZNI_URL, firebaseAutentikacija::dobaviToken)
    val provjeraNaloga = ProvjeraNaloga(izvorAutentikacije, izvorNaloga, backendApi, BuildConfig.VERZIJA_USLOVA)
}
