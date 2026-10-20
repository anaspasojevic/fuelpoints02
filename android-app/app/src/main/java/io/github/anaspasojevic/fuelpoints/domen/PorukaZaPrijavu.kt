package io.github.anaspasojevic.fuelpoints.domen

// Jednokratna poruka za Login poslije odjave ili brisanja naloga („Nalog je obrisan.”); samo u memoriji.
class PorukaZaPrijavu {
    @Volatile
    private var poruka: String? = null

    fun postavi(tekst: String) {
        poruka = tekst
    }

    fun preuzmi(): String? = poruka.also { poruka = null }
}
