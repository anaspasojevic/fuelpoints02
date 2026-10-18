ITERATION BRIEF — FuelPoints — ITERACIJA 4: Reward issue

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-04 (iz main na tagu i03, merge commit 43e604a) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i04
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; §31 uzimati iz .docx-a;
SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (sažetak svih odluka; detalji u sekcijama "Odluke Orchestrator-a" planova i01–i03)
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints)
Preduslov: tag i03 postoji; .\skripte\provjera.ps1 na main vraća 0.
Repozitorijum je state, razgovor nije state.

1. CILJ
Implementirati API-03 POST /api/v1/rewards/{rewardId}/issue: Android autentikaciju, strogu validaciju requestId (UUID v4),
interni lazy reconcile isteklih voucher-a (§18.1, D-1) i JEDNU Firestore transakciju koja rezerviše bodove
(availablePoints −= cost, reservedPoints += cost), kreira ACTIVE voucher sa opaque voucherId (≥ 128 bita), REWARD_RESERVE
ledger event i rewardRequests mapping — idempotentno po (uid, requestId) i bez double-spend-a pod konkurentnim zahtjevima
(API-T07, NFR-06, AC-05, AC-06). Uvesti Security Rules za rewardDefinitions, vouchers i rewardRequests doslovno iz §31.

2. SRS ZAHTJEVI U OPSEGU
- §26 API-03, §3.3, NFR-01 — Android autentikacija: postojeći posrednik napraviProvjeruTokena (i02), vezan SAMO na rutu
  POST /rewards/:rewardId/issue (ne na prefiks /rewards); UID isključivo iz verifikovanog token-a; isti rok od 10 s za cijeli
  zahtjev, od ulaska u posrednik. Nedostajući ili neispravan token → 401 UNAUTHENTICATED, ništa pročitano ni upisano.
- §13 — tijelo je JSON objekat sa TAČNO jednim poljem { requestId }.
  · requestId: kanonski UUID v4 malim slovima (O-15):
    ^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$ (regex bez zastavica; cijeli string).
    Nedostaje, nije string, velika slova, druga verzija (v1, v7), nil UUID, pogrešna varijanta, vitičaste zagrade, URN prefiks,
    bez crtica, okolni razmak, prelom reda → 422 INVALID_REQUEST (O-1), bez pristupa Firestore-u.
  · Backend sam određuje UID, cost, voucherId, status i timestamp-ove (§13): tijelo koje nije objekat ili ima bilo koje drugo
    polje (uid, rewardId, costPoints, voucherId, status, issuedAt, expiresAt, …) → 422 INVALID_REQUEST, ništa upisano.
- §12, §13.1 — rewardId iz putanje, poslije provjere formata (D-4): rewardDefinitions/{rewardId} se čita U transakciji.
  Ne postoji → 404 REWARD_NOT_FOUND; active == false → 409 REWARD_INACTIVE. costPoints se uzima iz definicije (nikad od
  klijenta) i kopira na voucher (snapshot u trenutku issue-a). Neispravna definicija (costPoints nije siguran cijeli broj ≥ 1,
  active nije boolean) → 500 INTERNAL_ERROR, ništa upisano (analogno i03/P-15).
- §13.1, AUTH-03 … AUTH-05, §27 — stanje naloga (prvi endpoint koji vraća ove kodove):
  · users/{uid} ne postoji, ILI users ACTIVE a loyaltyAccounts/{uid} ne postoji → 409 ACCOUNT_NOT_INITIALIZED (AUTH-03);
  · users.accountStatus == "DELETION_IN_PROGRESS" → 409 ACCOUNT_DELETION_IN_PROGRESS, bez obzira na loyaltyAccounts (AUTH-05);
  · accountStatus van SRS enum-a, ili loyaltyAccounts sa vrijednostima koje nisu nenegativni sigurni cijeli brojevi → 500
    (i02/P-2, i03/P-15). U svim slučajevima ništa upisano (ni reconcile).
