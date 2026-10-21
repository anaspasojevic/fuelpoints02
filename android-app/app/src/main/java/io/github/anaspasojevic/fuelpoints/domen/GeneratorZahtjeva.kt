package io.github.anaspasojevic.fuelpoints.domen

import java.util.UUID

// O-15: requestId je kanonski UUID v4 malim slovima; interfejs radi testova (I10-T01, I10-T02).
interface GeneratorZahtjeva {
    fun noviRequestId(): String
}

class UuidGeneratorZahtjeva : GeneratorZahtjeva {
    override fun noviRequestId(): String = UUID.randomUUID().toString()
}
