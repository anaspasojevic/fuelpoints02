# i06 — ADVERSARIAL REVIEW (LOOP 3, ekspresni režim)

Uloga: ADVERSARIAL REVIEWER, 2026-10-19. Režim: ekspresni (O-30 (f); O-31 po instrukciji Orchestrator-a, vidi R-01). Kod i testovi nisu
mijenjani; jedini upisani fajl je ovaj izvještaj. Privremeni fajl napada `backend/test/emulator/zz_napadi_i06.test.js` je obrisan, a
`git status` je čist.

## 1. Polazno stanje

| Stavka | Ishod |
|---|---|
| `git fetch --all --tags; git switch iteracija-06; git pull` | „Already up to date”; vrh grane H = `2dcdb97` ✔ |
| PR #6 `i06: Voucher redeem (API-04)` | OPEN ✔ |
| `git diff --stat 8c232be 2dcdb97` | samo `README.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/ODLUKE.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md` (5 fajlova, +266 / −27) ✔ |
| `provjera.ps1` | **nije pokretan**. Po O-31 kod na H je bajt-identičan kodu `8c232be` (diff sadrži samo `docs/*.md` i `README.md`). Za taj kod TEST_REPORT bilježi završni `provjera.ps1` sa exit 0: backend 81/81, emulator 170/170, rules 31/31, 7 smoke-ova, Android `BUILD SUCCESSFUL`, 1379 s |
| SRS hash | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` ✔; `git diff main -- docs/srs` prazno ✔ |
| JDK / portovi | `$env:Path = "C:\Program Files\Java\jdk-24\bin;" + $env:Path` prije run-a (OD-4); poslije run-a `Get-NetTCPConnection -LocalPort 8080,9099 -State Listen` → prazno ✔ |

## 2. Pregled po stavkama

Pregledani su SRS §20 (iz `.md`), §15–§16, §11, §26 API-04, §27 i §31, zatim `i06_brief.md`, `i06_plan.md` (sekcije 5, 9 i 14), unos i06 u
IMPLEMENTATION_LOG (OD-1 … OD-9) i `git diff i05..H -- backend/src firebase skripte`.

| # | Stavka | Ishod | Referenca |
|---|---|---|---|
| 1 | Scope, brief tačka 3: u `otkupVaucera.js` nema `tx.get(query)` ni reconcile-a; nema API-07, notifikacija ni FCM-a | ✔ | `git grep "tx\.get\("` → u `otkupVaucera.js` samo komentar (red 47); čitanja su isključivo `tx.getAll` nad dokumentima |
| 2 | Nema novih paketa; `package-lock.json`, `firebase/tests/package*.json` i `firestore.indexes.json` netaknuti; `package.json` +1 red (`test:emu:ciljano`) | ✔ | `git diff --stat i05 H` |
| 3 | Nema test-only koda u `src/` (`process.env.NODE_ENV|TEST`, `inject`, `ubriz`, `mock`); nema TODO/FIXME | ✔ | `git grep` → prazno |
| 4 | O-7: CANCELLED → `VOUCHER_CANCELLED`, EXPIRED → `VOUCHER_EXPIRED`; status ima prednost nad rokom | ✔ | `otkupVaucera.js:101–110` (T4 prije isteka); I06-T11 |
| 5 | O-8 (a): zapis samo u grani uspjeha | ✔ | jedini `tx.create(refZapis…)` je na `:160`, poslije §20.5 `return` |
| 6 | O-8 (b): `requestKey = SHA-256(stationId:redemptionRequestId)` | ✔ | `:56`; `izracunajRequestKey(prviDio, drugiDio)` mijenja samo imena parametara, ponašanje API-03 je isto (I06-T06) |
| 7 | O-24: zapis se provjerava prije stanja voucher-a; strukturna provjera (tačno 6 ključeva u sortiranom redoslijedu, ključ ↔ zapis) prije 409; za isti voucher O-27 + REDEEMED + stanica + uid; retry ne upisuje ništa | ✔ | `:70–89`, `jeIspravanZapis` `:28–40`; i06/P-3 A |
| 8 | O-25: terminalna stanja prije naloga; nalog samo za ACTIVE, prije §20.5 | ✔ | `:101–115` |
| 9 | O-26: reconcile se radi samo za voucher iz putanje | ✔ | `pripremiOslobadjanja` dobija jednu stavku `[{ ref: refVaucer, … }]` (`:129`) |
| 10 | O-27: jedna funkcija `jeKonzistentnoStanjeVaucera` (`vauceri.js:33`); koriste je redeem (T2, T3), cancel, `procitajIstekleAktivne` i O-16 retry (i06/P-1 A) | ✔ | `git grep jeKonzistentnoStanjeVaucera` → definicija + 4 korisnika; cancel više nema zasebnu CANCELLED/`cancelledAt` provjeru jer je ona pokrivena O-27 |
| 11 | O-28: `redeem_` i zapis samo kroz `tx.create`; `redeem_` i `release_` se provjeravaju prije grananja (i06/P-5); redoslijed upisa voucher → `redeem_` → nalog → zapis; sva čitanja prethode upisima | ✔ | `:117–162` |
| 12 | Redoslijed 5.1 van transakcije: parser 422 → D-5 404 → POS 401 → tijelo 422 → format 404 → rok 503 | ✔ | `rute/otkupVaucera.js:11–16`; `otkupVaucera.js:51–54` |
| 13 | Upisi samo navedenih polja: voucher `{status, redeemedAt, redeemedAtStationId}`, nalog `{reservedPoints, updatedAt}`, a `availablePoints` se ne upisuje; REDEEM ima tačno 9 polja po §11 | ✔ | `:144–159` |
| 14 | Vrijeme: `sadaMs` jednom po pokušaju; `redeemedAt = Timestamp.fromMillis(sadaMs)`; jedan `serverTimestamp()` po transakciji | ✔ | `:65`, `:124`, `:143`; I06-T17 |
| 15 | POS posrednik je samo na ruti; `stationId` samo iz `res.locals` | ✔ | `rute/otkupVaucera.js:12–15`; N8 |
| 16 | `redemptionRequestId`, `voucherId`, `requestKey` i `uid` ne pojavljuju se ni u logu ni u porukama; sve poruke su statičke | ✔ | izvor + N9 |
| 17 | `release_` se piše samo u `oslobadjanjeVaucera.js`; `redeem_` i `redemptionRequests` samo u `otkupVaucera.js` (+ `kolekcije.js`) | ✔ (kod) | vidi R-03 (literal se javlja i u komentarima) |
| 18 | Rules: diff `i05` je samo blok `redemptionRequests`, doslovno po §31 | ✔ | `git diff i05 -- firebase/firestore.rules` (+4 reda) |
| 19 | `provjera.ps1`: dodat je samo smoke red za API-04 (i06/P-2 A) | ✔ | diff `skripte/provjera.ps1` |
| 20 | `git diff i05 -- backend/test`: izmijenjen je samo `omotacBaze.js` (`prijePokusaja`; bez opcije se ponaša isto); ostalo su novi fajlovi | ✔ | `--diff-filter=M` |
| 21 | API-T08, API-T09 i API-T10 (uključujući granicu u servisu) postoje i asertuju ono što traže brief i plan 8.1 | ✔ | `otkupVaucera.test.js:124, 191, 228, 248` |
| 22 | I06-T18 je deterministički (`prijePokusaja` + `prisiliPonovniPokusaj: 1`), ima kontrolu bez opcije i pokriva slučajeve (a)–(g) | ✔ | `otkupAtomicnost.test.js:303–438` |
| 23 | I06-T19 (b) i (c) imaju po 20 ponavljanja, ostali dijelovi po 10; asertuje se 0×500 i tačno jedan terminalni prelaz | ✔ | `:479–539`; O-30 (c) |
| 24 | Tabela mutacija O-30 (b) je potpuna: M01, M02, M04, M05, M06, M07, M09, M12, M17, M18, M20 (+ M20b), M24, M30, M31, M32, M38, M41, M45 (D po i06/K-1); sve su ubijene 1/1, a ostale su označene „nije izvršeno, O-30 (b)” | ✔ | TEST_REPORT i06 |
| 25 | OD-3 (kod napisan prije prvog crvenog run-a) | ✔ uz NOTE | vidi R-02 |
| 26 | TRACEABILITY (redovi iz plana 12 i O-1 tabela), IMPLEMENTATION_LOG (≤ 1 strana, R-06 „Ispravka (i06)”, OD-n, (u)) i ODLUKE (§1, O-7 i O-8 zatvoreni, O-24 … O-30, (t) zatvoren, (u), §7, §10) su ažurirani; README ima sekciju API-04 | ✔ | `git diff i05 H -- docs README.md` |
| 27 | `git log i05..H` ne sadrži „Co-Authored-By”, „Claude”, „Generated” ni „Anthropic” | ✔ | grep → bez pogodaka |

## 3. Napadi N1 … N11

Pokretanje: `cd backend; npm run test:emu:ciljano -- test/emulator/zz_napadi_i06.test.js`. Rezultat: exit 0, `tests 11 / pass 11 / fail 0`,
107 s (sa JDK-om 24 prvim na PATH-u; poslije run-a su portovi 8080 i 9099 bili slobodni).

| # | Napad | Ishod |
|---|---|---|
| N1 | Isti voucher sa SIM01 i SIM02, isti `redemptionRequestId` „A” (dva različita `requestKey`-a), paralelno, 10 ponavljanja, svaki put novi nalog | ✔ raspodjela `200: 10`, `409 VOUCHER_ALREADY_REDEEMED: 10`, 0×500, 0×503; svaki put 1 REDEEM, 1 zapis, nalog `30/0` |
| N2 | Redeem × cancel paralelno, 10 ponavljanja | ✔ svaki put tačno jedan terminalni događaj (REDEEM + RELEASE = 1), balance tačan, 0×500. U ovom run-u je cancel pobijedio 10/10, a Builder-ov I06-T19 (c) bilježi 9/11. Obje grane deterministički pokriva I06-T18 (a), (b) |
| N3 | Isti ID za drugi voucher W; isti ID sa SIM02 za V; isti ID sa SIM02 za W | ✔ 409 `IDEMPOTENCY_CONFLICT` i 409 `VOUCHER_ALREADY_REDEEMED`, uz `snimakBaze` `deepStrictEqual` (0 upisa). Isti ID sa SIM02 za W je novi zahtjev → 200, `redeemedAtStationId 'SIM02'`, zapis pod `SHA-256("SIM02:POS-RDM-001")`, ukupno 2 zapisa (O-8 (b)) |
| N4 | Granica isteka u servisu (mock sata za `otkupVaucera.js`): `sadaMs = E`, `E − 1`, `E + 1` | ✔ `E` → EXPIRED + release, nalog `80/0`, 0 zapisa; `E − 1` → REDEEMED, `redeemedAt = E − 1`; `E + 1` → EXPIRED |
| N5 | `DELETION_IN_PROGRESS` + ACTIVE neistekao i ACTIVE istekao | ✔ 409 `ACCOUNT_DELETION_IN_PROGRESS`, `snimakBaze` nepromijenjen (nema release-a) |
| N6 | `voucherId`: Firebase UID (28), 64 × `A`, `%2F` u sredini, `..`, `%2E%2E`, 65 hex, 63 hex + `%0A`, 64 hex + `%20` | ✔ sve → 404 `VOUCHER_NOT_FOUND`, `brojPristupa 0` |
| N7 | Tijelo sa `stationId`; 64 KB string; 200 KB (iznad limita parsera); `__proto__` kao drugi ključ; `"A\u0000"` | ✔ sve → 422 `INVALID_REQUEST` (200 KB: 413 parsera se mapira u 422, ne uvodi se novi kod), `brojPristupa 0`. Dupli ključ `PRVI`/`DRUGI` → 200 sa zapisom pod `DRUGI` (dokumentovano kao i06/P-4) |
| N8 | Ključ u query-ju (`?X-POS-API-Key=…&stationId=SIM02`); vrijednost ključa sa promijenjenim velikim/malim slovima; ključ sa razmakom i viškom znakova; ime zaglavlja `x-pos-api-KEY` | ✔ prva tri → 401 `UNAUTHENTICATED_POS`, `brojPristupa 0`; ime zaglavlja nije osjetljivo na velika i mala slova (HTTP) → 200 sa `redeemedAtStationId 'SIM02'` za K2 |
| N9 | Log (svi kanali, `presretniLog`) za ishode 200, 200 (retry), 409 ALREADY, 409 CONFLICT, 404, 401 (sentinel ključ), 422 (sentinel ID), 500 (`baciNaUpisu: 2`), 503 (`code 14`) | ✔ statusi tačni; log ne sadrži K1, K2, sentinel ključ, V, V2, W, uid, ID-eve (prefiks `RDMSENT`) ni `requestKey`; odgovori su bez `stack`, `    at `, uid-a i ID-a |
| N10 | O-27: istekao ACTIVE sa `redeemedAt` kroz cancel, API-06, API-03 (SHOWER issue) i redeem | ✔ sva četiri → 500 `INTERNAL_ERROR`, `snimakBaze` nepromijenjen (nijedan release) |
| N11 | Kasni commit (`zadrziPrijeCommitaMs = rok + 500`) → 503; retry dok commit još visi; retry poslije commit-a; isti ID sa SIM02; isti ID za drugi voucher W | ✔ prvi 503; rani retry je dobio 200 (čeka bravu emulatora, pa vidi zapis); retry → 200 sa istim tijelom; SIM02 → 409 `VOUCHER_ALREADY_REDEEMED`; W → 409 `IDEMPOTENCY_CONFLICT`; ukupno 1 REDEEM, 1 zapis, nalog `30/50` |

Nijedan napad nije dao ishod suprotan SRS-u ili odlukama. Nijedan nije dao 500 pod kontencijom.

## 4. Nalazi

### R-01 — NOTE — O-31 nije upisana u repozitorijum
Instrukcija Reviewer-a se poziva na „O-30 (f) i O-31 u `docs/iteracije/i06_plan.md`, sekcija 14”. Sekcija 14 plana i `docs/ODLUKE.md` sadrže
samo O-30. `grep -rn "O-31" docs` ne daje nijedan pogodak. O-30 (f) traži „provjera.ps1 1×” za Reviewer-a, a ovaj review ga nije pokrenuo,
po pravilu iz instrukcije: kod je nepromijenjen od `8c232be`. Pošto je repozitorijum state, a razgovor nije, odluka O-31 (Reviewer ne pokreće
`provjera.ps1` kad diff od posljednjeg zelenog run-a sadrži samo `docs/*.md` / `README.md`) treba da se upiše u ODLUKE §2 i §10.
**Preporuka:** Orchestrator upisuje O-31 pri checkpoint-u ili u FIX LOOP-u (samo dokumentacija). Ne blokira.

### R-02 — NOTE — OD-3: kod API-04 je napisan prije prvog crvenog run-a
Redoslijed „test prije koda” (plan 7) nije poštovan doslovno. Builder je ipak izvršio crveni run prije commit-a, na stablu bez uvezane rute:
`otkupVaucera.test.js` `tests 13 / pass 1 / fail 12` (TEST_REPORT, korak 4). Uz to je 19 ključnih mutacija ubijeno 1/1, a mojih 11 napada je
nezavisno potvrdilo ponašanje. Testovi dakle stvarno obaraju neispravan kod. Procesno odstupanje je dokumentovano, a uticaja na kvalitet nema.
**Preporuka:** bez akcije.

### R-03 — NOTE — DoD `git grep "release_"` doslovno vraća i komentare
`git grep -n "release_" -- backend/src` vraća i komentare: `otkupVaucera.js:44` (novi, i06) te `obradaGresaka.js:32, 43` i
`otkazivanjeVaucera.js:28` (postojeći). Kod koji piše `release_` je samo u `oslobadjanjeVaucera.js:12`. TEST_REPORT tačno navodi
„(kod, bez komentara)”, pa tvrdnja nije netačna. Doslovna DoD komanda iz brief-a ipak ne daje „samo jedan fajl”.
**Preporuka:** u budućim briefovima formulisati inspekciju kao „kod (bez komentara)” ili je ograničiti na `doc(\`release_`. Ne mijenjati
komentare samo radi grep-a.

### R-04 — NOTE — Ishod slobodne trke redeem × cancel je pristrasan
U N2 je cancel pobijedio 10/10. Uzrok je vjerovatno redoslijed sticanja brava u emulatoru, a ne kod: oba toka čitaju i ažuriraju isti voucher
i nalog u transakciji. Invarijanta (tačno jedan terminalni prelaz) važi u svakom ponavljanju. Grana „redeem pobjeđuje” je deterministički
pokrivena u I06-T18 (b). Isto ograničenje „emulator ≠ produkcija” već bilježi ODLUKE §7.
**Preporuka:** bez akcije.

BLOCKER: 0. MAJOR: 0. MINOR: 0. NOTE: 4.

## 5. Otvorena pitanja za Orchestrator-a

1. Upis O-31 u ODLUKE (R-01): da li to radi Orchestrator pri checkpoint-u ili FIX LOOP (samo dokumentacija)?
2. SRS nejasnoće ni kontradikcije koje blokiraju nisu nađene. §20 se doslovno poklapa sa O-7, O-8 i O-24 … O-28.

## 6. Šta nije pregledano i zašto

- `provjera.ps1` nije pokrenut (O-31; kod je identičan `8c232be`, za koji TEST_REPORT bilježi exit 0). Pune suite nisu ponovo izvršene.
  Stvarno izvršen je samo moj ciljani run napada (exit 0).
- Builder-ove mutacije nisu ponavljane (O-30 (f)). Tabelu sam provjerio samo na potpunost i na to da ciljani testovi postoje.
- Produkcioni Firestore (optimistična kontencija, poruke gRPC grešaka): testovi smiju raditi samo nad emulatorom.
- I06-T20 (100 nasumičnih operacija) i I06-T21 (b) (spawn `pokreni.js`) samo sam pročitao, nisam ih pokretao.
- Android: van opsega i06 (build ide samo kroz `provjera.ps1`).
- Rules testove I06-T22 nisam ponovo pokretao; diff pravila (+4 reda, doslovno po §31) je pregledan.

## 7. PRESUDA

Nema nalaza nivoa BLOCKER, MAJOR ni MINOR. Kod API-04 i O-27 odgovara SRS §20, §11, §15–§16, §26, §27 i §31 i odlukama O-7, O-8 i O-24 … O-28.
Napadi N1 … N11 su dali SRS-ispravan ishod, bez ijednog 500 pod kontencijom. Dokumentacija je ažurirana, a commit-i su bez potpisa alata.
NOTE R-01 … R-04 idu u backlog (R-01: upis O-31 u ODLUKE).

**ITERATION ACCEPTED**
