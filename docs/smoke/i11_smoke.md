# i11 — Smoke protokol: NFR-09 (API 26 + API 35), S9, NFR-10, pravi Firebase projekat

Izvršava: Ana, ručno. Builder upisuje rezultate u `docs/TEST_REPORT.md` tek kad ih Ana popuni ovdje (ništa se ne izmišlja).
Za svako polje „Rezultat”: **PASS** / **FAIL** + kratka napomena. Slike idu u `docs/smoke/` (bez API ključeva, e-mailova i UID-ova u kadru).
Odluke: P-4 (S9 i AC-12 nad emulatorom), P-7 (Spark ograničenja se upisuju kakva jesu), P-8 (NFR-09 kroz `debug` + emulatore).

## 0. Priprema (lokalno, emulatori)

Kao u `docs/smoke/i09_smoke.md` i `i10_smoke.md`: `.env` sa `POS_API_KLJUCEVI`, slobodni portovi 8080 / 9099 / 3000 / 3001,
`.\skripte\pokreniLokalno.ps1`, `debug` APK. Kupovine i otkupe od ovog koraka radi **POS Simulator**:

```powershell
node pos-simulator/server.js        # http://127.0.0.1:3001, ključ stanice iz .env
```

## 1. NFR-09 — puna lista na API 26 i API 35 (`debug`, lokalni emulatori)

Isti scenarij na oba emulatora (API 26, pa API 35). Redovi su iz `i10_smoke.md` (S1 … S16, S18, S19); POS radnje kroz POS Simulator.

| # | Korak | Očekivano | API 26 | API 35 |
|---|---|---|---|---|
| S1 | Registracija „Ana” / e-mail / „Lozinka1” | Home „Zdravo, Ana”, 0 bodova, donja navigacija sa 5 stavki | PASS | PASS |
| S2 | Kupovine 42,730 l i 30,000 l (simulator) | Home: 72 boda | PASS | PASS |
| S2a | Ponovi isti zahtjev u simulatoru | 200, bodovi ostaju 72 | PASS | PASS |
| S3 | Istorija | 2 stavke, novija prva, „+30” / „+42”; bez „Učitaj starije kupovine” | PASS | PASS |
| S4 | 20 dodatnih kupovina (simulator: „Nova transakcija” + pošalji, 20×), Istorija | 20 stavki + „Učitaj starije kupovine”; poslije dodira 22, dugme nestaje | PASS | PASS |
| S5 | Nagrade | bodovi u zaglavlju; CAR_WASH (50) i SHOWER (30) „dostupno” | PASS | PASS |
| S6 | Izdaj CAR_WASH → dijalog → Izdaj | voucher QR, odbrojavanje 15:00; Home „Rezervisano 50” | PASS | PASS |
| S8 | Otkaži → dijalog → Otkaži voucher | voucher nestaje, bodovi vraćeni | PASS | PASS |
| S10 | Obavještenja | broj = broj kupovina, nepročitane sa žutom trakom; tap → traka nestaje | PASS | PASS |
| S11 | Profil: Ime za prikaz → „Ana S.” | Home „Zdravo, Ana S.”; 101 znak → greška | PASS | PASS |
| S12 | Promjena lozinke: pogrešna trenutna → poruka; „Lozinka2” → uspjeh; link za reset | neutralna poruka za reset | PASS | PASS |
| S13 | Pomoć i česta pitanja (padajuća pitanja), Uslovi korišćenja | pitanja podrazumijevano skupljena; dodir otvara/zatvara odgovor; tekst nepromijenjen; „Kontakt” na dnu | PASS | PASS |
| S14 | Odjavi se; prijava sa „Lozinka2” | Login; „nazad” ne vraća u aplikaciju; Home (AC-01) | PASS | PASS |
| S15 | Obriši nalog: Odustani; pogrešna lozinka; tačna | Login „Nalog je obrisan.”; ista prijava odbijena generičkom porukom | PASS | PASS |
| S16 | Tamni režim sistema (samo API 35) | Istorija, Nagrade, Obavještenja, Profil, Pomoć u tamnoj temi | n/a | PASS |
| S18 | NFR-09 zbirno: login, Home, QR, purchases, reward, notifications, Settings/logout | PASS | PASS | PASS |
| S19 | Logcat filtriran po paketu (`debug`) | nema tokena, `voucherId`-a, UID-a, e-maila iz koda aplikacije (SDK nalaz iz K-3 se u `debug` očekuje) | PASS (napomena: e-mail/UID iz Firebase SDK internog logovanja — K-3, poznato, očekivano u `debug`) | PASS (ista napomena — K-3) |

Napomena uz S13: Pomoć je preuređena (P-6); provjeriti i veliki font sistema (200 %) i da je svako pitanje dodirljivo (≥ 48 dp).

## 2. S9 — isticanje voucher-a (`debug`, emulator, API 35; P-4)

1. Simulator: kupovina dovoljna za SHOWER (≥ 30 bodova). 2. Aplikacija: Nagrade → izdaj SHOWER (30), zabilježiti `voucherId`
(vidi napomenu ispod). 3. Sačekati odbrojavanje 15:00 → 00:00 (ostali koraci mogu teći u međuvremenu).

