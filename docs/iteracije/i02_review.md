# i02 — Adversarial review (REVIEWER)

## 1. Pregledano stanje

| Stavka | Vrijednost |
|---|---|
| Grana / PR | `iteracija-02` → `main` (PR #2) |
| Commit | `bc82df8` (`git rev-parse --short HEAD`), radno stablo čisto na početku |
| Datum | 2026-10-16 |
| OS / shell | Windows 11 Pro 10.0.22621, Windows PowerShell 5.1 |
| Alati | `node -v` → `v24.21.0`; `npx firebase --version` → `15.32.1`; express `5.2.1`, firebase-admin `14.5.0` (`backend/package.json`); emulatori i Gradle sa JDK-om `C:\Program Files\Android\Android Studio\jbr` |
| SRS | `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` → `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`; `git diff main..HEAD -- docs/srs` → prazno |

Pročitano: `CLAUDE.md`, `docs/iteracije/i02_brief.md`, SRS §1.3, §2.2, §3, §5, §7.1–7.2, §11, §23–§31 (čitljiva kopija i §31 iz `.docx`-a),
`git diff main..HEAD`, cijeli `backend/src`, `backend/test`, `firebase/`, `skripte/provjera.ps1`, `.env.example`, `README.md`.
`docs/iteracije/i02_plan.md`, opis PR-a i commit poruke nisu korišćeni kao dokaz; `TEST_REPORT`, `IMPLEMENTATION_LOG` i `TRACEABILITY`
su pročitani tek u Fazi B. Pregledan je i izvor Admin SDK-a (`node_modules/firebase-admin/lib/auth/base-auth.js`, `token-verifier.js`,
`auth-api-request.js`) da bi se razlikovalo ponašanje SDK-a od ponašanja koda.

Sve probne skripte su bile u scratchpad direktorijumu sesije (van repozitorijuma): `zajednicko.mjs`, `napad1.mjs`, `napad1c.mjs`,
`napad2.mjs`, `napad3.mjs`, `napad3b.mjs`, `napad4.mjs`, `napad5.mjs`, `napad5b.mjs`, `mutacije.py`. `.env` nije pravljen.
Mutacije su vraćane sa `git restore -- backend/src firebase/firestore.rules` poslije svake; `git status --porcelain` poslije svake → prazno.

## 2. Izvršene provjere

### 2.1 Regresija (o)

| Komanda | Rezultat |
|---|---|
| `.\skripte\provjera.ps1` (1. put, prije napada) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 195 s. backend `npm test`: `ℹ tests 34` `ℹ fail 0`; `npm run test:emu`: `ℹ tests 32` `ℹ fail 0`; `firebase\tests npm test`: `ℹ tests 17` `ℹ fail 0`; Android `BUILD SUCCESSFUL` ×2; smoke 404 `NOT_FOUND` i 401 `UNAUTHENTICATED` |
| `.\skripte\provjera.ps1` (2. put, poslije svih napada i mutacija) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 174 s; isti brojevi (34/32/17, `fail 0`); I02-T09 10 764 ms |
| `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` poslije | 0 (slobodni) |

### 2.2 Inspekcija (e, n, 15)

| Provjera | Rezultat |
|---|---|
| `git grep -n -i -E "process\.env\.(NODE_ENV\|TEST)\|inject\|ubriz\|mock" -- backend/src` | prazno (exit 1) — nema test-only hook-ova |
| `git grep` za `pos/`, `rewards/`, `vouchers`, `reconcile`, `loyaltyLedger`, `X-POS`, `ACCOUNT_NOT_INITIALIZED`, `ruter.(get\|put\|patch\|delete\|post)` u `backend/src` | samo konstante kolekcija (`kolekcije.js`), stavka kataloga (i01), komentar u `dnevnik.js` i jedina ruta `ruter.post('/account/init', …)` (`rute/nalog.js:8`) — nema scope creep-a |
| `git diff --stat main..HEAD -- android-app pos-simulator` | prazno; `backend/package.json`, `package-lock.json`, `firebase/tests/package*.json` bez izmjena (nema novih paketa) |
| `git log --all -p \| grep -c -E "eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"` | `0` (nijedan JWT u istoriji) |
| `git log --all -p \| grep -E "PRIVATE KEY\|private_key\|AIza…\|client_secret"` | samo dokumentacija i provjera u `provjera.ps1` (regex), nijedna vrijednost |
| `git log --all --name-only \| grep -i -E "(^\|/)\.env$\|service-?account\|google-services\|\.pem$\|\.p12$"` | prazno |
| `git log main..HEAD --format="%an <%ae>%n%B" \| grep -i -E "co-authored\|claude\|generated\|anthropic"` | prazno; jedini autor `anaspasojevic <anaspasojevic09@gmail.com>` |
| Transakciona granica (`servisi/inicijalizacijaNaloga.js:26–66`) | oba upisa su `tx.create` u istom `db.runTransaction`; oba dokumenta se čitaju sa `tx.getAll` u transakciji; postojeći dokument se ne piše; callback nema sporednih efekata (samo lokalne promjenljive, nema logova, keša ni brojača van tx); nema ledger upisa; `maxAttempts: 5`; `saRokom` 10 s oko cijele transakcije |
| `posrednici/autentikacija.js:20` | `auth.verifyIdToken(poklapanje[1], true)` — checkRevoked = `true` (P-9, inspekcija); UID samo iz `dekodiran.uid` → `res.locals.uid`; `rute/nalog.js:10` prosljeđuje `uid: res.locals.uid` i samo dva validirana polja |
| Admin SDK `base-auth.js:121` | `if (checkRevoked \|\| isEmulator)` — u emulator režimu SDK uvijek provjerava opoziv i onemogućenje (potvrda P-9) |
| Admin SDK `auth-api-request.js:2050–2058` | emulator režim Auth-a = `!!process.env.FIREBASE_AUTH_EMULATOR_HOST`; jedina varijabla koja isključuje provjeru potpisa |
| `firebase/firestore.rules` vs §31 `.docx` (`word/document.xml`, tekst bez whitespace-a, do `match /purchases`) | `True` — helper funkcije i blokovi `/users/{uid}`, `/loyaltyAccounts/{uid}` identični; jedini ostatak je `match /{document=**} { allow read, write: if false; }`; nema dodatnih pravila |

### 2.3 Napadi nad pokrenutim backend-om (`src/pokreni.js` kao zaseban proces) i emulatorima

Emulatori: `cd backend; npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth`
(JBR prvi u PATH-u), ugašeni prije mutacija (portovi provjereni: 0 zauzetih).
Pokretanje proba: `node napad1.mjs`, `node napad1c.mjs`, `node napad2.mjs 30`, `node napad3.mjs`, `node napad3b.mjs`, `node napad4.mjs`, `node napad5.mjs`, `node napad5b.mjs`.

**(a) Granica autentikacije** — svaki slučaj: 401 `UNAUTHENTICATED`, tačno tri polja, baza prazna:
bez `Authorization`; `Basic …`; `Bearer`; `Bearer `; dva razmaka; tab; dodatni dio; token bez šeme; `Bearer,<token>`; istekao
(nepotpisan, `exp` u prošlosti); `aud`/`iss` drugog projekta; `aud` drugog projekta uz isti `iss`; prazan `sub`; nasumičan token;
token u `?token=`, `?access_token=`, `X-Firebase-Token`, `X-Authorization`, `Proxy-Authorization`; dva `Authorization` zaglavlja
(neispravno pa ispravno) → `HTTP/1.1 401`; obrisan, onemogućen, opozvan korisnik → 401. `bearer <token>` → 201, `BEARER <token>` → 200.
(Dva zaglavlja ispravno pa neispravno → 200: Node zadržava prvo `Authorization` zaglavlje; nije zaobilaženje.)

**(b) Impersonacija** — korisnik A: `uid` B u tijelu → 422 `INVALID_REQUEST`; `?uid=B` → 201 za A; `X-User-Id`, `X-Uid`,
`X-Firebase-Uid`, `uid` zaglavlja sa B → 200 za A. Poslije: dokumenti postoje samo za A, A nepromijenjen, za B ništa.

**(c) Mass assignment / prototype pollution** — `accountStatus`, `availablePoints`, `reservedPoints`, `createdAt`, `updatedAt`,
`acceptedTermsAt`, `nepoznato`, `constructor` (objekat), ugniježđen objekat, `displayname`, `" displayName"` → svi 422 `INVALID_REQUEST`.
Sirov `"__proto__"` → 422 `INVALID_REQUEST`; `{"displayName":{"__proto__":…}}` i `{"displayName":{"length":5}}` → 422 `INVALID_DISPLAY_NAME`.
Niz, `"Ana"`, `null`, bez Content-Type, `text/plain`, `application/x-www-form-urlencoded`, `application/merge-patch+json`,
`application/json; charset=utf-16` → 422 `INVALID_REQUEST` (svaki sa svježim korisnikom). Prazno tijelo uz `application/json`
→ 422 `INVALID_DISPLAY_NAME` (R-07). In-process (`napraviAplikaciju` importovan u probu) četiri `__proto__`/`constructor` tijela → 422;
poslije: `({}).zagadjeno` → `undefined`. Baza prazna. (Dupli ključ `displayName` → JSON.parse uzima zadnji → 201, očekivano.)

**(d) Validacija** — `displayName`: nedostaje, `""`, 101 × `a`, 51 × 😀, `null`, broj, niz → 422 `INVALID_DISPLAY_NAME`;
100 × `a`, 50 × 😀, `"A"`, `" "`, `"\u0000"`, 50 × `e\u0301` → 201, upisano i vraćeno identično; 99 × `a` + 😀 (101 UTF-16) → 422.
`"\uD800"` (usamljeni surogat) → **500 `INTERNAL_ERROR`**, stack `2 UNKNOWN: Application error processing RPC` u logu, 0 dokumenata (R-04).
`acceptedTermsVersion`: nedostaje, `1`, `"0.9"`, `"1.0 "`, `""`, `"1"`, `["1.0"]` → 422 `INVALID_REQUEST`.
Redoslijed: `displayName ""` + `"0.9"` → `INVALID_DISPLAY_NAME`; nepoznato polje + `displayName ""` → `INVALID_REQUEST`. Baza prazna.

**(f) Konkurentnost** — `node napad2.mjs 30` (30 paralelnih init-a, isti uid, različit `displayName`, 3 ponavljanja po procesu), izvršeno 3 × za N=30 i 1 × za N=10:

| Serija | Statusi | Različitih uspješnih tijela | users / loyaltyAccounts | Bodovi | Najduži odgovor |
|---|---|---|---|---|---|
| 1-1 (N=30) | `200×20, 201×1, 503×9` | 1 | 1 / 1 | 0/0 | 10 154 ms (503 poslije 10 063–10 153 ms) |
| 1-2, 1-3 | `200×29, 201×1` | 1 | 1 / 1 | 0/0 | 3 552 / 7 437 ms |
| 2-1 … 2-3 | `200×29, 201×1` | 1 | 1 / 1 | 0/0 | 6 763 / 3 556 / 3 581 ms |
| 3-1 … 3-3 | `200×29, 201×1` | 1 | 1 / 1 | 0/0 | 6 718 / 3 596 / 3 551 ms |
| N=10, 1 … 3 | `200×9, 201×1` | 1 | 1 / 1 | 0/0 | 6 382 / 3 553 / 3 543 ms |

Nijedan 500, nijedan duplikat, nijedan reset; u 1 od 12 serija 30 paralelnih 9 odgovora je 503 zbog isteka roka (R-01).
Trka sa `DELETION_IN_PROGRESS` (users ACTIVE bez loyaltyAccounts; 15 init-a, posle 30 ms Admin `update` statusa, pa još 15 init-a), 3 ×:
`{"409":15}/{"409":15}`, `{"409":15}/{"409":15}`, `{"201":1,"409":14}/{"409":15}` — nijedan init započet poslije promjene nije uspio;
u 3. seriji `loyaltyAccounts` je nastao, a `createTime` je **prije** `writeTime` promjene statusa (linearizovano); nijedan 500.

**(g) Idempotentnost** — init 201; Admin `availablePoints = 42`, `reservedPoints = 8`; poslije 1,2 s init sa `"Potpuno drugo"` → 200
`{"displayName":"Ana",…,"availablePoints":42,"reservedPoints":8}`; sva polja oba dokumenta (uklj. `updatedAt`, `acceptedTermsAt`)
jednaka; treći init → `updateTime` oba dokumenta nepromijenjen (nema upisa).

**(h) Djelimično stanje (P-2 A)** — samo users ACTIVE → 201, nastaje loyaltyAccounts 0/0, users nepromijenjen; samo loyaltyAccounts 42
→ 201, nastaje users, 42 ostaje; DELETION sa i bez loyaltyAccounts → 409, broj dokumenata 2→2 i 1→1, ništa izmijenjeno;
`"NEPOZNAT"` (sa i bez naloga), `accountStatus` nedostaje, `"active"` → 500, ništa izmijenjeno.

**(i) Nedostupnost** — `node napad3.mjs` (svaki scenarij zaseban proces backend-a):

| Scenarij | Odgovor | Dokumenti odmah / kasnije | Ponovljeni init istim procesom |
|---|---|---|---|
| Firestore zatvoren port | 503 za 10 040 ms | 0 / 0 | 503 |
| Auth zatvoren port | 503 za 37 ms | 0 / 0 | 503 |
| Firestore „crna rupa” | 503 za 10 045 ms | 0 / 0 | 503 |
| Auth „crna rupa” | 503 za 10 045 ms | 0 / 0 | 503 |
| oba „crna rupa” | 503 za 10 041 ms | 0 / 0 | 503 |
| Firestore spor (proxy 12 s), pa vraćen | 503 za 10 044 ms | 0 / **2** poslije 30 s (kasni commit, oba dokumenta) | 200, isto stanje |
| Firestore spor (4 s po paketu), pa vraćen | 503 za 10 049 ms | 0 / 2 | 200, isto stanje |
| Auth spor (12 s), pa vraćen | 503 za 10 022 ms | 0 / 0 | 201 |

Nikad 401 ni 500, nikad jedan dokument; token nije u odgovoru ni u logu procesa. `node napad3b.mjs` (Auth proxy kasni po paketu + Firestore crna rupa):
2 000 ms → 503 za 14 057 ms; **4 000 ms → 503 za 18 044 ms (> 15 s)** (R-02).

**(j) Curenje token-a** — `napad1.mjs`: 27 token-a, 87 odgovora (statusi 200, 201, 401, 409, 422, 500), log procesa 19 329 B (stdout + stderr,
uklj. stack za 500): nijedan cijeli token ni segment > 8 znakova u tijelu, zaglavljima ni logu; log ne sadrži `bearer`/`authorization`;
odgovori bez stack-a. 503 ishodi: `napad3.mjs`, `curenje token-a=false` za svih 8 scenarija.

**(k) Zaštita emulator režima** — `node napad4.mjs` (proces `src/pokreni.js`, port provjeravan svakih 25 ms):
`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, obje sa `""`, Auth sa `" "`, `firebase_auth_emulator_host` (mala slova),
`GCLOUD_PROJECT`/`GOOGLE_CLOUD_PROJECT=demo-x` uz prod `FIREBASE_PROJECT_ID`, `" demo-xx"`, `"DEMO-xx"`, `--env-file` sa emulator varijablom
→ svi `exit=1`, port nikad nije slušao, poruka imenuje samo varijable (bez vrijednosti). `NODE_OPTIONS=--env-file` → Node odbija (exit 9).
`"demo-xx "` → start (prefiks `demo-`, prihvatljivo). `FIREBASE_DATABASE_EMULATOR_HOST` + `FIREBASE_EMULATOR_HUB` uz prod → start, ali te
varijable ne isključuju provjeru potpisa (inspekcija SDK-a). Nijedno zaobilaženje.

**(l) Rules** — `node napad5.mjs`, `node napad5b.mjs` (rules-unit-testing, projekat `demo-rules-reviewer`): RULE-T01 … RULE-T07 kao u §30;
owner update samo `accountStatus` / `acceptedTermsVersion` / `acceptedTermsAt` / `createdAt` / nepoznato / `availablePoints` i svako od njih
uz `displayName` → DENY; `deleteField()` nad `accountStatus` i `displayName` → DENY; `updatedAt` klijentsko vrijeme / izostavljen / string → DENY;
create (i `set merge`) nepostojećeg users, delete, list (i upit sa `limit`), cross-user get i update → DENY; batch users + loyaltyAccounts → DENY;
transakcija nad loyaltyAccounts → DENY; loyaltyAccounts: owner update, `updatedAt`, merge, set istog sadržaja, delete, create, B update,
neautentifikovan get, list → DENY. Owner update samo `updatedAt = request.time` → ALLOW (dozvoljeno §31).
Granica `displayName` Rules ↔ Backend (`.length` 1–100): 100 × `a` A/A, 101 × `a` D/D, 50 × 😀 A/A, 51 × 😀 D/D, 99 × `a` + 😀 D/D,
50 × `e\u0301` A/A, 51 × D/D, 100 × `š` A/A, `" "` A/A, `""` D/D, NUL A/A, ZWJ porodica × 9 (72) A/A, × 12 (96) A/A, × 14 (112) D/D —
**ista granica u oba sloja** (OD-1/P-3 ispunjeno). Ukupno `PROBLEMA: 0` (tri prvobitna „XX” su bile greške probe: pogrešno izračunata dužina
ZWJ niza i batch/transakcija nad različitim instancama; ponovljeno ispravno u `napad5b.mjs`).

### 2.4 Mutacioni dokazi (m)

`python mutacije.py <id>`: primijeni → pokreni ciljani test fajl (emulator testovi kroz `npx firebase emulators:exec … "node --test --test-concurrency=1 <fajl>"`) → `git restore`.

| ID | Mutacija | Ciljani test | Rezultat |
|---|---|---|---|
| M01 | Rules: uklonjen `changedOnly([...])` u users update | `firebase\tests npm test` | UBIJEN: `✖ RULE-T05` |
| M02 | Rules: users `allow get: if signedIn()` | isto | UBIJEN: `✖ RULE-T03` |
| M17 | Rules: loyaltyAccounts `allow update: if isOwner(uid)` | isto | UBIJEN: `✖ RULE-T07 client update, merge i delete …` |
| M12c | Rules: `size() <= 101` | isto | UBIJEN: `✖ I02-T15 users update vlasnika: neispravan displayName …` |
| M03 | UID iz `req.body` + uklonjena provjera nepoznatih ključeva | `inicijalizacijaNaloga.test.js` | UBIJEN: `✖ I02-T04` |
| M16 | UID iz `req.query.uid ?? res.locals.uid` (validacija tijela zadržana) | `inicijalizacijaNaloga.test.js`, `autentikacija.test.js` | **PREŽIVIO** (exit 0) — R-05 |
| M04 | `tx.create` → `tx.set` (oba), uslov `exists` zadržan | `inicijalizacijaNaloga.test.js` | **PREŽIVIO** (exit 0) — R-06 |
| M04b | `tx.set` bezuslovno (uklonjen `exists` uslov) | isto | UBIJEN: `✖ API-T01`, `✖ I02-T14 (a)`, `✖ I02-T14 (b)` |
| M05 | users upis van transakcije (`await refKorisnik.create(korisnik)`) | isto | UBIJEN: `✖ I02-T08` (+7 drugih) |
| M06a | uklonjen `saRokom` oko transakcije | `nedostupnostServisa.test.js` | UBIJEN: `✖ I02-T11 Firestore … (crna rupa)` (20 953 ms), `(zatvoren port)` |
| M06b | uklonjen `saRokom` oko `verifyIdToken` | isto | UBIJEN: `✖ I02-T11 Auth nedostupan (crna rupa)` (20 623 ms) |
| M07 | uklonjena zaštita emulator/demo | `konfiguracija.test.js`, `pokretanjeBackenda.test.js` | UBIJEN: `✖ I02-T13` (unit + oba spawn testa) |
| M08 | `status >= 400 && status < 500` → `status >= 400` | `aplikacija.test.js` | UBIJEN: `✖ I01-T03 … 5xx … (N-01)` |
| M09 | `verifyIdToken(token, true)` → `verifyIdToken(token)` | `autentikacija.test.js` | preživio — P-9 (SDK `checkRevoked \|\| isEmulator`), nije nalaz; `true` potvrđen inspekcijom |
| M10 | uklonjena provjera `DELETION_IN_PROGRESS` (status tretiran kao poznat) | `inicijalizacijaNaloga.test.js` | UBIJEN: `✖ I02-T10` (oba testa) |
| M11 | init piše `loyaltyLedger` dokument | isto | UBIJEN: `✖ API-T01` |
| M12 | Backend `length <= 101` | isto | UBIJEN: `✖ I02-T06 neispravan displayName …` |
| M12b | Backend broji code point-e (`[...displayName].length`) | isto | UBIJEN: `✖ I02-T06 neispravan displayName …` |
| M13 | nepoznat `accountStatus` tretiran kao ACTIVE | isto | UBIJEN: `✖ I02-T14 (c)` |
| M14 | šema `Bearer` case-sensitive | `autentikacija.test.js` | UBIJEN: `✖ I02-T02 pozitivna kontrola …` |
| M15 | `Authorization` dodat u log greške | `logBezTokena.test.js` | UBIJEN: `✖ I02-T12` |

## 3. Nalazi

| ID | Severity | SRS / brief / odluka | Fajl | Kratak opis |
|---|---|---|---|---|
| R-01 | P2 | brief DoD (konkurentni init), I02-T09, i02/P-5 | `backend/src/servisi/inicijalizacijaNaloga.js:26–69` | Pod kontencijom (30 paralelnih, isti uid) dio zahtjeva dobija 503 po isteku roka; latencija 3,5–10 s; I02-T09 sa rizikom nestabilnosti |
| R-02 | P2 | brief tačka 2 (503 „u ograničenom roku”), I02-T11 („npr. < 15 s”), i02/P-5 | `backend/src/posrednici/autentikacija.js:20`, `backend/src/servisi/inicijalizacijaNaloga.js:69` | Rokovi se sabiraju (Auth 10 s + Firestore 10 s): izmjereno 18 044 ms do 503 |
| R-03 | P2 | brief tačka 2 (Auth nedostupan → 503, ne 401), i02/P-5 | `backend/src/greske/greskeServisa.js:15–22` | Van emulatora neuspjelo preuzimanje javnih ključeva SDK prijavljuje kao `auth/argument-error` → 401 umjesto 503 |
| R-04 | P2 | §27 `INVALID_DISPLAY_NAME`, brief (validacija), i02/P-3 | `backend/src/validacija/tijeloInita.js:10–12` | `displayName` sa usamljenim surogatom prolazi validaciju, Firestore ga odbija → 500 `INTERNAL_ERROR` umjesto 422 |
| R-05 | P2 | §3.3, brief I02-T04 | `backend/test/emulator/inicijalizacijaNaloga.test.js:176–198`, `autentikacija.test.js` | Nema regresionog testa za UID iz query-ja/zaglavlja; mutacija M16 preživljava |
| R-06 | P2 | brief (postojeći dokument se ne piše), i02/P-2 | `backend/src/servisi/inicijalizacijaNaloga.js:54,59` | Mutacija `tx.create` → `tx.set` (uz zadržan `exists` uslov) preživljava sve testove |
| R-07 | P3 | brief (tijelo mora biti JSON objekat sa tačno dva polja) | `backend/src/aplikacija.js:7`, `validacija/tijeloInita.js` | Prazno tijelo uz `Content-Type: application/json` → `INVALID_DISPLAY_NAME`, bez Content-Type → `INVALID_REQUEST` |
| R-08 | P3 | CLAUDE.md (checkpoint dokumenti) | `docs/IMPLEMENTATION_LOG.md` (i02, „Fajlovi”) | `i02_brief.md` naveden kao „netaknut”, `i02_plan.md` kao „izmijenjen”, a u `git diff main..HEAD` oba su novi fajlovi |

Nema P0 ni P1 nalaza. Nijedno zaobilaženje autentikacije, nijedna impersonacija, nijedan klijentski upis bodova/statusa, nijedno djelimično
stanje, nijedan token u odgovoru ili logu, nijedno odstupanje Rules od §31.

### R-01 — 503 i latencija pod konkurentnim init-om (P2)

- **Zahtjev:** brief DoD „Konkurentni init ne pravi duplikate, ne vraća 500 i ne resetuje stanje”; I02-T09; i02/P-5 (ABORTED i istek roka → 503).
- **Fajl:** `backend/src/servisi/inicijalizacijaNaloga.js:26–69` (svaki init, i ponovljeni koji ništa ne piše, ide kroz transakciju sa
  zaključavanjem oba dokumenta; `maxAttempts: 5` sa backoff-om SDK-a; rok 10 s).
- **Scenarij:** `node napad2.mjs 30` → serija 1-1: `{"200":20,"201":1,"503":9}`, 503 poslije 10 063–10 153 ms; ostalih 11 serija bez 503,
  ali najduži odgovor 3,5–7,4 s (N=30) i 3,5–6,4 s (N=10). I02-T09 u `provjera.ps1` traje 10,8–18,4 s za 3 × 10 zahtjeva.
- **Zašto nije P1:** nema 500, duplikata ni reseta; stanje je uvijek 1 users + 1 loyaltyAccounts, 0/0; 503 je po P-5 odobren ishod za
  ABORTED/istek roka, a init je idempotentan pa je klijentski retry bezbjedan. Ali kriterijum „sva tijela ista” iz pokušaja (f) nije
  ispunjen u 1/12 serija, a I02-T09 (koji dozvoljava samo 200/201) ima stvaran rizik nestabilnog pada kad prvi ciklus zakasni.
- **Očekivano:** paralelni init-i za isti uid završavaju sa 200/201 i istim tijelom u roku.
- **Najmanja ispravka (Orchestrator bira):** (1) dokumentovati latenciju kao poznato ograničenje (pesimistično zaključavanje u
  emulatoru) i u I02-T09 eksplicitno dozvoliti 503 uz provjeru konzistentnosti; ili (2) prvo čitati oba dokumenta van transakcije i, kad
  oba postoje, vratiti stanje bez transakcije (dokumenti se tada ionako ne pišu), a u transakciju ulaziti samo kad nešto nedostaje.
- **Test:** I02-T09 sa 30 paralelnih init-a u 3 ponavljanja → nijedan 500, tačno jedan 201, sva uspješna tijela ista, i (zavisno od odluke)
  ili nijedan 503 ili 503 dozvoljen uz 1/1 dokument i 0/0.

### R-02 — rok po pozivu, ne po zahtjevu: 18 s do 503 (P2)

- **Zahtjev:** brief tačka 2 „zahtjev se završava u ograničenom roku sa 503”; I02-T11 „u roku (npr. < 15 s)”; i02/P-5 „rok 10 s”.
- **Fajl:** `backend/src/posrednici/autentikacija.js:20` (`saRokom(verifyIdToken, 10 s)`) i `backend/src/servisi/inicijalizacijaNaloga.js:69`
  (`saRokom(transakcija, 10 s)`) — dva nezavisna roka u nizu; `konfiguracija.js:4–5` opisuje rok „za jedan poziv”.
- **Scenarij:** `node napad3b.mjs`: Auth emulator iza proxy-ja koji kasni 4 000 ms po paketu (verifikacija uspijeva za < 10 s), Firestore
  „crna rupa” → `503 SERVICE_UNAVAILABLE za 18044 ms`. Teorijski maksimum ~20 s. (Uz 2 000 ms: 14 057 ms.)
- **Očekivano:** jedan rok za cijeli zahtjev, tako da je 503 uvijek u roku iz brief-a.
- **Najmanja ispravka:** rok računati od početka zahtjeva (npr. `res.locals.rokDo = Date.now() + 10 000` u posredniku i preostalo vrijeme za
  transakciju), ili eksplicitna odluka Orchestrator-a da je P-5 rok po pozivu, uz izmjenu I02-T11 kriterijuma na „≤ 2 × 10 s”.
- **Test:** I02-T11 (c): Auth spor (ispod roka) + Firestore nedostupan → 503 za < 15 s.

### R-03 — van emulatora nedostupan servis javnih ključeva → 401 umjesto 503 (P2)

- **Zahtjev:** brief tačka 2 „ako Firestore ili Auth nisu dostupni … 503 (ne visi, nije 500 i nije 401)”; i02/P-5.
- **Fajl:** `backend/src/greske/greskeServisa.js:15–22` (`auth/argument-error` → `UNAUTHENTICATED`). Uzrok u SDK-u:
  `node_modules/firebase-admin/lib/auth/token-verifier.js:257–285` — `JwtErrorCode.KEY_FETCH_ERROR` se mapira na `INVALID_ARGUMENT`
  (`auth/argument-error`).
- **Scenarij (inspekcija; u emulatoru neizvodljivo jer emulator ne preuzima ključeve, P-9 klasa):** backend sa ne-demo projektom, bez mreže
  prema `googleapis.com` i sa praznim kešom ključeva → svaki `verifyIdToken` odbija sa `auth/argument-error` → 401 `UNAUTHENTICATED`; Android
  bi korisnika tretirao kao odjavljenog umjesto da ponovi pokušaj.
- **Zašto P2:** van obaveznog MVP okruženja (§2.3, §2.4, §33.3) i neizvodljivo testom; implementacija tačno slijedi listu iz P-5.
- **Najmanja ispravka:** dokumentovati kao poznato ograničenje u TEST_REPORT/IMPLEMENTATION_LOG (uz P-9), ili prepoznati grešku preuzimanja
  ključeva (poruka SDK-a „Error fetching public keys”) i mapirati je na 503 — odluka Orchestrator-a.
- **Test:** unit test `klasifikujGreskuAuth` sa stvarnim oblikom greške preuzimanja ključeva → `SERVICE_UNAVAILABLE` (ako se ispravlja).

### R-04 — usamljeni surogat u `displayName` → 500 (P2)

- **Zahtjev:** §27 `INVALID_DISPLAY_NAME` 422 „Display name није валидан”; brief: „displayName … inače 422 INVALID_DISPLAY_NAME”;
  i02/P-3 (`.length`, bez trim-a i normalizacije).
- **Fajl:** `backend/src/validacija/tijeloInita.js:10–12` (`jeIspravnoIme` provjerava samo tip i `.length`).
- **Scenarij:** `napad1.mjs`, `POST /api/v1/account/init` sa tijelom `{"displayName":"\ud800","acceptedTermsVersion":"1.0"}` i važećim token-om
  → `500 INTERNAL_ERROR`; log: `"stack":"Error: 2 UNKNOWN: Application error processing RPC …"`; 0 dokumenata (bez djelimičnog stanja).
- **Zašto P2, a ne P1:** stanje se ne mijenja i ništa ne curi; ulaz zadovoljava doslovnu definiciju iz brief-a/P-3 („string dužine 1–100”),
  a odluke ne pokrivaju neispravan UTF-16 — po CLAUDE.md ovo se označava i prepušta Orchestrator-u, ne „pomiruje”.
  Rules ne mogu primiti takav string, pa ispravka ne mijenja zajedničku granicu iz OD-1.
- **Najmanja ispravka:** u `jeIspravnoIme` dodati `displayName.isWellFormed()` (validacija, ne normalizacija).
- **Test:** I02-T06 slučaj `"\uD800"` (i `"a\uDC00"`) → 422 `INVALID_DISPLAY_NAME`, baza prazna.

### R-05 — nema testa za UID iz query-ja ili zaglavlja (P2)

- **Zahtjev:** §3.3 „не прихвата client-supplied UID као user authority”; brief I02-T04; pokušaj (b).
- **Fajl:** `backend/test/emulator/inicijalizacijaNaloga.test.js:176–198` (samo `uid` u tijelu); `autentikacija.test.js:73–86` (samo token u query-ju).
- **Scenarij:** mutacija M16 — `rute/nalog.js:10` `{ uid: req.query.uid ?? res.locals.uid, ...ulaz }` — `inicijalizacijaNaloga.test.js` i
  `autentikacija.test.js` → exit 0. Sa tom mutacijom A bi sa `?uid=B` kreirao nalog za B. Trenutni kod je ispravan (pokušaj (b): `?uid=B`,
  `X-User-Id`, `X-Uid` → dokumenti samo za A).
- **Najmanja ispravka:** samo test.
- **Test:** proširiti I02-T04: A sa `?uid=<B>` i sa zaglavljima `X-User-Id`/`X-Uid: <B>` → 201/200 za A, `users/B` i `loyaltyAccounts/B` ne postoje.

### R-06 — mutacija `tx.create` → `tx.set` preživljava (P2)

- **Zahtjev:** brief/P-2 A „postojeći dokument se ne mijenja ni jednim poljem”; pokušaj (m) traži da ova mutacija obori API-T01 (b) ili I02-T14.
- **Fajl:** `backend/src/servisi/inicijalizacijaNaloga.js:54` i `:59`.
- **Scenarij:** M04 (oba `tx.create` → `tx.set`, uslovi `if (!snimak….exists)` zadržani) → `inicijalizacijaNaloga.test.js` exit 0
  (uključujući I02-T09). Bezuslovni `tx.set` (M04b) je ubijen (`✖ API-T01`, `✖ I02-T14 (a)/(b)`).
- **Zašto P2, a ne P1:** uz čitanje u istoj transakciji mutant je nad stvarnim Firestore-om ponašanjem ekvivalentan (konkurentni upis između
  čitanja i commit-a poništava transakciju u oba slučaja), pa ponašanje nije ugroženo; ali drugi sloj zaštite (`create` odbija postojeći
  dokument) nema dokaz, a eksplicitno tražen mutacioni dokaz nije ispunjen.
- **Najmanja ispravka:** samo test.
- **Test:** I02-T08 varijanta sa omotačem transakcije čiji `getAll` za postojeći `users/{uid}` vraća snimak „ne postoji” → očekivano
  500/503 i `users/{uid}` bajt-po-bajt nepromijenjen (sa `tx.set` bi bio prepisan).

### R-07 — prazno JSON tijelo daje `INVALID_DISPLAY_NAME` (P3)

- **Zahtjev:** brief „tijelo mora biti JSON objekat sa TAČNO poljima displayName i acceptedTermsVersion”.
- **Fajl:** `backend/src/aplikacija.js:7` (`express.json()` za prazno tijelo daje `{}`), `validacija/tijeloInita.js:17–25`.
- **Scenarij:** `napad1c.mjs`: `Content-Type: application/json`, tijelo `""` → 422 `INVALID_DISPLAY_NAME`; isto bez Content-Type → 422 `INVALID_REQUEST`.
  Builder je to zabilježio u TEST_REPORT („Nalazi tokom izvršavanja”); nema uticaja na stanje.
- **Ispravka (opciono):** odluka da li je `{}`/prazno tijelo `INVALID_REQUEST`; ako da — provjera prisustva oba ključa prije provjere vrijednosti.
- **Test:** I02-T05 slučaj „prazno tijelo uz application/json” sa odlučenim kodom.

### R-08 — lista fajlova u IMPLEMENTATION_LOG (P3)

- **Fajl:** `docs/IMPLEMENTATION_LOG.md`, i02 „Fajlovi”: `docs/iteracije/i02_plan.md` je pod „Izmijenjeni (samo sekcija 15)”, a
  `docs/iteracije/i02_brief.md` pod „Netaknuti”; `git diff --name-only main..HEAD` prikazuje oba kao nove fajlove na grani (dodali su ih
  Orchestrator i Planner, ne Builder). Svi ostali fajlovi iz `git diff --name-only main..HEAD` su navedeni.
- **Ispravka:** jedna rečenica: „i02_brief.md i i02_plan.md su dodati na grani u koracima Orchestrator-a/Planner-a; Builder je mijenjao samo sekciju 15 plana.”

## 4. Pokrivenost obaveznih testova

| ID | Ocjena | Obrazloženje |
|---|---|---|
| API-T01 | adekvatno | tačna polja oba dokumenta, serverski timestamp-ovi, 0 ledger; ponovljeni init sa 42 → sva polja jednaka; M04b i M11 ubijeni |
| RULE-T01 … RULE-T07 | adekvatno | reprodukovano; M01, M02, M17 ubijeni; dodatni napadi (l) bez odstupanja |
| I02-T01 | adekvatno | bez zaglavlja, token u query-ju i drugom zaglavlju |
| I02-T02 | adekvatno | oblici zaglavlja, neispravan/istekao/drugi `aud`, pozitivna kontrola `bearer`; M14 ubijen |
| I02-T03 | adekvatno uz P-9 | obrisan/onemogućen/opozvan → 401; M09 preživljava zbog SDK-a (`checkRevoked \|\| isEmulator`), `true` potvrđen inspekcijom |
| I02-T04 | adekvatno za tijelo | M03 ubijen; query/zaglavlje nisu pokriveni (R-05, P2) |
| I02-T05 | adekvatno | server-controlled, nepoznato, `__proto__`, `constructor`, ne-objekat, `text/plain` |
| I02-T06 | adekvatno | granice u UTF-16 jedinicama; M12, M12b ubijeni; usamljeni surogat nije pokriven (R-04) |
| I02-T07 | adekvatno | svi oblici iz brief-a i O-11 |
| I02-T08 | adekvatno | M05 (upis van tx) ubijen; drugi sloj `create` nedokazan (R-06) |
| I02-T09 | adekvatno, uz rizik | 10 paralelnih ×3 prolazi; pod 30 paralelnih moguć 503 (R-01) |
| I02-T10 | adekvatno | sa i bez loyaltyAccounts; M10 ubijen; trka sa promjenom statusa (f) bez uspjeha poslije promjene |
| I02-T11 | adekvatno po servisu | M06a, M06b ubijeni; zbir rokova nije pokriven (R-02); R-03 netestabilno u emulatoru |
| I02-T12 | adekvatno | svi kanali, svi ishodi, segmenti token-a; M15 ubijen |
| I02-T13 | adekvatno | unit + spawn; M07 ubijen; zaobilaženja (k) neuspješna |
| I02-T14 | adekvatno | (a), (b), (c); M13 ubijen |
| I02-T15 | adekvatno | create/delete/list/cross-user/klijentski `updatedAt`/astralna granica; M12c ubijen |
| I02-T16 | adekvatno | GET init, nepostojeća ruta, neispravan JSON bez token-a (P-6); smoke 401 u `provjera.ps1` |
| N-01 | adekvatno | M08 ubijen |
| Regresija i01 | adekvatno | I01-T01 … T11, RULE-T12, I01-T10 (samo loyaltyLedger), Android build — `provjera.ps1` ×2, exit 0 |

## 5. Checkpoint dokumenti (Faza B)

- **TEST_REPORT:** reprodukovani su svi PASS-ovi iz „Rezultat po ID-u (Iteracija 2)”: backend `npm test` 34/34, `npm run test:emu` 32/32,
  `firebase\tests npm test` 17/17, `provjera.ps1` exit 0 dva puta zaredom; stvarni `err.code`-ovi (`auth/argument-error`,
  `auth/id-token-expired`, `auth/user-not-found`, `auth/user-disabled`, `auth/id-token-revoked`, `app/network-error`) i trajanja 503
  (~10 040 ms za Firestore, ~37 ms za zatvoren Auth port) se poklapaju sa mojim izvršavanjem. Builder-ove kontrolne mutacije M1 (preživljava, P-9),
  M2 (preživljava zbog stroge validacije), M2b–M10 i M-R01c se poklapaju sa mojim M09, M03, M05, M04b, M06a, M07, M01, M02, M15, M08.
  Nereprodukovan PASS: nema.
- **IMPLEMENTATION_LOG:** ponašanje je opisano istinito (provjereno napadima a–l); lista fajlova pokriva `git diff --name-only main..HEAD`
  osim netačne klasifikacije `i02_brief.md`/`i02_plan.md` (R-08, P3). Ograničenja (kasni commit poslije 503, i07 redoslijed brisanja, P-9,
  zatvoren Firestore port ~10 s) potvrđena.
- **TRACEABILITY:** `git diff main..HEAD -- docs/TRACEABILITY.md` mijenja samo kolone „Kod”, „Planirani test” i „Status” u redovima čija
  kolona iteracija uključuje 2 (§2.2/§3.2, §3.3, AUTH-01 … AUTH-05, AUTH-10, §7.1/§7.2, §24, §25/§31, §26 API-01, §27, NFR-01, NFR-03, NFR-04,
  NFR-07, AC-02); kolone zahtjeva i iteracije nepromijenjene. AUTH-03: „I02 ACCOUNT_NOT_INITIALIZED” zamijenjeno sa „I02 init iz stanja
  NOT_INITIALIZED; ACCOUNT_NOT_INITIALIZED u i04” po brief-u, uz dodatak „(API-T01 (a), I02-T14)” u istoj koloni — prihvatljivo.
- **OD-1:** Backend i Rules imaju istu granicu — dokazano u 2.3 (l) i (d) na 15 graničnih nizova (uključujući astralne znakove, kombinujuće
  znakove i ZWJ nizove) i mutacijama M12b/M12c.
- **OD-2** (konstanta roka uvedena u koraku 3): bez uticaja na opseg i ugovor — prihvatljivo.
- **OD-3** (dijagnostika `err.code` kroz privremenu Admin aplikaciju): samo dijagnostički ispis, asercije testa se oslanjaju na spawn-ovan
  proces; M06b dokazuje da test zaista zavisi od roka — prihvatljivo.
- **OD-4** (smoke 401 u istom koraku kao smoke 404): oba smoke-a reprodukovana u obje regresije — prihvatljivo.

## 6. Status

ITERATION ACCEPTED
