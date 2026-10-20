@file:OptIn(kotlinx.coroutines.ExperimentalCoroutinesApi::class)

package io.github.anaspasojevic.fuelpoints.ui.nagrade

import io.github.anaspasojevic.fuelpoints.domen.PorukeGresaka
import io.github.anaspasojevic.fuelpoints.domen.Preostalo
import io.github.anaspasojevic.fuelpoints.lazni.GlavniDispecerPravilo
import io.github.anaspasojevic.fuelpoints.lazni.LazniBackendApi
import io.github.anaspasojevic.fuelpoints.lazni.LazniGeneratorZahtjeva
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorAutentikacije
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNagrada
import io.github.anaspasojevic.fuelpoints.lazni.LazniIzvorNaloga
import io.github.anaspasojevic.fuelpoints.podaci.api.OdgovorVouchera
import io.github.anaspasojevic.fuelpoints.podaci.api.RezultatApi
import io.github.anaspasojevic.fuelpoints.podaci.nagrade.AktivniVoucher
import io.github.anaspasojevic.fuelpoints.podaci.nalog.LoyaltyNalog
import io.github.anaspasojevic.fuelpoints.podaci.nalog.StanjeDokumenta
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test

// I10-T02, T03, T04, T06 (UI-06, §12–§14, §17, §19, O-15, O-16, O-49, O-50, (s)).
class I10NagradeViewModelTest {

    @get:Rule
    val dispecer = GlavniDispecerPravilo()

    private val auth = LazniIzvorAutentikacije()
    private val nalog = LazniIzvorNaloga()
    private val izvor = LazniIzvorNagrada()
    private val api = LazniBackendApi()
    private val generator = LazniGeneratorZahtjeva()
    private val voucherId = "c".repeat(64)

    private fun TestScope.napravi(bodovi: Long? = 72): NagradeViewModel {
        nalog.loyalty.value = StanjeDokumenta.Postoji(LoyaltyNalog(bodovi, 0), false)
        val vm = NagradeViewModel(auth, nalog, izvor, api, generator) { POCETAK + testScheduler.currentTime }
        advanceUntilIdle()
        return vm
    }

    private fun NagradeViewModel.izdaj(rewardId: String) {
        dodirniNagradu(rewardId)
        potvrdiDijalog()
    }

    // Petlja otkucaja živi dok ima aktivnih voucher-a, a runTest na kraju čeka da se virtuelno vrijeme isprazni.
    private fun TestScope.ocisti() {
        izvor.vauceri.value = StanjeDokumenta.Postoji(emptyList(), false)
        advanceTimeBy(1_100)
    }

    private fun voucher(istice: Long) = StanjeDokumenta.Postoji(listOf(AktivniVoucher(voucherId, "CAR_WASH", 50, istice)), false)

    private fun greska(kod: String?, status: Int) = RezultatApi.GreskaBackenda(kod, status)

    // --- I10-T02 ---

    @Test
    fun `I10-T02 503 pa Pokusaj ponovo salje ISTI requestId`() = runTest {
        val vm = napravi()
        api.odgovoriIzdavanja += greska("SERVICE_UNAVAILABLE", 503)
        vm.izdaj("CAR_WASH")
        advanceUntilIdle()
        assertTrue(vm.stanje.value.poruka!!.mozePonoviti)
        vm.ponovi()
        advanceUntilIdle()
        assertEquals(listOf("CAR_WASH" to "req-1", "CAR_WASH" to "req-1"), api.zahtjeviIzdavanja)
        assertEquals(1, generator.brojac)
        assertEquals(PorukeGresaka.VOUCHER_IZDAT, vm.stanje.value.poruka!!.tekst)
    }

