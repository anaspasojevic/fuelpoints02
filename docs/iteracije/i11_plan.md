# i11 — PLAN (PLANNER): POS Simulator, pravi Firebase projekat, Release, završna NFR provjera

Uloga: PLANNER (bez koda). Grana `iteracija-11` (iz `main` na tagu `i10`). Normativni izvor: SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.md`).
Pročitano: `docs/iteracije/i11_brief.md`, `docs/ODLUKE.md` (cijeli), `docs/TRACEABILITY.md`, `docs/TEST_REPORT.md` (smoke i09, i10, „Otvorene stavke za i11”),
SRS §2.5, §3.1, §3.4, §3.5, §3.6, §26, §29, §33, §34, NFR-01 … NFR-10, AC-12; kod: `pos-simulator/`, `backend/src/aplikacija.js`,
`rute/kupovine.js`, `rute/otkupVaucera.js`, `validacija/tijeloKupovine.js`, `firebase/*.json`, `android-app/app/build.gradle.kts`, `proguard-rules.pro`,
`EkraniProfila.kt` (`EkranPomoci`), `strings.xml`, `skripte/provjera.ps1`, `skripte/pokreniLokalno.ps1`, `.gitignore`, `.env.example`.

Status: **PLAN SPREMAN ZA ODOBRENJE** — čeka odgovore na P-1 … P-8 (sekcija 9). Nijedan SRS nejasan ni kontradiktoran; sve stavke su odluke o načinu izvedbe, ne o SRS-u.

---

## 1. Polazno stanje (činjenice iz repoa)

| Oblast | Stanje na `i10` |
|---|---|
| `pos-simulator/` | samo kostur: prazan `index.html` + `README.md` („forme dolaze u Iteraciji 11”) |
| Backend CORS | **ne postoji** (`aplikacija.js`: nema `cors`, nema odgovora na `OPTIONS`); POS rute traže zaglavlje `X-POS-API-Key` → preglednik šalje preflight → stranica u pregledniku **ne može** direktno zvati Backend (vidi P-1) |
| Backend ↔ pravi projekat | `inicijalizujFirebaseAdmin({ projectId })` bez kredencijala: za pravi projekat Admin SDK uzima `GOOGLE_APPLICATION_CREDENTIALS`; Backend odbija start ako je emulator varijabla postavljena a projekat nije `demo-*` (README) |
| Seed | `seed:emu` radi isključivo nad emulatorom (`zastitaEmulatora`, i01/P-7); za pravi projekat seed ne postoji |
| Android `release` | `isMinifyEnabled = false`, `KORISTI_EMULATOR=false`, prazni `BACKEND_BAZNI_URL`, `FIREBASE_*` = `demo-*` (isti `defaultConfig`), `proguard-rules.pro` je šablon bez pravila |
| Android cleartext | samo `src/debug` `network_security_config` za `10.0.2.2` (O-40); `main` manifest bez cleartext-a (I09-T12 to provjerava) |
| Composite indeksi | `firebase/firestore.indexes.json`: `purchases(uid↑, occurredAt↓)`, `notifications(uid↑, createdAt↓)`, `vouchers(uid↑, status↑, expiresAt↑)`; emulator ih ne provjerava |
| Pomoć i FAQ | `EkranPomoci`: jedan `Text` sa cijelim FAQ-om iz jednog stringa `pomoc_cesta_pitanja` (7 pitanja/odgovora razdvojenih praznim redom); tekst odobrila Ana (i10/P-1, O-47) |
| `ODLUKE.md` §1 | red i10 još piše „U TOKU” (zastarjelo; i10 je ITERATION ACCEPTED, tag `i10`) — ispravlja se u K10 |
| Smoke dug iz i09/i10 | NFR-09 samo API 26 (i09, OD-1) odnosno samo API 35 (i10); S9 nije izvršen; NFR-10 (i09/S11) neizvršen, i10/S17 prijavljen PASS bez zapisanih detalja; screenshot-i konačnih ekrana postoje samo za 4 ekrana |

## 2. Princip izvedbe

1. Backend (`backend/src`) i `firestore.rules` se u i11 **ne mijenjaju** (AC-12 je tada „isti kod, završni run”). Jedini izuzetak bi bio P-1 opcija B (CORS) — preporučena je opcija koja ga ne dira.
2. Sve što je lokalno za pravi projekat (kredencijali, Web API key, App ID, POS ključ, service account) živi **van repoa** (NFR-07); repo dobija samo uputstva i `.gitignore` pravila.
3. Testovi ostaju nad emulatorom (`demo-fuelpoints`). Nad pravim projektom izvršavaju se samo **ručni smoke koraci** (Ana) — CLAUDE.md zabranjuje automatske testove nad produkcijom.
4. Svako business-critical ponašanje koje i11 dotiče ima automatski test (sekcija 6). Čisto operativne stavke (konzola, uređaj) imaju smoke protokol sa PASS/FAIL i dokazom.

## 3. Pregled koraka

| Korak | Sadržaj | Ko | Zavisi od |
|---|---|---|---|
| K1 | Odobrenje plana → `ODLUKE.md`, `.gitignore`, crveni testovi | Builder | odobrenje |
| K2 | POS Simulator (stranica + lokalni poslužitelj) + testovi I11-T01 … T04 | Builder | K1, P-1 |
| K3 | „Pomoć i česta pitanja” — raspored ekrana + I11-T07 | Builder | K1, P-6 |
| K4 | R8 pravilo za `Log.v/d/i`, `release` konfiguracija iz lokalnog fajla, `releaseProba` + I11-T05, T06 | Builder | K1, P-2, P-3 |
| K5 | Uputstvo za pravi Firebase Spark projekat i konzolu (dokument + ručni koraci) | Builder (dokument), Ana (konzola) | K4 (lokalna konfiguracija) |
| K6 | Composite indeksi nad pravim projektom + I11-T09 (statika) + ručni dokaz | Builder + Ana | K5 |
| K7 | Ručni end-to-end nad pravim projektom (releaseProba + Backend + POS Simulator) | Ana | K2, K4, K5, K6 |
| K8 | Smoke protokol `docs/smoke/i11_smoke.md`: NFR-09 (API 26 + API 35), S9, NFR-10 | Ana (izvršava), Builder (protokol, zapis) | K3, K7 |
| K9 | AC-12 završni run + §34.1 provjera komponenti | Builder | K2 … K8 |
| K10 | Dokumentacija: TRACEABILITY, IMPLEMENTATION_LOG, TEST_REPORT, README, ODLUKE | Builder | K9 |

Redoslijed izvršavanja: K1 → K2 → K3 → K4 → K5/K6 (paralelno sa Aninim konzolnim radom) → K7 → K8 → K9 → K10. K2, K3 i K4 su nezavisni od konzole, pa Builder radi dok Ana podešava projekat.

---

## 4. Koraci

### K1 — Odobrenje plana i priprema
- Doslovno upisati sekciju 14 („Odluke Orchestrator-a”) ovog plana; commit „i11: odobrenje plana i odluke Orchestrator-a”.
- `ODLUKE.md`: ispraviti red i10 u §1 (ITERATION ACCEPTED, tag `i10`, merge `061e106`, PR #10), dodati red i11 „U TOKU”.
- `.gitignore`: dodati `android-app/firebase.local.properties`, `android-app/*.keystore`, `android-app/*.jks`, `.env.real*` (već pokriveno `.env.*`, ali eksplicitno), `docs/**/*.apk`. Test I11-T08 provjerava da su pokriveni.
- Pokrenuti postojeći `provjera.ps1` jednom kao polazni zeleni run (i10 završni nije dokumentovan izvršenom komandom, vidi TEST_REPORT „`provjera.ps1` — Ana”); ovo je ujedno prvi „završni run” kandidat za AC-12.

### K2 — POS Simulator (SRS §2.5, §33.2, §34.1, §3.4)
Oblik: jedna HTML stranica `pos-simulator/index.html` (bez framework-a, bez eksternih resursa — nema CDN-a, radi offline) + **opciono** mali Node poslužitelj `pos-simulator/server.js` (bez zavisnosti, samo `node:http`) — zavisi od P-1.

Stranica (sve latinica, ijekavica; imena polja kao u SRS-u):
- Sekcija „Podešavanje”: bazni URL Backend-a (podrazumijevano `http://127.0.0.1:3000` ili isti origin), **POS API ključ** (`<input type="password">`, držan samo u memoriji stranice; **ne** `localStorage`/`sessionStorage`/kolačić, ne u URL, ne u `console.*`, ne u prikazu odgovora).
- Forma „Kupovina” (API-02): `loyaltyUid`, `posTransactionId`, količina goriva (korisnik unosi litre sa decimalama → stranica šalje `volumeMl` cijeli broj; npr. „42,730” → 42730; nevalidan unos se prijavi lokalno prije slanja), iznos (unosi se kao decimalni EUR → `amountMinor` cijeli broj, centi), `currency` fiksno „EUR” (jedina podržana, §8.4), `occurredAt` (podrazumijevano „sada”, ISO 8601 UTC sa `Z`, može se izmijeniti). Dugme „Nova transakcija” generiše jedinstven `posTransactionId` (npr. `SIM-<vrijeme>-<nasumično>`, uklapa se u `^[A-Za-z0-9._-]{1,64}$`); dugme „Ponovi isti zahtjev” šalje isti payload (demonstrira idempotentnost, 200 umjesto 201).
- Forma „Otkup nagrade” (API-04): `voucherId` (64 hex), `redemptionRequestId` (kanonski UUID v4 malim slovima, generiše se `crypto.randomUUID()`, može se ponoviti istim ID-em za retry).
- Tijelo zahtjeva sadrži **tačno** polja koja SRS traži za taj endpoint (API-02: 6 polja; API-04: samo `redemptionRequestId`; `voucherId` ide u putanju, enkodiran `encodeURIComponent`); **nikad `stationId`** (§3.4) ni `uid` kao autoritet.
- Prikaz odgovora: HTTP status, `error.code`/`message`/`correlationId` iz §27 (ili tijelo uspjeha), bez zaglavlja zahtjeva. Greške mreže (Backend ugašen) prikazati kao „Backend nije dostupan”. Za 503 ponuditi ponovni pokušaj istim `posTransactionId`/`redemptionRequestId` (§6 (b) ODLUKE: 503 ne znači da mutacija nije upisana).
- Ručni unos/kopiranje UID-a (bez QR skenera, §2.5).

