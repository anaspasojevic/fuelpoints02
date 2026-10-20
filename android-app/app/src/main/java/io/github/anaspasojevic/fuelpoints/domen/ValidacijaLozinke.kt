package io.github.anaspasojevic.fuelpoints.domen

// §3.6, i09/P-2: isto pravilo kao Firebase password policy — dužina u UTF-16 jedinicama ≥ 8,
// bar jedno veliko slovo A–Z i bar jedna cifra 0–9.
data class PravilaLozinke(val duzina: Boolean, val velikoSlovo: Boolean, val cifra: Boolean) {
    val ispunjena: Boolean get() = duzina && velikoSlovo && cifra
}

fun provjeriLozinku(lozinka: String) = PravilaLozinke(
    duzina = lozinka.length >= 8,
    velikoSlovo = lozinka.any { it in 'A'..'Z' },
    cifra = lozinka.any { it in '0'..'9' },
)

fun jeIspravnaLozinka(lozinka: String) = provjeriLozinku(lozinka).ispunjena
