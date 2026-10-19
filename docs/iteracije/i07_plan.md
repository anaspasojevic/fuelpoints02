# i07 — Plan (PLANNER)

Iteracija 7: Brisanje naloga (API-07). Grana `iteracija-07` (iz `main` = merge `9aae907`, tag `i06`).
Izvori: `CLAUDE.md`, `docs/iteracije/i07_brief.md` (obavezujući, posebno tačke 5 i 10), `docs/ODLUKE.md` (sve sekcije), SRS 3.1
(`docs/srs/FuelPoints_SRS_3_1.docx`, normativan, SHA-256 `7D866413…C60228` provjeren; `.md` čitljiva kopija), `docs/iteracije/i06_plan.md`
(struktura, sekcije 5 i 14), `i06_review.md` (R-01 … R-04), kod na vrhu grane (`58cb6d5` = `9aae907` + brief).
Datum plana: 2026-10-19. Uloga: PLANNER (bez koda). Režim: ekspresni (O-30, O-31). `provjera.ps1` nije pokretan.

Oznake: otvorena pitanja `i07/P-n` (sekcija 13); dopunski testovi `I07-T01 … I07-T16`; ključne mutacije `D01 … D11` (sekcija 9).
Probe su rađene privremenom skriptom u scratchpad-u sesije (van repoa, nije commit-ovana); ishod je u sekciji 3.2.

---

## 1. SRS zahtjevi u opsegu

| SRS / odluka | Šta se radi | Sekcija plana |
|---|---|---|
| §26 API-07, §3.3, NFR-01 | `DELETE /api/v1/account` sa postojećim `napraviProvjeruTokena` vezanim SAMO na tu rutu; UID samo iz verifikovanog token-a | 5.1, 5.2 |
| §26 „без body-ја”, O-21 | `provjeriPraznoTijelo` (postojeća) → 422 `INVALID_REQUEST` | 5.1 |
| §23 recent auth, §27 `REAUTHENTICATION_REQUIRED`, O-35 | `auth_time` iz verifikovanog token-a; `Date.now() ≤ auth_time·1000 + 300 000` (i07/P-2); inače 409 bez pristupa bazi; i za nastavak | 5.3 |
| §23.1, AUTH-05, O-32, O-36 | Tok 1 → 3 → 4a → 5 → 4b → 6; koraci 1, 3, 4b transakcije; 4a / 5 upiti + paketi ≤ 400 | 5.4 |
| §16, §18.1, §19.1, §7.6, §11, O-9, O-34, ODLUKE §6 (g), (r) | Korak 3: svaki ACTIVE voucher → CANCELLED + `cancelledAt` ili (istekao) EXPIRED, + `REWARD_RELEASE` kroz `oslobadjanjeVaucera.js`, u transakciji sa `loyaltyAccounts` | 5.4 (K3), 5.5 |
| §23.2, ODLUKE §6 (f), (m), (u) | Korak 4a: `rewardRequests`, `redemptionRequests` PRIJE `vouchers`; `notifications`; `vouchers`; `loyaltyAccounts` | 5.4 (K4a), 5.6 |
| §23.3, §11, AC-11, §33.5 | Korak 5: `purchases` i `loyaltyLedger` sa `uid` → `uid = null` (samo to polje) | 5.4 (K5) |
| ODLUKE §6 (a) | Korak 4b: `users/{uid}` POSLJEDNJI Firestore dokument | 5.4 (K4b) |
| §23.1 (6), §23.4 | Korak 6: `auth.deleteUser(uid)` posljednji; ponovljen DELETE nastavlja; O-34b | 5.4 (K6), 5.7 |
| O-33 | 204 bez tijela (prvo i nastavljeno brisanje) | 5.2 |
| §10, O-10a, O-3, O-12, ODLUKE §6 (d) | `evidencijaKupovine.js`: sačuvan purchase sa `uid === null` → `uid` se ne poredi | 5.8 |
| AUTH-04, AUTH-05, ODLUKE §6 (o) | Postojeće blokade (init 409, purchase 404, issue / cancel / redeem / API-06 409) + deterministički testovi promjene `users` usred transakcije | 5.9, I07-T08, I07-T09 |
| NFR-04, AC-09, AC-11, API-T12 | Testovi sekcije 8 | 8 |
| §27, O-1, O-18, D-3, §6 (h) | Kodovi po brief-u tačka 2; log bez `uid`-a i token-a; statičke poruke | 5.10 |

## 2. Van opsega

- Device registrations / FCM (§22; nema kolekcije), Android (Delete Account ekran, reauth — i10), `firestore.rules` (i08), B-1 (i08), B-2 (i09),
  admin / ručne korekcije, novi npm paketi, test-only kod u `backend/src`.
- Promjena ugovora API-01 … API-06 osim O-10a. `firestore.indexes.json` se ne mijenja (upiti `uid ==` koriste jednopoljni indeks).
- Nova kolekcija (npr. „tombstone” obrisanih UID-ova) — §24 je zatvoren spisak (i07/P-1, opcija D odbačena).

## 3. Polazno stanje i probe

### 3.1 Korak 0