- §13.1, §18, §18.1, D-1, O-14 — interni reconcile u ISTOJ transakciji kao issue: za svaki ACTIVE voucher korisnika za koji je
  serverTime ≥ expiresAt: status ACTIVE → EXPIRED, reservedPoints −= costPoints (sa voucher-a), availablePoints += costPoints,
  REWARD_RELEASE; najviše jednom po voucher-u.
  Redoslijed po §13.1: nalog ACTIVE → reward postoji → reward active → reconcile → availablePoints ≥ costPoints.
  · Ako issue poslije reconcile-a padne na INSUFFICIENT_POINTS: release-i se COMMIT-UJU, pa odgovor 409 INSUFFICIENT_POINTS
    (O-14, isti obrazac kao §20.5). Voucher, mapping i REWARD_RESERVE ne nastaju.
  · Kod ACCOUNT_*, REWARD_NOT_FOUND, REWARD_INACTIVE i 500 reconcile se ne izvršava (ništa upisano).
  · Ne diraju se voucher-i drugih korisnika ni voucher-i koji nisu ACTIVE (EXPIRED, CANCELLED, REDEEMED), ni neistekli ACTIVE.
  · Pri reconcile-u se na voucher-u mijenja SAMO status (§15 nema polje expiredAt; cancelledAt/redeemedAt ostaju null).
- §13.2, §7.4, §7.2 — u JEDNOJ transakciji: available −= cost, reserved += cost (+ updatedAt), ACTIVE voucher, REWARD_RESERVE,
  rewardRequests mapping. Invarijante availablePoints ≥ 0 i reservedPoints ≥ 0 poslije svakog događaja.
- §14 — rewardRequests/{requestKey}, requestKey = SHA-256(uid + ":" + requestId) (Planner predlaže kodiranje; preporuka:
  hex malim slovima nad UTF-8 bajtovima). Schema TAČNO { uid, requestId, rewardId, voucherId, createdAt }.
  Isti (uid, requestId) i isti rewardId → isti voucher bez nove rezervacije; isti requestId za drugi rewardId → 409
  IDEMPOTENCY_CONFLICT, ništa upisano. Isti requestId drugog korisnika je drugi ključ (nezavisan zahtjev).
  Neuspješan issue (409, 404, 500) NE pravi mapping (schema traži voucherId).
- O-16 — mapping se provjerava PRIJE preduslova §13.1 (analogno O-12): ako mapping postoji i rewardId je isti → vraća se
  isti voucher i NIŠTA se ne upisuje (ni reconcile), bez obzira na trenutno stanje naloga (i DELETION_IN_PROGRESS), definicije
  nagrade, bodova i statusa voucher-a. Validacija ulaza (tijelo, requestId, format rewardId) UVIJEK prethodi provjeri
  idempotentnosti (i03/P-6).
- §15 — voucherId generiše samo Backend, kriptografski sigurnim generatorom (node:crypto randomBytes), opaque, ≥ 128 bita
  entropije. NISU dozvoljeni: crypto.randomUUID() (122 bita), Firestore auto-ID (~119 bita), bilo šta izvedeno iz requestId-a,
  uid-a ili vremena. Format mora biti ispravan Firestore doc ID, bezbjedan kao parametar putanje (i05/i06) i ne smije se moći
  zamijeniti sa Firebase UID-om (AC-04). Preporuka: 32 bajta → 64 hex znaka malim slovima (Planner predlaže i obrazlaže).
- §15 — voucher schema TAČNO { uid, rewardId, costPoints, status: "ACTIVE", issuedAt, expiresAt, redeemedAt: null,
  cancelledAt: null, redeemedAtStationId: null }; bez requestId (§15). issuedAt i expiresAt su Firestore Timestamp.
- §17 — expiresAt = issuedAt + 15 min TAČNO, po vremenu Backend-a (§1.4: server timestamp = Backend/Firebase server
  environment); Android sat nije authority. FieldValue.serverTimestamp() ne može +15 min → tehnika u tački 5.
