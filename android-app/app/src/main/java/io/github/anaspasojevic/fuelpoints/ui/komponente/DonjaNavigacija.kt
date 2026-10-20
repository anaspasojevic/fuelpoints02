package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

// UI-03 (dopuna), O-46: Početna · Istorija · QR (centralno) · Nagrade · Profil.
enum class Tab { POCETNA, ISTORIJA, QR, NAGRADE, PROFIL }

// Ekran sa donjom navigacijom; sadržaj dobija ostatak visine, a sistemska traka se računa samo jednom.
@Composable
fun TabOkvir(tekuci: Tab, naTab: (Tab) -> Unit, sadrzaj: @Composable () -> Unit) {
    val boje = LocalBoje.current
    Column(Modifier.fillMaxSize().background(boje.pozadina)) {
        Box(Modifier.weight(1f).consumeWindowInsets(WindowInsets.navigationBars)) { sadrzaj() }
        DonjaNavigacija(tekuci, naTab)
    }
}

@Composable
fun DonjaNavigacija(tekuci: Tab, naTab: (Tab) -> Unit) {
    val boje = LocalBoje.current
    Row(
        Modifier
            .fillMaxWidth()
            .background(boje.kartica)
            .navigationBarsPadding()
            .heightIn(min = 64.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Stavka(Tab.POCETNA, tekuci, naTab, R.drawable.ikona_pocetna, R.string.tab_pocetna)
        Stavka(Tab.ISTORIJA, tekuci, naTab, R.drawable.ikona_racun, R.string.tab_istorija)
        QrDugme(stringResource(R.string.tab_qr_opis)) { naTab(Tab.QR) }
        Stavka(Tab.NAGRADE, tekuci, naTab, R.drawable.ikona_nagrada, R.string.tab_nagrade)
        Stavka(Tab.PROFIL, tekuci, naTab, R.drawable.ikona_osoba, R.string.tab_profil)
    }
}

@Composable
private fun RowScope.Stavka(tab: Tab, tekuci: Tab, naTab: (Tab) -> Unit, @DrawableRes ikona: Int, @StringRes naziv: Int) {
    val boje = LocalBoje.current
    val boja = if (tab == tekuci) boje.tekst else boje.sekundarni
    Column(
        Modifier
            .weight(1f)
            .heightIn(min = 56.dp)
            .clickable(role = Role.Tab) { naTab(tab) },
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(painterResource(ikona), contentDescription = null, tint = boja, modifier = Modifier.size(24.dp))
        Text(
            stringResource(naziv),
            style = TextStyle(fontSize = 11.sp, fontWeight = if (tab == tekuci) FontWeight.Bold else FontWeight.Medium),
            color = boja,
        )
    }
}

// Centralno žuto okruglo dugme (contentDescription „Moj QR kod”).
@Composable
private fun RowScope.QrDugme(opis: String, naKlik: () -> Unit) {
    val boje = LocalBoje.current
    Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
        Box(
            Modifier
                .padding(vertical = 4.dp)
                .size(56.dp)
                .background(boje.zuta, CircleShape)
                .clickable(role = Role.Button, onClick = naKlik),
            contentAlignment = Alignment.Center,
        ) {
            Icon(painterResource(R.drawable.ikona_qr), contentDescription = opis, tint = boje.tekstNaZutoj, modifier = Modifier.size(28.dp))
        }
    }
}
