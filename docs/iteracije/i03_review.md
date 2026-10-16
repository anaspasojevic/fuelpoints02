# i03 — Adversarial review (REVIEWER)

## 1. Pregledano stanje

| Stavka | Vrijednost |
|---|---|
| Grana / PR | `iteracija-03` → `main` |
| Commit | `e1cff20` (`git rev-parse --short HEAD`); `git fetch`, `git pull --ff-only` → „Already up to date”; radno stablo čisto na početku |
| Datum | 2026-10-16 |
| OS / shell | Windows 11 Pro 10.0.22621, Windows PowerShell 5.1 (probe i Git Bash za pomoćne komande) |
| Alati | `node` `v24.21.0`; express `5.2.1`, firebase-admin `14.5.0`, firebase-tools `15.32.1` (`backend/package.json`); `@firebase/rules-unit-testing` `5.0.2`; emulatori i Gradle sa JDK-om `C:\Program Files\Android\Android Studio\jbr` |
| SRS | `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` → `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (prije i poslije); `git diff main..HEAD -- docs/srs` → prazno |

Pročitano kao osnova (Faza A): `CLAUDE.md`, `docs/iteracije/i03_brief.md`, SRS §1.5, §3, §7, §8–§11, §21, §24–§31 (čitljiva kopija; §31 iz
`word/document.xml` `.docx`-a), `git diff main..HEAD`, cijeli `backend/src`, `backend/test`, `firebase/` (rules i testovi), `skripte/provjera.ps1`,
`.env.example`, `README.md`, i od plana SAMO sekcija 15 (odluke). `docs/iteracije/i02_review.md` samo kao uzor strukture.
NIJE korišćeno kao dokaz u Fazi A: ostatak `i03_plan.md`, opis PR-a, commit poruke, `TEST_REPORT`, `IMPLEMENTATION_LOG`, `TRACEABILITY`
(pročitani tek u Fazi B, sekcija 5).

Probne skripte (sve u scratchpad direktorijumu sesije, van repozitorijuma): `zajednicko.mjs`, `napad1.mjs` (autentikacija, mass assignment,
validacija, idempotentnost, model podataka), `napad2.mjs` (transakciona granica, konkurentnost), `napad3.mjs` (spawn `src/pokreni.js`: tajne,
sirovi HTTP, rok, konfiguracija), `napad4.mjs` (Security Rules), `pravila31.py` / `pravila31b.py` (poređenje Rules sa §31), `mutacije.py`.
`.env` nije pravljen; POS ključevi su generisani u toku izvršavanja (`randomBytes(32).toString('base64url')`) i nigdje nisu upisani.
Mutacije su vraćane sa `git restore -- backend/src firebase/firestore.rules` poslije svake; `git status --porcelain` poslije svake → prazno.

## 2. Izvršene provjere

### 2.1 Regresija (o)

| Komanda | Rezultat |
|---|---|
| `.\skripte\provjera.ps1; $LASTEXITCODE` (1., prije napada) | `SVE PROVJERE PROŠLE`, `EXIT=0`, 278 s; backend `npm test` `ℹ tests 45` `ℹ fail 0`; `npm run test:emu` `ℹ tests 67` `ℹ fail 0`; rules `ℹ tests 25` `ℹ fail 0`; smoke `404 NOT_FOUND`, `401 UNAUTHENTICATED`, `401 UNAUTHENTICATED_POS`; Android `BUILD SUCCESSFUL` ×2 |
| `cd backend; npm ci` (poslije napada i mutacija) | `added 713 packages`, exit 0 |
| `npm test` | `ℹ tests 45` `ℹ pass 45` `ℹ fail 0`, exit 0 |
| `npm run test:emu` ×3 zaredom | 67/67, `fail 0`, exit 0 sva tri (209 s, 197 s, 211 s). I03-T11: 503 u 1 od 3 ponavljanja u izvršavanjima 1 i 3 (`…,201,503`; `201,…,503,200,503,200`), uz tačno 1 purchase/EARN/notifikaciju; I03-T12: broj 503 = 0, 0, 1; I03-T13: 503 za 10 018 / 10 017 / 10 008 ms |
| `cd firebase\tests; npm ci; npm test` | `added 729 packages`; `ℹ tests 25` `ℹ pass 25` `ℹ fail 0`, exit 0 |
| `.\skripte\provjera.ps1; $LASTEXITCODE` (2., poslije svega) | `SVE PROVJERE PROŠLE`, `PROVJERA2=0`, 288 s; isti brojevi (45/67/25) |
| SRS hash / `git diff main..HEAD -- docs/srs` | `7D8664…60228` / prazno |
| `git status --porcelain` na kraju | prazno |
| `Get-NetTCPConnection -State Listen -LocalPort 8080,9099` na kraju | 0 (slobodni) |

### 2.2 Inspekcija (k, l, 15)

| Provjera | Rezultat |
|---|---|
| `git grep -n -E "ruter\.(get\|put\|patch\|delete\|post\|use\|all)" -- backend/src` | samo `rute/kupovine.js:9` `ruter.post('/pos/purchases', …)` i postojeći `rute/nalog.js:8` — nema novog endpoint-a; POS posrednik vezan samo na tu rutu |
| `git grep -n -i -E "process\.env\.(NODE_ENV\|TEST)\|inject\|ubriz\|mock" -- backend/src` | prazno (exit 1) — nema test-only hook-ova (opcija `dodajRute` postoji od i01, nije nova) |
| `git grep -n -E "TODO\|FIXME\|XXX" -- backend firebase/firestore.rules firebase/tests skripte` | samo `integrity` heševi u `package-lock.json` i regex u `provjera.ps1` |
| `git diff --stat main..HEAD -- android-app pos-simulator backend/package*.json firebase/tests/package*.json firebase.json` | prazno — nema novih paketa, Android i pos-simulator netaknuti |
| `git diff main..HEAD -- backend/src/greske` | prazno — nema novog koda greške |
| `git log main..HEAD --format="%an <%ae>%n%B" \| grep -i -E "co-authored\|claude\|generated\|anthropic\|\bAI\b"` | prazno; jedini autor `anaspasojevic <anaspasojevic09@gmail.com>` |
| `git log -p main..HEAD \| grep -o -E "[A-Za-z0-9_-]{43,}" \| sort -u` | samo SRS SHA-256 (2 oblika) i base64url alfabet iz testa — nijedan ključ u istoriji; `git log --all --name-only` bez `.env`, service account-a, `google-services` |
| Regresija testova (`git diff main..HEAD -- backend/test firebase/tests`) | uklonjene linije samo u `konfiguracija.test.js` (5, sve zamijenjene istim pozivom + `POS_API_KLJUCEVI`) i `podrazumijevanaZabrana.test.js` (6: I01-T10 i komentar) — nijedna asercija i01/i02 nije uklonjena ni oslabljena |
| Transakciona granica (`servisi/evidencijaKupovine.js:48–132`) | jedno `db.runTransaction`; prvo `tx.get(purchase)` (O-12), pa `tx.getAll(users, loyaltyAccounts, ledger, notifikacija)`; upisi `tx.create` ×3 + `tx.update` (samo `availablePoints`, `updatedAt`); nijedan upis van `tx`; callback bez sporednih efekata; `maxAttempts: 5`; `saRokom` sa preostalim rokom; rok provjeren prije `runTransaction` |
| POS posrednik (`posrednici/posAutentikacija.js:16–33`) | ključ samo iz `req.get('x-pos-api-key')`; SHA-256 kandidata; `timingSafeEqual` nad 32 bajta u petlji kroz SVE stanice bez `break`; odluka poslije petlje; sirov ključ se ne upisuje u `req`/`res.locals` |
| Konfiguracija (`konfiguracija/posKljucevi.js`) | čuva samo `{ stationId, otisakKljuca }` (zamrznuto); poruke imenuju varijablu i redni broj stavke |
| Log (`obradaGresaka.js:24–34`, `dnevnik.js`) | samo eksplicitna polja; `putanja: req.path` (bez query-ja) — vidi R-04 |
| `firebase/firestore.rules` vs §31 `.docx` (`python -I pravila31.py …`, `pravila31b.py`) | blokovi `/purchases/{purchaseId}`, `/loyaltyLedger/{eventId}`, `/notifications/{notificationId}`, `/users/{uid}`, `/loyaltyAccounts/{uid}` i helper funkcije — tekst bez whitespace-a **jednak** §31; cijeli fajl jednak §31 bez blokova `rewardDefinitions`, `vouchers`, `rewardRequests`, `redemptionRequests` → `True`; redoslijed `users, loyaltyAccounts, purchases, loyaltyLedger, notifications` kao u §31 (D-2) |

### 2.3 Napadi nad pokrenutim Backend-om i emulatorima

Emulatori: `cd backend; npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth` (JBR prvi u PATH-u),
ugašeni prije mutacija (portovi provjereni: 0). Probe: `node napad1.mjs` (220 OK / 1 „XX”), `node napad2.mjs` (0 problema), `node napad3.mjs`
(1 stvaran nalaz, R-04), `node napad4.mjs` (69 provjera, 0 problema). „Bez baze” znači: tačan status i kod, `omotacBaze.brojPristupa === 0`
i snimak cijele baze jednak prije/poslije.

**(a) POS autentikacija** — 401 `UNAUTHENTICATED_POS` bez pristupa bazi za: bez zaglavlja; ključ samo u `?X-POS-API-Key=`, `?key=`, `X-Api-Key`,
`X-POS-Key`, `X_POS_API_KEY`, `Authorization: <ključ>`, `Bearer <ključ>`, tijelu, `Cookie`; prazan; samo razmaci; pogrešan; prefiks 42 znaka;
`ključ + " x"`; velika slova; `K1, K2` u jednom zaglavlju; dva zaglavlja `K1,K1`, `K1,x`, `x,K1`; SHA-256 otisak ključa; standardni base64 istog
ključa. Sirovim HTTP-om (spawn): `X-POS-API-Key` ×2 (isti ključ), `X-POS-API-Key: K2` + `x-pos-api-key: K1`, ispravan + prazan → 401;
`X-POS-API-Key:\t<K2> \t` → 201 (P-12). Podmetanje stanice: `stationId: "SIM02"` u tijelu → 422 `INVALID_REQUEST`; `?stationId=SIM02` +
`X-Station-Id: SIM02` + `stationId: SIM02` zaglavlje sa ključem SIM01 → 201, `stationId: "SIM01"`, `purchases/SIM02__ST1` ne postoji; ključ
SIM02 → `SIM02__ST2`. Broj poziva `crypto.timingSafeEqual` (presretnut u probi) = 2 (broj stanica) za ključ prve, druge, pogrešan, prazan i
nedostajući ključ — nema ranog izlaska.

**(b) Strogo tijelo / mass assignment** — 422 `INVALID_REQUEST` bez baze za dodatna polja `stationId`, `earnedPoints`, `recordedAt`, `uid`,
`purchaseId`, `availablePoints`, `constructor` (objekat), `prototype`, `meta` (ugniježđen), `LoyaltyUid`, `" volumeMl"`, `hasOwnProperty`,
`toString`; sirovi `"__proto__":{…}` i `"__proto__":null`; `volumeMl: {"__proto__":…}` → `INVALID_VOLUME`; `Object.prototype` nezagađen.
Tijela `[]`, `null`, `"x"`, `1`, prazno, `text/plain`, form, `application/json; charset=utf-16`, `merge-patch+json` → 422 `INVALID_REQUEST`.
Dupli ključ u JSON-u (`volumeMl` 1 pa 42730) → JSON.parse uzima zadnji (201, 42730) — očekivano ponašanje parsera.

**(c) Validacija** — `1e3`, `1000.0`, `1.0e3`, `200000.0`, `2e5` → 201 sa cijelim brojem; `-0`, `1e-3`, `200000.5`, `2.000001e5`, `1e400`,
`9007199254740993`, `[1000]`, `{}`, `"1000"`, `true` → `INVALID_VOLUME` bez baze; `amountMinor: -0` → 201, sačuvano `+0` (`integerValue`);
`1000001`, `-1`, `0.5`, `"7050"` → `INVALID_AMOUNT`; `"EUR "`, `"Eur"`, `"EURO"`, `"€"`, `["EUR"]`, `{EUR:1}`, `"EUR\u200b"` → `UNSUPPORTED_CURRENCY`.
`occurredAt` odbijeno (`INVALID_OCCURRED_AT`, bez baze): 30. feb, 29. feb 2025 i 1900, sekunda 60 (i 31. dec), bez zone, `+25:00`, `+05:60`,
4 decimale, `,5`, malo `t`/`z`, bez sekundi, osnovni oblik, godina 0000, `0001-01-01T00:00:00+01:00`, godina 10000, `-0001`, RFC 1123, broj kao
string, `""`, `" "`, završni NUL, arapske cifre, broj, `null`, `true`, `{}`, niz. Prihvaćeno i sačuvano kao `Timestamp` sa tačnim trenutkom
(i u odgovoru `toISOString()`): `2024-02-29T23:59:59.999Z`, `2000-02-29`, `0001-01-01T00:00:00Z`, `0050-06-15` (godina 50, ne 1950),
`0099-12-31T23:59:59-01:00`, `+14:00`, `.5+01:30`. (Jedini „XX” u `napad1.log`: `2026-10-16T10:00:00-23:59` = 2026-10-17T09:59Z je >5 min u
budućnosti, pa je 422 ispravno — greška probe.) Granica +5 min nad čistom funkcijom (`provjeriTijeloKupovine(tijelo, sadaMs)`): +5:00.000 →
prihvaćeno, +5:00.001 → `INVALID_OCCURRED_AT`; HTTP +4:30 → 201, +5:01 (i isti trenutak sa `+02:00`) → 422. `posTransactionId` `a/b`, `..%2F`,
`a\b`, razmak, `İ`, prelom, NUL, 65 znakova, `""`, broj, `null`, niz → `INVALID_TRANSACTION_ID`; `.`, `..`, `...`, `__`, `__x__`, `-`, `_` → 201
na tačnoj putanji. `loyaltyUid` `a/b`, `/korisnikA`, `korisnikA/`, `../users/korisnikA`, `.`, `..`, `__x__`, `____`, `__.*__`, 129 × `u`,
65 × 😀 (130 jedinica), `\uD800`, `a\uDC00`, `""` → 404 `LOYALTY_ACCOUNT_NOT_FOUND` **bez pristupa bazi**; `5`, `null`, `true`, niz, objekat →
422 `INVALID_REQUEST`; ispravan format bez naloga (`__x`, `x__`, `_`, `...`, 64 × 😀, `a\0b`, `" "`) → 404 iz transakcije, ništa upisano.
Redoslijed P-6 (8 kombinacija sa više neispravnih polja) → uvijek kod prvog polja po redoslijedu; neispravan JSON bez ključa → 422;
neispravan ključ + nepoznato polje → 401.

**(d) Transakciona granica** — sva četiri dokumenta jedne kupovine imaju isti `updateTime` (jedan commit). Failure injection (`omotacBaze`):
greška na upisu 1, 2, 3, 4 i prije commit-a → 500 bez stack-a/internih detalja, baza nepromijenjena; `runTransaction` odbijen sa kodom 14/10/4 →
503, sa 6/9 → 500, baza nepromijenjena. Nekonzistentna stanja: postoji samo notifikacija ili samo ledger event → 500; `availablePoints`
string / nedostaje / `2^53`, `reservedPoints: null` → 500; ništa upisano. `accountStatus` nedostaje ili `"active"` → 404. „Crash odmah
poslije commit-a” (§9.3): sva četiri upisa su u istom commit-u (isti `updateTime`), pa ne postoji stanje purchase bez notifikacije.

**(e) Idempotentnost** — poslije prvog 201: retry isti / drugi `occurredAt` / `occurredAt` sa offsetom → 200 i tijelo **bajt-po-bajt** jednako
prvom (sačuvan prvi `occurredAt`); drugi uid (postojeći i nepostojeći), `volumeMl` +1, `volumeMl` 42000 (isti bodovi), `amountMinor` +1 i 0 → 409;
`currency: "eur"` → 422, `occurredAt` +6 min → 422, `loyaltyUid: "a/b"` → 404, nepoznato polje → 422 (P-6). Snimak baze nepromijenjen i
`updateTime` sva četiri dokumenta nepromijenjen poslije 13 retry-ja (nema upisa). Retry poslije što je korisnik pročitao notifikaciju → `readAt`
ostaje. Nalog `DELETION_IN_PROGRESS` i `"NEPOZNAT"`: retry → 200 prvo tijelo, drugi `volumeMl` → 409, nova kupovina → 404; obrisani `users` i
`loyaltyAccounts` → retry 200 (O-12). Isti `posTransactionId` na SIM01 i SIM02 sa različitim payload-om → dvije kupovine; `__b`, `a__b`, `_b` →
tri različita ID-a (`SIM01____b`, `SIM01__a__b`, `SIM01___b`).

**(f) Konkurentnost** (`napad2.mjs`):

| Scenarij | Rezultat |
|---|---|
| 10 identičnih (pola sa drugim `occurredAt`), 3 serije | `{200:9,201:1}` ×2, `{200:8,201:1,503:1}`; 1 različito tijelo; 1/1/1 dokument; balance 52; najduže 3,6 / 3,6 / 10,0 s |
| 30 identičnih, 3 serije | `{200:28,201:1,503:1}`, `{200:29,201:1}` ×2; isto; najduže 10,1 / 3,6 / 7,8 s |
| 10 različitih istog korisnika, retry 503 istim zahtjevom, 2 serije | svi 200/201, 503 = 4 i 0; zbir 60; niz `availableAfter` neprekinut; `reservedAfter` = 3; 10 notifikacija |
| 20 različitih, 2 serije | svi 200/201, 503 = 36 i 123; zbir 215; niz ispravan; 47,6 s i 98,2 s (napomena u sekciji 3) |
| miješano 5 identičnih + 5 različitih + 5 konfliktnih (drugi uid), 3 serije | nijedan 500; tačno 1 EARN za `M0`; nijedan 200/201 za uid koji nije pobijedio; balans svakog korisnika = zbir njegovih EARN-ova |
| retry dok je original zadržan 3 s prije commit-a | retry 201 za 56 ms, original 200 (aborted pa ponovljen); 1 EARN, balance 52; naknadni retry 200 isto tijelo |
| kasni commit poslije 503 (zadržano 10,5 s) | 503 za 10 009 ms; retry → 200; 1 EARN, 1 notifikacija |
| kupovine dok se status mijenja u `DELETION_IN_PROGRESS`, 3 serije | nijedan purchase sa `createTime` poslije `writeTime` promjene; nijedan 500 |

Nijedan scenarij nije proizveo drugi business effect (dupli EARN, duplu notifikaciju, izgubljene bodove ili 500).

**(g) Model podataka** — 900, 1999, 21 000, 22 999, 111 000, 112 000, 101 000, 42 730, 200 000, 5 000 ml: tačni skupovi polja purchase (§8.3),
ledger (§11), notifikacije (§9.2), `loyaltyAccounts` (§7.1); odgovor tačno 8 ključeva tim redoslijedom, bez uid-a; `availableAfter`/`reservedAfter`
= stanje poslije mutacije; `recordedAt` = `createdAt` (ledger, notifikacija) = `updatedAt` naloga, serverski (±5 s); `createdAt` naloga
nepromijenjen; `readAt` null; tekstovi „0 bodova”, „1 bod”, „21 bod”, „22 boda”, „111 bodova”, „112 bodova”, „101 bod”, „42 boda”, „200 bodova”,
„5 bodova”. Firestore REST tipovi: `volumeMl`, `amountMinor`, `earnedPoints`, `deltaAvailable`, `deltaReserved`, `availableAfter`, `reservedAfter`,
`availablePoints` → `integerValue`; `occurredAt`, `recordedAt`, `createdAt`, `updatedAt` → `timestampValue`; `voucherId`, `readAt` → `nullValue`.

**(h) Security Rules** (`napad4.mjs`, projekat `demo-rules-reviewer`): ALLOW: Android upit purchases `where uid==A orderBy occurredAt desc limit 20`,
`limit 1`; notifications `where uid==A orderBy createdAt desc limit 50`; `merge` samo `readAt = serverTimestamp()`. DENY: purchases `limit 21`,
`uid in [A,B]`, `uid != B`, `uid >= A`, collectionGroup, tuđi dokument, pseudonimizovan (`uid: null`), nepostojeći, podkolekcija,
neautentifikovan; set/merge/update (i istom vrijednošću)/delete/create za A, B i anonimnog A; batch purchase + notifikacija. Notifications:
`limit 51`, upit samo po `readAt`, tuđa, bez `uid`, podkolekcija, `readAt` klijentsko vrijeme / string, `readAt` + `relatedPurchaseId` /
`createdAt` / novo polje / brisanje `title`, `set` zamjena, drugi update `readAt`, `readAt` → null, B update A, update bez `uid`, nepostojeća,
create, delete, transakcija `readAt` + `title`, neautentifikovan list. loyaltyLedger za A, B, neautentifikovanog: get, list, collectionGroup,
create, update, delete. `PROBLEMA: 0`. RULE-T01 … RULE-T07, RULE-T12, I02-T15 zeleni u obje regresije.

**(i) Tajne** (`napad3.mjs`, spawn `src/pokreni.js`, dva ključa) — 18 sirovih HTTP zahtjeva sa ishodima 201, 200, 409, 404 (×2), 422 (ključ kao
vrijednost `volumeMl` i kao naziv polja), 500, 401 (×7), 404 (nepostojeća ruta ×2): nijedan odgovor ne sadrži ključ, `availablePoints`,
`reservedPoints`, `availableAfter`, `stack`; log (4 100 B, stdout + stderr, uključuje 500 sa stack-om) ne pominje `x-pos-api-key`. **Ključ se
pojavljuje u logu samo kad ga klijent stavi u URL putanju nepostojeće rute** (`/api/v1/pos/purchases/<ključ>`, `/api/v1/pos/<ključ>`) — R-04.
503 ishodi (j) bez ključa u logu. README i `.env.example`: samo placeholder `ZAMIJENI-GENERISANIM-KLJUCEM` i komanda za generisanje.

**(j) Rok** — spawn sa Firestore „crna rupa” / zatvoren port / spor proksi 12 s → 503 za 10 025 / 10 051 / 10 026 ms (drugo izvršavanje 10 033 /
10 035); ključ nije u logu; kod sporog proksija nijedan purchase ni poslije 30 s. I03-T16 (rok istekao prije transakcije → `runTransaction` se ne
poziva) za init i kupovinu reprodukovan u regresiji; M15 (ispod) ga obara.

**Konfiguracija** — start `src/pokreni.js` sa placeholder-om iz `.env.example`, praznom vrijednošću, duplim ključem, `S_1`, nekanonskim ključem,
standardnim base64 sa `=`, razmakom, `=` umjesto `:`, heks ključem (64 znaka) → exit 1, port ne sluša, poruka imenuje `POS_API_KLJUCEVI` i
stavku, bez vrijednosti i stack-a. `stationId "."` → start dozvoljen (u skladu sa O-13 regex-om).

### 2.4 Mutacioni dokazi (n)

`python -I mutacije.py <id>`: tačna zamjena teksta (mora se javiti tačno jednom; CRLF uvažen) → ciljani test → `git restore -- backend/src
firebase/firestore.rules` → `git status --porcelain` (prazno poslije svake). Emulator testovi: `cd backend; npx firebase emulators:exec --config
../firebase.json --project demo-fuelpoints --only firestore,auth "node --test --test-concurrency=1 <fajlovi>"`; unit: `node --test <fajl>`;
Rules: `cd firebase\tests; npm test`.

| ID | Mutacija | Ciljani test | Exit | Ishod |
|---|---|---|---|---|
| M01 | `break` poslije pogotka u petlji stanica | `jedinicni/posAutentikacija.test.js` | 1 | UBIJENA: `✖ I03-T01 (a)` |
| M02 | `stationId: req.query.stationId ?? res.locals.stationId` | `emulator/posAutentikacija.test.js`, `emulator/kupovina.test.js` | 0 | **PREŽIVJELA** (18/18) — R-01 |
| M02b | `stationId: req.get('x-station-id') ?? res.locals.stationId` | isto | 0 | **PREŽIVJELA** (18/18) — R-01 |
| M27 | ključ i iz `req.query['X-POS-API-Key']` | `emulator/posAutentikacija.test.js` | 1 | UBIJENA: `✖ I03-T01 (b) ključ … van zaglavlja` |
| M03 | `tx.create` purchase → `tx.set` | `emulator/kupovinaAtomicnost.test.js` | 1 | UBIJENA: `✖ I03-T10 (a), (b)`, `✖ I03-T10 (c2)` |
| M04 | `tx.create` ledger → `tx.set` (provjera postojanja zadržana) | `kupovinaAtomicnost`, `kupovina` | 1 | UBIJENA: `✖ I03-T10 (a), (b)` (zabilježen metod upisa) |
| M04b | `tx.create` notifikacija → `tx.set` | isto | 1 | UBIJENA: `✖ I03-T10 (a), (b)` |
| M05 | `occurredAt` dodat u poređenje idempotentnosti | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ I03-T18` |
| M06 | `occurredAtMs >` → `>=` (+5 min isključivo) | `jedinicni/*.test.js` | 0 | **PREŽIVJELA** (45/45) — R-02 |
| M06e | isto | `emulator/kupovina.test.js` | 0 | **PREŽIVJELA** (15/15) — R-02 |
| M07 | provjera ACTIVE naloga prije čitanja purchase-a (krši O-12) | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ I03-T19` |
| M08 | uklonjen `isWellFormed()` | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ I03-T09 neispravan format …` |
| M09 | `Math.floor` → `Math.round` | `jedinicni/bodovanje.test.js` | 1 | UBIJENA: `✖ I03-T03 (a)` |
| M10 | bez normalizacije `-0` | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ I03-T05` |
| M11 | notifikacija `refObavjestenje.create(…)` van transakcije | `emulator/kupovinaAtomicnost.test.js` | 1 | UBIJENA: `✖ I03-T10 (a), (b)`, `✖ I03-T11`, `✖ I03-T12` |
| M12 | retry vraća `occurredAt` iz zahtjeva umjesto sačuvanog | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ I03-T18` |
| M13 | ledger `availableAfter: dostupno` (stanje prije) | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ API-T02`, `✖ I03-T03 (b)` |
| M14 | uklonjen `saRokom` oko transakcije kupovine | `emulator/kupovinaAtomicnost.test.js` | 1 | UBIJENA: `✖ I03-T13` |
| M15 | uklonjena provjera preostalog roka (`if (false)`) | `emulator/rokPrijeTransakcije.test.js` | 1 | UBIJENA: `✖ I03-T16 (a), (b)`, `✖ I03-T16 (c)` |
| M16 | Rules notifications `limit <= 51` | `firebase\tests npm test` | 1 | UBIJENA: `✖ I03-T20 notifications: list limit 50 …` |
| M17 | Rules notifications bez `resource.data.readAt == null` | isto | 1 | UBIJENA: `✖ I03-T20 notifications update …` |
| M18 | Rules purchases `allow list: if ownResource();` (bez limita) | isto | 1 | UBIJENA: `✖ I03-T20 purchases …` |
| M19 | ključ iz zaglavlja dodat u `putanja` loga | `emulator/logBezPosKljuca.test.js` | 1 | UBIJENA: `✖ I03-T17 (a)`, `✖ I03-T17 (b)` |
| M19b | log `req.originalUrl` (sa query-jem) umjesto `req.path` | isto | 1 | UBIJENA: `✖ I03-T17 (a)`, `✖ I03-T17 (b)` |
| M20 | bez provjere ispravnosti balansa (P-15) | `emulator/kupovinaAtomicnost.test.js` | 1 | UBIJENA: `✖ I03-T10 (f)` |
| M21 | bez odbrane O-13 (stationId/posTransactionId dokumenta) | isto | 1 | UBIJENA: `✖ I03-T10 (d)` |
| M22 | `stationId` regex sa `_` | `jedinicni/konfiguracija.test.js`, `pokretanjeBackenda.test.js` | 1 | UBIJENA: `✖ I03-T15 (a) neispravna …` |
| M23 | nekonzistentno stanje provjerava samo ledger (ne notifikaciju) | `emulator/kupovinaAtomicnost.test.js` | 1 | UBIJENA: `✖ I03-T10 (e)` |
| M24 | `tx.update` naloga → `tx.set` (prepisuje cijeli nalog) | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ API-T02` |
| M25 | `^__.*__$` → `^__.+__$` (propušta `"____"`) | `emulator/kupovina.test.js` | 0 | **PREŽIVJELA** (15/15) — R-03 |
| M26 | oblik riječi: `jedinice === 1` bez izuzetka za 11 | `jedinicni/bodovanje.test.js` | 1 | UBIJENA: `✖ I03-T21 oblik riječi …` |
| M28 | samo `DELETION_IN_PROGRESS` odbijen (nepoznat status prolazi) | `emulator/kupovina.test.js` | 1 | UBIJENA: `✖ I03-T09 loyaltyUid bez ACTIVE naloga` |

