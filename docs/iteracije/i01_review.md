# i01 — Adversarial review (REVIEWER)

## 1. Pregledano stanje (grana, commit 1399934, datum, verzije alata)

- Grana: `iteracija-01` (PR #1 → `main`), `git rev-parse --short HEAD` → `1399934`; `git status` → čisto prije i poslije pregleda.
- Datum pregleda: 2026-10-15. Windows 11 Pro 10.0.22621, Windows PowerShell 5.1.
- Verzije alata (stvarni izlaz):

| Alat | Komanda | Izlaz |
|---|---|---|
| Node.js | `node -v` | `v24.21.0` |
| npm | `npm -v` | `11.19.0` |
| Java na PATH-u | `java -version` | `java version "24.0.1" 2025-04-15` (Oracle `javapath` posrednik) |
| Java za emulatore/Gradle | JBR Android Studio-a | `21.0.6` (Launcher JVM iz `gradlew --version`) |
| firebase-tools | `npx firebase --version` (backend) | `15.32.1` |
| Gradle | `.\gradlew.bat --version` | `Gradle 8.11.1` |

- Pročitano u cjelini: `CLAUDE.md`, `docs/iteracije/i01_brief.md`, SRS (.md) §1.3, §2, §3, §12, §24–§27, §28, §30, §31, §34;
  sav kod i testovi u `backend/`, `firebase/`, `pos-simulator/`, `android-app/`, `skripte/`, te `firebase.json`, `.firebaserc`,
  `.gitignore`, `.gitattributes`, `.env.example`, `README.md`. Tabela §27 je dodatno izvučena direktno iz normativnog `.docx`-a.
- `docs/iteracije/i01_plan.md`, opis PR-a i obrazloženja Builder-a nisu korišćeni kao dokaz. TEST_REPORT, IMPLEMENTATION_LOG
  i TRACEABILITY su čitani tek u Fazi B.

## 2. Izvršene provjere (komanda → stvarni rezultat, uključujući mutacione dokaze)

Privremeni fajlovi (skripte napada i mutacija) su bili van repozitorijuma (scratchpad). Svaka mutacija je vraćena sa
`git restore`; poslije svih eksperimenata `git status --short` je prazan. Lokalni `.env` je napravljen za `npm start`/seed i obrisan.

### 2.1 Priprema, SRS integritet, tajne

| Komanda | Rezultat |
|---|---|
| `git fetch origin; git switch iteracija-01; git pull; git rev-parse --short HEAD` | `1399934`, „Already up to date” |
| `git diff --stat main..HEAD -- docs/srs` | prazno |
| `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (odgovara) |
| `git ls-files \| Select-String '(^\|/)\.env$\|service-?account\|google-services\.json'` | prazno |
| `git log -p --all -- . \| Select-String 'private_key','BEGIN PRIVATE KEY','AIza','apiKey','google-services','\.env'` | pogoci su isključivo dokumentacija, `.gitignore` pravila, imena env varijabli i `@pnpm/config.env-replace` iz lock fajla; nijedan ključ, nijedan `AIza…`, nijedan `private_key` sadržaj |
| `git log --all --name-only` (imena fajlova u istoriji) | nema `.env`, service account JSON ni `google-services.json` ni u jednom commit-u |
| `git log --all --format=%B \| Select-String 'Co-Authored\|Claude\|Generated\|AI '` | prazno; autor svih commit-a `anaspasojevic` |
| `git grep` za `googleapis\|firebaseio\|.web.app\|fuelpoints-[a-z0-9]+` | samo nazivi paketa i fiktivni `fuelpoints-prod` u negativnom testu I01-T09; `.firebaserc` = `demo-fuelpoints`, `.env.example` = `demo-fuelpoints` |
| `git grep -E 'runTransaction\|FieldValue\|increment(\|verifyIdToken\|X-POS\|router.(post\|get…)\|/health\|/status\|fcm\|messaging'` u `backend/src`, `backend/skripte`, rules, `pos-simulator`, `android-app/app` | jedini pogodak je komentar u `backend/src/dnevnik.js:2`; nema business endpointa, transakcija, verifikacije tokena, POS auth-a, FCM-a |
| `git grep -n -E 'TODO\|FIXME'` (bez SRS/iteracija) | samo `CLAUDE.md` (pravilo), dokumenti i sama provjera u `provjera.ps1`; nema u kodu |
| `git ls-files \| Select-String 'local\.properties\|/build/\|\.idea\|\.github\|\.iml$'` | prazno (nema GitHub Actions ni IDE/build artefakata) |
| `.claude/settings.json` | postoji od `main` (commit `4c13246`, priprema), nije dio ovog PR-a |

### 2.2 Katalog grešaka (nezavisno od Builder-ovog testa)

- Iz `.docx` (`word/document.xml`, sekcija „ERROR CATALOG”) izvučeno 23 para:
  `UNAUTHENTICATED=401, UNAUTHENTICATED_POS=401, FORBIDDEN=403, ACCOUNT_NOT_INITIALIZED=409, ACCOUNT_DELETION_IN_PROGRESS=409,
  REAUTHENTICATION_REQUIRED=409, INVALID_DISPLAY_NAME=422, INVALID_TRANSACTION_ID=422, INVALID_VOLUME=422, INVALID_AMOUNT=422,
  UNSUPPORTED_CURRENCY=422, INVALID_OCCURRED_AT=422, LOYALTY_ACCOUNT_NOT_FOUND=404, IDEMPOTENCY_CONFLICT=409, REWARD_NOT_FOUND=404,
  REWARD_INACTIVE=409, INSUFFICIENT_POINTS=409, VOUCHER_NOT_FOUND=404, VOUCHER_EXPIRED=409, VOUCHER_CANCELLED=409,
  VOUCHER_ALREADY_REDEEMED=409, INTERNAL_ERROR=500, SERVICE_UNAVAILABLE=503`.
- Ručno upoređeno sa `backend/src/greske/katalogGresaka.js:10-32` i sa .md tabelom §27: identično, red po red.
  Dopuna je tačno `NOT_FOUND 404` i `INVALID_REQUEST 422` (`katalogGresaka.js:33-34`), izvor označen `O-1`. Nema drugih kodova.

### 2.3 Napadi na error handler (pokrenut `npm start` uz lokalni `.env`, sirovi TCP zahtjevi)

`npm start` → `FuelPoints backend sluša na http://127.0.0.1:3000/api/v1`. Rezultat probne skripte (sirovi HTTP, da URL ostane neizmijenjen):

| Zahtjev | Status | Body | Napomena |
|---|---|---|---|
| `GET /api/v1/nepostojeca` | 404 | `{error:{code,message,correlationId}}`, `NOT_FOUND` | tačno tri polja |
| `GET /` | 404 | isto, `NOT_FOUND` | |
| `DELETE /api/v1` | 404 | isto, `NOT_FOUND` | |
| `HEAD /api/v1` | 404 | prazno (HTTP semantika HEAD-a), `Content-Type: application/json` | |
| `OPTIONS /api/v1` | 404 | isto, `NOT_FOUND` | nema automatskog `Allow` odgovora |
| `POST` tijelo `{` (application/json) | 422 | `INVALID_REQUEST` | |
| `POST` tijelo 200 KiB | 422 | `INVALID_REQUEST` | |
| `POST` `Content-Type: application/json; charset=utf-16` | 422 | `INVALID_REQUEST` | |
| `POST` prazno tijelo (`Content-Length: 0`) | 404 | `NOT_FOUND` | parser ne baca grešku, ruta ne postoji |
| `POST` `{"__proto__":{"admin":true},…}` | 404 | `NOT_FOUND` | nema efekta |
| `POST` JSON primitiv `"tekst"` (strict) | 422 | `INVALID_REQUEST` | |
| `POST` prekinut (`Content-Length: 50`, bez tijela) | — (klijent zatvorio) | server je zabilježio 422 `INVALID_REQUEST` | |
| **`POST` `Content-Encoding: br`, tijelo `{}`** | **500** | **`INTERNAL_ERROR`** | **R-01** |
| **`POST` `Content-Encoding: gzip`, tijelo nije gzip** | **500** | **`INTERNAL_ERROR`** | **R-01** |
| `GET /api/v1/%E0%A4%A` | 404 | `NOT_FOUND` | u skladu sa O-1 (nema ruta sa parametrima) |
| `GET /%` | 404 | `NOT_FOUND` | |
| `GET` sa `Authorization: Bearer SENTINEL_A`, `X-POS-API-Key: SENTINEL_P` | 404 | `NOT_FOUND` | |
| `POST` sa sentinel zaglavljima + `{"SENTINEL_B` | 422 | `INVALID_REQUEST` | |
| `GET` sa `X-Correlation-Id: zadato` (2×) | 404 | `NOT_FOUND` | `correlationId` ≠ `zadato` |

- Nijedan odgovor nije sadržao `stack`, `    at `, `.js`, `C:\`, `SyntaxError`, `Unexpected`, `entity`, `too large`, `charset`,
  sentinel vrijednosti ni `zadato`; nijedan odgovor nema `X-Powered-By`.
- 18 odgovora sa body-jem → 18 jedinstvenih `correlationId` (UUID v4).
- `Select-String -Path srv_err.txt,srv_out.txt -Pattern 'SENTINEL|zadato'` → prazno. Serverski log sadrži samo
  `vrijeme, nivo, correlationId, code, status, metod, putanja` i, za 500, `stack` (samo u serverskom logu).

### 2.4 Produkcijska zaštita

| Komanda | Rezultat |
|---|---|
| `node --test test\emulator\punjenje.test.js` (bez emulator varijabli) | `Error: FIRESTORE_EMULATOR_HOST mora biti 127.0.0.1:8080…`, pass 0 / fail 1, exit 1, ~0,7 s (greška na vrhu modula, prije ijednog Firebase poziva) |
| isto za `adminSdk.test.js` sa ispravnim hostovima i `GCLOUD_PROJECT=fuelpoints-prod` | `Error: Testovi nad emulatorom zahtijevaju projekat čiji ID počinje sa demo-.`, exit 1 |
| `npm run seed:emu` bez `.env` i bez varijabli | `Punjenje je odbijeno: varijabla FIRESTORE_EMULATOR_HOST nije postavljena…`, exit 1 |
| isto sa `FIREBASE_PROJECT_ID=demo-fuelpoints`, bez emulator host-a | isto odbijanje, exit 1 |
| `.env` prisutan, `$env:FIREBASE_PROJECT_ID='fuelpoints-prod'` | `Punjenje je odbijeno: ID projekta u varijabli FIREBASE_PROJECT_ID mora počinjati sa demo-.`, exit 1; vrijednost nije ispisana |
| `.env` prisutan, emulator **nije** pokrenut | proces visi bez ikakvog izlaza; poslije ~6 min ručno prekinut (`Stop-Process`) → **R-03** |

`.firebaserc`, `firebase.json`, `.env.example` i kod referišu samo `demo-fuelpoints`.

Napomena: Admin SDK u emulator testovima i u seed procesu ispisuje `MetadataLookupWarning … ETIMEDOUT, ENOTFOUND`
(pokušaj otkrivanja GCE metadata servera). To nije Firebase projekat i nijedan podatak ne ide van emulatora; Builder je
to naveo kao poznato ograničenje, pa se ne prijavljuje kao nalaz.

### 2.5 Testovi (baseline)

| Komanda | Rezultat |
|---|---|
| `cd backend; npm ci` | uspjeh (`npm warn install-scripts` za `re2`) |
| `cd backend; npm test` | tests 19, pass 19, fail 0 |
| `cd backend; npm run test:emu` (JBR prvi u PATH-u) | tests 6, pass 6, fail 0, exit 0 |
| `cd firebase\tests; npm ci; npm test` | tests 5, pass 5, fail 0, exit 0 |
| `npm run test:emu` dok je `emulators:start` već pokrenut | `Error: Could not start Authentication Emulator, port taken.`, exit 1 (bezbjedan neuspjeh, testovi se ne izvršavaju nad dev emulatorom) |

### 2.6 Mutacioni dokazi (svaka mutacija vraćena `git restore`)

| # | Mutacija | Očekivano | Stvarno |
|---|---|---|---|
| M1 | `firestore.rules`: `allow read: if true; allow write: if false;` | RULE-T12 i I01-T10 padaju | pass 0 / fail 5; prvi razlog „Očekivan DENY, a operacija je dozvoljena: unauthenticated: get rewardRequests/kljuc1” |
| M2 | ciljano: `match /loyaltyLedger/{e} { allow write: if true; }` | pada samo I01-T10 loyaltyLedger | pass 4 / fail 1: „… unauthenticated: set loyaltyLedger/dogadjaj1” |
| M3 | handler: `message: err.message` | I01-T04 pada | I01-T02/T03/T04 padaju (fail 6) |
| M4 | handler: za 500 `message: String(err.stack)` | I01-T04 pada | fail 1: I01-T04 „sinhroni i async izuzetak…” |
| M5 | handler: dodatno polje `stack` u body za 500 | I01-T04 pada | fail 1: I01-T04 |
| M6 | `korelacija.js`: preuzima `X-Correlation-Id` | I01-T05 pada | fail 1: „dolazni X-Correlation-Id se ignoriše” |
| M7b | handler: `console.error(JSON.stringify(req.headers))` | I01-T04 log asercija pada | fail 1: „log sadrži correlationId, a ne sadrži Authorization…” |
| **M7d** | **handler: `console.log(JSON.stringify(req.headers))`** | **I01-T04 log asercija pada** | **pass 19 / fail 0; sentinel-i vidljivi u izlazu → R-02** |
| M8 | seed: `CAR_WASH costPoints 55` | I01-T08 pada | oba I01-T08 testa padaju |
| M9 | seed: treće polje `opis` u SHOWER | I01-T08 pada | oba I01-T08 testa padaju |
| M10 | zaštita: uklonjena provjera `demo-` prefiksa | I01-T09 pada | oba I01-T09 testa padaju |
| M11 | seed: `set(…, { merge: true })` | I01-T08 (drugi test) pada | fail 1: „ručno izmijenjen dokument vraća se na §12…” |
| M12 | katalog: `FORBIDDEN 401` | I01-T01 pada | fail 1 |
| M13 | katalog: dodat `BAD_REQUEST 400` | I01-T01 pada | fail 2 |
| M14 | konfiguracija: vrijednost `PORT` u poruci | I01-T06 pada | fail 1 |
| M15 | `nepoznataRuta` baca običan `Error` | I01-T02 pada | fail 3 (oba I01-T02) |

Napomena: prvi pokušaj M1/M2 sa `Set-Content -Encoding utf8` je dodao BOM u `firestore.rules` i oborio sve testove iz
pogrešnog razloga; ponovljeno je bez BOM-a (Node skripta), rezultati gore su iz ispravnog ponavljanja.

### 2.7 Seed nad emulatorom (ručno)

| Korak | Rezultat |
|---|---|
| `emulators:start --only firestore,auth` | „All emulators ready” za 8 s |
| `npm run seed:emu` (1.) | `Upisano 2 dokumenta u rewardDefinitions.`, exit 0; `CAR_WASH {displayName:"Besplatno pranje", costPoints:50 (integerValue), active:true}`, `SHOWER {displayName:"Besplatan tuš", costPoints:30, active:true}` |
| `npm run seed:emu` (2.) | identično stanje |
| dva seed procesa paralelno | exit 0 / 0, identično stanje (2 dokumenta, ista polja) |
| bajtovi `displayName` SHOWER (Node `fetch`) | `426573706c6174616e207475c5a1` = „Besplatan tuš” (UTF-8 ispravan) |
| ručno upisan `rewardDefinitions/STARI`, pa seed | 3 dokumenta: `CAR_WASH,SHOWER,STARI` → R-04 |
| prekid | upis je jedan `batch.commit()` → atomičan; djelimično stanje (1 od 2 dokumenta) nije moguće |

### 2.8 Ponovljivost `provjera.ps1`

| Komanda | Rezultat |
|---|---|
| `powershell -File .\skripte\provjera.ps1` (1.) | exit 0, 94 s, svih 9 koraka, „SVE PROVJERE PROŠLE” |
| `powershell -File .\skripte\provjera.ps1` (2., odmah poslije) | exit 0, 94 s, „SVE PROVJERE PROŠLE” |
| `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` poslije svakog | prazno |
| negativno: Node listener na 127.0.0.1:8080, pa skripta | exit 1, „NEUSPJEH: Portovi emulatora 8080 i 9099 su slobodni” |

### 2.9 Android

| Komanda | Rezultat |
|---|---|
| `.\gradlew.bat clean assembleDebug` (JAVA_HOME = JBR) | `BUILD SUCCESSFUL in 8s`, 35 executed |
| `.\gradlew.bat testDebugUnitTest` | `testDebugUnitTest NO-SOURCE`, `BUILD SUCCESSFUL` (P-3) |
| `:app:dependencies --configuration debugRuntimeClasspath \| Select-String 'firebase\|gms\|zxing\|google-services'` | prazno |
| merged manifest (debug) | `minSdkVersion 26`, `targetSdkVersion 35`; nema `uses-permission` osim AndroidX `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`; `GlavnaAktivnost` `exported=true` (launcher, obavezno); ostali `exported=true` su debug-only AndroidX test/tooling aktivnosti i `profileinstaller` receiver |
| `app/build.gradle.kts` | namespace/applicationId `io.github.anaspasojevic.fuelpoints` (P-5), compileSdk 35, minSdk 26, targetSdk 35, Compose uključen, nema google-services plugina |
| `libs.versions.toml` | `coreKtx 1.16.0`, `activityCompose 1.10.1` (OD-2), AGP 8.10.1, Kotlin 2.0.21, Compose BOM 2024.09.00 |
| `AndroidManifest.xml` | `allowBackup="true"` sa šablonskim `backup_rules`/`data_extraction_rules` (SRS ga ne propisuje; u i01 nema podataka) |
| repo | nema `local.properties`, `build/`, `.idea/` (lokalno postoje, ignorisani) |

### 2.10 Zavisnosti

| Komanda | Rezultat |
|---|---|
| `Select-String backend\package.json, firebase\tests\package.json -Pattern '"[\^~]'` | prazno: sve tačno pinovano |
| `package-lock.json` | commit-ovan u `backend/` i `firebase/tests/`; `npm ci` prolazi u oba |
| `cd backend; npm audit --omit=dev` | `found 0 vulnerabilities` (express, firebase-admin) |
| `cd backend; npm audit` | 11 (4 moderate, 7 high), sve u lancu `firebase-tools` (devDependency: `basic-ftp`, `braces`, `uuid`, `@opentelemetry/core` …) |
| `cd firebase\tests; npm audit` | 16 (4 moderate, 12 high), samo razvojne zavisnosti |

Ocjena: ranjivosti su u lokalnim razvojnim alatima (emulator CLI), ne u kodu koji se izvršava kao backend; nisu relevantne za i01.

## 3. Nalazi (tabela: ID | Severity | SRS/brief | fajl | kratak opis), pa detalji svakog nalaza po formatu iz tačke 5

| ID | Severity | SRS/brief | fajl | kratak opis |
|---|---|---|---|---|
| R-01 | P2 | odluka i01/P-4, O-1, §27 | `backend/src/greske/obradaGresaka.js:10-13` | Oštećeno komprimovano tijelo (`Content-Encoding: gzip/br/deflate`) → 500 `INTERNAL_ERROR` umjesto 422 `INVALID_REQUEST` |
| R-02 | P2 | §3.4, NFR-07, brief tačka 5 (logovanje) | `backend/test/jedinicni/aplikacija.test.js:14-17, 93-104` | Log asercija I01-T04 presreće samo `console.error`; logovanje tajnih zaglavlja kroz `console.log` ne obara test |
| R-03 | P3 | brief tačka 6 (seed), robusnost | `backend/skripte/napuniEmulator.js:18-27` | `npm run seed:emu` visi neograničeno kad emulator nije pokrenut; poruka „Provjeri da li je emulator pokrenut” se ne pojavljuje |
| R-04 | P3 | §12, DoD (seed) | `backend/src/punjenje/rewardDefinitions.js:11-18` | Seed ne uklanja dokumente van §12 u `rewardDefinitions`; ponašanje nije dokumentovano |
| R-05 | P3 | DoD (`npm start`), `provjera.ps1` | `skripte/provjera.ps1:104-107` | Korak „npm start smoke” pokreće `node src/pokreni.js`, a ne `npm start` |

### R-01 — P2: oštećeno komprimovano tijelo → 500 umjesto 422

- **Prekršeno:** odluka i01/P-4 („svaka 4xx greška body-parser-a → INVALID_REQUEST 422”), O-1; tvrdnja u IMPLEMENTATION_LOG
  („sve greške body-parser-a → INVALID_REQUEST 422”).
- **Kod:** `backend/src/greske/obradaGresaka.js:10-13` — `jeGreskaParsera` traži `typeof err.type === 'string'`.
  body-parser 2.3.0 (`node_modules/body-parser/lib/read.js:125, 136`) za grešku dekompresije radi `createError(400, zlibGreska)`:
  status 400, ali **bez** `type`. Zato `odrediKod` vraća `INTERNAL_ERROR`.
- **Scenario:** nad `npm start`:
  `POST /api/v1/x`, `Content-Type: application/json`, `Content-Encoding: gzip`, tijelo `nije gzip` →
  `HTTP/1.1 500`, `{"error":{"code":"INTERNAL_ERROR",…}}`; isto za `Content-Encoding: br`, tijelo `{}`.
  Serverski log: `"code":"INTERNAL_ERROR","status":500,…,"stack":"Error: incorrect header check\n    at genericNodeError …"`.
- **Očekivano:** 422 `INVALID_REQUEST` (klijentska greška body-ja), bez 500 zapisa sa stack-om u logu.
- **Uticaj:** body format je ispravan i ništa ne curi klijentu; pogrešna je klasifikacija (klijent dobija „greška servera”,
  a svaki takav zahtjev pravi 500 zapis sa stack-om u logu). Ograničen uticaj → P2 (izričit primjer P2 u kriterijumima).
- **Najmanja ispravka:** u `jeGreskaParsera` klasifikovati po statusu, ne po `type`: svaka greška koja nije `GreskaApi`
  a ima cijeli `status`/`statusCode` u opsegu 400–499 → `INVALID_REQUEST` (u i01 jedini izvor takvih grešaka je `express.json()`).
- **Test koji mora dokazati ispravku:** dopuna I01-T03: `POST /api/v1/nepostojeca` sa `Content-Type: application/json`,
  `Content-Encoding: gzip` i tijelom koje nije gzip → 422 `INVALID_REQUEST`, tačno tri polja, bez teksta zlib greške;
  isto za `deflate` i `br`. Mutacija (vraćanje uslova na `type`) mora oboriti test.

### R-02 — P2: log asercija I01-T04 ne dokazuje tvrdnju u potpunosti

- **Prekršeno:** tvrdnja testa „log … ne sadrži Authorization ni X-POS-API-Key” (§3.4, NFR-07, brief tačka 5: „NIKAD ne logovati
  Authorization ni X-POS-API-Key header”); TRACEABILITY NFR-07 navodi ovaj test kao dokaz.
- **Kod:** `backend/test/jedinicni/aplikacija.test.js:14-17` presreće samo `console.error`; asercija `:93-104` gleda samo te pozive.
- **Scenario (mutacija M7d):** u `centralniRukovalacGreskama` dodato `console.log(JSON.stringify(req.headers));` →
  `npm test` = pass 19 / fail 0, a u izlazu se vidi
  `{"authorization":"Bearer SENTINEL_AUTH_123","x-pos-api-key":"SENTINEL_POS_456",…}`.
  (Kontrola M7b sa `console.error` test ispravno obara.)
- **Očekivano:** test pada za bilo koji kanal logovanja procesa.
- **Uticaj:** trenutni kod je ispravan (provjereno nad živim serverom: sentinel-i nisu u stdout ni stderr); problem je u snazi
  dokaza, a POS ključevi dolaze u i03. → P2.
- **Najmanja ispravka:** u testu presresti `console.log`, `console.info`, `console.warn`, `console.error`, `console.debug`
  (ili `process.stdout.write` i `process.stderr.write`) i asercije izvršiti nad spojenim izlazom.
- **Test koji mora dokazati ispravku:** ista asercija I01-T04; mutacije M7b (`console.error`) i M7d (`console.log`) obje moraju
  oboriti test.

### R-03 — P3: seed visi kad emulator nije pokrenut

- **Prekršeno:** nijedan normativni zahtjev; robusnost/retry ponašanje seed CLI-ja (brief tačka 6 traži ispravan i zaštićen seed).
- **Kod:** `backend/skripte/napuniEmulator.js:18-27` — `batch.commit()` bez roka; `catch` sa porukom
  „Punjenje nije uspjelo. Provjeri da li je emulator pokrenut.” se ne dostiže jer Firestore klijent ponavlja pokušaje.
- **Scenario:** `Copy-Item .env.example .env; cd backend; npm run seed:emu` bez pokrenutog emulatora → nema izlaza;
  proces je i poslije ~6 min aktivan (start 20:43:46, prekinut 20:49:54).
- **Očekivano:** brz neuspjeh (exit 1) sa postojećom porukom. Djelimičnog stanja nema (batch je atomičan).
- **Najmanja ispravka:** prije inicijalizacije provjeriti dostupnost emulatora (`fetch('http://' + FIRESTORE_EMULATOR_HOST + '/')`
  sa `AbortSignal.timeout(…)`), ili ograničiti `commit` vremenskim rokom; u oba slučaja exit 1 i postojeća poruka.
- **Test koji mora dokazati ispravku:** emulator test: CLI sa `FIRESTORE_EMULATOR_HOST=127.0.0.1:<slobodan port>` i
  `FIREBASE_PROJECT_ID=demo-fuelpoints` → exit 1 u zadatom roku (npr. < 15 s), stderr sadrži „emulator”, bez stack-a.

### R-04 — P3: seed ne uklanja dokumente van §12

- **Prekršeno:** nije prekršen DoD (iz praznog stanja dvostruko pokretanje daje tačno 2 dokumenta); stvar je preciznosti
  tvrdnje „svako pokretanje vraća tačno vrijednosti iz §12” (`rewardDefinitions.js:9-10`).
- **Scenario:** ručno upisan `rewardDefinitions/STARI` (REST, emulator), pa `npm run seed:emu` → 3 dokumenta:
  `CAR_WASH, SHOWER, STARI`.
- **Očekivano:** ili seed garantuje da katalog sadrži tačno §12 stavke, ili je ograničenje eksplicitno navedeno.
- **Najmanja ispravka:** dokumentovati u komentaru/README da seed postavlja samo §12 stavke i ne briše ostale (ili, ako se
  želi stroga garancija, u istom batch-u obrisati dokumente čiji ID nije u `REWARD_DEFINITIONS`).
- **Test:** ako se izabere stroga varijanta — I01-T08 dopuna: unaprijed upisan `STARI`, poslije seed-a tačno `{CAR_WASH, SHOWER}`.

### R-05 — P3: „npm start smoke” ne pokreće `npm start`

- **Prekršeno:** preciznost DoD provjere „backend: npm start podiže server…” u `provjera.ps1`.
- **Kod:** `skripte/provjera.ps1:104-107` — `Start-Process node -ArgumentList 'src/pokreni.js'`; `start` skripta iz
  `package.json` (`node --env-file-if-exists=../.env src/pokreni.js`) se ne izvršava, pa pokvarena `start` skripta ne bi bila otkrivena.
- **Scenario:** inspekcija; ručno sam potvrdio da `npm start` radi (§2.3), pa trenutno nema funkcionalne greške.
- **Najmanja ispravka:** u smoke koraku pokretati `npm.cmd start` (sa `PORT`/`FIREBASE_PROJECT_ID` iz procesa, koje imaju prednost
  nad `.env`) i gasiti stablo procesa (`taskkill /PID … /T /F`), ili preimenovati korak u „backend start smoke”.
- **Test:** `provjera.ps1` sa privremeno pokvarenom `start` skriptom mora vratiti exit 1.

## 4. Pokrivenost obaveznih testova (I01-T01 … I01-T10, RULE-T12, Android build) — adekvatno / neadekvatno, zašto

| Test | Ocjena | Zašto |
|---|---|---|
| I01-T01 | adekvatno | poredi sa tvrdo upisanom tabelom (koju sam nezavisno uporedio sa `.docx`) i sa .md tabelom; M12 i M13 obaraju test |
| I01-T02 | adekvatno | provjerava status, tačno tri polja, poruku iz kataloga, UUID; M3 i M15 obaraju test |
| I01-T03 | adekvatno za ono što tvrdi | neispravan JSON i preveliko tijelo → 422; M3 obara test. Ne pokriva greške dekompresije (R-01) |
| I01-T04 | adekvatno za glavnu tvrdnju (500 bez stack-a/poruke/putanje) | M3, M4, M5 obaraju test. Dopunska log asercija je djelimična (R-02, P2) |
| I01-T05 | adekvatno | M6 obara test; nezavisno: 18/18 jedinstvenih ID-eva nad živim serverom |
| I01-T06 | adekvatno | čista funkcija i stvarni proces bez `PORT`; M14 obara test |
| I01-T07 | adekvatno | stvaran upis/čitanje/brisanje u Firestore emulatoru i kreiranje/brisanje korisnika u Auth emulatoru |
| I01-T08 | adekvatno | `deepStrictEqual` cijele kolekcije poslije 1. i 2. pokretanja + vraćanje izmijenjenog dokumenta; M8, M9, M11 obaraju test |
| I01-T09 | adekvatno | unit i CLI (exit 1, poruka bez vrijednosti, 0 dokumenata); M10 obara oba testa |
| I01-T10 | adekvatno | M1 i ciljana M2 obaraju test |
| RULE-T12 (preliminarno) | adekvatno | get/list/set/delete, neautentifikovan i autentifikovan; M1 obara sva tri slučaja; pravila se čitaju iz `firebase/firestore.rules` |
| Android build | adekvatno | `clean assembleDebug` BUILD SUCCESSFUL; `testDebugUnitTest` NO-SOURCE + BUILD SUCCESSFUL (P-3) |

## 5. Checkpoint dokumenti (Faza B)

**TEST_REPORT.md** — svaka PASS tvrdnja je reprodukovana:
- `npm test` 19/19, `npm run test:emu` 6/6, rules 5/5, `assembleDebug`, `testDebugUnitTest` NO-SOURCE, `npm start` smoke 404,
  `provjera.ps1` exit 0 i ≠ 0 — sve se poklapa sa mojim izvršavanjem (§2.5, §2.8, §2.9). Broj slučajeva po ID-u u tabeli
  „Rezultat po ID-u” je tačan. Rules kontrola (`allow read: if true` → fail 5) odgovara mojoj M1.
- Verzije alata se poklapaju (Node v24.21.0, npm 11.19.0, firebase-tools 15.32.1, Gradle 8.11.1, JBR 21.0.6).
- Primjedba (ne nalaz): završni Android unos je bio `34 up-to-date`; moj `clean assembleDebug` potvrđuje da build prolazi i iz čistog stanja.

**IMPLEMENTATION_LOG.md**:
- Spisak fajlova odgovara `git diff --name-only main..HEAD` (Android `res/**` je zbirno naveden, što je prihvatljivo;
  `docs/iteracije/i01_plan.md` je na ovoj grani dodat u PLANNER commit-u i izmijenjen, naveden kao „izmijenjen”).
- Netačna tvrdnja u CHANGELOG-u i u statusu P-4: „sve greške body-parser-a → INVALID_REQUEST 422” — ne važi za greške
  dekompresije (R-01). Ispravlja se zajedno sa R-01.
- Poznata ograničenja (audit, `install-scripts`, `MetadataLookupWarning`, PERMISSION_DENIED upozorenja, portovi) su tačna i
  potvrđena mojim izvršavanjem.

**TRACEABILITY.md** (`git diff main..HEAD -- docs/TRACEABILITY.md`):
- Izmijenjeni su samo redovi Iteracije 1 (§2.1/§34.1, §2.3, §2.4, §2.5, §12, §24, §25/§31, §27, NFR-03, NFR-07) i u njima samo
  kolone „Kod”, „Planirani test” i „Status”. Ostali redovi, pravila vođenja i tabela O-1 su nepromijenjeni.
- PASS je dodijeljen samo stavkama pokrivenim izvršenim testovima; §2.5 i §24 su ispravno „IMPLEMENTIRANO … (inspekcija)”, ne PASS;
  djelimične stavke (§12, §25/§31, NFR-03) eksplicitno navode „ostalo PLANIRANO”.
- NFR-07 kao dokaz navodi „I01-T04 (log bez zaglavlja)”; taj dokaz je djelimičan (R-02).

**Odstupanja:**
- OD-1 (JBR na početak PATH-a u `provjera.ps1`, preduslov u README): ne mijenja opseg, ugovor ni definiciju testa; npm skripte
  su nepromijenjene. Potvrđeno: dva uzastopna pokretanja ostavljaju portove 8080/9099 slobodnim. Prihvatljivo.
- OD-3 (riječ „TODO:” uklonjena iz komentara šablona `data_extraction_rules.xml`): samo komentar, ponašanje i pravila
  backup-a nepromijenjeni. Prihvatljivo.
- OD-4 (I01-T10 u commit-u koraka 2): samo raspored sadržaja po commit-ima; ne utiče na kod ni testove. Prihvatljivo.

## 6. Status

ITERATION ACCEPTED
