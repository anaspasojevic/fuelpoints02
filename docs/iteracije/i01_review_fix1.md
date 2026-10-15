# i01 — Ponovni review (FIX LOOP 1)

## 1. Pregledano stanje (commit, datum)

- Grana `iteracija-01`, `git rev-parse --short HEAD` → `937476f`; `git fetch origin; git switch iteracija-01; git pull` →
  „Already up to date”; `git status` čisto prije i poslije pregleda.
- Polazna tačka: prvi review `05d7d45`. Pregledani commit-i: `0d26115` (R-01), `8397532` (R-02), `14d03c6` (R-03),
  `642b8a6` (R-04, R-05), `937476f` (docs).
- Datum: 2026-10-15. Windows 11 Pro 10.0.22621, Windows PowerShell 5.1, Node v24.21.0.
- Redoslijed: najprije `git diff 05d7d45..HEAD` za kod i testove, sopstvene provjere i mutacije, tek onda
  IMPLEMENTATION_LOG, TEST_REPORT i TRACEABILITY.
- Sve privremene skripte (napadi, mutacije, test rute) su bile u scratchpad-u van repozitorijuma. Svaka mutacija je vraćena
  (`git restore` / `git checkout HEAD --`); lokalni `.env` je pravljen samo za `npm start`/seed i obrisan. Poslije svih
  eksperimenata: `git status --short` prazno, `Test-Path .env` → `False`, nema zaostalih `node` procesa
  (`napuniEmulator`, `pokreni.js`, `emulators`).

## 2. Status nalaza R-01 … R-05 (ISPRAVLJENO / NIJE ISPRAVLJENO + dokaz)

| ID | Status | Kratko |
|---|---|---|
| R-01 | ISPRAVLJENO | parser 4xx (uklj. gzip/deflate/br) → 422; ne-parser 4xx i parser 5xx → 500 |
| R-02 | ISPRAVLJENO | presreću se svi `console.*` i `stdout/stderr.write`; M7b i M7d obaraju I01-T04 |
| R-03 | ISPRAVLJENO | seed bez emulatora → exit 1 za 0,45 s; I01-T11 pada na mutaciju (vidi i N-02) |
| R-04 | ISPRAVLJENO (dokumentacija) | `rewardDefinitions.js:10-11`, `README.md:53`; seed ne briše (po odluci) |
| R-05 | ISPRAVLJENO (preimenovanje) | `skripte/provjera.ps1:104` |

### R-01 — ISPRAVLJENO

- **Kod:** `backend/src/aplikacija.js:7-19` (funkcija od linije 10) — omotač `parsirajJson` oko `express.json()`: greška parsera sa cijelim
  `status`/`statusCode` 400–499 → `GreskaApi('INVALID_REQUEST')`, bez obzira na `err.type`; ostalo `next(err)`.
  `backend/src/greske/obradaGresaka.js:10-17` — uklonjena klasifikacija po `type`; sve što nije `GreskaApi` → `INTERNAL_ERROR`.
  Klasifikacija je sada vezana za izvor (parser), ne za oblik greške — u skladu sa odlukom Orchestrator-a.
- **Nad `npm start`** (lokalni `.env` iz `.env.example`, `http.request`, `POST /api/v1/x`, `Content-Type: application/json`):

| Content-Encoding | Tijelo | Status | Body |
|---|---|---|---|
| gzip | `nije gzip` | 422 | `INVALID_REQUEST`, polja `code,message,correlationId` |
| deflate | `nije deflate` | 422 | isto |
| br | `{}` | 422 | isto |
| br | `nije br` | 422 | isto |
| gzip | ispravan gzip od `{` | 422 | isto |
| gzip | skraćen gzip (12 B) | 422 | isto |
| gzip / deflate / br | ispravno komprimovan `{"a":1}` | 404 | `NOT_FOUND` (kontrola: ispravno tijelo prolazi parser) |
| `zstd-x` (nepodržano) | `{}` | 422 | `INVALID_REQUEST` |
| — | `{` | 422 | `INVALID_REQUEST` |

  Nijedan body ne sadrži `header check|zlib|Z_|ecompress|stored block|unexpected end|stack|    at |SyntaxError|unsupported|encoding`.
  Serverski log (stderr) sadrži 11 JSON linija sa `422`/`404`;
  `Select-String -Pattern '"status":500','stack','INTERNAL_ERROR'` nad stdout i stderr → prazno.