Poslužitelj `server.js` (ako P-1 = A): servira `index.html` i **prosljeđuje samo** `POST /api/v1/pos/purchases` i `POST /api/v1/pos/vouchers/{voucherId}/redeem` na konfigurisani Backend (allowlist ruta, ostalo 404); zaglavlje `X-POS-API-Key` se prosljeđuje, nikad ne loguje ni ne čuva; slušanje samo na `127.0.0.1`; log samo metod + šablon rute + status (u duhu D-3), bez tijela i zaglavlja. Pokretanje: `node pos-simulator/server.js` (port iz `POS_SIMULATOR_PORT`, podrazumijevano 3001; Backend URL iz `BACKEND_URL`, podrazumijevano `http://127.0.0.1:3000`).

Testovi (prvo crveni): vidi I11-T01 … I11-T04. `pos-simulator/package.json` sa `"test": "node --test test/*.test.js"` (bez zavisnosti); korak „POS Simulator: npm test” dodaje se u `skripte/provjera.ps1`.

Dokumentacija: `pos-simulator/README.md` (pokretanje, oblik zahtjeva, kako dobiti UID sa Moj QR ekrana, primjer za idempotentni retry), `README.md` korijena (red u tabeli „POS Simulator”).

### K3 — Pomoć i česta pitanja: raspored ekrana
Samo raspored; **tekst ostaje doslovno** kakav je odobrila Ana (O-47, i10/P-1). Primjedba iz S13 nije konkretizovana (nepregledan raspored) → vidi P-6 (ponuđeni raspored dolje, Ana potvrđuje prije implementacije).
- Zamijeniti jedan string sa 7 blokova strukturisanim parovima (pitanje, odgovor): `strings.xml` → 7 pari `pomoc_p1 … pomoc_p7` / `pomoc_o1 … pomoc_o7` + `pomoc_kontakt` (isti tekst, samo razdvojen na nizove).
- `EkranPomoci`: za svaki par kartica/blok (`Pitanje`: `titleSmall`/semibold, žuta ili naglašena boja iz teme `LocalBoje`; `Odgovor`: `bodyMedium`, standardna boja), razmak 6 dp unutar para, 18 dp između parova, tanak razdjelnik; ekran se skroluje (`verticalScroll` ako `EkranOkvir` to već ne radi — Builder provjerava); „Kontakt” na kraju kao odvojen blok. Bez izmjene navigacije, bez novih zavisnosti, bez novog sadržaja.
- `contentDescription`/semantika: pitanja kao naslovi (`Modifier.semantics { heading() }`) radi pristupačnosti (NFR-10 duh).
- Test I11-T07 (JVM, statika nad `strings.xml`): tačno 7 pitanja i 7 odgovora, svako pitanje završava „?”, ni jedan odgovor nije prazan, nema „TODO”; a konkatenacija parova daje isti sadržaj kao tekst odobren u i10 (tekst iz `git show i10:…/strings.xml` zakucan u test kao očekivane vrijednosti ⇒ dokaz „tekst nepromijenjen”).
- Smoke: S-korak u `i11_smoke.md` (API 26 + API 35, svijetla i tamna tema, veliki font sistema 200 %).

