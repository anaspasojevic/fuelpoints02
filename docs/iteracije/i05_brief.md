ITERATION BRIEF — FuelPoints — ITERACIJA 5: Voucher cancel i account reconcile

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-05 (iz main na tagu i04, merge commit d445fe8) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i05
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; §31 uzimati iz .docx-a;
SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (sažetak svih odluka; detalji u sekcijama "Odluke Orchestrator-a" planova i01–i04)
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints)
Preduslov: tag i04 postoji; .\skripte\provjera.ps1 na main vraća 0.
Repozitorijum je state, razgovor nije state.

1. CILJ
Implementirati API-05 POST /api/v1/vouchers/{voucherId}/cancel i API-06 POST /api/v1/account/vouchers/reconcile:
Android autentikacija, strogo tijelo bez business input-a, i JEDNA Firestore transakcija po zahtjevu koja vraća rezervisane
bodove najviše jednom (ACTIVE → CANCELLED odnosno ACTIVE → EXPIRED; REWARD_RELEASE), idempotentno (state-idempotent cancel),
bez double-refund-a pod konkurentnim zahtjevima (API-T11, NFR-04, NFR-05, AC-08, AC-09).
Mehanizam reconcile-a iz i04 (isti redoslijed, isti release_{voucherId}, isti sadaMs) postaje JEDNA zajednička implementacija
koju koriste API-03, API-06 i (kasnije) redeem; ponašanje API-03 se ne mijenja.
PRVI KORAK iteracije je obaveza iz i04 (O-19, ODLUKE §6 (h)): ispravka loga 5xx grešaka PRIJE bilo kakvog koda u kojem je
voucherId u putanji.

2. SRS ZAHTJEVI U OPSEGU
- §26 API-05, API-06, §3.3, NFR-01 — Android autentikacija: postojeći posrednik napraviProvjeruTokena (i02), vezan SAMO na rute
  POST /vouchers/:voucherId/cancel i POST /account/vouchers/reconcile (ne na prefikse /vouchers ni /account); UID isključivo iz
  verifikovanog token-a; isti rok od 10 s za cijeli zahtjev, od ulaska u posrednik. Nedostajući ili neispravan token → 401
  UNAUTHENTICATED, ništa pročitano ni upisano.
- §26 (Input: "без body-ја" / "без business input-а") — vidi O-21 (politika tijela).
- §19 — cancel:
  · §19.1: ACTIVE voucher → status CANCELLED, cancelledAt = serverTime, reservedPoints −= cost, availablePoints += cost,
    REWARD_RELEASE; sve u jednoj transakciji;
  · §19.2: voucher je već CANCELLED → vraća se postojeće CANCELLED stanje, NIKAKAV novi refund, ništa se ne upisuje;
  · §19.3: REDEEMED → 409 VOUCHER_ALREADY_REDEEMED; EXPIRED → 409 VOUCHER_EXPIRED;
  · O-5 (Ana, 2026-10-18): voucher koji je u bazi ACTIVE, a serverTime ≥ expiresAt, tretira se kao §20.5: u ISTOJ transakciji
    ACTIVE → EXPIRED, reservedPoints −= cost, availablePoints += cost, REWARD_RELEASE; poslije commit-a odgovor 409 VOUCHER_EXPIRED.
    Ishod nikad nije CANCELLED za voucher kome je istekao rok;
  · O-6 (Ana, 2026-10-18): voucher postoji, ali pripada drugom korisniku → 403 FORBIDDEN, ništa upisano ni otkriveno u tijelu odgovora.
    Voucher koji ne postoji → 404 VOUCHER_NOT_FOUND. (Prvi endpoint koji koristi FORBIDDEN.)
- §16, §15 — state machine: dozvoljeni prelazi ACTIVE → EXPIRED / CANCELLED; terminalna stanja se ne napuštaju; pri prelazu se na
  voucher-u mijenja SAMO status (i cancelledAt kod CANCELLED); redeemedAt i redeemedAtStationId ostaju null.
