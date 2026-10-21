package io.github.anaspasojevic.fuelpoints.domen

import com.google.firebase.Timestamp
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.Kupovina
import io.github.anaspasojevic.fuelpoints.podaci.kupovine.mapirajKupovinu
import io.github.anaspasojevic.fuelpoints.podaci.nagrade.mapirajNagradu
import io.github.anaspasojevic.fuelpoints.podaci.nagrade.mapirajVoucher
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.ZoneId
import java.util.Date

class I10T01GeneratorZahtjevaTest {
    @Test
    fun `I10-T01 1000 requestId vrijednosti su kanonski UUID v4 malim slovima i sve razlicite`() {
        val obrazac = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
        val generator = UuidGeneratorZahtjeva()
        val vrijednosti = List(1000) { generator.noviRequestId() }
        assertTrue(vrijednosti.all { obrazac.matches(it) })
        assertEquals(1000, vrijednosti.toSet().size)
    }
}

class I10T03PrihvatljivostTest {
    @Test
    fun `I10-T03 eligibility je availablePoints vece ili jednako costPoints`() {
        assertEquals(Dostupnost.Dostupna, dostupnost(72, 50))
        assertEquals(Dostupnost.Dostupna, dostupnost(72, 30))
        assertEquals(Dostupnost.Dostupna, dostupnost(42, 30))
        assertEquals(Dostupnost.Nedostaje(8), dostupnost(42, 50))
        assertEquals(Dostupnost.Dostupna, dostupnost(50, 50))
        assertEquals(Dostupnost.StanjeNepoznato, dostupnost(null, 30))
    }

    @Test
    fun `I10-T03 oblik rijeci bod`() {
        assertEquals("1 bod", Prikaz.bodovi(1))
        for (n in listOf(2L, 22L, 42L)) assertEquals("$n boda", Prikaz.bodovi(n))
        for (n in listOf(0L, 5L, 11L, 12L, 111L)) assertEquals("$n bodova", Prikaz.bodovi(n))
    }

    @Test
    fun `I10-T03 katalog - neispravne definicije se preskacu`() {
        assertEquals(
            io.github.anaspasojevic.fuelpoints.podaci.nagrade.Nagrada("CAR_WASH", "Besplatno pranje", 50),
            mapirajNagradu("CAR_WASH", mapOf("active" to true, "displayName" to "Besplatno pranje", "costPoints" to 50L)),
        )
        assertNull(mapirajNagradu("X", mapOf("active" to false, "displayName" to "x", "costPoints" to 50L)))
        for (cijena in listOf<Any>(0L, -1L, 1.5, "50")) {
            assertNull(mapirajNagradu("X", mapOf("active" to true, "displayName" to "x", "costPoints" to cijena)))
        }
        assertNull(mapirajNagradu("X", mapOf("active" to true, "displayName" to 7L, "costPoints" to 50L)))
    }

    @Test
    fun `I10-T03 voucher - samo ACTIVE sa ispravnim expiresAt`() {
        val istice = Timestamp(Date(1_000_000L))
        val ispravan = mapOf("status" to "ACTIVE", "rewardId" to "SHOWER", "costPoints" to 30L, "expiresAt" to istice)
        assertEquals(1_000_000L, mapirajVoucher("v1", ispravan)!!.expiresAtMs)
        assertNull(mapirajVoucher("v1", ispravan + ("status" to "CANCELLED")))
        assertNull(mapirajVoucher("v1", ispravan + ("expiresAt" to "sutra")))
        assertNull(mapirajVoucher("v1", ispravan - "costPoints"))
    }
}

class I10T04OdbrojavanjeTest {
    @Test
    fun `I10-T04 preostalo vrijeme - zaokruzivanje na gore`() {
        fun ostalo(r: Long) = Odbrojavanje.preostalo(r, 0)
        assertEquals(Preostalo.Ostalo("15:00"), ostalo(900_000))
        assertEquals(Preostalo.Ostalo("15:00"), ostalo(899_001))
        assertEquals(Preostalo.Ostalo("14:59"), ostalo(899_000))
        assertEquals(Preostalo.Ostalo("01:00"), ostalo(60_000))
        assertEquals(Preostalo.Ostalo("00:01"), ostalo(1))
        assertEquals(Preostalo.Istekao, ostalo(0))
        assertEquals(Preostalo.Istekao, ostalo(-1))
    }
}

class I10T05PorukeGresakaTest {
    @Test
    fun `I10-T05 poruke za kodove tabele 6_2 doslovno`() {
        val ocekivano = mapOf(
            "INSUFFICIENT_POINTS" to "Nemate dovoljno bodova za ovu nagradu.",
            "REWARD_INACTIVE" to "Ova nagrada trenutno nije dostupna.",
            "REWARD_NOT_FOUND" to "Ova nagrada trenutno nije dostupna.",
            "IDEMPOTENCY_CONFLICT" to "Zahtjev nije moguće ponoviti. Pokušajte ponovo.",
            "VOUCHER_EXPIRED" to "Voucher je istekao. Bodovi su vraćeni.",
            "VOUCHER_ALREADY_REDEEMED" to "Voucher je već iskorišćen.",
            "VOUCHER_CANCELLED" to "Voucher je već otkazan.",
            "VOUCHER_NOT_FOUND" to "Voucher više ne postoji.",
            "REAUTHENTICATION_REQUIRED" to "Potvrdite lozinku još jednom.",
            "ACCOUNT_DELETION_IN_PROGRESS" to PorukeGresaka.BRISANJE_U_TOKU,
            "UNAUTHENTICATED" to PorukeGresaka.SESIJA_ISTEKLA,
            "SERVICE_UNAVAILABLE" to PorukeGresaka.SERVIS_NEDOSTUPAN,
        )
        for ((kod, poruka) in ocekivano) assertEquals(kod, poruka, PorukeGresaka.zaKod(kod))
        for (kod in listOf("FORBIDDEN", "INVALID_REQUEST", "NOT_FOUND", "INTERNAL_ERROR", "NESTO_DRUGO", "ACCOUNT_NOT_INITIALIZED", null)) {
            assertEquals(kod, PorukeGresaka.OPSTA, PorukeGresaka.zaKod(kod))
        }
    }

