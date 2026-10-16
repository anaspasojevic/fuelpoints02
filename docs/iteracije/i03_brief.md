ITERATION BRIEF — FuelPoints — ITERACIJA 3: Purchase / EARN

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-03 (iz main na tagu i02, merge commit 700b155) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i03
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; §31 uzimati iz .docx-a;
SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints)
Preduslov: tag i02 postoji; .\skripte\provjera.ps1 na main vraća 0.
Repozitorijum je state, razgovor nije state.

1. CILJ
Implementirati API-02 POST /api/v1/pos/purchases: POS autentikaciju (X-POS-API-Key → stationId), validaciju POS ulaza,
obračun bodova i JEDNU Firestore transakciju koja kreira purchase, mijenja loyalty balance, kreira EARN ledger event i
determinističku in-app notifikaciju — idempotentno po (stationId, posTransactionId) i ispravno pod konkurentnim zahtjevima.
Uvesti Security Rules za purchases, loyaltyLedger i notifications doslovno iz §31.

2. SRS ZAHTJEVI U OPSEGU
- §3.4, NFR-02 — POS autentikacija:
  · header X-POS-API-Key (naziv zaglavlja case-insensitive po HTTP-u, vrijednost se poredi tačno); za svaku stanicu poseban
    random ključ; mapa ključ → stationId u konfiguraciji (env), nikad u repou;
  · nedostajući, prazan ili neispravan ključ → 401 UNAUTHENTICATED_POS; ključ koji nije u zaglavlju X-POS-API-Key
    (query, drugo zaglavlje, tijelo) se ne prihvata; Firebase Bearer token nije zamjena za POS ključ;
  · stationId se uzima ISKLJUČIVO iz mape; ključ se nikad ne loguje, ne vraća i ne upisuje u poruku greške;
  · poređenje ključa u konstantnom vremenu, bez ranog izlaska ni po znaku ni po ključu iz mape (Planner predlaže tehniku).
- §1.5 — earnedPoints = floor(volumeMl / 1000), integer.
- §8.1, §8.2 — business identity (stationId, posTransactionId); doc ID {stationId}__{posTransactionId};
  posTransactionId ^[A-Za-z0-9._-]{1,64}$.
- §8.3 — purchases schema TAČNO: { uid, stationId, posTransactionId, volumeMl, amountMinor, currency, earnedPoints, occurredAt, recordedAt };
  uid = loyaltyUid iz zahtjeva; occurredAt i recordedAt su Firestore Timestamp (ne string).
- §8.4 — validacija POS ulaza:
  loyaltyUid → postojeći ACTIVE nalog (users/{uid}.accountStatus == "ACTIVE" I postoji loyaltyAccounts/{uid}), inače
              404 LOYALTY_ACCOUNT_NOT_FOUND (O-10); svako drugo stanje (nepoznat accountStatus, postoji samo jedan od dva dokumenta) → 404;
  posTransactionId → INVALID_TRANSACTION_ID; volumeMl integer 1–200000 → INVALID_VOLUME; amountMinor integer 0–1000000 → INVALID_AMOUNT;
  currency tačno "EUR" → UNSUPPORTED_CURRENCY; occurredAt validan timestamp, najviše 5 min u budućnosti po vremenu Backend-a → INVALID_OCCURRED_AT.
  Nedostajuće polje ili pogrešan JSON tip dobija kod svog polja (npr. volumeMl: "1000" ili null → INVALID_VOLUME),
  osim loyaltyUid (vidi tačku 5).
- §8.5 — stationId, earnedPoints i recordedAt su server-derived; recordedAt = server time.
- §7.3, §7.1–7.2 — EARN: availablePoints += p; updatedAt serverski; reservedPoints se ne mijenja; invarijante ≥ 0.
- §9 — u JEDNOJ Firestore transakciji: purchase, loyalty balance, EARN ledger event i in-app notifikacija.
  §9.1 notification ID = earn_{purchaseId}; §9.2 schema TAČNO { uid, type: "POINTS_EARNED", title, body, createdAt, readAt: null, relatedPurchaseId };
  §9.3 nema commit-a kupovine bez notifikacije; duplikat POS zahtjeva ne pravi drugu notifikaciju.
