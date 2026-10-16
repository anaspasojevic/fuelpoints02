# i03 — Plan (PLANNER)

Iteracija 3: Purchase / EARN. Grana `iteracija-03`.
Izvori: `CLAUDE.md`, `docs/iteracije/i03_brief.md`, SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`, normativan; `.md` čitljiva kopija; §31 iz `.docx`-a),
`docs/TRACEABILITY.md`, `docs/iteracije/i02_plan.md` (sekcija 15: odluke i02/P-1 … P-9), `docs/iteracije/i02_review_fix1.md` (F1-01),
`docs/IMPLEMENTATION_LOG.md` („Ograničenja za buduće iteracije”).
Datum plana: 2026-10-16. Uloga: PLANNER (bez koda).

Oznake otvorenih pitanja su `i03/P-n` (sekcija 13).

---

## 1. SRS zahtjevi u opsegu

| SRS / odluka | Šta se u i03 radi | Napomena |
|---|---|---|
| §3.4, NFR-02 | Posrednik `X-POS-API-Key` → `stationId` iz mape u konfiguraciji (env `POS_API_KLJUCEVI`, `i03/P-2`). Nedostaje / prazan / neispravan → 401 `UNAUTHENTICATED_POS`. Poređenje u konstantnom vremenu, bez ranog izlaska (`i03/P-3`). Ključ se ne loguje, ne vraća, ne upisuje u `res.locals`. | Posrednik samo na ruti `POST /pos/purchases`. |
| §3.1, §3.2, §8.5 | Strogo tijelo: tačno šest dozvoljenih ključeva; `stationId`, `earnedPoints`, `recordedAt`, `uid`, … → 422 `INVALID_REQUEST`. `stationId`, `earnedPoints`, `recordedAt` su isključivo serverski. | Brief tačka 5. |
| §1.5 | `earnedPoints = Math.floor(volumeMl / 1000)`, integer. | `izracunajBodove(volumeMl)`. |
| §8.1, §8.2, O-13 | `purchaseId = ${stationId}__${posTransactionId}`; `posTransactionId` `^[A-Za-z0-9._-]{1,64}$`; `stationId` iz konfiguracije `^[A-Za-z0-9.-]{1,32}$` (bez `_`). | Odbrana u dubinu: postojeći dokument sa drugim `stationId`/`posTransactionId` → 500. |
| §8.3 | `purchases/{purchaseId}` = TAČNO `{ uid, stationId, posTransactionId, volumeMl, amountMinor, currency, earnedPoints, occurredAt, recordedAt }`; `occurredAt` i `recordedAt` su `Timestamp`. | `uid = loyaltyUid`. |
| §8.4, O-10 | Validacija polja (redoslijed u 5.3): `INVALID_TRANSACTION_ID`, `INVALID_VOLUME`, `INVALID_AMOUNT`, `UNSUPPORTED_CURRENCY`, `INVALID_OCCURRED_AT`; `loyaltyUid` → ACTIVE nalog (`users.accountStatus == "ACTIVE"` I postoji `loyaltyAccounts`), inače 404 `LOYALTY_ACCOUNT_NOT_FOUND`. | Format `occurredAt`: `i03/P-4`; format `loyaltyUid`: `i03/P-5`. |
| §7.1–§7.3 | EARN: `availablePoints += p`, `updatedAt` serverski, `reservedPoints` nepromijenjen; invarijante ≥ 0. | `tx.update` samo `availablePoints` i `updatedAt`. |
| §9, §9.1–§9.3, §21 (kreiranje) | JEDNA transakcija: purchase (create), balance (update), EARN (create), notifikacija `notifications/earn_{purchaseId}` (create) `{ uid, type: "POINTS_EARNED", title, body, createdAt, readAt: null, relatedPurchaseId }`. | Tekst: `i03/P-8`. |
| §10, O-3, O-12 | Prvo se čita `purchases/{purchaseId}`. Postoji → poređenje `uid`, `volumeMl`, `amountMinor`, `currency` (isti → prvi rezultat, 200; različit → 409 `IDEMPOTENCY_CONFLICT`), bez obzira na stanje naloga; `occurredAt` se ne poredi. Ne postoji → provjera naloga (404) → četiri upisa. | — |
| O-4 | 0 bodova (npr. 900 ml) → sva četiri zapisa, EARN sa `deltaAvailable: 0`. | — |
| §11 | `loyaltyLedger/earn_{purchaseId}` (`i03/P-7`) = TAČNO `{ uid, type: "EARN", deltaAvailable: p, deltaReserved: 0, availableAfter, reservedAfter, purchaseId, voucherId: null, createdAt }`; samo `tx.create`. | — |
| §25.4, §25.5, §25.8, §31 | `firebase/firestore.rules`: blokovi `/purchases/{purchaseId}`, `/loyaltyLedger/{eventId}`, `/notifications/{notificationId}` doslovno iz §31 `.docx`-a, na mjestima kao u §31 (11.3). | RULE-T08, RULE-T10, RULE-T11, I03-T20. |
| §27, O-1 | Kodovi u opsegu: `UNAUTHENTICATED_POS`, `INVALID_TRANSACTION_ID`, `INVALID_VOLUME`, `INVALID_AMOUNT`, `UNSUPPORTED_CURRENCY`, `INVALID_OCCURRED_AT`, `LOYALTY_ACCOUNT_NOT_FOUND`, `IDEMPOTENCY_CONFLICT`, `INVALID_REQUEST`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE` (i postojeći `NOT_FOUND`). | Katalog se ne mijenja (svi kodovi već postoje). |
| NFR-04, NFR-05, NFR-07 | Failure injection na svakom upisu i prije commit-a; idempotentnost i kasni commit poslije 503 (I03-T13); ključevi van repoa, odgovora i logova. | — |
| F1-01 (backlog i02) | I03-T16: istekao rok → `runTransaction` se ne poziva, 503, 0 dokumenata — za init i kupovinu. | Samo test, bez izmjene `inicijalizacijaNaloga.js`. |

## 2. SRS zahtjevi van opsega

| SRS | Iteracija | Zašto nije sada |
|---|---|---|
| §26 API-03 … API-07, §7.4 – §7.6, §12 – §20 | 4–7 | Brief tačka 3. POS posrednik se veže samo na `POST /pos/purchases`. |
| §31 blokovi `rewardDefinitions`, `vouchers`, `rewardRequests`, `redemptionRequests`; RULE-T09; konačan RULE-T12 | 4–6, 8 (D-2) | Default deny ih i dalje pokriva. |
| §21.2 (readAt iz aplikacije), §21.3, UI-05, UI-07, composite indeks za Android upit | 10 | Android. |
| §23, AC-11, O-10a (retry poslije `uid = null`) | 7 | Vidi „Ograničenja za buduće iteracije” (sekcija 12). |
| §33.2 POS Simulator HTML, CORS | 11 | — |
| §1.3 refund/reversal, market, kampanje; FCM; health/status, rate limiting | nikad | §1.3, §22, §26 (tačno 7 endpointa). |

## 3. Zatečeno stanje repozitorijuma

Provjereno 2026-10-16 (samo čitanje, osim commit-a brief-a):

