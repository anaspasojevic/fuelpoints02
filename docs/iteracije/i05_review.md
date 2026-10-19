# i05 — ADVERSARIAL REVIEW (LOOP 3)

Iteracija 5: Voucher cancel (API-05) i account reconcile (API-06). Grana `iteracija-05`, PR #5, pregledan commit `cddfd7b`.
Reviewer nije autor koda. Normativ: SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`, SHA-256 `7d866413…60228`, nepromijenjen),
brief `docs/iteracije/i05_brief.md`, registar `docs/ODLUKE.md`.
Probe-skripte su van repoa (`C:\Users\Elitebook\i05_probe\`: `zajednicko.mjs`, `napadi1.test.mjs`, `napadi2.test.mjs`, `mutiraj.mjs`,
`mutacijeA.mjs`, `mutacijeB.mjs`) i nisu commit-ovane. Svaka kontrolna mutacija je vraćena `git restore`; `git status` je poslije svake
provjeren (runner baca grešku ako nije čist).

## 1. Sažetak i presuda

Nijedan napad na double-refund, dupli release, vlasništvo, idempotentnost, O-5 i O-19 nije uspio; 28/28 sopstvenih i 55/55 mutacija iz
plana su oborene; nalazi su 1 MINOR i 6 NOTE, bez BLOCKER-a i MAJOR-a — **ITERATION ACCEPTED**.

## 2. Okruženje i stvarni rezultati

Windows 11 Pro 10.0.22621, PowerShell 5.1, Node `v24.21.0`, JBR iz Android Studio-a. Sleep isključen prije rada
(`powercfg /change standby-timeout-ac 0`, `-dc 0`); trajanja ispod pokazuju da nije bilo sleep-a.

| Komanda | Rezultat (kopirano iz izlaza) | Exit | Trajanje |
|---|---|---|---|
| `git fetch; git switch iteracija-05; git pull --ff-only` | `Already up to date.`; HEAD `cddfd7b`; `git status` čist | 0 | — |
| `.\skripte\provjera.ps1` (početak, Faza A) | `SVE PROVJERE PROŠLE`; backend `ℹ tests 74`/`ℹ pass 74`/`ℹ fail 0`; `test:emu` `ℹ tests 141`/`ℹ pass 141`/`ℹ fail 0` (`duration_ms 892220.958`); rules `ℹ tests 30`/`ℹ pass 30`/`ℹ fail 0`; Android korak prošao | 0 | 1062 s |
| `.\skripte\provjera.ps1` (kraj, Faza B) | `SVE PROVJERE PROŠLE`; backend `ℹ tests 74`/`ℹ pass 74`/`ℹ fail 0`; `test:emu` `ℹ tests 141`/`ℹ pass 141`/`ℹ fail 0` (`duration_ms 927174.7408`); 6 smoke-ova (`404 NOT_FOUND`, `401 UNAUTHENTICATED` ×4 uklj. `/vouchers/:voucherId/cancel` i `/account/vouchers/reconcile`, `401 UNAUTHENTICATED_POS`; log sa šablonom rute, bez `voucherId`-a); rules `ℹ tests 30`/`ℹ pass 30`/`ℹ fail 0`; Android 2× `BUILD SUCCESSFUL` | 0 | 1034 s |
| `sha256sum docs/srs/FuelPoints_SRS_3_1.docx` | `7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228` | — | — |
| `git diff main...iteracija-05 --stat -- firebase docs/srs package.json backend/package.json backend/package-lock.json` | prazno | — | — |
| `git diff --numstat main...iteracija-05 -- backend/test` | 8 fajlova, samo dodavanja (`dekodiranjePutanje.test.js` `9 0`, ostalo novi fajlovi), 0 obrisanih linija | — | — |

`test:emu` (puna suite) je izvršen po vremenskom okviru 1× u Fazi A i 1× u Fazi B — oba puta kao korak `provjera.ps1` (`npm ci`,
`npm test`, `npm run test:emu`). Ciljana ponavljanja nestabilnih kandidata (emulator `emulators:start`, `node --test --test-name-pattern`):

| Test | Ponavljanja | Rezultat | Raspodjela (`t.diagnostic`) |
|---|---|---|---|
| I05-T18 (a), (b) | 5 | 5/5 `ℹ pass 2` `ℹ fail 0` | (a): `{"0×503, zbir 3":10}` ×4, `{"0×503, zbir 3":9,"1×503, zbir 3":1}` ×1 |
| I05-T11 (a)–(c) | 5 | 5/5 `ℹ pass 3` `ℹ fail 0` (199–257 s) | (a): 20×sve 200 ×3; 18+2×(9×200, 1×503); 19+1×(9×200, 1×503); (b): 0×500, 503 po vrsti 0–12 |
| I02-T09 | 5 | 5/5 `ℹ pass 1` `ℹ fail 0` (13–16 s) | — |

Nijedno ponavljanje nije dalo neočekivan ishod, pa cijeli skup nije pokretan 3× (vremenski okvir).

## 3. Faza A — napadi N1–N20

Napadi su izvršeni nad emulatorom (`demo-fuelpoints`, jednom pokrenut `npx firebase emulators:start --config ../firebase.json --project
demo-fuelpoints --only firestore,auth`) komandom
`node --test --test-concurrency=1 napadi1.test.mjs` / `napadi2.test.mjs` (env `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`,
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `GCLOUD_PROJECT=demo-fuelpoints`). Probe koriste produkcionu `napraviAplikaciju`, Auth
emulator token-e i repo-ov `omotacBaze` (brojanje upisa i pristupa). Invarijante (N7, `provjeriInvarijante`) se provjeravaju poslije svakog
scenarija: §7.2 ≥ 0; za svaki voucher koji je bio ACTIVE — ACTIVE ⇒ nema `release_`, EXPIRED/CANCELLED ⇒ tačno jedan `release_{voucherId}`
sa 9 polja §11, `deltaAvailable = cost = −deltaReserved`, `uid`, `purchaseId null`; `reservedPoints = početno − Σ oslobođeno`,
`availablePoints = početno + Σ oslobođeno`; lanac `availableAfter`/`reservedAfter` uzastopan; `redeemedAt`/`redeemedAtStationId` null,
`cancelledAt` Timestamp samo za CANCELLED.

Prvi run `napadi1` je imao 4 pada koja su bila greške probe, ne koda: (N4, N15) mock `Date.now` je mijenjao i sat roka (`preostaloMs` / ubrzan
sat → 503), (N8) moje očekivanje `NOT_FOUND` za segment `..`/`.` (supertest ne normalizuje putanju; kod daje `VOUCHER_NOT_FOUND`, što je po
O-22 ispravno), (N18) čišćenje emulatora 409 zbog transakcije zaostale iz N15. Proba je ispravljena (mock samo za čitanje sata u callback-u
servisa) i ta četiri napada su ponovljena: svi PROŠLI.

| # | Napad | Komanda / scenarij | Očekivano (SRS / odluka) | Dobijeno | Ishod |
|---|---|---|---|---|---|
| N1 | Double-refund: K=12 paralelnih cancel-a istog ACTIVE voucher-a | `napadi1` N1, 10 + 10 ponavljanja (503 viđen → ≥ 20) | §19.1, §19.2, NFR-04/05, AC-08: tačno jedan RELEASE, nalog `50/0`, sva 200 tijela identična, nikad 500 | 240 odgovora: `200` ×225, `503` ×15, 0×500; svaki put 1 `release_V`, V CANCELLED, invarijante tačne; retry poslije 503 → 200 isto tijelo | PROŠAO |
| N2 | cancel × API-06 paralelno (5+5) nad istim voucher-om | `napadi1` N2, neistekao 20× i istekao 20× | Tačno jedan RELEASE; neistekao → CANCELLED, istekao → EXPIRED; cancel istekao → 409 `VOUCHER_EXPIRED`; Σ `reconciledCount` ≤ 1 | neistekao: cancel 200 ×100, API-06 `200 rc=0` ×87, `503` ×13; istekao: cancel `409 VOUCHER_EXPIRED` ×100, API-06 `rc=0` ×86, `rc=1` ×14; uvijek 1 release, 0×500 | PROŠAO |
| N3 | REDEEMED / EXPIRED / CANCELLED (i sa prošlim expiresAt) postavljeni direktno | `napadi1` N3, omotač broji upise, `snimakBaze()` prije/poslije | §19.3: 409 / 409; §19.2: 200 iz sačuvanog stanja; 0 upisa | 409 `VOUCHER_ALREADY_REDEEMED`, 409 `VOUCHER_EXPIRED` ×2, 200 ×2 sa sačuvanim `cancelledAt` i 7 ključeva tim redoslijedom; `brojUpisa 0`, baza `deepStrictEqual` | PROŠAO |
| N4 | O-5 kroz HTTP + granica | `napadi1` N4; granica: `Date.now` za čitanje sata u callback-u = `expiresAt` / `expiresAt − 1` | O-5: EXPIRED + jedan RELEASE, 409; upisi voucher → release → nalog; `sadaMs ≥ expiresAt` istekao | 409 `VOUCHER_EXPIRED`; upisi tačno `update vouchers`, `create loyaltyLedger`, `update loyaltyAccounts`; `cancelledAt null`; retry 409, 0 upisa; granica: `=` → 409 EXPIRED, `−1 ms` → 200 CANCELLED sa `cancelledAt = expiresAt − 1` | PROŠAO |
| N5 | O-6: tuđi voucher u 5 stanja, nepostojeći, sličan uid | `napadi1` N5 | 403 `FORBIDDEN` bez upisa i bez podataka o voucher-u; 404 `VOUCHER_NOT_FOUND`; napadačev API-06 ne dira tuđi | 403 ×5 (ACTIVE, CANCELLED, EXPIRED, REDEEMED, istekao ACTIVE — bez O-5 release-a), tijelo samo `code/message/correlationId`, `brojUpisa 0`, baza nepromijenjena; API-06 napadača `{reconciledCount:0}`; nepostojeći 404; uid + razmak / druga veličina slova / skraćen → 403 | PROŠAO |
| N6 | O-20: 7 pokvarenih stanja naloga × (neistekao, istekao) + terminalna stanja + API-06 | `napadi1` N6 | ACTIVE putanja: 409 `ACCOUNT_NOT_INITIALIZED` / 409 `ACCOUNT_DELETION_IN_PROGRESS` / 500, ništa (ni O-5 release); CANCELLED 200, REDEEMED/EXPIRED 409 PRIJE naloga; API-06 nalog prvi | sve tačno; za svaki slučaj `brojUpisa 0` i baza `deepStrictEqual` | PROŠAO |
| N7 | Invarijante §7.2, §11, §16, §18.1, §19 | `provjeriInvarijante` poslije N1, N2, N4, N12, N13, N20 (a), (b) | vidi uvod | nijedno kršenje | PROŠAO |
| N8 | `voucherId`: velika slova, 63/65, `%00`, `%2F`, `%2e%2e`, `..`, `.`, `%C3%A9`, `%20`, `%0A`, `__…__`, 5000 znakova, prazan, `%2Fcancel`, puna širina `ｆ`, arapsko-indijske cifre | `napadi1` N8, omotač broji pristupe | 404 bez pristupa bazi (`VOUCHER_NOT_FOUND`; prazan segment `NOT_FOUND`, i05/P-12) | svi 404 `VOUCHER_NOT_FOUND` (prazan → `NOT_FOUND`), `brojPristupa 0` | PROŠAO |
| N9 | Tijelo (22 oblika × 2 rute), sa i bez token-a, sirov HTTP kroz TCP | `napadi2` N9 | O-21 / i05/P-2 / P-11 | bez tijela, `CL: 0` bez CT (Retrofit), `CT json` `CL: 0`, `{}`, ` { } `, chunked `{}` json, CT json bez tijela → 200; `[]`, `null`, `5`, `"x"`, `{"a":1}`, `{"__proto__":{}}`, `{"uid":"x"}`, neispravan JSON, chunked bez CT, `CL: 2` bez CT, `text/plain`, form, `merge-patch+json`, `CL: 00`, 200 KB → 422 `INVALID_REQUEST`; bez token-a: skalar/`null`/neispravan JSON/200 KB → 422, ostalo 401; bez token-a 0 pristupa bazi | PROŠAO |
| N10 | D-5 i K-1 | `napadi2` N10 (16 putanja + GET/PUT/DELETE/PATCH) | `%`, `%E0%A4%A` → 404 `NOT_FOUND`; neispravan JSON bez token-a → 422 (i uz loše kodiran segment); ispravno bez token-a → 401; log bez sirove vrijednosti i stack-a | tačno tako; `/vouchers//cancel` → 404 `NOT_FOUND`; `/VOUCHERS/<hex>/CANCEL` i završna `/` → 401 (i04/P-14); `/vouchers/<hex>`, `/vouchers`, `/account/vouchers`, `/reconcile/x` i drugi metodi → 404; log bez `%E0` i `    at ` | PROŠAO |
| N11 | Autentikacija | `napadi2` N11 | 401 `UNAUTHENTICATED`, 0 pristupa bazi; POS ključ ne prolazi | bez, prazan `Bearer`, loš, istekao (`exp` u prošlosti), tuđi `aud`, `Basic`, `Token`, dva razmaka, samo `X-POS-API-Key`, `?access_token=` → 401 za obje rute, `brojPristupa 0`; opozvan (`revokeRefreshTokens`) → 401; onemogućen korisnik → 401; `bearer` malim slovima → 200 (i02/P-7) | PROŠAO |
| N12 | API-06: 3 istekla (dva sa istim `expiresAt`), neistekao, CANCELLED, REDEEMED, EXPIRED, tuđi istekao; retry; 120 isteklih | `napadi1` N12 | §18.1 samo istekli ACTIVE korisnika, poredak (`expiresAt`, `voucherId`), lanac, retry 0 bez upisa | `{reconciledCount:3}`; upisi `update, create` ×3 pa `update` naloga, redom e3 → `0…` → `f…`; lanac `57/110, 87/80, 137/30`; tuđi i ostali netaknuti; retry `{0}` 0 upisa; 120 isteklih → `200 {"reconciledCount":120}` za 119 ms, invarijante tačne | PROŠAO |
| N13 | Kasni commit poslije 503 (cancel i O-5); otkaz baze code 14/4/10/13 | `napadi1` N13 (`zadrziPrijeCommitaMs 10500`, `odbijTransakcijuSa`) | ODLUKE §6 (b): 503; kasni commit; retry bez drugog RELEASE; 13 → 500 | `503 → retry 200` i `503 → retry 409`, 1 release; code 14/4/10 → 503, 13 → 500 (obje rute), baza nepromijenjena | PROŠAO |
| N14 | Log za sve ishode i za neočekivane greške | `napadi2` N14 (presretnuti svi kanali) | §6 (h), O-18, O-19: bez `voucherId`-a, `uid`-a, token-a, putanje dokumenta, linije poruke iz stack-a; opis ne baca | uspjeh/retry/API-06: ništa u logu; 403/404/409/422/401/503: samo `code/status/metod/putanja` (šablon rute); 13 vrsta 500 (gRPC 5 sa putanjom, gRPC 13 sa `\n    at <V>`, gRPC 6 sa `name` sa V, ne-gRPC sa putanjom, V velikim slovima, string, `Object.create(null)`, `toString`/`stack`/`message` getter koji baca, poruka promijenjena poslije stack-a, ručni stack sa V) → nijedan V u logu ni odgovoru; bacajući opisi → `(opis greške nedostupan)`; stvaran emulatorski `ALREADY_EXISTS` → `Error (code 6 ALREADY_EXISTS)` + okviri. Izuzetak: V razdvojen crticom ostavlja 31 hex znak u ne-gRPC poruci (R-03) | PROŠAO (uz NOTE R-03) |
| N15 | Sat po pokušaju | `napadi1` N15 (`prisiliPonovniPokusaj: 2`, brojanje `Date.now` po fajlu pozivaoca) | obaveza (j), (p): 1 + 1 po pokušaju; zajednički modul ne čita sat | cancel: `servisi/otkazivanjeVaucera.js` 4 čitanja za 3 pokušaja, `oslobadjanjeVaucera.js` 0, `cancelledAt` u odgovoru = sačuvani; API-06: `uskladjivanjeVaucera.js` 4 | PROŠAO |
| N16 | Rules §31 | `git diff main...iteracija-05 --stat -- firebase` (prazno), `firebase\tests` `ℹ pass 30` u oba `provjera.ps1` | nepromijenjeno, RULE-T01 … T12 zeleni | nepromijenjeno; 30/30 | PROŠAO |
| N17 | Regresija | `provjera.ps1` ×2, `git diff --numstat main...iteracija-05 -- backend/test` | i01–i04 test kod netaknut, sve zeleno | samo dodavanja; 74/141/30 | PROŠAO |
| N18 | API-03 retry za istekao voucher (N-01, (n)) | `napadi1` N18 | retry API-03 → 200 `ACTIVE`, 0 upisa; API-06 → 1; zatim API-03 retry `EXPIRED`, cancel 409 | tačno tako; nalog `60/0` | PROŠAO |
| N19 | Opseg | `git diff … -- package*.json` prazno; rute: samo `POST /vouchers/:voucherId/cancel` i `POST /account/vouchers/reconcile`; `git grep` za redeem/notifikacije | ništa van SRS-a (§1.3), nema novih paketa | potvrđeno; `release_` piše samo `oslobadjanjeVaucera.js`; nema notifikacija ni redeem-a | PROŠAO |
| N20 (a) | Konkurentno `DELETION_IN_PROGRESS` dok cancel drži transakciju (5×) | `napadi2` N20 (a), `prijeCommita` pokreće Admin update `users` | 200 sa release-om ili 409 bez release-a, nikad mješavina | 5× `200`, CANCELLED, 1 release, brisanje upisano tek poslije (brava emulatora) | PROŠAO (NOTE R-05) |
| N20 (b) | Vlasnik (10) i napadač (10) paralelno nad istim voucher-om (5×) | `napadi2` N20 (b) | napadač uvijek 403, jedan release, napadačev nalog netaknut | tačno tako | PROŠAO |
| N20 (c) | Unicode normalizacija uid-a (NFC token, NFD voucher) | `napadi2` N20 (c) (custom token Auth emulatora) | 403 (bez normalizacije, uid je opaque) | 403; isti NFC uid → 200 | PROŠAO |
| N20 (d) | 12 nekonzistentnih stanja (reserved < cost, `release_` za ACTIVE, `costPoints` 50.5 / `"50"` / 0, status `"ACTIVE "` / `"cancelled"`, `expiresAt` broj, bez `issuedAt`, bez `rewardId`, CANCELLED bez `cancelledAt`, `uid null`) | `napadi2` N20 (d) | 500 bez upisa | svih 12 → 500 `INTERNAL_ERROR`, `brojUpisa 0`, baza nepromijenjena | PROŠAO |
| N20 (e) | ACTIVE sa `redeemedAt ≠ null`, ACTIVE sa `cancelledAt ≠ null`, CANCELLED bez `release_` | `napadi2` N20 (e) | nekonzistentno stanje → 500 (ODLUKE §5) — SRS ne propisuje eksplicitno | prva dva → 200 CANCELLED (`cancelledAt` prepisan), treći → 200 | NALAZ R-01 (MINOR), R-02 (NOTE) |
| N20 (f) | cancel × 2 issue-a istog korisnika paralelno (5×) | `napadi2` N20 (f) | zbir 50, reserved = Σ ACTIVE, jedan release, 0×500 | `cancel 200, issue 409/409` ×4; `cancel 200, issue 201/503` ×1 (nalog `0/50`) | PROŠAO (NOTE R-04) |

