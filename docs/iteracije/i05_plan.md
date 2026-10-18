# i05 — Plan (PLANNER)

Iteracija 5: Voucher cancel (API-05) i account reconcile (API-06). Grana `iteracija-05`.
Izvori: `CLAUDE.md`, `docs/iteracije/i05_brief.md` (obavezujući, posebno tačke 2 i 5), `docs/ODLUKE.md` (posebno §6 (b), (g), (h), (j), (k),
(l), (n), (p), §7, §9), SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`, normativan, SHA-256 `7d866413…c60228`; `.md` čitljiva kopija),
`docs/TRACEABILITY.md`, `docs/IMPLEMENTATION_LOG.md` (i04), `docs/TEST_REPORT.md` (i04), `docs/iteracije/i04_plan.md` (uključujući sekciju 15,
FIX LOOP 1 i 2), `i04_review.md`, `i04_review_fix1.md`, `i04_review_fix2.md` (R-07 … R-12, R-M47, R-M48), kod na vrhu grane (`670e4c5`).
Datum plana: 2026-10-18. Uloga: PLANNER (bez koda).

Oznake otvorenih pitanja su `i05/P-n` (sekcija 13). Probe su rađene privremenim skriptama van repoa (scratchpad sesije), nisu commit-ovane;
ishod je upisan u sekciju 3. Oznake dopunskih testova su `I05-T01 … I05-T21`, kontrolnih mutacija `N01 … N37`, `N40 … N44` i `R-M46`, `R-M47`, `R-M48`, `R-M53` iz re-review-a 2 i04 (sekcija 8.4; N38 i N39 se ne koriste).

---

## 1. SRS zahtjevi u opsegu

| SRS / odluka | Šta se u i05 radi | Napomena |
|---|---|---|
| O-19 (ODLUKE §6 (h)), NFR-07, D-3, O-18 | PRVI korak: u `greske/obradaGresaka.js` okviri stack-a se uzimaju tek POSLIJE zaglavlja `${name}: ${message}` (R-07); ručno postavljen / neprepoznat stack → bez okvira; opis neočekivane greške nikad ne baca (R-10, `i05/P-6`); testovi obaraju R-M47, R-M48, R-M46, R-M53; pravilo statičkih poruka sa automatskim testom. | 5.9, korak 1 |
| §26 API-05, §3.3, NFR-01 | `POST /api/v1/vouchers/:voucherId/cancel`; postojeći posrednik `napraviProvjeruTokena(servisi.auth)` vezan SAMO na tu rutu; UID iz `res.locals.uid`; rok 10 s od ulaska u posrednik. | 5.2 |
| §26 API-06, §3.3, NFR-01 | `POST /api/v1/account/vouchers/reconcile`; isti posrednik SAMO na toj ruti (ne na `/account` ni `/vouchers`). | 5.2 |
| §26 („без body-ја” / „без business input-а”), §19 („Request body није потребан”), O-21, O-1 | Tijelo: bez tijela ili `{}`; sve ostalo → 422 `INVALID_REQUEST`, 0 pristupa bazi. Tačno pravilo iz probe B1 (`i05/P-2`). | 5.3 |
| O-22, ODLUKE §6 (k), D-5 | `voucherId` iz putanje `^[0-9a-f]{64}$` (bez zastavica) → inače 404 `VOUCHER_NOT_FOUND` bez pristupa bazi; neispravno percent-kodiran → 404 `NOT_FOUND` (D-5, postojeće). Vrijednost nikad u log ni u odgovor greške. | 5.4 |
| §19.1, §16, §15, §7.6, §11 | ACTIVE (neistekao) → `status: "CANCELLED"`, `cancelledAt = Timestamp.fromMillis(sadaMs)` (`i05/P-3`), `reservedPoints −= costPoints`, `availablePoints += costPoints`, `REWARD_RELEASE` (`release_{voucherId}`, `tx.create`); JEDNA transakcija. Na voucher-u se mijenjaju SAMO `status` i `cancelledAt`. | 5.5 |
| §19.2 | Već CANCELLED → 200 sa SAČUVANIM stanjem, ništa upisano, bez obzira na stanje naloga (O-20). | 5.5 T3 |
| §19.3 | REDEEMED → 409 `VOUCHER_ALREADY_REDEEMED`; EXPIRED → 409 `VOUCHER_EXPIRED`; ništa upisano, bez obzira na stanje naloga (O-20). | 5.5 T3 |
| O-5, §20.5 (analogija), §18.1 | ACTIVE a `sadaMs ≥ expiresAt` → u ISTOJ transakciji ACTIVE → EXPIRED (samo `status`), release, pa POSLIJE commit-a 409 `VOUCHER_EXPIRED`. Nikad CANCELLED za istekao voucher. | 5.5 T5 |
| O-6, §27 FORBIDDEN | Voucher postoji, `uid` drugog korisnika → 403 `FORBIDDEN`, ništa upisano, tijelo samo §27. Ne postoji → 404 `VOUCHER_NOT_FOUND`. | 5.5 T2 |
| O-20, AUTH-03, AUTH-05 | Cancel: provjera naloga SAMO za ACTIVE voucher (poslije vlasništva i statusa); API-06: provjera naloga prije upita. 409 `ACCOUNT_NOT_INITIALIZED` / 409 `ACCOUNT_DELETION_IN_PROGRESS` / 500. | 5.5, 5.6 (`i05/P-4`) |
| §18, §18.1, D-1 | API-06: svi ACTIVE voucher-i korisnika sa `sadaMs ≥ expiresAt` → EXPIRED + release, u JEDNOJ transakciji, najviše jednom; tuđi, ne-ACTIVE i neistekli se ne diraju. Odgovor `{ reconciledCount }`. | 5.6 |
| §11, §7.2, §7.6, i04/P-5, i04/P-6 | `loyaltyLedger/release_{voucherId}`, TAČNO 9 polja §11, samo `tx.create`, uz eksplicitnu provjeru postojećeg release-a; lanac `availableAfter`/`reservedAfter` deterministički (`expiresAt`, pa `voucherId`); invarijante ≥ 0. | 5.7 |
| ODLUKE §6 (g), (j), (l), (p) | JEDNA implementacija oslobađanja (`servisi/oslobadjanjeVaucera.js`) koju koriste API-03, API-06 i cancel/O-5; refaktor bez promjene ponašanja API-03, u zasebnom koraku, prije API-05/06. | 5.7, korak 2 (`i05/P-5`) |
| ODLUKE §6 (n) (N-01) | API-03 retry i dalje vraća sačuvani `ACTIVE`; API-06 je mehanizam koji Android poziva na Home-u; README opisuje preporučeni tok. | 11.2 |
| §27, O-1 | Kodovi: `UNAUTHENTICATED`, `FORBIDDEN`, `VOUCHER_NOT_FOUND`, `VOUCHER_EXPIRED`, `VOUCHER_ALREADY_REDEEMED`, `ACCOUNT_NOT_INITIALIZED`, `ACCOUNT_DELETION_IN_PROGRESS`, `INVALID_REQUEST`, `NOT_FOUND`, `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`. Svi postoje u katalogu; katalog se ne mijenja. | — |
| NFR-04, NFR-05, NFR-06, AC-08, AC-09 | Failure injection na svakom upisu i prije commit-a; state-idempotentan cancel i kasni commit; konkurentni cancel / reconcile / issue bez double-refund-a; release najviše jednom; RELEASE za svaki prelaz. | Sekcija 8 |
| §25.7, §31, RULE-T09 | `firebase/firestore.rules` se NE mijenja; RULE-T01 … RULE-T12 ostaju zeleni. | 5.10 |

## 2. SRS zahtjevi van opsega

| SRS | Iteracija | Zašto nije sada |
|---|---|---|
| §26 API-04 redeem, §20, §7.5 REDEEM, `redemptionRequests` i njegov §31 blok, prefiks `redeem_` | 6 | Brief tačka 3. `REDEEMED` se u i05 samo ČITA (§19.3). |
| `VOUCHER_CANCELLED` (O-7) | 6 | Ponovljen cancel vraća stanje (§19.2); kod koristi tek redeem. |
| §26 API-07, §23, `REAUTHENTICATION_REQUIRED`, O-9 (zatvaranje voucher-a pri brisanju) | 7 | Brief tačka 3. |
| Notifikacije za cancel / release / istek | nikad | §9.2 poznaje samo `POINTS_EARNED`. |
| Izmjena ugovora i ponašanja API-01, API-02, API-03 | — | Dozvoljen SAMO refaktor oslobađanja (korak 2) sa nepromijenjenim ponašanjem; sve i04 asercije ostaju. |
| Ograničenje broja voucher-a, admin funkcije, upis u `rewardDefinitions` | nikad | §1.3. API-06 ne uvodi gornju granicu (`i05/P-8`). |
| Android (Rewards ekran, countdown, pozivi API-05/06), composite indeksi za Android upite | 9, 10 | Brief tačka 3. |
| POS Simulator; FCM | 11; nikad | — |
| R-11, R-12 (log 5xx) | — | Ostaju poznata ograničenja (ODLUKE §7, P-6); i05 uvodi samo test pravila statičkih poruka (`i05/P-6`). |
| B-1, B-2 | i08, i09 | Brief tačka 4. |

## 3. Zatečeno stanje repozitorijuma

Provjereno 2026-10-18 (čitanje koda u repou; komande i probe ispod):

- `git fetch origin`, `git switch iteracija-05`, `git pull --ff-only origin iteracija-05` → „Already up to date”. `git log --oneline -3`:
  `670e4c5 i05: Iteration Brief (Orchestrator)`, `d445fe8 Merge pull request #4 from anaspasojevic/iteracija-04`,
  `af66169 i04: odluke Orchestrator-a poslije re-review 2 (O-19)`. `git status` čisto. `git tag -n1`: `i01` … `i04` (ITERATION ACCEPTED).
  `docs/iteracije/i05_brief.md` postoji. SHA-256 `.docx` = `7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228`.
- Backend (relevantno za i05):
  - `aplikacija.js`: globalni `parsirajJson` (`express.json()`; svaka 4xx greška parsera → 422 `INVALID_REQUEST`) PRIJE rutera `/api/v1`;
    rute: `dodajRuteNaloga`, `dodajRuteKupovina`, `dodajRuteNagrada`, pa `opcije.dodajRute` (test).
  - `posrednici/autentikacija.js`: `napraviProvjeruTokena(auth)` → `res.locals.uid`, `res.locals.rokDo` (rok od ulaska u posrednik).
  - `rute/nagrade.js`: obrazac rute API-03 (posrednik samo na ruti; tijelo → format ID-a → servis).
  - `servisi/izdavanjeNagrade.js`: transakcija API-03; reconcile je UGRAĐEN (privatna `upisiOslobadjanja`, inline validacija ACTIVE voucher-a,
    provjera `release_*`, lanac u memoriji); privatni `FORMAT_VOUCHER_ID`, `STATUSI_VAUCERA`, `jeIspravanSacuvaniVaucer`, `odgovorVaucera`,
    `jeNenegativanCijeliBroj`, `jePozitivanCijeliBroj`; `sadaMs = Date.now()` na početku callback-a (+ jedno čitanje pri ulasku, za rok).
  - `servisi/vauceri.js`: `TRAJANJE_VAUCERA_MS`, `generisiVoucherId`, `jeIstekao`, `poredakOslobadjanja`, `izracunajRequestKey`.
  - `greske/obradaGresaka.js`: `odrediKod` (GreskaApi → kod; D-5 → `NOT_FOUND`; ostalo → `INTERNAL_ERROR`); `putanjaZaLog` = `req.route.path`;
    `opisNeocekivaneGreske`: okviri = SVI redovi `err.stack` koji odgovaraju `/^\s+at /` (R-07: uključujući redove poruke), `String(err)` za
    ne-Error bez zaštite (R-10).
  - Katalog (`greske/katalogGresaka.js`) već ima `FORBIDDEN`, `VOUCHER_NOT_FOUND`, `VOUCHER_EXPIRED`, `VOUCHER_ALREADY_REDEEMED`.
  - `git grep -n -E "new [A-Za-z]*Error\(" -- backend/src`: sve poruke su string literali, osim `greske/GreskaApi.js:8`
    (`TypeError(\`Nepoznat kod greške: ${kod}\`)` — kod je konstanta iz koda, ne identifikator iz zahtjeva/baze).
- Test pomoćnici: `omotacBaze.js` (opcije `baciNaUpisu`, `baciPrijeCommita`, `sakrijPostojece` — i za rezultat upita, `zadrziPrijeCommitaMs`,
  `odbijTransakcijuSa`, `prijeCommita`, `prisiliPonovniPokusaj`; brojači `brojPristupa`, `brojPokusaja`, `brojTransakcija`, `brojUpisa`, `upisi`,
  `commitZavrsen`, `sveTransakcijeZavrsene`), `procesBackenda.js` (`pokreniBackend`, `envProcesa`, `slobodanPort`, …), `presretanjeLoga.js`
  (`presretniLog`, `tekstLoga`), `authEmulator.js` (`napraviKorisnika`, `napraviNepotpisanToken`), `posKljuc.js`.
- I04-T19 (`izdavanjeAtomicnost.test.js:693`): mock `Date.now` prepoznaje pozivaoca po fajlu `/src/servisi/izdavanjeNagrade.js` i očekuje
  čitanja `[0, 1, 2]` (ulaz + po pokušaju). I04-T20 (`logGresaka5xx.test.js`) traži okvire (`/\n\s+at /`) u logu stvarnih gRPC grešaka.
- `firebase/firestore.rules`: blok `/vouchers/{voucherId}` iz i04 (owner get/list `limit ≤ 20`, write DENY). `firestore.indexes.json` prazan.
- `skripte/provjera.ps1`: smoke sa četiri provjere (404 `NOT_FOUND`, 401 `/account/init`, 401 `UNAUTHENTICATED_POS`, 401 `/rewards/CAR_WASH/issue`).
- `docs/ODLUKE.md` §1 („Stanje iteracija”) još navodi i04 kao „čeka ponovni review”; tag `i04` postoji — Builder ispravlja u dokumentacionom koraku.

Probe (privremene skripte van repoa; Node `v24.21.0`, Express `5.2.1`, firebase-admin `14.5.0`):