    @Test
    fun `I10-T02 mrezna greska, 500 i odgovor bez 27 tijela ostavljaju isti requestId`() = runTest {
        val vm = napravi()
        for (odgovor in listOf(RezultatApi.MreznaGreska, greska("INTERNAL_ERROR", 500), greska(null, 502), greska(null, 0))) {
            api.zahtjeviIzdavanja.clear()
            api.odgovoriIzdavanja += odgovor
            vm.izdaj("CAR_WASH")
            advanceUntilIdle()
            vm.ponovi()
            advanceUntilIdle()
            assertEquals(2, api.zahtjeviIzdavanja.size)
            assertEquals(api.zahtjeviIzdavanja[0], api.zahtjeviIzdavanja[1])
            // Poslije uspjeha (drugi poziv) pokušaj je zatvoren: sljedeći tap pravi nov id.
        }
        assertEquals(4, generator.brojac)
    }

    @Test
    fun `I10-T02 konacan odgovor zatvara pokusaj - sljedeci tap pravi NOV requestId`() = runTest {
        val vm = napravi()
        val odgovori = listOf(
            RezultatApi.Uspjeh(OdgovorVouchera(voucherId, "CAR_WASH", 50, "ACTIVE", "a", "b")),
            greska("INSUFFICIENT_POINTS", 409),
            greska("REWARD_INACTIVE", 409),
            greska("IDEMPOTENCY_CONFLICT", 409),
            greska("REWARD_NOT_FOUND", 404),
            greska("INVALID_REQUEST", 422),
        )
        for (odgovor in odgovori) api.odgovoriIzdavanja += odgovor
        repeat(odgovori.size) {
            vm.izdaj("CAR_WASH")
            advanceUntilIdle()
        }
        assertEquals(odgovori.size, api.zahtjeviIzdavanja.map { it.second }.toSet().size)
        assertEquals(odgovori.size, generator.brojac)
    }

    @Test
    fun `I10-T02 nezavrsen pokusaj za CAR_WASH pa tap na SHOWER - nov requestId za SHOWER`() = runTest {
        val vm = napravi()
        api.odgovoriIzdavanja += greska("SERVICE_UNAVAILABLE", 503)
        vm.izdaj("CAR_WASH")
        advanceUntilIdle()
        vm.izdaj("SHOWER")
        advanceUntilIdle()
        assertEquals(listOf("CAR_WASH" to "req-1", "SHOWER" to "req-2"), api.zahtjeviIzdavanja)
    }

    @Test
    fun `I10-T02 dijalog Odustani - 0 poziva i 0 generisanih ID-eva`() = runTest {
        val vm = napravi()
        vm.dodirniNagradu("CAR_WASH")
        assertTrue(vm.stanje.value.dijalog is DijalogNagrada.Izdavanje)
        vm.odustani()
        advanceUntilIdle()
        assertNull(vm.stanje.value.dijalog)
        assertTrue(api.pozivi.isEmpty())
        assertEquals(0, generator.brojac)
    }

    @Test
    fun `I10-T02 dok zahtjev traje drugi tap ne pravi dodatne pozive`() = runTest {
        val vm = napravi()
        api.kapijaIzdavanja = CompletableDeferred()
        vm.izdaj("CAR_WASH")
        advanceUntilIdle()
        assertTrue(vm.stanje.value.radi)
        vm.dodirniNagradu("SHOWER")
        vm.potvrdiDijalog()
        advanceUntilIdle()
        assertEquals(1, api.zahtjeviIzdavanja.size)
        api.kapijaIzdavanja!!.complete(Unit)
        advanceUntilIdle()
        assertFalse(vm.stanje.value.radi)
        assertEquals(1, api.zahtjeviIzdavanja.size)
    }

    // --- I10-T03 ---

    @Test
    fun `I10-T03 eligibility u prikazu, redoslijed po costPoints, nedostaje i tap na nedostupnu`() = runTest {
        val vm = napravi(bodovi = 42)
        val katalog = vm.stanje.value.katalog
        assertEquals(listOf("SHOWER", "CAR_WASH"), katalog.map { it.rewardId })
        assertTrue(katalog[0].dostupna)
        assertFalse(katalog[1].dostupna)
        assertEquals(8L, katalog[1].nedostaje)
        vm.dodirniNagradu("CAR_WASH")
        assertNull(vm.stanje.value.dijalog)
        assertTrue(api.pozivi.isEmpty())
    }