- §10 — idempotentnost: isti (stationId, posTransactionId) + isti uid, volumeMl, amountMinor, currency → rezultat prve operacije,
  bez novog EARN-a; različit bilo koji od ta četiri → 409 IDEMPOTENCY_CONFLICT, ništa izmijenjeno.
  O-3: occurredAt NIJE dio poređenja; retry sa drugim occurredAt vraća prvi rezultat, sačuvani occurredAt se ne mijenja.
  O-12: provjera postojeće kupovine ide PRIJE provjere naloga (vidi tačku 5).
- O-4: i kupovina sa 0 bodova (npr. 900 ml) pravi sva četiri zapisa (purchase, balance update, EARN sa deltaAvailable 0, notifikacija).
- §11 — ledger event TAČNO { uid, type: "EARN", deltaAvailable: p, deltaReserved: 0, availableAfter, reservedAfter, purchaseId, voucherId: null, createdAt };
  immutable (tx.create, nikad update); availableAfter/reservedAfter = stanje loyaltyAccounts poslije ove mutacije.
- §21 (samo kreiranje) — notifikacija nastaje u transakciji kupovine; Firestore je jedini izvor; readAt = null.
- §25.4, §25.5, §25.8, §31 — u firebase/firestore.rules dodati DOSLOVNO iz §31 blokove /purchases/{purchaseId},
  /loyaltyLedger/{eventId} i /notifications/{notificationId}, na mjestima i redoslijedom kao u §31. Postojeći blokovi ostaju.
- §27 kodovi u opsegu: UNAUTHENTICATED_POS, INVALID_TRANSACTION_ID, INVALID_VOLUME, INVALID_AMOUNT, UNSUPPORTED_CURRENCY,
  INVALID_OCCURRED_AT, LOYALTY_ACCOUNT_NOT_FOUND, IDEMPOTENCY_CONFLICT, INVALID_REQUEST (O-1), INTERNAL_ERROR, SERVICE_UNAVAILABLE.
- NFR-04, NFR-05, NFR-07 — atomičnost (failure injection), retry-safe, POS ključevi van repoa, odgovora i logova.

3. VAN OPSEGA (NE SMIJE se implementirati)
- API-03 … API-07 (issue, cancel, reconcile, redemption, delete); RESERVE/REDEEM/RELEASE; voucher-i; rewardRequests; redemptionRequests;
  POS posrednik se u i03 veže samo na rutu POST /pos/purchases (redeem ruta je Iteracija 6);
- Security Rules za vouchers, rewardDefinitions, rewardRequests, redemptionRequests (D-2: Iteracije 4–6; lockdown 12/12 u i08);
- Android (Purchase History, Notifications, readAt iz aplikacije) — Iteracija 10; composite indeks za Android upit — Iteracija 10;
- POS Simulator HTML i CORS — Iteracija 11;
- pseudonimizacija (purchases.uid = null) i retry poslije pseudonimizacije (O-10a) — Iteracija 7;
- refund/reversal, bodovanje marketa, kampanje (§1.3); FCM; health/status ili bilo koji dodatni endpoint;
- izmjena ugovora API-01 i ponašanja i02 (osim testa I03-T16 i proširenja ulaza regresionih testova zbog nove konfiguracije).

4. ZAVISNOSTI
- i01: katalog grešaka, centralni rukovalac, parsirajJson, korelacija, dnevnik.js (samo eksplicitna polja), emulator test
  infrastruktura, provjera.ps1.
- i02: jedan rok po zahtjevu (ROK_ZAVISNOG_SERVISA_MS = 10 s), saRokom, jeNedostupnostFirestore, strogo tijelo, presretanje logova
  (svi kanali), procesBackenda/sporProksi, zaštita emulator/demo, Rules za users i loyaltyAccounts.
- Odluke: O-1, O-3, O-4, O-10, O-12, O-13, i02/P-5 (kasni commit poslije 503), i02/P-6 (422 za neispravan JSON).
- Backlog: F1-01 (docs/iteracije/i02_review_fix1.md) → test I03-T16.

