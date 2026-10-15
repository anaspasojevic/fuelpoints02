package io.github.anaspasojevic.fuelpoints

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.ui.Modifier

// Jedina početna aktivnost u Iteraciji 1: prazan Compose sadržaj (ekrani dolaze u Iteracijama 9–10).
class GlavnaAktivnost : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            Box(Modifier.fillMaxSize())
        }
    }
}
