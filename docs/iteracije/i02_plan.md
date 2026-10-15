# i02 — Plan (PLANNER)

Iteracija 2: Account lifecycle + authentication boundary. Grana `iteracija-02`.
Izvori: `CLAUDE.md`, `docs/iteracije/i02_brief.md`, SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`, normativan; `.md` čitljiva kopija),
`docs/TRACEABILITY.md`, `docs/iteracije/i01_plan.md` (sekcija 14: odluke P-1 … P-8, K-1 … K-4), `docs/IMPLEMENTATION_LOG.md`.
Datum plana: 2026-10-15. Uloga: PLANNER (bez koda).

Oznake otvorenih pitanja u ovom planu su `i02/P-n` (sekcija 13), da se ne miješaju sa `P-n` iz i01.

---

## 1. SRS zahtjevi u opsegu

| SRS | Šta se u i02 radi | Napomena |
|---|---|---|
| §3.1, §3.2 | Android je untrusted: Backend ne vjeruje nijednom polju koje identifikuje korisnika ili mijenja server-controlled stanje. Tijelo API-01 je strogo (tačno dva polja). | Mass assignment zaštita, brief tačka 2. |
| §3.3, NFR-01 | Posrednik za zaštićene Android endpointe: `Authorization: Bearer <Firebase-ID-token>` → `auth.verifyIdToken(token, true)` (checkRevoked). UID samo iz `decodedToken.uid`. Svaki neuspjeh verifikacije → 401 `UNAUTHENTICATED`. Token se ne loguje i ne vraća. | Ograničenje emulatora (nepotpisani token-i) ide u TEST_REPORT. |
| NFR-01 (zaštita) | Backend odbija start ako postoji `FIRESTORE_EMULATOR_HOST` ili `FIREBASE_AUTH_EMULATOR_HOST`, a `FIREBASE_PROJECT_ID` ne počinje sa `demo-`. | Odluka Orchestrator-a (brief tačka 5). |
| §5 AUTH-01 (samo API dio), AUTH-02, §26 API-01 | `POST /api/v1/account/init`, ulaz `{ displayName, acceptedTermsVersion }`. Jedna Firestore transakcija kreira `users/{uid}` i `loyaltyAccounts/{uid}`; svi timestamp-ovi serverski. | Android dio AUTH-01 je Iteracija 9. |
| AUTH-03 | Auth nalog postoji, `users/{uid}` ne postoji → init kreira nalog. Djelimično stanje po prijedlogu `i02/P-2`. | `ACCOUNT_NOT_INITIALIZED` je i04. |
| AUTH-04 | Postojeći `users/{uid}` sa `accountStatus = "ACTIVE"`: ponovljeni init ne mijenja ništa i vraća postojeće stanje (API-T01). | — |
| AUTH-05 | `accountStatus = "DELETION_IN_PROGRESS"` → 409 `ACCOUNT_DELETION_IN_PROGRESS`, ništa se ne mijenja. | Sam workflow brisanja je Iteracija 7. |
| AUTH-10, odluka O-11 | `acceptedTermsVersion` mora biti string jednak aktuelnoj verziji iz konfiguracije (env varijabla, vrijednost `"1.0"`), inače 422 `INVALID_REQUEST`. `acceptedTermsAt` = server timestamp. | Naziv varijable: `i02/P-4`. |
| §7.1, §7.2 | `loyaltyAccounts/{uid}` = tačno `{ availablePoints: 0, reservedPoints: 0, createdAt, updatedAt }`, bez `lifetimeEarnedPoints`; invarijante ≥ 0. | — |
| §11 (negativno) | Init NE pravi ledger event (§11 nema tip za kreiranje naloga). Test provjerava da je `loyaltyLedger` prazan. | Brief tačka 3. |
| §27, O-1 | Kodovi u opsegu: `UNAUTHENTICATED` 401, `ACCOUNT_DELETION_IN_PROGRESS` 409, `INVALID_DISPLAY_NAME` 422, `INVALID_REQUEST` 422, `INTERNAL_ERROR` 500, `SERVICE_UNAVAILABLE` 503 (i postojeći `NOT_FOUND` 404). Nijedan novi kod. | Katalog se ne mijenja. |
| NFR-04 | Atomičnost init-a dokazana failure injection testom (I02-T08). | — |
| §24 | Koriste se postojeće konstante `KOLEKCIJE.users`, `KOLEKCIJE.loyaltyAccounts`. | — |
| §25.1, §25.2, §25.3, §25.10, §31, NFR-03 | `firebase/firestore.rules`: doslovno iz §31 helper funkcije `signedIn`, `isOwner`, `ownResource`, `changedOnly` i blokovi `/users/{uid}` i `/loyaltyAccounts/{uid}`; default deny ostaje posljednji. RULE-T01 … RULE-T07. | Ostale kolekcije: i03–i06 (odluka D-2). |

## 2. SRS zahtjevi van opsega

| SRS | Iteracija | Zašto nije sada |
|---|---|---|
| §26 API-02 … API-07, §7.3 … §7.6, svaka loyalty mutacija | 3–7 | Brief tačka 3. |
| §11 ledger eventi | 3–7 | Init nema ledger event. |
| `ACCOUNT_NOT_INITIALIZED` „account gate” za druge endpointe | 4 | Prvi endpoint koji ga vraća. |
| §3.4, NFR-02 POS autentikacija | 3 | — |
| `REAUTHENTICATION_REQUIRED`, recent auth, DELETE /account, §23 | 7 | — |
| AUTH-01 (Android dio), AUTH-06 … AUTH-09, UI-01 … UI-08, retry init-a, promjena displayName-a iz aplikacije | 9, 10 | Android. |
| §3.5, §3.6 (Email Enumeration Protection, password policy, e-mail verifikacija) | 9 / O-2 | §1.3, brief tačka 3. |
| §25.4 … §25.9 i odgovarajući §31 blokovi, RULE-T08 … RULE-T11 | 3–8 (D-2) | — |
| FCM, Cloud Functions, health/status ili bilo koji dodatni endpoint | nikad | §1.3, §26 (tačno 7 endpointa). |

## 3. Zatečeno stanje repozitorijuma

Provjereno 2026-10-15 (samo čitanje):

- `git fetch`, `git status -sb` → `## iteracija-02...origin/iteracija-02`, radni direktorijum čist.
- HEAD `236ed89 i02: Iteration Brief (Orchestrator)`; `git diff --stat main HEAD` → samo `docs/iteracije/i02_brief.md` (+136).
- `main` = `origin/main` = tag `i01` (anotiran: „i01: Bootstrap i test infrastruktura - ITERATION ACCEPTED”) = `dabe3c0`; `i01` je predak HEAD-a.
- `docs/iteracije/i01_review_fix1.md` → `ITERATION ACCEPTED`; otvoreni P3 nalazi N-01 i N-02 nisu dio i02 brief-a (ne rade se).
- Preduslov `.\skripte\provjera.ps1` na kodu identičnom `main`: rezultat u sekciji 3.1.
- Backend: `aplikacija.js` (fabrika `napraviAplikaciju(opcije)` sa `opcije.dodajRute` samo za test), `pokreni.js` (konfiguracija → listen, bez Admin SDK-a), `konfiguracija.js` (`PORT`, `FIREBASE_PROJECT_ID`), `firebase/inicijalizacija.js` (`inicijalizujFirebaseAdmin({ projectId })` → `{ app, db, auth }`), katalog grešaka 23 + O-1, centralni rukovalac, `dnevnik.js`.
- `firebase/firestore.rules` = samo default deny; `firebase/tests/podrazumijevanaZabrana.test.js` = RULE-T12 (preliminarno) + I01-T10 (`users`, `loyaltyLedger`).
- Instalirani `firebase-admin` 14.5.0 (pregledan izvor u `node_modules`, bez izmjena):
  - `verifyIdToken(idToken, checkRevoked)` u emulator režimu preskače provjeru potpisa i UVIJEK radi `getUser(sub)`; `disabled` → `auth/user-disabled`; `auth_time * 1000 < tokensValidAfterTime` → `auth/id-token-revoked` (granularnost: sekunda; vidi 7.4);
  - emulator režim za Auth se čita iz `process.env.FIREBASE_AUTH_EMULATOR_HOST` pri svakom pozivu; Firestore klijent `FIRESTORE_EMULATOR_HOST` ima prednost nad `settings({ host })`. Zato se testovi nedostupnosti rade u zasebnom procesu (5.6, I02-T11);
  - transakcije: `maxAttempts` podrazumijevano 5 (`DEFAULT_MAX_TRANSACTION_ATTEMPTS`).
- Normativni §31 je provjeren direktno u `.docx` (`word/document.xml`, odlomak sa fontom Consolas, prelomi `w:br`). `.md` kopija ima pandoc escape-ove (`\[`, `\]`, `\*\*`, `\>=`), pa se NE kopira iz `.md`. Ciljni tekst je u 11.3.