| Provjera | Očekivano | Rezultat |
|---|---|---|
| Na 00:00 | „Voucher je istekao” | **PASS** — odbrojavanje isteklo, vaučer nestao iz Nagrada |
| Backend log | tačno jedan API-06 poziv (`/account/vouchers/reconcile`) (O-49) | nije posebno provjereno u logu; mehanizam potvrđen direktno kroz Firestore (vidi red ispod) |
| Nagrade / Home | voucher nestaje iz aktivnih; bodovi vraćeni; „Rezervisano” nestaje (O-5, AC-08) | **PASS** — potvrđeno i u Firestore: `vouchers` `status: EXPIRED`; `loyaltyLedger/release_<voucherId>` (`REWARD_RELEASE`, `deltaAvailable: +50`, `deltaReserved: -50`); `loyaltyAccounts`: `availablePoints: 60`, `reservedPoints: 0` |
| Simulator: otkup tog `voucherId` | `409 VOUCHER_EXPIRED` (O-7) | **PASS** — HTTP 409, `code: VOUCHER_EXPIRED` |

Napomena: izdat je CAR_WASH (50 bodova) umjesto SHOWER (30) — ne utiče na test, isti mehanizam §20.5 za sve nagrade. `voucherId`:
`175a3c33718a09647c7bcb9d46beba6f010e2a86dcfd01c18d7c9d5c85a1c5ca`, `issuedAt` 14:59:09, `expiresAt` 15:14:09.

Napomena: `voucherId` nije prikazan u aplikaciji; kopirati ga iz Firestore Emulator UI-ja / `Invoke-RestMethod` nad emulatorom
(`vouchers` kolekcija, polje je ID dokumenta) ili iz Backend `/api/v1` odgovora API-03 pri izdavanju.

## 3. NFR-10 — Layout Inspector (API 35, `debug`)

Za svaki ekran: svi interaktivni elementi ≥ 48 × 48 dp, ikone bez teksta imaju `contentDescription`. Upisati najmanju izmjerenu veličinu.
Ako je ijedan element ispod 48 dp: **FAIL** → javiti, ide u FIX LOOP (Builder ispravlja samo na tvoju prijavu).

| Ekran | Interaktivni elementi (najmanja veličina, dp) | `contentDescription` za ikone | Rezultat |
|---|---|---|---|
| Prijava | | | |
| Registracija | | | |
| Uslovi korišćenja | | | |
| „Dovršite registraciju” | | | |
| Home (+ marker „bez mreže”) | | | |
| Moj QR | | | |
| Istorija (+ „Učitaj starije”) | | | |
| Nagrade (+ dijalozi izdavanja / otkazivanja, aktivni voucher) | | | |
| Obavještenja | | | |
| Profil | | | |
| Promjena lozinke | | | |
| Pomoć i česta pitanja (zaglavlja pitanja) | | | |
| Brisanje naloga (upozorenje, lozinka, „Nalog se briše”) | | | |

## 4. Screenshot-i konačnih ekrana (zatvara i09/S12)

`docs/smoke/i11_prijava.png`, `i11_registracija.png`, `i11_home.png`, `i11_moj_qr.png`, `i11_istorija.png`, `i11_nagrade.png`,
`i11_obavjestenja.png`, `i11_profil.png`, `i11_pomoc.png`. Rezultat: **snimljeno**, svih 9 u `docs/smoke/` (API 35, svijetla tema,
konzistentna sesija). Napomena: `i11_profil.png` prikazuje e-mail test naloga (`ana35@primjer.com`) — test podatak, ne pravi korisnik.

## 5. Pravi Firebase projekat (K5, K6) — uputstvo: `docs/uputstva/pravi_firebase_projekat.md`

| Provjera | Očekivano | Rezultat / stvarno stanje |
|---|---|---|
| Email Enumeration Protection u konzoli | Enabled (slika `i11_konzola_eep.png`) | **PASS** — Enabled, potvrđeno u konzoli (Email/Password uključen, bez verifikacije e-maila) |
| Password policy u konzoli | Require, 8, A–Z, 0–9 (slika `i11_konzola_lozinka.png`) | **PASS** — Enforcement = Require, min 8, uppercase + numeric obavezni, potvrđeno u konzoli |
| REST 5a: `abcdefg1`, `Abcdefgh`, `Ab1` | `PASSWORD_DOES_NOT_MEET_REQUIREMENTS` za sve tri | **PASS** — sve tri odbijene sa `PASSWORD_DOES_NOT_MEET_REQUIREMENTS` (§3.6) |
| REST 5a: `Lozinka1` | uspjeh (probni nalog obrisan) | **PASS** — prihvaćena (ok=True), probni nalog obrisan |
| REST 5b: nepostojeći e-mail vs. pogrešna lozinka | isti `INVALID_LOGIN_CREDENTIALS` | **PASS** — identičan odgovor `INVALID_LOGIN_CREDENTIALS` (§3.5); password reset za postojeći i nepostojeći e-mail vraća identičan uspješan odgovor |
| Composite indeksi (3) | svi Enabled (`i11_konzola_indeksi.png`) | **PASS** — purchases, notifications, vouchers: deployovani i Enabled |
| `rewardDefinitions` (CAR_WASH 50, SHOWER 30, `active: true`) | postoje | **PASS** — CAR_WASH i SHOWER ručno seedovani u pravoj bazi (Firestore production mode + pravila deployovani) |
| Backend nad pravim projektom, `account/init` bez token-a | 401 `UNAUTHENTICATED` | **PASS** — 401 `UNAUTHENTICATED`; service account i Backend protiv pravog projekta potvrđeni |

