package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje
import io.github.anaspasojevic.fuelpoints.ui.tema.dseg7

// "Displej pumpe" iz prototipa (.pumpa): tamni panel zaobljenih uglova.
@Composable
fun LcdPanel(modifier: Modifier = Modifier, sadrzaj: @Composable ColumnScope.() -> Unit) {
    val boje = LocalBoje.current
    val oblik = RoundedCornerShape(28.dp)
    Column(
        modifier
            .background(boje.panel, oblik)
            .border(1.dp, if (boje.tamna) boje.linija else Color.White.copy(alpha = 0.06f), oblik)
            .padding(horizontal = 18.dp, vertical = 18.dp),
        content = sadrzaj,
    )
}

// Mali udubljeni ekran unutar panela (.ekranic).
@Composable
fun Ekranic(modifier: Modifier = Modifier, sadrzaj: @Composable () -> Unit) {
    Box(
        modifier
            .background(LocalBoje.current.ekranic, RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
    ) { sadrzaj() }
}

// Sedmosegmentni broj sa ugašenim ("duh") ciframa iza vrijednosti (.seg, .duh, .val).
@Composable
fun SegmentniBroj(vrijednost: String, duh: String, velicina: TextUnit, modifier: Modifier = Modifier, prigusen: Boolean = false) {
    val boje = LocalBoje.current
    val stil = TextStyle(fontFamily = dseg7, fontSize = velicina, lineHeight = velicina)
    val boja = if (prigusen) boje.lcd.copy(alpha = 0.6f) else boje.lcd
    Box(modifier, contentAlignment = Alignment.CenterEnd) {
        Text(duh, style = stil, color = boje.lcdDuh)
        Text(
            vrijednost,
            style = stil.copy(shadow = Shadow(color = boje.lcd.copy(alpha = 0.35f), blurRadius = 28f)),
            color = boja,
        )
    }
}

// Broj ugašenih cifara: najmanje koliko ima vrijednost.
fun duhZa(vrijednost: String, najmanje: Int) = "8".repeat(maxOf(najmanje, vrijednost.length))
