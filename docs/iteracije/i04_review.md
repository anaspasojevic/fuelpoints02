# i04 — Review (ADVERSARIAL REVIEWER, LOOP 3)

Iteracija 4: Reward issue (API-03), PR #4, grana `iteracija-04`, pregledani commit `dc52cd0`. Datum: 2026-10-17.
Normativno: SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`, §31 iz `.docx`-a), `docs/iteracije/i04_brief.md`, `docs/ODLUKE.md`.
Probe-skripte su van repoa (`C:\Users\Elitebook\i04_probe\`), nisu commit-ovane; njihov sadržaj i ishod su opisani ispod.

## 1. Sažetak i presuda

Produkcioni kod API-03 je u svim izvršenim napadima dao SRS-ispravan ishod (nijedan double-spend, dupli release ni voucher bez pokrića),
ali normativni test konkurentnosti (API-T07) ne razlikuje ispravan kod od koda sa double-spend greškom (mutacija M02 ga preživljava
6 od 7 puta), a jedna mutacija obavezujuće odluke i04/P-2 preživljava sve testove — **ITERATION REJECTED** (R-01, R-02).

## 2. Okruženje i stvarni rezultati

Windows 11 Pro 10.0.22621, PowerShell 5.1, Node `v24.21.0`, JBR Android Studio-a prvi u PATH-u.

```
git fetch origin; git switch iteracija-04; git pull --ff-only origin iteracija-04   → Already up to date.
git log --oneline -12   → dc52cd0 … 43e604a (10 commit-a i04 iznad merge-a i03)
git status              → nothing to commit, working tree clean
.\skripte\provjera.ps1  → "SVE PROVJERE PROŠLE", EXIT=0
```

| Korak `provjera.ps1` | Stvarni rezultat |
|---|---|
| SRS integritet, NFR-07, TODO/FIXME, portovi | prošlo |
| Backend `npm test` | `ℹ tests 63` `ℹ pass 63` `ℹ fail 0` |
| Backend `npm run test:emu` | `ℹ tests 99` `ℹ pass 99` `ℹ fail 0` (`duration_ms 350508`) |
| Smoke (4) | `404 NOT_FOUND`, `401 UNAUTHENTICATED`, `401 UNAUTHENTICATED_POS`, `401 UNAUTHENTICATED` (`/rewards/CAR_WASH/issue`) |
| Rules `npm test` | `ℹ tests 30` `ℹ pass 30` `ℹ fail 0` |
| Android `assembleDebug`, `testDebugUnitTest` | `BUILD SUCCESSFUL` |

API-T07 u ovom izvršavanju: `raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":19,"201 + 503 SERVICE_UNAVAILABLE":1}`.

Probe i mutacije su izvršavane nad jednim emulatorom (`npx firebase emulators:start --config ../firebase.json --project demo-fuelpoints
--only firestore,auth`) sa `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`,
`GCLOUD_PROJECT=demo-fuelpoints`; `node --test --test-concurrency=1 <fajl>`. Poslije svake mutacije `git restore`; na kraju `git status --short` prazan.

Poređenje Rules sa §31 (`uporediRules.ps1`, van repoa: `word/document.xml` iz `.docx`-a, tagovi uklonjeni, `w:br`/`w:p` → novi red,
poređenje svakog bloka uz normalizovan whitespace): `users`, `loyaltyAccounts`, `purchases`, `loyaltyLedger`, `rewardDefinitions`,
`vouchers`, `notifications`, `rewardRequests`, `/{document=**}` i četiri helper funkcije → `JEDNAKO`; `redemptionRequests` → `NEMA U RULES`
(D-2, i06). Redoslijed blokova kao u §31.

## 3. Faza A — napadi (slijepi pregled)

Probe: `zajednicko.mjs`, `napadi.test.mjs`, `log_i_ostalo.test.mjs`, `kontencija.test.mjs`, `rules.test.mjs` (uvoze `src/` i pomoćnike
testova po apsolutnoj putanji; supertest protiv `napraviAplikaciju`, `omotacBaze` broji pristupe i upise).