    @Test
    fun `I10-T03 72 boda - obje dostupne, 50 jednako 50 dostupno`() = runTest {
        assertTrue(napravi(72).stanje.value.katalog.all { it.dostupna })
    }

    @Test
    fun `I10-T03 bodovi null - nijedna nije dostupna i stanje nedostupno`() = runTest {
        val vm = napravi(bodovi = null)
        assertTrue(vm.stanje.value.stanjeNedostupno)
        assertTrue(vm.stanje.value.katalog.none { it.dostupna })
        vm.dodirniNagradu("SHOWER")
        assertNull(vm.stanje.value.dijalog)
    }

    // --- I10-T04 ---

    @Test
    fun `I10-T04 prelaz u Istekao salje tacno jedan API-06 i lista se mijenja tek novim snapshotom`() = runTest {
        val vm = napravi()
        izvor.vauceri.value = voucher(POCETAK + 3_000)
        advanceTimeBy(1_500)
        assertEquals(Preostalo.Ostalo("00:02"), vm.stanje.value.vauceri.single().preostalo)
        assertEquals(0, api.pozivi.count { it == "reconcile" })

        advanceTimeBy(2_000)
        assertEquals(Preostalo.Istekao, vm.stanje.value.vauceri.single().preostalo)
        assertEquals(1, api.pozivi.count { it == "reconcile" })

        advanceTimeBy(10_000)
        assertEquals(1, api.pozivi.count { it == "reconcile" })
        // Bez snapshot-a voucher ostaje u listi kao „istekao”.
        assertEquals(1, vm.stanje.value.vauceri.size)

        izvor.vauceri.value = StanjeDokumenta.Postoji(emptyList(), false)
        advanceTimeBy(1_000)
        assertTrue(vm.stanje.value.vauceri.isEmpty())
    }

    @Test
    fun `I10-T04 bez voucher-a nema otkucaja`() = runTest {
        napravi()
        // advanceUntilIdle() u napravi() se ne bi zavrsio da postoji beskonacna petlja otkucaja.
        advanceTimeBy(60_000)
        assertTrue(api.pozivi.isEmpty())
    }

    @Test
    fun `I10-T04 ON_START poziva API-06 samo ako je neki voucher prikazan kao istekao`() = runTest {
        val vm = napravi()
        vm.priOtvaranju()
        advanceUntilIdle()
        assertEquals(0, api.pozivi.count { it == "reconcile" })
        izvor.vauceri.value = voucher(POCETAK - 1_000)
        advanceTimeBy(1)
        assertEquals(1, api.pozivi.count { it == "reconcile" })
        vm.priOtvaranju()
        advanceTimeBy(1)
        assertEquals(2, api.pozivi.count { it == "reconcile" })
        ocisti()
    }

    @Test
    fun `I10-T04 naziv nagrade iz kataloga, inace rewardId`() = runTest {
        val vm = napravi()
        izvor.vauceri.value = StanjeDokumenta.Postoji(
            listOf(AktivniVoucher(voucherId, "CAR_WASH", 50, POCETAK + 900_000), AktivniVoucher("d".repeat(64), "NEPOZNATA", 5, POCETAK + 900_000)),
            false,
        )
        advanceTimeBy(1)
        assertEquals(listOf("Besplatno pranje", "NEPOZNATA"), vm.stanje.value.vauceri.map { it.naziv })
        ocisti()
    }

    // --- I10-T06 ---

    private fun TestScope.saVoucherom(): NagradeViewModel {
        val vm = napravi()
        izvor.vauceri.value = voucher(POCETAK + 900_000)
        advanceTimeBy(1)
        return vm
    }

    private fun NagradeViewModel.otkazi() {
        dodirniOtkazi("c".repeat(64))
        potvrdiDijalog()
    }

