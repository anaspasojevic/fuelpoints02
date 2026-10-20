package io.github.anaspasojevic.fuelpoints.ui.pocetna

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.ui.komponente.Ekranic
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.LcdPanel
import io.github.anaspasojevic.fuelpoints.ui.komponente.OznakaBezMreze
import io.github.anaspasojevic.fuelpoints.ui.komponente.SegmentniBroj
import io.github.anaspasojevic.fuelpoints.ui.komponente.duhZa
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.stilNaslovSrednji
import io.github.anaspasojevic.fuelpoints.ui.tema.stilOznakaEkrana

// UI-03 (3_pocetna.png, 9_pocetna_tamna_offline.png) u obimu O-41: ime, bodovi, rezervisano > 0, offline marker, ulaz na QR.
@Composable
fun EkranPocetne(vm: PocetnaViewModel, naObavjestenja: () -> Unit, naIzlaz: (IzlazSaPocetne) -> Unit) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current

    // O-43: API-06 pri svakom otvaranju Home-a.
    LifecycleEventEffect(Lifecycle.Event.ON_START) { vm.priOtvaranju() }

    LaunchedEffect(stanje.izlaz) {
        stanje.izlaz?.let {
            vm.izlazObradjen()
            naIzlaz(it)
        }
    }

    EkranOkvir {
        Spacer(Modifier.height(12.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                stanje.ime?.let { stringResource(R.string.zdravo, it) } ?: stringResource(R.string.zdravo_bez_imena),
                style = stilNaslovSrednji,
                color = boje.tekst,
                modifier = Modifier.weight(1f),
            )
            IconButton(onClick = naObavjestenja, modifier = Modifier.size(48.dp)) {
                Icon(painterResource(R.drawable.ikona_zvono), contentDescription = stringResource(R.string.obavjestenja_opis), tint = boje.tekst)
            }
        }
        Spacer(Modifier.height(14.dp))
        LcdPanel(Modifier.fillMaxWidth()) {
            if (stanje.izKesa) {
                OznakaBezMreze()
                Spacer(Modifier.height(12.dp))
            }
            val prigusen = stanje.izKesa
            if (stanje.stanjeNedostupno) {
                Text(
                    PorukeGresaka.STANJE_NEDOSTUPNO,
                    style = MaterialTheme.typography.bodyMedium,
                    color = boje.lcd,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                )
            } else {
                val vrijednost = stanje.bodovi?.toString() ?: ""
                val opisBodova = "$vrijednost ${stringResource(R.string.dostupnih_bodova)}"
                Row(Modifier.fillMaxWidth().padding(top = 18.dp).semantics(mergeDescendants = true) { contentDescription = opisBodova }, horizontalArrangement = Arrangement.Center) {
                    SegmentniBroj(vrijednost, duhZa(vrijednost, 3), 64.sp, prigusen = prigusen)
                }
                Text(
                    stringResource(R.string.dostupnih_bodova),
                    style = stilOznakaEkrana,
                    color = boje.oznakaEkrana,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                )
            }
            if (stanje.prikaziRezervisano) {
                Spacer(Modifier.height(16.dp))
                val rezervisano = stanje.rezervisano.toString()
                Ekranic(Modifier.fillMaxWidth()) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.rezervisano), style = stilOznakaEkrana, color = boje.oznakaEkrana, modifier = Modifier.weight(1f))
                        SegmentniBroj(rezervisano, duhZa(rezervisano, 2), 20.sp, prigusen = prigusen)
                    }
                }
            }
        }
    }
}
