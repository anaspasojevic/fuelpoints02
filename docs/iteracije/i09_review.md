# i09 — Review (ADVERSARIAL REVIEWER)

Iteracija 9: Android 1 — Prijava, Registracija, Home, Customer QR. Datum: 2026-10-20. Režim: ekspresni (O-30, O-31; Android bez mutacija).
Uloga: REVIEWER — kod i testovi nisu mijenjani; jedini upisan fajl je ovaj izvještaj. Emulator nije korišćen.

## 1. Polazno stanje

| Stavka | Komanda | Rezultat |
|---|---|---|
| Grana i vrh | `git fetch --all --tags; git switch iteracija-09; git pull; git log --oneline` | `iteracija-09`, up to date; **H = `1ffcce1`** ✔ |
| PR | `gh pr view 9 --json state,title,headRefName` | `OPEN`, „i09: Android 1 — Prijava, Registracija, Home, Customer QR”, `iteracija-09` ✔ |
| O-31 (a) | `git diff --stat b083e7f 1ffcce1` | samo `docs/IMPLEMENTATION_LOG.md`, `docs/ODLUKE.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md` → `provjera.ps1` se ne pokreće (završni run na `b083e7f`, exit 0, TEST_REPORT i09) ✔ |
| Android | `cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat testDebugUnitTest checkDebugAarMetadata; cd ..` | exit 0, `BUILD SUCCESSFUL` (task-ovi UP-TO-DATE) |
| Android, svježe | isto + `--rerun-tasks` | exit 0, `BUILD SUCCESSFUL in 22s`, 24 executed; XML: **10 klasa, 67 tests, 0 fail, 0 error, 0 skipped** ✔ |
| SRS hash | `(Get-FileHash docs/srs/FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` ✔ |
| Nepromijenjeno | `git diff --stat i08 -- backend firebase docs/srs skripte/provjera.ps1` | prazno ✔ |

## 2. Pregled po stavkama

