# i07 — ADVERSARIAL REVIEW (Brisanje naloga, API-07)

Uloga: REVIEWER, 2026-10-19. Režim: ekspresni (O-30, O-31). Kod i testovi nisu mijenjani.

## 1 Polazno stanje

| Stavka | Rezultat |
|---|---|
| Grana / vrh H | `iteracija-07`, H = `1f22be1`; PR #7 OPEN |
| Završni `provjera.ps1` (TEST_REPORT i07, run 2) | kod = `74c4227`, exit 0, emulator `193 / 193` |
| `git diff --stat 74c4227 1f22be1` | samo `README.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/ODLUKE.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md` → O-31 (a): `provjera.ps1` se NE ponavlja |
| SHA-256 `docs/srs/FuelPoints_SRS_3_1.docx` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` ✔ |
| `git diff i06 -- docs/srs firebase/firestore.rules` | prazno ✔ (i `firebase/`, `backend/package.json`, `package-lock.json`) |
| Emulator run | JDK 24 prvi na PATH-u; portovi 8080 i 9099 slobodni prije i poslije svakog run-a |

## 2 Pregled po stavkama

| # | Stavka | Ocjena | Referenca |
|---|---|---|---|
| 1 | Redoslijed K1 → K3 → K4a (`rewardRequests`, `redemptionRequests` prije `notifications`, `vouchers`, pa `loyaltyAccounts`) → K5 → K4b → K6 | ✔ | `servisi/brisanjeNaloga.js` `obrisiNalog`, `PRIVATNE_KOLEKCIJE`; O-32, §23.1 |
| 2 | Idempotentnost koraka: K1 preskače DELETION_IN_PROGRESS i nepostojeći users; K3 bez ACTIVE → ništa; K4a/K5 upit → paket dok upit nije prazan; K4b nepostojeći → ništa; K6 `auth/user-not-found` = obrisan | ✔ | §23.4, O-36; N4 |
| 3 | O-35: `Date.now() ≤ auth_time·1000 + 300 000` uključivo; `Number.isSafeInteger` i `≥ 0` inače 409 (fail closed); bez pristupa bazi | ✔ | `posrednici/svjezinaPrijave.js`; N1 |
| 4 | Redoslijed 422 JSON → 401 → 422 tijelo → 409 → tok | ✔ | `rute/brisanjeNaloga.js` (globalni parser, token, `provjeriPraznoTijelo`, svježina); N9 |
| 5 | `izloziAuthTime` samo na `DELETE /account` | ✔ | `git grep izloziAuthTime` → `autentikacija.js`, `rute/brisanjeNaloga.js` |
| 6 | O-9 / O-34 kroz `oslobadjanjeVaucera.js` (`procitajAktivneZaZatvaranje`, `pripremiOslobadjanja`, `upisiOslobadjanja`); istekao → EXPIRED, inače CANCELLED + `cancelledAt`; `release_` u kodu samo `oslobadjanjeVaucera.js:13` | ✔ | O-9, O-34, §18.1, §19.1 |
| 7 | O-34b: users ne postoji → nastavak, nikad `ACCOUNT_NOT_INITIALIZED`; 204 bez tijela i bez `Content-Type` | ✔ | N6; API-T12 |
| 8 | O-10a samo za `postojeca.uid === null`; ostala poređenja (§10.3, O-3) i redoslijed (postojeći purchase prije provjere naloga) nepromijenjeni | ✔ | `evidencijaKupovine.js:57–64`; N8 |
| 9 | OD-4 (`loyaltyAccounts` se briše samo ako postoji) — isto konačno stanje kao bezuslovno brisanje (brisanje nepostojećeg je no-op); razlika samo u broju upisa | ✔ | IMPLEMENTATION_LOG i07 OD-4 |
| 10 | Nema test-only koda u `src/` (`process.env.NODE_ENV/TEST`, `TODO`, `FIXME` → prazno); nema novih paketa; Rules netaknute | ✔ | inspekcije, sekcija 1 |
| 11 | `git diff i06 --name-status -- backend/test`: samo `A` (6 test fajlova, `omotacAutha.js`, `pripremaBrisanja.js`) i `M pomocnici/omotacBaze.js` (bez opcija ponašanje identično i06: servisi i01–i06 ne koriste `batch`) | ✔ | |
| 12 | Mutacije D01 … D11, D07b, D11b u TEST_REPORT, sve ubijene | ✔ | TEST_REPORT i07 |
| 13 | ODLUKE (O-31, O-2, B-1, O-9, O-10a, O-32 … O-36, i07/P-n, (v)) i TRACEABILITY ažurirani | ✔ | `docs/ODLUKE.md`, `docs/TRACEABILITY.md` |
| 14 | `git log i06..H` bez „Co-Authored-By”, „Claude”, „Generated” | ✔ | pretraga poruka prazna |
| 15 | Smoke `DELETE /api/v1/account` bez token-a → 401 (i07/P-9) | ✔ | `skripte/provjera.ps1` |

## 3 Napadi

Privremeni fajl `backend/test/emulator/zz_napadi_i07.test.js` (obrisan, nije commit-ovan; `git status` čist poslije).
Komanda: `npm run test:emu:ciljano -- test/emulator/zz_napadi_i07.test.js` → `tests 10 / pass 9 / fail 1` (exit 1); jedini pad je N9 zbog
pogrešnog očekivanja u napadu (tijelo `{}` sam očekivao kao 422, a O-21 / i05/P-2 ga izričito prihvata → 204). N9 ispravljen (tijela
`{"uid":"x"}`, `[]`, `null`, `"x"`) i ponovljen: `npm run test:emu:ciljano -- test/emulator/zz_napadi_i07.test.js --test-name-pattern=N9` →
`tests 1 / pass 1 / fail 0` (exit 0).

| # | Napad | Ishod |
|---|---|---|
| N1 | mock sata u `svjezinaPrijave.js`: `auth_time + 301 s` → 409 `REAUTHENTICATION_REQUIRED`, baza nepromijenjena; `auth_time + 300 s` → 204, nema dokumenata A | ✔ |
| N2 | 2 paralelna DELETE istog korisnika, 10× | ✔ `204: 20`, 0×500, stanje čisto, Auth obrisan |
| N3 | DELETE ‖ issue SHOWER ‖ kupovina ‖ redeem V ‖ cancel V2 (A sa 2 ACTIVE voucher-a), 10× | ✔ DELETE `204: 10`; issue `409 ACCOUNT_DELETION_IN_PROGRESS: 7`, `409 ACCOUNT_NOT_INITIALIZED: 1`, `503: 2`; kupovina `201: 1`, `404 LOYALTY_ACCOUNT_NOT_FOUND: 9`; redeem `200: 2`, `409 ACCOUNT_DELETION_IN_PROGRESS: 8`; cancel `200: 3`, `409: 7`; 0×500; poslije: 0 dokumenata sa uid A, Auth obrisan, svaki `reserve_` (uid null) ima tačno jedan `release_` ili `redeem_` (uid null) |
| N4 | prekid poslije K3 (`baciNaUpisu 5`), K4a (10), K5 (16), K4b (`baciNaBrisanju`) → 500, pa DELETE → 204, pa → 401; poslije K6 → 401 | ✔ `provjeriObrisanA` (isto konačno stanje) u svih 5 slučajeva |
| N5 | init poslije K1 (prekid u K3) | ✔ 409, baza nepromijenjena; nastavak → 204 |
| N6 | DELETE korisnika samo u Auth-u (users ne postoji) | ✔ 204, prazno tijelo, Auth obrisan |
| N7 | B `deepStrictEqual` u N1–N4, N6 | ✔ |
| N8 | retry kupovine A poslije brisanja: isti payload → 200, baza nepromijenjena, odgovor bez uid-a; `volumeMl + 1` → 409 `IDEMPOTENCY_CONFLICT`; nova transakcija → 404 | ✔ |
| N9 | tijela `{"uid":"x"}`, `[]`, `null`, `"x"` → 422 `INVALID_REQUEST`; neispravan JSON bez token-a → 422; `{}` bez token-a → 401; GET / POST / PUT / PATCH `/account`, DELETE `/account/init`, DELETE `/accounts` → 404 `NOT_FOUND`; baza i Auth netaknuti | ✔ |
| N10 | log ishoda 422, 401, 500, 503, 409, 204 bez uid-a, token-a, e-maila i `auth_time` (4 korisnika) | ✔ |
| N11 (dodatni) | NOT_INITIALIZED korisnik: DELETE ‖ init, init commit-ovan između K3 i K4a (presretač upita K4a) | vidi R-01 |

## 4 Nalazi

### R-01 — MINOR — K4a/K5 ne provjeravaju blokadu; prozor K1 → K4a za NOT_INITIALIZED nalog sa paralelnim init-om

- Referenca: AUTH-05, §23.1 (2), O-34b, i07/P-3 (blokada se provjerava samo u K3 i K4b), ODLUKE §7 (prozor K4b → K6 je jedini dokumentovan).
- Reprodukcija (N11): korisnik bez `users`; DELETE: K1 ne nalazi `users` (ništa), K3 nema voucher-a; prije prvog upita K4a init → 201
  (`users` ACTIVE, `loyaltyAccounts` 0/0); K4a briše `loyaltyAccounts/{uid}`; K4b nalazi `users` ACTIVE → 500 `INTERNAL_ERROR`.
- Očekivano: koraci poslije K1 rade samo dok su mutacije blokirane, ili se prozor dokumentuje kao poznato ograničenje.
- Dobijeno: poslije prvog DELETE-a `users` ACTIVE bez `loyaltyAccounts`, Auth postoji; ponovljen DELETE → 204 i čisto stanje.
- Procjena: samo sopstveni nalog, zahtijeva paralelan init i DELETE (Android po (v) to ne radi), loyalty stanje je 0/0, klijent dobija 500 i
  retry popravlja. Nije BLOCKER/MAJOR. Prijedlog za backlog: upisati u ODLUKE §7 uz P-1 (ili u i10 uz (v)); bez izmjene koda u i07.

### R-02 — NOTE — 503 pod kontencijom

N3: issue `503 SERVICE_UNAVAILABLE` 2/10 pod kontencijom (DELETE + 4 operacije istog korisnika). Već poznato ograničenje (§7, „503 moguć,
retry bezbjedan”); nijedan 500.

## 5 Pitanja za Orchestrator-a

Nema odluke koja blokira. R-01 je samo backlog (dokumentovanje u §7 / (v)).

## 6 PRESUDA

BLOCKER 0, MAJOR 0, MINOR 1, NOTE 1.

**ITERATION ACCEPTED**