## 4. Kontrolne mutacije

Runner `mutiraj.mjs`: tačna zamjena teksta (mora se javiti tačno jednom), ciljani test fajl(ovi) sa `--test-name-pattern`, nad istim
emulatorom, pa `git restore` i provjera `git status --porcelain -- backend`. Po vremenskom okviru svaka mutacija je pokrenuta jednom
(Builder: 10×). „OBORENA” = exit ≠ 0 sa ≥ 1 testom koji je stvarno izvršen i pao (runner odbija run sa 0 testova).

### 4.1 Faza A (sopstvene, bez uvida u plan) — 28/28 oborene

| # | Mutacija | Oborio | Ishod |
|---|---|---|---|
| A01 | RELEASE `tx.create` → `tx.set` | I05-T09, I05-T10, I05-T17, I05-T20 (b) | OBORENA |
| A02 | bez provjere postojećeg `release_` | I05-T09, I05-T16 (c) | OBORENA |
| A03 | istek `>` umjesto `>=` | I05-T07 granica, I04-T09 (f) | OBORENA |
| A04 | bez provjere vlasnika | I05-T05 (a), (b) | OBORENA |
| A05 | release bez promjene statusa voucher-a | API-T11 | OBORENA |
| A06 | promjena statusa u CANCELLED bez RELEASE-a | API-T11 | OBORENA |
| A07 | provjera naloga PRIJE idempotentnog CANCELLED | I05-T08 (b) | OBORENA |
| A08 | API-06 upit bez `uid` filtera i bez odbrambene provjere | I05-T15 (b) | OBORENA |
| A09 | redoslijed upisa cancel-a: nalog prije voucher/release | I05-T10 | OBORENA |
| A10 | `voucherId` regex bez `^` i `$` | I05-T03 (a), (b) | OBORENA |
| A11 | `cancelledAt` iz drugog `Date.now()` | I05-T13 | OBORENA |
| A12 | gRPC grana: okviri iz cijelog stack-a (R-07 vraćen) | I05-T01 (a), (b) | OBORENA |
| A13 | ACTIVE putanja bez provjere naloga | I05-T08 (a) | OBORENA |
| A14 | pogrešan znak `deltaAvailable` | API-T11 | OBORENA |
| A15 | `availableAfter` prije povećanja | API-T11 | OBORENA |
| A16 | O-5 postavlja CANCELLED | I05-T07 (oba) | OBORENA |
| A17 | O-5 baca u transakciji (release poništen) | I05-T07 (oba) | OBORENA |
| A18 | `Transfer-Encoding` bez tijela prihvaćen | I05-T03 (a), (b) | OBORENA |
| A19 | voucher čitan VAN transakcije (`refVaucer.get()`) | I05-T11 (a) | OBORENA |
| A20 | users/nalog čitani VAN transakcije (`db.getAll`) | I05-T11 (c), I05-T14 | OBORENA |
| A21 | `reconciledCount + 1` | I05-T15 (a)–(e) | OBORENA |
| A22 | REDEEMED provjera uklonjena | I05-T06 | OBORENA |
| A23 | API-06 bez provjere naloga | I05-T16 (a), (b) | OBORENA |
| A24 | `voucherId` (razdvojen crticom) u poruci `new Error` | I05-T02 | OBORENA |
| A25 | `sadaMs` jednom van callback-a | I05-T13 | OBORENA |
| A26 | opis greške bez `try/catch` (R-10) | I05-T01 (d) | OBORENA |
| A27 | niz prihvaćen kao tijelo | I05-T03 (a), (b) | OBORENA |
| A28 | provjera `reservedPoints − cost < 0` uklonjena | I05-T09, I05-T16 (c) | OBORENA |

