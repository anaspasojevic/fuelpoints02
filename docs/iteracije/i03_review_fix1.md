# i03 — Ponovni review (FIX LOOP 1)

## 1. Pregledano stanje

| Stavka | Vrijednost |
|---|---|
| Grana | `iteracija-03` (`git fetch origin; git switch iteracija-03; git pull --ff-only` → `Already up to date.`; `git status` → čisto) |
| Pregledani commit | `3373d89` (HEAD); osnova poređenja `f3659f6` (prvi review) |
| Datum | 2026-10-16 |
| OS / shell | Windows 11 Pro 10.0.22621, Windows PowerShell 5.1 (Git Bash za pomoćne komande); `node` `v24.21.0`; emulatori sa JDK-om `C:\Program Files\Android\Android Studio\jbr` (prvi u PATH-u) |
| SRS | `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` → `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`; `git diff main..HEAD -- docs/srs` → prazno (0 linija) |

Faza A (osnova): `CLAUDE.md`, `docs/iteracije/i03_brief.md`, `docs/iteracije/i03_plan.md` samo sekcija 15, `docs/iteracije/i03_review.md`
(R-01 … R-05), odluka Orchestrator-a za FIX LOOP 1 (2026-10-16), `git diff f3659f6..HEAD -- backend README.md` i kod koji diff dira
(`backend/src/greske/obradaGresaka.js`, `backend/src/dnevnik.js`, `backend/src/aplikacija.js`, `backend/src/rute/kupovine.js`, `rute/nalog.js`,
četiri izmijenjena test fajla). `TEST_REPORT`, `IMPLEMENTATION_LOG`, `TRACEABILITY` i commit poruke pročitani tek poslije sopstvenih proba i
mutacija (sekcija 4.4).

Probne skripte isključivo u scratchpad direktorijumu sesije (van repozitorijuma): `zajednicko.mjs` (iz prvog review-a), `r04.mjs` (napad R-04),
`mutacije.py` (prvi review) + `dodaj_mutacije.py` (nove mutacije FIX LOOP 1), `regresija.ps1`. POS ključevi i ID token generisani u toku
izvršavanja (`randomBytes(32).toString('base64url')`, Auth emulator `accounts:signUp`), nigdje upisani. Mutacije: tačna zamjena teksta → ciljani
test → `git restore -- backend/src firebase/firestore.rules` → `git status --porcelain` (prazno poslije svake, kolona `status=""` u izlazu).
Ručno pokrenuti emulatori (`npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth`) ugašeni prije
mutacija; `Get-NetTCPConnection -State Listen -LocalPort 8080,9099,4400,4000` → 0.

## 2. Status nalaza R-01 … R-05

| Nalaz | Odluka Orchestrator-a | Status |
|---|---|---|
| R-01 (P2) | samo test: query / `X-Station-Id` / zaglavlje `stationId` → 201, `SIM01`, `SIM02__…` ne postoji; M02, M02b ubijene | **RIJEŠENO PO ODLUCI** |
| R-02 (P3) | samo test: fiksni `sadaMs`, +300 000 ms prolazi, +300 001 ms → `INVALID_OCCURRED_AT`; M06 ubijena | **RIJEŠENO PO ODLUCI** |
| R-03 (P3) | samo test: `"____"`, `"__\n__"` → 404 bez baze; M25, M25s ubijene | **RIJEŠENO PO ODLUCI** |
| R-04 (P3) | ispravka koda (D-3): šablon rute / fiksna vrijednost; I03-T17 dopunjen (in-process i spawn); `putanja: req.path` ubijena | **RIJEŠENO PO ODLUCI** |
| R-05 (P3) | samo dokument (klasifikacija `i03_brief.md` / `i03_plan.md`) | **RIJEŠENO PO ODLUCI** |

### R-01 — dokaz