    @Test
    fun `I10-T06 cancel 200 - poruka otkazan i 0 API-06`() = runTest {
        val vm = saVoucherom()
        vm.otkazi()
        advanceTimeBy(1)
        assertEquals(listOf("otkazi:$voucherId"), api.pozivi)
        assertEquals(PorukeGresaka.VOUCHER_OTKAZAN, vm.stanje.value.poruka!!.tekst)
        ocisti()
    }

    @Test
    fun `I10-T06 cancel 409 VOUCHER_EXPIRED - tacno 1 API-06 i poruka istekao`() = runTest {
        val vm = saVoucherom()
        api.odgovoriOtkazivanja += greska("VOUCHER_EXPIRED", 409)
        vm.otkazi()
        advanceTimeBy(1)
        assertEquals(1, api.pozivi.count { it == "reconcile" })
        assertEquals(PorukeGresaka.VOUCHER_ISTEKAO, vm.stanje.value.poruka!!.tekst)
        ocisti()
    }

    @Test
    fun `I10-T06 VOUCHER_ALREADY_REDEEMED i VOUCHER_NOT_FOUND daju poruke`() = runTest {
        val vm = saVoucherom()
        api.odgovoriOtkazivanja += greska("VOUCHER_ALREADY_REDEEMED", 409)
        vm.otkazi()
        advanceTimeBy(1)
        assertEquals(PorukeGresaka.VOUCHER_ISKORISCEN, vm.stanje.value.poruka!!.tekst)
        api.odgovoriOtkazivanja += greska("VOUCHER_NOT_FOUND", 404)
        vm.otkazi()
        advanceTimeBy(1)
        assertEquals(PorukeGresaka.VOUCHER_NE_POSTOJI, vm.stanje.value.poruka!!.tekst)
        ocisti()
    }

    @Test
    fun `I10-T06 503 i mreza - Pokusaj ponovo ponavlja cancel za isti voucher`() = runTest {
        val vm = saVoucherom()
        api.odgovoriOtkazivanja += greska("SERVICE_UNAVAILABLE", 503)
        api.odgovoriOtkazivanja += RezultatApi.MreznaGreska
        vm.otkazi()
        advanceTimeBy(1)
        assertTrue(vm.stanje.value.poruka!!.mozePonoviti)
        vm.ponovi()
        advanceTimeBy(1)
        assertTrue(vm.stanje.value.poruka!!.mozePonoviti)
        vm.ponovi()
        advanceTimeBy(1)
        assertEquals(List(3) { "otkazi:$voucherId" }, api.pozivi)
        assertEquals(PorukeGresaka.VOUCHER_OTKAZAN, vm.stanje.value.poruka!!.tekst)
        ocisti()
    }

    @Test
    fun `I10-T06 dijalog Ne - 0 poziva`() = runTest {
        val vm = saVoucherom()
        vm.dodirniOtkazi(voucherId)
        assertTrue(vm.stanje.value.dijalog is DijalogNagrada.Otkazivanje)
        vm.odustani()
        advanceTimeBy(1)
        assertTrue(api.pozivi.isEmpty())
        ocisti()
    }

    @Test
    fun `I10-T06 409 ACCOUNT_DELETION_IN_PROGRESS - dogadjaj brisanjeUToku`() = runTest {
        val vm = saVoucherom()
        api.odgovoriOtkazivanja += greska("ACCOUNT_DELETION_IN_PROGRESS", 409)
        vm.otkazi()
        advanceTimeBy(1)
        assertEquals(IzlazSaNagrada.BrisanjeUToku, vm.stanje.value.izlaz)
        ocisti()
    }

    @Test
    fun `I10-T06 issue 409 ACCOUNT_NOT_INITIALIZED - tok pokretanja`() = runTest {
        val vm = napravi()
        api.odgovoriIzdavanja += greska("ACCOUNT_NOT_INITIALIZED", 409)
        vm.izdaj("SHOWER")
        advanceUntilIdle()
        assertEquals(IzlazSaNagrada.Pokretanje, vm.stanje.value.izlaz)
        assertNull(vm.stanje.value.poruka)
    }

    private companion object {
        const val POCETAK = 1_800_000_000_000L
    }
}