Napomena A24: mutacija sa `voucherId` razdvojenim crticom bi PROŠLA log test I05-T20 (redakcija `[hex]` traži ≥ 32 uzastopna hex znaka),
ali je obara statička provjera I05-T02. Zaštita od te klase zavisi od I05-T02 (vidi R-03).

### 4.2 Faza B (mutacije iz plana 8.4, definicije po planu i OD-7) — 55/55 oborene

| # | Mutacija | Prvi pali test(ovi) kod mene | Builder (TEST_REPORT) | Ishod |
|---|---|---|---|---|
| N01 | `tx.create` → `tx.set` | I04-T11, I05-T09 | 10/10, I05-T09 | OBORENA |
| N02 | cancel bez provjere statusa (3 grane) | API-T11, I05-T06 | 10/10 | OBORENA |
| N03 | bez provjere `release_` | I05-T09, I05-T16 (c) | 10/10 | OBORENA |
| N04 | `>` umjesto `>=` | I05-T07 granica, I04-T09 (f) | 10/10 | OBORENA |
| N05 | vlasnik uklonjen | I05-T05 (a), (b) | 10/10 | OBORENA |
| N06 | vlasnik poslije upisa | I05-T05 (a), (b) | 10/10 | OBORENA |
| N07 | CANCELLED u oslobađanje + `tx.set` + bez provjere | API-T11 | 10/10 | OBORENA |
| N08 | bez `cancelledAt` | API-T11 | 10/10 | OBORENA |
| N09 | `cancelledAt = serverTimestamp()` | API-T11 | 10/10 | OBORENA |
| N10a / N10b | znak `deltaAvailable` / `deltaReserved` | API-T11, I05-T07 | 10/10 | OBORENE |
| N11a / N11b | users/nalog van tx (cancel / API-06), samo I05-T14 (K-1) | I05-T14 | 10/10 | OBORENE |
| N12 | O-5 baca u callback-u | I05-T07 | 10/10 | OBORENA |
| N13 | O-5 → CANCELLED | I05-T07 | 10/10 | OBORENA |
| N14 | `DELETION_IN_PROGRESS` uklonjen | I05-T08 (a), I05-T16 | 10/10 | OBORENA |
| N15 | nalog prije CANCELLED | I05-T08 (b) | 10/10 | OBORENA |
| N16a / N16b | REDEEMED / EXPIRED provjera uklonjena | I05-T06 | 10/10 | OBORENE |
| N17 | upit bez `where(uid)` | I05-T15 (b) | 10/10 | OBORENA |
| N18 | upit bez `where(status)` | I05-T15 (a), (d) | 10/10 | OBORENA |
| N19a / N19b | rani izlaz 1 / `+ 1` | I05-T15 | 10/10 | OBORENE |
| N20a / N20b | `sadaMs` prije `runTransaction` (cancel / API-06) | I05-T13 | 10/10 | OBORENE |
| N21 | API-06 bez provjere naloga | I05-T16 (a), (b) | 10/10 | OBORENA |
| N22a / N22b | `uid` iz `req.query` (cancel / API-06) | I05-T04 | 10/10 | OBORENE |
| N23 / N24 | regex bez sidra / sa `i` | I05-T03 (a), (b) | 10/10 | OBORENE |
| N25a / N25b | `provjeriPraznoTijelo` prazna / grana `undefined` uvijek prolazi | I05-T03 (a), (b) | 10/10 | OBORENE |
| N26 | `voucherId` u `new Error` | I05-T02 | 10/10 | OBORENA |
| N27 | log `putanja = req.originalUrl` | I05-T20 (a), I04-T16 (a) | 10/10 | OBORENA |
| N28 | posrednik na prefiksu `/vouchers` | I05-T03 (b) | 10/10 | OBORENA |
| N29a / N29b | bez provjere roka | I05-T12 (d) | 10/10 | OBORENE |
| N30 | `reserved − cost < 0` uklonjena | I05-T09 | 10/10 | OBORENA |
| N31 | cancel postavlja i `redeemedAt` | API-T11 | 10/10 | OBORENA |
| N32 | odgovor sa `uid` | API-T11 | 10/10 | OBORENA |
| N33 | 403 → 404 | I05-T05 (a), (b) | 10/10 | OBORENA |
| N34 | voucher bez `uid` → 403 | I05-T05 (c) | 10/10 | OBORENA |
| N35 | O-5 vraća 200 | I05-T07 | 10/10 | OBORENA |
| N36 | lanac iz početnog stanja | I05-T15 (b) | 10/10 | OBORENA |
| N37 | bez sortiranja | I05-T15, I04-T09 (d) | 10/10 | OBORENA |
| R-M47 | okviri bez `rediguj` | I05-T01 (b) | 10/10 | OBORENA |
| R-M48 | `err.name` bez `rediguj` | I05-T01 (b) | 10/10 | OBORENA |
| R-M46 | prag hex-a 64 | I05-T01 (c) | 10/10 | OBORENA |
| R-M53 | hex samo mala slova | I05-T01 (c) | 10/10 | OBORENA |
| N40 | okviri iz cijelog stack-a | I05-T01 (a) | 10/10 | OBORENA |
| N41 | bez provjere zaglavlja stack-a | I05-T01 (b) | 10/10 | OBORENA |
| N42 | bez `try/catch` | I05-T01 (d) | 10/10 | OBORENA |
| N43 | okviri uvijek prazni | I04-T20 (a)–(c), I05-T01 | 10/10 | OBORENA |
| N44a | API-03: release poslije update-a naloga | I04-T11 | 10/10 | OBORENA |
| N44b | API-03: obrnut poredak release-a | I04-T09 (d) | 10/10 | OBORENA |