| # | Stavka | Nalaz | |
|---|---|---|---|
| 1 | Scope: nema UI-05 … UI-08, logout-a, Rewards | Rute: `pokretanje`, `prijava`, `registracija`, `uslovi`, `pocetna`, `mojQr`, `dovrsetakRegistracije`, `brisanjeUToku` (`NavigacijaAplikacije.kt`). Home ima samo „Moj QR kod” (O-41); nema bottom navigacije ni mrtvih dugmadi. | ✔ |
| 2 | Bez upisa u Firestore iz Android-a (§2.2, §25.2) | `FirestoreIzvorNaloga` koristi samo `get()` i `addSnapshotListener` na `users/{uid}` i `loyaltyAccounts/{uid}`; nema `set/update/delete/add/runTransaction`. | ✔ |
| 3 | Bez QR skenera i kamere (§2.6) | ZXing `core` samo `QRCodeWriter` u `main`; `QRCodeReader` samo u testu. Manifest: jedina dozvola `INTERNET` (+ I09-T12). | ✔ |
| 4 | NFR-07: tajne | `git ls-files` bez `google-services.json`, `.env`, keystore-a, service account-a; nema `com.google.gms` plugin-a. BuildConfig sadrži samo demo vrijednosti (`demo-fuelpoints`, `demo-api-key`) — nisu tajne (O-39). | ✔ |
| 5 | NFR-07: logovanje | `git grep -nE "Log\.|println|Timber|printStackTrace" -- android-app/app/src` → pogoci samo u `I09T12StatickaProvjeraTest.kt` (lista zabranjenih izraza). Nema `HttpLoggingInterceptor`; izuzeci se gutaju bez ispisa. Token ide samo u zaglavlje. | ✔ |
| 6 | Cleartext (O-40) | `src/debug/res/xml/network_security_config.xml`: `base-config` `false`, jedini `domain-config` `10.0.2.2`, `includeSubdomains="false"`; main manifest bez `usesCleartextTraffic` / `networkSecurityConfig`. | ✔ |
| 7 | §3.5 prijava | `PrijavaViewModel.prijavi`: `MreznaGreska` → mrežna poruka, **svaki drugi** `IshodAutentikacije` (`else`) → `NEISPRAVNA_PRIJAVA` = „E-mail adresa ili lozinka nisu ispravni.” (doslovno §3.5); prazna polja → ista poruka bez Firebase poziva. I09-T04. | ✔ |
| 8 | AUTH-09 / i09/P-4 neutralne poruke | Reset: svaki ne-mrežni ishod → `RESET_POSLAN`; kolizija e-maila → `REGISTRACIJA_NIJE_USPJELA` (tekst i09/P-4 B). I09-T05, I09-T11. | ✔ |
| 9 | §3.6 validator (i09/P-2) | `provjeriLozinku`: `length >= 8`, `any in 'A'..'Z'`, `any in '0'..'9'`; poruka sa „(A–Z)”. Testovi granica 7/8, bez A–Z (`Čokolada1`), bez 0–9 (arapsko-indijska cifra). I09-T01, N1. | ✔ |
| 10 | displayName 1–100 UTF-16 (i02/P-3) | `jeIspravnoIme`: `length in 1..100` + ispravni surogatni parovi, bez trim-a. I09-T02, N2. | ✔ |
| 11 | AUTH-01 | validacija → `registruj` → `postaviIme` → `inicijalizuj` (redoslijed I09-T11); ponovni pokušaj nikad ne ponavlja `createUser` (`nalogKreiran`, `imePostavljeno`). | ✔ |
| 12 | AUTH-03 (i09/P-3) | `ProvjeraNaloga.odredi`: `users` ne postoji **sa servera** → ime iz Auth profila → init; nema/neispravno ime → `DovrsetakRegistracije` (forma ime + uslovi). Odsustvo iz keša / greška → `BezMreze` (bez init-a). I09-T08, N4. | ✔ |
| 13 | AUTH-05 / (v) | `DELETION_IN_PROGRESS` → `BrisanjeUToku` bez init-a; init 409 `ACCOUNT_DELETION_IN_PROGRESS` → `BrisanjeUToku`; Home snapshot i API-06 409 → `brisanjeUToku`. Ekran bez dugmadi (O-41). | ✔ |
| 14 | AUTH-06 | `pokretanje` → `odredi()`; `ACTIVE` (i iz keša) → `pocetna` sa `popUpTo(graph)`. I09-T08, smoke S5. | ✔ |
| 15 | Init tijelo | `TijeloInita(displayName, acceptedTermsVersion)` → tačno `{"displayName":"Ana","acceptedTermsVersion":"1.0"}` (I09-T07 provjerava skup ključeva; N4 provjerava doslovan string). Verzija iz `BuildConfig.VERZIJA_USLOVA = "1.0"` (O-11). | ✔ |
| 16 | Bearer / UID (§3.3) | `dobaviToken()` prije **svakog** pokušaja (i prije retry-ja), `getIdToken(false)` (SDK osvježava pred istek; plan 5.6 odobren); bez sesije → nema zahtjeva. UID se nigdje ne šalje. I09-T07. | ✔ |
| 17 | API-06 (§18, O-43, (s)) | `LifecycleEventEffect(ON_START)` → `priOtvaranju()`; `ByteArray(0).toRequestBody(null)` → `Content-Length: 0`, bez `Content-Type`; greška se ne prikazuje i ne dira stanje; 409 → AUTH-03 / AUTH-05 tok. I09-T07, I09-T09, N4, N5. | ✔ |
| 18 | 503 retry (R-04) | Tačno jedan ponovni pokušaj poslije 1 000 ms, za oba endpointa; 500 bez ponavljanja. I09-T07, N5. | ✔ |
| 19 | §27 parsiranje | `TijeloGreske` (`ignoreUnknownKeys`); neparsabilno → `kod = null` → opšta poruka; `message` / `correlationId` se ne prikazuju. N3. | ✔ |
| 20 | NFR-08 | `addSnapshotListener(MetadataChanges.INCLUDE)` na `loyaltyAccounts/{uid}`; `izKesa = snimak.metadata.isFromCache` → `OznakaBezMreze`. I09-T10, smoke S6. | ✔ |
| 21 | reservedPoints > 0 (UI-03) | `prikaziRezervisano = (rezervisano ?: 0) > 0`. I09-T09. | ✔ |
| 22 | Bodovi se ne računaju lokalno | Home prikazuje samo vrijednosti iz snimka; odgovor init-a se ne koristi za prikaz; negativno / ne-Long → „Stanje bodova trenutno nije dostupno.” | ✔ |
| 23 | QR-01 … QR-05, AC-04 | `napraviQr(uid)` — sadržaj tačno UID (ECC M, UTF-8); dekodiranje ZXing-om u I09-T06; UID kao tekst ispod QR-a; `trenutniUid() == null` → `BezSesije` bez poziva generatora → `prijava`; gubitak sesije dok je QR otvoren → `BezSesije`. | ✔ |
| 24 | Zavisnosti (tabela 5.10) | `libs.versions.toml`: kotlin 2.3.21, firebaseBom 34.19.0, navigationCompose 2.9.8, lifecycle 2.9.4, coroutines 1.11.0, serialization 1.11.0, okhttp 5.3.2, zxing 3.5.4; AGP 8.10.1, composeBom 2024.09.00, coreKtx 1.16.0, activityCompose 1.10.1 nepromijenjeni; test: coroutines-test, mockwebserver. Ništa van O-45; `checkDebugAarMetadata` zelen. | ✔ |
| 25 | Fontovi / ikone (i09/P-5) | TTF u `res/font`, ikone `res/drawable/ikona_*.xml`; licence u `android-app/licence/` (3× SIL OFL 1.1, Apache 2.0) + `README.md` sa izvorima. Nijedna nova Gradle zavisnost. | ✔ |
| 26 | Uslovi 1.0 (O-44, i09/P-6) | Resurs `uslovi_1_0` — tekst 6 tačaka kako je odobren. | ✔ |
| 27 | TODO/FIXME | `git grep -niE "TODO|FIXME" -- android-app skripte` → samo pravilo u `skripte/provjera.ps1`. | ✔ |
| 28 | Testovi I09-T01 … T12 | Postoje i provjeravaju ono što plan (sekcija 8) traži: granice validatora, UTF-16, §3.5 za sve ishode, §27, `Content-Length: 0`, 503 retry, AUTH-03 / 05 / 06, NFR-08, statička provjera manifesta i logovanja. I09-T13 = ručni S11 (nije izvršen, vidi R-02). | ✔ |
| 29 | TEST_REPORT | Run-ovi `provjera.ps1` 2× (kod završnog `b083e7f`), rezultat po ID-u, smoke S1 … S13 sa N/A i odlaganjem uz razlog, nalaz S13 (i09/K-3). | ✔ |
| 30 | TRACEABILITY, ODLUKE, IMPLEMENTATION_LOG | Redovi UI-01 … UI-04, AUTH-01/03/06/09, §2.6, §3.6, QR-01 … QR-06, NFR-08, NFR-10 („neprovjereno”), AC-01 dio, AC-04; ODLUKE O-39 … O-45, i09/P-n, K-3, §7; OD-1 … OD-5. | ✔ |
| 31 | Potpisi u commit-ima | `git log i08..H --format='%an <%ae>%n%B' \| grep -iE "co-authored\|claude\|generated\|anthropic"` → 0 pogodaka. | ✔ |