Ukupno 31 mutacija (+1 ponovljena nad drugim fajlom): 26 UBIJENIH, 5 PREŽIVJELIH (M02, M02b, M06, M06e, M25) — sve preživjele su praznine u
testovima, ne u kodu (stvarno ponašanje je ispravno, dokazano probama (a) i (c)).

## 3. Nalazi

| ID | Severity | SRS / brief / odluka | Fajl | Kratak opis |
|---|---|---|---|---|
| R-01 | P2 | §3.4, §8.5, CLAUDE.md („stationId iz mape POS ključ → stanica”), brief I03-T01, pokušaj (a) | `backend/test/emulator/posAutentikacija.test.js:132–150` | Nema testa za podmetanje `stationId` kroz query ili drugo zaglavlje; mutacije M02 i M02b preživljavaju |
| R-02 | P3 | §8.4 („не више од 5 минута”), i03/P-4 („granica uključiva”) | `backend/src/validacija/tijeloKupovine.js:65`; nedostaje test | Uključiva granica +5:00 nije testirana; `>` → `>=` (M06/M06e) preživljava |
| R-03 | P3 | i03/P-5, OD-8 | `backend/test/emulator/kupovina.test.js:578–595` | I03-T09 ne sadrži `"____"` ni `"__\n__"`; mutacija M25 preživljava |
| R-04 | P3 | §3.4 („не смије се логовати”), NFR-07 | `backend/src/greske/obradaGresaka.js:32` (`putanja: req.path`) | POS ključ koji klijent stavi u URL putanju nepostojeće rute završava u logu |
| R-05 | P3 | CLAUDE.md (checkpoint dokumenti istiniti) | `docs/IMPLEMENTATION_LOG.md` (i03, „Fajlovi”) | `i03_brief.md` naveden kao „netaknut”, `i03_plan.md` kao „izmijenjen”, a oba su novi fajlovi na grani (ponavljanje i02 R-08) |

