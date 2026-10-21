package io.github.anaspasojevic.fuelpoints.domen

sealed interface Dostupnost {
    data object Dostupna : Dostupnost
    data class Nedostaje(val bodova: Long) : Dostupnost
    data object StanjeNepoznato : Dostupnost
}

// §13.1, UI-06: eligibility je samo UX (availablePoints ≥ costPoints); Backend je autoritet.
fun dostupnost(availablePoints: Long?, costPoints: Long): Dostupnost = when {
    availablePoints == null -> Dostupnost.StanjeNepoznato
    availablePoints >= costPoints -> Dostupnost.Dostupna
    else -> Dostupnost.Nedostaje(costPoints - availablePoints)
}