| # | Napad | Komanda / proba | Očekivano (SRS) | Dobijeno | Ishod |
|---|---|---|---|---|---|
| N1 | 50 bodova, K=10 paralelnih CAR_WASH, različit `requestId`, 20 ponavljanja | `napadi.test.mjs` „N1” | najviše jedan 201, ostali 409 (ili 503), stanje 0/50 ili 50/0, v = RESERVE = mapping ≤ 1 | 200 zahtjeva: `{"201":20,"409:INSUFFICIENT_POINTS":170,"503:SERVICE_UNAVAILABLE":10}`; u svakom ponavljanju tačno jedan 201; invarijante bez prekršaja | PROŠAO |
| N2 | isti `requestId` × 10 paralelno, 5 ponavljanja | „N2” | 1 voucher, 1 RESERVE, 1 mapping, isti voucherId | `{"200":45,"201":5}`; po ponavljanju 1/1/1; isti voucherId; `issuedAt` odgovora = dokument; retry 200 | PROŠAO |
| N3 | O-16 retry poslije: bodovi 0/0, nagrada neaktivna, nagrada obrisana, DELETION_IN_PROGRESS, users obrisan, loyaltyAccounts obrisan, voucher EXPIRED, ACTIVE i istekao | „N3” | 200, isti voucher, 0 upisa | svih 8: `200 isti`, `upisa=0`, baza `deepStrictEqual`; status u tijelu = sačuvani (EXPIRED / ACTIVE) | PROŠAO |
| N4 | isti `requestId` drugi reward; drugi uid | „N4” | 409 IDEMPOTENCY_CONFLICT bez upisa; drugi uid nezavisan | A SHOWER → `409 IDEMPOTENCY_CONFLICT upisa=0`; B → 201 drugi voucher; `car_wash` → 409 (drugi rewardId) | PROŠAO |
| N5 | 5 isteklih (dva sa istim expiresAt, jedan tačno na granici `sadaMs == expiresAt`, `Date.now` fiksiran), jedan 1 ms poslije, EXPIRED/CANCELLED/REDEEMED u prošlosti | „N5” | release ≥ granice, redoslijed expiresAt pa voucherId, lanac uzastopan, ne-ACTIVE netaknuti, release najviše jednom | `release=5`, lanac `a3:30/190 b2:60/160 f1:110/110 04:160/60 c5:190/30`, RESERVE `140/80`; „+1 ms” ostao ACTIVE; ne-ACTIVE netaknuti; drugi issue: ukupno 6 release-a, nalog `[140, 80]` | PROŠAO (prvi pokušaj probe pao zbog moje greške u očekivanom početnom stanju 210 umjesto 220; ispravljeno i ponovljeno) |
| N6 | O-14 grane uz istekao voucher | „N6” | INSUFFICIENT commit-uje release; ostalo ništa | INSUFFICIENT `409`, release, nalog `40/0`, `upisa=3`; REWARD_INACTIVE, REWARD_NOT_FOUND, ACCOUNT_NOT_INITIALIZED (bez users / bez loyaltyAccounts), ACCOUNT_DELETION_IN_PROGRESS, neispravna definicija (500): `upisa=0`, baza nepromijenjena | PROŠAO |
| N7 | invarijante §7.2, §11–§13 poslije scenarija | funkcija `invarijante` u N1, N2, N5, N20 | ≥ 0, zbir delti = nalog, ACTIVE ↔ RESERVE bez RELEASE, EXPIRED ↔ RELEASE, lanac | bez prekršaja (osim namjerno pripremljenih voucher-a bez RESERVE u N5) | PROŠAO |
| N8 | 30 oblika `requestId`/tijela + bez tijela, text/plain, form, JSON null/string/broj, duplikat ključa | „N8” | 422 INVALID_REQUEST, 0 pristupa bazi | svi `422/INVALID_REQUEST/db0`; duplikat ključa sa ispravnim posljednjim → 201 (N-02) | PROŠAO |
| N9 | `%00`, `%2F`, `%2e%2e`, `%2E`, 129 znakova, `__x__`, `%01`, `%7F`, NEL, `%0A`, `%09`, `%5F%5Fx%5F%5F`; ispravni nepostojeći; prazan segment, `..`, lone surrogate | „N9” | 404 REWARD_NOT_FOUND bez pristupa bazi; ispravan format → 404 poslije čitanja, 0 upisa | neispravni: svi `404/REWARD_NOT_FOUND/db0`; 128 znakova, `car_wash`, `Č`, emoji, razmak, ZWSP, `.x`, `__x` → `404/db6/upisa0`; `//issue` → 404 NOT_FOUND; `%ED%A0%80` → 404 NOT_FOUND (D-5); velika slova rute i završna `/` → 201 (i04/P-14) | PROŠAO |
| N10 | D-5: `%`, `%E0%A4%A`, `%ZZ`, `TAJNA%ZZ`, `%C0%AF`, `%ED%A0%80`, `%FF` na API-03; test ruta sa parametrom; GET sa 2 parametra; nepostojeće rute | `log_i_ostalo.test.mjs` „N10” | 404 NOT_FOUND, log bez stack-a i sirove vrijednosti, „(nepoznata ruta)” | svi `404/NOT_FOUND`, `logStack=false`, `logTAJNA=false`, `"putanja":"(nepoznata ruta)"`; `?q=TAJNA%ZZ` → 401 bez vrijednosti u logu | PROŠAO |
| N11 | K-1 redoslijed | „N11/N12” | 422 → 404 → 401 | neispravan JSON bez token-a `422`; neispravan JSON + `%ZZ` `422`; ispravan JSON + `%ZZ` `404 NOT_FOUND`; ispravno bez token-a `401`; sve `db0` | PROŠAO |
| N12 | bez token-a, loš, `Basic`, dva razmaka, bez šeme, POS ključ (zaglavlje i Bearer), istekao, drugi projekat, opozvan (`revokeRefreshTokens`), onemogućen korisnik, `?uid=` + `X-User-Id` | „N11/N12” | 401 UNAUTHENTICATED, 0 pristupa; UID samo iz token-a | svi `401/UNAUTHENTICATED/db0`; `?uid`/`X-User-Id` → voucher korisnika iz token-a, nalog D `100,0` | PROŠAO |
| N13 | `odbijTransakcijuSa` code 14/4/10/13/3; `zadrziPrijeCommitaMs: 11000` | „N13” | 503 za 14/4/10, 500 ostalo; retry poslije kasnog commit-a → isti voucher | `503,503,503,500,500`; prvi `503` za 10 034 ms, poslije commit-a 1 voucher, retry `200 isti`, RESERVE 1, mapping 1, nalog `50,50` | PROŠAO |
| N14 | log za 201, 200, 409×2, 422, 404, 401, 503 i 500 (ALREADY_EXISTS zastarjelim čitanjem mapping-a i `release_`) | „N14” | bez tijela, requestId, requestKey, voucherId, token-a, sirove putanje | 201…503: ništa od navedenog (log1 sve `false`); 500: log sadrži `path=/rewardRequests/<requestKey>` i `path=/loyaltyLedger/release_<voucherId>` u stack-u; odgovori bez stack-a | NALAZ R-04 |
| N15 | 10 000 generisanja; izvor | „N15” | 64 hex, jedinstveni, CSPRNG | `jedinstvenih=10000 uFormatu=10000 Math.random=false randomUUID=false randomBytes(32)=true`; 64 hex se ne može zamijeniti sa Firebase UID-om (28 znakova) | PROŠAO |
| N16 | Rules (32 slučaja) | `rules.test.mjs` | po §25.6, §25.7, §25.9, §31, RULE-T09 | owner get / list (`uid==`, `limit ≤ 20`) ALLOW; tuđi, nepostojeći, limit 21, bez limita, `in`, bez uslova, sve write operacije (i batch), neautentifikovan DENY; rewardRequests (i `uid == auth.uid`, i ID = uid) DENY za sve; rewardDefinitions prijavljen ALLOW, neprijavljen i write DENY; podkolekcije DENY | PROŠAO (vidi N-05) |
| N17 | vrijeme | „N17”, „N17b” | `expiresAt − issuedAt = 900 000`, `sadaMs` po pokušaju | razmak 900 000 u odgovoru i dokumentu; odgovor = dokument i pod kontencijom (8 zahtjeva, 27 pokušaja callback-a); ali vidi R-02 (mutacija MA21 preživljava) | PROŠAO / NALAZ R-02 |
| N18 | regresija | `provjera.ps1` | sve zeleno | sekcija 2 | PROŠAO |
| N19 | opseg | `git diff --stat main...iteracija-04 -- backend/package*.json firebase/tests/package*.json package.json`; `grep` ruta | bez paketa, samo API-03 | diff prazan; rute samo `/account/init`, `/pos/purchases`, `/rewards/:rewardId/issue`; nema redeem/cancel/reconcile/FCM; nema TODO/FIXME; commit-i samo `anaspasojevic`, bez potpisa alata | PROŠAO |
| N20-A1 | kontencija između RAZLIČITIH korisnika (15 × 2 izdavanja; zatim `kontencija.test.mjs`, po jedan zahtjev) | „N20-A1”, `kontencija.test.mjs` | nezavisni korisnici se ne ometaju (nema SRS zahtjeva o latenciji) | 15×2: `{"201":6,"503":24}`; po jedan zahtjev: K=2 → 3,6 s (3 pokušaja); K=5 → 9 pokušaja; K=10 → 2×503; K=15 → 11×503 (63 pokušaja); stanje uvijek konzistentno | NALAZ R-03 |
| N20-A2 | 250 isteklih voucher-a u jednoj transakciji | „N20-A2” | svi release-i | `201`, 192 ms, `release=250`, nalog `7450,50` | PROŠAO |
| N20-A3 | reservedPoints ne odgovara voucher-ima; ACTIVE sa `expiresAt` brojem; `costPoints 0`; ne-hex voucherId | „N20-A3” | 500 za nekonzistentno, ništa upisano | reserved < cost → `500`, baza ista; ACTIVE `expiresAt` broj → 500; `costPoints 0` → 500; reserved 500 bez voucher-a → 201 (N-03); ne-hex ID istekao → release (N-04) | PROŠAO |
| N20-A4 | uid `café` NFC/NFD, `a:b`, `a` (custom token) | „N20-A4” | nezavisni zahtjevi | 4×201, 4 mapping-a, 4 različita requestKey-a | PROŠAO |
| N20-A5 | 200 KB tijelo (sa/bez token-a), lažni gzip, PUT/GET/DELETE/PATCH/HEAD, method-override, JSON dubine 5000 | „N20-A5” | 422 / 404, bez pada | `422`, `422`, `422`, metodi `404 NOT_FOUND`, HEAD 404, override ignorisan (201), dubok JSON `422` | PROŠAO |
| N20-A6 | istekao voucher drugog korisnika | „N20-A6” | ne dira se | B `409 INSUFFICIENT_POINTS`; A voucher `ACTIVE`, A `0,50` | PROŠAO |
| N20-A7 | paralelno CAR_WASH (O-14 grana) + SHOWER + CAR_WASH istog korisnika sa istim isteklim voucher-om, 10 ponavljanja | „N20-A7” | release tačno jednom, zbir 30 | bez prekršaja | PROŠAO |

