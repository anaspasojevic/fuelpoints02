# i06 — Plan (PLANNER)

Iteracija 6: Voucher redeem (API-04). Grana `iteracija-06` (iz `main` = merge `5a2f8cc`, tag `i05`).
Izvori: `CLAUDE.md`, `docs/iteracije/i06_brief.md` (obavezujući, posebno tačke 2 i 5), `docs/ODLUKE.md` (sve sekcije), SRS 3.1
(`docs/srs/FuelPoints_SRS_3_1.docx`, normativan, SHA-256 `7D866413…C60228` provjeren; §31 provjeren direktno iz `.docx`-a; `.md` čitljiva kopija),
`docs/iteracije/i05_plan.md` (struktura, sekcije 5 i 8), `i05_review.md` sekcija 6 (R-01 … R-07), kod na vrhu grane (`b0bce9b` = `5a2f8cc` + brief).
Datum plana: 2026-10-19. Uloga: PLANNER (bez koda). `provjera.ps1` nije pokretan (O-29 (d)).

Oznake: otvorena pitanja `i06/P-n` (sekcija 13); dopunski testovi `I06-T01 … I06-T23`; kontrolne mutacije `M01 … M45` (sekcija 9).
Probe su rađene privremenim skriptama u scratchpad-u sesije (van repoa, nisu commit-ovane); ishod je u sekciji 3.2.

---

## 1. SRS zahtjevi u opsegu

| SRS / odluka | Šta se radi | Sekcija plana |
|---|---|---|
| §26 API-04, §3.4, NFR-02, ODLUKE §6 (c) | `POST /api/v1/pos/vouchers/:voucherId/redeem` sa postojećim `napraviProvjeruPosKljuca(posStanice)` vezanim SAMO na rutu; `stationId` isključivo iz `res.locals.stationId`; isti rok 10 s | 5.1, 5.2 |
| §20, §20.1, O-1 | Strogo tijelo `{ redemptionRequestId }`, `^[A-Za-z0-9._-]{1,64}$` bez zastavica; sve ostalo 422 `INVALID_REQUEST` bez pristupa bazi | 5.3 |
| O-22, ODLUKE §6 (k), (h), D-5 | `provjeriVoucherId` (postojeća) → 404 `VOUCHER_NOT_FOUND` bez baze; D-5 → 404 `NOT_FOUND` | 5.1, 5.4 |
| §20.2, O-8 (a), (b), O-24 | `redemptionRequests/{requestKey}`, `requestKey` = SHA-256(`stationId:redemptionRequestId`); zapis tačno 6 polja, samo pri uspjehu; mapping PRIJE stanja voucher-a; isti voucher → 200 isto tijelo bez upisa; drugi → 409 `IDEMPOTENCY_CONFLICT` | 5.5 (T1–T2) |
| §20.3, §7.5, §15, §16, §11, O-28 | Uspjeh u JEDNOJ transakciji: voucher REDEEMED (+ `redeemedAt`, `redeemedAtStationId`), `reservedPoints −= cost`, `REWARD_REDEEM` (`redeem_{voucherId}`, `tx.create`), zapis (`tx.create`) | 5.5 (T7–T8) |
| §20.4, O-7 | REDEEMED → 409 `VOUCHER_ALREADY_REDEEMED`; CANCELLED → 409 `VOUCHER_CANCELLED`; EXPIRED → 409 `VOUCHER_EXPIRED`; status ima prednost nad rokom | 5.5 (T4) |
| §20.5, §18, §7.6, ODLUKE §6 (g), (q), (j), O-26 | Istekao ACTIVE: u istoj transakciji EXPIRED + RELEASE kroz `oslobadjanjeVaucera.js`, pa 409 `VOUCHER_EXPIRED`; samo voucher iz putanje, bez `tx.get(query)` | 5.5 (T6, T9), 5.6 |
| AUTH-03, AUTH-05, O-25 | Nalog (`uid` iz voucher-a) tek za ACTIVE, poslije terminalnih stanja | 5.5 (T5) |
| O-23 / O-27, ODLUKE §6 (t) | JEDNA funkcija konzistentnosti stanja voucher-a u `servisi/vauceri.js`; koriste je redeem, cancel, `procitajIstekleAktivne` (i, po `i06/P-1`, O-16 retry API-03) | 5.7 |
| §24, §25.9, §31, D-2 | Blok `match /redemptionRequests/{requestKey} { allow read, write: if false; }` doslovno iz §31, ispred default deny | 5.8 |
| §27 | Kodovi u opsegu po brief-u tačka 2; FORBIDDEN se ne koristi | 5.1, 5.5, 6 |
| NFR-04, NFR-05, NFR-06, AC-04 (backend dio), AC-07, AC-08, AC-09 | Testovi 8.1, 8.2 | 8 |
| ODLUKE §6 (b) | Kasni commit poslije 503 + retry istog `redemptionRequestId` → 200 isto tijelo | 5.5, I06-T16 |
| §6 (h), D-3, O-18, O-19 | Log: šablon rute, bez POS ključa, `voucherId`-a, `redemptionRequestId`-a, `requestKey`-a, `uid`-a; statičke poruke | 5.9, I06-T21 |
| O-29 (c) | `npm run test:emu:ciljano -- <fajlovi>` (Node skripta, bez novog paketa) | 5.10 |

## 2. Van opsega

- API-07, cleanup `redemptionRequests`, O-9, O-10a, `REAUTHENTICATION_REQUIRED` (i07); notifikacija za redeem/release, FCM; POS Simulator (i11);
  Android (i09/i10); admin, ručna korekcija, refund/reversal (§1.3).
- Account-level reconcile pri redeem-u (O-26): nema `tx.get(query)` ni čitanja drugih voucher-a.
- Izmjena ugovora API-01 … API-06 osim O-27 (500 za nedostižno nekonzistentno stanje).
- B-1, B-2, R-02; novi npm paketi; test-only kod u `backend/src`; izmjena načina rada `test:emu` (O-29 (c)).
- `firestore.indexes.json` se ne mijenja (redeem ne koristi upite).

## 3. Polazno stanje i probe

### 3.1 Korak 0

- `git fetch --all --tags; git switch main; git pull` → „Already up to date”; HEAD `5a2f8cc`; tagovi `i01 … i05` postoje; radni direktorijum čist.
- SRS hash: `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (ispravan).
- `iteracija-06` napravljena; brief upisan doslovno (`b0bce9b`, push-ovano).
- Zatečeno: `KOLEKCIJE.redemptionRequests` već postoji (`podaci/kolekcije.js`); `firestore.rules` nema blok `redemptionRequests` (pokriva ga
  default deny; RULE-T12 ga već testira kroz `podrazumijevanaZabrana.test.js:87`); `izracunajRequestKey(uid, requestId)` u `servisi/vauceri.js`;
  `refRelease` je privatna funkcija u `oslobadjanjeVaucera.js`. `docs/ODLUKE.md` §1 još navodi i05 kao „čeka merge i tag” (Builder ažurira).

### 3.2 Probe (scratchpad, nisu commit-ovane)

| Proba | Ishod |
|---|---|
| P-a (O-27 fiksture) | `git grep` svih fabrika voucher-a u `backend/test` i `firebase/tests`: SVE fiksture i01–i05 (`kanonskiVaucer` u 5 fajlova, `pripremiVaucer` u `logVaucera.test.js`, inline u `logIzdavanja.test.js`) već imaju sva tri polja `redeemedAt`, `cancelledAt`, `redeemedAtStationId`. ACTIVE fiksture ih imaju `null`. REDEEMED/CANCELLED fiksture u `otkazivanjeVaucera`, `uskladjivanjeVaucera`, `logVaucera` su konzistentne po O-27. Jedini „nekonzistentni” po O-27 su `izdavanjeNagrade.test.js:713–714` (I04-T09 (b), (c): CANCELLED i REDEEMED sa sva tri polja `null`) — oni nisu ACTIVE, pa ih `procitajIstekleAktivne` nikad ne vidi (upit `status == ACTIVE`) i nijedan O-27 korisnik ih ne čita. **Zaključak: dopuna fikstura NIJE potrebna; nijedan postojeći test fajl se ne mijenja zbog O-27.** Preporuka iz brief-a (polja moraju postojati i biti `null`) se usvaja bez troška. |
| P-b (tijelo, `express.json()`) | Aplikacija iz `src/aplikacija.js` sa test rutom: bez tijela → `req.body === undefined`; `Content-Length: 0` bez CT → `undefined`; `Content-Length: 0` + JSON CT → `{}`; `text/plain` i `application/merge-patch+json` sa JSON-om → `undefined`; JSON niz → `[]`; JSON skalar, `null`, neispravan JSON, `charset=utf-16` → 422 iz globalnog parsera (prije rute, dakle i BEZ POS ključa, `putanja (nepoznata ruta)`); `{"__proto__":{…},"redemptionRequestId":"A"}` → sopstveni ključ `__proto__` (Object.keys ga vidi → 422); dupli ključ `{"redemptionRequestId":"A","redemptionRequestId":"B"}` → `{ redemptionRequestId: "B" }` (posljednji pobjeđuje, `i06/P-4`). Posljedica: za redeem je dovoljno „tijelo mora biti običan objekat sa tačno jednim ključem” — `undefined`, `{}`, niz i ne-JSON daju 422 (poslije POS ključa); skalar/`null`/neispravan JSON daju 422 i bez ključa (kao i05/P-11). |
| P-c (`requestKey`) | SHA-256(UTF-8 `"SIM01:POS-RDM-001"`) = `aefc7b83dbd1da18def47c0a4965f0e3a40752420325c5a3427b6d47946be20e` (Node `crypto` i .NET `SHA256` se slažu). `"SIM02:POS-RDM-001"` = `e3ce68ad64e896bbca473a2ea235ab3e9587854153138918f70daca61cfd61d2`. |
| P-d (deterministički redoslijed) | Skripta kroz `firebase emulators:exec` (demo-fuelpoints): (1) transakcija A čita voucher (ACTIVE), prisilni ABORTED (`code 10`) kao `prisiliPonovniPokusaj`; na POČETKU pokušaja 2, prije ijednog čitanja, izvrši se kompletna transakcija B (ACTIVE → CANCELLED) → B commit-uje bez čekanja, A u pokušaju 2 čita CANCELLED; 1,6 s; ponovljivo. (2) Isto preko `prijeCommita` (A drži bravu poslije čitanja): B ČEKA bravu (race 2 s → čekao), A commit-uje prva — redoslijed se ne može nametnuti. **Zaključak: postojeći `omotacBaze` nema hook „prije pokušaja”; potrebno je minimalno test-only proširenje `prijePokusaja(pokusaj)`** (awaited na početku svakog pokušaja, prije poziva callback-a), uz postojeći `prisiliPonovniPokusaj: 1`. Time se redeem × cancel, redeem × redeem, redeem × API-06 i „zastarjeli nalog” nameću deterministički, bez tajminga i kontencije. |
| P-e (`test:emu:ciljano` pod PowerShell-om) | `npm` je `npm.ps1`; `npm run x -- a.test.js "b c.test.js"` i `npm run x -- "test/emulator/*.test.js"` prosljeđuju argumente tačno (`--` se ne gubi, glob ostaje doslovan). `node node_modules/firebase-tools/lib/bin/firebase.js emulators:exec --config ../firebase.json --project demo-fuelpoints --only firestore,auth "node --test --test-concurrency=1 <fajl>"` iz `backend/` radi (exit 0, ~28 s ukupno za fajl od ~10 s). Pokretanje firebase JS ulaza preko `process.execPath` sa nizom argumenata (bez shell-a) izbjegava PowerShell/cmd navodnike; unutrašnju komandu `emulators:exec` sam izvršava kroz shell, pa putanje moraju biti bez `"`, `&`, `|`, `<`, `>`, `^`, `%`. |