- §18, §18.1 — API-06: za svaki ACTIVE voucher korisnika za koji je serverTime ≥ expiresAt, u jednoj transakciji ACTIVE → EXPIRED,
  reservedPoints −= costPoints, availablePoints += costPoints, REWARD_RELEASE; najviše jednom po voucher-u. Voucher-i drugih
  korisnika, voucher-i koji nisu ACTIVE i neistekli ACTIVE se ne diraju.
- §11, §7.2, §7.4, §7.6 — ledger REWARD_RELEASE TAČNO { uid, type, deltaAvailable: +cost, deltaReserved: −cost, availableAfter,
  reservedAfter, purchaseId: null, voucherId, createdAt }; immutable (tx.create); ledger eventId release_{voucherId} (i04/P-5,
  ODLUKE §6 (g), (l)) uz eksplicitnu provjeru postojećeg release-a; lanac availableAfter/reservedAfter uzastopan i deterministički
  (expiresAt rastuće, pa voucherId — i04/P-6). Invarijante availablePoints ≥ 0 i reservedPoints ≥ 0 poslije svakog događaja.
- §27 kodovi u opsegu: UNAUTHENTICATED, FORBIDDEN, VOUCHER_NOT_FOUND, VOUCHER_EXPIRED, VOUCHER_ALREADY_REDEEMED,
  ACCOUNT_NOT_INITIALIZED, ACCOUNT_DELETION_IN_PROGRESS, INVALID_REQUEST (O-1), NOT_FOUND (O-1; i D-5), INTERNAL_ERROR,
  SERVICE_UNAVAILABLE. VOUCHER_CANCELLED NE koristi cancel (ponovljen cancel vraća stanje, §19.2); tek redeem u i06 (O-7).
- AUTH-03, AUTH-05 — stanje naloga za ove endpoint-e po O-20.
- NFR-04, NFR-05, NFR-06 (konkurentni cancel / reconcile); AC-08 (cancel i expiry dio — sada kompletan), AC-09 (RELEASE događaj).
- §25.7, §31 — Security Rules ostaju kakve su (blok vouchers iz i04); RULE-T09 i RULE-T01 … T12 moraju ostati zeleni.
  Izmjena firestore.rules se NE očekuje; ako je Planner nađe potrebnom, mora je obrazložiti prema §31.
- ODLUKE §6 (n) (N-01 iz review-a i04): API-03 retry i dalje vraća sačuvani status ACTIVE i za voucher kome je expiresAt prošao;
  API-06 je mehanizam kojim Android to rješava (poziv na Home-u, pa čitanje iz Firestore-a). README opisuje preporučeni tok.

3. VAN OPSEGA (NE SMIJE se implementirati)
- API-04 redeem i njegova logika; API-07 delete account; REWARD_REDEEM; redemptionRequests i njegov §31 blok (i06);
  VOUCHER_CANCELLED (O-7, i06); REAUTHENTICATION_REQUIRED.
- Bilo kakva notifikacija za cancel, release ili istek (§9.2 poznaje samo POINTS_EARNED).
- Izmjena ugovora i ponašanja API-01, API-02 i API-03 (dozvoljen je SAMO refaktor zajedničkog reconcile mehanizma sa nepromijenjenim
  ponašanjem; sve i04 asercije ostaju).
- Ograničenje broja voucher-a, admin funkcije, upis u rewardDefinitions, Android (Rewards ekran, countdown, pozivi API-05/06 — i09/i10),
  POS Simulator (i11), composite indeksi za Android upite (i10), brisanje naloga (i07), FCM.

4. ZAVISNOSTI
- i01–i03: kao u briefu i04 (katalog grešaka, centralni rukovalac, parsirajJson, korelacija, dnevnik.js, napraviProvjeruTokena,
  ROK_ZAVISNOG_SERVISA_MS, saRokom, jeNedostupnostFirestore, omotacBaze, procesBackenda, presretanje logova, provjera ID-a (i03/P-5),
  D-3, i03/P-6, i03/P-7, i03/P-15, provjera.ps1).
- i04: servisi/izdavanjeNagrade.js (reconcile unutar transakcije), servisi/vauceri.js (jeIstekao, poredakOslobadjanja, generator,
  requestKey), validacija/identifikator.js, rute/nagrade.js, greske/obradaGresaka.js (O-18, O-19), firestore.rules (vouchers,
  rewardRequests, rewardDefinitions), testovi API-T05 … API-T07, I04-T01 … I04-T20.
