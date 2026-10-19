package io.github.anaspasojevic.fuelpoints.ui.registracija

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.provjeriLozinku
import io.github.anaspasojevic.fuelpoints.ui.komponente.DugmeNazad
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.Podnaslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PoljeZaUnos
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.PrihvatanjeUslova
import io.github.anaspasojevic.fuelpoints.ui.komponente.ZutoDugme
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.stilOznakaEkrana

// UI-02 (2_registracija.png): ime za prikaz, e-mail, lozinka, ponovljena lozinka, prihvatanje uslova.
@Composable
fun EkranRegistracije(
    vm: RegistracijaViewModel,
    naNazad: () -> Unit,
    naUslove: () -> Unit,
    naOdrediste: (OdredisteNaloga) -> Unit,
) {
    val stanje by vm.stanje.collectAsState()
    val unos = stanje.unos
    val greske = stanje.greske
    val omoguceno = !stanje.nalogKreiran && !stanje.radi

    LaunchedEffect(stanje.odrediste) {
        stanje.odrediste?.let {
            vm.navigacijaObradjena()
            naOdrediste(it)
        }
    }

    EkranOkvir {
        if (!stanje.nalogKreiran) DugmeNazad(naNazad) else Spacer(Modifier.height(48.dp))
        Spacer(Modifier.height(8.dp))
        Naslov(stringResource(R.string.registracija_naslov))
        Spacer(Modifier.height(8.dp))
        Podnaslov(stringResource(R.string.registracija_podnaslov))
        Spacer(Modifier.height(22.dp))

        PoljeZaUnos(
            unos.displayName, vm::promijeniIme,
            oznaka = stringResource(R.string.ime_za_prikaz), greska = greske.ime, omoguceno = omoguceno,
        )
        Spacer(Modifier.height(13.dp))
        PoljeZaUnos(
            unos.email, vm::promijeniEmail,
            oznaka = stringResource(R.string.email_oznaka), greska = greske.email, omoguceno = omoguceno,
            tipTastature = KeyboardType.Email,
        )
        Spacer(Modifier.height(13.dp))
        PoljeZaUnos(
            unos.lozinka, vm::promijeniLozinku,
            oznaka = stringResource(R.string.lozinka_oznaka), lozinka = true, greska = greske.lozinka, omoguceno = omoguceno,
        )
        Spacer(Modifier.height(10.dp))
        TrakePravila(unos.lozinka)
        Spacer(Modifier.height(14.dp))
        val poklapaju = unos.ponovljenaLozinka.isNotEmpty() && unos.ponovljenaLozinka == unos.lozinka
        val opisPoklapanja = stringResource(R.string.lozinke_se_poklapaju)
        PoljeZaUnos(
            unos.ponovljenaLozinka, vm::promijeniPonovljenuLozinku,
            oznaka = stringResource(R.string.ponovite_lozinku), lozinka = true, greska = greske.ponovljenaLozinka,
            omoguceno = omoguceno, akcija = ImeAction.Done,
            dodatak = if (poklapaju) {
                {
                    Icon(
                        painterResource(R.drawable.ikona_kvacica),
                        contentDescription = opisPoklapanja,
                        tint = LocalBoje.current.zelena,
                        modifier = Modifier.padding(end = 12.dp),
                    )
                }
            } else null,
        )
        Spacer(Modifier.height(6.dp))
        PrihvatanjeUslova(unos.prihvaceniUslovi, vm::promijeniUslove, naUslove, omoguceno)
        greske.uslovi?.let { PorukaGreske(it) }
        stanje.greska?.let {
            Spacer(Modifier.height(8.dp))
            PorukaGreske(it)
        }
        Spacer(Modifier.height(16.dp))
        val tekstDugmeta = if (stanje.nalogKreiran) R.string.pokusaj_ponovo else R.string.napravi_nalog
        ZutoDugme(stringResource(tekstDugmeta), vm::napraviNalog, radi = stanje.radi)
        Spacer(Modifier.height(20.dp))
    }
}

// Tri LCD trake pravila §3.6 koje se pale dok korisnik kuca (prototip).
@Composable
private fun TrakePravila(lozinka: String) {
    val boje = LocalBoje.current
    val pravila = provjeriLozinku(lozinka)
    Row(
        Modifier
            .fillMaxWidth()
            .background(boje.panel, RoundedCornerShape(12.dp))
            .padding(10.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        listOf(
            R.string.pravilo_duzina to pravila.duzina,
            R.string.pravilo_veliko_slovo to pravila.velikoSlovo,
            R.string.pravilo_cifra to pravila.cifra,
        ).forEach { (naziv, ispunjeno) ->
            val tekst = stringResource(naziv)
            val opis = stringResource(if (ispunjeno) R.string.pravilo_ispunjeno else R.string.pravilo_nije_ispunjeno, tekst)
            Column(Modifier.weight(1f).semantics(mergeDescendants = true) { contentDescription = opis }, horizontalAlignment = Alignment.CenterHorizontally) {
                val traka = Modifier.fillMaxWidth().height(6.dp)
                if (ispunjeno) {
                    Spacer(traka.shadow(6.dp, RoundedCornerShape(3.dp), ambientColor = boje.traka, spotColor = boje.traka).background(boje.traka, RoundedCornerShape(3.dp)))
                } else {
                    Spacer(traka.background(boje.panel2, RoundedCornerShape(3.dp)))
                }
                Text(
                    tekst,
                    style = stilOznakaEkrana,
                    color = if (ispunjeno) boje.trakaTekst else boje.oznakaEkrana,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 7.dp),
                )
            }
        }
    }
}

@Composable
fun EkranUslova(naNazad: () -> Unit) {
    EkranOkvir {
        DugmeNazad(naNazad)
        Spacer(Modifier.height(8.dp))
        Naslov(stringResource(R.string.uslovi_naslov))
        Spacer(Modifier.height(16.dp))
        Text(
            stringResource(R.string.uslovi_1_0),
            style = androidx.compose.material3.MaterialTheme.typography.bodyMedium,
            color = LocalBoje.current.tekst,
        )
        Spacer(Modifier.size(24.dp))
    }
}