Sve mutacije na koje se odnosi double-refund (N01, N03, N07, A01, A02, A19, A20), vlasništvo (N05, N06, N33, N34, A04), idempotentni
CANCELLED (N02, N15, A07), O-5 (N12, N13, N35, A16, A17), `tx.create` (N01, A01) i O-19 (R-M46/47/48/53, N40–N43, A12, A26) su izvršene i
oborene. Ishodi se poklapaju sa onim što je Builder prijavio (prvi pali test u istoj grupi ID-eva). Neoborenih mutacija nema.

## 5. Faza B — odstupanja OD-n

| OD | Sadržaj | Ocjena |
|---|---|---|
| OD-1 | API-06 dio I05-T03 (b) / I05-T04 u `uskladjivanjeVaucera.test.js` | Opravdano (ruta nastaje u koraku 5); sadržaj provjera isti — N9, N25a/b, N22b potvrđuju. Ne slabi. |
| OD-2 | I05-T20 (b) bez stvarnog gRPC NOT_FOUND iz cancel-a | Opravdano: i ja sam u N20 (a) vidio da Admin upis čeka bravu emulatora. NOT_FOUND grana rukovaoca je ista za sve rute i pokrivena I04-T20 (a) (N43 je obara); u N14 sam sintetičkom gRPC 5 greškom sa putanjom i `voucherId`-om provjerio rutu API-05 i API-06. Ne slabi ugovor. |
| OD-3 | Test-first nije bio crven za I05-T07 granicu, I05-T02 i testove koraka 6 | Prihvatljivo: kod je postojao; snaga testova je dokazana mutacijama (moje A03, A11, A24, A25 i plan N04, N20, N26 oborene). |
| OD-4 | Checkpoint-i koraka uz privremeno sklanjanje fajlova kasnijih koraka | Proceduralno; nema uticaja na završno stanje koje sam ja pokrenuo. |
| OD-5 | Run 1 `test:emu` nevažeći (sleep, 19 293 s, I02-T09 pao) | Ispravno naveden kao nevažeći i NE računa se (TEST_REPORT: „Ukupno 6 važećih … Nevažeće izvršavanje … OD-5”). I02-T09 je kod mene prošao 5/5 ciljano (13–16 s) i u oba `provjera.ps1`. Napomena: test traje ~15 s, a u nevažećem runu ≈ 5,1 h — pad je posljedica sleep-a, ne koda. |
| OD-6 | (a) `..` izbačen iz HTTP liste; (b) `ocistiFirestore()`; (c) izuzetak šablona rute u regexu | (a) Djelimično netačno obrazloženje: supertest/superagent NE normalizuje `..` (moj N8: `/vouchers/../cancel` stiže do rute i daje `404 VOUCHER_NOT_FOUND` bez pristupa bazi); jedinični test `provjeriVoucherId('..')` pokriva logiku, pa nema praznine — vidi R-06 (NOTE). (b), (c) opravdano, ne slabi. |
| OD-7 | Definicije varijanti mutacija | Razumne; N21 varijanta „provjera poslije oslobađanja u istoj tx” je zaista ekvivalentna zbog rollback-a. N19a „broj ACTIVE” nije izvodljiv bez novog upita — prihvatljivo, zamijenjen ranim izlazom. |
| OD-8 | Dodatni slučajevi | Samo pojačanje. |