## 4. Mutacije

### 4.1 Faza A (moje, bez uvida u plan) — runner `mutacije.mjs`, definicije `mutacijeA.mjs`

| # | Mutacija | Test koji je oborio | Ishod |
|---|---|---|---|
| MA01 | `tx.create` → `tx.set` mapping | I04-T11, I04-T11 (z1)–(z4) | OBORENA |
| MA02 | nalog/korisnik/nagrada čitani van transakcije | API-T07, I04-T13 | OBORENA (vidi R-01: neponovljivo za API-T07) |
| MA03 | upit bez `status == ACTIVE` | I04-T09 (b), (c), (e) | OBORENA |
| MA04 | `jeIstekao` `>` | I04-T09 (f) | OBORENA |
| MA05 | requestKey bez uid-a | I04-T06 (a), API-T06, I04-T06 (b) | OBORENA |
| MA06 | stanje naloga provjereno prije vraćanja postojećeg voucher-a | I04-T08 (a)–(e) | OBORENA |
| MA07 | bez provjere formata rewardId u ruti | I04-T03 (b), I04-T08 (f) | OBORENA |
| MA08 | trajanje 900 001 ms | I04-T09 (f), API-T06 | OBORENA |
| MA09 | rollback release-a kod INSUFFICIENT (bacanje u tx) | I04-T09 (e) | OBORENA |
| MA10 | regex bez verzije | I04-T02 (a) | OBORENA |
| MA11 | bez provjere postojećeg `release_` | I04-T10 (b) | OBORENA |
| MA12 | bez provjere reservedPoints ≥ 0 | I04-T10 (b) | OBORENA |
| MA13 | reconcile postavlja i `cancelledAt` | I04-T09 (a) | OBORENA |
| MA14 | 201/200 zamijenjeni | API-T06 | OBORENA |
| MA15 | `randomBytes(16)` | I04-T06 (a) ×2 | OBORENA |
| MA16 | bez DELETION_IN_PROGRESS | I04-T04 | OBORENA |
| MA17 | D-5 uklonjen | I04-T03 (c) ×2 | OBORENA |
| MA18 | bez `\p{Cc}` | I04-T03 (a), (b) | OBORENA |
| MA19 | release-i obrnutim redoslijedom | I04-T09 (d) | OBORENA |
| MA20 | bez IDEMPOTENCY_CONFLICT | I04-T07 | OBORENA |
| **MA21** | `sadaMs = rokDo − 10000` (jednom po zahtjevu, ne po pokušaju; krši i04/P-2) | — (API-T06, I04-T09, API-T07, I04-T12, I04-T13 svi prošli) | **PREŽIVJELA → R-02** |
| MA22 | O-14 grana bez ažuriranja naloga | I04-T09 (e) | OBORENA |
| MA23 | reconcile nad voucher-ima drugih korisnika | I04-T09 (b), (c) | OBORENA |
| MA24 | dodatna polja u tijelu dozvoljena | I04-T02 (a) | OBORENA |
| MA25 | `tx.create` → `tx.set` novi voucher | I04-T11, (z1)–(z4) | OBORENA |
| MA26 | `tx.create` → `tx.set` RELEASE | I04-T11, (z1)–(z4) | OBORENA |
| MA27 | `tx.create` → `tx.set` RESERVE | I04-T11, (z1)–(z4) | OBORENA |

