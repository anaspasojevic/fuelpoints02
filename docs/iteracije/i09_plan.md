# i09 — Plan (PLANNER)

Iteracija 9: Android 1 — Login, Registracija, Home, Customer QR. Grana `iteracija-09` (iz `main` = merge `2e98999`, tag `i08`).
Izvori: `CLAUDE.md`, `docs/iteracije/i09_brief.md` (obavezujući), `docs/ODLUKE.md` (verzija na tagu `i08`), SRS 3.1
(`docs/srs/FuelPoints_SRS_3_1.docx`, normativan, SHA-256 `7D866413…C60228` provjeren; `.md` čitljiva kopija), `docs/iteracije/i08_plan.md`
(struktura), `docs/dizajn/*.png`, `docs/dizajn/prototip.html`, `android-app/` (kostur i01), `README.md` (API-01, API-06), `skripte/provjera.ps1`.
Datum plana: 2026-10-19. Uloga: PLANNER (bez koda). Režim: ekspresni (O-30, O-31). `provjera.ps1` nije pokretan.

Oznake: otvorena pitanja `i09/P-n` (sekcija 13); dopunski testovi `I09-T01 … I09-T13`; koraci `K1 … K7` (sekcija 7). Mutacija nema (O-31 (c)).
Probe su rađene u scratchpad-u sesije (kopija `android-app` i privremene skripte, van repoa, nisu commit-ovane); ishod je u sekciji 3.2.

---

## 1. SRS zahtjevi u opsegu

| Zahtjev | Šta i09 isporučuje |
|---|---|
| UI-01, §3.5 | Ekran Prijava: e-mail, lozinka, „Prijavi se”, „Napravi nalog”, „Zaboravljena lozinka”. Svaki neuspjeh prijave osim mrežne greške → tačno „E-mail adresa ili lozinka nisu ispravni.” |
| UI-02, §3.6, AUTH-10 | Ekran Registracija: ime za prikaz, e-mail, lozinka, ponovljena lozinka, prihvatanje uslova (bez telefona i datuma rođenja); klijentska validacija §3.6 i `displayName` 1–100 UTF-16 (i02/P-3); `acceptedTermsVersion = "1.0"` (O-11). |
| AUTH-01 | Validacija → `createUserWithEmailAndPassword` → postavljanje Auth profila (`displayName`, i09/P-3) → `getIdToken` → `POST /api/v1/account/init`. |
| AUTH-03 (O-42) | Auth sesija bez `users/{uid}` (ili API vrati `409 ACCOUNT_NOT_INITIALIZED`) → ponovni init (5.4, i09/P-3). |
| AUTH-05 (dio, O-43, (v)) | `DELETION_IN_PROGRESS` → ekran sa porukom, bez Home funkcija; init se tada NE poziva. |
| AUTH-06 | Postojeća Auth sesija + `users/{uid}.accountStatus == "ACTIVE"` → Home bez ponovne prijave. |
| AUTH-09 | „Zaboravljena lozinka” → `sendPasswordResetEmail`; Backend ne učestvuje; ista poruka bez obzira na to da li e-mail postoji. |
| UI-03, §18, NFR-08 (O-41, O-43) | Home: `displayName`, `availablePoints`, `reservedPoints` samo ako > 0, offline/stale marker (`isFromCache` na snapshot-u `loyaltyAccounts/{uid}`), ulaz na QR; API-06 pri svakom ON_START. |
| UI-04, QR-01 … QR-06, §2.6, AC-04 | QR sa tačno Firebase UID-om (ZXing core, lokalno), UID i kao tekst; bez Auth sesije nema QR-a; nema guest QR-a; bez skenera i bez dozvole za kameru. QR-06: bez dodatnih mjera. |
| §2.2, §25.2, §25.3 | Android samo čita `users/{uid}` i `loyaltyAccounts/{uid}` (owner get / snapshot); nijedan upis u Firestore. |
| §3.3, NFR-01 | Svaki Backend poziv: `Authorization: Bearer <getIdToken>`; UID nikad u tijelu. HTTPS van MVP-a (O-40). |
| NFR-07 | Bez `google-services.json`, POS ključeva i service account-a u repou/APK-u; token, UID i e-mail se ne pišu u Logcat (I09-T12). |
| NFR-10 (dio) | Touch target ≥ 48×48 dp; ikone bez teksta sa `contentDescription` (inspekcija u smoke-u, I09-T13). |
| AC-01 (dio), AC-04 | Registracija, prijava, obnova sesije (logout je i10); QR sadrži UID i ništa drugo. |

## 2. Van opsega

UI-05 … UI-08, AUTH-07 (logout), AUTH-08, Delete Account, Rewards / issue / cancel / reward QR (i10); bottom navigacija i ulazi za Purchases,
Rewards, Notifications, Settings (O-41 → i10); POS Simulator (i11); pravi Firebase projekat, Email Enumeration Protection i password policy
„Require” u konzoli (O-2 → i11); NFR-09 na API 26 (i11); FCM; QR skener; kopiranje UID-a u clipboard (nije u SRS-u, §1.3); izmjene Backend-a,
Rules-a i `provjera.ps1`; Android upisi u Firestore (uključujući promjenu `displayName`, UI-08 → i10); Compose UI / instrumentacioni testovi.
Proba 3.2 (b) potvrđuje da izmjena Backend-a NIJE potrebna.

## 3. Polazno stanje i probe

### 3.1 Korak 0

`git fetch --all --tags`; `main` = `2e98999` = `i08^{commit}` (anotirani tag); SRS hash `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`
odgovara; grana `iteracija-09`; brief doslovno u `docs/iteracije/i09_brief.md` (commit „i09: Iteration Brief (Orchestrator)”, push -u).

Kostur i01: AGP 8.10.1, Gradle 8.11.1, Kotlin 2.0.21 (`kotlinOptions`), Compose BOM 2024.09.00, compileSdk/targetSdk 35, minSdk 26, jedna
`GlavnaAktivnost` sa praznim `Box`-om, bez `INTERNET` dozvole, bez testova. `firebase.json`: Firestore `127.0.0.1:8080`, Auth `127.0.0.1:9099`.
`.env.example`: Backend `PORT=3000`, sluša na `127.0.0.1` (sa Android emulatora dostupno kao `10.0.2.2`, koji je alias za loopback hosta).

### 3.2 Probe (scratchpad, nisu commit-ovane)

(a) **Firebase bez `google-services.json` i bez plugin-a (O-39) — POTVRĐENO.** `FirebaseApp.initializeApp(context, FirebaseOptions.Builder()
.setProjectId(BuildConfig…="demo-fuelpoints").setApplicationId("1:000000000000:android:0000000000000000").setApiKey("demo-api-key").build())`,
`FirebaseAuth.getInstance(app).useEmulator("10.0.2.2", 9099)`, `FirebaseFirestore.getInstance(app).useEmulator("10.0.2.2", 8080)`,
`addSnapshotListener(MetadataChanges.INCLUDE)` sa `metadata.isFromCache`, `getIdToken(false).await()`, NavHost + `viewModel()`:
`assembleDebug testDebugUnitTest` → **BUILD SUCCESSFUL** (uz izmjene toolchain-a iz (c)). Minimalno potrebno: tri obavezne vrijednosti
`FirebaseOptions` (projectId, applicationId u formatu `1:<broj>:android:<hex>`, apiKey proizvoljan za emulator) i `buildFeatures.buildConfig = true`.
Nijedna od tih vrijednosti nije tajna (demo projekat, emulator ne provjerava ključ).