### 3.1 Preduslov: `provjera.ps1`

`powershell -NoProfile -ExecutionPolicy Bypass -File .\skripte\provjera.ps1` na HEAD `236ed89` (kod identičan `main`/`i01`)
→ `EXIT=0`, 93 s, `SVE PROVJERE PROŠLE`: backend `npm test` 22/22, `test:emu` 6/6, smoke 404 `NOT_FOUND`,
rules 5/5, `assembleDebug` i `testDebugUnitTest` BUILD SUCCESSFUL. Zeleni checkpoint postoji.
(Prvi pokušaj je pao na `npm ci` sa `EBUSY` jer je Planner-ova ljuska bila pozicionirana u `backend/node_modules`;
to nije nalaz o repozitorijumu.)

## 4. Fajlovi (dodati / izmijeniti / netaknuto)

Legenda: **[D]** dodati, **[I]** izmijeniti, **[N]** netaknuto.

```
/
├── .env.example                              [I] + VERZIJA_USLOVA=1.0 (i02/P-4)
├── README.md                                 [I] VERZIJA_USLOVA, API-01 ukratko, zaštita emulator/demo, test komande nepromijenjene
├── skripte/provjera.ps1                      [I] smoke: VERZIJA_USLOVA u env; dodatni smoke POST /api/v1/account/init bez tokena → 401 UNAUTHENTICATED; zaglavlje bez „Iteraciju 1”
├── firebase/
│   ├── firestore.rules                       [I] §31 doslovno: signedIn, isOwner, ownResource, changedOnly, /users/{uid}, /loyaltyAccounts/{uid}, default deny (11.3)
│   └── tests/
│       ├── podrazumijevanaZabrana.test.js    [I] I01-T10 bez users dijela (ostaje loyaltyLedger); komentar zaglavlja
│       └── korisnikINalog.test.js            [D] RULE-T01 … RULE-T07, I02-T15
├── backend/
│   ├── src/
│   │   ├── aplikacija.js                     [I] opcije.servisi ({ db, auth }) i opcije.verzijaUslova; montira rute naloga na /api/v1
│   │   ├── pokreni.js                        [I] konfiguracija (uklj. zaštitu emulator/demo) → inicijalizujFirebaseAdmin → napraviAplikaciju({ servisi, verzijaUslova }) → listen
│   │   ├── konfiguracija/konfiguracija.js    [I] VERZIJA_USLOVA (obavezna) i zaštita emulator/demo (NFR-01); ROK_ZAVISNOG_SERVISA_MS
│   │   ├── posrednici/autentikacija.js       [D] napraviProvjeruTokena(auth): Bearer → verifyIdToken(token, true) → res.locals.uid
│   │   ├── rute/nalog.js                     [D] dodajRuteNaloga(ruter, { servisi, verzijaUslova }): POST /account/init
│   │   ├── validacija/tijeloInita.js         [D] provjeriTijeloInita(tijelo, verzijaUslova) → { displayName, acceptedTermsVersion } ili GreskaApi
│   │   ├── servisi/inicijalizacijaNaloga.js  [D] inicijalizujNalog(db, { uid, displayName, acceptedTermsVersion }) — JEDNA transakcija
│   │   └── greske/greskeServisa.js           [D] saRokom(obecanje, ms), klasifikujGreskuAuth(err), jeNedostupnostFirestore(err)
│   │   (ostalo [N]: dnevnik.js, greske/katalogGresaka.js, GreskaApi.js, obradaGresaka.js, posrednici/korelacija.js,
│   │    podaci/kolekcije.js, firebase/inicijalizacija.js, punjenje/*, skripte/napuniEmulator.js, package.json, package-lock.json)
│   └── test/
│       ├── pomocnici/
│       │   ├── emulator.js                   [N]
│       │   ├── presretanjeLoga.js            [D] presretniLog() i tekstLoga() premješteni iz aplikacija.test.js (bez promjene ponašanja)
│       │   ├── authEmulator.js               [D] napraviKorisnika() preko Auth emulator REST-a; napraviNepotpisanToken({...}) za istekao/tuđi token
│       │   └── procesBackenda.js             [D] pokreniBackend(env) (spawn src/pokreni.js), slobodanPort(), crnaRupa() (TCP server koji ne odgovara)
│       ├── jedinicni/
│       │   ├── aplikacija.test.js            [I] samo import presretniLog/tekstLoga iz pomocnici/presretanjeLoga.js
│       │   ├── konfiguracija.test.js         [I] I01-T06 prilagođen novoj obaveznoj varijabli (i02/P-4); I02-T13 (a)
│       │   ├── pokretanjeBackenda.test.js    [D] I02-T13 (b) spawn sa emulator varijablom i ne-demo projektom
│       │   └── greskeServisa.test.js         [D] I02-T11 (a) saRokom i klasifikacija grešaka (bez mreže)
│       └── emulator/
│           ├── autentikacija.test.js         [D] I02-T01, I02-T02, I02-T03, I02-T16
│           ├── inicijalizacijaNaloga.test.js [D] API-T01, I02-T04 … I02-T10, I02-T14
│           ├── logBezTokena.test.js          [D] I02-T12
│           └── nedostupnostServisa.test.js   [D] I02-T11 (b) spawn pokreni.js sa nedostupnim Firestore/Auth
└── docs/
    ├── TRACEABILITY.md                       [I] samo redovi Iteracije 2: Kod, Status, Planirani test; AUTH-03 tekst po brief-u
    ├── IMPLEMENTATION_LOG.md                 [I] unos i02
    ├── TEST_REPORT.md                        [I] sekcija i02 (stvarni izlaz) + poznato ograničenje (nepotpisani token-i)
    ├── srs/*                                 [N] hash se provjerava
    └── iteracije/i02_brief.md                [N]; i02_plan.md (ovaj fajl)
```

Nijedan novi npm paket. `backend/package.json` (uklj. skripte `test`, `test:emu`) i `firebase/tests/package.json` se ne mijenjaju: glob-ovi `test/jedinicni/*.test.js`, `test/emulator/*.test.js` i `*.test.js` već obuhvataju nove fajlove.

Imenovanje: `rute/`, `validacija/`, `servisi/` i nazivi fajlova su na srpskom; SRS nazivi (`users`, `loyaltyAccounts`, `displayName`, `acceptedTermsVersion`, `accountStatus`, kodovi grešaka) ostaju tačno kako piše u SRS-u.

## 5. Data-flow i granice

### 5.1 Tok zahtjeva `POST /api/v1/account/init`

```
korelacija → parsirajJson (i01) → /api/v1 ruter
  → ruta POST /account/init:
      1. provjeraTokena (posrednik, 5.2)         → 401 UNAUTHENTICATED | 503 | 500; res.locals.uid
      2. provjeriTijeloInita(req.body, verzija)  → 422 INVALID_REQUEST | 422 INVALID_DISPLAY_NAME   (5.3)
      3. inicijalizujNalog(db, {uid, ...})       → 409 ACCOUNT_DELETION_IN_PROGRESS | 503 | 500     (5.4)
      4. res.status(kreirano ? 201 : 200).json(stanje)                                            (6)
  → nepoznataRuta (NOT_FOUND) → centralniRukovalacGreskama (i01, nepromijenjen)
```

- Posrednik se veže SAMO na rutu (`ruter.post('/account/init', provjeraTokena, obradi)`), ne na prefiks `/account`. Zato `GET /api/v1/account/init` i `POST /api/v1/account/nepostojeca` ostaju 404 `NOT_FOUND` (i01 konvencija), a ne 401 (I02-T16).
- JSON parser je iz i01 montiran na nivou aplikacije, PRIJE rutera. Neispravan JSON zato daje 422 i bez token-a. Parsiranje nije business obrada i ništa se ne čita iz baze; vidi `i02/P-6`.
- Handler je `async`; Express 5 prosljeđuje odbijene promise-e centralnom rukovaocu (i01, 5.1 tačka 8).
- `res.locals.uid` je JEDINI izvor UID-a za rutu. Handler nikad ne čita `req.body.uid`, `req.query`, `req.params` ni zaglavlja osim `Authorization` (u posredniku).

### 5.2 Posrednik `napraviProvjeruTokena(auth)` (`posrednici/autentikacija.js`)

1. `const zaglavlje = req.get('authorization')`. Ako nije string → `GreskaApi('UNAUTHENTICATED')`.
2. Šema: regex `^Bearer ([^\s]+)$` sa zastavicom `i` za naziv šeme (RFC 7235 §2.1: šema je case-insensitive; vidi `i02/P-7`). Tačno jedan razmak, token bez whitespace-a. `Basic …`, `Bearer`, `Bearer ` (prazno), `Bearer a b`, `Bearer  x` (dva razmaka), `Token x` → 401.
3. `await saRokom(auth.verifyIdToken(token, true), ROK_ZAVISNOG_SERVISA_MS)`.
4. Uspjeh: `res.locals.uid = dekodiran.uid`; `next()`. Ništa drugo iz token-a se ne koristi.
5. Greška → `klasifikujGreskuAuth(err)` (5.5): token/korisnik → `UNAUTHENTICATED`; nedostupnost/rok → `SERVICE_UNAVAILABLE`; ostalo → `INTERNAL_ERROR`.
   Posrednik UVIJEK baca novu `GreskaApi(kod)`; originalna greška Admin SDK-a se ne prosljeđuje dalje (ni kao `cause`), da ni stack u logu za 5xx ne može sadržati dio token-a.