Nema P0 ni P1 nalaza. Nijedno zaobilaženje POS autentikacije, nijedno podmetanje stanice ili uid-a, nijedan dupli EARN/notifikacija, nijedno
djelimično stanje, nijedan ključ u odgovoru ni u logu za sve ishode iz brief-a, nijedno odstupanje Rules od §31.

Napomena (nije nalaz): pod kontencijom istog korisnika transakcije se serijalizuju (zaključavanje u emulatoru): 20 paralelnih različitih
kupovina istog korisnika daje 36–123 odgovora 503 (uz retry do uspjeha) i traje 48–98 s; 10–30 identičnih paralelnih povremeno daje jedan 503
(1 od 3 serije) i latenciju do ~10 s. Brief (I03-T11, I03-T12, i02/P-5) to eksplicitno dozvoljava, stanje je uvijek konzistentno i POS retry je
bezbjedan; za realan POS (jedna kupovina po korisniku u trenutku) bez uticaja. Ponašanje nad produkcionim Firestore-om (optimistička
konkurentnost) nije provjerljivo u emulatoru.

### R-01 — nema testa za `stationId` iz query-ja ili drugog zaglavlja (P2)

- **Zahtjev:** §3.4 „Backend configuration садржи мапирање API key → stationId … stationId се никада не прихвата као ауторитативно поље из POS
  request body-ја”; §8.5; CLAUDE.md „stationId se uzima iz mape POS API ključ → stanica, nikad iz tijela zahtjeva”; brief I03-T01 „ključ stanice B
  daje purchase sa stationId B (izvođenje stanice iz ključa)”; zadatak (a) „pokušaj podmetanja stationId (tijelo, query, zaglavlje)”.