- **Kod:** `git diff f3659f6..HEAD -- backend/src/rute` → prazno; `backend/src/rute/kupovine.js:13` i dalje `{ stationId: res.locals.stationId, ...ulaz }`.
- **Test (inspekcija):** `backend/test/emulator/posAutentikacija.test.js:152–170`, novi test „I03-T01 (b) stationId u query-ju ili zaglavljima
  X-Station-Id / stationId se ignoriše → stanica samo iz ključa”: tri zasebna zahtjeva sa ključem SIM01 (`?stationId=SIM02`, `X-Station-Id: SIM02`,
  zaglavlje `stationId: SIM02`; `posTransactionId` Q1/Q2/Q3) → `201`, `body.stationId === 'SIM01'`, `purchaseId === 'SIM01__Qn'`,
  `purchases/SIM01__Qn`.`stationId` = `SIM01`, `purchases/SIM02__Qn` ne postoji. Sve stavke odluke pokrivene.
- **Mutacije (sopstvene, `python -I mutacije.py …`):**
  - M02 (`req.query.stationId ?? res.locals.stationId`), ciljano `posAutentikacija.test.js` + `kupovina.test.js` → `exit 1`, `{'tests': '19', 'pass': '18', 'fail': '1'}`,
    `✖ I03-T01 (b) stationId u query-ju ili zaglavljima X-Station-Id / stationId se ignoriše …` — **UBIJENA** (prvi review: 18/18, preživjela).
  - M02b (`req.get('x-station-id') ?? …`), isto → `exit 1`, 18/19 — **UBIJENA**.
  - Dodatno samo nad `posAutentikacija.test.js`: M02q (query) `exit 1` 3/4, M02h (`x-station-id`) `exit 1` 3/4, M02c (`req.get('stationid') ?? …`,
    treći oblik iz odluke) `exit 1` 3/4 — sve **UBIJENE** istim testom.
- **Regresija:** test zelen u 3 × `test:emu` i 2 × `provjera.ps1` (sekcija 4.1).

### R-02 — dokaz

- **Kod:** `git diff f3659f6..HEAD -- backend/src/validacija` → prazno.
- **Test (inspekcija):** `backend/test/jedinicni/vrijemeKupovine.test.js:71–89` „I03-T07 (c)”: `sadaMs = Date.UTC(2026, 9, 16, 10, 0, 0, 0)`;
  `provjeriTijeloKupovine(tijelo(sadaMs + 300_000), sadaMs)` → bez greške i `occurredAtMs === sadaMs + 300_000`; `+300_001` → `assert.throws` sa
  `GreskaApi` i `kod === 'INVALID_OCCURRED_AT'`. Deterministički (bez `Date.now()`).
- **Mutacije:** M06 (`>` → `>=`), ciljano `node --test test/jedinicni/*.test.js` → `exit 1`, `{'tests': '46', 'pass': '45', 'fail': '1'}`,
  `✖ I03-T07 (c) occurredAt tačno +5 min …` — **UBIJENA** (prvi review: 45/45). M06u (isto, samo `vrijemeKupovine.test.js`) → `exit 1` 2/3.
  Dodatno M06p (`> sadaMs + NAJVISE_U_BUDUCNOSTI_MS + 1`, granica pomjerena za 1 ms naviše) → `exit 1` 2/3 — **UBIJENA** (test štiti obje strane granice).

### R-03 — dokaz

- **Kod:** nepromijenjen (`/^__.*__$/s` u `backend/src/validacija/tijeloKupovine.js`).
- **Test (inspekcija):** `backend/test/emulator/kupovina.test.js:585–587` — u listu I03-T09 (format, 404 bez pristupa bazi) dodati `['____', '____']`
  i `['__\\n__', '__\n__']` (stvaran prelom reda u vrijednosti). Postojeći slučajevi netaknuti.
- **Mutacije:** M25 (`.*` → `.+`) → `exit 1`, 14/15, `✖ I03-T09 neispravan format loyaltyUid → 404 bez ikakvog pristupa bazi …` — **UBIJENA**;
  M25s (bez zastavice `s`) → `exit 1`, 14/15, isti test — **UBIJENA**.

### R-04 — dokaz