26/27 oborene; MA21 nije ekvivalentna (pod kontencijom ponovljeni pokušaj koristi zastarjeli sat: `issuedAt` raniji od stvarnog izdavanja
do ~10 s, reconcile ne vidi voucher-e istekle u međuvremenu).

### 4.2 Faza B (plan 8.4) — definicije `mutacijeB.mjs`, sve 43 izvršene

| # | Test koji je oborio | Ishod |
|---|---|---|
| M01 | API-T05 | OBORENA |
| **M02** | API-T07 **PROŠAO**; I04-T13 pao | OBORENA samo preko I04-T13 (vidi R-01) |
| M03, M04, M05, M06 (`tx.create` → `tx.set`) | I04-T11 (z1)–(z4) | OBORENE |
| M07 | I04-T10 (b) | OBORENA |
| M08 | I04-T09 (b), (c) | OBORENA |
| M09 | I04-T09 (f) | OBORENA |
| M10 (requestKey) | API-T06, I04-T06 (b), I04-T06 (a) | OBORENA |
| M11 (O-16, mapping poslije preduslova; blok premješten iza provjere nagrade) | I04-T08 (a)–(e) | OBORENA |
| M12 (validacija poslije mapping-a) | I04-T02 (b), I04-T03 (b), I04-T08 (f) | OBORENA |
| M13, M13b | API-T06 | OBORENE |
| M14 | I04-T06 (a) ×2, API-T06 | OBORENA |
| M15, M15b, M16 (O-15) | I04-T02 (a), (b) | OBORENE |
| M17 (active poslije reconcile-a, commit) | I04-T05 nagrada | OBORENA |
| M18 (O-14 rollback) | I04-T09 (e) | OBORENA |
| M19 | I04-T01 UID | OBORENA |
| M20 | I04-T03 (b) | OBORENA |
| M21, M22 | I04-T03 (c) ×2, I04-T16 (a) | OBORENE |
| M23, M24 | I04-T03 (a), (b) | OBORENE |
| M25, M30 | I04-T05 SHOWER | OBORENE |
| M26, M28 | I04-T09 (a) | OBORENE |
| M27 | I04-T09 (d) | OBORENA |
| M29 | I04-T08 (a)–(e) | OBORENA |
| M31 | I04-T15 | OBORENA |
| M32 | I04-T10 (c) | OBORENA |
| M33 | I04-T07 | OBORENA |
| M34 | I04-T05 nagrada | OBORENA |
| M35 | I04-T04 | OBORENA |
| M36 | API-T06, I04-T16 (a) | OBORENA |
| M37 | I04-T16 (a), (b) | OBORENA |
| M38, M39, M41 | I04-T17 | OBORENE |
| M40 | RULE-T09 | OBORENA |

