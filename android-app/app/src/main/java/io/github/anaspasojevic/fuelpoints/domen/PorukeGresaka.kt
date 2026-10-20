package io.github.anaspasojevic.fuelpoints.domen

// Poruke tokova (§3.5, §3.6, §27, i09/P-4). Konstante su u domenu da bi ih JVM testovi upoređivali doslovno.
object PorukeGresaka {
    const val NEISPRAVNA_PRIJAVA = "E-mail adresa ili lozinka nisu ispravni."
    const val MREZA = "Nema veze sa mrežom. Provjerite internet i pokušajte ponovo."
    const val RESET_POSLAN = "Ako postoji nalog sa ovom e-mail adresom, poslali smo uputstvo za promjenu lozinke."
    const val RESET_PRAZAN_EMAIL = "Unesite e-mail adresu, pa ponovo dodirnite Zaboravljena lozinka."
    const val IME = "Unesite ime za prikaz (najviše 100 znakova)."
    const val EMAIL_PRAZAN = "Unesite e-mail adresu."
    const val EMAIL_NEISPRAVAN = "E-mail adresa nije ispravna."
    const val LOZINKA = "Lozinka mora imati najmanje 8 znakova, bar jedno veliko slovo (A–Z) i bar jednu cifru."
    const val LOZINKE_SE_NE_POKLAPAJU = "Lozinke se ne poklapaju."
    const val USLOVI = "Potrebno je prihvatiti uslove korišćenja."
    const val REGISTRACIJA_NIJE_USPJELA = "Registracija nije uspjela. Ako već imate nalog, prijavite se ili zatražite novu lozinku."
    const val BRISANJE_U_TOKU = "Vaš nalog se briše. Funkcije aplikacije nisu dostupne."
    const val SESIJA_ISTEKLA = "Sesija je istekla. Prijavite se ponovo."
    const val IME_NEISPRAVNO = "Ime za prikaz nije ispravno (1–100 znakova)."
    const val SERVIS_NEDOSTUPAN = "Servis trenutno nije dostupan. Pokušajte ponovo."
    const val OPSTA = "Došlo je do greške. Pokušajte ponovo."
    const val STANJE_NEDOSTUPNO = "Stanje bodova trenutno nije dostupno."

    // §27 kod → poruka; message i correlationId iz odgovora se nikad ne prikazuju.
    fun zaKod(kod: String?): String = when (kod) {
        "UNAUTHENTICATED" -> SESIJA_ISTEKLA
        "ACCOUNT_DELETION_IN_PROGRESS" -> BRISANJE_U_TOKU
        "INVALID_DISPLAY_NAME" -> IME_NEISPRAVNO
        "SERVICE_UNAVAILABLE" -> SERVIS_NEDOSTUPAN
        else -> OPSTA
    }
}