- **Fajl:** `backend/test/emulator/posAutentikacija.test.js:132–150` (pozitivni slučajevi bez ikakvog podmetnutog `stationId`-a);
  `kupovina.test.js:329–345` pokriva samo tijelo (422). Kod je ispravan: `backend/src/rute/kupovine.js:13` koristi samo `res.locals.stationId`.
- **Scenarij:** `python -I mutacije.py M02` (`rute/kupovine.js:13` → `{ stationId: req.query.stationId ?? res.locals.stationId, ...ulaz }`) →
  `posAutentikacija.test.js` + `kupovina.test.js`: `exit 0 … PREŽIVJELA {'tests': '18', 'pass': '18', 'fail': '0'}`; M02b (`req.get('x-station-id')`)
  isto. Sa M02 bi POS sa ključem SIM01 i `?stationId=SIM02` upisao kupovinu u ime stanice SIM02 (krši §3.4). Stvarno ponašanje (proba (a)):
  `?stationId=SIM02` + `X-Station-Id: SIM02` + zaglavlje `stationId: SIM02` sa ključem SIM01 → 201, `stationId: "SIM01"`, `purchases/SIM02__ST1` ne postoji.
- **Zašto P2, a ne P1:** ponašanje je ispravno (dokazano probom); nedostaje regresioni dokaz za eksplicitno tražen napad (isti razred kao i02 R-05).
- **Najmanja ispravka:** samo test.
- **Test:** proširiti I03-T01 (b): ključ SIM01 sa `?stationId=SIM02` i zaglavljima `X-Station-Id: SIM02` / `stationId: SIM02` → 201,
  `body.stationId === 'SIM01'`, `purchaseId === 'SIM01__…'`, `purchases/SIM02__…` ne postoji. Mora oboriti M02 i M02b.