- §11, §7.4, §7.6 — ledger TAČNO { uid, type, deltaAvailable, deltaReserved, availableAfter, reservedAfter, purchaseId: null,
  voucherId, createdAt }:
  · REWARD_RESERVE: deltaAvailable = −cost, deltaReserved = +cost;
  · REWARD_RELEASE: deltaAvailable = +cost, deltaReserved = −cost;
  immutable (tx.create, nikad update). availableAfter/reservedAfter = stanje poslije TOG događaja: kad transakcija ima više
  događaja (release-i, pa reserve), lanac je uzastopan i deterministički uređen (Planner predlaže redoslijed, npr. expiresAt,
  pa voucherId).
- §25.6, §25.7, §25.9, §31 — u firebase/firestore.rules dodati DOSLOVNO iz §31 blokove /rewardDefinitions/{rewardId},
  /vouchers/{voucherId} i /rewardRequests/{requestKey}, na mjestima i redoslijedom kao u §31
  (users, loyaltyAccounts, purchases, loyaltyLedger, rewardDefinitions, vouchers, notifications, rewardRequests, …, default deny).
  /redemptionRequests/{requestKey} ostaje za Iteraciju 6 (D-2). Postojeći blokovi ostaju netaknuti.
- §27 kodovi u opsegu: UNAUTHENTICATED, ACCOUNT_NOT_INITIALIZED, ACCOUNT_DELETION_IN_PROGRESS, REWARD_NOT_FOUND, REWARD_INACTIVE,
  INSUFFICIENT_POINTS, IDEMPOTENCY_CONFLICT, INVALID_REQUEST (O-1), NOT_FOUND (O-1; i za D-5 ako se odobri preporuka),
  INTERNAL_ERROR, SERVICE_UNAVAILABLE.
- NFR-04, NFR-05, NFR-06; AC-05, AC-06; AC-09 (RESERVE i RELEASE dio); AC-08 (dio: istekao voucher vraća bodove najviše jednom
  kroz interni reconcile).

3. VAN OPSEGA (NE SMIJE se implementirati)
- API-04 redeem, API-05 cancel, API-06 reconcile endpoint, API-07 delete; REWARD_REDEEM; prelazi u CANCELLED i REDEEMED;
  redemptionRequests i njegov §31 blok (Iteracija 6); FORBIDDEN (nije potreban u i04).
- Bilo kakva notifikacija za issue, release ili istek (§9.2 poznaje samo POINTS_EARNED).
- Upis u rewardDefinitions iz Backend-a (seed iz i01 ostaje jedini upis; nema admin funkcija, §1.3).
- Ograničenje broja aktivnih voucher-a po korisniku (SRS ga ne traži).
- Android (Rewards ekran, reward QR, countdown, poziv reconcile-a na Home-u) — Iteracije 9–10; POS Simulator — Iteracija 11;
  composite indeksi za Android upite — Iteracija 10.
- Izmjena ugovora i ponašanja API-01 i API-02; konačan RULE-T12 i 12/12 (Iteracija 8); FCM.

4. ZAVISNOSTI
- i01: katalog grešaka, centralni rukovalac, parsirajJson, korelacija, dnevnik.js, seed rewardDefinitions (CAR_WASH 50,
  SHOWER 30; displayName latinicom, i01/P-1), provjera.ps1.
- i02: napraviProvjeruTokena, ROK_ZAVISNOG_SERVISA_MS, saRokom, jeNedostupnostFirestore, strogo tijelo, procesBackenda/sporProksi,
  presretanje logova (svi kanali), zaštita emulator/demo.
- i03: obrazac transakcije (servisi/evidencijaKupovine.js), omotacBaze (failure injection, sakrijPostojece, sveTransakcijeZavrsene),
  provjera ID-a (i03/P-5), D-3 (šablon rute u logu), i03/P-6, i03/P-7, i03/P-15, I03-T16 (rok prije transakcije), poređenje
  Rules sa .docx-om privremenom skriptom van repoa (i03/P-14).