### Tvrdnje u TEST_REPORT

- Brojevi: `npm test` 74, `test:emu` 141 (završno) i 138 (na commit-u koraka 6, prije `logVaucera.test.js`), rules 30 — moja dva
  `provjera.ps1` daju 74 / 141 / 30. „138/138” se odnosi samo na čista izvršavanja koraka 6, što je u TEST_REPORT jasno navedeno.
- I05-T11 (a): Builder 0–2 × 503 po seriji, kod mene 0–2 × 503 po seriji u 5 serija; (b) 503 po vrsti 0–15 kod Builder-a, 0–12 kod mene;
  nijedan 500 — poklapa se.
- I05-T12: 503 za ≈ 10,0 s — moj N13 isto (prvi zahtjev 503, retry 200 / 409, 1 release).
- I05-T15 (e): 200 isteklih za 90–131 ms — moj N12 120 isteklih za 119 ms.
- I05-T18 (a) „1×503, zbir 3”: reprodukovao sam ga (run 5: `{"0×503, zbir 3":9,"1×503, zbir 3":1}`), test je stabilan 5/5. Ishod je po SRS-u
  dozvoljen: §27 `SERVICE_UNAVAILABLE` za zavisni servis (ABORTED poslije 5 pokušaja, i02/P-5), stanje konzistentno (svaki voucher tačno
  jedan release, nalog `115/0`), a zbir 3 znači da 503 transakcija nije oslobodila ništa (release je zaštićen `tx.create` + provjerom). Test
  pravilno ne traži zbir 3 kad postoji 503, ali traži `zbir + naknadni ≤ 3` i tačno jedan release po voucher-u.