## 3. NFR-10 — pregled Compose koda po elementu (zamjena za S11, OD-4)

Osnov: M3 `IconButton` (Compose BOM 2024.09.00 → material3 1.3.0) interno primjenjuje `minimumInteractiveComponentSize()` (48 dp);
`ZutoDugme` = `fillMaxWidth().height(56.dp)`; `LinkTekst` = `heightIn(min = 48.dp)` + `clickable(role = Button)`; polje = `heightIn(min = 52.dp)` puna širina;
`PrihvatanjeUslova` = `toggleable(role = Checkbox)` + `heightIn(min = 48.dp)`.

| Ekran | Element | Dimenzija dodira | contentDescription / tekst | |
|---|---|---|---|---|
| Prijava | Polje e-mail | ≥ 52 dp × puna širina | `semantics` „E-mail” (placeholder) | ✔ |
| Prijava | Polje lozinka | ≥ 52 dp × puna širina | `semantics` „Lozinka” | ✔ |
| Prijava | Ikona oka | `IconButton` 48 × 48 dp | „Prikaži lozinku” / „Sakrij lozinku” | ✔ |
| Prijava | „Prijavi se” | 56 dp × puna širina | tekst | ✔ |
| Prijava | „Zaboravljena lozinka” | ≥ 48 dp visina, širina teksta (> 48 dp) | tekst | ✔ |
| Prijava | „Napravi nalog” | ≥ 48 dp visina, širina teksta (> 48 dp) | tekst | ✔ |
| Prijava | Ikone pumpe, pošte, katanca | nisu klikabilne | `null` (dekorativne) | ✔ |
| Registracija | „Nazad” | `IconButton` 48 × 48 dp | „Nazad” | ✔ |
| Registracija | 4 polja (ime, e-mail, lozinka, ponovljena) | ≥ 52 dp × puna širina | oznaka iznad polja (tekst) | ✔ |
| Registracija | 2 ikone oka | `IconButton` 48 × 48 dp | „Prikaži / Sakrij lozinku” | ✔ |
| Registracija | Kvačica „lozinke se poklapaju” | nije klikabilna | „Lozinke se poklapaju” | ✔ |
| Registracija | LCD trake pravila | nisu klikabilne | `semantics(mergeDescendants)` ispunjeno / nije | ✔ |
| Registracija | Checkbox uslova + „Prihvatam” | ≥ 48 dp visina, širina 22 dp + 10 dp + tekst (> 48 dp) | `Role.Checkbox` + tekst „Prihvatam” | ✔ |
| Registracija | Link „uslove korišćenja” | ≥ 48 dp visina, širina teksta | tekst | ✔ |
| Registracija | „Napravi nalog” / „Pokušaj ponovo” | 56 dp × puna širina | tekst | ✔ |
| Uslovi | „Nazad” | `IconButton` 48 × 48 dp | „Nazad” | ✔ |
| Dovršite registraciju | Polje ime | ≥ 52 dp × puna širina | oznaka | ✔ |
| Dovršite registraciju | Checkbox + link uslova | kao Registracija | kao Registracija | ✔ |
| Dovršite registraciju | „Potvrdi” | 56 dp × puna širina | tekst | ✔ |
| Pokretanje | „Pokušaj ponovo” | 56 dp × puna širina | tekst | ✔ |
| Pokretanje | Indikator učitavanja | nije klikabilan | „Učitavanje…” | ✔ |
| Home | „Moj QR kod” | 56 dp × puna širina | tekst (ikona QR dekorativna) | ✔ |
| Home | Broj bodova (LCD) | nije klikabilan | `semantics(mergeDescendants)` „{n} dostupnih bodova” | ✔ |
| Home | Offline marker | nije klikabilan | tekst (ikona dekorativna) | ✔ |
| Moj QR | „Nazad” | `IconButton` 48 × 48 dp | „Nazad” | ✔ |
| Moj QR | Slika QR-a | nije klikabilna | „QR kod sa vašim identifikatorom” | ✔ |