- **Kod (inspekcija):** `backend/src/greske/obradaGresaka.js:21–23` — `putanjaZaLog(req)` vraća `req.route.path` kad je string, inače fiksno
  `'(nepoznata ruta)'`; `:38` `putanja: putanjaZaLog(req)`. Ostala polja (`correlationId`, `code`, `status`, `metod`, `stack` samo za 5xx) nepromijenjena;
  `git diff f3659f6..HEAD -- backend/src/dnevnik.js` → prazno. Šablon ruta su konstante iz koda (`/pos/purchases`, `/account/init`) — ne mogu
  sadržati podatke klijenta. Jedino drugo polje koje dolazi od klijenta je `metod`; Node HTTP parser odbija nepoznat metod sa 400 prije Express-a
  (proba ispod), pa ni ono ne može nositi tajnu.
- **Test (inspekcija):** `backend/test/emulator/logBezPosKljuca.test.js` — (a) in-process: dva nova ishoda 404 (`POST …/purchases/<k1>` sa ispravnim
  zaglavljem, `POST /api/v1/pos/<k2>` bez zaglavlja); log bez k1/k2; zapis za 401 ima `putanja` `/pos/purchases`, zapisi za oba 404 `code` `NOT_FOUND`
  i `putanja` `(nepoznata ruta)` (`zapisLoga` zahtijeva tačno jedan zapis po `correlationId`). (b) spawn `src/pokreni.js`: ista dva 404; statusi
  `[201, 401, 422, 404, 404]` (prošireno, ne oslabljeno); log procesa bez k1/k2; zapis 401 `putanja` `/pos/purchases`.
  Uklonjene linije u testovima (`git diff f3659f6..HEAD -- backend/test | grep "^-"`): samo dva komentara i stara asercija
  `assert.deepStrictEqual(statusi, [201, 401, 422])`, zamijenjena strožom — nijedna asercija uklonjena ni oslabljena.
- **Sopstveni napad** (`node r04.mjs`, emulatori, `FIRESTORE_EMULATOR_HOST`/`FIREBASE_AUTH_EMULATOR_HOST`; tajne: POS ključevi K1, K2, pravi ID token
  iz Auth emulatora, njegov payload segment, `loyaltyUid` `korisnikTajniUid7f3a9c2e`). Isti 20 zahtjeva in-process (presretnut `console.error`) i
  nad spawn-ovanim `src/pokreni.js` (`fetch`), plus 4 sirova HTTP zahtjeva u spawn-u. Za svaki: tačan status, odgovor (tijelo i zaglavlja) bez
  ijedne tajne, tačno jedan JSON zapis loga sa `correlationId` iz odgovora, tačnim `code`, `status`, `metod`, očekivanom `putanja`, `vrijeme`, samo
  dozvoljena polja i `stack` ako i samo ako je 5xx:

