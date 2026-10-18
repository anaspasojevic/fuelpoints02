# i04 — RE-REVIEW 2 poslije FIX LOOP-a 2 (ADVERSARIAL REVIEWER, LOOP 3)

Grana `iteracija-04`, PR #4, vrh `3d2bf74` („i04 fix2: TEST_REPORT ishod završne provjere”). Opseg: zatvaranje R-05 i R-06
(`docs/iteracije/i04_review_fix1.md`), odluke Orchestrator-a P-3 i P-4 (`docs/iteracije/i04_plan.md`, sekcija 15, „FIX LOOP 2 — odluke
Orchestrator-a”), regresija i dokumentacija. Diff: `git diff 54b2e0b..HEAD`. Normativ: SRS 3.1 (§3.3, §3.4, §27), NFR-07, odluke D-3, O-18, P-3.

Probe-skripte su van repoa (`C:\Users\Elitebook\i04_probe\fix2\`: `mutiraj.mjs`, `napadi.mjs`), nisu commit-ovane. Svaka mutacija je
vraćena sa `git restore src/greske/obradaGresaka.js` (skripta ispisuje `git status src: ''` poslije svake serije).

## 1. Sažetak i presuda

R-05 i R-06 su zatvoreni mojim sopstvenim dokazom (stvarne emulatorske NOT_FOUND / ALREADY_EXISTS greške ne ostavljaju ni ID ni red poruke u
logu; M43-vr, M43, M43-vr-g, M44, M45 padaju 10/10), nijedan napad ne izvlači requestKey ni voucherId na putu dostižnom u i04, a četiri
preživjele mutacije reviewera su ekvivalentne nad domenom ulaza i04 (dokaz u sekciji 4), pa je presuda **ITERATION ACCEPTED** uz nalaze
R-07 (MINOR, nedostižno) i R-08 … R-12 (NOTE) za i05+.

## 2. Stvarni rezultati

Git na početku: `git fetch` / `git switch iteracija-04` / `git pull --ff-only` → `Already up to date.`; `git log --oneline -8` vrh
`3d2bf74 i04 fix2: TEST_REPORT ishod završne provjere`, zatim `00cf0c1`, `f27ab90`, `458e720`, `0c80582`, `54b2e0b`, `b1817d6`, `5678e58`;
`git status` → `nothing to commit, working tree clean`.

`.\skripte\provjera.ps1` na vrhu grane (`3d2bf74`, izlaz u `provjera.txt`):

```
==> Backend: npm ci, npm test, npm run test:emu
ℹ tests 63
ℹ pass 63
ℹ fail 0
ℹ raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":20}
✔ I04-T20 (a) stvarna emulatorska NOT_FOUND (tx.update nepostojećeg vouchers/<id> u transakciji) → … (3154.6895ms)
✔ I04-T20 (b) stvarna emulatorska NOT_FOUND van transakcije (update nepostojećeg rewardRequests/<id>) → … (17.6987ms)
✔ I04-T20 (c) ne-gRPC Error i bačen string: … (7.5069ms)
✔ I04-T16 (c) 500 ALREADY_EXISTS na rewardRequests/<requestKey>, loyaltyLedger/release_<voucherId>, vouchers/<voucherId> i …
ℹ tests 105
ℹ pass 105
ℹ fail 0
ℹ duration_ms 387530.814
Smoke: 404 NOT_FOUND, correlationId 9820eb14-…
Smoke: 401 UNAUTHENTICATED, correlationId 079e26d7-…
Smoke: 401 UNAUTHENTICATED_POS, correlationId c6699ff9-…
Smoke: 401 UNAUTHENTICATED, correlationId fe085c8e-…
==> Firestore rules: npm ci, npm test
ℹ tests 30
ℹ pass 30
ℹ fail 0
BUILD SUCCESSFUL in 1s
BUILD SUCCESSFUL in 1s
SVE PROVJERE PROŠLE
EXIT=0
```

Brojevi testova odgovaraju Builder-u: **63 / 105 / 30**, `fail 0`.

Stvarni log 500 iz API-03 u istom izvršavanju (I04-T16 (c), ALREADY_EXISTS):
`"stack":"Error (code 6 ALREADY_EXISTS)\n    at callErrorFromStatus (C:\\…\\@grpc\\grpc-js\\build\\src\\call.js:32:19)\n    at …"` — bez poruke
Firestore-a, sa okvirima.

Ponavljanja (ručno pokrenut `npx firebase emulators:start --config ../firebase.json --project demo-fuelpoints --only firestore,auth`,
JBR prvi u PATH-u; `mutiraj.mjs` pokreće `node --test --test-concurrency=1 --test-reporter=spec <fajlovi>` sa env
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `GCLOUD_PROJECT=demo-fuelpoints`):

| Izvršavanje | Testovi | Rezultat |
|---|---|---|
| nemutiran ×10 | `logIzdavanja.test.js` + `logGresaka5xx.test.js` cijeli (I04-T16 (a), (b), (c), I04-T20 (a), (b), (c)) | 10 × `exit=0 pass=6 fail=0` → `REZULTAT nemutiran: pao 0/10` |
| nemutiran ×3 | `izdavanjeAtomicnost.test.js`, `--test-name-pattern="API-T07\|I04-T13\|I04-T18\|I04-T19"` | 3 × `exit=0 pass=4 fail=0` → `pao 0/3` (API-T07 sam izvršava 20 ponavljanja → 60 paralelnih parova) |

Na kraju: portovi 8080 / 9099 slobodni (emulator ugašen), `git status --short` prazan prije pisanja ovog fajla.

## 3. Status R-05 i R-06

### R-06 — ZATVOREN

I04-T16 (c) sada ima slučajeve `voucher` (ALREADY_EXISTS na `vouchers/<noviVoucherId>`) i `reserve` (ALREADY_EXISTS na
`loyaltyLedger/reserve_<noviVoucherId>`), sa asercijama za četiri requestKey-a, oba voucherId-a, requestId i putanju (diff
`backend/test/emulator/logIzdavanja.test.js`: samo dodavanja; jedina obrisana linija je stari naslov testa, zamijenjen proširenim).

Builder-ova tvrdnja o ekvivalentnosti M43-vr i M43 za I04-T16 (c) poslije koraka 2 je **tačna**, a ne izgovor:
- greške u I04-T16 (c) su stvarne gRPC greške (`code 6`), pa idu granom bez poruke; `redigujPutanje` dobija samo `err.name` (`"Error"`) i
  okvire (`at callErrorFromStatus (…\@grpc\grpc-js\…)` itd.);
- dokaz mjerenjem: pod **M43** (redakcija putanja potpuno isključena) I04-T16 (c) prolazi 10/10, dakle u okvirima tog testa nema ni putanje
  ni ID-a — razlika između M43-vr / M43 i originala nije vidljiva nijednim ulazom iz tog testa;
- obje mutacije obara I04-T20 (c) 10/10 (ne-gRPC poruke `vouchers/TAJNA-<uuid>`, `loyaltyLedger/reserve_TAJNA-<uuid>`), a ekvivalent na novom
  mjestu (M43-vr-g) obara I04-T16 (c) 10/10:

```
REZULTAT M43-vr: pao 10/10; po testu: {"I04-T20 (c) ne-gRPC Error i ba":10}
REZULTAT M43: pao 10/10; po testu: {"I04-T20 (c) ne-gRPC Error i ba":10}
REZULTAT M43-vr-g: pao 10/10; po testu: {"I04-T16 (c) 500 ALREADY_EXISTS":10}
M43-vr-g poruka: AssertionError [ERR_ASSERTION]: voucher: log sadrži voucherId (novi)
```

### R-05 — ZATVOREN

`opisNeocekivaneGreske` za `Number.isInteger(err.code)` vraća `name (code N IME_STATUSA)` + okvire, bez poruke. Stvarna emulatorska poruka
(sopstveni napad a1, `napadi.mjs`):

```
[sirova emulatorska poruka a1] code=5 message="5 NOT_FOUND: no entity to update: app: \"dev~demo-fuelpoints\"\npath <\n  Element {\n    type: \"vouchers\"\n    name: \"b1737f90…f6c7\"\n  }\n>\n"
### a1 NOT_FOUND u tx, vouchers/b1737f90…
odgovor: 500 INTERNAL_ERROR tijeloPo27=true next(err)=false bacenoIzRukovaoca=null
log.stack prvi red: "Error (code 5 NOT_FOUND)"
CURI: ne
```

Isto za `TAJNA-<uuid>` (ID koji nije hex), van transakcije (a2), za ALREADY_EXISTS van transakcije (a3, sirova poruka
`… path=/loyaltyLedger/reserve_<id>]`) i u transakciji (a4): svuda `CURI: ne`. M44 i M45 padaju 10/10 (sekcija 4). Odgovor klijentu je po §27
(`tijeloPo27=true`, 500 `INTERNAL_ERROR`, poruka iz kataloga). Dijagnostika ostaje (`Error (code 5 NOT_FOUND)`, `Error (code 6 ALREADY_EXISTS)`
+ okviri). Ostatak zavisnosti od oblika poruke je R-07 (nedostižno u i04, requestKey / voucherId se i tada rediguju).

## 4. Tabela mutacija

Sve serije: 10 izvršavanja `logIzdavanja.test.js` + `logGresaka5xx.test.js` (6 testova), kod sa vrha `3d2bf74`. Mutacije M43-vr … M45 su
tekstualno iste kao u TEST_REPORT-u (M43-vr tačno kako sam je izveo u re-reviewu 1). R-M* su moje.

| Mutacija | Izmjena u `obradaGresaka.js` | Pao | Koji test pada | Prva poruka |
|---|---|---|---|---|
| M43-vr | `redigujPutanje` propušta mečeve sa `vouchers/` ili `reserve_` | **10/10** | samo I04-T20 (c) (10) | `vouchers/<id bez hex-a>: log sadrži tajnu` |
| M43 | `redigujPutanje`: `return tekst;` | **10/10** | samo I04-T20 (c) (10) | `vouchers/<id bez hex-a>: log sadrži tajnu` |
| M43-vr-g | gRPC grana dodaje sirovu poruku kad sadrži `vouchers/` ili `reserve_` | **10/10** | samo I04-T16 (c) (10) | `voucher: log sadrži voucherId (novi)` |
| M44 | `if (Number.isInteger(err.code)) {` → `if (false) {` | **10/10** | I04-T20 (a) (10), I04-T20 (b) (10) | `vouchers/bc9387…: prvi red opisa: Error: 5 NOT_FOUND: no entity to update: …` |
| M45 | bez `.replace(HEX_NIZ, '[hex]')` | **10/10** | I04-T20 (c) (10) | `goli hex: log sadrži tajnu` |
| R-M46b | prag hex-a 32 → 65 | **10/10** | I04-T20 (c) | `goli hex: log sadrži tajnu` |
| R-M49 | bačen ne-Error bez redakcije (`return String(err);`) | **10/10** | I04-T20 (c) | `string sa golim hex-om: log sadrži tajnu` |
| R-M50 | gRPC grana za svaki `err.code !== undefined` | **10/10** | I04-T20 (c) | `Error sa string code: log bez poruke greške` |
| R-M51 | bez imena statusa (`(code N)`) | **10/10** | I04-T20 (a), (b) | `prvi red opisa: Error (code 5)` |
| R-M52 | gRPC grana bez okvira | **10/10** | I04-T20 (a), (b), I04-T16 (c) | `log bez okvira stack-a` |
| R-M46 | prag hex-a 32 → 64 | 0/10 | — | ekvivalentna (dokaz E1) |
| R-M53 | hex samo mala slova (`[0-9a-f]{32,}`) | 0/10 | — | ekvivalentna (dokaz E1) |
| R-M47 | okviri bez redakcije (uklonjen `.map(rediguj)`) | 0/10 | — | ekvivalentna u domenu i04 (dokaz E2); nalaz R-07 / R-08 |
| R-M48 | `err.name` bez redakcije | 0/10 | — | ekvivalentna u domenu i04 (dokaz E3); nalaz R-08 |

Napomena: M43-vr i M43 više ne pada I04-T16 (c) — vidi sekciju 3 (tačna ekvivalentnost za taj test, dokaz preko M43 10/10 prolaza).

Dokazi ekvivalentnosti:
- **E1 (R-M46, R-M53):** O-18 štiti requestKey i voucherId. Oba su uvijek tačno 64 mala hex znaka: `createHash('sha256')…digest('hex')`
  (`izracunajRequestKey`), `crypto.randomBytes(32).toString('hex')` (`generisiVoucherId`), a voucherId iz mapping-a prolazi
  `FORMAT_VOUCHER_ID = /^[0-9a-f]{64}$/`. Niz od 64 mala hex znaka meči `{32,}`, `{64,}` i `[0-9a-f]` jednako, za BILO KOJI ulaz; mutacije
  mijenjaju samo ponašanje za skraćene (32 … 63) ili velika slova, što nije requestKey ni voucherId. Dokumentovani prag ≥ 32 ostaje netestiran (R-09).
- **E2 (R-M47):** u okvire ulaze samo redovi `err.stack` koji počinju sa `\s+at `. Za stvarne greške i04: okviri su putanje fajlova i imena
  funkcija (napad a1: `[da li err.stack okviri sadrže ID]: false`; jedini redovi „at” bez zagrade su `at C:\…\node_modules\…`), a nijedan red
  stvarne emulatorske poruke ne počinje sa `at ` (NOT_FOUND: `path <`, `Element {`, `type:`, `name:`, `}`, `>`; ALREADY_EXISTS je jednoredna).
  Ne-gRPC poruke u i04 su statičke (`git grep "new (Type)?Error("` u `backend/src`: sve sa literalom, osim `GreskaApi.js:8` čiji je `kod`
  konstanta iz koda). Dakle nijedan ulaz i04 (zahtjev ili stanje baze) ne stavlja ID u okvir. Produkcioni format nije provjeren → R-07.
- **E3 (R-M48):** `err.name` dolazi iz klase greške (`Error`, `GreskaApi`, `TypeError` iz SDK-a, `URIError` — 4xx); nijedan ulaz (zahtjev,
  stanje baze) ga ne mijenja.

## 5. Napadi V2 i V5 (`napadi.mjs`, centralni rukovalac pozvan direktno; „log” = `console.error` zapis)

Odgovor je u svakom slučaju gdje rukovalac ne baca bio `tijeloPo27=true` (status i tijelo tačno po §27, poruka iz kataloga).

| # | Napad | Log `stack` (prvi red; stvarno) | Curi | Dostižno u i04 |
|---|---|---|---|---|
| a1 | stvarna NOT_FOUND, `tx.update` nad `vouchers/<64 hex>` i `vouchers/TAJNA-<uuid>` | `Error (code 5 NOT_FOUND)` + okviri (16–17 redova) | ne | da (nekonzistentno stanje) |
| a2 | isto van transakcije | `Error (code 5 NOT_FOUND)` | ne | — (API-03 piše samo u tx) |
| a3 | stvarna ALREADY_EXISTS van tx, `loyaltyLedger/reserve_<id>` | `Error (code 6 ALREADY_EXISTS)` | ne | — |
| a4 | stvarna ALREADY_EXISTS u tx (`tx.create`) | `Error (code 6 ALREADY_EXISTS)` | ne | da (I04-T16 (c)) |
| b1 | obični `Error`, `code = 5`, poruka sa tajnom i hex-om | `Error (code 5 NOT_FOUND)` (poruka izostavljena; dijagnoza pogrešna) | ne | ne → R-11 |
| b2 | `code = 404` | `Error (code 404 nepoznat status)` | ne | ne |
| b3 | `code = -1` | `Error (code -1 nepoznat status)` | ne | ne |
| c1 | `code = 'ENOENT'`, poruka `/tmp/<hex>` | `Error: ENOENT: open '/tmp/[hex]'` | ne | ne |
| c2 | `code = 'ECONNRESET'`, poruka `vouchers/<tajna>` | `Error: read ECONNRESET [putanja dokumenta]` | ne | ne |
| d1 | hex od 31 znaka | `Error: skraceni c03a4d42…970` | **DA** (31 hex) | ne → R-09 |
| d1b | hex od 32 znaka | `Error: skraceni [hex]` | ne | ne |
| d2 | 64 hex razdvojen crticama (4×16) | `Error: id c03a…-3b71…-ffec…-7c60…` | **DA** | ne → R-12 |
| d3 | 64 hex razdvojen razmacima | isto sa razmacima | **DA** | ne → R-12 |
| d4 | hex u `err.name` (ne-gRPC) | `Greska_[hex]: x` | ne | ne (R-M48 netestirana, R-08) |
| d4b | `vouchers/<tajna>` u `err.name`, gRPC `code 6` | `[putanja dokumenta] (code 6 ALREADY_EXISTS)` | ne | ne |
| d5 | hex i `vouchers/<tajna>` u okvirima steka | `Error: okvir` + redigovani okviri | ne | ne (R-M47 netestirana, R-08) |
| d6 | ne-gRPC višeredna poruka sa redom `    at TAJNA-<uuid>` | `Error: prvi red` …; red `at TAJNA-…` u okvirima | **DA** (ne-hex ID) | ne → R-07 |
| d6b | **gRPC** `code 5`, poruka sa redom `    at TAJNA-<uuid>` | `Error (code 5 NOT_FOUND)` + red `    at TAJNA-…` | **DA** (ne-hex ID; hex bi bio `[hex]`) | ne → R-07 |
| e1 | bačen string sa `vouchers/<tajna>` | `x [putanja dokumenta]` | ne | ne |
| e2 / e2b | objekat sa `toString` (hex / ne-hex tajna) | `obj [hex]` / `obj TAJNA-…` | ne / **DA** | ne → R-12 |
| e3 / e4 | `null` / `undefined` | `null` / `undefined` | ne | ne |
| e5 | `Object.create(null)` | nema zapisa; rukovalac baca `TypeError: Cannot convert object to primitive value` | — | ne → R-10 |
| e6 | objekat čiji `toString` baca `Error("baca <hex>")` | nema zapisa; rukovalac baca tu grešku (sa hex-om) | (finalhandler) | ne → R-10 |
| f1–f3 | `code` = `Infinity` / `NaN` / `5.5`, poruka sa hex-om | `Error: f [hex]` (ne-gRPC grana) | ne | ne |
| f4 | `code = 1e21` | `Error (code 1e+21 nepoznat status)` | ne | ne |
| g1 | requestId (UUID) u ne-gRPC poruci | `Error: requestId d6edfb17-…` | **DA** (requestId) | ne → R-12 |
| g2 | uid (28 alfanum.) u ne-gRPC poruci | `Error: uid aB3dE5fG…` | **DA** (uid) | ne → R-12 |
| g3 | `users/<uid>` u ne-gRPC poruci | `Error: [putanja dokumenta]` | ne | ne |
| h1 | `GreskaApi('SERVICE_UNAVAILABLE')` (503) | `GreskaApi: SERVICE_UNAVAILABLE` + okviri; odgovor 503 po §27 | ne | da (I04-T14, `provjera.txt`) |
| h2 | `res.headersSent = true`, poruka sa tajnom | nema zapisa rukovaoca, `next(err)` pozvan | ne (rukovalac); finalhandler N-11 | ne |
| h3 | `GreskaApi('INSUFFICIENT_POINTS')` (409) | `stack` izostavljen | ne | da |
| V5-1 | 100 000 hex / 1 000 000 hex | 1,0 ms / 7,5 ms; log 413 znakova (`[hex]`) | ne | ne |
| V5-1 | `(31 hex + "g") × 32 000` (~1 MB) | 52,8 ms; log 1 024 408 znakova (ništa redigovano) | ne | ne → R-12 (veličina loga) |
| V5-1 | `"path=" × 200 000`, `"users/" × 150 000`, `"documents/" + 1 MB` | 1,2 / 1,0 / 1,4 ms | ne | ne (nema ReDoS-a: svi obrasci linearni) |
| V5-2 | `saRokom(obećanje koje se odbija za 100 ms gRPC greškom sa `vouchers/<tajna>`, 20 ms)` | ishod `GreskaApi:SERVICE_UNAVAILABLE`; `unhandledRejection=[]` | ne | da (I04-T14 put) |

Statusni kodovi i tijela su nepromijenjeni u odnosu na `54b2e0b`: `git diff 54b2e0b..HEAD -- backend/src` dira samo
`opisNeocekivaneGreske` i pomoćne funkcije; `centralniRukovalacGreskama`, `odrediKod` i katalog nisu dirani. `git diff` testova: samo
dodavanja (proširen I04-T16 (c), novi `logGresaka5xx.test.js`); nijedna asercija uklonjena ni oslabljena.

## 6. Novi nalazi

### R-07 — MINOR (nedostižno u i04; ne blokira) — gRPC grana „bez poruke” i dalje propušta redove poruke koji počinju sa `at `

- Referenca: P-3 („redakcija NE SMIJE zavisiti od oblika poruke Firestore greške”), O-18, NFR-07.
- Reprodukcija (`napadi.mjs`, d6b): `centralniRukovalacGreskama(Object.assign(new Error('5 NOT_FOUND: x\n    at TAJNA-<uuid>\n  name: "TAJNA-<uuid>"'), { code: 5 }), …)`.
- Očekivano: u logu samo `Error (code 5 NOT_FOUND)` + okviri, ništa iz poruke. Dobijeno: `Error (code 5 NOT_FOUND)` + red `    at TAJNA-<uuid>`
  (`CURI: DA`). Uzrok: okviri se uzimaju iz `err.stack`, koji počinje porukom; filter `/^\s+at /` propušta svaki red poruke tog oblika.
- Uticaj: zaštita i dalje zavisi od oblika poruke (red ne smije počinjati sa `at `). requestKey i voucherId (64 hex) bi i tada bili
  `[hex]`, pa O-18 vrijednosti ne cure; cure ne-hex identifikatori. Nijedna stvarna emulatorska poruka nema takav red (E2); produkcijski format
  nije provjeren. Mutacija R-M47 (bez redakcije okvira) preživljava 10/10 — upravo ta zadnja odbrana nije testirana.
- Predložena ispravka (ne primjenjujem): okvire uzimati iz `err.stack` tek POSLIJE poruke (npr. ako `stack.startsWith(`${name}: ${message}`)`,
  odsjeći taj prefiks, inače odbaciti okvire), i u I04-T20 dodati slučaj sa redom `\n    at <hex>` / `\n    at <ne-hex ID>` u poruci gRPC greške
  (obara R-M47 i trenutni propust).

### R-08 — NOTE — dokumentovana redakcija `err.name` i okvira nije pokrivena testom

- TEST_REPORT FIX LOOP 2: „`name` i okviri idu kroz istu redakciju”. R-M47 i R-M48 preživljavaju 10/10. Ekvivalentne nad ulazima i04 (E2, E3),
  ali i05/i06 (voucherId u putanji, D-3) to ne smiju naslijediti netestirano.
- Predlog: u I04-T20 (c) (ili prvi test i05 po uzoru na njega) dodati `err.name` sa hex-om i ručno postavljen `err.stack` sa hex-om / putanjom
  u okviru (kao napadi d4, d5).

### R-09 — NOTE — prag ≥ 32 i velika slova hex redakcije nisu testirani

- ODLUKE §6 (h) i TEST_REPORT navode „svaki niz od ≥ 32 uzastopna hex znaka”; R-M46 (prag 64) i R-M53 (samo mala slova) preživljavaju 10/10.
  Ekvivalentne za O-18 vrijednosti (E1). Skraćeni ID ispod 32 znaka ostaje (d1) — to je dokumentovana heuristika.
- Predlog: slučajevi sa 32-hex i velikim slovima u I04-T20 (c), ili ispraviti tekst odluke na „64 hex” ako je to stvarni ugovor.

### R-10 — NOTE — rukovalac baca za ne-Error bez primitivne vrijednosti

- e5 (`Object.create(null)`) i e6 (`toString` baca): `opisNeocekivaneGreske` baca iz `String(err)`, zapis se ne upisuje, odgovor po §27 izostaje;
  Express tada predaje novu grešku `finalhandler`-u (ne-§27 odgovor i, van `NODE_ENV=test`, nerediguje `err.stack`; u e6 poruka nosi hex).
- Nedostižno: kod i04 baca samo `Error` / `GreskaApi`; Firestore i Express bacaju `Error`.
- Predlog: `try { … } catch { return '(opis greške nedostupan)'; }` oko opisa, sa testom.

### R-11 — NOTE — numerički `code` na ne-gRPC grešci daje pogrešnu dijagnozu

- b1: obični `Error` sa `code = 5` → `Error (code 5 NOT_FOUND)`, poruka izostavljena. Smjer je bezbjedan (manje u logu), ali „NOT_FOUND” nije
  istina. Nedostižno u i04 (nijedan kod ne postavlja numerički `code`; Node errno je string, c1).

### R-12 — NOTE — identifikatori koji nisu niz ≥ 32 hex ostaju u ne-gRPC poruci; veličina loga nije ograničena

- g1 (requestId UUID), g2 (uid), d2 / d3 (64 hex razdvojen crticama ili razmacima), e2b: ostaju u logu. requestId i uid nisu u opsegu O-18
  (putanje, requestKey, voucherId), ali I04-T16 (a) zabranjuje requestId u logu za sve ishode API-03. Nedostižno: sve ne-gRPC poruke u i04 su
  statičke (E2). Poruka od ~1 MB se upisuje cijela (V5-1).
- Predlog za i05+: pravilo „poruke `new Error` u servisima su statičke” upisati uz ODLUKE §6 (h) (i provjeravati u review-u); opciono
  ograničiti dužinu opisa u logu.

## 7. Otvorena pitanja za Orchestrator-a

**P-5 (R-07, R-08, R-09):** kada zatvoriti preostalu zavisnost od oblika poruke (redovi `at …` iz poruke) i testne praznine redakcije?
- Opcija A: FIX LOOP 3 u i04 prije merge-a.
- Opcija B (preporuka): upis u ODLUKE §6 (h) kao obaveza i05 — prvi korak i05 (API-05 / API-06, voucherId u putanji) uvodi odsijecanje poruke iz
  `err.stack` i testove koji obaraju R-M47 i R-M48. Razlog: nijedan ulaz i04 ne dostiže propust, requestKey i voucherId se i u hipotetičkom
  obliku rediguju, a P-3 je u dosegu i04 ispunjen za sve stvarne oblike grešaka (emulator).
- SRS ne propisuje format serverskog loga; odluka je O-18 / P-3 nivoa.

**P-6 (R-10 … R-12):** samo upis u ODLUKE §7 (preporuka) ili obaveza za i05? Preporuka: §7 + pravilo statičkih poruka u §6 (h).

## 8. Šta nije provjereno i zašto

- Format grešaka produkcionog Firestore-a (testovi rade isključivo nad emulatorom, CLAUDE.md); R-07 ostaje otvoren za taj slučaj.
- Grana `res.headersSent` kroz stvarni Express `finalhandler` van `NODE_ENV=test` (N-11; nijedna ruta ne šalje zaglavlja prije greške) —
  provjereno samo da rukovalac ne bilježi ništa i poziva `next(err)` (h2).
- Builder-ova dopunska mutacija M44b i serije M43-r / M43-v nisu ponovo izvršene (M44, M43-vr, M43-vr-g ih pokrivaju).
- Android dio provjeren samo kroz `provjera.ps1` (`BUILD SUCCESSFUL` ×2); van opsega i04.
- Uid sa `/` (greška SDK-a „documentPath … must point to a document” sa uid-om u poruci) — nije izvršeno; Firebase Auth klijentski nalozi
  dobijaju generisan uid, pa nije dostižno kroz API; uid nije u opsegu O-18.

V3 (dokumentacija):
- TEST_REPORT FIX LOOP 2: svaki n/10 koji sam ponovio se slaže (nemutiran 0/10; M43-vr i M43: I04-T20 10/10, I04-T16 (c) 0/10; M43-vr-g:
  I04-T16 (c) 10/10; M44: I04-T20 10/10 — kod mene padaju tačno (a) i (b); M45: I04-T20 10/10); brojevi 63 / 105 / 30 se slažu.
- IMPLEMENTATION_LOG (FIX LOOP 2 tabela, commit-i, ograničenja), ODLUKE (status i04; P-3, P-4 u §3; §6 (h) ažuriran; §6 (o) obaveza i07 iz P-4;
  §6 (p) N-12; §7 N-11 i dopuna R-05; redoslijed (j), (k), (l) ispravljen), TRACEABILITY (API-03 i NFR-07 sa I04-T20) — prisutni i u skladu
  sa kodom.
- `git diff 54b2e0b..HEAD -- docs/iteracije/i04_review.md docs/iteracije/i04_review_fix1.md docs/srs` → prazno (0 redova); SHA-256 SRS-a
  provjeren u `provjera.ps1`.

V4 (opseg):
- `git diff 54b2e0b..HEAD --stat -- backend/src` → samo `backend/src/greske/obradaGresaka.js | 50 +++++--` (P-3 poštovan).
- `git diff 54b2e0b..HEAD -- backend/package*.json firebase/tests/package*.json package*.json` → prazno; `backend/src/rute`, `aplikacija.js` nisu dirani
  (nema novih ruta).
- Commit-i `0c80582` … `3d2bf74`: autor `anaspasojevic <anaspasojevic09@gmail.com>`; pretraga poruka i diff-a za `Co-Authored|Claude|Generated with|Anthropic`
  → bez pogodaka.

## 9. PRESUDA

**ITERATION ACCEPTED.** R-05 i R-06 su ZATVORENI sopstvenim dokazom; nema novog BLOCKER-a ni MAJOR-a; nijedna neekvivalentna mutacija ne
preživljava (R-M46, R-M47, R-M48, R-M53 ekvivalentne nad domenom ulaza i04, dokazi E1–E3); novi MINOR R-07 nije dostižan u i04 i ne izvlači
requestKey ni voucherId. R-07 … R-12 idu Orchestrator-u (P-5, P-6) za ODLUKE i i05.
