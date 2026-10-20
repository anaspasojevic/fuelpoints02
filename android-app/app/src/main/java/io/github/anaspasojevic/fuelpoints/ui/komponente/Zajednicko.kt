package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.stilNaslov

// Okvir svakog ekrana: pozadina teme, sistemske trake i tastatura (safeDrawing), skrol i bočni razmak 20 dp.
@Composable
fun EkranOkvir(sadrzaj: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxSize()
            .background(LocalBoje.current.pozadina)
            .windowInsetsPadding(WindowInsets.safeDrawing)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 8.dp),
        content = sadrzaj,
    )
}

@Composable
fun PorukaGreske(tekst: String, modifier: Modifier = Modifier) {
    val boje = LocalBoje.current
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(painterResource(R.drawable.ikona_greska), contentDescription = null, tint = boje.crvena, modifier = Modifier.size(18.dp))
        Text(tekst, style = MaterialTheme.typography.bodySmall, color = boje.crvena)
    }
}

// Tekstualni link sa žutim podvlačenjem (.link); površina dodira ≥ 48 dp (NFR-10).
@Composable
fun LinkTekst(tekst: String, naKlik: () -> Unit, modifier: Modifier = Modifier) {
    val boje = LocalBoje.current
    Box(
        modifier
            .heightIn(min = 48.dp)
            .clickable(role = Role.Button, onClick = naKlik),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            tekst,
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Bold),
            color = boje.tekst,
            modifier = Modifier.drawBehind {
                val debljina = 3.dp.toPx()
                val y = size.height + 1.dp.toPx()
                drawLine(boje.zuta, Offset(0f, y), Offset(size.width, y), strokeWidth = debljina)
            },
        )
    }
}

@Composable
fun DugmeNazad(naKlik: () -> Unit) {
    IconButton(onClick = naKlik) {
        Icon(painterResource(R.drawable.ikona_nazad), contentDescription = stringResource(R.string.nazad), tint = LocalBoje.current.tekst)
    }
}

// Prihvatanje uslova (AUTH-10): kvadratić iz prototipa + "Prihvatam" kao jedna površina ≥ 48 dp; link vodi na tekst uslova.
@Composable
fun PrihvatanjeUslova(prihvaceni: Boolean, naPromjenu: (Boolean) -> Unit, naUslove: () -> Unit, omoguceno: Boolean = true) {
    val boje = LocalBoje.current
    Row(verticalAlignment = Alignment.CenterVertically) {
        Row(
            Modifier
                .heightIn(min = 48.dp)
                .toggleable(value = prihvaceni, enabled = omoguceno, role = Role.Checkbox, onValueChange = naPromjenu)
                .padding(end = 6.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Box(
                Modifier
                    .size(22.dp)
                    .background(if (prihvaceni) boje.tekst else boje.kartica, RoundedCornerShape(6.dp))
                    .border(1.5.dp, if (prihvaceni) boje.tekst else boje.sekundarni, RoundedCornerShape(6.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (prihvaceni) {
                    Icon(painterResource(R.drawable.ikona_kvacica), contentDescription = null, tint = boje.zuta, modifier = Modifier.size(17.dp))
                }
            }
            Text(stringResource(R.string.prihvatam), style = MaterialTheme.typography.bodySmall, color = boje.tekst)
        }
        LinkTekst(stringResource(R.string.uslove_koriscenja), naUslove)
    }
}

@Composable
fun Naslov(tekst: String, modifier: Modifier = Modifier) {
    Text(tekst, style = stilNaslov, color = LocalBoje.current.tekst, modifier = modifier)
}

@Composable
fun Podnaslov(tekst: String, modifier: Modifier = Modifier) {
    Text(tekst, style = MaterialTheme.typography.bodyMedium, color = LocalBoje.current.sekundarni, modifier = modifier)
}