- `git fetch --all --tags; git switch main; git pull` → „Already up to date”; `git describe --tags` → `i06`; HEAD `9aae907`; radni direktorijum čist.
- SRS hash: `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (ispravan).
- `iteracija-07` napravljena; brief upisan doslovno (`58cb6d5`, push-ovano).
- Zatečeno: svi mapping-i imaju `uid` (`rewardRequests`: `{ uid, requestId, rewardId, voucherId, createdAt }`; `redemptionRequests`:
  `{ stationId, uid, … }`); `notifications`, `vouchers`, `purchases`, `loyaltyLedger` imaju `uid`. `REAUTHENTICATION_REQUIRED` već postoji u
  katalogu (409). `omotacBaze` NEMA `batch()` (ima samo `collection`, `doc`, `getAll`, `runTransaction`). Posrednik ne izlaže `auth_time`.
  `ODLUKE.md` §1 još navodi i06 kao „čeka review” (Builder ažurira po brief-u 10).

### 3.2 Probe (scratchpad, nisu commit-ovane; `firebase emulators:exec`, demo-fuelpoints, JDK 24 prvi na PATH-u)

| Proba | Ishod |
|---|---|
| P-a (`auth_time`) | Dekodiran token Auth emulatora: `auth_time` je **broj u sekundama** (= `iat` pri `signUp`; `signInWithPassword` daje novi `auth_time`). `tokensValidAfterTime` novog korisnika = trenutak kreiranja. **Nepotpisan token sa `auth_time = sada − 300` (ili − 301) uz `verifyIdToken(t, true)` → `auth/id-token-revoked`** (provjera opoziva poredi `auth_time` sa `validSince`; isto za `createUser`). Dakle test NE može dobiti „star” `auth_time` kroz token. Nepotpisan token BEZ `auth_time` → prolazi verifikaciju (`auth_time` `undefined`); `auth_time` kao string → prolazi. **Zaključak:** test svježine koristi pravi token (`auth_time = T`) i mock `Date.now` SAMO za pozive iz modula provjere svježine (obrazac I04-T19 / I05-T13): `T·1000 + 300 000` → dozvoljeno, `+ 300 001` i `T + 301 s` → 409; odvojeno nepotpisan token bez `auth_time` → 409 (fail closed, i07/P-2). |
| P-b (`deleteUser`) | `auth.deleteUser(uid)` → `verifyIdToken(staritoken, true)` → `auth/user-not-found` (→ 401 kroz postojeći `klasifikujGreskuAuth`). Drugi `deleteUser` istog UID-a → baca `auth/user-not-found`. Ponovna registracija istim e-mailom → NOVI UID. **Zaključak:** korak 6 tretira `auth/user-not-found` kao „već obrisan” (idempotentnost pod paralelnim DELETE-om); ponovljen DELETE poslije uspješnog koraka 6 dobija 401 (i07/P-8). |
| P-c (upit + paket) | `where('uid','==',u).get()` + `batch.delete` za 50 dokumenata: ~310 ms (prvi poziv), 450: ~200 ms; pseudonimizacija 50 (`batch.update {uid:null}`): ~130 ms, poslije 0 sa `uid`, 50 sa `uid == null`. **Emulator NE provjerava granicu od 500 upisa po paketu** (501 prolazi) — granica ≤ 400 (O-36) se ne može dokazati padom u emulatoru, samo brojanjem operacija po paketu u omotaču (I07-T06 (c)). `batch.update` nepostojećeg → gRPC `5 NOT_FOUND`; `batch.delete` nepostojećeg → OK. `tx.get(query)` + `tx.delete` radi. |
| P-d (`prijePokusaja`, obaveza (o)) | Inspekcija: init, purchase, issue, cancel, redeem i API-06 svi dobijaju `servisi.db` (rute `nalog.js`, `kupovine.js:12`, `nagrade.js:13`, `vauceri.js:15,22`, `otkupVaucera.js:14`) i čitaju `users/{uid}` U SVOJOJ transakciji (`tx.getAll` / `tx.get`; redeem po `vaucer.uid`, purchase poslije O-12 čitanja kupovine). `omotacBaze.runTransaction` poziva `prijePokusaja(pokusaj)` prije svakog pokušaja za svaku transakciju, pa uz `prisiliPonovniPokusaj: 1` pokriva sve šest (i06 P-d: druga operacija se izvrši do kraja između pokušaja 1 i 2). **Zaključak: postojeći hook je dovoljan za (o); proširenje omotača je potrebno samo za `batch()` i dnevnik redoslijeda (i07/P-7).** |

## 4. Raspored fajlova

**Novi**
- `backend/src/rute/brisanjeNaloga.js` — `dodajRuteBrisanja(ruter, { servisi })`.
- `backend/src/posrednici/svjezinaPrijave.js` — `MAKSIMALNA_STAROST_PRIJAVE_MS = 300_000`, `jeSvjezaPrijava(authTime, sadaMs)`, `provjeriSvjezinuPrijave(authTime)`
  (jedini poziv `Date.now()` u modulu → mock po fajlu).
- `backend/src/servisi/brisanjeNaloga.js` — `obrisiNalog(db, auth, { uid }, rokDo)`; koraci kao zasebne funkcije modula (5.4).
- Testovi: `backend/test/jedinicni/svjezinaPrijave.test.js`, `backend/test/emulator/brisanjeNaloga.test.js` (API-T12, I07-T02 … T07, T12),
  `emulator/brisanjeAtomicnost.test.js` (I07-T06, T11, T13), `emulator/blokadeBrisanja.test.js` (I07-T08, T09, T15), `emulator/kupovinaPseudonim.test.js`
  (I07-T10), `emulator/logBrisanja.test.js` (I07-T14); pomoćnik `backend/test/pomocnici/omotacAutha.js`.

**Izmijenjeni**
- `backend/src/posrednici/autentikacija.js` — opcija `napraviProvjeruTokena(auth, { izloziAuthTime = false } = {})`; samo uz `true` postavlja
  `res.locals.authTime = dekodiran.auth_time`. Bez opcije ponašanje identično i06 (O-35 „samo za ovu rutu”).
- `backend/src/servisi/oslobadjanjeVaucera.js` — nova `procitajAktivneZaZatvaranje(tx, db, { uid, sadaMs })` (5.5); ostalo netaknuto.
- `backend/src/servisi/evidencijaKupovine.js` — O-10a (5.8), jedan uslov.
- `backend/src/aplikacija.js` — `dodajRuteBrisanja(ruterApi, { servisi })`.
- `backend/test/pomocnici/omotacBaze.js` — `batch()` (prolaz, brojanje, dnevnik, `baciNaUpisu` važi i za operacije paketa) i opcija `dnevnik` (i07/P-7).
- Dokumentacija (korak 7): `TRACEABILITY.md`, `IMPLEMENTATION_LOG.md`, `TEST_REPORT.md`, `ODLUKE.md`, `README.md` (sekcija API-07).

**Netaknuti**: `firebase/firestore.rules`, `firestore.indexes.json`, `package*.json`, `skripte/provjera.ps1` (osim i07/P-9), svi postojeći test fajlovi
i01–i06 (osim `omotacBaze.js`), `stanjeNaloga.js`, `izdavanjeNagrade.js`, `otkazivanjeVaucera.js`, `otkupVaucera.js`, `uskladjivanjeVaucera.js`,
`inicijalizacijaNaloga.js` (blokade već postoje — 5.9).

## 5. Detaljan dizajn

### 5.1 Tok zahtjeva i redoslijed provjera (O-35)

```
korelacija → parsirajJson (neispravan JSON / skalar / null → 422, bez token-a i baze)
  → DELETE /api/v1/account
      1. provjeraTokena({ izloziAuthTime: true }) → 401 UNAUTHENTICATED / 503; postavlja rokDo, uid, authTime
      2. provjeriPraznoTijelo(req.body, req.headers) → 422 INVALID_REQUEST
      3. provjeriSvjezinuPrijave(res.locals.authTime) → 409 REAUTHENTICATION_REQUIRED (bez ijednog pristupa bazi / Auth-u)
      4. obrisiNalog(servisi.db, servisi.auth, { uid }, rokDo) → 503 / 500
      5. 204 bez tijela
  → nepoznataRuta (GET / POST / PUT /account, DELETE /account/init → 404 NOT_FOUND)
