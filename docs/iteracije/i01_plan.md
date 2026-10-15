# i01 — Plan (PLANNER)

Iteracija 1: Bootstrap i test infrastruktura. Grana `iteracija-01`.
Izvori: `CLAUDE.md`, `docs/iteracije/i01_brief.md`, SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`, normativan; `.md` čitljiva kopija), `docs/TRACEABILITY.md`.
Datum plana: 2026-10-14.

---

## 1. SRS zahtjevi u opsegu

| SRS | Šta se u i01 radi | Napomena |
|---|---|---|
| §2.1, §34.1 | Kostur svih obaveznih komponenti: `android-app/` (Android App), `backend/` (Loyalty Backend), `pos-simulator/` (POS Simulator), Firebase Authentication i Cloud Firestore kroz Emulator Suite (`firebase.json`), `firebase/firestore.rules` (Firestore Security Rules). | FCM (opcion, §2.1, §34.2) se NE radi (CLAUDE.md). |
| §2.3 | Backend: Node.js 24 LTS + Express + Firebase Admin SDK, lokalni Node proces (`npm start`). Bez Cloud Functions. | — |
| §2.4 | Firebase Emulator Suite (Firestore + Auth) za sve testove koji diraju podatke; projekat `demo-fuelpoints`; nijedan test ne koristi production projekat. | — |
| §2.5 | POS Simulator: samo folder, `README.md` i prazna HTML stranica. | Forme i mrežni pozivi su Iteracija 11. |
| §2.6, NFR-09 | Android projekat: Kotlin + Jetpack Compose, minSdk 26, compileSdk/targetSdk 35; jedna prazna početna aktivnost; bez QR skenera (i bez QR generatora, jer je to Iteracija 9). | SRS ne navodi doslovno compileSdk/targetSdk. To je izvedeno iz NFR-09 (smoke na API 26 i API 35) i odluke brief-a. |
| §12 | Seed `rewardDefinitions`: `CAR_WASH` (costPoints 50, active true), `SHOWER` (costPoints 30, active true), idempotentan, radi samo nad emulatorom. | Vrijednost `displayName` je BLOKIRANA otvorenim pitanjem P-1 (§12 u .docx-u je ćirilica, a brief traži latinicu). |
| §24 | Nazivi 9 kanonskih kolekcija kao konstante na jednom mjestu (`backend/src/podaci/kolekcije.js`), bez logike. | — |
| §26 | Express aplikacija sa base path `/api/v1`, bez ijednog business endpointa. | — |
| §27 | Standardni error body `{ "error": { "code", "message", "correlationId" } }`, svih 23 koda sa tačnim HTTP statusima kao konstante, centralni error handler, bez stack trace-a prema klijentu. | Uz to tehnička dopuna O-1: `NOT_FOUND` 404 i `INVALID_REQUEST` 422. |
| §25.1, §25.10, NFR-03 | `firebase/firestore.rules` sadrži SAMO default deny (`match /{document=**} { allow read, write: if false; }`). | Pune normativne politike §31 i RULE-T01 … T11 su Iteracija 8. |
| §30 RULE-T12 | Preliminarni rules smoke test (vidi P-2). | Konačna verzija ide u Iteraciju 8. |
| NFR-07, §3.4 (samo dio o logovanju) | Nijedan secret u repou: `.env.example` samo sa placeholder-ima, `.gitignore`; logger nikad ne loguje `Authorization` ni `X-POS-API-Key`. | Sama POS autentikacija je Iteracija 3. |

## 2. SRS zahtjevi van opsega

| SRS | Iteracija | Zašto nije sada |
|---|---|---|
| §1.3 (sve), §22 FCM, §33.3 production hosting | nikad | Van opsega SRS-a ili CLAUDE.md. |
| §3.3, NFR-01: verifikacija Firebase ID tokena | 2 | Brief, tačka 3. |
| §3.4, NFR-02: X-POS-API-Key → stationId | 3 (+6) | Brief, tačka 3. U i01 važi samo zabrana logovanja zaglavlja. |
| §3.5, §3.6: Auth konfiguracija i password policy | 9, 10 | Android/Firebase konzola. |
| §4 UI-01 … UI-08, AUTH-06 … AUTH-09, QR-01 … QR-06, NFR-08, NFR-10 | 9, 10 | Android ekrani, Firebase zavisnosti, google-services plugin, QR. |
| §5 AUTH-01 … AUTH-05, AUTH-10, §26 API-01 | 2 | Account init. |
| §1.5, §7.3, §8, §9, §10, §26 API-02 | 3 | Purchase/EARN. |
| §7.4, §13, §14, §15, §17, §26 API-03, NFR-06 | 4 | Reward issue. |
| §16, §18, §19, §26 API-05, API-06 | 5 | Cancel/reconcile. |
| §7.5, §7.6, §20, §26 API-04 | 6 | Redemption. |
| §23, §26 API-07 | 7 | Account deletion. |
| §11, NFR-04, NFR-05: ledger, transakcije, idempotencija | 3–7 | Nema business transakcija u i01. |
| §21 notifikacije | 3, 8, 10 | — |
| §25.2 … §25.9, §31, RULE-T01 … RULE-T11 | 2–8, postepeno (odluka D-2): users i loyaltyAccounts u i02; purchases, notifications i loyaltyLedger u i03; vouchers, rewardDefinitions i rewardRequests u i04; redemptionRequests u i06; doslovna provjera §31 i 12/12 RULE testova u i08 | U i01 postoji samo default deny. |
| §2.5 POS forme i mrežni pozivi | 11 | — |
| Health/status ili bilo koji dodatni endpoint | nikad | §26: tačno 7 business endpointa. |
| GitHub Actions, admin portal | nikad | Brief, tačka 3. |

## 3. Zatečeno stanje repozitorijuma

Provjereno komandama `git fetch`, `git switch iteracija-01`, `git pull`, `git status` i `git ls-files`:

- Grana `iteracija-01` je ažurna sa `origin/iteracija-01`. Radni direktorijum je čist. Jedini commit je `4c13246 Priprema: SRS 3.1, pravila projekta, brief i01, početna matrica`.
- Praćeni fajlovi: `CLAUDE.md`, `.claude/settings.json` (attribution prazan, `includeCoAuthoredBy: false`), `docs/TRACEABILITY.md`, `docs/dizajn/*.png` (10 fajlova), `docs/dizajn/prototip.html`, `docs/iteracije/i01_brief.md`, `docs/srs/FuelPoints_SRS_3_1.docx`, `docs/srs/FuelPoints_SRS_3_1.md`.
- Ne postoje: `backend/`, `firebase/`, `pos-simulator/`, `android-app/`, `skripte/`, `firebase.json`, `.firebaserc`, `.gitignore`, `.gitattributes`, `.env.example`, `README.md`, `docs/IMPLEMENTATION_LOG.md` ni `docs/TEST_REPORT.md`.
- SHA-256 od `.docx`: `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`, što odgovara brief-u.
- Brief u zaglavlju kaže da je repo „prazan”. Važi stvarno stanje, kako je napisano iznad.

Okruženje na Aninom računaru (samo čitanje):

| Stavka | Vrijednost |
|---|---|
| `node -v` | v24.21.0 |
| `npm -v` | 11.19.0 |
| `java -version` (PATH) | Oracle Java 24.0.1. `JAVA_HOME` nije postavljen. |
| Android Studio | 2024.3.2 (build AI-243.26053.27…, `C:\Program Files\Android\Android Studio`), JBR 21.0.6 |
| Android SDK (`%LOCALAPPDATA%\Android\Sdk`) | platforms: android-26, 33, 34, 35; build-tools: 34.0.0, 35.0.0, 35.0.1, 36.0.0. `ANDROID_HOME` nije postavljen. |
| Gradle u kešu | 8.11.1-bin, 8.12-all |
| Firebase emulator keš | cloud-firestore-emulator-v1.22.0.jar, ui-v1.15.0 |
| PowerShell | 5.1.22621. ExecutionPolicy CurrentUser = RemoteSigned, pa lokalne `.ps1` skripte rade. |

## 4. Fajlovi (dodati / izmijeniti / netaknuto)

Legenda: **[D]** dodati, **[I]** izmijeniti, **[N]** netaknuto, **[A]** generiše Android Studio u ručnom koraku R-1, a Builder ga prilagođava.

```
/
├── .claude/settings.json                 [N] podešavanje alata (bez potpisa u commit-ima)
├── CLAUDE.md                             [N] pravila projekta
├── .gitignore                            [D] isključuje node_modules, .env*, ključeve, google-services.json, logove emulatora i Android build artefakte
├── .gitattributes                        [D] normalizacija kraja linija; *.docx/*.png/*.jar binary; gradlew eol=lf; *.bat eol=crlf
├── .env.example                          [D] spisak env varijabli sa placeholder vrijednostima, bez tajni
├── .firebaserc                           [D] podrazumijevani projekat demo-fuelpoints
├── firebase.json                         [D] emulatori Firestore 127.0.0.1:8080 i Auth 127.0.0.1:9099, putanja do rules i indexes
├── README.md                             [D] (srpski) preduslovi, pokretanje i komande za provjeru
├── skripte/
│   └── provjera.ps1                      [D] pokreće sve DoD provjere redom; exit code ≠ 0 na prvu grešku
├── backend/
│   ├── package.json                      [D] zavisnosti pinovane tačno; skripte start, test, test:emu, seed:emu
│   ├── package-lock.json                 [D] zaključane verzije (generiše npm install)
│   ├── src/
│   │   ├── aplikacija.js                 [D] fabrika napraviAplikaciju(opcije), bez listen: korelacija → JSON parser → /api/v1 → NOT_FOUND → centralni handler
│   │   ├── pokreni.js                    [D] ulazna tačka: ucitajKonfiguraciju (fail fast) → listen na 127.0.0.1:PORT
│   │   ├── dnevnik.js                    [D] logovanje grešaka kao JSON linija (correlationId, code, status, metod, putanja); nikad zaglavlja ni tijelo
│   │   ├── konfiguracija/
│   │   │   └── konfiguracija.js          [D] ucitajKonfiguraciju(env): obavezne varijable, validacija, greška imenuje samo varijablu, nikad vrijednost
│   │   ├── greske/
│   │   │   ├── katalogGresaka.js         [D] 23 koda iz §27 + NOT_FOUND/INVALID_REQUEST (O-1): kod, HTTP status, generička poruka (srpski, latinica), izvor
│   │   │   ├── GreskaApi.js              [D] klasa GreskaApi(kod) koja nosi samo kod iz kataloga (nepoznat kod → izuzetak pri konstrukciji)
│   │   │   └── obradaGresaka.js          [D] middleware nepoznataRuta (NOT_FOUND) i centralniRukovalacGreskama (§27 body, bez stack-a)
│   │   ├── posrednici/
│   │   │   └── korelacija.js             [D] dodjeljuje crypto.randomUUID() kao correlationId u res.locals za svaki zahtjev
│   │   ├── podaci/
│   │   │   └── kolekcije.js              [D] zamrznute konstante 9 kanonskih kolekcija iz §24
│   │   ├── firebase/
│   │   │   └── inicijalizacija.js        [D] inicijalizujFirebaseAdmin({ projectId }) → { db, auth } (Admin SDK)
│   │   └── punjenje/
│   │       ├── zastitaEmulatora.js       [D] provjeriEmulatorskoOkruzenje(env): odbija rad bez FIRESTORE_EMULATOR_HOST ili sa projektom koji ne počinje sa demo-
│   │       └── rewardDefinitions.js      [D] podaci iz §12 i napuniRewardDefinitions(db): deterministički set() oba dokumenta u jednom batch-u
│   ├── skripte/
│   │   └── napuniEmulator.js             [D] CLI za seed: zaštita → inicijalizacija → punjenje → exit code
│   └── test/
│       ├── pomocnici/
│       │   └── emulator.js               [D] provjera da je okruženje emulatorsko + ocistiEmulatore() (REST DELETE za Firestore i Auth)
│       ├── jedinicni/
│       │   ├── katalogGresaka.test.js    [D] I01-T01
│       │   ├── aplikacija.test.js        [D] I01-T02, I01-T03, I01-T04, I01-T05
│       │   └── konfiguracija.test.js     [D] I01-T06
│       └── emulator/
│           ├── adminSdk.test.js          [D] I01-T07
│           └── punjenje.test.js          [D] I01-T08, I01-T09
├── firebase/
│   ├── firestore.rules                   [D] samo default deny (NFR-03, §25.1, §25.10)
│   ├── firestore.indexes.json            [D] prazan skup indeksa ({"indexes": [], "fieldOverrides": []})
│   └── tests/
│       ├── package.json                  [D] @firebase/rules-unit-testing, firebase, firebase-tools (pinovani); skripta test
│       ├── package-lock.json             [D] zaključane verzije
│       └── podrazumijevanaZabrana.test.js [D] RULE-T12 (preliminarno)
├── pos-simulator/
│   ├── README.md                         [D] (srpski) svrha po §2.5 i napomena da forme dolaze u Iteraciji 11
│   └── index.html                        [D] prazna HTML stranica (naslov FuelPoints POS Simulator), bez formi i skripti
├── android-app/                          [A] projekat iz Android Studio čarobnjaka (ručni korak R-1)
│   ├── .gitignore                        [A] ostaje kako ga generiše Android Studio
│   ├── build.gradle.kts                  [A] ostaje
│   ├── settings.gradle.kts               [A] rootProject.name = "FuelPoints"
│   ├── gradle.properties                 [A] ostaje
│   ├── gradle/libs.versions.toml         [A] ostaje (verzije AGP/Kotlin/Compose iz šablona Android Studio-a 2024.3.2)
│   ├── gradle/wrapper/gradle-wrapper.jar [A] binarni fajl, commit-uje se
│   ├── gradle/wrapper/gradle-wrapper.properties [A] commit-uje se
│   ├── gradlew                           [A] eol=lf
│   ├── gradlew.bat                       [A] eol=crlf
│   └── app/
│       ├── build.gradle.kts              [A→I] provjeriti: minSdk 26, compileSdk 35, targetSdk 35, namespace/applicationId iz R-1
│       ├── proguard-rules.pro            [A] ostaje
│       └── src/
│           ├── main/AndroidManifest.xml  [A→I] activity android:name=".GlavnaAktivnost"
│           ├── main/java/<paket>/GlavnaAktivnost.kt [A→I] preimenovana MainActivity: ComponentActivity sa praznim Compose sadržajem
│           ├── main/java/<paket>/ui/theme/*  [A→obrisati] Color.kt/Theme.kt/Type.kt iz šablona (dizajn je Iteracija 9)
│           ├── main/res/**               [A] resursi šablona (ikone, strings.xml, themes.xml) ostaju
│           ├── test/…/ExampleUnitTest.kt [A→obrisati] trivijalni test šablona sa engleskim nazivom (vidi P-3)
│           └── androidTest/…/ExampleInstrumentedTest.kt [A→obrisati] isto
└── docs/
    ├── TRACEABILITY.md                   [I] SAMO kolone „Kod” i „Status” za stavke Iteracije 1
    ├── IMPLEMENTATION_LOG.md             [D] unos za i01: CHANGELOG, fajlovi, ograničenja
    ├── TEST_REPORT.md                    [D] stvarno izvršene komande i stvarni izlaz, datum, verzije alata
    ├── srs/FuelPoints_SRS_3_1.docx       [N] normativan, hash se provjerava
    ├── srs/FuelPoints_SRS_3_1.md         [N]
    ├── dizajn/*                          [N]
    └── iteracije/i01_brief.md            [N]; i01_plan.md (ovaj fajl, piše ga PLANNER)
```

Napomena o imenovanju: `index.html`, `README.md`, `package.json`, `firebase.json`, `.firebaserc`, `firestore.rules`, `firestore.indexes.json`, `AndroidManifest.xml`, `*.gradle.kts`, `gradlew*` i `libs.versions.toml` su konvencionalni fajlovi alata. Naziv `rewardDefinitions.js` sadrži SRS naziv kolekcije, pa ostaje na engleskom. Sve ostalo je na srpskom.

## 5. Data-flow i granice

### 5.1 Tok HTTP zahtjeva kroz Express (`napraviAplikaciju`)

Redoslijed middleware-a je obavezujući:

1. `app.disable('x-powered-by')`: ne otkriva internu tehnologiju u zaglavljima (isti cilj kao zabrana internih detalja iz §27).
2. **korelacija** (`posrednici/korelacija.js`): `res.locals.correlationId = crypto.randomUUID()`. Postavlja se PRIJE parsera, pa i greška parsiranja ima correlationId. Dolazni ID od klijenta se NE prihvata, jer klijent nije trusted, a SRS ga ne traži. Response zaglavlje se ne dodaje, jer to nije u §27.
3. **JSON parser**: `express.json()` sa podrazumijevanim limitom od 100 kb. Parsira samo `Content-Type: application/json`. Pošto je parser montiran na nivou aplikacije, neispravan JSON daje 422 i na nepoznatoj ruti (I01-T03 koristi `POST /api/v1/nepostojeca`).
4. **Ruter `/api/v1`**: `express.Router()` bez ijedne rute (§26: business endpointi dolaze u Iteracijama 2–7). Opcija `opcije.dodajRute(ruterApi)` se poziva SAMO iz testa I01-T04. `pokreni.js` poziva `napraviAplikaciju()` bez opcija, pa test ruta nikad ne postoji u produkcionoj aplikaciji.
5. **nepoznataRuta**: svaki zahtjev koji nije obrađen (nepoznata putanja, nepodržan HTTP metod, i putanje van `/api/v1`, npr. `GET /`) dobija `next(new GreskaApi('NOT_FOUND'))`.
6. **centralniRukovalacGreskama** (4 argumenta, posljednji u lancu):
   - `err instanceof GreskaApi` → status i poruka iz kataloga;
   - greška body-parser-a (`typeof err.type === 'string'` i `err.status` iz opsega 4xx, npr. `entity.parse.failed`) → `INVALID_REQUEST` 422 (O-1). Za ostale tipove body-parser-a vidi P-4;
   - sve ostalo → `INTERNAL_ERROR` 500. Originalna poruka i stack idu SAMO u serverski log;
   - odgovor: `res.status(http).json({ error: { code, message, correlationId } })`, tačno ta tri polja. `message` je uvijek generička poruka iz kataloga, nikad `err.message`;
   - ako je `res.headersSent`, poziva se `next(err)` (Express prekida konekciju; klijent ne dobija stack).
7. **Logovanje** (`dnevnik.js`): jedna JSON linija na `console.error` za svaki error odgovor: `{ vrijeme, nivo, correlationId, code, status, metod, putanja }`, gdje je `putanja = req.path` (bez query stringa). Samo za 500 dodaje se `stack` interne greške (server-side). Logger NEMA pristup objektu zaglavlja i nikad ne loguje `req.headers`, `Authorization`, `X-POS-API-Key` ni tijelo zahtjeva.
8. Express 5 automatski prosljeđuje odbijene promise-e iz async handlera u error handler. Zato nema „uncaught” grananja (bitno od Iteracije 2).

### 5.2 Učitavanje konfiguracije (fail fast)

- Izvor su SAMO environment varijable. `npm start` = `node --env-file-if-exists=../.env src/pokreni.js`. Ako `.env` ne postoji, ne puca Node, nego naša provjera, sa jasnom porukom. Varijable iz procesa imaju prednost nad `.env`, što je ponašanje Node-a.
- `ucitajKonfiguraciju(env)` je čista funkcija (prima objekat, ne čita `process.env` direktno) i vraća `Object.freeze({ port, projectId, host: '127.0.0.1' })`.
- Obavezne varijable u i01: `PORT` (cijeli broj 1–65535) i `FIREBASE_PROJECT_ID` (neprazan string).
- Kod greške baca `GreskaKonfiguracije` čija poruka sadrži samo NAZIV varijable i razlog („nedostaje obavezna varijabla PORT”, „varijabla PORT nema ispravan format”), nikad vrijednost. Sve nedostajuće varijable se prijavljuju odjednom.
- `pokreni.js` hvata grešku, ispisuje `Greška konfiguracije: …` na stderr i završava sa `process.exitCode = 1`, bez stack-a i bez listen-a.
- U i01 `pokreni.js` NE inicijalizuje Admin SDK, jer nijedna ruta ga ne koristi. Admin SDK se veže za aplikaciju u Iteraciji 2. U i01 ga koriste T07 i seed.

### 5.3 Tok seed skripte (`npm run seed:emu`)

```
node --env-file-if-exists=../.env skripte/napuniEmulator.js
  1. provjeriEmulatorskoOkruzenje(process.env)   ← PRIJE bilo kakvog importa/inicijalizacije Firestore klijenta
       - FIRESTORE_EMULATOR_HOST postavljen i neprazan, inače odbij;
       - FIREBASE_PROJECT_ID postavljen i počinje sa "demo-", inače odbij;
       - odbijanje: poruka na stderr (bez vrijednosti varijabli), exit code 1, nijedan mrežni poziv.
  2. inicijalizujFirebaseAdmin({ projectId })    ← Admin SDK sam čita FIRESTORE_EMULATOR_HOST
  3. napuniRewardDefinitions(db)                 ← jedan WriteBatch: set() bez merge za CAR_WASH i SHOWER
       - dokument sadrži TAČNO polja iz §12: displayName, costPoints, active;
       - ID-evi su deterministički (rewardId), pa je ponovno pokretanje idempotentno i vraća §12 vrijednosti.
  4. ispis "Upisano 2 dokumenta u rewardDefinitions." i exit code 0; greška → exit code 1 bez stack-a.
```

Seed pretpostavlja da emulator već radi (`npx firebase emulators:start …`, vidi README). Batch nije loyalty transakcija. To je samo atomičan upis kataloga, bez ledger eventa, jer §11 traži ledger samo za promjene loyalty stanja.

### 5.4 Transaction boundary

U i01 ne postoji nijedna Firestore transakcija ni promjena loyalty stanja (brief, tačka 3). Jedina „granica” je atomični batch u seed-u (5.3). Ledger se ne dira.

### 5.5 Testovi nad emulatorom

`firebase emulators:exec` pokreće Firestore (i Auth za backend), postavlja `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` i `GCLOUD_PROJECT`, pa izvršava `node --test --test-concurrency=1 …`. Kad se komanda završi, emulatori se gase. Vidi i 7.3.

## 6. Rizici (security / concurrency / idempotency)

| # | Rizik | Mjera | Dokaz |
|---|---|---|---|
| R1 | Curenje stack trace-a, putanja fajlova ili internih poruka klijentu | Centralni handler vraća samo poruku iz kataloga. `err.message` i `err.stack` nikad ne idu u odgovor. Za 500 je poruka generička. Express default handler se nikad ne dostiže, osim kod `headersSent`, kad tijelo već nije naše. | I01-T04 (sinhroni i async izuzetak sa porukom koja sadrži lažnu putanju i „tajnu”) |
| R2 | Logovanje `Authorization` / `X-POS-API-Key` | `dnevnik.js` prima samo eksplicitna polja (correlationId, code, status, metod, putanja). Zaglavlja i tijelo se ne prosljeđuju. Putanja je bez query stringa. | Dopunska asercija u I01-T04: zahtjev sa oba zaglavlja sa sentinel vrijednostima; uhvaćeni `console.error` izlaz ne sadrži sentinel vrijednosti |
| R3 | Secret-i u repou (.env, service account JSON, google-services.json, POS ključevi) | `.gitignore` (vidi 10.4), `.env.example` samo sa ne-tajnim vrijednostima i placeholder-ima. U i01 ne postoji nijedan secret, jer POS ključevi dolaze u i03, a service account se ne koristi uz emulator. | `provjera.ps1`: `git ls-files` + regex (DoD) i provjera da `.env.example` ne sadrži `PRIVATE KEY`/`private_key` |
| R4 | Seed ili test slučajno usmjeren na production | (a) seed zaštita prije inicijalizacije Admin SDK-a: `FIRESTORE_EMULATOR_HOST` mora postojati i projekat mora počinjati sa `demo-`; (b) `test/pomocnici/emulator.js` na vrhu svakog emulator test fajla provjerava `FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080'`, `FIREBASE_AUTH_EMULATOR_HOST === '127.0.0.1:9099'` i `GCLOUD_PROJECT` koji počinje sa `demo-`, inače baca grešku prije bilo kakvog poziva. Tako se emulator testovi ne mogu izvršiti „golim” `node --test` nad produkcijom; (c) svi emulator pozivi idu kroz `--project demo-fuelpoints` (prefiks `demo-` je Firebase garancija da se ne kontaktira nijedan stvarni resurs); (d) `ocistiEmulatore()` gađa SAMO `127.0.0.1` emulator REST endpoint. | I01-T09; implicitno T07/T08 |
| R5 | Neidempotentan seed (duplikati ili drift vrijednosti) | Deterministički ID-evi `CAR_WASH`/`SHOWER` i `set()` bez `merge`: drugo pokretanje vraća tačno §12 vrijednosti i ne pravi nove dokumente. | I01-T08 |
| R6 | Testovi dijele stanje emulatora (flaky, zavisnost od redoslijeda) | `--test-concurrency=1` (fajlovi serijski). Testovi unutar fajla su sekvencijalni (podrazumijevano u `node:test`). `beforeEach` → `ocistiEmulatore()` (Firestore + Auth). Rules testovi: `testEnv.clearFirestore()` u `beforeEach`. Backend i rules suite se izvršavaju jedna poslije druge, nikad paralelno (isti port 8080). | Stabilni ponovljeni prolazi; `provjera.ps1` serijski |
| R7 | Port 8080/9099 zauzet (npr. Ana ima pokrenut `emulators:start`), pa `emulators:exec` pada | `provjera.ps1` prije emulator koraka provjerava `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` i prekida sa jasnom porukom. | Ručno |
| R8 | Pogrešan JDK za Gradle (Java 24 na PATH-u; Gradle iz šablona Android Studio-a 2024.3.2 ne podržava pokretanje na Javi 24) | `provjera.ps1` u Android koraku postavlja `$env:JAVA_HOME` na JBR Android Studio-a (21.0.6), samo za taj proces. README to dokumentuje. Firebase emulatori traže JDK 21+, pa im Java 24 na PATH-u odgovara. | Android DoD komande |
| R9 | Dolazni `correlationId` od klijenta (log injection, lažno povezivanje) | Dolazni ID se ignoriše; uvijek `crypto.randomUUID()`. | I01-T05 |
| R10 | Test ruta za 500 procuri u produkcionu aplikaciju | Ruta se montira samo kroz `opcije.dodajRute`, koju poziva jedino test. `pokreni.js` ne prosljeđuje opcije. | Inspekcija (Reviewer) + I01-T02 (bez opcija, nepoznata ruta → 404) |
| R11 | Supply chain / nestabilne verzije | Tačne verzije (bez `^`), `package-lock.json` commit-ovan, `npm ci` u provjeri. Bira se posljednja verzija starija od 14 dana (vidi 10.1). | `npm ci` prolazi |
| R12 | Idempotency/concurrency business operacija | Nije primjenjivo u i01, jer nema business mutacija. | — |

## 7. Testovi

Svi testovi koriste `node:test` + `node:assert/strict`. Test naslovi počinju ID-em (npr. `test('I01-T02 nepoznata ruta → 404 NOT_FOUND', …)`), pa se rezultat može pratiti u TEST_REPORT-u.

### 7.1 Backend unit: `cd backend; npm test`, bez emulatora, bez mreže

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| I01-T01 | `test/jedinicni/katalogGresaka.test.js` | (1) Test sadrži sopstvenu tabelu 23 para `kod → HTTP`, prepisanu iz §27 normativnog .docx-a, i poredi je `deepStrictEqual` sa svim stavkama kataloga čiji je izvor `§27`. (2) Test parsira tabelu između naslova `# 27.` i `# 28.` u `docs/srs/FuelPoints_SRS_3_1.md` (samo čitanje) i provjerava da daje istih 23 para, čime otkriva drift kopije. (3) Dopuna O-1 je tačno `{ NOT_FOUND: 404, INVALID_REQUEST: 422 }`. (4) Ukupno 25 stavki; nema duplikata koda (katalog je definisan kao niz, pa provjera ima smisla). (5) Svaka stavka ima nepraznu poruku bez ćiriličnih znakova (srpski, latinica). (6) Katalog je zamrznut (`Object.isFrozen`). (7) Nijedan kod van tih 25 ne postoji. |
| I01-T02 | `test/jedinicni/aplikacija.test.js` | `GET /api/v1/nepostojeca` → status 404, `Content-Type` JSON, tijelo je tačno `{ error: { code: 'NOT_FOUND', message: <iz kataloga>, correlationId: <UUID v4> } }`. Provjerava se da `Object.keys(body) = ['error']` i `Object.keys(body.error) = ['code','message','correlationId']`. Dodatno: `DELETE /api/v1` (nepodržan metod) → 404 NOT_FOUND; `GET /` → 404 NOT_FOUND. |
| I01-T03 | isti fajl | `POST /api/v1/nepostojeca`, `Content-Type: application/json`, tijelo `{` → 422, `code: 'INVALID_REQUEST'`, tačno tri polja; poruka ne sadrži tekst greške JSON parsera (`JSON`, `position`, `Unexpected`). Dodatno (P-4): tijelo veće od limita parsera (100 kb) → 422 `INVALID_REQUEST`, tačno tri polja, bez teksta greške parsera. |
| I01-T04 | isti fajl | Aplikacija iz `napraviAplikaciju({ dodajRute })` sa test rutama: (a) `GET /api/v1/test-greska` baca `new Error('interna tajna poruka C:\\tajno\\putanja\\fajl.js')`; (b) `GET /api/v1/test-greska-async` vraća odbijen promise sa istom porukom. Oba → 500, `code: 'INTERNAL_ERROR'`, tačno tri polja. Sirovi tekst odgovora NE sadrži: `stack`, `interna tajna poruka`, `C:\\`, `.js`, `    at `. Dopunska asercija (R2): zahtjev šalje `Authorization: Bearer SENTINEL_AUTH_123` i `X-POS-API-Key: SENTINEL_POS_456`; `console.error` je presretnut (`mock.method(console, 'error')`); log sadrži correlationId odgovora, a ne sadrži nijedan sentinel. Isti zahtjevi bez `dodajRute` daju 404, što pokazuje da test rute nisu u podrazumijevanoj aplikaciji. |
| I01-T05 | isti fajl | Dva uzastopna `GET /api/v1/nepostojeca` → oba correlationId-a su UUID v4 i međusobno različiti. Zahtjev sa dolaznim zaglavljem `X-Correlation-Id: zadato` ne dobija tu vrijednost (R9). |
| I01-T06 | `test/jedinicni/konfiguracija.test.js` | (a) `ucitajKonfiguraciju({})` baca `GreskaKonfiguracije` koja navodi `PORT` i `FIREBASE_PROJECT_ID`. (b) `ucitajKonfiguraciju({ PORT: 'TAJNA_VRIJEDNOST_PORT', FIREBASE_PROJECT_ID: 'demo-tajna-xyz' })` baca grešku za format PORT-a, a poruka ne sadrži `TAJNA_VRIJEDNOST_PORT`. (c) Ispravne vrijednosti → zamrznut objekat `{ port: 3000, projectId, host: '127.0.0.1' }`. (d) `child_process.spawnSync(process.execPath, ['src/pokreni.js'], { env: { PATH, SystemRoot, FIREBASE_PROJECT_ID: 'demo-tajna-xyz' } })` bez `PORT` → exit code ≠ 0 u roku od 10 s (proces ne sluša), stderr sadrži `PORT`, a stderr i stdout ne sadrže `demo-tajna-xyz` ni `    at `. |

Komanda: `cd backend; npm test` → `node --test test/jedinicni/*.test.js`.

### 7.2 Backend nad emulatorom: `cd backend; npm run test:emu`

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| I01-T07 | `test/emulator/adminSdk.test.js` | Kroz `inicijalizujFirebaseAdmin({ projectId: process.env.GCLOUD_PROJECT })`: Firestore upisuje `probaI01/dok1` `{ tekst: 'proba', broj: 1 }`, čita isti sadržaj (`deepStrictEqual`), briše ga i potvrđuje da `exists === false`. Auth `createUser({ email: 'proba@primjer.test', password: 'Proba1234' })` → `getUser(uid)` vraća isti e-mail → `deleteUser(uid)` → `getUser` odbija sa `auth/user-not-found`. Kolekcija `probaI01` je samo testna i postoji samo u emulatoru. |
| I01-T08 | `test/emulator/punjenje.test.js` | CLI `node skripte/napuniEmulator.js` (spawn, env iz `emulators:exec` + `FIREBASE_PROJECT_ID=demo-fuelpoints`) pokrenut DVAPUT, oba puta exit 0. Poslije prvog: `rewardDefinitions` ima tačno 2 dokumenta; `CAR_WASH.data()` je `deepStrictEqual` `{ displayName: <P-1>, costPoints: 50, active: true }`, a `SHOWER` `{ displayName: <P-1>, costPoints: 30, active: true }`; nema dodatnih polja. Poslije drugog: isti broj dokumenata i identični `data()`. Plus: dokument izmijenjen ručno (`active: false`) prije trećeg pokretanja vraća se na §12 vrijednosti (deterministički seed). |
| I01-T09 | isti fajl | (a) Unit nivo: `provjeriEmulatorskoOkruzenje({ FIREBASE_PROJECT_ID: 'demo-fuelpoints' })` baca grešku; `provjeriEmulatorskoOkruzenje({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'fuelpoints-prod' })` baca grešku; ispravan par prolazi. (b) CLI bez `FIRESTORE_EMULATOR_HOST` (env sastavljen eksplicitno, bez nasljeđivanja) → exit 1, stderr objašnjava odbijanje i ne sadrži vrijednosti varijabli. (c) CLI sa emulator host-om, ali `FIREBASE_PROJECT_ID=fuelpoints-prod` → exit 1. (d) Poslije (b) i (c) emulator `rewardDefinitions` je prazan (0 dokumenata), dakle ništa nije upisano. |

Komanda: `cd backend; npm run test:emu`.

### 7.3 Čišćenje emulatora i serijsko izvršavanje

- `test/pomocnici/emulator.js` eksportuje:
  - `provjeriTestnoOkruzenje()`, koja se poziva na vrhu svakog emulator test fajla (R4);
  - `ocistiEmulatore()`, koja radi `fetch DELETE http://127.0.0.1:8080/emulator/v1/projects/${GCLOUD_PROJECT}/databases/(default)/documents` i `fetch DELETE http://127.0.0.1:9099/emulator/v1/projects/${GCLOUD_PROJECT}/accounts`, pa provjerava `response.ok` (inače baca grešku). Host je fiksno `127.0.0.1` (nikad iz env-a), a projekat mora počinjati sa `demo-`.
- Svaki emulator test fajl ima `beforeEach(ocistiEmulatore)`, a za Admin SDK `after()` → `deleteApp(app)` da proces ne visi.
- `--test-concurrency=1` u `test:emu` i u rules `test` skripti: fajlovi idu jedan po jedan. Testovi unutar fajla se ne označavaju sa `{ concurrency: true }`.
- Rules: `before` → `initializeTestEnvironment({ projectId: 'demo-fuelpoints', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8') } })`; `beforeEach` → `testEnv.clearFirestore()`; `after` → `testEnv.cleanup()`.

### 7.4 Rules: `cd firebase\tests; npm test`

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| RULE-T12 (preliminarno) | `firebase/tests/podrazumijevanaZabrana.test.js` | Samo ono što §30 navodi (internal/unknown kolekcije, P-2). Dokumenti se pripreme kroz `withSecurityRulesDisabled`: `rewardRequests/kljuc1`, `redemptionRequests/kljuc1`, `nepoznataKolekcija/dok1`. Za `unauthenticatedContext()` i `authenticatedContext('korisnikA')` se za svaki dokument radi `assertFails(getDoc)`, `assertFails(setDoc)` i `assertFails(deleteDoc)`, a za svaku od te tri kolekcije `assertFails(getDocs(collection(...)))` (list). Konačan oblik u Iteraciji 8. |
| I01-T10 | isti fajl | Default deny za kolekcije još bez pravila (P-2): `users/korisnikA` i `loyaltyLedger/dogadjaj1`, isti obim provjera kao RULE-T12 (unauthenticated i `authenticatedContext('korisnikA')`, vlasnik `users/korisnikA`; get, set, delete i list → DENY). Privremen: dio za `users` zamjenjuju RULE-T01–T05 u Iteraciji 2, a dio za `loyaltyLedger` RULE-T11 u Iteraciji 3. |

Komanda: `cd firebase\tests; npm test`.

### 7.5 Android

`.\gradlew.bat assembleDebug` i `.\gradlew.bat testDebugUnitTest` → BUILD SUCCESSFUL. U i01 nema Android testova sa SRS ili I01 ID-em (brief ih ne definiše). Vidi P-3.

## 8. Definition of Done

Iz brief-a (tačka 6), sa komandama (PowerShell, iz korijena repozitorijuma):

- [ ] Struktura kao u brief-u (tačka 5) i u sekciji 4. Nema TODO/FIXME:
  `git grep -n -E "TODO|FIXME" -- backend firebase pos-simulator skripte android-app/app/src README.md` daje prazan izlaz.
- [ ] `cd backend; npm ci; npm test; cd ..`: svi I01-T01 … I01-T06 PASS, exit 0.
- [ ] `cd backend; npm run test:emu; cd ..`: I01-T07 … I01-T09 PASS kroz `firebase emulators:exec` (Firestore + Auth, demo-fuelpoints), exit 0.
- [ ] `cd firebase\tests; npm ci; npm test; cd ..\..`: RULE-T12 (preliminarno) i I01-T10 PASS.
- [ ] `cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug; .\gradlew.bat testDebugUnitTest; cd ..`: oba BUILD SUCCESSFUL.
- [ ] `npm start` (uz `.env` kopiran iz `.env.example`) podiže server na `127.0.0.1:<PORT>`; `Invoke-WebRequest http://127.0.0.1:<PORT>/api/v1/nepostojeca -UseBasicParsing` → 404 sa `NOT_FOUND` body-jem. `/api/v1` nema business ruta (inspekcija `src/aplikacija.js`). Isto automatski radi `provjera.ps1` (smoke korak).
- [ ] Seed: I01-T08 (dvostruko pokretanje → tačno 2 dokumenta sa §12 vrijednostima) i I01-T09 (odbijanje bez emulatora / ne-demo projekat) PASS.
- [ ] Error body tačno po §27 (samo `code`, `message`, `correlationId`), bez stack trace-a, correlationId jedinstven po zahtjevu: I01-T02 … I01-T05 PASS.
- [ ] Katalog: 23 koda iz §27 + NOT_FOUND + INVALID_REQUEST sa tačnim HTTP statusima: I01-T01 PASS.
- [ ] `firebase/firestore.rules` = samo default deny (inspekcija) i RULE-T12 i I01-T10 zeleni.
- [ ] NFR-07: `git ls-files | Select-String -Pattern '(^|/)\.env$|service-?account|google-services\.json'` daje prazan izlaz; `.env.example` sadrži samo ne-tajne vrijednosti i placeholder-e.
- [ ] SRS nepromijenjen: `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` = `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`; `git diff main -- docs/srs` daje prazan izlaz.
- [ ] `.\skripte\provjera.ps1` pokreće sve gore navedeno redom, a `$LASTEXITCODE` je 0 (i ≠ 0 na prvu grešku; Builder to jednom ručno demonstrira, npr. privremeno pogrešnim očekivanim hash-om u lokalnoj kopiji bez commit-a, i upiše u TEST_REPORT).
- [ ] `docs/TRACEABILITY.md`: kolone „Kod” (i „Status”) popunjene za stavke Iteracije 1 (§2.1/§34.1, §2.3, §2.4, §2.5, §12, §24, §25/§31, §27, NFR-03, NFR-07). Ostale kolone i redovi su netaknuti.
- [ ] `docs/IMPLEMENTATION_LOG.md`: unos za i01 (CHANGELOG, fajlovi, ograničenja).
- [ ] `docs/TEST_REPORT.md`: stvarni izlaz komandi, datum, verzije Node/npm/Java (PATH i JBR)/firebase-tools/Gradle/AGP; PASS samo za stvarno izvršeno.
- [ ] `README.md` (srpski): preduslovi i komande.
- [ ] Svi commit-i bez potpisa alata, svaki push-ovan; PR `iteracija-01 → main` otvoren (bez merge-a).
- [ ] Reviewer: ITERATION ACCEPTED (bez P0/P1) → merge u main → anotirani tag `i01` → `git push --tags`. Ovo NE radi Builder u ovoj fazi.

## 9. Traceability (SRS → komponenta → test)

| SRS | Komponenta | Test |
|---|---|---|
| §2.1, §34.1 | `android-app/`, `backend/`, `pos-simulator/`, `firebase.json`, `firebase/firestore.rules` | I01-T07 (Admin SDK nad Firestore/Auth emulatorom), Android build, RULE-T12, I01-T10; inspekcija strukture |
| §2.3 | `backend/package.json` (express, firebase-admin, engines node 24), `backend/src/pokreni.js`, `backend/src/firebase/inicijalizacija.js` | I01-T07; npm start smoke u `provjera.ps1` |
| §2.4 | `firebase.json`, `.firebaserc`, `backend/test/pomocnici/emulator.js`, `backend/src/punjenje/zastitaEmulatora.js` | I01-T07, I01-T09 |
| §2.5 | `pos-simulator/README.md`, `pos-simulator/index.html` | inspekcija |
| §2.6, NFR-09 (priprema) | `android-app/app/build.gradle.kts` (minSdk 26, compileSdk/targetSdk 35), `GlavnaAktivnost.kt` | `assembleDebug`, `testDebugUnitTest` |
| §12 | `backend/src/punjenje/rewardDefinitions.js`, `backend/skripte/napuniEmulator.js` | I01-T08 |
| §24 | `backend/src/podaci/kolekcije.js` | inspekcija (RULE-T12 pokriva pristup) |
| §26 (base path) | `backend/src/aplikacija.js` | I01-T02 |
| §27 | `backend/src/greske/katalogGresaka.js`, `GreskaApi.js`, `obradaGresaka.js`, `posrednici/korelacija.js` | I01-T01 … I01-T05 |
| O-1 (tehnička dopuna, nije SRS kod) | `katalogGresaka.js` (NOT_FOUND, INVALID_REQUEST) | I01-T01, I01-T02, I01-T03 |
| §25.1, §25.9, §25.10, NFR-03 (default deny) | `firebase/firestore.rules` | RULE-T12 (preliminarno: internal/unknown kolekcije) |
| §25.1 (default deny za users i loyaltyLedger dok nemaju pravila) | `firebase/firestore.rules` | I01-T10 (privremen) |
| NFR-07, §3.4 (bez logovanja ključa) | `.gitignore`, `.env.example`, `backend/src/dnevnik.js`, `backend/src/konfiguracija/konfiguracija.js` | inspekcija u `provjera.ps1`; I01-T04 (dopunska log asercija); I01-T06 |

## 10. Tehničke odluke

### 10.1 Verzije paketa

Provjereno sa `npm view` 2026-10-14. Pravilo izbora: posljednja stabilna verzija objavljena prije najmanje 14 dana (zrelost, izbjegavanje tek objavljenih major izdanja). Sve verzije su pinovane tačno, bez `^`/`~`, a `package-lock.json` se commit-uje.

| Paket | Najnovija (datum) | **Izbor** | Obrazloženje |
|---|---|---|---|
| express | 5.3.0 (2026-10-09) | **5.2.1** (2025-12-01) | Express 5 je aktuelna glavna linija (`latest`); 4.x je samo održavanje (`latest-4`). Express 5 automatski prosljeđuje odbijene promise-e iz async handlera u error handler, a to je ključno za centralni §27 handler od i02, kad handleri postanu async Firestore transakcije. 5.3.0 je star 5 dana. |
| firebase-admin | 14.5.0 (2026-09-23) | **14.5.0** | Starija od 14 dana; engines `node >=22`. |
| firebase-tools | 15.33.0 (2026-10-08) | **15.32.1** (2026-09-30) | 15.33.0 je star 6 dana. Pinuje se kao devDependency i u `backend/` i u `firebase/tests/` (ista verzija), poziva se kroz npm skripte (lokalni `node_modules/.bin`). Emulatori traže JDK 21+, a na PATH-u je Java 24. |
| supertest | 7.3.1 (2026-10-02) | **7.3.0** (2026-09-22) | 7.3.1 je star 12 dana. |
| @firebase/rules-unit-testing | 6.0.0 (2026-10-07) | **5.0.2** (2026-08-19) | 6.0.0 je novo major izdanje staro 7 dana. Verzija 5.0.2 ima peer `firebase ^12.0.0` i engines `node >=20`. |
| firebase | 13.0.0 (2026-10-07) | **12.19.0** (2026-09-09) | Peer zavisnost za rules-unit-testing 5.x (`^12.0.0`). Koristi se samo u `firebase/tests`, nikad u backend-u. |

`engines` u oba package.json: `"node": ">=24.12.0 <25"` (Node 24 LTS; Ana ima 24.21.0).

### 10.2 npm skripte

Svi paketi su `"private": true` i `"type": "module"` (ESM). npm na Windows-u izvršava skripte kroz `cmd.exe`, pa se glob `*.test.js` ne širi u ljusci, nego ga obrađuje sam `node --test` (Node 24 podržava glob). Unutrašnji navodnici su `\"` u JSON-u.

`backend/package.json`:

```json
"scripts": {
  "start": "node --env-file-if-exists=../.env src/pokreni.js",
  "test": "node --test test/jedinicni/*.test.js",
  "test:emu": "firebase emulators:exec --config ../firebase.json --project demo-fuelpoints --only firestore,auth \"node --test --test-concurrency=1 test/emulator/*.test.js\"",
  "seed:emu": "node --env-file-if-exists=../.env skripte/napuniEmulator.js"
}
```

`firebase/tests/package.json`:

```json
"scripts": {
  "test": "firebase emulators:exec --config ../../firebase.json --project demo-fuelpoints --only firestore \"node --test --test-concurrency=1 *.test.js\""
}
```

Napomene za Builder-a:
- `--config` je globalna opcija firebase CLI-ja. Putanje u `firebase.json` (rules, indexes) razrješavaju se relativno na direktorijum tog fajla. Builder to MORA potvrditi prvim stvarnim pokretanjem (emulator log mora prijaviti učitavanje `firebase/firestore.rules`). Ako se pokaže drugačije, ne izmišlja zaobilaznicu, nego upisuje nalaz u IMPLEMENTATION_LOG i javlja.
- Prvo pokretanje emulatora može preuzeti JAR (potreban internet), jer pinovana verzija firebase-tools možda traži drugu verziju Firestore emulatora od keširane v1.22.0.
- Ne dodaju se druge npm skripte.

### 10.3 `firebase.json`, `.firebaserc`, `.env.example`

`firebase.json`:

```json
{
  "firestore": {
    "rules": "firebase/firestore.rules",
    "indexes": "firebase/firestore.indexes.json"
  },
  "emulators": {
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "auth": { "host": "127.0.0.1", "port": 9099 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

Emulator UI je isključen, jer ga SRS ne traži, zauzima još jedan port i dodatno preuzimanje.

`.firebaserc`:

```json
{ "projects": { "default": "demo-fuelpoints" } }
```

`.env.example` (komentari na srpskom; samo ne-tajne vrijednosti):

```
# Kopirati u .env (korijen repozitorijuma): Copy-Item .env.example .env
# .env se NIKAD ne commit-uje. POS ključevi se dodaju tek u Iteraciji 3.
PORT=3000
FIREBASE_PROJECT_ID=demo-fuelpoints
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
```

`firebase/firestore.rules`:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 10.4 `.gitignore` i `.gitattributes`

`.gitignore`:

```
# Node
node_modules/
npm-debug.log*

# Okruženje i tajne (NFR-07)
.env
.env.*
!.env.example
*service-account*.json
*serviceAccount*.json
*-firebase-adminsdk-*.json
google-services.json

# Firebase emulator
firebase-debug.log
firebase-debug.*.log
firestore-debug.log
ui-debug.log
.firebase/

# Android / Gradle / IDE
.gradle/
build/
local.properties
.idea/
*.iml
.kotlin/
captures/
.cxx/
.externalNativeBuild/

# OS
Thumbs.db
.DS_Store
```

`.gitattributes`:

```
* text=auto
*.docx binary
*.png binary
*.jpg binary
*.jar binary
*.webp binary
gradlew text eol=lf
*.bat text eol=crlf
*.ps1 text eol=crlf
```

### 10.5 Android

Builder NE može pouzdano sam napraviti projekat, jer `gradle-wrapper.jar` je binarni fajl, Gradle nije instaliran globalno, a verzije AGP/Kotlin/Compose moraju odgovarati instaliranom Android Studio-u 2024.3.2. Zato projekat pravi Ana kroz čarobnjak (ručni korak R-1), a Builder poslije toga:

1. Provjerava `git status` (smiju biti samo nepraćeni fajlovi pod `android-app/`) i da `local.properties`, `.gradle/`, `.idea/` i `build/` nisu u `git status` (ignorisani).
2. U `android-app/app/build.gradle.kts` provjerava `minSdk = 26`, `compileSdk = 35`, `targetSdk = 35`, a ako šablon postavi drugačije, ispravlja na te vrijednosti. Verzije AGP/Kotlin/Compose BOM ostaju kako ih je postavio šablon i upisuju se u TEST_REPORT. Ne dodaje nijednu zavisnost (posebno ne Firebase ni google-services, jer su to Iteracije 9–10).
3. Preimenuje `MainActivity` u `GlavnaAktivnost` (fajl, klasa, `AndroidManifest.xml`). Sadržaj: `ComponentActivity` → `setContent { Box(Modifier.fillMaxSize()) }`, bez teksta i teme. Briše `Greeting` i `ui/theme/*.kt` (dizajn je Iteracija 9). XML tema u `res/values/themes.xml` ostaje, jer je manifest koristi.
4. Briše `ExampleUnitTest.kt` i `ExampleInstrumentedTest.kt` (P-3). Test zavisnosti u `libs.versions.toml` ostaju za Iteraciju 9.
5. Pokreće (JAVA_HOME = JBR) `.\gradlew.bat assembleDebug` i `.\gradlew.bat testDebugUnitTest`. Oba moraju dati BUILD SUCCESSFUL; `testDebugUnitTest` će prijaviti NO-SOURCE.
6. Commit-uje i wrapper (`gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, `gradle-wrapper.properties`). Prije commit-a provjerava `git check-attr -a android-app/gradlew android-app/gradlew.bat android-app/gradle/wrapper/gradle-wrapper.jar` (eol=lf / eol=crlf / binary).

JDK: Gradle se pokreće sa `$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'` (JBR 21.0.6), jer Java 24 sa PATH-a nije podržana u Gradle verziji iz šablona. Vrijednost se ne upisuje u repo (`org.gradle.java.home` u `gradle.properties` bi bila mašinski specifična putanja).

### 10.6 `skripte/provjera.ps1`

Kodiranje UTF-8 **sa BOM-om**, jer Windows PowerShell 5.1 inače pogrešno čita č/ć/š/ž/đ. Kraj linija CRLF. Kostur ponašanja:

- `Set-StrictMode -Version Latest`. `$ErrorActionPreference` se NE postavlja na `Stop` globalno, jer u PS 5.1 stderr nativnih komandi (java, npm, gradle) tada postaje terminirajuća greška. Umjesto toga, poslije SVAKE nativne komande provjerava se `$LASTEXITCODE`.
- Pomoćna funkcija `Korak($naziv, [scriptblock]$blok)`: ispis `==> $naziv`, izvršavanje, pa ako je `$LASTEXITCODE -ne 0` ili je blok bacio izuzetak: `NEUSPJEH: $naziv` i `exit 1`. `Pop-Location` ide u `finally`.
- Radni direktorijum je korijen repozitorijuma (`Split-Path -Parent $PSScriptRoot`). Svaki korak koji mijenja direktorijum koristi `Push-Location`/`Pop-Location`.

Redoslijed (prekid na prvu grešku):

1. **Alati**: `node -v` počinje sa `v24.`; `java -version` (kroz `cmd /c "java -version 2>&1"`) daje major ≥ 21; postoji `C:\Program Files\Android\Android Studio\jbr\bin\java.exe` (ili `$env:JAVA_HOME` već postavljen).
2. **SRS integritet**: SHA-256 `.docx`-a je jednak `7D866413…60228`.
3. **NFR-07**: `git ls-files | Select-String -Pattern '(^|/)\.env$|service-?account|google-services\.json'` daje prazan izlaz; `.env.example` ne sadrži `PRIVATE KEY` ni `private_key`.
4. **TODO/FIXME**: `git grep -n -E "TODO|FIXME" -- backend firebase pos-simulator skripte android-app/app/src README.md` mora biti prazno. `git grep` vraća 1 kad nema pogodaka, pa se tumači: 1 = OK, 0 = NEUSPJEH, ostalo = greška. Skripta mora isključiti sopstvenu liniju sa regex-om (npr. pretragom bez `skripte/provjera.ps1` putem pathspec `:!skripte/provjera.ps1`).
5. **Portovi**: 8080 i 9099 nisu u `Listen` stanju (`Get-NetTCPConnection`), inače poruka „zaustavi pokrenute emulatore”.
6. **Backend**: `npm ci`, `npm test`, `npm run test:emu` (u `backend/`).
7. **Backend start smoke**: `$env:PORT='3999'; $env:FIREBASE_PROJECT_ID='demo-fuelpoints'` (samo u procesu skripte); `Start-Process node -ArgumentList 'src/pokreni.js' -WorkingDirectory backend -PassThru -NoNewWindow`; do 10 s ponavlja `Invoke-WebRequest http://127.0.0.1:3999/api/v1/nepostojeca -UseBasicParsing`. U PS 5.1 404 baca izuzetak, pa se iz `$_.Exception.Response` čita status (404) i tijelo (`code` = `NOT_FOUND`). `Stop-Process` u `finally`.
8. **Rules**: `npm ci`, `npm test` (u `firebase/tests/`).
9. **Android**: ako `$env:JAVA_HOME` nije postavljen, postavlja se na JBR (samo u procesu); `.\gradlew.bat assembleDebug`, `.\gradlew.bat testDebugUnitTest` (u `android-app/`).
10. Ispis `SVE PROVJERE PROŠLE` i `exit 0`.

Pokretanje: `.\skripte\provjera.ps1`, pa `$LASTEXITCODE`. ExecutionPolicy RemoteSigned za CurrentUser je već postavljen.

### 10.7 Ostale odluke

- **Poruke kataloga** (srpski, latinica, generičke). Primjeri: NOT_FOUND „Traženi resurs ne postoji.”, INVALID_REQUEST „Zahtjev nije ispravan.”, INTERNAL_ERROR „Došlo je do neočekivane greške na serveru.” Za ostalih 22 koda Builder piše kratke generičke poruke u duhu kolone „Značenje” iz §27, bez internih detalja.
- **Struktura kataloga**: niz zamrznutih objekata `{ kod, http, poruka, izvor: '§27' | 'O-1' }` i iz njega izvedena zamrznuta mapa `KATALOG_GRESAKA[kod]`.
- **Konstante kolekcija** (§24): `export const KOLEKCIJE = Object.freeze({ users: 'users', loyaltyAccounts: 'loyaltyAccounts', purchases: 'purchases', loyaltyLedger: 'loyaltyLedger', rewardDefinitions: 'rewardDefinitions', vouchers: 'vouchers', notifications: 'notifications', rewardRequests: 'rewardRequests', redemptionRequests: 'redemptionRequests' })`. Ključevi i vrijednosti su tačni SRS nazivi. Seed koristi `KOLEKCIJE.rewardDefinitions`.
- **Listen**: `app.listen(port, '127.0.0.1')` i ispis `FuelPoints backend sluša na http://127.0.0.1:<port>/api/v1` (ispisuju se samo host i port, nikad druge varijable).
- **package/applicationId** (Android): `io.github.anaspasojevic.fuelpoints` (odluka P-5). SRS ga ne propisuje.

## 11. Ručni koraci za Anu

**R-1: Android projekat (OBAVEZNO, prije Builder-ovog koraka 11; najbolje prije početka Builder sesije).**
U Android Studio-u 2024.3.2: *File → New → New Project… → Phone and Tablet → Empty Activity → Next*:

| Polje | Vrijednost |
|---|---|
| Name | `FuelPoints` |
| Package name | `io.github.anaspasojevic.fuelpoints` (odluka P-5) |
| Save location | `C:\Users\Elitebook\fuelpoints02\android-app` |
| Language | Kotlin (Empty Activity je Compose/Kotlin šablon) |
| Minimum SDK | `API 26 ("Oreo"; Android 8.0)` |
| Build configuration language | `Kotlin DSL (build.gradle.kts) [Recommended]` |

*Finish* → sačekati da se Gradle sync završi bez greške → zatvoriti projekat (*File → Close Project*). NE pokretati aplikaciju, NE dodavati Firebase i NE commit-ovati ništa. Builder preuzima `android-app/` kao nepraćen folder. Ako čarobnjak ponudi compileSdk 36 (nije instaliran), ostaviti, jer Builder spušta na 35. Ako sync padne, poslati poruku greške Builder-u i ne popravljati ručno.

**R-2: `.env` za ručno pokretanje (opciono, za `npm start` i `npm run seed:emu`).**
`Copy-Item .env.example .env` u korijenu repozitorijuma. Fajl je ignorisan i ne commit-uje se.

**R-3: Internet pri prvom pokretanju emulatora.**
Prvi `npm run test:emu` / `npm test` u `firebase\tests` može preuzeti JAR Firestore emulatora u `%USERPROFILE%\.cache\firebase\emulators`.

**R-4: GitHub CLI za PR (ako nije prijavljen).**
Ako `gh auth status` kaže da Ana nije prijavljena, kucati `! gh auth login` u sesiji.

Napomena: `JAVA_HOME` NIJE potrebno trajno mijenjati. `provjera.ps1` ga postavlja samo za svoj proces. Za ručno pokretanje Gradle-a iz PowerShell-a: `$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'`.

## 12. Otvorena pitanja za Orchestrator-a

**P-1 (BLOKIRA korak 9: seed): `displayName` u §12, ćirilica ili latinica?**
Normativni `.docx` (provjereno direktno u `word/document.xml`) u tabeli §12 ima „Бесплатно прање” i „Бесплатан туш” (ćirilica). Brief (tačka 2) traži `"Besplatno pranje"` i `"Besplatan tuš"` (latinica). Po CLAUDE.md ima prednost SRS, ali je moguće da je tabela u SRS-u samo opis na jeziku dokumenta, a da je stvarna vrijednost podatka namjerno latinična (Android UI je na latinici). Ne pomirujem sam. Opcije: (a) tačno kao u .docx-u (ćirilica); (b) latinica kao u brief-u, uz eksplicitnu odluku Orchestrator-a upisanu kao O-2 u TRACEABILITY. Do odgovora Builder radi sve korake osim koraka 9.

**P-2: Opseg RULE-T12 (preliminarno).**
§30 definiše RULE-T12 kao „Client access nad internal/unknown collection → DENY”. Brief pod RULE-T12 navodi `users`, `loyaltyLedger` i nepoznatu kolekciju, a to su u §30 sadržaji RULE-T01/T03 (users) i RULE-T11 (loyaltyLedger). Plan uključuje i `rewardRequests`/`redemptionRequests`, jer ih §30 RULE-T12 imenuje. Pitanja: (1) da li je u redu da se `users`/`loyaltyLedger` asercije u i01 vode pod oznakom RULE-T12, iako su u §30 druge oznake? (2) Potvrda da se u Iteraciji 8 owner read `users/{uid}` mijenja u ALLOW (RULE-T02, §31), pa se taj dio preliminarnog testa tada uklanja ili seli, a RULE-T12 ostaje samo internal/unknown.

**P-3: Android test u i01.**
Brief traži da `testDebugUnitTest` bude BUILD SUCCESSFUL, ali ne definiše nijedan Android test. Plan briše šablonske `ExampleUnitTest`/`ExampleInstrumentedTest` (engleski nazivi, trivijalni 2+2 test koji nema veze sa SRS-om), pa `testDebugUnitTest` prolazi kao NO-SOURCE. Da li je to prihvatljivo, ili Orchestrator želi jedan dopunski test (npr. I01-T10) ili zadržavanje preimenovanog šablonskog testa?

**P-4: Ostale greške body-parser-a.**
O-1 pokriva „neispravan JSON body” (INVALID_REQUEST 422) i zabranjuje druge kodove. body-parser može prijaviti i preveliko tijelo (413, `entity.too.large`), nepodržan charset/encoding (415) i prekinut zahtjev (400, `request.aborted`). Prijedlog: sve greške body-parser-a (4xx sa `err.type`) → INVALID_REQUEST 422, jer nijedan drugi kod nije dozvoljen. Potrebna je potvrda; do tada Builder radi po prijedlogu i to bilježi u IMPLEMENTATION_LOG.

**P-5: Android package name / applicationId.**
SRS ga ne propisuje. Predlog: `org.unibl.pmf.fuelpoints`. Ana/Orchestrator neka potvrdi prije R-1, jer se kasnije teže mijenja (i Firebase registracija aplikacije u Iteraciji 9 zavisi od njega).

**P-6: Sljedivost za I01-T06.**
TRACEABILITY nema red ni planirani test za I01-T06 (konfiguracija fail fast). Builder smije mijenjati samo kolone „Kod” i „Status”. Da li Orchestrator dodaje I01-T06 u kolonu „Planirani test” reda NFR-07 (ili §2.3), ili se T06 vodi samo u TEST_REPORT-u?

**P-7 (informativno, za kasnije iteracije, ne blokira i01): seed van emulatora.**
§3.5 (Email Enumeration Protection) i §3.6 (password policy „Require”) se podešavaju u stvarnom Firebase projektu; Auth emulator ih ne sprovodi. Ako se demo/odbrana radi nad stvarnim projektom, `rewardDefinitions` će trebati upisati i tamo, a brief i01 zabranjuje seed van emulatora. Potrebna je odluka do Iteracije 9.

**P-8 (informativno): verzije paketa.**
Uputstvo PLANNER-u kaže „provjeri sa npm view”. Plan namjerno NE uzima najnovije verzije gdje su mlađe od 14 dana (express 5.3.0, firebase-tools 15.33.0, supertest 7.3.1, firebase 13 / rules-unit-testing 6), nego posljednje zrelije (sekcija 10.1). Ako Orchestrator želi najnovije, mijenja se samo tabela 10.1.

## 13. IMPLEMENTATION PLAN za Builder-a

Opšte za svaki korak: poslije commit-a odmah `git push`. Commit poruke su bez potpisa alata. Prije commit-a `git status` mora pokazivati samo fajlove tog koraka. `npm install` se koristi samo za generisanje lock fajla sa tačnim verzijama (`npm install --save-exact`); provjere idu kroz `npm ci`.

**Korak 1: Osnova repozitorijuma i konfiguracija emulatora**
- Fajlovi: `.gitignore`, `.gitattributes`, `.env.example`, `.firebaserc`, `firebase.json`, `firebase/firestore.indexes.json`.
- Šta: sadržaj tačno po 10.3 i 10.4.
- Dokaz: `git check-attr -a docs/srs/FuelPoints_SRS_3_1.docx` → `binary`; `git ls-files | Select-String '(^|/)\.env$'` prazno; `git status` bez promjena na `docs/srs`.
- Commit: `i01: gitignore, gitattributes, env primjer i konfiguracija emulatora`

**Korak 2: Default deny pravila, RULE-T12 (preliminarno) i I01-T10**
- Fajlovi: `firebase/firestore.rules`, `firebase/tests/package.json`, `firebase/tests/package-lock.json`, `firebase/tests/podrazumijevanaZabrana.test.js`.
- Šta: prvo testovi (7.4: RULE-T12 i I01-T10, podjela po P-2), pa rules po 10.3; `npm install --save-exact` verzija iz 10.1; skripta `test` po 10.2. Potvrditi u logu emulatora da je učitan `firebase/firestore.rules`.
- Dokaz: `cd firebase\tests; npm ci; npm test` → RULE-T12 i I01-T10 PASS. Kontrola: privremena lokalna izmjena rules u `allow read: if true` (bez commit-a) mora oboriti test; vratiti i zabilježiti u TEST_REPORT.
- Commit: `i01: default deny pravila i RULE-T12 (preliminarno)`

**Korak 3: Backend paket i testni pomoćnici**
- Fajlovi: `backend/package.json`, `backend/package-lock.json`, `backend/test/pomocnici/emulator.js`.
- Šta: zavisnosti (express 5.2.1, firebase-admin 14.5.0; dev: firebase-tools 15.32.1, supertest 7.3.0), `type: module`, `engines`, skripte tačno po 10.2; pomoćnici `provjeriTestnoOkruzenje()` i `ocistiEmulatore()` po 7.3.
- Dokaz: `cd backend; npm ci` uspijeva. Pomoćnici se koriste u koracima 8–9.
- Commit: `i01: backend paket i pomoćnici za emulator testove`

**Korak 4: Katalog grešaka (I01-T01)**
- Fajlovi: `backend/test/jedinicni/katalogGresaka.test.js`, zatim `backend/src/greske/katalogGresaka.js`.
- Šta: test po 7.1 (crven), pa katalog (23 + O-1) po 10.7 (zelen).
- Dokaz: `npm test` → I01-T01 PASS.
- Commit: `i01: katalog grešaka po §27 i dopuna O-1 (I01-T01)`

**Korak 5: Express aplikacija, correlationId i centralni error handler (I01-T02 … I01-T05)**
- Fajlovi: `backend/test/jedinicni/aplikacija.test.js`, zatim `backend/src/aplikacija.js`, `backend/src/posrednici/korelacija.js`, `backend/src/greske/GreskaApi.js`, `backend/src/greske/obradaGresaka.js`, `backend/src/dnevnik.js`.
- Šta: testovi po 7.1, pa implementacija toka iz 5.1 (redoslijed middleware-a obavezujući; `dodajRute` samo kao opcija fabrike; P-4 prijedlog za body-parser greške).
- Dokaz: `npm test` → I01-T01 … I01-T05 PASS.
- Commit: `i01: Express fabrika sa /api/v1, correlationId i error handler po §27 (I01-T02–T05)`

**Korak 6: Konfiguracija i ulazna tačka (I01-T06)**
- Fajlovi: `backend/test/jedinicni/konfiguracija.test.js`, zatim `backend/src/konfiguracija/konfiguracija.js`, `backend/src/pokreni.js`.
- Šta: po 5.2 i 10.7 (listen na 127.0.0.1).
- Dokaz: `npm test` → I01-T01 … I01-T06 PASS; ručno `Copy-Item .env.example .env` (lokalno, ignorisan) → `npm start` → `Invoke-WebRequest http://127.0.0.1:3000/api/v1/nepostojeca -UseBasicParsing` → 404 NOT_FOUND; izlaz u TEST_REPORT.
- Commit: `i01: konfiguracija iz env varijabli sa fail fast i ulazna tačka (I01-T06)`

**Korak 7: Kanonske kolekcije i Admin SDK nad emulatorom (I01-T07)**
- Fajlovi: `backend/src/podaci/kolekcije.js`, `backend/test/emulator/adminSdk.test.js`, `backend/src/firebase/inicijalizacija.js`.
- Šta: konstante §24 po 10.7; test po 7.2; `inicijalizujFirebaseAdmin({ projectId })` vraća `{ app, db, auth }` (named app da više testova ne kolidira; `deleteApp` u `after`).
- Dokaz: `npm run test:emu` → I01-T07 PASS.
- Commit: `i01: kanonske kolekcije po §24 i Admin SDK nad emulatorom (I01-T07)`

**Korak 8: Zaštita samo-emulator za seed (I01-T09)**
- Fajlovi: `backend/test/emulator/punjenje.test.js` (dio za T09), `backend/src/punjenje/zastitaEmulatora.js`, `backend/skripte/napuniEmulator.js` (zaštita + inicijalizacija; poziv punjenja se dodaje u koraku 9).
- Šta: po 5.3 (koraci 1–2) i 7.2 (T09).
- Dokaz: `npm run test:emu` → I01-T07, I01-T09 PASS.
- Commit: `i01: seed odbija rad van emulatora i van demo projekta (I01-T09)`

**Korak 9: Seed rewardDefinitions po §12 (I01-T08). BLOKIRANO DO ODGOVORA NA P-1**
- Fajlovi: `backend/test/emulator/punjenje.test.js` (dio za T08), `backend/src/punjenje/rewardDefinitions.js`, `backend/skripte/napuniEmulator.js`.
- Šta: po 5.3 (koraci 3–4) i 7.2 (T08), sa `displayName` vrijednostima iz odgovora na P-1.
- Dokaz: `npm run test:emu` → I01-T07 … I01-T09 PASS.
- Commit: `i01: idempotentan seed rewardDefinitions po §12 (I01-T08)`

**Korak 10: POS Simulator kostur**
- Fajlovi: `pos-simulator/README.md`, `pos-simulator/index.html`.
- Šta: README (srpski: svrha po §2.5 i §33.2, forme u Iteraciji 11); `index.html`: `<!doctype html>`, `lang="sr-Latn"`, `<meta charset="utf-8">`, `<title>FuelPoints POS Simulator</title>` i prazan `<body>`, bez `<form>` i `<script>`.
- Dokaz: inspekcija (`Select-String -Path pos-simulator\index.html -Pattern '<form|<script|fetch'` → prazno).
- Commit: `i01: kostur POS Simulator-a po §2.5`

**Korak 11: Android projekat (preduslov R-1)**
- Fajlovi: `android-app/**` iz R-1, uz izmjene iz 10.5 (minSdk/compileSdk/targetSdk, `GlavnaAktivnost.kt`, `AndroidManifest.xml`, brisanje `ui/theme/*`, `Example*Test.kt`).
- Šta: tačno 10.5, koraci 1–6. Ako `android-app/` ne postoji, Builder STAJE i traži R-1.
- Dokaz: `cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug; .\gradlew.bat testDebugUnitTest` → oba BUILD SUCCESSFUL; `git ls-files android-app | Select-String 'local.properties|/build/|\.idea'` prazno.
- Commit: `i01: Android projekat (Kotlin, Compose, minSdk 26, target 35) sa Gradle wrapper-om`

**Korak 12: Skripta provjere i README**
- Fajlovi: `skripte/provjera.ps1` (UTF-8 sa BOM-om, CRLF), `README.md`.
- Šta: skripta tačno po 10.6. README (srpski): preduslovi (Node 24 LTS, JDK 21+ za emulatore, Android Studio + SDK 35, JBR za Gradle), struktura, `.env`, pokretanje emulatora (`cd backend; npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth`), `npm start`, `npm run seed:emu`, sve test komande, `provjera.ps1`.
- Dokaz: `.\skripte\provjera.ps1; $LASTEXITCODE` → 0. Jednom demonstrirati ≠ 0 (privremena lokalna izmjena bez commit-a, npr. pogrešan očekivani hash) i zabilježiti.
- Commit: `i01: skripta provjera.ps1 i README`

**Korak 13: Dokumentacija checkpoint-a**
- Fajlovi: `docs/TEST_REPORT.md` [D], `docs/IMPLEMENTATION_LOG.md` [D], `docs/TRACEABILITY.md` [I, samo „Kod” i „Status”].
- Šta: TEST_REPORT sa stvarnim izlazom svih komandi iz brief-a (tačka 8) i `provjera.ps1`, datumom i verzijama (node, npm, java PATH + JBR, firebase-tools, Gradle, AGP, Kotlin), PASS samo za izvršeno, NO-SOURCE za Android unit testove eksplicitno navedeno. IMPLEMENTATION_LOG: CHANGELOG i01, spisak fajlova, poznata ograničenja (P-1 … P-8 status, NO-SOURCE, JDK napomena). TRACEABILITY: putanje i status `PASS (TEST_REPORT i01)` samo za stavke čiji su testovi stvarno prošli.
- Dokaz: `git diff --stat main -- docs/srs` prazno; `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` = očekivani.
- Commit: `i01: TEST_REPORT, IMPLEMENTATION_LOG i sljedivost za iteraciju 1`

**Korak 14: Pull request**
- Šta: `gh pr create --base main --head iteracija-01 --title "i01: Bootstrap i test infrastruktura"` sa opisom na srpskom (isporuka A–G iz brief-a, tačka 9; bez potpisa alata). BEZ merge-a i BEZ taga, jer to dolazi tek poslije ITERATION ACCEPTED.
- Commit: nema.

## 14. Odluke Orchestrator-a (odobrenje plana)

Plan je ODOBREN (Orchestrator, 2026-10-15) uz ispravke K-1 … K-4.

P-1 Seed displayName je latinicom: CAR_WASH "Besplatno pranje", SHOWER "Besplatan tuš".
    Odluku je donijela Ana (autor SRS-a): tabela §12 ispisuje naziv pismom dokumenta, a vrijednost
    podatka je tekst koji se prikazuje u aplikaciji, na latinici (kao poruka u §3.5). Korak 9 je deblokiran.
    U TRACEABILITY se vodi kao "odluka i01/P-1".
P-2 RULE-T12 (preliminarno) obuhvata samo ono što §30 navodi: internal i unknown kolekcije —
    rewardRequests, redemptionRequests i nepoznata kolekcija; unauthenticated i authenticated
    get, set, delete i list → DENY.
    Asercije za users i loyaltyLedger izdvajaju se u dopunski test I01-T10 "default deny za kolekcije
    još bez pravila" (isti fajl, isti obim provjera). I01-T10 je privremen: dio za users zamjenjuju
    RULE-T01–T05 u Iteraciji 2, a dio za loyaltyLedger RULE-T11 u Iteraciji 3.
    RULE-T12 konačan oblik dobija u Iteraciji 8.
P-3 Android u i01 nema testova. Šablonski Example*Test.kt se brišu; testDebugUnitTest sa NO-SOURCE
    i BUILD SUCCESSFUL ispunjava DoD. U TEST_REPORT se NO-SOURCE navodi eksplicitno.
P-4 Svaka greška body-parser-a (4xx sa err.type: neispravan JSON, preveliko tijelo, nepodržan
    charset/encoding, prekinut zahtjev) → INVALID_REQUEST 422. Drugi kodovi se ne uvode (O-1).
P-5 Android namespace/applicationId: io.github.anaspasojevic.fuelpoints.
P-6 U docs/TRACEABILITY.md Builder smije, samo za redove Iteracije 1, dopuniti kolonu
    "Planirani test" stvarnim I01 oznakama (npr. I01-T06 u redove §2.3 i NFR-07; I01-T10 u red §25/§31),
    pored kolona "Kod" i "Status". Ostali redovi i kolone ostaju netaknuti.
P-7 Seed u i01 radi isključivo nad emulatorom. Odluka o demo okruženju (emulator ili stvarni
    Firebase projekat, zbog §3.5/§3.6) donosi se prije Iteracije 9 (otvoreno pitanje O-2).
P-8 Prihvaćeno pravilo "posljednja stabilna verzija starija od 14 dana"; verzije iz 10.1 ostaju.

K-1 Sekcija 2, red "§25.2 … §25.9, §31, RULE-T01 … RULE-T11": umjesto "8" piše "2–8, postepeno
    (odluka D-2): users i loyaltyAccounts u i02; purchases, notifications i loyaltyLedger u i03;
    vouchers, rewardDefinitions i rewardRequests u i04; redemptionRequests u i06; doslovna provjera
    §31 i 12/12 RULE testova u i08".
K-2 Sekcije 7.4, 8, 9 i korak 2: podjela RULE-T12 / I01-T10 prema P-2.
K-3 Sekcije 10.7 i 11 (R-1): package name io.github.anaspasojevic.fuelpoints.
K-4 Sekcija 7.1, I01-T03: dodaje se slučaj tijela većeg od limita parsera → 422 INVALID_REQUEST,
    tačno tri polja, bez teksta greške parsera (P-4).