5. ODLUKE ORCHESTRATOR-a ZA OVU ITERACIJU
- O-3, O-4, O-10 (Ana, 2026-10-16) — kako je navedeno u tački 2.
- O-12 (Ana, 2026-10-16): redoslijed u transakciji je (1) pročitati purchases/{purchaseId}; ako postoji → poređenje po §10
  (isti → prvi rezultat; različit → 409), BEZ obzira na trenutno stanje naloga; (2) tek ako ne postoji → provjera ACTIVE naloga (404),
  pa četiri upisa. Retry već upisane kupovine nije nova loyalty mutacija (AUTH-05), pa za nalog u DELETION_IN_PROGRESS vraća prvi
  rezultat, a nova kupovina za taj nalog → 404. Retry poslije pseudonimizacije (uid = null) ostaje O-10a za Iteraciju 7.
- O-13 (Ana, 2026-10-16): stationId u konfiguraciji mora odgovarati ^[A-Za-z0-9.-]{1,32}$ — BEZ znaka "_" (podskup §8.2).
  Razlog: doc ID {stationId}__{posTransactionId} bi inače bio dvosmislen ("A_" + "__" + "B" i "A" + "__" + "_B" daju isti ID).
  Dodatno (odbrana u dubinu): ako purchase dokument postoji, a njegovi stationId/posTransactionId nisu jednaki zahtjevu → 500
  INTERNAL_ERROR, ništa upisano.
- Strogo tijelo kao u i02: JSON objekat sa TAČNO poljima loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAt.
  Tijelo koje nije objekat ili ima bilo koje drugo polje (stationId, earnedPoints, recordedAt, uid, X-POS-API-Key, …) → 422 INVALID_REQUEST,
  ništa upisano (§8.5, §3.1). loyaltyUid koji nedostaje ili nije string → 422 INVALID_REQUEST; string neispravnog formata → 404
  LOYALTY_ACCOUNT_NOT_FOUND bez ikakvog pristupa Firestore-u.
- Redoslijed provjera (deterministički; Planner predlaže tačan poredak polja, Orchestrator odobrava):
  neispravan JSON → 422 INVALID_REQUEST (i02/P-6 važi i za POS rutu: parser ostaje globalan, ništa se ne čita ni piše) →
  POS ključ (401) → struktura tijela (422 INVALID_REQUEST) → polja po §8.4 (422, svako svojim kodom) → format loyaltyUid (404) →
  transakcija (O-12). Sve 401/422 provjere i format loyaltyUid se završavaju BEZ pristupa Firestore-u.
- Konfiguracija POS ključeva: Planner predlaže naziv i format env varijable (npr. lista stationId:ključ). Backend odbija start
  ako mapa nedostaje, prazna je ili neispravna, ako ključ nema bar 128 bita entropije (Planner predlaže tačnu provjeru formata
  i minimalne dužine, npr. base64url od 32 bajta), ako se ključ ili stationId ponavlja ili stationId krši O-13. Poruka greške
  imenuje samo varijablu i razlog, nikad vrijednost. .env.example sadrži samo placeholder-e sa kojima Backend NE startuje;
  testovi i provjera.ps1 generišu ključeve u toku izvršavanja. README daje PowerShell komandu za generisanje ključa.
- loyaltyUid se nikad ne koristi kao putanja prije provjere formata (zaštita od "a/b"); Planner predlaže format
  (preporuka: string 1–128 znakova, isWellFormed, bez "/", nije "." ni "..", ne odgovara ^__.*__$).
- occurredAt: Planner predlaže tačan format (preporuka: RFC 3339 string sa obaveznim "Z" ili offsetom, 0–3 decimale sekunde).
  Odbijaju se: datum bez vremenske zone, nepostojeći kalendarski datum (JavaScript Date "2026-02-30T00:00:00Z" tiho pretvara
  u 2. mart — to mora biti INVALID_OCCURRED_AT), sekunda 60, broj, prazan string, vrijeme > server + 5 min.
  Čuva se kao Firestore Timestamp; vrijednost koja se čuva, poredi i vraća mora biti ista.