- Napomena o alatu: prvi pokušaj sa sirovim TCP klijentom koji odmah radi half-close (`socket.end(tijelo)`) dobio je za
  komprimovana tijela prazan odgovor, iako je server zabilježio 422 `INVALID_REQUEST`. Ponovljeno sa `http.request`
  (rezultati gore). Ponašanje Node HTTP servera pri half-close-u nije dio ove ispravke i ne prijavljuje se.
- **Ne-parser 4xx (privremene test rute, skripta van repoa, `napraviAplikaciju({ dodajRute })`):** greške sa
  `status 400`, `status 404`, `status 413 + type 'entity.too.large'`, `statusCode 415`, `status 422 + type 'entity.parse.failed'`,
  bačene sinhrono, iz `async` handlera i kroz `next(err)` → svih 15 kombinacija `500 INTERNAL_ERROR`, tačno tri polja.
- **Parser 5xx:** spoljna Express aplikacija sa posrednikom `req.setEncoding('utf8')` ispred `napraviAplikaciju()` →
  raw-body `createError(500, 'stream encoding should not be set')` → `500 INTERNAL_ERROR` (log: `"status":500`, stack samo u logu).
- **Mutacije (`cd backend; npm test`):**

| Mutacija | Rezultat |
|---|---|
| M-R01a: u `parsirajJson` vraćen uslov `typeof err?.type === 'string' && …` | pass 21 / fail 1: „I01-T03 oštećeno komprimovano tijelo (gzip, deflate, br) …” |
| M-R01b: u `odrediKod` vraćeno „svaki 4xx → `INVALID_REQUEST`” | pass 21 / fail 1: „I01-T03 greška sa 4xx statusom koja ne dolazi iz JSON parsera → 500” |
| M-R01c: u `parsirajJson` uklonjena gornja granica `status < 500` | **pass 22 / fail 0** → N-01 |

- **Crveno nad starim kodom:** `git checkout 05d7d45 -- backend/src/aplikacija.js backend/src/greske/obradaGresaka.js`,
  `node --test --test-name-pattern="I01-T03" test/jedinicni/aplikacija.test.js` → pass 2 / fail 2 (`500 !== 422`, `422 !== 500`).

### R-02 — ISPRAVLJENO

- **Kod:** `backend/test/jedinicni/aplikacija.test.js:15-38` (presretač: linije 18-34) — `presretniLog()` mock-uje `console.log/info/warn/error/debug`
  (zapis preko `util.format`) i `process.stdout.write`/`process.stderr.write` (bilježi i prosljeđuje); asercija nad spojenim
  izlazom. Produkcioni kod nije mijenjan.
- **Mutacije** (u `centralniRukovalacGreskama` dodat red prije `const stavka …`):

| Mutacija | Rezultat |
|---|---|
| M7b `console.error(JSON.stringify(req.headers))` | `npm test`: pass 21 / fail 1 — I01-T04 log |
| M7d `console.log(JSON.stringify(req.headers))` | `npm test`: pass 21 / fail 1 — I01-T04 log |
| `process.stdout.write(JSON.stringify(req.headers) + '\n')` | pass 21 / fail 1 — I01-T04 log |
| `console.warn(req.headers)` | pass 21 / fail 1 — I01-T04 log |
| `console.info(req.headers)` | `--test-name-pattern="I01-T04 log"`: fail 1, „log sadrži Authorization” |
| `console.debug(req.headers)` | fail 1, „log sadrži Authorization” |
| `process.stderr.write(JSON.stringify(req.headers))` | fail 1, „log sadrži Authorization” |
| kontrola: M7d nad testom iz `05d7d45` | pass 1 / fail 0, sentinel-i vidljivi u izlazu (originalni R-02 reprodukovan) |

