package io.github.anaspasojevic.fuelpoints.ui.qr

import android.graphics.Bitmap
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.FilterQuality
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.zxing.common.BitMatrix
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.ui.komponente.DugmeNazad
import io.github.anaspasojevic.fuelpoints.ui.komponente.EkranOkvir
import io.github.anaspasojevic.fuelpoints.ui.komponente.Naslov
import io.github.anaspasojevic.fuelpoints.ui.komponente.Podnaslov
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

private val tamnaQr = Color(0xFF13262B)

// UI-04 (4_moj_qr.png): QR sa UID-om i UID kao tekst; bez dugmeta za kopiranje i bez nagrada (i10).
@Composable
fun EkranQr(vm: QrViewModel, naNazad: () -> Unit, naPrijavu: () -> Unit) {
    val stanje by vm.stanje.collectAsState()
    val boje = LocalBoje.current

    LaunchedEffect(stanje) {
        if (stanje == StanjeQr.BezSesije) naPrijavu()
    }

    val prikaz = stanje as? StanjeQr.Prikaz ?: return
    val slika = remember(prikaz.matrica) { uSliku(prikaz.matrica) }

    EkranOkvir {
        DugmeNazad(naNazad)
        Naslov(stringResource(R.string.qr_naslov))
        Spacer(Modifier.height(8.dp))
        Podnaslov(stringResource(R.string.qr_podnaslov))
        Spacer(Modifier.height(24.dp))
        Column(
            Modifier
                .fillMaxWidth()
                .background(boje.zuta, RoundedCornerShape(28.dp))
                .padding(22.dp),
        ) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(1f)
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .padding(10.dp),
            ) {
                UgloviOkvira(Modifier.fillMaxSize())
                Image(
                    bitmap = slika,
                    contentDescription = stringResource(R.string.qr_opis),
                    filterQuality = FilterQuality.None,
                    modifier = Modifier.fillMaxSize().padding(12.dp),
                )
            }
            Spacer(Modifier.height(16.dp))
            Text(stringResource(R.string.vas_identifikator), style = MaterialTheme.typography.bodySmall, color = boje.tekstNaZutoj.copy(alpha = 0.75f))
            Text(
                prikaz.uid,
                style = TextStyle(fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold, fontSize = 17.sp),
                color = boje.tekstNaZutoj,
            )
        }
        Spacer(Modifier.height(18.dp))
        Podnaslov(stringResource(R.string.qr_napomena))
        Spacer(Modifier.height(24.dp))
    }
}

// Uglovi "ciljnika" oko koda iz prototipa (dekorativno).
@Composable
private fun UgloviOkvira(modifier: Modifier) {
    Canvas(modifier) {
        val d = 26.dp.toPx()
        val s = 4.dp.toPx()
        val stil = Stroke(width = s)
        val p = s / 2
        val w = size.width
        val h = size.height
        listOf(
            listOf(Offset(p, d), Offset(p, p), Offset(d, p)),
            listOf(Offset(w - d, p), Offset(w - p, p), Offset(w - p, d)),
            listOf(Offset(p, h - d), Offset(p, h - p), Offset(d, h - p)),
            listOf(Offset(w - d, h - p), Offset(w - p, h - p), Offset(w - p, h - d)),
        ).forEach { tacke ->
            val putanja = Path().apply {
                moveTo(tacke[0].x, tacke[0].y)
                lineTo(tacke[1].x, tacke[1].y)
                lineTo(tacke[2].x, tacke[2].y)
            }
            drawPath(putanja, tamnaQr, style = stil)
        }
    }
}

private fun uSliku(matrica: BitMatrix): ImageBitmap {
    val sirina = matrica.width
    val visina = matrica.height
    val tamna = android.graphics.Color.rgb(0x13, 0x26, 0x2B)
    val pikseli = IntArray(sirina * visina) { i ->
        if (matrica.get(i % sirina, i / sirina)) tamna else android.graphics.Color.WHITE
    }
    return Bitmap.createBitmap(pikseli, sirina, visina, Bitmap.Config.ARGB_8888).asImageBitmap()
}
