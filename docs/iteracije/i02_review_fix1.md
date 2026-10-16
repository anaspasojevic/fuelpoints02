# i02 — Ponovni review (FIX LOOP 1)

## 1. Pregledano stanje (commit, datum)

| Stavka | Vrijednost |
|---|---|
| Grana | `iteracija-02` (`git fetch origin; git switch iteracija-02; git pull` → `Already up to date.`; `git status` → čisto) |
| Pregledani commit | `e1576ba` (HEAD); osnova poređenja `1759848` (prvi review) |
| Datum | 2026-10-16 |
| OS / shell | Windows 11 Pro 10.0.22621, Windows PowerShell 5.1; `node -v` → `v24.21.0`; emulatori sa JDK-om `C:\Program Files\Android\Android Studio\jbr` (prvi u PATH-u) |
| SRS | `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` → `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (jednak zadatom); `git diff main..HEAD -- docs/srs` → prazno |

Pročitano prije provjera: `CLAUDE.md`, `docs/iteracije/i02_brief.md`, `docs/iteracije/i02_review.md`, `git diff 1759848..HEAD` (kod i testovi).
`IMPLEMENTATION_LOG`, `TEST_REPORT` i commit poruke pročitani tek poslije sopstvenih provjera (sekcija 4.4).

Probne skripte su bile isključivo u scratchpad direktorijumu sesije (van repozitorijuma): `zajednicko.mjs`, `r01.mjs`, `r02.mjs`, `r02b.mjs`,
`r02c.mjs`, `r02d.mjs`, `r04r05.mjs`, `r04rules.mjs`, `mutiraj.mjs`, `mutacija.sh`. Mutacije su primjenjivane u radnom stablu i vraćane sa
`git restore -- src` (u `backend`); `git status --porcelain` poslije svake → prazno. Ručno pokrenuti emulatori
(`npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth`) ugašeni su prije mutacija i prije
`provjera.ps1`; `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` → 0 (prije pokretanja i poslije gašenja).

## 2. Status nalaza R-01 … R-08

| Nalaz | Odluka Orchestrator-a | Status |
|---|---|---|
| R-01 | 503 pod jakom kontencijom dozvoljen; ispravka samo u I02-T09 | **RIJEŠENO PO ODLUCI** |
| R-02 | jedan rok 10 s za cijeli zaštićeni zahtjev, od ulaska u posrednik | **RIJEŠENO PO ODLUCI** |
| R-03 | samo dokumentacija (poznato ograničenje, O-2) | **RIJEŠENO PO ODLUCI** |
| R-04 | `isWellFormed()` u validaciji; `.length` ostaje | **RIJEŠENO PO ODLUCI** |
| R-05 | samo test | **RIJEŠENO PO ODLUCI** |
| R-06 | samo test | **RIJEŠENO PO ODLUCI** |
| R-07 | bez izmjene koda, rečenica u README/IMPLEMENTATION_LOG | **RIJEŠENO PO ODLUCI** |
| R-08 | rečenica u IMPLEMENTATION_LOG | **RIJEŠENO PO ODLUCI** |

### R-01 — dokaz

- **Kod:** `git diff 1759848..HEAD -- backend/src/servisi/inicijalizacijaNaloga.js` mijenja samo rok (R-02); logika transakcije nepromijenjena.
- **Test (inspekcija):** `backend/test/emulator/inicijalizacijaNaloga.test.js` I02-T09: statusi ∈ {200, 201, 503}, 503 sa tačnim tijelom
  `SERVICE_UNAVAILABLE` (`provjeriTijeloGreske`), `kreirani.length <= 1`, sva 200/201 tijela `deepStrictEqual`, tačno 1 `users` / 1
  `loyaltyAccounts` / 0 `loyaltyLedger`, 0/0, naknadni sekvencijalni init → 200 sa tijelom jednakim uspješnim i sačuvanom `displayName`.
  Sve stavke odluke pokrivene.
- **Sopstvena skripta** `node r01.mjs 30` (spawn `src/pokreni.js`, 30 paralelnih init-a za isti uid, različit `displayName`, 3 serije po
  pokretanju; provjera nakon svake serije), izvršeno 3 puta:

| Pokretanje / serija | Statusi | Razl. uspješnih tijela | users / loyaltyAccounts / ledger | Bodovi | Najduži | Naknadni init |
|---|---|---|---|---|---|---|
| 1 / 1, 2, 3 | `200×29, 201×1` (sve tri) | 1 | 1 / 1 / 0 | 0/0 | 6 960 / 7 610 / 3 531 ms | 200, isto tijelo |
| 2 / 1 | `200×23, 201×1, 503×6` | 1 | 1 / 1 / 0 | 0/0 | 10 053 ms | 200, isto tijelo |
| 2 / 2, 3 | `200×29, 201×1` | 1 | 1 / 1 / 0 | 0/0 | 3 616 / 3 559 ms | 200, isto tijelo |
| 3 / 1, 2, 3 | `200×29, 201×1` (sve tri) | 1 | 1 / 1 / 0 | 0/0 | 6 595 / 3 583 / 7 084 ms | 200, isto tijelo |

  Ishod svakog pokretanja: `PROBLEMA: 0`; nijedan 500 (ni u logu procesa `INTERNAL_ERROR`); 503 tijela tačno `SERVICE_UNAVAILABLE`.
  Ishodi su u skladu sa odlukom (503 dozvoljen, konzistentnost uvijek ispunjena).
- **I02-T09 u 3 uzastopna `npm run test:emu`** (iz `backend`, JBR prvi u PATH-u): exit 0 / 0 / 0, `ℹ tests 36` `ℹ pass 36` `ℹ fail 0` svaki put;
  `✔ I02-T09 …` 14 690 / 14 233 / 10 861 ms; dijagnostika svih 9 ponavljanja `200×9, 201×1`. Dodatno zelen u oba `provjera.ps1` (14 385 / 10 775 ms).
- **Dokumentacija:** latencija/503 pod kontencijom upisani kao poznato ograničenje (IMPLEMENTATION_LOG i TEST_REPORT, „FIX LOOP 1”).

### R-02 — dokaz

- **Kod (inspekcija):** `backend/src/posrednici/autentikacija.js:15–16` — `rokDo = Date.now() + ROK_ZAVISNOG_SERVISA_MS` na ulazu u posrednik,
  `res.locals.rokDo`; `:24` — `saRokom(verifyIdToken(…, true), rokDo - Date.now())`; `rute/nalog.js:10` prosljeđuje `res.locals.rokDo`;
  `servisi/inicijalizacijaNaloga.js:23–26` — `preostaloMs = rokDo - Date.now()`, `if (!(preostaloMs > 0)) throw SERVICE_UNAVAILABLE` **prije**
  `db.runTransaction`, a transakcija dobija `saRokom(…, preostaloMs)`. `rokDo` je lokalna promjenljiva po zahtjevu (zatvaranje u
  `provjeraTokena`), nema dijeljenog stanja. Bez `rokDo` (`undefined` → `NaN`) servis ne pokreće transakciju (fail-safe). Konstanta i dalje 10 000 ms.
- **Napad 3b ponovljen** (`node r02.mjs`; spawn `src/pokreni.js`, Auth emulator iza `sporProksi` sa kašnjenjem po komadu, Firestore „crna rupa”):

| Auth kašnjenje | Kontrola (Firestore pravi) | Firestore crna rupa | Token u odgovoru/logu | users / loyaltyAccounts |
|---|---|---|---|---|
| 2 000 ms | 201 za 7 233 ms | **503 `SERVICE_UNAVAILABLE` za 10 037 ms** | ne | 0 / 0 |
| 4 000 ms | 503 za 10 045 ms | **503 `SERVICE_UNAVAILABLE` za 10 045 ms** | ne | 0 / 0 |

  (Prvi review: 14 057 / 18 044 ms.) Oba ≤ ~10,5 s.
- **Gdje ističe rok** (`node r02d.mjs <kašnjenje> <rupa|pravi>`, in-process, omotači samo bilježe vrijeme): verifikacija uspijeva, transakcija
  dobija samo ostatak:
  `Auth 2000, rupa: verifyIdToken OK t+4040; runTransaction t+4041; odgovor 503 t+10026` ·
  `Auth 2000, pravi: verifyIdToken OK t+4048; runTransaction t+4049; odgovor 201 t+7196` ·
  `Auth 4000, rupa: verifyIdToken OK t+8053; runTransaction t+8054; odgovor 503 t+10045` ·
  `Auth 4000, pravi: verifyIdToken OK t+8048; runTransaction t+8050; odgovor 503 t+10047`.
- **Rok istekao prije transakcije → transakcija se ne pokreće** (`node r02b.mjs`, in-process; lažni `auth.verifyIdToken` sinhrono blokira
  10 050 ms pa vraća razriješen uid; omotač baze broji `runTransaction`):
  `HTTP: 503 {"error":{"code":"SERVICE_UNAVAILABLE",…}} za 10089 ms; runTransaction pozvan: 0`; `users/rokIstekao postoji: false`.
  Log procesa: `"code":"SERVICE_UNAVAILABLE","status":503,…"stack":"GreskaApi: SERVICE_UNAVAILABLE\n at inicijalizujNalog (…/inicijalizacijaNaloga.js:25:11)"`
  — greška nastaje na zaštiti prije transakcije. Direktni pozivi servisa: `rokDo u prošlosti`, `rokDo = Date.now()`, `bez rokDo` →
  `SERVICE_UNAVAILABLE; runTransaction pozvan: 0` (sva tri).
- **Rokovi se ne dijele između zahtjeva** (`node r02.mjs`, Auth direktno, Firestore crna rupa; zahtjev 2 pokrenut 3 000 ms poslije zahtjeva 1):
  `zahtjev 1 → 503 trajanje 10036 ms (kraj t0+10036); zahtjev 2 (start t0+3000) → 503 trajanje 10017 ms (kraj t0+13030)` — svaki zahtjev ima
  svoj rok od 10 s.
- **Mutacija MR02 — vraćena dva nezavisna roka** (`verifyIdToken` sa `ROK_ZAVISNOG_SERVISA_MS`, transakcija sa `10_000`), `mutacija.sh MR02
  test/emulator/nedostupnostServisa.test.js` → exit 1:
  `✖ I02-T11 (c) Auth spor (4000 ms po komadu) … (18764.9758ms)` (`HTTP 503 za 18043 ms`),
  `✖ I02-T11 (c) Auth spor (2000 ms po komadu) … (15015.8639ms)` (`HTTP 503 za 14086 ms`); `ℹ tests 6 ℹ pass 4 ℹ fail 2`. **UBIJENA.**
- I02-T11 (c) u 3 × `test:emu` i 2 × `provjera.ps1`: 503 za 10 021 – 10 043 ms; (b) varijante: Firestore 10 025 – 10 046 ms, Auth zatvoren port
  18 – 40 ms, Auth crna rupa 10 020 – 10 041 ms.
- Zapažanje (nije nalaz, posljedica odluke): sa jednim rokom, spor Auth (~8 s) + hladan Firestore klijent daje 503 iako je Firestore dostupan
  (`Auth 4000, pravi` iznad); transakcija je već pokrenuta pa je kasnije commit-ovala oba dokumenta (poslije proba: 2 `users`, 2
  `loyaltyAccounts` — po par za oba „pravi” scenarija, nikad jedan dokument). To je već dokumentovano ograničenje „kasni commit poslije 503”
  iz i02; init je idempotentan, pa ponovljeni init vraća 200.

### R-03 — dokaz (inspekcija dokumentacije)

`docs/IMPLEMENTATION_LOG.md` (FIX LOOP 1, „Poznata ograničenja”) i `docs/TEST_REPORT.md` (FIX LOOP 1, „Poznata ograničenja”): opisano
`KEY_FETCH_ERROR` → `auth/argument-error` → 401 umjesto 503, neizvodljivo u emulatoru (P-9 klasa), vezano za O-2 prije Iteracije 9; kod
`greskeServisa.js` nepromijenjen (`git diff 1759848..HEAD -- backend/src/greske` → prazno). U skladu sa odlukom.

### R-04 — dokaz

- **Kod:** `backend/src/validacija/tijeloInita.js:11–17` — `typeof === 'string' && isWellFormed() && length >= 1 && length <= 100`; `.length`
  (UTF-16 jedinice) zadržan, bez trim-a i normalizacije.
- **Sopstvena proba** (`node r04r05.mjs`, spawn `src/pokreni.js`, svaki slučaj svjež korisnik): `"\uD800"`, `"a\uDC00"`, `"\uDC00a"`,
  `"\uDBFF\uDBFF"`, 99 × `a` + `"\uD83D"` → svi `422 INVALID_DISPLAY_NAME`, tačno tri polja; `baza poslije surogata: 0 dokumenata`.
  50 × 😀 → 201, 100 × `š` → 201, 100 × `a` → 201, 50 × `e\u0301` → 201 (upisano i vraćeno identično); 51 × 😀 → 422, 101 × `š` → 422.
  Log bez stack-a (`stack u logu: false`), `PROBLEMA: 0`.
- **Granica i dalje ista kao u Rules** (`node r04rules.mjs`, `@firebase/rules-unit-testing` iz `firebase/tests`, projekat
  `demo-rules-reviewer-fix1`, owner update `displayName` + `updatedAt = serverTimestamp()` naspram `provjeriTijeloInita`):
  100×a A/A, 101×a D/D, 50×😀 A/A, 51×😀 D/D, 100×š A/A, 101×š D/D, 99×a+😀 D/D, 50×e\u0301 A/A, `""` D/D, `" "` A/A → `RAZLIKA: 0`.
  `firebase/firestore.rules` nepromijenjen (`git diff 1759848..HEAD -- firebase` → prazno).
- **Mutacija MR04** (uklonjen `displayName.isWellFormed() &&`) → `inicijalizacijaNaloga.test.js` exit 1:
  `✖ I02-T06 neispravan displayName → 422 INVALID_DISPLAY_NAME, ništa upisano`, `usamljeni visoki surogat \uD800: status`, `500 !== 422`.
  **UBIJENA.** (U ovom izvršavanju bez ispravke ishod je 500, kao u prvom review-u; Builder je u svom izvršavanju zabilježio 503 — oba su
  „nije odbijeno validacijom”, test pada u oba slučaja.)
- Napomena: test pokriva `"\uD800"` i `"a\uDC00"`; `"\uDC00a"` je provjeren samo probom (isti kod putanje `isWellFormed`) — dovoljno.

### R-05 — dokaz

- **Ručno** (`node r04r05.mjs`): korisnik A, `?uid=<B>` → 201, `X-User-Id: <B>` → 200, `X-Uid: <B>` → 200, `X-Firebase-Uid: <B>` → 200;
  poslije: `users/B false, loyaltyAccounts/B false, users/A true, ukupno users 1, la 1`.
- **Mutacija M16** (`rute/nalog.js`: `uid: req.query.uid ?? res.locals.uid`) → exit 1:
  `✖ I02-T04 uid u query-ju i u zaglavljima X-User-Id / X-Uid se ignoriše → nalog samo za korisnika iz token-a`; `ℹ tests 16 ℹ pass 15 ℹ fail 1`. **UBIJENA.**
- **Mutacija M16h** (`uid: req.get('x-user-id') ?? req.get('x-uid') ?? res.locals.uid`) → exit 1, isti test pada. **UBIJENA.**

### R-06 — dokaz

- **Test (inspekcija):** nova varijanta I02-T08 — omotač `tx.getAll` vraća lažni snimak „ne postoji” za postojeći `users/{uid}` odnosno
  `loyaltyAccounts/{uid}` (zasebno), očekuje 500/503 bez stack-a, `brojUpisa >= 1` (upis je zaista pokušan) i oba dokumenta `deepStrictEqual`
  nepromijenjena. Bez mutacije: `ℹ sakriven users/{uid}: HTTP 500 INTERNAL_ERROR`, `ℹ sakriven loyaltyAccounts/{uid}: HTTP 500 INTERNAL_ERROR` (3 × test:emu).
- **Mutacija M04** (oba `tx.create` → `tx.set`, uslovi `exists` zadržani) → exit 1:
  `✖ I02-T08 getAll vraća „ne postoji” za postojeći dokument → 500/503 bez stack-a, users i loyaltyAccounts nepromijenjeni`; `ℹ fail 1`. **UBIJENA.**
- Dodatno M04u (samo `users`) i M04n (samo `loyaltyAccounts`) → exit 1, isti test pada. **UBIJENE.**

### R-07 — dokaz (inspekcija dokumentacije)

`README.md` (sekcija API, 2 nove rečenice) i `IMPLEMENTATION_LOG` (FIX LOOP 1, „Poznata ograničenja”): `{}`/prazno tijelo uz
`application/json` → `422 INVALID_DISPLAY_NAME`, bez JSON Content-Type → `422 INVALID_REQUEST`. `git diff 1759848..HEAD -- backend/src/aplikacija.js`
→ prazno; promjena u `tijeloInita.js` je samo R-04. U skladu sa odlukom.

### R-08 — dokaz (inspekcija dokumentacije)

`IMPLEMENTATION_LOG` i02 „Fajlovi”: `i02_plan.md` uklonjen iz liste izmijenjenih, `i02_brief.md` uklonjen iz „Netaknuti”, dodata rečenica
„`i02_brief.md` i `i02_plan.md` su dodati na grani u koracima Orchestrator-a i Planner-a; Builder je mijenjao samo sekciju 15 plana.” U skladu sa odlukom.

## 3. Novi nalazi

| ID | Severity | SRS / brief / odluka | Fajl:linija | Kratak opis |
|---|---|---|---|---|
| F1-01 | P3 | odluka R-02; CLAUDE.md („za svako business-critical ponašanje postoji automatski test”) | `backend/src/servisi/inicijalizacijaNaloga.js:24–26` | Zaštita „rok istekao → transakcija se ne pokreće” nema automatski test; mutacija koja je uklanja preživljava |

Nema P0, P1 ni P2 nalaza.

### F1-01 — zaštita isteklog roka bez testa (P3)

- **Zahtjev:** odluka R-02 (jedan rok za cijeli zaštićeni zahtjev); CLAUDE.md pravilo o automatskom testu. Builder ovu zaštitu navodi kao dio
  ispravke R-02 (IMPLEMENTATION_LOG, red R-02: „`inicijalizujNalog` ne pokreće transakciju kad je preostalo vrijeme ≤ 0”).
- **Fajl:** `backend/src/servisi/inicijalizacijaNaloga.js:24–26` (`if (!(preostaloMs > 0)) { throw new GreskaApi('SERVICE_UNAVAILABLE'); }`).
- **Scenarij:** mutacija MR02b (`if (!(preostaloMs > 0))` → `if (false)`) → `mutacija.sh MR02b test/emulator/nedostupnostServisa.test.js`
  → exit 0 (`ℹ tests 6 ℹ pass 6`); `mutacija.sh MR02b test/emulator/inicijalizacijaNaloga.test.js` → exit 0 (`ℹ tests 16 ℹ pass 16`).
  Sa mutacijom HTTP ishod ostaje 503 (`saRokom` sa negativnim rokom ističe za 1 ms), ali se transakcija pokreće poslije isteka roka i može
  kasnije commit-ovati dokumente za zahtjev koji je klijentu već vraćen kao 503.
- **Zašto P3:** trenutni kod je ispravan (dokazano probom `r02b.mjs`: `runTransaction pozvan: 0`); i sa mutacijom stanje bi ostalo
  konzistentno (oba dokumenta u jednoj transakciji, idempotentan init) i pokriveno dokumentovanim ograničenjem „kasni commit poslije 503”.
  Odluka R-02 traži samo jedan rok, koji je testom I02-T11 (c) dokazan (MR02 ubijena).
- **Očekivano:** automatski dokaz da se transakcija ne pokreće kad je rok istekao.
- **Najmanja ispravka:** samo test (bez izmjene koda).
- **Test:** npr. I02-T11 (d), in-process: `napraviAplikaciju` sa lažnim `auth` čiji `verifyIdToken` vrati uid tek poslije isteka roka (ili direktan
  poziv `inicijalizujNalog(omotac, …, Date.now() - 1)`) i omotačem baze koji broji `runTransaction` → 503 `SERVICE_UNAVAILABLE`, `runTransaction` 0 puta,
  0 dokumenata. Može se riješiti u FIX LOOP-u ili prenijeti u backlog — odluka Orchestrator-a; ne blokira prihvatanje.

## 4. Regresija i scope

### 4.1 Regresija

| Komanda | Rezultat |
|---|---|
| `.\skripte\provjera.ps1` (1) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 200 s; backend `npm test` `ℹ tests 34` `ℹ fail 0`; `npm run test:emu` `ℹ tests 36` `ℹ fail 0`; `firebase\tests npm test` `ℹ tests 17` `ℹ fail 0`; Android `BUILD SUCCESSFUL` ×2; smoke 404 `NOT_FOUND` i 401 `UNAUTHENTICATED` |
| `.\skripte\provjera.ps1` (2, odmah zatim) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 198 s; isti brojevi |
| `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` poslije | `zauzetih portova: 0` |
| `npm run test:emu` ×3 (prije `provjera.ps1`) | exit 0 ×3, `ℹ tests 36` `ℹ pass 36` `ℹ fail 0`, 133 / 133 / 130 s |
| `backend: npm ci` / `firebase\tests: npm ci` | exit 0; `added 713 packages …` / `added 729 packages …` |
| `git status --porcelain` poslije svega | prazno |

### 4.2 Mutacije (FIX LOOP 1)

| ID | Mutacija | Ciljani test fajl | Rezultat |
|---|---|---|---|
| M16 | UID iz `req.query.uid ?? res.locals.uid` | `inicijalizacijaNaloga.test.js` | UBIJENA (`✖ I02-T04 … query … zaglavljima`) |
| M16h | UID iz `X-User-Id` / `X-Uid` zaglavlja | isto | UBIJENA (isti test) |
| M04 | oba `tx.create` → `tx.set` | isto | UBIJENA (`✖ I02-T08 getAll vraća „ne postoji” …`) |
| M04u / M04n | samo `users` / samo `loyaltyAccounts` `tx.create` → `tx.set` | isto | UBIJENE (isti test) |
| MR04 | uklonjen `isWellFormed()` | isto | UBIJENA (`✖ I02-T06 neispravan displayName`, `500 !== 422`) |
| MR02 | dva nezavisna roka od po 10 s | `nedostupnostServisa.test.js` | UBIJENA (`✖ I02-T11 (c)` ×2, 18 043 / 14 086 ms) |
| MR02b | uklonjena zaštita isteklog roka prije transakcije | `nedostupnostServisa.test.js`, `inicijalizacijaNaloga.test.js` | PREŽIVJELA (exit 0 / exit 0) — F1-01 (P3) |

### 4.3 Scope

- `git diff --stat 1759848..HEAD`: 12 fajlova — `README.md`, `backend/src/konfiguracija/konfiguracija.js` (samo komentar), `backend/src/posrednici/autentikacija.js`,
  `backend/src/rute/nalog.js`, `backend/src/servisi/inicijalizacijaNaloga.js` (R-02), `backend/src/validacija/tijeloInita.js` (R-04),
  `backend/test/emulator/inicijalizacijaNaloga.test.js` (R-01, R-04, R-05, R-06), `backend/test/emulator/nedostupnostServisa.test.js` i
  `backend/test/pomocnici/procesBackenda.js` (R-02), `docs/IMPLEMENTATION_LOG.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md`. Svi potrebni za R-01 … R-08.
- `git diff --name-only 1759848..HEAD -- '*package*.json' firebase android-app pos-simulator docs/srs` → prazno (nema novih paketa, Rules nepromijenjen).
- Novi kodovi / rute: u dodatim linijama `backend/src` jedino `new GreskaApi('SERVICE_UNAVAILABLE')` (postojeći §27 kod); `katalogGresaka.js` bez izmjena;
  nijedan novi `ruter.*`. Nema TODO/FIXME u dodatim linijama.
- Commit-i `1759848..HEAD`: jedini autor `anaspasojevic <anaspasojevic09@gmail.com>`; `grep -i -E "co-authored|claude|generated|anthropic"` → prazno;
  JWT u `git log 1759848..HEAD -p` → `0`.
- TRACEABILITY: `git diff 1759848..HEAD -- docs/TRACEABILITY.md` mijenja samo kolone „Planirani test” i „Status” u redovima Iteracije 2 (§3.3, AUTH-02,
  §26 API-01, §27, NFR-04); kolone zahtjeva i iteracije nepromijenjene.
- SRS hash = `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (jednak zadatom).

