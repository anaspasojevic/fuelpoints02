package io.github.anaspasojevic.fuelpoints.ui.navigacija

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import io.github.anaspasojevic.fuelpoints.Zavisnosti
import io.github.anaspasojevic.fuelpoints.domen.OdredisteNaloga
import io.github.anaspasojevic.fuelpoints.domen.TokBrisanja
import io.github.anaspasojevic.fuelpoints.ui.istorija.EkranIstorije
import io.github.anaspasojevic.fuelpoints.ui.istorija.IstorijaViewModel
import io.github.anaspasojevic.fuelpoints.ui.komponente.Tab
import io.github.anaspasojevic.fuelpoints.ui.komponente.TabOkvir
import io.github.anaspasojevic.fuelpoints.ui.nagrade.EkranNagrada
import io.github.anaspasojevic.fuelpoints.ui.nagrade.IzlazSaNagrada
import io.github.anaspasojevic.fuelpoints.ui.nagrade.NagradeViewModel
import io.github.anaspasojevic.fuelpoints.ui.obavjestenja.EkranObavjestenja
import io.github.anaspasojevic.fuelpoints.ui.obavjestenja.ObavjestenjaViewModel
import io.github.anaspasojevic.fuelpoints.ui.pocetna.EkranPocetne
import io.github.anaspasojevic.fuelpoints.ui.pocetna.IzlazSaPocetne
import io.github.anaspasojevic.fuelpoints.ui.pocetna.PocetnaViewModel
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.BrisanjeUTokuViewModel
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.DovrsetakRegistracijeViewModel
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.EkranBrisanjaUToku
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.EkranDovrsetkaRegistracije
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.EkranPokretanja
import io.github.anaspasojevic.fuelpoints.ui.pokretanje.PokretanjeViewModel
import io.github.anaspasojevic.fuelpoints.ui.prijava.EkranPrijave
import io.github.anaspasojevic.fuelpoints.ui.prijava.PrijavaViewModel
import io.github.anaspasojevic.fuelpoints.ui.profil.BrisanjeNalogaViewModel
import io.github.anaspasojevic.fuelpoints.ui.profil.EkranBrisanjaNaloga
import io.github.anaspasojevic.fuelpoints.ui.profil.EkranImena
import io.github.anaspasojevic.fuelpoints.ui.profil.EkranLozinke
import io.github.anaspasojevic.fuelpoints.ui.profil.EkranPomoci
import io.github.anaspasojevic.fuelpoints.ui.profil.EkranProfila
import io.github.anaspasojevic.fuelpoints.ui.profil.ImeViewModel
import io.github.anaspasojevic.fuelpoints.ui.profil.LozinkaViewModel
import io.github.anaspasojevic.fuelpoints.ui.profil.ProfilViewModel
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
    const val ISTORIJA = "istorija"
    const val NAGRADE = "nagrade"
    const val PROFIL = "profil"
    const val OBAVJESTENJA = "obavjestenja"
    const val IME = "profil/ime"
    const val LOZINKA = "profil/lozinka"
    const val POMOC = "profil/pomoc"
    const val BRISANJE_NALOGA = "brisanjeNaloga"
    const val NASTAVAK_BRISANJA = "nastavakBrisanja"
}

private fun Tab.ruta() = when (this) {
    Tab.POCETNA -> Rute.POCETNA
    Tab.ISTORIJA -> Rute.ISTORIJA
    Tab.QR -> Rute.MOJ_QR
    Tab.NAGRADE -> Rute.NAGRADE
    Tab.PROFIL -> Rute.PROFIL
}