Ponovljivost M02 (`mutacijeC.mjs`, `mutacijeD.mjs`):

| Izvršavanje pod M02 | Rezultat |
|---|---|
| API-T07 sam, 5 puta zaredom | 5 × `pass=1 fail=0` (PREŽIVJELA) |
| API-T07 u fazi B | `pass=1 fail=0` (PREŽIVJELA) |
| API-T07 u fazi A (zajedno sa I04-T10 (a), I04-T13) | pao (jednom) |
| moja proba N1 (K=10, 20 ponavljanja) | `pass=1 fail=0` (PREŽIVJELA) |
| I04-T13 sam, 3 puta + 2 ranija | 4 od 5 pao |

Dakle API-T07 obara M02 u 1 od 7 izvršavanja, I04-T13 u 4 od 5; cijeli suite propušta M02 u približno 1 od 6 izvršavanja.

## 5. Faza B — odstupanja OD-1 … OD-7

| OD | Ocjena |
|---|---|
| OD-1 (I04-T13: 409 → ponavljanje istim `requestId`, 250 ms, do 120 pokušaja) | Opravdano: bez toga test nije sadržao nijedan RESERVE. Ponavljanje istim `requestId` je u skladu sa i04/P-13 (neuspjeh ne pravi mapping). Ne slabi test: traži tačno 3 voucher-a, 3 mapping-a i lanac EARN/RESERVE od 0/0. Stabilnost: 5 samostalnih izvršavanja nad nemutiranim kodom, svih 5 `pass` (10,6 s, 23,4 s, 10,6 s, 10,7 s, 16,3 s; 409 prije uspjeha 30–79; 503: 0–3); plus prolaz u `provjera.ps1`. Napomena: I04-T13 je, zbog R-01, de facto jedini test koji obara M02, a ni on ne pouzdano (4/5). |
| OD-2 | Opravdano po i04/P-1 (tijelo iz sačuvanog dokumenta); (a)–(c) i dalje `deepStrictEqual`. |
| OD-3 | Prihvatljivo; crvenilo dokazano mutacijama, koje sam ponovio (sekcija 4.2) — osim tvrdnje za M02/API-T07 (R-01). |
| OD-4 | Nisam mogao provjeriti da je `provjera.ps1` zaista bio zelen na svakom međukoraku; provjerio sam samo završni commit. |
| OD-5 | Opravdano; nije uočeno ni u mojim izvršavanjima. |
| OD-6 | Samo pojačanje. |
| OD-7 | Opravdano. |