| Zahtjev | Status / kod | `putanja` u logu |
|---|---|---|
| `POST /api/v1/pos/purchases/<K1>` sa i bez `X-POS-API-Key` | 404 `NOT_FOUND` | `(nepoznata ruta)` |
| `POST /api/v1/pos/<K2>`; `POST /<K1>`; `…/purchases%2F<K1>`; `…/purchases;k=<K1>`; `/api/v1/` + 10 000 znakova sa K1 | 404 `NOT_FOUND` | `(nepoznata ruta)` |
| `POST …/purchases/<K1>` + neispravan JSON (`{"a":`) | 422 `INVALID_REQUEST` | `(nepoznata ruta)` |
| `POST …/purchases/<K1>?k=<K2>&<K2>=1` | 404 `NOT_FOUND` | `(nepoznata ruta)` |
| `POST …/purchases?X-POS-API-Key=<K1>` + pogrešno zaglavlje | 401 `UNAUTHENTICATED_POS` | `/pos/purchases` |
| `POST …/purchases?X-POS-API-Key=<K1>` + neispravan JSON | 422 `INVALID_REQUEST` | `(nepoznata ruta)` |
| `GET …/purchases/<K1>`; `PUT …/purchases?<K1>` | 404 `NOT_FOUND` | `(nepoznata ruta)` |
| `POST /api/v1/account/init/<ID token>` sa `Authorization: Bearer <token>`; `POST /api/v1/<ID token>` | 404 `NOT_FOUND` | `(nepoznata ruta)` |
| `POST /api/v1/account/init?token=<ID token>` bez zaglavlja | 401 `UNAUTHENTICATED` | `/account/init` |
| `POST …/purchases/<loyaltyUid>` | 404 `NOT_FOUND` | `(nepoznata ruta)` |
| `POST …/purchases` sa nepostojećim `loyaltyUid` u tijelu | 404 `LOYALTY_ACCOUNT_NOT_FOUND` | `/pos/purchases` |
| `POST …/purchases?x=<K1>`, `volumeMl: <K2>` | 422 `INVALID_VOLUME` | `/pos/purchases` |
| `POST …/purchases?x=<K2>`, nalog sa `availablePoints: -5` | 500 `INTERNAL_ERROR` (stack samo u logu, bez tajni) | `/pos/purchases` |
| sirovo (spawn): metod = ključ (slova) | Node `400 Bad Request`, bez zapisa u logu | — |
| sirovo: putanja `…/<K1>\t` | Node `400 Bad Request`, bez zapisa | — |
| sirovo: absolute-form `POST http://evil<K1>.host/api/v1/pos/purchases/<K2>` | 404 | `(nepoznata ruta)` |
| sirovo: `POST /api/v1/pos/<K1>/../purchases` (bez normalizacije) | 404 | `(nepoznata ruta)` |

  Rezultat: `OK` 97, `PROBLEMA: 0`; in-process 20 zapisa, spawn 22 zapisa (5 160 B); log nijednog kanala ne sadrži K1, K2, token, payload
  segment tokena, `loyaltyUid` niti nazive `X-POS-API-Key`/`Authorization`. Primjer zapisa (spawn):
  `{"vrijeme":"2026-10-16T20:59:45.518Z","nivo":"greska","correlationId":"b18c5f7d-…","code":"NOT_FOUND","status":404,"metod":"POST","putanja":"(nepoznata ruta)"}`.
  Dijagnostika ostaje: `correlationId` povezuje odgovor i zapis, uz `code`, `status`, `metod` i šablon rute; smoke u `provjera.ps1` prikazuje
  `"putanja":"/account/init"`, `"/pos/purchases"`, `"(nepoznata ruta)"`.
  (Prva dva izvršavanja probe imala su greške u samoj probi — `procitajPosKljuceve(…)` umjesto `.stanice` i `fetch` koji normalizuje `..` — obje
  ispravljene u probi; nisu nalazi.)
- **Mutacije** (ciljano `test/emulator/logBezPosKljuca.test.js`):

| ID | Mutacija | Rezultat |
|---|---|---|
| M19c | `putanja: req.path` (mutacija iz odluke) | `exit 1`, 0/2: `✖ I03-T17 (a)`, `✖ I03-T17 (b)` — **UBIJENA** |
| M19d | `putanja: req.originalUrl` | `exit 1`, 0/2 — **UBIJENA** |
| M19e | bez pogođene rute `req.path` umjesto fiksne vrijednosti | `exit 1`, 0/2 — **UBIJENA** |
| M19f | uvijek `(nepoznata ruta)` (gubi se šablon) | `exit 1`, 0/2 — **UBIJENA** (asercija `putanja` `/pos/purchases` za 401) |
| M19g | `putanjaZaLog(req) + ' ' + X-POS-API-Key` | `exit 1`, 0/2 — **UBIJENA** |
| M19h | `req.baseUrl + …` / `req.baseUrl + req.path` | `exit 1`, 0/2 — **UBIJENA** |
| M19i | bez rute: prva 3 segmenta dekodirane putanje (`/api/v1/pos`, bez ključa) | `exit 1`, 1/2: `✖ I03-T17 (a)` — **UBIJENA** (asercija fiksne vrijednosti) |

### R-05 — dokaz (inspekcija dokumentacije, Faza B)