6. Promjenljiva `token` se ne upisuje u `res.locals`, `req`, log ni odgovor.

### 5.3 Validacija tijela `provjeriTijeloInita(tijelo, verzijaUslova)` (`validacija/tijeloInita.js`)

Redoslijed je obavezujući (prvi neuspjeh određuje kod):

1. `tijelo` nije običan objekat (`undefined` jer Content-Type nije JSON, `null`, niz, string, broj, boolean) → `INVALID_REQUEST`.
2. `Object.keys(tijelo)` sadrži bilo koji ključ osim `displayName` i `acceptedTermsVersion` (npr. `uid`, `accountStatus`, `availablePoints`, `reservedPoints`, `createdAt`, `updatedAt`, `acceptedTermsAt`, `__proto__`, `constructor`) → `INVALID_REQUEST`. Provjera ide preko `Object.keys` (sopstveni ključevi; `JSON.parse` daje `__proto__` kao sopstveni ključ).
3. `displayName` nedostaje, nije string, ili mu dužina nije 1–100 → `INVALID_DISPLAY_NAME`. Dužina: `i02/P-3` (prijedlog: broj Unicode code point-a, `[...s].length`). Bez trim-a i normalizacije (SRS ih ne traži).
4. `acceptedTermsVersion` nedostaje, nije string, ili `!== verzijaUslova` (stroga jednakost, bez trim-a) → `INVALID_REQUEST`.
5. Vraća NOVI objekat `{ displayName, acceptedTermsVersion }` (nikad `tijelo` po referenci).

Validacija ide PRIJE čitanja baze: neispravan zahtjev za postojeći nalog daje 422, ne 200.

### 5.4 Transakciona granica `inicijalizujNalog(db, { uid, displayName, acceptedTermsVersion })`

```
refUser  = db.collection(KOLEKCIJE.users).doc(uid)
refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid)

rezultat = await saRokom(db.runTransaction(async (tx) => {
  [snapUser, snapNalog] = await tx.getAll(refUser, refNalog)        // oba čitanja u ISTOJ transakciji

  ako snapUser.exists:
     status = snapUser.get('accountStatus')
     ako status === 'DELETION_IN_PROGRESS' → throw GreskaApi('ACCOUNT_DELETION_IN_PROGRESS')   // ništa se ne piše
     ako status !== 'ACTIVE'               → throw new Error('neočekivan accountStatus')       // → 500, ništa se ne piše

  vrijeme = FieldValue.serverTimestamp()
  kreirano = false
  ako !snapUser.exists:
     tx.create(refUser, { displayName, accountStatus: 'ACTIVE', createdAt: vrijeme, updatedAt: vrijeme,
                          acceptedTermsVersion, acceptedTermsAt: vrijeme });  kreirano = true
  ako !snapNalog.exists:                                                    // vidi i02/P-2
     tx.create(refNalog, { availablePoints: 0, reservedPoints: 0, createdAt: vrijeme, updatedAt: vrijeme });  kreirano = true

  return { kreirano, stanje: <izvedeno iz snap-ova ili upisanih vrijednosti, oblik iz sekcije 6> }
}, { maxAttempts: 5 }), ROK_ZAVISNOG_SERVISA_MS)
```

Pravila za Builder-a:

- Oba upisa su `tx.create` (ne `set`, ne `update`): i kad bi se zaobišlo čitanje, commit ne može prepisati postojeći dokument (`ALREADY_EXISTS`).
- Postojeći dokument se NIKAD ne piše (ni `updatedAt`). API-T01 i I02-T14 to provjeravaju poljem po polje, uključujući timestamp-ove.
- Callback transakcije se može izvršiti više puta (retry na contention). Callback nema sporednih efekata van `tx` (nema brojača, logova, keša); `kreirano` i `stanje` se računaju svaki put iznova.
- Nema ledger eventa, notifikacije ni bilo kog trećeg dokumenta.
- Nijedno polje iz zahtjeva osim `displayName` i `acceptedTermsVersion` ne ulazi u dokument; `accountStatus`, `createdAt`, `acceptedTermsAt`, bodovi su konstante/serverski.
- `uid` se koristi samo kao `doc(uid)`, nikad u spojenom stringu putanje.
- `maxAttempts: 5` je podrazumijevana vrijednost SDK-a, navedena eksplicitno. Ako I02-T09 pokaže `ABORTED` poslije 5 pokušaja, Builder smije podići na 10 i to upisuje u IMPLEMENTATION_LOG sa izlazom testa. Testovi se ne slabe.
- Greške van callback-a (5.5): `GreskaApi` prolazi; nedostupnost/rok/`ABORTED` → `SERVICE_UNAVAILABLE`; sve ostalo → izvorna greška → 500 `INTERNAL_ERROR` (stack samo u serverskom logu; sadrži putanju dokumenta sa uid-om, ne token).

### 5.5 Rok i klasifikacija grešaka zavisnih servisa (`greske/greskeServisa.js`)

- `ROK_ZAVISNOG_SERVISA_MS = 10_000` (konstanta u `konfiguracija.js`, nije env varijabla). Brief traži odgovor u roku < 15 s. 10 s ostavlja prostor za prvi poziv Admin SDK-a (i01: `MetadataLookupWarning` dodaje ~3–4 s).
- `saRokom(obecanje, ms)`: `Promise.race` sa tajmerom; istek → `GreskaApi('SERVICE_UNAVAILABLE')`; tajmer se uvijek čisti (`finally`) i ima `unref()`, da ne drži proces.
- Posljedica roka: transakcija kojoj je istekao rok može se ipak commit-ovati poslije 503 odgovora. Stanje je i tada konzistentno (oba dokumenta ili nijedan), a ponovljeni init vraća postojeće stanje (idempotentnost). Ovo se upisuje u IMPLEMENTATION_LOG kao poznato ponašanje (`i02/P-5`).
- `klasifikujGreskuAuth(err)` po `err.code`:
  - 401: `auth/argument-error`, `auth/invalid-id-token`, `auth/id-token-expired`, `auth/id-token-revoked`, `auth/user-disabled`, `auth/user-not-found` — samo kodovi koji znače „token ili korisnik nije važeći”. Builder u TEST_REPORT upisuje stvarne kodove dobijene u I02-T02/T03; ako se pojavi drugi kod koji se odnosi na token ili korisnika (iz `firebase-admin/lib/auth/error.js`), dodaje ga i navodi u IMPLEMENTATION_LOG;
  - 503: `app/network-error`, `app/network-timeout`, `GreskaApi('SERVICE_UNAVAILABLE')` iz `saRokom`;
  - sve ostalo → 500 `INTERNAL_ERROR`.
  Stvaran kod koji Admin SDK daje kad Auth emulator nije dostupan (zatvoren port) Builder utvrđuje u I02-T11 i upisuje u TEST_REPORT; ako nije u listi 503, staje i javlja (ne širi listu nagađanjem).
- `jeNedostupnostFirestore(err)`: gRPC `err.code` ∈ { 14 `UNAVAILABLE`, 4 `DEADLINE_EXCEEDED`, 10 `ABORTED` } (`ABORTED` = contention poslije svih pokušaja; vidi `i02/P-5`).

### 5.6 Start Backend-a (`pokreni.js`, `konfiguracija.js`)

```
ucitajKonfiguraciju(process.env)                     // fail fast, poruke bez vrijednosti
  - PORT, FIREBASE_PROJECT_ID (i01), VERZIJA_USLOVA (neprazan string; i02/P-4)
  - zaštita NFR-01: ako je u env-u DEFINISANA (bilo koja vrijednost, i prazna) FIRESTORE_EMULATOR_HOST
    ili FIREBASE_AUTH_EMULATOR_HOST, a FIREBASE_PROJECT_ID ne počinje sa "demo-" → GreskaKonfiguracije
    („emulator varijable su postavljene, a FIREBASE_PROJECT_ID ne počinje sa demo-”; bez vrijednosti)
  → Object.freeze({ port, projectId, host: '127.0.0.1', verzijaUslova })
inicijalizujFirebaseAdmin({ projectId })             // tek POSLIJE zaštite; i01 funkcija bez izmjene
napraviAplikaciju({ servisi: { db, auth }, verzijaUslova }).listen(port, host)
```