Provjera ostalih tvrdnji:
- Brojevi testova (63 / 99 / 30) — potvrđeno.
- API-T07 „503 se nije pojavio” u 6 izvršavanja Builder-a — u mom izvršavanju jedno ponavljanje `201 + 503` (test to dozvoljava; nije kontradikcija, ali ni garancija K-3 ishoda).
- „M02 → API-T07 1 / 1” u TEST_REPORT-u — **nije ponovljivo** (R-01).
- P-1 … P-16: potvrđeno inspekcijom i napadima (P-1 N2/N3/N17, P-2 N17 uz R-02, P-3 N15, P-4 N20-A4, P-5 N5/N6, P-6 N5, P-7 N6/MA22, P-8 N10/N11, P-9 N9, P-10 `firestore.indexes.json` nepromijenjen, P-11 N14, P-12 N6, P-13 README, P-14 N9, P-16 N20-A2). K-1 (N11), K-2 (ODLUKE B-1), K-3 (asercija u testu) — potvrđeno.
- Docs: TRACEABILITY ima komponentu i test za sve stavke iz brief-a, tačka 5; README API-03 odgovara kodu (redoslijed K-1, O-14, P-13, 503 + retry); ODLUKE.md ažuriran (napomena N-08); F1-01: `git grep -n -P "firebase\tests" -- docs` → prazno (exit 1).

Šta Builder nije provjerio, a ja jesam: kontencija različitih korisnika (R-03), ponovljivost M02 (R-01), `sadaMs` po pokušaju (R-02),
opozvan/onemogućen/istekao token na API-03, 250 isteklih voucher-a, Unicode/`:` u uid-u. Šta ni ja nisam mogao: produkcioni Firestore
(range lock-ovi upita, ID sa NUL znakom), razlika satova, međukoraci (OD-4).

## 6. Nalazi

### R-01 — MAJOR — API-T07 ne otkriva double-spend implementaciju; M02 nije pouzdano oboren
- Referenca: NFR-06 („Verification: concurrent integration test”), AC-06, API-T07, plan 8.4 M02 („Mora oboriti API-T07 (≥ 20 ponavljanja), I04-T13”), brief tačka 6 (DoD: mutacije iz plana obaraju ciljane testove), TEST_REPORT i04 (M02 „1 / 1”).
- Reprodukcija: zamjena u `backend/src/servisi/izdavanjeNagrade.js`
  `await tx.getAll(refKorisnik, refNalog, refNagrada);` → `await Promise.all([refKorisnik.get(), refNalog.get(), refNagrada.get()]);`,
  pa `node --test --test-concurrency=1 --test-name-pattern=API-T07 test/emulator/izdavanjeAtomicnost.test.js` (emulator pokrenut), 5 puta; zatim `--test-name-pattern=I04-T13`, 3 puta; `git restore`.
