package io.github.anaspasojevic.fuelpoints.ui.nagrade

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.domen.Preostalo
import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.Prikaz
import io.github.anaspasojevic.fuelpoints.domen.napraviQr
import io.github.anaspasojevic.fuelpoints.ui.komponente.Ekranic
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.Kartica
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaGreske
import io.github.anaspasojevic.fuelpoints.ui.komponente.PorukaUspjeha
import io.github.anaspasojevic.fuelpoints.ui.komponente.SegmentniBroj
import io.github.anaspasojevic.fuelpoints.ui.komponente.SporednoDugme
import io.github.anaspasojevic.fuelpoints.ui.komponente.duhZa
import io.github.anaspasojevic.fuelpoints.ui.qr.uSliku
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

// UI-06 (6_nagrade.png): bodovi, aktivni voucher-i, katalog. Stanje dolazi iz Firestore snimaka.
@Composable
fun EkranNagrada(vm: NagradeViewModel, naIzlaz: (IzlazSaNagrada) -> Unit) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current

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
            Naslov(stringResource(R.string.nagrade_naslov), Modifier.weight(1f))
            val bodovi = stanje.bodovi
            if (bodovi != null) {
                Text(
                    Prikaz.bodovi(bodovi),
                    style = MaterialTheme.typography.labelLarge,
                    color = boje.tekst,
                    modifier = Modifier.background(boje.kartica, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
        }
        if (stanje.stanjeNedostupno) {
            Spacer(Modifier.height(8.dp))
            PorukaGreske(PorukeGresaka.STANJE_NEDOSTUPNO)
        }
        stanje.poruka?.let { poruka ->
            Spacer(Modifier.height(10.dp))
            if (poruka.uspjeh) PorukaUspjeha(poruka.tekst) else PorukaGreske(poruka.tekst)
            if (poruka.mozePonoviti) SporednoDugme(stringResource(R.string.pokusaj_ponovo), vm::ponovi, Modifier.fillMaxWidth(), omoguceno = !stanje.radi)
        }
        Spacer(Modifier.height(14.dp))
        stanje.vauceri.forEach { voucher ->
            KarticaVouchera(voucher, omoguceno = !stanje.radi, naOtkazi = { vm.dodirniOtkazi(voucher.voucherId) })
            Spacer(Modifier.height(14.dp))
        }
        Text(stringResource(R.string.izaberite_nagradu), style = MaterialTheme.typography.titleMedium, color = boje.tekst)
        Spacer(Modifier.height(10.dp))
        if (stanje.katalogNedostupan) PorukaGreske(PorukeGresaka.KATALOG_NEDOSTUPAN)
        stanje.katalog.chunked(2).forEach { red ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                red.forEach { KarticaNagrade(it, omoguceno = !stanje.radi, naDodir = { vm.dodirniNagradu(it.rewardId) }, modifier = Modifier.weight(1f)) }
                if (red.size == 1) Spacer(Modifier.weight(1f))
            }
            Spacer(Modifier.height(12.dp))
        }
        Spacer(Modifier.height(8.dp))
    }

    when (val dijalog = stanje.dijalog) {
        is DijalogNagrada.Izdavanje -> AlertDialog(
            onDismissRequest = vm::odustani,
            text = { Text("Izdati voucher: ${dijalog.nagrada.naziv} za ${Prikaz.bodovi(dijalog.nagrada.costPoints)}? Voucher važi 15 minuta.") },
            confirmButton = { TextButton(vm::potvrdiDijalog) { Text(stringResource(R.string.izdaj)) } },
            dismissButton = { TextButton(vm::odustani) { Text(stringResource(R.string.odustani)) } },
        )
        is DijalogNagrada.Otkazivanje -> AlertDialog(
            onDismissRequest = vm::odustani,
            text = { Text(stringResource(R.string.otkazi_dijalog)) },
            confirmButton = { TextButton(vm::potvrdiDijalog) { Text(stringResource(R.string.otkazi_voucher)) } },
            dismissButton = { TextButton(vm::odustani) { Text(stringResource(R.string.ne)) } },
        )
        null -> Unit
    }
}