(b) **Auth emulator token → Backend `verifyIdToken` (emulator mod) — POTVRĐENO.** Emulatori + Backend (`node src/pokreni.js`, port 3998,
privremeni POS ključ). Token dobijen istim REST pozivom koji šalje Android SDK (`identitytoolkit…/accounts:signUp?key=demo-api-key`):
`aud=demo-fuelpoints`, `iss=https://securetoken.google.com/demo-fuelpoints`, `alg=none`. Rezultati: API-06 prije init-a → `409 ACCOUNT_NOT_INITIALIZED`;
init → `201 {"displayName":"Ana","accountStatus":"ACTIVE","acceptedTermsVersion":"1.0","availablePoints":0,"reservedPoints":0}`; ponovljeni
init sa drugim imenom → `200` sa NEPROMIJENJENIM imenom; API-06 → `200 {"reconciledCount":0}`. Dodatno o emulatoru: pogrešna lozinka →
`INVALID_PASSWORD`, nepostojeći e-mail → `EMAIL_NOT_FOUND` (emulator nema Email Enumeration Protection, pa klijent MORA mapirati oba na istu
poruku); slaba lozinka `abcdef` je PRIHVAĆENA (policy „Require” tek u i11, O-2 — do tada je klijentska validacija §3.6 jedina kontrola);
reset za nepostojeći e-mail → `EMAIL_NOT_FOUND` (klijent mora prikazati neutralnu poruku). Izmjena Backend-a nije potrebna.

(c) **Zavisnosti i toolchain (i01/P-8: posljednja stabilna starija od 14 dana, granica 2026-10-05).**
1. Prvi pokušaj sa najnovijim stabilnim (Firebase BoM 34.19.0, navigation-compose 2.10.2, lifecycle 2.11.0, OkHttp 5.5.0): **`checkDebugAarMetadata`
   FAILED** — 14 problema: traže compileSdk ≥ 37 i AGP ≥ 9.1.0 (navigation 2.10.x, lifecycle 2.11.x, navigationevent 1.1.2, core 1.18.0,
   activity 1.13.0, okhttp-android 5.5.0).
2. AndroidX linija kompatibilna sa compileSdk 35 / AGP 8.10.1 (navigation 2.9.8, lifecycle 2.9.4) + OkHttp 4.12.0: **`compileDebugKotlin` FAILED** —
   `firebase-auth-24.2.0-api.jar … binary version of its metadata is 2.3.0, expected version is 2.0.0` (Firebase BoM 34.19.0 je kompajliran
   Kotlin-om 2.3; Kotlin 2.0.21 ga ne može čitati).
3. Kotlin 2.3.21 (posljednja stabilna, 2026-04-22) + `kotlin { compilerOptions { jvmTarget = JVM_11 } }` umjesto `kotlinOptions` (u Kotlin-u 2.3
   greška) + coroutines 1.11.0 + serialization 1.11.0 + OkHttp 5.3.2: **BUILD SUCCESSFUL**, `ProbaTest` 2/2 PASS, debug APK 17,8 MB.
   Trajanje `assembleDebug testDebugUnitTest`: 120 s (hladno, sa preuzimanjem zavisnosti); topli run nije mjeren.
4. OkHttp: `okhttp-android` 5.4.0 ima `minCompileSdk=36` (AAR metadata), 5.3.2 `minCompileSdk=1` → 5.3.2 je najviša kompatibilna.
Zaključak: i01/P-8 se ne može ispuniti doslovno bez nadogradnje AGP/compileSdk → **i09/P-1**.

(d) **ZXing core u JVM unit testu — POTVRĐENO.** `QRCodeWriter().encode(uid, QR_CODE, 256, 256, {MARGIN: 1})` → `BitMatrix` → `IntArray` piksela
→ `RGBLuminanceSource` → `HybridBinarizer` → `QRCodeReader().decode(...).text == uid` (PASS). Isti test: OkHttp `MockWebServer` — POST sa
`ByteArray(0).toRequestBody(null)` šalje `Content-Length: 0` bez `Content-Type` (O-21, ODLUKE (s)); kotlinx.serialization tijelo init-a je tačno
`{"displayName":"Ana","acceptedTermsVersion":"1.0"}` sa `Content-Type: application/json; charset=utf-8` (PASS).

## 4. Raspored fajlova

Sve u `android-app/` osim gdje je navedeno. Paket `io.github.anaspasojevic.fuelpoints` (i01/P-5) = `…/`.

| Fajl / folder | Sadržaj |
|---|---|
| `gradle/libs.versions.toml`, `build.gradle.kts`, `app/build.gradle.kts` | zavisnosti (sekcija 5.10), Kotlin 2.3.21, plugin `kotlin.plugin.serialization`, `compilerOptions`, `buildConfig = true`, BuildConfig polja (5.1) |
| `app/src/main/AndroidManifest.xml` | `INTERNET` (jedina dozvola); `android:name=".FuelPointsAplikacija"`; bez cleartext-a i bez `networkSecurityConfig` |
| `app/src/debug/AndroidManifest.xml`, `app/src/debug/res/xml/network_security_config.xml` | samo debug: cleartext dozvoljen samo za domen `10.0.2.2` (O-40) |
| `…/FuelPointsAplikacija.kt` | `Application`: inicijalizacija Firebase-a iz BuildConfig (5.1) i ručni kontejner zavisnosti `Zavisnosti` (bez DI biblioteke) |
| `…/GlavnaAktivnost.kt` | jedina aktivnost: tema + `NavigacijaAplikacije` |
| `…/podaci/autentikacija/` | `IzvorAutentikacije` (interfejs), `FirebaseIzvorAutentikacije` (mapiranje Firebase izuzetaka → `IshodAutentikacije`) |
| `…/podaci/nalog/` | `IzvorNaloga` (interfejs: čitanje i posmatranje `users/{uid}`, posmatranje `loyaltyAccounts/{uid}` sa `izKesa`), `FirestoreIzvorNaloga` |
| `…/podaci/api/` | `BackendApi` (interfejs), `OkHttpBackendApi`, modeli `@Serializable` (`TijeloInita`, `OdgovorInita`, `OdgovorUskladjivanja`, `TijeloGreske`), `RezultatApi` |
| `…/domen/` | `ValidacijaLozinke.kt`, `ValidacijaImena.kt`, `PorukeGresaka.kt`, `GeneratorQr.kt` (čist Kotlin → `BitMatrix`), `ProvjeraNaloga.kt` (AUTH-06 / AUTH-03 odluka) |
| `…/ui/tema/` | `Boje.kt`, `Tipografija.kt`, `TemaFuelPoints.kt` (svijetla i tamna, 5.9) |
| `…/ui/komponente/` | `LcdPanel`, `SegmentniBroj`, `ZutoDugme`, `PoljeZaUnos`, `OznakaBezMreze` |
| `…/ui/pokretanje/` | `EkranPokretanja`, `PokretanjeViewModel` (AUTH-06, AUTH-03), `EkranDovrsetkaRegistracije`, `EkranBrisanjaUToku` |
| `…/ui/prijava/` | `EkranPrijave`, `PrijavaViewModel` (UI-01, §3.5, AUTH-09) |
| `…/ui/registracija/` | `EkranRegistracije`, `RegistracijaViewModel` (UI-02, AUTH-01), `EkranUslova` (tekst uslova 1.0) |
| `…/ui/pocetna/` | `EkranPocetne`, `PocetnaViewModel` (UI-03, O-43, NFR-08) |
| `…/ui/qr/` | `EkranQr`, `QrViewModel` (UI-04, QR-01 … QR-05) |
| `…/ui/navigacija/NavigacijaAplikacije.kt` | rute i prelazi (5.2) |
| `app/src/main/res/values/strings.xml`, `values-night/` (ako treba) | svi tekstovi i poruke (srpski, latinica, ijekavica); tekst uslova 1.0 (O-44) |
| `app/src/main/res/font/` | Figtree, Big Shoulders Display, DSEG7 Classic Bold (i09/P-5) |
| `app/src/main/res/drawable/` | vektorske ikone (Material Symbols, Apache 2.0): oko / precrtano oko, QR, mreža isključena, strelica nazad (i09/P-5) |
| `android-app/licence/` | tekstovi licenci fontova (OFL 1.1) i ikona (Apache 2.0) |
| `app/src/test/java/…/` | I09-T01 … I09-T12 (sekcija 8) + `lazni/` (lažni izvori za testove) |
| `app/src/main/res/values/themes.xml`, `colors.xml` | uklanjanje šablonskih boja; tema prozora usklađena sa pozadinom |
| `skripte/pokreniLokalno.ps1` | NOV: emulatori + seed + Backend sa lokalnim `.env` (5.11) |
| `docs/smoke/i09_smoke.md`, `docs/smoke/*.png` | NOV: protokol smoke-a i screenshot-i (Login, Home, QR) |
| `README.md`, `docs/*` | pokretanje aplikacije lokalno; TRACEABILITY, ODLUKE, IMPLEMENTATION_LOG, TEST_REPORT |

