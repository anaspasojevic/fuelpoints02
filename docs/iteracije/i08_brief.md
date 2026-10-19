ITERATION BRIEF — FuelPoints — ITERACIJA 8: Security Rules lockdown 12/12 i B-1

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-08 (iz main na tagu i07, merge 3d2ec94) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i08
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (verzija na tagu i07) — sve odluke obavezujuće. Režim: ekspresni (O-30, O-31).
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints). Repozitorijum je state, razgovor nije state.

1. CILJ
Završni lockdown Firestore Security Rules (D-2: „i08 je završni lockdown 12/12”): firebase/firestore.rules je SADRŽINSKI IDENTIČAN §31 i to se
dokazuje automatskim testom; RULE-T01 … RULE-T12 iz §30 u konačnom obliku (RULE-T12 više nije „preliminarno”) sa granicama iz §31; kompletna
backend + Rules suita u jednom run-u dokazuje 12/12 API i 12/12 Rules (AC-12, backend dio; završno u i11). Uz to B-1 (zabrana kontrolnih
znakova u loyaltyUid) i NFR-07 inspekcija tajni.

2. SRS ZAHTJEVI U OPSEGU
- §31 — firestore.rules = §31 (iz .docx-a); dozvoljena je samo razlika u razmacima / uvlačenju. Test poređenja (I08-T01) bez novog npm paketa.
  Ako se nađe sadržinska razlika — ispraviti pravila prema §31 (nikad obrnuto) i upisati u OD-n.
- §30 RULE-T01 … RULE-T12 — svaki RULE-Txx ima bar jedan test sa TAČNO tom oznakom u nazivu i pokriva cijeli tekst stavke §30; dopune granicama
  iz §31 (najmanje): RULE-T04 displayName dužine 1 i 100 ALLOW, 0 i 101 DENY, updatedAt ≠ request.time DENY; RULE-T08 list sa limit 20 ALLOW,
  limit 21 / bez limit-a / bez where uid DENY; RULE-T09 isto za vouchers (limit 20); RULE-T10 list limit 50 / 51, readAt null → request.time ALLOW,
  readAt ≠ request.time DENY, drugi put readAt DENY, title / body DENY; RULE-T12 konačno: rewardRequests, redemptionRequests i nepoznata kolekcija
  (i podkolekcija) → get / list / create / update / delete DENY za neautentifikovanog, drugog korisnika i „vlasnika” (uid u dokumentu == auth.uid).
- §25.1 – §25.10, NFR-03 (default deny, owner isolation), AC-02 (Android ne može povećati bodove: svi write na loyaltyAccounts, purchases, loyaltyLedger,
  vouchers, rewardRequests, redemptionRequests DENY).
- AC-12 (backend dio): jedan završni run → tabela u TEST_REPORT: API-T01 … API-T12 i RULE-T01 … RULE-T12, svaki sa fajlom, nazivom testa i PASS.
- B-1 (Ana, 2026-10-19): §8.2 / i03/P-5 — loyaltyUid (API-02) sa bilo kojim \p{Cc} znakom (NUL, \n, \t, DEL …) → 404 LOYALTY_ACCOUNT_NOT_FOUND
  BEZ pristupa bazi (kao rewardId, i04/P-9; ista provjera, ne nova kopija regex-a gdje je moguće). Ostalo ponašanje API-02 nepromijenjeno.
- NFR-07 — inspekcija (I08-Txx): git ls-files bez .env, google-services.json, service-account / *-key.json; POS ključevi samo kao SHA-256 otisci;
  git grep bez obrazaca tajni (npr. "BEGIN PRIVATE KEY", "AIza", "x-pos-api-key:" sa vrijednošću). Rezultat komandi u TEST_REPORT.

