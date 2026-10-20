package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

// Glavna akcija ekrana (.dugme.zuto): puna širina, visina 56 dp (NFR-10).
@Composable
fun ZutoDugme(
    tekst: String,
    naKlik: () -> Unit,
    modifier: Modifier = Modifier,
    radi: Boolean = false,
    @DrawableRes ikona: Int? = null,
) {
    val boje = LocalBoje.current
    Button(
        onClick = naKlik,
        enabled = !radi,
        modifier = modifier.fillMaxWidth().height(56.dp),
        shape = RoundedCornerShape(14.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = boje.zuta,
            contentColor = boje.tekstNaZutoj,
            disabledContainerColor = boje.zuta.copy(alpha = 0.6f),
            disabledContentColor = boje.tekstNaZutoj,
        ),
    ) {
        if (radi) {
            CircularProgressIndicator(Modifier.size(22.dp), color = boje.tekstNaZutoj, strokeWidth = 2.5.dp)
        } else {
            if (ikona != null) {
                // Dekorativna: tekst dugmeta nosi značenje.
                Icon(painterResource(ikona), contentDescription = null, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(8.dp))
            }
            Text(tekst, style = MaterialTheme.typography.labelLarge)
        }
    }
}
