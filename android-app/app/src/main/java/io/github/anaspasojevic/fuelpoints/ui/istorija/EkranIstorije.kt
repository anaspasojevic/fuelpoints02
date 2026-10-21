package io.github.anaspasojevic.fuelpoints.ui.istorija

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.Prikaz
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Kupovina
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.Kartica
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.SporednoDugme
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import java.time.ZoneId

// UI-05 (5_istorija.png): „račun” sa kupovinama; samo ono što SRS traži (datum, količina, iznos, valuta, bodovi).
@Composable
fun EkranIstorije(vm: IstorijaViewModel) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current
    val zona = ZoneId.systemDefault()

    LifecycleEventEffect(Lifecycle.Event.ON_START) { vm.priOtvaranju() }

    EkranOkvir {
        Spacer(Modifier.height(12.dp))
        Naslov(stringResource(R.string.istorija_naslov))
        Spacer(Modifier.height(14.dp))
        Kartica(Modifier.padding(vertical = 8.dp)) {
            when {
                !stanje.ucitano && stanje.ucitava -> Row(Modifier.fillMaxWidth().padding(24.dp), horizontalArrangement = Arrangement.Center) {
                    CircularProgressIndicator(color = boje.tekst)
                }
                stanje.ucitano && stanje.kupovine.isEmpty() -> Text(
                    stringResource(R.string.istorija_prazno),
                    style = MaterialTheme.typography.bodyMedium,
                    color = boje.sekundarni,
                    modifier = Modifier.padding(16.dp),
                )
                else -> stanje.kupovine.forEach { RedKupovine(it, zona) }
            }
            if (stanje.ucitano) {
                Text(
                    stringResource(R.string.istorija_napomena),
                    style = MaterialTheme.typography.bodySmall,
                    color = boje.sekundarni,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(12.dp),
                )
            }
        }
        stanje.greska?.let {
            Spacer(Modifier.height(10.dp))
            PorukaGreske(it)
            SporednoDugme(stringResource(R.string.pokusaj_ponovo), vm::ponovi, Modifier.fillMaxWidth())
        }
        if (stanje.sljedeciKursor != null) {
            Spacer(Modifier.height(12.dp))
            SporednoDugme(stringResource(R.string.ucitaj_starije), vm::ucitajStarije, Modifier.fillMaxWidth(), omoguceno = !stanje.ucitava)
        }
        Spacer(Modifier.height(16.dp))
    }
}

@Composable
private fun RedKupovine(k: Kupovina, zona: ZoneId) {
    val boje = LocalBoje.current
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) {
            Text(Prikaz.datumIVrijeme(k.occurredAtMs, zona), style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace), color = boje.tekst)
            Text(
                "${Prikaz.litri(k.volumeMl)} · ${Prikaz.iznos(k.amountMinor, k.currency)}",
                style = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                color = boje.sekundarni,
            )
        }
        Text(
            "+${k.earnedPoints}",
            style = MaterialTheme.typography.titleMedium.copy(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold),
            color = if (k.earnedPoints == 0L) boje.sekundarni else boje.tekst,
        )
    }
}