## 4. Raspored fajlova

**Novi**
- `backend/skripte/testEmuCiljano.js` — O-29 (c) (5.10).
- `backend/src/rute/otkupVaucera.js` — `dodajRuteOtkupa(ruter, { servisi, posStanice })`.
- `backend/src/validacija/zahtjevOtkupa.js` — `provjeriTijeloOtkupa(tijelo)`, `FORMAT_REDEMPTION_REQUEST_ID`.
- `backend/src/servisi/otkupVaucera.js` — `otkupiVaucer(db, { stationId, voucherId, redemptionRequestId }, rokDo)`; JEDINI kod koji piše
  `redeem_` i `redemptionRequests`.
- Testovi: `backend/test/jedinicni/testEmuCiljano.test.js`, `jedinicni/konzistentnostVaucera.test.js`, `jedinicni/zahtjevOtkupa.test.js`,
  `backend/test/emulator/konzistentnostVaucera.test.js`, `emulator/otkupVaucera.test.js`, `emulator/otkupAtomicnost.test.js`,
  `emulator/logOtkupa.test.js`, `firebase/tests/zahtjeviOtkupa.test.js`.

**Izmijenjeni**
- `backend/package.json` — samo skript `"test:emu:ciljano": "node skripte/testEmuCiljano.js"` (bez zavisnosti; `test:emu` nepromijenjen).
- `backend/src/servisi/vauceri.js` — `jeKonzistentnoStanjeVaucera(vaucer)` (O-27); `izracunajRequestKey(prviDio, drugiDio)` — samo imena
  parametara i komentar (§14 i §20.2), ponašanje isto.
- `backend/src/servisi/otkazivanjeVaucera.js` — O-27 umjesto `jeIspravanSacuvaniVaucer || rewardId` i umjesto zasebne CANCELLED/`cancelledAt` provjere.
- `backend/src/servisi/oslobadjanjeVaucera.js` — O-27 u `procitajIstekleAktivne`; `refRelease` postaje `export` (koristi ga redeem za provjeru
  postojanja, bez literala `release_` van modula).
- `backend/src/servisi/izdavanjeNagrade.js` — O-27 u O-16 retry grani (SAMO ako Orchestrator usvoji `i06/P-1` A).
- `backend/src/aplikacija.js` — `dodajRuteOtkupa(ruterApi, { servisi, posStanice })`.
- `backend/test/pomocnici/omotacBaze.js` — opcija `prijePokusaja` (test-only, 3.2 P-d); ostale opcije netaknute.
- `firebase/firestore.rules` — samo blok `redemptionRequests` (5.8).
- `skripte/provjera.ps1` — samo novi smoke red (redeem bez ključa → 401 `UNAUTHENTICATED_POS`), vidi `i06/P-2`.
- Dokumentacija (korak 9): `docs/TRACEABILITY.md`, `IMPLEMENTATION_LOG.md`, `TEST_REPORT.md`, `ODLUKE.md`, `README.md`.

**Netaknuti**: svi postojeći test fajlovi i01–i05 (3.2 P-a), `firestore.indexes.json`, `greske/*`, `posrednici/*`, `rute/vauceri.js`, `test:emu`.

## 5. Detaljan dizajn

### 5.1 Tok zahtjeva i redoslijed provjera van transakcije (K-1, i03/P-6)

```
korelacija → parsirajJson (globalno: neispravan JSON / skalar / null / nepodržan charset → 422, bez ključa i baze)
  → /api/v1 ruter, dekodiranje :voucherId (neispravno percent-kodiran → 404 NOT_FOUND, D-5)
  → POST /pos/vouchers/:voucherId/redeem
      1. provjeraPosKljuca (posStanice prazno → 500 i03/P-11; ključ → 401 UNAUTHENTICATED_POS); postavlja rokDo, stationId
      2. provjeriTijeloOtkupa(req.body) → 422 INVALID_REQUEST
      3. provjeriVoucherId(req.params.voucherId) → 404 VOUCHER_NOT_FOUND
      4. otkupiVaucer(db, { stationId: res.locals.stationId, voucherId, redemptionRequestId }, res.locals.rokDo)
           4a. preostaloMs ≤ 0 (ili NaN) → 503, bez ijednog poziva db; 4b. transakcija (5.5)
      5. 200 tijeloOtkupljenog (6)
  → nepoznataRuta (GET / PUT / druga putanja → 404 NOT_FOUND) → centralniRukovalacGreskama
```

| # | Provjera | Ishod | Baza | Obrazloženje |
|---|---|---|---|---|
| 0a | Globalni JSON parser | 422 `INVALID_REQUEST` | ne | i02/P-6, i01/P-4 |
| 0b | D-5 | 404 `NOT_FOUND` | ne | i04/P-8, K-1 |
| 1 | POS ključ | 401 `UNAUTHENTICATED_POS` (500 bez konfiguracije) | ne | §3.4, NFR-02; identitet prije sadržaja (kao token kod API-03/05) |
| 2 | Tijelo | 422 | ne | §20.1, O-1 |
| 3 | Format `voucherId` | 404 `VOUCHER_NOT_FOUND` | ne | O-22; tijelo prije ID-a iz putanje — isti redoslijed kao API-03 (`provjeriTijeloIzdavanja` → `provjeriRewardId`) i API-05 (`provjeriPraznoTijelo` → `provjeriVoucherId`) — **potvrđujem** |
| 4 | Rok | 503 | ne | ODLUKE §5 |

### 5.2 Ruta (`rute/otkupVaucera.js`)

```js
export function dodajRuteOtkupa(ruter, { servisi, posStanice }) {
  ruter.post('/pos/vouchers/:voucherId/redeem', napraviProvjeruPosKljuca(posStanice), async (req, res) => {
    const { redemptionRequestId } = provjeriTijeloOtkupa(req.body);
    const voucherId = provjeriVoucherId(req.params.voucherId);
    const odgovor = await otkupiVaucer(servisi.db, { stationId: res.locals.stationId, voucherId, redemptionRequestId }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });
}
```
- Nova instanca posrednika po ruti (kao `kupovine.js`); ista mapa `posStanice` iz `napraviAplikaciju` → isti rok i ista konfiguracija (§6 (c)).
- Šablon rute u logu je `/pos/vouchers/:voucherId/redeem` (D-3).
- `stationId` iz tijela → 422 (strogo tijelo); iz query-ja / zaglavlja (`X-Station-Id`) se ne čita nigdje.

### 5.3 Tijelo (`validacija/zahtjevOtkupa.js`)

```js
export const FORMAT_REDEMPTION_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;   // §20.1, doslovno, bez zastavica
export function provjeriTijeloOtkupa(tijelo) {
  if (!jeObicanObjekat(tijelo)) throw new GreskaApi('INVALID_REQUEST');                 // undefined, null, niz, skalar
  if (Object.keys(tijelo).length !== 1 || !Object.hasOwn(tijelo, 'redemptionRequestId'))
    throw new GreskaApi('INVALID_REQUEST');                                             // nedostaje / dodatno polje / __proto__
  const { redemptionRequestId } = tijelo;
  if (typeof redemptionRequestId !== 'string' || !FORMAT_REDEMPTION_REQUEST_ID.test(redemptionRequestId))
    throw new GreskaApi('INVALID_REQUEST');
  return { redemptionRequestId };                                                       // novi objekat
}
```
- JS `$` bez `m` ne prihvata završni `\n` (isto kao i04). `"."`, `".."`, `"__x__"` su ispravni po §20.1 — nisu putanja dokumenta
  (ID dokumenta je `requestKey` = 64 hex), pa ne treba `jeIspravanIdDokumenta`.
- Vrijednost se ne stavlja u poruku greške ni log (statička poruka kataloga).

### 5.4 `voucherId` — postojeća `provjeriVoucherId` (bez izmjene). Firebase UID (28 znakova, AC-04 Customer QR) → 404 `VOUCHER_NOT_FOUND`.

### 5.5 Transakciona granica `otkupiVaucer(db, { stationId, voucherId, redemptionRequestId }, rokDo)` (`servisi/otkupVaucera.js`)

