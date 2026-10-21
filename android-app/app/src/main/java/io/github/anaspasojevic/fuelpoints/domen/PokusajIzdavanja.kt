package io.github.anaspasojevic.fuelpoints.domen

// O-50, §13, i10/P-2: jedan logički pokušaj izdavanja nagrade nosi isti requestId dok ne dobije konačan odgovor.
// Tap „Izdaj” za istu nagradu dok je pokušaj nezavršen = retry (isti requestId); pokušaj za drugu nagradu napušta prethodni.
class PokusajIzdavanja(private val generator: GeneratorZahtjeva) {
    private var rewardId: String? = null
    private var requestId: String? = null

    // Početak ili nastavak pokušaja; vraća requestId koji se šalje.
    fun pocni(rewardId: String): String {
        val tekuci = requestId
        if (tekuci != null && this.rewardId == rewardId) return tekuci
        val novi = generator.noviRequestId()
        this.rewardId = rewardId
        requestId = novi
        return novi
    }

    // Konačan odgovor (201, 200, 4xx): sljedeći tap pravi novi requestId.
    fun zatvori() {
        rewardId = null
        requestId = null
    }

    // Odgovor koji ne zatvara pokušaj: 503, mrežna greška, 500 i odgovor bez čitljivog §27 tijela (i10/P-2).
    companion object {
        fun jeKonacan(kod: String?, status: Int): Boolean = kod != null && status < 500
    }
}
