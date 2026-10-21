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

    // i10, §27 (Rewards, cancel, delete).
    const val NEDOVOLJNO_BODOVA = "Nemate dovoljno bodova za ovu nagradu."
    const val NAGRADA_NEDOSTUPNA = "Ova nagrada trenutno nije dostupna."
    const val ZAHTJEV_SE_NE_MOZE_PONOVITI = "Zahtjev nije moguće ponoviti. Pokušajte ponovo."
    const val VOUCHER_ISTEKAO = "Voucher je istekao. Bodovi su vraćeni."
    const val VOUCHER_ISKORISCEN = "Voucher je već iskorišćen."
    const val VOUCHER_VEC_OTKAZAN = "Voucher je već otkazan."
    const val VOUCHER_NE_POSTOJI = "Voucher više ne postoji."
    const val POTVRDITE_LOZINKU = "Potvrdite lozinku još jednom."

    // Poruke tokova (I10-T doslovno).
    const val VOUCHER_IZDAT = "Voucher je izdat. Pokažite QR kod na kasi."
    const val VOUCHER_OTKAZAN = "Voucher je otkazan. Bodovi su vraćeni."
    const val IME_SACUVANO = "Ime je sačuvano."
    const val IME_NA_CEKANJU = "Promjena će biti sačuvana kad veza bude dostupna."
    const val UNESITE_TRENUTNU_LOZINKU = "Unesite trenutnu lozinku."
    const val TRENUTNA_LOZINKA_NEISPRAVNA = "Trenutna lozinka nije ispravna."
    const val PREVISE_POKUSAJA = "Previše pokušaja. Pokušajte kasnije."
    const val LOZINKA_PROMIJENJENA = "Lozinka je promijenjena."
    const val UNESITE_LOZINKU = "Unesite lozinku."
    const val LOZINKA_NIJE_ISPRAVNA = "Lozinka nije ispravna."
    const val BRISANJE_NIJE_ZAVRSENO = "Brisanje nije završeno. Pokušajte ponovo."
    const val NALOG_OBRISAN = "Nalog je obrisan."
    const val KATALOG_NEDOSTUPAN = "Katalog nagrada trenutno nije dostupan."

    // §27 kod → poruka; message i correlationId iz odgovora se nikad ne prikazuju.
    fun zaKod(kod: String?): String = when (kod) {
        "UNAUTHENTICATED" -> SESIJA_ISTEKLA
        "ACCOUNT_DELETION_IN_PROGRESS" -> BRISANJE_U_TOKU
        "INVALID_DISPLAY_NAME" -> IME_NEISPRAVNO
        "SERVICE_UNAVAILABLE" -> SERVIS_NEDOSTUPAN
        "INSUFFICIENT_POINTS" -> NEDOVOLJNO_BODOVA
        "REWARD_INACTIVE", "REWARD_NOT_FOUND" -> NAGRADA_NEDOSTUPNA
        "IDEMPOTENCY_CONFLICT" -> ZAHTJEV_SE_NE_MOZE_PONOVITI
        "VOUCHER_EXPIRED" -> VOUCHER_ISTEKAO
        "VOUCHER_ALREADY_REDEEMED" -> VOUCHER_ISKORISCEN
        "VOUCHER_CANCELLED" -> VOUCHER_VEC_OTKAZAN
        "VOUCHER_NOT_FOUND" -> VOUCHER_NE_POSTOJI
        "REAUTHENTICATION_REQUIRED" -> POTVRDITE_LOZINKU
        else -> OPSTA
    }
}