- `main` = `origin/main` = tag `i02` (anotiran) = `700b155` (merge PR #2). `docs/iteracije/i02_review_fix1.md` → `ITERATION ACCEPTED`; otvoren samo P3 F1-01 (u ovom brief-u → I03-T16).
- Grana `iteracija-03` napravljena iz `main`; prvi commit `da1d894 i03: Iteration Brief (Orchestrator)` (samo `docs/iteracije/i03_brief.md`), push-ovan.
- Backend (i02): `aplikacija.js` (`napraviAplikaciju({ servisi, verzijaUslova, dodajRute })`, globalni `parsirajJson`), `posrednici/autentikacija.js` (rok `rokDo` u `res.locals`),
  `servisi/inicijalizacijaNaloga.js` (provjera preostalog roka prije `runTransaction`), `greske/greskeServisa.js` (`saRokom`, `jeNedostupnostFirestore` 14/4/10),
  `konfiguracija.js` (`PORT`, `FIREBASE_PROJECT_ID`, `VERZIJA_USLOVA`, zaštita emulator/demo, `ROK_ZAVISNOG_SERVISA_MS = 10_000`), `dnevnik.js` (samo eksplicitna polja; `putanja = req.path`, bez query-ja).
- Katalog već ima sve kodove u opsegu (`katalogGresaka.js`); ne mijenja se.
- `firebase/firestore.rules` = helper funkcije + `/users/{uid}` + `/loyaltyAccounts/{uid}` + default deny (i02). `firebase/tests/podrazumijevanaZabrana.test.js` sadrži RULE-T12 (preliminarno) i I01-T10 (loyaltyLedger).
- `ucitajKonfiguraciju` koristi samo `pokreni.js`; spawn testovi koji startuju Backend: I01-T06 (bez PORT), I02-T13 (b) (`pokretanjeBackenda.test.js`), I02-T11 (`nedostupnostServisa.test.js`).
- Provjereno sondom u Node 24 (privremena skripta u scratchpad-u, nije u repou):
  - `new Date('2026-02-30T00:00:00Z')` → `2026-03-02T00:00:00.000Z` (tiho pomjeranje — zato vlastiti parser, 5.4);
  - `Date.UTC(1, 0, 1)` → `1901-01-01` (godine 0–99 se mapiraju na 19xx — parser NE smije koristiti `Date.UTC`/`new Date(y, …)` za godinu);
  - `Timestamp.fromMillis(min − 1)` baca (`seconds` van `[-62135596800, 253402300799]`) — opseg se provjerava prije konstrukcije;
  - `JSON.parse('{"a":1e3}').a === 1000`; `JSON.parse('-0')` daje `-0`; Firestore serializer (`@google-cloud/firestore/build/src/serializer.js:98`) `-0` upisuje kao `doubleValue` (ne integer) — zato normalizacija `-0 → 0` (`i03/P-9`);
  - Node HTTP parser: `X-POS-API-Key:   abc  ` → `"abc"` (OWS se uklanja po HTTP-u); dva zaglavlja `x-pos-api-key: a` i `X-Pos-Api-Key: b` → `"a, b"`; prazno zaglavlje → `""` (`i03/P-12`).
- §31 izvučen direktno iz `word/document.xml` normativnog `.docx`-a (prelomi `w:br`, odlomci `w:p`): tekst blokova u 11.3. `.md` kopija se ne koristi (pandoc escape-ovi).
- PowerShell 5.1 komanda za ključ (11.2) provjerena: daje 43 znaka, `Buffer.from(k, 'base64url')` = 32 bajta, kanonski oblik.

### 3.1 Preduslov: `provjera.ps1`

`powershell -NoProfile -ExecutionPolicy Bypass -File .\skripte\provjera.ps1` na kodu identičnom `main`/`i02` (izlaz preusmjeren u fajl van repoa)
→ `SVE PROVJERE PROŠLE`, `EXIT=0`: SRS hash, NFR-07, bez TODO/FIXME, portovi; backend `npm test` `ℹ tests 34` `ℹ fail 0`, `test:emu` `ℹ tests 36` `ℹ fail 0`;
smoke 404 `NOT_FOUND` i 401 `UNAUTHENTICATED`; rules `ℹ tests 17` `ℹ fail 0`; `assembleDebug` i `testDebugUnitTest` BUILD SUCCESSFUL. Zeleni checkpoint postoji.
Zabilježeno trajanje (1075 s) uključuje čekanje pozivaoca na pipe koji drži Gradle daemon (poznato ograničenje iz i02); `EXIT=0` je upisan tek poslije `gradlew --stop`.

## 4. Fajlovi (dodati / izmijeniti / netaknuto)

Legenda: **[D]** dodati, **[I]** izmijeniti, **[N]** netaknuto.

```
/
├── .env.example                                  [I] POS_API_KLJUCEVI sa placeholder-om sa kojim Backend NE startuje (11.2)
├── README.md                                     [I] POS konfiguracija, PowerShell komanda za ključ, API-02 ukratko
├── skripte/provjera.ps1                          [I] POS_API_KLJUCEVI generisan u toku izvršavanja; smoke POST /api/v1/pos/purchases bez ključa → 401
├── firebase/
│   ├── firestore.rules                           [I] + /purchases, /loyaltyLedger, /notifications doslovno iz §31 (11.3)
│   └── tests/
│       ├── podrazumijevanaZabrana.test.js        [I] I01-T10 uklonjen u potpunosti; komentar zaglavlja
│       └── kupovineObavjestenjaLedger.test.js    [D] RULE-T08, RULE-T10, RULE-T11, I03-T20
├── backend/
│   ├── src/
│   │   ├── aplikacija.js                         [I] opcije.posStanice; dodajRuteKupovina(ruterApi, { servisi, posStanice })
│   │   ├── pokreni.js                            [I] prosljeđuje konfiguracija.posStanice
│   │   ├── konfiguracija/konfiguracija.js        [I] POS_API_KLJUCEVI (obavezna) → posStanice
│   │   ├── konfiguracija/posKljucevi.js          [D] procitajPosKljuceve(vrijednost) → { stanice, problemi } (5.6)
│   │   ├── posrednici/posAutentikacija.js        [D] napraviProvjeruPosKljuca(posStanice) → res.locals.stationId, res.locals.rokDo (5.2)
│   │   ├── rute/kupovine.js                      [D] dodajRuteKupovina(ruter, { servisi, posStanice }): POST /pos/purchases
│   │   ├── validacija/tijeloKupovine.js          [D] provjeriTijeloKupovine(tijelo, sadaMs) (5.3)
│   │   ├── validacija/vrijemeKupovine.js         [D] procitajOccurredAt(tekst) → milisekunde | null (5.4)
│   │   ├── servisi/bodovanje.js                  [D] izracunajBodove(volumeMl), oblikRijeciBod(n), tekstObavjestenja(p) (5.7)
│   │   └── servisi/evidencijaKupovine.js         [D] evidentirajKupovinu(db, ulaz, rokDo) — JEDNA transakcija (5.5)
│   │   (ostalo [N]: dnevnik.js, greske/*, posrednici/autentikacija.js, posrednici/korelacija.js, rute/nalog.js,
│   │    servisi/inicijalizacijaNaloga.js, validacija/tijeloInita.js, podaci/kolekcije.js, firebase/inicijalizacija.js, punjenje/*,
│   │    skripte/napuniEmulator.js, package.json, package-lock.json)
│   └── test/
│       ├── pomocnici/
│       │   ├── posKljuc.js                       [D] generisiPosKljuc() (crypto.randomBytes(32) → base64url), posKonfiguracija([[stationId, kljuc], …]) → string za env
│       │   ├── omotacBaze.js                     [D] omotač oko pravog db za i03 testove (8, „Pomoćnici”); i02 omotač u inicijalizacijaNaloga.test.js [N]
│       │   └── (emulator.js, authEmulator.js, presretanjeLoga.js [N]; procesBackenda.js [N])
│       ├── jedinicni/
│       │   ├── konfiguracija.test.js             [I] I01-T06 i I02-T13 (a): POS_API_KLJUCEVI kao proširenje ulaza/očekivanja; I03-T15 (a)
│       │   ├── pokretanjeBackenda.test.js        [I] I02-T13 (b): POS_API_KLJUCEVI u env-u; I03-T15 (b) spawn
│       │   ├── posAutentikacija.test.js          [D] I03-T01 (a) konstantno vrijeme: broj poređenja = broj stanica
│       │   ├── bodovanje.test.js                 [D] I03-T03 (a), I03-T21
│       │   └── vrijemeKupovine.test.js           [D] I03-T07 (a) parser bez mreže
│       └── emulator/
│           ├── nedostupnostServisa.test.js       [I] samo env spawn-ovanog procesa: + POS_API_KLJUCEVI (proširenje ulaza)
│           ├── posAutentikacija.test.js          [D] I03-T01 (b), I03-T22
│           ├── kupovina.test.js                  [D] API-T02, API-T03, API-T04, I03-T02 … I03-T09, I03-T14, I03-T18, I03-T19
│           ├── kupovinaAtomicnost.test.js        [D] I03-T10, I03-T11, I03-T12, I03-T13
│           ├── rokPrijeTransakcije.test.js       [D] I03-T16 (init i kupovina)
│           └── logBezPosKljuca.test.js           [D] I03-T17 (in-process + spawn)
└── docs/
    ├── TRACEABILITY.md                           [I] samo redovi Iteracije 3 (Kod, Status, Planirani test); §8.3 – §8.5 tekst po brief-u
    ├── IMPLEMENTATION_LOG.md                     [I] unos i03 (+ status i03/P-n, ograničenja za buduće iteracije)
    ├── TEST_REPORT.md                            [I] sekcija i03 (stvarni izlaz)
    ├── srs/*                                     [N]
    └── iteracije/i03_brief.md [N]; i03_plan.md (ovaj fajl)
```

Nijedan novi npm paket. Koriste se `node:crypto` (`timingSafeEqual`, `createHash`, `randomBytes`), `firebase-admin/firestore` (`FieldValue`, `Timestamp`), `node:test` `mock`.
Glob-ovi `test/jedinicni/*.test.js`, `test/emulator/*.test.js` i `firebase/tests/*.test.js` obuhvataju nove fajlove; `package.json` se ne mijenja.

Imenovanje: SRS nazivi (`purchases`, `loyaltyLedger`, `notifications`, `loyaltyUid`, `posTransactionId`, `volumeMl`, `amountMinor`, `currency`, `occurredAt`,
`recordedAt`, `earnedPoints`, `stationId`, `purchaseId`, `availableAfter`, `reservedAfter`, `deltaAvailable`, `deltaReserved`, `voucherId`, `relatedPurchaseId`,
`readAt`, `EARN`, `POINTS_EARNED`, kodovi grešaka, `X-POS-API-Key`) ostaju tačno kao u SRS-u; sve ostalo srpski.

## 5. Data-flow i granice

### 5.1 Tok zahtjeva `POST /api/v1/pos/purchases`

```
korelacija → parsirajJson (i01; neispravan JSON → 422 INVALID_REQUEST, bez ključa i bez baze, i02/P-6) → /api/v1 ruter
  → ruta POST /pos/purchases:
      1. provjeraPosKljuca (5.2)                       → 401 UNAUTHENTICATED_POS | 500; res.locals.stationId, res.locals.rokDo
      2. provjeriTijeloKupovine(req.body, Date.now())  → 422 INVALID_REQUEST | 422 <kod polja> | 404 LOYALTY_ACCOUNT_NOT_FOUND (format)   (5.3)
      3. evidentirajKupovinu(db, { stationId, ...ulaz }, rokDo)
                                                       → 404 | 409 IDEMPOTENCY_CONFLICT | 500 | 503   (5.5)
      4. res.status(kreirano ? 201 : 200).json(odgovor)                                                    (6)
  → nepoznataRuta (NOT_FOUND) → centralniRukovalacGreskama (i01, nepromijenjen)
```

- Posrednik se veže SAMO na rutu (`ruter.post('/pos/purchases', provjeraPosKljuca, obradi)`), ne na prefiks `/pos`: `GET /api/v1/pos/purchases` i
  `POST /api/v1/pos/nepostojeca` ostaju 404 `NOT_FOUND` (I03-T22).
- Koraci 1 i 2 se završavaju BEZ ijednog poziva prema `servisi.db` (ni `collection`, `doc`, `runTransaction`); I03-T01, I03-T02, I03-T09 to mjere omotačem.
- `res.locals.stationId` je JEDINI izvor `stationId`-a. Handler nikad ne čita `req.query`, `req.params` ni zaglavlja osim `X-POS-API-Key` (u posredniku).
- Handler je `async` (Express 5 prosljeđuje odbijene promise-e centralnom rukovaocu).

### 5.2 Posrednik `napraviProvjeruPosKljuca(posStanice)` (`posrednici/posAutentikacija.js`)

`posStanice` = zamrznut niz `{ stationId, otisakKljuca }` iz konfiguracije (5.6); `otisakKljuca` = SHA-256 (32 bajta) UTF-8 vrijednosti ključa. Sirov ključ se u procesu NE čuva poslije čitanja konfiguracije.

```
provjeraPosKljuca(req, res, next):
  rokDo = Date.now() + ROK_ZAVISNOG_SERVISA_MS;  res.locals.rokDo = rokDo          // jedan rok po zahtjevu (i02 R-02), od ulaska u posrednik
  ako !Array.isArray(posStanice) || posStanice.length === 0 → throw new Error('POS konfiguracija nije proslijeđena.')   // → 500, i03/P-11
  vrijednost = req.get('x-pos-api-key')                                            // naziv zaglavlja case-insensitive (HTTP)
  kandidat   = typeof vrijednost === 'string' ? vrijednost : ''
  otisak     = crypto.createHash('sha256').update(kandidat, 'utf8').digest()
  pronadjena = null
  za SVAKU stanicu (bez break/return):
     jednako = crypto.timingSafeEqual(otisak, stanica.otisakKljuca)
     ako jednako && pronadjena === null → pronadjena = stanica.stationId
  ako kandidat === '' || pronadjena === null → throw new GreskaApi('UNAUTHENTICATED_POS')
  res.locals.stationId = pronadjena;  next()
```

Tehnika konstantnog vremena (`i03/P-3`):
- Poređenje je nad SHA-256 otiscima fiksne dužine (32 bajta), pa `timingSafeEqual` ne baca za različite dužine i ne otkriva dužinu ključa;
  `timingSafeEqual` nema rani izlazak po bajtu.
- Petlja uvijek prolazi kroz SVE stanice; nedostajući i prazan ključ prolaze istu petlju (heš praznog stringa), odluka se donosi tek poslije petlje.
- Jedina zavisnost trajanja od ulaza je heširanje kandidata (dužina napadačevog sopstvenog ulaza), što ne otkriva ništa o ključevima.
- `crypto` se uvozi kao default objekat (`import crypto from 'node:crypto'`) i poziva kao `crypto.timingSafeEqual(...)`, da test (I03-T01 (a)) može
  `mock.method` brojati pozive: tačno `posStanice.length` za pogodak prve, pogodak posljednje, promašaj, prazan i nedostajući ključ. Ovo nije test hook
  (nema grananja ni zastavice u kodu), već način poziva.

Pravila:
- Ključ iz query-ja (`?X-POS-API-Key=…`), drugog zaglavlja (`X-Api-Key`, `Authorization: Bearer <ključ>`), ili tijela (`{ "X-POS-API-Key": … }`) se nikad ne čita →
  bez ispravnog zaglavlja 401 (provjera ključa ide prije strukture tijela). Firebase ID token u `Authorization` se ignoriše.
- Dupla zaglavlja: Node ih spaja u `"a, b"`, što nije ključ → 401 (I03-T01).
- Posrednik baca samo `GreskaApi('UNAUTHENTICATED_POS')` ili grešku bez vrijednosti; promjenljive `vrijednost`, `kandidat`, `otisak` se ne upisuju u `req`, `res.locals`, log ni grešku.

### 5.3 Validacija tijela `provjeriTijeloKupovine(tijelo, sadaMs)` (`validacija/tijeloKupovine.js`)

Redoslijed je obavezujući (prvi neuspjeh određuje kod; `i03/P-6`):

| # | Provjera | Kod |
|---|---|---|
| 1 | `tijelo` nije običan objekat (`undefined` bez JSON Content-Type, `null`, niz, string, broj, boolean) | 422 `INVALID_REQUEST` |
| 2 | `Object.keys(tijelo)` sadrži ključ van `{ loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAt }` (npr. `stationId`, `earnedPoints`, `recordedAt`, `uid`, `X-POS-API-Key`, `__proto__`, `constructor`) | 422 `INVALID_REQUEST` |
| 3 | `loyaltyUid` nedostaje ili nije string | 422 `INVALID_REQUEST` |
| 4 | `posTransactionId` nije string ili ne odgovara `/^[A-Za-z0-9._-]{1,64}$/` (JS `$` bez `m` zastavice ne prihvata završni `\n`) | 422 `INVALID_TRANSACTION_ID` |
| 5 | `volumeMl`: `!Number.isInteger(v) \|\| v < 1 \|\| v > 200000` | 422 `INVALID_VOLUME` |
| 6 | `amountMinor`: `!Number.isInteger(v) \|\| v < 0 \|\| v > 1000000` | 422 `INVALID_AMOUNT` |
| 7 | `currency !== 'EUR'` (stroga jednakost; ne-string pada) | 422 `UNSUPPORTED_CURRENCY` |
| 8 | `occurredAt`: `procitajOccurredAt(occurredAt)` (5.4) vrati `null`, ili rezultat `> sadaMs + 300_000` | 422 `INVALID_OCCURRED_AT` |
| 9 | `loyaltyUid` nema ispravan format (`i03/P-5`, ispod) | 404 `LOYALTY_ACCOUNT_NOT_FOUND` |

- Redovi 4–8 prate redoslijed tabele §8.4 (posTransactionId, volumeMl, amountMinor, currency, occurredAt); red 9 je §8.4 `loyaltyUid` kao poslednja provjera bez baze,
  jer 404 za nepostojeći nalog nastaje tek u transakciji (O-12), a format i postojanje daju isti kod.
- Nedostajuće polje (`undefined`) i pogrešan JSON tip padaju na provjeri svog polja (`volumeMl: "1000"` ili `null` → `INVALID_VOLUME`).
- `Number.isInteger` radi nad parsiranom JSON vrijednošću: `1000.0` i `1e3` su u JSON-u isti broj kao `1000` i prolaze; ovo se dokumentuje (README, IMPLEMENTATION_LOG),
  bez dodatne provjere sirovog teksta.
- `-0` (dozvoljen JSON) se normalizuje u `0` (`v === 0 ? 0 : v`) za `volumeMl` i `amountMinor`, da se u Firestore ne upiše `doubleValue -0` (`i03/P-9`).
- `sadaMs = Date.now()` Backend-a u trenutku validacije; granica je uključiva (`=== sadaMs + 300_000` prolazi).
- Format `loyaltyUid` (`i03/P-5`): `typeof === 'string'`, `isWellFormed()`, dužina 1–128 (`.length`, UTF-16 jedinice, isto kao Firebase UID ograničenje od 128 znakova),
  ne sadrži `/`, nije `.` ni `..`, ne odgovara `/^__.*__$/`. Prazan string (`""`) prolazi red 3 (jeste string) i pada na redu 9 → 404 (brief, I03-T09).
- Vraća NOVI objekat `{ loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAtMs }` (nikad `tijelo` po referenci).

### 5.4 Parser `procitajOccurredAt(tekst)` (`validacija/vrijemeKupovine.js`, `i03/P-4`)

Prihvata se SAMO RFC 3339 `date-time` string sa obaveznom zonom:

```
^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$
```

- Veliko `T` i `Z` (strože od RFC 3339 koji dozvoljava mala slova; dokumentuje se). 0–3 decimale; `.5` = 500 ms, `.05` = 50 ms.
- Provjere: mjesec 01–12; dan 01–broj dana u mjesecu (gregorijanska prestupna godina: djeljiva sa 4 i ne sa 100, ili djeljiva sa 400); sat 00–23; minut 00–59;
  sekunda 00–59 (60 se odbija); offset sat 00–23, offset minut 00–59. `-00:00` se tumači kao UTC.
- Računanje bez `Date.UTC` i bez `Date.parse` (godine 0–99, tiho pomjeranje datuma): `const d = new Date(0); d.setUTCFullYear(g, m - 1, dan); d.setUTCHours(sat, min, sek, ms);`
  `rezultat = d.getTime() - predznak * (offSat * 60 + offMin) * 60_000`. Kalendarska ispravnost se provjerava PRIJE računanja (gornja pravila), ne poslije.
- Rezultat mora biti u opsegu Firestore `Timestamp`-a: `[-62_135_596_800_000, 253_402_300_799_999]` ms, inače `null`.
- Ne-string (broj, `null`, objekat), `""`, datum bez zone (`2026-10-16T10:00:00`), samo datum, `2026-02-30T00:00:00Z`, `…T10:00:60Z`, 4+ decimale, razmak umjesto `T` → `null`.
- Čuvanje: `Timestamp.fromMillis(occurredAtMs)`. Vraćanje: `occurredAt.toDate().toISOString()` (uvijek `YYYY-MM-DDTHH:mm:ss.sssZ`, UTC). Čuvana, poređena i vraćena vrijednost
  je isti trenutak u milisekundama (I03-T07 provjerava `toMillis()` i string odgovora, uključujući ulaz sa offset-om `+02:00`).

### 5.5 Transakciona granica `evidentirajKupovinu(db, ulaz, rokDo)` (`servisi/evidencijaKupovine.js`)

`ulaz = { stationId, loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAtMs }`.

```
preostaloMs = rokDo - Date.now()
ako !(preostaloMs > 0) → throw GreskaApi('SERVICE_UNAVAILABLE')            // PRIJE ijednog poziva db (ni collection/doc); F1-01, I03-T16

purchaseId = `${stationId}__${posTransactionId}`
refKupovina    = db.collection(KOLEKCIJE.purchases).doc(purchaseId)
refKorisnik    = db.collection(KOLEKCIJE.users).doc(loyaltyUid)
refNalog       = db.collection(KOLEKCIJE.loyaltyAccounts).doc(loyaltyUid)
refDogadjaj    = db.collection(KOLEKCIJE.loyaltyLedger).doc(`earn_${purchaseId}`)
refObavjestenje= db.collection(KOLEKCIJE.notifications).doc(`earn_${purchaseId}`)

transakcija = db.runTransaction(async (tx) => {
  // (1) O-12: postojeća kupovina se provjerava PRIJE naloga
  snimakKupovine = await tx.get(refKupovina)
  ako snimakKupovine.exists:
     k = snimakKupovine.data()
     ako k.stationId !== stationId || k.posTransactionId !== posTransactionId → throw new Error('purchase dokument ne odgovara ID-u')   // O-13 → 500
     ako k.uid !== loyaltyUid || k.volumeMl !== volumeMl || k.amountMinor !== amountMinor || k.currency !== currency
        → throw GreskaApi('IDEMPOTENCY_CONFLICT')                                 // §10.3; occurredAt se ne poredi (O-3)
     return { kreirano: false, odgovor: odgovorKupovine(purchaseId, k) }          // §10.2, ništa se ne piše

  // (2) nova kupovina
  [snimakKorisnika, snimakNaloga, snimakDogadjaja, snimakObavjestenja] = await tx.getAll(refKorisnik, refNalog, refDogadjaj, refObavjestenje)
  ako !snimakKorisnika.exists || snimakKorisnika.get('accountStatus') !== 'ACTIVE' || !snimakNaloga.exists
     → throw GreskaApi('LOYALTY_ACCOUNT_NOT_FOUND')                               // O-10
  ako snimakDogadjaja.exists || snimakObavjestenja.exists → throw new Error('nekonzistentno stanje')   // → 500
  dostupno = snimakNaloga.get('availablePoints'); rezervisano = snimakNaloga.get('reservedPoints')
  ako bilo koje nije Number.isSafeInteger ili je < 0 → throw new Error('neispravan loyaltyAccounts')    // → 500, i03/P-15

  p = izracunajBodove(volumeMl);  availableAfter = dostupno + p;  reservedAfter = rezervisano
  vrijeme = FieldValue.serverTimestamp()
  kupovina = { uid: loyaltyUid, stationId, posTransactionId, volumeMl, amountMinor, currency,
               earnedPoints: p, occurredAt: Timestamp.fromMillis(occurredAtMs), recordedAt: vrijeme }
  { title, body } = tekstObavjestenja(p)

  tx.create(refKupovina, kupovina)                                                              // upis 1
  tx.update(refNalog, { availablePoints: availableAfter, updatedAt: vrijeme })                  // upis 2
  tx.create(refDogadjaj, { uid: loyaltyUid, type: 'EARN', deltaAvailable: p, deltaReserved: 0,
                           availableAfter, reservedAfter, purchaseId, voucherId: null, createdAt: vrijeme })   // upis 3
  tx.create(refObavjestenje, { uid: loyaltyUid, type: 'POINTS_EARNED', title, body, createdAt: vrijeme,
                               readAt: null, relatedPurchaseId: purchaseId })                    // upis 4
  return { kreirano: true, odgovor: odgovorKupovine(purchaseId, kupovina) }
}, { maxAttempts: 5 })

return await saRokom(transakcija, preostaloMs)   // greške: GreskaApi prolazi; jeNedostupnostFirestore → SERVICE_UNAVAILABLE; ostalo → izvorna greška → 500
```

Pravila za Builder-a:
- Redoslijed i broj upisa su fiksni (1–4) jer failure injection (I03-T10) cilja svaki po rednom broju.
- Svi novi dokumenti `tx.create` (nikad `set`): i kad bi čitanje bilo zastarjelo, commit ne može prepisati postojeći purchase/ledger/notifikaciju (`ALREADY_EXISTS` → 500).
  `loyaltyAccounts` jedino `tx.update` sa tačno dva polja.
- Jedan `FieldValue.serverTimestamp()` za `recordedAt`, `updatedAt`, `createdAt` (ledger) i `createdAt` (notifikacija): isti serverski trenutak u sva četiri.
- `availableAfter` se računa iz stanja pročitanog u ISTOJ transakciji (ne `FieldValue.increment`), pa je niz `availableAfter` pod konkurencijom konzistentan (I03-T12).
- Callback bez sporednih efekata van `tx` (može se izvršiti više puta).
- Svaki ID se koristi samo kao `.doc(id)`; `loyaltyUid` stiže ovdje tek poslije provjere formata (5.3 red 9).
- `maxAttempts: 5` (kao i02). Ako I03-T11/T12 pokažu da je ishod nestabilan (npr. 500 umjesto 409/200), Builder STAJE i javlja; ako samo ima mnogo 503, I03-T12 ih ponavlja (to je očekivano).
- `odgovorKupovine(purchaseId, podaci)` je ista funkcija za obje grane (6); u grani kreiranja `podaci.occurredAt` je isti `Timestamp` koji se upisuje.

### 5.6 Konfiguracija POS ključeva (`konfiguracija/posKljucevi.js`, `konfiguracija.js`, `i03/P-2`)

- Varijabla: `POS_API_KLJUCEVI` (nije SRS naziv → srpski). Obavezna, bez podrazumijevane vrijednosti.
- Format: `stationId:ključ[,stationId:ključ…]`, bez ijednog razmaka. Primjer oblika (NE važeći ključ): `SIM01:<43 znaka>,SIM02:<43 znaka>`.
  `:` i `,` nisu u alfabetu ni `stationId`-a (O-13) ni base64url-a, pa je razdvajanje jednoznačno.
- Provjere `procitajPosKljuceve(vrijednost)` (svaki problem se skuplja; poruka imenuje varijablu, redni broj stavke i razlog, NIKAD vrijednost):
  1. nedostaje ili `''` → „nedostaje obavezna varijabla POS_API_KLJUCEVI”;
  2. sadrži whitespace, ili je neka stavka prazna (npr. `a:b,`), ili stavka nema tačno jedan `:` → „POS_API_KLJUCEVI nema ispravan format (stavka N)”;
  3. `stationId` ne odgovara `^[A-Za-z0-9.-]{1,32}$` (O-13; `_` i ostali znakovi odbijeni) → „… stationId nije ispravan (stavka N)”;
  4. ključ nije tačno 43 znaka `^[A-Za-z0-9_-]{43}$`, ili `Buffer.from(k, 'base64url')` nije 32 bajta, ili ponovno kodiranje nije jednako `k` (kanonski base64url od 32 bajta = 256 bita) → „… POS ključ nije base64url od 32 bajta (stavka N)”;
  5. ključ ima manje od 16 različitih znakova (`i03/P-2`: odbija očigledne placeholder-e tipa `AAAA…`; slučajan ključ od 43 znaka ima ~30 različitih, vjerovatnoća < 16 je zanemarljiva) → „… POS ključ nije slučajan (stavka N)”;
  6. ponovljen `stationId` → „… ponovljen stationId (stavke N i M)”; ponovljen ključ → „… ponovljen POS ključ (stavke N i M)”.
- Rezultat: `Object.freeze` niza `Object.freeze({ stationId, otisakKljuca })` (SHA-256 ključa). `ucitajKonfiguraciju` vraća
  `Object.freeze({ port, projectId, host, verzijaUslova, posStanice })`. Sirov ključ se ne čuva u objektu konfiguracije (ne može procuriti ni kroz ispis objekta).
- Greška konfiguracije ide postojećim tokom (`Greška konfiguracije: …` na stderr, exit ≠ 0, bez listen-a i bez Admin SDK-a).

### 5.7 Bodovanje i tekst notifikacije (`servisi/bodovanje.js`, `i03/P-8`)

- `izracunajBodove(volumeMl) = Math.floor(volumeMl / 1000)` (ulaz je validiran integer; rezultat 0–200).
- `oblikRijeciBod(n)`: `n % 10 === 1 && n % 100 !== 11` → `bod`; `n % 10 ∈ {2,3,4} && n % 100 ∉ {12,13,14}` → `boda`; inače `bodova`.
  Tabela: 0 bodova; 1 bod; 2, 3, 4 boda; 5–20 bodova (uklj. 11, 12, 13, 14); 21 bod; 22 boda; 42 boda; 101 bod; 111, 112, 113, 114 bodova; 200 bodova.
- `tekstObavjestenja(p)` → `{ title: 'Bodovi za kupovinu goriva', body: `Za kupovinu goriva dobili ste ${p} ${oblikRijeciBod(p)}.` }`.
  Primjeri: „Za kupovinu goriva dobili ste 42 boda.”, „… 1 bod.”, „… 0 bodova.” Bez UID-a, stationId-a, iznosa, ključa.

### 5.8 Start Backend-a i aplikacija

```
ucitajKonfiguraciju(process.env)  // + POS_API_KLJUCEVI → posStanice (fail fast)
inicijalizujFirebaseAdmin({ projectId })
napraviAplikaciju({ servisi: { db, auth }, verzijaUslova, posStanice }).listen(port, host)
```

- `napraviAplikaciju`: nova opcija `posStanice`; `dodajRuteKupovina(ruterApi, { servisi: opcije.servisi, posStanice: opcije.posStanice })` odmah poslije `dodajRuteNaloga`, prije `opcije.dodajRute`.
- Bez `posStanice` (i01 unit testovi) aplikacija radi kao do sada; `POST /pos/purchases` tada daje 500 `INTERNAL_ERROR` (fail closed, `i03/P-11`). Produkcioni `pokreni.js` uvijek prosljeđuje validiranu konfiguraciju.
- Failure injection i brojanje pristupa idu kroz ISTI parametar `servisi` (omotač iz testa). U `src/` nema grananja „ako je test”, env zastavica ni test ruta.

### 5.9 Security Rules

`firebase/firestore.rules` dobija tačan sadržaj iz 11.3. Klijent: owner `get` i ograničen `list` (`uid == auth.uid`, `limit ≤ 20`) nad `purchases`; nikakav pristup
`loyaltyLedger`; owner `get`/`list` (`limit ≤ 50`) i jedini `update` `readAt: null → request.time` nad `notifications`. Backend (Admin SDK) ne podliježe pravilima.

## 6. Prijedlog ugovora API-02 (za odobrenje, `i03/P-1`)

| Situacija | HTTP | Tijelo |
|---|---|---|
| Purchase kreiran (prvi zahtjev) | **201 Created** | `{ "purchaseId", "stationId", "posTransactionId", "volumeMl", "amountMinor", "currency", "earnedPoints", "occurredAt" }` |
| Retry istog `(stationId, posTransactionId)` sa istim `uid`, `volumeMl`, `amountMinor`, `currency` | **200 OK** | isto tijelo, bajt-po-bajt jednako prvom |
| Greške | §27 | `{ "error": { "code", "message", "correlationId" } }` (i01) |

Primjer: `201 {"purchaseId":"SIM01__000184","stationId":"SIM01","posTransactionId":"000184","volumeMl":42730,"amountMinor":7050,"currency":"EUR","earnedPoints":42,"occurredAt":"2026-10-16T10:00:00.000Z"}`.

- Sve vrijednosti iz sačuvanog purchase dokumenta (`odgovorKupovine(purchaseId, podaci)`); redoslijed ključeva fiksan, test provjerava `Object.keys`.
- `occurredAt` = sačuvani `Timestamp` → `toISOString()`; retry sa drugim `occurredAt` (O-3) vraća SAČUVANI.
- Ne sadrži: `uid`/`loyaltyUid` (minimizacija; tijelo ostaje stabilno i poslije pseudonimizacije u i07), balance (`availablePoints`, `reservedPoints`, `availableAfter`),
  `recordedAt` (serverski timestamp nepoznat prije commit-a), ID ledger eventa/notifikacije, ključ.
- Alternativa (manje): `{ purchaseId, earnedPoints }`.

## 7. Rizici (security / concurrency / idempotency)

| # | Rizik | Mjera | Dokaz |
|---|---|---|---|
| R1 | `stationId` iz tijela/query-ja (lažna stanica) | Samo iz mape; `stationId` u tijelu → 422 | I03-T01 (ključ B → stationId B), I03-T02 |
| R2 | Ključ prihvaćen van zaglavlja; Bearer kao zamjena | Čita se samo `X-POS-API-Key` | I03-T01 |
| R3 | Timing napad na ključ | SHA-256 + `timingSafeEqual`, petlja kroz sve stanice | I03-T01 (a) (broj poređenja); inspekcija |
| R4 | Ključ u logu/odgovoru/poruci greške/konfiguraciji | `dnevnik.js` nepromijenjen; konfiguracija čuva samo otiske; poruke bez vrijednosti | I03-T15, I03-T17 (svi kanali, svi ishodi, spawn) |
| R5 | Slab ili ponovljen ključ, placeholder iz `.env.example` | Provjere 5.6 | I03-T15 |
| R6 | Dvosmislen purchase ID (`_` u stationId) | O-13 regex; odbrana u dubinu (postojeći dokument sa drugim parom → 500) | I03-T15, I03-T14, I03-T10 (d) |
| R7 | Mass assignment (`earnedPoints`, `recordedAt`, `uid`) | Strogo tijelo; dokument iz validiranih polja i konstanti | I03-T02; API-T02 tačan skup polja |
| R8 | Path injection kroz `loyaltyUid` (`a/b`, `..`, `__x__`) | Format prije bilo kakvog pristupa bazi | I03-T09 (0 pristupa bazi) |
| R9 | Djelimično stanje (purchase bez notifikacije, bodovi bez ledger-a) | Četiri upisa u jednoj transakciji | I03-T10 (svaki upis + prije commit-a) |
| R10 | Dupli EARN / notifikacija pod paralelnim retry-jem | Čitanje purchase-a u transakciji + `tx.create` + deterministički ID-evi | I03-T11, API-T03, I03-T10 (c) zastarjelo čitanje |
| R11 | Izgubljeno ažuriranje bodova pod paralelnim kupovinama | Čitanje i `update` u istoj transakciji | I03-T12 (zbir i niz `availableAfter`) |
| R12 | Kasni commit poslije 503 → POS retry dodaje bodove drugi put | Idempotency ključ = purchase ID | I03-T13 |
| R13 | Prepisan `occurredAt` pri retry-ju | Postojeći dokument se nikad ne piše | I03-T18 |
| R14 | Novi EARN za nalog u brisanju | O-12 redoslijed; nova kupovina → 404 | I03-T19 |
| R15 | `new Date` tiho prihvata nepostojeće datume; godine 0–99 | Vlastiti parser (5.4) | I03-T07 (a)/(b) |
| R16 | `-0` upisan kao double (krši §8.3 integer) | Normalizacija | I03-T05 |
| R17 | Transakcija pokrenuta poslije isteka roka | Provjera preostalog vremena prije `runTransaction` | I03-T16 |
| R18 | Pod kontencijom emulator vrati `ALREADY_EXISTS` umjesto retry-ja → 500 | Mjerenje u I03-T11; ako se pojavi, Builder STAJE i javlja (ne širi klasifikaciju) | I03-T11 |
| R19 | Rules odstupaju od §31 | Automatsko poređenje sa `.docx` (11.3) | TEST_REPORT |
| R20 | Test-only hook u produkciji | DI kroz `servisi`; nema env zastavica | `git grep` (sekcija 9) |

## 8. Testovi

Svi testovi: `node:test` + `node:assert/strict`, naslovi počinju ID-em. Emulator testovi: `provjeriTestnoOkruzenje()` na vrhu, `beforeEach(ocistiEmulatore)`, `after` → `deleteApp`.
Aplikacija u testu: `napraviAplikaciju({ servisi, verzijaUslova: '1.0', posStanice })`, gdje je `posStanice = procitajPosKljuceve(posKonfiguracija([['SIM01', k1], ['SIM02', k2]])).stanice`
(stvarni parser iz `src/`), ključevi `generisiPosKljuc()` u svakom test fajlu. Svako tijelo greške se provjerava tačno (tri polja, poruka iz kataloga, UUID v4), kao u i02.

Pomoćnici:
- `posKljuc.js`: `generisiPosKljuc()` = `randomBytes(32).toString('base64url')`; `posKonfiguracija(parovi)` = `parovi.map(([s, k]) => `${s}:${k}`).join(',')`.
- `omotacBaze.js`: `omotacBaze(db, opcije)` — `collection`, `doc`, `runTransaction`, `getAll` delegiraju pravom `db` i broje se (`brojPristupa`, `brojTransakcija`);
  `tx` proxy bilježi upise `[{ metod, putanja }]` (`create`/`set`/`update`/`delete`) i opcije: `baciNaUpisu: n` (baca `Error('ubrizgana greška C:\\tajno\\x.js')` na n-tom upisu),
  `baciPrijeCommita`, `sakrijPostojece: [putanja]` (`tx.get`/`tx.getAll` vraćaju „ne postoji”), `zadrziPrijeCommitaMs` (callback završi, pa čeka; izlaže `commitZavrsen` promise),
  `odbijTransakcijuSa` (npr. `{ code: 14 }`). Kontrola u svakom testu: isti omotač bez opcija → očekivan uspjeh (dokaz da omotač ne mijenja ponašanje).
- Postojeći: `napraviKorisnika` (authEmulator), `presretniLog`/`tekstLoga`, `pokreniBackend`/`envProcesa`/`slobodanPort`.
- Priprema naloga: Admin SDK upisuje kanonske `users/{uid}` (ACTIVE) i `loyaltyAccounts/{uid}` (`availablePoints` po testu, `reservedPoints: 3` gdje se provjerava da se ne mijenja).

### 8.1 SRS katalog

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| API-T02 | `emulator/kupovina.test.js` | Nalog sa `availablePoints: 10`, `reservedPoints: 3`. `POST` ključem SIM01, `{ loyaltyUid, posTransactionId: '000184', volumeMl: 42730, amountMinor: 7050, currency: 'EUR', occurredAt: <sada − 1 min, ISO> }` → 201, tijelo tačno po sekciji 6 (`Object.keys`, `earnedPoints: 42`, `purchaseId: 'SIM01__000184'`). `purchases/SIM01__000184` ima TAČNO 9 ključeva §8.3; `uid` = loyaltyUid, `stationId: 'SIM01'`, `earnedPoints: 42` (integer), `occurredAt` je `Timestamp` jednak ulazu (ms), `recordedAt` je `Timestamp` u [prije − 5 s, poslije + 5 s]. `loyaltyAccounts`: `availablePoints: 52`, `reservedPoints: 3`, `updatedAt` = `recordedAt`, `createdAt` nepromijenjen. `loyaltyLedger/earn_SIM01__000184` TAČNO 9 ključeva §11: `type 'EARN'`, `deltaAvailable 42`, `deltaReserved 0`, `availableAfter 52`, `reservedAfter 3`, `purchaseId`, `voucherId null`, `createdAt` = `recordedAt`. `notifications/earn_SIM01__000184` TAČNO 7 ključeva §9.2: `type 'POINTS_EARNED'`, `title`/`body` po 5.7 („… 42 boda.”), `readAt === null`, `relatedPurchaseId`, `createdAt` = `recordedAt`. Ukupno tačno 1 purchase, 1 ledger, 1 notifikacija (cijele kolekcije). Invarijante ≥ 0. |
| API-T03 | isti | Poslije API-T02 scenarija zapamte se svi dokumenti (`data()`); isti zahtjev još 2× → 200, tijelo `deepStrictEqual` tijelu prvog 201; sva četiri dokumenta `deepStrictEqual` zapamćenim (uklj. `updatedAt`, timestamp-ove); broj dokumenata u `purchases`, `loyaltyLedger`, `notifications` nepromijenjen. |
| API-T04 | isti | Poslije prve kupovine, isti `posTransactionId` sa (a) drugim `loyaltyUid` (postojeći ACTIVE nalog B), (b) `volumeMl + 1`, (c) `amountMinor + 1`, (d) — `currency` se ne može razlikovati a da prođe validaciju (whitelist = `EUR`), pa se (d) radi kao konflikt nad dokumentom pripremljenim Admin SDK-om sa `currency: 'USD'` (inače kanonskim) i zahtjevom sa `EUR` → svako 409 `IDEMPOTENCY_CONFLICT`; svi dokumenti `deepStrictEqual` prije/poslije (uklj. nalog B). Validacija: `volumeMl: 0`, `currency: 'BAM'`, `occurredAt: 'nije-vrijeme'` (novi `posTransactionId`) → `INVALID_VOLUME`, `UNSUPPORTED_CURRENCY`, `INVALID_OCCURRED_AT`, ništa upisano. |
| RULE-T08 | `firebase/tests/kupovineObavjestenjaLedger.test.js` | Kupovine A (2) i B (1), kanonske. Vlasnik A: `getDocs(query(purchases, where('uid','==','korisnikA'), limit(20)))` → ALLOW (2 dokumenta); `getDoc` svoje → ALLOW. Vlasnik A: `setDoc` nove kupovine sa `uid: A`, `updateDoc` svoje (`earnedPoints: 999`), `deleteDoc` svoje → DENY; isto za drugog korisnika i neautentifikovanog → DENY. |
| RULE-T10 | isti | Notifikacija A (`readAt: null`). Vlasnik: `getDoc` → ALLOW; `updateDoc({ readAt: serverTimestamp() })` → ALLOW. Na novoj notifikaciji (`readAt: null`): `updateDoc({ title: 'x' })`, `updateDoc({ body: 'x' })` → DENY. |
| RULE-T11 | isti | `loyaltyLedger/earn_X` sa `uid: A`. Konteksti A, B, neautentifikovan: `getDoc`, `getDocs(collection)`, `getDocs(query(where uid == A, limit 20))`, `setDoc` novog, `updateDoc` postojećeg, `deleteDoc` → svako DENY. |

### 8.2 Dopunski testovi I03

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| I03-T01 | (a) `jedinicni/posAutentikacija.test.js`; (b) `emulator/posAutentikacija.test.js` | (a) Bez mreže, 3 stanice: `mock.method(crypto, 'timingSafeEqual')` → broj poziva = 3 za ključ prve, ključ posljednje, nepoznat, prazan i nedostajući ključ; pogodak → `res.locals.stationId` tačan, promašaj → `GreskaApi` `UNAUTHENTICATED_POS`. (b) Ispravno tijelo, omotač broji pristupe: bez zaglavlja; `X-POS-API-Key: <pogrešan>` (validan oblik, nije u mapi); ključ SIM01 sa izmijenjenim jednim znakom; ključ + `x`; prazno zaglavlje; ispravan ključ samo u query-ju (`?X-POS-API-Key=`); samo u `X-Api-Key`; samo u tijelu (`{ ..., "X-POS-API-Key": k }` bez zaglavlja); `Authorization: Bearer <važeći Firebase ID token>`; dva zaglavlja (ispravan + pogrešan) → svako 401 `UNAUTHENTICATED_POS`, 0 pristupa bazi, baza prazna osim pripremljenog naloga. Pozitivno: ključ SIM02 → 201, `purchases/SIM02__<id>.stationId === 'SIM02'`, tijelo `stationId: 'SIM02'`; naziv zaglavlja malim slovima (`x-pos-api-key`) → 201; vrijednost sa okolnim razmacima → 201 (`i03/P-12`). |
| I03-T02 | `emulator/kupovina.test.js` | Ispravno tijelo + po jedno dodatno polje: `stationId: 'SIM02'`, `earnedPoints: 1000`, `recordedAt`, `uid`, `X-POS-API-Key`, `nepoznato`, `__proto__` (sirov JSON), `constructor` → 422 `INVALID_REQUEST`; tijelo `[]`, `null`, `"tekst"`, `5`, `true`, prazno bez Content-Type, `text/plain` → 422 `INVALID_REQUEST`; `loyaltyUid` nedostaje, `null`, `5`, `["uid"]` → 422 `INVALID_REQUEST`. Svako: 0 pristupa bazi, ništa upisano. Redoslijed: `{ nepoznato: 1, volumeMl: 0, ... }` → `INVALID_REQUEST` (ne `INVALID_VOLUME`); `{ loyaltyUid: 5, volumeMl: 0, ... }` → `INVALID_REQUEST`. |
| I03-T03 | (a) `jedinicni/bodovanje.test.js`; (b) `emulator/kupovina.test.js` | (a) `izracunajBodove`: 1→0, 900→0, 999→0, 1000→1, 1999→1, 10 000→10, 10 990→10, 42 730→42, 200 000→200; rezultat `Number.isInteger`. (b) API za 900, 999, 1000, 10 000, 10 990, 200 000 (svaki novi `posTransactionId`): `earnedPoints`, `deltaAvailable`, balance; za 900 (O-4) postoje sva četiri zapisa, `deltaAvailable: 0`, `availableAfter` = prethodno, `updatedAt` pomjeren, body „… 0 bodova.”. |
| I03-T04 | `emulator/kupovina.test.js` | `volumeMl` 1 → 201 (0 bodova), 200000 → 201 (200 bodova); `1000.0` i `1e3` (sirov JSON) → 201, sačuvano `1000` (dokumentovano ponašanje JSON-a); 0, 200001, -1, 1.5, `"1000"`, `null`, `true`, nedostaje → 422 `INVALID_VOLUME`, ništa upisano, 0 pristupa bazi. |
| I03-T05 | isti | `amountMinor` 0 i 1000000 → 201; `-0` (sirov JSON) → 201 i sačuvano `Object.is(v, 0)` (`i03/P-9`); -1, 1000001, 1.5, `"100"`, `null`, nedostaje → 422 `INVALID_AMOUNT`, ništa upisano. |
| I03-T06 | isti | `currency` `"EUR"` → 201; `"eur"`, `"BAM"`, `""`, `" EUR"`, `978`, `null`, nedostaje → 422 `UNSUPPORTED_CURRENCY`, ništa upisano. |
| I03-T07 | (a) `jedinicni/vrijemeKupovine.test.js`; (b) `emulator/kupovina.test.js` | (a) `procitajOccurredAt`: ispravno `2026-10-16T10:00:00Z`, `.5Z` (=500 ms), `.123Z`, `+02:00` (= 08:00Z), `-00:00`, `2024-02-29T…Z`, `0001-01-01T00:00:00Z` (min), `9999-12-31T23:59:59.999Z`; neispravno → `null`: `2026-02-30T00:00:00Z`, `2025-02-29T…`, `2100-02-29T…`, `…T24:00:00Z`, `…T10:60:00Z`, `…T10:00:60Z`, `…T10:00:00` (bez zone), `2026-10-16`, `2026-10-16 10:00:00Z`, `…t…z` (mala slova), `.1234Z`, `+24:00`, `+02:60`, `0001-01-01T00:00:00+00:01` (ispod min), `""`, `1760608800000` (broj), `null`. (b) API: sada, prošlost (2020), +4:30 → 201, sačuvan `Timestamp`, `toMillis()` = očekivano, odgovor `occurredAt` = `new Date(ms).toISOString()`; ulaz `…T12:00:00+02:00` → sačuvano i vraćeno `…T10:00:00.000Z`; +5:01, neispravan string, 30. februar, broj, bez zone, nedostaje → 422 `INVALID_OCCURRED_AT`, ništa upisano. |
| I03-T08 | isti (b) | `posTransactionId` 1 znak, 64 znaka, `"a.b-c_D9"`, `"."` → 201 (`purchases/SIM01__<id>`); 65 znakova, `""`, `"a/b"`, `"a b"`, `"č"`, `"a\n"`, `184` (broj), `null`, nedostaje → 422 `INVALID_TRANSACTION_ID`, ništa upisano, 0 pristupa bazi. |
| I03-T09 | isti | 404 `LOYALTY_ACCOUNT_NOT_FOUND`, ništa upisano: nepostojeći uid; `users` DELETION_IN_PROGRESS + `loyaltyAccounts`; `users` ACTIVE bez `loyaltyAccounts`; `loyaltyAccounts` bez `users`; `users` sa `accountStatus: 'NEPOZNAT'` + `loyaltyAccounts`. Pripremljeni dokumenti `deepStrictEqual` prije/poslije; ukupan broj dokumenata (sve kolekcije) nepromijenjen. Format (0 pristupa bazi, omotač): `"a/b"`, `""`, `"."`, `".."`, `"__x__"`, 129 znakova, usamljen surogat `"\uD800"`. Pozitivno: uid od 128 znakova sa pripremljenim nalogom → 201. |
| I03-T10 | `emulator/kupovinaAtomicnost.test.js` | Nalog `availablePoints: 10`. (a) `baciNaUpisu` 1, 2, 3, 4 (svaki zaseban zahtjev, isti payload) → 500 `INTERNAL_ERROR`, tijelo bez `stack`, `    at `, `ubrizgana`, `C:\`, `tajno`; upisi zabilježeni do n-tog (putanje tačne: purchase, loyaltyAccounts, loyaltyLedger, notifications); `purchases`, `loyaltyLedger`, `notifications` prazni, nalog `deepStrictEqual` početnom. (b) `baciPrijeCommita` (sva četiri upisa zabilježena) → 500, isto stanje. (c) `sakrijPostojece: ['purchases/SIM01__X']` poslije uspješne kupovine (zastarjelo čitanje) → 500 ili 503 (tačno tijelo), dokumenti nepromijenjeni, i dalje 1 EARN i 1 notifikacija. (d) Postojeći purchase pripremljen sa `stationId: 'SIM02'` pod ID-em `SIM01__X` → 500, ništa promijenjeno (O-13). (e) Nekonzistentno stanje: pripremljen samo `notifications/earn_SIM01__Y`, pa zasebno samo `loyaltyLedger/earn_SIM01__Y` → 500, ništa upisano, pripremljeni dokument nepromijenjen. (f) Nalog sa `availablePoints: -1` / `'10'` → 500, ništa upisano (`i03/P-15`). Kontrola: omotač bez opcija → 201 i 4 zapisa. |
| I03-T11 | isti | 10 paralelnih identičnih zahtjeva (`Promise.all`, ista aplikacija), 3 ponavljanja: statusi ⊆ {200, 201, 503}, nijedan 500; ≤ 1 × 201; svaki 503 sa tačnim tijelom `SERVICE_UNAVAILABLE`; sva uspješna tijela `deepStrictEqual`; tačno 1 purchase, 1 ledger, 1 notifikacija; balance = početno + p. Naknadni sekvencijalni retry → 200 i isto tijelo (i jednako uspješnim, ako ih ima). Statusi u `t.diagnostic`. |
| I03-T12 | isti | Početno `availablePoints: 5`, `reservedPoints: 3`; 10 paralelnih različitih kupovina (`volumeMl` 1000·(i+1) + i, p = 1…10). Svaki 503 se ponavlja ISTIM zahtjevom (najviše 20 pokušaja po zahtjevu; preko toga test pada). Kraj: svaki zahtjev ima 201 ili 200; `availablePoints = 5 + 55`; tačno 10 EARN; sortirani po `availableAfter`: prvi = 5 + svoja delta, svaki sljedeći = prethodni + svoja delta, posljednji = 60; `reservedAfter === 3` svuda; `reservedPoints === 3`; 10 notifikacija, 10 purchase-a. Broj 503 u `t.diagnostic`. |
| I03-T13 | isti | Omotač `zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500`: zahtjev → 503 `SERVICE_UNAVAILABLE` (tačno tijelo) u < 12 s; `await commitZavrsen` → sva četiri dokumenta postoje, balance +p. POS retry (pravi `db`) → 200, tijelo jednako očekivanom ugovoru (sekcija 6) izvedenom iz zahtjeva; drugi retry → identično tijelo; tačno 1 EARN, 1 notifikacija, balance +p jednom. Trajanje ~11 s (rok je konstanta, `i03/P-13`). |
| I03-T14 | `emulator/kupovina.test.js` | Isti `posTransactionId: '000184'` sa SIM01 i SIM02 (isti korisnik) → oba 201, `SIM01__000184` i `SIM02__000184` posebni dokumenti, 2 EARN, 2 notifikacije, bodovi zbir. `posTransactionId: 'a__b'` → 201, `purchases/SIM01__a__b`, `earn_SIM01__a__b` u ledger-u i notifikacijama; retry → 200. |
| I03-T15 | (a) `jedinicni/konfiguracija.test.js`; (b) `jedinicni/pokretanjeBackenda.test.js` | (a) `ucitajKonfiguraciju` baca `GreskaKonfiguracije` koja imenuje `POS_API_KLJUCEVI` i NE sadrži vrijednost (ni ključ, ni `stationId`) za: nedostaje; `''`; `SIM01` (bez `:`); `SIM01:` ; `:<ključ>`; `SIM01:<ključ>,` (prazna stavka); razmak u vrijednosti; ključ 42 i 44 znaka; ključ sa `+`/`/`/`=`; nekanonski 43. znak; `'A'.repeat(43)` (manje od 16 različitih); ponovljen ključ za dvije stanice; ponovljen `stationId`; `SIM_01`; `SIM 01`; `SIM/01`; `stationId` od 33 znaka; tačna linija `POS_API_KLJUCEVI=` iz `.env.example` (čita se fajl). Prolazi: jedna i tri stanice; `stationId` `S`, `a.b-C9`, 32 znaka; rezultat sadrži `posStanice` sa tačnim `stationId`-ovima i otiscima, bez sirovog ključa (`JSON.stringify`/`util.inspect` konfiguracije ne sadrži ključ). (b) Spawn `src/pokreni.js` sa ispravnim ostalim env-om i: bez `POS_API_KLJUCEVI`; sa placeholder-om iz `.env.example`; sa ključem kojem fali jedan znak (ključ je inače tajan, sentinel) → izlaz ≠ 0 za < 10 s, stderr imenuje `POS_API_KLJUCEVI`, ne sadrži vrijednost ni `    at `; port nikad nije slušao. |
| I03-T16 | `emulator/rokPrijeTransakcije.test.js` | F1-01. Omotač broji `runTransaction` i sve pristupe. (a) `inicijalizujNalog(omotac, { uid, displayName, acceptedTermsVersion }, rokDo)` i (b) `evidentirajKupovinu(omotac, ulaz, rokDo)` za `rokDo` ∈ { `Date.now() − 1`, `Date.now() − 10_000`, `Date.now()`, `undefined`, `NaN` } → odbija `GreskaApi` sa `kod === 'SERVICE_UNAVAILABLE'` (`KATALOG_GRESAKA[kod].http === 503`), `brojTransakcija === 0`, baza bez novih dokumenata (nalog pripremljen za (b) nepromijenjen). (c) HTTP oblik: `napraviAplikaciju({ ..., dodajRute })` sa test rutom koja poziva svaki servis sa `Date.now() − 1` → 503 tačno tijelo, `brojTransakcija === 0`. Kontrola: isti poziv sa `Date.now() + 10_000` → uspjeh, `brojTransakcija === 1`. |
| I03-T17 | `emulator/logBezPosKljuca.test.js` | (a) In-process, `presretniLog()`, ključevi k1 (SIM01) i k2 (SIM02), sentinel `SENTINEL_POS_…`: ishodi 201, 200, 401 (sentinel u zaglavlju; k1 samo u query-ju; k1 samo u tijelu bez zaglavlja; Bearer), 404 (nepostojeći nalog), 409, 422 (`INVALID_REQUEST` sa k2 kao vrijednošću nepoznatog polja; `INVALID_VOLUME`; neispravan JSON koji sadrži k1), 500 (failure injection), 503 (`odbijTransakcijuSa: { code: 14 }`). Asercije: spojeni log ne sadrži k1, k2, sentinel; nijedan odgovor (tijelo + SVA zaglavlja) ne sadrži k1/k2/sentinel; nijedan odgovor ne sadrži `availablePoints`, `reservedPoints`, `availableAfter`, `stack`, `    at `; log sadrži `correlationId` svakog error odgovora. (b) Spawn `src/pokreni.js` (pravi emulatori, ključevi generisani): 201, 401 (k1 u query-ju), 422 (k1 u tijelu kao nepoznato polje) → stdout+stderr procesa ne sadrže k1/k2. |
| I03-T18 | `emulator/kupovina.test.js` | O-3: prva kupovina sa `occurredAt = T1`; retry istog payload-a sa `T2 ≠ T1` (oba validna) → 200, tijelo = prvo (sa `T1`); `purchases.occurredAt.toMillis() === T1`; dokumenti `deepStrictEqual`; 1 EARN. |
| I03-T19 | isti | O-12: kupovina za nalog A → 201; Admin SDK postavi `users/A.accountStatus = 'DELETION_IN_PROGRESS'`; retry istog payload-a → 200 i prvo tijelo, dokumenti nepromijenjeni; retry sa `volumeMl + 1` → 409; nova kupovina (novi `posTransactionId`) → 404 `LOYALTY_ACCOUNT_NOT_FOUND`, ništa novo (1 purchase, 1 EARN, 1 notifikacija). |
| I03-T20 | `firebase/tests/kupovineObavjestenjaLedger.test.js` | purchases (A kao vlasnik): `where uid == A` bez `limit` → DENY; `limit(21)` → DENY; bez `where` (`limit(20)`) → DENY; `where uid == B` → DENY; `getDoc` kupovine B → DENY; neautentifikovan get/list → DENY. notifications: `where uid == A, limit(50)` → ALLOW; `limit(51)` → DENY; bez `limit` → DENY; drugi `update` readAt (već postavljen) → DENY; `readAt: Timestamp.now()` (klijentsko) → DENY; `readAt` + `title` zajedno → DENY; izmjena `uid` / `type` → DENY; `readAt: null` (null → null) → DENY; `setDoc` nove notifikacije sa `uid: A` → DENY; `deleteDoc` svoje → DENY; B: `getDoc`/`updateDoc(readAt)` notifikacije A → DENY; neautentifikovan get → DENY. |
| I03-T21 | `jedinicni/bodovanje.test.js` | `oblikRijeciBod` za 0, 1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15, 20, 21, 22, 25, 42, 100, 101, 102, 111, 112, 113, 114, 121, 200 → tačno po tabeli 5.7; `tekstObavjestenja(42)` = `{ title: 'Bodovi za kupovinu goriva', body: 'Za kupovinu goriva dobili ste 42 boda.' }`; za 0 i 1 tačni stringovi. |
| I03-T22 | `emulator/posAutentikacija.test.js` | Granice rute: `GET /api/v1/pos/purchases` (sa ispravnim ključem) → 404 `NOT_FOUND`; `POST /api/v1/pos/nepostojeca` bez ključa → 404; `POST /api/v1/pos/purchases` sa neispravnim JSON-om bez ključa → 422 `INVALID_REQUEST`, 0 pristupa bazi (i02/P-6); `napraviAplikaciju` bez `posStanice` → `POST /pos/purchases` 500 `INTERNAL_ERROR` (`i03/P-11`). Plus smoke u `provjera.ps1` (produkcioni start, bez ključa → 401 `UNAUTHENTICATED_POS`). |

### 8.3 Regresija

- I01 i I02 suite bez izmjene asercija. Dozvoljena proširenja ulaza (brief tačka 5):
  - I01-T06: (a) `{}` → dodatna asercija da poruka navodi i `POS_API_KLJUCEVI`; (b), (c), „prazna VERZIJA_USLOVA” → ulaz + `POS_API_KLJUCEVI: <generisan>`; (c) očekivani objekat + `posStanice` (izračunat u testu). Spawn „bez PORT” nepromijenjen.
  - I02-T13 (a) `ISPRAVNO` + `POS_API_KLJUCEVI`; (b) env spawn-a + `POS_API_KLJUCEVI` (da proces pada baš na zaštiti emulator/demo).
  - I02-T11 (`nedostupnostServisa.test.js`): env spawn-a + `POS_API_KLJUCEVI`.
- I01-T10: uklonjen u potpunosti (`describe` i komentar); zamjenjuje ga RULE-T11.
- RULE-T01 … RULE-T07, I02-T15, RULE-T12 (preliminarno): bez izmjene; moraju ostati zeleni nad novim rules fajlom.
- Android: `assembleDebug`, `testDebugUnitTest` kroz `provjera.ps1`; Android kod se ne dira.

### 8.4 Kontrolne mutacije (Builder izvršava lokalno, bez commit-a, svaku pa `git restore`; ishod u TEST_REPORT)

| # | Mutacija | Mora oboriti |
|---|---|---|
| M01 | `stationId` = prva stanica iz mape (umjesto pronađene) | I03-T01 (b) SIM02 |
| M02 | petlja posrednika sa `break`/`return` na pogodak | I03-T01 (a) |
| M03 | `kandidat === stanica.kljuc` bez otiska (i konfiguracija čuva ključ) | I03-T01 (a); I03-T15 (a) (`inspect` sadrži ključ) |
| M04 | provjera ključa čita i `req.query['X-POS-API-Key']` | I03-T01 (b) |
| M05 | uklonjena provjera nepoznatih ključeva tijela | I03-T02 |
| M06 | validacija tijela poslije `tx.get` (u transakciji) | I03-T02 / I03-T04 (pristupi bazi > 0) |
| M07 | `Math.round` umjesto `Math.floor` | I03-T03 (10 990 → 11) |
| M08 | uklonjena gornja granica `volumeMl` | I03-T04 |
| M09 | bez normalizacije `-0` | I03-T05 |
| M10 | `currency.toUpperCase() === 'EUR'` | I03-T06 |
| M11 | parser `Date.parse` umjesto vlastitog | I03-T07 (30. februar, bez zone) |
| M12 | uklonjena granica +5 min | I03-T07 (+5:01) |
| M13 | regex `posTransactionId` bez `$` | I03-T08 (65 znakova) |
| M14 | uklonjena provjera formata `loyaltyUid` | I03-T09 (`a/b` → 500 ili pristup bazi) |
| M15 | provjera naloga bez `loyaltyAccounts` | I03-T09 |
| M16 | notifikacija upisana van transakcije (poslije commit-a) | I03-T10 (a) upis 4 / (b) |
| M17 | `tx.create` purchase → `tx.set` | I03-T10 (c) |
| M18 | uklonjena provjera postojećeg ledger/notifikacije | I03-T10 (e) |
| M19 | uklonjena odbrana O-13 (stationId postojećeg dokumenta) | I03-T10 (d) |
| M20 | `FieldValue.increment(p)` + `availableAfter` iz zastarjelog čitanja van transakcije | I03-T12 (niz `availableAfter`) |
| M21 | poređenje bez `currency` | API-T04 (d) |
| M22 | `occurredAt` uključen u poređenje | I03-T18 |
| M23 | provjera naloga PRIJE čitanja purchase-a (O-12 obrnuto) | I03-T19 |
| M24 | uklonjena provjera isteklog roka u `evidentirajKupovinu` (i, zasebno, u `inicijalizujNalog` = MR02b) | I03-T16 |
| M25 | `zabiljeziGresku` dobija `zaglavlja: req.headers` | I03-T17 |
| M26 | uklonjena provjera „manje od 16 različitih” / ponovljen ključ / O-13 regex | I03-T15 (a) |
| M27 | ledger `availableAfter = dostupno` (prije mutacije) | API-T02 |
| M28 | Rules: `/purchases` `allow list: if ownResource();` (bez limit-a) | I03-T20 |
| M29 | Rules: `/notifications` bez `resource.data.readAt == null` | I03-T20 (drugi update) |
| M30 | Rules: `/loyaltyLedger` `allow read: if signedIn();` | RULE-T11 |
| M31 | Rules: `/notifications` `changedOnly(['readAt', 'title'])` | RULE-T10 |

## 9. Definition of Done

- [ ] Sve iz sekcije 1 implementirano, ništa iz sekcije 2. `git grep -n -E "/rewards/|/vouchers|reconcile|redeem|REWARD_RESERVE|vouchers|rewardRequests|redemptionRequests" -- backend/src` → samo `podaci/kolekcije.js` i `greske/katalogGresaka.js`.
- [ ] `cd backend; npm ci; npm test; npm run test:emu; cd ..` → svi PASS (I01, I02 regresija + I03-T01 (a), T03 (a), T07 (a), T15, T21; API-T02 … T04, I03-T01 (b), T02 … T14, T16 … T19, T22).
- [ ] `cd firebase\tests; npm ci; npm test; cd ..\..` → RULE-T01 … T08, T10, T11, T12 (preliminarno), I02-T15, I03-T20 PASS; I01-T10 ne postoji.
- [ ] I03-T10: 0 novih zapisa i balance nepromijenjen za svaki upis i prije commit-a.
- [ ] I03-T11, I03-T12: bez duplikata, bez 500, tačan zbir i niz `availableAfter`; I03-T11 zelen 3 uzastopna `test:emu` izvršavanja.
- [ ] I03-T17 i I03-T15: ključ nije ni u jednom logu (svi kanali, spawn), odgovoru ni poruci greške; nijedan odgovor nema balance.
- [ ] `firebase/firestore.rules` tekstualno jednak §31 `.docx`-a bez četiri bloka van opsega (11.3, automatsko poređenje kao u i02).
- [ ] Kontrolne mutacije M01 … M31 obaraju ciljane testove (ili je izuzetak obrazložen u TEST_REPORT).
- [ ] `git grep -n -i -E "process\.env\.(NODE_ENV|TEST)|inject|ubriz|mock" -- backend/src` → prazno; nema novih paketa (`git diff main -- '*package*.json'` prazno).
- [ ] `git grep -n -E "[A-Za-z0-9_-]{43}" -- .env.example README.md` ne nalazi važeći ključ (placeholder ne prolazi I03-T15).
- [ ] `.\skripte\provjera.ps1; $LASTEXITCODE` → 0, uključujući smoke 401 `UNAUTHENTICATED_POS`.
- [ ] SRS hash = `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`; `git diff main -- docs/srs` prazno.
- [ ] Nema TODO/FIXME (`provjera.ps1`).
- [ ] `docs/TRACEABILITY.md`, `docs/IMPLEMENTATION_LOG.md` (unos i03, status i03/P-n, ograničenja za buduće iteracije), `docs/TEST_REPORT.md` (stvarni izlaz) ažurirani.
- [ ] Commit-i bez potpisa alata, svaki push-ovan; PR `iteracija-03 → main` otvoren, bez merge-a.
- [ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag `i03` → `git push --tags` (ne radi Builder).

## 10. Traceability (SRS → komponenta → test)

| SRS | Komponenta | Test |
|---|---|---|
| §3.4, NFR-02 | `posrednici/posAutentikacija.js`, `konfiguracija/posKljucevi.js`, `konfiguracija.js`, `rute/kupovine.js` | I03-T01, I03-T15, I03-T22; smoke |
| §1.5 | `servisi/bodovanje.js` | API-T02, I03-T03 |
| §8.1, §8.2, O-13 | `servisi/evidencijaKupovine.js`, `validacija/tijeloKupovine.js`, `konfiguracija/posKljucevi.js` | API-T03, I03-T08, I03-T14, I03-T15, I03-T10 (d) |
| §8.3 – §8.5 | `validacija/tijeloKupovine.js`, `validacija/vrijemeKupovine.js`, `servisi/evidencijaKupovine.js` | API-T02, API-T04, I03-T02 (server-controlled polja u tijelu → 422 INVALID_REQUEST), I03-T04 … I03-T09 |
| §7.1 – §7.3 | `servisi/evidencijaKupovine.js` | API-T02, I03-T03, I03-T12 |
| §9, AC-10 | `servisi/evidencijaKupovine.js`, `servisi/bodovanje.js` | API-T02, I03-T10, I03-T21 |
| §10, NFR-05, AC-03, O-3, O-12 | `servisi/evidencijaKupovine.js` | API-T03, API-T04, I03-T11, I03-T13, I03-T18, I03-T19 |
| §11, AC-09 (EARN) | `servisi/evidencijaKupovine.js` | API-T02, I03-T10, I03-T12; RULE-T11 |
| §21 (kreiranje) | `servisi/evidencijaKupovine.js` | API-T02, RULE-T10 |
| §25.4, §25.5, §25.8, §31, NFR-03 | `firebase/firestore.rules` | RULE-T08, RULE-T10, RULE-T11, I03-T20 |
| §27, O-1 | postojeći katalog i rukovalac | I03-T01 … I03-T10, I03-T16 |
| NFR-04 | `servisi/evidencijaKupovine.js` | I03-T10 |
| NFR-07, §3.4 (log) | `posrednici/posAutentikacija.js`, `konfiguracija/posKljucevi.js`, `dnevnik.js` (N), `.env.example`, `provjera.ps1` | I03-T15, I03-T17 |
| F1-01 (R-02 i02) | `servisi/inicijalizacijaNaloga.js` (N), `servisi/evidencijaKupovine.js` | I03-T16 |

## 11. Tehničke odluke

### 11.1 Paketi

Nema novih paketa ni promjene verzija.

### 11.2 `.env.example` (dopuna) i README

```
# POS ključevi (§3.4, NFR-02): stationId:ključ, više stanica odvojeno zarezom, bez razmaka.
# stationId: ^[A-Za-z0-9.-]{1,32}$ (bez "_"); ključ: base64url od 32 slučajna bajta (43 znaka). Generisanje: README.
# Placeholder ispod NIJE važeći ključ i Backend sa njim NE startuje.
POS_API_KLJUCEVI=SIM01:ZAMIJENI-GENERISANIM-KLJUCEM
```

Komentar „POS ključevi se dodaju tek u Iteraciji 3.” se uklanja. README (PowerShell 5.1, provjereno):

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')
```

`provjera.ps1`: `POS_API_KLJUCEVI` u `$naziviEnv` (vraća se na kraju); u smoke koraku se ključ generiše istom tehnikom i postavlja `SIM01:<ključ>`
(nikad `Write-Host`); treći smoke: `POST /api/v1/pos/purchases` sa ispravnim tijelom bez zaglavlja → 401 `UNAUTHENTICATED_POS`. Fajl ostaje UTF-8 sa BOM-om i CRLF.

### 11.3 `firebase/firestore.rules` (ciljni sadržaj)

Postojeći sadržaj ostaje; blokovi `/purchases/{purchaseId}` i `/loyaltyLedger/{eventId}` se umeću poslije `/loyaltyAccounts/{uid}`, a `/notifications/{notificationId}` poslije njih
(u §31 između stoje `rewardDefinitions` i `vouchers`, koji se dodaju u i04/i05). Tekst blokova doslovno iz `word/document.xml`; uvlačenje i prazni redovi kao u `.docx`; LF; završni prelom.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return signedIn() && request.auth.uid == uid;
    }

    function ownResource() {
      return signedIn()
          && resource.data.uid == request.auth.uid;
    }

    function changedOnly(fields) {
      return request.resource.data
        .diff(resource.data)
        .affectedKeys()
        .hasOnly(fields);
    }

    match /users/{uid} {
      allow get: if isOwner(uid);
      allow list, create, delete: if false;

      allow update: if isOwner(uid)
                    && changedOnly(['displayName', 'updatedAt'])
                    && request.resource.data.displayName is string
                    && request.resource.data.displayName.size() >= 1
                    && request.resource.data.displayName.size() <= 100
                    && request.resource.data.updatedAt == request.time;
    }

    match /loyaltyAccounts/{uid} {
      allow get: if isOwner(uid);
      allow list, create, update, delete: if false;
    }

    match /purchases/{purchaseId} {
      allow get: if ownResource();
      allow list: if ownResource()
                  && request.query.limit != null
                  && request.query.limit <= 20;
      allow create, update, delete: if false;
    }

    match /loyaltyLedger/{eventId} {
      allow read, write: if false;
    }

    match /notifications/{notificationId} {
      allow get: if ownResource();
      allow list: if ownResource()
                  && request.query.limit != null
                  && request.query.limit <= 50;
      allow create, delete: if false;
      allow update: if ownResource()
                    && changedOnly(['readAt'])
                    && resource.data.readAt == null
                    && request.resource.data.readAt is timestamp
                    && request.resource.data.readAt == request.time;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Automatsko poređenje (kao i02, privremena skripta van repoa): izvući §31 iz `word/document.xml` (`w:br` i `w:p` → `\n`, `w:t` tekst, HTML entiteti),
ukloniti blokove `rewardDefinitions`, `vouchers`, `rewardRequests`, `redemptionRequests` zajedno sa praznim redom ispred svakog, normalizovati CRLF → LF,
uporediti sa `firebase/firestore.rules` → očekivano `JEDNAKO_DOCX`; dodatno `diff` sa ovim blokom → `IDENTICNO_PLANU`. Izlaz u TEST_REPORT; Reviewer ponavlja.

### 11.4 Ostalo

- `res.locals.rokDo` i `res.locals.stationId` postavlja samo POS posrednik; ruta ne računa sopstveni rok.
- Odgovor uspjeha se pravi eksplicitno (`odgovorKupovine`), nikad `snap.data()` direktno.
- README sekcija „API”: API-02 (zaglavlje, ulaz, formati iz 5.3/5.4, 201/200, kodovi grešaka u opsegu); bez primjera sa važećim ključem.

## 12. Ručni koraci za Anu

- Za ručno `npm start`: `Copy-Item .env.example .env`, pa u `.env` zamijeniti placeholder ključem generisanim komandom iz README-a. Bez toga Backend namjerno ne startuje.
- Ako `gh auth status` kaže da nije prijavljena, prije PR koraka kucati `! gh auth login`.

Ograničenja za buduće iteracije (Builder upisuje u IMPLEMENTATION_LOG):
- **i04–i06 (`i03/P-7`):** ledger `eventId` je `<tip>_<id>` sa prefiksima bez `_`: `earn_{purchaseId}` (i03); prijedlog `reserve_{voucherId}`, `redeem_{voucherId}`,
  `release_{voucherId}` — odluka pripada tim iteracijama, ali prefiks `earn_` je zauzet.
- **i06:** isti `napraviProvjeruPosKljuca(posStanice)` se veže na rutu redeem; mapa i rok se ne dupliraju.
- **i07 (O-10a):** postojeći purchase sa `uid: null` i retry sa `loyaltyUid` → po i03 kodu daje 409 (poređenje `uid`); i07 odlučuje i mijenja.
- **i10:** Android upit `purchases`/`notifications` mora imati `where('uid', '==', auth.uid)` i `limit ≤ 20 / ≤ 50`; `orderBy` traži composite indeks (i10).

## 13. Otvorena pitanja za Orchestrator-a

Nijedno nije SRS kontradikcija koja blokira plan; sva su odluke koje brief izričito prepušta Planner-u (prijedlog + odobrenje).

**i03/P-1 (odobrenje traži brief): ugovor odgovora API-02.**
Prijedlog u sekciji 6: 201 prvi put, 200 za retry; tijelo `{ purchaseId, stationId, posTransactionId, volumeMl, amountMinor, currency, earnedPoints, occurredAt }` iz sačuvanog
dokumenta, bez `uid`-a, balance-a i `recordedAt`. Alternativa: `{ purchaseId, earnedPoints }`.

**i03/P-2 (odobrenje traži brief): konfiguracija POS ključeva.**
`POS_API_KLJUCEVI=stationId:ključ[,…]`, bez razmaka; ključ tačno kanonski base64url od 32 bajta (43 znaka, 256 bita). Dodatno pravilo „najmanje 16 različitih znakova” odbija
očigledne placeholder-e (heuristika, ne mjera entropije; lažno odbijanje slučajnog ključa praktično nemoguće). Alternativa: bez heuristike (samo format). Preporuka: sa heuristikom.

**i03/P-3 (odobrenje traži brief): tehnika konstantnog vremena.**
SHA-256 kandidata i ključeva + `crypto.timingSafeEqual` nad 32 bajta, petlja kroz sve stanice bez ranog izlaska, odluka poslije petlje (5.2); test broji pozive (I03-T01 (a)).

**i03/P-4 (odobrenje traži brief): format `occurredAt`.**
RFC 3339 sa obaveznim `Z` ili `±hh:mm`, veliko `T`/`Z`, 0–3 decimale, vlastita kalendarska provjera, opseg Firestore `Timestamp`-a; čuva se `Timestamp.fromMillis`, vraća `toISOString()`.
Mala slova `t`/`z` (dozvoljena u RFC 3339) se odbijaju — strože, dokumentovano. Donja granica (godina 0001) nije poslovno pravilo nego tehnički opseg; SRS ne daje donju granicu, pa se ne izmišlja.

**i03/P-5 (odobrenje traži brief): format `loyaltyUid`.**
Prihvaćena preporuka brief-a: string, `isWellFormed`, 1–128 UTF-16 jedinica, bez `/`, nije `.`/`..`, ne `^__.*__$`. Neispravan format → 404 bez pristupa bazi.

**i03/P-6 (odobrenje traži brief): poredak provjera polja.**
Tabela 5.3: objekat → nepoznati ključevi → `loyaltyUid` tip → `posTransactionId` → `volumeMl` → `amountMinor` → `currency` → `occurredAt` → format `loyaltyUid` (404) → transakcija.

**i03/P-7 (odobrenje traži brief): ledger eventId.**
`earn_{purchaseId}` (isti oblik kao notification ID, druga kolekcija — nema sudara). Jedinstvenost prema budućim tipovima: prefiks bez `_` prije prvog `_` jednoznačno određuje tip;
budući tipovi koriste druge prefikse (sekcija 12). Jedan purchase ima tačno jedan EARN (refund/reversal je van opsega, §1.3), pa je ID po purchase-u dovoljan.

**i03/P-8 (odobrenje traži brief): tekst notifikacije.**
`title: "Bodovi za kupovinu goriva"`, `body: "Za kupovinu goriva dobili ste {p} {bod|boda|bodova}."`, pravilo i tabela u 5.7.

**i03/P-9: normalizacija `-0`.**
JSON `-0` je validan integer po `Number.isInteger`, ali bi ga Firestore upisao kao double. Prijedlog: normalizovati u `0` (ne odbijati — SRS dozvoljava 0 za `amountMinor`).
`volumeMl` `-0` je 0 → `INVALID_VOLUME` u svakom slučaju.

**i03/P-10 (informativno): oznake testova.** I03-T01 … I03-T20 kao u brief-u; dodati I03-T21 (tekst i oblici riječi „bod”) i I03-T22 (granice POS rute). Proširenja SRS testova ostaju pod SRS oznakom.

**i03/P-11: aplikacija bez `posStanice`.** Prijedlog: `POST /pos/purchases` → 500 `INTERNAL_ERROR` (fail closed, kao i02 bez `servisi`), ne 401 — pogrešna konfiguracija ne smije izgledati kao klijentska greška.

**i03/P-12 (informativno): „vrijednost se poredi tačno”.**
Node HTTP parser po HTTP specifikaciji uklanja okolni whitespace (OWS) vrijednosti zaglavlja prije nego što je aplikacija vidi, pa `X-POS-API-Key:  <ključ>  ` prolazi.
Unutrašnji znakovi se porede tačno; duplo zaglavlje (`"a, b"`) je 401. I03-T01 fiksira oba ponašanja.

**i03/P-13 (informativno): trajanje I03-T13.** Rok je konstanta (i02/P-5), pa test kasnog commit-a traje ~11 s. Rok se NE pravi parametrom aplikacije (bio bi test knob).

**i03/P-14 (informativno): poređenje Rules sa `.docx`.** Kao u i02: privremena skripta (Python iz sistema ili Node), izlaz u TEST_REPORT; ne postaje dio `provjera.ps1` (brief to ne traži).

**i03/P-15: neispravan `loyaltyAccounts` dokument.** Ako `availablePoints`/`reservedPoints` nisu nenegativni cijeli brojevi → 500, ništa upisano (invarijanta §7.2 se ne „popravlja”).

## 14. IMPLEMENTATION PLAN za Builder-a

Opšte: poslije svakog commit-a odmah `git push`. Commit poruke na srpskom, bez potpisa alata. Prije commit-a `git status` sadrži samo fajlove tog koraka. Testovi prvi (crveni), pa kod.
Svaki commit ima zelen `npm test`; emulator testovi zeleni najkasnije na commit-u koraka u kojem su dodati. Nijedan novi paket.

**Korak 1: Security Rules (RULE-T08, RULE-T10, RULE-T11, I03-T20; I01-T10 uklonjen)**
- Fajlovi: `firebase/tests/kupovineObavjestenjaLedger.test.js` [D], `firebase/tests/podrazumijevanaZabrana.test.js` [I], `firebase/firestore.rules` [I].
- Dokaz: `cd firebase\tests; npm ci; npm test` → svi PASS (prije izmjene rules: RULE-T08/T10 ALLOW slučajevi padaju); poređenje sa `.docx` (11.3) → `JEDNAKO_DOCX`.
- Commit: `i03: Security Rules za purchases, loyaltyLedger i notifications doslovno po §31 (RULE-T08, T10, T11)`

**Korak 2: Konfiguracija POS ključeva (I03-T15; I01-T06, I02-T13 proširenje ulaza)**
- Fajlovi: `backend/test/pomocnici/posKljuc.js` [D], `backend/test/jedinicni/konfiguracija.test.js` [I], `backend/test/jedinicni/pokretanjeBackenda.test.js` [I],
  `backend/test/emulator/nedostupnostServisa.test.js` [I] (samo env), `backend/src/konfiguracija/posKljucevi.js` [D], `backend/src/konfiguracija/konfiguracija.js` [I], `.env.example` [I].
- Šta: 5.6, 11.2. `pokreni.js` u ovom koraku još ne prosljeđuje `posStanice` (ruta ne postoji).
- Dokaz: `npm test` PASS; `npm run test:emu` (I02-T11 i dalje PASS sa novim env-om).
- Commit: `i03: POS ključevi iz konfiguracije sa provjerom formata i jedinstvenosti (I03-T15)`

**Korak 3: Bodovanje, tekst notifikacije i parser occurredAt (I03-T03 a, I03-T07 a, I03-T21)**
- Fajlovi: `backend/test/jedinicni/bodovanje.test.js` [D], `backend/test/jedinicni/vrijemeKupovine.test.js` [D], `backend/src/servisi/bodovanje.js` [D], `backend/src/validacija/vrijemeKupovine.js` [D].
- Dokaz: `npm test` PASS.
- Commit: `i03: obračun bodova po §1.5, tekst notifikacije i strogo čitanje occurredAt`

**Korak 4: POS posrednik i ruta sa validacijom (I03-T01, I03-T02, I03-T04 … I03-T09 dio bez baze, I03-T22)**
- Fajlovi: `backend/test/pomocnici/omotacBaze.js` [D], `backend/test/jedinicni/posAutentikacija.test.js` [D], `backend/test/emulator/posAutentikacija.test.js` [D],
  `backend/src/posrednici/posAutentikacija.js` [D], `backend/src/validacija/tijeloKupovine.js` [D], `backend/src/rute/kupovine.js` [D], `backend/src/aplikacija.js` [I], `backend/src/pokreni.js` [I].
- Šta: 5.1, 5.2, 5.3, 5.8. Ruta poziva servis iz koraka 5 — ako bi test bio crven na commit-u, koraci 4 i 5 se spajaju u jedan commit (Builder bira; svaki commit zelen).
- Dokaz: `npm test`, `npm run test:emu` PASS.
- Commit: `i03: POS autentikacija X-POS-API-Key i stroga validacija tijela kupovine (I03-T01, I03-T02)`

**Korak 5: Transakcija kupovine (API-T02 … API-T04, I03-T03 b … I03-T14, I03-T18, I03-T19)**
- Fajlovi: `backend/test/emulator/kupovina.test.js` [D], `backend/test/emulator/kupovinaAtomicnost.test.js` [D], `backend/src/servisi/evidencijaKupovine.js` [D], `backend/src/rute/kupovine.js` [I].
- Šta: 5.5, sekcija 6 (po odobrenom `i03/P-1`).
- Dokaz: `npm run test:emu` PASS; I03-T11 i I03-T12 zeleni u 3 uzastopna izvršavanja (izlaz u TEST_REPORT, broj 503 iz `t.diagnostic`).
- Commit: `i03: POST /pos/purchases u jednoj Firestore transakciji sa EARN i notifikacijom, idempotentno (API-T02–T04)`

**Korak 6: Rok prije transakcije i log bez ključa (I03-T16, I03-T17)**
- Fajlovi: `backend/test/emulator/rokPrijeTransakcije.test.js` [D], `backend/test/emulator/logBezPosKljuca.test.js` [D].
- Šta: samo testovi (kod već postoji); MR02b i M24 moraju biti ubijene.
- Dokaz: `npm run test:emu` PASS.
- Commit: `i03: testovi isteklog roka prije transakcije (F1-01) i loga bez POS ključa (I03-T16, I03-T17)`

**Korak 7: provjera.ps1 i README**
- Fajlovi: `skripte/provjera.ps1` [I] (UTF-8 BOM, CRLF), `README.md` [I].
- Dokaz: `.\skripte\provjera.ps1; $LASTEXITCODE` → 0, dva puta zaredom.
- Commit: `i03: provjera.ps1 sa POS ključem iz izvršavanja i smoke 401 za /pos/purchases; README`

**Korak 8: Kontrolne mutacije (bez commit-a koda)** — M01 … M31 i MR02b, svaka lokalno pa `git restore`; ishod (komanda, ciljani test, exit) u TEST_REPORT.

**Korak 9: Dokumentacija checkpoint-a**
- Fajlovi: `docs/TEST_REPORT.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/TRACEABILITY.md` [I].
- TEST_REPORT: stvarni izlaz komandi iz brief-a (tačka 8), rezultat po ID-u, mutacije, poređenje rules sa `.docx`, inspekcije iz sekcije 9.
  IMPLEMENTATION_LOG: CHANGELOG i03, fajlovi, odstupanja, status `i03/P-n`, ograničenja za buduće iteracije (sekcija 12), poznata ograničenja (`i03/P-12`, `i03/P-13`, JSON `1e3`).
  TRACEABILITY: samo redovi Iteracije 3; red §8.3 – §8.5: „I03 stationId/earnedPoints iz body-ja ignorisani” → „I03-T02 server-controlled polja u tijelu → 422 INVALID_REQUEST”.
- Dokaz: `git diff main -- docs/srs` prazno; hash odgovara.
- Commit: `i03: TEST_REPORT, IMPLEMENTATION_LOG i sljedivost za iteraciju 3`

**Korak 10: Pull request**
- `gh pr create --base main --head iteracija-03 --title "i03: Purchase / EARN"`, opis na srpskom (isporuka A–G, brief tačka 9), bez potpisa alata. BEZ merge-a i BEZ taga.

## 15. Odluke Orchestrator-a (odobrenje plana)

Plan je ODOBREN (Orchestrator, 2026-10-16) uz ispravke K-1 i K-2 ispod. Ana je odluke O-12 i O-13 donijela 2026-10-16 (brief, tačka 5).

i03/P-1  Odobreno: 201 za prvi zahtjev, 200 za retry; tijelo TAČNO { purchaseId, stationId, posTransactionId, volumeMl, amountMinor,
         currency, earnedPoints, occurredAt } tim redoslijedom ključeva, iz sačuvanog dokumenta; occurredAt = toISOString() sačuvanog
         Timestamp-a; bez uid-a, balance-a, recordedAt-a, ID-eva ledger eventa/notifikacije i ključa.
i03/P-2  Odobreno: POS_API_KLJUCEVI=stationId:ključ[,…], bez razmaka; ključ kanonski base64url od 32 bajta (43 znaka);
         heuristika "najmanje 16 različitih znakova" ostaje; provjere i poruke tačno po 5.6.
i03/P-3  Odobreno: SHA-256 + crypto.timingSafeEqual nad 32 bajta, petlja kroz sve stanice bez ranog izlaska, odluka poslije petlje;
         konfiguracija čuva samo otiske, nikad sirov ključ.
i03/P-4  Odobreno po 5.4 (RFC 3339, obavezna zona, veliko T/Z, 0–3 decimale, vlastita kalendarska provjera, opseg Timestamp-a).
i03/P-5  Odobreno po 5.3 (string, isWellFormed, 1–128 UTF-16 jedinica, bez "/", nije "."/"..", ne ^__.*__$).
i03/P-6  Odobreno po tabeli 5.3. Dopuna (obavezujuća): validacija ulaza, uključujući format loyaltyUid, UVIJEK prethodi provjeri
         idempotentnosti — i kad purchase već postoji. Retry sa neispravnim poljem dobija kod tog polja (npr. occurredAt > +5 min →
         422 INVALID_OCCURRED_AT; neispravan format loyaltyUid → 404 LOYALTY_ACCOUNT_NOT_FOUND), a ne prvi rezultat ni 409.
         Upisati u README i IMPLEMENTATION_LOG; I03-T18 dopuniti sa ta dva slučaja nad postojećom kupovinom (dokumenti
         deepStrictEqual prije/poslije, 0 pristupa bazi).
i03/P-7  Odobreno: loyaltyLedger/earn_{purchaseId}. Prefiksi reserve_/redeem_/release_ za i04–i06 su samo prijedlog i ne obavezuju te iteracije.
i03/P-8  Odobreno: title "Bodovi za kupovinu goriva"; body "Za kupovinu goriva dobili ste {p} {bod|boda|bodova}." po pravilu 5.7.
i03/P-9  Odobreno: -0 → 0 za volumeMl i amountMinor.
i03/P-10 Prihvaćene oznake I03-T01 … I03-T22.
i03/P-11 Odobreno: aplikacija bez posStanice → POST /pos/purchases 500 INTERNAL_ERROR (fail closed).
i03/P-12 Prihvaćeno: okolni whitespace uklanja HTTP parser; unutrašnji znakovi se porede tačno; duplo zaglavlje → 401.
i03/P-13 Prihvaćeno: rok ostaje konstanta; I03-T13 traje ~11 s.
i03/P-14 Prihvaćeno: poređenje Rules sa .docx privremenom skriptom van repoa; komanda i stvarni izlaz u TEST_REPORT.
i03/P-15 Odobreno: neispravan loyaltyAccounts (vrijednost nije nenegativan siguran cijeli broj) → 500, ništa upisano.

Ispravke plana (obavezujuće):
K-1 I03-T10 (c) ne obara M17: kad su ledger event i notifikacija vidljivi, transakcija pada na provjeri nekonzistentnog stanja prije
    upisa, a kad bi bili sakriveni, tx.create ledger-a bi oborio cijeli commit — pa tx.set za purchase tu ne pravi štetu.
    Dodaje se I03-T10 (c2): Admin SDK pripremi SAMO purchases/SIM01__Z (kanonski, bez ledger eventa i notifikacije), omotač ga
    sakrije pri čitanju (sakrijPostojece) → očekivano 500 INTERNAL_ERROR bez stack-a, purchase dokument deepStrictEqual pripremljenom,
    0 ledger događaja, 0 notifikacija, balance nepromijenjen. M17 MORA oboriti (c2).
K-2 provjera.ps1 ne smije biti crven između koraka 2 i 7. U koraku 2 se u skripte/provjera.ps1 dodaje POS_API_KLJUCEVI u $naziviEnv
    i generisanje ključa (tehnika iz 11.2, bez ispisa) za postojeći smoke start; dokaz koraka 2 dopunjen sa
    `.\skripte\provjera.ps1; $LASTEXITCODE` → 0. Korak 7 dodaje novi smoke 401 UNAUTHENTICATED_POS i README. Fajl ostaje UTF-8 sa BOM-om i CRLF.