### R-03 — ISPRAVLJENO

- **Kod:** `backend/skripte/napuniEmulator.js:6-17, 29-33` (provjera dostupnosti: linije 10-17) — poslije zaštite samo-emulator, a prije učitavanja Admin SDK-a,
  `fetch('http://' + FIRESTORE_EMULATOR_HOST + '/')` sa `AbortSignal.timeout(5000)`; neuspjeh → postojeća poruka, exit 1.
  Zaštita (I01-T09) ostaje prva provjera.
- **Ručno:** emulator nije pokrenut (`Get-NetTCPConnection -LocalPort 8080,9099` prazno), `.env` iz `.env.example`,
  `cd backend; npm run seed:emu` → `exit=1`, `451 ms`, izlaz „Punjenje nije uspjelo. Provjeri da li je emulator pokrenut.”,
  bez `    at `. (Okvir `NativeCommandError` u izlazu je PowerShell-ov omotač stderr-a, ne aplikacija.)
  Dodatno: `FIRESTORE_EMULATOR_HOST=127.0.0.1:1 … node skripte/napuniEmulator.js` → ista poruka, `exit 1`.
- **I01-T11** (`backend/test/jedinicni/punjenjeBezEmulatora.test.js`, dio `npm test`): PASS (96 ms).
- **Mutacija M-R03** (`if (!(await emulatorJeDostupan(…)))` → `if (false)`): `npm test` → pass 21 / fail 1,
  „I01-T11 … (20033 ms)”, `AssertionError: proces nije završio u roku od 20 s`.
- **Crveno nad starim kodom** (`git checkout 05d7d45 -- backend/skripte/napuniEmulator.js`): I01-T11 fail, 20046 ms, `ETIMEDOUT`.
- Preostali rubni slučaj (port zauzet servisom koji nije emulator) → N-02 (P3).

### R-04 — ISPRAVLJENO (samo dokumentacija, po odluci)

- `backend/src/punjenje/rewardDefinitions.js:9-11`: „… vraća tačno vrijednosti iz §12 za te stavke. Seed postavlja samo
  stavke iz §12 i ne briše druge dokumente u rewardDefinitions.” `README.md:53`: ista rečenica.
- Ponašanje nepromijenjeno (diff sadrži samo komentar); seed ne briše dokumente van §12 — u skladu sa odlukom Orchestrator-a.

### R-05 — ISPRAVLJENO (samo preimenovanje, po odluci)

- `skripte/provjera.ps1:104`: `Korak 'Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1)'`.
  Logika koraka nepromijenjena (diff: 1 red). Naziv više ne tvrdi da se izvršava `npm start`.
  Kozmetika (nije nalaz): dupliran prefiks „Backend: backend …”.

## 3. Novi nalazi

| ID | Severity | SRS/odluka | fajl | kratak opis |
|---|---|---|---|---|
| N-01 | P3 | odluka Orchestrator-a za R-01 (parser 5xx → INTERNAL_ERROR), O-1 | `backend/src/aplikacija.js:13`, `backend/test/jedinicni/aplikacija.test.js` | Nijedan test ne štiti granu „greška parsera sa 5xx → INTERNAL_ERROR”; mutacija koja uklanja `status < 500` preživljava |
| N-02 | P3 | robusnost seed CLI-ja (nastavak R-03) | `backend/skripte/napuniEmulator.js:10-17` | Ako na `FIRESTORE_EMULATOR_HOST` sluša HTTP servis koji nije Firestore emulator, seed i dalje visi |