- Integer polja: Number.isInteger nad parsiranom JSON vrijednošću (1000.0 i 1e3 iz JSON-a su isti broj kao 1000 — dokumentovati,
  ne izmišljati provjeru koju JSON parser ne može podržati).
- Ledger eventId za EARN je deterministički (Planner predlaže oblik, npr. earn_{purchaseId}, i obrazlaže da se neće sudarati sa
  ID-evima budućih tipova), tako da duplikat EARN-a nije moguć ni na nivou ID-a. Svi novi dokumenti u transakciji se pišu sa tx.create;
  loyaltyAccounts sa tx.update samo availablePoints i updatedAt. Ako purchase ne postoji, a notifikacija ili ledger event sa istim
  ID-em postoji (nekonzistentno stanje) → 500 INTERNAL_ERROR, ništa upisano.
- Jedan rok po zahtjevu (i02, R-02) važi i za POS rutu: računa se od ulaska u POS posrednik; ako je rok istekao prije transakcije,
  transakcija se ne pokreće (→ 503).
- Kasni commit poslije 503 je za kupovinu prihvatljiv JER je idempotency ključ (stationId, posTransactionId): POS retry vraća prvi
  rezultat. To se MORA dokazati testom (I03-T13).
- SRS ne definiše response body ni status uspjeha za API-02. Planner predlaže minimalan ugovor (npr. 201 prvi put, 200 za retry),
  koji Orchestrator/Ana odobravaju. Ograničenja: tijelo se gradi iz sačuvanog purchase dokumenta (ne iz zahtjeva); tijelo prvog
  odgovora i svakog uspješnog retry-ja je IDENTIČNO; NE sadrži balance korisnika, podatke o nalogu koje POS nije poslao,
  POS ključ ni serverske timestamp-ove koji se ne znaju prije commit-a.
- Tekst notifikacije (title, body) na srpskom, latinica, ijekavica, bez internih podataka (bez UID-a, stationId-a, ključa);
  Planner predlaže tačan tekst, uključujući ispravan oblik riječi "bod" za 0, 1, 2–4, 5–20, 21, 22, 42, 111–114.
- I01-T10 se uklanja u potpunosti (loyaltyLedger dio zamjenjuje RULE-T11).
- Regresioni testovi i01/i02 se smiju mijenjati SAMO kao proširenje ulaza (npr. nova obavezna POS konfiguracija u spawn-ovanim
  procesima i I01-T06); nijedna postojeća asercija se ne uklanja ni ne slabi.
- Nijedan novi npm paket bez obrazloženja u planu i odobrenja Orchestrator-a.
- TRACEABILITY: Builder smije u redovima Iteracije 3 popuniti "Kod", "Status" i "Planirani test"; u redu §8.3 – §8.5 tekst
  "I03 stationId/earnedPoints iz body-ja ignorisani" mijenja u "I03-T02 server-controlled polja u tijelu → 422 INVALID_REQUEST".

6. DEFINITION OF DONE
[ ] Sve iz tačke 2 implementirano; ništa iz tačke 3.
[ ] Testovi iz tačke 7 prolaze; regresija i01 i i02 prolazi (uključujući Android build kroz provjera.ps1).
[ ] Transakciona granica: sva četiri zapisa nastaju u istoj transakciji; failure injection na svakom od upisa i prije commit-a → 0 novih zapisa,
    balance nepromijenjen.
[ ] Konkurentnost: paralelni identični zahtjevi daju tačno jedan purchase, jedan EARN i jednu notifikaciju; paralelne različite kupovine
    istog korisnika daju tačan zbir bodova i konzistentan niz availableAfter.
[ ] Nijedan odgovor ni log (svi kanali, svi ishodi) ne sadrži X-POS-API-Key; nijedan odgovor nema stack, internu poruku ni balance.
[ ] firestore.rules: dodati blokovi tekstualno jednaki §31 iz .docx-a (automatsko poređenje kao u i02); RULE-T08, RULE-T10, RULE-T11 zeleni;
    RULE-T01 … RULE-T07, RULE-T12 i I02-T15 i dalje zeleni.