`docs/IMPLEMENTATION_LOG.md` (i03 „Fajlovi”): `docs/iteracije/i03_plan.md` uklonjen sa liste izmijenjenih, `i03_brief.md` uklonjen iz „Netaknuti”,
dodata rečenica „`i03_brief.md` i `i03_plan.md` su dodati na grani u koracima Orchestrator-a i Planner-a; Builder je mijenjao samo sekciju 15 plana.”
`git diff --name-status main..HEAD -- docs/iteracije` → `A i03_brief.md`, `A i03_plan.md`, `A i03_review.md` — u skladu. „Netaknuti” sada tačno navodi
`obradaGresaka.js` „(do FIX LOOP 1, R-04)”; `dnevnik.js` zaista netaknut. U skladu sa odlukom.

Napomena o kontenciji (503 i latencija) upisana kao poznato ograničenje u IMPLEMENTATION_LOG i TEST_REPORT („FIX LOOP 1”), kod nije mijenjan — u skladu sa odlukom.

## 3. Novi nalazi

| ID | Severity | SRS / odluka | Fajl:linija | Kratak opis |
|---|---|---|---|---|
| F1-01 | P3 | CLAUDE.md („TEST_REPORT sadrži samo stvarno izvršene komande”) | `docs/TEST_REPORT.md:1774`, `:1776`, `:1783` | Putanja `firebase\tests` je upisana sa `\t` protumačenim kao tabulator („`firebase<TAB>ests`”), pa komanda u izvještaju nije doslovna |

Nema P0, P1 ni P2 nalaza. Izmjena nije uvela regresiju, novi scope ni oslabljen test.

### F1-01 — oštećena putanja u TEST_REPORT-u (P3)

- **Zahtjev:** CLAUDE.md — TEST_REPORT sadrži stvarno izvršene komande (čitljive i ponovljive).
- **Fajl:** `docs/TEST_REPORT.md:1774` i `:1776` (`| \`firebase<TAB>ests: npm test\` …`), `:1783` (`\`firebase<TAB>ests npm test\``);
  `grep -nP "firebase\tests" docs/TEST_REPORT.md` → 3 pogotka, u ostalim checkpoint dokumentima 0.
- **Scenarij:** čitalac kopira komandu iz tabele — putanja ne postoji. Sadržaj rezultata (25/25, exit 0) je tačan i reprodukovan (4.1).
- **Očekivano:** `firebase\tests`.
- **Najmanja ispravka:** zamijeniti tabulator sa `\t` u tri linije (samo dokument).
- **Test:** nije potreban; provjera `grep -nP "firebase\tests" docs/TEST_REPORT.md` → prazno. Kozmetika, ne blokira prihvatanje.

Zapažanje (nije nalaz, dokumentovano u IMPLEMENTATION_LOG/TEST_REPORT): greška JSON parsera nastaje prije rutera, pa se neispravan JSON na
`POST /api/v1/pos/purchases` bilježi kao `(nepoznata ruta)` (isto `GET` na postojeću putanju). To je tačno „zahtjev bez pogođene rute” iz odluke;
dijagnostika ide preko `correlationId`, `code` (`INVALID_REQUEST`) i `metod`.

## 4. Regresija i scope

### 4.1 Regresija

Sve iz jedne sekvence (`powershell -NoProfile -ExecutionPolicy Bypass -File regresija.ps1`, JBR prvi u PATH-u), poslije mutacija:

