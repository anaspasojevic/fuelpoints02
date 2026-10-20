package io.github.anaspasojevic.fuelpoints.ui.obavjestenja

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.Prikaz
import io.github.anaspasojevic.fuelpoints.podaci.obavjestenja.Obavjestenje
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.Kartica
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.DugmeNazad
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import java.time.ZoneId

// UI-07 (7_obavjestenja.png): do 50 najnovijih; tap na stavku je „otvara” (readAt), bez grupisanja i paginacije.
@Composable
fun EkranObavjestenja(vm: ObavjestenjaViewModel, naNazad: () -> Unit, naPrijavu: () -> Unit) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current
    val zona = ZoneId.systemDefault()
    val sada = System.currentTimeMillis()

    LaunchedEffect(stanje.izlazNaPrijavu) { if (stanje.izlazNaPrijavu) naPrijavu() }

    EkranOkvir {
        DugmeNazad(naNazad)
        Naslov(stringResource(R.string.obavjestenja_naslov))
        Spacer(Modifier.height(14.dp))
        if (stanje.greska) PorukaGreske(PorukeGresaka.OPSTA)
        if (stanje.ucitano && stanje.obavjestenja.isEmpty()) {
            Text(stringResource(R.string.obavjestenja_prazno), style = MaterialTheme.typography.bodyMedium, color = boje.sekundarni)
        }
        if (stanje.obavjestenja.isNotEmpty()) {
            Kartica {
                stanje.obavjestenja.forEach { RedObavjestenja(it, Prikaz.vrijemeObavjestenja(it.createdAtMs, sada, zona)) { vm.otvori(it.id) } }
            }
        }
        Spacer(Modifier.height(12.dp))
        Text(stringResource(R.string.obavjestenja_napomena), style = MaterialTheme.typography.bodySmall, color = boje.sekundarni)
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun RedObavjestenja(o: Obavjestenje, vrijeme: String, naDodir: () -> Unit) {
    val boje = LocalBoje.current
    Row(
        Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .heightIn(min = 56.dp)
            .clickable(role = Role.Button, onClick = naDodir),
    ) {
        // Žuta traka lijevo označava nepročitano.
        Box(Modifier.width(4.dp).fillMaxHeight().background(if (o.procitano) androidx.compose.ui.graphics.Color.Transparent else boje.zuta))
        Column(Modifier.weight(1f).padding(horizontal = 14.dp, vertical = 10.dp)) {
            Row(Modifier.fillMaxWidth()) {
                Text(
                    o.title,
                    style = MaterialTheme.typography.bodyMedium.copy(fontWeight = if (o.procitano) FontWeight.Normal else FontWeight.Bold),
                    color = boje.tekst,
                    modifier = Modifier.weight(1f),
                )
                Text(vrijeme, style = MaterialTheme.typography.bodySmall, color = boje.sekundarni)
            }
            Text(o.body, style = MaterialTheme.typography.bodySmall, color = boje.sekundarni)
        }
    }
}