```
preostaloMs = rokDo − Date.now();  ako !(preostaloMs > 0) → throw GreskaApi('SERVICE_UNAVAILABLE')         // bez ijednog poziva db
requestKey = izracunajRequestKey(stationId, redemptionRequestId)                                          // O-8 (b)
refZapis = redemptionRequests/{requestKey}; refVaucer = vouchers/{voucherId}; refRedeem = loyaltyLedger/redeem_{voucherId}

transakcija = db.runTransaction(async (tx) => {
  sadaMs = Date.now()                                                       // jednom po pokušaju (§6 (j))

  // T1 čitanje: zapis i voucher iz putanje jednim tx.getAll (redoslijed PROVJERA je ipak: zapis pa voucher)
  [snimakZapisa, snimakVaucera] = await tx.getAll(refZapis, refVaucer)

  // T2 idempotentnost PRIJE stanja voucher-a (O-24, §20.2)
  ako snimakZapisa.exists:
    z = snimakZapisa.data()
    ako !jeIspravanZapis(z, stationId, redemptionRequestId)      → throw Error('Nekonzistentno stanje: neispravan zapis otkupa.')   // 500
        // tačno 6 ključeva; z.stationId === stationId; z.redemptionRequestId === redemptionRequestId; z.voucherId odgovara FORMAT_VOUCHER_ID;
        // z.uid neprazan string; z.resultStatus === 'REDEEMED'; z.createdAt Timestamp
    ako z.voucherId !== voucherId                                → throw GreskaApi('IDEMPOTENCY_CONFLICT')            // 409, ništa upisano
    // isti voucher: retry → 200 iz SAČUVANOG voucher-a, bez obzira na nalog i rok; NIŠTA se ne upisuje
    ako !snimakVaucera.exists                                    → throw Error('Nekonzistentno stanje: zapis otkupa bez voucher-a.')  // 500
    v = snimakVaucera.data()
    ako !jeKonzistentnoStanjeVaucera(v) || v.status !== 'REDEEMED' || v.redeemedAtStationId !== stationId || v.uid !== z.uid
                                                                  → throw Error('Nekonzistentno stanje: voucher ne odgovara zapisu otkupa.')  // 500
    return { ishod: 'OTKUPLJEN', odgovor: tijeloOtkupljenog(voucherId, v) }

  // T3 postojanje i konzistentnost (O-27)
  ako !snimakVaucera.exists                                      → throw GreskaApi('VOUCHER_NOT_FOUND')               // 404
  v = snimakVaucera.data()
  ako !jeKonzistentnoStanjeVaucera(v)                            → throw Error('Nekonzistentno stanje: neispravan voucher.')          // 500

  // T4 terminalna stanja PRIJE naloga (O-25), status prije roka (O-7); ništa se ne upisuje
  REDEEMED → GreskaApi('VOUCHER_ALREADY_REDEEMED'); CANCELLED → GreskaApi('VOUCHER_CANCELLED'); EXPIRED → GreskaApi('VOUCHER_EXPIRED')   // 409

  // T5 ACTIVE: nalog vlasnika voucher-a (uid iz voucher-a, POS ga ne šalje)
  [snimakKorisnika, snimakNaloga] = await tx.getAll(users/{v.uid}, loyaltyAccounts/{v.uid})
  { dostupno, rezervisano } = procitajStanjeNaloga(snimakKorisnika, snimakNaloga)                      // 409 / 409 / 500 (AUTH-03, AUTH-05)

  // T6 ledger trag za ACTIVE voucher (O-28; i04/P-5): ni redeem_ ni release_ ne smiju postojati
  [snimakRedeem, snimakRelease] = await tx.getAll(refRedeem, refRelease(db, voucherId))
  ako snimakRedeem.exists || snimakRelease.exists               → throw Error('Nekonzistentno stanje: ledger događaj postoji za ACTIVE voucher.')  // 500

  expiresAtMs = v.expiresAt.toMillis()
  // T7 §20.5: istekao ACTIVE → EXPIRED + RELEASE u ISTOJ transakciji (zajednički mehanizam, §6 (q)); bez zapisa (O-8 (a))
  ako jeIstekao(expiresAtMs, sadaMs):
    { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db,
          { vauceri: [{ ref: refVaucer, voucherId, expiresAtMs, cijena: v.costPoints, izmjena: { status: 'EXPIRED' } }], dostupno, rezervisano })
          // ponovo čita release_ (bezopasno), reservedPoints − cost < 0 → 500
    vrijeme = FieldValue.serverTimestamp()
    upisiOslobadjanja(tx, db, oslobadjanja, { uid: v.uid, vrijeme })                                  // upis 1 voucher, 2 release_
    tx.update(loyaltyAccounts/{v.uid}, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme })   // upis 3
    return { ishod: 'ISTEKAO' }

  // T8 §20.3: otkup
  ako rezervisano − v.costPoints < 0                             → throw Error('Nekonzistentno stanje: reservedPoints bi pao ispod 0.')   // 500
  rezervisano −= v.costPoints                                      // dostupno se NE mijenja (§7.5)
  izmjena = { status: 'REDEEMED', redeemedAt: Timestamp.fromMillis(sadaMs), redeemedAtStationId: stationId }
  vrijeme = FieldValue.serverTimestamp()
  tx.update(refVaucer, izmjena)                                                                         // upis 1
  tx.create(refRedeem, { uid: v.uid, type: 'REWARD_REDEEM', deltaAvailable: 0, deltaReserved: −v.costPoints,
                         availableAfter: dostupno, reservedAfter: rezervisano, purchaseId: null, voucherId, createdAt: vrijeme })   // upis 2
  tx.update(loyaltyAccounts/{v.uid}, { reservedPoints: rezervisano, updatedAt: vrijeme })              // upis 3 (availablePoints se ne upisuje)
  tx.create(refZapis, { stationId, uid: v.uid, redemptionRequestId, voucherId, resultStatus: 'REDEEMED', createdAt: vrijeme })   // upis 4
  return { ishod: 'OTKUPLJEN', odgovor: tijeloOtkupljenog(voucherId, { ...v, ...izmjena }) }
}, { maxAttempts: 5 })

rezultat = await saRokom(transakcija, preostaloMs)    // GreskaApi prolazi; jeNedostupnostFirestore → 503; ostalo → izvorna → 500 (kao cancel)
ako rezultat.ishod === 'ISTEKAO' → throw GreskaApi('VOUCHER_EXPIRED')      // TEK POSLIJE commit-a (§20.5, obrazac O-5 / O-14)
return rezultat.odgovor
```

**Potvrda redoslijeda O-24 / O-25 (sa obrazloženjem po SRS-u)**
1. Zapis prvi (O-24): §20.2 „Поновљен исти request ID за исти voucher враћа исти резултат” — retry uspješnog zahtjeva nailazi na REDEEMED
   voucher (i eventualno nalog u brisanju ili prošli `expiresAt`); da je stanje voucher-a prvo, retry bi dobio 409 i prekršio §20.2 i NFR-05.
   Strukturna provjera zapisa (500) prije poređenja `voucherId` (409), kao O-16 (mapping ↔ ključ) — vidi `i06/P-3`.
2. Postojanje (404) → konzistentnost (O-27, 500) → terminalna stanja (409): O-27 mora prethoditi grananju po statusu, inače bi se REDEEMED bez
   `redeemedAt` prijavio kao 409 umjesto kao nekonzistentno stanje (ODLUKE §5).
3. Terminalna stanja prije naloga (O-25, po uzoru na O-20): §20.4 / O-7 ne mijenjaju stanje, pa AUTH-05 („nova mutacija se odbija”) nije pogođen;
   ishod ne zavisi od naloga.
4. Nalog prije isteka (O-25): §20.5 JE mutacija (release); AUTH-05 je blokira → 409 `ACCOUNT_DELETION_IN_PROGRESS`, bez release-a.
5. `redeem_` / `release_` prije grananja na istek (T6): ACTIVE voucher sa bilo kojim od ta dva događaja je nekonzistentan u OBJE grane; brief
   navodi provjeru „redeem_ ili release_ već postoji” poslije isteka — ja je stavljam ODMAH prije grananja jer važi za obje grane (ishod isti:
   500 bez upisa; `i06/P-5`).
6. `reservedPoints < cost` (500) neposredno prije upisa (u §20.5 grani kroz `pripremiOslobadjanja`).

**Čitanja (sva prije svih upisa)**: T1 `tx.getAll(zapis, voucher)`; T5 `tx.getAll(users, loyaltyAccounts)`; T6 `tx.getAll(redeem_, release_)`;
§20.5 još `release_` u `pripremiOslobadjanja`. Nikad `tx.get(query)` (O-26). Ništa se ne čita van transakcije.

**Upisi (O-28; fiksni redoslijed i broj — failure injection ih cilja po putanji)**
- Uspjeh: 1 `update vouchers/V` (TAČNO `status`, `redeemedAt`, `redeemedAtStationId`), 2 `create loyaltyLedger/redeem_V`, 3 `update loyaltyAccounts/uid`
  (TAČNO `reservedPoints`, `updatedAt`), 4 `create redemptionRequests/requestKey`. **Potvrđujem redoslijed iz brief-a** (isti obrazac kao i05: voucher → ledger →
  nalog; zapis posljednji kao u API-03 gdje je mapping posljednji upis).
- §20.5: 1 `update vouchers/V` (`{ status: 'EXPIRED' }`), 2 `create loyaltyLedger/release_V`, 3 `update loyaltyAccounts/uid` (available, reserved, updatedAt).
- Svi ostali ishodi: 0 upisa.

**Ishod svake grane**

| Grana | HTTP | Upisi |
|---|---|---|
| rok istekao prije tx | 503 | 0, 0 pristupa db |
| zapis nekonzistentan / bez voucher-a / voucher ne odgovara | 500 | 0 |
| zapis za drugi voucher | 409 `IDEMPOTENCY_CONFLICT` | 0 |
| zapis za isti voucher (retry) | 200, tijelo iz sačuvanog | 0 |
| voucher ne postoji | 404 `VOUCHER_NOT_FOUND` | 0 |
| O-27 pada | 500 | 0 |
| REDEEMED / CANCELLED / EXPIRED | 409 `VOUCHER_ALREADY_REDEEMED` / `VOUCHER_CANCELLED` / `VOUCHER_EXPIRED` | 0 |
| ACTIVE, nalog: users ne postoji / DELETION / nepoznat status / loyaltyAccounts ne postoji / neispravan | 409 `ACCOUNT_NOT_INITIALIZED` / 409 `ACCOUNT_DELETION_IN_PROGRESS` / 500 / 409 `ACCOUNT_NOT_INITIALIZED` / 500 | 0 |
| ACTIVE, `redeem_` ili `release_` postoji | 500 | 0 |
| ACTIVE istekao, `reserved < cost` | 500 | 0 |
| ACTIVE istekao | 409 `VOUCHER_EXPIRED` (poslije commit-a) | 3 |
| ACTIVE neistekao, `reserved < cost` | 500 | 0 |
| ACTIVE neistekao | 200 | 4 |
| greška upisa / commit-a / `ALREADY_EXISTS` (zastarjelo čitanje) | 500 | 0 (rollback) |
| UNAVAILABLE / DEADLINE / ABORTED iscrpljen / rok tokom tx | 503 | 0 ili kasni commit (§6 (b)) |

**Konkurentnost**: double-redeem i redeem × cancel sprečava čitanje i ažuriranje ISTOG `vouchers/V` i ISTOG `loyaltyAccounts/uid` u transakciji
(Firestore serializuje ili ponavlja), uz `tx.create` za `redeem_` i zapis kao drugu liniju odbrane. Dva paralelna ista zahtjeva: drugi u ponovljenom
pokušaju vidi zapis → 200 isto tijelo. Kasni commit poslije 503 → retry vidi zapis → 200.

### 5.6 §20.5 grana kroz `oslobadjanjeVaucera.js`

- Redeem poziva `pripremiOslobadjanja` + `upisiOslobadjanja` sa jednom stavkom `{ ref, voucherId, expiresAtMs, cijena, izmjena: { status: 'EXPIRED' } }`,
  identično O-5 grani cancel-a (§6 (g), (q)). Modul ne čita sat (`sadaMs` iz redeem callback-a).
- `refRelease` se izvozi (jedina izmjena modula pored O-27 u `procitajIstekleAktivne`); redeem ga koristi samo za ČITANJE u T6.
  `git grep -n "release_" -- backend/src` → i dalje samo `servisi/oslobadjanjeVaucera.js`; `git grep -n "REWARD_RELEASE" -- backend/src` → isto.
- `git grep -n -E "redeem_|REWARD_REDEEM|redemptionRequests" -- backend/src` → samo `servisi/otkupVaucera.js` (+ `podaci/kolekcije.js` za naziv kolekcije).

### 5.7 O-27 — `jeKonzistentnoStanjeVaucera(vaucer)` (`servisi/vauceri.js`) i svi korisnici

