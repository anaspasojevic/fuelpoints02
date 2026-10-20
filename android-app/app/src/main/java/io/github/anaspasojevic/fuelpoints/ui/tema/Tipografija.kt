package io.github.anaspasojevic.fuelpoints.ui.tema

import androidx.compose.material3.Typography
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import io.github.anaspasojevic.fuelpoints.R

// Fontovi prototipa (i09/P-5): Figtree za tekst, Big Shoulders Display za naslove, DSEG7 za brojeve na "displeju".
val figtree = FontFamily(
    Font(R.font.figtree_regular, FontWeight.Normal),
    Font(R.font.figtree_medium, FontWeight.Medium),
    Font(R.font.figtree_semibold, FontWeight.SemiBold),
    Font(R.font.figtree_bold, FontWeight.Bold),
)

// Varijabilni font: težina se bira osom wght (API 26+).
@OptIn(ExperimentalTextApi::class)
private fun bigShoulders(tezina: Int) = Font(
    R.font.big_shoulders_display,
    FontWeight(tezina),
    FontStyle.Normal,
    variationSettings = FontVariation.Settings(FontVariation.weight(tezina)),
)

val bigShouldersDisplay = FontFamily(bigShoulders(700), bigShoulders(800))

val dseg7 = FontFamily(Font(R.font.dseg7_classic_bold, FontWeight.Bold))

val stilNaslov = TextStyle(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold, fontSize = 38.sp, lineHeight = 36.sp)
val stilNaslovSrednji = TextStyle(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold, fontSize = 28.sp, lineHeight = 28.sp)
val stilOznakaEkrana = TextStyle(fontFamily = figtree, fontWeight = FontWeight.Medium, fontSize = 12.sp)

val tipografijaFuelPoints = Typography().let { osnova ->
    Typography(
        headlineLarge = osnova.headlineLarge.copy(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold),
        headlineMedium = osnova.headlineMedium.copy(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold),
        headlineSmall = osnova.headlineSmall.copy(fontFamily = bigShouldersDisplay, fontWeight = FontWeight.ExtraBold),
        titleLarge = osnova.titleLarge.copy(fontFamily = figtree, fontWeight = FontWeight.Bold),
        titleMedium = osnova.titleMedium.copy(fontFamily = figtree, fontWeight = FontWeight.Bold),
        titleSmall = osnova.titleSmall.copy(fontFamily = figtree, fontWeight = FontWeight.SemiBold),
        bodyLarge = osnova.bodyLarge.copy(fontFamily = figtree, fontSize = 15.sp),
        bodyMedium = osnova.bodyMedium.copy(fontFamily = figtree, fontSize = 14.5.sp),
        bodySmall = osnova.bodySmall.copy(fontFamily = figtree, fontSize = 13.sp),
        labelLarge = osnova.labelLarge.copy(fontFamily = figtree, fontWeight = FontWeight.Bold, fontSize = 16.sp),
        labelMedium = osnova.labelMedium.copy(fontFamily = figtree, fontWeight = FontWeight.SemiBold, fontSize = 13.sp),
        labelSmall = osnova.labelSmall.copy(fontFamily = figtree),
    )
}
