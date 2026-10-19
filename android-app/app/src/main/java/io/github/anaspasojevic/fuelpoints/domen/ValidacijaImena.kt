package io.github.anaspasojevic.fuelpoints.domen

// UI-02, i02/P-3: displayName ima 1–100 UTF-16 jedinica i ispravan UTF-16, bez trim-a (isto kao Backend jeIspravnoIme).
fun jeIspravnoIme(displayName: String): Boolean =
    displayName.length in 1..100 && jeIspravanUtf16(displayName)

private fun jeIspravanUtf16(tekst: String): Boolean {
    var i = 0
    while (i < tekst.length) {
        val znak = tekst[i]
        when {
            znak.isHighSurrogate() -> {
                if (i + 1 >= tekst.length || !tekst[i + 1].isLowSurrogate()) return false
                i += 2
            }
            znak.isLowSurrogate() -> return false
            else -> i++
        }
    }
    return true
}