### R-02 — uključiva granica +5 min nije testirana (P3)

- **Zahtjev:** §8.4 „не више од 5 минута у будућности”; i03/P-4 „najviše +5 min u odnosu na vrijeme Backend-a (granica uključiva)”.
- **Fajl:** `backend/src/validacija/tijeloKupovine.js:65` (`occurredAtMs > sadaMs + NAJVISE_U_BUDUCNOSTI_MS` — ispravno); testovi pokrivaju samo
  +4:30 i +5:01 (`kupovina.test.js:507`, `:524`, `:643`).
- **Scenarij:** `python -I mutacije.py M06` (`>` → `>=`) → `node --test test/jedinicni/*.test.js`: `exit 0 … {'tests': '45', 'pass': '45'}`;
  M06e → `kupovina.test.js`: `exit 0 … 15/15`. Stvarno ponašanje (proba (c), čista funkcija sa fiksnim `sadaMs`): +300 000 ms → prihvaćeno,
  +300 001 ms → `INVALID_OCCURRED_AT`.
- **Zašto P3:** razlika od 1 ms na granici, ponašanje ispravno, ali odluka P-4 nema dokaz.
- **Najmanja ispravka:** samo test (funkcija već prima `sadaMs`, pa je test deterministički).
- **Test:** unit test `provjeriTijeloKupovine(tijelo, sadaMs)` sa `occurredAt = new Date(sadaMs + 300_000).toISOString()` → bez greške;
  `+300_001` → `GreskaApi` `INVALID_OCCURRED_AT`. Mora oboriti M06.

