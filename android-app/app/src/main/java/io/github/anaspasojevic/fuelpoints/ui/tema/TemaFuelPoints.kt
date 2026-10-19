package io.github.anaspasojevic.fuelpoints.ui.tema

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider

// Svijetla i tamna tema po prototipu; prati sistemski režim (plan i09, 5.9).
@Composable
fun TemaFuelPoints(tamna: Boolean = isSystemInDarkTheme(), sadrzaj: @Composable () -> Unit) {
    val boje = if (tamna) tamneBoje else svijetleBoje
    val shema = if (tamna) darkColorScheme() else lightColorScheme()
    val prilagodjena = shema.copy(
        primary = boje.zuta, onPrimary = boje.tekstNaZutoj,
        secondary = boje.zuta, onSecondary = boje.tekstNaZutoj,
        background = boje.pozadina, onBackground = boje.tekst,
        surface = boje.kartica, onSurface = boje.tekst,
        surfaceVariant = boje.kartica, onSurfaceVariant = boje.sekundarni,
        outline = boje.linija, error = boje.crvena,
    )
    CompositionLocalProvider(LocalBoje provides boje) {
        MaterialTheme(colorScheme = prilagodjena, typography = tipografijaFuelPoints, content = sadrzaj)
    }
}