| Komanda | Rezultat |
|---|---|
| `.\skripte\provjera.ps1; $LASTEXITCODE` (1) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 280 s; `npm test` `ℹ tests 46` `ℹ fail 0`; `test:emu` `ℹ tests 68` `ℹ pass 68` `ℹ fail 0`; rules `ℹ tests 25` `ℹ fail 0`; Android `BUILD SUCCESSFUL` ×2; smoke 404 `NOT_FOUND` (`putanja` `(nepoznata ruta)`), 401 `UNAUTHENTICATED` (`/account/init`), 401 `UNAUTHENTICATED_POS` (`/pos/purchases`) |
| `cd backend; npm ci` | `added 713 packages`, exit 0 |
| `npm test` | `ℹ tests 46` `ℹ pass 46` `ℹ fail 0`, exit 0; `✔ I03-T07 (c) …` |
| `npm run test:emu` ×3 | exit 0 ×3, `ℹ tests 68` `ℹ pass 68` `ℹ fail 0`; 222 / 216 / 208 s. I03-T12 broj 503: 2 / 6 / 3 (dozvoljeno, zbir i niz tačni); I03-T13 503 za 10 022 / 10 016 / 10 020 ms; I03-T01 (b) query/zaglavlja, I03-T09, I03-T17 (a), (b) zeleni sva tri puta |
| `cd firebase\tests; npm ci; npm test` | `added 729 packages`, exit 0; `ℹ tests 25` `ℹ pass 25` `ℹ fail 0`, exit 0 |
| `.\skripte\provjera.ps1; $LASTEXITCODE` (2) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 291 s; isti brojevi |
| SRS hash / `git diff main..HEAD -- docs/srs` | `7D8664…60228` / prazno |
| `Get-NetTCPConnection -State Listen -LocalPort 8080,9099,4400` na kraju | 0 (slobodni) |
| `git status --porcelain` na kraju | prazno |

### 4.2 Mutacije (FIX LOOP 1)

| ID | Mutacija | Ciljani test | Exit | Ishod |
|---|---|---|---|---|
| M02 | `stationId: req.query.stationId ?? res.locals.stationId` | `emulator/posAutentikacija` + `kupovina` | 1 | UBIJENA (`✖ I03-T01 (b) … query … zaglavljima`) |
| M02b | `req.get('x-station-id') ?? …` | isto | 1 | UBIJENA |
| M02q / M02h / M02c | query / `x-station-id` / `stationid` zaglavlje | `emulator/posAutentikacija` | 1 / 1 / 1 | UBIJENE |
| M06 | `>` → `>=` | `jedinicni/*.test.js` | 1 | UBIJENA (`✖ I03-T07 (c)`) |
| M06u / M06p | `>=` / granica +1 ms | `jedinicni/vrijemeKupovine.test.js` | 1 / 1 | UBIJENE |
| M25 | `^__.*__$` → `^__.+__$` | `emulator/kupovina` | 1 | UBIJENA (`✖ I03-T09 neispravan format …`) |
| M25s | bez zastavice `s` | isto | 1 | UBIJENA |
| M19c | `putanja: req.path` | `emulator/logBezPosKljuca` | 1 | UBIJENA (`✖ I03-T17 (a)`, `✖ I03-T17 (b)`) |
| M19d, M19e, M19f, M19g, M19h, M19i | vidi R-04 | isto | 1 (sve) | UBIJENE |

Ukupno 17 mutacija, 17 ubijenih, 0 preživjelih; `git status --porcelain` poslije svake prazno.

### 4.3 Scope

- `git diff --stat f3659f6..HEAD`: 9 fajlova — `README.md` (2 rečenice o sadržaju loga), `backend/src/greske/obradaGresaka.js` (R-04),
  `backend/test/emulator/kupovina.test.js` (R-03), `logBezPosKljuca.test.js` (R-04), `posAutentikacija.test.js` (R-01),
  `backend/test/jedinicni/vrijemeKupovine.test.js` (R-02), `docs/IMPLEMENTATION_LOG.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md`.
  Svaka izmjena pripada R-01 … R-05 ili napomeni o kontenciji.
- `git diff --name-only f3659f6..HEAD -- '*package*.json' firebase android-app pos-simulator docs/srs firebase.json` → prazno (nema novih paketa;
  Rules, Android i pos-simulator netaknuti).