Bez izmjene: `backend/`, `firebase/`, `firebase.json`, `docs/srs/`, `skripte/provjera.ps1` (Android korak već postoji).

## 5. Detaljan dizajn

### 5.1 Konfiguracija (O-39, O-40)

- `defaultConfig`: `buildConfigField` `FIREBASE_PROJECT_ID = "demo-fuelpoints"`, `FIREBASE_APPLICATION_ID = "1:000000000000:android:0000000000000000"`,
  `FIREBASE_API_KEY = "demo-api-key"` (nisu tajne; komentar to kaže), `VERZIJA_USLOVA = "1.0"` (O-11).
- `debug`: `KORISTI_EMULATOR = true`, `EMULATOR_HOST = "10.0.2.2"`, `PORT_AUTH = 9099`, `PORT_FIRESTORE = 8080` (iz `firebase.json`),
  `BACKEND_BAZNI_URL = "http://10.0.2.2:3000/api/v1/"` (port iz `.env.example`).
- `release`: `KORISTI_EMULATOR = false`, `BACKEND_BAZNI_URL = ""`; release se u i09 ne gradi i ne koristi — vrijednosti za pravi projekat
  dolaze u i11 iz lokalnog fajla van repoa (O-2, O-39). Aplikacija sa praznim URL-om ne poziva mrežu (fail closed, poruka greške).
- `FuelPointsAplikacija.onCreate`: `FirebaseApp.initializeApp(this, options)` (podrazumijevana instanca), pa — samo ako `KORISTI_EMULATOR` —
  `useEmulator` za Auth i Firestore PRIJE prve upotrebe. Firestore podrazumijevana perzistencija ostaje uključena (potrebna za NFR-08 i AUTH-06 offline).
- Debug `network_security_config`: `<domain-config cleartextTrafficPermitted="true"><domain includeSubdomains="false">10.0.2.2</domain></domain-config>`,
  `base-config` bez cleartext-a. Main manifest nema `usesCleartextTraffic` ni `networkSecurityConfig`.

### 5.2 Navigacija i ekrani

Rute (`NavHost`, start `pokretanje`): `pokretanje` → {`prijava`, `pocetna`, `dovrsetakRegistracije`, `brisanjeUToku`}; `prijava` ↔ `registracija`;
`registracija` → `uslovi` (čitanje teksta, nazad); `pocetna` → `mojQr` (nazad). Prelazi u `pocetna`, `prijava` i `brisanjeUToku` brišu back stack
(`popUpTo(0)`), da „nazad” ne vodi na Login poslije prijave ni na Home poslije gubitka sesije.
Dodatno: `AuthStateListener` (kroz `IzvorAutentikacije.posmatrajSesiju()`) — kad sesija nestane dok je otvoren `pocetna` / `mojQr`, navigacija ide na `prijava` (QR-03).

### 5.3 Login (UI-01, §3.5) i Forgotten password (AUTH-09)

- „Prijavi se”: ako je e-mail ili lozinka prazna → bez Firebase poziva, poruka §3.5 (prazna polja su ishod prijave). Inače `signInWithEmailAndPassword`.
- `FirebaseIzvorAutentikacije` mapira: `FirebaseNetworkException` → `MreznaGreska`; SVE ostalo (`FirebaseAuthInvalidCredentialsException`,
  `FirebaseAuthInvalidUserException`, `FirebaseTooManyRequestsException`, `IllegalArgumentException`, nepoznat izuzetak) → `NeispravniPodaci`.
- Poruke: `NeispravniPodaci` → TAČNO „E-mail adresa ili lozinka nisu ispravni.”; `MreznaGreska` → „Nema veze sa mrežom. Provjerite internet i pokušajte ponovo.”
- Uspjeh → `ProvjeraNaloga` (5.4), isto kao obnova sesije.
- „Zaboravljena lozinka” koristi e-mail iz polja: prazan → „Unesite e-mail adresu, pa ponovo dodirnite Zaboravljena lozinka.”; inače
  `sendPasswordResetEmail`; uspjeh i SVAKA ne-mrežna greška (uključujući `EMAIL_NOT_FOUND`, neispravan format) → ista poruka „Ako postoji
  nalog sa ovom e-mail adresom, poslali smo uputstvo za promjenu lozinke.”; mrežna greška → mrežna poruka. Nema posebnog ekrana.
- Polje lozinke: maskirano, ikona „prikaži / sakrij lozinku” (48 dp, `contentDescription`).

### 5.4 Provjera naloga: AUTH-06, AUTH-03, AUTH-05 (O-42, O-43, (v))

`ProvjeraNaloga.odredi(uid)` (domen, testabilno lažnim izvorima) — poziva se na `pokretanje` (postojeća sesija), poslije prijave i poslije
registracije kad init vrati grešku:
1. Nema Auth sesije → `Prijava`.
2. `IzvorNaloga.procitajKorisnika(uid)` (Firestore `get()`, podrazumijevani izvor: server, offline → keš):
   - `ACTIVE` → `Pocetna` (AUTH-06; i iz keša — Home tada pokazuje marker).
   - `DELETION_IN_PROGRESS` → `BrisanjeUToku` (AUTH-05); init se NE poziva ((v)).
   - ne postoji, odgovor sa servera → AUTH-03 (korak 3).
   - ne postoji / greška, a odgovor nije sa servera (offline bez keša) → `BezMreze` (poruka + „Pokušaj ponovo”).
   - `accountStatus` van enum-a → `Greska` (opšta poruka, bez stack-a).
3. AUTH-03 (i09/P-3, preporuka A): `displayName` iz Auth profila (`currentUser.displayName`, postavljen pri registraciji).
   Ako je ispravan po `ValidacijaImena` → `init(displayName, "1.0")`; ako nedostaje ili nije ispravan → `DovrsetakRegistracije`
   (forma: ime za prikaz + prihvatanje uslova → init).
4. Ishod init-a: `200`/`201` → `Pocetna`; `409 ACCOUNT_DELETION_IN_PROGRESS` → `BrisanjeUToku`; `422 INVALID_DISPLAY_NAME` → `DovrsetakRegistracije`;
   `503` → jedan ponovni pokušaj poslije 1 s (R-04), pa greška; mrežna greška / ostalo → `Greska` sa porukom po §27 kodu i „Pokušaj ponovo”.