- Odluke: O-1, O-14, O-16 (analogija za idempotentnost prije preduslova), O-17 (tx.get(query) zadržan), O-18, O-19, D-3, D-5, K-1
  redoslijed (JSON 422 → D-5 404 → token 401), ograničenja (b), (g), (h), (j), (k), (l), (n), (p) iz docs/ODLUKE.md.
- Backlog: B-1, B-2 ostaju otvoreni (ne ulaze u i05).

5. ODLUKE ORCHESTRATOR-a ZA OVU ITERACIJU
- O-5 i O-6: vidi tačku 2 (odlučila Ana).
- O-19 — OBAVEZA, PRVI KORAK (ODLUKE §6 (h)), PRIJE koda koji stavlja voucherId u putanju:
  · R-07: gRPC grana u greske/obradaGresaka.js iz err.stack ne uzima nijedan red poruke (samo okvire stack-a; danas filter
    /^\s+at / propušta red poruke koji počinje sa "at ");
  · testovi koji obaraju mutacije R-M47 i R-M48 (definicije u docs/iteracije/i04_review_fix2.md, sekcija 4/6) i slučajevi praga 32 hex
    i velikih slova (R-09, R-08 — detalji u i04_review_fix2.md, sekcija 6);
  · R-10 (opis greške baca za ne-Error bez primitivne vrijednosti: try/catch sa statičkim opisom) — Planner odlučuje; preporuka: isti
    korak, jer je ista funkcija;
  · pravilo statičkih poruka: identifikatori (requestKey, voucherId, uid, requestId) se ne umeću u poruku loga ni u poruku new Error u
    servisima; Planner uvodi test koji to provjerava za nove servise.
- O-20 (Orchestrator; Planner potvrđuje ili obrazlaže alternativu) — stanje naloga, po uzoru na O-16:
  · CANCEL: idempotentno stanje se vraća PRIJE provjere naloga: voucher CANCELLED → 200 sa postojećim stanjem i NIŠTA se ne upisuje,
    bez obzira na stanje naloga (i DELETION_IN_PROGRESS). REDEEMED / EXPIRED → 409 (VOUCHER_ALREADY_REDEEMED / VOUCHER_EXPIRED),
    ništa se ne upisuje, bez obzira na stanje naloga (nema loyalty mutacije).
    Tek za ACTIVE voucher (jedini koji mutira): nalog mora biti ACTIVE (users DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS
    — AUTH-05 "нове loyalty mutation операције се одбијају"; users ne postoji ili loyaltyAccounts ne postoji → 409
    ACCOUNT_NOT_INITIALIZED; accountStatus van enum-a ili loyaltyAccounts neispravan → 500; ništa upisano, ni O-5 release).
  · RECONCILE (API-06): nalog ne postoji → 409 ACCOUNT_NOT_INITIALIZED; DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS;
    neispravno stanje → 500; ništa upisano. Nalog ACTIVE bez isteklih voucher-a → 200, brojač 0, ništa upisano.
  · Planner izvodi tačan redoslijed provjera i obrazlaže ga SRS-om.
- O-21 (Orchestrator) — politika tijela za endpoint-e bez business input-a ("без body-ја"): bez tijela i tijelo "{}" su ispravni;
  svako drugo tijelo (objekat sa ijednim poljem, niz, string, broj, null) → 422 INVALID_REQUEST; neispravan JSON → 422 i bez
  token-a (i02/P-6, K-1). Planner provjerava probom ponašanje express.json() za prazno tijelo, Content-Length: 0, bez Content-Type i
  Content-Type koji nije JSON, i predlaže tačno pravilo (Android/Retrofit šalje POST bez tijela).
- O-22 (Orchestrator) — voucherId iz putanje: format ^[0-9a-f]{64}$ (ODLUKE §6 (k)); neispravan → 404 VOUCHER_NOT_FOUND bez
  pristupa Firestore-u (analogno D-4); neispravno percent-kodiran → D-5 (404 NOT_FOUND). Vrijednost nikad u log (ni šablon rute,
  ni poruka, ni stack — §6 (h)) i nikad u odgovor greške. U uspješnom odgovoru voucherId je podatak vlasnika.
