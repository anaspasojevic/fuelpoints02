package io.github.anaspasojevic.fuelpoints.ui.profil

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.StanjeBrisanja
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.Kartica
import io.github.anaspasojevic.fuelpoints.ui.komponente.LinkTekst
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PoljeZaUnos
import io.github.anaspasojevic.fuelpoints.ui.komponente.Podnaslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaUspjeha
import io.github.anaspasojevic.fuelpoints.ui.komponente.RedListe
import io.github.anaspasojevic.fuelpoints.ui.komponente.DugmeNazad
import io.github.anaspasojevic.fuelpoints.ui.komponente.SporednoDugme
import io.github.anaspasojevic.fuelpoints.ui.komponente.ZutoDugme
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.stilNaslovSrednji

// UI-08 (8_profil.png).
@Composable
fun EkranProfila(
    vm: ProfilViewModel,
    naIme: () -> Unit,
    naLozinku: () -> Unit,
    naPomoc: () -> Unit,
    naUslove: () -> Unit,
    naBrisanje: () -> Unit,
    naPrijavu: () -> Unit,
) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current

    LaunchedEffect(stanje.izlazNaPrijavu) { if (stanje.izlazNaPrijavu) naPrijavu() }

    EkranOkvir {
        Spacer(Modifier.height(12.dp))
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(Modifier.size(56.dp).background(boje.zuta, RoundedCornerShape(16.dp)), contentAlignment = Alignment.Center) {
                Text(stanje.ime?.firstOrNull()?.uppercase() ?: "", style = stilNaslovSrednji, color = boje.tekstNaZutoj)
            }
            Column {
                Text(stanje.ime ?: "", style = stilNaslovSrednji, color = boje.tekst)
                Text(stanje.email ?: "", style = MaterialTheme.typography.bodySmall, color = boje.sekundarni)
            }
        }
        Spacer(Modifier.height(18.dp))
        Kartica {
            RedListe(R.drawable.ikona_osoba, stringResource(R.string.profil_ime), vrijednost = stanje.ime, chevron = true, naKlik = naIme)
            RedListe(R.drawable.ikona_posta, stringResource(R.string.profil_email), vrijednost = stringResource(R.string.email_ne_moze))
            RedListe(R.drawable.ikona_kljuc, stringResource(R.string.profil_lozinka), chevron = true, naKlik = naLozinku)
        }
        Spacer(Modifier.height(14.dp))
        Kartica {
            RedListe(R.drawable.ikona_pomoc, stringResource(R.string.profil_pomoc), chevron = true, naKlik = naPomoc)
            RedListe(R.drawable.ikona_dokument, stringResource(R.string.profil_uslovi), chevron = true, naKlik = naUslove)
        }
        Spacer(Modifier.height(14.dp))
        Kartica {
            RedListe(R.drawable.ikona_odjava, stringResource(R.string.odjavi_se), naKlik = vm::odjavi)
            RedListe(R.drawable.ikona_brisanje, stringResource(R.string.obrisi_nalog), opasno = true, naKlik = naBrisanje)
        }
        Spacer(Modifier.height(16.dp))
    }
}

// UI-08, RULE-T04: izmjena imena za prikaz.
@Composable
fun EkranImena(vm: ImeViewModel, naNazad: () -> Unit) {
    val stanje by vm.stanje.collectAsState()
    LaunchedEffect(stanje.gotovo) { if (stanje.gotovo) naNazad() }

    EkranOkvir {
        DugmeNazad(naNazad)
        Naslov(stringResource(R.string.profil_ime))
        Spacer(Modifier.height(18.dp))
        PoljeZaUnos(stanje.ime, vm::promijeniIme, oznaka = stringResource(R.string.ime_za_prikaz), greska = stanje.greska, akcija = ImeAction.Done)
        stanje.obavjestenje?.let {
            Spacer(Modifier.height(8.dp))
            PorukaUspjeha(it)
        }
        Spacer(Modifier.height(16.dp))
        ZutoDugme(stringResource(R.string.sacuvaj), vm::sacuvaj, radi = stanje.radi)
    }
}

// AUTH-08, AUTH-09 (iz Profila).
@Composable
fun EkranLozinke(vm: LozinkaViewModel, naNazad: () -> Unit) {
    val stanje by vm.stanje.collectAsState()

    EkranOkvir {
        DugmeNazad(naNazad)
        Naslov(stringResource(R.string.profil_lozinka))
        Spacer(Modifier.height(18.dp))
        PoljeZaUnos(stanje.trenutna, vm::promijeniTrenutnu, oznaka = stringResource(R.string.trenutna_lozinka), lozinka = true)
        Spacer(Modifier.height(10.dp))
        PoljeZaUnos(stanje.nova, vm::promijeniNovu, oznaka = stringResource(R.string.nova_lozinka), lozinka = true)
        Spacer(Modifier.height(10.dp))
        PoljeZaUnos(stanje.ponovljena, vm::promijeniPonovljenu, oznaka = stringResource(R.string.ponovite_lozinku), lozinka = true, akcija = ImeAction.Done)
        stanje.greska?.let {
            Spacer(Modifier.height(8.dp))
            PorukaGreske(it)
        }
        stanje.obavjestenje?.let {
            Spacer(Modifier.height(8.dp))
            PorukaUspjeha(it)
        }
        Spacer(Modifier.height(16.dp))
        ZutoDugme(stringResource(R.string.promijeni_lozinku), vm::promijeni, radi = stanje.radi)
        Spacer(Modifier.height(8.dp))
        LinkTekst(stringResource(R.string.posalji_reset), vm::posaljiReset, Modifier.fillMaxWidth())
    }
}

