# i04 — Re-review poslije FIX LOOP-a 1 (ADVERSARIAL REVIEWER, LOOP 3)

Iteracija 4: Reward issue (API-03), PR #4, grana `iteracija-04`, pregledani vrh `b1817d6` („i04 fix: dokumentacija FIX LOOP-a 1”).
Datum: 2026-10-17/18. Normativno: SRS 3.1, `docs/iteracije/i04_brief.md`, `docs/ODLUKE.md`, `docs/iteracije/i04_plan.md` (O-17, O-18).
Probe-skripte su van repoa (`C:\Users\Elitebook\i04_probe\fix1\`), nisu commit-ovane: `ponovi.mjs` (runner: primijeni zamjene → N
izvršavanja `node --test --test-concurrency=1 --test-name-pattern=<ID> <fajl>` → `git restore`), definicije `defV1V2.mjs`, `defV3.mjs`,
`defPotvrde.mjs`, `defDopuna.mjs`, probe `v3.mjs`, `v3b.mjs`, `v6.mjs`.

## 1. Sažetak i presuda

R-01, R-02 i R-04 su zatvoreni u obimu iz prvog reviewa. Ipak, mutacija koja isključuje redakciju samo za putanje `vouchers/…` i
`reserve_…` preživljava I04-T16 (c) 10/10. Pored toga, stvarni format emulatorske greške `NOT_FOUND` (`name: "<voucherId>"`) prolazi
kroz redakciju. Presuda: **ITERATION REJECTED** (R-06; R-05 se preporučuje u istom prolazu).

## 2. Stvarni rezultati

```
git fetch origin; git switch iteracija-04; git pull --ff-only origin iteracija-04   → Already up to date.
git log --oneline -8   → b1817d6, 5678e58, b562245, 070a1fc, 1811463, d3e6d6a, dc52cd0, 4e42bc8
git status             → nothing to commit, working tree clean
.\skripte\provjera.ps1 → "SVE PROVJERE PROŠLE", EXIT=0 (474 s)
```

| Korak `provjera.ps1` (vrh `b1817d6`) | Stvarni rezultat |
|---|---|
| Alati, SRS integritet (SHA-256), NFR-07, TODO/FIXME, portovi | prošlo |
| Backend `npm test` | `ℹ tests 63` `ℹ pass 63` `ℹ fail 0` |
| Backend `npm run test:emu` | `ℹ tests 102` `ℹ pass 102` `ℹ fail 0` (`duration_ms 391153.6376`); I04-T18 ✔ 31 746 ms, I04-T19 ✔ 1 420 ms, I04-T16 (c) ✔ 207 ms |
| API-T07 u ovom izvršavanju | `raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":19,"201 + 503 SERVICE_UNAVAILABLE":1}` |
| Smoke (4) | `404 NOT_FOUND`, `401 UNAUTHENTICATED`, `401 UNAUTHENTICATED_POS`, `401 UNAUTHENTICATED` (`/rewards/:rewardId/issue`) |
| Rules `npm test` | `ℹ tests 30` `ℹ pass 30` `ℹ fail 0` |
| Android `assembleDebug`, `testDebugUnitTest` | `BUILD SUCCESSFUL` |

Brojke 63 / 102 / 30 iz Builder-ovog TEST_REPORT-a se poklapaju sa mojim.

Stabilnost na nemutiranom kodu (runner `ponovi.mjs`, emulator `firebase emulators:start --only firestore,auth`, JBR):
- API-T07 (20 ponavljanja u testu) 3 izvršavanja: `exit=0 pass=1 fail=0` ×3.
- I04-T13: 3 izvršavanja, `exit=0 pass=1 fail=0` ×3.
- I04-T18 10/10 (≈ 36 s po izvršavanju), I04-T19 10/10, I04-T16 (c) 10/10, cijeli `logIzdavanja.test.js` 1/1.

Opseg:
- `git diff d3e6d6a..HEAD --stat -- backend/src` → samo `backend/src/greske/obradaGresaka.js | 31` (O-18 ispoštovan).
- `git diff d3e6d6a..HEAD -- backend/package*.json firebase/tests/package*.json package*.json docs/iteracije/i04_review.md docs/srs`
  → prazno (nema novih paketa, raniji review i SRS nisu dirani). Nema novih ruta.
- Commit-i `1811463`…`b1817d6`: autor `anaspasojevic <anaspasojevic09@gmail.com>`, bez potpisa alata.

## 3. Status ranijih nalaza

| Nalaz | Status | Dokaz |
|---|---|---|
| R-01 (MAJOR) API-T07 ne obara M02 | **ZATVOREN** | I04-T18 na nemutiranom kodu 10/10 prolazi; pod M02 10/10 pada sa `ponavljanje 1: balance (izgubljen upis kupovine ili izdavanja)`. Pada i pod obilaznicama (a) (samo `loyaltyAccounts` van transakcije) i (d) (`db.doc(\`loyaltyAccounts/${uid}\`).get()`), obje 10/10. Kupovina (API-02) ne čita `vouchers`, pa test ne zavisi od brave upita: pod M02 se kupovina commit-uje odmah, a na ispravnom kodu čeka bravu `loyaltyAccounts`. Obilaznice (e) i (e2) (provjera bodova na kopiji pročitanoj prije `runTransaction`) I04-T18 ne hvata (0/3), ali ih API-T07 hvata 3/3 (`ponavljanje 1: dva uspješna izdavanja`) i I04-T13 1/1 (cijeli fajl). Za (b) i (c) vidi N-09. Izmjene u `omotacBaze.js` su čisto proširenje: nove opcije su podrazumijevano neaktivne, `brojPokusaja` je samo brojač, a svih 102 emulator testova prolazi. |
| R-02 (MINOR, blokirao) MA21 preživljava | **ZATVOREN** | I04-T19 na nemutiranom kodu 10/10 prolazi; pod MA21 (= M42) 10/10 pada (`čitanja Date.now po pokušaju: [{…"pokusaj":0}]`). Svih šest varijanti iz sekcije 4 pada 10/10. Pod stvarnom kontencijom (V6-1b) `issuedAt` je jednak očitavanju sa početka posljednjeg pokušaja. |
| R-03 (MINOR) kontencija različitih korisnika | **ZATVOREN (dokumentacija, O-17)** | IMPLEMENTATION_LOG (FIX LOOP 1) i ODLUKE §7 sada navode da ograničenje važi i za RAZLIČITE korisnike, sa mojim brojevima (K=2 → 3,6 s; K=5 → 9 pokušaja; K=10 → 2×503; K=15 → 11×503, 63 pokušaja). Upisani su backlog B-2 (i09) i O-17. Tehnika nije mijenjana (`izdavanjeNagrade.js` bez diff-a). |
| R-04 (MINOR) requestKey / voucherId u logu 500 | **ZATVOREN za oblik iz R-04** | Proba `v3.mjs` (a1–a4): ALREADY_EXISTS na `rewardRequests/<requestKey>`, `loyaltyLedger/release_<voucherId>`, `loyaltyLedger/reserve_<voucherId>` i `vouchers/<voucherId>` daje 500 `INTERNAL_ERROR`. Log ne sadrži nijednu tajnu (`procurilo=[]`), sadrži `Error (code 6): 6 ALREADY_EXISTS: entity already exists: EntityRef[partitionRef=dev~demo-probe, [putanja dokumenta]]` i okvire `at …`. Odgovor je po §27. Otvoreno je dvoje: test pokriva samo prva dva oblika (R-06), a drugi stvarni oblik Firestore greške prolazi kroz redakciju (R-05). |

## 4. Tabela mutacija i obilaznica

Sve zamjene u `backend/src/servisi/izdavanjeNagrade.js` (V1, V2) ili `backend/src/greske/obradaGresaka.js` (V3). Svaka je vraćena
sa `git restore`; poslije svake serije `git status: ""`. Razlog pada je potvrđen jednim dodatnim izvršavanjem sa sačuvanim izlazom.

| # | Mutacija / obilaznica | Test | Ishod | Poruka pada |
|---|---|---|---|---|
| — | nemutirano | I04-T18 | 0/10 pao | — |
| M02 | `tx.getAll(refKorisnik, refNalog, refNagrada)` → `Promise.all([… .get()])` | I04-T18 | **10/10 pao** | `balance (izgubljen upis …)` |
| V1-a | samo `loyaltyAccounts` van transakcije | I04-T18 | **10/10 pao** | isto |
| V1-b | samo `rewardDefinitions` van transakcije | I04-T18 / cijeli `izdavanjeAtomicnost` / `izdavanjeNagrade` | 0/3 / 0/1 / 0/1 (18/18) | preživljava — N-09 |
| V1-c | samo `users` van transakcije | I04-T18 / cijeli `izdavanjeAtomicnost` / `izdavanjeNagrade` | 0/3 / 0/1 / 0/1 (18/18) | preživljava — N-09 |
| V1-d | nalog preko `db.doc('loyaltyAccounts/<uid>').get()` | I04-T18 | **10/10 pao** | `balance …` |
| V1-e | kopija naloga prije `runTransaction`, `dostupno` iz kopije | I04-T18 / API-T07 / cijeli fajl | 0/3 / **3/3** / **1/1** (API-T07, I04-T13) | `dva uspješna izdavanja` |
| V1-e2 | samo provjera `dostupno < cijena` na kopiji | I04-T18 / API-T07 / cijeli fajl | 0/3 / **3/3** / **1/1** (API-T07, I04-T13) | `dva uspješna izdavanja` |
| — | nemutirano | I04-T19 | 0/10 pao | — |
| MA21 = M42 | `const sadaMs = rokDo - 10000;` | I04-T19 | **10/10 pao** | `čitanja Date.now po pokušaju: [{…"pokusaj":0}]` |
| V2-1 | `sadaMs` jednom po zahtjevu, `Date.now()` prije `runTransaction` | I04-T19 | **10/10 pao** | `[{pokusaj:0},{pokusaj:0}]` |
| V2-2 | `sadaMs` = vrijeme ulaska (isto čitanje kao `preostaloMs`) | I04-T19 | **10/10 pao** | `[{pokusaj:0}]` |
| V2-3 | `expiresAt` iz `new Date().getTime()` | I04-T19 | **10/10 pao** | `expiresAt u odgovoru` |
| V2-4 | `Date.now()` po pokušaju, ali se zadržava vrijednost prvog | I04-T19 | **10/10 pao** | `issuedAt u odgovoru` |
| V2-5 | reconcile po vremenu ulaska, `issuedAt` po pokušaju | I04-T19 | **10/10 pao** | `Expected values to be strictly equal` (EXPIRED) |
| V2-6 | `issuedAt` iz `performance.timeOrigin + performance.now()` | I04-T19 | **10/10 pao** | `issuedAt u odgovoru` |
| — | nemutirano | I04-T16 (c) | 0/10 pao | — |
| M43 | `redigujPutanje`: `return tekst;` | I04-T16 (c) | **10/10 pao** | `mapping: log sadrži requestKey (mapping)` |
| M43-rel | redakcija isključena samo za putanje sa `release_` | I04-T16 (c) | **10/10 pao** | `release: log sadrži voucherId (postojeći)` |
| **M43-vr** | redakcija isključena samo za putanje sa `vouchers/` ili `reserve_` | I04-T16 (c) | **0/10 — PREŽIVJELA** | — → **R-06** |
| M43-req | redakcija isključena samo za `rewardRequests` | I04-T16 (c) | 3/3 pao | `mapping: log sadrži requestKey` |
| M43-samoDoc | ostavljena samo alternativa `documents/` | I04-T16 (c) | 3/3 pao | `mapping: log sadrži requestKey` |
| M43-samoPath | uklonjena samo alternativa `path=` (sa stanovišta tajni ekvivalentna: `\b<kolekcija>/` i dalje rediguje) | I04-T16 (c) | 3/3 pao | `mapping: log sadrži putanju dokumenta` (test zabranjuje i literal `path=/`) |
| M43-stack | okviri zamijenjeni cijelim `err.stack` bez redakcije | I04-T16 (c) | 3/3 pao | `mapping: log sadrži requestKey` |
| M43-poruka | poruka bez redakcije (okviri redigovani) | I04-T16 (c) | 3/3 pao | `mapping: log sadrži requestKey` |

Prva verzija I04-T16 (c) koju je Builder pominjao (pala 10/10 zbog `ocistiEmulatore()` u pripremi drugog slučaja, koja je brisala i Auth
korisnika): uklanjanje čišćenja je opravdano. Prvi slučaj ne upisuje ništa (transakcija pada na commit-u), a mapping `kljuc1` koji
ostaje u bazi ne utiče na drugi slučaj (drugi `requestId`). Test i dalje provjerava i `kljuc1` i `kljuc2`. M43-rel pokazuje da drugi
slučaj sam obara mutaciju za `release_`. Test nije oslabljen; slab je samo u obuhvatu (R-06).

## 5. Napadi V3 — šta log stvarno sadrži

Drugi emulator (Firestore 8085, Auth 9095, projekat `demo-probe`, kopija `firebase.json` van repoa), stvarni `src/`. Za sintetičke
greške direktno je pozivan `centralniRukovalacGreskama`. Tajna u sintetičkim slučajevima je `c×64`. Svi odgovori su
`{"error":{"code":"INTERNAL_ERROR","message":"Došlo je do neočekivane greške na serveru.","correlationId":…}}`, status 500 (503 za g).

| # | Napad | Dostižno preko API-03 u i04? | Log (polje `stack`) | Procurilo |
|---|---|---|---|---|
| a1 | ALREADY_EXISTS `rewardRequests/<requestKey>` (sakrijPostojece) | samo zastarjelo čitanje / nekonzistentno stanje | `Error (code 6): 6 ALREADY_EXISTS: entity already exists: EntityRef[partitionRef=dev~demo-probe, [putanja dokumenta]]` + 16 okvira `at` | ne |
| a2 | ALREADY_EXISTS `loyaltyLedger/release_<voucherId>` | isto | isto | ne |
| a3 | ALREADY_EXISTS `loyaltyLedger/reserve_<voucherId>` | isto (praktično kolizija) | isto | ne (ali nije u testu → R-06) |
| a4 | ALREADY_EXISTS `vouchers/<voucherId>` | isto (praktično kolizija) | isto | ne (ali nije u testu → R-06) |
| real-1 | **stvarni** emulator `NOT_FOUND` (`tx.update` nepostojećeg dokumenta) | **ne** (vidi ispod) | `Error (code 5): 5 NOT_FOUND: no entity to update: app: "dev~demo-probe"\npath <\n  Element {\n    type: "vouchers"\n    name: "dddd…(64)"\n  }\n>` | **DA → R-05** |
| real-2 | stvarni `NOT_FOUND` van transakcije (`rewardRequests/<hex>`) | ne | isto, `type: "rewardRequests"`, `name: "<hex>"` | **DA → R-05** |
| real-3 | stvarni ALREADY_EXISTS (`tx.create`, `create`) | — | `… EntityRef[…, [putanja dokumenta]]` | ne |
| real-4 | stvarni FAILED_PRECONDITION (code 9) | — | poruka bez ID-a | ne |
| b | poruka sa golim hex-om bez prefiksa | ne (nijedna greška u kodu i Firestore-u viđena u emulatoru nema taj oblik) | `Error (code 6): 6 ALREADY_EXISTS: entity already exists: cccc…` | da (N-10) |
| b | `release_<hex>` bez kolekcije | ne | `… release_cccc… exists` | da (N-10) |
| c | `cause`, `details`, `metadata`, `statusDetails` sa putanjom/hex-om | — | `Error (code 6): 6 ALREADY_EXISTS` + okviri (dodatna polja se ne bilježe) | ne |
| d | bačen string sa golim hex-om / sa `vouchers/` / objekat / `null` | ne (kod ne baca ne-Error) | `greska cccc…` / `greska [putanja dokumenta]` / `[object Object]` / `null` | da samo za goli hex u stringu (N-10) |
| e | kolekcija van `KOLEKCIJE` (`redemptionRequestz/…`), putanja u `name`, hex u okviru steka, višeredna poruka sa redom `    at …`, URL-kodirana putanja, ID sa zarezom | ne | vrijednost ostaje | da (N-10) |
| e | JSON `{"path":"/vouchers/…"}` | — | `{"path":"/[putanja dokumenta]}` | ne |
| f | ostala mjesta koja pišu u log | — | `src/dnevnik.js` (jedini rukovalac), `src/pokreni.js` (samo konfiguracija i start). Express-ov podrazumijevani `finalhandler` (za `res.headersSent` → `next(err)`) bi ispisao cijeli `err.stack`, ali nijedna ruta ne šalje zaglavlja prije greške (N-11). Kasno odbijanje transakcije poslije 503 hvata `Promise.race` u `saRokom` (nema unhandled rejection). | — |
| g | 503 (code 14/4/10) sa porukom koja nosi putanju i hex | da | `GreskaApi: SERVICE_UNAVAILABLE` + okviri (originalna greška se ne bilježi) | ne |
| g | 500 code 13 sa golim hex-om (`odbijTransakcijuSa`) | samo ubrizgavanjem | `Error (code 13): 13 INTERNAL: bare cccc…` | da (N-10) |

Dostižnost real-1 u i04 (`v3b.mjs`): voucher ili `loyaltyAccounts` je brisan Admin SDK-om (van transakcije) dok izdavanje drži
transakciju (`omotacBaze({ prijeCommita })`). Brisanje čeka bravu (`brisanje čeka (> 2,5 s) → kasnije: obrisano za 2540 ms`),
izdavanje se commit-uje (201) i tek onda brisanje uspijeva. NOT_FOUND iz `tx.update` zato nije dostižan dok se dokument čita u
transakciji, a u i04 ništa ne briše dokumente. Postaje relevantan sa kodom koji radi `update`/`tx.update` bez prethodnog čitanja u
istoj transakciji (i05–i07).

Dijagnostika je ostala moguća (`Error (code 6): 6 ALREADY_EXISTS …` + okviri). Odgovor klijentu i statusni kod se nisu promijenili.

## 6. Novi nalazi

### R-05 — MINOR — redakcija ne pokriva stvarni emulatorski format `NOT_FOUND` (`name: "<id>"`)
- Referenca: O-18 („log 5xx … ne smije sadržati … voucherId ni requestKey, ni u poruci ni u stack-u”, globalno), D-3, ODLUKE §6 (h)
  („nove kolekcije i oblici poruka moraju ostati pokriveni redakcijom”).
- Reprodukcija (`v3.mjs`): `db.runTransaction(async (tx) => { tx.update(db.doc('vouchers/<64 hex>'), { status: 'EXPIRED' }); })`
  nad emulatorom, pa se uhvaćena greška proslijedi `centralniRukovalacGreskama`.
- Očekivano: nema ID-a u logu.
- Dobijeno: `… path <\n  Element {\n    type: "vouchers"\n    name: "<64 hex>"\n  }\n>`. Regex traži samo `path=`, `documents/` i
  `<kolekcija>/`, pa ovaj oblik ostaje neredigovan.
- Dostižnost: u i04 ne (sekcija 5). Od i05/i06 zavisi od toga da li će neki `update` ići bez prethodnog čitanja.
- Predložena ispravka (ne primjenjujem): za greške sa numeričkim gRPC `code` ne bilježiti poruku, nego `name`, `code` (npr.
  `code 5`) i okvire. To ne zavisi od oblika poruke. Druga mogućnost je dodati pravilo za `name: "…"` i test sa stvarnom NOT_FOUND
  greškom (uzrokovati je direktnim `tx.update` u testu).

### R-06 — MINOR (blokira po pravilu presude: neoborena, neekvivalentna mutacija) — I04-T16 (c) ne pokriva `vouchers/<voucherId>` ni `reserve_<voucherId>`
- Referenca: O-18, D-3, plan i04 (mutacije moraju oboriti ciljani test), zadatak re-reviewa V3 („slab test”).
- Reprodukcija: u `obradaGresaka.js`
  `return tekst.replace(PUTANJA_DOKUMENTA, '[putanja dokumenta]');` →
  `return tekst.replace(PUTANJA_DOKUMENTA, (m) => (/vouchers\/|reserve_/.test(m) ? m : '[putanja dokumenta]'));`,
  pa `node --test --test-concurrency=1 "--test-name-pattern=I04-T16 \(c\)" test/emulator/logIzdavanja.test.js`, 10 puta, `git restore`.
- Očekivano: test pada.
- Dobijeno: 10/10 `exit=0 pass=1 fail=0`. U testu postoje samo slučajevi `rewardRequests/<requestKey>` i `loyaltyLedger/release_<voucherId>`.
  `vouchers/<voucherId>` je upravo oblik koji od i06 nosi podatak za iskorišćavanje voucher-a.
- Predložena ispravka (ne primjenjujem): dodati u I04-T16 (c) slučajeve `vouchers/<noviVoucherId>` i
  `loyaltyLedger/reserve_<noviVoucherId>`. Oba su ponovljiva sa `sakrijPostojece` i fiksiranim `randomBytes(32)`, kao a3/a4 u
  `v3.mjs` (pripremi dokument drugog uid-a pod tim ID-em i sakrij ga). Ako se usvoji R-05, dodati i stvarnu NOT_FOUND grešku.
  Dokazati da M43-vr pada 10/10.

### Napomene (NOTE, ne blokiraju)
- **N-09** Obilaznice V1-b (`rewardDefinitions` van transakcije) i V1-c (`users` van transakcije) ne obara nijedan test (I04-T18 0/3,
  cijeli `izdavanjeAtomicnost` i `izdavanjeNagrade` prolaze), iako plan 5.5 (redovi §12/§13.1) traži čitanje u transakciji. U i04 su
  ponašanjem ekvivalentne: nijedan API ne mijenja `rewardDefinitions` (samo seed CLI), a `accountStatus` se ne mijenja poslije init-a.
  Svaki redoslijed je zato serijalizabilan kao „issue prije pisca”. Od i07 (`DELETION_IN_PROGRESS`, brisanje naloga) V1-c postaje
  stvaran rizik (voucher izdat poslije početka brisanja). Preporuka: upisati u ODLUKE §6 kao obavezu za i07, sa testom po uzoru na
  I04-T18 (promjena `accountStatus` dok izdavanje drži transakciju).
- **N-10** Redakcija je zasnovana na obrascu, pa ne hvata goli 64-hex, `release_<hex>` bez kolekcije, ne-Error string, putanju u `name`,
  hex u okviru steka, URL-kodirane putanje ni ID sa zarezom ili razmakom. Ništa od toga nije dostižno u i04. Ispravka iz R-05 (bez poruke
  za gRPC greške) zatvara većinu.
- **N-11** Express `finalhandler` (grana `res.headersSent` → `next(err)`) bilježi cijeli `err.stack` bez redakcije kad `NODE_ENV !== 'test'`.
  Nije dostižno jer nijedna ruta ne šalje zaglavlja prije greške.
- **N-12** I04-T19 je vezan za implementaciju: mock prepoznaje pozivaoca po fajlu `src/servisi/izdavanjeNagrade.js` i očekuje tačno jedno
  čitanje pri ulasku. Legitiman refaktor (npr. sat kroz pomoćnu funkciju u `vauceri.js`) bi oborio test. Prihvatljivo, ali treba imati na umu u i05/i06.
- **N-13** ODLUKE §6: nove oznake su jedinstvene (a–n, bez duplikata; N-08 zatvoren), ali je redoslijed (l) ispred (j). Kozmetika.
- **N-14** M43-samoPath je sa stanovišta tajni ekvivalentna, a test je ipak obara, jer zabranjuje i literal `path=/`. To je strožije
  od O-18, ali bez štete.

## 7. Otvorena pitanja za Orchestrator-a

**P-3 (R-05):** da li se R-05 ispravlja u FIX LOOP-u 2 zajedno sa R-06 ili kao obavezan preduslov i05?
- Opcija A: FIX LOOP 2. Isti fajl i isti test, mala izmjena; ispravka „bez poruke za gRPC greške” uklanja zavisnost od oblika poruke.
- Opcija B: backlog, sa obavezom u ODLUKE §6 (h) za i05.
- Preporuka: A. O-18 je formulisan globalno, a jedini preostali poznati oblik koji curi je onaj koji sam emulator proizvodi.

**P-4 (N-09):** upisati u ODLUKE §6 obavezu za i07 (test konkurentne promjene `accountStatus` za vrijeme izdavanja)? Preporuka: da.

## 8. Šta nije provjereno i zašto
- Produkcioni Firestore (format poruka grešaka, brave upita): testovi rade isključivo nad emulatorom. Format NOT_FOUND u produkciji je
  drugačiji (sa `documents/…`), ali nije provjerljiv.
- Cijeli emulator suite pod obilaznicama V1-b/V1-c: pokrenuti su samo `izdavanjeAtomicnost.test.js` i `izdavanjeNagrade.test.js`
  (ostali fajlovi ne pozivaju API-03 transakciju na način koji bi to razlikovao).
- Obilaznice V1-a/V1-d nisu ponovljene nad API-T07, jer ih I04-T18 obara 10/10.
- Razlika satova Backend/Firestore — sve na istoj mašini.
- Zelen `provjera.ps1` na međukoracima FIX LOOP-a: provjeren je samo vrh `b1817d6`.

## 9. PRESUDA

**ITERATION REJECTED.** Builder mora ispraviti:
1. **R-06**: proširiti I04-T16 (c) slučajevima ALREADY_EXISTS na `vouchers/<voucherId>` i `loyaltyLedger/reserve_<voucherId>` tako
   da mutacija M43-vr (redakcija isključena za `vouchers/` i `reserve_`) pada 10/10; upisati M43-vr u TEST_REPORT sa stvarnim brojevima.

Po odluci Orchestrator-a (P-3, preporuka: u istom FIX LOOP-u): **R-05**, redakcija nezavisna od oblika poruke ili pokrivanje stvarnog
emulatorskog NOT_FOUND oblika, sa testom koji koristi stvarnu NOT_FOUND grešku. Napomene N-09 … N-14 ne blokiraju.

R-01, R-02, R-03 i R-04 (oblik iz prvog reviewa) su zatvoreni i ne treba ih ponovo otvarati.