- Dodate linije u `backend/src`: nijedan `new GreskaApi('…')`, nijedan `ruter.*`, nijedan TODO/FIXME — nema novog koda greške ni endpoint-a.
- Commit-i `f3659f6..HEAD` (`45f6884`, `4bd81da`, `235323f`, `5b0cfa0`, `3373d89`): jedini autor `anaspasojevic <anaspasojevic09@gmail.com>`;
  `grep -i -E "co-authored|claude|generated|anthropic|\bAI\b"` nad porukama → prazno. `git log -p f3659f6..HEAD | grep -o -E "[A-Za-z0-9_-]{43,}"`
  → samo SRS SHA-256 — nijedan ključ ni token u istoriji.

### 4.4 Checkpoint dokumenti (Faza B, pročitani poslije sopstvenih provjera)

Svaki novi PASS iz `docs/TEST_REPORT.md` („Iteracija 3 — FIX LOOP 1”) je reprodukovan:

| Tvrdnja TEST_REPORT-a | Moje izvršavanje |
|---|---|
| `npm test` 46/46 | 46/46 (samostalno i ×2 kroz `provjera.ps1`) |
| `npm run test:emu` ×3 68/68 | ×3 68/68 (+2 kroz `provjera.ps1`) |
| `firebase\tests npm test` 25/25 | 25/25 (samostalno i ×2) |
| `provjera.ps1` ×2 exit 0, tri smoke-a, novi oblik `putanja` u logu | exit 0 ×2 (280 / 291 s); isti oblik zapisa |
| M02, M02b ubijene (I03-T01 (b)) | ubijene (+ M02q/h/c) |
| M06 ubijena (I03-T07 (c)) | ubijena (+ M06u, M06p) |
| M25, M25s ubijene (I03-T09) | ubijene |
| `putanja: req.path` ubijena, crveno prije ispravke | M19c ubijena (`log sadrži POS ključ`, 0/2); stanje prije ispravke potvrđuje prvi review (napad3) |
| I03-T13 503 za ~10,0 s | 10 016 – 10 022 ms |
| I03-T11/T12 bez 503 u njihovim izvršavanjima | kod mene I03-T12 503 = 2/6/3 — dozvoljeno brief-om (i02/P-5), testovi zeleni; TEST_REPORT ne tvrdi da 503 ne može nastati |
| SRS hash, prazan `git diff -- docs/srs`, portovi slobodni | reprodukovano |
| Nereprodukovan PASS | nema |

- **IMPLEMENTATION_LOG** (FIX LOOP 1): tabela R-01 … R-05 istinito opisuje diff (fajlovi, sadržaj testova, `req.route.path` / `(nepoznata ruta)`,
  `dnevnik.js` nepromijenjen); tvrdnja „nijedan postojeći test ne zavisi od sirove putanje u logu” potvrđena (`grep -rn putanja backend/test` —
  jedine asercije nad poljem loga su nove u `logBezPosKljuca.test.js`); lista commit-a odgovara `git log`. Ograničenja (kontencija, šablon bez
  `/api/v1`, nepodržan metod → `(nepoznata ruta)`) tačna — potvrđena probom.
- **TEST_REPORT:** sadržajno tačan; tri oštećene putanje (F1-01, P3). Opis zaostalog Firestore procesa pri prvom pokušaju Rules testova je
  iskreno zabilježen neuspjeh i ponavljanje.
- **TRACEABILITY:** `git diff f3659f6..HEAD -- docs/TRACEABILITY.md` mijenja samo kolonu „Kod” u redovima §3.4 (iteracije „3, 6”) i NFR-07
  („1 (+ svaka)”) — oba su redovi Iteracije 3; kolone zahtjeva, iteracije, testa i statusa nepromijenjene.

## 5. Status

R-01 … R-05 su riješeni po odluci Orchestrator-a (svih 17 mutacija ubijeno, napad R-04 nad oba kanala bez ijedne tajne u logu, dijagnostika
očuvana). Regresija je zelena (`provjera.ps1` ×2 exit 0; 46 / 68 ×3 / 25). Nema P0 ni P1 nalaza; jedini novi nalaz F1-01 je P3 (kozmetika
u TEST_REPORT-u) i može se ispraviti u sljedećem checkpoint-u dokumenata.

ITERATION ACCEPTED