```js
// §15, §16, O-27: jedina definicija konzistentnog voucher dokumenta. Polja stanja moraju POSTOJATI (undefined ≠ null).
export function jeKonzistentnoStanjeVaucera(v) {
  if (typeof v?.uid !== 'string' || v.uid === '' || typeof v.rewardId !== 'string' || !jeIspravanSacuvaniVaucer(v)) return false;
  const jeTs = (x) => x instanceof Timestamp;
  switch (v.status) {
    case 'ACTIVE':    return v.redeemedAt === null && v.redeemedAtStationId === null && v.cancelledAt === null;
    case 'REDEEMED':  return jeTs(v.redeemedAt) && typeof v.redeemedAtStationId === 'string' && v.redeemedAtStationId !== '' && v.cancelledAt === null;
    case 'CANCELLED': return jeTs(v.cancelledAt) && v.redeemedAt === null && v.redeemedAtStationId === null;
    case 'EXPIRED':   return v.redeemedAt === null && v.redeemedAtStationId === null && v.cancelledAt === null;
    default:          return false;
  }
}
```

| Korisnik | Izmjena | Ponašanje prije → poslije (samo nedostižno stanje) | Test koji obara „bez provjere” |
|---|---|---|---|
| redeem (`otkupVaucera.js`, T2 i T3) | nova | — | I06-T14 (a) (mutacija M30) |
| cancel (`otkazivanjeVaucera.js`) | poslije `uid` / FORBIDDEN (O-6 ostaje prvi), `!jeKonzistentnoStanjeVaucera(v)` → 500 zamjenjuje `jeIspravanSacuvaniVaucer || rewardId` i provjeru CANCELLED bez `cancelledAt` | ACTIVE sa tragom redeem/cancel: 200 → 500 (R-01 zatvoren); REDEEMED bez `redeemedAt`: 409 → 500; postojeće I05-T09 (CANCELLED bez `cancelledAt` → 500) i dalje važi | I06-T03 (M31) |
| `procitajIstekleAktivne` (API-03 reconcile, API-06) | `!jeKonzistentnoStanjeVaucera(data) \|\| data.uid !== uid \|\| data.status !== 'ACTIVE'` → 500 za SVAKI ACTIVE iz upita (istekao ili ne, kao i04/P-7 (d)) | ACTIVE sa tragom: release (200/201) → 500 bez upisa | I06-T04 (M32) |
| O-16 retry API-03 (`izdavanjeNagrade.js`) | SAMO ako `i06/P-1` A: `jeKonzistentnoStanjeVaucera` umjesto `jeIspravanSacuvaniVaucer` | REDEEMED bez `redeemedAt` u retry-ju: 200 → 500 | I06-T05 (M33) |

`jeIspravanSacuvaniVaucer` ostaje kao dio O-27 (gradivni blok); ako `i06/P-1` A, njen jedini direktni korisnik postaje `jeKonzistentnoStanjeVaucera`.
Fiksture: nijedna dopuna (3.2 P-a). Korak 2 dokazuje: cijela i01–i05 suite zelena bez izmjene ijednog postojećeg test fajla.

### 5.8 Rules

```
    match /redemptionRequests/{requestKey} {
      allow read, write: if false;
    }
```
Doslovno iz §31 (provjereno u `.docx`), između `rewardRequests` i `match /{document=**}`, uvlačenje kao ostali blokovi.
`git diff i05 -- firebase/firestore.rules` = samo ova 3 reda (+ eventualno prazan red).

### 5.9 Log

- `zabiljeziGresku` već bilježi šablon rute (D-3) → `/pos/vouchers/:voucherId/redeem`; za 422 iz globalnog parsera `(nepoznata ruta)`.
- Sve nove poruke `new Error('…')` su statičke (I05-T02 skenira cijeli `src`). Ništa ne loguje `requestKey`, `redemptionRequestId`, `stationId`
  (nije tajna, ali nije potreban), `uid`, `voucherId`. gRPC greške (npr. `ALREADY_EXISTS` na `redemptionRequests/<64 hex>`) idu bez poruke (§6 (h)).

### 5.10 O-29 (c) — `backend/skripte/testEmuCiljano.js`

```js
// O-29 (c): ciljani emulator run; ista konfiguracija kao test:emu (isti emulators:exec, demo-fuelpoints, firestore+auth,
// --test-concurrency=1), samo zadati fajlovi. firebase-tools se pokreće kroz process.execPath (bez shell-a, bez PowerShell navodnika).
export function napraviArgumente(argumenti) → niz argumenata za firebase.js
  // fajlovi: ≥ 1; svaki odgovara /^test\/emulator\/[A-Za-z0-9_.*-]+\.test\.js$/ (dozvoljen * za glob koji razvija node --test; bez .., \, ", razmaka)
  // opciono jedan --test-name-pattern=<obrazac> sa /^[A-Za-z0-9 _.()-]+$/ (bez znakova koje cmd/sh tumače); sve ostalo → greška, exit 2
  // komanda = `node --test --test-concurrency=1 [--test-name-pattern="<obrazac>"] "<f1>" "<f2>" …`
  // → ['…/firebase-tools/lib/bin/firebase.js', 'emulators:exec', '--config', '../firebase.json', '--project', 'demo-fuelpoints',
  //    '--only', 'firestore,auth', komanda]
glavni dio (kad je skripta pokrenuta direktno): spawn(process.execPath, napraviArgumente(argv), { cwd: backend, stdio: 'inherit' }) → exit kod djeteta
```
`package.json`: `"test:emu:ciljano": "node skripte/testEmuCiljano.js"`. Upotreba (PowerShell, iz `backend`):
`npm run test:emu:ciljano -- test/emulator/otkupVaucera.test.js` ; više fajlova razmakom; `npm run test:emu:ciljano -- test/emulator/otkupVaucera.test.js --test-name-pattern=API-T09`.
`test:emu` i `provjera.ps1` (osim smoke reda, `i06/P-2`) se ne mijenjaju i ostaju dokaz za DoD.

## 6. Ugovor odgovora API-04 (prijedlog za Anu, `i06/P-6`)

Usvaja se preporuka brief-a bez izmjene:
- **200** i za prvi otkup i za retry istog `(stationId, redemptionRequestId)` za isti voucher (§20.2 „исти резултат”).
- Tijelo TAČNO, tim redoslijedom: `{ voucherId, rewardId, costPoints, status: "REDEEMED", issuedAt, expiresAt, redeemedAt, redeemedAtStationId }`;
  vremena `toDate().toISOString()` (ISO 8601 UTC, kao API-03); `tijeloOtkupljenog(voucherId, v)` je JEDNA funkcija za prvi odgovor
  (`{ ...v, ...izmjena }`, `redeemedAt = Timestamp.fromMillis(sadaMs)` je tačno ono što se upisuje) i retry (SAČUVANI dokument) → bajt-identično.
- Ne sadrži: `uid`, `redemptionRequestId`, `requestKey`, ID-eve ledger događaja, balance, `cancelledAt`.
- Greške: tačno §27 tijelo; 409 `IDEMPOTENCY_CONFLICT` bez ijednog `voucherId`-a. 409 `VOUCHER_EXPIRED` poslije §20.5 commit-a nema tijelo uspjeha.

## 7. Koraci implementacije (jedan korak = jedan commit + push; testovi prije koda; `provjera.ps1` → 0 poslije svakog koraka, i03/K-2)

O-29 (a): prije svakog `provjera.ps1` / `test:emu` / ponovljenog konkurentnog testa `powercfg /change standby-timeout-ac 0` (na kraju vratiti).
Procjena uključuje `provjera.ps1` (~16 min danas, ~21 min sa i06 testovima).

| # | Commit | Sadržaj | Procjena (min) |
|---|---|---|---|
| 0 | `i06: odobrenje plana i odluke Orchestrator-a` | Builder doslovno upisuje odluke u sekciju 14 | 5 |
| 1 | `i06: test:emu:ciljano (O-29 (c))` | I06-T01 prvo (crveno), pa `skripte/testEmuCiljano.js` + skript u `package.json`; ručna provjera pod PowerShell-om (jedan fajl, dva fajla, glob, `--test-name-pattern`), rezultat u TEST_REPORT | 20 + 18 |
| 2 | `i06: zajednička provjera stanja voucher-a (O-27)` | I06-T02, I06-T03, I06-T04 (+ I06-T05 ako P-1 A) prvo (crveni), pa `jeKonzistentnoStanjeVaucera` + cancel + `procitajIstekleAktivne` (+ O-16); `npm run test:emu` KOMPLETNA i05 suite zelena; `git diff i05 -- backend/test` = samo novi fajlovi | 40 + 20 |
| 3 | `i06: Rules blok redemptionRequests (§31)` | I06-T22 prvo, pa blok | 10 + 20 |
| 4 | `i06: validacija zahtjeva otkupa i requestKey (§20.1, O-8 (b))` | I06-T06, I06-T07 prvo, pa `zahtjevOtkupa.js` i parametri `izracunajRequestKey` | 20 + 20 |
| 5 | `i06: API-04 redeem (§20, O-24 … O-28)` | API-T08 … API-T10, I06-T08 … I06-T14 prvo, pa `servisi/otkupVaucera.js`, `rute/otkupVaucera.js`, `aplikacija.js`, `refRelease` export, smoke red u `provjera.ps1` (`i06/P-2`) | 120 + 22 |
| 6 | `i06: atomičnost i konkurentnost otkupa` | `omotacBaze.prijePokusaja`; I06-T15 … I06-T20 (testovi; kod se mijenja samo ako test otkrije grešku) | 90 + 22 |
| 7 | `i06: log i odgovori otkupa` | I06-T21 | 30 + 22 |
| 8 | (bez commit-a) | Kontrolne mutacije M01 … M45 kroz `test:emu:ciljano` / `npm test`, svaka pa `git restore` | 75 (D ~1,5 min) + 35 (K 10×) |
| 9 | `i06: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost, registar odluka i README` | Dokumentacija + inspekcije (I06-T23) + `provjera.ps1` ×1 završno (+ hash) | 50 + 22 |
| 10 | PR `iteracija-06 → main` (bez merge-a) | | 5 |

**Ukupno ≈ 7 h 30 min** (od toga ≈ 3 h 10 min `provjera.ps1`; laptop mora biti budan cijelo vrijeme po O-29 (a)).

## 8. Testovi