### K4 — Release build, R8 pravilo za Log.v/d/i (i09/K-3, NFR-07)
Cilj: u `release` APK-u nijedan `android.util.Log.v/d/i` poziv — ni aplikacije ni biblioteka (Firebase Auth SDK loguje e-mail na INFO i UID na DEBUG, ODLUKE §7) — ne ostaje.
- `app/build.gradle.kts` → `release { isMinifyEnabled = true; isShrinkResources = true }` (R8 full mode je podrazumijevan u AGP 8.10).
- `proguard-rules.pro`:
  ```
  -assumenosideeffects class android.util.Log {
      public static int v(...);
      public static int d(...);
      public static int i(...);
  }
  ```
  `Log.w/e` se **ne** uklanjaju (greške ostaju dijagnostički vidljive; Auth SDK ih ne koristi za e-mail/UID — provjerava se u S-koraku). Builder prvo pokuša ovaj klasični oblik; ako R8 8.x podržava `-maximumremovedandroidloglevel 4` i daje isti rezultat, može ga dodati uz dokaz (odluka Buildera, bez P-pitanja).
- Dopunska keep pravila **samo ako** release smoke pokaže potrebu (kotlinx.serialization i Firebase donose consumer pravila; OkHttp/ZXing ne traže ništa). Ne dodavati pravila „za svaki slučaj”.
- Release konfiguracija pravog projekta iz lokalnog fajla van repoa (O-2, i09/P-7): `android-app/firebase.local.properties` (gitignored) sa `firebase.projectId`, `firebase.applicationId`, `firebase.apiKey`, `backend.baseUrl`. `build.gradle.kts` čita fajl **ako postoji**; ako ne postoji, `release` ostaje sa praznim vrijednostima i `assembleRelease` i dalje uspijeva (CI/provjera.ps1 ne zavisi od lokalnog fajla). Vrijednosti za `demo-fuelpoints` ostaju samo u `debug`; u `release` više nema `demo-*` (I11-T06).
- `main` manifest ostaje bez cleartext-a i bez dodatnih dozvola (I09-T12 i dalje važi). `BACKEND_BAZNI_URL` za pravi `release` mora biti `https://…` (NFR-01) — validira se u `build.gradle.kts` (greška buildа ako lokalni URL ne počinje sa `https://`).
- **Probni release na uređaju** (P-2): dodatni build type `releaseProba` (`initWith(release)`, `applicationIdSuffix` ne — koristi isti paket da bi radio sa pravim projektom; potpisan `debug` ključem; `src/releaseProba/` sa `network_security_config` koji dozvoljava cleartext **samo** za `10.0.2.2`; `matchingFallbacks += "release"`). Time se isti R8-minifikovan kod testira nad pravim Firebase-om i lokalnim Backend-om bez HTTPS tunela. `main` i `release` ostaju HTTPS-only. Taj build type se ne distribuira.
- Dokaz uklanjanja (automatski + ručni):
  1. I11-T05 (JVM statika): `isMinifyEnabled = true` u `release`, pravilo prisutno u `proguard-rules.pro`, pravilo pokriva v/d/i a ne e/w.
  2. Skripta/`provjera.ps1` korak (opciono Builder): `.\gradlew.bat assembleRelease` zeleno; `mapping.txt` postoji. Dex provjera `apkanalyzer`/`dexdump` da nema `Landroid/util/Log;->i`/`d`/`v` poziva iz paketa `com.google.firebase.auth` (komanda i rezultat u TEST_REPORT; ako alat ne nađe, to se piše).
  3. Ručno (S-korak): `releaseProba` na API 35, prijava + registracija, `adb logcat -d | Select-String "FirebaseAuth|ana@|Creating user|Logging in as|Notifying id token"` → 0 pogodaka; ista komanda nad `debug` (kontrola) → pogoci postoje (dokaz da je nalaz stvaran i da je rupa zatvorena).
- Poznato ograničenje (ostaje u ODLUKE §7): `debug` build i dalje loguje (svjesno — razvoj nad emulatorom); `-assumenosideeffects` ne štiti od logovanja kroz `Log.println`/`Timber`-slične puteve — SDK ih ne koristi (provjeriti u dex dokazu).