// Reward QR sadrži tačno voucherId (bez prefiksa); voucherId se ne prikazuje kao tekst ni ne loguje ((h)).
@Composable
private fun KarticaVouchera(voucher: StavkaVouchera, omoguceno: Boolean, naOtkazi: () -> Unit) {
    val boje = LocalBoje.current
    val istekao = voucher.preostalo == Preostalo.Istekao
    Column(Modifier.fillMaxWidth().background(boje.kartica, RoundedCornerShape(20.dp)).padding(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (!istekao) {
                val slika = remember(voucher.voucherId) { uSliku(napraviQr(voucher.voucherId)) }
                val opis = stringResource(R.string.qr_voucher_opis)
                Image(
                    slika,
                    contentDescription = opis,
                    filterQuality = FilterQuality.None,
                    modifier = Modifier.size(132.dp).background(Color.White, RoundedCornerShape(10.dp)).padding(6.dp),
                )
            }
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.aktivni_voucher), style = MaterialTheme.typography.bodySmall, color = boje.sekundarni)
                Text(voucher.naziv, style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold), color = boje.tekst)
                Text(
                    "Rezervisano ${Prikaz.bodovi(voucher.costPoints)}. Pokažite na kasi.",
                    style = MaterialTheme.typography.bodySmall,
                    color = boje.sekundarni,
                )
            }
        }
        Spacer(Modifier.height(12.dp))
        Ekranic(Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                when (val p = voucher.preostalo) {
                    is Preostalo.Ostalo -> {
                        Text(stringResource(R.string.vazi_jos), style = MaterialTheme.typography.bodySmall, color = boje.oznakaEkrana, modifier = Modifier.weight(1f))
                        SegmentniBroj(p.mmss, duhZa(p.mmss, 5), 30.sp)
                    }
                    Preostalo.Istekao -> Text(
                        stringResource(R.string.voucher_istekao),
                        style = MaterialTheme.typography.bodyMedium,
                        color = boje.lcd,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        if (!istekao) {
            Spacer(Modifier.height(10.dp))
            SporednoDugme(stringResource(R.string.otkazi), naOtkazi, Modifier.fillMaxWidth(), omoguceno = omoguceno, ikona = R.drawable.ikona_zatvori)
        }
    }
}

@Composable
private fun KarticaNagrade(stavka: StavkaNagrade, omoguceno: Boolean, naDodir: () -> Unit, modifier: Modifier = Modifier) {
    val boje = LocalBoje.current
    val oblik = RoundedCornerShape(16.dp)
    val klik = if (stavka.dostupna && omoguceno) Modifier.clickable(role = Role.Button, onClick = naDodir) else Modifier
    Column(
        modifier
            .background(if (stavka.dostupna) boje.zutaMeka else boje.kartica, oblik)
            .border(if (stavka.dostupna) 2.dp else 0.dp, if (stavka.dostupna) boje.zuta else Color.Transparent, oblik)
            .then(klik)
            .padding(14.dp),
    ) {
        Text(stavka.naziv, style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold), color = boje.tekst)
        Text(
            if (stavka.dostupna) stringResource(R.string.dostupno) else "nedostaje ${Prikaz.bodovi(stavka.nedostaje)}",
            style = MaterialTheme.typography.bodySmall,
            color = boje.sekundarni,
        )
        Spacer(Modifier.height(10.dp))
        Ekranic(Modifier.fillMaxWidth()) {
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.CenterEnd) {
                val cijena = stavka.costPoints.toString()
                SegmentniBroj(cijena, duhZa(cijena, 2), 26.sp, prigusen = !stavka.dostupna)
            }
        }
    }
}
