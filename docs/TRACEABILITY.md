# FuelPoints — matrica sljedivosti (SRS 3.1 → kod → test)

Normativni izvor: `docs/srs/FuelPoints_SRS_3_1.docx` (SHA-256 `7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228`).
Čitljiva kopija: `docs/srs/FuelPoints_SRS_3_1.md` (nije normativna).

Pravila vođenja:

- Kolonu **Kod** popunjava Builder kad implementira stavku (putanja fajla / modul / funkcija).
- **Status**: `PLANIRANO` → `IMPLEMENTIRANO` → `PASS` (samo nakon stvarnog izvršavanja testa, sa referencom na `TEST_REPORT.md`).
- Testovi iz SRS kataloga zadržavaju SRS oznake (`API-Txx`, `RULE-Txx`, `AC-xx`). Dopunski testovi koje SRS ne imenuje dobijaju oznaku `I<iteracija>-T<broj>` (npr. `I03-T05`).
- Numerisane liste u SRS §13.2, §19.1, §20.3 i §23.1 u .docx-u nastavljaju numeraciju (6., 11., 16., 22.); ovdje se referišu kao koraci 1–n. SRS se ne mijenja.

## Tehnička dopuna kataloga grešaka (van §27, odobrila Ana — odluka O-1)

| Kod | HTTP | Upotreba |
|---|---|---|
| NOT_FOUND | 404 | nepoznata ruta ili nepodržan HTTP metod |
| INVALID_REQUEST | 422 | neispravan JSON body; nevalidan `requestId` (§13), `redemptionRequestId` (§20.1), `acceptedTermsVersion` (API-01) |

## Matrica