`BrisanjeUToku`: poruka „Vaš nalog se briše. Funkcije aplikacije nisu dostupne.” — bez dugmadi (logout je i10; O-41 zabranjuje mrtva dugmad).

### 5.5 Registracija (UI-02, AUTH-01, AUTH-10)

Redoslijed: lokalna validacija (sve greške odjednom, ispod polja) → `createUserWithEmailAndPassword` → `updateProfile(displayName)` →
`init(displayName, "1.0")` (token u API klijentu) → ishod kao 5.4 korak 4.
- Validacija: ime 1–100 UTF-16 jedinica i ispravan UTF-16 (i02/P-3; bez trim-a, isto kao Backend `jeIspravnoIme`); e-mail neprazan;
  lozinka §3.6 (i09/P-2); ponovljena lozinka jednaka; uslovi prihvaćeni (checkbox + link „uslove korišćenja” → `uslovi`).
- Poruke validacije: „Unesite ime za prikaz (najviše 100 znakova).”, „Unesite e-mail adresu.”, „Lozinka mora imati najmanje 8 znakova,
  bar jedno veliko slovo i bar jednu cifru.”, „Lozinke se ne poklapaju.”, „Potrebno je prihvatiti uslove korišćenja.”
- Prikaz pravila lozinke kao u prototipu (tri LCD trake „8+ znakova”, „veliko slovo”, „cifra” koje se pale dok korisnik kuca).
- Greške Firebase-a: `FirebaseAuthUserCollisionException` → i09/P-4; `FirebaseAuthWeakPasswordException` → poruka §3.6; neispravan e-mail →
  „E-mail adresa nije ispravna.”; mreža → mrežna poruka.
- Pad poslije kreiranja Auth naloga (updateProfile ili init): korisnik je prijavljen; „Pokušaj ponovo” ponavlja SAMO preostale korake
  (nikad ponovo `createUser`); ako aplikacija bude ugašena, sljedeće pokretanje ide AUTH-03 putem (5.4).

### 5.6 Backend API klijent (O-45: OkHttp + kotlinx.serialization)

- Izbor: **OkHttp 5.3.2 + kotlinx.serialization-json** (ne Retrofit): dva endpointa, potpuna kontrola nad tijelom (`Content-Length: 0` bez
  `Content-Type` za API-06), bez dodatnog converter paketa; MockWebServer je iz iste porodice.
- `OkHttpBackendApi(baznaAdresa, dobaviToken: suspend () -> String, pauza: suspend (Long) -> Unit = ::delay)`; token se uzima prije SVAKOG poziva
  (`getIdToken(false)` — SDK sam osvježava token pred istek), zaglavlje `Authorization: Bearer <token>`; UID se nigdje ne šalje.
- `inicijalizujNalog(displayName, acceptedTermsVersion)` → `POST account/init`, tijelo tačno `{"displayName","acceptedTermsVersion"}`, `application/json`.
- `uskladiVaucere()` → `POST account/vouchers/reconcile`, `ByteArray(0).toRequestBody(null)` (O-43, ODLUKE (s)).
- Rezultat: `RezultatApi.Uspjeh(tijelo)` | `RezultatApi.GreskaBackenda(kod: String?, status: Int)` | `RezultatApi.MreznaGreska`.
  §27 tijelo se parsira (`ignoreUnknownKeys = true`); neparsabilno tijelo → `kod = null` (nikad sirov odgovor prema UI-ju); `message` i
  `correlationId` se ne prikazuju.
- 503 → jedan ponovni pokušaj poslije pauze od 1 000 ms (R-04, O-43) — za oba endpointa (oba su idempotentna); drugi 503 → `GreskaBackenda(SERVICE_UNAVAILABLE)`.
- Rok: `callTimeout` 15 s (Backend rok je 10 s); istek → `MreznaGreska`. Nema logging interceptor-a; izuzeci se ne loguju.

### 5.7 Home (UI-03, O-41, O-43, NFR-08)

- `PocetnaViewModel` posmatra `users/{uid}` (ime, `accountStatus`) i `loyaltyAccounts/{uid}` sa `MetadataChanges.INCLUDE`.
- Prikaz: „Zdravo, {displayName}”; LCD panel sa `availablePoints` (sedmosegmentni broj, „dostupnih bodova”); ploča „Rezervisano {n}” samo kad
  `reservedPoints > 0`; marker kad `izKesa == true`: traka „Nema mreže. Prikazano posljednje poznato stanje.” sa ikonom (tamna verzija kao
  `9_pocetna_tamna_offline.png`); veliko žuto dugme „Moj QR kod” (jedini ulaz, O-41). Nema bottom navigacije, zvona, „Posljednja točenja”, gauge-a sa nagradama.
- O-43: `LifecycleEventEffect(ON_START)` → `viewModel.priOtvaranju()` → API-06. Greška API-06 se ne prikazuje i ne blokira stanje;
  `409 ACCOUNT_NOT_INITIALIZED` → navigacija na `pokretanje` (AUTH-03 tok); `409 ACCOUNT_DELETION_IN_PROGRESS` → `brisanjeUToku`.
  Snapshot `users` sa `DELETION_IN_PROGRESS` → `brisanjeUToku`; `loyaltyAccounts` ne postoji (sa servera) → `pokretanje`.
- Vrijednosti koje nisu nenegativni cijeli brojevi → „Stanje bodova trenutno nije dostupno.” (ne računa se ništa lokalno; bodovi se nikad
  ne izvode iz odgovora API-ja).
- Ažuriranje bez ručnog osvježavanja: snapshot listener (kupovina preko POS-a → novi snapshot → 42).

### 5.8 QR (UI-04, QR-01 … QR-06, §2.6, AC-04)

- `GeneratorQr.napravi(sadrzaj): BitMatrix` — `QRCodeWriter`, `ErrorCorrectionLevel.M`, `MARGIN = 1`, `CHARACTER_SET = "UTF-8"`; sadržaj je
  TAČNO UID (bez prefiksa, JSON-a ili drugih podataka — AC-04, QR-06). Pretvaranje u `ImageBitmap` je tanki Compose sloj.
- `QrViewModel`: `uid = izvorAutentikacije.trenutniUid()`; `null` → stanje `BezSesije` → navigacija na `prijava` (QR-03, QR-04: nema guest QR-a).
- Ekran po `4_moj_qr.png`: naslov „Pokažite na kasi”, uputstvo „Kasir skenira kod i bodovi za gorivo stižu na vaš nalog.”, žuti okvir sa
  uglovima, „Vaš identifikator” + UID tekstom (monospace, `selectable` nije potreban), napomena „Ovim kodom se samo sakupljaju bodovi.”
  (bez rečenice o nagradama — Rewards ekran je i10). Bez dugmeta za kopiranje (2. Van opsega). Svjetlina ekrana se ne mijenja.

### 5.9 Dizajn (CLAUDE.md, `docs/dizajn`)

