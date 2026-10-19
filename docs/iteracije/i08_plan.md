# i08 — Plan (PLANNER)

Iteracija 8: Security Rules lockdown 12/12 i B-1. Grana `iteracija-08` (iz `main` = merge `3d2ec94`, tag `i07`).
Izvori: `CLAUDE.md`, `docs/iteracije/i08_brief.md` (obavezujući), `docs/ODLUKE.md` (verzija na tagu `i07`), SRS 3.1
(`docs/srs/FuelPoints_SRS_3_1.docx`, normativan, SHA-256 `7D866413…C60228` provjeren; `.md` čitljiva kopija), `docs/iteracije/i07_plan.md`
(struktura), `i07_review.md` (R-01, R-02), kod na vrhu grane (`3d2ec94` + brief).
Datum plana: 2026-10-19. Uloga: PLANNER (bez koda). Režim: ekspresni (O-30, O-31). `provjera.ps1` nije pokretan.

Oznake: otvorena pitanja `i08/P-n` (sekcija 13); dopunski testovi `I08-T01 … I08-T04`; ključne mutacije `D01 … D06` (sekcija 9).
Probe su rađene privremenim skriptama u scratchpad-u sesije (van repoa, nisu commit-ovane); ishod je u sekciji 3.2.

---

## 1. SRS zahtjevi u opsegu

| Zahtjev | Šta i08 dokazuje |
|---|---|
| §31 | `firebase/firestore.rules` sadržinski identičan §31 (samo razmaci / uvlačenje / prazni redovi); automatski test I08-T01 (O-37). |
| §30 RULE-T01 … RULE-T12 | Svaki RULE-Txx ima test sa tačno tom oznakom u nazivu, pokriva cijeli tekst stavke §30 i granice iz §31 (5.2); RULE-T12 konačan (5.3). |
| §25.1 … §25.10, NFR-03 | Default deny i owner isolation kroz RULE-T01 … RULE-T12 + postojeće I02-T15, I03-T20, I04-T17, I06-T22. |
| AC-02 | Nijedan klijentski write na `loyaltyAccounts`, `purchases`, `loyaltyLedger`, `vouchers`, `rewardRequests`, `redemptionRequests` (ni vlasnika sa `uid == auth.uid`) nije dozvoljen: RULE-T07/T08/T09/T11/T12 + objedinjena matrica I08-T02. |
| AC-12 (backend dio) | Jedan završni `provjera.ps1` → tabela API-T01 … API-T12 i RULE-T01 … RULE-T12 (fajl, naziv, PASS) u TEST_REPORT (5.6). |
| §8.2 / i03/P-5, B-1 | `loyaltyUid` sa bilo kojim `\p{Cc}` → 404 `LOYALTY_ACCOUNT_NOT_FOUND` bez pristupa bazi (5.5, I08-T03). |
| NFR-07 | Inspekcija tajni (I08-T04, komande u 5.7; rezultat u TEST_REPORT). |

## 2. Van opsega

Android (i09, i10), composite indeksi (ograničenja (e), (i) → i10), POS Simulator (i11), pravi Firebase projekat (O-2 → i11), FCM / device
registrations, svako pravilo ili kolekcija van §31, izmjena API-01 … API-07 osim B-1, novi npm paketi, test-only kod u `backend/src`,
izmjena `firestore.indexes.json`. O-38: R-01 i R-02 iz review-a i07 samo u dokumentaciji, bez koda.

## 3. Polazno stanje i probe

### 3.1 Korak 0

`git fetch --all --tags`; `main` = `3d2ec94` = `i07^{commit}` (anotirani tag); SRS hash `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`
odgovara; grana `iteracija-08`; brief doslovno u `docs/iteracije/i08_brief.md` (commit „i08: Iteration Brief (Orchestrator)”, push -u).

### 3.2 Probe (scratchpad, nisu commit-ovane; bez emulatora, bez novih paketa)