```

| # | Provjera | Ishod | Baza / Auth | Obrazloženje |
|---|---|---|---|---|
| 0 | Globalni parser | 422 | ne | i02/P-6, i05/P-11 |
| 1 | Token | 401 / 503 | samo `verifyIdToken` | §3.3, NFR-01 |
| 2 | Tijelo | 422 | ne | O-21 (bez tijela, `Content-Length: 0`, `{}` su ispravni; i05/P-2) |
| 3 | Svježina | 409 `REAUTHENTICATION_REQUIRED` | ne | §23, O-35; važi i za nastavak (users DELETION_IN_PROGRESS ili ne postoji) |
| 4 | Rok | 503 | ne | ODLUKE §5; provjerava se i prije SVAKOG koraka toka |

### 5.2 Ruta (`rute/brisanjeNaloga.js`)

```js
export function dodajRuteBrisanja(ruter, { servisi }) {
  ruter.delete('/account', napraviProvjeruTokena(servisi?.auth, { izloziAuthTime: true }), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    provjeriSvjezinuPrijave(res.locals.authTime);
    await obrisiNalog(servisi.db, servisi.auth, { uid: res.locals.uid }, res.locals.rokDo);
    res.status(204).end();                                   // O-33: bez tijela, i za nastavak
  });
}
```
- Samo `ruter.delete('/account', …)`: prefiks `/account` ostaje bez posrednika (POST `/account/init`, POST `/account/vouchers/reconcile` netaknuti).
- Šablon rute u logu: `/account` (D-3).

### 5.3 Svježina prijave (`posrednici/svjezinaPrijave.js`, O-35, i07/P-2)

```js
export const MAKSIMALNA_STAROST_PRIJAVE_MS = 300_000;          // §23 „auth_time <= 5 min”
// auth_time je u sekundama (P-a). Cjelobrojno poređenje u ms je ekvivalent O-35 (Date.now()/1000 − auth_time ≤ 300) bez razlomaka.
export function jeSvjezaPrijava(authTime, sadaMs) {
  return Number.isSafeInteger(authTime) && authTime >= 0 && sadaMs <= authTime * 1000 + MAKSIMALNA_STAROST_PRIJAVE_MS;
}
export function provjeriSvjezinuPrijave(authTime) {
  if (!jeSvjezaPrijava(authTime, Date.now())) throw new GreskaApi('REAUTHENTICATION_REQUIRED');
}
```
- Granica uključiva (`<=`). `auth_time` nedostaje / nije nenegativan siguran cijeli broj → 409 (fail closed; P-a: emulator propušta takav token).
- `auth_time` u budućnosti (razlika satova) → dozvoljeno (razlika negativna ≤ 300 s); Admin SDK provjerava `iat`/`exp`, ne `auth_time` (poznato ograničenje).
- Vrijednost `auth_time` i `uid` se ne loguju.

### 5.4 Tok brisanja `obrisiNalog(db, auth, { uid }, rokDo)` (`servisi/brisanjeNaloga.js`, O-32, O-36, O-34b)

Svaki korak: `preostaloMs = rokDo − Date.now()`; `!(preostaloMs > 0)` → `GreskaApi('SERVICE_UNAVAILABLE')` bez pristupa; svaki poziv Firestore-a / Auth-a
kroz `saRokom(…, preostaloMs)`; `GreskaApi` prolazi; `jeNedostupnostFirestore` → 503; ostalo → izvorna greška → 500 (obrazac `otkazivanjeVaucera.js`).
Svaki korak je idempotentan: ponovljen nad stanjem posle sopstvenog (djelimičnog ili potpunog) izvršenja daje isto stanje. Konstante:
`MAKSIMALNO_POKUSAJA = 5`, `NAJVISE_UPISA_PO_PAKETU = 400`.

```
K1  transakcija (users):
      s = tx.get(users/uid)
      !s.exists                         → ništa (O-34b: NOT_INITIALIZED ili pad između 4b i 6)
      status === 'DELETION_IN_PROGRESS' → ništa (§23.1 (1), AUTH-05)
      status === 'ACTIVE'               → tx.update(users/uid, { accountStatus: 'DELETION_IN_PROGRESS', updatedAt: serverTimestamp() })   // upis 1
      inače                             → Error('Neočekivan accountStatus u users dokumentu.') → 500, ništa upisano (ODLUKE §5)
K2  (bez koda) blokada je posljedica K1: svaka mutacija čita users u svojoj transakciji (5.9)
K3  transakcija (zatvaranje ACTIVE voucher-a, O-9, O-34):
      sadaMs = Date.now()                                                // jednom po pokušaju (§6 (j))
      [sU, sN] = tx.getAll(users/uid, loyaltyAccounts/uid)
      sU.exists && status !== 'DELETION_IN_PROGRESS' → Error(statička) → 500        // odbrana: zatvaranje samo dok su mutacije blokirane
      zatvaranja = procitajAktivneZaZatvaranje(tx, db, { uid, sadaMs })              // 5.5; tx.get(query) uid ==, status == ACTIVE; O-27 → 500
      zatvaranja.length === 0 → ništa (0 upisa, bez obzira na loyaltyAccounts)
      !sN.exists → Error('Nekonzistentno stanje: …') → 500
      { dostupno, rezervisano } iz sN (jeNenegativanCijeliBroj, inače 500 — isto kao stanjeNaloga.js)
      { oslobadjanja, dostupno, rezervisano } = pripremiOslobadjanja(tx, db, { vauceri: zatvaranja, dostupno, rezervisano })   // release_ postoji / reserved < 0 → 500
      vrijeme = serverTimestamp()
      upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme })        // po voucher-u: update voucher, create release_
      tx.update(loyaltyAccounts/uid, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme })
K4a brisanje privatnih resursa (upit + paketi), TAČNO ovim redoslijedom (ODLUKE §6 (f), (m), (u)):
      obrisiPoUid(rewardRequests); obrisiPoUid(redemptionRequests); obrisiPoUid(notifications); obrisiPoUid(vouchers);
      paket: delete(loyaltyAccounts/uid)                                // delete nepostojećeg je no-op (P-c)
      obrisiPoUid(k) = ponavljaj { q = k.where('uid','==',uid).limit(400).get(); q.empty → kraj; batch.delete svakog; commit }
K5  pseudonimizacija (§23.3): pseudonimizujPoUid(purchases); pseudonimizujPoUid(loyaltyLedger)
      = ponavljaj { q = k.where('uid','==',uid).limit(400).get(); q.empty → kraj; batch.update(ref, { uid: null }) svakog; commit }
      // samo polje uid; ništa drugo se ne mijenja; postupak završava jer svaki commit smanjuje skup koji upit vraća
K4b transakcija (users posljednji, ODLUKE §6 (a)):
      s = tx.get(users/uid); !s.exists → ništa; status === 'DELETION_IN_PROGRESS' → tx.delete(users/uid); inače → 500 (odbrana)
K6  auth.deleteUser(uid) kroz saRokom; greška 'auth/user-not-found' → već obrisan (P-b, paralelni DELETE); 'app/network-error' /
      'app/network-timeout' / istek → 503; ostalo → 500
