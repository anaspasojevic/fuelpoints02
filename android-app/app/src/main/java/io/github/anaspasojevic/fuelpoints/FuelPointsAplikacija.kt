package io.github.anaspasojevic.fuelpoints

import android.app.Application
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore

// Inicijalizacija Firebase-a iz BuildConfig vrijednosti, bez google-services.json (O-39).
class FuelPointsAplikacija : Application() {

    lateinit var zavisnosti: Zavisnosti
        private set

    override fun onCreate() {
        super.onCreate()
        val opcije = FirebaseOptions.Builder()
            .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
            .setApplicationId(BuildConfig.FIREBASE_APPLICATION_ID)
            .setApiKey(BuildConfig.FIREBASE_API_KEY)
            .build()
        val aplikacija = FirebaseApp.initializeApp(this, opcije)
        val auth = FirebaseAuth.getInstance(aplikacija)
        val baza = FirebaseFirestore.getInstance(aplikacija)
        if (BuildConfig.KORISTI_EMULATOR) {
            // Emulator se mora postaviti prije prve upotrebe Auth-a i Firestore-a.
            auth.useEmulator(BuildConfig.EMULATOR_HOST, BuildConfig.PORT_AUTH)
            baza.useEmulator(BuildConfig.EMULATOR_HOST, BuildConfig.PORT_FIRESTORE)
        }
        zavisnosti = Zavisnosti(auth, baza)
    }
}
