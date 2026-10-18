# i04 — Plan (PLANNER)

Iteracija 4: Reward issue. Grana `iteracija-04`.
Izvori: `CLAUDE.md`, `docs/iteracije/i04_brief.md` (obavezujući, posebno tačka 5), `docs/ODLUKE.md`, SRS 3.1
(`docs/srs/FuelPoints_SRS_3_1.docx`, normativan; `.md` čitljiva kopija; §31 iz `.docx`-a), `docs/TRACEABILITY.md`,
`docs/IMPLEMENTATION_LOG.md` (i03: „Ograničenja za buduće iteracije”, „Poznata ograničenja”), `docs/TEST_REPORT.md` (i03),
`docs/iteracije/i03_plan.md`, `i03_review.md`, `i03_review_fix1.md`, kod na vrhu grane (`8f08a06`).
Datum plana: 2026-10-17. Uloga: PLANNER (bez koda).

Oznake otvorenih pitanja su `i04/P-n` (sekcija 13). Probe su rađene privremenim skriptama van repoa (scratchpad sesije) i nisu commit-ovane;
ishod je upisan u sekciju 3.

---

## 1. SRS zahtjevi u opsegu

| SRS / odluka | Šta se u i04 radi | Napomena |
|---|---|---|
| §26 API-03, §3.3, NFR-01 | `POST /api/v1/rewards/:rewardId/issue`; postojeći posrednik `napraviProvjeruTokena(servisi.auth)` vezan SAMO na tu rutu. UID isključivo iz `res.locals.uid`; rok 10 s od ulaska u posrednik (`res.locals.rokDo`). Bez/neispravan token → 401 `UNAUTHENTICATED`, 0 pristupa bazi. | 5.2 |
| §13, O-15, O-1 | Tijelo: običan JSON objekat sa TAČNO jednim ključem `requestId`; `requestId` mora odgovarati `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (bez zastavica). Sve ostalo → 422 `INVALID_REQUEST`, 0 pristupa bazi. Backend sam određuje UID, cost, voucherId, status i timestamp-ove. | 5.3 |
| §12, §13.1, D-4 | `rewardId` iz putanje: provjera formata bez baze (5.4) → 404 `REWARD_NOT_FOUND`; u transakciji `rewardDefinitions/{rewardId}`: ne postoji → 404; neispravna definicija → 500; `active == false` → 409 `REWARD_INACTIVE`; `costPoints` iz definicije, kopija na voucher (snapshot). | 5.4, 5.5 |
| §13.1, AUTH-03 … AUTH-05, §27 | Stanje naloga u transakciji: `ACCOUNT_NOT_INITIALIZED` 409, `ACCOUNT_DELETION_IN_PROGRESS` 409, nepoznat `accountStatus` / neispravan `loyaltyAccounts` → 500; ništa upisano (ni reconcile). | 5.5 korak T3 |
| §13.1, §18, §18.1, D-1, O-14 | Interni reconcile u ISTOJ transakciji, poslije provjera naloga i nagrade, prije provjere bodova: svaki ACTIVE voucher korisnika sa `sadaMs ≥ expiresAt` → EXPIRED (mijenja se SAMO `status`), `reservedPoints −= costPoints` (sa voucher-a), `availablePoints += costPoints`, `REWARD_RELEASE`. Kad poslije reconcile-a nema dovoljno bodova: release-i se commit-uju, odgovor 409 `INSUFFICIENT_POINTS`. | 5.5, 5.6 |
| §13.2, §7.4, §7.2 | JEDNA transakcija: `availablePoints −= cost`, `reservedPoints += cost`, `updatedAt`; ACTIVE voucher; `REWARD_RESERVE`; `rewardRequests` mapping. Invarijante ≥ 0 poslije svakog događaja. | 5.5 |
| §14, O-16, i03/P-6 | `rewardRequests/{requestKey}`, `requestKey` = SHA-256 hex (mala slova) nad UTF-8 `uid + ":" + requestId` (`i04/P-4`); schema TAČNO `{ uid, requestId, rewardId, voucherId, createdAt }`. Mapping se čita PRVI u transakciji (O-16): isti `rewardId` → isti voucher, ništa upisano (200); drugi `rewardId` → 409 `IDEMPOTENCY_CONFLICT`. Validacija ulaza uvijek prije. Neuspješan issue ne pravi mapping. | 5.5 korak T1–T2 |
| §15 | `voucherId` = `crypto.randomBytes(32).toString('hex')` (256 bita, 64 znaka `[0-9a-f]`) (`i04/P-3`). Voucher TAČNO `{ uid, rewardId, costPoints, status: "ACTIVE", issuedAt, expiresAt, redeemedAt: null, cancelledAt: null, redeemedAtStationId: null }`, bez `requestId`. | 5.7 |
| §17, §1.4 | `issuedAt = Timestamp.fromMillis(sadaMs)`, `expiresAt = Timestamp.fromMillis(sadaMs + 900 000)`; `sadaMs` = jedno čitanje sata Backend-a po pokušaju transakcije; reconcile poredi isti `sadaMs` (`i04/P-2`). | 5.7 |
| §11, §7.4, §7.6, i03/P-7 | `loyaltyLedger/reserve_{voucherId}` (REWARD_RESERVE) i `loyaltyLedger/release_{voucherId}` (REWARD_RELEASE), samo `tx.create`, TAČNO 9 polja §11; uzastopan, deterministički lanac `availableAfter`/`reservedAfter` (`i04/P-5`, `i04/P-6`). | 5.6 |
| §25.6, §25.7, §25.9, §31, D-2 | `firebase/firestore.rules`: blokovi `/rewardDefinitions/{rewardId}`, `/vouchers/{voucherId}`, `/rewardRequests/{requestKey}` doslovno iz §31 `.docx`-a, na mjestima kao u §31 (11.3). `/redemptionRequests` ostaje za i06. | RULE-T09, I04-T17 |
| D-5 | Neispravno percent-kodiran parametar putanje (Express 5 `URIError`, `status 400`) → 404 `NOT_FOUND` u centralnom rukovaocu, bez stack-a i bez sirove vrijednosti u logu i odgovoru; globalno (`i04/P-8`). | 5.8 |
| §27, O-1 | Kodovi: `UNAUTHENTICATED`, `ACCOUNT_NOT_INITIALIZED`, `ACCOUNT_DELETION_IN_PROGRESS`, `REWARD_NOT_FOUND`, `REWARD_INACTIVE`, `INSUFFICIENT_POINTS`, `IDEMPOTENCY_CONFLICT`, `INVALID_REQUEST`, `NOT_FOUND`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. | Katalog se ne mijenja (svi kodovi postoje). |
| NFR-04, NFR-05, NFR-06, AC-05, AC-06, AC-08 (i04 dio), AC-09 (RESERVE, RELEASE) | Failure injection na svakom upisu i prije commit-a; idempotentnost i kasni commit poslije 503; double-spend pod paralelnim zahtjevima; release najviše jednom. | Sekcija 8 |
| F1-01 (backlog i03) | Ispravka tri oštećene putanje `firebase<TAB>ests` → `firebase\tests` u `docs/TEST_REPORT.md` (linije 1774, 1776, 1783). | Dokumentacioni korak |

## 2. SRS zahtjevi van opsega

| SRS | Iteracija | Zašto nije sada |
|---|---|---|
| §26 API-04 redeem, API-05 cancel, API-06 reconcile endpoint, API-07 delete; §7.5 REDEEM; §19; §20; prelazi u CANCELLED i REDEEMED | 5, 6, 7 | Brief tačka 3. Nijedna ruta osim API-03 se ne dodaje. |
| §31 blok `/redemptionRequests/{requestKey}`; konačan RULE-T12 (12/12) | 6, 8 (D-2) | Default deny ga i dalje pokriva; RULE-T12 (preliminarno) ostaje zelen. |
| `FORBIDDEN` | — | Nije potreban u i04 (UID iz token-a određuje sve dokumente). |
| Notifikacije za issue/release/istek | nikad | §9.2 poznaje samo `POINTS_EARNED`. |
| Upis u `rewardDefinitions` iz Backend-a (osim i01 seed-a); admin funkcije | nikad | §1.3. |
| Ograničenje broja aktivnih voucher-a po korisniku | nikad | SRS ga ne traži. |
| Android (Rewards ekran, reward QR, countdown, reconcile na Home-u), composite indeksi za Android upite | 9, 10 | Brief tačka 3. |
| POS Simulator | 11 | — |
| Izmjena ugovora i ponašanja API-01 i API-02 | — | Samo refaktor provjere formata ID-a bez promjene ponašanja (`i04/P-9`), dokazan regresijom I03-T09. |
| FCM; §1.3 stavke | nikad | — |

## 3. Zatečeno stanje repozitorijuma

Provjereno 2026-10-17 (čitanje koda u repou; komande i probe ispod):

- `git fetch`, `git switch iteracija-04`, `git pull --ff-only` → „Already up to date”. Vrh grane `8f08a06 i04: Iteration Brief (Orchestrator) i registar odluka`;
  `main` = `origin/main` = tag `i03` (anotiran) = `43e604a` (merge PR #3). `git log main..iteracija-04` = samo `8f08a06`. Radno stablo čisto.
  `docs/iteracije/i04_brief.md` i `docs/ODLUKE.md` postoje.
- Backend: `aplikacija.js` (`napraviAplikaciju({ servisi, verzijaUslova, posStanice, dodajRute })`, globalni `parsirajJson` PRIJE rutera `/api/v1`),
  `posrednici/autentikacija.js` (`napraviProvjeruTokena(auth)` → `res.locals.uid`, `res.locals.rokDo`), `servisi/evidencijaKupovine.js` (obrazac transakcije i03),
  `greske/obradaGresaka.js` (`odrediKod`: sve što nije `GreskaApi` → `INTERNAL_ERROR`; stack u log samo za ≥ 500; `putanjaZaLog` = `req.route.path` ili `(nepoznata ruta)`, D-3),
  `greske/greskeServisa.js` (`saRokom`, `jeNedostupnostFirestore` 14/4/10), `validacija/tijeloKupovine.js` (privatna `jeIspravanFormatUid`, i03/P-5 + zastavica `s`),
  `podaci/kolekcije.js` (već sadrži `rewardDefinitions`, `vouchers`, `rewardRequests`), `punjenje/rewardDefinitions.js` (CAR_WASH 50, SHOWER 30, `active: true`).
  `crypto` kao default import koristi samo `posAutentikacija.js`; `randomUUID` koriste `korelacija.js` i `firebase/inicijalizacija.js`.
- Katalog grešaka već ima sve kodove u opsegu (`REWARD_NOT_FOUND`, `REWARD_INACTIVE`, `INSUFFICIENT_POINTS`, `ACCOUNT_NOT_INITIALIZED`, …); ne mijenja se.
- `firebase/firestore.rules` = helper funkcije + users, loyaltyAccounts, purchases, loyaltyLedger, notifications + default deny. `firebase/firestore.indexes.json` = `{"indexes": [], "fieldOverrides": []}`.
  `firebase/tests/podrazumijevanaZabrana.test.js` sadrži RULE-T12 (preliminarno) za `rewardRequests`, `redemptionRequests` i nepoznatu kolekciju.
- Test pomoćnici: `omotacBaze.js` (opcije `baciNaUpisu`, `baciPrijeCommita`, `sakrijPostojece`, `zadrziPrijeCommitaMs`, `odbijTransakcijuSa`; `upisi`,
  `brojPristupa`, `brojTransakcija`, `commitZavrsen`, `sveTransakcijeZavrsene`). Proxy `tx.get` sakriva samo rezultate koji imaju `ref` (snimak dokumenta) —
  rezultat upita (`QuerySnapshot`, nema `ref`) prolazi nepromijenjen. `procesBackenda.js` (`pokreniBackend`, `envProcesa`, `slobodanPort`), `presretanjeLoga.js`
  (svi kanali), `authEmulator.js` (`napraviKorisnika`), `emulator.js`.
- `skripte/provjera.ps1`: UTF-8 sa BOM-om, CRLF; smoke korak sa tri provjere (404 `NOT_FOUND`, 401 `UNAUTHENTICATED` na `/account/init`, 401 `UNAUTHENTICATED_POS`).
- §31 izvučen iz `word/document.xml` normativnog `.docx`-a (`tar.exe -xf … word/document.xml`, paragrafi `w:p` → `\n`, `w:br` → `\n`, HTML entiteti):
  tekst blokova `rewardDefinitions`, `vouchers`, `rewardRequests` u 11.3.

Probe (privremene skripte van repoa; Node `v24.21.0`, Express `5.2.1`, firebase-admin `14.5.0`, emulator `demo-fuelpoints` kroz
`npx firebase emulators:exec --only firestore,auth`, JBR prvi u PATH-u):

| # | Proba | Stvaran ishod |
|---|---|---|
| E1 | `POST /api/v1/rewards/%E0%A4%A/issue` nad `napraviAplikaciju({ dodajRute })` sa test rutom `/rewards/:rewardId/issue` | **500 `INTERNAL_ERROR`**; log `putanja: "(nepoznata ruta)"` i `stack: "URIError: Failed to decode param '%E0%A4%A' …"` — sirova vrijednost u logu (D-5 potvrđen). Isto za `%ZZ`. |
| E2 | Ista putanja sa `GET` | 500, isti log (dekodiranje se dešava pri poklapanju putanje, prije provjere metoda). |
| E3 | Ista putanja + neispravan JSON (`{neispravan`) | **422 `INVALID_REQUEST`** — globalni JSON parser je prije rutera, pa stvarni redoslijed je JSON → D-5 (`i04/P-8`). |
| E4 | `POST /api/v1/rewards/%E0%A4%A/drugo`, `POST /api/v1/nesto/%E0%A4%A` | 404 `NOT_FOUND` (nijedan sloj sa parametrom se ne poklapa → nema dekodiranja). |
| E5 | Oblik greške u error handler-u | `err instanceof URIError === true`, `err.status === 400`, `err.statusCode === undefined`, `err.message === "Failed to decode param '%E0%A4%A'"`, `req.route === undefined`. |
| E6 | `rewardId` iz putanje: `a%2Fb`, `a%00b`, `%0A`, `.`, `%2E%2E` | Ruta pogođena; `req.params.rewardId` = `"a/b"`, `"a\u0000b"`, `"\n"`, `"."`, `".."` (code point-i potvrđeni). |
| E7 | `/rewards//issue`; `/REWARDS/CAR_WASH/ISSUE`; `/rewards/CAR_WASH/issue/` | 404 `NOT_FOUND`; ruta pogođena (Express ruter je case-insensitive i nije strict — postojeće ponašanje svih ruta, `i04/P-14`). |
| F1 | Firestore emulator: `doc(id).get()`, `tx.get`, `tx.getAll` za ID sa `\u0000`, samo `\u0000`, `\n`, `\u0001`, `\u007f`, `\u0085`, `\t`, `\ufeff`, `\u00a0`, `\u200d`, `\u2028`, `\uffff`, 64 astralna znaka, `" "`, `\`, `...`, 1500 i 1501 znak | Svuda `exists: false`, bez greške; `set` dokumenta sa ID-em `a\u0000b` uspijeva. Emulator NE odbija NUL/kontrolne znakove ni ID > 1500 bajtova; ponašanje produkcije nije provjerljivo (`i04/P-9`). |
| F2 | `tx.get(collection('vouchers').where('uid','==','U').where('status','==','ACTIVE'))` | Radi; vraća `QuerySnapshot` (`docs` niz, nema `ref`), tačno ACTIVE voucher-i korisnika U (ne EXPIRED, ne tuđi). Emulator ne traži indeks (`i04/P-10`). |
| F3 | 10 paralelnih transakcija (upit ACTIVE voucher-a + `tx.get(loyaltyAccounts)` → za istekle: `tx.update` status EXPIRED, `tx.create` `loyaltyLedger/release_{id}`, `tx.update` nalog), `maxAttempts: 5` | Svih 10 ispunjeno; tačno jedna je oslobodila voucher (`[0,0,0,0,0,0,0,0,1,0]`), jedan `release_v1`, nalog `50/30` (tačno jednom), `v1` EXPIRED. |
| F4 | `Timestamp.fromMillis(ms)` i `+900 000` upisano i pročitano | `toMillis()` tačno jednak, razlika tačno `900000`, `toISOString()` sa milisekundama. |
| F5 | `tx.create` postojećeg dokumenta | `code 6` `ALREADY_EXISTS` (→ 500 po postojećoj klasifikaciji). |
| F6 | `tx.get` poslije `tx.update` u istoj transakciji | Greška „Firestore transactions require all reads to be executed before all writes.” (`code` undefined → bio bi 500): sva čitanja moraju prethoditi upisima (5.5). |
| C1 | `crypto.randomBytes(32).toString('hex')` | 64 znaka, `/^[0-9a-f]{64}$/` ✔. |
| C2 | `mock.method(crypto, 'randomBytes', n => n === 32 ? Buffer.alloc(32, 0xab) : izvorna(n))` iz testa, modul poziva `crypto.randomBytes(32)` preko default importa | Mock djeluje (`'ab'.repeat(32)`), poziv sa argumentom 32 zabilježen, `randomBytes(40)` (koristi ga `@google-cloud/firestore` `util.autoId`) prolazi do izvorne funkcije; `mock.restoreAll()` vraća izvornu. |
| C3 | Vektor `requestKey`: SHA-256 hex nad UTF-8 `"U:3b241101-e2bb-4255-8caf-4136c566a962"` | `631e80fe93e6fd96cd78653da1d09604ac2acd0c12db25ef15596ac2738e5628` (fiksira kodiranje u unit testu I04-T06 (a)). |

### 3.1 Preduslov: `provjera.ps1`

`.\skripte\provjera.ps1` na vrhu grane (`8f08a06`, kod identičan `main`/`i03`), izlaz preusmjeren u fajl van repoa, PowerShell 5.1 → `SVE PROVJERE PROŠLE`, `EXIT=0`:
SRS hash, NFR-07, bez TODO/FIXME, portovi slobodni; backend `npm test` `ℹ tests 46` `ℹ pass 46` `ℹ fail 0`; `npm run test:emu` `ℹ tests 68` `ℹ pass 68` `ℹ fail 0`;
smoke `404 NOT_FOUND`, `401 UNAUTHENTICATED`, `401 UNAUTHENTICATED_POS` (u logu `putanja` `(nepoznata ruta)`, `/account/init`, `/pos/purchases`);
rules `ℹ tests 25` `ℹ pass 25` `ℹ fail 0`; Android `BUILD SUCCESSFUL` (assembleDebug, testDebugUnitTest). `git status` poslije: čisto. Zeleni checkpoint postoji.

## 4. Fajlovi (dodati / izmijeniti / netaknuto)

Legenda: **[D]** dodati, **[I]** izmijeniti, **[N]** netaknuto.

```
/
├── README.md                                     [I] API-03 (ugovor, greške, retry, 503/kasni commit), D-5 rečenica (dokumentacioni korak)
├── skripte/provjera.ps1                          [I] četvrti smoke: POST /api/v1/rewards/CAR_WASH/issue bez token-a → 401 UNAUTHENTICATED (UTF-8 BOM, CRLF)
├── firebase/
│   ├── firestore.rules                           [I] + /rewardDefinitions, /vouchers, /rewardRequests doslovno iz §31 (11.3)
│   ├── firestore.indexes.json                    [N] (i04/P-10: upit sa dva uslova jednakosti ne traži composite indeks)
│   └── tests/
│       ├── nagradeIVauceri.test.js               [D] RULE-T09, I04-T17
│       └── (korisnikINalog, kupovineObavjestenjaLedger, podrazumijevanaZabrana [N]; RULE-T12 mora ostati zelen)
├── backend/
│   ├── src/
│   │   ├── aplikacija.js                         [I] dodajRuteNagrada(ruterApi, { servisi }) poslije dodajRuteKupovina, prije opcije.dodajRute
│   │   ├── greske/obradaGresaka.js               [I] D-5: URIError sa status 400 → NOT_FOUND (5.8)
│   │   ├── rute/nagrade.js                       [D] dodajRuteNagrada(ruter, { servisi }): POST /rewards/:rewardId/issue (5.2)
│   │   ├── validacija/identifikator.js           [D] jeIspravanIdDokumenta(vrijednost) — pravila i03/P-5 (premješteno iz tijeloKupovine.js, i04/P-9)
│   │   ├── validacija/tijeloKupovine.js          [I] samo import jeIspravanIdDokumenta umjesto privatne funkcije (ponašanje isto)
│   │   ├── validacija/zahtjevIzdavanja.js        [D] provjeriTijeloIzdavanja(tijelo) → { requestId }; provjeriRewardId(rewardId) → rewardId (5.3, 5.4)
│   │   ├── servisi/vauceri.js                    [D] TRAJANJE_VAUCERA_MS, generisiVoucherId(), jeIstekao(expiresAtMs, sadaMs),
│   │   │                                             poredakOslobadjanja(a, b), izracunajRequestKey(uid, requestId) (5.6, 5.7)
│   │   └── servisi/izdavanjeNagrade.js           [D] izdajNagradu(db, { uid, rewardId, requestId }, rokDo) — JEDNA transakcija (5.5)
│   │   (ostalo [N]: dnevnik.js, greske/GreskaApi.js, greske/katalogGresaka.js, greske/greskeServisa.js, posrednici/*, rute/nalog.js,
│   │    rute/kupovine.js, servisi/evidencijaKupovine.js, servisi/inicijalizacijaNaloga.js, servisi/bodovanje.js, validacija/tijeloInita.js,
│   │    validacija/vrijemeKupovine.js, podaci/kolekcije.js, konfiguracija/*, firebase/inicijalizacija.js, punjenje/*, pokreni.js,
│   │    skripte/napuniEmulator.js, package.json, package-lock.json)
│   └── test/
│       ├── pomocnici/
│       │   ├── omotacBaze.js                     [I] sakrijPostojece važi i za dokumente u rezultatu upita (tx.get(query)) (8, „Pomoćnici”)
│       │   └── (emulator.js, authEmulator.js, presretanjeLoga.js, procesBackenda.js, posKljuc.js [N])
│       ├── jedinicni/
│       │   ├── zahtjevIzdavanja.test.js          [D] I04-T02 (a), I04-T03 (a)
│       │   ├── vauceri.test.js                   [D] I04-T06 (a), I04-T09 (f)
│       │   └── dekodiranjePutanje.test.js        [D] I04-T03 (c) D-5 (bez emulatora; supertest nad napraviAplikaciju)
│       └── emulator/
│           ├── izdavanjeNagrade.test.js          [D] API-T05, API-T06, I04-T01 … I04-T09 (b), I04-T03 (b)
│           ├── izdavanjeAtomicnost.test.js       [D] API-T07, I04-T10 … I04-T15
│           └── logIzdavanja.test.js              [D] I04-T16 (in-process + spawn)
│       (postojeći i01–i03 testovi [N])
└── docs/
    ├── TRACEABILITY.md                           [I] redovi Iteracije 4 (brief tačka 5) i tabela O-1
    ├── IMPLEMENTATION_LOG.md                     [I] unos i04 (CHANGELOG, commit-i, fajlovi, odstupanja, status i04/P-n, ograničenja, poznata ograničenja)
    ├── TEST_REPORT.md                            [I] sekcija i04 (stvarni izlaz) + ispravka F1-01 (linije 1774, 1776, 1783)
    ├── ODLUKE.md                                 [I] status O-14, O-15, O-16, D-4, D-5; odluke i04/P-n; nova ograničenja; backlog F1-01 zatvoren
    ├── srs/*                                     [N]
    └── iteracije/i04_brief.md [N]; i04_plan.md (ovaj fajl; Builder upisuje samo sekciju 15)
```

Nijedan novi npm paket. Koriste se `node:crypto` (`randomBytes`, `createHash`), `firebase-admin/firestore` (`FieldValue`, `Timestamp`), `node:test` `mock`.
Glob-ovi `test/jedinicni/*.test.js`, `test/emulator/*.test.js` i `firebase/tests/*.test.js` obuhvataju nove fajlove; `package.json` se ne mijenja.

Imenovanje: SRS nazivi (`rewardDefinitions`, `vouchers`, `rewardRequests`, `loyaltyLedger`, `requestId`, `requestKey`, `rewardId`, `voucherId`, `costPoints`,
`active`, `status`, `ACTIVE`, `EXPIRED`, `issuedAt`, `expiresAt`, `redeemedAt`, `cancelledAt`, `redeemedAtStationId`, `REWARD_RESERVE`, `REWARD_RELEASE`,
`availableAfter`, `reservedAfter`, `deltaAvailable`, `deltaReserved`, kodovi grešaka) ostaju tačno kao u SRS-u; sve ostalo srpski (latinica, ijekavica).

## 5. Data-flow i granice

### 5.1 Tok zahtjeva `POST /api/v1/rewards/{rewardId}/issue` i tačan poredak provjera (`i04/P-7`)

```
korelacija → parsirajJson (globalno; neispravan JSON → 422 INVALID_REQUEST, bez token-a i bez baze; i02/P-6)
  → /api/v1 ruter: poklapanje putanje i dekodiranje parametra (neispravno percent-kodiran → URIError 400 → 404 NOT_FOUND, D-5, 5.8)
  → ruta POST /rewards/:rewardId/issue:
      1. provjeraTokena (i02)                         → 401 UNAUTHENTICATED | 503 | 500; res.locals.uid, res.locals.rokDo
      2. provjeriTijeloIzdavanja(req.body)            → 422 INVALID_REQUEST                                       (5.3)
      3. provjeriRewardId(req.params.rewardId)        → 404 REWARD_NOT_FOUND                                       (5.4)
      4. izdajNagradu(servisi.db, { uid, rewardId, requestId }, rokDo)
           4a. rok: preostaloMs ≤ 0                   → 503, runTransaction se ne poziva                           (5.5)
           4b. transakcija (5.5): T1 mapping → T2 retry/konflikt → T3 nalog → T4 nagrada → T5 reconcile → T6 bodovi → T7 upisi
      5. res.status(kreirano ? 201 : 200).json(odgovor)                                                          (6)
  → nepoznataRuta (NOT_FOUND) → centralniRukovalacGreskama
```

| # | Provjera | Ishod | Pristup bazi |
|---|---|---|---|
| 0a | JSON parser (globalan) | 422 `INVALID_REQUEST` | ne |
| 0b | Dekodiranje parametra putanje (D-5) | 404 `NOT_FOUND` | ne |
| 1 | Token (`Authorization: Bearer`, `verifyIdToken(token, true)`) | 401 `UNAUTHENTICATED` (503 / 500 po i02/P-5) | ne (Auth, ne Firestore) |
| 2 | Tijelo: običan objekat; ključevi tačno `{requestId}`; `requestId` string po regex-u O-15 | 422 `INVALID_REQUEST` | ne |
| 3 | Format `rewardId` (5.4) | 404 `REWARD_NOT_FOUND` | ne |
| 4 | Preostali rok > 0 | 503 `SERVICE_UNAVAILABLE` | ne |
| T1 | `rewardRequests/{requestKey}` postoji? (O-16) | → T2 | da (tx) |
| T2 | Mapping: nekonzistentan → 500; `rewardId` različit → 409 `IDEMPOTENCY_CONFLICT`; isti → voucher iz mapping-a, 200, ništa upisano | — | da (tx) |
| T3 | Nalog (`users`, `loyaltyAccounts`) | 409 / 500 (5.5) | da (tx) |
| T4 | Definicija nagrade | 404 / 500 / 409 (5.5) | da (tx) |
| T5 | ACTIVE voucher-i korisnika; istekli → release (u memoriji) | 500 za nekonzistentno | da (tx) |
| T6 | `availablePoints` (poslije release-a) ≥ `costPoints` | ne → release-i se commit-uju, pa 409 `INSUFFICIENT_POINTS` (O-14) | da (tx) |
| T7 | Novi `voucherId`; provjera da voucher i `reserve_{voucherId}` ne postoje (500); upisi | 201 | da (tx) |

Sve prije koraka T1 se završava BEZ ijednog poziva prema `servisi.db` (ni `collection`, `doc`, `runTransaction`); I04-T01 … I04-T03 to mjere omotačem
(`brojPristupa === 0`). Napomena: stvaran redoslijed 0a → 0b je obrnut u odnosu na listu u brief-u (tačka 5: „D-5 → JSON”), jer je parser globalan
od i01; vidi `i04/P-8`.

### 5.2 Posrednik i ruta (`rute/nagrade.js`)

```js
export function dodajRuteNagrada(ruter, { servisi }) {
  ruter.post('/rewards/:rewardId/issue', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    const { requestId } = provjeriTijeloIzdavanja(req.body);
    const rewardId = provjeriRewardId(req.params.rewardId);
    const { kreirano, odgovor } = await izdajNagradu(servisi.db, { uid: res.locals.uid, rewardId, requestId }, res.locals.rokDo);
    res.status(kreirano ? 201 : 200).json(odgovor);
  });
}
```

- Posrednik SAMO na ruti, ne `ruter.use('/rewards', …)`: `GET /api/v1/rewards/CAR_WASH/issue` i `POST /api/v1/rewards/CAR_WASH` bez token-a → 404 `NOT_FOUND` (I04-T03).
- Handler čita samo `req.body` i `req.params.rewardId`; nikad `req.query`, druga zaglavlja ni `req.params` za UID. `uid` isključivo `res.locals.uid`.
- Bez `servisi` (i01 unit testovi) postojeći obrazac: `napraviProvjeruTokena(undefined)` → poziv `auth.verifyIdToken` baca → 500 (fail closed, kao API-01); ne mijenja se.

### 5.3 Validacija tijela `provjeriTijeloIzdavanja(tijelo)` (`validacija/zahtjevIzdavanja.js`)

| # | Provjera | Kod |
|---|---|---|
| 1 | `tijelo` nije običan objekat (`undefined` bez JSON Content-Type, `null`, niz, string, broj, boolean) | 422 `INVALID_REQUEST` |
| 2 | `Object.keys(tijelo)` sadrži bilo koji ključ osim `requestId` (npr. `uid`, `rewardId`, `costPoints`, `voucherId`, `status`, `issuedAt`, `expiresAt`, `__proto__` iz sirovog JSON-a, `constructor`) | 422 `INVALID_REQUEST` |
| 3 | `typeof requestId !== 'string'` ili `!UUID_V4.test(requestId)`, `UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/` (bez zastavica; JS `$` bez `m` ne prihvata završni `\n`) | 422 `INVALID_REQUEST` |

Vraća NOVI objekat `{ requestId }`. Odbijaju se: nedostaje, `null`, broj, niz, velika slova (cijela ili djelimično), v1 (`…-1…`), v7, nil UUID, varijanta `c`/`0`,
`{…}`, `urn:uuid:` prefiks, bez crtica, okolni razmak, završni `\n`, `\r\n`, 35/37 znakova, ne-ASCII cifre (O-15).

### 5.4 Format `rewardId` (D-4, `i04/P-9`)

`provjeriRewardId(rewardId)` → vraća `rewardId` ili baca `GreskaApi('REWARD_NOT_FOUND')`; ispravno ako:
1. `typeof rewardId === 'string'` i `jeIspravanIdDokumenta(rewardId)` — ista pravila kao `loyaltyUid` (i03/P-5, OD-8): `isWellFormed()`, `length` 1–128 (UTF-16),
   ne sadrži `/`, nije `.` ni `..`, ne odgovara `/^__.*__$/s`;
2. ne sadrži kontrolni znak: `!/\p{Cc}/u.test(rewardId)` (U+0000–U+001F, U+007F–U+009F) — dopuna samo za `rewardId` (probe F1: emulator ne odbija NUL,
   produkcija nije provjerljiva; brief I04-T03 traži NUL → 404 bez baze).

`jeIspravanIdDokumenta` se premješta iz `tijeloKupovine.js` u `validacija/identifikator.js` bez promjene logike; `tijeloKupovine.js` je uvozi
(I03-T09 regresija dokazuje isto ponašanje). Kontrolni znakovi se za `loyaltyUid` NE dodaju (ponašanje API-02 se ne mijenja; napomena u `i04/P-9`).

### 5.5 Transakciona granica `izdajNagradu(db, { uid, rewardId, requestId }, rokDo)` (`servisi/izdavanjeNagrade.js`)

```
preostaloMs = rokDo - Date.now()
ako !(preostaloMs > 0) → throw GreskaApi('SERVICE_UNAVAILABLE')       // PRIJE ijednog poziva db (I04-T15)

requestKey     = izracunajRequestKey(uid, requestId)                   // čista funkcija, bez baze
refMapping     = db.collection(KOLEKCIJE.rewardRequests).doc(requestKey)
refKorisnik    = db.collection(KOLEKCIJE.users).doc(uid)
refNalog       = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid)
refNagrada     = db.collection(KOLEKCIJE.rewardDefinitions).doc(rewardId)
upitAktivnih   = db.collection(KOLEKCIJE.vouchers).where('uid', '==', uid).where('status', '==', 'ACTIVE')

transakcija = db.runTransaction(async (tx) => {
  sadaMs = Date.now()                                                  // jedno čitanje sata po pokušaju (i04/P-2)

  // T1–T2 (O-16): mapping PRIJE preduslova
  snimakMapping = await tx.get(refMapping)
  ako snimakMapping.exists:
     m = snimakMapping.data()
     ako m.uid !== uid || m.requestId !== requestId                     → throw Error('nekonzistentan mapping')        // 500
     ako typeof m.rewardId !== 'string' || !/^[0-9a-f]{64}$/.test(m.voucherId) → throw Error(...)                     // 500
     ako m.rewardId !== rewardId                                         → throw GreskaApi('IDEMPOTENCY_CONFLICT')     // 409
     snimakVaucera = await tx.get(db.collection(KOLEKCIJE.vouchers).doc(m.voucherId))
     ako !snimakVaucera.exists                                           → throw Error(...)                             // 500 (ograničenje (f))
     v = snimakVaucera.data()
     ako v.uid !== uid || v.rewardId !== m.rewardId || !jeIspravanSacuvaniVaucer(v) → throw Error(...)                  // 500
     return { ishod: 'POSTOJECI', odgovor: odgovorVaucera(m.voucherId, v) }                                             // 200, ništa upisano

  // T3–T4: čitanje naloga i definicije (jedan getAll), provjere TAČNIM redoslijedom
  [snimakKorisnika, snimakNaloga, snimakNagrade] = await tx.getAll(refKorisnik, refNalog, refNagrada)
  ako !snimakKorisnika.exists                                            → throw GreskaApi('ACCOUNT_NOT_INITIALIZED')   // i kad postoji loyaltyAccounts
  status = snimakKorisnika.get('accountStatus')
  ako status === 'DELETION_IN_PROGRESS'                                  → throw GreskaApi('ACCOUNT_DELETION_IN_PROGRESS') // bez obzira na loyaltyAccounts
  ako status !== 'ACTIVE'                                                → throw Error('neočekivan accountStatus')      // 500 (i02/P-2)
  ako !snimakNaloga.exists                                               → throw GreskaApi('ACCOUNT_NOT_INITIALIZED')   // AUTH-03
  dostupno = snimakNaloga.get('availablePoints'); rezervisano = snimakNaloga.get('reservedPoints')
  ako !jeNenegativanCijeliBroj(dostupno) || !jeNenegativanCijeliBroj(rezervisano) → throw Error(...)                    // 500 (i03/P-15)
  ako !snimakNagrade.exists                                              → throw GreskaApi('REWARD_NOT_FOUND')
  cijena = snimakNagrade.get('costPoints'); aktivna = snimakNagrade.get('active')
  ako !(Number.isSafeInteger(cijena) && cijena >= 1) || typeof aktivna !== 'boolean' → throw Error(...)                 // 500 (i04/P-12)
  ako aktivna === false                                                  → throw GreskaApi('REWARD_INACTIVE')

  // T5: reconcile (§18.1, O-14) — čitanja
  snimakAktivnih = await tx.get(upitAktivnih)                            // koristi se SAMO snimakAktivnih.docs
  za svaki d u snimakAktivnih.docs: ako d.get('uid') !== uid || d.get('status') !== 'ACTIVE'
        || !(d.get('expiresAt') instanceof Timestamp) || !(Number.isSafeInteger(d.get('costPoints')) && d.get('costPoints') >= 1)
        → throw Error('neispravan ACTIVE voucher')                       // 500
  istekli = snimakAktivnih.docs.filter(d => jeIstekao(d.get('expiresAt').toMillis(), sadaMs)).sort(poredakOslobadjanja)
  snimciRelease = istekli.length > 0 ? await tx.getAll(...istekli.map(d => refLedger(`release_${d.id}`))) : []
  ako bilo koji snimciRelease[i].exists                                  → throw Error('release postoji za ACTIVE voucher') // 500

  // T5: reconcile — računanje lanca u memoriji (bez upisa)
  oslobadjanja = []
  za svaki d u istekli (sortirano):
     c = d.get('costPoints')
     ako rezervisano - c < 0                                             → throw Error('reservedPoints < 0')            // 500, invarijanta §7.2
     dostupno += c; rezervisano -= c
     oslobadjanja.push({ ref: d.ref, voucherId: d.id, c, availableAfter: dostupno, reservedAfter: rezervisano })

  // T6: bodovi (O-14)
  vrijeme = FieldValue.serverTimestamp()                                 // jedan po transakciji (i04/P-2)
  ako dostupno < cijena:
     ako oslobadjanja.length === 0 → return { ishod: 'NEDOVOLJNO' }     // ništa upisano
     upisiOslobadjanja(tx, oslobadjanja, uid, vrijeme)                   // upisi 1 … 2k (5.6)
     tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme })                    // upis 2k+1
     return { ishod: 'NEDOVOLJNO' }                                      // commit release-a, pa 409 POSLIJE transakcije

  // T7: novi voucher — posljednja čitanja, pa upisi
  voucherId   = generisiVoucherId()                                      // crypto.randomBytes(32).toString('hex'), po pokušaju
  refVaucer   = db.collection(KOLEKCIJE.vouchers).doc(voucherId)
  refReserve  = refLedger(`reserve_${voucherId}`)
  [snimakNovog, snimakReserve] = await tx.getAll(refVaucer, refReserve)
  ako snimakNovog.exists || snimakReserve.exists                         → throw Error('voucherId zauzet')              // 500
  availableAfter = dostupno - cijena; reservedAfter = rezervisano + cijena
  vaucer = { uid, rewardId, costPoints: cijena, status: 'ACTIVE', issuedAt: Timestamp.fromMillis(sadaMs),
             expiresAt: Timestamp.fromMillis(sadaMs + TRAJANJE_VAUCERA_MS), redeemedAt: null, cancelledAt: null, redeemedAtStationId: null }
  upisiOslobadjanja(tx, oslobadjanja, uid, vrijeme)                      // upisi 1 … 2k
  tx.update(refNalog, { availablePoints: availableAfter, reservedPoints: reservedAfter, updatedAt: vrijeme })            // upis 2k+1
  tx.create(refVaucer, vaucer)                                                                                          // upis 2k+2
  tx.create(refReserve, { uid, type: 'REWARD_RESERVE', deltaAvailable: -cijena, deltaReserved: cijena,
                          availableAfter, reservedAfter, purchaseId: null, voucherId, createdAt: vrijeme })               // upis 2k+3
  tx.create(refMapping, { uid, requestId, rewardId, voucherId, createdAt: vrijeme })                                    // upis 2k+4
  return { ishod: 'KREIRAN', odgovor: odgovorVaucera(voucherId, vaucer) }
}, { maxAttempts: 5 })

rezultat = await saRokom(transakcija, preostaloMs)    // GreskaApi prolazi; jeNedostupnostFirestore → 503; ostalo → izvorna → 500
ako rezultat.ishod === 'NEDOVOLJNO' → throw GreskaApi('INSUFFICIENT_POINTS')   // tek POSLIJE commit-a (O-14)
return { kreirano: rezultat.ishod === 'KREIRAN', odgovor: rezultat.odgovor }
```

Pravila za Builder-a:
- **Sva čitanja prethode svim upisima** (proba F6). Zato se lanac release-a računa u memoriji, a upisi se rade tek u T6/T7. Redoslijed čitanja:
  mapping → (voucher iz mapping-a) | (users, loyaltyAccounts, rewardDefinitions) → upit ACTIVE → `release_*` → novi voucher i `reserve_*`.
- **Redoslijed i broj upisa su fiksni** (failure injection I04-T11 ih cilja rednim brojem): za k isteklih voucher-a: upisi 1…2k release-i (5.6), 2k+1 nalog,
  2k+2 voucher, 2k+3 RESERVE, 2k+4 mapping; u O-14 grani 1…2k, pa 2k+1 nalog.
- `loyaltyAccounts` jedino `tx.update` sa tačno `availablePoints`, `reservedPoints`, `updatedAt`, JEDNOM po transakciji (finalne vrijednosti).
  Voucher pri reconcile-u jedino `tx.update(ref, { status: 'EXPIRED' })`. Svi novi dokumenti `tx.create` (nikad `set`).
- Double-spend: `availablePoints` se čita i mijenja u ISTOJ transakciji (`tx.getAll` + `tx.update`), nikad `FieldValue.increment`, nikad čitanje van transakcije.
- Greške unutar callback-a (`throw`) poništavaju SVE (i reconcile) — tako ACCOUNT_*, REWARD_NOT_FOUND, REWARD_INACTIVE, IDEMPOTENCY_CONFLICT i 500 ništa ne upisuju.
  JEDINI ishod koji commit-uje bez voucher-a je `NEDOVOLJNO` sa ≥ 1 release-om (O-14); 409 se baca tek poslije uspješnog commit-a.
- Callback nema sporednih efekata van `tx`; `Date.now()` i `generisiVoucherId()` su dozvoljeni (novi pri svakom pokušaju; vrijedi samo commit-ovani).
- `maxAttempts: 5` (kao i02/i03). Ako konkurentni testovi daju 500 (npr. `ALREADY_EXISTS` pod kontencijom), Builder STAJE i javlja (ne širi klasifikaciju grešaka).
- Svaki ID se koristi samo kao `.doc(id)`; `rewardId` stiže tek poslije 5.4, `uid` iz verifikovanog token-a, `voucherId` iz mapping-a tek poslije provjere `^[0-9a-f]{64}$`.
- `jeIspravanSacuvaniVaucer(v)`: `Number.isSafeInteger(v.costPoints) && v.costPoints >= 1`, `v.status ∈ {ACTIVE, REDEEMED, EXPIRED, CANCELLED}`,
  `v.issuedAt` i `v.expiresAt` su `Timestamp`. (Lista statusa je §15 enum, ne implementacija prelaza.)
- Skup provjera nekonzistentnog stanja (→ 500, ništa upisano), konačno: mapping sa drugim `uid`/`requestId`; mapping bez ispravnog `rewardId`/`voucherId`;
  mapping postoji a voucher ne; voucher iz mapping-a sa drugim `uid` ili `rewardId` ili neispravnim poljima; nepoznat `accountStatus`; neispravan
  `loyaltyAccounts`; neispravna definicija nagrade; ACTIVE voucher sa neispravnim `costPoints`/`expiresAt` (ili `uid`/`status` koji ne odgovara upitu);
  `release_{voucherId}` postoji za ACTIVE voucher; `reservedPoints` bi pao ispod 0 pri release-u; novi voucher ili `reserve_{voucherId}` već postoji.

### 5.6 Release i ledger lanac (`i04/P-5`, `i04/P-6`)

```
upisiOslobadjanja(tx, oslobadjanja, uid, vrijeme):
  za svako o (redoslijedom poredakOslobadjanja):
     tx.update(o.ref, { status: 'EXPIRED' })                                                           // upis 2i-1
     tx.create(refLedger(`release_${o.voucherId}`), { uid, type: 'REWARD_RELEASE', deltaAvailable: o.c, deltaReserved: -o.c,
                availableAfter: o.availableAfter, reservedAfter: o.reservedAfter, purchaseId: null,
                voucherId: o.voucherId, createdAt: vrijeme })                                           // upis 2i
```

- `poredakOslobadjanja(a, b)`: prvo `expiresAt.toMillis()` rastuće, pa `voucherId` rastuće (poređenje stringova `<`/`>`, UTF-16, bez `localeCompare`).
  Deterministički i nezavisan od redoslijeda rezultata upita (Firestore vraća po ID-u).
- Lanac: release-i (sortirano), pa RESERVE. Prvi release: `availableAfter = dostupnoPrije + c1`, `reservedAfter = rezervisanoPrije − c1`; svaki sljedeći nastavlja
  od prethodnog; RESERVE: `availableAfter = posljednji.availableAfter − cijena`, `reservedAfter = posljednji.reservedAfter + cijena`.
- `release_{voucherId}` + `tx.create` daje „najviše jednom” na nivou ID-a: voucher ima tačno jedan RESERVE i najviše jedan RELEASE (EXPIRED i CANCELLED su
  terminalni i međusobno isključivi, §16). Isti mehanizam obavezuje i05 (cancel) i i06 (istekao redeem) — ograničenje (g).
- Svi ledger događaji jedne transakcije imaju isti `createdAt` (jedan `serverTimestamp`); redoslijed unutar transakcije je pravilo iznad, rekonstruktivno iz
  lanca `availableAfter`/`reservedAfter` (§11 nema polje za redni broj; ne dodaje se).

### 5.7 `voucherId`, `requestKey` i vrijeme (`servisi/vauceri.js`; `i04/P-2`, `P-3`, `P-4`)

```js
import crypto from 'node:crypto';                       // default import: test može mock.method(crypto, 'randomBytes') (proba C2); nije hook
export const TRAJANJE_VAUCERA_MS = 900_000;            // §17: 15 min
export function generisiVoucherId() { return crypto.randomBytes(32).toString('hex'); }
export function jeIstekao(expiresAtMs, sadaMs) { return sadaMs >= expiresAtMs; }          // §18.1, granica uključiva
export function poredakOslobadjanja(a, b) { … 5.6 … }
export function izracunajRequestKey(uid, requestId) {
  return crypto.createHash('sha256').update(`${uid}:${requestId}`, 'utf8').digest('hex');
}
```

- `voucherId`: 32 bajta (256 bita ≥ 128, §15) iz CSPRNG-a, 64 znaka `[0-9a-f]`. Ispravan Firestore doc ID (nema `/`, nije `.`/`..`, ne može biti `__…__`),
  bezbjedan kao segment putanje bez percent-kodiranja (i05/i06), ne liči na Firebase UID (Auth UID: 28 znakova `[A-Za-z0-9]`, miješana slova; AC-04). Nije izveden
  iz `requestId`, `uid` ni vremena.
- `requestKey`: SHA-256 nad UTF-8 bajtovima `uid + ":" + requestId`, hex malim slovima (64 znaka, ispravan doc ID). Injektivno: `requestId` ima fiksan oblik bez `:`,
  pa je `uid` = sve prije posljednjih 37 znakova. O-15 (samo mala slova) garantuje jedan UUID → jedan `requestKey`.
- Vrijeme: `sadaMs = Date.now()` jednom po pokušaju transakcije; `issuedAt`, `expiresAt` i poređenje u reconcile-u koriste ISTI `sadaMs` (razmak tačno
  900 000 ms, provjerljivo testom; `issuedAt` poznat prije commit-a pa ide u odgovor 201). Ledger `createdAt`, mapping `createdAt` i
  `loyaltyAccounts.updatedAt` = jedan `FieldValue.serverTimestamp()` po transakciji (kao i03: commit vrijeme, monoton sa redoslijedom commit-a kroz EARN,
  RESERVE i RELEASE). Nema test knob-a za sat: testovi pripremaju voucher-e sa prošlim `expiresAt` Admin SDK-om, granicu `≥` dokazuje unit test `jeIstekao`.

### 5.8 D-5 — dekodiranje parametra putanje (`greske/obradaGresaka.js`, `i04/P-8`)

```js
// D-5: Express 5 baca URIError sa status 400 kad parametar putanje nije ispravno percent-kodiran, prije bilo koje rute.
// Zahtjev ne pogađa nijednu rutu → NOT_FOUND (O-1); kao 4xx bez stack-a, pa poruka sa sirovom vrijednošću ne ide u log.
function odrediKod(err) {
  if (err instanceof GreskaApi) return err.kod;
  if (err instanceof URIError && err.status === 400) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}
```

- Globalno: važi za svaku buduću rutu sa parametrom (i05 `/vouchers/:voucherId/cancel`, i06 `/pos/vouchers/:voucherId/redeem`).
- `putanja` u logu je `(nepoznata ruta)` (`req.route` ne postoji, proba E5); log bez `stack`-a (404 < 500) i bez `err.message`; odgovor je standardno tijelo §27.
- Ostale greške rutera/parsera se ne mijenjaju (URIError iz drugog izvora nema `status 400` → i dalje 500).

### 5.9 Security Rules

`firebase/firestore.rules` dobija tačan sadržaj iz 11.3. Klijent: `rewardDefinitions` read za prijavljenog, write DENY; `vouchers` owner `get` i `list`
(`uid == auth.uid`, `limit ≤ 20`), write DENY; `rewardRequests` read/write DENY. Backend (Admin SDK) ne podliježe pravilima.

## 6. Prijedlog ugovora API-03 (za odobrenje, `i04/P-1`)

| Situacija | HTTP | Tijelo |
|---|---|---|
| Novi voucher | **201 Created** | `{ "voucherId", "rewardId", "costPoints", "status", "issuedAt", "expiresAt" }` |
| Retry istog `(uid, requestId)` za isti `rewardId` | **200 OK** | isto tijelo, iz SAČUVANOG voucher dokumenta |
| Greške | §27 | `{ "error": { "code", "message", "correlationId" } }` |

Primjer: `201 {"voucherId":"214d001c…abda87","rewardId":"CAR_WASH","costPoints":50,"status":"ACTIVE","issuedAt":"2026-10-17T10:00:00.000Z","expiresAt":"2026-10-17T10:15:00.000Z"}`.

- `odgovorVaucera(voucherId, v)` = `{ voucherId, rewardId: v.rewardId, costPoints: v.costPoints, status: v.status, issuedAt: v.issuedAt.toDate().toISOString(),
  expiresAt: v.expiresAt.toDate().toISOString() }`, ista funkcija za 201 i 200; redoslijed ključeva fiksan (test provjerava `Object.keys`).
- `voucherId`, `rewardId`, `costPoints`, `issuedAt`, `expiresAt` su identični u prvom odgovoru i svakom retry-ju (snapshot, ništa se od njih ne mijenja).
- `status` = TRENUTNI status sačuvanog voucher-a (prvi put uvijek `ACTIVE`; retry poslije reconcile-a drugim issue-om → `EXPIRED`). Retry ništa ne upisuje (O-16),
  pa ACTIVE voucher kome je prošao `expiresAt`, a još nije reconcile-ovan, vraća `"status":"ACTIVE"` uz `expiresAt` u prošlosti — tijelo je slika sačuvanog
  dokumenta, ne procjena isteka (Android stanje čita iz Firestore-a i reconcile-uje na Home-u, i10).
- Ne sadrži: `uid`, `requestId`, `requestKey`, ID-eve ledger događaja, balance (`availablePoints`, `reservedPoints`, `availableAfter`; Android ga čita iz
  `loyaltyAccounts`, §2.2), `redeemedAt`/`cancelledAt`/`redeemedAtStationId`, interne podatke.
- Greške: `401 UNAUTHENTICATED`, `404 REWARD_NOT_FOUND`, `404 NOT_FOUND` (nepostojeća ruta / D-5), `409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`,
  `409 REWARD_INACTIVE`, `409 INSUFFICIENT_POINTS` (i kad su istekli voucher-i upravo oslobođeni, O-14), `409 IDEMPOTENCY_CONFLICT`, `422 INVALID_REQUEST`,
  `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE` (voucher je možda ipak izdat: retry istim `requestId` vraća isti voucher).
- Alternative: (a) bez `status` (klijent ga čita iz Firestore-a); (b) `status` uvijek `"ACTIVE"` (stanje u trenutku izdavanja) — odbačeno jer bi retry
  poslije EXPIRED tvrdio nešto što više nije tačno.

## 7. Rizici (security / concurrency / idempotency)

| # | Rizik | Mjera | Dokaz |
|---|---|---|---|
| R1 | Double-spend: dva paralelna issue-a troše istih 50 bodova | Čitanje i `tx.update` istog `loyaltyAccounts` u jednoj transakciji; bez provjere van transakcije | API-T07 (≥ 20 ponavljanja), I04-T13; M01, M02 |
| R2 | Isti `requestId` paralelno → dva voucher-a / dvije rezervacije | Mapping se čita prvi u transakciji; `tx.create` mapping-a; kontencija → retry vidi mapping | I04-T12; M04 |
| R3 | Release dva puta (paralelni issue-i, zastarjelo čitanje) | Voucher se čita u transakciji (upit) i mijenja u njoj; `release_{voucherId}` + `tx.create`; eksplicitna provjera postojećeg release-a | I04-T10, I04-T11 (z4); proba F3; M06, M07 |
| R4 | Kasni commit poslije 503 → klijent ponovi novim `requestId` ili isti dobije drugi voucher | Idempotency ključ `(uid, requestId)`; retry istim `requestId` vraća isti voucher (ograničenje (b)) | I04-T14, I04-T12 |
| R5 | Reconcile prepiše/oslobodi tuđi, neistekli ili ne-ACTIVE voucher | Upit `uid == UID && status == ACTIVE`; provjera `uid`/`status` svakog rezultata; `jeIstekao` | I04-T09 (b), (c); M08 |
| R6 | Djelimično stanje (bodovi bez voucher-a, voucher bez mapping-a, release bez RELEASE-a) | Svi upisi u jednoj transakciji; O-14 jedini izuzetak bez voucher-a | I04-T11 (svaki upis + prije commit-a); M18 |
| R7 | Retry pri promijenjenom stanju daje drugi rezultat ili upisuje (O-16) | Mapping prije preduslova; retry grana bez upisa | I04-T08; M11 |
| R8 | Validacija zaobiđena retry-jem (i03/P-6) | Validacija i format prije transakcije | I04-T08 (f); M12 |
| R9 | `voucherId` predvidljiv / izveden / slab (< 128 bita) / sudar sa UID-om | `crypto.randomBytes(32)` hex; provjera zauzetosti; format različit od UID-a | I04-T06; M14 |
| R10 | `voucherId` kao podatak za redemption curi u log ili poruku (i05/i06) | Odgovor ga sadrži samo u 201/200 tijelu; log bilježi šablon rute; D-5 bez sirove vrijednosti | I04-T16 |
| R11 | D-5: `URIError` → 500 sa sirovom vrijednošću u logu | `odrediKod` → 404 bez stack-a | I04-T03 (c), I04-T16; M21, M22 |
| R12 | Path injection kroz `rewardId` (`a/b`, `..`, `__x__`, NUL) | Format prije bilo kakvog pristupa bazi | I04-T03; M23, M24 |
| R13 | Mass assignment (`costPoints`, `voucherId`, `uid`, `status` u tijelu) | Strogo tijelo (samo `requestId`) | I04-T02, I04-T06 |
| R14 | UID iz tijela/query-ja/zaglavlja | Samo `res.locals.uid` | I04-T01; M19 |
| R15 | Dva oblika istog UUID-a (velika/mala slova) → dva `requestKey`-a | O-15: samo kanonski mala slova | I04-T02; M16 |
| R16 | `requestKey` bez `uid`-a → tuđi mapping | `SHA-256(uid:requestId)`; provjera `mapping.uid` | I04-T06 (b), API-T06; M10, M36 |
| R17 | Sat Backend-a vs Firestore (issuedAt/expiresAt po Backend-u, ledger `createdAt` po Firestore-u) | Jedan `sadaMs` za issue i reconcile; ograničenje dokumentovano | I04-T09 (f), API-T06; poznato ograničenje |
| R18 | Pod kontencijom `ALREADY_EXISTS` umjesto retry-ja → 500 | Mjerenje u API-T07, I04-T10, I04-T12; ako se pojavi, Builder STAJE | API-T07, I04-T10, I04-T12 |
| R19 | Reconcile commit-ovan i kod REWARD_INACTIVE / ACCOUNT_* | Sve greške bacaju u callback-u (rollback); provjere prije reconcile-a | I04-T04, I04-T05; M17 |
| R20 | Rollback release-a kod INSUFFICIENT_POINTS (krši O-14) | Ishod `NEDOVOLJNO` se vraća, 409 se baca poslije commit-a | I04-T09 (e); M18 |
| R21 | Rules odstupaju od §31; klijent piše voucher | Automatsko poređenje sa `.docx`; RULE-T09 | 11.3, RULE-T09, I04-T17 |
| R22 | Test-only hook u produkciji | DI kroz `servisi`; mock samo kroz default import `crypto` (kao i03) | `git grep` (sekcija 9) |
| R23 | Mnogo isteklih voucher-a → transakcija preko limita upisa | 2 upisa po voucher-u; svaki voucher ≥ 1 bod rezerve — praktično nedostižno u MVP-u | Poznato ograničenje (`i04/P-16`) |

## 8. Testovi

Svi testovi: `node:test` + `node:assert/strict`, naslovi počinju ID-em. Emulator testovi: `provjeriTestnoOkruzenje()` na vrhu, `beforeEach(ocistiEmulatore)`,
`after` → `deleteApp`. Aplikacija: `napraviAplikaciju({ servisi: { db: <db ili omotač>, auth: firebase.auth }, verzijaUslova: '1.0' })`; token iz Auth emulatora
(`napraviKorisnika`); `rewardDefinitions` puni `napuniRewardDefinitions(db)` (i01 seed) ili Admin SDK za neispravne definicije. Svako tijelo greške se provjerava
tačno (tri polja, poruka iz kataloga, `correlationId` UUID v4).

Pomoćnici:
- `omotacBaze.js` [I]: u proxy-ju `tx.get`, kad rezultat ima niz `docs` (rezultat upita) i `sakrijPostojece` nije prazan, vraća se objekat
  `{ docs: filtrirano, size, empty, query, forEach }` bez dokumenata čija je putanja u `sakrijPostojece`. Postojeće ponašanje za snimke dokumenata nepromijenjeno.
  Servis koristi samo `.docs` rezultata upita (5.5). Kontrola u svakom testu sa omotačem: omotač bez opcija → očekivan uspjeh.
- U test fajlovima (lokalno, ne iz `src/`): `kljucZahtjeva(uid, requestId)` = `createHash('sha256').update(`${uid}:${requestId}`).digest('hex')` (nezavisno po §14);
  `pripremiNalog(uid, { availablePoints, reservedPoints, accountStatus })` (kanonski `users` + `loyaltyAccounts`); `pripremiVaucer(id, { uid, rewardId, costPoints,
  status, expiresAtMs })` (kanonski §15, id 64 hex); `snimakKorisnika(uid)` = `users/uid`, `loyaltyAccounts/uid`, svi `vouchers`, `rewardRequests` i `loyaltyLedger`
  sa tim `uid` (za `deepStrictEqual` prije/poslije); `izdaj(rewardId, tijelo, { token, db })` (supertest).
- Mock generatora: `mock.method(crypto, 'randomBytes', (n, ...o) => n === 32 ? FIKSNO : izvorna(n, ...o))`, `afterEach(() => mock.restoreAll())`.

### 8.1 SRS katalog

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| API-T05 | `emulator/izdavanjeNagrade.test.js` | Nalog `availablePoints: 49`, `reservedPoints: 0`, seed. `POST /rewards/CAR_WASH/issue` `{ requestId: <v4> }` → 409 `INSUFFICIENT_POINTS` (tačno tijelo). `snimakKorisnika` `deepStrictEqual` prije/poslije (uklj. `updatedAt`); 0 voucher-a, 0 mapping-a, 0 ledger događaja; omotač: `upisi` = `[]`. |
| API-T06 | isti | Nalog `50/0`. Zahtjev → 201; tijelo tačno po 6 (`Object.keys` = 6 ključeva tim redoslijedom; `voucherId` `^[0-9a-f]{64}$`; `rewardId 'CAR_WASH'`; `costPoints 50`; `status 'ACTIVE'`; `issuedAt`/`expiresAt` ISO sa `Z`). `loyaltyAccounts`: `availablePoints 0`, `reservedPoints 50`, `createdAt` nepromijenjen, `updatedAt` = ledger `createdAt`. `vouchers/{voucherId}` TAČNO 9 ključeva §15 (`status 'ACTIVE'`, `costPoints 50`, `uid`, `rewardId`, `redeemedAt`/`cancelledAt`/`redeemedAtStationId` `=== null`, `issuedAt`/`expiresAt` `Timestamp`, `expiresAt.toMillis() − issuedAt.toMillis() === 900000`, `issuedAt` u [prije − 5 s, poslije + 5 s], ISO u tijelu = `toDate().toISOString()`). `loyaltyLedger/reserve_{voucherId}` TAČNO 9 ključeva §11: `type 'REWARD_RESERVE'`, `deltaAvailable −50`, `deltaReserved 50`, `availableAfter 0`, `reservedAfter 50`, `purchaseId null`, `voucherId`, `createdAt` `Timestamp`. `rewardRequests/{kljucZahtjeva(uid, requestId)}` (ključ izračunat u testu) TAČNO 5 ključeva §14 (`uid`, `requestId`, `rewardId`, `voucherId`, `createdAt` = ledger `createdAt`). Ukupno 1 voucher, 1 mapping, 1 ledger. Retry istog `requestId` 2× → 200, tijelo `deepStrictEqual` prvom 201; svi dokumenti `deepStrictEqual` poslije prvog; i dalje 1/1/1; omotač na retry-ju: `upisi` = `[]`. Invarijante ≥ 0. |
| API-T07 | `emulator/izdavanjeAtomicnost.test.js` | 20 ponavljanja u jednom testu, svako sa NOVIM korisnikom (`napraviKorisnika`, nalog `50/0`), omotač bez opcija: dva PARALELNA `CAR_WASH` zahtjeva sa različitim `requestId` (`Promise.all`), pa `await omotac.sveTransakcijeZavrsene`. Svako ponavljanje: statusi ⊆ {201, 409, 503}; ≤ 1 × 201; 0 × 500; svaki 409 je `INSUFFICIENT_POINTS`, svaki 503 tačno tijelo `SERVICE_UNAVAILABLE`; broj voucher-a = broj `REWARD_RESERVE` = broj mapping-a ≤ 1; balance tačno `0/50` ako je 1 voucher, `50/0` ako 0. Raspodjela ishoda (201/409/503) kroz `t.diagnostic` (upisuje se u TEST_REPORT). |
| RULE-T09 | `firebase/tests/nagradeIVauceri.test.js` | Voucher-i A (2) i B (1) kanonski (§15). Vlasnik A: `getDoc(vouchers/vA1)` → ALLOW; `getDocs(query(vouchers, where('uid','==','korisnikA'), limit(20)))` → ALLOW (2). Vlasnik A: `setDoc` novog voucher-a sa `uid: A`, `updateDoc` svog (`status: 'EXPIRED'`; zasebno `costPoints: 1`), `deleteDoc` svog → DENY; drugi korisnik i neautentifikovan isto → DENY. |

### 8.2 Dopunski testovi I04

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| I04-T01 | `emulator/izdavanjeNagrade.test.js` | Ispravno tijelo, omotač broji pristupe: bez `Authorization`; `Bearer neispravan`; `Basic <token>`; `Bearer` bez token-a; token u query-ju (`?token=`) → svako 401 `UNAUTHENTICATED`, `brojPristupa === 0`, baza bez novih dokumenata. UID samo iz token-a: korisnik A (token A, nalog 50/0) i B (nalog 50/0): zahtjev sa tokenom A + `?uid=<B>` + zaglavlje `X-User-Id: <B>` → 201, voucher `uid === A`, nalog A `0/50`, nalog B nepromijenjen, mapping pod `kljucZahtjeva(A, …)`, ništa za B. |
| I04-T02 | (a) `jedinicni/zahtjevIzdavanja.test.js`; (b) `emulator/izdavanjeNagrade.test.js` | (a) `provjeriTijeloIzdavanja`: prolazi kanonski v4 (više nasumičnih `randomUUID()`, varijante 8/9/a/b); odbija (`GreskaApi` `INVALID_REQUEST`) sve iz 5.3: `undefined`, `null`, `[]`, `"x"`, `5`, `true`, `{}`, `{ requestId: null }`, `{ requestId: 5 }`, `{ requestId: [uuid] }`, velika slova (cijeli, jedan znak), v1 `…-11ec-…`, v7 `…-7…`, nil `00000000-0000-0000-0000-000000000000`, varijanta `c`/`0`/`7`, `{…}`, `urn:uuid:…`, bez crtica, `" "+uuid`, `uuid+" "`, `uuid+"\n"`, `uuid+"\r\n"`, 35 i 37 znakova, arapsko-indijske cifre; dodatno polje uz ispravan `requestId`: `uid`, `rewardId`, `costPoints`, `voucherId`, `status`, `issuedAt`, `expiresAt`, `nepoznato`. (b) HTTP sa važećim token-om, omotač: reprezentativan podskup (nedostaje, velika slova, v1, nil, `{ requestId, costPoints: 1 }`, `{ requestId, voucherId: <64 hex> }`, `__proto__` sirov JSON, `[]`, `text/plain`) → 422 `INVALID_REQUEST`, `brojPristupa === 0`, ništa upisano; neispravan JSON BEZ token-a → 422. Redoslijed: `{ nepoznato: 1 }` + rewardId `__x__` → 422 (tijelo prije formata `rewardId`). |
| I04-T03 | (a) `jedinicni/zahtjevIzdavanja.test.js`; (b) `emulator/izdavanjeNagrade.test.js`; (c) `jedinicni/dekodiranjePutanje.test.js` | (a) `provjeriRewardId`: prolazi `CAR_WASH`, `SHOWER`, 128 znakova, `a.b`, `č`; odbija (`REWARD_NOT_FOUND`) `""`, `"a/b"`, `"."`, `".."`, `"__x__"`, `"____"`, `"__\n__"`, 129 znakova, `"\uD800"`, `"a\u0000b"`, `"\u0000"`, `"\n"`, `"\u007f"`, `"\u0085"`, ne-string. (b) HTTP, važeći token, omotač: `/rewards/FOO/issue` (format ispravan, ne postoji) → 404 `REWARD_NOT_FOUND`, ništa upisano (i kad postoji istekao ACTIVE voucher — nije reconcile-ovan); `a%2Fb`, `__x__`, `%2E%2E`, 129 znakova, `a%00b`, `%0A` → 404 `REWARD_NOT_FOUND`, `brojPristupa === 0`; `GET /rewards/CAR_WASH/issue` i `POST /rewards/CAR_WASH` bez token-a → 404 `NOT_FOUND`. (c) Bez emulatora: `napraviAplikaciju()` (produkciona ruta API-03 postoji) i `napraviAplikaciju({ dodajRute })` sa test rutom `/test/:id`: `POST /api/v1/rewards/%E0%A4%A/issue`, `GET` iste, `POST /api/v1/rewards/%ZZ/issue`, `POST /api/v1/test/<SENTINEL>%E0` → 404 `NOT_FOUND` (tačno tijelo), log (svi kanali, `presretniLog`) ima tačno jedan zapis sa `code NOT_FOUND`, `status 404`, `putanja "(nepoznata ruta)"`, bez ključa `stack`, i NE sadrži `%E0%A4%A`, `%ZZ`, `SENTINEL`, `Failed to decode`; isti zahtjev sa neispravnim JSON-om → 422 (stvaran redoslijed, `i04/P-8`). Kontrola: URIError bez `status` iz test rute (`throw new URIError('x')`) → 500 (ostale greške nepromijenjene). |
| I04-T04 | `emulator/izdavanjeNagrade.test.js` | Svaki slučaj sa pripremljenim isteklim ACTIVE voucher-om korisnika (reserved odgovara): users ne postoji (i loyaltyAccounts ne postoji); users ACTIVE bez loyaltyAccounts; loyaltyAccounts bez users → 409 `ACCOUNT_NOT_INITIALIZED`; DELETION_IN_PROGRESS + loyaltyAccounts i DELETION_IN_PROGRESS bez loyaltyAccounts → 409 `ACCOUNT_DELETION_IN_PROGRESS`; `accountStatus: 'NEPOZNAT'` (sa i bez loyaltyAccounts); loyaltyAccounts `availablePoints: -1`, `'50'`, `1.5`, `reservedPoints: null` → 500 bez stack-a. Svuda: `snimakKorisnika` `deepStrictEqual`, voucher i dalje ACTIVE, 0 release, `upisi === []`. |
| I04-T05 | isti | Uz istekao ACTIVE voucher: `CAR_WASH.active = false` → 409 `REWARD_INACTIVE`; definicija `costPoints` 0, −1, 1.5, `"50"`, `null`, nedostaje; `active: "true"`, nedostaje → 500; ništa upisano (ni reconcile, `upisi === []`). Pozitivno: SHOWER (30) sa 30/0 → 201, `costPoints 30`, balance `0/30`. Snapshot: izdat CAR_WASH (50), pa Admin SDK `rewardDefinitions/CAR_WASH.costPoints = 70`: voucher i dalje `costPoints 50`; retry → 200 sa `costPoints 50`; zatim Admin SDK postavi `expiresAt` voucher-a u prošlost i izda se SHOWER → RELEASE `deltaAvailable +50` (sa voucher-a, ne 70). |
| I04-T06 | (a) `jedinicni/vauceri.test.js`; (b) `emulator/izdavanjeNagrade.test.js` | (a) `generisiVoucherId`: 1000 poziva → svi `^[0-9a-f]{64}$`, svi različiti; mock `randomBytes` (C2) → rezultat tačno `FIKSNO.toString('hex')` i poziv sa argumentom `32` (izveden samo iz CSPRNG-a). `izracunajRequestKey('U', '3b241101-e2bb-4255-8caf-4136c566a962')` = vektor C3; `uid` sa `:` daje različit ključ od pomjerene podjele. (b) 100 izdavanja (SHOWER, jedan korisnik sa dovoljno bodova, različiti `requestId`, sekvencijalno) → 100 različitih `voucherId`-eva u formatu, nijedan ne sadrži `uid` ni `requestId` (bez crtica); isti `requestId` za korisnike A i B → oba 201, dva voucher-a, dva mapping-a pod različitim ključevima, balance oba promijenjen. `voucherId` u tijelu → 422 (I04-T02). |
| I04-T07 | isti | CAR_WASH sa `requestId` R → 201; isti R za SHOWER → 409 `IDEMPOTENCY_CONFLICT`; `snimakKorisnika` `deepStrictEqual`, `upisi === []`; ponovo R za CAR_WASH → 200 (isti voucher). |
| I04-T08 | isti | O-16, poslije uspješnog CAR_WASH (R): (a) Admin SDK `availablePoints = 0`, `reservedPoints = 0`; (b) `active = false`; (c) `accountStatus = 'DELETION_IN_PROGRESS'`; (d) voucher EXPIRED kroz SHOWER issue drugim `requestId` (voucher `expiresAt` u prošlost Admin SDK-om) → retry R: 200, `status 'EXPIRED'`, ostala polja tijela jednaka prvom; (e) voucher ACTIVE a `expiresAt` u prošlosti → retry R: 200 `status 'ACTIVE'`, voucher i dalje ACTIVE, nema RELEASE-a. Svaki: isti `voucherId`, `upisi === []`, `snimakKorisnika` `deepStrictEqual` stanju prije retry-ja. (f) Retry sa `requestId` velikim slovima → 422; R na `/rewards/__x__/issue` → 404 `REWARD_NOT_FOUND`; oba `brojPristupa === 0`. (g) Mapping nekonzistentnosti → I04-T10 (c). |
| I04-T09 | (a)–(e) `emulator/izdavanjeNagrade.test.js`; (f) `jedinicni/vauceri.test.js` | (a) Nalog `20/50`, istekao ACTIVE CAR_WASH voucher V (50) → SHOWER → 201: V `deepStrictEqual` prije osim `status: 'EXPIRED'` (cancelledAt/redeemedAt ostaju null); `release_V` TAČNO 9 polja (`deltaAvailable +50`, `deltaReserved −50`, `availableAfter 70`, `reservedAfter 0`, `purchaseId null`, `voucherId V`); RESERVE `availableAfter 40`, `reservedAfter 30`; nalog `40/30`. (b) Neistekao ACTIVE (`expiresAt` = sada + 10 min) ostaje ACTIVE, bez release-a. (c) Korisnikovi EXPIRED, CANCELLED, REDEEMED sa prošlim `expiresAt` i istekao ACTIVE voucher drugog korisnika → nepromijenjeni (deepStrictEqual), bez release-a; nalog drugog nepromijenjen. (d) Tri istekla (`f…f` expiresAt T−3 min / 30, `0…0` T−2 min / 50, `a…a` i `b…b` sa istim T−1 min) → release-i redom `f…f`, `0…0`, `a…a`, `b…b` (rekonstrukcija lanca: svaki `availableAfter` = prethodni + delta), pa RESERVE; zbir tačan. (e) O-14: nalog `5/30`, istekao SHOWER voucher V (30), zahtjev CAR_WASH (50) → 409 `INSUFFICIENT_POINTS`; V EXPIRED, `release_V` postoji (`availableAfter 35`, `reservedAfter 0`), nalog `35/0`, NEMA novog voucher-a, mapping-a ni RESERVE-a; retry istog `requestId` → 409 opet, bez novog release-a. (f) `jeIstekao(T, T)` true; `jeIstekao(T, T − 1)` false; `jeIstekao(T, T + 1)` true; `poredakOslobadjanja` za jednake `expiresAt` po `voucherId`. |
| I04-T10 | `emulator/izdavanjeAtomicnost.test.js` | (a) Nalog `0/50`, istekao V (50); 10 paralelnih SHOWER sa različitim `requestId` (omotač bez opcija, `sveTransakcijeZavrsene`) → statusi ⊆ {201, 409, 503}, 0 × 500, svaki 409 `INSUFFICIENT_POINTS`; broj `release_V` = broj novih voucher-a = broj RESERVE = broj mapping-a ≤ 1 (release bez voucher-a ovdje nije moguć jer 50 ≥ 30); ako je taj broj 0 (svi 503 bez kasnog commit-a), jedan od zahtjeva se ponavlja ISTIM `requestId` do 201 (najviše 20 pokušaja). Kraj: tačno 1 `release_V`, V EXPIRED, nalog `20/30`. (b) Nekonzistentno → 500, `upisi === []`, dokumenti nepromijenjeni: `release_V` postoji a V ACTIVE i istekao; ACTIVE voucher sa `costPoints: 0` / `'50'` / bez `expiresAt`; reserved manji od cijene isteklog voucher-a (`20` uz V 50). (c) Mapping nekonzistentnosti (pripremljene Admin SDK-om pod `kljucZahtjeva(uid, R)`): `uid` drugi; `requestId` drugi; `voucherId` ne postoji; voucher sa drugim `uid`; voucher sa drugim `rewardId`; `voucherId: 'a/b'` → 500, `upisi === []`. (d) Prisilan sudar: mock `randomBytes` → FIKSNO; pripremljen `loyaltyLedger/reserve_{FIKSNO_HEX}` (pa zasebno `vouchers/{FIKSNO_HEX}`) → 500, `upisi === []`, pripremljeni dokument nepromijenjen, balance nepromijenjen. |
| I04-T11 | isti | Failure injection, svaki zaseban zahtjev → 500 bez `stack`, `    at `, `ubrizgana`, `C:\`, `tajno`; `snimakKorisnika` `deepStrictEqual` početnom: (a) bez isteklih: `baciNaUpisu` 1…4 (putanje: loyaltyAccounts, vouchers, loyaltyLedger/reserve_, rewardRequests); (b) jedan istekao: `baciNaUpisu` 1…6 (vouchers/V, loyaltyLedger/release_V, loyaltyAccounts, vouchers/novi, reserve_, rewardRequests); (c) O-14 grana: 1…3; (d) `baciPrijeCommita` za (a), (b), (c). Zastarjelo čitanje (K-1 iz i03), mock `randomBytes` gdje treba: (z1) pripremljen `vouchers/{FIKSNO_HEX}` sakriven → 500, dokument nepromijenjen; (z2) pripremljen mapping pod `kljucZahtjeva` sakriven → 500 (ne 201), mapping nepromijenjen, 0 voucher-a; (z3) pripremljen `reserve_{FIKSNO_HEX}` sakriven → 500; (z4) istekao V + pripremljen `release_V` sakriven → 500, `release_V` nepromijenjen, V ACTIVE. Kontrola: omotač bez opcija → 201. |
| I04-T12 | isti | 10 paralelnih ISTIH zahtjeva (isti `requestId`, CAR_WASH, nalog `50/0`), 3 ponavljanja (novi korisnik): `sveTransakcijeZavrsene`; statusi ⊆ {200, 201, 503}; 0 × 500; ≤ 1 × 201; svi uspješni sa istim `voucherId` i `deepStrictEqual` tijelom; tačno 1 voucher, 1 RESERVE, 1 mapping; balance `0/50`. Naknadni retry → 200, isti voucher. Statusi u `t.diagnostic`. |
| I04-T13 | isti | Nalog `0/0`, POS konfiguracija iz testa (kao i03); paralelno 5 kupovina (po 20 bodova, različiti `posTransactionId`) i 3 issue-a SHOWER (različiti `requestId`); svaki 503 se ponavlja ISTIM zahtjevom (najviše 20 pokušaja); `sveTransakcijeZavrsene`. Kraj: `availablePoints + reservedPoints === 100`; `reservedPoints === 30 × broj voucher-a`; svi EARN + RESERVE događaji korisnika sortirani po lancu čine konzistentan niz (svaki `availableAfter`/`reservedAfter` = prethodni + delta, počev od 0/0); invarijante ≥ 0 u svakom događaju; issue-i koji su dobili 409 nisu ostavili mapping. |
| I04-T14 | isti | Omotač `zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500`: CAR_WASH (50/0) → 503 tačno tijelo u < 12 s; `await commitZavrsen` → voucher, RESERVE i mapping postoje, balance `0/50`. Retry istim `requestId` (pravi `db`) → 200, `voucherId` = iz mapping-a, tijelo izvedeno iz sačuvanog voucher-a; drugi retry identičan; tačno 1 voucher, 1 RESERVE, 1 mapping. |
| I04-T15 | isti | `izdajNagradu(omotac, { uid, rewardId: 'CAR_WASH', requestId }, rokDo)` za `rokDo` ∈ { `Date.now() − 1`, `Date.now() − 10 000`, `Date.now()`, `undefined`, `NaN` } → `GreskaApi` `SERVICE_UNAVAILABLE`, `brojTransakcija === 0`, `brojPristupa === 0`, baza nepromijenjena. HTTP oblik: `dodajRute` sa test rutom koja poziva `izdajNagradu` sa `Date.now() − 1` → 503 tačno tijelo. Kontrola: `Date.now() + 10 000` → uspjeh, `brojTransakcija === 1`. |
| I04-T16 | `emulator/logIzdavanja.test.js` | (a) In-process, `presretniLog()`, sentinel `SENTINEL_I04_…`: ishodi 201, 200, 401 (token = sentinel), 404 `REWARD_NOT_FOUND`, 404 `NOT_FOUND` (D-5 sa sentinel-om u putanji: `/rewards/SENTINEL%E0/issue`), 409 (×4 koda), 422 (`requestId` = sentinel; nepoznato polje sa sentinel-om), 500 (failure injection), 503 (`odbijTransakcijuSa: { code: 14 }`). Spojeni log ne sadrži važeći ID token, sentinel, `requestKey`, `requestId` iz tijela, `voucherId`, `Failed to decode`; nijedan odgovor (tijelo + zaglavlja) ne sadrži `stack`, `    at `, `availablePoints`, `reservedPoints`, `availableAfter`, `uid` korisnika, `requestKey`; zapisi za pogođenu rutu imaju `putanja: '/rewards/:rewardId/issue'`, za D-5 `(nepoznata ruta)`; log sadrži `correlationId` svakog error odgovora. (b) Spawn `src/pokreni.js` (pravi emulatori, `POS_API_KLJUCEVI` generisan): 401 (sentinel token), 404 D-5 (sentinel u putanji), 422 (sentinel `requestId`) → stdout+stderr bez sentinel-a i bez `Failed to decode`. |
| I04-T17 | `firebase/tests/nagradeIVauceri.test.js` | vouchers (A vlasnik): `where uid == A` bez `limit` → DENY; `limit(21)` → DENY; bez `where` (`limit(20)`) → DENY; `where uid == B` → DENY; `getDoc` voucher-a B → DENY; neautentifikovan get/list → DENY. rewardDefinitions: prijavljen `getDoc(CAR_WASH)` i `getDocs(collection)` → ALLOW; neautentifikovan get/list → DENY; prijavljen `setDoc` nove, `updateDoc(costPoints: 1)`, `deleteDoc` → DENY. rewardRequests: dokument sa `uid: A` — A, B, neautentifikovan: get, list (`where uid == A, limit 20`), set, update, delete → DENY. RULE-T12 (`podrazumijevanaZabrana.test.js`) ostaje nepromijenjen i zelen. |

### 8.3 Regresija

- I01, I02, I03 suite bez izmjene asercija i bez izmjene fajlova (`git diff main -- backend/test/jedinicni backend/test/emulator firebase/tests` = samo novi fajlovi;
  jedina izmjena postojećeg test koda je `test/pomocnici/omotacBaze.js` — proširenje, postojeće grane nepromijenjene).
- Refaktor `jeIspravanIdDokumenta` (5.4) pokriva I03-T09 (format `loyaltyUid`, uklj. `"____"`, `"__\n__"`, surogat, 128/129).
- RULE-T01 … RULE-T08, RULE-T10 … RULE-T12 (preliminarno), I02-T15, I03-T20: bez izmjene, zeleni nad novim rules fajlom.
- Android: `assembleDebug`, `testDebugUnitTest` kroz `provjera.ps1`; Android kod se ne dira.

### 8.4 Kontrolne mutacije (Builder izvršava lokalno, bez commit-a, svaku pa `git restore`; ishod u TEST_REPORT)

| # | Mutacija | Mora oboriti |
|---|---|---|
| M01 | uklonjena provjera `dostupno < cijena` | API-T05 |
| M02 | bodovi pročitani VAN transakcije (`db.doc(...).get()` prije `runTransaction`), u transakciji `tx.update` bez čitanja naloga | API-T07 (≥ 20 ponavljanja), I04-T13 |
| M03 | `tx.create` → `tx.set` za novi voucher | I04-T11 (z1) |
| M04 | `tx.create` → `tx.set` za mapping | I04-T11 (z2) |
| M05 | `tx.create` → `tx.set` za RESERVE | I04-T11 (z3) |
| M06 | `tx.create` → `tx.set` za RELEASE | I04-T11 (z4) |
| M07 | uklonjena eksplicitna provjera postojećeg `release_{id}` | I04-T10 (b) (`upisi === []`) |
| M08 | upit bez `where('status', '==', 'ACTIVE')` (reconcile bez provjere statusa) | I04-T09 (c) |
| M09 | `jeIstekao`: `>` umjesto `>=` | I04-T09 (f) |
| M10 | `requestKey` = SHA-256(`requestId`) (bez `uid`-a) | I04-T06 (b), API-T06 |
| M11 | čitanje mapping-a POSLIJE provjera naloga i nagrade (krši O-16) | I04-T08 (a), (b), (c) |
| M12 | validacija tijela i formata `rewardId` poslije čitanja mapping-a (krši i03/P-6) | I04-T08 (f), I04-T02 (b), I04-T03 (b) (`brojPristupa`) |
| M13 | `expiresAt = sadaMs + 15 * 60` (sekunde); zasebno `+ 900 001` | API-T06 |
| M14 | `generisiVoucherId` = `crypto.randomUUID()` | I04-T06 (a), (b); API-T06 (format) |
| M15 | UUID regex bez provjere verzije (`[0-9a-f]{4}` umjesto `4[0-9a-f]{3}`); zasebno bez provjere varijante | I04-T02 (a), (b) |
| M16 | UUID regex sa zastavicom `i` | I04-T02 (a), (b) |
| M17 | provjera `active` POSLIJE reconcile-a, ishod `NEAKTIVNA` vraćen (commit) umjesto bačen | I04-T05 |
| M18 | O-14 grana baca `GreskaApi('INSUFFICIENT_POINTS')` u callback-u (rollback release-a) | I04-T09 (e) |
| M19 | `uid = req.query.uid ?? res.locals.uid` | I04-T01 |
| M20 | posrednik na prefiksu (`ruter.use('/rewards', provjeraTokena)`) | I04-T03 (b) (`GET` bez token-a → 401 umjesto 404) |
| M21 | uklonjena D-5 klauzula u `odrediKod` | I04-T03 (c), I04-T16 |
| M22 | D-5 klasifikovan kao `NOT_FOUND`, ali `stack` se loguje uvijek (`stack: String(err.stack)`) | I04-T03 (c), I04-T16 |
| M23 | uklonjena provjera kontrolnih znakova za `rewardId` | I04-T03 (a), (b) (`a%00b` → pristup bazi) |
| M24 | uklonjena cijela provjera formata `rewardId` | I04-T03 (b) |
| M25 | release koristi `costPoints` iz trenutne definicije umjesto sa voucher-a | I04-T05 (snapshot) |
| M26 | `availableAfter` RESERVE-a iz stanja PRIJE release-a | I04-T09 (a) |
| M27 | uklonjeno sortiranje `poredakOslobadjanja` (redoslijed upita) | I04-T09 (d) |
| M28 | reconcile postavlja i `cancelledAt: Timestamp.now()` | I04-T09 (a) |
| M29 | `status` u odgovoru konstantno `'ACTIVE'` | I04-T08 (d) |
| M30 | odgovor retry-ja: `costPoints` iz definicije | I04-T05 (snapshot retry) |
| M31 | uklonjena provjera preostalog roka u `izdajNagradu` | I04-T15 |
| M32 | uklonjena provjera `mapping.uid`/`requestId` | I04-T10 (c) |
| M33 | uklonjeno poređenje `mapping.rewardId !== rewardId` | I04-T07 |
| M34 | definicija bez provjere tipa (`costPoints "50"` prolazi) | I04-T05 |
| M35 | redoslijed naloga: `!snimakNaloga.exists` prije provjere `DELETION_IN_PROGRESS` | I04-T04 (DELETION bez loyaltyAccounts) |
| M36 | `odgovorVaucera` uključuje `uid` | API-T06 (`Object.keys`), I04-T16 |
| M37 | `zabiljeziGresku` dobija `putanja: req.originalUrl` | I04-T16 |
| M38 | Rules: `/vouchers` `allow list: if ownResource();` (bez limit-a) | I04-T17 |
| M39 | Rules: `/rewardDefinitions` `allow read: if true;` | I04-T17 |
| M40 | Rules: `/vouchers` `allow update: if ownResource();` | RULE-T09 |
| M41 | Rules: `/rewardRequests` `allow read: if signedIn();` | I04-T17 |

Ako mutacija preživi, Builder dopunjava test (ne slabi kod) i bilježi to kao odstupanje (OD-n), kao u i03.

## 9. Definition of Done

- [ ] Sve iz sekcije 1 implementirano, ništa iz sekcije 2: `git grep -n -E "/vouchers/|/redeem|/cancel|account/vouchers|REWARD_REDEEM|redemptionRequests" -- backend/src`
      → samo `podaci/kolekcije.js` (`redemptionRequests`).
- [ ] `cd backend; npm ci; npm test; npm run test:emu; cd ..` → svi PASS (regresija I01–I03 + I04-T02 (a), T03 (a), (c), T06 (a), T09 (f); API-T05 … T07,
      I04-T01 … T16 emulator dio).
- [ ] `cd firebase\tests; npm ci; npm test; cd ..\..` → RULE-T01 … RULE-T12 (RULE-T12 preliminarno), I02-T15, I03-T20, I04-T17 PASS.
- [ ] Transakciona granica: I04-T11 — za svaki upis i prije commit-a stanje korisnika `deepStrictEqual` stanju prije; (z1)–(z4) 500 bez prepisivanja.
- [ ] Double-spend: API-T07 sa 20 ponavljanja u jednom izvršavanju zelen u 3 uzastopna `test:emu` izvršavanja; raspodjela 201/409/503 u TEST_REPORT.
- [ ] Idempotentnost: I04-T12 (10 istih paralelno), I04-T14 (kasni commit + retry) zeleni; I04-T12 zelen u 3 uzastopna izvršavanja.
- [ ] Reconcile: I04-T09, I04-T10 zeleni (release tačno jednom, O-14 dokazan).
- [ ] I04-T16: nijedan odgovor ni log (svi kanali, spawn) ne sadrži token, stack prema klijentu, balance, `requestKey`, sirovu putanju (D-3, D-5).
- [ ] `firebase/firestore.rules` tekstualno jednak §31 `.docx`-a bez bloka `/redemptionRequests/{requestKey}` (automatsko poređenje 11.3: `JEDNAKO_DOCX`, `IDENTICNO_PLANU`).
- [ ] Kontrolne mutacije M01 … M41 obaraju ciljane testove (ili je izuzetak obrazložen u TEST_REPORT).
- [ ] `git grep -n -i -E "process\.env\.(NODE_ENV|TEST)|inject|ubriz|mock" -- backend/src` → prazno; `git grep -n randomUUID -- backend/src` → samo
      `korelacija.js` i `firebase/inicijalizacija.js`; `git diff main -- '*package*.json'` prazno.
- [ ] `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 poslije svakog koraka (i03/K-2) i na kraju dva puta zaredom, uključujući smoke 401 `UNAUTHENTICATED` na
      `POST /api/v1/rewards/CAR_WASH/issue`.
- [ ] SRS hash = `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`; `git diff main -- docs/srs` prazno. Nema TODO/FIXME.
- [ ] `docs/TRACEABILITY.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/TEST_REPORT.md` (stvarni izlaz; F1-01 ispravljen: `git grep -n -P "firebase\tests" -- docs` prazno),
      `docs/ODLUKE.md`, README (API-03) ažurirani.
- [ ] Commit-i bez potpisa alata, svaki push-ovan; PR `iteracija-04 → main` otvoren, bez merge-a i taga.
- [ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag `i04` (ne radi Builder).

## 10. Traceability (SRS → komponenta → test)

| SRS | Komponenta | Test |
|---|---|---|
| §26 API-03, §3.3, NFR-01 | `rute/nagrade.js`, `aplikacija.js`, `posrednici/autentikacija.js` (N) | API-T06, I04-T01, I04-T03 (b); smoke 401 |
| §13, O-15, O-1 | `validacija/zahtjevIzdavanja.js` | I04-T02 |
| §12, §13.1 (nagrada), D-4 | `validacija/zahtjevIzdavanja.js`, `validacija/identifikator.js`, `servisi/izdavanjeNagrade.js` | I04-T03, I04-T05 |
| §13.1 (nalog), AUTH-03 … AUTH-05 | `servisi/izdavanjeNagrade.js` | I04-T04 |
| §13.2, §7.4, §7.2, NFR-04, AC-05 | `servisi/izdavanjeNagrade.js` | API-T05, API-T06, I04-T11 |
| §14, NFR-05, O-16 | `servisi/izdavanjeNagrade.js`, `servisi/vauceri.js` (`izracunajRequestKey`) | API-T06, I04-T06, I04-T07, I04-T08, I04-T12, I04-T14 |
| §15 | `servisi/vauceri.js` (`generisiVoucherId`), `servisi/izdavanjeNagrade.js` | API-T06, I04-T06, I04-T10 (d) |
| §16 (ACTIVE → EXPIRED dio) | `servisi/izdavanjeNagrade.js` | I04-T09 |
| §17 | `servisi/vauceri.js` (`TRAJANJE_VAUCERA_MS`), `servisi/izdavanjeNagrade.js` | API-T06 |
| §18, §18.1, §7.6, D-1, O-14, AC-08 (i04 dio) | `servisi/izdavanjeNagrade.js`, `servisi/vauceri.js` (`jeIstekao`, `poredakOslobadjanja`) | I04-T09, I04-T10 |
| §11, AC-09 (RESERVE, RELEASE) | `servisi/izdavanjeNagrade.js` | API-T06, I04-T09, I04-T13 |
| NFR-06, AC-06 | `servisi/izdavanjeNagrade.js` | API-T07, I04-T10, I04-T13 |
| §25.6, §25.7, §25.9, §31, NFR-03 | `firebase/firestore.rules` | RULE-T09, I04-T17, RULE-T12 |
| §27, O-1, D-5 | `greske/obradaGresaka.js`, katalog (N) | I04-T01 … I04-T05, I04-T03 (c), I04-T15, I04-T16 |
| NFR-07, D-3 | `greske/obradaGresaka.js`, `dnevnik.js` (N) | I04-T16 |

## 11. Tehničke odluke

### 11.1 Paketi

Nema novih paketa ni promjene verzija. UUID provjera regex-om; SHA-256 i `randomBytes` iz `node:crypto`.

### 11.2 README (dokumentacioni korak) i `provjera.ps1`

README sekcija „API” dobija API-03: zaglavlje `Authorization: Bearer <Firebase ID token>`; tijelo tačno `{ "requestId" }` (kanonski UUID v4 malim slovima,
generisan jednom po logičkom pokušaju, ponovljen pri retry-ju); ugovor iz sekcije 6; reconcile isteklih voucher-a prije izdavanja i O-14 (409 uz već vraćene
bodove); `503` → retry istim `requestId`; poredak provjera (5.1, uključujući da neispravan JSON ima prednost i da je validacija prije idempotentnosti); D-5 rečenica
uz postojeći opis loga („neispravno percent-kodiran parametar putanje → `404 NOT_FOUND`”). Bez primjera sa važećim token-om.

`provjera.ps1` (korak 6 implementacije): u smoke korak se dodaje četvrta provjera `POST /api/v1/rewards/CAR_WASH/issue` sa tijelom
`{"requestId":"3b241101-e2bb-4255-8caf-4136c566a962"}` bez `Authorization` → 401, `code UNAUTHENTICATED`; naslov koraka dopunjen. Fajl ostaje UTF-8 sa BOM-om i CRLF.

### 11.3 `firebase/firestore.rules` (ciljni sadržaj)

Postojeći sadržaj ostaje; `/rewardDefinitions/{rewardId}` i `/vouchers/{voucherId}` se umeću poslije `/loyaltyLedger/{eventId}`, a `/rewardRequests/{requestKey}`
poslije `/notifications/{notificationId}` (ispred default deny; u §31 između stoji `redemptionRequests`, koji se dodaje u i06). Tekst doslovno iz `word/document.xml`;
uvlačenje i prazni redovi kao u `.docx`; LF; završni prelom.

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

    match /rewardDefinitions/{rewardId} {
      allow read: if signedIn();
      allow write: if false;
    }

    match /vouchers/{voucherId} {
      allow get: if ownResource();
      allow list: if ownResource()
                  && request.query.limit != null
                  && request.query.limit <= 20;
      allow create, update, delete: if false;
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

    match /rewardRequests/{requestKey} {
      allow read, write: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Automatsko poređenje (kao i02/i03, `i03/P-14`; privremena skripta van repoa): izvući §31 iz `word/document.xml` (`w:p` i `w:br` → `\n`, `w:t` tekst, HTML entiteti),
ukloniti blok `redemptionRequests` zajedno sa praznim redom ispred njega, normalizovati CRLF → LF, uporediti sa `firebase/firestore.rules` → očekivano `JEDNAKO_DOCX`;
dodatno uporediti sa ovim blokom → `IDENTICNO_PLANU`. Komanda i izlaz u TEST_REPORT; Reviewer ponavlja.

### 11.4 Ostalo

- `res.locals.uid` i `res.locals.rokDo` postavlja samo postojeći posrednik; ruta ne računa sopstveni rok.
- Odgovor uspjeha se pravi eksplicitno (`odgovorVaucera`), nikad `snap.data()` direktno.
- `servisi/vauceri.js` je namijenjen i i05/i06 (`jeIstekao`, `poredakOslobadjanja`, mehanizam `release_{voucherId}`); u i04 se ne dodaje ništa što koristi samo i05/i06.
- `firebase/firestore.indexes.json` ostaje prazan (`i04/P-10`).

## 12. Ručni koraci za Anu

- Nema obaveznih. Ako `gh auth status` kaže da nije prijavljena, prije PR koraka kucati `! gh auth login`.

Ograničenja za buduće iteracije (Builder upisuje u IMPLEMENTATION_LOG i `docs/ODLUKE.md`, poslije odobrenja):
- **i05, i06 (g):** svaki prelaz u EXPIRED / CANCELLED koristi `release_{voucherId}` + `tx.create` (najviše jednom) i provjeru postojećeg release-a; ledger
  `createdAt` = `serverTimestamp`.
- **i05, i06 (vrijeme):** istek se procjenjuje `jeIstekao(expiresAt.toMillis(), sadaMs)` sa jednim `sadaMs = Date.now()` po pokušaju transakcije (isti izvor kao `issuedAt`).
- **i05, i06 (voucherId u putanji):** format `^[0-9a-f]{64}$` je poznat; neispravan oblik → odgovarajući 404 bez pristupa bazi; D-5 već pokriva neispravno percent-kodiranje;
  vrijednost nikad u log/poruku (h).
- **i07 (f):** retry issue-a kad mapping postoji a voucher ne → 500 (i04); i07 određuje redoslijed brisanja.
- **i10 (i):** Android upit `vouchers` mora imati `where('uid','==',auth.uid)` i `limit ≤ 20`; `rewardDefinitions` čita samo prijavljen korisnik.

## 13. Otvorena pitanja za Orchestrator-a

Nijedno nije protivrječnost SRS-a koja blokira plan; P-1 … P-12 su odluke koje brief izričito prepušta Planner-u (prijedlog + odobrenje), P-13 … P-16 informativne.
Jedno odstupanje od teksta brief-a je označeno: **P-8 (stvaran redoslijed JSON → D-5)**.

**i04/P-1 (odobrenje traži brief): ugovor API-03.**
Sekcija 6: 201 novi voucher, 200 retry; tijelo TAČNO `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt }` tim redoslijedom, iz sačuvanog voucher dokumenta
(201: iz upisanog objekta); `issuedAt`/`expiresAt` = `toDate().toISOString()`; `status` = trenutni status sačuvanog voucher-a (ACTIVE kome je istekao rok ostaje
`"ACTIVE"` dok ga reconcile ne promijeni). Alternative: bez `status`; `status` uvijek `"ACTIVE"`. Preporuka: trenutni status (tačna slika dokumenta).

**i04/P-2 (odobrenje traži brief): izvor vremena.**
`sadaMs = Date.now()` jednom po pokušaju transakcije (na početku callback-a) za `issuedAt`, `expiresAt = sadaMs + 900 000` i poređenje `sadaMs ≥ expiresAt` u reconcile-u.
Ledger `createdAt` (RESERVE i RELEASE), mapping `createdAt` i `loyaltyAccounts.updatedAt` = jedan `FieldValue.serverTimestamp()` po transakciji (kao i03: commit vrijeme,
monotono kroz EARN/RESERVE/RELEASE istog korisnika). Alternativa: sve iz `sadaMs` (jedan izvor po transakciji, ali ledger miješa sat Backend-a i Firestore-a).
Poznato ograničenje: `issuedAt` (sat Backend-a) i ledger `createdAt` (Firestore) mogu se razlikovati za odstupanje satova; lokalno (emulator na istoj mašini) zanemarljivo.

**i04/P-3 (odobrenje traži brief): `voucherId`.**
`crypto.randomBytes(32).toString('hex')` → 64 znaka `[0-9a-f]` (256 bita), generisan u callback-u (po pokušaju), poziv preko default importa `crypto` (test može mock-ovati,
kao i03 `timingSafeEqual`; proba C2). Razlozi za hex umjesto base64url: nikad `__…__` (base64url ima `_`), nikad `-`/`_` u putanji, jednoznačan regex za i05/i06,
jasno različit od Firebase UID-a. Alternativa: base64url od 32 bajta (43 znaka) — kraće, ali uz vjerovatnoću ~2⁻²⁴ po ID-u za rezervisani oblik `__…__` i miješana slova.

**i04/P-4 (odobrenje traži brief): kodiranje `requestKey`.**
SHA-256 nad UTF-8 bajtovima `uid + ":" + requestId`, hex malim slovima (64 znaka). Injektivno jer `requestId` ima fiksan format bez `:`. Vektor C3 u unit testu.

**i04/P-5 (odobrenje traži brief; obavezuje i05/i06): ledger eventId.**
Potvrđena preporuka: `reserve_{voucherId}` i `release_{voucherId}`, samo `tx.create`, uz eksplicitnu provjeru postojećeg `release_{voucherId}` prije upisa (→ 500 ako postoji
za ACTIVE voucher). Prefiks `redeem_` ostaje slobodan za i06.

**i04/P-6 (odobrenje traži brief): deterministički redoslijed release-a.**
`expiresAt` rastuće, pa `voucherId` rastuće (poređenje stringova); upisi po voucher-u: `update status`, pa `create release_`; lanac release-i → RESERVE; svi isti `createdAt`.

**i04/P-7 (odobrenje traži brief): tačan poredak provjera i skup nekonzistentnih stanja.**
Tabela 5.1 i pseudokod 5.5. Detalji koje brief ne određuje, a ovdje se predlažu: (a) mapping sa drugim `uid`/`requestId` → 500 PRIJE poređenja `rewardId`;
(b) 409 `IDEMPOTENCY_CONFLICT` bez čitanja voucher-a; (c) unutar naloga: users ne postoji → 409 NOT_INITIALIZED; DELETION → 409 (bez obzira na loyaltyAccounts);
ostali status → 500; loyaltyAccounts ne postoji → 409 NOT_INITIALIZED; neispravan balance → 500; (d) neispravan ACTIVE voucher (bilo koji, ne samo istekao) → 500;
(e) `reservedPoints` bi pao ispod 0 pri release-u → 500. Skup nekonzistentnih stanja: lista na kraju 5.5.

**i04/P-8 (odobrenje traži brief — ODSTUPANJE od redoslijeda u brief-u): D-5.**
Prijedlog: 404 `NOT_FOUND` u `odrediKod` (`err instanceof URIError && err.status === 400`), globalno; log `(nepoznata ruta)`, bez stack-a; poruka greške (sa sirovom
vrijednošću) se nigdje ne upisuje. Probe E1–E5. **Stvaran redoslijed je JSON (422) → D-5 (404)**, a ne „D-5 → JSON” kako stoji u brief-u (tačka 5), jer je
`parsirajJson` globalan od i01 (i02/P-6) i izvršava se prije rutera (proba E3). Opcije: (A) prihvatiti stvaran redoslijed (oba ishoda su deterministički 4xx bez
stack-a i bez pristupa bazi; nema bezbjednosne razlike) — **preporuka**; (B) premjestiti parser iza rutera/u rute da D-5 bude prvi — mijenja i01/i02 arhitekturu i
ponašanje API-01/API-02 (van opsega). I04-T03 (c) fiksira izabrani redoslijed. Alternativa kodu: 400 nije u katalogu, 422 `INVALID_REQUEST` je po O-1 za tijelo/requestId,
pa 404 ostaje najbliži smislu („nijedna ruta nije pogođena”).

**i04/P-9 (odobrenje traži brief): D-4 i NUL/kontrolni znakovi.**
Proba F1: emulator prihvata ID sa NUL i kontrolnim znakovima (i `set`), pa ishod ne bi bio 500, ali produkcija nije provjerljiva, a brief (I04-T03) očekuje NUL → 404 bez
baze. Prijedlog: `rewardId` = pravila i03/P-5 (zajednička funkcija `jeIspravanIdDokumenta`, premještena iz `tijeloKupovine.js` bez promjene logike) + zabrana `\p{Cc}`
(samo za `rewardId`). Alternativa: (a) samo i03/P-5 pravila (NUL bi otišao u Firestore → u emulatoru 404 iz transakcije); (b) dupliranje funkcije umjesto premještanja
(bez diranja i03 fajla). Napomena za Orchestrator-a (bez izmjene u i04): `loyaltyUid` sa NUL-om (API-02) danas ide do Firestore-a i u emulatoru daje 404 — ista
neprovjerljivost u produkciji; odluka o usklađivanju pripada nekoj kasnijoj iteraciji.

**i04/P-10 (potvrda traži brief): `tx.get(query)` i indeks.**
Proba F2/F3: Admin SDK `tx.get(query)` radi nad emulatorom i serijalizuje paralelne transakcije (tačno jedan release od 10). Emulator ne provjerava indekse; po dokumentaciji
Firestore-a upit samo sa uslovima jednakosti (`uid ==`, `status ==`, bez `orderBy`/opsega) se izvršava spajanjem jednopoljnih indeksa i ne traži composite indeks.
`firestore.indexes.json` se ne mijenja; neprovjerljivost nad produkcijom ide u poznata ograničenja.

**i04/P-11 (odobrenje traži brief): proširenje test pomoćnika.**
`omotacBaze.sakrijPostojece` se primjenjuje i na dokumente u rezultatu `tx.get(query)` (vraća objekat sa filtriranim `docs`, `size`, `empty`, `query`, `forEach`).
Ništa drugo se ne mijenja; brojanje upisa po kolekciji se izvodi iz postojećeg `upisi` (putanje). Mock `crypto.randomBytes` iz testa za prisilan sudar i fiksiran ID.

**i04/P-12: neispravna definicija nagrade vs. `active == false`.**
Prvo provjera ispravnosti (`costPoints` siguran cijeli broj ≥ 1, `active` boolean) → 500, tek onda `active === false` → 409. Definicija sa `active: false` i neispravnim
`costPoints` → 500 (nekonzistentno stanje se ne skriva iza poslovnog koda). `displayName` se ne provjerava (ne koristi se). Alternativa: `REWARD_INACTIVE` prije provjere `costPoints`.

**i04/P-13 (informativno): `requestId` poslije neuspjeha.** Neuspješan issue (409/404/500) ne pravi mapping (§14 schema traži `voucherId`), pa isti `requestId` može kasnije
uspjeti (npr. poslije EARN-a) — to je retry istog logičkog pokušaja, ne drugi poslovni efekat. O-14: 409 `INSUFFICIENT_POINTS` može doći uz već vraćene bodove (Android
balance čita iz Firestore-a).

**i04/P-14 (informativno): Express ruter je case-insensitive i nije strict** (proba E7): `/api/v1/REWARDS/CAR_WASH/ISSUE` i završna `/` pogađaju rutu — postojeće ponašanje
svih ruta od i01; ne mijenja se (bez bezbjednosnog uticaja; `rewardId` se ne mijenja po veličini slova).

**i04/P-15 (informativno): oznake testova.** I04-T01 … I04-T17 kao u brief-u, sa podtačkama (a)/(b)/(c) po fajlu; proširenja SRS testova ostaju pod SRS oznakom.

**i04/P-16 (informativno): neograničen broj ACTIVE voucher-a u upitu.** SRS ne ograničava broj aktivnih voucher-a; svaki release su 2 upisa, pa bi tek stotine isteklih voucher-a
jednog korisnika približile limite transakcije. Ne uvodi se ograničenje (van opsega); poznato ograničenje.

## 14. IMPLEMENTATION PLAN za Builder-a

Opšte: poslije svakog commit-a odmah `git push origin iteracija-04`. Commit poruke na srpskom, bez potpisa alata. Prije commit-a `git status` sadrži samo fajlove tog
koraka. Testovi prvi (crveni, izlaz zabilježen za TEST_REPORT), pa kod. Svaki commit: `npm test` zelen; emulator testovi zeleni najkasnije na commit-u koraka u kojem
su dodati; `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 poslije svakog koraka (i03/K-2). Emulator komande sa JBR-om prvim u PATH-u. Nijedan novi paket.

**Korak 0: Odluke Orchestrator-a** — Builder doslovno upisuje odluke u sekciju 15 ovog plana. Commit: `i04: odobrenje plana i odluke Orchestrator-a`.

**Korak 1: Security Rules (RULE-T09, I04-T17)**
- Fajlovi: `firebase/tests/nagradeIVauceri.test.js` [D], `firebase/firestore.rules` [I].
- Crveno: prije izmjene rules — RULE-T09 owner get/list i I04-T17 rewardDefinitions ALLOW padaju (default deny). Zeleno poslije 11.3.
- Dokaz: `cd firebase\tests; npm ci; npm test` → svi PASS (uklj. RULE-T12); poređenje sa `.docx` → `JEDNAKO_DOCX`, `IDENTICNO_PLANU`; `provjera.ps1` → 0.
- Commit: `i04: Security Rules za rewardDefinitions, vouchers i rewardRequests doslovno po §31 (RULE-T09)`

**Korak 2: D-5 globalno (I04-T03 (c))**
- Fajlovi: `backend/test/jedinicni/dekodiranjePutanje.test.js` [D], `backend/src/greske/obradaGresaka.js` [I].
- U ovom koraku test koristi samo `napraviAplikaciju({ dodajRute })` sa `/test/:id` (ruta API-03 još ne postoji); slučajevi nad `/rewards/…/issue` se dodaju u koraku 4.
- Crveno: 500 + `stack` sa sirovom vrijednošću (kao proba E1). Zeleno: 404 `NOT_FOUND`, log bez stack-a i sirove vrijednosti.
- Dokaz: `npm test` PASS; `provjera.ps1` → 0.
- Commit: `i04: neispravno kodiran parametar putanje → 404 NOT_FOUND bez sirove vrijednosti u logu (D-5)`

**Korak 3: Čiste funkcije: validacija i voucher pomoćnici (I04-T02 (a), I04-T03 (a), I04-T06 (a), I04-T09 (f))**
- Fajlovi: `backend/test/jedinicni/zahtjevIzdavanja.test.js` [D], `backend/test/jedinicni/vauceri.test.js` [D], `backend/src/validacija/identifikator.js` [D],
  `backend/src/validacija/tijeloKupovine.js` [I] (samo import), `backend/src/validacija/zahtjevIzdavanja.js` [D], `backend/src/servisi/vauceri.js` [D].
- Crveno: moduli ne postoje (`ERR_MODULE_NOT_FOUND`). Zeleno poslije 5.3, 5.4, 5.6, 5.7.
- Dokaz: `npm test` PASS; `npm run test:emu` PASS (I03-T09 regresija refaktora); `provjera.ps1` → 0.
- Commit: `i04: validacija requestId (O-15) i rewardId (D-4), generator voucherId i requestKey`

**Korak 4: Servis i ruta API-03 (API-T05, API-T06, I04-T01 … I04-T09 emulator dio, I04-T03 (b), dopuna I04-T03 (c))**
- Fajlovi: `backend/test/pomocnici/omotacBaze.js` [I], `backend/test/emulator/izdavanjeNagrade.test.js` [D], `backend/test/jedinicni/dekodiranjePutanje.test.js` [I]
  (slučajevi nad produkcionom rutom), `backend/src/servisi/izdavanjeNagrade.js` [D], `backend/src/rute/nagrade.js` [D], `backend/src/aplikacija.js` [I].
- Crveno: testovi napisani prvi → ruta ne postoji (404 `NOT_FOUND` umjesto očekivanih kodova); izlaz zabilježen. Zeleno poslije 5.2, 5.5–5.7, sekcija 6 (po odobrenom `i04/P-1`).
- Dokaz: `npm test`, `npm run test:emu` PASS; `provjera.ps1` → 0.
- Commit: `i04: POST /rewards/{rewardId}/issue u jednoj Firestore transakciji sa reconcile-om, RESERVE i mapping-om (API-T05, API-T06)`

**Korak 5: Atomičnost, konkurentnost, idempotentnost i rok (API-T07, I04-T10 … I04-T15)**
- Fajlovi: `backend/test/emulator/izdavanjeAtomicnost.test.js` [D].
- Samo testovi (kod iz koraka 4); test-first se dokazuje kontrolnim mutacijama (M01–M07, M10, M18, M31, M32) koje ove testove obaraju (kao i03 OD-3).
- Dokaz: `npm run test:emu` PASS 3 uzastopna izvršavanja (API-T07, I04-T10, I04-T12 statistika iz `t.diagnostic`); `provjera.ps1` → 0.
  Ako se pojavi 500 pod kontencijom, Builder STAJE i javlja (R18).
- Commit: `i04: testovi double-spend-a, release-a najviše jednom, paralelnog retry-ja, kasnog commit-a i roka (API-T07)`

**Korak 6: Log bez tajni i smoke (I04-T16; `provjera.ps1`)**
- Fajlovi: `backend/test/emulator/logIzdavanja.test.js` [D], `skripte/provjera.ps1` [I] (UTF-8 BOM, CRLF).
- Dokaz: `npm run test:emu` PASS; `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 sa četvrtim smoke-om (`Smoke: 401 UNAUTHENTICATED` za `/rewards/CAR_WASH/issue`).
- Commit: `i04: test loga bez tajni za API-03 i smoke 401 za /rewards/{rewardId}/issue`

**Korak 7: Kontrolne mutacije (bez commit-a koda)** — M01 … M41, svaka lokalno pa `git restore`; ishod (komanda, ciljani test, `ℹ fail`, exit) u TEST_REPORT.
Preživjela mutacija → dopuna testa u zasebnom commit-u `i04: ojačan test … (nalaz kontrolne mutacije Mnn)` + `provjera.ps1` → 0.

**Korak 8: Dokumentacija checkpoint-a i PR**
- Fajlovi: `docs/TEST_REPORT.md` (sekcija i04: stvarni izlaz komandi iz brief-a tačka 8, `test:emu` ×3, `provjera.ps1` ×2, rezultat po ID-u, statistika API-T07 /
  I04-T10 / I04-T12, mutacije, poređenje rules sa `.docx`, inspekcije iz sekcije 9; ispravka F1-01 na linijama 1774, 1776, 1783 — samo `firebase<TAB>ests` →
  `firebase\tests`, ništa drugo), `docs/IMPLEMENTATION_LOG.md` (unos i04: CHANGELOG, commit-i, fajlovi, odstupanja, status `i04/P-n`, ograničenja za buduće
  iteracije iz sekcije 12, poznata ograničenja: P-2 satovi, P-9/P-10 neprovjerljivo nad produkcijom, P-14, P-16), `docs/TRACEABILITY.md` (redovi Iteracije 4
  iz brief-a tačka 5; tabela O-1: `requestId` po O-15, `NOT_FOUND` i za D-5), `docs/ODLUKE.md` (status O-14, O-15, O-16, D-4, D-5; odluke `i04/P-n` iz
  sekcije 15; ograničenja; F1-01 zatvoren; stanje iteracija), `README.md` (API-03, 11.2).
- Dokaz: `git diff main -- docs/srs` prazno; hash odgovara; `provjera.ps1` → 0 dva puta zaredom.
- Commit: `i04: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost, registar odluka i README za iteraciju 4`
- PR: `gh pr create --base main --head iteracija-04 --title "i04: Reward issue"`, opis na srpskom (isporuka A–G, brief tačka 9), bez potpisa alata. BEZ merge-a i BEZ taga.

## 15. Odluke Orchestrator-a (odobrenje plana)

Plan je ODOBREN (Orchestrator, 2026-10-17) uz ispravke K-1 … K-3 ispod. Ana je odluke O-14, O-15 i O-16 donijela 2026-10-17 (brief, tačka 5).

i04/P-1  Odobreno: 201 za novi voucher, 200 za retry; tijelo TAČNO { voucherId, rewardId, costPoints, status, issuedAt, expiresAt } tim redoslijedom
         ključeva, ista funkcija odgovorVaucera za 201 i 200 (201 iz upisanog objekta, 200 iz SAČUVANOG voucher dokumenta); issuedAt/expiresAt =
         toDate().toISOString(); status = trenutni status sačuvanog voucher-a. Bez uid-a, requestId-a, requestKey-a, ID-eva ledger događaja, balance-a i
         redeemedAt/cancelledAt/redeemedAtStationId.
i04/P-2  Odobreno: sadaMs = Date.now() jednom po pokušaju transakcije, na početku callback-a; issuedAt = Timestamp.fromMillis(sadaMs), expiresAt =
         Timestamp.fromMillis(sadaMs + 900 000); reconcile poredi isti sadaMs (jeIstekao: sadaMs ≥ expiresAt). Ledger createdAt, mapping createdAt i
         loyaltyAccounts.updatedAt = jedan FieldValue.serverTimestamp() po transakciji. Razlika satova Backend/Firestore ide u poznata ograničenja.
i04/P-3  Odobreno: voucherId = crypto.randomBytes(32).toString('hex') (64 znaka [0-9a-f], 256 bita), generisan u callback-u, poziv preko default
         importa crypto; provjera zauzetosti (vouchers/{id} i reserve_{id}) prije upisa → 500.
i04/P-4  Odobreno: requestKey = SHA-256 nad UTF-8 bajtovima uid + ":" + requestId, hex malim slovima; vektor C3 u unit testu.
i04/P-5  Odobreno i OBAVEZUJE i05 i i06: loyaltyLedger/reserve_{voucherId} i loyaltyLedger/release_{voucherId}, samo tx.create, uz eksplicitnu
         provjeru postojećeg release_{voucherId} prije upisa (→ 500). Prefiks redeem_ je rezervisan za i06.
i04/P-6  Odobreno: release-i po expiresAt rastuće, pa po voucherId rastuće (poređenje stringova, bez localeCompare); po voucher-u prvo update statusa,
         pa create release_; lanac release-i → RESERVE; svi događaji transakcije imaju isti createdAt.
i04/P-7  Odobreno po tabeli 5.1 i pseudokodu 5.5, uključujući (a)–(e) i listu nekonzistentnih stanja na kraju 5.5. Redoslijed čitanja i redoslijed i broj
         upisa (1 … 2k release-i, 2k+1 nalog, 2k+2 voucher, 2k+3 RESERVE, 2k+4 mapping; O-14 grana 1 … 2k, pa 2k+1 nalog) su obavezujući.
i04/P-8  Odobrena opcija A: stvaran redoslijed je neispravan JSON (422 INVALID_REQUEST) → D-5 (404 NOT_FOUND). U odrediKod:
         err instanceof URIError && err.status === 400 → NOT_FOUND, globalno; log "(nepoznata ruta)", bez stack-a i bez poruke greške. Vidi K-1.
i04/P-9  Odobreno: zajednička jeIspravanIdDokumenta u validacija/identifikator.js (premještena iz tijeloKupovine.js bez promjene logike; I03-T09 je
         regresioni dokaz) + zabrana \p{Cc} samo za rewardId. loyaltyUid se u i04 ne mijenja (backlog, K-2).
i04/P-10 Potvrđeno: tx.get(query) radi nad emulatorom; firebase/firestore.indexes.json se ne mijenja; neprovjerljivost nad produkcijom ide u poznata ograničenja.
i04/P-11 Odobreno: omotacBaze.sakrijPostojece važi i za dokumente u rezultatu tx.get(query); postojeće grane omotača nepromijenjene; mock
         crypto.randomBytes samo iz testova.
i04/P-12 Odobreno: prvo ispravnost definicije (costPoints siguran cijeli broj ≥ 1, active boolean) → 500, tek onda active === false → 409 REWARD_INACTIVE.
i04/P-13 Prihvaćeno (informativno): neuspješan issue ne pravi mapping, pa isti requestId može kasnije uspjeti; O-14: 409 može doći uz već vraćene bodove.
         Oboje upisati u README (API-03).
i04/P-14 Prihvaćeno (informativno): Express ruter je case-insensitive i nije strict; ne mijenja se.
i04/P-15 Prihvaćene oznake I04-T01 … I04-T17 sa podtačkama.
i04/P-16 Prihvaćeno kao poznato ograničenje: broj ACTIVE voucher-a u upitu reconcile-a nije ograničen.

Ispravke plana (obavezujuće):
K-1 Brief i04, tačka 5, "Redoslijed provjera": umjesto "dekodiranje parametra (D-5) → neispravan JSON (422) → token (401)" važi
    "neispravan JSON (422) → dekodiranje parametra (D-5, 404 NOT_FOUND) → token (401) → …" (i04/P-8). Brief se ne mijenja; ova odluka ima prednost.
K-2 docs/ODLUKE.md (korak 8), sekcija "8. Backlog": nova stavka
    "B-1 (i04/P-9) | P3 | loyaltyUid (API-02) sa NUL ili kontrolnim znakom prolazi provjeru formata i ide do Firestore-a (u emulatoru 404 iz transakcije;
    produkcija neprovjerljiva) | odluka prije i08". Kod API-02 se u i04 ne mijenja.
K-3 API-T07 dodatno: među 20 ponavljanja mora biti bar jedno sa ishodom tačno {201, 409 INSUFFICIENT_POINTS} — dokaz da je drugi zahtjev odbila
    provjera bodova u transakciji, a ne samo kontencija (503); inače test pada. Ako se to ne postigne ni u jednom od 3 uzastopna izvršavanja,
    Builder STAJE i javlja (kao R18).

### FIX LOOP 1 — odluke Orchestrator-a

Odgovor na review i04 (`docs/iteracije/i04_review.md`, ITERATION REJECTED, commit `d3e6d6a`). Builder ispravlja tačno R-01, R-02 i R-04 i
dokumentaciju usklađuje sa stvarnim stanjem (R-03).

O-17 (odgovor na review P-1 / R-03): tehnika tx.get(query) nad vouchers ZADRŽAVA SE (propisana brief-om, tačka 5). Opcija B (upit van
     transakcije + tx.getAll kandidata) se NE uvodi: mijenja zamrznutu tehniku, otvara prozor između upita i sadaMs i nije potrebna za SRS
     (NFR-06 je ispunjen, stanje je uvijek konzistentno). Ispravlja se samo dokumentovano ograničenje: u emulatoru tx.get(query) serijalizuje
     izdavanja i RAZLIČITIH korisnika (izmjereno u reviewu: K=2 → 3,6 s; K=5 → 9 pokušaja; K=10 → 2×503; K=15 → 11×503); ponašanje
     produkcionog Firestore-a nije provjereno. Novi backlog B-2: ako se kontencija pokaže u demu (i09), razmotriti opciju B uz novu odluku.
     Posljedica: zaštita od double-spend-a se NE smije oslanjati na bravu upita, pa R-01 test mora raditi nezavisno od nje.
O-18 (odgovor na review P-2 / R-04): serverski log za neočekivane (5xx) greške transakcije NE SMIJE sadržati putanje dokumenata,
     requestKey ni voucherId, ni u poruci ni u stack-u. Popravlja se u ovom FIX LOOP-u, globalno u centralnom rukovaocu greškama.
Napomene N-01…N-08 iz reviewa ne blokiraju. Obavezno: N-08 (duple oznake (f) i (g) u ODLUKE §6) ispraviti; N-01 (O-16 retry vraća
     sačuvani status ACTIVE i za voucher kojem je expiresAt prošao; i05/API-06 to zatvara) upisati kao ograničenje za i05.

### FIX LOOP 2 — odluke Orchestrator-a

Odgovor na re-review i04 (`docs/iteracije/i04_review_fix1.md`, ITERATION REJECTED, commit `54b2e0b`). R-01, R-02, R-03 i R-04 (oblik iz
prvog reviewa) su ZATVORENI i ne diraju se. Builder ispravlja R-06 i R-05, upisuje obaveze iz N-09 i vraća dokumentaciju u red.

- P-3 (R-05): ispravlja se u FIX LOOP-u 2 zajedno sa R-06 (opcija A). Redakcija loga 5xx grešaka NE SMIJE zavisiti od oblika poruke
  Firestore greške (emulator i produkcija se razlikuju). O-18 ostaje globalan.
- P-4 (N-09): upisuje se u ODLUKE §6 kao OBAVEZA za i07: poseban test po uzoru na I04-T18 (konkurentna promjena accountStatus naloga
  ili brisanje naloga dok izdavanje drži transakciju; voucher ne smije biti izdat poslije početka brisanja). Jednako za čitanje users i
  rewardDefinitions u transakciji — provjeriti da su van i04 pokrivena testom čim neki API počne mijenjati te dokumente.
- Napomene N-10…N-14: N-10 se zatvara ispravkom iz koraka 2; N-11 (Express finalhandler za res.headersSent), N-12 (I04-T19 je vezan za
  fajl i broj čitanja Date.now pri ulasku; refaktor sata u i05/i06 mora uskladiti test) i N-13 (redoslijed oznaka (l) ispred (j) u ODLUKE §6)
  upisuju se u ODLUKE (N-13 se samo ispravlja).