Konvencije kao i05 (8): `node:test` + `node:assert/strict`, naslov počinje ID-em; emulator fajlovi: `provjeriTestnoOkruzenje()`, `beforeEach(ocistiEmulatore)` +
`napuniRewardDefinitions`, `afterEach(mock.restoreAll)`; aplikacija `napraviAplikaciju({ servisi: { …firebase, db }, verzijaUslova: '1.0', posStanice })` sa
`posKonfiguracija([['SIM01', K1], ['SIM02', K2]])`; tačno §27 tijelo (`provjeriTijeloGreske`). Lokalni pomoćnici: `pripremiNalog`, `pripremiVaucer`
(kanonski §15, sva polja), `pripremiDogadjaj` (konzistentan ledger: `reserve_`, za EXPIRED/CANCELLED `release_`, za REDEEMED `redeem_`), `snimakBaze()`,
`otkupi(voucherId, { kljuc, db, tijelo, zaglavlja })` (supertest). Svaki test sa omotačem ima kontrolu (omotač bez opcija → očekivan uspjeh).
Testovi koji dozvoljavaju 503 čekaju `sveTransakcijeZavrsene`. Standardni primjer: nalog `30/50`, ACTIVE CAR_WASH V (50, `expiresAt` = sada + 10 min) +
`reserve_V`, SIM01, `"POS-RDM-001"`.

### 8.1 SRS katalog

| ID | SRS | Fajl | Šta tačno provjerava |
|---|---|---|---|
| API-T08 | §20.3, §7.5, §11, §15, §16, AC-07, AC-09 | `emulator/otkupVaucera.test.js` | Standardni primjer → 200; tijelo tačno po 6 (`Object.keys` 8 ključeva tim redoslijedom; `redeemedAtStationId 'SIM01'`; `redeemedAt` = ISO sačuvanog). V `deepStrictEqual` prije osim `status 'REDEEMED'`, `redeemedAt` (`Timestamp`, u [prije − 5 s, poslije + 5 s]), `redeemedAtStationId 'SIM01'`; `cancelledAt null`. Nalog `30/0` (`availablePoints` 30 kao prije), `createdAt` nepromijenjen, `updatedAt` = `createdAt` događaja. `loyaltyLedger/redeem_V` TAČNO 9 ključeva §11 (`type 'REWARD_REDEEM'`, `deltaAvailable 0`, `deltaReserved −50`, `availableAfter 30`, `reservedAfter 0`, `purchaseId null`, `voucherId V`, `uid`, `createdAt Timestamp`); tačno 1 REDEEM korisnika, 0 RELEASE. `redemptionRequests/aefc7b83…be20e` TAČNO 6 ključeva (`stationId 'SIM01'`, `uid` = `v.uid`, `redemptionRequestId 'POS-RDM-001'`, `voucherId V`, `resultStatus 'REDEEMED'`, `createdAt` = `createdAt` događaja); ukupno 1 zapis. Omotač: `upisi` = tačno 4 po 5.5. |
| API-T09 | §20.2, §20.4, NFR-05, O-8 (b), O-24 | isti | (a) Isti zahtjev ponovo 2× → 200, tijelo `deepStrictEqual` prvom; `snimakBaze()` `deepStrictEqual` stanju poslije prvog; omotač `upisi === []`. (b) Isti ID (SIM01) za drugi ACTIVE voucher W istog korisnika → 409 `IDEMPOTENCY_CONFLICT` (tijelo bez V i W); W i nalog netaknuti, `upisi === []`. (c) Novi ID `"POS-RDM-002"` za V → 409 `VOUCHER_ALREADY_REDEEMED`, `upisi === []`. (d) Isti ID sa SIM02 (ključ K2) za V → 409 `VOUCHER_ALREADY_REDEEMED`; `redemptionRequests/e3ce68ad…61d2` ne postoji; ukupno 1 zapis, 1 REDEEM. |
| API-T10 | §20.5, §7.6, §18, AC-08, O-8 (a) | isti | Nalog `0/50`, ACTIVE V (50) sa `expiresAt` = sada − 1 min → 409 `VOUCHER_EXPIRED` tačno; V `deepStrictEqual` prije osim `status 'EXPIRED'` (`redeemedAt`, `redeemedAtStationId`, `cancelledAt` `null`); nalog `50/0`; `release_V` 9 polja (`deltaAvailable 50`, `deltaReserved −50`, `availableAfter 50`, `reservedAfter 0`); 0 REDEEM; 0 zapisa. Ponovljen zahtjev → 409 `VOUCHER_EXPIRED`, `upisi === []`, stanje `deepStrictEqual`. Granica (mock `Date.now` samo za pozive iz `/src/servisi/otkupVaucera.js`, kao I05-T07): `sadaMs === expiresAt` → 409 EXPIRED + release; `sadaMs === expiresAt − 1` → 200, `redeemedAt.toMillis() === expiresAt − 1`. |

### 8.2 Dopunski testovi I06

