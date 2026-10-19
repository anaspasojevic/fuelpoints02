package io.github.anaspasojevic.fuelpoints.ui.tema

import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

// Tokeni boja iz docs/dizajn/prototip.html (:root i .tamna).
@Immutable
data class BojeFuelPoints(
    val pozadina: Color,
    val kartica: Color,
    val tekst: Color,
    val sekundarni: Color,
    val linija: Color,
    val zuta: Color,
    val zutaMeka: Color,
    val panel: Color,
    val panel2: Color,
    val lcd: Color,
    val crvena: Color,
    val zelena: Color,
    val tamna: Boolean,
) {
    // Boje LCD "displeja pumpe" su iste u obje teme.
    val ekranic: Color get() = Color(0xFF0B1518)
    val oznakaEkrana: Color get() = Color(0xFF8FA3A7)
    val lcdDuh: Color get() = lcd.copy(alpha = 0.09f)
    val tekstNaZutoj: Color get() = Color(0xFF13262B)
    val traka: Color get() = Color(0xFF4CD08A)
    val trakaTekst: Color get() = Color(0xFFC9F2DA)
}

val svijetleBoje = BojeFuelPoints(
    pozadina = Color(0xFFE9EDEB),
    kartica = Color(0xFFFFFFFF),
    tekst = Color(0xFF13262B),
    sekundarni = Color(0xFF56676C),
    linija = Color(0xFFD5DCD9),
    zuta = Color(0xFFFFC22E),
    zutaMeka = Color(0xFFFFF3D1),
    panel = Color(0xFF15272C),
    panel2 = Color(0xFF1E353B),
    lcd = Color(0xFFFFCB45),
    crvena = Color(0xFFD7402B),
    zelena = Color(0xFF2F8F5B),
    tamna = false,
)

val tamneBoje = svijetleBoje.copy(
    pozadina = Color(0xFF0E181B),
    kartica = Color(0xFF172529),
    tekst = Color(0xFFE6ECEA),
    sekundarni = Color(0xFF97A6A9),
    linija = Color(0xFF26383D),
    zutaMeka = Color(0xFF3A3016),
    panel = Color(0xFF0A1316),
    panel2 = Color(0xFF15262B),
    tamna = true,
)

val LocalBoje = staticCompositionLocalOf { svijetleBoje }