- Odluke: O-1, O-12 (analogija), O-14, O-15, O-16, D-1, D-2, D-3, D-4, D-5; ograničenja (b) i (e) iz docs/ODLUKE.md.
- Backlog: F1-01 (docs/iteracije/i03_review_fix1.md) — ispraviti u dokumentacionom koraku i04.

5. ODLUKE ORCHESTRATOR-a ZA OVU ITERACIJU
- O-14 (Ana, 2026-10-17): reconcile ide u istu transakciju kao issue, redoslijedom §13.1; kad issue padne na INSUFFICIENT_POINTS,
  release-i se commit-uju, pa odgovor 409 INSUFFICIENT_POINTS (obrazac §20.5).
- O-15 (Ana, 2026-10-17): requestId je samo kanonski UUID v4 malim slovima; velika slova → 422 INVALID_REQUEST.
  Razlog: jedan UUID mora dati tačno jedan requestKey (Android UUID.randomUUID().toString() daje mala slova).
- O-16 (Ana, 2026-10-17): mapping prije preduslova; retry istog (uid, requestId, rewardId) vraća isti voucher i ništa ne upisuje.
- D-4 (Orchestrator): rewardId iz putanje se provjerava kao ostali ID-evi PRIJE upotrebe kao putanja (string, isWellFormed,
  bez "/", nije "." ni "..", ne odgovara ^__.*__$ sa zastavicom s, dužina 1–128 UTF-16 jedinica). Neispravan → 404
  REWARD_NOT_FOUND bez pristupa Firestore-u (analogno i03/P-5; lista INVALID_REQUEST iz O-1 ne obuhvata ID-eve iz putanje).
  Napomena: Express dekodira "%2F" u "/" i "%00" u NUL. Planner utvrđuje ponašanje Firestore-a za ID sa NUL ili kontrolnim
  znakom i predlaže pravilo — ishod ne smije biti 500.
- D-5 (Orchestrator) — dekodiranje parametra putanje. Provjereno nad Express 5.2.1: neispravno percent-kodiran parametar
  (npr. POST /api/v1/rewards/%E0%A4%A/issue) baca URIError "Failed to decode param '<sirova vrijednost>'" (status 400) PRIJE
  rute. Sadašnji centralni rukovalac to vraća kao 500 INTERNAL_ERROR i u log upisuje stack koji SADRŽI sirovu vrijednost iz URL-a.
  To krši D-3 i postaje curenje tajne od Iteracije 5/6, kad je voucherId u putanji.
  Zahtjev: deterministički 4xx, bez stack-a i bez sirove vrijednosti u logu i odgovoru; ispravka je globalna (važi za sve
  buduće rute sa parametrom). Planner predlaže kod i mjesto ispravke; preporuka: 404 NOT_FOUND (O-1, zahtjev ne pogađa
  nijednu rutu), "putanja" u logu "(nepoznata ruta)". Ostale greške rutera/parsera se ne mijenjaju.
- Ugovor odgovora API-03 (SRS ga ne definiše): Planner predlaže, Ana odobrava. Ograničenja:
  · 201 za novi voucher, 200 za retry (preporuka, kao API-01/API-02);
  · tijelo se gradi iz voucher dokumenta (za retry iz SAČUVANOG dokumenta); voucherId, rewardId, costPoints, issuedAt i
    expiresAt su identični u prvom odgovoru i u svakom retry-ju; da li se vraća status i koji — Planner obrazlaže (preporuka:
    trenutni status sačuvanog voucher-a);
  · timestamp-ovi kao UTC ISO 8601 (kao occurredAt u API-02);
  · bez uid-a, requestId-a, requestKey-a, ID-eva ledger događaja, balance-a (Android ga čita iz loyaltyAccounts, §2.2) i
    bez ikakvih internih podataka.