| ID | SRS / odluka | Fajl | Priprema → asercije |
|---|---|---|---|
| I06-T01 | O-29 (c) | `jedinicni/testEmuCiljano.test.js` | `napraviArgumente(['test/emulator/a.test.js'])` → tačan niz (`emulators:exec`, `--config ../firebase.json`, `--project demo-fuelpoints`, `--only firestore,auth`, komanda `node --test --test-concurrency=1 "test/emulator/a.test.js"`); dva fajla; `test/emulator/*.test.js`; `--test-name-pattern=API-T09`. Odbija (baca): bez fajlova, `../x.test.js`, `C:\\x.test.js`, `test/jedinicni/x.test.js`, `test/emulator/a"b.test.js`, `test/emulator/a&b.test.js`, `test/emulator/a b.test.js`, obrazac sa `|`. Plus ručni run pod PowerShell-om (TEST_REPORT). |
| I06-T02 | O-27, §15, §16 | `jedinicni/konzistentnostVaucera.test.js` | `jeKonzistentnoStanjeVaucera`: konzistentni — ACTIVE (sva tri `null`), REDEEMED (`Timestamp`, `'SIM01'`, `null`), CANCELLED (`Timestamp`, `null`, `null`), EXPIRED (sva `null`). Nekonzistentni (svaki zasebno): ACTIVE sa `redeemedAt` / `redeemedAtStationId 'S'` / `cancelledAt`; ACTIVE bez polja `redeemedAt` (izostavljeno) / bez `cancelledAt` / bez `redeemedAtStationId`; REDEEMED bez `redeemedAt`, `redeemedAt` string, `redeemedAtStationId ''`/`null`/`5`, sa `cancelledAt`; CANCELLED bez `cancelledAt`, sa `redeemedAt`, sa `redeemedAtStationId`; EXPIRED sa bilo kojim od tri; plus postojeći: `uid ''`/`5`/nedostaje, `rewardId 5`, `costPoints 0/1.5/'50'`, `status 'PENDING'`, `issuedAt`/`expiresAt` string; `undefined`/`null` ulaz → `false` bez bacanja. |
| I06-T03 | O-27 (cancel), O-23, R-01 | `emulator/konzistentnostVaucera.test.js` | Nalog `0/50` + `reserve_V`; V ACTIVE neistekao sa (a) `redeemedAt: Timestamp`, (b) `redeemedAtStationId 'SIM01'`, (c) `cancelledAt: Timestamp` (stari se ne prepisuje), (d) polje `cancelledAt` izostavljeno; REDEEMED bez `redeemedAt`; EXPIRED sa `cancelledAt` → `POST …/cancel` vlasnika → 500 bez stack-a, omotač `upisi === []`, `snimakBaze` `deepStrictEqual`. Isto (a) sa isteklim ACTIVE (bez O-5 release-a). Kontrola: kanonski ACTIVE → 200. |
| I06-T04 | O-27 (`procitajIstekleAktivne`) | isti | Za API-06 i za API-03 (SHOWER, nalog `30/50`): ACTIVE istekao sa `redeemedAt` → 500, 0 upisa, nijedan release; ACTIVE NEistekao sa `cancelledAt` → 500 (svaki ACTIVE iz upita se provjerava); kontrola kanonski → 200 `{1}` / 201. |
| I06-T05 | O-27 (O-16 retry; samo ako `i06/P-1` A) | isti | Issue → 201 (V); Admin SDK: V `status 'REDEEMED'` bez `redeemedAt` → retry istog `requestId` → 500, `upisi === []`; kontrola: V REDEEMED konzistentan → 200 sa `status 'REDEEMED'` (postojeći ugovor i04/P-1). |
| I06-T06 | O-8 (b), §20.2 | `jedinicni/zahtjevOtkupa.test.js` | `izracunajRequestKey('SIM01','POS-RDM-001') === 'aefc7b83dbd1da18def47c0a4965f0e3a40752420325c5a3427b6d47946be20e'`; `('SIM02', …) === 'e3ce68ad…61d2'`; dva poziva jednaka; različito od `('SIM01','POS-RDM-002')`; 64 mala hex; API-03 regresija: `izracunajRequestKey(uid, uuid)` = ručno izračunat SHA-256 `uid:uuid`. |
| I06-T07 | §20.1, O-1 | isti | `provjeriTijeloOtkupa` prihvata: `'A'`, 64 znaka, `'.'`, `'..'`, `'__x__'`, `'-_.'`, `'a.b-c_d'`, `'POS-RDM-001'`, objekat bez prototipa (`Object.create(null)`) sa ispravnim poljem; vraća NOVI objekat. Odbija (`INVALID_REQUEST`): 65 znakova, `''`, `'a:b'`, `'a/b'`, `'a b'`, `'š'`, `'𝟘'`, `'a\n'`, `5`, `null`, `true`, `[]`, `{}`, `undefined`, `'x'` (skalar), niz `['A']`, dodatno polje (`stationId`, `uid`, `voucherId`, `x`), `JSON.parse('{"__proto__":1,"redemptionRequestId":"A"}')`. |
| I06-T08 | §20.1, O-1, O-22, D-5, AC-04, i03/P-6, K-1 | `emulator/otkupVaucera.test.js` | Važeći ključ, omotač: tijela bez tijela, `Content-Length: 0`, `{}`, `[]`, `{"redemptionRequestId":5}`, `{"redemptionRequestId":"a:b"}`, 65 znakova, dodatno `stationId`/`uid`/`voucherId`, `text/plain` sa ispravnim JSON-om, `application/merge-patch+json` → 422, `brojPristupa === 0`. `null`, `"x"`, `5`, neispravan JSON BEZ ključa → 422. Putanja (ispravno tijelo): `%41`+63 hex (velika), 63/65 znakova, `a%2Fb`, `%00`+63 hex, `__x__`, Firebase UID oblik (28 znakova, AC-04), `..` → 404 `VOUCHER_NOT_FOUND`, `brojPristupa === 0`; `/pos/vouchers//redeem` → 404 `NOT_FOUND` (kao i05/P-12); `%E0%A4%A` → 404 `NOT_FOUND`; `GET`, `PUT` na rutu → 404 `NOT_FOUND`. Redoslijed: `{}` + neispravan voucherId → 422; `{}` bez ključa → 401. |
| I06-T09 | §3.4, NFR-02, i03/P-11, §6 (c) | isti | Bez `X-POS-API-Key`, prazan, pogrešan (iste dužine), kraći, duži, ključ u `Authorization` / query `?key=` → 401 `UNAUTHENTICATED_POS`, `brojPristupa === 0`, baza nepromijenjena. `stationId` iz query-ja (`?stationId=SIM02`) i zaglavlja `X-Station-Id: SIM02` sa ključem K1 → 200, `redeemedAtStationId 'SIM01'`, zapis `stationId 'SIM01'`, ključ = SHA-256(`SIM01:…`). Ključ K2 → `redeemedAtStationId 'SIM02'`. Aplikacija bez `posStanice` (i sa `[]`) → 500 bez stack-a. |
| I06-T10 | §27 `VOUCHER_NOT_FOUND` | isti | Ispravan format, ne postoji → 404 tačno, `upisi === []`, 0 zapisa. |
| I06-T11 | O-7, §20.4 | isti | Pripremljeno Admin SDK-om sa konzistentnim ledger-om: REDEEMED (`redeem_`, nalog `30/0`) → 409 `VOUCHER_ALREADY_REDEEMED`; CANCELLED (`release_`) → 409 `VOUCHER_CANCELLED`; EXPIRED (`release_`) → 409 `VOUCHER_EXPIRED`; CANCELLED sa prošlim `expiresAt` → `VOUCHER_CANCELLED`; REDEEMED sa prošlim `expiresAt` → `VOUCHER_ALREADY_REDEEMED`. Svuda `upisi === []`, `snimakBaze` `deepStrictEqual`, 0 zapisa. |
| I06-T12 | O-25, AUTH-03, AUTH-05 | isti | ACTIVE neistekao + `DELETION_IN_PROGRESS` → 409 `ACCOUNT_DELETION_IN_PROGRESS`; isto istekao (nema release-a, V ACTIVE); users ne postoji; users bez loyaltyAccounts; loyaltyAccounts bez users → 409 `ACCOUNT_NOT_INITIALIZED`; `accountStatus 'NEPOZNAT'`, `reservedPoints -1` / `'50'` → 500. REDEEMED / CANCELLED / EXPIRED + `DELETION_IN_PROGRESS` → 409 voucher koda. Retry uspješnog zahtjeva poslije prebacivanja naloga u `DELETION_IN_PROGRESS` → 200 isto tijelo (O-24); isto poslije brisanja `users` i poslije pomjeranja `expiresAt` u prošlost. Svuda `upisi === []`. |
| I06-T13 | O-24, O-8 (a) | isti | (a) Zapis za isti V nekonzistentan → 500, `upisi === []`: `stationId 'SIM02'` pod ključem SIM01; `redemptionRequestId` drugi; `resultStatus 'FAILED'`; `uid` prazan; dodatno polje; `voucherId` nije 64 hex; V ne postoji; V ACTIVE; V REDEEMED sa `redeemedAtStationId 'SIM02'`; `uid` V ≠ `uid` zapisa. (b) O-8 (a): ID `"POS-RDM-009"` → 409 za EXPIRED W1, → 409 za CANCELLED W2, → 404 za nepostojeći, → (§20.5) 409 za istekao ACTIVE W3: posle svakog 0 zapisa; zatim isti ID za ACTIVE V → 200 (zapis sa `voucherId V`). Invarijanta: #zapisa = #REDEEM = #REDEEMED. |
| I06-T14 | O-27, O-28, §5 nekonzistentno | isti | 500 bez stack-a, `upisi === []`, stanje `deepStrictEqual`: (a) O-27 za redeem: ACTIVE sa `redeemedAt` / `redeemedAtStationId` / `cancelledAt` / bez polja; REDEEMED bez `redeemedAt`; `costPoints 0`; `uid ''`. (b) `redeem_V` postoji a V ACTIVE; `release_V` postoji a V ACTIVE (neistekao i istekao). (c) `reservedPoints 20` uz V 50 (neistekao i istekao). (d) Zastarjelo čitanje (`sakrijPostojece`): `loyaltyLedger/redeem_V` pripremljen pa sakriven → 500 (`ALREADY_EXISTS`), `redeem_V` nepromijenjen, V ACTIVE; `redemptionRequests/<ključ>` (zapis za drugi voucher W) sakriven → 500, zapis nepromijenjen, V ACTIVE. |
| I06-T15 | NFR-04, AC-09 | `emulator/otkupAtomicnost.test.js` | Failure injection: (a) uspjeh — `baciNaUpisu` 1, 2, 3, 4 (putanje iz `upisi`: `vouchers/V`, `loyaltyLedger/redeem_V`, `loyaltyAccounts/uid`, `redemptionRequests/<ključ>`); (b) §20.5 — 1, 2, 3 (`vouchers/V`, `loyaltyLedger/release_V`, `loyaltyAccounts/uid`); (c) `baciPrijeCommita` za (a) i (b). Svaki → 500 bez `stack`, `    at `, `ubrizgana`, `C:\`, `tajno`; `snimakBaze` `deepStrictEqual` početnom. Kontrola: 200 / 409. |
| I06-T16 | §6 (b), §6 (c), NFR-05 | isti | (a) Kasni commit: `zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500` → 503 tačno; `await commitZavrsen` → V REDEEMED, 1 REDEEM, 1 zapis; retry istim ID-em (pravi `db`) → 200, tijelo iz sačuvanog; drugi retry identičan; i dalje 1/1. (b) Isto za §20.5 (commit poslije 503) → retry 409 `VOUCHER_EXPIRED`, 1 release, 0 zapisa. (c) Rok: `otkupiVaucer` sa `rokDo` ∈ { `Date.now() − 1`, `Date.now()`, `undefined`, `NaN` } → `SERVICE_UNAVAILABLE`, `brojTransakcija === 0`, `brojPristupa === 0`; kontrola `+10 000` → uspjeh. (d) `odbijTransakcijuSa: { code: 14 }` → 503, 0 upisa. |
| I06-T17 | §6 (j), i05/P-3 | isti | `prisiliPonovniPokusaj: 1`, mock `Date.now` samo za `/src/servisi/otkupVaucera.js`: čitanja `[0, 1, 2]` (ulaz + po pokušaju), vrijednosti `T0 + 10 000·n`; `expiresAt = T0 + 15 000` → pokušaj 1 bi otkupio, pokušaj 2 vidi istek → 409 `VOUCHER_EXPIRED`, V EXPIRED, 1 release, 0 REDEEM, 0 zapisa. Drugi slučaj (`expiresAt` daleko): `redeemedAt.toMillis() === T0 + 20 000` (sat iz POSLJEDNJEG pokušaja). |
| I06-T18 | NFR-06, AC-07, AC-08, O-26 — deterministički redoslijed (i05/K-1) | isti | Omotač `{ prisiliPonovniPokusaj: 1, prijePokusaja }`: pokušaj 1 čita, prisilni ABORTED; `prijePokusaja(2)` izvrši drugu operaciju DO KRAJA (pravi `db`), pa pokušaj 2 čita novo stanje. (a) redeem (SIM01) ← cancel → redeem 409 `VOUCHER_CANCELLED`, V CANCELLED, 1 release, 0 REDEEM, 0 zapisa, nalog `80/0`. (b) cancel ← redeem → cancel 409 `VOUCHER_ALREADY_REDEEMED`, V REDEEMED, 1 REDEEM, 0 release, nalog `30/0`. (c) redeem SIM01 `"A"` ← redeem SIM02 `"B"` → prvi 409 `VOUCHER_ALREADY_REDEEMED`, 1 REDEEM, 1 zapis (SIM02). (d) redeem `"A"` ← isti redeem `"A"` → oba 200, tijela `deepStrictEqual`, 1 REDEEM, 1 zapis. (e) istekao V: redeem ← API-06 → redeem 409 `VOUCHER_EXPIRED`, 1 release (od API-06), V EXPIRED; isto redeem ← issue SHOWER (reconcile V). (f) Zastarjeli nalog: V1 (50), V2 (30), nalog `0/80`; redeem V1 ← redeem V2 → oba 200, nalog `0/0`, REDEEM V1 `reservedAfter 0`, lanac uzastopan. (g) O-26: istekli W istog korisnika ostaje ACTIVE poslije redeem-a V (0 release za W). Kontrola: bez `prijePokusaja` → 200 / ishod bez druge operacije. Sve deterministički (1 izvršavanje po slučaju). |
| I06-T19 | NFR-06, AC-07, AC-08 — slobodna konkurentnost | isti | Omotač bez opcija, `sveTransakcijeZavrsene`, raspodjela u `t.diagnostic`; svaki ≥ 20 ponavljanja, svaki put novi korisnik; asercije važe za SVAKI redoslijed: (a) 10 identičnih redeem-a → statusi ⊆ {200, 503}, 0×500, sva 200 tijela identična; ako nijedan 200 → retry (≤ 20) daje 200; tačno 1 REDEEM, 1 zapis, nalog `30/0`. (b) redeem SIM01 × redeem SIM02 (različiti ID-evi) → statusi ⊆ {200, 409 `VOUCHER_ALREADY_REDEEMED`, 503}, ≤ 1×200, 0×500; poslije retry-ja 503 → tačno jedan 200; 1 REDEEM, 1 zapis. (c) redeem × cancel → tačno jedno od {V REDEEMED + 1 REDEEM + 1 zapis + nalog `30/0`, V CANCELLED + 1 release + 0 zapisa + nalog `80/0`}; gubitnik 409 (`VOUCHER_CANCELLED` / `VOUCHER_ALREADY_REDEEMED`) ili 503; 0×500. (d) istekao V: 3 redeem + 3 API-06 + 3 SHOWER issue (nalog `0/50`) → tačno 1 release V, V EXPIRED, 0 REDEEM, 0 zapisa, `available + reserved = 50`, lanac uzastopan; 0×500. (e) 3 ACTIVE voucher-a istog korisnika (50, 30, 30; nalog `0/110`) paralelno otkupljena (5 ponavljanja, 503 → retry) → nalog `0/0`, 3 REDEEM, 3 zapisa, lanac uzastopan. |
| I06-T20 | §7.2, §7.3–7.6, AC-09, O-8 (a) | isti | 250 sekvencijalnih nasumičnih operacija (seed `0x1606`, `mulberry32` u testu) nad jednim korisnikom: kupovina (0–60 bodova), issue (CAR_WASH/SHOWER), cancel, API-06, redeem (nasumičan sopstveni voucher bilo kog statusa, SIM01/SIM02, novi ili ponovljen ID), „istek” (Admin pomjera `expiresAt` ACTIVE voucher-a u prošlost). Poslije svake: `available ≥ 0`, `reserved ≥ 0`, `available + reserved = ΣEARN − Σcost(REDEEMED)`, `reserved = Σcost(ACTIVE)`, svaki voucher 1 RESERVE i ≤ 1 terminalni događaj (REDEEM xor RELEASE; = 1 za ne-ACTIVE), #REDEEM = #zapisa = #REDEEMED, lanac `availableAfter`/`reservedAfter` uzastopan; svi voucher-i O-27 konzistentni. Raspodjela operacija/ishoda u `t.diagnostic`. |
| I06-T21 | §3.4, §6 (h), D-3, O-18, O-19, NFR-07 | `emulator/logOtkupa.test.js` | (a) In-process, `presretniLog()`, sentinel-i: ishodi 200 (prvi i retry), 401 (ključ = sentinel), 404 formata (`__SENTINEL__`), 404 D-5, 404 nepostojeći, 409 ×6 kodova, 422 (tijelo sa sentinel `redemptionRequestId` neispravnog oblika i dodatnim poljem), 500 (failure injection i `ALREADY_EXISTS` na `redemptionRequests/<ključ>` i `redeem_V`), 503 (`code 14` i kasni commit). Spojeni log ne sadrži: K1, K2, sentinel-e, nijedan `voucherId`, `redemptionRequestId` (`POS-RDM-…`), oba `requestKey`-a, `uid`, `availablePoints`/`reservedPoints` vrijednosti; nijedan odgovor (tijelo + zaglavlja) ne sadrži `stack`, `    at `, `uid`, `requestKey`, `redemptionRequestId`, balance; zapisi pogođene rute imaju `putanja '/pos/vouchers/:voucherId/redeem'`, D-5/parser `(nepoznata ruta)`. (b) Spawn `src/pokreni.js` (po uzoru na `logBezPosKljuca`): redeem bez ključa, sa sentinel ključem, 404 formata, 422 → stdout+stderr bez sentinel-a i ključeva. |
| I06-T22 | §24, §25.9, §31, D-2, RULE-T12 | `firebase/tests/zahtjeviOtkupa.test.js` | Admin pripremi `redemptionRequests/k1` sa `uid: 'vlasnik'`: vlasnik (`auth.uid == 'vlasnik'`), drugi korisnik, neautentifikovan → `get`, `list` (i `where('uid','==','vlasnik')`), `create`, `update`, `delete` → DENY (`assertFails`). RULE-T01 … RULE-T12 netaknuti i zeleni. |
| I06-T23 | DoD inspekcije | — (sekcija 10) | `git grep` / `git diff` komande iz sekcije 10 sa očekivanim ishodom. |

Smoke (`provjera.ps1`, `i06/P-2`): `POST /api/v1/pos/vouchers/<'0'×64>/redeem` bez ključa, tijelo `{"redemptionRequestId":"SMOKE1"}` → 401 `UNAUTHENTICATED_POS`.

Regresija: i01–i05 suite bez izmjene ijednog postojećeg test fajla (izuzetak samo `omotacBaze.js`: nova opcija; postojeće opcije i ponašanje bez
opcija identični); RULE-T01 … RULE-T12; Android kroz `provjera.ps1`.

## 9. Kontrolne mutacije (lokalno, bez commit-a, svaka pa `git restore`; O-29 (b))

D = deterministička (ciljani test ne zavisi od tajminga ni redoslijeda transakcija) → 1/1, ciljani test mora pasti. K = konkurentna → 10/10 (svaki run
pada). Pokretanje: `npm run test:emu:ciljano -- <fajl> --test-name-pattern=<ID>` ili `npm test` za jedinične. Preživjela → dopuna testa, commit
`i06: ojačan test … (nalaz mutacije Mnn)`, odstupanje OD-n. Obrazloženje D: svi D ciljevi su sekvencijalni zahtjevi ili I06-T18 (redoslijed nametnut
`prijePokusaja`), pa ishod ne zavisi od rasporeda.

| # | Mutacija (tačna izmjena) | D/K | Ciljani test | Očekivano |
|---|---|---|---|---|
| M01 | T4: uklonjena provjera statusa (REDEEMED/CANCELLED/EXPIRED idu dalje) | D | API-T09 (c), I06-T11 | 1/1 |
| M02 | `tx.create` → `tx.set` za `redeem_` | D | I06-T14 (d) (sakriven `redeem_` → ne pada) | 1/1 |
| M03 | `tx.create` → `tx.set` za zapis | D | I06-T14 (d) (sakriven zapis) | 1/1 |
| M04 | T6 uklonjen (bez provjere `redeem_`/`release_`) | D | I06-T14 (b) (`upisi === []`) | 1/1 |
| M05 | T2 premješten iza T4 (mapping poslije statusa) | D | API-T09 (a) (retry → 409) | 1/1 |
| M06 | zapis za drugi voucher → nastavlja (bez 409) | D | API-T09 (b) | 1/1 |
| M07 | `requestKey` bez `stationId` (`izracunajRequestKey('', id)`) | D | API-T08 (ključ dokumenta), API-T09 (d) | 1/1 |
| M08 | `requestKey` = doslovan `redemptionRequestId` | D | API-T08 (ID dokumenta `aefc7b83…`) | 1/1 |
| M09 | zapis se pravi i u §20.5 grani | D | API-T10 (0 zapisa) | 1/1 |
| M10 | zapis se pravi pri 409: CANCELLED / EXPIRED grana radi `tx.create(refZapis, …)` i vraća ishod koji se poslije commit-a pretvara u 409 | D | I06-T13 (b) | 1/1 |
| M11 | `availablePoints` se upisuje kao `dostupno − cost` | D | API-T08 | 1/1 |
| M12 | `reservedPoints` se ne smanjuje | D | API-T08 | 1/1 |
| M13 | `deltaReserved: +cost`; zasebno M13b `deltaAvailable: −cost` | D | API-T08 | 1/1 svaka |
| M14 | `redeemedAtStationId: req.body?.stationId ?? 'SIM01'` (ne iz `res.locals`) — ruta | D | I06-T09 (SIM02 ključ) | 1/1 |
| M15 | `redeemedAt` se ne postavlja | D | API-T08 | 1/1 |
| M16 | `cancelledAt: Timestamp.fromMillis(sadaMs)` dodat u izmjenu redeem-a | D | API-T08 | 1/1 |
| M17 | `jeIstekao`: `>` umjesto `>=` | D | API-T10 (granica `sadaMs === expiresAt`) | 1/1 |
| M18 | §20.5 grana baca `GreskaApi('VOUCHER_EXPIRED')` u callback-u (rollback release-a) | D | API-T10 | 1/1 |
| M19 | §20.5 grana postavlja REDEEMED (izmjena `status: 'REDEEMED'`) | D | API-T10 | 1/1 |
| M20 | CANCELLED → `VOUCHER_EXPIRED`; zasebno M20b CANCELLED → `VOUCHER_NOT_FOUND` | D | I06-T11 | 1/1 svaka |
| M21 | EXPIRED → `VOUCHER_ALREADY_REDEEMED` | D | I06-T11 | 1/1 |
| M22 | rok prije statusa (istek provjeren prije T4: CANCELLED sa prošlim rokom → EXPIRED) | D | I06-T11 (CANCELLED + prošao rok) | 1/1 |
| M23 | `DELETION_IN_PROGRESS` provjera uklonjena (u `procitajStanjeNaloga`) | D | I06-T12 | 1/1 |
| M24 | T5 (nalog) prije T4 (krši O-25) | D | I06-T12 (REDEEMED + DELETION → 409 voucher koda) | 1/1 |
| M25 | T5 prije T2 (nalog prije mapping-a) | D | I06-T12 (retry + DELETION → 200) | 1/1 |
| M26 | voucher čitan VAN transakcije (`refVaucer.get()` prije `runTransaction`, u tx samo zapis) | D | I06-T18 (a) | 1/1 |
| M27 | loyaltyAccounts čitan VAN transakcije | D | I06-T18 (f) | 1/1 |
| M28 | `sadaMs = Date.now()` prije `runTransaction` | D | I06-T17 | 1/1 |
| M29 | uklonjena provjera roka prije transakcije | D | I06-T16 (c) | 1/1 |
| M30 | O-27 uklonjena iz redeem-a (T3 bez `jeKonzistentnoStanjeVaucera`) | D | I06-T14 (a) | 1/1 |
| M31 | O-27 uklonjena iz cancel-a (vraćeno `jeIspravanSacuvaniVaucer \|\| rewardId`) | D | I06-T03 | 1/1 |
| M32 | O-27 uklonjena iz `procitajIstekleAktivne` | D | I06-T04 | 1/1 |
| M33 | O-27 uklonjena iz O-16 retry-ja (samo ako `i06/P-1` A) | D | I06-T05 | 1/1 |
| M34 | O-27: ACTIVE grana bez provjere `redeemedAtStationId`; zasebno M34b polja „izostavljeno = null” (`== null`) | D | I06-T02 | 1/1 svaka |
| M35 | redeem oslobađa druge istekle voucher-e (dodat `procitajIstekleAktivne` + release, krši O-26) | D | I06-T18 (g) | 1/1 |
| M36 | `uid` zapisa / ledger-a / naloga iz konstantnog ili `stationId`-a umjesto `v.uid` (`uid: stationId`) | D | API-T08 | 1/1 |
| M37 | POS posrednik na prefiksu (`ruter.use('/pos/vouchers', provjera)`) | D | I06-T08 (`GET` bez ključa → 401 umjesto 404) | 1/1 |
| M38 | ruta bez posrednika (stationId `'SIM01'` konstanta) | D | I06-T09 | 1/1 |
| M39 | regex bez sidara; M39b sa zastavicom `i` i `[a-z0-9…]`; M39c `{1,}` umjesto `{1,64}` | D | I06-T07 | 1/1 svaka |
| M40 | `voucherId` u poruci (`new Error(\`… ${voucherId}\`)`); M40b `redemptionRequestId` u `console.error` | D | I05-T02, I06-T21 | 1/1 svaka |
| M41 | Rules: `allow read: if signedIn();` u bloku `redemptionRequests` | D | I06-T22 | 1/1 |
| M42 | retry vraća tijelo iz zapisa umjesto iz voucher-a (`redeemedAt` iz `z.createdAt`) | D | API-T09 (a) (identično tijelo) | 1/1 |
| M43 | T2: uklonjena provjera `redeemedAtStationId === stationId` / `uid` jednak | D | I06-T13 (a) | 1/1 |
| M44 | upis naloga prije voucher-a (redoslijed upisa 3,1,2,4) | D | I06-T15 (putanje upisa) | 1/1 |
| M45 | status provjeravan VAN transakcije (pre-čitanje voucher-a; u tx samo nalog i upisi, bez ponovne provjere statusa) | K | I06-T19 (b) (20 ponavljanja; preklapanje dva redeem-a nije zagarantovano u svakom ponavljanju, ali u 20 ponavljanja jeste praktično uvijek) | 10/10 |