### K5 — Pravi Firebase Spark projekat i konzola (O-2; §3.5, §3.6)
Deliverable Buildera: `docs/uputstva/pravi_firebase_projekat.md` (PowerShell komande, bez tajni, sa listom „šta se NE commit-uje”). Izvršava Ana. Koraci:
1. Firebase konzola → novi projekat (Spark, bez Google Analytics-a), npr. `fuelpoints-diplomski` (ID bira Ana; **ne** `demo-`).
2. Android app: paket `io.github.anaspasojevic.fuelpoints` → samo vrijednosti `appId`, `apiKey`, `projectId` se upisuju u `android-app/firebase.local.properties`. `google-services.json` se **ne** preuzima u repo (O-39; ako se preuzme radi čitanja vrijednosti, ostaje van repoa; `.gitignore` ga već pokriva).
3. Authentication → Sign-in method → **Email/Password** uključen; (bez Email link, bez verifikacije — §3.5).
4. **Email Enumeration Protection**: Authentication → Settings → User actions → „Email enumeration protection” = **Enabled** (§3.5). Dokaz: slika konzole + REST test (korak 7b).
5. **Password policy**: Authentication → Settings → Password policy → **Enforcement mode: Require** (ne „Notify”); minimalna dužina **8**; **Require uppercase = da**, **Require numeric = da**; lowercase = ne, non-alphanumeric = ne (SRS §3.6: samo 8 + veliko slovo + cifra; jednako klijentu, i09/P-2). Maksimalna dužina ostaje podrazumijevana (≥ 100 jer klijent ne ograničava gore). Dokaz: slika konzole + REST test (korak 7a). Ako konzola za Spark traži nadogradnju na Identity Platform (Blaze) da bi ponudila neku od ovih opcija → **STOP, vidi P-7** (Planner ne pretpostavlja; plan ne uvodi plaćeni plan bez tvoje odluke).
6. Firestore Database: Native mode, lokacija bliska (npr. `eur3`/`europe-west`), **production mode** (default deny; pravila se deploy-uju u K6). Pravila i indeksi: `npx firebase deploy --only "firestore:rules,firestore:indexes" --project <ID> --config firebase.json` iz korijena repoa (`.firebaserc` se **ne** mijenja; projekat samo kroz `--project`). Pravila su identična `firebase/firestore.rules` (§31, I08-T01).
7. REST dokazi (PowerShell `Invoke-RestMethod`, Web API key se čita iz lokalnog fajla, ne ispisuje se):
   a. `accounts:signUp` sa slabom lozinkom (`abcdefg1` bez velikog slova; `Abcdefgh` bez cifre; `Ab1` prekratka) → očekivano `PASSWORD_DOES_NOT_MEET_REQUIREMENTS` za sve tri; sa `Lozinka1` → uspjeh (test nalog se zatim briše). Time se potvrđuje da je **server-side** Require aktivan (klijentska provjera zaobiđena, §3.6).
   b. `accounts:signInWithPassword` sa nepostojećim e-mailom i sa postojećim e-mailom + pogrešnom lozinkom → **isti** odgovor `INVALID_LOGIN_CREDENTIALS`; `accounts:sendOobCode` (PASSWORD_RESET) za nepostojeći e-mail → isti uspješan odgovor kao za postojeći.
8. Service account: Project settings → Service accounts → generisati ključ → snimiti **van repoa** (npr. `C:\Users\Elitebook\fuelpoints-secrets\sa.json`); `GOOGLE_APPLICATION_CREDENTIALS` samo u tekućoj PowerShell sesiji (`$env:GOOGLE_APPLICATION_CREDENTIALS = '…'`), nikad u `.env` koji se commit-uje i nikad u logu. Backend `.env` za pravi projekat: poseban fajl van repoa ili `.env` sa `FIREBASE_PROJECT_ID=<ID>` **bez** `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`; novi (ne demo) POS ključ za stanicu (generisanje kao u README).
9. Seed `rewardDefinitions` (CAR_WASH 50, SHOWER 30, `active: true`, §12) — vidi P-5 (preporuka: ručno kroz konzolu, 2 dokumenta, bez dodirivanja `zastitaEmulatora`).
10. Backend start nad pravim projektom: `cd backend; npm start`. Očekivano: start bez emulator varijabli, prvi zahtjev proizvodi `MetadataLookupWarning` ili ne (poznato iz §7). Provjera: `GET /api/v1/…` bez tokena → 401 (smoke kao u `provjera.ps1`).
11. Zatvaranje poznatog ograničenja i02/R-03 (ODLUKE §7): van emulatora greška preuzimanja javnih ključeva daje 401 umjesto 503 — samo **opisati** u dokumentu kao ponašanje produkcije (nije dostižno bez ometanja mreže); ne mijenja se kod. Ako Ana želi dokaz (isključi mrežu Backend-a, pošalji pravi token), u TEST_REPORT ide rezultat; inače ostaje poznato ograničenje.

Dokaz o izvršenju: slike konzole (Email Enumeration Protection = Enabled; Password policy = Require, 8, uppercase, numeric) u `docs/smoke/i11_konzola_*.png` — **bez** API ključeva i e-mailova u kadru (Ana pokriva ili isječe). Rezultati REST testova u `i11_smoke.md`.

### K6 — Composite indeksi nad pravim projektom
- Deploy: `firebase deploy --only firestore:indexes` (K5.6). Čekati status **Enabled** u konzoli (Firestore → Indexes) ili `npx firebase firestore:indexes --project <ID>`; kopija stanja u TEST_REPORT (tri indeksa, status, bez ID-a projekta ako Ana ne želi).
- Dokaz da upiti rade (bez `FAILED_PRECONDITION: The query requires an index`): Android ručno na `releaseProba`: Istorija (purchases `uid ==` + `orderBy occurredAt desc`, `limit 20` + učitavanje starijih), Obavještenja (`notifications` `orderBy createdAt desc`, `limit 50`), Nagrade (`vouchers` `uid ==`, `status == ACTIVE`, `orderBy expiresAt`, `limit 20`); Backend: API-03/API-06 upit `vouchers uid ==, status ==` (jednakosti; ODLUKE i04/P-10, i05/P-9 „potreba za indeksom utvrđena samo nad emulatorom” → ovdje se utvrđuje nad produkcijom). Ako produkcija traži dodatni indeks za neki upit (poruka sa linkom) → **STOP**, ne popravljati u hodu: javlja se kao nalaz i ide kroz P-9 odluku (promjena `firestore.indexes.json` mijenja i08 dokaz).
- Prije deploy-a Builder dokazuje poklapanje: I11-T09 (JVM statika) parsira `FirestoreIzvor*.kt` upite (`orderBy`/`whereEqualTo`) i traži u `firestore.indexes.json` odgovarajući indeks; test pada ako Android upit sa `orderBy` nema indeks. Time je „oblik” automatski provjeren, a produkcijsko ponašanje ručno.
- Provjeriti i da pravila nad pravim projektom odbijaju direktan upis: u Firestore Rules Playground (konzola) ili `curl` sa ID tokenom na REST `documents` endpoint: PATCH `loyaltyAccounts/<uid>` sa tokenom vlasnika → `403 PERMISSION_DENIED` (AC-02 nad produkcijom; ručni dokaz, jedan red u smoke-u).