Preuzima se: tokeni boja iz `prototip.html` (svijetla: `poz #E9EDEB`, `kart #FFFFFF`, `ink #13262B`, `sek #56676C`, `linija #D5DCD9`,
`zuta #FFC22E`, `zuta-meko #FFF3D1`, `panel #15272C`, `panel2 #1E353B`, `lcd #FFCB45`, `crvena #D7402B`, `zelena #2F8F5B`; tamna: `poz #0E181B`,
`kart #172529`, `ink #E6ECEA`, `sek #97A6A9`, `linija #26383D`, `zuta-meko #3A3016`, `panel #0A1316`, `panel2 #15262B`) mapirani u Material3
`ColorScheme` + `CompositionLocal` za LCD boje; tema prati sistemski režim. Tipografija: naslovi Big Shoulders Display (700/800), tekst Figtree,
brojevi DSEG7 Classic Bold sa „duh” ciframa `8` u pozadini (displej pumpe). Komponente: LCD panel („ekranić”), žuto dugme pune širine
(visina 56 dp), polja sa ikonom i okvirom, crvena poruka greške sa ikonom, LCD trake pravila lozinke.
Login hero: LCD panel „FuelPoints” sa ugašenim („duh”) ciframa `88.88` / `88`, bez izmišljenih vrijednosti; naslov „Svaki litar se broji.”
Ne preuzima se u i09 (O-41 / i10): bottom navigacija, zvono, gauge sa pragovima nagrada, kartica „Imate dovoljno za…”, „Posljednja točenja”,
ekrani 5–8. NFR-10: svi klikabilni elementi `Modifier.minimumInteractiveComponentSize()` / ≥ 48 dp; ikone bez teksta imaju `contentDescription`,
dekorativne `null`.

### 5.10 Zavisnosti (O-45, i09/P-1)

| Biblioteka | Verzija | Napomena |
|---|---|---|
| Kotlin (android, compose, serialization plugin) | 2.3.21 (bilo 2.0.21) | nužno za Firebase BoM 34.19.0 (metadata 2.3) |
| Firebase BoM → `firebase-auth`, `firebase-firestore` | 34.19.0 | posljednja starija od 14 dana (35.0.0 je od 2026-10-07) |
| `androidx.navigation:navigation-compose` | 2.9.8 | 2.10.x traži compileSdk 37 / AGP 9.1 |
| `androidx.lifecycle:lifecycle-viewmodel-compose` (+ `lifecycleRuntimeKtx` usklađen) | 2.9.4 | 2.11.x traži compileSdk 37 / AGP 9.1 |
| `kotlinx-coroutines-play-services` | 1.11.0 | `Task.await()` |
| `kotlinx-serialization-json` | 1.11.0 | 1.12.0 je od 2026-10-19 |
| `com.squareup.okhttp3:okhttp` | 5.3.2 | 5.4.0+ traži compileSdk 36 |
| `com.google.zxing:core` | 3.5.4 | samo generisanje |
| test: `kotlinx-coroutines-test` 1.11.0, `okhttp3:mockwebserver` 5.3.2 | | JUnit 4.13.2 već postoji |

Ostaju nepromijenjeni: AGP 8.10.1, Gradle 8.11.1, compileSdk/targetSdk 35, minSdk 26, Compose BOM 2024.09.00, core-ktx 1.16.0, activity-compose 1.10.1.
Builder mora pri dodavanju potvrditi da Gradle ne podiže tranzitivno androidx artefakte iznad compileSdk 35 (`checkDebugAarMetadata` zelen).

### 5.11 Lokalni smoke (O-31 (d)) — `skripte/pokreniLokalno.ps1`

Iz korijena; traži `.env` (inače poruka „Kopirajte .env.example u .env i upišite POS ključ (README).”, exit 1) i slobodne portove 8080, 9099 i
`PORT` iz `.env`; JDK iz Android Studio-a prvi na PATH-u (kao `provjera.ps1`). Pokreće: (1) `npx firebase emulators:start … --only firestore,auth`
(proces u pozadini, čeka port 9099 i 8080, rok 60 s); (2) `npm run seed:emu`; (3) `npm start` (Backend sa `../.env`). Ispisuje adrese
(`10.0.2.2` za emulator), nikad vrijednosti iz `.env`. Ctrl+C (`try/finally`) gasi Backend i emulatore (uključujući Java proces na 8080).
Protokol `docs/smoke/i09_smoke.md`: koraci + očekivano + PASS/FAIL kolona; PowerShell blok za kupovinu 42 730 ml koji čita POS ključ iz `.env`
u promjenljivu bez ispisa (`Invoke-RestMethod … -Headers @{ 'X-POS-API-Key' = $kljuc }`, UID se prepisuje sa QR ekrana).

Koraci protokola (emulator API 35, debug APK):
S1 prvo pokretanje → Login (UI-01 elementi). S2 registracija sa „Lozinka” (bez cifre) → poruka §3.6, bez naloga; „Ana” / ana@primjer.ba / „Lozinka1”
→ Home „Zdravo, Ana”, 0 bodova, bez „Rezervisano”. S3 QR: kod + isti UID kao tekst. S4 POS kupovina 42 730 ml → Home 42 bez osvježavanja (AC-03 vidljivo).
S5 ugasiti/pokrenuti aplikaciju → Home bez prijave (AUTH-06). S6 airplane mode → marker „Nema mreže…” u roku od ~10 s, bodovi ostaju; mreža →
marker nestaje. S7 obrisati podatke aplikacije → Login: pogrešna lozinka i nepostojeći e-mail → ista poruka §3.5; tačna prijava → Home.
S8 „Zaboravljena lozinka” za postojeći i nepostojeći e-mail → ista poruka. S9 AUTH-03: nalog kreiran samo u Auth emulatoru (REST signUp sa
`displayName`) → prijava → Home sa tim imenom (init urađen). S10 tamni režim sistema → tamna tema. S11 NFR-10 inspekcija (Layout Inspector:
dugmad i ikone ≥ 48 dp, `contentDescription`). S12 screenshot-i Login, Home, QR → `docs/smoke/`. S13 Logcat filtriran po paketu: nema tokena, UID-a ni e-maila.

## 6. Ugovor sa Backend-om (bez izmjene; README)

API-01: `POST /api/v1/account/init`, `Authorization: Bearer`, tijelo tačno `{ displayName, acceptedTermsVersion }`; `201`/`200`
`{ displayName, accountStatus, acceptedTermsVersion, availablePoints, reservedPoints }` (i02/P-1); greške `401`, `409 ACCOUNT_DELETION_IN_PROGRESS`,
`422 INVALID_DISPLAY_NAME`, `422 INVALID_REQUEST`, `500`, `503`. API-06: `POST /api/v1/account/vouchers/reconcile` bez tijela → `200 { reconciledCount }`
(i05/P-1; vrijednost se ne koristi); greške `401`, `409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`, `422`, `500`, `503`.

Poruke po §27 kodu (`PorukeGresaka`, prikazuju se samo kad tok traži poruku):
`UNAUTHENTICATED` → „Sesija je istekla. Prijavite se ponovo.”; `ACCOUNT_NOT_INITIALIZED` → (tok AUTH-03, bez poruke);
`ACCOUNT_DELETION_IN_PROGRESS` → poruka 5.4; `INVALID_DISPLAY_NAME` → „Ime za prikaz nije ispravno (1–100 znakova).”;
`SERVICE_UNAVAILABLE` → „Servis trenutno nije dostupan. Pokušajte ponovo.”; `INTERNAL_ERROR`, `INVALID_REQUEST`, `NOT_FOUND`, nepoznat ili
`null` kod → „Došlo je do greške. Pokušajte ponovo.”; mreža → mrežna poruka (5.3). Ostali §27 kodovi (Rewards, POS) dolaze u i10 sa svojim tokovima.

## 7. Koraci implementacije (jedan korak = jedan commit + push; testovi prije koda; O-30 (a): `provjera.ps1` tačno 2×)

Gradle iz `android-app` sa `$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'`.