- Vrijeme (§17, §18.1) — preporuka: jedno čitanje sata Backend-a po pokušaju transakcije (sadaMs = Date.now() unutar callback-a);
  issuedAt = Timestamp.fromMillis(sadaMs), expiresAt = Timestamp.fromMillis(sadaMs + 900 000), a reconcile poredi ISTI sadaMs
  ≥ expiresAt. Razmak je tako tačno 15 min i provjerljiv testom. Planner obrazlaže izbor i alternativu i upisuje rizik (sat
  Backend-a vs. Firestore) kao poznato ograničenje. Za ledger createdAt, mapping createdAt i loyaltyAccounts.updatedAt Planner
  predlaže serverTimestamp (kao i03) ili sadaMs, sa obrazloženjem. Nema test knob-a za sat u produkcionom kodu: testovi pripremaju
  voucher-e sa prošlim expiresAt Admin SDK-om, a granicu ≥ dokazuje jedinični test čiste funkcije sa fiksnim sadaMs.
- Ledger eventId (i03/P-7) — preporuka: reserve_{voucherId} i release_{voucherId}, uz tx.create. Voucher ima tačno jedan RESERVE i
  najviše jedan RELEASE (EXPIRED i CANCELLED su terminalni i međusobno isključivi, §16), pa deterministički release_{voucherId}
  garantuje "najviše jednom" na nivou ID-a i za i05 (cancel) i za i06 (istekao redeem). Planner potvrđuje ili obrazlaže
  alternativu; odobrena odluka postaje obavezujuća za i05/i06.
- Nekonzistentno stanje → 500 INTERNAL_ERROR, ništa upisano (Planner predlaže tačan skup provjera), najmanje:
  mapping postoji, a voucher ne postoji; mapping.uid / mapping.requestId ne odgovara zahtjevu; voucher.uid ili voucher.rewardId
  ne odgovara mapping-u; release_{voucherId} postoji, a voucher je ACTIVE; ACTIVE voucher sa neispravnim costPoints ili
  expiresAt; reserve_{voucherId} već postoji za novi voucherId.
- Konkurentnost: transakcija čita rewardRequests/{requestKey}, users/{uid}, loyaltyAccounts/{uid}, rewardDefinitions/{rewardId}
  i ACTIVE voucher-e korisnika (upit uid == UID i status == "ACTIVE" kroz tx.get(query)). Planner potvrđuje da Admin SDK tx.get(query)
  radi nad emulatorom i da upit sa dva uslova jednakosti ne traži composite indeks; ako traži, dodaje ga u
  firebase/firestore.indexes.json. Double-spend sprečava čitanje i ažuriranje ISTOG loyaltyAccounts dokumenta u transakciji —
  nikakva provjera bodova van transakcije.
- Upisi: svi novi dokumenti (voucher, mapping, ledger događaji) sa tx.create; loyaltyAccounts samo tx.update (availablePoints,
  reservedPoints, updatedAt); voucher pri reconcile-u samo tx.update statusa. Callback nema sporednih efekata van tx.
- Rok i kasni commit: isti mehanizam kao I03-T16 — istekao rok prije transakcije → runTransaction se ne poziva, 503. Kasni commit
  poslije 503 je prihvatljiv JER je idempotency ključ (uid, requestId): retry vraća isti voucher — MORA se dokazati testom
  (ograničenje (b)). maxAttempts ostaje 5; 503 pod kontencijom je dozvoljen ishod; testovi koji ga dozvoljavaju čekaju kraj
  svih transakcija (sveTransakcijeZavrsene) prije asercija i prije sljedećeg testa (i03 OD-5).
- Strogo tijelo kao i02/i03; neispravan JSON → 422 INVALID_REQUEST i bez token-a (i02/P-6). Redoslijed provjera (Planner predlaže
  tačan poredak, Orchestrator odobrava): dekodiranje parametra (D-5) → neispravan JSON (422) → token (401) → struktura tijela i
  requestId (422) → format rewardId (404, D-4) → rok (503) → transakcija: mapping (O-16: isti rewardId → retry; drugi → 409)
  → stanje naloga (409 / 500) → definicija nagrade (404 / 409 / 500) → reconcile → bodovi (409 uz commit release-a, O-14) → upisi.
  Sve prije transakcije se završava BEZ pristupa Firestore-u.