### K7 — Ručni end-to-end nad pravim projektom
Okruženje: Backend lokalno nad pravim projektom (K5.10), `releaseProba` APK na emulatoru API 35 (`10.0.2.2:3000`), POS Simulator (K2) u pregledniku.
Scenarij (zapis u `i11_smoke.md`): registracija (nova lozinka kroz pravu politiku; slaba lozinka se odbija i na serveru), prijava, Home 0 bodova → POS Simulator kupovina 42,730 l / iznos / EUR → Home 42 boda (AC-03) → retry istog zahtjeva iz simulatora → 200, bodovi isti → Nagrade: izdavanje SHOWER → voucher QR + `voucherId` (kopiran sa ekrana ili Firestore konzole) → POS Simulator otkup → 200, voucher nestaje iz aktivnih (AC-07) → retry otkupa → 200 isto tijelo → ponovni otkup drugog voucher-a bez ključa → 401 (NFR-02) → odjava → brisanje naloga (API-07) → ponovna prijava odbijena generičkom porukom. Ledger provjera u konzoli: `reserve_`, `redeem_`, `earn_` zapisi postoje (AC-09). Logcat filter iz K4.

### K8 — Smoke protokol `docs/smoke/i11_smoke.md`
Builder piše protokol (sve ekrane iz i09 i i10 po NFR-09), Ana izvršava, Builder upisuje rezultate (ne izmišlja).
**NFR-09 (puna lista: login, Home, QR, purchases, reward, notifications, Settings/logout)** na **API 26 i API 35**, `debug` + lokalni emulatori (`.\skripte\pokreniLokalno.ps1`; ponovljivo); isti scenarij kao `i10_smoke.md` S1 … S16, S18, S19. Rezultat po API nivou, tabela PASS/FAIL. (Na API 26 sistemski tamni režim ne postoji ⇒ S16 samo API 35; tamna tema se provjerava i kroz „Forsiraj tamnu temu” ako Ana želi — informativno.)
**S9 (isticanje vaučera)**: API 35, `debug`; izdati SHOWER (30), sačekati odbrojavanje 15:00 → 00:00; očekivano: „Voucher je istekao” → tačno jedan API-06 (O-49) → voucher nestaje iz aktivnih → bodovi vraćeni, „Rezervisano” nestaje (O-5/§20.5, AC-08); zatim POS Simulator otkup tog voucher-a → `409 VOUCHER_EXPIRED` (O-7). Bonus: isti test nad `releaseProba` + pravi Firestore (K7) gdje je to praktično (jedan 15-min čekanje može poslužiti oba: ako Ana izvede S9 samo jednom, vrijedi nad pravim projektom; vidi P-4).
**NFR-10 Layout Inspector (API 35, svi ekrani)** — spisak ekrana u protokolu: Prijava, Registracija, Uslovi korišćenja, „Dovršite registraciju”, Home (+ offline marker), Moj QR, Istorija (+ „Učitaj starije”), Nagrade (+ dijalozi izdavanja/otkazivanja, aktivni voucher), Obavještenja, Profil, Promjena lozinke, Pomoć i česta pitanja, Brisanje naloga (upozorenje, lozinka, „Nalog se briše”). Po ekranu tabela: interaktivni elementi, izmjerena veličina (dp), `contentDescription` za ikone bez teksta, PASS/FAIL. Ako element < 48×48 dp → FAIL → u FIX LOOP (Builder radi `minimumInteractiveComponentSize`/`Modifier.sizeIn(48.dp)`; **stvarno ispravlja kod samo ako Ana prijavi FAIL**, jer Layout Inspector je njena ručna provjera).
**Screenshot-i** (zatvara i09/S12): Prijava, Registracija, Home, Moj QR, Istorija, Nagrade, Obavještenja, Profil, Pomoć u `docs/smoke/i11_*.png` (bez stvarnog e-maila/UID-a gdje je moguće — test nalog).

### K9 — AC-12 i §34.1
- AC-12 = 12/12 API testova (API-T01 … API-T12, §29) + 12/12 Rules testova (RULE-T01 … RULE-T12, §30) u **jednom** `provjera.ps1` run-u (i08/P-4) nad emulatorom, na istom kodu koji se predaje (poslije svih ostalih Builder commit-a, a prije docs-only commit-a po O-31). Pošto Backend i `firestore.rules` ostaju netaknuti (`git diff i10 -- backend/src firebase/firestore.rules` prazno), run dokazuje AC-12 za isti kod kao u i08. Pitanje „nad pravim/emulator okruženjem po odluci Plannera” — **odluka Plannera: emulator** (CLAUDE.md: testovi isključivo nad emulatorom; produkcija se pokriva ručnim K6/K7 koracima). Ana potvrđuje u P-4.
- Tabela u TEST_REPORT: svaki API-Txx i RULE-Txx sa nazivom testa i PASS iz tog run-a (brojevi preuzeti iz stvarnog izlaza, ne iz sjećanja).
- §34.1 lista (Android App, Node/Express Backend, Firebase Authentication, Cloud Firestore, Firebase Emulator Suite, POS Simulator, Firestore Security Rules): za svaku komponentu: gdje je u repou, kojom komandom/dokazom je „prisutna i funkcionalna”, referenca na rezultat (npr. POS Simulator → I11-T03 + K7). Zapis u TRACEABILITY i TEST_REPORT.
- Pretraga tajni (I11-T08): `git grep -n -E "AIza[0-9A-Za-z_-]{35}|BEGIN (RSA )?PRIVATE KEY|\"private_key\"|X-POS-API-Key:\s*[A-Za-z0-9_-]{43}"` u praćenim fajlovima → prazno; `git ls-files` ne sadrži `google-services.json`, `*.keystore`, `*service-account*.json`, `firebase.local.properties`, `.env`.

### K10 — Dokumentacija (checkpoint)
`docs/TRACEABILITY.md` (NFR-09, NFR-10, §2.5, §3.5, §3.6, §33.2, §34.1, AC-12 redovi → testovi/dokazi i11), `docs/IMPLEMENTATION_LOG.md` (i11: koraci, odstupanja OD-n), `docs/TEST_REPORT.md` (samo stvarno izvršene komande + smoke tabele iz K8, REST dokazi K5, indeksi K6), `README.md` (POS Simulator, release/`releaseProba`, uputstvo za pravi projekat sa linkom, tabela „šta je lokalno”), `docs/ODLUKE.md` (nove stavke i11/P-n, zatvaranje: O-2 → implementirano; i09/K-3 → ZATVORENO; §7 ograničenja i09 (S10, S11, S12) → zatvorena ili ažurirana; §1 i11 status; napomena da je projekat završen po planu). Poslije ITERATION ACCEPTED: PR, merge, `provjera.ps1`/`git diff` po O-31 (b), anotirani tag `i11`, `git push origin i11` — radi Ana/Orchestrator, ne Planner.

---

