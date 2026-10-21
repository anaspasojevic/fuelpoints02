package io.github.anaspasojevic.fuelpoints.domen

// (v), O-48: aplikacijska zastavica „brisanje u toku” (samo u memoriji). Dok je uključena, API klijent ne šalje init, API-06,
// API-03 ni API-05, a Home ne poziva API-06 niti navigira na „Nalog se briše”.
class ZastavicaBrisanja {
    @Volatile
    private var ukljucena = false

    fun jeUkljucena(): Boolean = ukljucena

    fun ukljuci() {
        ukljucena = true
    }

    fun iskljuci() {
        ukljucena = false
    }
}
