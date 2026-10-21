package io.github.anaspasojevic.fuelpoints.domen

sealed interface Preostalo {
    data class Ostalo(val mmss: String) : Preostalo
    data object Istekao : Preostalo
}

// O-49, §17: odbrojavanje do expiresAt je samo prikaz (lokalni sat); stvarni istek određuje Backend.
object Odbrojavanje {
    fun preostalo(expiresAtMs: Long, sadaMs: Long): Preostalo {
        val razlika = expiresAtMs - sadaMs
        if (razlika <= 0) return Preostalo.Istekao
        val sekunde = (razlika + 999) / 1000
        return Preostalo.Ostalo("%02d:%02d".format(java.util.Locale.ROOT, sekunde / 60, sekunde % 60))
    }
}