### R-03 — I03-T09 bez `"____"` i `"__\n__"` (P3)

- **Zahtjev:** i03/P-5 „ne ^__.*__$”; IMPLEMENTATION_LOG OD-8 tvrdi da zastavica `s` štiti `"__\n__"`.
- **Fajl:** `backend/test/emulator/kupovina.test.js:578–595` (od rezervisanih oblika samo `__x__`).
- **Scenarij:** `python -I mutacije.py M25` (`/^__.*__$/s` → `/^__.+__$/s`) → `kupovina.test.js`: `exit 0 … 15/15`. Sa mutacijom `"____"`
  (rezervisan Firestore ID) prolazi validaciju i stiže do Firestore-a. Stvarno ponašanje: `"____"` → 404 bez pristupa bazi (proba (c)).
  Isto važi za uklanjanje zastavice `s` (`"__\n__"` nije u testu) — nije zasebno izvršeno kao mutacija.
- **Najmanja ispravka:** samo test.
- **Test:** I03-T09 (format) dopuniti sa `"____"` i `"__\n__"` → 404 bez pristupa bazi. Mora oboriti M25 i mutaciju bez `s`.

### R-04 — POS ključ u URL putanji nepostojeće rute završava u logu (P3)

- **Zahtjev:** §3.4 „POS API key … не смије се логовати”; NFR-07; brief I03-T17 (svi kanali, svi ishodi; „ni kad je poslat u query-ju ili tijelu”).
- **Fajl:** `backend/src/greske/obradaGresaka.js:32` — `putanja: req.path` (i01, nepromijenjeno u i03).
- **Scenarij:** `node napad3.mjs` (spawn `src/pokreni.js`): `POST /api/v1/pos/purchases/<K1>` sa ispravnim zaglavljem i `POST /api/v1/pos/<K2>` bez
  zaglavlja → 404 `NOT_FOUND` (odgovor bez ključa), ali stderr:
  `{"…","code":"NOT_FOUND","status":404,"metod":"POST","putanja":"/api/v1/pos/purchases/pIgcR5B7RV5aEakqpjYuaQ5PUT38ySxA4sMGaSqJ13k"}`
  (ključ iz izvršavanja, generisan za probu). Svi ostali kanali i ishodi su čisti.