- Greška konfiguracije: postojeći tok (`Greška konfiguracije: …` na stderr, `exitCode = 1`, bez listen-a i bez inicijalizacije Admin SDK-a).
- `pokreni.js` i dalje ne prosljeđuje `dodajRute`.
- Zaštita važi i za `npm start` (`--env-file-if-exists=../.env`): `.env.example` ima emulator varijable i `demo-fuelpoints`, pa prolazi.
- Seed CLI i `zastitaEmulatora.js` (i01) se ne mijenjaju; to je druga, stroža zaštita (seed traži emulator).

### 5.7 `napraviAplikaciju(opcije)` (`aplikacija.js`)

- Nove opcije: `servisi` (`{ db, auth }`) i `verzijaUslova`. Ruta `POST /account/init` se montira UVIJEK (`dodajRuteNaloga(ruterApi, opcije)`), prije `opcije.dodajRute`.
- Ako `servisi` nisu proslijeđeni (i01 unit testovi), aplikacija radi kao do sada; poziv `/account/init` tada završava u posredniku sa 500 `INTERNAL_ERROR` (nema `auth`). Nijedan i01 test ne gađa tu rutu. Produkcioni `pokreni.js` uvijek prosljeđuje servise.
- Failure injection (I02-T08) koristi ISTI parametar `servisi`: test prosljeđuje omotač oko pravog `db`. U `src/` nema grananja tipa „ako je test”, nema env zastavica ni test ruta.

### 5.8 Security Rules

`firebase/firestore.rules` dobija tačan sadržaj iz 11.3. Klijent: owner `get` za `users/{uid}` i `loyaltyAccounts/{uid}`; owner `update` za `users/{uid}` samo `displayName` + `updatedAt == request.time`; sve ostalo DENY. Backend (Admin SDK) ne podliježe pravilima.

## 6. Prijedlog ugovora API-01 (za odobrenje, `i02/P-1`)

SRS ne definiše odgovor uspjeha. Prijedlog (samo SRS-imenovana polja, bez internih detalja, bez timestamp-ova i bez uid-a):

| Situacija | HTTP | Tijelo |
|---|---|---|
| Kreiran bar jedan dokument (prvi init; dopuna djelimičnog stanja po `i02/P-2`) | **201 Created** | `{ "displayName", "accountStatus", "acceptedTermsVersion", "availablePoints", "reservedPoints" }` |
| Oba dokumenta postoje, `ACTIVE` (ponovljeni init) | **200 OK** | isti oblik, vrijednosti iz Firestore-a (ne iz zahtjeva) |
| Greške | §27 | `{ "error": { "code", "message", "correlationId" } }` (i01) |

Primjer prvog init-a: `201 {"displayName":"Ana","accountStatus":"ACTIVE","acceptedTermsVersion":"1.0","availablePoints":0,"reservedPoints":0}`.

- Razlikovanje prvog i ponovljenog init-a ide statusom (201/200), bez dodatnog polja van SRS-a.
- Redoslijed ključeva je fiksan (kao gore); test provjerava `Object.keys`.
- Timestamp-ovi se ne vraćaju: serverski timestamp nije poznat bez dodatnog čitanja poslije commit-a, a Android ih čita direktno iz Firestore-a (§25.2, §25.3).
- I02-T09: svi uspješni odgovori u paraleli imaju identično tijelo; tačno jedan je 201.

## 7. Rizici (security / concurrency / idempotency)

| # | Rizik | Mjera | Dokaz |
|---|---|---|---|
| R1 | UID iz tijela/query-ja (impersonacija) | UID samo iz `verifyIdToken`; `uid` u tijelu → 422 prije bilo kakvog čitanja | I02-T04 (dokument za uid iz tijela ne postoji ni u jednom slučaju) |
| R2 | Mass assignment (`accountStatus`, bodovi, timestamp-ovi) | Strogo tijelo (5.3), dokument se gradi iz konstanti i dva validirana polja | I02-T05; API-T01 `deepStrictEqual` polja |
| R3 | Opozvan, obrisan ili onemogućen korisnik i dalje prolazi | `verifyIdToken(token, true)` | I02-T03 |
| R4 | Emulator režim sa stvarnim projektom: Admin SDK prihvata NEPOTPISANE token-e → potpuna impersonacija | Zaštita na startu (5.6) prije inicijalizacije Admin SDK-a | I02-T13 (unit + spawn) |
| R5 | Djelimično stanje (samo jedan dokument) | Oba `tx.create` u jednoj transakciji; failure injection između upisa i poslije oba upisa | I02-T08 |
| R6 | Duplikati / reset pod konkurencijom | Čitanje oba dokumenta u istoj transakciji + `tx.create`; postojeći se nikad ne piše | I02-T09, API-T01 (42 ostaje 42) |
| R7 | Reset bodova kod djelimičnog stanja | Postojeći `loyaltyAccounts` se nikad ne piše | I02-T14 |
| R8 | Zahtjev visi kad Firestore/Auth nije dostupan; 500/401 umjesto 503 | `saRokom` (10 s) + klasifikacija (5.5) | I02-T11 (zatvoren port i „crna rupa”, oba servisa) |
| R9 | Token u logu/odgovoru (i kroz stack Admin SDK greške) | Posrednik baca samo novu `GreskaApi`; `dnevnik.js` nepromijenjen (bez zaglavlja) | I02-T12 (svi kanali, svi ishodi: 201, 401, 409, 422, 500, 503) |
| R10 | Test-only hook u produkciji | Failure injection kroz DI parametar `servisi` iz testa; nema env zastavica | Inspekcija: `git grep -n -i -E "test|inject|mock" -- backend/src` (Reviewer); I02-T16 (produkcioni start: ruta postoji, 401 bez token-a) |
| R11 | Late commit poslije 503 (rok istekao) | Prihvatljivo zbog atomičnosti i idempotentnosti; dokumentuje se | `i02/P-5` |
| R12 | Neusklađena granica displayName backend ↔ rules (`size()` vs `.length`) | Isto brojanje u oba sloja (`i02/P-3`) | I02-T06 + I02-T15 (astralni znakovi) |
| R13 | Callback transakcije sa sporednim efektima pri retry-u | Pravilo iz 5.4 | Inspekcija; I02-T09 |
| R14 | Flaky revoke test (granularnost od 1 s) | Pauza ≥ 1,1 s između izdavanja token-a i `revokeRefreshTokens` | I02-T03 stabilan u 2 uzastopna `provjera.ps1` |
| R15 | Neispravan JSON bez token-a daje 422, ne 401 | Arhitektura i01 (parser na nivou aplikacije); bez čitanja baze | `i02/P-6`, I02-T16 |

## 8. Testovi

Svi testovi: `node:test` + `node:assert/strict`, naslovi počinju ID-em. Emulator testovi: `provjeriTestnoOkruzenje()` na vrhu fajla, `beforeEach(ocistiEmulatore)`, `after` → `deleteApp`. Aplikacija u testu: `napraviAplikaciju({ servisi: inicijalizujFirebaseAdmin({ projectId: GCLOUD_PROJECT }), verzijaUslova: '1.0' })` + supertest, osim gdje piše „spawn”.

Pomoćnici:
- `authEmulator.js`: `napraviKorisnika(email)` → `POST http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=kljuc-emulatora` `{ email, password, returnSecureToken: true }` → `{ uid: localId, idToken }`. Host fiksan `127.0.0.1:9099` (kao `ocistiEmulatore`). `kljuc-emulatora` nije tajna (emulator prihvata bilo koji ključ). `napraviNepotpisanToken({ uid, aud, iss, iat, exp, auth_time })` → `base64url(header {alg:'none',typ:'JWT'}).base64url(payload).` (oblik emulator token-a).
- `presretanjeLoga.js`: `presretniLog()`/`tekstLoga()` iz i01 (`console.log/info/warn/error/debug` + `process.stdout/stderr.write`), premješteno bez izmjene.
- `procesBackenda.js`: `pokreniBackend(env)` = `spawn(process.execPath, ['src/pokreni.js'], { env eksplicitno sastavljen })`, čeka da port prihvata konekcije (≤ 10 s), skuplja stdout/stderr; `zaustavi()`; `slobodanPort()`; `crnaRupa()` = `net.createServer` koji prihvata konekciju i nikad ne odgovara.

