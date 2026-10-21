package io.github.anaspasojevic.fuelpoints.ui.pokretanje

import androidx.lifecycle.ViewModel
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// AUTH-05 / AUTH-07 (i10/P-6): ekran „Nalog se briše” nudi „Odjavi se”; odjava ne zove Backend ni Firestore.
class BrisanjeUTokuViewModel(private val auth: IzvorAutentikacije) : ViewModel() {
    private val _izlazNaPrijavu = MutableStateFlow(false)
    val izlazNaPrijavu: StateFlow<Boolean> = _izlazNaPrijavu.asStateFlow()

    fun odjavi() {
        auth.odjavi()
        _izlazNaPrijavu.value = true
    }
}
