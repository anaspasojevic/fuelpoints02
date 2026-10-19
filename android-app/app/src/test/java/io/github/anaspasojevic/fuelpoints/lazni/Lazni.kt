package io.github.anaspasojevic.fuelpoints.lazni

import io.github.anaspasojevic.fuelpoints.podaci.api.BackendApi
import io.github.anaspasojevic.fuelpoints.podaci.api.OdgovorInita
import io.github.anaspasojevic.fuelpoints.podaci.api.OdgovorUskladjivanja
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IshodAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.autentikacija.IzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.podaci.nalog.IzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.nalog.Korisnik
import io.github.anaspasojevic.fuelpoints.podaci.nalog.LoyaltyNalog
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.filterNotNull
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.rules.TestWatcher
import org.junit.runner.Description

// Dispatchers.Main → StandardTestDispatcher; runTest dijeli isti planer (virtuelno vrijeme).
@OptIn(ExperimentalCoroutinesApi::class)
class GlavniDispecerPravilo : TestWatcher() {
    override fun starting(description: Description) = Dispatchers.setMain(StandardTestDispatcher())
    override fun finished(description: Description) = Dispatchers.resetMain()
}

class LazniIzvorAutentikacije(
    uid: String? = "uid-ana",
    var ime: String? = "Ana",
) : IzvorAutentikacije {
    val sesija = MutableStateFlow(uid)
    var ishodPrijave: IshodAutentikacije = IshodAutentikacije.Uspjeh
    var ishodRegistracije: IshodAutentikacije = IshodAutentikacije.Uspjeh
    var ishodImena: IshodAutentikacije = IshodAutentikacije.Uspjeh
    var ishodReseta: IshodAutentikacije = IshodAutentikacije.Uspjeh
    val pozivi = mutableListOf<String>()

    override fun trenutniUid() = sesija.value
    override fun imeIzProfila() = ime
    override fun posmatrajSesiju(): Flow<String?> = sesija

    override suspend fun prijavi(email: String, lozinka: String): IshodAutentikacije {
        pozivi += "prijavi"
        return ishodPrijave
    }

    override suspend fun registruj(email: String, lozinka: String): IshodAutentikacije {
        pozivi += "registruj"
        if (ishodRegistracije == IshodAutentikacije.Uspjeh) sesija.value = "uid-novi"
        return ishodRegistracije
    }

    override suspend fun postaviIme(displayName: String): IshodAutentikacije {
        pozivi += "postaviIme:$displayName"
        if (ishodImena == IshodAutentikacije.Uspjeh) ime = displayName
        return ishodImena
    }

    override suspend fun posaljiReset(email: String): IshodAutentikacije {
        pozivi += "posaljiReset"
        return ishodReseta
    }

    override suspend fun dobaviToken() = sesija.value?.let { "token" }
}

class LazniIzvorNaloga : IzvorNaloga {
    var citanje: StanjeDokumenta<Korisnik> = StanjeDokumenta.Postoji(Korisnik("Ana", "ACTIVE"), izKesa = false)
    val korisnik = MutableStateFlow<StanjeDokumenta<Korisnik>?>(StanjeDokumenta.Postoji(Korisnik("Ana", "ACTIVE"), false))
    val loyalty = MutableStateFlow<StanjeDokumenta<LoyaltyNalog>?>(StanjeDokumenta.Postoji(LoyaltyNalog(0, 0), false))
    var brojCitanja = 0

    override suspend fun procitajKorisnika(uid: String): StanjeDokumenta<Korisnik> {
        brojCitanja++
        return citanje
    }

    override fun posmatrajKorisnika(uid: String) = korisnik.filterNotNull()
    override fun posmatrajLoyaltyNalog(uid: String) = loyalty.filterNotNull()
}

class LazniBackendApi : BackendApi {
    val odgovoriInita = ArrayDeque<RezultatApi<OdgovorInita>>()
    var odgovorUskladjivanja: RezultatApi<OdgovorUskladjivanja> = RezultatApi.Uspjeh(OdgovorUskladjivanja(0))
    val pozivi = mutableListOf<String>()

    override suspend fun inicijalizujNalog(displayName: String, acceptedTermsVersion: String): RezultatApi<OdgovorInita> {
        pozivi += "init:$displayName:$acceptedTermsVersion"
        return odgovoriInita.removeFirstOrNull()
            ?: RezultatApi.Uspjeh(OdgovorInita(displayName, "ACTIVE", acceptedTermsVersion, 0, 0))
    }

    override suspend fun uskladiVaucere(): RezultatApi<OdgovorUskladjivanja> {
        pozivi += "reconcile"
        return odgovorUskladjivanja
    }

    val brojInita get() = pozivi.count { it.startsWith("init:") }
}