| # | Proba | Stvaran ishod |
|---|---|---|
| B1 | `napraviAplikaciju({ dodajRute })` sa test rutom `POST /proba/:id/cancel` koja vraća `req.body` i zaglavlja; sirovi HTTP zahtjevi preko `net` socket-a (tačno kontrolisana zaglavlja) | Bez tijela (bez CL/TE/CT) → `req.body undefined`; `Content-Length: 0` bez CT (oblik OkHttp/Retrofit) → `undefined`; `Content-Length: 0` + `application/json` → `{}`; `application/json` bez CL/TE → `undefined`; `{}`, `" { } "`, `APPLICATION/JSON {}` → `{}`; chunked 0 bajtova + JSON CT → `{}`; chunked 0 bajtova bez CT → `undefined`; `{"a":1}` → objekat; `{"__proto__":1}` → sopstveni ključ `__proto__`; `[]` → niz; `"x"`, `5`, `null`, `true`, `"   "`, `{neispravan`, `charset=utf-16` → **422 `INVALID_REQUEST` iz globalnog parsera** (strict); `text/plain`, bez CT i `application/merge-patch+json` SA tijelom → `req.body undefined` (tijelo nepročitano, `Content-Length` > 0). `Content-Length: 0` uz poslata 2 bajta → `400 Bad Request` iz Node HTTP parsera (prije Express-a). |
| B2 | Oblik `err.stack` (Node 24 / V8): `Error`, prazna poruka, `GreskaApi`, `TypeError`, `URIError`, izvedena klasa, `name`/`message` promijenjeni poslije konstrukcije, ručno postavljen `stack`, `cause`, `AggregateError`; poruke sa redom `    at TAJNA-…` | Stack se formira lijeno sa TRENUTNIM `name`/`message`: svaki slučaj osim ručnog stack-a počinje `${name}: ${message}` (`Error` za praznu poruku); `GreskaApi` → `GreskaApi: SERVICE_UNAVAILABLE`. Postojeći filter (`/^\s+at /` nad cijelim stack-om) propušta red poruke `    at TAJNA` (gRPC i ne-gRPC oblik, izvedena klasa, promijenjena poruka) — R-07 potvrđen; izdvajanje okvira POSLIJE zaglavlja ga ne propušta ni u jednom slučaju; ručni stack → 0 okvira. |
| G1 | Firestore emulator: stvarne gRPC greške — `tx.update` nepostojećeg `vouchers/<hex>` u tx, `update` nepostojećeg `rewardRequests/<hex>` van tx, `tx.create` postojećeg `release_<hex>` | Sve tri: `name "Error"`, stack POČINJE `${name}: ${message}` (NOT_FOUND poruka ima 8 redova, ALREADY_EXISTS 1); okvira poslije poruke 16 / 26 / 15 (van tx stack ima i `Caused by` + okvire). Prijedlog 5.9 zadržava okvire → I04-T20 (a), (b) i I04-T16 (c) ostaju zeleni. |
| K1 | 10 paralelnih transakcija obrasca cancel-a (tx.get voucher → getAll users, nalog, `release_` → update voucher, create release, update nalog), isti neistekao voucher (50, nalog 0/50), 5 ponavljanja | Svaki put: tačno 1 × CANCELLED, 9 × „bez upisa” (retry vidi CANCELLED), 1 `release_`, nalog 50/0, 0 grešaka. |
| K2 | Isti istekao voucher: 5 transakcija obrasca cancel-a (O-5) + 5 transakcija obrasca API-06 (`tx.get(query)` uid ==, status == ACTIVE) paralelno, 5 ponavljanja | Svaki put tačno 1 release (nekad cancel → EXPIRED, nekad API-06 → 1), ostali bez upisa; voucher EXPIRED, nalog 50/0, 0 grešaka. Upit u transakciji radi bez indeksa (kao i04/P-10). |
| L1 | Jedna transakcija obrasca API-06 sa N isteklih voucher-a (upit + `getAll` N `release_` + 2N + 1 upisa, svaki `release_` sa `serverTimestamp`) | N = 50 (101 upis) 151 ms; N = 200 (401 upis) 385 ms; N = 500 (1001 upis) 538 ms — sve uspješno, nalog tačan. Emulator ne nameće limit od 500 upisa; za produkciju vidi `i05/P-8`. |

Probe nisu dirale repozitorijum (`git status` poslije: samo novi `docs/iteracije/i05_plan.md`); emulator ugašen, portovi slobodni.

### 3.1 Preduslov: `provjera.ps1`

`.\skripte\provjera.ps1` na vrhu grane (`670e4c5`, kod identičan `main`/`i04`), izlaz preusmjeren u fajl van repoa → `SVE PROVJERE PROŠLE`, `EXIT=0`:
SRS hash, NFR-07, bez TODO/FIXME, portovi slobodni; backend `npm test` `ℹ tests 63` `ℹ pass 63` `ℹ fail 0`; `npm run test:emu` `ℹ tests 105`
`ℹ pass 105` `ℹ fail 0` (API-T07 `raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":20}`); smoke `404 NOT_FOUND`, `401 UNAUTHENTICATED`
(`/account/init`), `401 UNAUTHENTICATED_POS`, `401 UNAUTHENTICATED` (`/rewards/:rewardId/issue`); rules `ℹ tests 30` `ℹ pass 30` `ℹ fail 0`;
Android `BUILD SUCCESSFUL` ×2. `git status` poslije: čisto (osim ovog plana). Zeleni checkpoint postoji.

## 4. Fajlovi (dodati / izmijeniti / netaknuto)

Legenda: **[D]** dodati, **[I]** izmijeniti, **[N]** netaknuto.

```
/
├── README.md                                     [I] API-05, API-06, preporučeni tok klijenta (11.2) — dokumentacioni korak
├── skripte/provjera.ps1                          [I] smoke: 401 na /vouchers/<64 hex>/cancel i /account/vouchers/reconcile (UTF-8 BOM, CRLF)
├── firebase/
│   ├── firestore.rules                           [N] (5.10)
│   ├── firestore.indexes.json                    [N] (i05/P-9)
│   └── tests/*                                   [N] (RULE-T01 … RULE-T12 moraju ostati zeleni)
├── backend/
│   ├── src/
│   │   ├── aplikacija.js                         [I] dodajRuteVaucera(ruterApi, { servisi }) poslije dodajRuteNagrada, prije opcije.dodajRute
│   │   ├── greske/obradaGresaka.js               [I] O-19: okviri tek poslije zaglavlja (R-07); opis nikad ne baca (R-10) (5.9)
│   │   ├── rute/vauceri.js                       [D] dodajRuteVaucera: POST /vouchers/:voucherId/cancel, POST /account/vouchers/reconcile (5.2)
│   │   ├── validacija/zahtjevVaucera.js          [D] provjeriPraznoTijelo(tijelo, zaglavlja), provjeriVoucherId(voucherId) (5.3, 5.4)
│   │   ├── servisi/vauceri.js                    [I] + FORMAT_VOUCHER_ID, STATUSI_VAUCERA, jePozitivanCijeliBroj, jeNenegativanCijeliBroj,
│   │   │                                             jeIspravanSacuvaniVaucer (premješteno iz izdavanjeNagrade.js bez promjene logike)
│   │   ├── servisi/stanjeNaloga.js               [D] procitajStanjeNaloga(snimakKorisnika, snimakNaloga) — AUTH-03/05 provjere (5.8)
│   │   ├── servisi/oslobadjanjeVaucera.js        [D] ZAJEDNIČKI mehanizam release-a (5.7): procitajIstekleAktivne, pripremiOslobadjanja,
│   │   │                                             upisiOslobadjanja
│   │   ├── servisi/izdavanjeNagrade.js           [I] koristi oslobadjanjeVaucera.js, stanjeNaloga.js i vauceri.js; ponašanje isto (korak 2)
│   │   ├── servisi/otkazivanjeVaucera.js         [D] otkaziVaucer(db, { uid, voucherId }, rokDo) — JEDNA transakcija (5.5)
│   │   └── servisi/uskladjivanjeVaucera.js       [D] uskladiVaucere(db, { uid }, rokDo) — JEDNA transakcija (5.6)
│   │   (ostalo [N]: dnevnik.js, greske/GreskaApi.js, greske/katalogGresaka.js, greske/greskeServisa.js, posrednici/*, rute/nalog.js,
│   │    rute/kupovine.js, rute/nagrade.js, servisi/evidencijaKupovine.js, servisi/inicijalizacijaNaloga.js, servisi/bodovanje.js,
│   │    validacija/identifikator.js, validacija/tijeloInita.js, validacija/tijeloKupovine.js, validacija/vrijemeKupovine.js,
│   │    validacija/zahtjevIzdavanja.js, podaci/kolekcije.js, konfiguracija/*, firebase/inicijalizacija.js, punjenje/*, pokreni.js,
│   │    package.json, package-lock.json)
│   └── test/
│       ├── pomocnici/*                           [N] (postojeće opcije omotacBaze su dovoljne, i05/P-10)
│       ├── jedinicni/
│       │   ├── opisGreske5xx.test.js             [D] I05-T01 (O-19: R-07 … R-10)
│       │   ├── staticnePoruke.test.js            [D] I05-T02 (pravilo statičkih poruka)
│       │   ├── zahtjevVaucera.test.js            [D] I05-T03 (a) (O-21, O-22)
│       │   └── dekodiranjePutanje.test.js        [I] samo proširenje ulaza: D-5 nad /vouchers/…/cancel (I04-T03 (c))
│       └── emulator/
│           ├── otkazivanjeVaucera.test.js        [D] API-T11, I05-T03 (b) … I05-T09
│           ├── uskladjivanjeVaucera.test.js      [D] I05-T15, I05-T16
│           ├── vauceriAtomicnost.test.js         [D] AC-08, I05-T10 … I05-T14, I05-T17 … I05-T19
│           └── logVaucera.test.js                [D] I05-T20 (in-process + spawn)
│       (postojeći i01–i04 testovi [N]; izuzetak je samo proširenje ulaza u dekodiranjePutanje.test.js)
└── docs/
    ├── TRACEABILITY.md, IMPLEMENTATION_LOG.md, TEST_REPORT.md, ODLUKE.md   [I] dokumentacioni korak
    ├── srs/*                                     [N]
    └── iteracije/i05_brief.md [N]; i05_plan.md (ovaj fajl; Builder upisuje samo sekciju 15)
```

Nijedan novi npm paket. Glob-ovi `test/jedinicni/*.test.js` i `test/emulator/*.test.js` obuhvataju nove fajlove; `package.json` se ne mijenja.
Imenovanje: SRS nazivi (`vouchers`, `voucherId`, `status`, `ACTIVE`, `CANCELLED`, `EXPIRED`, `REDEEMED`, `cancelledAt`, `costPoints`,
`REWARD_RELEASE`, `availableAfter`, `reservedAfter`, `deltaAvailable`, `deltaReserved`, kodovi grešaka, `reconcile` u putanji) ostaju tačno
kao u SRS-u; sve ostalo srpski (latinica, ijekavica). Polje odgovora `reconciledCount` je prijedlog (`i05/P-1`).

## 5. Data-flow i granice

### 5.1 Tok zahtjeva i poredak provjera

```
korelacija → parsirajJson (globalno; neispravan JSON, JSON skalar ili null → 422 INVALID_REQUEST, bez token-a i baze; i02/P-6, proba B1)
  → /api/v1 ruter: poklapanje putanje i dekodiranje parametra (neispravno percent-kodiran → 404 NOT_FOUND, D-5)
  → POST /vouchers/:voucherId/cancel                         → POST /account/vouchers/reconcile
      1. provjeraTokena → 401 | 503 | 500                        1. provjeraTokena → 401 | 503 | 500
      2. provjeriPraznoTijelo → 422 INVALID_REQUEST              2. provjeriPraznoTijelo → 422 INVALID_REQUEST
      3. provjeriVoucherId → 404 VOUCHER_NOT_FOUND               3. uskladiVaucere(db, { uid }, rokDo)
      4. otkaziVaucer(db, { uid, voucherId }, rokDo)                 3a. rok → 503 (bez db); 3b. transakcija (5.6)
           4a. rok → 503 (bez db); 4b. transakcija (5.5)         4. 200 { reconciledCount }
      5. 200 tijeloOtkazanog (6)
  → nepoznataRuta (NOT_FOUND) → centralniRukovalacGreskama
```

| # | Provjera | Ishod | Pristup bazi |
|---|---|---|---|
| 0a | JSON parser (globalan): neispravan JSON, `null`, `"x"`, `5`, `true`, samo razmaci, nepodržan charset | 422 `INVALID_REQUEST` | ne |
| 0b | Dekodiranje parametra (D-5) | 404 `NOT_FOUND` | ne |
| 1 | Token | 401 `UNAUTHENTICATED` (503 / 500 po i02/P-5) | ne (Auth) |
| 2 | Tijelo (O-21, 5.3) | 422 `INVALID_REQUEST` | ne |
| 3 | Format `voucherId` (O-22, samo cancel) | 404 `VOUCHER_NOT_FOUND` | ne |
| 4 | Preostali rok > 0 | 503 `SERVICE_UNAVAILABLE` | ne |
| T… | Transakcija (5.5 / 5.6) | — | da |

Redoslijed 0a → 0b → 1 → 2 → 3 je isti kao za API-03 (K-1, i04/P-8): tijelo prije formata ID-a iz putanje, oba prije baze (i03/P-6).
Posljedica globalnog parsera (proba B1): JSON skalar/`null` → 422 i BEZ token-a, dok `{"a":1}` i `[]` bez token-a → 401 (tijelo se
provjerava tek poslije token-a) — oba ishoda deterministička, bez pristupa bazi; upisuje se u README.

### 5.2 Posrednik i rute (`rute/vauceri.js`)

```js
export function dodajRuteVaucera(ruter, { servisi }) {
  ruter.post('/vouchers/:voucherId/cancel', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    const voucherId = provjeriVoucherId(req.params.voucherId);
    const odgovor = await otkaziVaucer(servisi.db, { uid: res.locals.uid, voucherId }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });
  ruter.post('/account/vouchers/reconcile', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    const odgovor = await uskladiVaucere(servisi.db, { uid: res.locals.uid }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });
}
```

- Posrednik SAMO na rutama (kao API-03): `GET`/`PUT /api/v1/vouchers/<64 hex>/cancel`, `GET /api/v1/account/vouchers/reconcile`,
  `POST /api/v1/vouchers/<64 hex>` bez token-a → 404 `NOT_FOUND` (posrednik se ne izvršava).
- Handler čita samo `req.body`, `req.headers['content-length']`, `req.headers['transfer-encoding']` (5.3) i `req.params.voucherId`; UID
  isključivo `res.locals.uid`; nikad `req.query` ni druga zaglavlja.
- Šabloni ruta u logu (D-3): `/vouchers/:voucherId/cancel` i `/account/vouchers/reconcile` (`req.route.path`) — vrijednost `voucherId` se ne
  bilježi nikad (ni 4xx ni 5xx zapis).
- Prazan segment (`/vouchers//cancel`) ne pogađa rutu (Express parametar traži ≥ 1 znak, kao i04 E7) → 404 `NOT_FOUND`, ne
  `VOUCHER_NOT_FOUND` (`i05/P-12`). Ruter je case-insensitive i nije strict (i04/P-14): `/VOUCHERS/<hex>/CANCEL` pogađa rutu; `voucherId`
  se ne mijenja po veličini slova, pa `<HEX>` → 404 `VOUCHER_NOT_FOUND`.

### 5.3 Politika tijela O-21 (`validacija/zahtjevVaucera.js`, `i05/P-2`)

Proba B1 je pokazala da globalni `express.json()` čita tijelo SAMO kad je `Content-Type` `application/json` (case-insensitive), a za svaki
drugi ili nepostojeći `Content-Type` ostavlja `req.body === undefined` i tijelo NE čita — čak i kad tijelo postoji (`text/plain` sa
`{"uid":"x"}`, bez `Content-Type` sa tijelom, `application/merge-patch+json`). Zato „bez tijela” ne smije značiti samo `req.body === undefined`.

```js
// O-21: endpoint bez business input-a prihvata samo odsustvo tijela ili prazan JSON objekat.
export function provjeriPraznoTijelo(tijelo, zaglavlja) {
  if (tijelo === undefined) {                                       // parser nije čitao (nije JSON Content-Type ili nema tijela)
    const duzina = zaglavlja['content-length'];
    if (zaglavlja['transfer-encoding'] !== undefined || (duzina !== undefined && duzina !== '0')) {
      throw new GreskaApi('INVALID_REQUEST');                       // tijelo postoji, ali ga parser nije pročitao
    }
    return;
  }
  if (!jeObicanObjekat(tijelo) || Object.keys(tijelo).length !== 0) {
    throw new GreskaApi('INVALID_REQUEST');                         // niz, objekat sa ijednim poljem (i "__proto__")
  }
}
```

