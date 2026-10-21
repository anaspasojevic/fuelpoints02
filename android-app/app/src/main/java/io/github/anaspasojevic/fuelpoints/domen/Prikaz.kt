package io.github.anaspasojevic.fuelpoints.domen

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

// Formatiranje za UI-05 i UI-07 (i10/P-11); bez zavisnosti od lokala uređaja osim zone.
object Prikaz {
    private val datumVrijeme = DateTimeFormatter.ofPattern("dd.MM.yyyy. HH:mm", Locale.ROOT)
    private val datum = DateTimeFormatter.ofPattern("dd.MM.yyyy.", Locale.ROOT)
    private val vrijeme = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)

    // 42 730 → „42,73 l”, 42 735 → „42,735 l”, 30 000 → „30,00 l”: 2–3 decimale, bez gubitka.
    fun litri(volumeMl: Long): String {
        val decimale = "%03d".format(Locale.ROOT, volumeMl % 1000).trimEnd('0').padEnd(2, '0')
        return "${volumeMl / 1000},$decimale l"
    }

    // amountMinor / 100 sa dvije decimale + kod valute iz dokumenta (§8.4 whitelist).
    fun iznos(amountMinor: Long, currency: String): String =
        "${amountMinor / 100},${"%02d".format(Locale.ROOT, amountMinor % 100)} $currency"

    fun datumIVrijeme(ms: Long, zona: ZoneId): String = datumVrijeme.format(Instant.ofEpochMilli(ms).atZone(zona))

    // Obavještenje: danas „HH:mm”, inače „dd.MM.yyyy.”.
    fun vrijemeObavjestenja(kreirano: Long, sada: Long, zona: ZoneId): String {
        val k = Instant.ofEpochMilli(kreirano).atZone(zona)
        val s = Instant.ofEpochMilli(sada).atZone(zona)
        return if (k.toLocalDate() == s.toLocalDate()) vrijeme.format(k) else datum.format(k)
    }

    // Oblik riječi kao Backend (i03/P-8): 1 bod, 2–4 boda, ostalo bodova; 11–14 uvijek bodova.
    fun rijecBod(n: Long): String = when {
        n % 100 in 11..14 -> "bodova"
        n % 10 == 1L -> "bod"
        n % 10 in 2..4 -> "boda"
        else -> "bodova"
    }

    fun bodovi(n: Long): String = "$n ${rijecBod(n)}"
}