### N-01 — P3: grana „parser 5xx → INTERNAL_ERROR” nije pokrivena testom

- **Prekršeno:** odluka Orchestrator-a za R-01 („parser 5xx i ostale greške → INTERNAL_ERROR”) nema automatski dokaz.
  Trenutno ponašanje je ispravno (dokazano ručno, §2 R-01).
- **Kod:** `backend/src/aplikacija.js:13` — `status >= 400 && status < 500`.
- **Scenario:** mutacija M-R01c (`status >= 400 && status < 500` → `status >= 400`) → `npm test` pass 22 / fail 0;
  sa tom mutacijom parser greška `stream.encoding.set` (500) bi postala 422 `INVALID_REQUEST` i ne bi bila logovana kao 500.
- **Očekivano:** test pada kada se parser 5xx klasifikuje kao `INVALID_REQUEST`.
- **Uticaj:** samo snaga dokaza za klasifikaciju grešaka; ništa ne curi klijentu → P3.
- **Najmanja ispravka (samo test):** u I01-T03 dodati slučaj: spoljna Express aplikacija sa posrednikom
  `(req, res, next) => { req.setEncoding('utf8'); next(); }` ispred `napraviAplikaciju()`, `POST /api/v1/x` sa
  `Content-Type: application/json` i tijelom `{"a":1}` → 500 `INTERNAL_ERROR`, tačno tri polja.
- **Test:** M-R01c mora oboriti novi slučaj.

### N-02 — P3: seed visi kad port zauzima servis koji nije emulator

- **Prekršeno:** nijedan normativni zahtjev; preostali dio robusnosti iz R-03 (odluka Orchestrator-a za R-03 traži samo
  scenario „emulator nije pokrenut”, koji je ispravljen).
- **Kod:** `backend/skripte/napuniEmulator.js:10-17` — bilo koji HTTP odgovor znači „emulator radi”; `batch.commit()` i dalje
  nema vremenski rok.
- **Scenario:** Node `http.createServer((q, r) => r.end('ok'))` na slobodnom portu; seed CLI sa
  `FIRESTORE_EMULATOR_HOST=127.0.0.1:<taj port>`, `FIREBASE_PROJECT_ID=demo-fuelpoints` → nema izlaza osim
  `MetadataLookupWarning`; proces prekinut poslije 40 043 ms (`exit=null sig=SIGTERM`).
- **Očekivano:** brz neuspjeh sa postojećom porukom, exit 1.
- **Uticaj:** samo lokalni razvojni alat, rijedak scenario, bez djelimičnog stanja (batch je atomičan) → P3, ne blokira.
- **Najmanja ispravka:** ograničiti `napuniRewardDefinitions(...)` vremenskim rokom u CLI-ju (npr. `Promise.race` sa
  tajmerom od nekoliko sekundi → postojeća poruka, exit 1), ili ga ostaviti kao poznato ograničenje u IMPLEMENTATION_LOG-u.
- **Test:** varijanta I01-T11 sa lažnim HTTP serverom na portu → exit 1 u roku < 15 s.

## 4. Regresija i scope

### Testovi i skripta

| Komanda | Rezultat |
|---|---|
| `cd backend; npm ci; npm test` | tests 22, pass 22, fail 0 |
| `powershell -NoProfile -ExecutionPolicy Bypass -File .\skripte\provjera.ps1` (1.) | exit 0, 95 s, `SVE PROVJERE PROŠLE`; npm test 22/22, test:emu 6/6, rules 5/5, assembleDebug i testDebugUnitTest BUILD SUCCESSFUL |
| isto (2., odmah poslije) | exit 0, 96 s, `SVE PROVJERE PROŠLE`, isti brojevi |
| `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` poslije svakog pokretanja | prazno |

### Scope