// O-47, i10/P-1: statički tekst.
@Composable
fun EkranPomoci(naNazad: () -> Unit) {
    val boje = LocalBoje.current
    EkranOkvir {
        DugmeNazad(naNazad)
        Naslov(stringResource(R.string.pomoc_naslov))
        Spacer(Modifier.height(14.dp))
        PITANJA_POMOCI.forEachIndexed { indeks, (pitanje, odgovor) ->
            StavkaPitanja(stringResource(pitanje), stringResource(odgovor))
            HorizontalDivider(color = boje.linija)
        }
        Spacer(Modifier.height(18.dp))
        Text(
            stringResource(R.string.pomoc_kontakt_naslov),
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = boje.zuta,
            modifier = Modifier.semantics { heading() },
        )
        Spacer(Modifier.height(6.dp))
        Text(stringResource(R.string.pomoc_kontakt), style = MaterialTheme.typography.bodyMedium, color = boje.tekst)
        Spacer(Modifier.height(16.dp))
    }
}

// Pomoć (P-6): pitanja i odgovori su odobreni tekst (O-47); svako pitanje je zaglavlje koje otkriva odgovor, podrazumijevano skupljeno.
private val PITANJA_POMOCI = listOf(
    R.string.pomoc_p1 to R.string.pomoc_o1,
    R.string.pomoc_p2 to R.string.pomoc_o2,
    R.string.pomoc_p3 to R.string.pomoc_o3,
    R.string.pomoc_p4 to R.string.pomoc_o4,
    R.string.pomoc_p5 to R.string.pomoc_o5,
    R.string.pomoc_p6 to R.string.pomoc_o6,
)

@Composable
private fun StavkaPitanja(pitanje: String, odgovor: String) {
    val boje = LocalBoje.current
    var prosireno by rememberSaveable { mutableStateOf(false) }
    val stanje = stringResource(if (prosireno) R.string.pomoc_prosireno else R.string.pomoc_skupljeno)
    Column(Modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .heightIn(min = 48.dp)
                .clickable(role = Role.Button) { prosireno = !prosireno }
                .semantics { heading(); stateDescription = stanje }
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                pitanje,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                color = boje.zuta,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(12.dp))
            Text(if (prosireno) "−" else "+", style = MaterialTheme.typography.titleMedium, color = boje.zuta)
        }
        if (prosireno) {
            Text(odgovor, style = MaterialTheme.typography.bodyMedium, color = boje.tekst, modifier = Modifier.padding(bottom = 12.dp))
        }
    }
}

// AUTH-05, §23, O-48: potvrda → lozinka → API-07. nastavak = true iz ekrana „Nalog se briše”.
@Composable
fun EkranBrisanjaNaloga(vm: BrisanjeNalogaViewModel, naNazad: () -> Unit, naPrijavu: () -> Unit) {
    val stanje by vm.stanje.collectAsState()
    var lozinka by remember { mutableStateOf("") }

    // R-01: sistemsko „nazad” je isto što i „Odustani” (gasi zastavicu); dok traje DELETE ne radi ništa.
    BackHandler(enabled = stanje != StanjeBrisanja.URadu && stanje !is StanjeBrisanja.Zavrseno) { vm.odustani() }

    LaunchedEffect(stanje) {
        when (stanje) {
            is StanjeBrisanja.Zavrseno -> naPrijavu()
            StanjeBrisanja.Odustao -> naNazad()
            else -> Unit
        }
    }

    EkranOkvir {
        Spacer(Modifier.height(24.dp))
        Naslov(stringResource(R.string.obrisi_nalog))
        Spacer(Modifier.height(10.dp))
        when (val s = stanje) {
            is StanjeBrisanja.UnosLozinke -> {
                Podnaslov(stringResource(R.string.brisanje_lozinka_podnaslov))
                Spacer(Modifier.height(14.dp))
                PoljeZaUnos(lozinka, { lozinka = it }, oznaka = stringResource(R.string.lozinka_oznaka), lozinka = true, akcija = ImeAction.Done)
                s.poruka?.let {
                    Spacer(Modifier.height(8.dp))
                    PorukaGreske(it)
                }
                Spacer(Modifier.height(16.dp))
                ZutoDugme(stringResource(R.string.obrisi_nalog), { vm.potvrdi(lozinka) })
                Spacer(Modifier.height(8.dp))
                SporednoDugme(stringResource(R.string.odustani), vm::odustani, Modifier.fillMaxWidth())
            }
            StanjeBrisanja.URadu -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) { CircularProgressIndicator(color = LocalBoje.current.tekst) }
            is StanjeBrisanja.MozePonoviti -> {
                PorukaGreske(s.poruka)
                Spacer(Modifier.height(16.dp))
                ZutoDugme(stringResource(R.string.pokusaj_ponovo), vm::ponovi)
            }
            else -> Unit
        }
    }

    if (stanje == StanjeBrisanja.Upozorenje) {
        AlertDialog(
            onDismissRequest = vm::odustani,
            text = { Text(stringResource(R.string.brisanje_upozorenje)) },
            confirmButton = { TextButton(vm::nastavi) { Text(stringResource(R.string.nastavi), fontWeight = FontWeight.Bold) } },
            dismissButton = { TextButton(vm::odustani) { Text(stringResource(R.string.odustani)) } },
        )
    }
}