| Zahtjev (proba B1) | `req.body` poslije parsera | Ishod |
|---|---|---|
| bez `Content-Length`, bez `Transfer-Encoding`, bez `Content-Type` | `undefined` | ✔ ispravno |
| `Content-Length: 0`, bez `Content-Type` (OkHttp/Retrofit `@POST` bez `@Body`) | `undefined` | ✔ ispravno |
| `Content-Length: 0` + `application/json` | `{}` | ✔ ispravno |
| `application/json` bez `Content-Length`/`Transfer-Encoding` | `undefined` | ✔ ispravno |
| `application/json`, tijelo `{}` (i `" { } "`, `APPLICATION/JSON`) | `{}` | ✔ ispravno |
| `Transfer-Encoding: chunked` + `application/json`, 0 bajtova | `{}` | ✔ ispravno |
| `application/json` `{"a":1}`, `{"__proto__":1}`, `[]` | objekat sa ključem / niz | 422 (provjera 2, poslije token-a) |
| `application/json` `"x"`, `5`, `null`, `true`, samo razmaci, `{neispravan` | — (parser baca 4xx) | 422 (0a, i bez token-a) |
| `application/json; charset=utf-16` | — (415 parsera) | 422 (0a) |
| `text/plain` / bez `Content-Type` / `application/merge-patch+json` sa tijelom (`Content-Length > 0`) | `undefined` | 422 (provjera 2) |
| `Transfer-Encoding: chunked`, bez `Content-Type`, 0 bajtova | `undefined` | 422 (tijelo nije moguće provjeriti bez čitanja; Retrofit ga ne šalje) |

- `Content-Length` je string iz zaglavlja (Node ga već odbija ako nije cijeli broj); prihvata se samo tačno `'0'`.
- Odbačena alternativa: route-specifičan `express.json({ type: () => true })` koji bi pročitao svako tijelo — mijenja globalni redoslijed
  parsera (i01/i02) i dodaje drugi parser; pravilo iznad je deterministično bez čitanja.
- Proba B1 (p): `Content-Length: 0` uz poslatih 2 bajta → `400 Bad Request` iz Node HTTP parsera (prije Express-a, bez tijela §27, bez
  loga) — ponašanje Node-a za sve rute od i01; van opsega.

### 5.4 Format `voucherId` (O-22, ODLUKE §6 (k))

```js
export function provjeriVoucherId(voucherId) {
  if (typeof voucherId !== 'string' || !FORMAT_VOUCHER_ID.test(voucherId)) {   // FORMAT_VOUCHER_ID = /^[0-9a-f]{64}$/ iz vauceri.js
    throw new GreskaApi('VOUCHER_NOT_FOUND');
  }
  return voucherId;
}
```

- Bez zastavica; JS `$` bez `m` ne prihvata završni `\n`. Odbijaju se: velika slova (cijela / jedan znak), 63 i 65 znakova, `%2F` (`/`),
  NUL (`%00`), `\n` (`%0A`), `__x__`, Firebase UID oblik (28 alfanumerika), UUID, `..`, razmak, ne-ASCII cifre.
- Nijedna od ovih vrijednosti ne stiže do `db.collection/doc` (`brojPristupa === 0`). Odgovor greške je tijelo §27 (poruka iz kataloga) —
  `voucherId` se ne pojavljuje ni u odgovoru ni u logu (zapis 404 ima šablon rute, bez stack-a).
- `FORMAT_VOUCHER_ID` se iz `izdavanjeNagrade.js` premješta u `servisi/vauceri.js` (korak 2), pa i API-03 (mapping) i i05 koriste isti izraz.

### 5.5 Transakciona granica cancel-a `otkaziVaucer(db, { uid, voucherId }, rokDo)` (`servisi/otkazivanjeVaucera.js`)

```
preostaloMs = rokDo - Date.now();  ako !(preostaloMs > 0) → throw GreskaApi('SERVICE_UNAVAILABLE')    // bez ijednog poziva db
refVaucer = vouchers/{voucherId}; refKorisnik = users/{uid}; refNalog = loyaltyAccounts/{uid}

transakcija = db.runTransaction(async (tx) => {
  sadaMs = Date.now()                                                     // jedno čitanje po pokušaju (ODLUKE §6 (j))

  // T1 postojanje
  snimak = await tx.get(refVaucer)
  ako !snimak.exists                                  → throw GreskaApi('VOUCHER_NOT_FOUND')              // 404
  v = snimak.data()

  // T2 vlasništvo (O-6) — prije bilo čega drugog o tuđem voucher-u
  ako typeof v.uid !== 'string' || v.uid === ''       → throw Error('Nekonzistentno stanje: voucher bez vlasnika.')   // 500
  ako v.uid !== uid                                   → throw GreskaApi('FORBIDDEN')                      // 403, ništa upisano
  ako !jeIspravanSacuvaniVaucer(v) || typeof v.rewardId !== 'string'
                                                      → throw Error('Nekonzistentno stanje: neispravan voucher.')     // 500

  // T3 terminalna stanja (O-20: PRIJE provjere naloga; ništa se ne upisuje)
  ako v.status === 'CANCELLED':
     ako !(v.cancelledAt instanceof Timestamp)        → throw Error('Nekonzistentno stanje: otkazan voucher bez cancelledAt.')  // 500
     return { ishod: 'OTKAZAN', odgovor: tijeloOtkazanog(voucherId, v) }                                  // 200, §19.2
  ako v.status === 'REDEEMED'                         → throw GreskaApi('VOUCHER_ALREADY_REDEEMED')       // 409
  ako v.status === 'EXPIRED'                          → throw GreskaApi('VOUCHER_EXPIRED')                // 409
  // ostaje ACTIVE (status je u enum-u §15)

  // T4 nalog (O-20, AUTH-03, AUTH-05) — samo za ACTIVE
  [snimakKorisnika, snimakNaloga] = await tx.getAll(refKorisnik, refNalog)
  { dostupno, rezervisano } = procitajStanjeNaloga(snimakKorisnika, snimakNaloga)                       // 409 / 409 / 500 (5.8)

  // T5 istek (O-5) ili otkazivanje (§19.1)
  istekao = jeIstekao(v.expiresAt.toMillis(), sadaMs)
  izmjena = istekao ? { status: 'EXPIRED' } : { status: 'CANCELLED', cancelledAt: Timestamp.fromMillis(sadaMs) }

  // T6 oslobađanje — zajednički mehanizam (5.7): čita release_{voucherId}, provjerava, računa lanac
  { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db,
        { vauceri: [{ ref: snimak.ref, voucherId, expiresAtMs, cijena: v.costPoints, izmjena }], dostupno, rezervisano })
        // release_ postoji → 500; reservedPoints − cijena < 0 → 500

  // T7 upisi (fiksan redoslijed): 1 voucher (tx.update izmjena), 2 release_ (tx.create), 3 loyaltyAccounts (tx.update)
  vrijeme = FieldValue.serverTimestamp()
  upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme })
  tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme })
  return istekao ? { ishod: 'ISTEKAO' } : { ishod: 'OTKAZAN', odgovor: tijeloOtkazanog(voucherId, { ...v, ...izmjena }) }
}, { maxAttempts: 5 })

rezultat = await saRokom(transakcija, preostaloMs)    // GreskaApi prolazi; jeNedostupnostFirestore → 503; ostalo → izvorna → 500
ako rezultat.ishod === 'ISTEKAO' → throw GreskaApi('VOUCHER_EXPIRED')             // tek POSLIJE commit-a (O-5, obrazac O-14)
return rezultat.odgovor
```

Pravila za Builder-a:
- **Sva čitanja prije svih upisa** (i04 F6): voucher → users + loyaltyAccounts (`tx.getAll`) → `release_{voucherId}` (u `pripremiOslobadjanja`).
- **Upisi fiksni po redoslijedu i broju** (failure injection ih cilja): 1 `vouchers/{voucherId}` (`tx.update` SAMO `status` [+ `cancelledAt`]),
  2 `loyaltyLedger/release_{voucherId}` (`tx.create`), 3 `loyaltyAccounts/{uid}` (`tx.update` tačno `availablePoints`, `reservedPoints`,
  `updatedAt`). Isti redoslijed važi za O-5 granu. `redeemedAt`, `redeemedAtStationId`, `issuedAt`, `expiresAt`, `uid`, `rewardId`,
  `costPoints` se ne diraju; u O-5 grani ni `cancelledAt`.
- Double-refund: status voucher-a i balance se čitaju i mijenjaju u ISTOJ transakciji; `release_{voucherId}` + `tx.create` je druga linija
  odbrane (zastarjelo čitanje → `ALREADY_EXISTS` → 500, ništa upisano). Nikakva provjera statusa van transakcije, nikad `FieldValue.increment`.
- Svaki `throw` u callback-u poništava sve (i O-5 release kad nalog nije ACTIVE). JEDINI ishod koji commit-uje, a vraća grešku, je `ISTEKAO`.
- Idempotentnost: ponovljen cancel čita CANCELLED i vraća tijelo iz SAČUVANOG dokumenta; prvi odgovor je izveden iz upisanog objekta, koji je
  identičan sačuvanom jer je `cancelledAt = Timestamp.fromMillis(sadaMs)` poznat prije commit-a (proba i04 F4: `toMillis` tačno jednak).
- Kasni commit poslije 503 (ODLUKE §6 (b)): klijent ponavlja isti cancel; retry vidi CANCELLED → 200 bez upisa (ili, ako je commit-ovana O-5
  grana, EXPIRED → 409). Nema idempotency ključa jer je operacija state-idempotentna (§19) — stanje voucher-a JE ključ.
- Callback nema sporednih efekata van `tx`; `Date.now()` je dozvoljen (novi po pokušaju).
- `voucherId` se koristi samo kao `.doc(voucherId)` poslije 5.4; `uid` iz token-a.
- Nekonzistentna stanja → 500, ništa upisano (konačna lista, `i05/P-4`): `uid` voucher-a nije neprazan string; `costPoints` nije siguran
  cijeli broj ≥ 1; `status` van enum-a §15; `issuedAt`/`expiresAt` nisu `Timestamp`; `rewardId` nije string; CANCELLED bez `cancelledAt`
  `Timestamp`; nepoznat `accountStatus`; neispravan `loyaltyAccounts`; ACTIVE voucher a `release_{voucherId}` postoji; `reservedPoints < costPoints`.
  NE provjerava se (obrazloženje u `i05/P-4`): postojanje `release_` pri retry-ju CANCELLED / EXPIRED voucher-a.

### 5.6 Transakciona granica API-06 `uskladiVaucere(db, { uid }, rokDo)` (`servisi/uskladjivanjeVaucera.js`)

```
preostaloMs = rokDo - Date.now();  ako !(preostaloMs > 0) → throw GreskaApi('SERVICE_UNAVAILABLE')

transakcija = db.runTransaction(async (tx) => {
  sadaMs = Date.now()
  [snimakKorisnika, snimakNaloga] = await tx.getAll(users/{uid}, loyaltyAccounts/{uid})
  { dostupno, rezervisano } = procitajStanjeNaloga(snimakKorisnika, snimakNaloga)                       // 409 / 409 / 500, PRIJE upita
  istekli = await procitajIstekleAktivne(tx, db, { uid, sadaMs })      // tx.get(upit uid ==, status == ACTIVE); neispravan ACTIVE → 500;
                                                                         // filtrirano jeIstekao, sortirano poredakOslobadjanja
  ako istekli.length === 0 → return { reconciledCount: 0 }                                               // ništa upisano
  { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db, { vauceri: istekli, dostupno, rezervisano })
  vrijeme = FieldValue.serverTimestamp()
  upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme })                                              // upisi 1 … 2k
  tx.update(loyaltyAccounts/{uid}, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme })   // upis 2k+1
  return { reconciledCount: oslobadjanja.length }
}, { maxAttempts: 5 })
return await saRokom(transakcija, preostaloMs)   // ista klasifikacija kao 5.5
```

- `reconciledCount` je broj voucher-a prebačenih u EXPIRED U OVOM POZIVU (commit-ovanom pokušaju); voucher koji je u međuvremenu oslobodio
  drugi zahtjev se ne broji (retry callback-a ga više ne vidi kao ACTIVE).
- Redoslijed provjera (O-20): nalog prije upita, pa nalog u brisanju sa isteklim voucher-ima → 409 bez ijednog release-a (AUTH-05).
- Upit i validacija ACTIVE voucher-a su ISTI kod kao u API-03 (`procitajIstekleAktivne`); neispravan ACTIVE voucher (bilo koji, ne samo
  istekao) → 500, kao i04/P-7 (d).
- Nema gornje granice broja voucher-a (`i05/P-8`).

### 5.7 Zajednički mehanizam oslobađanja (`servisi/oslobadjanjeVaucera.js`, `i05/P-5`)

```js
// Čita ACTIVE voucher-e korisnika upitom u transakciji (O-17), provjerava ih i vraća istekle po poredakOslobadjanja. Bez čitanja sata.
export async function procitajIstekleAktivne(tx, db, { uid, sadaMs }) → [{ ref, voucherId, expiresAtMs, cijena, izmjena: { status: 'EXPIRED' } }]

// Za svaki voucher (već sortiran ili jedan): tx.getAll(release_{id}…) → postoji → throw Error (500); lanac u memoriji;
// reservedPoints − cijena < 0 → throw Error (500). Vraća { oslobadjanja (sa availableAfter/reservedAfter), dostupno, rezervisano }.
export async function pripremiOslobadjanja(tx, db, { vauceri, dostupno, rezervisano })

// Po oslobađanju: tx.update(ref, izmjena), pa tx.create(release_{voucherId}, 9 polja §11). Jedino mjesto u src/ koje piše release_.
export function upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme })
```

- Sadržaj je DOSLOVNO premješten iz `izdavanjeNagrade.js` (inline validacija ACTIVE voucher-a, provjera `release_*`, lanac, `upisiOslobadjanja`),
  uz jedno uopštenje: stavka nosi `izmjena` (`{ status: 'EXPIRED' }` za reconcile/O-5, `{ status: 'CANCELLED', cancelledAt }` za cancel).
  Poruke grešaka ostaju iste statičke rečenice.
- Modul NE čita sat: `sadaMs` prosljeđuje pozivalac (čitan u njegovom callback-u). Zato `izdavanjeNagrade.js` i dalje čita `Date.now()` tačno
  kao danas (ulaz + jednom po pokušaju), pa **I04-T19 ostaje nepromijenjen i važi bez izmjene** (ODLUKE §6 (p) ispunjen bez usklađivanja
  testa: nema refaktora sata). Novi servisi čitaju sat u SVOM callback-u; I05-T13 to provjerava po uzoru na I04-T19 (pozivalac po fajlu).
- Korisnici: API-03 (T5 reconcile, O-14 grana i T7), API-06 (sve), cancel (jedan voucher, CANCELLED ili EXPIRED), i06 redeem (§20.5) kasnije.
- Inspekcija „jedna implementacija”: `git grep -n "release_" -- backend/src` → samo `servisi/oslobadjanjeVaucera.js`;
  `git grep -n "REWARD_RELEASE" -- backend/src` → samo isti fajl.
- Refaktor API-03 (korak 2) mijenja samo mjesto koda: redoslijed čitanja (mapping → nalog/nagrada → upit → `release_*` → novi voucher/reserve),
  redoslijed i broj upisa (1 … 2k, 2k+1, 2k+2, 2k+3, 2k+4; O-14: 1 … 2k, 2k+1) i ishodi ostaju; dokaz je cijela i04 suite (uklj. I04-T09 (d),
  I04-T11 po putanjama upisa, I04-T19) zelena PRIJE koraka 3.

### 5.8 Stanje naloga (`servisi/stanjeNaloga.js`, `i05/P-4`)

```js
// AUTH-03, AUTH-05, §7.2, i02/P-2, i03/P-15: isti poredak kao i04/P-7 (c).
export function procitajStanjeNaloga(snimakKorisnika, snimakNaloga) {
  users ne postoji                     → GreskaApi('ACCOUNT_NOT_INITIALIZED')        (i kad loyaltyAccounts postoji)
  accountStatus === 'DELETION_IN_PROGRESS' → GreskaApi('ACCOUNT_DELETION_IN_PROGRESS') (bez obzira na loyaltyAccounts)
  accountStatus !== 'ACTIVE'           → Error('Neočekivan accountStatus u users dokumentu.')     // 500
  loyaltyAccounts ne postoji           → GreskaApi('ACCOUNT_NOT_INITIALIZED')
  availablePoints/reservedPoints nisu nenegativni sigurni cijeli brojevi → Error('Neispravan loyaltyAccounts dokument.')  // 500
  return { dostupno, rezervisano }
}
```