## 5. Redoslijed „crveno prije koda” (K-3 i07 pravilo)
K2: I11-T01 … T04 prvo (padaju: prazna stranica); K3: I11-T07 (pada: jedan string); K4: I11-T05, T06 (padaju: `isMinifyEnabled=false`, `demo-*` u release); K6: I11-T09 (zelen odmah ako indeksi već pokrivaju — to je prihvatljivo, navodi se u TEST_REPORT kao „bez crvenog: dokaz poklapanja, ne novo ponašanje”); K9: I11-T08 (zelen odmah, regresiona kontrola). Crveni run se bilježi u TEST_REPORT prije koda.

## 6. Plan testova

| ID | Šta dokazuje | Lokacija | Tip |
|---|---|---|---|
| I11-T01 | POS Simulator: tijelo kupovine = tačno 6 polja SRS-a, bez `stationId`/`uid`; tijelo otkupa = samo `redemptionRequestId`, `voucherId` samo u putanji (§3.4, §8.4, §20.1); konverzija litara → `volumeMl` i EUR → `amountMinor` (npr. „42,730” → 42730; zaokruživanje, nevalidan unos odbijen) | `pos-simulator/test/` (`node:test`, logika izdvojena u `pos-simulator/logika.js` koju učitava i stranica) | JVM-ekvivalent (Node) |
| I11-T02 | API ključ se ne čuva (nema `localStorage`/`sessionStorage`/`document.cookie`/`console.` sa ključem u `index.html` i `logika.js`), polje je `type=password`; poslužitelj ne loguje zaglavlja ni tijelo (hvata se izlaz procesa) i prosljeđuje samo dvije dozvoljene rute (ostalo 404) | `pos-simulator/test/` | Node |
| I11-T03 | End-to-end nad emulatorom: simulator (preko `server.js`) → pravi Backend: API-02 201 pa retry 200, pogrešan ključ 401 `UNAUTHENTICATED_POS`, API-04 200 pa retry 200, drugi voucher isti `redemptionRequestId` 409 `IDEMPOTENCY_CONFLICT`; ključ i Authorization ne završavaju u logu | `backend/test/emulator/posSimulator.test.js` (koristi postojeće pomoćnike; uvozi `pos-simulator/server.js`) | emulator |
| I11-T04 | Prikaz greške: tijelo §27 (`code`, `message`, `correlationId`) se prikazuje, stack/neočekivano tijelo ne; mreža nedostupna → poruka; 503 nudi retry sa istim ID-em | `pos-simulator/test/` | Node |
| I11-T05 | `release`: `isMinifyEnabled = true`; `proguard-rules.pro` ima `-assumenosideeffects` za `android.util.Log` v/d/i, a ne za w/e | `I11T05ReleaseProvjeraTest.kt` | JVM statika |
| I11-T06 | `release` bez `demo-*` i bez emulator hosta; `BACKEND_BAZNI_URL` iz lokalne konfiguracije i `https://` (ili prazan); `releaseProba` jedini build type sa cleartext-om, samo `10.0.2.2`; `main` bez cleartext-a (nastavak I09-T12) | isto | JVM statika |
| I11-T07 | FAQ: 7 pitanja/odgovora strukturisano, tekst identičan odobrenom (i10/P-1) | `I11T07PomocTekstTest.kt` | JVM statika |
| I11-T08 | Tajne: nijedan praćeni fajl ne sadrži API ključ/privatni ključ/POS ključ; zabranjeni fajlovi nisu praćeni; `.gitignore` pokriva lokalne fajlove (NFR-07) | `backend/test/jedinicni/tajneURepou.test.js` (`git ls-files`/`git grep` kroz `child_process`) | Node |
| I11-T09 | Svaki Android upit sa `orderBy` ima odgovarajući composite indeks u `firestore.indexes.json` (polja i smjer) | `I11T09IndeksiTest.kt` (čita izvore i JSON) | JVM statika |
| AC-12 | 12/12 API + 12/12 Rules u jednom run-u | `provjera.ps1` | emulator, završni run |
| M-1 … | Ručni: konzola (EEP, Require), REST dokazi, indeksi Enabled, upiti bez `FAILED_PRECONDITION`, R8 Logcat, NFR-09 ×2, S9, NFR-10, K7 scenarij | `docs/smoke/i11_smoke.md` | ručni (Ana) |

Kontrolne mutacije (O-31 (c): Android bez mutacija; i11 uvodi samo jednu, jeftinu, za statičke testove): (1) vratiti `isMinifyEnabled=false` → I11-T05 mora pasti; (2) obrisati `-assumenosideeffects` pravilo → T05 pada; (3) dodati `stationId` u tijelo kupovine simulatora → T01 pada; (4) dodati `console.log` sa ključem → T02 pada; (5) obrisati jedan indeks iz JSON-a → T09 pada. 1/1 determinističke, 5 ukupno.

## 7. Sljedivost (SRS → i11)
| SRS | Pokriveno |
|---|---|
| §2.5, §33.2, §34.1 (POS Simulator) | K2, I11-T01 … T04, K7, K9 |
| §3.4 (POS ključ, `stationId` iz mape) | K2 (nema `stationId` u tijelu), I11-T01, I11-T03, K7 korak „bez ključa → 401” |
| §3.5 (Email Enumeration Protection; generička poruka) | K5.4, K5.7b, K7 |
| §3.6 (password policy Require) | K5.5, K5.7a, K7 |
| NFR-07 (tajne, logovi) | K4 (R8), I11-T05, T08, S-Logcat |
| NFR-09 | K8 (API 26 + API 35) |
| NFR-10 | K8 (Layout Inspector, svi ekrani) |
| NFR-01 (HTTPS u produkciji) | K4 (`https://` provjera za `release`); lokalni HTTP samo `releaseProba`/`debug` (§33.3) |
| AC-12 | K9 |
| AC-01, 02, 03, 07, 08, 09 (potvrda nad pravim projektom) | K6, K7, S9 |