- Inspekcije I05-T21: ponovio sam `git grep` za `release_`/`REWARD_RELEASE` i `Date.now` (isti ishod), `git log` autora i potpisa (svi
  `anaspasojevic <anaspasojevic09@gmail.com>`, nema „Co-Authored”, „Claude”, „Generated”).
- Kozmetika: u tabeli mutacija redovi R-M46 i R-M53 (i N10a/N10b, N16a/N16b …) ponavljaju isti opis „…; zasebno …” umjesto opisa
  varijante — vidi R-07 (NOTE).

### Odluke i05/P-1 … P-14 i K-1 … K-3 u kodu

| Odluka | Provjereno | Ishod |
|---|---|---|
| P-1 | `tijeloOtkazanog` 7 ključeva tim redoslijedom; ista funkcija za prvi i retry; API-06 `{ reconciledCount }` (N3, N12, N14) | DA |
| P-2 | `provjeriPraznoTijelo`: `undefined` + `Transfer-Encoding` ili `Content-Length ≠ '0'` → 422; Retrofit prihvaćen (N9) | DA |
| P-3 | `cancelledAt = Timestamp.fromMillis(sadaMs)`, jedan `sadaMs` po pokušaju (N4 granica, N15) | DA |
| P-4 | Poredak: postoji → `uid` (500) → vlasnik → ispravan → CANCELLED/REDEEMED/EXPIRED → nalog → istek → `release_` → reserved; API-06 nalog prvi; retry bez provjere `release_` (N5, N6, N20 (d), (e)) | DA |
| P-5 | Raspored fajlova; `release_` samo u `oslobadjanjeVaucera.js`; i01–i04 test kod netaknut | DA |
| P-6 | O-19 u koraku 1 (`9b28b06` prije `5747aab`), I05-T01/T02 | DA |
| P-7 | 503 `GreskaApi` zadržava zaglavlje i okvire (N14 503 zapis) | DA |
| P-8 | bez gornje granice (N12: 120) | DA |
| P-9 | rules/indeksi nepromijenjeni | DA |
| P-10 | `omotacBaze.js` nepromijenjen (`git diff` nema tog fajla) | DA |
| P-11 | dva oblika 422 (N9) | DA |
| P-12 | `/vouchers//cancel` → 404 `NOT_FOUND` (N10), upisano u ODLUKE §4 i §7 i README | DA (dokumentovano odstupanje od briefa, odobreno) |
| P-13, P-14 | README | DA |
| K-1 | I05-T14 deterministički; N11a/N11b ga obaraju sa uzorkom samo `I05-T14` | DA |
| K-2 | ODLUKE.md ažuriran (O-5, O-6, O-20 … O-22, i05/P-n, (g), (h), (j), (k), (n), (p) zatvoreni, (o) ostaje) | DA |
| K-3 | nijedan 500 pod kontencijom (moji N1, N2, N20 (b), (f) i 5 serija I05-T11/T18) | DA |

