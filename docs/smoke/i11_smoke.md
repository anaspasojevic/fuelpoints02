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
| S1 | Registracija „Ana” / e-mail / „Lozinka1” | Home „Zdravo, Ana”, 0 bodova, donja navigacija sa 5 stavki | | |
| S2 | Kupovine 42,730 l i 30,000 l (simulator) | Home: 72 boda | | |
| S2a | Ponovi isti zahtjev u simulatoru | 200, bodovi ostaju 72 | | |
| S3 | Istorija | 2 stavke, novija prva, „+30” / „+42”; bez „Učitaj starije kupovine” | | |
| S4 | 20 dodatnih kupovina (simulator: „Nova transakcija” + pošalji, 20×), Istorija | 20 stavki + „Učitaj starije kupovine”; poslije dodira 22, dugme nestaje | | |
| S5 | Nagrade | bodovi u zaglavlju; CAR_WASH (50) i SHOWER (30) „dostupno” | | |
| S6 | Izdaj CAR_WASH → dijalog → Izdaj | voucher QR, odbrojavanje 15:00; Home „Rezervisano 50” | | |
| S8 | Otkaži → dijalog → Otkaži voucher | voucher nestaje, bodovi vraćeni | | |
| S10 | Obavještenja | broj = broj kupovina, nepročitane sa žutom trakom; tap → traka nestaje | | |
| S11 | Profil: Ime za prikaz → „Ana S.” | Home „Zdravo, Ana S.”; 101 znak → greška | | |
| S12 | Promjena lozinke: pogrešna trenutna → poruka; „Lozinka2” → uspjeh; link za reset | neutralna poruka za reset | | |
| S13 | Pomoć i česta pitanja (padajuća pitanja), Uslovi korišćenja | pitanja podrazumijevano skupljena; dodir otvara/zatvara odgovor; tekst nepromijenjen; „Kontakt” na dnu | | |
| S14 | Odjavi se; prijava sa „Lozinka2” | Login; „nazad” ne vraća u aplikaciju; Home (AC-01) | | |
| S15 | Obriši nalog: Odustani; pogrešna lozinka; tačna | Login „Nalog je obrisan.”; ista prijava odbijena generičkom porukom | | |
| S16 | Tamni režim sistema (samo API 35) | Istorija, Nagrade, Obavještenja, Profil, Pomoć u tamnoj temi | n/a | |
| S18 | NFR-09 zbirno: login, Home, QR, purchases, reward, notifications, Settings/logout | PASS | | |
| S19 | Logcat filtriran po paketu (`debug`) | nema tokena, `voucherId`-a, UID-a, e-maila iz koda aplikacije (SDK nalaz iz K-3 se u `debug` očekuje) | | |

Napomena uz S13: Pomoć je preuređena (P-6); provjeriti i veliki font sistema (200 %) i da je svako pitanje dodirljivo (≥ 48 dp).

## 2. S9 — isticanje voucher-a (`debug`, emulator, API 35; P-4)

1. Simulator: kupovina dovoljna za SHOWER (≥ 30 bodova). 2. Aplikacija: Nagrade → izdaj SHOWER (30), zabilježiti `voucherId`
(vidi napomenu ispod). 3. Sačekati odbrojavanje 15:00 → 00:00 (ostali koraci mogu teći u međuvremenu).

| Provjera | Očekivano | Rezultat |
|---|---|---|
| Na 00:00 | „Voucher je istekao” | |
| Backend log | tačno jedan API-06 poziv (`/account/vouchers/reconcile`) (O-49) | |
| Nagrade / Home | voucher nestaje iz aktivnih; bodovi vraćeni; „Rezervisano” nestaje (O-5, AC-08) | |
| Simulator: otkup tog `voucherId` | `409 VOUCHER_EXPIRED` (O-7) | |

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
`i11_obavjestenja.png`, `i11_profil.png`, `i11_pomoc.png`. Rezultat (snimljeno / nedostaje): ______

## 5. Pravi Firebase projekat (K5, K6) — uputstvo: `docs/uputstva/pravi_firebase_projekat.md`

| Provjera | Očekivano | Rezultat / stvarno stanje |
|---|---|---|
| Email Enumeration Protection u konzoli | Enabled (slika `i11_konzola_eep.png`) | |
| Password policy u konzoli | Require, 8, A–Z, 0–9 (slika `i11_konzola_lozinka.png`) | |
| REST 5a: `abcdefg1`, `Abcdefgh`, `Ab1` | `PASSWORD_DOES_NOT_MEET_REQUIREMENTS` za sve tri | |
| REST 5a: `Lozinka1` | uspjeh (probni nalog obrisan) | |
| REST 5b: nepostojeći e-mail vs. pogrešna lozinka | isti `INVALID_LOGIN_CREDENTIALS` | |
| Composite indeksi (3) | svi Enabled (`i11_konzola_indeksi.png`) | |
| `rewardDefinitions` (CAR_WASH 50, SHOWER 30, `active: true`) | postoje | |
| Backend nad pravim projektom, `account/init` bez token-a | 401 `UNAUTHENTICATED` | |

Ako Spark ne nudi Password policy „Require” ili Email Enumeration Protection bez nadogradnje (P-7): **ne nadograđivati**, upisati ovdje
tačno šta konzola piše (i sliku). §3.5 / §3.6 tada nisu ispunjeni na server strani; ide u ODLUKE §7 kao poznato ograničenje.

## 6. K7 — end-to-end nad pravim projektom (`releaseProba`, API 35, Backend lokalno, POS Simulator)

| # | Korak | Očekivano | Rezultat |
|---|---|---|---|
| E1 | Registracija sa „Lozinka1” (slaba lozinka se na serveru provjerava REST-om, odjeljak 5) | Home 0 bodova | |
| E2 | Simulator: kupovina 42,730 l | Home 42 boda (AC-03) | |
| E3 | Simulator: „Ponovi isti zahtjev” | 200, bodovi 42 | |
| E4 | Nagrade → izdaj SHOWER; `voucherId` iz Firestore konzole (`vouchers`) | voucher QR, „Rezervisano 30” | |
| E5 | Simulator: otkup (`voucherId` + novi `redemptionRequestId`) | 200 `REDEEMED`; voucher nestaje (AC-07) | |
| E6 | Simulator: isti otkup ponovo | 200 isto tijelo | |
| E7 | Simulator: drugi voucher, bez POS ključa | 401 `UNAUTHENTICATED_POS` (NFR-02) | |
| E8 | Istorija, Obavještenja, Nagrade (tri upita sa indeksima) | učitavaju se; **bez** `FAILED_PRECONDITION` | |
| E9 | Firestore konzola: `loyaltyLedger` | `earn_`, `reserve_`, `redeem_` zapisi (AC-09) | |
| E10 | Direktan upis u `loyaltyAccounts/<uid>` sa ID token-om vlasnika (Rules Playground ili REST) | 403 `PERMISSION_DENIED` (AC-02) | |
| E11 | Odjava; brisanje naloga; ponovna prijava | odbijena generičkom porukom | |
| E12 | Logcat nad `releaseProba`: `adb logcat -d \| Select-String "FirebaseAuth\|ana@\|Creating user\|Logging in as\|Notifying id token"` | **0 pogodaka**; ista komanda nad `debug` (kontrola) daje pogotke | |

Ako produkcija traži dodatni indeks (poruka sa linkom): **STOP**, ne popravljati u hodu; javiti (P-9).
Poslije testa obrisati probne naloge (Authentication → Users).