Ukupno: 45 oznaka (+ varijante b/c: 8) = 53 izvršavanja; D 52 (M33 samo uz P-1 A), K 1.
Napomena: M26/M27 su po brief-u bile prirodno K; zahvaljujući `prijePokusaja` (3.2 P-d) su D.

## 10. Definition of Done (komande iz korijena, PowerShell)

- [ ] Sekcija 1 implementirana; sekcija 2 ne: `git grep -n -i -E "tx\.get\(.*where|reconcile" -- backend/src/servisi/otkupVaucera.js` → prazno.
- [ ] `git grep -n "release_" -- backend/src` → samo `servisi/oslobadjanjeVaucera.js`; `git grep -n "redeem_" -- backend/src` → samo `servisi/otkupVaucera.js`;
      `git grep -n -E "REWARD_REDEEM|redemptionRequests" -- backend/src` → `servisi/otkupVaucera.js` i `podaci/kolekcije.js`.
- [ ] O-27: `git grep -n "jeKonzistentnoStanjeVaucera" -- backend/src` → definicija + redeem, cancel, `oslobadjanjeVaucera.js` (+ `izdavanjeNagrade.js` ako P-1 A).
- [ ] `cd backend; npm ci; npm test; npm run test:emu; cd ..` → svi PASS; `cd firebase\tests; npm ci; npm test; cd ..\..` → svi PASS.
- [ ] `cd backend; npm run test:emu:ciljano -- test/emulator/otkupVaucera.test.js; cd ..` → exit 0 (i sa dva fajla, i sa `--test-name-pattern`).
- [ ] `git diff i05 -- backend/test` → samo novi fajlovi i `pomocnici/omotacBaze.js` (nova opcija).
- [ ] `git diff i05 -- firebase/firestore.rules` → samo blok `redemptionRequests`; `git diff i05 -- firebase/firestore.indexes.json` prazno.
- [ ] `git diff i05 -- backend/package.json` → samo `test:emu:ciljano`; `git diff i05 -- backend/package-lock.json firebase/tests/package*.json` prazno.
- [ ] `git grep -n -i -E "process\.env\.(NODE_ENV|TEST)|inject|ubriz|mock" -- backend/src` → prazno; nema TODO/FIXME.
- [ ] I06-T15 (failure injection), I06-T18, I06-T19 (≥ 20 ponavljanja, raspodjela u TEST_REPORT, 0×500), I06-T16 (kasni commit) zeleni.
- [ ] Mutacije M01 … M45 po O-29 (b), tabela jedan red po mutaciji (O-29 (e)).
- [ ] `.\skripte\provjera.ps1; $LASTEXITCODE` → 0 poslije svakog koraka (1–7, 9) sa novim smoke-om.
- [ ] `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` → `7D86…0228`; `git diff main -- docs/srs` prazno.
- [ ] Dokumentacija: TRACEABILITY (sekcija 12), IMPLEMENTATION_LOG (unos i06, status `i06/P-n`, ograničenja i07+, R-06 „Ispravka (i06)”),
      TEST_REPORT (O-29 (e)), ODLUKE (O-7, O-8, O-24 … O-29, `i06/P-n`, nova ograničenja, §9 O-7/O-8 zatvoreni, §6 (t) zatvoren, §10 O-29,
      §1 stanje: i05 ACCEPTED sa tagom `i05`, i06 u toku), README (API-04, primjer PowerShell zahtjeva, O-8 (a) posljedica, `i06/P-4`, `test:emu:ciljano`).