- Očekivano: svako izvršavanje API-T07 pada (dva 201 za istih 50 bodova).
- Dobijeno: API-T07 prolazi 6 od 7 puta, I04-T13 pada 4 od 5 puta. Uzrok (dijagnostika R-03): `tx.get(upitAktivnih)` u emulatoru zaključava
  šire od upita, pa se dva izdavanja serijalizuju i drugi pokušaj ponovo čita stanje — zaštitu u testu daje slučajna brava upita, ne čitanje
  `loyaltyAccounts` u transakciji. Produkcioni kod je ispravan (nalog se čita u transakciji); problem je dokazna snaga testa za
  najvažnije svojstvo iteracije i netačna tvrdnja u TEST_REPORT-u.
- Predložena ispravka (ne primjenjujem): dodati deterministički test (npr. I04-T18) — izdavanje sa `omotacBaze({ zadrziPrijeCommitaMs })`
  koje drži transakciju poslije čitanja, a za to vrijeme konkurentni upis istog `loyaltyAccounts` (kupovina API-02 ili Admin SDK `update`);
  asercija tačnog konačnog stanja i lanca. Pokazati da M02 obara taj test 10/10; ispraviti red M02 u TEST_REPORT-u stvarnim podacima
  o ponovljivosti; u TEST_REPORT upisati da API-T07 nad emulatorom ne razlikuje M02.

### R-02 — MINOR (blokira po pravilu presude: neoborena, neekvivalentna mutacija) — i04/P-2 „sadaMs po pokušaju” nije zaštićen testom
- Referenca: i04/P-2 (obavezujuće), ODLUKE §6 (j) (obavezuje i05/i06), §17, §18.1.
- Reprodukcija: `const sadaMs = Date.now();` → `const sadaMs = rokDo - 10000;` u `izdavanjeNagrade.js`; pokrenuti API-T06, I04-T09, API-T07,
  I04-T12, I04-T13 — svi prolaze.
- Očekivano: bar jedan test pada.
- Dobijeno: mutacija preživljava (MA21).
- Predložena ispravka: test koji `mock.method(Date, 'now', …)` vraća rastuće vrijednosti (npr. +1000 ms po pozivu) i provjerava da je
  `issuedAt` jednak vrijednosti pročitanoj na početku (posljednjeg) pokušaja callback-a, a ne vremenu ulaska u posrednik; po mogućnosti i
  varijanta sa prisilnim ponovnim pokušajem.

### R-03 — MINOR (otvoreno pitanje, sekcija 7) — kontencija između različitih korisnika zbog `tx.get(query)` nad `vouchers`
- Referenca: brief tačka 5 („Konkurentnost … kroz tx.get(query)”), i04/P-10, ODLUKE §7 („503 i latencija … pod jakom kontencijom istog korisnika”).
- Reprodukcija: `kontencija.test.mjs` — K korisnika, svaki tačno jedan SHOWER zahtjev, paralelno.
- Dobijeno: K=2 → 3,6 s; K=5 → 9 pokušaja za 5 zahtjeva; K=10 → 2×503; K=15 → 11×503. Dijagnostička izmjena (upit zamijenjen praznim
  rezultatom, odmah vraćena) → K=15: 15×201 za 77 ms; čitanje nagrade van transakcije ne mijenja ishod. Stanje uvijek konzistentno.
- Ocjena: SRS ne propisuje latenciju i NFR-06 je ispunjen, ali dokumentovano ograničenje je netačno („istog korisnika”), a demo radi nad
  emulatorom (§2.3, §33.3, O-2). Ponašanje produkcionog Firestore-a nije provjerljivo.
- Predložena ispravka: najmanje — ispraviti poznato ograničenje u IMPLEMENTATION_LOG / ODLUKE §7 izmjerenim brojevima. Promjena tehnike je
  odluka Orchestrator-a (sekcija 7, P-1).

### R-04 — MINOR — 500 iz commit-a upisuje `requestKey` / `voucherId` u serverski log
- Referenca: D-3, ODLUKE §6 (h), (k), NFR-07 (duh), CLAUDE.md (log bez tajni).
- Reprodukcija: `log_i_ostalo.test.mjs` „N14”: `omotacBaze(db, { sakrijPostojece: ['rewardRequests/<key>'] })` → retry → 500; isto za
  `loyaltyLedger/release_<voucherId>`.
- Dobijeno: log linija `"stack":"Error: 6 ALREADY_EXISTS: entity already exists: EntityRef[… path=/rewardRequests/<REQUEST_KEY>]…"` i
  `… path=/loyaltyLedger/release_<VOUCHER_ID>]`; odgovor bez toga.