## 8. Rizici i zavisnosti
| # | Rizik | Ublažavanje |
|---|---|---|
| R1 | Password policy / EEP na Spark planu zahtijeva Identity Platform (Blaze) | P-7; STOP u K5.5 umjesto pretpostavke |
| R2 | R8 u `release` razbije kotlinx.serialization/Firebase refleksiju → crash pri prijavi | `releaseProba` smoke odmah poslije K4; keep pravila tek po dokazanoj potrebi |
| R3 | Produkcioni Firestore traži indeks koji emulator nije tražio | K6 STOP + nalaz (P-9); nijedna izmjena indeksa bez odluke |
| R4 | `-assumenosideeffects` ne ukloni SDK logove (logovi preko drugog puta) | dex + Logcat dokaz; ako ne uspije, nalaz ostaje poznato ograničenje uz tekst iz §7 (ne tvrdi se zatvoreno) |
| R5 | Browser blokira POS poziv zbog CORS-a | P-1 (preporuka: lokalni proxy bez izmjene Backend-a) |
| R6 | Curenje ključeva kroz screenshot-e/TEST_REPORT | pravila u uputstvu (K5), I11-T08, Ana pregleda slike prije commit-a |
| R7 | 15-min čekanje S9 produži sesiju | S9 se vodi paralelno sa drugim K8 koracima (isteče u pozadini) |
| R8 | Kontencija B-2 (tx.get(query) nad `vouchers`) vidljiva na produkciji | samo posmatra se; ako se pokaže (503), upisati nalog; ne mijenjati (O-17) |

## 9. Otvorena pitanja (čekaju odobrenje)

**P-1 — Kako POS Simulator zove Backend (CORS)?** Backend nema CORS, a `X-POS-API-Key` aktivira preflight, pa HTML stranica (ni sa `file://`) ne može direktno do Backend-a.
- **A (preporuka):** stranica + mali Node `server.js` (bez zavisnosti) koji servira stranicu i proxy-ja samo dvije POS rute na Backend. Backend/`firestore.rules` ostaju netaknuti; AC-12 je „isti kod”; veličina ≈ 80 linija. Cijena: simulator nije *samo* HTML (SRS §2.5 dopušta „jednu HTML stranicu”, `server.js` je pomoćni lokalni alat).
- B: dodati CORS u Backend (npr. `POS_SIMULATOR_ORIGIN` iz konfiguracije). Čista HTML stranica, ali mijenja trusted Backend i traži nove testove/mutacije i novu odluku; riziko za AC-12 argument „kod nije mijenjan”.
- C: Postman kolekcija umjesto stranice (§2.5 dozvoljava, ali brief kaže HTML preporučeno).

**P-2 — Kako provjeriti `release` na uređaju kad je Backend lokalni HTTP (NFR-01 traži HTTPS u produkciji, §33.3 hosting nije dio rada)?**
- **A (preporuka):** build type `releaseProba` (kopija `release`, debug potpis, cleartext samo `10.0.2.2` u njegovom `network_security_config`), `release` ostaje HTTPS-only i nepotpisan (nema keystore-a u repou). Nova odluka uz O-40 (cleartext više nije samo u `debug`, ali nikad u `main`/`release`).
- B: HTTPS tunel (npr. Cloudflare Tunnel/ngrok) ka lokalnom Backend-u — eksterna usluga, promjenjiv URL, saobraćaj test podataka preko treće strane.
- C: `release` se samo gradi i statički provjerava (bez izvršavanja na uređaju) — slabiji dokaz za R8 i Logcat.

**P-3 — Gdje stoji konfiguracija pravog projekta za Android?** Preporuka: `android-app/firebase.local.properties` (gitignored; `projectId`, `applicationId`, `apiKey`, `baseUrl`), čita ga `build.gradle.kts` ako postoji (O-2, i09/P-7). Alternativa: Gradle `-P` svojstva ili `~/.gradle/gradle.properties`. Potvrdi preporuku.

**P-4 — AC-12 „nad pravim/emulator okruženjem”:** odluka Plannera: **emulator** (jedan `provjera.ps1`, CLAUDE.md zabranjuje testove nad produkcijom), a produkcija se pokriva ručnim K6/K7 koracima. Slažeš li se? Takođe: S9 jednom (nad pravim projektom/`releaseProba`, zadovoljava i debug zahtjev brief-a „ručno na uređaju”) ili dva puta (debug emulator + pravi projekat)? Preporuka: jednom nad pravim projektom + zasebno `debug` je već pokriveno JVM testovima I10-T04/T06/T11; ako želiš strogo dva, dodaje se 15 min.

**P-5 — Seed `rewardDefinitions` u pravom projektu:** preporuka **ručno kroz konzolu** (2 dokumenta, polja iz §12: `displayName`, `costPoints`, `active`), jer `zastitaEmulatora` namjerno zabranjuje seed van emulatora (i01/P-7) i jer je to jednokratna operacija. Alternativa: nova skripta sa izričitom zastavicom `--pravi-projekat` (kod + test + oslabljena zaštita) — ne preporučujem.

**P-6 — Raspored „Pomoć i česta pitanja”:** primjedba iz S13 je opšta („nije najpregledniji”). Predloženo: pitanja kao naglašeni naslovi (semibold, boja teme), odgovori ispod, razmaci između parova, razdjelnik, „Kontakt” odvojen; tekst nepromijenjen (T07). Ako imaš na umu nešto drugo (npr. harmonika/expand, kartice sa okvirom kao u dizajnu `docs/dizajn/8_profil.png`), reci prije K3.

**P-7 — Ako Spark ne dozvoli Require/EEP bez nadogradnje (Identity Platform/Blaze):** Planner ne uvodi plaćeni plan sam. Ako se to desi u K5.5, STOP i tvoja odluka: (a) nadograditi (Blaze sa budžetnim alarmom, besplatna kvota pokriva rad), (b) dokumentovati kao ograničenje i ostati na klijentskoj validaciji (SRS §3.6 tada nije ispunjen — to je odstupanje od SRS-a koje mora potpisati Ana). Preporuka: (a) ako se pojavi; prvo provjeriti stvarno stanje konzole.

**P-8 — NFR-09 okruženje:** puna lista na API 26 i API 35 kroz `debug` + lokalni emulatori (ponovljivo), a pravi projekat samo na API 35 `releaseProba` (K7). Alternativa: i API 26 nad pravim projektom (+~45 min). Preporuka: kao prva opcija.

**P-9 (uslovno) — Ako K6 pokaže da produkcija traži dodatni composite indeks:** odluka da li se indeks dodaje u `firestore.indexes.json` (mijenja i08/i10 dokaz „oblik indeksa”, ali ne Rules ni Backend kod) — Planner predlaže da, ako se desi, Orchestrator odobri dopunu uz test T09.

### Odobrenje plana — odluke Ane (P-1 … P-9)

