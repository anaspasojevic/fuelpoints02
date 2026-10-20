package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.annotation.DrawableRes
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

// Bijela kartica (.kartica) zaobljenih uglova.
@Composable
fun Kartica(modifier: Modifier = Modifier, sadrzaj: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth().background(LocalBoje.current.kartica, RoundedCornerShape(16.dp)), content = sadrzaj)
}

// Red liste (Profil): ikona, tekst, opciona vrijednost i chevron; visina ≥ 56 dp (NFR-10).
@Composable
fun RedListe(
    @DrawableRes ikona: Int,
    tekst: String,
    modifier: Modifier = Modifier,
    vrijednost: String? = null,
    opasno: Boolean = false,
    chevron: Boolean = false,
    naKlik: (() -> Unit)? = null,
) {
    val boje = LocalBoje.current
    val boja = if (opasno) boje.crvena else boje.tekst
    val klik = if (naKlik != null) Modifier.clickable(role = Role.Button, onClick = naKlik) else Modifier
    Row(
        modifier.fillMaxWidth().heightIn(min = 56.dp).then(klik).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(painterResource(ikona), contentDescription = null, tint = boja, modifier = Modifier.size(22.dp))
        Text(tekst, style = MaterialTheme.typography.bodyMedium, color = boja, modifier = Modifier.weight(1f))
        if (vrijednost != null) Text(vrijednost, style = MaterialTheme.typography.bodySmall, color = boje.sekundarni)
        if (chevron) Icon(painterResource(R.drawable.ikona_strelica_desno), contentDescription = null, tint = boje.sekundarni, modifier = Modifier.size(22.dp))
    }
}

// Sekundarna akcija (okvir, visina ≥ 48 dp).
@Composable
fun SporednoDugme(tekst: String, naKlik: () -> Unit, modifier: Modifier = Modifier, omoguceno: Boolean = true, @DrawableRes ikona: Int? = null) {
    val boje = LocalBoje.current
    OutlinedButton(
        onClick = naKlik,
        enabled = omoguceno,
        modifier = modifier.heightIn(min = 48.dp),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.5.dp, boje.linija),
    ) {
        if (ikona != null) {
            Icon(painterResource(ikona), contentDescription = null, tint = boje.tekst, modifier = Modifier.size(18.dp))
            Spacer(Modifier.width(6.dp))
        }
        Text(tekst, style = MaterialTheme.typography.labelLarge, color = boje.tekst)
    }
}

@Composable
fun PorukaUspjeha(tekst: String, modifier: Modifier = Modifier) {
    val boje = LocalBoje.current
    Text(tekst, style = MaterialTheme.typography.bodySmall, color = boje.zelena, modifier = modifier.fillMaxWidth())
}

// Zaglavlje sa strelicom nazad (ekrani izvan tabova).
@Composable
fun ZaglavljeNazad(naslov: String, naNazad: () -> Unit) {
    DugmeNazad(naNazad)
    Naslov(naslov)
}