Premješteno iz `izdavanjeNagrade.js` (T3) bez promjene; koriste ga API-03, API-06 i cancel (jedna implementacija AUTH-05 blokade mutacija).

### 5.9 O-19 — log 5xx (`greske/obradaGresaka.js`, PRVI korak)

```js
// R-07: okviri se uzimaju tek POSLIJE zaglavlja "<name>: <message>" (ili "<name>" za praznu poruku) na početku stack-a, pa nijedan red
// poruke ne ulazi u log. Stack koji ne počinje tim zaglavljem (ručno postavljen) → bez okvira.
function okviriStacka(err) {
  const stack = String(err.stack ?? '');
  const zaglavlje = err.message === '' ? String(err.name) : `${String(err.name)}: ${String(err.message)}`;
  if (!stack.startsWith(zaglavlje)) return [];
  return stack.slice(zaglavlje.length).split('\n').filter((l) => /^\s+at /.test(l)).map(rediguj);
}
// R-10: opis neočekivane greške nikad ne baca (ne-Error bez primitivne vrijednosti, toString koji baca).
function opisNeocekivaneGreske(err) {
  try { … postojeća logika, okviri = okviriStacka(err) … } catch { return '(opis greške nedostupan)'; }
}
```

- Proba B2: V8 formira `stack` lijeno sa TRENUTNIM `name` i `message`, pa zaglavlje odgovara za `Error`, `GreskaApi` (`GreskaApi: KOD`),
  `TypeError`, `URIError`, izvedene klase, promijenjen `name`/`message` prije prvog čitanja; red `    at TAJNA` iz poruke više ne ulazi
  (gRPC i ne-gRPC); ručno postavljen stack → 0 okvira. Proba G1 (emulator): stvarne gRPC greške (`NOT_FOUND` u tx i van, `ALREADY_EXISTS`)
  počinju zaglavljem i zadržavaju okvire — I04-T20 (a), (b) i I04-T16 (c) (`/\n\s+at /`) ostaju zeleni.
- `name` i okviri i dalje idu kroz `rediguj` (R-08); ne-gRPC poruka kao do sada (`rediguj`, prag ≥ 32 hex, i velika slova — R-09).
- R-11 i R-12 se ne mijenjaju (poznata ograničenja); R-12 se za nove servise zatvara pravilom statičkih poruka (I05-T02).
- Odgovor klijentu, statusi, `odrediKod` i katalog se ne mijenjaju.

### 5.10 Security Rules

`firebase/firestore.rules` ostaje netaknut: §31 blok `/vouchers/{voucherId}` (iz i04) već daje owner `get`/`list` (`limit ≤ 20`) i
`create, update, delete: if false` — klijent ne može postaviti `CANCELLED`/`EXPIRED`, `cancelledAt` ni balance (§2.2, §25.7); cancel i reconcile
idu isključivo kroz Backend (Admin SDK ne podliježe pravilima). `loyaltyLedger` i `loyaltyAccounts` write DENY već pokrivaju RULE-T07, RULE-T11.
Nema novih Rules testova; RULE-T01 … RULE-T12 se izvršavaju u regresiji.

## 6. Prijedlog ugovora API-05 i API-06 (za odobrenje, `i05/P-1`)

| Endpoint / situacija | HTTP | Tijelo |
|---|---|---|
| API-05, prvi uspješan cancel | **200 OK** | `{ "voucherId", "rewardId", "costPoints", "status": "CANCELLED", "issuedAt", "expiresAt", "cancelledAt" }` |
| API-05, ponovljen cancel (§19.2) | **200 OK** | isto, iz SAČUVANOG dokumenta (byte-identično prvom) |
| API-05, istekao ACTIVE (O-5) | 409 | `VOUCHER_EXPIRED` (§27), bodovi vraćeni |
| API-06 | **200 OK** | `{ "reconciledCount": <cijeli broj ≥ 0> }` |
| Greške | §27 | `{ "error": { "code", "message", "correlationId" } }` |

Primjer API-05: `200 {"voucherId":"214d…87","rewardId":"CAR_WASH","costPoints":50,"status":"CANCELLED","issuedAt":"2026-10-18T10:00:00.000Z",
"expiresAt":"2026-10-18T10:15:00.000Z","cancelledAt":"2026-10-18T10:03:12.345Z"}`. Primjer API-06: `200 {"reconciledCount":2}`.

- `tijeloOtkazanog(voucherId, v)` = `{ voucherId, rewardId: v.rewardId, costPoints: v.costPoints, status: v.status,
  issuedAt: v.issuedAt.toDate().toISOString(), expiresAt: …, cancelledAt: v.cancelledAt.toDate().toISOString() }`; redoslijed ključeva
  fiksan (test `Object.keys`); ista funkcija za prvi odgovor (upisani objekat) i retry (sačuvani dokument). Prvih 6 ključeva = API-03 (i04/P-1).
- Zašto 200 i za prvi cancel: ništa se ne kreira (status se mijenja), a §19 traži state-idempotentnost — klijent ne treba razlikovati prvi
  i ponovljen poziv (isto tijelo). Alternativa: 200 prvi / 200 retry je jedina opcija koja daje identičan odgovor; 204 bez tijela odbačen
  (brief traži tijelo iz sačuvanog dokumenta).
- API-06 vraća samo broj (bez `voucherId`-eva — ne vraća podatke za iskorišćavanje; Android stanje čita iz Firestore-a, §2.2, §25.7).
  Alternativa: `204` bez tijela — odbačena jer test i README ne bi mogli dokazati „0 upisa” iz odgovora; ili `{ reconciledCount, voucherIds }` —
  odbačena (podatak koji ne treba).
- Nijedan odgovor ne sadrži `uid`, `requestId`/`requestKey`, ID-eve ledger događaja, balance (`availablePoints`, `reservedPoints`,
  `availableAfter`), `redeemedAt`, `redeemedAtStationId`.
- Greške API-05: `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 VOUCHER_NOT_FOUND`, `404 NOT_FOUND` (ruta, D-5), `409 VOUCHER_EXPIRED`,
  `409 VOUCHER_ALREADY_REDEEMED`, `409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`, `422 INVALID_REQUEST`, `500`, `503`
  (cancel je možda ipak upisan; isti poziv je bezbjedan retry). API-06: `401`, `404 NOT_FOUND` (ruta), `409 ACCOUNT_NOT_INITIALIZED`,
  `409 ACCOUNT_DELETION_IN_PROGRESS`, `422 INVALID_REQUEST`, `500`, `503` (retry bezbjedan; drugi poziv vraća 0 za već oslobođene).

## 7. Rizici (security / concurrency / idempotency)

| # | Rizik | Mjera | Dokaz |
|---|---|---|---|
| R1 | Dupli refund: ponovljen cancel pravi drugi RELEASE | Status se čita u tx; CANCELLED grana ne piše; `release_{voucherId}` + `tx.create` + eksplicitna provjera | API-T11, I05-T06; N02, N03, N07 |
| R2 | cancel × cancel paralelno | Isti voucher i nalog čitani i mijenjani u tx; konflikt → retry vidi CANCELLED | I05-T11 (a) ×20; proba K1 |
| R3 | cancel × API-06 × issue nad istim isteklim voucher-om | Sva tri čitaju voucher (dok. ili upit) i nalog u tx i pišu oba; `release_` kao backstop; jedan zajednički mehanizam | I05-T11 (b) ×20, AC-08; proba K2 |
| R4 | API-06 × API-06; API-06 × issue | Upit u tx (O-17) + nalog u tx; zaštita NE zavisi od brave upita (I05-T14 deterministički) | I05-T18, I05-T14 |
| R5 | Kasni commit poslije 503 | State-idempotentnost: retry vidi CANCELLED/EXPIRED; testovi čekaju `sveTransakcijeZavrsene` | I05-T12 (a), (b) |
| R6 | `voucherId` (podatak za redemption) u logu, poruci, šablonu rute, odgovoru greške | Log bilježi `req.route.path`; poruke statičke (I05-T02); O-19 okviri bez poruke; 4xx bez stack-a; odgovor iz kataloga | I05-T01, I05-T02, I05-T20; N26, N27 |
| R7 | FORBIDDEN otkriva postojanje voucher-a | Odluka O-6 (Ana) prihvata; `voucherId` ima 256 bita (nepogodljiv), tijelo 403 bez podataka; tuđi voucher se ne čita dalje od `uid` | I05-T05; N05, N06 |
| R8 | Provjera vlasnika poslije upisa / uklonjena | T2 prije svih upisa i prije provjere statusa | I05-T05 (deepStrictEqual oba korisnika); N05, N06 |
| R9 | Nekonzistentno stanje „popravljeno” umjesto 500 | Konačna lista 5.5 / 5.7 / 5.8 → 500, ništa upisano | I05-T09, I05-T16 (c) |
| R10 | Neograničen broj isteklih voucher-a u API-06 | §18.1 traži jednu transakciju; Firestore više nema limit od 500 upisa (izvor u `i05/P-8`); proba L1 | I05-T15 (e), poznato ograničenje |
| R11 | Path injection kroz `voucherId` | Strogi regex prije baze | I05-T03; N23, N24 |
| R12 | UID iz query-ja / zaglavlja / tijela | Samo `res.locals.uid`; tijelo mora biti prazno | I05-T04; N22 |
| R13 | Tijelo sa „business input-om” prećutno ignorisano (npr. `text/plain`) | 5.3 pravilo čita zaglavlja | I05-T03; N25 |
| R14 | O-5 release poništen bacanjem (bodovi ostaju rezervisani) ili O-5 postavlja CANCELLED | Ishod `ISTEKAO` se vraća, 409 tek poslije commit-a | I05-T07; N12, N13 |
| R15 | Release pri DELETION_IN_PROGRESS (AUTH-05) | Provjera naloga prije oslobađanja (cancel T4, API-06 prije upita) | I05-T08, I05-T16; N14 |
| R16 | Provjera naloga prije idempotentnog povrata (krši O-20) | T3 prije T4 | I05-T08 (b); N15 |
| R17 | Sat: `sadaMs` van callback-a / jedan za sve pokušaje | `Date.now()` na početku callback-a | I05-T13; N20 |
| R18 | Refaktor mijenja ponašanje API-03 | Zaseban korak; i04 suite zelena prije API-05/06; I04-T19 netaknut | Korak 2; N44 |
| R19 | Pod kontencijom 500 (`ALREADY_EXISTS`) umjesto retry-ja | Mjerenje u I05-T11, I05-T18; ako se pojavi 500, Builder STAJE i javlja (kao i04 R18) | I05-T11, I05-T18 |
| R20 | Log 5xx opis baca (R-10) → ne-§27 odgovor | try/catch sa statičkim opisom | I05-T01 (d); N42 |
| R21 | Test-only hook u `src/` | Mock samo `Date.now` / omotač iz testa | `git grep` (sekcija 9) |

## 8. Testovi

Svi testovi: `node:test` + `node:assert/strict`, naslov počinje ID-em. Emulator testovi: `provjeriTestnoOkruzenje()`, `beforeEach(ocistiEmulatore)`
(+ `napuniRewardDefinitions` gdje treba), `afterEach(mock.restoreAll)`, `after` → `deleteApp`. Aplikacija: `napraviAplikaciju({ servisi: { …firebase,
db }, verzijaUslova: '1.0', posStanice })`; token iz Auth emulatora. Svako tijelo greške se provjerava tačno (`provjeriTijeloGreske`, kao i04).
Pomoćnici po test fajlu (lokalno, po uzoru na i04): `pripremiNalog(uid, available, reserved, accountStatus?)`, `pripremiVaucer(id, uid,
{ rewardId, costPoints, status, expiresAtMs, cancelledAt? })` (kanonski §15), `pripremiRelease(voucherId, …)` (konzistentan ledger za terminalna
stanja), `snimakKorisnika(uid)` (users, loyaltyAccounts, svi vouchers i loyaltyLedger tog uid-a), `snimakBaze()`, `otkazi(voucherId, { token,
db, tijelo, zaglavlja })`, `uskladi({ token, db, … })` (supertest), `fajlPozivaoca()` (kao I04-T19).
Svaki test sa omotačem ima kontrolu: omotač bez opcija → očekivan uspjeh. Testovi koji dozvoljavaju 503 čekaju `sveTransakcijeZavrsene` prije asercija.

### 8.1 SRS katalog

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| API-T11 | `emulator/otkazivanjeVaucera.test.js` | Nalog `0/50`, ACTIVE CAR_WASH voucher V (50, `expiresAt` = sada + 10 min) + konzistentan `reserve_V`. `POST /vouchers/V/cancel` bez tijela → 200; tijelo tačno po 6 (`Object.keys` 7 ključeva tim redoslijedom; `status 'CANCELLED'`; `cancelledAt` ISO = `toDate().toISOString()` sačuvanog). V: `deepStrictEqual` prije osim `status 'CANCELLED'` i `cancelledAt` (`Timestamp`, u [prije − 5 s, poslije + 5 s], `< expiresAt`); `redeemedAt`, `redeemedAtStationId` `null`. Nalog `50/0`, `createdAt` nepromijenjen, `updatedAt` = `createdAt` release-a. `loyaltyLedger/release_V` TAČNO 9 ključeva §11 (`type 'REWARD_RELEASE'`, `deltaAvailable 50`, `deltaReserved −50`, `availableAfter 50`, `reservedAfter 0`, `purchaseId null`, `voucherId V`, `uid`, `createdAt` `Timestamp`); ukupno 1 RELEASE korisnika. Ponovljen cancel 2× (bez tijela i sa `{}`) → 200, tijelo `deepStrictEqual` prvom; `snimakKorisnika` `deepStrictEqual` stanju poslije prvog; omotač na retry-ju `upisi === []`. Invarijante ≥ 0. |
| AC-08 | `emulator/vauceriAtomicnost.test.js` | Tri scenarija, svaki sa istim isteklim ACTIVE voucher-om V (50) i nalogom `0/50`, različitim redoslijedom: (a) cancel (409 `VOUCHER_EXPIRED`, release) → API-06 (`reconciledCount 0`) → SHOWER issue (nalog 50 → 201, bez release-a za V) → cancel (409, 0 upisa); (b) API-06 (1) → cancel (409, 0 upisa) → issue; (c) issue SHOWER (reconcile V) → cancel (409) → API-06 (0). Svuda: tačno jedan `release_V`, V EXPIRED (`cancelledAt null`), balance tačan (`availablePoints + reservedPoints` = 50), lanac ledger-a uzastopan. Dopuna: ACTIVE neistekao V → cancel → API-06 → issue: tačno jedan release, V CANCELLED. |

### 8.2 Dopunski testovi I05

