// Katalog grešaka: 23 koda iz SRS §27 i tehnička dopuna O-1 (NOT_FOUND, INVALID_REQUEST).
// Kodovi ostaju tačno kako ih SRS imenuje; poruke su generičke, na srpskom (latinica),
// bez internih detalja.

function stavka(kod, http, poruka, izvor) {
  return Object.freeze({ kod, http, poruka, izvor });
}

export const STAVKE_KATALOGA = Object.freeze([
  stavka('UNAUTHENTICATED', 401, 'Prijava nije važeća ili nedostaje.', '§27'),
  stavka('UNAUTHENTICATED_POS', 401, 'POS ključ nije važeći ili nedostaje.', '§27'),
  stavka('FORBIDDEN', 403, 'Nemate pravo na ovu operaciju.', '§27'),
  stavka('ACCOUNT_NOT_INITIALIZED', 409, 'FuelPoints profil ne postoji.', '§27'),
  stavka('ACCOUNT_DELETION_IN_PROGRESS', 409, 'Nalog se briše.', '§27'),
  stavka('REAUTHENTICATION_REQUIRED', 409, 'Potrebna je ponovna prijava.', '§27'),
  stavka('INVALID_DISPLAY_NAME', 422, 'Ime za prikaz nije ispravno.', '§27'),
  stavka('INVALID_TRANSACTION_ID', 422, 'ID POS transakcije nije ispravan.', '§27'),
  stavka('INVALID_VOLUME', 422, 'Količina goriva je van dozvoljenog opsega.', '§27'),
  stavka('INVALID_AMOUNT', 422, 'Iznos je van dozvoljenog opsega.', '§27'),
  stavka('UNSUPPORTED_CURRENCY', 422, 'Valuta nije podržana.', '§27'),
  stavka('INVALID_OCCURRED_AT', 422, 'Vrijeme kupovine nije prihvatljivo.', '§27'),
  stavka('LOYALTY_ACCOUNT_NOT_FOUND', 404, 'Aktivan loyalty nalog ne postoji.', '§27'),
  stavka('IDEMPOTENCY_CONFLICT', 409, 'Isti ID zahtjeva je već korišćen sa drugačijim podacima.', '§27'),
  stavka('REWARD_NOT_FOUND', 404, 'Nagrada ne postoji.', '§27'),
  stavka('REWARD_INACTIVE', 409, 'Nagrada nije aktivna.', '§27'),
  stavka('INSUFFICIENT_POINTS', 409, 'Nemate dovoljno raspoloživih bodova.', '§27'),
  stavka('VOUCHER_NOT_FOUND', 404, 'Vaučer ne postoji.', '§27'),
  stavka('VOUCHER_EXPIRED', 409, 'Vaučer je istekao.', '§27'),
  stavka('VOUCHER_CANCELLED', 409, 'Vaučer je otkazan.', '§27'),
  stavka('VOUCHER_ALREADY_REDEEMED', 409, 'Vaučer je već iskorišćen.', '§27'),
  stavka('INTERNAL_ERROR', 500, 'Došlo je do neočekivane greške na serveru.', '§27'),
  stavka('SERVICE_UNAVAILABLE', 503, 'Servis trenutno nije dostupan.', '§27'),
  stavka('NOT_FOUND', 404, 'Traženi resurs ne postoji.', 'O-1'),
  stavka('INVALID_REQUEST', 422, 'Zahtjev nije ispravan.', 'O-1'),
]);

export const KATALOG_GRESAKA = Object.freeze(
  Object.fromEntries(STAVKE_KATALOGA.map((s) => [s.kod, s])),
);