| P | Odluka | Posljedica po plan |
|---|---|---|
| P-1 | A: HTML stranica + mali lokalni proxy `server.js`, bez zavisnosti | K2 kako je opisano; Backend i Rules netaknuti |
| P-2 | A: `releaseProba`; `release` ostaje samo HTTPS | K4 kako je opisano |
| P-3 | Odobreno: `android-app/firebase.local.properties` (gitignored) | K4 |
| P-4 | A: AC-12 i S9 nad emulatorom, ne produkcijom | K9: `provjera.ps1` nad emulatorom; S9 se izvodi na emulatoru (`debug` + lokalni emulatori), ne nad pravim projektom |
| P-5 | Odobreno: `rewardDefinitions` u pravom projektu ručno kroz konzolu | K5.9; bez izmjene `zastitaEmulatora` |
| P-6 | Padajuća pitanja (accordion) za Pomoć/FAQ | K3: svako pitanje je zaglavlje koje se širi/skuplja i otkriva odgovor; tekst nepromijenjen (T07); zaglavlja imaju semantiku dugmeta (stanje prošireno/skupljeno) i ≥ 48 dp; podrazumijevano skupljeno |
| P-7 | NE nadograđivati plan. Password policy „Require” i Email Enumeration Protection ostaju dokumentovano ograničenje na Spark planu | K5.4, K5.5, K5.7 i `i11_smoke.md`: u konzoli se prvo provjeri šta Spark nudi; ako opcije nisu dostupne bez nadogradnje, ne nadograđuje se, nego se stvarno stanje (slika konzole, REST odgovori) upisuje kao poznato ograničenje u ODLUKE §7 i TEST_REPORT. §3.5/§3.6 tada nisu ispunjeni na server strani; zaštitu daje samo klijentska validacija (i09/P-2). Builder to ne prikazuje kao ispunjen zahtjev. |
| P-8 | A: NFR-09 kroz `debug` i lokalne emulatore na API 26 i API 35; pravi projekat samo za API 35 provjeru | K8 |
| P-9 | A: uslovno, samo ako produkcija zaista zatraži dodatni indeks | K6 |

Napomena Plannera uz P-4 i P-7: P-4 isključuje S9 nad pravim projektom, pa K7 (pravi projekat) ne sadrži čekanje isteka voucher-a. P-7 je svjesno odstupanje od §3.5/§3.6 samo ako Spark opcije zaista nisu dostupne; ako jesu, uključuju se bez nadogradnje i vrijedi tekst K5.

## 10. Procjena vremena

| Korak | Builder (rad sa Claude-om) | Ana (ručno) |
|---|---|---|
| K1 | 0,5 h | odobrenje |
| K2 POS Simulator + testovi | 2,5 – 3 h | 0,25 h (pregled stranice) |
| K3 Pomoć/FAQ | 1 h | 0,25 h |
| K4 R8 + release + `releaseProba` + T05, T06 | 2,5 – 3 h (Gradle buildovi 5–10 min svaki) | 0,5 h (Logcat dokaz) |
| K5 uputstvo + konzola | 1 h (dokument) | 1,5 – 2 h (projekat, konzola, REST dokazi, service account) |
| K6 indeksi + T09 | 1 h | 0,75 h (deploy, čekanje indeksa 5–30 min, provjera upita) |
| K7 end-to-end | — | 1 – 1,5 h |
| K8 smoke protokol; NFR-09 ×2, S9, NFR-10, screenshot-i | 1 h (protokol + zapis) | 3 – 3,5 h (2 × ≈ 50 min, S9 15 min paralelno, NFR-10 ≈ 60 min, slike 20 min) |
| K9 AC-12 + §34.1 + tajne T08 | 1 h (+ ≈ 40 min `provjera.ps1`, bez sleep-a) | — |
| K10 dokumentacija | 1,5 h | 0,25 h |
| **Ukupno** | **≈ 12 – 14 h** | **≈ 8 – 10 h** |

Procjena kalendarski: 3 radna dana sa Aninim konzolnim i uređajnim koracima prepletenim (Firebase indeksi i S9 čekanja u pozadini). Prije dugih run-ova laptop ne smije u sleep (O-29). Ekspresni režim O-31 važi (Reviewer ne ponavlja `provjera.ps1` ako je završni run na kodu X, a ostatak su `docs/*.md` i `README.md`).

## 11. Van opsega (potvrđeno)
FCM (§33.4), promjena e-maila, QR skener u aplikaciji, istorija vaučera, produkcioni hosting Backend-a (§33.3), Play Store potpisivanje/keystore u repou, App Check, Crashlytics/Analytics, bilo šta iz §1.3.

## 12. Definition of Done
- [ ] POS Simulator radi: kupovina + otkup + idempotentni retry; I11-T01 … T04 zeleni; u `provjera.ps1`
- [ ] Backend i `firestore.rules` netaknuti (`git diff i10 -- backend/src firebase/firestore.rules` prazno) — ili P-1 B uz dokaz
- [ ] `release` sa R8, pravilo za Log.v/d/i; I11-T05, T06 zeleni; `assembleRelease` zeleno; dex/Logcat dokaz u TEST_REPORT
- [ ] Pravi Spark projekat: EEP = Enabled, Password policy = Require (8 / A–Z / 0–9) — slike + REST dokazi (ili P-7 odluka)
- [ ] Composite indeksi Enabled nad pravim projektom, tri Android upita bez `FAILED_PRECONDITION`, Backend upit bez indeksne greške
- [ ] NFR-09 PASS na API 26 i API 35; NFR-10 PASS za sve ekrane iz spiska; S9 PASS; screenshot-i konačnih ekrana
- [ ] FAQ ekran preuređen, tekst nepromijenjen (T07), smoke PASS
- [ ] AC-12: jedan `provjera.ps1` run, exit 0, 12/12 + 12/12 u tabeli
- [ ] §34.1: svih 7 komponenti sa dokazom; I11-T08 (tajne) zelen; nijedna tajna u repou, logovima ni slikama
- [ ] TRACEABILITY, IMPLEMENTATION_LOG, TEST_REPORT (samo izvršene komande), README, ODLUKE ažurirani; bez TODO/FIXME

---

## 14. Odluke Orchestrator-a (odobrenje plana)

Odgovori na P-1 … P-9 su upisani u sekciji 9 („Odobrenje plana — odluke Ane”). Builder ih doslovno prenosi u `docs/ODLUKE.md` u koraku K1.
Nema dodatnih ispravki K-n.