    @Test
    fun `I10-T05 poruke ne sadrze identifikatore iz ulaza`() {
        val voucherId = "ab".repeat(32)
        val sve = listOf("VOUCHER_EXPIRED", "VOUCHER_NOT_FOUND", "UNAUTHENTICATED", "INTERNAL_ERROR").map { PorukeGresaka.zaKod(it) }
        assertTrue(sve.none { it.contains(voucherId) || it.contains("uid-ana") })
    }

    @Test
    fun `I10-T05 doslovne poruke tokova`() {
        assertEquals("Voucher je izdat. Pokažite QR kod na kasi.", PorukeGresaka.VOUCHER_IZDAT)
        assertEquals("Voucher je otkazan. Bodovi su vraćeni.", PorukeGresaka.VOUCHER_OTKAZAN)
        assertEquals("Ime je sačuvano.", PorukeGresaka.IME_SACUVANO)
        assertEquals("Promjena će biti sačuvana kad veza bude dostupna.", PorukeGresaka.IME_NA_CEKANJU)
        assertEquals("Unesite trenutnu lozinku.", PorukeGresaka.UNESITE_TRENUTNU_LOZINKU)
        assertEquals("Trenutna lozinka nije ispravna.", PorukeGresaka.TRENUTNA_LOZINKA_NEISPRAVNA)
        assertEquals("Previše pokušaja. Pokušajte kasnije.", PorukeGresaka.PREVISE_POKUSAJA)
        assertEquals("Lozinka je promijenjena.", PorukeGresaka.LOZINKA_PROMIJENJENA)
        assertEquals("Unesite lozinku.", PorukeGresaka.UNESITE_LOZINKU)
        assertEquals("Lozinka nije ispravna.", PorukeGresaka.LOZINKA_NIJE_ISPRAVNA)
        assertEquals("Brisanje nije završeno. Pokušajte ponovo.", PorukeGresaka.BRISANJE_NIJE_ZAVRSENO)
        assertEquals("Nalog je obrisan.", PorukeGresaka.NALOG_OBRISAN)
    }
}

class I10T08PrikazTest {
    @Test
    fun `I10-T08 litri bez gubitka sa 2 do 3 decimale`() {
        assertEquals("42,73 l", Prikaz.litri(42_730))
        assertEquals("42,735 l", Prikaz.litri(42_735))
        assertEquals("30,00 l", Prikaz.litri(30_000))
        assertEquals("0,001 l", Prikaz.litri(1))
    }

    @Test
    fun `I10-T08 iznos i valuta`() {
        assertEquals("68,37 EUR", Prikaz.iznos(6_837, "EUR"))
        assertEquals("0,00 EUR", Prikaz.iznos(0, "EUR"))
        assertEquals("1,05 EUR", Prikaz.iznos(105, "EUR"))
    }

    @Test
    fun `I10-T08 datum u zoni uredjaja`() {
        val ms = java.time.Instant.parse("2026-10-06T06:12:00Z").toEpochMilli()
        assertEquals("06.10.2026. 08:12", Prikaz.datumIVrijeme(ms, ZoneId.of("Europe/Sarajevo")))
    }

    @Test
    fun `I10-T08 vrijeme obavjestenja - danas HH_mm, inace datum`() {
        val zona = ZoneId.of("Europe/Sarajevo")
        val sada = java.time.Instant.parse("2026-10-20T10:00:00Z").toEpochMilli()
        assertEquals("08:30", Prikaz.vrijemeObavjestenja(java.time.Instant.parse("2026-10-20T06:30:00Z").toEpochMilli(), sada, zona))
        assertEquals("19.10.2026.", Prikaz.vrijemeObavjestenja(java.time.Instant.parse("2026-10-19T06:30:00Z").toEpochMilli(), sada, zona))
    }

    @Test
    fun `I10-T08 maper kupovine - ispravan dokument`() {
        val polja = mapOf(
            "occurredAt" to Timestamp(Date(5_000L)), "volumeMl" to 42_730L, "amountMinor" to 6_837L, "currency" to "EUR", "earnedPoints" to 42L,
        )
        assertEquals(Kupovina("p1", 5_000L, 42_730L, 6_837L, "EUR", 42L), mapirajKupovinu("p1", polja))
    }

    @Test
    fun `I10-T08 maper kupovine - dokument bez polja ili sa pogresnim tipom se preskace`() {
        val polja = mapOf(
            "occurredAt" to Timestamp(Date(5_000L)), "volumeMl" to 42_730L, "amountMinor" to 6_837L, "currency" to "EUR", "earnedPoints" to 42L,
        )
        assertNotNull(mapirajKupovinu("p1", polja))
        for (kljuc in polja.keys) assertNull(kljuc, mapirajKupovinu("p1", polja - kljuc))
        assertNull(mapirajKupovinu("p1", polja + ("earnedPoints" to "42")))
        assertNull(mapirajKupovinu("p1", polja + ("volumeMl" to -1L)))
    }
}