- Zajednički reconcile mehanizam — JEDNA implementacija (servis), koju koriste API-03, API-06 i pojedinačno oslobađanje za cancel/O-5:
  isti release_{voucherId} + tx.create + eksplicitna provjera postojećeg release-a, isti poredak (expiresAt, voucherId), isti
  jeIstekao(expiresAtMs, sadaMs) sa jednim sadaMs = Date.now() po pokušaju transakcije (ODLUKE §6 (j)). Refaktor se radi u zasebnom
  koraku plana, sa svim i04 testovima zelenim PRIJE dodavanja API-05/API-06; I04-T19 se u istom koraku usklađuje bez slabljenja
  (ODLUKE §6 (p)). Planner predlaže rasporede fajlova i imena.
- Ugovor odgovora (SRS ga ne definiše): Planner predlaže, Ana odobrava. Ograničenja:
  · API-05: 200 za prvi uspješan cancel I za ponovljen cancel (§19.2), tijelo se uvijek gradi iz SAČUVANOG voucher dokumenta
    (identično u prvom odgovoru i u svakom retry-ju): preporuka { voucherId, rewardId, costPoints, status: "CANCELLED", issuedAt,
    expiresAt, cancelledAt }; timestamp-ovi kao UTC ISO 8601 (kao API-03). Greške po §27 (tijelo standardno).
  · API-06: 200; preporuka tijela { reconciledCount: <broj voucher-a prebačenih u EXPIRED u ovom pozivu> } (bez voucherId-eva).
  · Nijedan odgovor ne sadrži uid, requestKey, ID-eve ledger događaja, balance (Android ga čita iz loyaltyAccounts, §2.2) ni interne podatke.
- Vrijeme: sadaMs = Date.now() jednom po pokušaju transakcije; za cancelledAt Planner predlaže serverTimestamp ili
  Timestamp.fromMillis(sadaMs) uz obrazloženje (§19.1 "serverTime"); ledger createdAt i loyaltyAccounts.updatedAt po i04 odluci
  (serverTimestamp). Nema test knob-a za sat u produkcionom kodu.
- Konkurentnost: cancel čita vouchers/{voucherId} i (za ACTIVE) users/{uid} i loyaltyAccounts/{uid} U transakciji; API-06 čita ACTIVE
  voucher-e korisnika kroz tx.get(query) (O-17). Double-refund sprečava čitanje i ažuriranje ISTOG loyaltyAccounts i ISTOG voucher
  dokumenta u transakciji + release_{voucherId} sa tx.create — nikakva provjera statusa van transakcije. Paralelni zahtjevi nad istim
  voucher-om (cancel × cancel, cancel × API-06, cancel × issue sa reconcile-om, API-06 × API-06) daju tačno jedan RELEASE.
- Kasni commit poslije 503: cancel je state-idempotent, pa je retry bezbjedan — MORA se dokazati testom (ograničenje (b));
  testovi koji dozvoljavaju 503 čekaju kraj svih transakcija (sveTransakcijeZavrsene) prije asercija i prije sljedećeg testa.
- Nekonzistentno stanje → 500 INTERNAL_ERROR, ništa upisano (Planner predlaže tačan skup provjera), najmanje: voucher bez ispravnih
  polja (uid, rewardId, costPoints cijeli broj ≥ 1, status u enum-u, expiresAt Timestamp); ACTIVE voucher a release_{voucherId} već
  postoji; loyaltyAccounts.reservedPoints < costPoints (bi pao ispod 0); CANCELLED / EXPIRED voucher bez odgovarajućeg release-a
  u ledger-u — Planner odlučuje da li se provjerava pri retry-ju (cijena: dodatno čitanje) ili ne (obrazložiti).
- Upisi: voucher samo tx.update (status, cancelledAt kod cancel-a); loyaltyAccounts samo tx.update (availablePoints, reservedPoints,
  updatedAt); RELEASE sa tx.create; callback bez sporednih efekata van tx.