- **Zašto P3:** zahtijeva da POS sam pogrešno pošalje ključ u putanji (pogrešna integracija klijenta), ruta ne postoji i ključ ne daje pristup;
  isti razred postoji za Bearer token od i01. Brief eksplicitno navodi query i tijelo, ne putanju. Odluka pripada Orchestrator-u.
- **Najmanja ispravka (Orchestrator bira):** (1) dokumentovati kao poznato ograničenje; ili (2) za `NOT_FOUND` logovati samo prefiks rute / skraćenu
  putanju (npr. segmente duže od N znakova zamijeniti sa `…`).
- **Test (ako se ispravlja):** I03-T17 ishod 404 sa ključem u putanji → log ne sadrži ključ.

### R-05 — lista fajlova u IMPLEMENTATION_LOG (P3)

- **Fajl:** `docs/IMPLEMENTATION_LOG.md`, i03 „Fajlovi”: `docs/iteracije/i03_plan.md` je pod „Izmijenjeni (samo sekcija 15)”, a
  `docs/iteracije/i03_brief.md` pod „Netaknuti”; `git diff --name-status main..HEAD` prikazuje oba kao `A` (dodali su ih Orchestrator `da1d894`
  i Planner `bae4402`). Ostali fajlovi iz `git diff --name-only main..HEAD` su tačno navedeni. Isti nalaz kao i02 R-08.
- **Ispravka:** jedna rečenica: „i03_brief.md i i03_plan.md su dodati na grani u koracima Orchestrator-a/Planner-a; Builder je mijenjao samo sekciju 15 plana.”

## 4. Pokrivenost obaveznih testova

| ID | Fajl | Adekvatno | Obrazloženje |
|---|---|---|---|
| API-T02 | `emulator/kupovina.test.js:192` | da | tačni skupovi polja svih dokumenata, tipovi, serverski timestamp-ovi, `availableAfter`/`reservedAfter`, `readAt` null; M13, M24 ubijene |
| API-T03 | `kupovina.test.js:267` | da | dva retry-ja, tijelo bajt-po-bajt, snimak baze jednak |
| API-T04 | `kupovina.test.js:288` | da | sva četiri polja zasebno (currency nad pripremljenim dokumentom — jedini način jer je whitelist samo EUR); volume/currency/timestamp 422 |
| RULE-T08 | `firebase/tests/kupovineObavjestenjaLedger.test.js:155` | da | owner query/get ALLOW, write DENY za 3 konteksta; M18 ubijena (preko I03-T20) |
| RULE-T10 | isti, `:180` | da | ALLOW `readAt = request.time`; title/body i uz `readAt` DENY (OD-4) |
| RULE-T11 | isti, `:202` | da | get/list/upit/create/update/delete × vlasnik/drugi/neautentifikovan |
| I03-T01 | `jedinicni/posAutentikacija.test.js`, `emulator/posAutentikacija.test.js:101,132` | **djelimično** | ključ van zaglavlja, Bearer, ID token, dupla zaglavlja, broj poređenja (M01, M27 ubijene); podmetanje `stationId` u query/zaglavlju nije pokriveno (R-01, P2) |
| I03-T02 | `kupovina.test.js:329` | da | server-controlled i nepoznata polja, `__proto__`, `constructor`, ne-objekti, `text/plain`, redoslijed |
| I03-T03 | `jedinicni/bodovanje.test.js:6`, `kupovina.test.js:383` | da | svih 6 vrijednosti, O-4 (900 ml, četiri zapisa); M09 ubijena |
| I03-T04 | `kupovina.test.js:424` | da | granice, `1000.0`, `1e3`, tipovi |
| I03-T05 | `kupovina.test.js:457` | da | granice, `-0` (M10 ubijena) |
| I03-T06 | `kupovina.test.js:484` | da | svi oblici iz brief-a i `" EUR"` |
| I03-T07 | `jedinicni/vrijemeKupovine.test.js`, `kupovina.test.js:502` | da, uz R-02 | svi oblici iz brief-a, sekunda 60, offseti, godine 0001/0099; uključiva granica +5:00 nije dokazana (R-02, P3) |
| I03-T08 | `kupovina.test.js:538` | da | 1/64/65, `/`, razmak, ne-ASCII, prelom, broj, `null` |
| I03-T09 | `kupovina.test.js:563,578` | da, uz R-03 | svih 5 stanja naloga, format bez pristupa bazi, 128 znakova prolazi; M08, M28 ubijene; `"____"` nedostaje (R-03, P3) |
| I03-T10 | `emulator/kupovinaAtomicnost.test.js:132–250` | da | svaki od 4 upisa i prije commit-a, zastarjelo čitanje (c, c2), O-13 (d), nekonzistentno stanje (e), P-15 (f); M03, M04, M04b, M11, M20, M21, M23 ubijene. Omotač samo delegira (kontrolni slučaj bez opcija → 201) |
| I03-T11 | `kupovinaAtomicnost.test.js:252` | da | 3 ponavljanja, čeka kraj svih transakcija (izolacija); dozvoljava 503 uz tačno tijelo i konzistentno stanje; ne može biti trivijalno zelen jer naknadni retry mora vratiti 200 sa 42 boda i 1 EARN |
| I03-T12 | `kupovinaAtomicnost.test.js:291` | da | retry 503 istim zahtjevom (≤ 20), zbir, niz `availableAfter`, `reservedAfter`, 10 notifikacija; M11 ubijena |
| I03-T13 | `kupovinaAtomicnost.test.js:338` | da | 503 < 12 s, kasni commit, retry prvo tijelo, 1 EARN; M14 ubijena |
| I03-T14 | `kupovina.test.js:597` | da | dvije stanice, `a__b` sa retry-jem |
| I03-T15 | `jedinicni/konfiguracija.test.js:165,218`, `pokretanjeBackenda.test.js:67` | da | 24 neispravna oblika + placeholder iz `.env.example`, spawn; M22 ubijena |
| I03-T16 | `emulator/rokPrijeTransakcije.test.js` | da | init i kupovina, 5 oblika isteklog roka, `brojTransakcija === 0`; M15 ubijena |
| I03-T17 | `emulator/logBezPosKljuca.test.js` | da, uz R-04 | svi ishodi 201/200/401/404/409/422/500/503, in-process i spawn; M19, M19b ubijene; ključ u putanji nije pokriven (R-04, P3) |
| I03-T18 | `kupovina.test.js:625` | da | O-3 i dopuna P-6 (validacija prije idempotentnosti, 0 pristupa); M05, M12 ubijene |
| I03-T19 | `kupovina.test.js:657` | da | O-12 sva tri slučaja; M07 ubijena |
| I03-T20 | `kupovineObavjestenjaLedger.test.js:222–285` | da | sve granice iz brief-a; M16, M17, M18 ubijene |
| I03-T21 | `jedinicni/bodovanje.test.js:25,59` | da | 0…200, tekst; M26 ubijena |
| I03-T22 | `emulator/posAutentikacija.test.js:152`, smoke u `provjera.ps1` | da | GET, nepoznata `/pos` putanja, neispravan JSON bez ključa, bez `posStanice` → 500 |
| Regresija i01/i02 | sve suite | da | 45/67/25 ×(1 + 3 + 2), `provjera.ps1` ×2 exit 0; nijedna asercija uklonjena/oslabljena; I01-T10 uklonjen po brief-u |