### Dokumentacija

- TRACEABILITY: redovi §16, §18, §19, §26 API-05, API-06, §27, AUTH-03/05, NFR-04 … NFR-06, AC-08, AC-09 imaju komponentu i test; O-1 tabela
  dopunjena (NOT_FOUND, INVALID_REQUEST za tijelo).
- IMPLEMENTATION_LOG (i05): CHANGELOG, commit-i, fajlovi, OD-1 … OD-8, status pitanja, ograničenja (q), (r), (s), poznata ograničenja.
- ODLUKE.md: O-5, O-6, O-19 (izvršeno), O-20 … O-22, i05/P-1 … P-14, K-1, K-3; O-5/O-6 zatvorena u §9.
- README: API-05, API-06, preporučeni tok, P-12, P-13, P-14, redoslijed provjera — poklapa se sa kodom (provjereno napadima N9, N10).

## 6. Nalazi

### R-01 — MINOR — ACTIVE voucher sa nenull `redeemedAt` / `redeemedAtStationId` / `cancelledAt` se otkazuje

- Referenca: §15 (voucher šema), §16 (terminalna stanja), ODLUKE §5 („Nekonzistentno stanje baze se ne popravlja: 500, ništa upisano”),
  brief tačka 5 („Planner predlaže tačan skup provjera, najmanje …” — ovaj slučaj nije u minimumu).
- Reprodukcija (`napadi2` N20 (e)): pripremiti ACTIVE voucher (nalog `0/50`), Admin SDK-om postaviti `redeemedAt: Timestamp.now(),
  redeemedAtStationId: 'ST-1'` (ili `cancelledAt: Timestamp.fromMillis(1)`), pa `POST /api/v1/vouchers/<V>/cancel` sa token-om vlasnika.
- Očekivano: 500 `INTERNAL_ERROR` bez upisa (voucher sa tragom redeem-a/cancel-a a statusom ACTIVE je nekonzistentan).
- Dobijeno: `200 CANCELLED`, release upisan; u drugom slučaju postojeći `cancelledAt` se prepisuje novim.
- Uticaj: nije dostižno kroz API (samo Backend piše voucher-e, Rules zabranjuju upis); ne vodi double-refund-u. Postaje bitnije u i06, kad
  redeem počne postavljati `redeemedAt`.
- Predložena ispravka (ne primjenjujem): u `jeIspravanSacuvaniVaucer` (ili u cancel/API-06 za ACTIVE) zahtijevati
  `redeemedAt === null && redeemedAtStationId === null && cancelledAt === null` za status ACTIVE (i `cancelledAt instanceof Timestamp` samo
  za CANCELLED), sa testom u I05-T09 i I05-T16 (c). Može u backlog / i06.

### R-02 — NOTE — Retry nad CANCELLED / EXPIRED ne provjerava postojanje `release_{voucherId}`

