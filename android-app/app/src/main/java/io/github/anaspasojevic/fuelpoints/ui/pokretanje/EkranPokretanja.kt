package io.github.anaspasojevic.fuelpoints.ui.pokretanje

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.LcdPanel
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.Podnaslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.PoljeZaUnos
import io.github.anaspasojevic.fuelpoints.ui.komponente.PrihvatanjeUslova
import io.github.anaspasojevic.fuelpoints.ui.komponente.ZutoDugme
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.bigShouldersDisplay

// Pokretanje: AUTH-06 obnova sesije ili AUTH-03; bez mreže poruka i „Pokušaj ponovo”.
@Composable
fun EkranPokretanja(vm: PokretanjeViewModel, naOdrediste: (OdredisteNaloga) -> Unit) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current
    val ucitavanje = stringResource(R.string.ucitavanje)

    LaunchedEffect(stanje.odrediste) {
        stanje.odrediste?.let {
            vm.navigacijaObradjena()
            naOdrediste(it)
        }
    }

    EkranOkvir {
        Spacer(Modifier.height(48.dp))
        LcdPanel(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(painterResource(R.drawable.ikona_pumpa), contentDescription = null, tint = boje.zuta, modifier = Modifier.size(26.dp))
                Text(
                    stringResource(R.string.app_name),
                    style = TextStyle(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp),
                    color = Color.White,
                    modifier = Modifier.weight(1f),
                )
                if (stanje.radi) {
                    CircularProgressIndicator(
                        Modifier.size(22.dp).semantics { contentDescription = ucitavanje },
                        color = boje.lcd,
                        strokeWidth = 2.5.dp,
                    )
                }
            }
        }
        stanje.poruka?.let {
            Spacer(Modifier.height(20.dp))
            PorukaGreske(it)
            Spacer(Modifier.height(16.dp))
            ZutoDugme(stringResource(R.string.pokusaj_ponovo), vm::provjeri)
        }
    }
}

// i09/P-3 rezerva (AUTH-03 bez imena u Auth profilu).
@Composable
fun EkranDovrsetkaRegistracije(vm: DovrsetakRegistracijeViewModel, naUslove: () -> Unit, naOdrediste: (OdredisteNaloga) -> Unit) {
    val stanje by vm.stanje.collectAsState()

    LaunchedEffect(stanje.odrediste) {
        stanje.odrediste?.let {
            vm.navigacijaObradjena()
            naOdrediste(it)
        }
    }

    EkranOkvir {
        Spacer(Modifier.height(48.dp))
        Naslov(stringResource(R.string.dovrsetak_naslov))
        Spacer(Modifier.height(8.dp))
        Podnaslov(stringResource(R.string.dovrsetak_podnaslov))
        Spacer(Modifier.height(22.dp))
        PoljeZaUnos(stanje.ime, vm::promijeniIme, oznaka = stringResource(R.string.ime_za_prikaz), greska = stanje.greskaImena)
        Spacer(Modifier.height(6.dp))
        PrihvatanjeUslova(stanje.prihvaceniUslovi, vm::promijeniUslove, naUslove)
        stanje.greskaUslova?.let { PorukaGreske(it) }
        stanje.greska?.let {
            Spacer(Modifier.height(8.dp))
            PorukaGreske(it)
        }
        Spacer(Modifier.height(16.dp))
        ZutoDugme(stringResource(R.string.potvrdi), vm::potvrdi, radi = stanje.radi)
    }
}

// AUTH-05 (dio): nalog u brisanju — poruka bez Home funkcija i bez dugmadi (logout je i10, O-41).
@Composable
fun EkranBrisanjaUToku() {
    EkranOkvir {
        Spacer(Modifier.height(48.dp))
        Naslov(stringResource(R.string.brisanje_naslov))
        Spacer(Modifier.height(8.dp))
        Podnaslov(io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka.BRISANJE_U_TOKU)
    }
}
