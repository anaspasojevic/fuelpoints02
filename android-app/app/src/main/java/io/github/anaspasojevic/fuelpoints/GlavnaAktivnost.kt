package io.github.anaspasojevic.fuelpoints

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.TemaFuelPoints

// Jedina aktivnost aplikacije.
class GlavnaAktivnost : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        setContent {
            TemaFuelPoints {
                Box(Modifier.fillMaxSize().background(LocalBoje.current.pozadina))
            }
        }
    }
}