| ID | SRS zahtjev | Iteracija | Kod | Planirani test | Status |
|---|---|---|---|---|---|
| §1.3, §22 | Van opsega (uklj. FCM — ne radimo) | sve | — | Reviewer scope provjera | PLANIRANO |
| §1.5 | earnedPoints = floor(volumeMl / 1000) | 3 | | API-T02; I03 dopunski (900→0, 10 000→10, 10 990→10) | PLANIRANO |
| §2.1, §34.1 | Obavezne komponente | 1 | | I01 bootstrap testovi | PLANIRANO |
| §2.2, §3.2 | Android ne mijenja kritično loyalty stanje | 2–8 | | RULE-T05, T07, T08, T09, T11; AC-02 | PLANIRANO |
| §2.3 | Node.js 24 LTS + Express + Admin SDK, lokalni proces | 1 | | I01-T07 | PLANIRANO |
| §2.4 | Emulator Suite; testovi bez production projekta | 1 | | I01-T07, I01-T09 | PLANIRANO |
| §2.5 | POS Simulator (kostur → HTML forme) | 1, 11 | | AC scenario (it. 11) | PLANIRANO |
| §2.6 | Android samo generiše QR, nema skenera | 9 | | inspekcija | PLANIRANO |
| §3.3 | Bearer Firebase ID token; UID samo iz tokena | 2 | | API-T01; I02 negativni (bez tokena, nevažeći token, uid u body-ju) | PLANIRANO |
| §3.4 | X-POS-API-Key → stationId; stationId nikad iz body-ja; ključ se ne loguje | 3, 6 | | I03/I06 negativni POS testovi | PLANIRANO |
| §3.5 | Auth e-mail/password, Email Enumeration Protection, generička poruka | 9 | | ručna provjera konzole + UI provjera | PLANIRANO |
| §3.6 | Password policy (8, veliko slovo, cifra; Require) | 9, 10 | | Android unit test validacije + ručna provjera | PLANIRANO |
| UI-01 – UI-04 | Login, Registration, Home, Customer QR | 9 | | NFR-09 smoke | PLANIRANO |
| UI-05 – UI-08 | Purchases, Rewards, Notifications, Settings/Help | 10 | | NFR-09 smoke | PLANIRANO |
| AUTH-01 | Registracija → /account/init | 2 (API), 9 (Android) | | API-T01; AC-01 | PLANIRANO |
| AUTH-02 | init: users + loyaltyAccounts u jednoj transakciji, 0/0 | 2 | | API-T01; I02 failure injection (nijedan dokument) | PLANIRANO |
| AUTH-03 | NOT_INITIALIZED (logičko stanje) | 2, 9 | | I02 ACCOUNT_NOT_INITIALIZED | PLANIRANO |
| AUTH-04, AUTH-05 | ACTIVE / DELETION_IN_PROGRESS, blokada mutacija | 2, 7 | | API-T12; I07 blokade | PLANIRANO |
| AUTH-06 | Session restore | 9 | | AC-01 | PLANIRANO |
| AUTH-07 | Logout | 10 | | AC-01 | PLANIRANO |
| AUTH-08 | Promjena lozinke (recent reauth) | 10 | | smoke | PLANIRANO |
| AUTH-09 | Password reset preko Firebase-a | 9 | | smoke | PLANIRANO |
| AUTH-10 | Uslovi upisani pri init-u | 2 | | API-T01 | PLANIRANO |
| QR-01 – QR-06 | Customer QR = UID, lokalno, samo uz sesiju, nije voucher | 9 (+6) | | AC-04; I06 UID kao voucherId → VOUCHER_NOT_FOUND | PLANIRANO |
| §7.1, §7.2 | loyaltyAccount schema; invarijante ≥ 0 | 2–7 | | asercija invarijanti u svakom API testu | PLANIRANO |
| §7.3 | EARN | 3 | | API-T02 | PLANIRANO |
| §7.4 | RESERVE | 4 | | API-T06 | PLANIRANO |
| §7.5 | REDEEM | 6 | | API-T08 | PLANIRANO |
| §7.6 | RELEASE | 4 (interno), 5, 6 | | API-T10, API-T11 | PLANIRANO |
| §8.1, §8.2 | Purchase ID {stationId}__{posTransactionId}, validacija | 3 | | API-T03; I03 INVALID_TRANSACTION_ID | PLANIRANO |
| §8.3 – §8.5 | Purchase schema, POS validacija, server-derived polja | 3 | | API-T04; I03 stationId/earnedPoints iz body-ja ignorisani | PLANIRANO |
| §9 | Jedna transakcija: purchase + balance + EARN + notifikacija earn_{purchaseId} | 3 | | API-T02; I03 failure injection | PLANIRANO |
| §10 | Idempotencija kupovine; 409 IDEMPOTENCY_CONFLICT | 3 | | API-T03, API-T04; I03 paralelni identični zahtjevi | PLANIRANO |
| §11 | Immutable ledger | 3–7 | | AC-09 asercije u API testovima; RULE-T11 | PLANIRANO |
| §12 | rewardDefinitions (CAR_WASH 50, SHOWER 30) | 1 (seed), 4, 10 | | I01-T08; API-T05 | PLANIRANO |
| §13 | Reward issue + preduslovi | 4 | | API-T05, API-T06 | PLANIRANO |
| §14 | rewardRequests, SHA-256(uid:requestId), 409 za drugi reward | 4 | | API-T06; I04 konflikt | PLANIRANO |
| §15 | voucherId opaque, ≥ 128 bita, samo Backend | 4 | | I04 format/entropija ID-a | PLANIRANO |
| §16 | State machine, terminalna stanja | 5, 6 | | API-T09, API-T11; I05 prelazi | PLANIRANO |
| §17 | expiresAt = issuedAt + 15 min (server) | 4, 5 | | I04 expiresAt | PLANIRANO |
| §18 | Lazy reconciliation (interno prije issue-a; API-06) | 4, 5 | | I04 reconcile prije issue-a; I05 reconcile jednom | PLANIRANO |
| §19 | Cancel, state-idempotent | 5 | | API-T11 | PLANIRANO |
| §20 | Redemption, redemptionRequests, istekao ACTIVE | 6 | | API-T08, API-T09, API-T10 | PLANIRANO |
| §21 | In-app notifikacije, readAt, do 50 | 3, 8, 10 | | API-T02; RULE-T10 | PLANIRANO |
| §23 | Account deletion, pseudonimizacija, Auth posljednji, resume | 7 | | API-T12; I07 resume; I07 REAUTHENTICATION_REQUIRED | PLANIRANO |
| §24 | 9 kanonskih kolekcija | 1 (konstante), 2–7 | | RULE-T12 | PLANIRANO |
| §25, §31 | Security policy / normativna pravila | 1 (default deny), 2–7, 8 | | RULE-T01 – RULE-T12 | PLANIRANO |
| §26 API-01 | POST /account/init | 2 | | API-T01 | PLANIRANO |
| §26 API-02 | POST /pos/purchases | 3 | | API-T02 – API-T04 | PLANIRANO |
| §26 API-03 | POST /rewards/{rewardId}/issue | 4 | | API-T05 – API-T07 | PLANIRANO |
| §26 API-04 | POST /pos/vouchers/{voucherId}/redeem | 6 | | API-T08 – API-T10 | PLANIRANO |
| §26 API-05 | POST /vouchers/{voucherId}/cancel | 5 | | API-T11 | PLANIRANO |
| §26 API-06 | POST /account/vouchers/reconcile | 5 | | I05 reconcile testovi | PLANIRANO |
| §26 API-07 | DELETE /account | 7 | | API-T12 | PLANIRANO |
| §27 | Error body, katalog, bez stack trace-a | 1 (+ svaka) | | I01-T01 – I01-T05 | PLANIRANO |
| NFR-01 | Verifikacija ID tokena | 2 | | I02 negativni token testovi | PLANIRANO |
| NFR-02 | POS key obavezan | 3, 6 | | I03/I06 negativni POS testovi | PLANIRANO |
| NFR-03 | Default deny, owner isolation | 1, 8 | | RULE-T01 – RULE-T12 | PLANIRANO |
| NFR-04 | Atomičnost | 2–7 | | failure injection testovi | PLANIRANO |
| NFR-05 | Idempotencija purchase/issue/redemption | 3, 4, 6 | | API-T03, API-T06, API-T09 | PLANIRANO |
| NFR-06 | Concurrency / double-spend | 4 (+6) | | API-T07; I06 paralelni redeem | PLANIRANO |
| NFR-07 | Secrets van APK-a, repoa i logova | 1 (+ svaka) | | inspekcija (git ls-files, grep) | PLANIRANO |
| NFR-08 | Stale/offline marker (isFromCache) | 9 | | offline test | PLANIRANO |
| NFR-09 | Smoke na API 26 i API 35 | 10, 11 | | smoke protokol | PLANIRANO |
| NFR-10 | Touch target ≥ 48×48 dp, contentDescription | 9, 10 | | UI inspekcija | PLANIRANO |
| AC-01 | Registracija, prijava, restore, odjava | 9, 10 → 11 | | smoke + scenario | PLANIRANO |
| AC-02 | Android ne može povećati bodove | 2–8 | | RULE-T07 i ostali write DENY | PLANIRANO |
| AC-03 | 42,730 l → 42 boda tačno jednom | 3 | | API-T02, API-T03 | PLANIRANO |
| AC-04 | Customer QR = UID, nije voucher | 9, 6 | | I06 UID kao voucherId | PLANIRANO |
| AC-05 | Issue rezerviše atomski | 4 | | API-T06 + failure injection | PLANIRANO |
| AC-06 | Konkurentni zahtjevi ne troše iste bodove | 4 | | API-T07 | PLANIRANO |
| AC-07 | Redeem najviše jednom | 6 | | API-T08, API-T09 | PLANIRANO |
| AC-08 | Istekao/otkazan vraća bodove najviše jednom | 5, 6 | | API-T10, API-T11 | PLANIRANO |
| AC-09 | Ledger event za svaku mutaciju | 3–7 | | ledger asercije | PLANIRANO |
| AC-10 | Notifikacija atomski sa kupovinom | 3 | | API-T02 + failure injection | PLANIRANO |
| AC-11 | Brisanje → uid = null u purchases i ledger | 7 | | API-T12 | PLANIRANO |
| AC-12 | 12/12 API + 12/12 Rules | 7, 8 → 11 | | kompletna suita | PLANIRANO |