- Test-only: omotacBaze se smije proširiti (npr. sakrivanje dokumenata iz rezultata upita u tx.get, brojanje upisa po
  kolekciji); src/ nema grananja ni hook-ova za testove.
- Nijedan novi npm paket (UUID provjera regex-om; SHA-256 i randomBytes iz node:crypto).
- Regresioni testovi i01–i03 se smiju mijenjati SAMO kao proširenje ulaza; nijedna postojeća asercija se ne uklanja ni ne slabi.
  RULE-T12 (rewardRequests) mora ostati zelen i poslije dodavanja bloka /rewardRequests.
- TRACEABILITY: Builder popunjava "Kod", "Status" i "Planirani test" u redovima Iteracije 4: §7.4, §7.6 (i04 dio), §12 (i04 dio),
  §13, §14, §15, §17, §18 (i04 dio), §25/§31, §26 API-03, §27, NFR-04, NFR-05, NFR-06, AC-05, AC-06, AC-08 (i04 dio), AC-09,
  AUTH-03 (ACCOUNT_NOT_INITIALIZED); u tabeli tehničke dopune O-1 dopunjava upotrebu (requestId po O-15; NOT_FOUND za D-5 ako se odobri).
- docs/ODLUKE.md: Builder u dokumentacionom koraku upisuje status O-14, O-15, O-16, D-4, D-5, odluke i04/P-n iz sekcije
  "Odluke Orchestrator-a" plana i nova ograničenja za buduće iteracije; postojeće stavke ne mijenja.

6. DEFINITION OF DONE
[ ] Sve iz tačke 2 implementirano; ništa iz tačke 3.
[ ] Testovi iz tačke 7 prolaze; regresija i01–i03 prolazi (uključujući Android build kroz provjera.ps1).
[ ] Transakciona granica: release-i, balance, voucher, REWARD_RESERVE i mapping nastaju u istoj transakciji; failure injection na
    svakom upisu i prije commit-a → stanje korisnika deepStrictEqual stanju prije zahtjeva.
[ ] Double-spend: API-T07 ponovljen ≥ 20 puta u jednom izvršavanju — nikad dva uspješna issue-a; broj ponavljanja i raspodjela
    ishoda (201 / 409 / 503) upisani u TEST_REPORT.
[ ] Idempotentnost: paralelni isti requestId → jedan voucher, jedan REWARD_RESERVE, jedan mapping; kasni commit poslije 503 +
    retry → isti voucher.
[ ] Reconcile: release tačno jednom po voucher-u, i pod paralelnim issue-ima; O-14 dokazan.
[ ] Nijedan odgovor ni log (svi kanali, svi ishodi) ne sadrži token, stack prema klijentu, balance, requestKey ni sirovu putanju (D-3, D-5).
[ ] firestore.rules: dodati blokovi tekstualno jednaki §31 iz .docx-a (automatsko poređenje kao u i03); RULE-T09 zelen; RULE-T01 …
    RULE-T08, RULE-T10 … RULE-T12, I02-T15 i I03-T20 i dalje zeleni.
[ ] Kontrolne mutacije iz plana obaraju ciljane testove; ishod upisan u TEST_REPORT.
[ ] Test-only hook-ovi ne postoje u produkcionom kodu; nema novih paketa.
[ ] .\skripte\provjera.ps1 → exit 0 poslije svakog koraka plana i na kraju (uključujući novi smoke: POST /api/v1/rewards/CAR_WASH/issue
    bez token-a → 401 UNAUTHENTICATED); SRS hash nepromijenjen.
[ ] docs/TRACEABILITY.md, docs/IMPLEMENTATION_LOG.md (unos i04, status i04/P-n, ograničenja za buduće iteracije, poznata ograničenja),
    docs/TEST_REPORT.md (stvarni izlaz; F1-01 ispravljen), docs/ODLUKE.md i README (API-03) ažurirani.
