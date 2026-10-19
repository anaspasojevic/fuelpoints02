package io.github.anaspasojevic.fuelpoints.ui.navigacija

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import io.github.anaspasojevic.fuelpoints.Zavisnosti
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.ui.pocetna.EkranPocetne
import io.github.anaspasojevic.fuelpoints.ui.pocetna.IzlazSaPocetne
import io.github.anaspasojevic.fuelpoints.ui.pocetna.PocetnaViewModel
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.DovrsetakRegistracijeViewModel
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.EkranBrisanjaUToku
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.EkranDovrsetkaRegistracije
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.EkranPokretanja
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.PokretanjeViewModel
import io.github.anaspasojevic.fuelpoints.ui.prijava.EkranPrijave
import io.github.anaspasojevic.fuelpoints.ui.prijava.PrijavaViewModel
import io.github.anaspasojevic.fuelpoints.ui.qr.EkranQr
import io.github.anaspasojevic.fuelpoints.ui.qr.QrViewModel
import io.github.anaspasojevic.fuelpoints.ui.registracija.EkranRegistracije
import io.github.anaspasojevic.fuelpoints.ui.registracija.EkranUslova
import io.github.anaspasojevic.fuelpoints.ui.registracija.RegistracijaViewModel

private object Rute {
    const val POKRETANJE = "pokretanje"
    const val PRIJAVA = "prijava"
    const val REGISTRACIJA = "registracija"
    const val USLOVI = "uslovi"
    const val POCETNA = "pocetna"
    const val MOJ_QR = "mojQr"
    const val DOVRSETAK_REGISTRACIJE = "dovrsetakRegistracije"
    const val BRISANJE_U_TOKU = "brisanjeUToku"
}

// Prelazi na početne tačke tokova brišu back stack, da „nazad” ne vodi na Login poslije prijave ni na Home poslije gubitka sesije.
private fun NavHostController.zamijeni(ruta: String) = navigate(ruta) {
    popUpTo(graph.id) { inclusive = true }
    launchSingleTop = true
}

private fun NavHostController.idiNa(odrediste: OdredisteNaloga) = when (odrediste) {
    OdredisteNaloga.Prijava -> zamijeni(Rute.PRIJAVA)
    OdredisteNaloga.Pocetna -> zamijeni(Rute.POCETNA)
    OdredisteNaloga.DovrsetakRegistracije -> zamijeni(Rute.DOVRSETAK_REGISTRACIJE)
    OdredisteNaloga.BrisanjeUToku -> zamijeni(Rute.BRISANJE_U_TOKU)
    // BezMreze i Greska ostaju na ekranu koji ih je dobio.
    OdredisteNaloga.BezMreze, is OdredisteNaloga.Greska -> Unit
}

@Composable
fun NavigacijaAplikacije(z: Zavisnosti) {
    val nav = rememberNavController()
    NavHost(nav, startDestination = Rute.POKRETANJE) {
        composable(Rute.POKRETANJE) {
            EkranPokretanja(viewModel { PokretanjeViewModel(z.provjeraNaloga) }, nav::idiNa)
        }
        composable(Rute.PRIJAVA) {
            EkranPrijave(
                viewModel { PrijavaViewModel(z.izvorAutentikacije, z.provjeraNaloga) },
                naRegistraciju = { nav.navigate(Rute.REGISTRACIJA) },
                naOdrediste = nav::idiNa,
            )
        }
        composable(Rute.REGISTRACIJA) {
            EkranRegistracije(
                viewModel { RegistracijaViewModel(z.izvorAutentikacije, z.provjeraNaloga) },
                naNazad = { nav.popBackStack() },
                naUslove = { nav.navigate(Rute.USLOVI) },
                naOdrediste = nav::idiNa,
            )
        }
        composable(Rute.USLOVI) {
            EkranUslova(naNazad = { nav.popBackStack() })
        }
        composable(Rute.DOVRSETAK_REGISTRACIJE) {
            EkranDovrsetkaRegistracije(
                viewModel { DovrsetakRegistracijeViewModel(z.provjeraNaloga) },
                naUslove = { nav.navigate(Rute.USLOVI) },
                naOdrediste = nav::idiNa,
            )
        }
        composable(Rute.BRISANJE_U_TOKU) {
            EkranBrisanjaUToku()
        }
        composable(Rute.POCETNA) {
            EkranPocetne(
                viewModel { PocetnaViewModel(z.izvorAutentikacije, z.izvorNaloga, z.backendApi) },
                naQr = { nav.navigate(Rute.MOJ_QR) { launchSingleTop = true } },
                naIzlaz = { izlaz ->
                    when (izlaz) {
                        IzlazSaPocetne.Pokretanje -> nav.zamijeni(Rute.POKRETANJE)
                        IzlazSaPocetne.Prijava -> nav.zamijeni(Rute.PRIJAVA)
                        IzlazSaPocetne.BrisanjeUToku -> nav.zamijeni(Rute.BRISANJE_U_TOKU)
                    }
                },
            )
        }
        composable(Rute.MOJ_QR) {
            EkranQr(
                viewModel { QrViewModel(z.izvorAutentikacije) },
                naNazad = { nav.popBackStack() },
                naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
            )
        }
    }
}