### 8.1 SRS katalog

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| API-T01 | `emulator/inicijalizacijaNaloga.test.js` | (a) Novi korisnik, `{ displayName: 'Ana', acceptedTermsVersion: '1.0' }` → 201, tijelo tačno po sekciji 6 (`Object.keys` i vrijednosti, 0/0). `users/{uid}.data()` ima TAČNO ključeve `displayName, accountStatus, createdAt, updatedAt, acceptedTermsVersion, acceptedTermsAt`; `accountStatus === 'ACTIVE'`; tri timestamp-a su `Timestamp`, međusobno jednaka i u intervalu [prije zahtjeva − 5 s, poslije odgovora + 5 s] (serversko vrijeme emulatora). `loyaltyAccounts/{uid}.data()` ima TAČNO `availablePoints: 0, reservedPoints: 0, createdAt, updatedAt` (bez `lifetimeEarnedPoints`), timestamp-ovi jednaki onima iz `users`. Kolekcija `loyaltyLedger` je prazna; ukupno postoje tačno 2 dokumenta (users 1, loyaltyAccounts 1). (b) Admin SDK postavi `availablePoints = 42`; zapamte se oba `data()`. Ponovljeni init sa `{ displayName: 'Drugo ime', acceptedTermsVersion: '1.0' }` → 200, tijelo sa `displayName: 'Ana'`, `availablePoints: 42`; oba `data()` poslije su `deepStrictEqual` zapamćenim (displayName, svi timestamp-ovi, bodovi). Invarijante §7.2 (≥ 0) provjerene u oba koraka. |
| RULE-T01 | `firebase/tests/korisnikINalog.test.js` | `unauthenticatedContext()`: `getDoc(users/korisnikA)` → `assertFails`. |
| RULE-T02 | isti | `authenticatedContext('korisnikA')`: `getDoc(users/korisnikA)` → `assertSucceeds`. |
| RULE-T03 | isti | `authenticatedContext('korisnikB')`: `getDoc(users/korisnikA)` → DENY; `getDocs(collection(users))` za korisnikA i korisnikB → DENY (list je zabranjen i vlasniku). |
| RULE-T04 | isti | Vlasnik: `updateDoc(users/korisnikA, { displayName: 'Novo', updatedAt: serverTimestamp() })` → ALLOW; isto sa displayName od 1 i od 100 znakova → ALLOW. |
| RULE-T05 | isti | Vlasnik, `updatedAt: serverTimestamp()`, uz ispravan displayName dodaje/mijenja jedno od: `accountStatus: 'ACTIVE'→'DELETION_IN_PROGRESS'`, `acceptedTermsVersion`, `acceptedTermsAt`, `createdAt`, nepoznato polje `uloga: 'admin'` → svako DENY; `setDoc` cijelog dokumenta sa dodatnim poljem → DENY. |
| RULE-T06 | isti | Vlasnik: `getDoc(loyaltyAccounts/korisnikA)` → ALLOW. |
| RULE-T07 | isti | Za vlasnika, drugog korisnika i neautentifikovanog: `setDoc` novog `loyaltyAccounts/{svoj uid}` (create), `updateDoc` postojećeg (`availablePoints: 1000`), `setDoc(..., { merge: true })`, `deleteDoc` → svako DENY. |

Svi rules dokumenti se pripremaju kroz `withSecurityRulesDisabled` u kanonskom obliku (AUTH-02 / §7.1), sa `Timestamp` vrijednostima.

### 8.2 Dopunski testovi I02

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| I02-T01 | `emulator/autentikacija.test.js` | Ispravno tijelo bez `Authorization` → 401 `UNAUTHENTICATED`, tačno tri polja greške; Firestore prazan (users 0, loyaltyAccounts 0). Važeći token poslat negdje drugdje, a ne u `Authorization` (query `?token=…`, zaglavlje `X-Firebase-Token`) → 401, ništa upisano. (Token kao polje tijela pokriva I02-T05: nepoznato polje → 422.) |
| I02-T02 | isti | → 401 i ništa upisano za: `Basic <base64>`, `Bearer`, `Bearer ` , `Bearer  <validan>` (dva razmaka), `Bearer <validan> x`, `Token <validan>`, `Bearer abc`, `Bearer a.b.c`, nepotpisan token sa `exp` u prošlosti (→ `auth/id-token-expired`), nepotpisan token sa `aud` drugog projekta (`demo-drugi`). Pozitivna kontrola: `bearer <validan>` (mala slova) → 201 (`i02/P-7`). Stvarni `err.code` za svaki slučaj Builder upisuje u TEST_REPORT. Token sa izmijenjenim payload-om (tuđi uid) se NE testuje: emulator ga prihvata jer token-i nisu potpisani (poznato ograničenje iz brief-a, TEST_REPORT). |
| I02-T03 | isti | Za tri korisnika sa važećim token-om: (a) `auth.deleteUser(uid)` → 401; (b) `auth.updateUser(uid, { disabled: true })` → 401; (c) pauza 1,1 s, `auth.revokeRefreshTokens(uid)` → 401. Kontrola prije svake izmjene: isti token daje 201/200. Poslije (a)–(c) nijedan dokument za ta tri uid-a nije nastao osim kontrolnog init-a (a kontrolni dokumenti su nepromijenjeni). |
| I02-T04 | `emulator/inicijalizacijaNaloga.test.js` | Korisnik A (token), tijelo `{ uid: <uid korisnika B>, displayName, acceptedTermsVersion }` → 422 `INVALID_REQUEST`; `users/B`, `loyaltyAccounts/B`, `users/A`, `loyaltyAccounts/A` ne postoje. Isto sa `uid` = uid iz token-a → 422 (strogo tijelo). Isto kad A već ima nalog → 422, A-ovi dokumenti nepromijenjeni, B ne postoji. |
| I02-T05 | isti | Po jedno dodatno polje: `accountStatus`, `availablePoints`, `reservedPoints`, `createdAt`, `updatedAt`, `acceptedTermsAt`, nepoznato `uloga`, `__proto__` (sirov JSON string), `constructor` → 422 `INVALID_REQUEST`, Firestore prazan. Tijelo nije objekat: `[]`, `null`, `"tekst"`, `5`, `true`, prazno tijelo bez Content-Type, `text/plain` tijelo → 422 `INVALID_REQUEST`, ništa upisano. Redoslijed: `{ uloga: 1, displayName: '' }` → `INVALID_REQUEST` (ne `INVALID_DISPLAY_NAME`). |
| I02-T06 | isti | → 422 `INVALID_DISPLAY_NAME`, ništa upisano: nedostaje, `""`, 101 znak, `null`, `5`, `["a"]`, `{}`; prema `i02/P-3`: 101 astralni znak (`'😀'.repeat(101)`). → 201 sa tačnim `displayName` u dokumentu: 1 znak, 100 znakova, 100 astralnih znakova (svaki slučaj novi korisnik). Bez trim-a: `"  Ana  "` se upisuje tačno tako. Redoslijed: `{ displayName: '', acceptedTermsVersion: '9.9' }` → `INVALID_DISPLAY_NAME`. |
| I02-T07 | isti | → 422 `INVALID_REQUEST`, ništa upisano: `acceptedTermsVersion` nedostaje, `1.0` (broj), `null`, `"0.9"`, `"2.0"`, `"1.0 "`, `""`. Isto za postojeći ACTIVE nalog → 422 i dokumenti nepromijenjeni. |
| I02-T08 | isti | Failure injection kroz `servisi.db` = omotač oko pravog `db`: `runTransaction(fn, opcije)` poziva pravi `db.runTransaction` sa `tx` proxy-jem čiji `create`/`set`/`update` broji upise GLOBALNO za omotač; `collection`/`doc` delegiraju. (a) Baca `Error('ubrizgana greška C:\\tajno\\x.js')` na DRUGI upis (poslije prvog `tx.create`) → 500 `INTERNAL_ERROR`, tačno tri polja, tijelo bez `stack`, `    at `, `ubrizgana`, `C:\\`; users 0 i loyaltyAccounts 0. (b) Omotač poziva pravi callback, a kad se on uspješno završi (oba upisa su već u transakciji), baca grešku prije commit-a → 500, 0 dokumenata. Kontrola: isti omotač bez bacanja → 201 i 2 dokumenta (dokaz da omotač ne mijenja ponašanje). Implementacija koja bi upisivala van transakcije ili u dvije transakcije pada na (a). |
| I02-T09 | isti | Jedan korisnik, 10 paralelnih zahtjeva (`Promise.all`) sa `displayName` `Ime-0` … `Ime-9`: nijedan status 500; svi statusi ∈ {200, 201}; tačno jedan 201; sva tijela `deepStrictEqual`; `displayName` u tijelu = ime iz zahtjeva koji je dobio 201; users 1, loyaltyAccounts 1 (cijele kolekcije), stanje 0/0; `loyaltyLedger` prazan. Ponavlja se 3 puta (svaki put novi korisnik) u istom testu. |
| I02-T10 | isti | Admin SDK pripremi `users/{uid}` sa `accountStatus: 'DELETION_IN_PROGRESS'` (+ kanonska polja) i `loyaltyAccounts/{uid}` (`availablePoints: 7`) → init → 409 `ACCOUNT_DELETION_IN_PROGRESS`, oba `data()` `deepStrictEqual` prije/poslije. Varijanta: DELETION_IN_PROGRESS bez `loyaltyAccounts` → 409 i `loyaltyAccounts/{uid}` i dalje ne postoji. |
| I02-T11 | (a) `jedinicni/greskeServisa.test.js`; (b) `emulator/nedostupnostServisa.test.js` | (a) Bez mreže: `saRokom(new Promise(() => {}), 50)` → `GreskaApi` `SERVICE_UNAVAILABLE` za < 1 s; `saRokom(Promise.resolve(1), 50)` → 1; `klasifikujGreskuAuth` za svaki kod iz liste 401/503 i nepoznat kod → očekivani kod; `jeNedostupnostFirestore` za 14, 4, 10 → true, za 5, 7, `undefined` → false. (b) Spawn `src/pokreni.js` (`PORT` slobodan, `FIREBASE_PROJECT_ID=demo-fuelpoints`, `VERZIJA_USLOVA=1.0`, eksplicitan env): četiri varijante — Firestore → zatvoren port / crna rupa (Auth = pravi emulator, token pravog korisnika), Auth → zatvoren port / crna rupa (Firestore = pravi emulator). Svaka: `POST /api/v1/account/init` → 503 `SERVICE_UNAVAILABLE`, tačno tri polja, bez `stack`/`    at `, odgovor za < 15 s (mjereno); nije 401 ni 500. Za Auth varijante: pravi Firestore emulator ostaje prazan. stdout+stderr procesa ne sadrže token. |
| I02-T12 | `emulator/logBezTokena.test.js` | `presretniLog()` aktivan; za svaki ishod sa važećim (ili namjerno neispravnim, ali jedinstvenim) token-om: 201, 200, 401 (neispravan token `SENTINEL_TOKEN_…`, `Basic SENTINEL_BASIC_…`, opozvan korisnik), 409, 422 (oba koda), 500 (failure injection), 503 (in-process: `servisi.db` čiji `runTransaction` odbija sa `{ code: 14 }`). Asercije: spojeni log ne sadrži token, nijedan njegov segment (header/payload/potpis kad nije prazan) ni sentinel-e; odgovori (tijelo i SVA zaglavlja) ne sadrže token; log sadrži `correlationId` svakog error odgovora (dokaz da je presretač radio). (I02-T11 (b) pokriva logove spawn procesa.) |
| I02-T13 | (a) `jedinicni/konfiguracija.test.js`; (b) `jedinicni/pokretanjeBackenda.test.js` | (a) `ucitajKonfiguraciju` baca `GreskaKonfiguracije` za: `FIRESTORE_EMULATOR_HOST` + `fuelpoints-prod`; `FIREBASE_AUTH_EMULATOR_HOST` + `fuelpoints-prod`; prazna `FIRESTORE_EMULATOR_HOST=''` + `fuelpoints-prod`; poruka imenuje varijable, ne sadrži `fuelpoints-prod` ni `127.0.0.1:8080`. Prolazi za: emulator varijable + `demo-fuelpoints`; bez emulator varijabli + `fuelpoints-prod`. (b) Spawn `src/pokreni.js` sa `PORT=<slobodan>`, `VERZIJA_USLOVA=1.0`, `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_PROJECT_ID=tajni-prod-xyz` → izlaz ≠ 0 za < 10 s, stderr imenuje `FIREBASE_PROJECT_ID`, ne sadrži `tajni-prod-xyz` ni `    at `; port nikad nije slušao (pokušaj konekcije odbijen). Isto sa `FIREBASE_AUTH_EMULATOR_HOST`. |
| I02-T14 | `emulator/inicijalizacijaNaloga.test.js` | Djelimično stanje, po odobrenoj varijanti `i02/P-2`. Prijedlog (varijanta A): (a) postoji samo `users/{uid}` ACTIVE → 201, nastaje `loyaltyAccounts/{uid}` 0/0, `users` `deepStrictEqual` prije/poslije, tijelo sa displayName iz Firestore-a; (b) postoji samo `loyaltyAccounts/{uid}` sa `availablePoints: 42` → 201, nastaje `users/{uid}` (displayName i verzija iz zahtjeva, serverski timestamp-ovi), `loyaltyAccounts` `deepStrictEqual` prije/poslije (42 ostaje 42). (c) `users` sa `accountStatus: 'NEPOZNAT'` → 500, ništa promijenjeno. |
| I02-T15 | `firebase/tests/korisnikINalog.test.js` | Ostale granice §25.2/§25.3/§31 (nisu u RULE-T01 … T07): users `create` (vlasnik, novi dokument), `delete` (vlasnik) → DENY; update vlasnika sa `displayName` `''`, 101 znak, broj → DENY; `updatedAt` = klijentski `Timestamp.now()` → DENY; update drugog korisnika i neautentifikovan update → DENY; `loyaltyAccounts` get drugog korisnika i neautentifikovan get → DENY; `list` loyaltyAccounts (vlasnik) → DENY. `i02/P-3`: 100 astralnih znakova → ALLOW, 101 → DENY (Builder upisuje stvaran ishod; ako se razlikuje od backend-a, STAJE i javlja). |
| I02-T16 | `emulator/autentikacija.test.js` | Granice rute: `GET /api/v1/account/init` → 404 `NOT_FOUND`; `POST /api/v1/account/nepostojeca` bez token-a → 404 (posrednik nije na prefiksu); `POST /api/v1/account/init` sa neispravnim JSON-om bez token-a → 422 `INVALID_REQUEST`, ništa upisano (`i02/P-6`). Plus smoke u `provjera.ps1` (produkcioni start: `POST /api/v1/account/init` bez token-a → 401). |