### 4.4 Checkpoint dokumenti (pročitani poslije sopstvenih provjera)

Svaki novi PASS iz `docs/TEST_REPORT.md` („Iteracija 2 — FIX LOOP 1”) je reprodukovan:

| Tvrdnja TEST_REPORT-a | Moje izvršavanje |
|---|---|
| `npm test` 34/34 | `provjera.ps1` ×2: `ℹ tests 34` `ℹ fail 0` |
| `npm run test:emu` ×3 36/36 | ×3: `ℹ tests 36` `ℹ pass 36` `ℹ fail 0` |
| `firebase\tests npm test` 17/17 | `provjera.ps1` ×2: `ℹ tests 17` `ℹ fail 0` |
| `npm ci` oba exit 0 | exit 0 / exit 0 (713 / 729 paketa) |
| `provjera.ps1` ×2 exit 0 | `EXIT=0` ×2 |
| I02-T09 `200×9, 201×1` u svim ponavljanjima | 15/15 ponavljanja `200×9, 201×1` |
| I02-T11 (c) 503 za ~10,02–10,05 s; dva nezavisna roka ubijena | 10 021 – 10 043 ms; MR02 ubijena (18 043 / 14 086 ms) |
| I02-T04 M16 ubijena | M16 i M16h ubijene |
| I02-T06 mutacija `isWellFormed` ubijena | MR04 ubijena |
| I02-T08 nova varijanta → 500 za oba dokumenta; M04, M04-l ubijene | `HTTP 500 INTERNAL_ERROR` ×2 (3 × test:emu); M04, M04u, M04n ubijene |

Nereprodukovan PASS: nema. IMPLEMENTATION_LOG (FIX LOOP 1) opisuje izmjene istinito i u skladu sa diff-om; zaštita isteklog roka je
tačno opisana, ali bez testa (F1-01). Rečenice za R-03, R-07, R-08 i ograničenje R-01 prisutne.

## 5. Status

ITERATION ACCEPTED