Svi obavezni ID-evi imaju adekvatno pokriće bitnog ponašanja; I03-T01 je djelimičan za jedan napad (R-01, P2), što po kriterijumu iz zadatka
nije P0/P1.

## 5. Checkpoint dokumenti (Faza B)

| Tvrdnja iz TEST_REPORT-a | Moje izvršavanje |
|---|---|
| `backend: npm test` 45/45 | reprodukovano (provjera 1 i 2, samostalno) |
| `npm run test:emu` 67/67 ×3 | reprodukovano ×3 (+2 kroz `provjera.ps1`) |
| `firebase\tests: npm test` 25/25 | reprodukovano (samostalno i ×2 kroz `provjera.ps1`) |
| `provjera.ps1` exit 0 ×2, tri smoke-a | reprodukovano (278 s, 288 s) |
| SRS hash, prazan `git diff -- docs/srs` | reprodukovano |
| I03-T11 povremeni 503, I03-T12 0–12 × 503, I03-T13 503 za ~10,0 s | reprodukovano (503 u 2 od 9 ponavljanja I03-T11; I03-T12 0/0/1; 10 008–10 018 ms) |
| Rules `JEDNAKO_DOCX` | reprodukovano vlastitom skriptom (`True`) |
| Kontrolne mutacije M02 (`break`), M04 (query ključ), M07, M09, M16, M17, M18, M19, M22, M23, M24, M25, M26c, M27, M28, M29 | reprodukovane kao moje M01, M27, M09, M10, M11, M03, M23, M21, M05, M07, M15, M19, M22, M13, M18, M17 — sve UBIJENE |
| „Kontrolne mutacije 35/35” | tabela ima 34 reda (M01 … M31 uz M26a/b/c i MR02b); „35” očigledno broji i ponovljeno izvršavanje M17 nad (c2) — kozmetika, nije zaseban nalaz |
| Nereprodukovan PASS | nema |

- **IMPLEMENTATION_LOG:** CHANGELOG istinito opisuje diff (provjereno inspekcijom i napadima a–j); tvrdnja da su katalog grešaka, `obradaGresaka.js`,
  `dnevnik.js`, `greskeServisa.js`, `inicijalizacijaNaloga.js` i paketi netaknuti — tačna (`git diff --stat`). Netačna klasifikacija
  `i03_brief.md`/`i03_plan.md` (R-05). Odstupanja OD-1 … OD-8 imaju razlog i dokaz: OD-4 (M31) i OD-6 (M18) se poklapaju sa mojim M23/M17;
  OD-5 (izolacija kasnog commit-a) je opravdan — moje izvršavanje I03-T11 sa 503 i dalje prolazi sa stanjem provjerenim POSLIJE kasnog commit-a;
  OD-8 (zastavica `s`) postoji u kodu, ali nema test (R-03). Ograničenje „i07: retry sa `uid: null` → 409” je u skladu sa O-10a (nije nalaz u i03).
- **TRACEABILITY:** `git diff main..HEAD -- docs/TRACEABILITY.md` mijenja kolone „Kod”, „Planirani test” i „Status” u redovima čija kolona iteracija
  uključuje 3 ili je „svaka” (§1.5, §2.2/§3.2, §3.4, §7.1/§7.2, §7.3, §8.1/§8.2, §8.3–§8.5, §9, §10, §11, §21, §24, §25/§31, §26 API-02, §27, NFR-02,
  NFR-04, NFR-05, NFR-07, AC-02, AC-03, AC-09, AC-10) i red NFR-03 (iteracije „1, 8”) dopunom za Rules iz i03 — isto kao u i02, sadržajno tačno
  (D-2 uvodi Rules u i03). Red §8.3 – §8.5 sadrži tačno traženi tekst „I03-T02 server-controlled polja u tijelu → 422 INVALID_REQUEST”.
  Kolone zahtjeva i iteracije nepromijenjene.

## 6. Status

Nema P0 ni P1 nalaza; svi obavezni testovi imaju adekvatno pokriće ponašanja (praznine R-01 … R-03 su P2/P3 i tiču se samo dokaza, ne ponašanja).
Preporuka za FIX LOOP ili backlog (odluka Orchestrator-a): R-01 (P2, samo test), R-02 i R-03 (P3, samo test), R-04 (P3, odluka), R-05 (P3, dokument).

ITERATION ACCEPTED