| ID | Fajl | Šta tačno provjerava |
|---|---|---|
| I05-T01 | `jedinicni/opisGreske5xx.test.js` | O-19, bez emulatora; `centralniRukovalacGreskama` sa lažnim `res` (kao I04-T20 `obradi`), log presretnut (svi kanali); svaki slučaj: odgovor 500 tačno §27, jedan zapis loga, `next` se ne poziva. (a) R-07: gRPC (`code 5`) greška čija poruka sadrži `\n    at <64 hex>`, `\n    at TAJNA-<uuid>`, `\n    at vouchers/TAJNA-<uuid>` → log bez `TAJNA`, bez hex-a, bez ijednog reda poruke; počinje `Error (code 5 NOT_FOUND)`; ima ≥ 1 okvir. Isto za ne-gRPC sa `\n    at <64 hex>` u poruci → u okvirima nema hex-a (ne-gRPC poruka sama ide kroz `rediguj`). (b) R-08: `err.name` sa 64 hex i `vouchers/TAJNA-x` (gRPC i ne-gRPC; `name` postavljen prije prvog čitanja stack-a) → log bez obje tajne; ručno postavljen `err.stack = \`${name}: ${message}\n    at f (vouchers/TAJNA-…)\n    at <64 hex> (x.js:1:1)\`` → okviri prisutni, redigovani (`[putanja dokumenta]`, `[hex]`), bez tajni (obara R-M47); ručno postavljen stack sa drugim zaglavljem i tajnom u okviru → 0 okvira, bez tajne. (c) R-09: ne-gRPC poruka sa tačno 32 hex → `[hex]` (obara R-M46 prag 64); 64 hex VELIKIM slovima → `[hex]` (obara R-M53); 31 hex ostaje (dokumentovana granica heuristike). (d) R-10: `Object.create(null)`, objekat čiji `toString` baca `Error('baca <64 hex>')`, `Error` čiji `stack` getter baca → 500 §27, zapis sa opisom `(opis greške nedostupan)`, log bez hex-a. (e) regresija: stvaran `GreskaApi('SERVICE_UNAVAILABLE')` → 503, `GreskaApi: SERVICE_UNAVAILABLE` + okviri (kao i04). |
| I05-T02 | `jedinicni/staticnePoruke.test.js` | Pravilo statičkih poruka (ODLUKE §6 (h)): čita sve `backend/src/**/*.js`; za svaki `new <X>Error(` (regex `/new\s+(?:[A-Z][A-Za-z]*)?Error\s*\(/g`) argument do prve `,`/`)` mora biti JEDAN string literal u `'…'` ili `"…"` (bez `+`, bez template literala, bez identifikatora); izuzetak je samo `greske/GreskaApi.js` (`TypeError` sa kodom iz kataloga — nije identifikator iz zahtjeva/baze). Kontrola: test prepoznaje sintetički izvor sa `new Error(\`x ${voucherId}\`)` i `new Error('a' + uid)` kao kršenje (funkcija provjere je izvezena unutar test fajla i testirana nad stringom). |
| I05-T03 | (a) `jedinicni/zahtjevVaucera.test.js`; (b) `emulator/otkazivanjeVaucera.test.js` | (a) `provjeriPraznoTijelo`: prolazi `(undefined, {})`, `(undefined, {'content-length':'0'})`, `({}, {'content-length':'2'})`, `({}, {'transfer-encoding':'chunked'})`; odbija (`INVALID_REQUEST`) `({a:1})`, `(JSON.parse('{"__proto__":1}'))`, `([])`, `(null)`, `('x')`, `(5)`, `(true)`, `(undefined, {'content-length':'11'})`, `(undefined, {'transfer-encoding':'chunked'})`, `(undefined, {'content-length':'00'})`. `provjeriVoucherId`: prolazi 64 hex (mala), `'0'.repeat(64)`; odbija (`VOUCHER_NOT_FOUND`) velika slova (cijeli, jedan znak), 63, 65, `''`, `'a/b…'`, `'\u0000'+63 hex`, 64 hex + `'\n'`, `'__x__'`, 28-znakovni UID, UUID, `'..'`, ne-string, arapsko-indijske cifre. (b) HTTP sa važećim token-om, omotač: za OBA endpoint-a (O-21) bez tijela, `Content-Length: 0` bez `Content-Type`, `{}` → uspjeh (kontrola); `{"a":1}`, `{"uid":"<B>"}`, `{"voucherId":"…"}`, `[]`, `text/plain` sa `{"uid":"x"}`, bez `Content-Type` sa tijelom, `application/merge-patch+json` → 422, `brojPristupa === 0`; `null`, `"x"`, `5`, neispravan JSON BEZ token-a → 422. Za cancel (O-22): `%41…` (velika), 63/65 znakova, `a%2Fb`, `%00`+63 hex, `__x__`, UID oblik → 404 `VOUCHER_NOT_FOUND`, `brojPristupa === 0`; `/vouchers//cancel` → 404 `NOT_FOUND` (`i05/P-12`); `/vouchers/%E0%A4%A/cancel` → 404 `NOT_FOUND` (D-5); `GET`, `PUT` na obje rute i `POST /vouchers/<hex>` bez token-a → 404 `NOT_FOUND`. Redoslijed: `{"a":1}` + neispravan `voucherId` → 422 (tijelo prije formata). |
| I05-T04 | `emulator/otkazivanjeVaucera.test.js` (cancel) i `emulator/uskladjivanjeVaucera.test.js` (API-06) | Oba endpoint-a, omotač: bez `Authorization`, `Bearer neispravan`, `Basic <token>`, `Bearer` bez token-a, `?token=` → 401 `UNAUTHENTICATED`, `brojPristupa === 0`, baza nepromijenjena. UID samo iz token-a: A i B sa po jednim ACTIVE voucher-om (B-ov istekao): API-06 sa token-om A + `?uid=<B>` + `X-User-Id: <B>` → `reconciledCount` po A-u (0), B nepromijenjen; cancel A-ovog voucher-a sa istim dodacima → 200, release `uid === A`, B nepromijenjen. |
| I05-T05 | `emulator/otkazivanjeVaucera.test.js` | O-6: (a) 64 hex koji ne postoji → 404 `VOUCHER_NOT_FOUND`, ništa upisano. (b) A otkazuje ACTIVE voucher korisnika B (B nalog `0/50`) → 403 `FORBIDDEN` tačno §27 (tijelo bez `voucherId`, `rewardId`, `costPoints`, statusa, `uid`); `snimakKorisnika(A)` i `snimakKorisnika(B)` `deepStrictEqual` prije/poslije; `upisi === []`. Isto za B-ov istekao ACTIVE (bez O-5 release-a), B-ov CANCELLED (403, ne 200), B-ov REDEEMED, B-ov EXPIRED → 403. (c) voucher bez polja `uid` / `uid: null` / `uid: 5` / `uid: ''` → 500 bez stack-a, ništa upisano. |
| I05-T06 | isti | §19.3 i §19.2 (pripremljeno Admin SDK-om sa konzistentnim ledger-om: `reserve_` i za EXPIRED/CANCELLED `release_`; za REDEEMED nalog bez rezerve): REDEEMED → 409 `VOUCHER_ALREADY_REDEEMED`; EXPIRED → 409 `VOUCHER_EXPIRED`; CANCELLED (pripremljen) → 200, tijelo iz sačuvanog dokumenta. Svuda `snimakKorisnika` `deepStrictEqual`, `upisi === []`. |
| I05-T07 | isti | O-5: nalog `0/50`, ACTIVE V (50) sa `expiresAt` = sada − 1 min → 409 `VOUCHER_EXPIRED` tačno; V `deepStrictEqual` prije osim `status 'EXPIRED'` (`cancelledAt` ostaje `null`); `release_V` 9 polja (`availableAfter 50`, `reservedAfter 0`); nalog `50/0`. Ponovljen cancel → 409 `VOUCHER_EXPIRED`, `upisi === []`, stanje `deepStrictEqual`. Granica u servisu (Date.now mock za `/src/servisi/otkazivanjeVaucera.js`, kao I04-T19): `sadaMs === expiresAt` → EXPIRED (409); `sadaMs === expiresAt − 1` → CANCELLED (200, `cancelledAt.toMillis() === expiresAt − 1`). Jedinična granica `jeIstekao` ostaje I04-T09 (f). |
| I05-T08 | isti | O-20, nalog: ACTIVE neistekao V + `DELETION_IN_PROGRESS` → 409 `ACCOUNT_DELETION_IN_PROGRESS`; isto za istekao ACTIVE (nema O-5 release-a, V ACTIVE); users ne postoji (i loyaltyAccounts ne postoji); users ACTIVE bez loyaltyAccounts → 409 `ACCOUNT_NOT_INITIALIZED`; `accountStatus: 'NEPOZNAT'`; loyaltyAccounts `availablePoints: -1`, `'50'`, `reservedPoints: 1.5` → 500. Svuda `upisi === []`, stanje `deepStrictEqual`. (b) Idempotentno PRIJE naloga: CANCELLED V + `DELETION_IN_PROGRESS` → 200 (isto tijelo), CANCELLED V + users ne postoji → 200; REDEEMED / EXPIRED + `DELETION_IN_PROGRESS` → 409 voucher koda; svuda `upisi === []`. |
| I05-T09 | isti | Nekonzistentno → 500 bez stack-a, `upisi === []`, stanje `deepStrictEqual`: ACTIVE V a `release_V` postoji; `reservedPoints 20` uz V 50; `costPoints` `0`, `-1`, `1.5`, `'50'`, nedostaje; `status: 'PENDING'`; `expiresAt` nedostaje / string; `rewardId: 5`; CANCELLED bez `cancelledAt` / `cancelledAt: 'x'`. Zastarjelo čitanje: `sakrijPostojece: ['loyaltyLedger/release_V']` uz pripremljen release → 500 (`ALREADY_EXISTS`), release nepromijenjen, V ACTIVE. |
| I05-T10 | `emulator/vauceriAtomicnost.test.js` | Failure injection cancel-a: (a) neistekao: `baciNaUpisu` 1, 2, 3 (putanje `vouchers/V`, `loyaltyLedger/release_V`, `loyaltyAccounts/uid` — provjerene iz `upisi`); (b) O-5 grana: 1, 2, 3; (c) `baciPrijeCommita` za (a) i (b). Svaki → 500 bez `stack`, `    at `, `ubrizgana`, `C:\`, `tajno`; `snimakKorisnika` `deepStrictEqual` početnom. Kontrola: omotač bez opcija → 200 / 409. |
| I05-T11 | isti | Konkurentnost (omotač bez opcija, `sveTransakcijeZavrsene`, statusi u `t.diagnostic`): (a) 10 paralelnih cancel-a istog neisteklog V, 20 ponavljanja, svaki put novi korisnik (nalog `0/50`): statusi ⊆ {200, 503}, 0 × 500, ≥ 1 × 200 ili poslije svih 503 retry (najviše 20 pokušaja) daje 200; sva 200 tijela `deepStrictEqual`; tačno 1 `release_V`, V CANCELLED, nalog `50/0`. (b) Isti istekao V: paralelno 4 cancel-a + 3 API-06 + 3 SHOWER issue-a (nalog `0/50`, SHOWER 30), 20 ponavljanja: statusi cancel ⊆ {409 `VOUCHER_EXPIRED`, 503}, API-06 ⊆ {200, 503}, issue ⊆ {201, 409 `INSUFFICIENT_POINTS`, 503}; 0 × 500; tačno 1 `release_V`; V EXPIRED; zbir `reconciledCount` (200 odgovori) ≤ 1; nalog `available + reserved = 50`, `reserved = 30 × broj novih voucher-a`; lanac ledger-a uzastopan. (c) Tri ACTIVE neistekla voucher-a istog korisnika (50, 30, 30; nalog `0/110`) otkazana paralelno, 5 ponavljanja → 3 × 200 (503 se ponavlja), nalog `110/0`, 3 release-a sa uzastopnim lancem (redoslijed commit-a proizvoljan, zbir tačan). |
| I05-T12 | isti | (a) Kasni commit: omotač `zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500` → cancel 503 tačno tijelo u < 12 s; `await commitZavrsen` → V CANCELLED, 1 release, nalog `50/0`; retry (pravi `db`) → 200, tijelo iz sačuvanog (`cancelledAt` = sačuvani); drugi retry identičan; tačno 1 release. (b) Isto za istekao V (O-5 commit-ovan poslije 503) → retry 409 `VOUCHER_EXPIRED`, 1 release. (c) Isto za API-06 → retry `reconciledCount 0`, 1 release. (d) Rok: `otkaziVaucer` i `uskladiVaucere` sa `rokDo` ∈ { `Date.now() − 1`, `Date.now()`, `undefined`, `NaN` } → `GreskaApi SERVICE_UNAVAILABLE`, `brojTransakcija === 0`, `brojPristupa === 0`; kontrola `Date.now() + 10 000` → uspjeh. |
| I05-T13 | isti | `sadaMs` po pokušaju (ODLUKE §6 (j)): omotač `prisiliPonovniPokusaj: 1`, mock `Date.now` samo za pozive iz `/src/servisi/otkazivanjeVaucera.js` (pa zasebno `/src/servisi/uskladjivanjeVaucera.js`): čitanja `[0, 1, 2]` (ulaz + po pokušaju), vrijednost `T0 + 10 000 × n`; V ističe između pokušaja (`expiresAt = T0 + 15 000`) → cancel: 409 `VOUCHER_EXPIRED`, V EXPIRED, 1 release (prvi pokušaj bi otkazao); API-06: `reconciledCount 1`. Kontrola: I04-T19 nepromijenjen i zelen. |
| I05-T14 | isti | Stanje naloga čitano u transakciji, nezavisno od brave upita (po uzoru na I04-T18): omotač `prijeCommita` drži cancel (pa zasebno API-06) poslije čitanja; za to vrijeme POS kupovina istog korisnika (+20, ne čita `vouchers`) commit-uje; transakcija se ponavlja; kraj: nalog = početni + 20 + oslobođeno, lanac EARN/RELEASE uzastopan, 1 release; 10 ponavljanja. |
| I05-T15 | `emulator/uskladjivanjeVaucera.test.js` | API-06: (a) nalog bez voucher-a → 200 `{ reconciledCount: 0 }` (`Object.keys` = 1 ključ), `upisi === []`, stanje `deepStrictEqual`. (b) Nalog `5/140`: istekli `f…f` (30, T−3 min) i `0…0` (50, T−2 min), neistekao ACTIVE (30), CANCELLED, REDEEMED, EXPIRED (sa prošlim `expiresAt`), istekao ACTIVE drugog korisnika → 200 `{ reconciledCount: 2 }`; release redom `f…f` (`availableAfter 35`, `reservedAfter 110`), `0…0` (`85`, `60`); oba voucher-a `deepStrictEqual` prije osim `status 'EXPIRED'`; ostali (i tuđi + njegov nalog) `deepStrictEqual`; nalog `85/60`. (c) Isti `expiresAt` za `a…a` i `b…b` → redom `a…a`, `b…b`. (d) Drugi poziv → `0`, `upisi === []`. (e) 200 isteklih voucher-a (SHOWER 30) jednog korisnika → `reconciledCount 200`, nalog tačan, 200 release-a, u < 10 s (proba L1). |
| I05-T16 | isti | O-20 i nekonzistentno, svaki sa isteklim ACTIVE voucher-om: users ne postoji; users ACTIVE bez loyaltyAccounts; loyaltyAccounts bez users → 409 `ACCOUNT_NOT_INITIALIZED`; `DELETION_IN_PROGRESS` (sa i bez loyaltyAccounts) → 409 `ACCOUNT_DELETION_IN_PROGRESS`; `accountStatus 'NEPOZNAT'`, neispravan loyaltyAccounts → 500. (c) ACTIVE voucher sa `costPoints 0` / bez `expiresAt`; `release_` postoji za istekao ACTIVE; `reservedPoints` manji od zbira → 500. Svuda `upisi === []`, voucher ACTIVE, stanje `deepStrictEqual`. Nalog bez voucher-a i `DELETION_IN_PROGRESS` → 409 (provjera prije upita). |
| I05-T17 | `emulator/vauceriAtomicnost.test.js` | Failure injection API-06 (dva istekla): `baciNaUpisu` 1 … 5 (putanje: voucher1, release1, voucher2, release2, nalog) i `baciPrijeCommita` → 500, stanje `deepStrictEqual`; zastarjelo čitanje `release_` → 500. Kontrola → 200 `{2}`. |
| I05-T18 | isti | (a) 10 paralelnih API-06 nad istim nalogom sa 3 istekla (10 ponavljanja, novi korisnik): 0 × 500, svaki voucher tačno 1 release, zbir `reconciledCount` (200 odgovori) = 3 kad nema 503, ≤ 3 inače, nalog tačan. (b) API-06 × 3 issue-a istog korisnika paralelno (10 ponavljanja) → bez duplog release-a, balance i lanac tačni. |
| I05-T19 | isti | Očuvanje bodova: 250 sekvencijalnih nasumičnih operacija (fiksan seed `0x1505`, PRNG `mulberry32` u testu) nad jednim korisnikom: kupovina (API-02, 0–60 bodova), issue (CAR_WASH/SHOWER), cancel nasumičnog sopstvenog voucher-a (bilo kog statusa), API-06, „istek” (Admin SDK pomjera `expiresAt` nasumičnog ACTIVE voucher-a u prošlost — simulacija proteka vremena, ne mijenja status ni bodove). Poslije svake operacije: `availablePoints ≥ 0`, `reservedPoints ≥ 0`, `available + reserved = Σ EARN`, `reserved = Σ costPoints ACTIVE voucher-a`, svaki voucher ima tačno 1 RESERVE i ≤ 1 RELEASE (= 1 za EXPIRED/CANCELLED), lanac (sortiran po rekonstrukciji) uzastopan. Raspodjela operacija u `t.diagnostic`. |
| I05-T20 | `emulator/logVaucera.test.js` | (a) In-process, `presretniLog()`, sentinel-i: ishodi cancel 200 (prvi i retry), 401 (token = sentinel), 403, 404 `VOUCHER_NOT_FOUND` (ispravan format), 404 formata (`__SENTINEL__`), 404 D-5 (sentinel u putanji sa `%E0`), 409 ×5 kodova, 422 (tijelo sa sentinel-om), 500 (failure injection), 503 (`odbijTransakcijuSa: { code: 14 }`); API-06 200, 401, 409, 422, 500, 503. Spojeni log ne sadrži: ID token, sentinel, nijedan `voucherId` (iz putanje, tuđi, oslobođeni), `uid` korisnika, `availablePoints`, `Failed to decode`; nijedan odgovor (tijelo + zaglavlja) ne sadrži `stack`, `    at `, `uid`, balance; zapisi za pogođene rute imaju `putanja` tačno `/vouchers/:voucherId/cancel` odnosno `/account/vouchers/reconcile`, D-5 `(nepoznata ruta)`; log sadrži `correlationId` svakog error odgovora. (b) Stvarna emulatorska 500 iz cancel-a: `release_V` pripremljen pa sakriven (`ALREADY_EXISTS` na `loyaltyLedger/release_<V>`) i `tx.update` nad voucher-om obrisanim između čitanja i commit-a (`prijeCommita` briše V Admin SDK-om → `NOT_FOUND` sa ID-em u poruci) → log bez V, sa `code 6` / `code 5`. (c) Spawn `src/pokreni.js`: cancel 401 (sentinel token), 404 formata (sentinel), 404 D-5, 422; API-06 401 → stdout+stderr bez sentinel-a, `voucherId`-a i `Failed to decode`. I04-T16 ostaje netaknut. |
| I05-T21 | — (inspekcija, sekcija 9) | Jedna implementacija: `git grep -n -E "release_|REWARD_RELEASE" -- backend/src` → samo `servisi/oslobadjanjeVaucera.js`; `git grep -n -E "Date\.now" -- backend/src/servisi/oslobadjanjeVaucera.js` → prazno; `git diff i04 -- backend/test/emulator/izdavanjeAtomicnost.test.js` → prazno (I04-T19 nepromijenjen). |

### 8.3 Regresija

- I01 … I04 suite bez izmjene asercija i bez izmjene fajlova (`git diff main -- backend/test firebase/tests` = samo novi fajlovi i
  proširenje ulaza u `dekodiranjePutanje.test.js`: `POST /api/v1/vouchers/%E0%A4%A/cancel`, `GET` iste → 404 `NOT_FOUND`, log bez sirove vrijednosti).
- Korak 2 (refaktor): CIJELA i04 suite (API-T05 … API-T07 sa 20 ponavljanja, I04-T01 … I04-T20) zelena; 3 uzastopna `npm run test:emu`.
- RULE-T01 … RULE-T12, I02-T15, I03-T20, I04-T17 bez izmjene. Android `assembleDebug`, `testDebugUnitTest` kroz `provjera.ps1`.

### 8.4 Kontrolne mutacije (Builder izvršava lokalno, bez commit-a, svaku pa `git restore`; ishod n/10 u TEST_REPORT)

Svaka mutacija: 10 izvršavanja ciljanog testa (`--test-name-pattern`, jedan dugo pokrenut emulator, kao i04 FIX LOOP 2) → mora pasti 10/10
(konkurentne: pasti u ≥ 1 od 3 serije od 20 ponavljanja, ishod upisan). Preživjela → dopuna testa (ne slabljenje koda), commit
`i05: ojačan test … (nalaz mutacije Nnn)`, odstupanje OD-n.

| # | Mutacija | Mora oboriti |
|---|---|---|
| N01 | `tx.create` → `tx.set` za RELEASE (u `upisiOslobadjanja`) | I05-T09 (zastarjelo čitanje), I04-T11 (z4) |
| N02 | cancel bez provjere statusa ACTIVE (CANCELLED/EXPIRED/REDEEMED idu u oslobađanje) | API-T11 (retry), I05-T06 |
| N03 | uklonjena eksplicitna provjera postojećeg `release_{voucherId}` | I05-T09 (`upisi === []`), I05-T16 (c) |
| N04 | `jeIstekao`: `>` umjesto `>=` | I05-T07 (granica u servisu), I04-T09 (f) |
| N05 | provjera vlasnika uklonjena | I05-T05 (b) |
| N06 | provjera vlasnika poslije upisa (T2 premješten iza T7) | I05-T05 (b) (`deepStrictEqual` B-a) |
| N07 | CANCELLED grana prolazi u oslobađanje uz `tx.set` release-a (ponovljen cancel pravi novi RELEASE) | API-T11 |
| N08 | `cancelledAt` se ne postavlja | API-T11 |
| N09 | `cancelledAt = FieldValue.serverTimestamp()` (prvi odgovor ≠ sačuvani) | API-T11 (tijelo retry-ja `deepStrictEqual` prvom) |
| N10 | `deltaAvailable: -cijena` (pogrešan predznak); zasebno `deltaReserved: cijena` | API-T11, I05-T07 |
| N11 | loyaltyAccounts čitan VAN transakcije (`db.doc().get()`), u tx bez čitanja | I05-T14, I05-T11 (a) |
| N12 | O-5 grana baca `GreskaApi('VOUCHER_EXPIRED')` u callback-u (rollback release-a) | I05-T07 |
| N13 | O-5 grana postavlja CANCELLED | I05-T07 |
| N14 | provjera `DELETION_IN_PROGRESS` uklonjena (u `procitajStanjeNaloga`) | I05-T08, I05-T16, I04-T04 |
| N15 | provjera naloga PRIJE vraćanja CANCELLED stanja (T4 prije T3) | I05-T08 (b) |
| N16 | REDEEMED provjera uklonjena; zasebno EXPIRED provjera uklonjena | I05-T06 |
| N17 | API-06 upit bez `where('uid', …)` (obrađuje tuđe voucher-e) | I05-T15 (b) |
| N18 | API-06 upit bez `where('status', '==', 'ACTIVE')` | I05-T15 (b) |
| N19 | `reconciledCount` = broj ACTIVE (umjesto isteklih); zasebno `+ 1` | I05-T15 (a), (b), (d) |
| N20 | `sadaMs = Date.now()` prije `runTransaction` (jedan za sve pokušaje) u cancel-u; zasebno u API-06 | I05-T13 |
| N21 | API-06 provjera naloga POSLIJE upita i oslobađanja (release prije provjere DELETION) | I05-T16 |
| N22 | `uid = req.query.uid ?? res.locals.uid` (obje rute) | I05-T04 |
| N23 | regex `voucherId` bez sidra (`/[0-9a-f]{64}/`) | I05-T03 (a), (b) |
| N24 | regex `voucherId` sa zastavicom `i` | I05-T03 (a), (b) |
| N25 | neispravno tijelo prihvaćeno: `provjeriPraznoTijelo` uklonjena; zasebno grana `tijelo === undefined` uvijek prolazi | I05-T03 (a), (b) |
| N26 | `voucherId` u poruci greške servisa (`new Error(\`… ${voucherId}\`)` u T2) | I05-T02, I05-T20 |
| N27 | `zabiljeziGresku` dobija `putanja: req.originalUrl` | I05-T20, I04-T16 |
| N28 | posrednik na prefiksu (`ruter.use('/vouchers', provjera)`) | I05-T03 (b) (`GET` bez token-a → 401 umjesto 404) |
| N29 | uklonjena provjera roka u `otkaziVaucer`; zasebno u `uskladiVaucere` | I05-T12 (d) |
| N30 | `reservedPoints − cijena < 0` provjera uklonjena | I05-T09 |
| N31 | cancel mijenja i `redeemedAt: null → Timestamp` (dodatno polje) | API-T11 (`deepStrictEqual` osim status/cancelledAt) |
| N32 | odgovor cancel-a sadrži `uid` | API-T11 (`Object.keys`), I05-T20 |
| N33 | 403 tijelo/greška za tuđi voucher zamijenjena sa 404 | I05-T05 (b) |
| N34 | voucher bez `uid` tretiran kao tuđi (403 umjesto 500) | I05-T05 (c) |
| N35 | O-5 grana zadržava `ishod: 'OTKAZAN'` i vraća 200 | I05-T07 |
| N36 | release lanac iz stanja PRIJE prethodnog release-a (API-06 sa dva) | I05-T15 (b) |
| N37 | uklonjeno sortiranje `poredakOslobadjanja` u zajedničkom modulu | I05-T15 (c), I04-T09 (d) |
| R-M47 | `opisNeocekivaneGreske`: okviri bez `.map(rediguj)` | I05-T01 (b) |
| R-M48 | `err.name` bez `rediguj` | I05-T01 (b) |
| R-M46 / R-M53 | prag hex-a 32 → 64; zasebno samo mala slova | I05-T01 (c) |
| N40 | R-07 vraćen: okviri iz CIJELOG stack-a (`/^\s+at /` nad svim redovima) | I05-T01 (a) |
| N41 | `okviriStacka` bez provjere zaglavlja (ručni stack zadržava okvire) | I05-T01 (b) (drugo zaglavlje) |
| N42 | uklonjen `try/catch` oko opisa (R-10) | I05-T01 (d) |
| N43 | `opisNeocekivaneGreske` vraća prazne okvire uvijek | I04-T20 (a), (b), I05-T01 (e) |
| N44 | refaktor: `upisiOslobadjanja` u API-03 poslije `tx.update(refNalog)` (mijenja redoslijed upisa); zasebno poredak release-a obrnut | I04-T11, I04-T09 (d) |

