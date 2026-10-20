package io.github.anaspasojevic.fuelpoints

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import io.github.anaspasojevic.fuelpoints.ui.navigacija.NavigacijaAplikacije
import io.github.anaspasojevic.fuelpoints.ui.tema.TemaFuelPoints

// Jedina aktivnost aplikacije.
class GlavnaAktivnost : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        val zavisnosti = (application as FuelPointsAplikacija).zavisnosti
        setContent {
            TemaFuelPoints {
                NavigacijaAplikacije(zavisnosti)
            }
        }
    }
}
