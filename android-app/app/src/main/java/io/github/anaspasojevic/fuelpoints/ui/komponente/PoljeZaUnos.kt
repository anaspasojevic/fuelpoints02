package io.github.anaspasojevic.fuelpoints.ui.komponente

import androidx.annotation.DrawableRes
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import io.github.anaspasojevic.fuelpoints.R
import io.github.anaspasojevic.fuelpoints.ui.tema.LocalBoje

// Polje za unos iz prototipa (.unos, .polje): opciona oznaka iznad, ikona lijevo, okvir koji pokazuje fokus i grešku.
@Composable
fun PoljeZaUnos(
    vrijednost: String,
    naPromjenu: (String) -> Unit,
    modifier: Modifier = Modifier,
    oznaka: String? = null,
    opis: String? = null,
    @DrawableRes ikona: Int? = null,
    lozinka: Boolean = false,
    greska: String? = null,
    omoguceno: Boolean = true,
    tipTastature: KeyboardType = KeyboardType.Text,
    akcija: ImeAction = ImeAction.Next,
    dodatak: (@Composable () -> Unit)? = null,
) {
    val boje = LocalBoje.current
    val interakcija = remember { MutableInteractionSource() }
    val fokus by interakcija.collectIsFocusedAsState()
    var vidljiva by rememberSaveable { mutableStateOf(false) }
    val bojaOkvira = when {
        greska != null -> boje.crvena
        fokus -> boje.tekst
        else -> boje.linija
    }
    Column(modifier.fillMaxWidth()) {
        if (oznaka != null) {
            Text(oznaka, style = MaterialTheme.typography.labelMedium, color = boje.tekst)
            Spacer(Modifier.padding(top = 6.dp))
        }
        BasicTextField(
            value = vrijednost,
            onValueChange = naPromjenu,
            enabled = omoguceno,
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyLarge.copy(color = if (omoguceno) boje.tekst else boje.sekundarni),
            cursorBrush = SolidColor(boje.tekst),
            visualTransformation = if (lozinka && !vidljiva) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = if (lozinka) KeyboardType.Password else tipTastature,
                imeAction = akcija,
                autoCorrectEnabled = !lozinka && tipTastature == KeyboardType.Text,
            ),
            interactionSource = interakcija,
            modifier = Modifier
                .fillMaxWidth()
                .semantics { if (opis != null) contentDescription = opis },
            decorationBox = { polje ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(min = 52.dp)
                        .background(boje.kartica, RoundedCornerShape(12.dp))
                        .border(1.5.dp, bojaOkvira, RoundedCornerShape(12.dp))
                        .padding(start = 14.dp, end = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (ikona != null) {
                        // Dekorativna: oznaka ili opis polja nosi značenje.
                        Icon(painterResource(ikona), contentDescription = null, tint = boje.sekundarni, modifier = Modifier.size(21.dp))
                        Spacer(Modifier.width(10.dp))
                    }
                    Box(Modifier.weight(1f).padding(vertical = 14.dp)) {
                        if (vrijednost.isEmpty() && oznaka == null && opis != null) {
                            Text(opis, style = MaterialTheme.typography.bodyLarge, color = boje.sekundarni)
                        }
                        polje()
                    }
                    if (lozinka) {
                        IconButton(onClick = { vidljiva = !vidljiva }) {
                            Icon(
                                painterResource(if (vidljiva) R.drawable.ikona_oko_precrtano else R.drawable.ikona_oko),
                                contentDescription = stringResource(if (vidljiva) R.string.sakrij_lozinku else R.string.prikazi_lozinku),
                                tint = boje.sekundarni,
                            )
                        }
                    }
                    dodatak?.invoke()
                    if (!lozinka && dodatak == null) Spacer(Modifier.width(12.dp))
                }
            },
        )
        if (greska != null) {
            Spacer(Modifier.padding(top = 6.dp))
            PorukaGreske(greska)
        }
    }
}