| K | Sadržaj | Commit |
|---|---|---|
| K1 | Toolchain i zavisnosti (5.10), `compilerOptions`, BuildConfig (5.1), manifest + debug NSC, `FuelPointsAplikacija`, fontovi/ikone + licence, tema (5.9); I09-T12 (statički); `assembleDebug testDebugUnitTest` zeleni. | `i09: zavisnosti, Firebase konfiguracija bez google-services i tema (O-39, O-40, O-45)` |
| K2 | I09-T01, T02, T06 (generator) prije koda → crveni; `ValidacijaLozinke`, `ValidacijaImena`, `GeneratorQr`, `PorukeGresaka`; zeleni. | `i09: validacija §3.6, displayName i generator QR-a (I09-T01, T02, T06)` |
| K3 | I09-T07 prije koda; `OkHttpBackendApi` + modeli; `FirebaseIzvorAutentikacije`, `FirestoreIzvorNaloga`. | `i09: API klijent i izvori podataka (API-01, API-06, §27, I09-T07)` |
| K4 | I09-T03, T04, T05, T08, T09, T10, T11 + QR dio T06 prije koda; `ProvjeraNaloga` i ViewModel-i. | `i09: tokovi AUTH-01/03/06/09, Home i QR u ViewModel-ima (I09-T03 … T11)` |
| K5 | Ekrani, komponente, navigacija (5.2 – 5.9), tekst uslova (O-44); ručna provjera na emulatoru; **`provjera.ps1` #1**. | `i09: ekrani Prijava, Registracija, Home i Moj QR (UI-01 … UI-04)` |
| K6 | `skripte/pokreniLokalno.ps1`, `docs/smoke/i09_smoke.md`, README (pokretanje aplikacije lokalno); **`provjera.ps1` #2 (završni)** na commit-u koda X; Builder traži od Ane smoke S1 … S13 i screenshot-e. | `i09: skripta za lokalni smoke i protokol (O-31 (d))` |
| K7 | Screenshot-i u `docs/smoke/`; TEST_REPORT (testovi po ID-u, oba `provjera.ps1`, commit X, smoke rezultat Ane), TRACEABILITY, ODLUKE (§1 i08 ACCEPTED tag `i08` merge `2e98999`, i09 status; O-39 … O-45; i09/P-n), IMPLEMENTATION_LOG. PR → `main` bez merge-a. | `i09: TEST_REPORT, smoke, sljedivost i registar odluka` |

Ako Ana prijavi FAIL u smoke-u: ispravka u novom commit-u koda, ponovljen `provjera.ps1` se računa kao #2 (završni) samo ako je prvi #2
poništen izmjenom koda — Builder to bilježi kao OD-n (O-30 (a) „tačno 2×” ostaje cilj).

## 8. Testovi (JVM, `testDebugUnitTest`; ulaze u `provjera.ps1`)

Konvencije: JUnit 4, `runTest` + `StandardTestDispatcher` i `Dispatchers.setMain` za ViewModel-e; lažni izvori u `src/test/…/lazni/`
(`LazniIzvorAutentikacije`, `LazniIzvorNaloga`, `LazniBackendApi`) broje pozive i čuvaju argumente. Naziv svake test klase / metode počinje ID-em.

| ID | SRS / odluka | Asercije |
|---|---|---|
| I09-T01 | §3.6, i09/P-2 | `Lozinka1` ✓; `Lozink1` (7) ✗; `Lozinka1` (8) ✓; `lozinka1` (bez velikog) ✗; `Lozinkaa` (bez cifre) ✗; `čokoladA1` ✓; `Čokolada1` ✗ (Č nije A–Z, P-2 A); `Lozinka١` (arapsko-indijska cifra) ✗; `Lozi😀n1` (7 kodnih tačaka = 8 UTF-16 jedinica) ✓; prazna ✗. |
| I09-T02 | UI-02, i02/P-3 | `""` ✗; 1 ✓; 100 ✓; 101 ✗; 50 × emoji (100 UTF-16) ✓, 51 ✗; usamljeni surogat ✗; `"  "` ✓ (bez trim-a, kao Backend). |
| I09-T03 | UI-02, AUTH-10 | Registracija: lozinke se ne poklapaju / uslovi neprihvaćeni / neispravna lozinka / ime 101 → poruke 5.5 i 0 poziva `createUser` i init. Forma nema polja za telefon i datum rođenja (model stanja ima tačno 5 ulaza). |
| I09-T04 | UI-01, §3.5 | Za svaki ishod: neispravna lozinka, nepostojeći korisnik, onemogućen korisnik, previše pokušaja, neispravan e-mail, nepoznata greška, prazno polje (0 poziva) → poruka `==` „E-mail adresa ili lozinka nisu ispravni.”; mrežna → mrežna poruka (≠ §3.5). |
| I09-T05 | AUTH-09 | Reset: uspjeh, `EMAIL_NOT_FOUND`, neispravan e-mail, nepoznata → identična neutralna poruka; mrežna → mrežna; prazno polje → 0 poziva. |
| I09-T06 | QR-01 … QR-05, AC-04, §2.6 | (a) `GeneratorQr` + ZXing dekodiranje (`RGBLuminanceSource`) == UID za tipičan 28-znakovni UID, 1 znak i 128 znakova; (b) `QrViewModel` sa sesijom: sadržaj QR-a `==` UID i tekst `==` UID (bez prefiksa); (c) bez sesije → `BezSesije`, generator se ne poziva. |
| I09-T07 | API-01, API-06, §3.3, §27, O-21, O-43, R-04 | MockWebServer: init — `POST /api/v1/account/init`, `Authorization: Bearer <token iz lažnog izvora>`, `Content-Type: application/json`, tijelo parsirano = tačno ključevi `{displayName, acceptedTermsVersion}` sa vrijednostima, bez `uid`; `201` i `200` parsirani. API-06 — `POST …/account/vouchers/reconcile`, `Content-Length: 0`, bez `Content-Type`, prazno tijelo. §27 tijelo → `GreskaBackenda(kod, status)`; ne-JSON 502 → `kod = null`. `503` → tačno 2 zahtjeva i uspjeh ako drugi uspije; `503`,`503` → tačno 2 zahtjeva i `SERVICE_UNAVAILABLE`; `500` → 1 zahtjev. Pauza 1 000 ms (virtuelno vrijeme). Ugašen server → `MreznaGreska`. Token se traži po pozivu (2 poziva → 2 traženja). |
| I09-T08 | AUTH-06, AUTH-03, AUTH-05, (v), O-42 | `ProvjeraNaloga`: bez sesije → Prijava; ACTIVE → Pocetna i 0 poziva prijave/init-a; ACTIVE iz keša → Pocetna; nema `users` (server) + Auth ime „Ana” → init(„Ana”, „1.0”) → Pocetna; Auth ime `null` → DovrsetakRegistracije, 0 init-a; DELETION_IN_PROGRESS → BrisanjeUToku, 0 init-a; init 409 DELETION → BrisanjeUToku; init 422 INVALID_DISPLAY_NAME → DovrsetakRegistracije; offline bez keša → BezMreze; status van enum-a → Greska. |
| I09-T09 | UI-03, §18, O-43 | `PocetnaViewModel`: svaki `priOtvaranju()` → tačno jedan API-06 (dva otvaranja → 2); API-06 `500` / mreža → stanje bodova i dalje prikazano, bez poruke; `409 ACCOUNT_NOT_INITIALIZED` → događaj AUTH-03; `409 ACCOUNT_DELETION_IN_PROGRESS` → BrisanjeUToku; `reservedPoints` 0 → nije vidljivo, 30 → vidljivo; snapshot 0 → 42 mijenja prikaz bez novog poziva. |
| I09-T10 | NFR-08 | Snapshot `izKesa = true` → marker vidljiv; `false` → nije; prelaz true → false → true prati snapshot. |
| I09-T11 | AUTH-01 | Registracija: redoslijed `createUser` → `postaviIme` → init(ime, „1.0”); kolizija e-maila → poruka P-4, 0 init-a; init mreža → greška, „Pokušaj ponovo” zove samo init (createUser tačno 1×). |
| I09-T12 | NFR-07, O-40, O-45 | Statička provjera (čita fajlove modula): nema `android.util.Log`, `Log.`, `println`, `printStackTrace`, `HttpLoggingInterceptor` u `src/main`; main manifest: jedina `uses-permission` je `INTERNET`, nema `usesCleartextTraffic`/`networkSecurityConfig`; debug NSC dozvoljava cleartext samo za `10.0.2.2`; `google-services.json` ne postoji u `app/`; nema `CAMERA` dozvole (§2.6). |
| I09-T13 | NFR-10 | Inspekcija u smoke-u (S11) — Compose UI testovi su van opsega (instrumentacija). |