### 8.3 Regresija

- I01-T01 … I01-T05, I01-T07 … I01-T09, I01-T11: bez izmjene testova (osim premještanja `presretniLog` u pomoćnik, bez promjene ponašanja).
- I01-T06: prilagođen (`i02/P-4`): (a) `{}` → poruka navodi i `VERZIJA_USLOVA`; (b) neispravan PORT uz `VERZIJA_USLOVA: '1.0'`; (c) ispravne vrijednosti uz `VERZIJA_USLOVA: '1.0'` → `{ port: 3000, projectId: 'demo-fuelpoints', host: '127.0.0.1', verzijaUslova: '1.0' }`; (d) bez izmjene.
- I01-T10: samo `loyaltyLedger` dio; `users` dio se uklanja (zamjenjuju ga RULE-T01 … RULE-T05, I02-T15).
- RULE-T12 (preliminarno): bez izmjene.
- Android: `assembleDebug`, `testDebugUnitTest` (NO-SOURCE) kroz `provjera.ps1`; Android kod se ne dira.

### 8.4 Kontrolne mutacije (Builder izvršava lokalno, bez commit-a, i upisuje u TEST_REPORT)

| Mutacija | Mora oboriti |
|---|---|
| `verifyIdToken(token, true)` → `verifyIdToken(token)` | ne obara u emulatoru (SDK uvijek provjerava opoziv u emulator režimu) — upisati kao poznato ograničenje; inspekcija |
| UID iz `req.body.uid ?? dekodiran.uid` | I02-T04 |
| upis `users` sa `db.collection(...).doc(uid).create(...)` van transakcije | I02-T08 (a) |
| `tx.create` loyaltyAccounts → `tx.set` bez provjere postojanja | API-T01 (b) / I02-T14 (b) |
| uklonjena provjera nepoznatih ključeva | I02-T04, I02-T05 |
| uklonjen `saRokom` oko transakcije | I02-T11 (b) Firestore crna rupa |
| uklonjena zaštita emulator/demo | I02-T13 |
| `allow get: if signedIn()` u `/users/{uid}` | RULE-T03 |
| `allow update: if isOwner(uid)` (bez `changedOnly`) | RULE-T05 |

## 9. Definition of Done