Ako Spark ne nudi Password policy „Require” ili Email Enumeration Protection bez nadogradnje (P-7): **ne nadograđivati**, upisati ovdje
tačno šta konzola piše (i sliku). §3.5 / §3.6 tada nisu ispunjeni na server strani; ide u ODLUKE §7 kao poznato ograničenje.

## 6. K7 — end-to-end (`debug` + Firebase Emulator Suite; zamjena za pravi projekat, O-51)

**Zamjena (O-51):** scenarij E1–E12 se izvodi nad `debug` build-om i lokalnim Firebase Emulator Suite-om (API 35, Backend lokalno, POS Simulator), a ne nad pravim projektom `fuelpoints02`. Razlog: iz Android emulatora Firebase Auth/Firestore nisu dostupni (`FirebaseNetworkException`, „Could not reach Cloud Firestore backend”), iako opšti HTTPS (google.com), lokalni Backend (`10.0.2.2:3000`) i REST pozivi sa host mašine ka istim endpoint-ima rade (`docs/uputstva/pravi_firebase_projekat.md`, odjeljak 5), a isključenje Windows Defender Firewall-a nije pomoglo. Uzrok je ograničenje razvojnog okruženja, ne greška implementacije. Mentor je usmeno odobrio zamjenu 21.10.2026. `release` i `releaseProba` su napravljeni i instalirani; konfiguracija pravog projekta potvrđena je REST dokazima (odjeljak 5). U koracima ispod „Firestore konzola” znači Emulator UI (`http://127.0.0.1:4000`), a E12 kontrola nad `debug` ostaje, uz napomenu da `releaseProba` Logcat provjera nije izvedena ručnim tokom.

| # | Korak | Očekivano | Rezultat |
|---|---|---|---|
| E1 | Registracija sa „Lozinka1” (slaba lozinka se na serveru provjerava REST-om, odjeljak 5) | Home 0 bodova | **PASS** — nalog kreiran, 0 bodova |
| E2 | Simulator: kupovina 42,730 l | Home 42 boda (AC-03) | **PASS** — `earnedPoints=42` |
| E3 | Simulator: „Ponovi isti zahtjev” | 200, bodovi 42 | **PASS** — retry istog `posTransactionId`, bodovi ostali 42 (idempotentno) |
| E4 | Nagrade → izdaj SHOWER; `voucherId` iz Firestore konzole (`vouchers`) | voucher QR, „Rezervisano 30” | **PASS** — 12 dostupno, 30 rezervisano |
| E5 | Simulator: otkup (`voucherId` + novi `redemptionRequestId`) | 200 `REDEEMED`; voucher nestaje (AC-07) | **PASS** — status `REDEEMED` |
| E6 | Simulator: isti otkup ponovo | 200 isto tijelo | **PASS** — identičan odgovor (idempotentno) |
| E7 | Simulator: drugi voucher, bez POS ključa | 401 `UNAUTHENTICATED_POS` (NFR-02) | **PASS** — 401 `UNAUTHENTICATED_POS` |
| E8 | Istorija, Obavještenja, Nagrade (tri upita sa indeksima) | učitavaju se; **bez** `FAILED_PRECONDITION` | **PASS** — rade bez grešaka |
| E9 | Firestore konzola: `loyaltyLedger` | `earn_`, `reserve_`, `redeem_` zapisi (AC-09) | **PASS** — provjereno direktno u Firestore emulatoru: EARN +42, RESERVE −30/+30, REDEEM −30; stanja se poklapaju |
| E10 | Direktan upis u `loyaltyAccounts/<uid>` sa ID token-om vlasnika (Rules Playground ili REST) | 403 `PERMISSION_DENIED` (AC-02) | **Nije ponovo ručno izvedeno** — pokriveno postojećim automatskim RULE testovima iz ranijih iteracija |
| E11 | Odjava; brisanje naloga; ponovna prijava | odbijena generičkom porukom | **PASS** — odjava, ponovna prijava, brisanje naloga i odbijena prijava poslije brisanja |
| E12 | Logcat nad `releaseProba`: `adb logcat -d \| Select-String "FirebaseAuth\|ana@\|Creating user\|Logging in as\|Notifying id token"` | **0 pogodaka**; ista komanda nad `debug` (kontrola) daje pogotke | **Nije izvedeno ručno** — ostaje zabilježeno u O-51 kao van dometa ove zamjene |

Ako produkcija traži dodatni indeks (poruka sa linkom): **STOP**, ne popravljati u hodu; javiti (P-9).
Poslije testa obrisati probne naloge (Authentication → Users).