[ ] Kontrolne mutacije iz plana (sekcija 8.4) obaraju ciljane testove; ishod upisan u TEST_REPORT.
[ ] Test-only hook-ovi ne postoje u produkcionoj aplikaciji; nema novih paketa bez odobrenja.
[ ] .\skripte\provjera.ps1 → exit 0 (uključujući smoke: POST /api/v1/pos/purchases bez ključa → 401 UNAUTHENTICATED_POS); SRS hash nepromijenjen.
[ ] docs/TRACEABILITY.md, docs/IMPLEMENTATION_LOG.md (unos i03, status i03/P-n, ograničenja za buduće iteracije), docs/TEST_REPORT.md (stvarni izlaz) ažurirani.
[ ] Commit-i bez potpisa alata; PR iteracija-03 → main otvoren (bez merge-a).
[ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag i03.

7. OBAVEZNI TESTOVI
SRS katalog:
- API-T02  42 730 ml → tačno 42 boda; purchases/SIM01__<id> sa TAČNIM skupom polja (§8.3), EARN ledger event (tačan skup polja,
           availableAfter/reservedAfter, voucherId null), balance +42, notifikacija earn_{purchaseId} (tačan skup polja, readAt null,
           relatedPurchaseId) — sve postoji i tačno je; recordedAt/createdAt su serverski Timestamp-ovi.
- API-T03  Ponovljeni isti (stationId, posTransactionId) sa istim payload-om → identično tijelo prve operacije; bodovi, ledger i notifikacije nepromijenjeni.
- API-T04  Isti purchase ID sa drugačijim uid, volumeMl, amountMinor ili currency (svaki zasebno) → 409 IDEMPOTENCY_CONFLICT, ništa izmijenjeno;
           nevalidan volume, currency i timestamp → odbijeno odgovarajućim kodom, ništa upisano.
- RULE-T08 Owner query purchases (where uid == auth.uid, limit ≤ 20) i owner get → ALLOW; direct purchase write (create/update/delete,
           i vlasnika) → DENY. Granice (bez limit-a, limit 21, bez uid uslova, tuđi dokument) idu u I03-T20.
- RULE-T10 Owner read notifikacije i update readAt null → request.time → ALLOW; izmjena title/body → DENY. Granice (drugi update readAt,
           readAt ≠ request.time, izmjena uid/type, create/delete, tuđa notifikacija, list limit > 50) idu u I03-T20.
- RULE-T11 Bilo kakav read/write nad loyaltyLedger (vlasnik, drugi korisnik, neautentifikovan; get, list, create, update, delete) → DENY.
Dopunski (konačne oznake određuje Planner):
- I03-T01 POS ključ: nedostaje / pogrešan / prazan / samo u query-ju / samo u drugom zaglavlju / samo u tijelu / Bearer token umjesto ključa
          → 401 UNAUTHENTICATED_POS, ništa upisano; ključ stanice B daje purchase sa stationId B (izvođenje stanice iz ključa).
- I03-T02 Server-controlled ili nepoznata polja u tijelu (stationId, earnedPoints, recordedAt, uid, …), tijelo koje nije objekat,
          loyaltyUid nedostaje ili nije string → 422 INVALID_REQUEST, ništa upisano.
- I03-T03 Pravilo bodovanja: 900 → 0 (sva četiri zapisa, O-4), 999 → 0, 1000 → 1, 10 000 → 10, 10 990 → 10, 200 000 → 200.
- I03-T04 volumeMl granice: 1 i 200000 prolaze; 0, 200001, -1, 1.5, "1000", null, nedostaje → INVALID_VOLUME.
- I03-T05 amountMinor granice: 0 i 1000000 prolaze; -1, 1000001, 1.5, string, null, nedostaje → INVALID_AMOUNT.
- I03-T06 currency: "EUR" prolazi; "eur", "BAM", "", broj, null, nedostaje → UNSUPPORTED_CURRENCY.
- I03-T07 occurredAt: sada, prošlost, +4:30 prolaze (sačuvan kao Timestamp); +5:01, neispravan string, nepostojeći datum (30. februar),
          broj, datum bez vremenske zone, nedostaje → INVALID_OCCURRED_AT.
- I03-T08 posTransactionId: 1 i 64 znaka prolaze; 65, "", "a/b", "a b", ne-ASCII, broj, nedostaje → INVALID_TRANSACTION_ID.
- I03-T09 loyaltyUid: nepostojeći, DELETION_IN_PROGRESS, users bez loyaltyAccounts, loyaltyAccounts bez users, "a/b", "", predugačak
          → 404 LOYALTY_ACCOUNT_NOT_FOUND, ništa upisano, nijedan dokument van očekivanih putanja.
- I03-T10 Failure injection na svakom od četiri upisa i prije commit-a → nijedan novi zapis, balance nepromijenjen; odgovor bez stack-a;
          uključuje i nekonzistentno stanje (postoji notifikacija ili ledger event za purchase koji ne postoji) → 500, ništa upisano.
- I03-T11 10 paralelnih IDENTIČNIH zahtjeva → tačno 1 purchase, 1 EARN, 1 notifikacija, balance +p jednom; nijedan 500; najviše jedan 201;
          sva uspješna tijela identična; 503 dozvoljen (tačno tijelo SERVICE_UNAVAILABLE) uz konzistentno stanje i naknadni retry → isto tijelo.
- I03-T12 10 paralelnih RAZLIČITIH kupovina istog korisnika (svaka sa p > 0) → svaki 503 se ponavlja istim zahtjevom do uspjeha (ograničen
          broj pokušaja); na kraju availablePoints = zbir; tačno 10 EARN događaja; sortirani po availableAfter: prvi = početno + delta,
          svaki sljedeći = prethodni availableAfter + svoja delta, posljednji = zbir; reservedAfter svuda nepromijenjen.
- I03-T13 Kasni commit poslije 503: transakcija se commit-uje poslije isteka roka (klijent dobija 503) → POS retry → prvo tijelo, tačno jedan EARN.
- I03-T14 Isti posTransactionId na dvije stanice → dvije različite kupovine (identitet je par); posTransactionId sa "__" (npr. "a__b") radi ispravno.
- I03-T15 Konfiguracija POS ključeva: nedostaje, prazna, neispravan format, prekratak ključ, ponovljen ključ, ponovljen stationId,
          stationId sa "_" ili nedozvoljenim znakom, placeholder iz .env.example → Backend odbija start, poruka bez vrijednosti.
- I03-T16 (F1-01) Istekao rok prije transakcije → runTransaction se NE poziva, odgovor 503, 0 dokumenata — za init (API-01) i za kupovinu (API-02).
- I03-T17 Log i odgovor (svi kanali, svi ishodi: 201, 200, 401, 404, 409, 422, 500, 503) ne sadrže vrijednost X-POS-API-Key
          (ni kad je poslat u query-ju ili tijelu); nijedan odgovor ne sadrži balance.
- I03-T18 (O-3) Retry sa drugim occurredAt → prvo tijelo; sačuvani occurredAt nepromijenjen; bez novog EARN-a.
- I03-T19 (O-12) Nalog prebačen u DELETION_IN_PROGRESS poslije kupovine: retry istog payload-a → prvo tijelo, ništa novo; retry sa drugim
          volumeMl → 409; nova kupovina (novi posTransactionId) → 404 LOYALTY_ACCOUNT_NOT_FOUND.
- I03-T20 Granice Rules za purchases, notifications i loyaltyLedger van RULE-T08/T10/T11 (vidi iznad).
Regresija: kompletna i01 i i02 suita; I01-T10 uklonjen; RULE-T01 … RULE-T07, RULE-T12 i I02-T15 i dalje zeleni.

8. KOMANDE ZA PROVJERU (PowerShell, iz korijena repozitorijuma)
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE              # 0
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs                           # prazno

9. ISPORUKA BUILDER-a
A. PR iteracija-03 → main; B. CHANGELOG (IMPLEMENTATION_LOG); C. dodati/izmijenjeni fajlovi;
D. izvršeni testovi i rezultat po ID-u (uključujući kontrolne mutacije); E. neizvršeni testovi i zašto;
F. poznata ograničenja i odstupanja od plana; G. ažurirana docs/TRACEABILITY.md.
