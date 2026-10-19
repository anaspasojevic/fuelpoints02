# Iteracija 8 — ADVERSARIAL REVIEW (Security Rules lockdown 12/12 i B-1)

Režim: ekspresni (O-30, O-31). Datum: 2026-10-19. Reviewer ne mijenja kod ni testove; privremeni napadi su obrisani, `git status` čist.

## 1. Polazno stanje

| Stavka | Ishod |
|---|---|
| Grana / vrh H | `iteracija-08`, H = `441603f` (= `origin/iteracija-08`); PR #8 „i08: Security Rules lockdown 12/12 i B-1” OPEN, headRefOid `441603f` |
| Kod završnog run-a | `e8d10d0`; `git diff --stat e8d10d0 441603f` → samo `docs/IMPLEMENTATION_LOG.md`, `docs/ODLUKE.md`, `docs/TEST_REPORT.md`, `docs/TRACEABILITY.md` → `provjera.ps1` se po O-31 NE pokreće |
| SRS hash | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` ✔ |
| `git diff i07 -- docs/srs firebase/firestore.indexes.json` | prazno ✔ |
| Emulator | JDK 24 prvi na PATH-u; portovi 8080 i 9099 slobodni prije i poslije napada ✔ |
| Izmijenjen kod (`git diff --stat i07..H -- backend firebase skripte`) | `backend/src/validacija/identifikator.js`, `backend/src/validacija/zahtjevIzdavanja.js`, `backend/test/emulator/kupovina.test.js`, 5 fajlova u `firebase/tests` (+1 novi `normativnaPravila.test.js`); `firebase/firestore.rules` nepromijenjen |

## 2. Pregled po stavkama

| # | Stavka | Ishod |
|---|---|---|
| 1 | `firestore.rules` = §31 iz `.docx`-a: nezavisno izvučen tekst paragrafa §31 iz `word/document.xml` i upoređen bez bijelih znakova sa `firebase/firestore.rules` → IDENTIČNO; pregledano i red po red (helperi, 10 `match` blokova, default deny) | ✔ |
| 2 | I08-T01 (a) poredi normalizovane redove `.md` §31 i pravila; (b) dokazuje da izmjena jednog reda (`<= 20` → `<= 21`) daje razliku, a samo razmaci / prazni redovi jednakost; uz to TEST_REPORT D01 … D05 bilježe pad I08-T01 pri svakoj mutaciji pravila | ✔ |
| 3 | RULE-T01 … RULE-T12: svaki ID ima test sa tačno tom oznakom (24 testa); pokriven cijeli tekst §30 | ✔ |
| 4 | Granice iz brief-a t. 2: RULE-T04 displayName 1 / 100 ALLOW, 0 / 101 / ne-string DENY, klijentski `updatedAt` i bez `updatedAt` DENY; RULE-T08 i RULE-T09 limit 20 ALLOW, 21 / bez limit-a / bez where / tuđi uid DENY; RULE-T10 limit 50 / 51, `readAt` = `request.time` ALLOW, klijentsko vrijeme DENY, null → null DENY, drugi `readAt` DENY, title / body DENY | ✔ |
| 5 | RULE-T12 konačan: rewardRequests, redemptionRequests, nepoznata kolekcija, podkolekcije (i ispod `users/{uid}`, `loyaltyAccounts/{uid}`), collectionGroup; get / list / list `where uid == A limit 20` / create / set / update / delete DENY za neautentifikovanog, drugog i „vlasnika” (`uid` u dokumentu == auth.uid); „preliminarno” uklonjeno | ✔ |
| 6 | `git diff i07 -- firebase/tests`: uklonjeni redovi su samo preimenovanja naziva (RULE-T01, RULE-T12) i zamjena pomoćne funkcije; nijedna asercija nije uklonjena ni oslabljena (stari `set`, `get`, `list`, `delete` i dalje postoje, kontekst `authenticated (A)` je postao „vlasnik” sa `uid: A` u dokumentu — jače) | ✔ |
| 7 | I08-T02 (AC-02): create / update / set merge / delete nad 6 kritičnih kolekcija u 3 konteksta DENY i stanje nepromijenjeno | ✔ |
| 8 | B-1: `\p{Cc}` u `jeIspravanIdDokumenta` (`identifikator.js:4,9`); duplikat iz `zahtjevIzdavanja.js` uklonjen; funkciju koriste samo `loyaltyUid` (`tijeloKupovine.js:56`) i `rewardId` (`zahtjevIzdavanja.js:31`) — nema drugih pozivalaca na koje bi izmjena uticala; I04-T03 (`izdavanjeNagrade.test.js`) nepromijenjen; I08-T03 pokriva NUL, LF, TAB, CR, U+001F, DEL, U+0085, U+009F i redoslijed i03/P-6 | ✔ |
| 9 | AC-12 tabela u TEST_REPORT: API-T01 … API-T12 (14 testova) i RULE-T01 … RULE-T12 (24 testa), svaki PASS, iz `provjera.ps1` #2 na `e8d10d0` (exit 0); `provjera.ps1` tačno 2× | ✔ |
| 10 | NFR-07 inspekcija (I08-T04): komande i ishodi u TEST_REPORT; 2 pogotka su samo dokumentacija koja citira obrasce | ✔ |
| 11 | Mutacije D01 … D06 (≤ 6, sve D 1/1); OD-3 (prvi nevažeći pokušaj zbog `|` u `cmd`) ponovljen i dokumentovan | ✔ |
| 12 | ODLUKE: B-1 ZATVORENO, O-37, O-38 (R-01 i07 u §7, R-02 i07 u backlog bez roka), i08/P-1 … P-4, K-1, §1 i07 ACCEPTED (tag `i07`, merge `3d2ec94`); TRACEABILITY ažuriran (§25/§31, NFR-03, NFR-07, AC-02, AC-12, §8.2); IMPLEMENTATION_LOG OD-1 … OD-5 | ✔ |
| 13 | Nema novih paketa, test-only koda u `src/`, TODO/FIXME | ✔ |
| 14 | `git log i07..H`: autor samo `anaspasojevic`; bez „Co-Authored-By”, „Claude”, „Generated”, „Anthropic” | ✔ |

## 3. Napadi (privremeni fajlovi, nisu commit-ovani, obrisani)

Rules: `firebase/tests/zz_napadi_i08.test.js`, `npx firebase emulators:exec --config ../../firebase.json --project demo-fuelpoints --only firestore
"node --test --test-concurrency=1 zz_napadi_i08.test.js"` → exit 0, `ℹ tests 6 / pass 6 / fail 0`.
Backend: `backend/test/emulator/zz_napadi_i08.test.js`, `zz_napadi_i08b.test.js` (zaglavlje kopirano iz `kupovina.test.js` / `izdavanjeNagrade.test.js`),
`npm run test:emu:ciljano -- test/emulator/zz_napadi_i08.test.js test/emulator/zz_napadi_i08b.test.js` → exit 0, `ℹ tests 4 / pass 4 / fail 0`.

| Napad | Sadržaj | Očekivano | Dobijeno |
|---|---|---|---|
| N1 | create / set / update / delete / batch update nad loyaltyAccounts, purchases, loyaltyLedger, vouchers, rewardRequests, redemptionRequests (neaut., vlasnik A, drugi B); `increment(1)` i `deleteField()` nad sopstvenim nalogom; create naloga za treći uid | DENY | DENY (sve) |
| N2 | vlasnik list vouchers / purchases: bez ičega, limit 20 bez where, `uid == A` limit 21, bez limit-a, `uid in [A, B]`, `uid != B`, `orderBy(uid)`; notifications limit 51 | DENY; kontrolno `uid == A limit 20` ALLOW | kao očekivano |
| N3 | users update sa accountStatus, acceptedTermsVersion, acceptedTermsAt, createdAt, dodatnim poljem, `deleteField(displayName)`, displayName lista, samo klijentski updatedAt; set bez merge; update / merge tuđeg; delete; create | DENY | DENY (sve) |
| N4 | notifications: readAt stari timestamp, string, readAt + uid B, samo uid, tuđa, već pročitana → serverTimestamp, reset na null, create, delete; kontrolno prvi `serverTimestamp()` ALLOW pa drugi put DENY | DENY (kontrolno ALLOW) | kao očekivano |
| N5 | A čita users/B, loyaltyAccounts/B, vouchers B, purchases B, notifications B, sopstveni loyaltyLedger, rewardRequests, redemptionRequests; list `uid == B`; neaut. rewardDefinitions | DENY | DENY (sve) |
| N6 | `x/1`, `users/A/x/1`, `users/A/x/1/y/2`, podkolekcije ispod vouchers / notifications / rewardDefinitions, `deviceRegistrations/1`, `admin/config` (get, set, list) u 3 konteksta; write rewardDefinitions | DENY | DENY (sve) |
| N7 | API-02 loyaltyUid `"a\u0000b"`, `"a\nb"`, `"a\u007fb"`, `"a\r\nb"`, `"\u0080x"`, `" \u0000"`, 128 znakova sa NUL; isto kad dokument `loyaltyAccounts/a\nb` stvarno postoji; NUL + prazan posTransactionId → `INVALID_TRANSACTION_ID` (redoslijed); regresija `"a b"`, `"ključ😀"`, 128 × `z` → 201; API-03 rewardId `a%09b`, `%09`, `CAR_WASH%09`, `%0D`, `a%C2%85`, `%C2%9F` | 404 `LOYALTY_ACCOUNT_NOT_FOUND` / `REWARD_NOT_FOUND` sa 0 pristupa bazi; redoslijed i regresija nepromijenjeni | kao očekivano (omotač baze: 0 pristupa, baza nepromijenjena) |

## 4. Nalazi

| ID | Nivo | Referenca | Opis |
|---|---|---|---|
| R-01 | NOTE | §31, O-37, i08/P-1 | I08-T01 automatski poredi pravila sa `.md` kopijom, a `.docx` (normativni) samo jednokratno ručno. Reprodukcija: reviewer je nezavisno izvukao §31 iz `word/document.xml` i poredio bez bijelih znakova → identično (u skladu sa TEST_REPORT 1756 = 1756). Očekivano / dobijeno: u skladu sa odlukom P-1 A; `.md` i `.docx` su nepromjenljivi (hash i `git diff` prazni), pa rizik razilaženja ne postoji. Bez akcije. |

BLOCKER: 0, MAJOR: 0, MINOR: 0, NOTE: 1.

## 5. Pitanja za Orchestrator-a

Nema.

## 6. PRESUDA

**ITERATION ACCEPTED**