// Prelaz između tabova: „nazad” sa bilo kog taba vodi na Početnu, a sa Početne izlazi iz aplikacije.
private fun NavHostController.naTab(tab: Tab) = navigate(tab.ruta()) {
    popUpTo(Rute.POCETNA) { saveState = true }
    launchSingleTop = true
    restoreState = true
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

    // Gubitak sesije na bilo kojoj prijavljenoj ruti vodi na Login, osim dok traje tok brisanja naloga (tok sam vodi na Login).
    LaunchedEffect(Unit) {
        var prethodni = z.izvorAutentikacije.trenutniUid()
        z.izvorAutentikacije.posmatrajSesiju().collect { uid ->
            if (prethodni != null && uid == null && !z.zastavicaBrisanja.jeUkljucena()) nav.zamijeni(Rute.PRIJAVA)
            prethodni = uid
        }
    }

    val izlazSaNagrada = { izlaz: IzlazSaNagrada ->
        when (izlaz) {
            IzlazSaNagrada.Pokretanje -> nav.zamijeni(Rute.POKRETANJE)
            IzlazSaNagrada.Prijava -> nav.zamijeni(Rute.PRIJAVA)
            IzlazSaNagrada.BrisanjeUToku -> nav.zamijeni(Rute.BRISANJE_U_TOKU)
        }
    }

    NavHost(nav, startDestination = Rute.POKRETANJE) {
        composable(Rute.POKRETANJE) {
            EkranPokretanja(viewModel { PokretanjeViewModel(z.provjeraNaloga) }, nav::idiNa)
        }
        composable(Rute.PRIJAVA) {
            EkranPrijave(
                viewModel { PrijavaViewModel(z.izvorAutentikacije, z.provjeraNaloga, z.porukaZaPrijavu) },
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
            EkranBrisanjaUToku(
                viewModel { BrisanjeUTokuViewModel(z.izvorAutentikacije) },
                naNastavak = { nav.navigate(Rute.NASTAVAK_BRISANJA) },
                naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
            )
        }
        composable(Rute.POCETNA) {
            TabOkvir(Tab.POCETNA, nav::naTab) {
                EkranPocetne(
                    viewModel { PocetnaViewModel(z.izvorAutentikacije, z.izvorNaloga, z.backendApi, z.zastavicaBrisanja) },
                    naObavjestenja = { nav.navigate(Rute.OBAVJESTENJA) { launchSingleTop = true } },
                    naIzlaz = { izlaz ->
                        when (izlaz) {
                            IzlazSaPocetne.Pokretanje -> nav.zamijeni(Rute.POKRETANJE)
                            IzlazSaPocetne.Prijava -> nav.zamijeni(Rute.PRIJAVA)
                            IzlazSaPocetne.BrisanjeUToku -> nav.zamijeni(Rute.BRISANJE_U_TOKU)
                        }
                    },
                )
            }
        }
        composable(Rute.ISTORIJA) {
            TabOkvir(Tab.ISTORIJA, nav::naTab) {
                EkranIstorije(viewModel { IstorijaViewModel(z.izvorAutentikacije, z.izvorKupovina) })
            }
        }
        composable(Rute.MOJ_QR) {
            TabOkvir(Tab.QR, nav::naTab) {
                EkranQr(
                    viewModel { QrViewModel(z.izvorAutentikacije) },
                    naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
                )
            }
        }
        composable(Rute.NAGRADE) {
            TabOkvir(Tab.NAGRADE, nav::naTab) {
                EkranNagrada(
                    viewModel {
                        NagradeViewModel(
                            z.izvorAutentikacije, z.izvorNaloga, z.izvorNagrada, z.backendApi, z.generatorZahtjeva,
                        ) { System.currentTimeMillis() }
                    },
                    naIzlaz = izlazSaNagrada,
                )
            }
        }
        composable(Rute.PROFIL) {
            TabOkvir(Tab.PROFIL, nav::naTab) {
                EkranProfila(
                    viewModel { ProfilViewModel(z.izvorAutentikacije, z.izvorNaloga) },
                    naIme = { nav.navigate(Rute.IME) },
                    naLozinku = { nav.navigate(Rute.LOZINKA) },
                    naPomoc = { nav.navigate(Rute.POMOC) },
                    naUslove = { nav.navigate(Rute.USLOVI) },
                    naBrisanje = { nav.navigate(Rute.BRISANJE_NALOGA) },
                    naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
                )
            }
        }
        composable(Rute.OBAVJESTENJA) {
            EkranObavjestenja(
                viewModel { ObavjestenjaViewModel(z.izvorAutentikacije, z.izvorObavjestenja) },
                naNazad = { nav.popBackStack() },
                naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
            )
        }
        composable(Rute.IME) {
            EkranImena(viewModel { ImeViewModel(z.izvorAutentikacije, z.izvorNaloga) }, naNazad = { nav.popBackStack() })
        }
        composable(Rute.LOZINKA) {
            EkranLozinke(viewModel { LozinkaViewModel(z.izvorAutentikacije) }, naNazad = { nav.popBackStack() })
        }
        composable(Rute.POMOC) {
            EkranPomoci(naNazad = { nav.popBackStack() })
        }
        composable(Rute.BRISANJE_NALOGA) {
            EkranBrisanjaNaloga(
                viewModel { BrisanjeNalogaViewModel(TokBrisanja(z.izvorAutentikacije, z.backendApi, z.zastavicaBrisanja, z.porukaZaPrijavu)) },
                naNazad = { nav.popBackStack() },
                naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
            )
        }
        composable(Rute.NASTAVAK_BRISANJA) {
            EkranBrisanjaNaloga(
                viewModel {
                    BrisanjeNalogaViewModel(
                        TokBrisanja(z.izvorAutentikacije, z.backendApi, z.zastavicaBrisanja, z.porukaZaPrijavu, nastavak = true),
                    )
                },
                naNazad = { nav.popBackStack() },
                naPrijavu = { nav.zamijeni(Rute.PRIJAVA) },
            )
        }
    }
}