- Referenca: i05/P-4 (odobreno: ne provjerava se), brief tačka 5.
- Reprodukcija (N20 (e)): CANCELLED voucher bez `release_` (nalog i dalje `0/50`) → `POST …/cancel` → 200.
- Ponašanje je po odobrenoj odluci; upisujem samo kao svjesnu granicu detekcije nekonzistentnog stanja (veza sa (r) za i07).

### R-03 — NOTE — Redakcija hex-a u logu ne-gRPC poruka ostavlja prefiks < 32 znaka

- Referenca: ODLUKE §6 (h), §7 R-12 (poznato ograničenje).
- Reprodukcija (N14): neočekivana ne-gRPC greška sa porukom `id <31 hex>-<33 hex>` → log `Error: id 1c1c7bf462071a96b2157355f4cf6a2-[hex]`.
- Nedostižno u kodu i05 (sve poruke su statičke, I05-T02 to provjerava i obara A24/N26). Bez nove radnje; ostaje R-12.

### R-04 — NOTE — 503 pod kontencijom istog naloga

- Reprodukcija: N1 (12 paralelnih cancel-a) 15/240 × 503; N2 (cancel × API-06) 13/100 API-06 × 503; N20 (f) 1/10 issue × 503;
  I05-T18 (a) 1×503 u 1 od 50 ponavljanja.
- Po SRS-u dozvoljeno (§27, i02/P-5, ODLUKE §7), stanje uvijek konzistentno, retry bezbjedan (N13). Upisano radi i09/i10 (UX: Android treba
  ponoviti poziv na 503).

### R-05 — NOTE — 409 grana pri konkurentnom početku brisanja nije dostižna testom u emulatoru

- Reprodukcija (N20 (a)): Admin update `users.accountStatus = 'DELETION_IN_PROGRESS'` za vrijeme cancel transakcije čeka bravu; cancel
  commit-uje (200), brisanje se upisuje poslije. Konzistentno; isti razlog kao OD-2. Obaveza (o) ostaje za i07 (API-07 test).

### R-06 — NOTE — Netačno obrazloženje u OD-6 (a)

- IMPLEMENTATION_LOG / TEST_REPORT kažu da klijentski URL parser normalizuje `..`; supertest to ne radi (N8: `/api/v1/vouchers/../cancel` →
  `404 VOUCHER_NOT_FOUND`, `brojPristupa 0`). Pokrivenost nije umanjena (jedinični `provjeriVoucherId('..')`), ali tekst je netačan.
  Predlog: ispraviti rečenicu u dokumentacionom koraku sljedeće iteracije ili dodati `..`/`.` u HTTP listu I05-T03 (b).

### R-07 — NOTE — Opisi varijanti u tabeli mutacija TEST_REPORT-a

- Redovi R-M46 i R-M53, N10a/N10b, N11a/N11b, N16a/N16b, N19a/N19b, N20a/N20b, N22a/N22b, N25a/N25b, N29a/N29b imaju isti tekst (opis iz plana
  sa „zasebno …”) za obje varijante; definicije su samo u OD-7. Kozmetika; predlog: jedan red po varijanti sa tačnim opisom.

Ukupno: BLOCKER 0, MAJOR 0, MINOR 1 (R-01), NOTE 6 (R-02 … R-07).

## 7. Otvorena pitanja za Orchestrator-a

1. **R-01 (ACTIVE voucher sa tragom redeem/cancel)** — SRS ne navodi eksplicitno da je to nekonzistentno; ODLUKE §5 kaže da se nekonzistentno
   stanje ne popravlja. Opcije: (A) u i06 (redeem) uvesti zajedničku provjeru „ACTIVE ⇒ `redeemedAt`, `redeemedAtStationId`, `cancelledAt`
   null” za API-03/05/06 i redeem, sa testom; (B) backlog bez promjene. Preporuka: A, u i06, jer redeem prvi počinje pisati ta polja.
2. Nema drugih nejasnoća SRS-a ili briefa koje bi blokirale; P-12 je odobreno odstupanje od briefa i dosljedno je sprovedeno.

## 8. Šta nije provjereno i zašto

- Produkcioni Firestore (optimistična kontencija, indeks `uid ==, status ==`, brava upita, format gRPC poruka): testovi smiju samo nad
  emulatorom (CLAUDE.md, §2.4). Builder isto nije mogao.
- Stvaran gRPC NOT_FOUND iz cancel transakcije i 409 pri konkurentnom početku brisanja: brava emulatora (OD-2, R-05); pokriveno sintetički (N14)
  i postojećim I04-T20 (a).
- Potpis token-a: emulator token-i nisu potpisani (ODLUKE §7); provjerio sam istek, `aud`, opoziv i onemogućenog korisnika, ne i lažan potpis.
- Razlika satova Backend/Firestore (i05/P-3): obje komponente na istoj mašini.
- Mutacije sam pokrenuo po jednom (vremenski okvir), ne 10×; za konkurentne mutacije (A19, A20, N11a/b) jedan run je bio dovoljan da padnu.
- Puna suite `test:emu` je pokrenuta 2× (kroz `provjera.ps1`), a ne 3×; ciljana ponavljanja (I05-T11, I05-T18, I02-T09 po 5×) nisu dala
  neočekivan ishod, pa 3× nije bilo potrebno po vremenskom okviru.
- Android: van opsega i05 (samo build kroz `provjera.ps1`).

## 9. PRESUDA

Nema BLOCKER-a ni MAJOR-a; svi napadi N1–N20 su dali SRS-ispravan ishod (uz MINOR R-01 i NOTE R-02 … R-07 za backlog); 28/28 sopstvenih i
55/55 mutacija iz plana su oborene; `provjera.ps1` vraća 0 na početku i na kraju.

**ITERATION ACCEPTED**