→ 204
```

**Čitanja / upisi po koraku**

| Korak | Čitanja | Upisi | Atomičnost |
|---|---|---|---|
| K1 | `users/uid` (tx) | 0 ili 1 (`users` update) | 1 transakcija |
| K3 | `users`, `loyaltyAccounts` (tx.getAll), upit ACTIVE voucher-a (tx), `release_*` (tx.getAll) | 2n + 1 (n = broj ACTIVE) ili 0 | 1 transakcija (NFR-04) |
| K4a | upiti `uid ==` po kolekciji (van tx) | ≤ 400 po paketu | po paketu; ponovljivo |
| K5 | upiti `uid ==` (van tx) | ≤ 400 po paketu | po paketu; ponovljivo |
| K4b | `users/uid` (tx) | 0 ili 1 (`users` delete) | 1 transakcija |
| K6 | — | Auth nalog | Auth API |

**Zašto ovaj redoslijed (O-32 potvrđen):**
- K1 prvi: sve mutacije (5.9) čitaju `users` u transakciji, pa svaka koja commit-uje poslije K1 vidi `DELETION_IN_PROGRESS` → 409 / 404; svaka koja je
  commit-ovala prije K1 vidljiva je upitima K3 / K4a / K5 (upiti Firestore-a su strogo konzistentni). Bez toga bi issue mogao napraviti ACTIVE voucher
  poslije K3 (mutacija D01).
- K3 prije K4a: voucher se ne briše bez RELEASE (AC-09, O-9); RELEASE dobija `uid` i K5 ga pseudonimizuje (API-T12: RELEASE sa `uid = null`).
- Mapping-i prije `vouchers` (f, m, u): u međustanju retry issue-a ne nailazi na mapping bez voucher-a (nego na nalog u brisanju → 409), a retry
  otkupa ne nailazi na zapis bez voucher-a (nego na REDEEMED voucher → 409, kasnije 404) — nikad 500 (I07-T15).
- `loyaltyAccounts` u K4a poslije `vouchers`: K3 ponovljen u nastavku nađe 0 ACTIVE i ne treba nalog.
- K5 prije K4b, K4b prije K6: `users` postoji (DELETION_IN_PROGRESS) dok god išta drugo nije gotovo, pa init (i02/P-2) vraća 409 i ne može
  „oživjeti” nalog (ODLUKE §6 (a)); Auth posljednji da bi autentifikovan nastavak bio moguć (§23.4).

**Ishodi**

| Situacija | HTTP | Stanje poslije |
|---|---|---|
| sve uspjelo (prvi put ili nastavak) | 204 | sve očišćeno, Auth obrisan |
| users ne postoji, Auth postoji (O-34b) | 204 | preostali resursi po `uid` očišćeni, Auth obrisan |
| `accountStatus` van enum-a (K1 / K4b) ili ACTIVE u K3 / K4b | 500 | ništa upisano u tom koraku |
| K3 nekonzistentno (O-27, `release_` postoji, `loyaltyAccounts` ne postoji uz ACTIVE voucher-e, neispravan nalog, `reserved < cost`) | 500 | K1 urađen, K3 ništa |
| rok istekao prije / tokom koraka; Firestore 14/4/10; Auth nedostupan | 503 | konzistentno (korak urađen ili ne; kasni commit dozvoljen, §6 (b)) |
| greška upisa / commit-a u koraku | 500 | prethodni koraci urađeni; tekući atomično ništa (tx) ili do posljednjeg commit-ovanog paketa |
| ponovljen DELETE poslije 204 | 401 | (Auth ne postoji, P-b) |

### 5.5 O-9 / O-34 kroz `oslobadjanjeVaucera.js`

```js
// O-9, O-34 (i07): SVI ACTIVE voucher-i korisnika (bez obzira na istek), svaki O-27 konzistentan; istekao (sadaMs ≥ expiresAt) → { status: 'EXPIRED' },
// ostali → { status: 'CANCELLED', cancelledAt: Timestamp.fromMillis(sadaMs) }; poredak poredakOslobadjanja (i04/P-6). Modul ne čita sat.
export async function procitajAktivneZaZatvaranje(tx, db, { uid, sadaMs }) { … isti upit i ista O-27 provjera kao procitajIstekleAktivne … }
```
- Zajednički dio upita i O-27 provjere izdvaja se u privatnu `procitajAktivne(tx, db, uid)` koju koriste i `procitajIstekleAktivne` (ponašanje
  API-03 / API-06 nepromijenjeno; i04/i05/i06 testovi to dokazuju) i nova funkcija.
- `release_` i `REWARD_RELEASE` i dalje samo u ovom modulu (`git grep "release_" -- backend/src` → kod samo ovdje).
- Terminalni voucher-i (REDEEMED / CANCELLED / EXPIRED) se ne čitaju u K3 i ne dobijaju nov događaj; brišu se u K4a.
- Retry cancel-a CANCELLED voucher-a ne provjerava `release_` (i05/P-4) — K3 uvijek piše `release_` kroz `tx.create` + eksplicitnu provjeru, pa
  ograničenje (r) je zadovoljeno.

### 5.6 Međustanja i ograničenja (f), (m), (u) — zatvaranje

| Međustanje (DELETE prekinut) | Retry issue (isti `requestId`) | Retry redeem (isti `redemptionRequestId`) |
|---|---|---|
| poslije K1 / K3 | mapping postoji → O-16: 200 isti voucher (status iz baze, npr. CANCELLED) — ništa ne upisuje | zapis postoji → O-24: 200 isto tijelo |
| poslije brisanja mapping-a, prije `vouchers` | 409 `ACCOUNT_DELETION_IN_PROGRESS` (nalog) | zapis ne postoji → voucher REDEEMED → 409 `VOUCHER_ALREADY_REDEEMED` |
| poslije `vouchers` | 409 `ACCOUNT_DELETION_IN_PROGRESS` | 404 `VOUCHER_NOT_FOUND` |
| poslije K6 | 401 | 404 `VOUCHER_NOT_FOUND` |

Nijedno međustanje ne daje 500 → (f), (m), (u) zatvoreni (i07/P-6: §20.2 „isti rezultat” prestaje kad §23.2 obriše zapis).

### 5.7 Nastavak (§23.4) i O-34b — potvrđujem uz preciziranje

- Ponovljen DELETE uvijek izvršava CIJELI tok od K1; svaki korak nad već očišćenim stanjem je no-op (0 upisa). Nema „markera napretka”.
- `users` ne postoji (NOT_INITIALIZED ili pad između K4b i K6): K1 i K4b no-op; K3 zatvara eventualne ACTIVE voucher-e ako `loyaltyAccounts` postoji
  (nedostižno kroz API, jer je `users` brisan posljednji), inače 500; K4a / K5 čiste ostatke; K6 briše Auth → 204. Nikad `ACCOUNT_NOT_INITIALIZED`
  (O-34b; mutacija D10).
- Recent auth važi i za nastavak (O-35): korisnik čiji je prvi pokušaj pao i koji je čekao > 5 min mora ponovo da se prijavi (Auth nalog još postoji,
  pa je ponovna prijava moguća — §23.4 zadovoljen).

### 5.8 O-10a (`evidencijaKupovine.js`)

```js
// §10.3, O-10a: poslije pseudonimizacije (§23.3, uid === null) uid se ne poredi; ostala polja i dalje (O-3: occurredAt ne).
const uidSePoredi = postojeca.uid !== null;
if ((uidSePoredi && postojeca.uid !== loyaltyUid) || postojeca.volumeMl !== volumeMl || …) throw new GreskaApi('IDEMPOTENCY_CONFLICT');
```
- Samo `=== null` isključuje poređenje (npr. `undefined` / `''` i dalje se poredi → 409). Odgovor `odgovorKupovine` već nema `uid` (i03/P-1).
- Posljedica (i07/P-5): retry sa ISTIM payload-om a DRUGIM `loyaltyUid` poslije pseudonimizacije → 200 prvi rezultat, bez EARN-a i bez upisa.

### 5.9 Blokade (AUTH-05) i obaveza (o)

Postojeće provjere se ne mijenjaju: init (`inicijalizacijaNaloga.js`, DELETION → 409), purchase (O-10 → 404), issue / cancel / redeem / API-06
(`procitajStanjeNaloga` → 409). Sve čitaju `users` u transakciji (P-d). Obaveza (o) se dokazuje testom I07-T09 (deterministički, `prijePokusaja`);
dio (o) o `rewardDefinitions` ostaje neprimjenjiv (nijedan API ih ne mijenja) — ostaje u ODLUKE §6 (o) kao napomena.

### 5.10 Log

- Šablon rute `/account`; poruke `new Error` statičke (I05-T02 skenira cijeli `src`); `uid`, `auth_time`, token, `displayName` se ne loguju.
- gRPC greške paketa (npr. `5 NOT_FOUND` na `purchases/<id>`) idu bez poruke (§6 (h)).

## 6. Ugovor odgovora API-07

- 204 bez tijela (`res.status(204).end()`), i za nastavak (O-33). Greške tačno §27 tijelo: 401 `UNAUTHENTICATED`, 409 `REAUTHENTICATION_REQUIRED`,
  422 `INVALID_REQUEST`, 404 `NOT_FOUND` (metod / ruta), 500 `INTERNAL_ERROR`, 503 `SERVICE_UNAVAILABLE`. Nikad `ACCOUNT_NOT_INITIALIZED` ni
  `ACCOUNT_DELETION_IN_PROGRESS`.

## 7. Koraci implementacije (jedan korak = jedan commit + push; testovi prije koda; O-30 (a): `provjera.ps1` tačno 2×)

Između koraka: `cd backend; npm test; npm run test:emu:ciljano -- <novi/izmijenjeni fajlovi>`. Prije run-a: JDK prvi na PATH-u, portovi 8080/9099 slobodni,
laptop budan (O-29 (a)).

| # | Commit | Sadržaj | Procjena (min) |
|---|---|---|---|
| 0 | `i07: odobrenje plana i odluke Orchestrator-a` | sekcija 14 doslovno | 5 |
| 1 | `i07: O-10a retry kupovine poslije pseudonimizacije` | I07-T10 prvo (crveno), pa izmjena `evidencijaKupovine.js`; ciljano `kupovina.test.js`, `kupovinaPseudonim.test.js` | 30 |
| 2 | `i07: test pomoćnici za brisanje (batch, dnevnik, omotacAutha)` | `omotacBaze.batch()` + `dnevnik`, `omotacAutha.js`; kontrola: i03–i06 fajlovi sa omotačem zeleni (ciljano) | 30 |
| 3 | `i07: API-07 brisanje naloga (§23, O-32 … O-36)` | `svjezinaPrijave.test.js`, API-T12, I07-T01 … I07-T07, I07-T12 prvo; pa `svjezinaPrijave.js`, opcija posrednika, `procitajAktivneZaZatvaranje`, `brisanjeNaloga.js`, ruta, `aplikacija.js`; **`provjera.ps1` #1** (dira zajednički kod: posrednik, `oslobadjanjeVaucera.js`, `aplikacija.js`) | 130 + 22 |
| 4 | `i07: atomičnost, nastavak, blokade i konkurentnost brisanja (NFR-04, AUTH-05, §6 (o))` | I07-T06, I07-T08, I07-T09, I07-T11, I07-T13, I07-T15 (kod se mijenja samo ako test otkrije grešku) | 90 |
| 5 | `i07: log brisanja naloga` | I07-T14 | 25 |
| 6 | (bez commit-a) | ključne mutacije D01 … D11 (sekcija 9), svaka pa `git restore` | 40 |
| 7 | `i07: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost, registar odluka i README` | dokumentacija (O-30 (d)) + inspekcije I07-T16 + **`provjera.ps1` #2** + hash | 45 + 22 |
| 8 | PR `iteracija-07 → main` (bez merge-a) | | 5 |

**Procjena Builder faze ≈ 7 h** (od toga ≈ 45 min dva `provjera.ps1`; ≈ 2 h 10 min korak 3).

## 8. Testovi

Konvencije kao i06 (sekcija 8): `node:test` + `assert/strict`, naslov počinje ID-em, `provjeriTestnoOkruzenje()`, `beforeEach(ocistiEmulatore)` +
`napuniRewardDefinitions`, `afterEach(mock.restoreAll)`, `provjeriTijeloGreske`, `sveTransakcijeZavrsene` gdje je 503 dozvoljen. Aplikacija sa
`servisi: { db: omotac, auth: omotacAutha(firebase.auth, …) }`. Korisnik iz `napraviKorisnika` (pravi token). Lokalni pomoćnici: `pripremiKorisnikaA()`
(primjer iz brief-a kroz PRAVE API pozive: init, 2 kupovine SIM01, issue CAR_WASH), `snimakPoUid(uid)` (sve kolekcije §24, dokumenti sa tim
`uid`-om ili ID-em), `normalizuj(snimak)` (Timestamp → oznaka, radi poređenja dva run-a), `obrisi(token, { tijelo, zaglavlja })`.
Mock sata: `Date.now` se mijenja samo za pozivaoca čiji stack sadrži `/src/posrednici/svjezinaPrijave.js` (odnosno `/src/servisi/brisanjeNaloga.js`
za K3 granicu), kao I04-T19.

### 8.1 SRS katalog

| ID | SRS | Fajl | Šta tačno provjerava |
|---|---|---|---|
| API-T12 | §23, §23.1 … §23.4, AC-09, AC-11 | `emulator/brisanjeNaloga.test.js` | (a) Primjer brief-a: A `72/0` → issue → `22/50`, 2 notifikacije; B (init + 1 kupovina + issue SHOWER) snimljen. DELETE A → 204, prazno tijelo. Poslije: `users/A`, `loyaltyAccounts/A` ne postoje; 0 notifikacija, 0 voucher-a, 0 `rewardRequests`, 0 `redemptionRequests` sa `uid A` (i po ID-u); purchases: tačno 2 dokumenta A (po ID-u) sa `uid null`, ostala polja `deepStrictEqual` prije; ledger: tačno 4 događaja A (`earn_` ×2, `reserve_V`, `release_V`) sa `uid null`, ostala polja nepromijenjena osim novog `release_V` (`deltaAvailable 50`, `deltaReserved −50`, `availableAfter 72`, `reservedAfter 0`); upit `uid == A` u svim kolekcijama → 0; `auth.getUser(A)` → `auth/user-not-found`; snimak B `deepStrictEqual`. (b) Nastavak: isti primjer, prvi DELETE prekinut (`baciNaUpisu` = prvi upis K4a) → 500; `users/A.accountStatus === 'DELETION_IN_PROGRESS'`; drugi DELETE (isti token) → 204; konačno stanje `normalizuj`-jednako (a). |

### 8.2 Dopunski testovi I07

| ID | SRS / odluka | Fajl | Priprema → asercije |
|---|---|---|---|
| I07-T01 | O-35, i07/P-2 | `jedinicni/svjezinaPrijave.test.js` | `jeSvjezaPrijava(T, T·1000 + 300 000) === true`; `+ 300 001` → false; `(T+301)·1000` → false; `T·1000` → true; budući `auth_time` → true; `undefined`, `null`, `'T'`, `1.5`, `-1`, `NaN`, `Infinity` → false. `provjeriSvjezinuPrijave` baca `GreskaApi` sa `kod 'REAUTHENTICATION_REQUIRED'`. |
| I07-T02 | §23, O-35 | `emulator/brisanjeNaloga.test.js` | Pravi token (`auth_time = T`), mock sata svježine: `T·1000 + 300 000` → 204; `(T+301)·1000` → 409 tačno, `brojPristupa === 0`, `omotacAutha.brisanja === 0`, Auth i baza netaknuti. Isto 409 za nastavak (users `DELETION_IN_PROGRESS`) i za users ne postoji. Nepotpisan token bez `auth_time` → 409, 0 pristupa. Kontrola: bez mock-a → 204. |
| I07-T03 | §26, §3.3, O-21, O-1, O-35 redoslijed | isti | Bez token-a, `Bearer abc`, istekao → 401, 0 pristupa. Tijela: `{"a":1}`, `[]`, `text/plain` sa sadržajem, `Content-Length: 5` bez JSON-a → 422; bez tijela, `Content-Length: 0`, `{}` → 204 (svaki na novom korisniku). Neispravan JSON / `null` bez token-a → 422. Redoslijed: objekat bez token-a → 401; `{"a":1}` + star `auth_time` → 422 (tijelo prije svježine). `GET` / `POST` / `PUT` `/account`, `DELETE /account/init` → 404 `NOT_FOUND`; POST `/account/init` → 201 (netaknut). Posrednik bez opcije ne postavlja `res.locals.authTime` (test ruta kroz `dodajRute`). |
| I07-T04 | O-9, O-34, AC-09, §16, §19.1, §18.1 | isti | Nalog `0/80`: ACTIVE V1 (50, neistekao), ACTIVE V2 (30, istekao), REDEEMED V3, CANCELLED V4, EXPIRED V5 (konzistentni ledger). DELETE prekinut `baciNaUpisu` = prvi upis K4a → stanje poslije K3: V1 CANCELLED + `cancelledAt` (= mock `sadaMs`), V2 EXPIRED (bez `cancelledAt`), nalog `80/0`, `release_V1`/`release_V2` po `poredakOslobadjanja` (V2 prvi: `availableAfter 30`, zatim V1 `80`), 0 novih događaja za V3–V5. Nastavak → 204: ledger sa `uid null` sadrži tačno 2 nova RELEASE. Granica (mock sata `brisanjeNaloga.js`): `sadaMs === expiresAt` → EXPIRED; `expiresAt − 1` → CANCELLED. |
| I07-T05 | O-32, §23.1, ODLUKE §6 (a), (f), (m), (u) | isti | Primjer A + otkup jednog voucher-a (`redemptionRequests` A) + 2 notifikacije. Zajednički `dnevnik` omotača i `omotacAutha`; niz (metod, kolekcija) mora biti TAČNO: `update users` → (`update vouchers`, `create loyaltyLedger`)×n, `update loyaltyAccounts` → `delete rewardRequests`* → `delete redemptionRequests`* → `delete notifications`* → `delete vouchers`* → `delete loyaltyAccounts` → `update purchases`* → `update loyaltyLedger`* → `delete users` → `deleteUser`. Nijedan `delete vouchers` prije posljednjeg `delete rewardRequests`/`redemptionRequests`; `delete users` poslije svih ostalih; `deleteUser` posljednji. |
| I07-T06 | NFR-04, §23.4, O-36, DoD „prekid poslije svakog koraka” | `emulator/brisanjeAtomicnost.test.js` | (a) Kontrolni run daje dnevnik i konačno stanje S. Za svaku granicu koraka (prvi upis K3, K4a, K5, K4b; `deleteUser` kroz `omotacAutha.baciNaBrisanju`) i za `baciPrijeCommita` K1 / K3 / K4b: novi fiksni podaci, DELETE sa prekidom → 500 bez `stack`; stanje = stanje poslije prethodnih koraka (provjera ključnih invarijanti: status, ACTIVE voucher-i, nalog); drugi DELETE (pravi `db`, `auth`) → 204; `normalizuj` stanje = S. (b) Prekid USRED koraka: 401 notifikacija i 401 kupovina (seed Admin SDK) — prekid na drugom paketu K4a i drugom paketu K5 → nastavak → 204, 0 dokumenata sa `uid A`. (c) Svaki paket ima ≤ 400 operacija (dnevnik po paketu). |
| I07-T07 | O-34b, AUTH-03, §23.4 | `emulator/brisanjeNaloga.test.js` | (a) Pad između K4b i K6 (`omotacAutha.baciNaBrisanju`) → 500; users ne postoji, Auth postoji; drugi DELETE → 204, Auth obrisan, 0 upisa u Firestore (dnevnik). (b) users obrisan Admin SDK-om, a notifikacije / purchases / vouchers (terminalni) / `loyaltyAccounts` A postoje → 204, sve očišćeno, purchases `uid null`. (c) NOT_INITIALIZED (samo Auth) → 204, Auth obrisan, dnevnik = samo `deleteUser`. |
| I07-T08 | AUTH-05, O-10, O-20, O-25, i02/P-2 | `emulator/blokadeBrisanja.test.js` | Primjer A + ACTIVE voucher; Admin postavi `DELETION_IN_PROGRESS` (stanje „poslije K1”). Omotač: init → 409 `ACCOUNT_DELETION_IN_PROGRESS`; nova kupovina → 404 `LOYALTY_ACCOUNT_NOT_FOUND`; issue (novi `requestId`) / cancel ACTIVE / redeem ACTIVE / API-06 (istekao voucher) → 409 `ACCOUNT_DELETION_IN_PROGRESS`; svuda `upisi === []`, snimak `deepStrictEqual`. |
| I07-T09 | ODLUKE §6 (o), P-4 / N-09 | isti | Deterministički (i05/K-1): omotač `{ prisiliPonovniPokusaj: 1, prijePokusaja }`; pokušaj 1 čita ACTIVE nalog, prisilni ABORTED; `prijePokusaja(2)` Admin SDK-om postavi `DELETION_IN_PROGRESS`. (a) issue → 409, 0 voucher-a, 0 RESERVE, nalog nepromijenjen; (b) cancel → 409, voucher ACTIVE, 0 RELEASE; (c) redeem → 409, voucher ACTIVE, 0 REDEEM, 0 zapisa; (d) purchase (nova) → 404, 0 purchases / EARN / notifikacija; (e) API-06 → 409, 0 release; (f) init (users ne postoji, `prijePokusaja(2)` napravi users `DELETION_IN_PROGRESS`) → 409, `loyaltyAccounts` nije kreiran. (g) Varijanta issue: `prijePokusaja(2)` izvrši CIJELI DELETE (pravi servisi) → issue 409 `ACCOUNT_NOT_INITIALIZED`, 0 voucher-a, 0 dokumenata sa `uid A`. Kontrola za svaki: bez `prijePokusaja` → uspjeh. |
| I07-T10 | §10, O-10a, O-3, O-12, ODLUKE §6 (d) | `emulator/kupovinaPseudonim.test.js` | Kupovina A `SIM01/POS-1`; DELETE A (pseudonimizacija). Omotač: retry istog payload-a (`loyaltyUid A`) → 200, tijelo `deepStrictEqual` prvom (bez `uid`), `upisi === []`; drugi `occurredAt` → 200; drugi `loyaltyUid` (B, aktivan) → 200 prvi rezultat, 0 EARN za B (i07/P-5); drugi `volumeMl` / `amountMinor` / `currency` → 409 `IDEMPOTENCY_CONFLICT`. Regresija: purchase sa `uid` string i drugi `loyaltyUid` → 409 (API-T04 nepromijenjen). |
| I07-T11 | O-36, ODLUKE §6 (b), §27 503 | `emulator/brisanjeAtomicnost.test.js` | (a) `obrisiNalog` sa `rokDo` ∈ {prošlost, `NaN`, `undefined`} → 503, `brojPristupa === 0`, Auth netaknut. (b) Istek usred K3 (`zadrziPrijeCommitaMs: ROK + 500`) → 503; `await sveTransakcijeZavrsene`; stanje konzistentno (K3 commit-ovan: nalog `available + reserved` nepromijenjen, svaki zatvoren voucher ima RELEASE); drugi DELETE → 204, S. (c) `omotacAutha` `deleteUser` baca `{ code: 'app/network-error' }` → 503; drugi DELETE → 204. (d) `odbijTransakcijuSa: { code: 14 }` → 503, 0 upisa. |
| I07-T12 | ODLUKE §5, O-27 | `emulator/brisanjeNaloga.test.js` | 500 bez stack-a, Auth postoji: (a) `accountStatus 'NEPOZNAT'` → 0 upisa; (b) ACTIVE voucher sa `release_` → K1 urađen, K3 0 upisa; (c) ACTIVE voucher O-27 nekonzistentan (`cancelledAt` popunjen); (d) ACTIVE voucher-i uz nepostojeći `loyaltyAccounts`; (e) `reservedPoints 20` uz voucher 50. Kontrola: ispravno stanje → 204. |
| I07-T13 | NFR-06, §23.4 | `emulator/brisanjeAtomicnost.test.js` | Slobodna konkurentnost, 10 ponavljanja, novi korisnik svaki put: (a) 2 paralelna DELETE (isti token) → statusi ⊆ {204, 503}, 0×500; poslije retry-ja 503 → stanje S, Auth obrisan. (b) DELETE ‖ 3× issue ‖ 2× kupovina ‖ cancel → 0×500; na kraju 0 dokumenata sa `uid A`; svaki voucher A koji je postojao ima RESERVE i tačno 1 RELEASE/REDEEM (ledger po `voucherId`), lanac `availableAfter`/`reservedAfter` uzastopan. Raspodjela u `t.diagnostic`. |
| I07-T14 | §6 (h), D-3, O-18, NFR-07 | `emulator/logBrisanja.test.js` | `presretniLog()`; ishodi 204, 401 (neispravan i obrisan korisnik), 409 reauth, 422, 404 metod, 500 (prekid K3 / K4a / K6), 503 (rok, Auth nedostupan). Spojeni log ne sadrži: `uid` A, token, `auth_time`, e-mail, `displayName`, `voucherId`, `requestKey`; zapisi pogođene rute imaju `putanja '/account'`; nijedan odgovor nema `stack`, `    at `, `uid`. |
| I07-T15 | ODLUKE §6 (f), (m), (u), O-16, O-24 | `emulator/blokadeBrisanja.test.js` | Međustanja tabele 5.6 (prekid na odgovarajućem upisu K4a, `dnevnik`): retry issue / redeem daju tačno navedene kodove, nikad 500; 0 upisa. |
| I07-T16 | DoD inspekcije | — (sekcija 10) | `git grep` / `git diff` komande iz sekcije 10. |

Regresija: i01–i06 suite bez izmjene postojećih test fajlova (izuzetak `omotacBaze.js`: nova metoda/opcija; bez opcija ponašanje identično).

## 9. Ključne mutacije (O-30 (b), O-31 (c); D = deterministička 1/1; lokalno, svaka pa `git restore`)

| # | Mutacija | Ciljani test |
|---|---|---|
| D01 | K1 (status) premješten iza K3 | I07-T05 (i I07-T13 (b) kao K, ne izvršava se) |
| D02 | K4b prije K5 (users obrisan prije pseudonimizacije) | I07-T05 |
| D03 | K6 prije K1 (Auth obrisan prije Firestore cleanup-a) | I07-T05, API-T12 (b) |
| D04 | u K4a `rewardRequests` (i `redemptionRequests`) poslije `vouchers` | I07-T05, I07-T15 |
| D05 | K3 uklonjen (ACTIVE voucher obrisan bez RELEASE) | API-T12 (a), I07-T04 |
| D06 | istekao zatvoren kao CANCELLED (bez grananja na `jeIstekao`) | I07-T04 (granica) |
| D07 | provjera svježine uklonjena iz rute; D07b `<` umjesto `<=` | I07-T02; I07-T01 + I07-T02 (granica) |
| D08 | O-10a vraćen (`uid` se poredi i kad je `null`) | I07-T10 |
| D09 | K5 bez `loyaltyLedger` (ledger nije pseudonimizovan) | API-T12 (a) |
| D10 | users ne postoji → `GreskaApi('ACCOUNT_NOT_INITIALIZED')` u K1 | I07-T07 |
| D11 | issue čita `users` VAN transakcije (pre-čitanje prije `runTransaction`, u tx samo nalog); D11b `DELETION_IN_PROGRESS` provjera uklonjena za issue | I07-T09 (a); I07-T08 |

Ukupno 11 oznaka + 2 varijante = 13 izvršavanja, sve D (I07-T09 je deterministički po `prijePokusaja`). Preživjela → dopuna testa, commit
`i07: ojačan test … (nalaz mutacije Dnn)`, OD-n.

## 10. Definition of Done (komande iz korijena, PowerShell)

- [ ] `git grep -n "release_" -- backend/src` → kod samo `servisi/oslobadjanjeVaucera.js` (komentari drugdje dozvoljeni).
- [ ] `git grep -n -E "deleteUser|DELETION_IN_PROGRESS'" -- backend/src` → `deleteUser` samo u `servisi/brisanjeNaloga.js`; upis `DELETION_IN_PROGRESS` samo tamo.
- [ ] `git grep -n "izloziAuthTime" -- backend/src` → `posrednici/autentikacija.js` i `rute/brisanjeNaloga.js`.
- [ ] `cd backend; npm test; npm run test:emu:ciljano -- <i07 fajlovi>; cd ..` → PASS; `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 (tačno 2×, O-30 (a)).
- [ ] `git diff i06 -- firebase/firestore.rules firebase/firestore.indexes.json backend/package.json backend/package-lock.json` → prazno.
- [ ] `git diff i06 -- backend/test` → novi fajlovi + `pomocnici/omotacBaze.js`; postojeći test fajlovi netaknuti.
- [ ] `git grep -n -i -E "process\.env\.(NODE_ENV|TEST)|inject|ubriz|mock" -- backend/src` → prazno; nema TODO/FIXME.
- [ ] `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` → `7D86…0228`; `git diff i06 -- docs/srs` prazno.
- [ ] Mutacije D01 … D11 tabela u TEST_REPORT (jedan red po mutaciji); raspodjela I07-T13.
- [ ] Dokumentacija po brief-u 5 (TRACEABILITY redovi sekcije 12) i 10 (O-31 u ODLUKE §3 i §10; R-02 … R-04 i06 u §8; §1 i06 ACCEPTED, tag `i06`,
      merge PR #6 `9aae907`; O-2 zatvoren u §9; B-1 → i08 u §8); ODLUKE: O-9, O-10a, O-32 … O-36, `i07/P-n`; zatvara O-9, O-10a, (a), (d), (f), (m),
      (o), (r), (u); novo ograničenje (v) za i10 (i07/P-1, P-8). README: sekcija API-07 (PowerShell primjer, 204, 409 reauth, nastavak).
- [ ] Commit-i bez potpisa alata, svaki push-ovan; PR otvoren bez merge-a i taga.

## 11. Rizici i poznata ograničenja

- **Prozor K4b → K6** (i07/P-1): init sa još važećim token-om može ponovo napraviti `users`/`loyaltyAccounts` poslije K4b; ako zatim K6 uspije, ostaju
  dokumenti bez Auth naloga. Preporuka: prihvatiti i dokumentovati + ograničenje (v) za Android.
- **Granica paketa 500** nije provjerljiva u emulatoru (P-c); kod koristi ≤ 400 i test broji operacije po paketu.
- **Svježina u testu** se dokazuje mock-om sata po fajlu (P-a: emulator ne izdaje token sa starim `auth_time` koji prolazi `checkRevoked`).
- **Velik nalog**: rok 10 s ograničava broj dokumenata po zahtjevu; istek → 503, nastavak bezbjedan (O-36). Izmjereno: ~450 dokumenata ≈ 0,2–0,3 s
  po kolekciji u emulatoru; produkcija neprovjerljiva.
- **Konkurentni DELETE**: drugi `deleteUser` → `auth/user-not-found` tretira se kao uspjeh; oba zahtjeva mogu dobiti 204.
- **Emulator ≠ produkcija** (brave, kontencija, `auth_time` / `validSince` semantika) — kao §7.

## 12. TRACEABILITY redovi (Builder popunjava „Kod”, „Status”)

| Red | Kod | Test |
|---|---|---|
| §23, §23.1 … §23.4 | `servisi/brisanjeNaloga.js`, `rute/brisanjeNaloga.js` | API-T12, I07-T04 … I07-T07, I07-T11 |
| §23 recent auth, §27 `REAUTHENTICATION_REQUIRED`, O-35 | `posrednici/svjezinaPrijave.js`, `posrednici/autentikacija.js` | I07-T01, I07-T02 |
| §26 API-07, §3.3, NFR-01, O-21 | `rute/brisanjeNaloga.js`, `aplikacija.js` | I07-T03 |
| AUTH-04, AUTH-05 (i07 dio), ODLUKE §6 (o) | postojeći servisi (5.9) | I07-T08, I07-T09 |
| §16, §18.1, §19.1, §7.6, §11, O-9, O-34, AC-09 | `servisi/oslobadjanjeVaucera.js` (`procitajAktivneZaZatvaranje`) | I07-T04, API-T12 |
| §23.3, AC-11 | `servisi/brisanjeNaloga.js` (K5) | API-T12, I07-T06 (b) |
| NFR-04 (brisanje) | `servisi/brisanjeNaloga.js` | I07-T06, I07-T11, I07-T12 |
| §10 (O-10a) | `servisi/evidencijaKupovine.js` | I07-T10 |
| ODLUKE §6 (a), (f), (m), (u) | `servisi/brisanjeNaloga.js` (redoslijed) | I07-T05, I07-T15 |
| §6 (h), D-3 (brisanje) | — | I07-T14 |

## 13. Otvorena pitanja (`i07/P-n`)

- **i07/P-1 — prozor između K4b i K6 (init „oživljava” nalog).** SRS §23.1 (6) „Auth posljednji”, AUTH-03 (Android ponavlja init kad `users` ne postoji),
  ODLUKE §6 (a). Poslije K4b `users` ne postoji, a Auth nalog i token još važe (P-b), pa API-01 može napraviti `users` ACTIVE + `loyaltyAccounts`; ako K6
  zatim uspije, ostaju dokumenti (sa `displayName`) bez Auth naloga. Prozor je jedan Auth RPC (~desetine ms) i zahtijeva token TOG korisnika.
  Opcije: **(A)** prihvatiti, dokumentovati (ODLUKE §7) i novo ograničenje **(v) za i10**: Android poslije pokretanja DELETE-a ne poziva init ni drugi
  API do 204, a 401 na ponovljen DELETE tumači kao završeno brisanje (i07/P-8). Bez koda. **(B)** poslije K6 dodatni idempotentni „sweep”
  `users`/`loyaltyAccounts` po UID-u — sužava, ali ne zatvara prozor (init čiji je token verifikovan prije K6 može commit-ovati poslije sweep-a) i
  dodaje Firestore korak POSLIJE Auth-a, što je u suprotnosti sa doslovnim §23.1 (6) — traži Aninu odluku. **(C)** `revokeRefreshTokens` prije K4b —
  nova Auth mutacija van SRS-a; ponovna prijava i dalje otvara prozor; ruši nastavak sa postojećim token-om (traži ponovnu prijavu). **(D)** „tombstone”
  kolekcija — zabranjeno (§24 zatvoren spisak, §1.3). Onemogućavanje Auth naloga (`disabled`) prije kraja nije dozvoljeno (brief, §23.4).
  **Preporuka: A** (jedina bez odstupanja od §23.1; rizik ograničen na korisnikov sopstveni token).
- **i07/P-2 — tačan oblik O-35.** Potvrđujem O-35 sa preciziranjem: (a) poređenje u cijelim ms `Date.now() ≤ auth_time·1000 + 300 000` (ekvivalentno
  `Date.now()/1000 − auth_time ≤ 300`, bez razlomaka); (b) `auth_time` koji nije nenegativan siguran cijeli broj (nedostaje, string) → 409 (fail closed;
  P-a: emulator propušta token bez `auth_time`); (c) budući `auth_time` → dozvoljeno. **Preporuka: odobriti.**
- **i07/P-3 — O-34b potvrđujem uz preciziranje** (5.7): nastavak uvijek izvršava cijeli tok; `accountStatus` van enum-a → 500 i nalog se ne može obrisati
  dok se stanje ne ispravi (ODLUKE §5 „nekonzistentno stanje se ne popravlja”); K3 i K4b u transakciji provjeravaju da je `users` DELETION_IN_PROGRESS ili
  da ne postoji (inače 500). **Preporuka: odobriti.**
- **i07/P-4 — korak 3 kao jedna transakcija bez gornje granice ACTIVE voucher-a** (kao i05/P-8): broj ACTIVE voucher-a je ograničen bodovima korisnika
  (svaki košta ≥ 30), 2 upisa po voucher-u. **Preporuka: odobriti** (poznato ograničenje, kao i05/P-8).
- **i07/P-5 — posljedica O-10a** (5.8): poslije pseudonimizacije isti `(stationId, posTransactionId)` sa istim payload-om i DRUGIM `loyaltyUid` → 200 prvi
  rezultat (nema EARN-a). Doslovno O-10a („uid se NE poredi”). **Preporuka:** prihvatiti, upisati u README i ODLUKE §7.
- **i07/P-6 — §20.2 / O-16 poslije brisanja mapping-a** (5.6): retry otkupa / izdavanja kad je §23.2 obrisao zapis više ne vraća „isti rezultat” nego
  409 / 404 (nikad 500). **Preporuka:** prihvatiti; zatvara (f), (m), (u).
- **i07/P-7 — test-only proširenja:** `omotacBaze.batch()` (prolaz; operacije u `upisi` sa metodom `batch.delete` / `batch.update` i oznakom paketa;
  `baciNaUpisu` broji i operacije paketa — postojeći servisi ne koriste pakete, pa i01–i06 ponašanje identično) + opcija `dnevnik` (zajednički niz za
  redoslijed sa Auth-om); `test/pomocnici/omotacAutha.js` (`verifyIdToken` prolaz, `deleteUser` sa `dnevnik`, `baciNaBrisanju`, brojač). **Preporuka: odobriti.**
- **i07/P-8 — ponovljen DELETE poslije uspješnog K6 → 401** (P-b), ne 204 (O-33 važi dok Auth nalog postoji). Ako je 503 nastao poslije commit-a K6
  (izgubljen odgovor), retry dobija 401. **Preporuka:** prihvatiti; Android (i10) 401 poslije DELETE-a tretira kao završeno brisanje (ograničenje (v)).
- **i07/P-9 — smoke u `provjera.ps1`**: `DELETE /api/v1/account` bez token-a → 401 `UNAUTHENTICATED` (jedan red, kao i06/P-2). **Preporuka: dodati**
  (u koraku 3, prije `provjera.ps1` #1).

SRS kontradikcija koja blokira rad: nije nađena. i07/P-1 opcija B bi bila odstupanje od §23.1 (6) i zato nije preporučena bez Anine odluke.

## 14. Odluke Orchestrator-a (odobrenje plana)