3. VAN OPSEGA
- Android (i09, i10), composite indeksi za Android upite (ograničenja (e), (i) — i10), POS Simulator (i11), pravi Firebase projekat (O-2 → i11),
  device registrations / FCM; bilo koje pravilo ili kolekcija van §31; izmjena API-01 … API-07 osim B-1; novi npm paketi; test-only kod u backend/src.

4. ZAVISNOSTI
D-2 (pravila uvođena postepeno u i02, i03, i04, i06), RULE-T testovi u firebase/tests/*.test.js, i01 preliminarni RULE-T12, i03/P-5, i04/P-9, O-31.

5. ODLUKE ZA OVU ITERACIJU
- B-1 (Ana, 2026-10-19): kao u tački 2.
- O-37 (Orchestrator): dokaz identičnosti pravila je automatski test (I08-T01) koji čita normativni tekst; Planner predlaže izvor (preporuka: .md kopija
  sa uklonjenim markdown escape-ovima, uz jednokratnu ručnu provjeru prema .docx-u upisanu u TEST_REPORT; ako .md nije pouzdan — fiksni tekst §31 u
  test fajlu prepisan iz .docx-a i provjeren red po red) i normalizaciju (samo razmaci / prazni redovi).
- O-38 (Orchestrator): R-01 iz review-a i07 (prozor K1 → K4a: init korisnika bez naloga između K3 i K4a daje 500 na prvom DELETE-u; ponovljen DELETE
  popravlja) se upisuje u ODLUKE §7 kao poznato ograničenje; R-02 (i07, NOTE, 503 pod opterećenjem) u backlog bez roka. Bez izmjene koda.
- Postojeći RULE testovi se smiju samo PROŠIRITI (nove asercije / slučajevi) i preimenovati „preliminarno” → konačno; nijedna postojeća asercija se ne
  uklanja ni ne slabi.
- Ključne mutacije (O-31 (c), D 1/1, najviše 6), najmanje: vouchers list bez `request.query.limit <= 20`; users update bez changedOnly; notifications
  update bez `readAt == request.time`; loyaltyLedger `allow read: if signedIn()`; rewardRequests / redemptionRequests `allow read: if signedIn()`;
  B-1 provjera uklonjena.
- O-30 (a): provjera.ps1 tačno 2× (poslije izmjene pravila / B-1 i na kraju); u TEST_REPORT commit koda završnog run-a.
- Dokumentacija: TRACEABILITY (§25/§31, NFR-03, NFR-07, AC-02, AC-12 backend dio, RULE-T01 … T12, §8.2 B-1), ODLUKE (B-1 zatvoren, O-37, O-38,
  i08/P-n, §1 i07 ACCEPTED tag i07 merge 3d2ec94), IMPLEMENTATION_LOG, TEST_REPORT (O-30 (d)).

6. DEFINITION OF DONE
[ ] I08-T01 (pravila = §31) zelen; RULE-T01 … RULE-T12 konačni i zeleni; B-1 test zelen; regresija i01–i07 zelena.
[ ] AC-12 tabela (12 API + 12 Rules, svaki PASS) iz jednog završnog run-a.
[ ] Mutacije (≤ 6) D 1/1 u TEST_REPORT; NFR-07 inspekcija u TEST_REPORT.
[ ] firestore.indexes.json nepromijenjen; nema novih paketa ni test-only koda u src/; SRS hash nepromijenjen.
[ ] PR iteracija-08 → main bez merge-a; commit-i bez potpisa alata. Reviewer (O-31): ACCEPTED → merge → git diff <vrh PR-a> main prazno → tag i08.

7. KOMANDE (PowerShell, iz korijena)
cd firebase\tests; npm test; cd ..\..
cd backend; npm test; npm run test:emu:ciljano -- test/emulator/kupovina.test.js; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE
git diff i07 -- firebase/firestore.indexes.json   # prazno
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash

8. ISPORUKA BUILDER-a: PR; kratak sažetak; testovi po ID-u; AC-12 tabela sa 12 API i 12 Rules (AC-12).