(a) **§31 iz `.md` naspram `firestore.rules`.** Sekcija između `# 31. FIRESTORE RULES` i `# 32. ACCEPTANCE CRITERIA` ima tačno jedan
` ```javascript ` blok. Markdown escape-ovi u bloku: tačno `\[`, `\]`, `\>`, `\<`, `\*` (poslije uklanjanja nijedna `\` ne ostaje; nema ne-ASCII znakova).
Normalizacija red-po-red (CRLF/LF, `trim`, niz razmaka → jedan razmak, bez praznih redova): **77 = 77 redova, 0 razlika.** U `.md` su
nastavni redovi (`&& …`) izgubili uvlačenje — to je razlika u razmaku, normalizacija je pokriva.

(b) **§31 iz `.docx` naspram `firestore.rules`.** Kopija `.docx` → `.zip` u scratchpad-u, `Expand-Archive` (ugrađen PowerShell), tekst `<w:t>`
iz `word/document.xml`; §31 je posljednje pojavljivanje naslova (prvo je sadržaj). Kod je u `.docx` jedan paragraf sa `<w:br w:type="textWrapping"/>`,
pa je poređenje rađeno bez ikakvih razmaka: **1756 = 1756 znakova, identično.** Zaključak: `.md` je za §31 pouzdan izvor (O-37, i08/P-1).

(c) **Mapa RULE-Txx → postojeći testovi (`firebase/tests`).**

| RULE | Postojeći test | Šta fali u odnosu na §30 / §31 (granice su danas u I0x testovima, ne u RULE-Txx) |
|---|---|---|
| T01 | `korisnikINalog` — neautentifikovan get | §30 „read” uključuje i list: neautentifikovan list `users` DENY. |
| T02 | owner get | — |
| T03 | cross-user get; list users (A, B) | — |
| T04 | update dužine 4, 1, 100 → ALLOW | 0 (`''`) i 101 DENY; `displayName` nije string (5) DENY; `updatedAt` klijentski `Timestamp.now()` DENY; update samo `displayName` (bez `updatedAt`) DENY. (Danas dio u I02-T15.) |
| T05 | dodatna polja + setDoc sa dodatnim poljem | — |
| T06 | owner get | — |
| T07 | create/update/merge/delete (svi konteksti) | — |
| T08 | list `where uid == A limit 20` ALLOW, owner get; write DENY | limit 21, bez limit-a, bez `where uid` (limit 20), `where uid == B` → DENY. (Danas u I03-T20.) |
| T09 | isto za vouchers | isto kao T08 za vouchers. (Danas u I04-T17.) |
| T10 | owner get, readAt null → serverTimestamp ALLOW; title/body (i uz readAt) DENY | owner list `where uid limit 50` ALLOW; 51, bez limit-a, bez `where` DENY; readAt klijentsko vrijeme DENY; drugi put readAt DENY. (Danas u I03-T20.) |
| T11 | get/list/list where/create/update/delete × 3 konteksta | — |
| T12 | „(preliminarno)”: 3 kolekcije × {get, list, set, delete} × {neautentifikovan, A}; dokument `{ proba: true }` bez `uid` | drugi korisnik; „vlasnik” (dokument sa `uid == auth.uid`); `update`, `create` novog dokumenta, list `where uid == A limit 20`; podkolekcije. |

API-T01 … API-T12 postoje u `backend/test/emulator/*` (API-T10 i API-T12 po 2 testa) — ulaze u AC-12 tabelu bez izmjene.

(d) **NFR-07 brza proba:** `git ls-files` ne sadrži `.env`, `google-services.json`, `*service-account*`, `*-key.json` (samo `.env.example`
sa placeholder-om); `git grep` obrazaca tajni pogađa samo dokumentaciju (i01_review, i08_brief). POS ključevi se u `konfiguracija/posKljucevi.js`
čuvaju samo kao SHA-256 otisci (i03/P-3); testni ključevi se generišu u toku izvršavanja (`test/pomocnici/posKljuc.js`).

## 4. Raspored fajlova

| Fajl | Izmjena |
|---|---|
| `firebase/firestore.rules` | **bez izmjene** (proba 3.2: = §31). Ako I08-T01 ipak nađe sadržinsku razliku → ispravka prema §31 + OD-n. |
| `firebase/tests/normativnaPravila.test.js` | NOV: I08-T01 (bez emulatora; pokreće se istom `npm test` komandom). |
| `firebase/tests/korisnikINalog.test.js` | proširenje RULE-T01, RULE-T04. |
| `firebase/tests/kupovineObavjestenjaLedger.test.js` | proširenje RULE-T08, RULE-T10. |
| `firebase/tests/nagradeIVauceri.test.js` | proširenje RULE-T09. |
| `firebase/tests/podrazumijevanaZabrana.test.js` | RULE-T12 konačno (zaglavlje bez „preliminarno”, `provjeriZabranu` proširen); I08-T02 (AC-02). |
| `backend/src/validacija/identifikator.js` | B-1: zabrana `\p{Cc}` u `jeIspravanIdDokumenta` (i08/P-3, preporuka B). |
| `backend/src/validacija/zahtjevIzdavanja.js` | uklanja lokalni `KONTROLNI_ZNAK` (provjera prelazi u zajedničku funkciju; ponašanje `rewardId` identično). |
| `backend/test/emulator/kupovina.test.js` | I08-T03 (novi test; postojeći I03-T09 netaknut). |
| `docs/*` | TRACEABILITY, ODLUKE, IMPLEMENTATION_LOG, TEST_REPORT (sekcija 7, korak K4). |

Nijedan novi paket; `package.json` / `package-lock.json` nepromijenjeni; `firestore.indexes.json` nepromijenjen.

## 5. Detaljan dizajn

### 5.1 I08-T01 — pravila = §31 (O-37, i08/P-1, i08/P-2)

`firebase/tests/normativnaPravila.test.js`, `node:test` + `assert/strict`, samo `node:fs`:
1. Čita `../../docs/srs/FuelPoints_SRS_3_1.md` i `../firestore.rules` (putanje preko `import.meta.url`, kao postojeći testovi).
2. Isijeca tekst od `# 31. FIRESTORE RULES` do `# 32. ACCEPTANCE CRITERIA`; asercija: oba naslova nađena, tačno jedan ` ```javascript ` blok.
3. Uklanja markdown escape-ove: `\` ispred ASCII interpunkcije → sam znak (opšte pravilo CommonMark-a, pokriva `\[ \] \< \> \*`);
   asercija: poslije toga u bloku nema `\` (rules jezik iz §31 ne koristi `\`, pa preostala kosa crta znači neprepoznat escape → test pada, ne „guta” se).
4. Normalizacija oba teksta (i08/P-2): podjela na redove (`\r?\n`), `trim`, niz bijelih znakova → jedan razmak, izbacivanje praznih redova.
5. `assert.deepStrictEqual(redoviPravila, redoviSrs)` — pri razlici `node:test` ispisuje tačan red.
6. (b) Kontrola komparatora (da test nije prazan): u memoriji izmijenjena kopija pravila (`<= 20` → `<= 21` u prvom pojavljivanju) mora dati razliku;
   kopija sa drugačijim uvlačenjem i dodatnim praznim redovima mora dati jednakost.

Jednokratna ručna provjera prema `.docx`-u (O-37): Builder ponavlja postupak 3.2 (b) u scratchpad-u (skripta se ne commit-uje) i upisuje komande i
rezultat („1756 = 1756, identično”) u TEST_REPORT.

### 5.2 Dopune RULE-T01 … RULE-T11 (samo proširenje; nijedna postojeća asercija se ne uklanja ni ne slabi)

Granice iz I02-T15 / I03-T20 / I04-T17 se **dupliraju** u RULE-Txx (I0x testovi ostaju netaknuti) tako da svaki RULE-Txx sam pokriva §30 + §31:
- **RULE-T01:** + neautentifikovan `getDocs(collection('users'))` DENY.
- **RULE-T04:** postojeći ALLOW (dužine 4, 1, 100) ostaju; nov test `RULE-T04 granice: displayName 0 / 101 / nije string, updatedAt ≠ request.time,
  bez updatedAt → DENY`: `''`, `'y'.repeat(101)`, `5` (uz `serverTimestamp()`) DENY; `{ displayName: 'Novo', updatedAt: Timestamp.now() }` DENY;
  `{ displayName: 'Novo' }` DENY. U nazivu postojećeg testa ostaje oznaka RULE-T04.
- **RULE-T08:** nov test `RULE-T08 granice upita: limit 20 ALLOW; limit 21, bez limit-a, bez where uid, tuđi uid → DENY` (vlasnik):
  `where uid == A limit 20` ALLOW (+ tačno A1, A2); `limit 21`, bez `limit`, `limit(20)` bez `where`, `where uid == B limit 20` DENY.
- **RULE-T09:** isti test za `vouchers` (limit 20 / 21).
- **RULE-T10:** nov test `RULE-T10 list limit 50 / 51 i granice readAt`: `where uid == A limit 50` ALLOW; `limit 51`, bez `limit`, bez `where` DENY;
  `readAt: Timestamp.now()` DENY; prvi `readAt: serverTimestamp()` ALLOW pa drugi DENY; `readAt: null` (null → null) DENY. Postojeći title/body ostaju.
- RULE-T02, T03, T05, T06, T07, T11: već pokrivaju cijelu stavku §30; bez izmjene.

### 5.3 RULE-T12 konačno (`podrazumijevanaZabrana.test.js`)

- Zaglavlje fajla i `describe`: „RULE-T12 client access nad internal/unknown kolekcijom → DENY” (bez „preliminarno”, bez „Konačan oblik u Iteraciji 8”).
- Priprema (bez pravila): svaki dokument `{ uid: VLASNIK, proba: true }` — „vlasnik” je dokument sa `uid == auth.uid`.
- Konteksti: neautentifikovan, `korisnikA` (vlasnik), `korisnikB` (drugi). Za svaku putanju i kontekst: `get`, `list` kolekcije, `list where uid == A
  limit 20`, `set` postojećeg, `create` novog ID-a (setDoc na nepostojeći), `update`, `delete` → DENY. Kolekcija za `list` = roditeljska putanja
  dokumenta (sve osim posljednjeg segmenta), da radi i za podkolekcije.
- Testovi (oznaka RULE-T12 u svakom nazivu): `rewardRequests/kljuc1`; `redemptionRequests/kljuc1`; `nepoznataKolekcija/dok1`;
  podkolekcije: `nepoznataKolekcija/dok1/podkolekcija/dok2`, `users/korisnikA/privatno/dok1`, `loyaltyAccounts/korisnikA/istorija/dok1`,
  `rewardRequests/kljuc1/pod/dok1` (podkolekcija ispod dozvoljenog `users/{uid}` dokazuje da `match /users/{uid}` ne pokriva podkolekcije);
  + `collectionGroup('podkolekcija')` list (vlasnik) DENY.
- Postojeći skup (3 putanje × {get, list, set, delete} × {neautentifikovan, A}) je podskup novog → nijedna asercija ne nestaje.

### 5.4 AC-02 — I08-T02 (`podrazumijevanaZabrana.test.js`)

Objedinjena matrica „Android ne može povećati bodove”: vlasnik A (i B, neautentifikovan) nad svakom od 6 kritičnih kolekcija: `create` dokumenta sa
`uid == A`, `update`, `set merge`, `delete` → DENY; konkretno povećanje: `loyaltyAccounts/A` `availablePoints + 1000` (update i merge), nova
`purchases/SIM01__X` sa `earnedPoints`, nov `loyaltyLedger/earn_…` EARN, nov `vouchers/…` ACTIVE, `rewardRequests` / `redemptionRequests` zapis.
Dokumenti pripremljeni bez pravila u kanonskom obliku (helperi prepisani lokalno, kao u ostalim fajlovima). Poslije svih pokušaja: `withSecurityRulesDisabled`
čitanje → `loyaltyAccounts/A` nepromijenjen (`deepStrictEqual`).

### 5.5 B-1 — `loyaltyUid` bez kontrolnih znakova (i08/P-3)

Preporuka B: u `jeIspravanIdDokumenta` (`validacija/identifikator.js`) dodati uslov `!/\p{Cc}/u.test(vrijednost)` i komentar (i04/P-9, B-1);
iz `provjeriRewardId` ukloniti `|| KONTROLNI_ZNAK.test(rewardId)` i konstantu. Funkciju koriste tačno dva mjesta (`tijeloKupovine.js` → `loyaltyUid`,
`zahtjevIzdavanja.js` → `rewardId`), pa je ponašanje `rewardId` identično (I04-T03 (a) ostaje zelen, dokaz), a `loyaltyUid` dobija istu provjeru —
jedna kopija regex-a. Mjesto provjere u `provjeriTijeloKupovine` se ne mijenja: posljednja, poslije `occurredAt` (i03/P-6), bez pristupa bazi (O-10).
`\p{Cc}` = U+0000–U+001F i U+007F–U+009F (uključuje NUL, `\t`, `\n`, `\r`, DEL, U+0085). Ostali znakovi (razmak, `č`, emoji) — nepromijenjeno.

### 5.6 AC-12 izvještaj

„Jedan završni run” = drugi (završni) `.\skripte\provjera.ps1` na commit-u koda X (i08/P-4): backend (`npm test` + `npm run test:emu`) i Rules (`npm test`)
su koraci istog izvršavanja. Builder iz izlaza tog run-a pravi tabelu u TEST_REPORT: 24+ redova (API-T01 … API-T12, uključujući oba testa API-T10 i
API-T12; RULE-T01 … RULE-T12, svaki test sa tom oznakom) — kolone ID, fajl, tačan naziv testa, PASS — i ukupne brojeve (`# pass`, `# fail 0`) po suiti.

### 5.7 NFR-07 inspekcija — I08-T04 (iz korijena, PowerShell; izlaz u TEST_REPORT)

```
git ls-files | Select-String -Pattern '(^|/)\.env$','google-services\.json','service-account','-key\.json$','\.pem$','\.p12$'   # prazno
git grep -nIE "BEGIN (RSA |EC )?PRIVATE KEY|\"private_key\"|AIza[0-9A-Za-z_-]{35}" -- . ':!docs/srs'                       # prazno
git grep -niIE "x-pos-api-key\s*[:=]\s*['\"]?[A-Za-z0-9_-]{43}" -- .                                                       # prazno
git grep -nIE "POS_API_KLJUCEVI=[^\s#]*:[A-Za-z0-9_-]{43}" -- .                                                            # prazno (samo placeholder)
git grep -n "createHash('sha256')" -- backend/src/konfiguracija/posKljucevi.js                                            # otisak, i03/P-3
git check-ignore -v .env firebase/tests/firestore-debug.log                                                                # oba ignorisana
```

Pogoci u dokumentaciji koja citira obrasce (brief, i01_review, ovaj plan) se navode i obrazlažu, ne brišu. NFR-07 za Android APK — i09/i10 (van opsega).

### 5.8 O-38

ODLUKE §7: R-01 (i07) — prozor K1 → K4a: init NOT_INITIALIZED korisnika commit-ovan između K3 i K4a daje 500 na prvom DELETE-u; ponovljen DELETE
popravlja; poznato ograničenje. ODLUKE §8: R-02 (i07, NOTE, 503 pod kontencijom) — backlog bez roka. Bez koda.

## 6. Ugovor odgovora (B-1)

`POST /api/v1/pos/purchases` sa `loyaltyUid` koji sadrži `\p{Cc}`, a ostala polja ispravna → `404 { "error": { "code": "LOYALTY_ACCOUNT_NOT_FOUND", … } }`
po §27, bez stack-a, 0 pristupa Firestore-u. Ako je i neko ranije polje neispravno, važi raniji kod (redoslijed i03/P-6). Sve ostalo nepromijenjeno.

## 7. Koraci implementacije (jedan korak = jedan commit + push; testovi prije koda; O-30 (a): `provjera.ps1` tačno 2×)

Prije svakog emulator run-a: `$env:Path = "C:\Program Files\Java\jdk-24\bin;" + $env:Path`; portovi 8080 i 9099 slobodni prije i poslije.

| K | Sadržaj | Commit |
|---|---|---|
| K1 | I08-T01, dopune RULE-T01/T04/T08/T09/T10, RULE-T12 konačno, I08-T02. `cd firebase\tests; npm test` — očekivano zeleno odmah (pravila = §31); ako nešto pada → nalaz, ispravka pravila prema §31, OD-n. Ručna `.docx` provjera (5.1). | `i08: RULE-T01 … RULE-T12 konačno i test pravila = §31 (I08-T01, I08-T02)` |
| K2 | I08-T03 u `kupovina.test.js`; crveni run (`npm run test:emu:ciljano -- test/emulator/kupovina.test.js`) zabilježen prije koda (i07/K-3); zatim 5.5; ciljani run + `npm test` zeleni; **`provjera.ps1` #1**. | `i08: B-1 zabrana kontrolnih znakova u loyaltyUid (§8.2, i03/P-5)` |
| K3 | Mutacije D01 … D06 (lokalno, svaka pa `git restore`); NFR-07 inspekcija (I08-T04); **`provjera.ps1` #2 (završni)** na commit-u koda X. | — (bez izmjene koda) |
| K4 | TEST_REPORT (crveni run, `.docx` provjera, mutacije, NFR-07, AC-12 tabela, commit X), TRACEABILITY, ODLUKE (§1 i07 ACCEPTED tag `i07` merge `3d2ec94`, i08 status; B-1 zatvoren u §2 i §8; O-37, O-38 u §3; i04/P-9 red; §7 R-01; §8 R-02; i08/P-n), IMPLEMENTATION_LOG. PR `iteracija-08` → `main` bez merge-a. | `i08: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost i registar odluka` |

## 8. Testovi

Konvencije kao postojeći `firebase/tests/*.test.js` (`initializeTestEnvironment`, `clearFirestore` u `beforeEach`, `ocekujZabranu` / `ocekujDozvolu` sa
opisom) i `backend/test/emulator/kupovina.test.js` (`provjeriOdbijanjeBezBaze` sa `omotacBaze`, `brojPristupa === 0`).

### 8.1 SRS katalog (§30) — konačni oblik

| ID | Fajl | Konačni sadržaj |
|---|---|---|
| RULE-T01 | `korisnikINalog.test.js` | neautentifikovan get + list `users` → DENY |
| RULE-T02, T03, T05, T06, T07 | isti | nepromijenjeno (3.2 (c)) |
| RULE-T04 | isti | ALLOW 4 / 1 / 100; DENY 0 / 101 / ne-string / `updatedAt` klijentski / bez `updatedAt` |
| RULE-T08 | `kupovineObavjestenjaLedger.test.js` | postojeće + granice upita (5.2) |
| RULE-T09 | `nagradeIVauceri.test.js` | postojeće + granice upita (5.2) |
| RULE-T10 | `kupovineObavjestenjaLedger.test.js` | postojeće + list 50/51, readAt granice (5.2) |
| RULE-T11 | isti | nepromijenjeno |
| RULE-T12 | `podrazumijevanaZabrana.test.js` | 5.3 |

### 8.2 Dopunski testovi I08

| ID | SRS / odluka | Fajl | Asercije |
|---|---|---|---|
| I08-T01 | §31, O-37, i08/P-1, P-2 | `firebase/tests/normativnaPravila.test.js` | (a) normalizovani redovi `firestore.rules` `deepStrictEqual` normalizovani §31 iz `.md`; jedan blok; bez preostalih `\`. (b) kontrola komparatora (5.1 tačka 6). |
| I08-T02 | AC-02, §25.3–§25.5, §25.7, §25.9, NFR-03 | `firebase/tests/podrazumijevanaZabrana.test.js` | 5.4 |
| I08-T03 | B-1, §8.2, i03/P-5, O-10, §27 | `backend/test/emulator/kupovina.test.js` | `loyaltyUid` ∈ {`a\u0000b`, `\u0000`, `a\nb`, `abc\n` (završni prelom), `a\tb`, `\r`, `a\u001fb`, `\u007f`, `a\u0085`, `\u009f`} (ostala polja ispravna) — svaki → `provjeriOdbijanjeBezBaze` 404 `LOYALTY_ACCOUNT_NOT_FOUND`, `brojPristupa === 0`, bez `stack`. Redoslijed: `a\u0000b` + `volumeMl: 0` → 422 `INVALID_VOLUME`. Kontrola: ACTIVE nalog `korisnik č` (razmak + ne-ASCII, nije Cc) → 201 (nepromijenjeno ponašanje). |
| I08-T04 | NFR-07 | — (inspekcija, 5.7) | komande 5.7, izlaz u TEST_REPORT |

Regresija: i01–i07 suite bez izmjene postojećih asercija (I04-T03 (a) dokazuje nepromijenjeno ponašanje `rewardId` poslije premještanja provjere).

## 9. Ključne mutacije (O-31 (c); D = deterministička 1/1; lokalno, svaka pa `git restore`)

Svaka mutacija pravila obara i I08-T01 (tekst ≠ §31) — to se bilježi, ali mutacija se računa „ubijenom” samo ako padne navedeni RULE / I08 test
(dokaz da ponašajni test, ne samo poređenje teksta, štiti pravilo).

| # | Mutacija | Ciljani test |
|---|---|---|
| D01 | `vouchers` list bez `&& request.query.limit <= 20` | RULE-T09 (limit 21 DENY) |
| D02 | `users` update bez `changedOnly(['displayName', 'updatedAt'])` | RULE-T05 |
| D03 | `notifications` update bez `&& request.resource.data.readAt == request.time` | RULE-T10 (klijentski readAt DENY) |
| D04 | `loyaltyLedger`: `allow read: if signedIn(); allow write: if false;` | RULE-T11 |
| D05 | `rewardRequests` i `redemptionRequests`: `allow read: if signedIn();` | RULE-T12 (i I04-T17, I06-T22) |
| D06 | B-1 provjera uklonjena iz `jeIspravanIdDokumenta` | I08-T03 (`brojPristupa > 0`) i I04-T03 (a) |

Preživjela → dopuna testa, commit `i08: ojačan test … (nalaz mutacije Dnn)`, OD-n.

## 10. Definition of Done (komande iz korijena, PowerShell)

```
cd firebase\tests; npm test; cd ..\..
cd backend; npm test; npm run test:emu:ciljano -- test/emulator/kupovina.test.js; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE                                   # 0, tačno 2× u sesiji
git diff i07 -- firebase/firestore.indexes.json firebase/firestore.rules   # prazno (rules prazno ako I08-T01 zelen bez ispravke)
git diff i07 --stat -- '*package*.json'                                  # prazno
git grep -n "preliminarno" -- firebase/tests                              # prazno
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash   # 7D866413…C60228
git log i07..HEAD --format=%B | Select-String -Pattern 'Co-Authored|Claude|Generated'   # prazno
```

[ ] I08-T01 … I08-T03 zeleni; RULE-T01 … RULE-T12 konačni i zeleni; regresija i01–i07 zelena. [ ] AC-12 tabela iz završnog run-a.
[ ] D01 … D06 D 1/1. [ ] I08-T04 u TEST_REPORT. [ ] Dokumentacija (K4). [ ] PR bez merge-a.

## 11. Rizici i poznata ograničenja

- I08-T01 zavisi od `.md` kopije; ona je nepromjenljiva (CLAUDE.md), a jednokratna `.docx` provjera (5.1) veže je za normativni tekst. Ako se `.md`
  ikad regeneriše drugim alatom, I08-T01 može pasti zbog formata — to je ispravno ponašanje (traži ponovnu provjeru), ne lažno zeleno.
- Normalizacija red-po-red je stroža od „samo razmaci”: drugačiji prelom reda u `firestore.rules` obara test. Prihvatljivo (pravila su već red-po-red = §31).
- Emulator i produkcija mogu se razlikovati za `\p{Cc}` u ID-u dokumenta — B-1 to zaobilazi jer do baze ne dolazi.
- AC-12 je ovdje samo backend dio; završna potvrda u i11 (pravi projekat, O-2).

## 12. TRACEABILITY redovi (Builder popunjava „Status”)

| Red | Kod | Test |
|---|---|---|
| §31, §25.1 … §25.10, D-2 (lockdown) | `firebase/firestore.rules` | I08-T01, RULE-T01 … RULE-T12 |
| §30 RULE-T01 … RULE-T12 | `firebase/firestore.rules` | RULE-T01 … RULE-T12 (fajlovi 8.1) |
| NFR-03 | `firebase/firestore.rules` | RULE-T01 … RULE-T12, I02-T15, I03-T20, I04-T17, I06-T22 |
| AC-02 | `firebase/firestore.rules` | I08-T02, RULE-T07, T08, T09, T11, T12 |
| AC-12 (backend dio) | — | TEST_REPORT tabela (5.6) |
| §8.2 / i03/P-5, B-1 | `backend/src/validacija/identifikator.js`, `tijeloKupovine.js` | I08-T03, I03-T09 |
| i04/P-9 (rewardId) | `backend/src/validacija/identifikator.js`, `zahtjevIzdavanja.js` | I04-T03 (a) |
| NFR-07 | `konfiguracija/posKljucevi.js`, `.gitignore` | I08-T04 (inspekcija) |

## 13. Otvorena pitanja (`i08/P-n`)

SRS nije nejasan ni kontradiktoran u opsegu i08 (§30 „readAt null→timestamp” je §31 precizirao na `request.time`; §25.7 „vouchers potrebni Rewards
ekranu” §31 precizira kao list sa `limit <= 20` — §31 je normativna politika, bez sukoba). Pitanja ispod su izbor tehnike, sa preporukom.

**i08/P-1 — izvor normativnog teksta za I08-T01 (O-37; §31).**
A) `.md` kopija + uklanjanje markdown escape-ova, uz jednokratnu ručnu `.docx` provjeru u TEST_REPORT. B) Fiksni tekst §31 prepisan u test fajl.
C) Test čita `.docx` direktno (ZIP parsiranje kroz `node:zlib`, bez paketa).
**Preporuka: A.** Proba 3.2: `.md` = rules 77/77, `.docx` = rules 1756/1756. B dodaje treću kopiju koja može odstupiti od SRS-a; C je ~60 redova
ZIP/XML koda u testu radi istog rezultata.

**i08/P-2 — normalizacija (O-37).**
A) Red-po-red: `trim`, niz razmaka → jedan, bez praznih redova. B) Cijeli tekst bez ikakvih bijelih znakova (kao `.docx` proba).
**Preporuka: A** — strožija (B bi prihvatio npr. spajanje `allow read` u `allowread`) i daje čitljivu razliku po redu; prolazi na današnjem stanju.

**i08/P-3 — mjesto B-1 provjere (brief: „ista provjera, ne nova kopija regex-a”).**
A) `export function sadrziKontrolniZnak` u `identifikator.js`, poziv u `provjeriRewardId` i `provjeriTijeloKupovine`.
B) Uslov `\p{Cc}` unutar `jeIspravanIdDokumenta`; lokalna provjera u `provjeriRewardId` se uklanja.
**Preporuka: B** — jedan uslov na jednom mjestu; funkciju koriste tačno `loyaltyUid` i `rewardId`, pa je za `rewardId` ponašanje identično
(I04-T03 (a)); D06 jednim izostavljanjem obara oba testa.

**i08/P-4 — značenje „jedan završni run” za AC-12.**
`provjera.ps1` pokreće backend emulator suite i Rules suite kao dva `emulators:exec` koraka. **Preporuka:** jedan završni run = jedno izvršavanje
`provjera.ps1` (izlazni kod 0) na commit-u koda X; tabela navodi oba koraka. Alternativa (jedan zajednički `emulators:exec` za obje suite) traži
novu skriptu — van opsega.

## 14. Odluke Orchestrator-a (odobrenje plana)