- [ ] Commit-i bez potpisa alata, svaki push-ovan; PR otvoren bez merge-a i taga.

## 11. Rizici i poznata ograničenja

- **Kontencija**: redeem čita samo dokumente (bez upita), pa nema B-2 efekta; 503 pod kontencijom istog voucher-a/naloga je moguć (R-04) — retry je bezbjedan
  (zapis ili terminalno stanje).
- **Emulator ≠ produkcija** (brave, poruke grešaka) — kao §7.
- **O-8 (a) posljedica**: ID neuspješnog pokušaja može se kasnije upotrijebiti za drugi voucher (README).
- **`i06/P-4`**: dupli ključ u JSON-u — posljednji pobjeđuje (JSON.parse), neotkrivo bez sopstvenog parsera.
- **Novo ograničenje za i07 (prijedlog (u))**: brisanje naloga uklanja voucher-e i `redemptionRequests` (§23.2); retry otkupa koji naiđe na zapis bez
  voucher-a daje 500 (O-24) — i07 određuje redoslijed brisanja (analogno (f)/(m)).
- **Ledger `createdAt` vs `redeemedAt`**: `redeemedAt` po satu Backend-a, `createdAt` po Firestore-u (kao i05/P-3).
- **Trajanje**: `provjera.ps1` poslije svakog koraka čini ~40 % Builder faze; prekinut run se ponavlja (O-29 (a)).
- **`prijePokusaja`** zavisi od toga da Admin SDK poništi pokušaj prije ponavljanja (potvrđeno probom P-d nad emulatorom); ako se ponašanje promijeni sa
  verzijom SDK-a, I06-T18 pada glasno (kontrola u testu), ne prolazi lažno.

## 12. TRACEABILITY redovi (Builder popunjava „Kod”, „Status”, „Planirani test”)

| Red | Kod | Test |
|---|---|---|
| §3.4 (i06 dio), NFR-02 | `rute/otkupVaucera.js`, `posrednici/posAutentikacija.js` | I06-T09, I06-T21 |
| §7.5 REDEEM | `servisi/otkupVaucera.js` | API-T08, I06-T20 |
| §7.6 RELEASE (redeem dio) | `servisi/otkupVaucera.js` → `oslobadjanjeVaucera.js` | API-T10, I06-T15 (b) |
| §11 REWARD_REDEEM | `servisi/otkupVaucera.js` | API-T08, I06-T14, I06-T20 |
| §15 / §16 (REDEEMED, O-27) | `servisi/vauceri.js`, `otkupVaucera.js` | API-T08, I06-T02 … I06-T05 |
| §18 (redeem dio), O-26 | `servisi/otkupVaucera.js` | API-T10, I06-T18 (g) |
| §20, §20.1 … §20.5 | `validacija/zahtjevOtkupa.js`, `servisi/otkupVaucera.js` | API-T08 … API-T10, I06-T07, I06-T11, I06-T13 |
| §24 / §25.9 / §31 redemptionRequests | `firebase/firestore.rules` | RULE-T12, I06-T22 |
| §26 API-04 | `rute/otkupVaucera.js`, `aplikacija.js` | API-T08, smoke |
| §27 (nova upotreba: `VOUCHER_CANCELLED`, `UNAUTHENTICATED_POS` na API-04, `IDEMPOTENCY_CONFLICT`) | `greske/katalogGresaka.js` (postojeći) | I06-T08 … I06-T13 |
| QR / AC-04 (backend) | `validacija/zahtjevVaucera.js` | I06-T08 |
| NFR-04 | `servisi/otkupVaucera.js` | I06-T15 |
| NFR-05 | isto | API-T09, I06-T16, I06-T18 (d) |
| NFR-06, AC-07 | isto | I06-T18, I06-T19 |
| AC-08 | isto | API-T10, I06-T18 (e), I06-T19 (d) |
| AC-09 | isto | API-T08, API-T10, I06-T20 |
| O-1 tabela: `INVALID_REQUEST` za `redemptionRequestId` | `validacija/zahtjevOtkupa.js` | I06-T07, I06-T08 |

## 13. Otvorena pitanja (`i06/P-n`)

- **i06/P-1 — O-27 i O-16 retry API-03.** SRS §15 / ODLUKE §5; brief O-27 navodi obavezne korisnike redeem, cancel i `procitajIstekleAktivne`, a tačka 3
  dozvoljava O-27 promjenu ponašanja API-01 … API-06. Nejasno: da li i O-16 retry grana (`izdavanjeNagrade.js`, čita voucher i vraća ga) mora koristiti
  O-27. Opcije: (A) da — jedna definicija na svakom mjestu gdje se čita sačuvani voucher; nedostižno kroz API; + I06-T05, M33; (B) ne — retry samo čita,
  ne mijenja stanje, ostaje `jeIspravanSacuvaniVaucer`. **Preporuka: A** (O-23 cilj „jedna provjera stanja”; trošak 1 test + 1 mutacija, fiksture nepromijenjene po P-a).
- **i06/P-2 — smoke u `provjera.ps1` vs „provjera.ps1 nepromijenjen”.** Brief tačka 6 traži novi smoke (redeem bez ključa → 401) u `provjera.ps1`, a ista
  tačka i O-29 (c) kažu „test:emu i provjera.ps1 nepromijenjeni”. Opcije: (A) dodati SAMO smoke red (kao i03–i05), „nepromijenjen” se odnosi na O-29 (c)
  mehanizam (ciljani run ne ulazi u `provjera.ps1`); (B) bez smoke-a. **Preporuka: A.** Plan je napisan po A.
- **i06/P-3 — poredak unutar O-24.** §20.2 / O-24 ne kažu da li strukturna nekonzistentnost zapisa (npr. `resultStatus ≠ "REDEEMED"`) ima prednost nad 409
  `IDEMPOTENCY_CONFLICT` kad je `voucherId` drugi. Opcije: (A) zapis mora odgovarati svom ključu i biti ispravan (500) PRIJE poređenja `voucherId`-a (kao O-16:
  mapping ↔ ključ prvo), konzistentnost VOUCHER-a samo za isti voucher; (B) prvo poređenje `voucherId`-a (409), pa ostalo. **Preporuka: A.**
- **i06/P-4 — dupli ključ u JSON tijelu** (informativno, P-b): `{"redemptionRequestId":"A","redemptionRequestId":"B"}` → otkup sa `"B"`. §20.1 ne pominje;
  otkrivanje traži sopstveni parser (novi kod/paket, van opsega). **Preporuka:** prihvatiti, upisati u README i poznata ograničenja.
- **i06/P-5 — položaj provjere `redeem_`/`release_` (O-25 ciljni redoslijed).** Brief stavlja „redeem_ ili release_ već postoji” poslije isteka; plan je
  stavlja neposredno prije grananja na istek (važi za obje grane: ACTIVE sa bilo kojim terminalnim događajem je nekonzistentan; u §20.5 grani i `redeem_`
  → 500). Ishod je u svim slučajevima 500 bez upisa; razlika je samo da §20.5 grana dodatno odbija postojeći `redeem_`. **Preporuka: odobriti** (strože, nedostižno kroz API).
- **i06/P-6 — ugovor odgovora API-04** (sekcija 6). **Preporuka:** usvojiti preporuku brief-a bez izmjene.
- **i06/P-7 — test-only proširenje `omotacBaze.prijePokusaja`** (3.2 P-d): jedina deterministička tehnika za redeem × cancel / redeem × redeem / zastarjeli
  nalog bez kontencije; brief ga dozvoljava. **Preporuka: odobriti.**
- **i06/P-8 — oblik `test:emu:ciljano`** (5.10): Node skripta, pokreće `firebase-tools` JS ulaz kroz `process.execPath` (bez shell-a), bijela lista putanja
  `test/emulator/*.test.js` i opcioni `--test-name-pattern`. **Preporuka: odobriti.**
- **i06/P-9 — novo ograničenje (u) za i07** (sekcija 11): zapis bez voucher-a poslije brisanja naloga → 500 na retry-ju. **Preporuka:** upisati u ODLUKE §6 kao (u).

SRS kontradikcija koja blokira rad: nije nađena.

## 14. Odluke Orchestrator-a (odobrenje plana)