- [ ] Sve iz sekcije 1 implementirano, ništa iz sekcije 2. `git grep -n -E "/pos/|/rewards/|/vouchers|reconcile|loyaltyLedger" -- backend/src` → samo `podaci/kolekcije.js`.
- [ ] `cd backend; npm ci; npm test; npm run test:emu; cd ..` → svi testovi PASS (I01 regresija + I02-T11 (a), I02-T13 + API-T01, I02-T01 … I02-T12, I02-T14, I02-T16).
- [ ] `cd firebase\tests; npm ci; npm test; cd ..\..` → RULE-T01 … RULE-T07, I02-T15, RULE-T12 (preliminarno), I01-T10 (loyaltyLedger) PASS.
- [ ] Transakciona granica: I02-T08 (a) i (b) → 0 dokumenata.
- [ ] I02-T09: bez duplikata, bez 500, bez reseta, tačno jedan 201.
- [ ] I02-T12 i I02-T11 (b): nijedan log (svi kanali) ni odgovor ne sadrži token.
- [ ] `firebase/firestore.rules` bajt-po-bajt jednak 11.3 (Builder: `git diff` + vizuelno poređenje sa `.docx`); RULE-T01 … RULE-T07 zeleni.
- [ ] Test-only hook-ovi: `git grep -n -i -E "process\.env\.(NODE_ENV|TEST)|inject|ubriz" -- backend/src` → prazno.
- [ ] `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 (uklj. novi smoke 401).
- [ ] `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` = `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`; `git diff main -- docs/srs` prazno.
- [ ] Nema TODO/FIXME (`provjera.ps1`).
- [ ] `docs/TRACEABILITY.md` (redovi Iteracije 2), `docs/IMPLEMENTATION_LOG.md` (unos i02), `docs/TEST_REPORT.md` (stvarni izlaz + poznato ograničenje nepotpisanih token-a) ažurirani.
- [ ] Commit-i bez potpisa alata, svaki push-ovan; PR `iteracija-02 → main` otvoren, bez merge-a.
- [ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag `i02` → `git push --tags` (ne radi Builder).

## 10. Traceability (SRS → komponenta → test)

| SRS | Komponenta | Test |
|---|---|---|
| §3.1, §3.2, §2.2 | `validacija/tijeloInita.js`, `servisi/inicijalizacijaNaloga.js`, `firestore.rules` | I02-T04, I02-T05, RULE-T05, RULE-T07 |
| §3.3, NFR-01 | `posrednici/autentikacija.js`, `greske/greskeServisa.js`, `konfiguracija.js` (zaštita), `pokreni.js` | I02-T01, I02-T02, I02-T03, I02-T04, I02-T13, I02-T16 |
| AUTH-01 (API), AUTH-02, §26 API-01 | `rute/nalog.js`, `servisi/inicijalizacijaNaloga.js`, `aplikacija.js` | API-T01, I02-T08, I02-T09 |
| AUTH-03 | `servisi/inicijalizacijaNaloga.js` | API-T01 (a), I02-T14 |
| AUTH-04 | isto | API-T01 (b), I02-T09 |
| AUTH-05 | isto | I02-T10 |
| AUTH-10, O-11 | `validacija/tijeloInita.js`, `konfiguracija.js` (`VERZIJA_USLOVA`) | API-T01, I02-T07 |
| §7.1, §7.2 | `servisi/inicijalizacijaNaloga.js` | API-T01, I02-T09, I02-T14 |
| §27 (UNAUTHENTICATED, ACCOUNT_DELETION_IN_PROGRESS, INVALID_DISPLAY_NAME, INTERNAL_ERROR, SERVICE_UNAVAILABLE), O-1 (INVALID_REQUEST) | postojeći katalog i rukovalac; `greske/greskeServisa.js` | I02-T01 … I02-T11 |
| NFR-04 | `servisi/inicijalizacijaNaloga.js` | I02-T08 |
| NFR-07, §3.4 (log) | `posrednici/autentikacija.js`, `dnevnik.js` (N) | I02-T12, I02-T11 (b) |
| §25.1, §25.2, §25.3, §25.10, §31, NFR-03, AC-02 (dio) | `firebase/firestore.rules` | RULE-T01 … RULE-T07, I02-T15, RULE-T12, I01-T10 |

## 11. Tehničke odluke

### 11.1 Paketi

Nema novih paketa ni promjene verzija (i01, 10.1). Koriste se: `firebase-admin/firestore` (`FieldValue`), `firebase-admin/auth` (preko `servisi.auth`), `node:net`, `node:child_process` (samo testovi), `fetch` (Node 24, samo testovi), `firebase/firestore` (`updateDoc`, `serverTimestamp`, `Timestamp`, samo rules testovi).

### 11.2 `.env.example` (dopuna)

```
# Aktuelna verzija uslova korišćenja (AUTH-10, odluka O-11). Init prihvata samo ovu vrijednost.
VERZIJA_USLOVA=1.0
```

Komentar o POS ključevima ostaje. U `provjera.ps1` `VERZIJA_USLOVA` se dodaje u `$naziviEnv` (vraća se na kraju) i postavlja na `1.0` u smoke koraku.

### 11.3 `firebase/firestore.rules` (ciljni sadržaj, doslovno iz §31 normativnog `.docx`-a)

Uzeti su: zaglavlje, četiri helper funkcije, blokovi `/users/{uid}` i `/loyaltyAccounts/{uid}` i završni `match /{document=**}`, sa uvlačenjem i praznim redovima tačno kao u `.docx`. Blokovi za `purchases`, `loyaltyLedger`, `rewardDefinitions`, `vouchers`, `notifications`, `rewardRequests`, `redemptionRequests` se dodaju u i03–i06 (D-2); do tada ih pokriva default deny. Kraj linija LF (kao postojeći fajl), završni prelom reda.

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

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

`ownResource()` se u i02 ne koristi (prvi korisnik su `purchases` u i03), ali je brief eksplicitno traži doslovno. Ako emulator prijavi upozorenje o nekorišćenoj funkciji, Builder ga upisuje u TEST_REPORT; to nije greška.

### 11.4 Ostalo

- Naziv parametra fabrike: `servisi` (`{ db, auth }`), isti oblik koji vraća `inicijalizujFirebaseAdmin` (plus `app`, koji se ignoriše).
- Odgovor uspjeha se pravi eksplicitno (`{ displayName, accountStatus, acceptedTermsVersion, availablePoints, reservedPoints }`), nikad `snap.data()` direktno (inače bi procurili timestamp-ovi ili buduća polja).
- Poruke `GreskaKonfiguracije` za novu varijablu: „nedostaje obavezna varijabla VERZIJA_USLOVA”; za zaštitu: „emulator varijable (FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST) su postavljene, a FIREBASE_PROJECT_ID ne počinje sa demo-”.
- `README.md`: sekcija Konfiguracija (VERZIJA_USLOVA, zaštita), kratka sekcija „API” (API-01: zaglavlje, ulaz, 201/200, kodovi grešaka iz §27 u opsegu). Bez primjera sa pravim token-om.

## 12. Ručni koraci za Anu

Nema obaveznih ručnih koraka. Ako `gh auth status` kaže da Ana nije prijavljena, prije koraka sa PR-om kucati `! gh auth login`. Za ručno `npm start` ponovo kopirati `.env.example` u `.env` (nova varijabla `VERZIJA_USLOVA`).

## 13. Otvorena pitanja za Orchestrator-a

**i02/P-1 (odobrenje traži brief): ugovor odgovora uspjeha za API-01.**
Prijedlog u sekciji 6: 201 kad je nešto kreirano, 200 za ponovljeni init; tijelo `{ displayName, accountStatus, acceptedTermsVersion, availablePoints, reservedPoints }`, bez timestamp-ova i uid-a. Alternativa (manje): bez `acceptedTermsVersion`. Builder ne mijenja ugovor bez odobrenja.

**i02/P-2 (odobrenje traži brief): djelimično stanje.**
AUTH-03 definiše NOT_INITIALIZED kao „`users/{uid}` ne postoji ILI account initialization nije završen” i kaže da Android tada ponovo poziva init. Prijedlog (varijanta A): init u istoj transakciji kreira SAMO dokument koji nedostaje, postojeći ne dira ni jednim poljem (bodovi se nikad ne resetuju), odgovor 201 sa stvarnim stanjem; `DELETION_IN_PROGRESS` uvijek 409 bez dopune; `accountStatus` van SRS enum-a → 500 bez izmjene. Varijanta B: svako djelimično stanje → 500 `INTERNAL_ERROR` bez izmjene (nalog trajno blokiran dok se ručno ne popravi). Preporuka: A.

**i02/P-3: kako se broji dužina `displayName` (1–100).**
Brief kaže „ista granica kao §31”; §31 koristi `string.size()` u rules-ima. Za znakove van BMP-a (emoji) JavaScript `.length` broji UTF-16 jedinice, a code point brojanje broji znakove. Prijedlog: Backend broji Unicode code point-e (`[...s].length`); Builder u I02-T15 empirijski utvrđuje šta `size()` radi u emulatoru (100/101 × `😀`). Ako se rules i prijedlog razlikuju, Builder STAJE i javlja (ne usklađuje sam). Bez trim-a i Unicode normalizacije (SRS ih ne traži); `"   "` je validno ime.

**i02/P-4: naziv i obaveznost env varijable verzije uslova; izmjena I01-T06.**
Prijedlog: `VERZIJA_USLOVA` (nije SRS naziv, pa srpski), obavezna (fail fast kao `PORT`), bez podrazumijevane vrijednosti u kodu; vrijednost `1.0` u `.env.example` i `provjera.ps1`. Posljedica: I01-T06 (a)/(b)/(c) dobija novu varijablu u ulazu/očekivanju (8.3). Potrebna je potvrda da je ta izmjena regresionog testa prihvatljiva.

**i02/P-5: mapiranje grešaka zavisnih servisa i rok.**
Prijedlog: rok 10 s (konstanta) za `verifyIdToken` i transakciju; 503 za istek roka, mrežne greške Auth-a (`app/network-error`, `app/network-timeout`) i Firestore gRPC `UNAVAILABLE`/`DEADLINE_EXCEEDED`/`ABORTED` (contention poslije svih pokušaja); sve ostalo 500. Prihvata se da transakcija može biti commit-ovana poslije 503 odgovora (konzistentno i idempotentno).

**i02/P-6: 422 prije 401 za neispravan JSON.**
JSON parser iz i01 radi prije rutera, pa `POST /api/v1/account/init` sa neispravnim JSON-om i bez token-a daje 422 `INVALID_REQUEST`. Ništa se ne čita ni piše. Prijedlog: zadržati (promjena bi dirala i01 arhitekturu i I01-T03). Alternativa: parser montirati iza posrednika po ruti.

**i02/P-7: naziv šeme `Bearer` case-insensitive.**
RFC 7235 §2.1 / RFC 6750: naziv šeme ne zavisi od velikih/malih slova. Prijedlog: prihvatiti `bearer`/`BEARER`; sve ostalo (druga šema, prazan token, više razmaka, dodatni dio) → 401. Alternativa: samo tačno `Bearer`.

**i02/P-8 (informativno): oznake dopunskih testova.**
Brief ostavlja konačne oznake Planner-u: I02-T01 … I02-T13 kao u brief-u, plus I02-T14 (djelimično stanje), I02-T15 (rules granice van RULE-T01 … T07), I02-T16 (granice rute). Proširenja SRS testova (npr. list u RULE-T03, merge u RULE-T07) ostaju pod SRS oznakom jer su dio istog očekivanog rezultata iz §30.

**i02/P-9 (informativno): poznato ograničenje checkRevoked u emulatoru.**
U emulator režimu Admin SDK UVIJEK provjerava opoziv/onemogućenje (`checkRevoked || isEmulator`), pa test ne može razlikovati `verifyIdToken(token, true)` od `verifyIdToken(token)`. Pored nepotpisanih token-a (brief), i ovo ide u TEST_REPORT kao poznato ograničenje; `true` se provjerava inspekcijom.

## 14. IMPLEMENTATION PLAN za Builder-a

Opšte: poslije svakog commit-a odmah `git push`. Commit poruke na srpskom, bez potpisa alata. Prije commit-a `git status` sadrži samo fajlove tog koraka. Testovi se pišu prvi (crveni), pa kod. Nijedan novi paket.

**Korak 1: Security Rules za users i loyaltyAccounts (RULE-T01 … RULE-T07, I02-T15, I01-T10)**
- Fajlovi: `firebase/tests/korisnikINalog.test.js` [D], `firebase/tests/podrazumijevanaZabrana.test.js` [I], `firebase/firestore.rules` [I].
- Šta: testovi po 8.1/8.2 (crveni nad default deny: RULE-T02, T04, T06 padaju); uklanjanje `users` dijela iz I01-T10; rules tačno po 11.3.
- Dokaz: `cd firebase\tests; npm ci; npm test` → svi PASS; mutacije za rules iz 8.4 obaraju RULE-T03/T05.
- Commit: `i02: Security Rules za users i loyaltyAccounts doslovno po §31 (RULE-T01–T07)`

**Korak 2: Konfiguracija — VERZIJA_USLOVA i zaštita emulator/demo (I02-T13, I01-T06)**
- Fajlovi: `backend/test/jedinicni/konfiguracija.test.js` [I], `backend/test/pomocnici/procesBackenda.js` [D], `backend/test/jedinicni/pokretanjeBackenda.test.js` [D], `backend/src/konfiguracija/konfiguracija.js` [I], `.env.example` [I].
- Šta: 5.6 (bez Admin SDK-a u `pokreni.js` još uvijek); I01-T06 po 8.3.
- Dokaz: `cd backend; npm test` → I01 + I02-T13 PASS.
- Commit: `i02: verzija uslova iz konfiguracije i odbijanje emulator režima van demo projekta (I02-T13)`

**Korak 3: Rok i klasifikacija grešaka zavisnih servisa (I02-T11 a)**
- Fajlovi: `backend/test/jedinicni/greskeServisa.test.js` [D], `backend/src/greske/greskeServisa.js` [D].
- Šta: 5.5.
- Dokaz: `npm test` PASS.
- Commit: `i02: rok i klasifikacija grešaka Firestore i Auth servisa (I02-T11)`

**Korak 4: Posrednik autentikacije i ruta init sa validacijom (I02-T01, T02, T03, T16)**
- Fajlovi: `backend/test/pomocnici/authEmulator.js` [D], `backend/test/emulator/autentikacija.test.js` [D], `backend/src/posrednici/autentikacija.js` [D], `backend/src/validacija/tijeloInita.js` [D], `backend/src/rute/nalog.js` [D] (u ovom koraku handler poziva servis iz koraka 5 — zato se koraci 4 i 5 mogu spojiti u jedan commit ako bi inače test bio crven na commit-u; Builder bira, svaki commit mora imati zelen `npm test`), `backend/src/aplikacija.js` [I].
- Šta: 5.1, 5.2, 5.3, 5.7.
- Dokaz: `npm run test:emu` → I02-T01, T02, T03, T16 PASS; stvarni `err.code`-ovi upisani za TEST_REPORT.
- Commit: `i02: verifikacija Firebase ID token-a sa checkRevoked i stroga validacija tijela init-a (I02-T01–T03)`

**Korak 5: Transakcija init-a (API-T01, I02-T04 … I02-T10, I02-T14)**
- Fajlovi: `backend/test/emulator/inicijalizacijaNaloga.test.js` [D], `backend/src/servisi/inicijalizacijaNaloga.js` [D], `backend/src/rute/nalog.js` [I].
- Šta: 5.4, sekcija 6 (po odobrenom `i02/P-1`), `i02/P-2`.
- Dokaz: `npm run test:emu` → svi PASS; I02-T09 tri puta zaredom zelen (ponoviti `test:emu` 3×, izlaz u TEST_REPORT).
- Commit: `i02: POST /account/init u jednoj Firestore transakciji, idempotentno (API-T01)`

**Korak 6: Produkcioni start sa Admin SDK-om, nedostupnost servisa i log (I02-T11 b, I02-T12)**
- Fajlovi: `backend/src/pokreni.js` [I], `backend/test/emulator/nedostupnostServisa.test.js` [D], `backend/test/pomocnici/presretanjeLoga.js` [D], `backend/test/jedinicni/aplikacija.test.js` [I] (samo import), `backend/test/emulator/logBezTokena.test.js` [D].
- Šta: 5.6; testovi po 8.2.
- Dokaz: `npm test` i `npm run test:emu` PASS; I01-T04 i dalje pada na mutacije M7b/M7d (provjera premještenog pomoćnika).
- Commit: `i02: pokretanje sa Admin SDK-om, 503 kad servis nije dostupan i log bez token-a (I02-T11, I02-T12)`

**Korak 7: provjera.ps1 i README**
- Fajlovi: `skripte/provjera.ps1` [I] (UTF-8 sa BOM-om i CRLF ostaju), `README.md` [I].
- Šta: 11.2, 11.4; smoke 401 za `/account/init` bez token-a (PS 5.1: status i tijelo iz `$_.Exception.Response` / `$_.ErrorDetails.Message`, kao postojeći smoke).
- Dokaz: `.\skripte\provjera.ps1; $LASTEXITCODE` → 0, dva puta zaredom.
- Commit: `i02: provjera.ps1 sa smoke testom za /account/init i README`

**Korak 8: Kontrolne mutacije (bez commit-a koda)**
- Šta: sve iz 8.4, svaka lokalno pa `git restore`; rezultat u TEST_REPORT.

**Korak 9: Dokumentacija checkpoint-a**
- Fajlovi: `docs/TEST_REPORT.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/TRACEABILITY.md` [I].
- Šta: TEST_REPORT — stvarni izlaz komandi iz brief-a (tačka 8) i `provjera.ps1`, rezultat po ID-u, mutacije, stvarni `err.code`-ovi, ishod `size()` (`i02/P-3`), poznata ograničenja (nepotpisani token-i; `i02/P-9`). IMPLEMENTATION_LOG — CHANGELOG i02, fajlovi, odstupanja, status `i02/P-n`. TRACEABILITY — samo redovi Iteracije 2: „Kod”, „Status”, „Planirani test”; AUTH-03: „I02 ACCOUNT_NOT_INITIALIZED” → „I02 init iz stanja NOT_INITIALIZED; ACCOUNT_NOT_INITIALIZED u i04”.
- Dokaz: `git diff main -- docs/srs` prazno; hash odgovara.
- Commit: `i02: TEST_REPORT, IMPLEMENTATION_LOG i sljedivost za iteraciju 2`

**Korak 10: Pull request**
- `gh pr create --base main --head iteracija-02 --title "i02: Account lifecycle i granica autentikacije"`, opis na srpskom (isporuka A–G iz brief-a, tačka 9), bez potpisa alata. BEZ merge-a i BEZ taga.

## 15. Odluke Orchestrator-a (odobrenje plana)

(Popunjava Orchestrator.)