- Test-only: omotacBaze se smije proširiti; src/ nema grananja ni hook-ova za testove. Nijedan novi npm paket.
- Regresioni testovi i01–i04 se smiju mijenjati SAMO kao proširenje ulaza (osim usklađenja I04-T19 iz refaktora, bez slabljenja);
  nijedna postojeća asercija se ne uklanja ni ne slabi.
- TRACEABILITY: Builder popunjava "Kod", "Status" i "Planirani test" u redovima Iteracije 5: §16 (i05 dio), §18 (API-06 dio),
  §19, §26 API-05 i API-06, §27 (FORBIDDEN, VOUCHER_NOT_FOUND, VOUCHER_EXPIRED, VOUCHER_ALREADY_REDEEMED), AUTH-05 (i05 dio),
  NFR-04, NFR-05, AC-08, AC-09; u tabeli tehničke dopune O-1 dopunjava upotrebu (NOT_FOUND; INVALID_REQUEST za tijelo).
- docs/ODLUKE.md: Builder u dokumentacionom koraku upisuje O-5, O-6, O-19 (izvršeno), O-20, O-21, O-22, odluke i05/P-n iz sekcije
  "Odluke Orchestrator-a" plana i nova ograničenja; zatvara O-5 i O-6 u tabeli otvorenih pitanja; ažurira (g), (h), (j), (k), (n), (p).

6. DEFINITION OF DONE
[ ] Obaveza O-19 izvršena PRIJE koda sa voucherId u putanji (zaseban commit; mutacije R-M47 i R-M48 obaraju svoje testove).
[ ] Sve iz tačke 2 implementirano; ništa iz tačke 3.
[ ] Testovi iz tačke 7 prolaze; regresija i01–i04 prolazi (uključujući Android build kroz provjera.ps1).
[ ] Refaktor zajedničkog reconcile-a: svi i04 testovi (API-T05 … API-T07, I04-T01 … I04-T20) zeleni poslije refaktora i PRIJE API-05/06.
[ ] Transakciona granica: svaki prelaz stanja (CANCELLED, EXPIRED), balance i RELEASE nastaju u istoj transakciji; failure injection na
    svakom upisu i prije commit-a → stanje korisnika deepStrictEqual stanju prije zahtjeva.
[ ] Double-refund: konkurentni cancel i konkurentni cancel × reconcile ponovljeni ≥ 20 puta — tačno jedan RELEASE po voucher-u, balance
    tačan, nijedan 500; broj ponavljanja i raspodjela ishoda upisani u TEST_REPORT.
[ ] Idempotentnost: ponovljen cancel → 200 sa istim stanjem, 0 upisa; kasni commit poslije 503 + retry → CANCELLED jednom, jedan RELEASE.
[ ] O-5, O-6, O-20, O-21, O-22 dokazani testovima.
[ ] Nijedan odgovor ni log (svi kanali, svi ishodi) ne sadrži token, voucherId iz putanje, stack prema klijentu, balance ni sirovu putanju
    (D-3, D-5, ODLUKE §6 (h)); šablon rute u logu.
[ ] Kontrolne mutacije iz plana obaraju ciljane testove; ishod upisan u TEST_REPORT (broj ponavljanja svake: n/10).
[ ] firestore.rules nepromijenjen ili izmjena obrazložena §31; RULE-T01 … RULE-T12 i dalje zeleni; nema test-only hook-ova u src/; nema novih paketa.
[ ] .\skripte\provjera.ps1 → exit 0 poslije svakog koraka plana i na kraju (novi smoke: POST /api/v1/vouchers/<64 hex>/cancel bez token-a
    → 401 UNAUTHENTICATED; POST /api/v1/account/vouchers/reconcile bez token-a → 401 UNAUTHENTICATED); SRS hash nepromijenjen.
[ ] docs/TRACEABILITY.md, docs/IMPLEMENTATION_LOG.md (unos i05, status i05/P-n, ograničenja za buduće iteracije, poznata ograničenja),
    docs/TEST_REPORT.md (stvarni izlaz), docs/ODLUKE.md i README (API-05, API-06 i preporučeni tok klijenta) ažurirani.