| Komanda | Rezultat |
|---|---|
| `git diff --stat 05d7d45..HEAD` | 11 fajlova: `README.md`, `backend/skripte/napuniEmulator.js`, `backend/src/aplikacija.js`, `backend/src/greske/obradaGresaka.js`, `backend/src/punjenje/rewardDefinitions.js`, `backend/test/jedinicni/aplikacija.test.js`, `backend/test/jedinicni/punjenjeBezEmulatora.test.js` (novi), `docs/IMPLEMENTATION_LOG.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md`, `skripte/provjera.ps1` — svaki potreban za R-01 … R-05, testove ili docs |
| `git diff --stat 05d7d45..HEAD -- docs/srs backend/package.json backend/package-lock.json firebase pos-simulator android-app backend/src/greske/katalogGresaka.js` | prazno: nema novih paketa, kodova grešaka ni promjena pravila/Android-a |
| `git grep -n -E "\.(get\|post\|put\|patch\|delete\|all\|use)\(" -- backend/src` | samo `aplikacija.js:27,28,34,36,37` (korelacija, parser, `/api/v1` ruter, `nepoznataRuta`, rukovalac) — nema endpointa |
| `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (odgovara) |
| `git grep -n -E "TODO\|FIXME" -- backend skripte` | samo sama provjera u `skripte/provjera.ps1:83-86` |
| `git log 05d7d45..HEAD --format="%an%n%B"` + `Select-String 'Co-Authored\|Claude\|Generated\|AI '` | prazno; autor svih 5 commit-a `anaspasojevic` |
| novi test ID | `I01-T11` (format `I<iteracija>-T<broj>`, CLAUDE.md) |

### Checkpoint dokumenti

**TEST_REPORT.md (sekcija FIX LOOP 1)** — svaka nova PASS/FAIL tvrdnja je reprodukovana:
- R-01 crveno nad `05d7d45` (pass 2 / fail 2, `500 !== 422`, `422 !== 500`) i zeleno (4/4); M-R01 (`err.type`) obara
  „oštećeno komprimovano tijelo” — reprodukovano (kod mene pass 21 / fail 1 jer je u međuvremenu dodat I01-T11; Builder-ov
  `pass 20` je iz trenutka prije I01-T11, konzistentno).
- R-02: stari test + M7d prolazi sa sentinel-ima u izlazu; novi test pada za M7b, M7d, `console.info`, `stdout.write`,
  `stderr.write` — reprodukovano (plus `console.warn`, `console.debug`).
- R-03: crveno nad `05d7d45` (`ETIMEDOUT`, ~20 s) i zeleno; ručni CLI sa `127.0.0.1:1` → poruka, `exit 1` — reprodukovano.
- „Rezultat po ID-u”: brojevi slučajeva (T01 6, T02 2, T03 4, T04 3, T05 2, T06 4, T11 1 = 22; T07 2, T08 2, T09 2 = 6;
  RULE-T12 3, I01-T10 2 = 5) odgovaraju mom izvršavanju. `provjera.ps1` exit 0 — reprodukovano dvaput.

**IMPLEMENTATION_LOG.md** — netačna tvrdnja iz R-01 je ispravljena na oba mjesta (CHANGELOG: „greške JSON parsera
(`express.json()`) sa statusom 400–499 → `INVALID_REQUEST` 422 … ostalo → `INTERNAL_ERROR` 500” uz objašnjenje;
tabela P-4: „greške JSON parsera sa 4xx → `INVALID_REQUEST` 422, klasifikacija na izvoru”). Nova tabela FIX LOOP 1 tačno
opisuje izmjene i fajlove (poklapa se sa `git diff --stat`). Nema netačnih tvrdnji.

**TRACEABILITY.md** — izmijenjena samo dva reda Iteracije 1 (§2.4, §12: dodat I01-T11 i „FIX LOOP 1”); ostali redovi
nepromijenjeni. Prihvatljivo.

## 5. Status

ITERATION ACCEPTED