## 9. Definition of Done

- [ ] Korak 1 (O-19) commit-ovan PRIJE ijednog koda sa `voucherId` u putanji; I05-T01 obara R-M47, R-M48, R-M46, R-M53, N40 … N43 (10/10).
- [ ] Sve iz sekcije 1 implementirano, ništa iz sekcije 2: `git grep -n -E "redeem|REWARD_REDEEM|redemptionRequests|VOUCHER_CANCELLED" -- backend/src`
      → samo `podaci/kolekcije.js` (`redemptionRequests`) i `greske/katalogGresaka.js` (stavke kataloga).
- [ ] Refaktor (korak 2): cijela i04 suite zelena PRIJE koraka 3 (3 uzastopna `test:emu`); I05-T21 inspekcija prolazi.
- [ ] `cd backend; npm ci; npm test; npm run test:emu; cd ..` → svi PASS (I01 … I05); `cd firebase\tests; npm ci; npm test` → svi PASS.
- [ ] Transakciona granica: I05-T10, I05-T17 (svaki upis i prije commit-a) — stanje `deepStrictEqual`.
- [ ] Double-refund: I05-T11 (a), (b) sa 20 ponavljanja zeleni u 3 uzastopna `test:emu`; raspodjela ishoda u TEST_REPORT; 0 × 500.
- [ ] Idempotentnost: API-T11 retry 0 upisa; I05-T12 (a)–(c) kasni commit + retry.
- [ ] O-5 (I05-T07), O-6 (I05-T05), O-20 (I05-T08, I05-T16), O-21 / O-22 (I05-T03) zeleni.
- [ ] I05-T20: odgovori i log (svi kanali, spawn) bez token-a, `voucherId`-a, `uid`-a, balance-a, stack-a, sirove putanje; šabloni ruta.
- [ ] Kontrolne mutacije N01 … N37, N40 … N44, R-M46, R-M47, R-M48, R-M53 obaraju ciljane testove (ili je izuzetak obrazložen u TEST_REPORT).
- [ ] `firebase/firestore.rules` i `firestore.indexes.json` nepromijenjeni (`git diff main -- firebase` prazno); RULE-T01 … RULE-T12 zeleni.
- [ ] `git grep -n -i -E "process\.env\.(NODE_ENV|TEST)|inject|ubriz|mock" -- backend/src` → prazno; `git diff main -- '*package*.json'` prazno.
- [ ] `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 poslije svakog koraka i na kraju dva puta zaredom, sa smoke-om
      `POST /api/v1/vouchers/<64 hex>/cancel` → 401 i `POST /api/v1/account/vouchers/reconcile` → 401 `UNAUTHENTICATED`.
- [ ] SRS hash nepromijenjen; `git diff main -- docs/srs` prazno; nema TODO/FIXME.
- [ ] `docs/TRACEABILITY.md` (redovi iz brief-a tačka 5, tabela O-1), `docs/IMPLEMENTATION_LOG.md` (unos i05, status `i05/P-n`, ograničenja,
      poznata ograničenja), `docs/TEST_REPORT.md` (stvarni izlaz), `docs/ODLUKE.md` (O-5, O-6, O-19 izvršeno, O-20, O-21, O-22, `i05/P-n`,
      §6 (g), (h), (j), (k), (n), (p), §9 O-5/O-6 zatvoreni, §1 stanje iteracija), README (API-05, API-06, preporučeni tok) ažurirani.
- [ ] Commit-i bez potpisa alata, svaki push-ovan; PR `iteracija-05 → main` otvoren, bez merge-a i taga.
- [ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag `i05` (ne radi Builder).

## 10. Traceability (SRS → komponenta → test)

| SRS | Komponenta | Test |
|---|---|---|
| O-19, NFR-07, D-3, O-18 | `greske/obradaGresaka.js` | I05-T01, I05-T02, I04-T16, I04-T20 |
| §26 API-05, §3.3, NFR-01 | `rute/vauceri.js`, `aplikacija.js`, `posrednici/autentikacija.js` (N) | API-T11, I05-T04; smoke 401 |
| §26 API-06, §3.3, NFR-01 | `rute/vauceri.js`, `aplikacija.js` | I05-T04, I05-T15; smoke 401 |
| §26 (bez body-ja), O-21, O-1 | `validacija/zahtjevVaucera.js` (`provjeriPraznoTijelo`) | I05-T03 |
| O-22, D-5 | `validacija/zahtjevVaucera.js` (`provjeriVoucherId`), `servisi/vauceri.js` (`FORMAT_VOUCHER_ID`), `greske/obradaGresaka.js` (N za D-5) | I05-T03, I04-T03 (c) proširen |
| §19.1, §16, §7.6, NFR-04 | `servisi/otkazivanjeVaucera.js`, `servisi/oslobadjanjeVaucera.js` | API-T11, I05-T10 |
| §19.2, NFR-05 | `servisi/otkazivanjeVaucera.js` | API-T11, I05-T06, I05-T12 |
| §19.3 | `servisi/otkazivanjeVaucera.js` | I05-T06 |
| O-5, §20.5 (analogija) | `servisi/otkazivanjeVaucera.js` | I05-T07, I05-T12 (b), AC-08 |
| O-6, §27 FORBIDDEN | `servisi/otkazivanjeVaucera.js` | I05-T05 |
| O-20, AUTH-03, AUTH-05 | `servisi/stanjeNaloga.js`, `servisi/otkazivanjeVaucera.js`, `servisi/uskladjivanjeVaucera.js` | I05-T08, I05-T16, I04-T04 |
| §18, §18.1, D-1 | `servisi/uskladjivanjeVaucera.js`, `servisi/oslobadjanjeVaucera.js` | I05-T15, I05-T17, I05-T18 |
| §11, AC-09 (RELEASE) | `servisi/oslobadjanjeVaucera.js` | API-T11, I05-T07, I05-T15, I05-T19 |
| §7.2 | `servisi/oslobadjanjeVaucera.js`, `servisi/stanjeNaloga.js` | I05-T09, I05-T19 |
| NFR-06, AC-08 | sva tri servisa + zajednički modul | I05-T11, I05-T14, I05-T18, AC-08 |
| ODLUKE §6 (g), (l), (p) | `servisi/oslobadjanjeVaucera.js`, `servisi/izdavanjeNagrade.js` | I05-T21, i04 suite, I04-T19 |
| §25.7, §31, NFR-03 | `firebase/firestore.rules` (N) | RULE-T09, RULE-T01 … RULE-T12 |
| §27 | katalog (N), `greske/obradaGresaka.js` | I05-T03 … I05-T09, I05-T16, I05-T20 |

## 11. Tehničke odluke

### 11.1 Paketi

Nema novih paketa ni promjene verzija. Koriste se `firebase-admin/firestore` (`FieldValue`, `Timestamp`), `node:test` `mock`, `node:fs` (I05-T02).

### 11.2 README (dokumentacioni korak) i `provjera.ps1`

README sekcija „API” dobija:
- **API-05** `POST /api/v1/vouchers/{voucherId}/cancel`: `Authorization: Bearer`; bez tijela (ili `{}`; svako drugo tijelo → 422, i kad
  `Content-Type` nije JSON); `voucherId` 64 mala hex znaka (inače `404 VOUCHER_NOT_FOUND`); ugovor iz sekcije 6; ponovljen cancel → isto 200
  bez novog povrata (§19.2); istekao ACTIVE → bodovi vraćeni + `409 VOUCHER_EXPIRED` (O-5); tuđi → `403 FORBIDDEN`; redoslijed provjera (5.1,
  5.5); `503` → isti poziv je bezbjedan retry.
- **API-06** `POST /api/v1/account/vouchers/reconcile`: isto tijelo i zaglavlje; `{ reconciledCount }`; greške.
- **Preporučeni tok klijenta** (ODLUKE §6 (n)): Home → API-06, pa čitanje `loyaltyAccounts` i ACTIVE voucher-a iz Firestore-a; API-03 retry
  može vratiti `"status":"ACTIVE"` za voucher kome je prošao `expiresAt` — klijent tada poziva API-06; cancel: poziv API-05, na `409 VOUCHER_EXPIRED`
  osvježi stanje (bodovi su već vraćeni).

`provjera.ps1` (korak 7): smoke korak dobija dvije provjere bez `Authorization` i bez tijela: `POST /api/v1/vouchers/<'0'×64>/cancel` → 401,
`POST /api/v1/account/vouchers/reconcile` → 401 (`code UNAUTHENTICATED`); naslov koraka dopunjen; fajl ostaje UTF-8 sa BOM-om i CRLF.

### 11.3 `firebase/firestore.rules` i indeksi

Ne mijenjaju se (5.10, `i05/P-9`). Cancel čita jedan dokument po ID-u (bez upita); API-06 koristi isti upit kao API-03 (`uid ==`, `status ==`,
bez `orderBy`/opsega), koji Firestore izvršava spajanjem jednopoljnih indeksa (i04/P-10).

### 11.4 Ostalo

- Odgovori se prave eksplicitno (`tijeloOtkazanog`, `{ reconciledCount }`), nikad `snap.data()` direktno.
- `res.locals.uid` i `res.locals.rokDo` postavlja samo postojeći posrednik.
- Builder ne mijenja `odrediKod`, katalog ni `GreskaApi`.

## 12. Ručni koraci za Anu

- Nema obaveznih. Ako `gh auth status` kaže da nije prijavljena, prije PR koraka kucati `! gh auth login`.

Ograničenja za buduće iteracije (Builder upisuje u IMPLEMENTATION_LOG i `docs/ODLUKE.md`, poslije odobrenja):
- **i06 (g):** istekao redeem (§20.5) koristi `servisi/oslobadjanjeVaucera.js` (`pripremiOslobadjanja` + `upisiOslobadjanja` sa
  `{ status: 'EXPIRED' }`) i `servisi/stanjeNaloga.js`; nijedan drugi kod ne piše `release_`.
- **i06 (h):** pravilo statičkih poruka važi automatski (I05-T02 skenira cijeli `backend/src`).
- **i07 (O-9):** ako brisanje zatvara ACTIVE voucher-e kao CANCELLED/EXPIRED, mora proći kroz isti mehanizam (release najviše jednom) ili
  odluka O-9 mora reći da RELEASE izostaje; cancel retry ne provjerava `release_` (`i05/P-4`).
- **i10:** Android poziva API-06 na Home-u i poslije `409 VOUCHER_EXPIRED` iz API-05 osvježava stanje; `Content-Length: 0` bez tijela (Retrofit
  `@POST` bez `@Body`) je ispravan zahtjev.

## 13. Otvorena pitanja za Orchestrator-a

Nijedno nije protivrječnost SRS-a koja blokira plan. P-1 … P-10 su prijedlozi koje brief izričito traži; P-11 … P-14 informativni.
Jedno odstupanje od teksta brief-a je označeno: **P-12 (prazan `voucherId` → `NOT_FOUND`, ne `VOUCHER_NOT_FOUND`)**.

**i05/P-1 (brief traži): ugovor API-05 i API-06.**
Sekcija 6: API-05 → 200 i za prvi i za ponovljen cancel; tijelo TAČNO `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt, cancelledAt }`
tim redoslijedom, ista funkcija za prvi odgovor (upisani objekat) i retry (SAČUVANI dokument), vremena `toDate().toISOString()`. O-5 → 409
`VOUCHER_EXPIRED` poslije commit-a. API-06 → 200 `{ reconciledCount }`. Alternative: API-05 bez `issuedAt`/`expiresAt` (kraće; ali isti prefiks
kao API-03 olakšava Android model); API-06 `204` bez tijela ili sa listom `voucherId`-eva (odbačeno, sekcija 6). Preporuka: kako je navedeno.

**i05/P-2 (brief traži): politika tijela O-21.**
Pravilo 5.3: `req.body` (poslije globalnog parsera) mora biti `undefined` ILI prazan običan objekat; kad je `undefined`, zahtjev ne smije nositi
nepročitano tijelo (`Transfer-Encoding` prisutan ili `Content-Length` različit od `'0'` → 422). Proba B1: bez ovog dodatka `text/plain`/bez
`Content-Type` tijelo sa `{"uid":"x"}` bi prošlo kao „bez tijela”. Prihvata Retrofit oblik (`Content-Length: 0`, bez `Content-Type`).
Posljedica: chunked prazno tijelo BEZ JSON `Content-Type` → 422. Alternative: (a) samo `req.body === undefined || {}` (prihvata nepročitana
tijela — krši O-21 „svako drugo tijelo → 422”); (b) poseban parser za ove rute koji čita svako tijelo (mijenja arhitekturu parsera i01/i02).
Preporuka: 5.3.

**i05/P-3 (brief traži): izvor vremena za `cancelledAt` i poređenje isteka.**
`cancelledAt = Timestamp.fromMillis(sadaMs)`, isti `sadaMs = Date.now()` (jednom po pokušaju, na početku callback-a) koji odlučuje O-5 (`jeIstekao`).
Razlozi: (1) §1.4 „Server timestamp: vrijeme koje određuje Backend/Firebase server environment” — sat Backend-a je serverTime, Android sat nije
uključen (§17); (2) vrijednost je poznata prije commit-a, pa je prvi odgovor identičan sačuvanom dokumentu bez dodatnog čitanja (§19.2, brief:
tijelo iz sačuvanog dokumenta); (3) isti izvor kao `issuedAt`/`expiresAt` i odluka o isteku (i04/P-2), pa važi invarijanta `cancelledAt < expiresAt`
za svaki CANCELLED voucher (testirano u API-T11, I05-T07). Ledger `createdAt` i `loyaltyAccounts.updatedAt` = jedan `serverTimestamp()` po
transakciji (i04/P-2). Alternativa: `FieldValue.serverTimestamp()` za `cancelledAt` — vrijednost nepoznata do commit-a; prvi odgovor bi zahtijevao
čitanje poslije commit-a (dodatni poziv, novi 503 prozor) ili bi se razlikovao od retry-ja. Poznato ograničenje (kao i04/P-2): razlika satova
Backend/Firestore između `cancelledAt` i ledger `createdAt`.

**i05/P-4 (brief traži): redoslijed provjera (O-20) i skup nekonzistentnih stanja.**
Cancel (5.5): rok → `vouchers/{id}` postoji (404) → `uid` ispravan (500) → vlasnik (403) → ispravnost voucher-a (500) → CANCELLED (200; bez
`cancelledAt` → 500) / REDEEMED (409) / EXPIRED (409) → nalog (409 / 409 / 500) → istek (O-5) → `release_` postoji (500) → `reserved < cost` (500)
→ upisi. API-06 (5.6): rok → nalog (409 / 409 / 500) → upit (neispravan ACTIVE → 500) → `release_` (500) → `reserved` (500) → upisi.
Obrazloženje: O-20 (idempotentni povrat i terminalni 409 prije naloga — nema loyalty mutacije, AUTH-05 blokira samo mutacije); O-6 (vlasnik prije
statusa, pa tuđem korisniku se ne otkriva ni stanje voucher-a: tuđi CANCELLED → 403, ne 200); `uid` prije vlasništva (voucher bez vlasnika je
nekonzistentan, ne „tuđi”); nalog prije isteka (AUTH-05: nalog u brisanju ne dobija ni O-5 release). Nalog za API-06 PRIJE upita (O-20: „ništa
upisano”, i ne čita voucher-e naloga u brisanju). Skup nekonzistentnih stanja: kraj 5.5 i 5.8.
**Retry CANCELLED / EXPIRED bez provjere `release_` u ledger-u** — preporuka: NE provjerava se. Razlozi: (1) status i release nastaju samo u istoj
transakciji (NFR-04, dokazano failure injection testovima I05-T10, I05-T17, I04-T11), pa stanje „terminalan bez release-a” ne može nastati kroz
Backend; (2) retry grana je read-only, a 500 bi trajno blokirao klijenta bez mogućnosti oporavka (nekonzistentnost se ne „popravlja”, ali se ni
ne otkriva ničim što klijent može riješiti); (3) i07 (O-9) još ne zna da li zatvaranje voucher-a pri brisanju piše RELEASE i kada se ledger
pseudonimizuje (`uid = null`) — provjera bi vezala i05 za odluku koja nije donesena; (4) jedno čitanje manje u najčešćem retry putu.
Alternativa: `tx.get(release_{id})` za CANCELLED/EXPIRED; ne postoji ili `voucherId`/`type` ne odgovara → 500 (cijena: dodatno čitanje + i07 rizik).

**i05/P-5 (brief traži): raspored fajlova i plan refaktora zajedničkog mehanizma.**
5.7 i 5.8: `servisi/oslobadjanjeVaucera.js` (`procitajIstekleAktivne`, `pripremiOslobadjanja`, `upisiOslobadjanja`), `servisi/stanjeNaloga.js`
(`procitajStanjeNaloga`), premještanje validatora voucher-a i `FORMAT_VOUCHER_ID` u `servisi/vauceri.js`. Refaktor = korak 2 (zaseban commit):
samo premještanje koda iz `izdavanjeNagrade.js` + uopštenje `izmjena`; dokaz: cijela i04 suite zelena 3 puta i `provjera.ps1` → 0, PRIJE koraka 3.
**I04-T19 se ne mijenja**: modul ne čita sat, `izdavanjeNagrade.js` čita `Date.now()` isto kao danas (ODLUKE §6 (p) — nema refaktora sata, pa
nema ni usklađivanja). Alternative: (a) sve u `vauceri.js` (miješa čiste funkcije i rad sa `tx`); (b) `stanjeNaloga` ostaviti dupliran u tri servisa
(manji refaktor API-03, ali tri kopije AUTH-05 blokade; N14 bi tada trebalo izvesti tri puta). Preporuka: kako je navedeno.

**i05/P-6 (brief traži): korak O-19 i pravilo statičkih poruka.**
Korak 1 (5.9): okviri tek poslije zaglavlja `${name}: ${message}` (inače bez okvira) — tačno smjer iz O-19; testovi I05-T01 (a)–(e) obaraju R-M47,
R-M48, R-M46, R-M53 i povratak R-07; postojeći I04-T20 i I04-T16 ostaju zeleni (proba G1). **R-10 se rješava u istom koraku** (ista funkcija,
try/catch sa statičkim opisom `(opis greške nedostupan)`, test I05-T01 (d)) — preporuka brief-a. R-11 i R-12 ostaju poznata ograničenja.
Pravilo statičkih poruka: automatski test I05-T02 (statička analiza izvora `backend/src`: argument svakog `new …Error(` je jedan string literal;
jedini izuzetak `GreskaApi.js`) + runtime dokaz I05-T20 (log 500 iz novih servisa bez `voucherId`/`uid`). Alternativa: samo review (status quo
ODLUKE §6 (h)) — odbačeno jer brief traži test.

**i05/P-7 (informativno uz P-6): `GreskaApi` 5xx log.** Zaglavlje `GreskaApi: SERVICE_UNAVAILABLE` (proba B2) — 503 zapis zadržava okvire
kao danas (I05-T01 (e)).

**i05/P-8 (brief traži): gornja granica broja voucher-a u API-06.**
Preporuka: BEZ granice. §18.1 traži „за сваки ACTIVE voucher … у једној transaction”; granica (ili dijeljenje u više transakcija) bi to prekršila.
Firestore je 2023-03-29 ukinuo limit od 500 upisa po commit-u/transakciji (Firestore release notes; https://docs.cloud.google.com/firestore/docs/release-notes,
https://firebase.google.com/docs/firestore/quotas); ostaju 10 MiB po zahtjevu, 270 s po transakciji (60 s neaktivnosti) i 500 transformacija polja po
DOKUMENTU (svaki `release_` ima jedan `serverTimestamp`). Proba L1: 500 isteklih (1001 upis) u 538 ms nad emulatorom. Praktična granica je rok
zahtjeva (10 s → 503, stanje konzistentno, retry bezbjedan). Svaki voucher zahtijeva ≥ 30 rezervisanih bodova (SHOWER), pa stotine isteklih
voucher-a jednog korisnika nisu realne u MVP-u. Poznato ograničenje (nastavak i04/P-16); produkcija nije provjerljiva (CLAUDE.md: testovi samo nad
emulatorom). I05-T15 (e) mjeri 200. Alternativa: granica npr. 100 po pozivu + ponovni poziv klijenta (krši „jedna transakcija”, mijenja ugovor).

**i05/P-9 (brief traži): composite indeks.**
Nije potreban. Cancel čita jedan dokument po ID-u (nema upita). API-06 koristi ISTI upit kao API-03 (`uid ==`, `status ==`, bez `orderBy` i opsega),
koji Firestore izvršava spajanjem automatskih jednopoljnih indeksa (i04/P-10); probe K2 i L1 potvrđuju rad u emulatoru (emulator ne provjerava
indekse). `firestore.indexes.json` ostaje prazan; neprovjerljivost nad produkcijom ostaje u poznatim ograničenjima (i04/P-10).

**i05/P-10 (brief traži): proširenja test pomoćnika.**
Nijedno nije potrebno: `omotacBaze` već ima `baciNaUpisu`, `baciPrijeCommita`, `sakrijPostojece` (i za upit), `zadrziPrijeCommitaMs`,
`odbijTransakcijuSa`, `prijeCommita`, `prisiliPonovniPokusaj`, `brojPristupa`, `brojTransakcija`, `upisi`, `sveTransakcijeZavrsene`. `fajlPozivaoca`,
`pripremi*`, `snimak*` i PRNG su lokalni u test fajlovima (kao i04). Ako Builder ipak mora proširiti `omotacBaze`, dozvoljeno je samo dodavanje opcije
sa nepromijenjenim postojećim granama (odstupanje OD-n u IMPLEMENTATION_LOG).

**i05/P-11 (informativno): dva oblika 422 zavisno od tipa tijela.** JSON skalar / `null` / neispravan JSON → 422 i bez token-a (globalni parser,
i02/P-6, K-1); objekat sa poljem / niz / ne-JSON tijelo → 401 bez token-a, 422 sa token-om. Oba deterministička, bez baze. Upisuje se u README.

**i05/P-12 (informativno — ODSTUPANJE od liste brief-a, tačka 7): prazan `voucherId`.** Brief među neispravnim formatima navodi „prazno” → 404
`VOUCHER_NOT_FOUND`. `/api/v1/vouchers//cancel` ne pogađa rutu (Express parametar traži ≥ 1 znak; isto ponašanje i04 E7 za `/rewards//issue`), pa je
ishod 404 `NOT_FOUND` iz `nepoznataRuta`, bez token-a i bez baze. Prazan string ostaje u jediničnom testu `provjeriVoucherId` (`VOUCHER_NOT_FOUND`).
Opcije: (A) prihvatiti `NOT_FOUND` za HTTP (preporuka; oba su 404 bez pristupa bazi i bez vrijednosti u logu); (B) posebna ruta za prazan segment —
nova ruta van §26, odbačeno.

**i05/P-13 (informativno): 403 i postojanje voucher-a.** O-6 svjesno otkriva da voucher postoji (403 vs 404). Rizik je mali: `voucherId` ima 256 bita
i sam je tajna (ko ga zna, već može pokušati redeem na POS-u, §1.4). Tuđi voucher se čita samo do polja `uid`; tijelo 403 je samo §27; log bilježi šablon rute.

**i05/P-14 (informativno): `reconciledCount` pod kontencijom.** Broji samo voucher-e koje je oslobodio commit-ovan pokušaj OVOG zahtjeva; zbir
kroz paralelne pozive je ≤ broj isteklih (jednak kad nema 503). Android ga ne koristi za balance (čita `loyaltyAccounts`).

## 14. IMPLEMENTATION PLAN za Builder-a

Opšte: poslije svakog commit-a odmah `git push origin iteracija-05`. Commit poruke na srpskom, bez potpisa alata. Prije commit-a `git status`
sadrži samo fajlove tog koraka. Testovi prvi (crveni, izlaz zabilježen za TEST_REPORT), pa kod; gdje test ne može biti crven (kod već postoji),
test-first se dokazuje kontrolnim mutacijama (kao i04 OD-3). Svaki commit: `npm test` zelen; emulator testovi zeleni najkasnije na commit-u koraka
u kojem su dodati; `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 poslije svakog koraka. Emulator komande sa JBR-om prvim u PATH-u. Nijedan novi paket.
Ako konkurentni test da 500, Builder STAJE i javlja (R19).

**Korak 0: Odluke Orchestrator-a** — Builder doslovno upisuje odluke u sekciju 15 ovog plana. Commit: `i05: odobrenje plana i odluke Orchestrator-a`.

**Korak 1: Obaveza O-19 — log 5xx (I05-T01, I05-T02)** — PRIJE bilo kakvog koda sa `voucherId` u putanji.
- Fajlovi: `backend/test/jedinicni/opisGreske5xx.test.js` [D], `backend/test/jedinicni/staticnePoruke.test.js` [D], `backend/src/greske/obradaGresaka.js` [I] (5.9).
- Crveno: I05-T01 (a) (red `at TAJNA` u logu), (b) ručni stack sa drugim zaglavljem (okviri sa tajnom), (d) (rukovalac baca) padaju na postojećem kodu.
  I05-T02 je zelen od početka (pravilo već važi) — test-first: mutacija N26 nad privremenim izvorom ga obara.
- Zeleno poslije 5.9. Dokaz: `npm test` PASS; `npm run test:emu` PASS (I04-T16, I04-T20 nepromijenjeni i zeleni); mutacije R-M47, R-M48, R-M46, R-M53,
  N40 … N43 po 10/10 (izlaz za TEST_REPORT); `provjera.ps1` → 0.
- Commit: `i05: log 5xx bez redova poruke u okvirima i bez bacanja iz opisa greške (O-19: R-07 … R-10)`

**Korak 2: Zajednički mehanizam oslobađanja — refaktor API-03 bez promjene ponašanja (5.7, 5.8)**
- Fajlovi: `backend/src/servisi/oslobadjanjeVaucera.js` [D], `backend/src/servisi/stanjeNaloga.js` [D], `backend/src/servisi/vauceri.js` [I],
  `backend/src/servisi/izdavanjeNagrade.js` [I]. Nijedan test fajl se ne mijenja (`git diff -- backend/test` prazno; I04-T19 netaknut).
- Pravilo: kod se PREMJEŠTA (iste provjere, isti redoslijed čitanja i upisa, iste statičke poruke); jedino uopštenje je polje `izmjena`.
- Dokaz: `npm test` PASS; `npm run test:emu` PASS 3 uzastopna izvršavanja (API-T07 20 ponavljanja, I04-T09 (d), I04-T11, I04-T19 zeleni);
  inspekcija I05-T21 (`release_` samo u novom modulu, modul bez `Date.now`); mutacija N44 obara I04-T11 / I04-T09 (d); `provjera.ps1` → 0.
- Commit: `i05: zajednički mehanizam oslobađanja voucher-a i stanja naloga, API-03 bez promjene ponašanja (§18.1, ODLUKE §6 (g))`

**Korak 3: Validacija tijela i `voucherId` (I05-T03 (a))**
- Fajlovi: `backend/test/jedinicni/zahtjevVaucera.test.js` [D], `backend/src/validacija/zahtjevVaucera.js` [D].
- Crveno: `ERR_MODULE_NOT_FOUND`. Zeleno poslije 5.3, 5.4 (po odobrenom `i05/P-2`). Dokaz: `npm test` PASS; `provjera.ps1` → 0.
- Commit: `i05: validacija praznog tijela (O-21) i formata voucherId (O-22)`

**Korak 4: API-05 cancel (API-T11, I05-T03 (b), I05-T04 cancel dio, I05-T05 … I05-T09; proširenje I04-T03 (c))**
- Fajlovi: `backend/test/emulator/otkazivanjeVaucera.test.js` [D], `backend/test/jedinicni/dekodiranjePutanje.test.js` [I] (samo novi ulazi),
  `backend/src/servisi/otkazivanjeVaucera.js` [D], `backend/src/rute/vauceri.js` [D] (samo ruta cancel), `backend/src/aplikacija.js` [I].
- Crveno: ruta ne postoji (404 `NOT_FOUND` umjesto očekivanih kodova); izlaz zabilježen. Zeleno poslije 5.2, 5.5, sekcija 6 (po odobrenom `i05/P-1`).
- Dokaz: `npm test`, `npm run test:emu` PASS; `provjera.ps1` → 0.
- Commit: `i05: POST /vouchers/{voucherId}/cancel u jednoj Firestore transakciji sa REWARD_RELEASE (API-T11, O-5, O-6, O-20)`

**Korak 5: API-06 reconcile (I05-T04 API-06 dio, I05-T15, I05-T16)**
- Fajlovi: `backend/test/emulator/uskladjivanjeVaucera.test.js` [D], `backend/src/servisi/uskladjivanjeVaucera.js` [D], `backend/src/rute/vauceri.js` [I].
- Crveno: ruta ne postoji. Zeleno poslije 5.6. Dokaz: `npm test`, `npm run test:emu` PASS; `provjera.ps1` → 0.
- Commit: `i05: POST /account/vouchers/reconcile — istekli ACTIVE voucher-i u EXPIRED sa REWARD_RELEASE u jednoj transakciji (§18.1)`

**Korak 6: Atomičnost, konkurentnost, idempotentnost, rok, sat i očuvanje bodova (AC-08, I05-T10 … I05-T14, I05-T17 … I05-T19)**
- Fajlovi: `backend/test/emulator/vauceriAtomicnost.test.js` [D]. Samo testovi; test-first kroz mutacije N01, N03, N04, N07, N11, N12, N20, N29, N30.
- Dokaz: `npm run test:emu` PASS 3 uzastopna izvršavanja (statistika I05-T11, I05-T18, raspodjela I05-T19 iz `t.diagnostic`); `provjera.ps1` → 0.
- Commit: `i05: testovi double-refund-a, kasnog commit-a, roka, sata po pokušaju i očuvanja bodova (AC-08, NFR-04 … NFR-06)`

**Korak 7: Log bez tajni i smoke (I05-T20; `provjera.ps1`)**
- Fajlovi: `backend/test/emulator/logVaucera.test.js` [D], `skripte/provjera.ps1` [I] (UTF-8 BOM, CRLF).
- Dokaz: `npm run test:emu` PASS; `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 sa šest smoke provjera.
- Commit: `i05: test loga bez voucherId-a za API-05 i API-06 i smoke 401 za nove rute`

**Korak 8: Kontrolne mutacije (bez commit-a koda)** — N01 … N37, N40 … N44 (i R-M* iz koraka 1 ponovo na kraju), svaka lokalno pa `git restore`; ishod
(komanda, ciljani test, n/10, prva poruka) u TEST_REPORT. Preživjela → dopuna testa u zasebnom commit-u `i05: ojačan test … (nalaz mutacije Nnn)` +
`provjera.ps1` → 0.

**Korak 9: Dokumentacija checkpoint-a i PR**
- Fajlovi: `docs/TEST_REPORT.md` (sekcija i05: stvarni izlaz komandi iz brief-a tačka 8, `test:emu` ×3, `provjera.ps1` ×2, rezultat po ID-u, statistika
  I05-T11 / I05-T18 / I05-T19, mutacije n/10, inspekcije iz sekcije 9), `docs/IMPLEMENTATION_LOG.md` (unos i05: CHANGELOG, commit-i, fajlovi,
  odstupanja OD-n, status `i05/P-n`, ograničenja iz sekcije 12, poznata ograničenja: P-3 satovi, P-8 bez granice / produkcija neprovjerljiva, P-9,
  P-11, P-12, P-13, R-11, R-12), `docs/TRACEABILITY.md` (redovi iz brief-a tačka 5; tabela O-1: `NOT_FOUND` i za prazan segment / nove rute,
  `INVALID_REQUEST` za tijelo endpoint-a bez body-ja), `docs/ODLUKE.md` (O-5, O-6, O-19 izvršeno, O-20, O-21, O-22, odluke `i05/P-n` iz sekcije 15,
  ažurirani §6 (g), (h), (j), (k), (n), (p), nova ograničenja iz sekcije 12, §9 O-5 i O-6 zatvoreni, §1 stanje iteracija i04 ACCEPTED / i05),
  `README.md` (11.2).
- Dokaz: `git diff main -- docs/srs` prazno; hash odgovara; `provjera.ps1` → 0 dva puta zaredom.
- Commit: `i05: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost, registar odluka i README za iteraciju 5`
- PR: `gh pr create --base main --head iteracija-05 --title "i05: Voucher cancel i account reconcile"`, opis na srpskom (isporuka A–G, brief tačka 9),
  bez potpisa alata. BEZ merge-a i BEZ taga.

## 15. Odluke Orchestrator-a (odobrenje plana)

Plan je ODOBREN (Orchestrator, 2026-10-18) uz ispravke K-1 … K-3 ispod. Ana je odluke O-5 i O-6 donijela (brief); O-20 … O-22 su odluke Orchestrator-a iz briefa.

i05/P-1  Odobreno: API-05 vraća 200 i za prvi poziv i za retry; tijelo sa 7 ključeva u fiksnom redoslijedu iz plana sekcije 6; API-06 vraća 200 { reconciledCount }.
i05/P-2  Odobreno: pravilo tijela za endpoint-e bez tijela (O-21): prazno tijelo ili {} je valjano, sve ostalo 422 INVALID_REQUEST; kad je req.body === undefined,
         zahtjev ne smije nositi nepročitan sadržaj (Transfer-Encoding prisutan ili Content-Length različit od '0' → 422). Retrofit oblik (Content-Length: 0, bez Content-Type) se prihvata.
i05/P-3  Odobreno: cancelledAt = Timestamp.fromMillis(sadaMs); jedan sadaMs po pokušaju transakcije (i04/P-2, obaveza (j)).
i05/P-4  Odobreno: redoslijed provjera iz plana 5.1 i 5.5 (O-20): idempotentni CANCELLED (200, bez upisa) i REDEEMED/EXPIRED 409 PRIJE provjere naloga; provjera naloga
         (NOT_INITIALIZED 409, DELETION_IN_PROGRESS 409, inače 500) samo na ACTIVE putanji koja mijenja stanje. Odobrena preporuka: na retry-u se NE provjerava postojanje release_{voucherId}.
         API-06: provjera naloga ide prva.
i05/P-5  Odobreno: raspored fajlova iz plana (servisi/oslobadjanjeVaucera.js, servisi/stanjeNaloga.js, servisi/otkazivanjeVaucera.js, servisi/uskladjivanjeVaucera.js,
         validacija/zahtjevVaucera.js, rute/vauceri.js). Refaktor zajedničkog mehanizma NE mijenja ponašanje API-03; I04-T19 i sav test kod i01–i04 ostaju netaknuti
         (git diff -- backend/test u koraku 2 mora biti prazan).
i05/P-6  Odobreno: O-19 izmjena u greske/obradaGresaka.js (okviriStacka bez ijedne linije poruke iz err.stack; R-10: opis greške ne smije baciti izuzetak) ide u KORAK 1,
         zajedno sa I05-T01 i I05-T02 (statička analiza: identifikatori se ne interpoliraju u new Error poruke ni u logove). Testovi koji ubijaju R-M47 i R-M48 + pokrivanje R-08/R-09.
i05/P-7  Prihvaćeno (informativno).
i05/P-8  Odobreno: API-06 bez gornje granice broja voucher-a; ograničenje (Firestore 10 MiB / 270 s po transakciji) ide u poznata ograničenja.
i05/P-9  Odobreno: firestore.indexes.json i firestore.rules se ne mijenjaju (nema složenog indeksa).
i05/P-10 Odobreno: bez proširenja omotacBaze.js osim ako korak to stvarno traži; ako traži, samo aditivno i uz odstupanje OD-n.
i05/P-11 Odobreno: dva oblika 422 (skalarni/null JSON → 422 i bez tokena; objekat/niz → 401 bez tokena), kao u planu.
i05/P-12 Odobreno kao DOKUMENTOVANO ODSTUPANJE od briefa: /vouchers//cancel → 404 NOT_FOUND (ne VOUCHER_NOT_FOUND), jer prazan segment nije ruta. Upisati u ODLUKE.md i README.
i05/P-13 Prihvaćeno (informativno): 403 otkriva postojanje tuđeg voucher-a (O-6). Upisati u README.
i05/P-14 Prihvaćeno (informativno): reconciledCount pod kontencijom broji samo voucher-e koje je ta transakcija zaista oslobodila. Upisati u README.

Ispravke plana (obavezujuće):
K-1 I05-T14 (deterministički test) mora dokazati svoj ishod bez oslanjanja na kontenciju/503 i bez oslanjanja na to da upit nad vouchers serijalizuje transakcije
    (pouka i04 R-01). Ako test može proći i kad je zaštita uklonjena, to je preživjela mutacija i test se jača.
K-2 docs/ODLUKE.md (korak 9): upisati O-5, O-6 (odlučeno), O-20, O-21, O-22, odluke i05/P-n, ograničenja iz plana, zatvorene obaveze (g), (h), (j), (k), (n), (p) i status
    obaveze (o) (ostaje za i07). Stanje iteracija: i05 — "BUILDER završio, čeka review".
K-3 Ako bilo koji test pod kontencijom vrati 500 (R19), ili test nije 10/10 u oba smjera (sa kodom prolazi, bez zaštite pada), Builder STAJE i javlja. Ne improvizuje.
