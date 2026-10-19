package io.github.anaspasojevic.fuelpoints.ui.qr

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.zxing.common.BitMatrix
import io.github.anaspasojevic.fuelpoints.domen.napraviQr
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface StanjeQr {
    data class Prikaz(val uid: String, val matrica: BitMatrix) : StanjeQr
    data object BezSesije : StanjeQr
}

// UI-04, QR-01 … QR-05, AC-04: QR i tekst su tačno Firebase UID; bez Auth sesije nema QR-a (nema guest QR-a).
class QrViewModel(
    private val auth: IzvorAutentikacije,
    private val generator: (String) -> BitMatrix = { napraviQr(it) },
) : ViewModel() {

    private val _stanje = MutableStateFlow(stanjeZa(auth.trenutniUid()))
    val stanje: StateFlow<StanjeQr> = _stanje.asStateFlow()

    init {
        viewModelScope.launch {
            auth.posmatrajSesiju().collect { uid ->
                val trenutno = _stanje.value
                if (uid == null) _stanje.value = StanjeQr.BezSesije
                else if (trenutno !is StanjeQr.Prikaz || trenutno.uid != uid) _stanje.value = stanjeZa(uid)
            }
        }
    }

    private fun stanjeZa(uid: String?): StanjeQr =
        if (uid == null) StanjeQr.BezSesije else StanjeQr.Prikaz(uid, generator(uid))
}
