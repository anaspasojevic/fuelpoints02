package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

// NFR-08: offline/stale marker (9_pocetna_tamna_offline.png).
@Composable
fun OznakaBezMreze(modifier: Modifier = Modifier) {
    val boje = LocalBoje.current
    Row(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(painterResource(R.drawable.ikona_bez_mreze), contentDescription = null, tint = boje.lcd, modifier = Modifier.size(20.dp))
        Text(
            stringResource(R.string.bez_mreze_marker),
            style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold),
            color = boje.lcd,
        )
    }
}