Regresija: backend i Rules suite kroz `provjera.ps1` (nepromijenjeni).

## 9. Ključne mutacije

Nema (O-31 (c): Android iteracije bez mutacija).

## 10. Definition of Done (komande iz korijena, PowerShell)

```
cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug testDebugUnitTest; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE                                   # 0, tačno 2× u sesiji
git diff i08 -- backend firebase firebase.json docs/srs skripte/provjera.ps1   # prazno
git ls-files | Select-String -Pattern 'google-services\.json|\.env$|service-?account'   # prazno
git grep -n -E 'android\.util\.Log|Log\.[dviwe]\(|println\(' -- android-app/app/src/main   # prazno
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash   # 7D866413…C60228
git log i08..HEAD --format=%B | Select-String -Pattern 'Co-Authored|Claude|Generated'   # prazno
```

[ ] I09-T01 … I09-T12 zeleni. [ ] Smoke S1 … S13 PASS (Ana, API 35) u TEST_REPORT. [ ] Screenshot-i Login, Home, QR u `docs/smoke/`.
[ ] Dokumentacija (K7). [ ] PR bez merge-a.

## 11. Rizici i poznata ograničenja

- Toolchain (i09/P-1): nadogradnja Kotlin-a 2.0.21 → 2.3.21 dira kostur i01; AGP 8.10.1 sa Kotlin-om 2.3 radi (proba), ali nije zvanično
  testirana kombinacija za svaku buduću biblioteku; i10 (bez novih zavisnosti) to ne mijenja. Firebase BoM 35.x i androidx 2.10+/2.11+ ostaju
  nedostupni dok se ne podigne AGP/compileSdk.
- Emulator nema password policy ni Email Enumeration Protection (proba (b)): slabu lozinku zaustavlja samo klijent; konačna kontrola dolazi u i11 (O-2).
- `isFromCache` marker se u Firestore SDK-u pali tek kad SDK zaključi da je offline (do ~10 s) — smoke S6 to dozvoljava.
- `BrisanjeUToku` nema akciju (logout je i10); korisnik u tom stanju može samo zatvoriti aplikaciju.
- Firebase SDK sam može pisati u Logcat (npr. upozorenje o emulatoru); I09-T12 pokriva samo kod aplikacije, S13 provjerava stvarni Logcat.
- QR-06: statični UID se može fotografisati — prihvaćen rizik; QR nosi samo UID (AC-04).
- Debug APK 17,8 MB (bez minifikacije); release/minifikacija je i11.

## 12. TRACEABILITY redovi (Builder popunjava „Status”)

| Red | Kod | Test |
|---|---|---|
| UI-01, §3.5 | `ui/prijava/*`, `podaci/autentikacija/*` | I09-T04, smoke S1, S7 |
| AUTH-09 | `ui/prijava/PrijavaViewModel.kt` | I09-T05, smoke S8 |
| UI-02, §3.6 (klijent), AUTH-10 | `ui/registracija/*`, `domen/ValidacijaLozinke.kt`, `ValidacijaImena.kt` | I09-T01, T02, T03, smoke S2 |
| AUTH-01 (Android dio) | `ui/registracija/RegistracijaViewModel.kt`, `podaci/api/*` | I09-T11, T07, smoke S2 |
| AUTH-03, O-42 | `domen/ProvjeraNaloga.kt`, `ui/pokretanje/*` | I09-T08, smoke S9 |
| AUTH-05 (Android prikaz), (v) | `domen/ProvjeraNaloga.kt`, `ui/pokretanje/EkranBrisanjaUToku.kt` | I09-T08, T09 |
| AUTH-06 | `domen/ProvjeraNaloga.kt` | I09-T08, smoke S5 |
| UI-03, §18 (Android poziv), O-41, O-43 | `ui/pocetna/*`, `podaci/api/*` | I09-T09, T07, smoke S2, S4 |
| NFR-08 | `ui/pocetna/PocetnaViewModel.kt`, `podaci/nalog/*` | I09-T10, smoke S6 |
| UI-04, QR-01 … QR-05, §2.6, AC-04 | `ui/qr/*`, `domen/GeneratorQr.kt` | I09-T06, smoke S3 |
| QR-06 | — (prihvaćen rizik) | — |
| §2.2, §25.2, §25.3 (Android samo čita) | `podaci/nalog/FirestoreIzvorNaloga.kt` | inspekcija (nema `set`/`update`/`delete` poziva), RULE-T02, T06 |
| §3.3, NFR-01 (klijent) | `podaci/api/OkHttpBackendApi.kt` | I09-T07 |
| §27 (klijent) | `podaci/api/*`, `domen/PorukeGresaka.kt` | I09-T07 |
| NFR-07 (Android) | manifest, `build.gradle.kts`, bez logovanja | I09-T12, smoke S13 |
| NFR-10 (dio) | `ui/*` | I09-T13 (smoke S11) |
| AC-01 (registracija, prijava, obnova sesije) | gore | smoke S2, S5, S7 |
| O-39, O-40, O-45 | `app/build.gradle.kts`, `FuelPointsAplikacija.kt`, `src/debug/*` | I09-T12, proba 3.2 |

## 13. Otvorena pitanja (`i09/P-n`)

SRS nije kontradiktoran u opsegu i09. Nejasnoće i izbori koji traže odluku:

**i09/P-1 — i01/P-8 se ne može ispuniti doslovno (proba 3.2 (c)).** Najnovije stabilne verzije traže AGP ≥ 9.1 i compileSdk ≥ 37;
Firebase BoM 34.19.0 traži Kotlin ≥ 2.2.
A) Kotlin 2.3.21 (posljednja stabilna) + `compilerOptions`; AGP 8.10.1 / compileSdk 35 ostaju; za androidx i OkHttp „posljednja stabilna
starija od 14 dana KOMPATIBILNA sa AGP 8.10.1 / compileSdk 35” (tabela 5.10). Provjereno probom (BUILD SUCCESSFUL).
B) Puna nadogradnja: AGP 9.1+, Gradle 9, compileSdk 37 (targetSdk ostaje 35), sve najnovije. Nije probano; mijenja i01 kostur znatno više,
traži SDK platformu 37 i nosi rizik za vrijeme iteracije.
C) Kotlin 2.0.21 ostaje, a Firebase BoM se spušta na posljednju verziju kompajliranu Kotlin-om ≤ 2.1 (starija linija, 2025.). Nije probano.
**Preporuka: A** — najmanja izmjena koja radi; pravilo i01/P-8 se dopunjuje riječima „kompatibilna sa toolchain-om iz i01”.