Zaključak: pregledom koda NFR-10 je ispunjen za sve klikabilne elemente i09. Ovo je pregled koda, ne mjerenje na uređaju:
**obaveza za i11** — ručna Layout Inspector provjera na API 35 (S11 / I09-T13) za ekrane i09 i i10 (R-02).

## 4. Napadi (privremeni test `android-app/app/src/test/…/fuelpoints/ReviewNapadiTest.kt`, nije commit-ovan, obrisan; `git status` čist)

Komanda: `.\gradlew.bat testDebugUnitTest --tests "*ReviewNapadiTest*"` → exit 0; XML: 6 tests, 0 failures, 0 errors.

| # | Napad | Očekivano | Dobijeno | |
|---|---|---|---|---|
| N1 | Validator: `Lozinka1`, `lozinka1`, `LOZINKAA`, `Lozink1`, `Čokolada1` (+ `LOZINKA1`) | PASS, FAIL, FAIL, FAIL, FAIL (+ PASS) | isto | ✔ |
| N2 | displayName: `""`, 101 × `x`, 50 emoji (100 jed.), 51 emoji (102 jed.), 99 + emoji (101 jed.) | FAIL, FAIL, PASS, FAIL, FAIL | isto | ✔ |
| N3 | §27: `{"message":…}` bez `error`, nepoznat kod sa „Stack: …” u `message`, HTML, `{"error":"STRING"}`, `code` broj, `code` null, prazno tijelo; 200 sa HTML-om | `GreskaBackenda`, poruka = opšta; sirov tekst nikad do UI-ja | svi → `GreskaBackenda(kod null ili nepoznat)` → `zaKod` = „Došlo je do greške. Pokušajte ponovo.”; 200 + HTML → `GreskaBackenda(null, 200)` | ✔ |
| N4a | Init 409 `ACCOUNT_DELETION_IN_PROGRESS` u AUTH-03 toku (pravi `OkHttpBackendApi` + MockWebServer) | `BrisanjeUToku`; tijelo tačno `{"displayName":"Ana","acceptedTermsVersion":"1.0"}` | isto | ✔ |
| N4b | API-06 409 `ACCOUNT_NOT_INITIALIZED` na Home-u, pa `odredi()` sa `users` odsutnim na serveru | izlaz `Pokretanje`; API-06 bez tijela; zatim ponovni init → `Pocetna` | isto (`bodySize` 0, drugi zahtjev `/api/v1/account/init`) | ✔ |
| N5 | API-06 503 dvaput (Home sa 42 / 5 bodova) | tačno 2 zahtjeva, jedna pauza 1 000 ms; Home i dalje 42, rezervisano vidljivo, bez izlaza i bez poruke | `requestCount` 2, `pauze` [1000], stanje nepromijenjeno | ✔ |