- Ocjena: u i04 dostižno samo kod nekonzistentnog stanja / zastarjelog čitanja (Builder je to sam prijavio kao otvoreno pitanje); od i05/i06
  `voucherId` je podatak za iskorišćavanje voucher-a.
- Predložena ispravka: u `centralniRukovalacGreskama` za greške sa numeričkim gRPC `code` logovati `name`, `code` i okvire stack-a bez
  poruke (ili redigovati `path=…` / `documents/…`), uz test u I04-T16; ili eksplicitna odluka Orchestrator-a da se odloži do i05.

### Napomene (NOTE, ne blokiraju)
- **N-01** O-16 retry vraća `status: "ACTIVE"` za voucher čiji je `expiresAt` prošao (ništa se ne upisuje, po O-16). Android (i10) mora
  odlučivati po `expiresAt`; i05 (API-06) to zatvara.
- **N-02** Duplikat ključa u JSON-u (`{"requestId":"X","requestId":"<uuid>"}`) → važi posljednji (201). Nije u suprotnosti sa §13.
- **N-03** `reservedPoints` se ne poredi sa zbirom ACTIVE voucher-a (reserved 500 bez voucher-a → issue prolazi). SRS ne traži.
- **N-04** Reconcile prihvata ACTIVE voucher sa ID-em van `^[0-9a-f]{64}$`; mapping grana takav ID odbija (500). Nekonzistentna strogost, bez posljedica (voucher-e piše samo Backend).
- **N-05** Zadatak reviewer-a (N16: „ni svoje”; N5: „balanceBefore/After”) odstupa od SRS-a: §25.7, §31 i RULE-T09 dozvoljavaju owner get/list voucher-a, a §11 ima `availableAfter`/`reservedAfter`. Primijenjen je SRS; kod je ispravan.
- **N-06** 503 pod kontencijom istog korisnika (N1: 10/200; N17b: 3/8) — prihvaćeno ograničenje.
- **N-07** API-T07 dozvoljava `201 + 503`; K-3 traži bar jedan `{201, 409}`, pa test zavisi od slučajne raspodjele (u mom izvršavanju 19/20).
- **N-08** `docs/ODLUKE.md` §6 ima po dvije stavke sa oznakama (f) i (g) („potvrđeno u i04”); preporuka: nove oznake.

## 7. Otvorena pitanja za Orchestrator-a

**P-1 (R-03): tehnika čitanja ACTIVE voucher-a za reconcile.** Brief propisuje `tx.get(query)`; u emulatoru to serijalizuje izdavanja svih
korisnika (i maskira R-01).
- Opcija A: zadržati, ispraviti dokumentovano ograničenje brojevima iz R-03.
- Opcija B: upit van transakcije daje kandidate, pa `tx.getAll(kandidati)` i ponovna provjera `uid`/`status`/`expiresAt` u transakciji.
  Voucher nastao poslije upita ne može biti istekao, a promjena statusa kandidata se vidi u transakciji, pa je „release najviše jednom”
  i dalje garantovan sa `release_{voucherId}` + `tx.create`. Mijenja tehniku iz brief-a.
- Preporuka: B, uz posebnu odluku jer važi i za i05/i06; ako ostaje A, R-01 se mora riješiti testom sa drugim konkurentnim upisom.

**P-2 (R-04):** da li se sanitizacija loga za 5xx Firestore greške radi u FIX LOOP-u i04 ili kao obavezan preduslov i05. Preporuka: FIX LOOP i04 (mala, globalna izmjena; ograničenje (h) je već usvojeno).

## 8. Šta nije provjereno i zašto
- Produkcioni Firestore i Rules engine (range lock-ovi upita, NUL u ID-u, indeks) — testovi isključivo nad emulatorom.
- Razlika satova Backend/Firestore (i04/P-2) — ista mašina.
- Zelen `provjera.ps1` na svakom međukoraku (OD-4) — ponovljen samo na završnom commit-u.
- Android ponašanje — van opsega i04 (build prolazi kroz `provjera.ps1`).
- Potpis token-a (emulator token-i nisu potpisani; poznato ograničenje i02/P-9).

## 9. PRESUDA

**ITERATION REJECTED.** Builder mora ispraviti:
1. **R-01** — deterministički test koji obara M02 (≥ 10/10), ispravan red M02 i napomena o API-T07 u TEST_REPORT-u.
2. **R-02** — test koji obara MA21 (`sadaMs` po pokušaju, i04/P-2).

U FIX LOOP-u ili backlog-u po odluci Orchestrator-a: R-03 (P-1), R-04 (P-2); napomene N-01 … N-08.