[ ] Commit-i bez potpisa alata; PR iteracija-05 → main otvoren (bez merge-a).
[ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag i05.

7. OBAVEZNI TESTOVI
SRS katalog:
- API-T11  ACTIVE CAR_WASH voucher (50, available 0 / reserved 50) → cancel → 200; voucher CANCELLED sa cancelledAt (Timestamp), ostala
           polja netaknuta; available 50, reserved 0; tačno jedan REWARD_RELEASE tačnih polja (§11) sa availableAfter/reservedAfter;
           ponovljen cancel → 200, isto tijelo, stanje svih dokumenata deepStrictEqual stanju poslije prvog cancel-a (nema drugog RELEASE).
- AC-08    istekao ACTIVE voucher vraća bodove najviše jednom kroz cancel (O-5), kroz API-06 i kroz API-03 reconcile; svaki put tačno jedan RELEASE.
Dopunski (konačne oznake I05-Txx određuje Planner):
- Obaveza O-19: testovi za R-07 … R-10 i mutacije R-M47, R-M48.
- Autentikacija (oba endpoint-a): bez token-a, neispravan token, druga šema → 401, 0 pristupa bazi; UID samo iz token-a
  (?uid=<B>, X-User-Id: <B> ne mijenja ishod).
- Tijelo (O-21): bez tijela, "{}" → ispravno; objekat sa poljem, niz, string, broj, null, neispravan JSON (i bez token-a) → 422, 0 pristupa bazi.
- voucherId iz putanje (O-22): neispravan format (velika slova, 63 / 65 znakova, "%2F", NUL, "__x__", uid-oblik, prazno) → 404
  VOUCHER_NOT_FOUND, 0 pristupa bazi; neispravno percent-kodiran → 404 NOT_FOUND (D-5), log bez sirove vrijednosti i bez stack-a;
  GET / PUT na rute → 404 NOT_FOUND.
- Cancel — postojanje i vlasništvo (O-6): ispravan format a ne postoji → 404 VOUCHER_NOT_FOUND; voucher drugog korisnika → 403 FORBIDDEN,
  oba dokumenta i balance oba korisnika deepStrictEqual prije/poslije, tijelo bez podataka o voucher-u; voucher bez polja uid → 500.
- Cancel — stanja: REDEEMED → 409 VOUCHER_ALREADY_REDEEMED; EXPIRED → 409 VOUCHER_EXPIRED; ništa upisano (pripremljeno Admin SDK-om sa
  konzistentnim ledger-om).
- Cancel — O-5: ACTIVE voucher sa prošlim expiresAt → u istoj transakciji EXPIRED + RELEASE (cancelledAt ostaje null), 409 VOUCHER_EXPIRED,
  bodovi vraćeni jednom; ponovljen zahtjev → 409 VOUCHER_EXPIRED, 0 upisa; jedinični test granice jeIstekao (sadaMs == expiresAt istekao,
  expiresAt − 1 ms nije); voucher kome rok ističe za 1 ms poslije sadaMs se otkazuje normalno.
- Cancel — nalog (O-20): ACTIVE voucher + DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS, ništa upisano (i za istekao voucher —
  nema O-5 release-a); CANCELLED voucher + DELETION_IN_PROGRESS → 200 bez upisa; REDEEMED / EXPIRED + DELETION_IN_PROGRESS → 409 voucher
  koda; users ne postoji / loyaltyAccounts ne postoji → 409 ACCOUNT_NOT_INITIALIZED; nepoznat accountStatus / neispravan loyaltyAccounts → 500.
- Cancel — nekonzistentno stanje → 500 bez upisa: release_{voucherId} već postoji a voucher ACTIVE; reservedPoints < costPoints;
  costPoints neispravan; status van enum-a.
- Cancel — konkurentnost: 10 paralelnih cancel-a istog voucher-a → tačno jedan RELEASE, svi uspješni odgovori identični, nijedan 500,
  503 dozvoljen + retry (ponoviti ≥ 20 puta, svaki put novi korisnik); cancel × API-06 × issue (sa reconcile-om) nad istim isteklim
  voucher-om → tačno jedan RELEASE, konačno EXPIRED, balance tačan; cancel različitih voucher-a istog korisnika paralelno → balance zbir.
- Cancel — failure injection na svakom upisu (voucher, RELEASE, loyaltyAccounts) i prije commit-a → stanje deepStrictEqual stanju prije;
  500 bez stack-a; isto za O-5 granu.
- Cancel — kasni commit poslije 503 → retry → CANCELLED jednom, jedan RELEASE (sveTransakcijeZavrsene); istekao rok prije transakcije →
  runTransaction se NE poziva, 503, 0 pristupa bazi.
- API-06: nalog bez voucher-a → 200, brojač 0, 0 upisa; dva istekla + jedan neistekao + jedan CANCELLED + jedan REDEEMED + jedan tuđi →
  tačno dva EXPIRED sa RELEASE lancem po (expiresAt, voucherId), ostali netaknuti, brojač 2; drugi poziv → brojač 0, 0 upisa;
  nalog (nema users / nema loyaltyAccounts / DELETION_IN_PROGRESS / neispravan) → 409 / 409 / 409 / 500 bez upisa; failure injection;
  10 paralelnih API-06 poziva → svaki voucher oslobođen jednom; API-06 × issue istog korisnika → balance tačan, bez duplog release-a.
- Zajednički mehanizam: kompletna i04 suite zelena poslije refaktora (uključujući API-T07 sa ≥ 20 ponavljanja).
- Očuvanje bodova: niz od ≥ 200 nasumičnih operacija (kupovina, issue, cancel, API-06, sa fiksiranim seed-om) nad jednim korisnikom →
  available + reserved = ukupno zarađeno − ukupno iskorišćeno (REDEEM nije u opsegu), nijedna vrijednost < 0, lanac ledger-a uzastopan.
- Odgovori i log (svi ishodi, svi kanali) bez token-a, voucherId-a iz putanje, uid-a, balance-a, stack-a; šabloni ruta
  /vouchers/:voucherId/cancel i /account/vouchers/reconcile; i dalje važi test iz i04 za API-03.
- Rules: bez novih testova ako se pravila ne mijenjaju; RULE-T01 … RULE-T12 zeleni.
Kontrolne mutacije (Builder izvršava lokalno, bez commit-a, svaku pa git restore; ishod n/10 u TEST_REPORT) — najmanje:
tx.create → tx.set za RELEASE; cancel bez provjere statusa ACTIVE; bez provjere postojećeg release_{voucherId}; ">" umjesto ">=" kod
isteka; provjera vlasnika uklonjena; provjera vlasnika poslije upisa; ponovljen cancel pravi novi RELEASE; cancelledAt se ne postavlja;
pogrešan predznak deltaAvailable/deltaReserved; loyaltyAccounts čitan van transakcije; O-5 grana bacanjem poništava release (krši O-5);
O-5 grana postavlja CANCELLED; provjera DELETION_IN_PROGRESS uklonjena; provjera naloga prije vraćanja CANCELLED stanja (krši O-20);
REDEEMED / EXPIRED provjera uklonjena; API-06 obrađuje voucher-e drugih korisnika; API-06 ne provjerava status ACTIVE; pogrešan brojač;
regex voucherId-a bez sidra ili sa zastavicom i; voucherId u log poruci; R-M47, R-M48 (O-19); neispravno tijelo prihvaćeno (O-21);
refaktor mijenja redoslijed release-a u API-03.
Regresija: kompletne suite i01–i04 (backend jedinični + emulator, Rules, Android build kroz provjera.ps1).

8. KOMANDE ZA PROVJERU (PowerShell, iz korijena repozitorijuma)
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE              # 0
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs                           # prazno

9. ISPORUKA BUILDER-a
A. PR iteracija-05 → main; B. CHANGELOG (IMPLEMENTATION_LOG); C. dodati/izmijenjeni fajlovi;
D. izvršeni testovi i rezultat po ID-u (uključujući kontrolne mutacije i statistiku konkurentnih testova); E. neizvršeni testovi i zašto;
F. poznata ograničenja i odstupanja od plana; G. ažurirana docs/TRACEABILITY.md i docs/ODLUKE.md.