## 5. Nalazi

**R-01 — MINOR — smoke na API 26 umjesto API 35 (OD-1).** Referenca: O-31 (d), i09/K-2, brief tačka 5. Reprodukcija: TEST_REPORT i09,
tabela smoke. Očekivano: S1 … S13 na API 35. Dobijeno: API 26 (S1 … S9, S13 PASS; S10 N/A). Procesno odstupanje, transparentno upisano;
API 26 je minSdk pa funkcionalni tokovi jesu pokriveni. Obaveza za i11: smoke i09 ekrana na API 35 (uz NFR-09) uključujući S10 tamnu temu.

**R-02 — NOTE — NFR-10 bez izvršene inspekcije na uređaju (OD-4).** Referenca: NFR-10, I09-T13 / S11. Pregled koda (sekcija 3) ne nalazi
nijedan element ispod 48 dp ni funkcionalnu ikonu bez `contentDescription`. Obaveza za i11: Layout Inspector na API 35 (i09 + i10 ekrani),
rezultat u TEST_REPORT i TRACEABILITY (NFR-10 ostaje „IMPLEMENTIRANO, neprovjereno” do tada).

**R-03 — NOTE — screenshot-i odloženi (OD-3).** Brief tačka 8 traži screenshot-e Login, Home, QR u `docs/smoke/`. Svrha je „za kasniji rad”,
pa je odlaganje do konačnih ekrana poslije i10 opravdano. Obaveza za i10/i11.

**R-04 — NOTE — Firebase Auth SDK loguje e-mail (INFO) i UID (DEBUG) (S13, i09/K-3).** Kod aplikacije ne loguje (I09-T12, `git grep`).
NFR-07 se odnosi na tajne; e-mail i UID nisu tajne, ali brief traži da „token, UID i e-mail ne idu u Logcat”. Već upisano kao obaveza za i11
(R8 `-assumenosideeffects` za `Log.v/d/i`); preporuka da se i11 smoke S13 ponovi nad release build-om.

**R-05 — NOTE — sistemsko „nazad” poslije kreiranja Auth naloga u registraciji.** `EkranRegistracije` skriva dugme „Nazad” kad je
`nalogKreiran`, ali nema `BackHandler`, pa gest „nazad” vraća na Prijavu dok je korisnik prijavljen, a nalog možda nije inicijalizovan.
Posljedica nije gubitak stanja: sljedeća prijava ili pokretanje ide kroz `ProvjeraNaloga` → AUTH-03 ponovni init (I09-T08, N4b). Bez akcije u i09.

**R-06 — NOTE — `LinkTekst` ograničava samo visinu (`heightIn(min = 48.dp)`), ne širinu.** Svi postojeći linkovi su tekstovi širi od 48 dp,
pa je NFR-10 ispunjen; kratak link u i10 bi tražio `widthIn(min = 48.dp)` ili `minimumInteractiveComponentSize()`.

**R-07 — NOTE — teorijska petlja Home ↔ Pokretanje.** Ako bi Backend vratio API-06 409 `ACCOUNT_NOT_INITIALIZED` dok `users/{uid}` postoji kao
`ACTIVE`, Home → `pokretanje` → `pocetna` bi se ponavljalo pri svakom ON_START. AUTH-02 (jedna transakcija za oba dokumenta) i i05 logika
čine ovo stanje nedostižnim; bez akcije.

Ukupno: 0 BLOCKER, 0 MAJOR, 1 MINOR, 6 NOTE.

## 6. Pitanja za Orchestrator-a

Nema pitanja koja traže odluku prije merge-a. Backlog za i10/i11 (već upisan u IMPLEMENTATION_LOG i ODLUKE, ovdje objedinjen):
smoke i09 ekrana na API 35 + S10 (R-01); Layout Inspector NFR-10 (R-02); screenshot-i (R-03); R8 uklanjanje SDK logova i ponovljen S13 na
release build-u (R-04).

## 7. PRESUDA

**ITERATION ACCEPTED**

Nema BLOCKER ni MAJOR nalaza. Svi SRS zahtjevi u opsegu i09 (UI-01 … UI-04, §3.5, §3.6, AUTH-01/03/05/06/09/10, QR-01 … QR-06, §18 / O-43,
NFR-07, NFR-08) potvrđeni su kodom, testovima (67/67, svježe izvršeno) i napadima N1 … N5; NFR-10 potvrđen pregledom koda uz obavezu
inspekcije na uređaju u i11.