**i09/P-2 — tačno pravilo §3.6 („8 znakova, veliko slovo, cifra”).** §3.6 traži ISTO pravilo kao Firebase policy. Firebase policy (i
klijentski `validatePassword` Firebase SDK-a) broji dužinu u UTF-16 jedinicama, „veliko slovo” = `A`–`Z`, „cifra” = `0`–`9`.
A) Kao Firebase: dužina `String.length` ≥ 8, bar jedan `A`–`Z`, bar jedan `0`–`9` (`Čokolada1` se odbija).
B) Unicode: `Character.isUpperCase` / `isDigit` (`Čokolada1` se prihvata) — ali tada bi Firebase u i11 odbio lozinku koju je klijent prihvatio.
**Preporuka: A** (isto pravilo na obje strane, §3.6). Poruka validacije može dodati „(A–Z)”: „…bar jedno veliko slovo (A–Z) i bar jednu cifru.”

**i09/P-3 — odakle `displayName` za AUTH-03 ponovni init (O-42).**
A) Pri registraciji se `displayName` upisuje u Firebase Auth profil (`updateProfile`, prije init-a); AUTH-03 ga čita iz Auth profila i
ponovo poziva init sa `acceptedTermsVersion "1.0"`; ako ime nedostaje ili nije ispravno (pad između `createUser` i `updateProfile`, ili nalog
napravljen van aplikacije) → kratka forma „Dovršite registraciju” (ime + prihvatanje uslova). Obrazloženje: ime je u Auth profilu samo ako je
korisnik prošao formu registracije sa prihvaćenim uslovima, pa ponovni init sa „1.0” odražava stvarno prihvatanje (AUTH-10); radi i na drugom
uređaju i poslije reinstalacije; Auth profil nije loyalty stanje (§2.2 dozvoljava profilna polja), Backend ostaje nepromijenjen.
B) Uvijek forma „Dovršite registraciju” (korisnik ponovo unosi ime i prihvata uslove). Jednostavnije, ali AUTH-03 posle prekida mreže pri
registraciji traži ponovni unos.
C) Lokalno čuvanje (SharedPreferences) — gubi se reinstalacijom i ne radi na drugom uređaju.
**Preporuka: A sa B kao rezervom** (tačno kako je opisano u 5.4).

**i09/P-4 — poruka kad e-mail pri registraciji već postoji.** SRS §3.5 traži generičku poruku samo za login i Email Enumeration Protection
(koja ne pokriva kreiranje naloga). A) „Nalog sa ovom e-mail adresom već postoji. Prijavite se ili zatražite novu lozinku.” (jasno korisniku,
otkriva postojanje, kao i sam Firebase signUp). B) Neutralno: „Registracija nije uspjela. Ako već imate nalog, prijavite se ili zatražite novu lozinku.”
**Preporuka: B** — u duhu §3.5 / EEP, bez gubitka upotrebljivosti.

**i09/P-5 — fontovi i ikone kao resursi (O-45 „ništa drugo bez i09/P-n”).** Prototip koristi Figtree, Big Shoulders Display, DSEG7 Classic
(sve SIL OFL 1.1) i Material Symbols (Apache 2.0). Downloadable fonts traže paket `ui-text-google-fonts`, a `material-icons-extended` je
dodatna zavisnost. A) TTF fajlovi u `res/font` i potrebne ikone kao vektorski drawable-i u `res/drawable`, licence u `android-app/licence/` —
nijedna nova Gradle zavisnost. B) Sistemski font i samo ikone iz `material-icons-core` (bez oka za lozinku, QR i offline ikone) — odstupa od dizajna.
**Preporuka: A** (izgled „displeja pumpe” traži sedmosegmentni font; bez nove zavisnosti).

**i09/P-6 — tekst uslova korišćenja verzije „1.0” (O-44; Ana odobrava).** Prijedlog (resurs `uslovi_1_0`):
> **Uslovi korišćenja FuelPoints programa lojalnosti, verzija 1.0**
> 1. FuelPoints je program lojalnosti benzinske pumpe. Za svaki pun litar goriva dobijate jedan bod (42,73 l = 42 boda).
> 2. Bodove dodjeljuje isključivo sistem pumpe pri kupovini; aplikacija ih samo prikazuje. Bodovi nemaju novčanu vrijednost i ne mogu se prenijeti.
> 3. Bodovi se mogu zamijeniti za nagrade iz kataloga u aplikaciji. Voucher za nagradu važi 15 minuta; neiskorišćen ili otkazan voucher vraća bodove.
> 4. Vaš QR kod sadrži samo identifikator naloga i služi isključivo za sakupljanje bodova na kasi.
> 5. Čuvamo ime za prikaz, e-mail adresu i istoriju kupovina goriva radi vođenja naloga. Nalog možete obrisati u aplikaciji; kupovine i
>    istorija bodova tada ostaju samo bez veze sa vama.
> 6. Ovo je diplomski projekat (PMF Banja Luka) i ne predstavlja komercijalnu uslugu.
Napomena: tačke 3 i 5 opisuju ponašanje §13, §17, §23 koje aplikacija dobija u i10; ako Ana želi tekst samo o i09 funkcijama, izostaviti ih.

**i09/P-7 (informativno) — `release` build bez konfiguracije.** U i09 se gradi samo debug; `release` ima `KORISTI_EMULATOR = false` i prazan
`BACKEND_BAZNI_URL` (5.1) dok i11 ne doda lokalni fajl van repoa. Preporuka: prihvatiti (bez koda za i11 unaprijed, bez TODO-a).

**Procjena (Builder):** K1 1 h, K2 0,5 h, K3 1 h, K4 1,5 h, K5 2–2,5 h, K6 0,5 h + `provjera.ps1` 2× (~2 × 10 min), K7 0,5 h →
**~7–8 h** rada + smoke Ane ~30 min.

## 14. Odluke Orchestrator-a (odobrenje plana)

Plan i09 (commit ab79761) je ODOBREN. Datum: 2026-10-19.

i09/P-1 — A: Kotlin 2.3.21 (+ compilerOptions jvmTarget JVM_11); AGP 8.10.1, Gradle 8.11.1, compileSdk/targetSdk 35, minSdk 26 ostaju; verzije iz
          tabele 5.10. Pravilo i01/P-8 se dopunjuje: „posljednja stabilna verzija starija od 14 dana KOMPATIBILNA sa toolchain-om iz i01”
          (upisati u ODLUKE §4 kao i09/P-1).
i09/P-2 — A: §3.6 kao Firebase policy: String.length ≥ 8, bar jedan A–Z, bar jedan 0–9; poruka „…bar jedno veliko slovo (A–Z) i bar jednu cifru.”
i09/P-3 — A sa B kao rezervom: displayName se pri registraciji upisuje u Firebase Auth profil prije init-a; AUTH-03 ga čita za ponovni init sa
          acceptedTermsVersion "1.0"; ako nedostaje ili nije ispravan → forma „Dovršite registraciju” (ime + prihvatanje uslova).
i09/P-4 — B: neutralna poruka „Registracija nije uspjela. Ako već imate nalog, prijavite se ili zatražite novu lozinku.”
i09/P-5 — A: fontovi (SIL OFL 1.1) u res/font i potrebne ikone kao vektorski drawable-i, licence u android-app/licence/; nijedna nova Gradle zavisnost.
i09/P-6 — ODOBRILA ANA (2026-10-19): tekst uslova korišćenja verzije 1.0 tačno kako je predložen u planu (svih 6 tačaka), resurs uslovi_1_0.
i09/P-7 — prihvaćeno: release build bez konfiguracije do i11 (O-2); bez TODO-a.

ISPRAVKE PLANA
i09/K-1 — K2 i K3 plana se spajaju u jedan commit „i09: validacija, generator QR-a, API klijent i izvori podataka (I09-T01, T02, T06, T07)”.
i09/K-2 — smoke S1 … S13 izvršava Ana na emulatoru API 35 poslije K6; Builder čeka njen rezultat prije K7 (O-31 (d)).
