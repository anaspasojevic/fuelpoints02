package io.github.anaspasojevic.fuelpoints.ui.prijava

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.ui.komponente.Ekranic
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.LcdPanel
import io.github.anaspasojevic.fuelpoints.ui.komponente.LinkTekst
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.Podnaslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PoljeZaUnos
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.SegmentniBroj
import io.github.anaspasojevic.fuelpoints.ui.komponente.ZutoDugme
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.bigShouldersDisplay
import io.github.anaspasojevic.fuelpoints.ui.tema.stilOznakaEkrana

// UI-01 (1_prijava.png): e-mail, lozinka, Prijavi se, Napravi nalog, Zaboravljena lozinka.
@Composable
fun EkranPrijave(vm: PrijavaViewModel, naRegistraciju: () -> Unit, naOdrediste: (OdredisteNaloga) -> Unit) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current

    LaunchedEffect(stanje.odrediste) {
        stanje.odrediste?.let {
            vm.navigacijaObradjena()
            naOdrediste(it)
        }
    }

    EkranOkvir {
        Spacer(Modifier.height(8.dp))
        LcdPanel(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(painterResource(R.drawable.ikona_pumpa), contentDescription = null, tint = boje.zuta, modifier = Modifier.size(26.dp))
                Text(
                    stringResource(R.string.app_name),
                    style = TextStyle(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp),
                    color = Color.White,
                )
            }
            Spacer(Modifier.height(16.dp))
            // Ugašen displej: samo "duh" cifre, bez izmišljenih vrijednosti.
            Ekranic(Modifier.fillMaxWidth()) {
                Text(stringResource(R.string.litara), style = stilOznakaEkrana, color = boje.oznakaEkrana)
                SegmentniBroj("", "888.88", 46.sp, Modifier.fillMaxWidth().padding(top = 18.dp))
            }
            Spacer(Modifier.height(8.dp))
            Ekranic(Modifier.fillMaxWidth()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.bodova), style = stilOznakaEkrana, color = boje.oznakaEkrana, modifier = Modifier.weight(1f))
                    SegmentniBroj("", "888", 26.sp)
                }
            }
        }
        Spacer(Modifier.height(22.dp))
        Naslov(stringResource(R.string.prijava_naslov))
        Spacer(Modifier.height(6.dp))
        Podnaslov(stringResource(R.string.prijava_podnaslov))
        Spacer(Modifier.height(18.dp))

        val greskaPrijave = stanje.greska != null
        PoljeZaUnos(
            vrijednost = stanje.email,
            naPromjenu = vm::promijeniEmail,
            opis = stringResource(R.string.email_oznaka),
            ikona = R.drawable.ikona_posta,
            tipTastature = KeyboardType.Email,
        )
        Spacer(Modifier.height(13.dp))
        PoljeZaUnos(
            vrijednost = stanje.lozinka,
            naPromjenu = vm::promijeniLozinku,
            opis = stringResource(R.string.lozinka_oznaka),
            ikona = R.drawable.ikona_katanac,
            lozinka = true,
            akcija = ImeAction.Done,
            greska = null,
        )
        if (greskaPrijave) {
            Spacer(Modifier.height(8.dp))
            PorukaGreske(stanje.greska!!)
        }
        stanje.obavjestenje?.let {
            Spacer(Modifier.height(8.dp))
            Text(it, style = MaterialTheme.typography.bodySmall, color = boje.tekst)
        }
        Spacer(Modifier.height(16.dp))
        ZutoDugme(stringResource(R.string.prijavi_se), vm::prijavi, radi = stanje.radi)
        Row(Modifier.fillMaxWidth().padding(top = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            LinkTekst(stringResource(R.string.zaboravljena_lozinka), vm::zaboravljenaLozinka)
            LinkTekst(stringResource(R.string.napravi_nalog), naRegistraciju)
        }
    }
}