[ ] Commit-i bez potpisa alata; PR iteracija-04 → main otvoren (bez merge-a).
[ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag i04.

7. OBAVEZNI TESTOVI
SRS katalog:
- API-T05  49 available → CAR_WASH (50) → 409 INSUFFICIENT_POINTS; users, loyaltyAccounts, vouchers, rewardRequests i loyaltyLedger
           korisnika deepStrictEqual stanju prije (nema isteklih voucher-a).
- API-T06  50 available → CAR_WASH → 201: available 0, reserved 50; voucher sa TAČNIM skupom polja (§15), status ACTIVE,
           expiresAt − issuedAt = 900 000 ms; REWARD_RESERVE sa TAČNIM skupom polja (§11); mapping sa TAČNIM skupom polja (§14)
           pod requestKey izračunatim u testu nezavisno po §14. Retry istog requestId → 200, isti voucher, stanje nepromijenjeno
           (jedan voucher, jedan RESERVE, jedan mapping).
- API-T07  50 available; dva PARALELNA CAR_WASH zahtjeva sa različitim requestId → nikad oba uspješna. Ponoviti ≥ 20 puta (svaki put
           novi korisnik). Svako ponavljanje, poslije kraja svih transakcija: najviše jedan 201, nijedan 500; drugi ishod 409
           INSUFFICIENT_POINTS ili 503 (tačno tijelo SERVICE_UNAVAILABLE); broj voucher-a = broj REWARD_RESERVE = broj mapping-a ≤ 1;
           balance tačno 0/50 ili 50/0 u skladu sa brojem voucher-a.
- RULE-T09 Owner get sopstvenog voucher-a i owner list (where uid == auth.uid, limit ≤ 20) → ALLOW; voucher write (create, update,
           delete; i vlasnika, npr. status ili costPoints) → DENY.
Dopunski (konačne oznake određuje Planner):
- I04-T01 Autentikacija: bez token-a, neispravan token, druga šema → 401 UNAUTHENTICATED, 0 pristupa bazi; UID samo iz token-a
          (?uid=<B>, X-User-Id: <B> → voucher korisnika A, ništa za B).
- I04-T02 Tijelo i requestId (O-15): svi oblici iz tačke 2 → 422 INVALID_REQUEST, 0 pristupa bazi; server-controlled i nepoznata
          polja u tijelu → 422; neispravan JSON bez token-a → 422.
- I04-T03 rewardId: format-ispravan nepostojeći ("FOO") → 404 REWARD_NOT_FOUND, ništa upisano; neispravan format (D-4: "%2F",
          "__x__", 129 znakova, NUL) → 404 bez pristupa bazi; neispravno percent-kodiran (D-5) → odobreni 4xx, log bez sirove
          vrijednosti i bez stack-a; GET na rutu issue → 404 NOT_FOUND.
- I04-T04 Stanje naloga: users ne postoji; users ACTIVE bez loyaltyAccounts; loyaltyAccounts bez users → 409 ACCOUNT_NOT_INITIALIZED;
          DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS; nepoznat accountStatus i neispravan loyaltyAccounts → 500;
          u svim slučajevima ništa upisano, ni kad postoji istekao ACTIVE voucher.
- I04-T05 Nagrada: active false → 409 REWARD_INACTIVE; neispravna definicija (costPoints 0, −1, 1.5, "50"; active "true") → 500;
          ništa upisano, ni reconcile. SHOWER (30) se izdaje ispravno; costPoints na voucher-u je snapshot (izmjena definicije
          poslije issue-a ne mijenja voucher).
- I04-T06 voucherId: ≥ 100 izdavanja → svi ID-evi jedinstveni i u odobrenom formatu; nisu izvedeni iz requestId/uid; voucherId u
          tijelu zahtjeva → 422. requestKey: isti requestId dva korisnika → dva nezavisna voucher-a.
- I04-T07 IDEMPOTENCY_CONFLICT: isti requestId za SHOWER poslije CAR_WASH → 409, stanje deepStrictEqual.
- I04-T08 O-16, retry pri promijenjenom stanju: poslije issue-a (a) available pao na 0, (b) reward active = false, (c) nalog
          DELETION_IN_PROGRESS, (d) voucher EXPIRED (reconcile-ovan drugim issue-om), (e) voucher ACTIVE a istekao → retry → isti voucher,
          0 upisa, dokumenti deepStrictEqual; (f) retry sa neispravnim requestId ili neispravnim formatom rewardId → 422 / 404 (i03/P-6).
- I04-T09 Reconcile prije issue-a: (a) 20 available + istekao CAR_WASH voucher (reserved 50) → SHOWER: voucher EXPIRED (samo status
          promijenjen), REWARD_RELEASE tačnih polja, pa RESERVE 30, uzastopan lanac availableAfter/reservedAfter; (b) neistekao ACTIVE
          ostaje; (c) EXPIRED/CANCELLED/REDEEMED sa prošlim expiresAt i voucher-i drugog korisnika se ne diraju; (d) više isteklih
          voucher-a → deterministički lanac; (e) O-14: release + INSUFFICIENT_POINTS → release commit-ovan, 409, nema voucher-a,
          mapping-a ni RESERVE; (f) jedinični test granice: sadaMs == expiresAt → istekao, sadaMs = expiresAt − 1 ms → nije.
- I04-T10 Release najviše jednom: 10 paralelnih issue-a (različiti requestId) istog korisnika sa istim isteklim voucher-om → tačno jedan
          REWARD_RELEASE za taj voucher, balance tačan; nekonzistentna stanja iz tačke 5 → 500, ništa upisano.
- I04-T11 Failure injection na svakom upisu (voucher pri reconcile-u, RELEASE, loyaltyAccounts, novi voucher, RESERVE, mapping) i prije
          commit-a → stanje deepStrictEqual stanju prije; odgovor 500 bez stack-a.
- I04-T12 10 paralelnih ISTIH zahtjeva (isti requestId) → tačno 1 voucher, 1 RESERVE, 1 mapping, balance promijenjen jednom; nijedan 500;
          najviše jedan 201; svi uspješni odgovori sa istim voucherId; 503 dozvoljen + naknadni retry → isti voucher.
- I04-T13 Issue paralelno sa kupovinama istog korisnika (npr. 5 kupovina + 3 issue-a, različiti requestId) → konačni available/reserved
          tačni; svi EARN, RESERVE i RELEASE događaji korisnika čine konzistentan lanac; invarijante ≥ 0.
- I04-T14 Kasni commit poslije 503 → retry istim requestId → isti voucher; tačno jedan RESERVE i jedan mapping.
- I04-T15 Istekao rok prije transakcije → runTransaction se NE poziva, 503, 0 pristupa bazi (kao I03-T16).
- I04-T16 Odgovori (svi ishodi) bez stack-a, balance-a, uid-a, requestKey-a; log (svi kanali) bez token-a i bez sirove putanje —
          za pogođenu rutu šablon /rewards/:rewardId/issue.
- I04-T17 Granice Rules van RULE-T09: vouchers — list bez limit-a, limit 21, bez uslova uid, tuđi voucher (get, list),
          neautentifikovan → DENY; rewardDefinitions — prijavljen get/list → ALLOW, neautentifikovan → DENY, create/update/delete → DENY;
          rewardRequests — i dokument sa uid == auth.uid → DENY za sve operacije.
Regresija: kompletne suite i01–i03 (backend jedinični + emulator, Rules); RULE-T12 zelen.

8. KOMANDE ZA PROVJERU (PowerShell, iz korijena repozitorijuma)
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE              # 0
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs                           # prazno

9. ISPORUKA BUILDER-a
A. PR iteracija-04 → main; B. CHANGELOG (IMPLEMENTATION_LOG); C. dodati/izmijenjeni fajlovi;
D. izvršeni testovi i rezultat po ID-u (uključujući kontrolne mutacije i statistiku API-T07); E. neizvršeni testovi i zašto;
F. poznata ograničenja i odstupanja od plana; G. ažurirana docs/TRACEABILITY.md i docs/ODLUKE.md.
