ITERATION BRIEF — FuelPoints — ITERACIJA 6: Voucher redeem (API-04)

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-06 (iz main na tagu i05, merge commit 5a2f8cc, PR #5) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i06
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; §31 uzimati iz .docx-a;
SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (verzija na main, tag i05) — sve odluke su obavezujuće
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints)
Preduslov: tag i05 postoji (checkpoint i05: provjera.ps1 na main vratio 0 prije taga).
Repozitorijum je state, razgovor nije state.

1. CILJ
Implementirati API-04 POST /api/v1/pos/vouchers/{voucherId}/redeem: POS autentikacija (X-POS-API-Key → stationId), strogo tijelo
{ redemptionRequestId }, i JEDNA Firestore transakcija po zahtjevu koja ACTIVE voucher prevodi u REDEEMED NAJVIŠE JEDNOM
(reservedPoints −= cost, availablePoints nepromijenjen, REWARD_REDEEM, redemptionRequests zapis), idempotentno po
(stationId, redemptionRequestId) (§20.2, NFR-05), bez double-spend-a pod konkurentnim zahtjevima (NFR-06, AC-07); istekao ACTIVE
voucher u istoj transakciji → EXPIRED + REWARD_RELEASE, pa 409 VOUCHER_EXPIRED (§20.5, AC-08).
Uz to: obaveza O-23 (ODLUKE §6 (t)) — zajednička provjera stanja voucher-a za redeem i cancel, i Rules blok redemptionRequests (D-2).

Primjer (brojevi za testove): nalog 30 / 50 (available / reserved), ACTIVE CAR_WASH (50), stanica SIM01, redemptionRequestId
"POS-RDM-001" → 200; voucher REDEEMED, redeemedAt, redeemedAtStationId "SIM01"; nalog 30 / 0; REWARD_REDEEM
{ deltaAvailable: 0, deltaReserved: −50, availableAfter: 30, reservedAfter: 0 }; jedan redemptionRequests zapis.
Isti zahtjev ponovo → 200, identično tijelo, 0 upisa.

2. SRS ZAHTJEVI U OPSEGU
- §26 API-04, §3.4, NFR-02 — postojeći napraviProvjeruPosKljuca(posStanice) (i03), vezan SAMO na rutu
  POST /pos/vouchers/:voucherId/redeem (ne na prefiks /pos); ista mapa i isti rok od 10 s od ulaska u posrednik (ODLUKE §6 (c));
  stationId ISKLJUČIVO iz res.locals.stationId; ključ nikad u log / odgovor; nedostajući ili pogrešan ključ → 401 UNAUTHENTICATED_POS,
  ništa pročitano ni upisano.
- §20 tijelo, §20.1, O-1 — tijelo je JSON objekat sa TAČNO jednim poljem redemptionRequestId: string koji odgovara
  ^[A-Za-z0-9._-]{1,64}$ (bez zastavica); nedostaje / drugi tip / dodatno polje (uključujući stationId, uid, voucherId) / niz / null /
  bez tijela / ne-JSON → 422 INVALID_REQUEST, 0 pristupa bazi. redemptionRequestId nikad u log ni u poruku greške.
- O-22, ODLUKE §6 (k) — voucherId iz putanje: ista provjeriVoucherId (validacija/zahtjevVaucera.js) → neispravan 404 VOUCHER_NOT_FOUND
  bez pristupa bazi; D-5 za neispravno percent-kodiranje; vrijednost nikad u log (§6 (h)).
- §20.2 — redemptionRequests/{requestKey}, requestKey po O-8 (b); zapis TAČNO { stationId, uid, redemptionRequestId, voucherId,
  resultStatus, createdAt }; uid postavlja Backend iz voucher dokumenta (POS ga ne šalje); isti ID za isti voucher → isti rezultat;
  isti ID za drugi voucher → 409 IDEMPOTENCY_CONFLICT. Zapis samo pri uspjehu (O-8 (a)).
- §20.3, §7.5, §16, §15 — uspjeh u JEDNOJ transakciji: status → REDEEMED, redeemedAt, redeemedAtStationId = stationId,
  reservedPoints −= costPoints, availablePoints se NE mijenja, REWARD_REDEEM, redemptionRequests zapis. Na voucher-u se mijenjaju
  SAMO status, redeemedAt i redeemedAtStationId; cancelledAt ostaje null.
- §20.4 — novi request ID za REDEEMED voucher → 409 VOUCHER_ALREADY_REDEEMED; ništa upisano.
- §20.5, §18 („при redemption-у конкретног voucher-а”), §7.6 — ACTIVE voucher sa sadaMs ≥ expiresAt: u ISTOJ transakciji
  ACTIVE → EXPIRED, reservedPoints −= cost, availablePoints += cost, REWARD_RELEASE (zajednički mehanizam, ODLUKE §6 (g), (q));
  poslije commit-a 409 VOUCHER_EXPIRED; redemptionRequests zapis se NE pravi (O-8 (a)).
- O-7 — CANCELLED → 409 VOUCHER_CANCELLED; EXPIRED (status) → 409 VOUCHER_EXPIRED; ništa upisano.
- §11 — REWARD_REDEEM TAČNO { uid, type: "REWARD_REDEEM", deltaAvailable: 0, deltaReserved: −cost, availableAfter, reservedAfter,
  purchaseId: null, voucherId, createdAt }; immutable (tx.create); eventId redeem_{voucherId} (O-28).
- §24, §25.9, §31 — blok match /redemptionRequests/{requestKey} { allow read, write: if false; } doslovno iz §31 (D-2), ispred
  default deny; nijedna druga izmjena firestore.rules.
- §27 kodovi u opsegu: UNAUTHENTICATED_POS, INVALID_REQUEST (O-1), NOT_FOUND (O-1, D-5), VOUCHER_NOT_FOUND, IDEMPOTENCY_CONFLICT,
  VOUCHER_ALREADY_REDEEMED, VOUCHER_CANCELLED, VOUCHER_EXPIRED, ACCOUNT_NOT_INITIALIZED, ACCOUNT_DELETION_IN_PROGRESS, INTERNAL_ERROR,
  SERVICE_UNAVAILABLE. FORBIDDEN se za redeem NE koristi (POS sa ispravnim ključem može otkupiti voucher bilo kog korisnika; voucherId je
  podatak kojim se otkupljuje, §15).
- AUTH-03, AUTH-05 — stanje naloga po O-25.
- NFR-04, NFR-05, NFR-06; AC-04 (backend dio: Customer QR UID kao voucherId → 404), AC-07, AC-08 (redeem dio — sada kompletan), AC-09.
- O-23 / ODLUKE §6 (t) — zajednička provjera stanja voucher-a (O-27).

3. VAN OPSEGA (NE SMIJE se implementirati)
- API-07 i bilo kakav cleanup redemptionRequests (i07; uid u zapisu se samo upisuje); O-9, O-10a; REAUTHENTICATION_REQUIRED.
- Notifikacija za redeem / release (§9.2 poznaje samo POINTS_EARNED); FCM.
- POS Simulator forme (i11), Android (i09/i10), admin funkcije, ručna korekcija bodova, refund/reversal (§1.3).
- Account-level reconcile pri redeem-u (O-26): redeem ne čita ni ne oslobađa druge voucher-e korisnika (bez tx.get(query)).
- Izmjena ugovora i ponašanja API-01 … API-06, osim O-27 (500 bez upisa za nekonzistentno stanje voucher-a, nedostižno kroz API);
  sve postojeće asercije ostaju.
- B-1 (odluka prije i08), B-2 (i09), R-02 (cancel retry bez provjere release_ ostaje po i05/P-4).
- Novi npm paketi; test-only hook-ovi u src/; izmjena i03/K-2 (provjera.ps1 poslije svakog koraka ostaje).

4. ZAVISNOSTI
- i03: napraviProvjeruPosKljuca, posStanice, i03/P-2, P-3, P-11 (fail closed), logBezPosKljuca test, i03/P-6 (validacija prije baze).
- i04: vauceri.js (FORMAT_VOUCHER_ID, jeIstekao, izracunajRequestKey, STATUSI_VAUCERA, jeIspravanSacuvaniVaucer), i04/P-2, P-5
  (prefiks redeem_ rezervisan za i06), i04/P-8 / K-1 (redoslijed: neispravan JSON 422 → D-5 404 → autentikacija 401 → …).
- i05: servisi/oslobadjanjeVaucera.js (pripremiOslobadjanja + upisiOslobadjanja sa { status: 'EXPIRED' } — JEDINI kod koji piše
  release_, §6 (q)), servisi/stanjeNaloga.js (procitajStanjeNaloga), validacija/zahtjevVaucera.js (provjeriVoucherId),
  servisi/otkazivanjeVaucera.js (cancel — dobija O-27), I05-T02 (statičke poruke važe automatski za nove servise), I05-T13 (sat po pokušaju).
- Odluke: O-1, O-16 (analogija), O-17, O-18, O-19, O-20 (analogija), O-22, O-23, D-2, D-3, D-5, K-1, i03/K-2; ograničenja (b), (c), (g),
  (h), (j), (k), (l), (q), (t).

5. ODLUKE ZA OVU ITERACIJU
- O-7 (Ana, 2026-10-19): redeem CANCELLED voucher-a → 409 VOUCHER_CANCELLED; redeem EXPIRED voucher-a (status) → 409 VOUCHER_EXPIRED;
  ništa se ne upisuje. Status u bazi ima prednost nad rokom: CANCELLED voucher kome je prošao expiresAt → VOUCHER_CANCELLED.
- O-8 (Ana, 2026-10-19):
  (a) redemptionRequests zapis se pravi SAMO pri uspješnom redemption-u (§20.3 korak 6), resultStatus: "REDEEMED". Neuspjeh (409, 404,
      422, 401, 500, 503) ne pravi zapis; §20.5 upisuje samo EXPIRED + RELEASE. Invarijanta: broj zapisa = broj REWARD_REDEEM =
      broj REDEEMED voucher-a. Posljedica (dokumentovati u README): request ID upotrijebljen za neuspješan pokušaj može se kasnije
      upotrijebiti za drugi voucher.
  (b) requestKey = SHA-256 nad UTF-8 stationId + ":" + redemptionRequestId, hex malim slovima (kao i04/P-4; postojeća
      izracunajRequestKey ili njen generički oblik bez promjene ponašanja API-03). Podjela je jednoznačna (ni stationId (O-13) ni
      redemptionRequestId (§20.1) ne sadrže ":"). Isti redemptionRequestId sa druge stanice je DRUGI ključ (novi zahtjev).
- O-24 (Orchestrator; Planner potvrđuje ili obrazlaže) — idempotentnost PRIJE stanja voucher-a (po uzoru na O-16, O-12; §20.2 to traži:
  retry uspješnog zahtjeva nailazi na REDEEMED voucher i ne smije dobiti 409). U transakciji prvo redemptionRequests/{requestKey}:
  · postoji i voucherId isti → 200 sa ISTIM tijelom kao prvi odgovor (iz sačuvanog voucher dokumenta), NIŠTA se ne upisuje, bez obzira
    na stanje naloga i rok; zapis mora biti konzistentan (polja, resultStatus "REDEEMED", voucher postoji, REDEEMED,
    redeemedAtStationId == stationId, uid jednak) — inače 500 bez upisa;
  · postoji a voucherId drugi → 409 IDEMPOTENCY_CONFLICT, ništa upisano, tijelo bez podataka o oba voucher-a.
- O-25 (Orchestrator, po uzoru na O-20) — stanje naloga (uid iz voucher dokumenta): REDEEMED / CANCELLED / EXPIRED → 409 voucher koda
  PRIJE provjere naloga (nema mutacije). Tek za ACTIVE: procitajStanjeNaloga — DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS,
  users ili loyaltyAccounts ne postoji → 409 ACCOUNT_NOT_INITIALIZED, neispravno → 500; ništa upisano, ni §20.5 release (AUTH-05).
  Ciljni redoslijed u transakciji (Planner potvrđuje): mapping (O-24) → voucher postoji (404) → konzistentnost voucher-a (O-27, 500) →
  REDEEMED / CANCELLED / EXPIRED (409) → nalog (samo ACTIVE) → istek (§20.5) → redeem_ ili release_ već postoji (500) →
  reservedPoints < cost (500) → upisi. Van transakcije (K-1): neispravan JSON 422 → D-5 404 → POS ključ 401 → tijelo 422 →
  format voucherId-a 404 (Planner potvrđuje redoslijed tijelo / voucherId po uzoru na API-03 i API-05).
- O-26 (Orchestrator) — §18 „при redemption-у конкретног voucher-а”: redeem reconcile-uje SAMO voucher iz putanje (§20.5); drugi istekli
  voucher-i istog korisnika se ne diraju (to radi API-06 / API-03). Nema tx.get(query) u redeem-u (bez kontencije iz B-2).
- O-27 (Orchestrator; izvršenje O-23, §6 (t)) — JEDNA funkcija konzistentnosti stanja voucher-a (servisi/vauceri.js), na osnovu §15:
  · ACTIVE    ⇒ redeemedAt === null, redeemedAtStationId === null, cancelledAt === null;
  · REDEEMED  ⇒ redeemedAt Timestamp, redeemedAtStationId neprazan string, cancelledAt === null;
  · CANCELLED ⇒ cancelledAt Timestamp, redeemedAt === null, redeemedAtStationId === null;
  · EXPIRED   ⇒ redeemedAt, redeemedAtStationId, cancelledAt === null;
  uz postojeće (uid, rewardId, costPoints ≥ 1, status u enum-u, issuedAt / expiresAt Timestamp). Nekonzistentno → 500, ništa upisano.
  OBAVEZNO koriste: redeem i cancel (API-05). Koristi je i procitajIstekleAktivne (API-03, API-06), da se ACTIVE voucher sa tragom
  redeem-a / cancel-a nigdje ne „oslobodi”; to je promjena samo za nedostižno nekonzistentno stanje. Planner provjerava test fiksture
  i01–i05 (polje izostavljeno ili null) i predlaže; preporuka: polja moraju postojati i biti null, a fiksture koje ih nemaju se dopunjuju
  SAMO dodavanjem polja sa null (proširenje ulaza, ne slabljenje). Za svakog korisnika funkcije test koji obara mutaciju „bez provjere”.
- O-28 (Orchestrator) — ledger loyaltyLedger/redeem_{voucherId} (i04/P-5), samo tx.create, uz eksplicitnu provjeru da ni redeem_{voucherId}
  ni release_{voucherId} ne postoje prije upisa (→ 500). Jedan modul piše redeem_ (git grep). Upisi uspjeha (Planner potvrđuje redoslijed):
  1 voucher (tx.update: status, redeemedAt, redeemedAtStationId), 2 redeem_ (tx.create), 3 loyaltyAccounts (tx.update: reservedPoints,
  updatedAt — availablePoints se ne upisuje), 4 redemptionRequests (tx.create). Sva čitanja prethode svim upisima.
- O-29 (Ana, 2026-10-19) — skraćenje trajanja iteracija; važi od i06 za SVE naredne iteracije i uloge (petlje, SRS testovi, git tag i
  i03/K-2 ostaju nepromijenjeni):
  (a) prije svakog dugog run-a (test:emu, provjera.ps1, ponovljeni konkurentni testovi) laptop ne smije u sleep (npr.
      powercfg /change standby-timeout-ac 0, poslije vratiti); run koji je prekinut ili traje nerealno dugo se PONAVLJA, ne tumači;
  (b) kontrolne mutacije: DETERMINISTIČKA mutacija (ciljani test ne zavisi od tajminga ni redoslijeda transakcija) se pokreće 1/1 i
      ciljani test mora pasti; KONKURENTNA / vremenski zavisna mutacija se pokreće n/10 i mora pasti u svakom od 10 run-ova. Plan svaku
      mutaciju označava D ili K uz obrazloženje. Zamjenjuje „n/10 za sve” iz briefova i03–i05;
  (c) ciljani emulator run: backend npm skript test:emu:ciljano koji kroz isti firebase emulators:exec (ista konfiguracija, projekat
      demo-fuelpoints, --test-concurrency=1) pokreće samo zadate test fajlove; koristi se za mutacije i razvoj. test:emu i provjera.ps1 se
      ne mijenjaju i ostaju dokaz za DoD. Bez novog npm paketa; tačan oblik (npr. mala Node skripta u backend/skripte) predlaže Planner
      nakon probe pod PowerShell-om;
  (d) vremenski okviri: Planner ≤ 1 h i ne pokreće provjera.ps1 (main je provjeren na checkpoint-u i05; Planner provjerava samo HEAD, tag
      i hash SRS-a); Reviewer ≤ 3 h, mutacije po jednom, provjera.ps1 najviše 2×;
  (e) TEST_REPORT sažet: po run-u samo komanda, exit kod, tests / pass / fail, trajanje i raspodjela ishoda konkurentnih testova; tabela
      mutacija ima JEDAN red po mutaciji (oznaka, tačna izmjena, D/K, ciljani test, ishod 1/1 ili n/10) — time je riješen i R-07; puni
      izlazi se ne lijepe, osim teksta neočekivano pale asercije.
- Vrijeme: sadaMs = Date.now() jednom po pokušaju transakcije (§6 (j)); redeemedAt = Timestamp.fromMillis(sadaMs) (kao i05/P-3);
  ledger createdAt, zapis createdAt i loyaltyAccounts.updatedAt = jedan serverTimestamp() po transakciji (i04/P-2). Test sata po
  pokušaju za novi servis po uzoru na I05-T13. Nema test knob-a za sat u src/.
- Ugovor odgovora (SRS ga ne definiše; Planner predlaže, Ana odobrava). Preporuka: 200 i za prvi redeem i za retry (§20.2 „исти
  резултат”); tijelo tačno { voucherId, rewardId, costPoints, status: "REDEEMED", issuedAt, expiresAt, redeemedAt, redeemedAtStationId }
  iz SAČUVANOG dokumenta (ista funkcija za prvi odgovor i retry; ISO 8601 UTC kao API-03). rewardId je potreban kasiru (šta izdaje).
  Nijedan odgovor ne sadrži uid, redemptionRequestId, requestKey, ID-eve ledger događaja, balance ni interne podatke.
- Konkurentnost: voucher, redemptionRequests/{requestKey}, users i loyaltyAccounts se čitaju U transakciji; double-redeem / redeem × cancel
  sprečava čitanje i ažuriranje ISTOG voucher dokumenta i ISTOG loyaltyAccounts u transakciji + tx.create za redeem_ i za zapis —
  nikakva provjera statusa van transakcije. Testovi moraju biti deterministički (i05/K-1): asercije važe za SVAKI redoslijed izvršavanja
  i ne oslanjaju se na kontenciju ni na 503; ako je potreban tačno određen redoslijed, postiže se test-only omotacBaze (dozvoljeno
  proširenje), ne tajmingom.
- Kasni commit poslije 503 (ograničenje (b)): retry istog redemptionRequestId vraća 200 sa istim tijelom (mapping) — MORA se dokazati
  testom; testovi koji dozvoljavaju 503 čekaju kraj svih transakcija (sveTransakcijeZavrsene) prije asercija i prije sljedećeg testa.
- Log (§6 (h), D-3, O-18, O-19): šablon rute /pos/vouchers/:voucherId/redeem; u logu (svi kanali, svi ishodi) nema X-POS-API-Key,
  voucherId-a, redemptionRequestId-a, requestKey-a, uid-a ni stack-a prema klijentu; poruke statičke (I05-T02 pokriva nove fajlove).
- Upisi: postojeći dokumenti samo tx.update navedenih polja; novi samo tx.create; callback bez sporednih efekata van tx; maxAttempts 5.
- Rules: dodaje se samo blok redemptionRequests (doslovno §31); RULE-T01 … RULE-T12 zeleni; dopunski Rules test: vlasnik (uid u zapisu ==
  auth.uid), drugi korisnik i neautentifikovan → get / list / create / update / delete DENY.
- Dokumentacija: R-06 (NOTE iz review-a i05) se rješava napomenom „Ispravka (i06)” u IMPLEMENTATION_LOG / TEST_REPORT (postojeći tekst
  i05 se ne prepisuje); R-07 je riješen formatom iz O-29 (e).
- Regresioni testovi i01–i05 se smiju mijenjati SAMO kao proširenje ulaza (uključujući O-27 dopunu fikstura); nijedna postojeća asercija
  se ne uklanja ni ne slabi.
- TRACEABILITY: Builder popunjava „Kod”, „Status” i „Planirani test” za: §3.4 (i06 dio), §7.5, §7.6 (API-T10), §11 (REDEEM), §16 (REDEEMED),
  §18 (redeem dio), §20, §24 / §25 / §31 (redemptionRequests), §26 API-04, §27 (nova upotreba), QR / AC-04 (backend dio), NFR-02, NFR-04,
  NFR-05, NFR-06, AC-07, AC-08, AC-09; u tabeli O-1 dopunjava INVALID_REQUEST za redemptionRequestId.
- docs/ODLUKE.md: Builder u dokumentacionom koraku upisuje O-7, O-8, O-24 … O-29, odluke i06/P-n iz sekcije „Odluke Orchestrator-a” plana i
  nova ograničenja; zatvara O-7 i O-8 u §9 i (t) u §6; O-29 upisuje i u §10 (konvencije toka rada); stanje iteracija u §1.

6. DEFINITION OF DONE
[ ] Sve iz tačke 2 implementirano; ništa iz tačke 3 (git grep scope provjera u TEST_REPORT).
[ ] API-T08, API-T09, API-T10 i svi dopunski I06-Txx prolaze; regresija i01–i05 prolazi (uključujući Android build kroz provjera.ps1).
[ ] O-27 implementirana kao JEDNA funkcija; koriste je redeem, cancel i procitajIstekleAktivne; mutacija „bez provjere” obara test kod svakog korisnika.
[ ] Transakciona granica: REDEEMED + REDEEM + balance + zapis, odnosno EXPIRED + RELEASE + balance, u istoj transakciji; failure injection na
    svakom upisu i prije commit-a → stanje deepStrictEqual stanju prije zahtjeva.
[ ] Double-redeem: konkurentni redeem × redeem (različiti ID-evi i stanice), redeem × cancel, redeem × API-06 × issue ponovljeni ≥ 20 puta
    (svaki put novi korisnik) — tačno jedan terminalni prelaz i tačno jedan ledger događaj po voucher-u, balance tačan, nijedan 500; broj
    ponavljanja i raspodjela ishoda u TEST_REPORT.
[ ] Idempotentnost: isti zahtjev → 200 isto tijelo, 0 upisa; kasni commit poslije 503 + retry → REDEEMED jednom, jedan REDEEM, jedan zapis.
[ ] O-7, O-8 (a), (b), O-24 … O-28 dokazani testovima.
[ ] Nijedan odgovor ni log ne sadrži POS ključ, voucherId, redemptionRequestId, requestKey, uid, balance ni stack; šablon rute u logu.
[ ] Kontrolne mutacije iz plana obaraju ciljane testove po O-29 (b): D 1/1, K n/10; ishod u TEST_REPORT u formatu O-29 (e).
[ ] test:emu:ciljano postoji i radi pod PowerShell-om (O-29 (c)); test:emu i provjera.ps1 nepromijenjeni.
[ ] firestore.rules: git diff i05 pokazuje samo blok redemptionRequests; RULE-T01 … RULE-T12 i dopunski Rules test zeleni; nema test-only
    hook-ova u src/; nema novih paketa.
[ ] git grep "release_" -- backend/src → samo servisi/oslobadjanjeVaucera.js; git grep "redeem_" -- backend/src → samo jedan servis.
[ ] .\skripte\provjera.ps1 → exit 0 poslije svakog koraka plana i na kraju (i03/K-2; novi smoke: POST /api/v1/pos/vouchers/<64 hex>/redeem
    bez X-POS-API-Key → 401 UNAUTHENTICATED_POS); SRS hash nepromijenjen.
[ ] docs/TRACEABILITY.md, docs/IMPLEMENTATION_LOG.md (unos i06, status i06/P-n, ograničenja za i07+, poznata ograničenja),
    docs/TEST_REPORT.md (stvarni izlaz, sažet po O-29 (e)), docs/ODLUKE.md i README (API-04, primjer zahtjeva, O-8 (a) posljedica) ažurirani.
[ ] Commit-i bez potpisa alata; PR iteracija-06 → main otvoren (bez merge-a).
[ ] Reviewer: ITERATION ACCEPTED → merge → provjera.ps1 na main → anotirani tag i06 → git push origin i06 (korak se NE preskače).

7. OBAVEZNI TESTOVI
SRS katalog:
- API-T08  nalog 30 / 50, ACTIVE CAR_WASH (50), SIM01, "POS-RDM-001" → 200; voucher REDEEMED, redeemedAt Timestamp (= sadaMs),
           redeemedAtStationId "SIM01", cancelledAt null, ostala polja netaknuta; nalog 30 / 0; tačno jedan REWARD_REDEEM tačnih polja
           (§11: deltaAvailable 0, deltaReserved −50, availableAfter 30, reservedAfter 0, purchaseId null); tačno jedan redemptionRequests
           zapis tačnih polja (uid iz voucher-a, resultStatus "REDEEMED"); availablePoints nijednom nije promijenjen.
- API-T09  isti zahtjev ponovo → 200, identično tijelo, stanje svih dokumenata deepStrictEqual stanju poslije prvog (nema drugog REDEEM);
           isti ID za drugi ACTIVE voucher → 409 IDEMPOTENCY_CONFLICT, drugi voucher netaknut; novi ID za isti voucher → 409
           VOUCHER_ALREADY_REDEEMED; isti ID sa stanice SIM02 → 409 VOUCHER_ALREADY_REDEEMED (drugi requestKey, nema zapisa).
- API-T10  ACTIVE voucher (50, nalog 0 / 50) sa prošlim expiresAt → 409 VOUCHER_EXPIRED; voucher EXPIRED (redeemedAt, cancelledAt null);
           nalog 50 / 0; tačno jedan REWARD_RELEASE; NEMA redemptionRequests zapisa ni REDEEM; ponovljen zahtjev → 409, 0 upisa;
           granica: sadaMs == expiresAt istekao, expiresAt − 1 ms otkupljiv.
Dopunski (konačne oznake I06-Txx određuje Planner):
- POS autentikacija: bez ključa, prazan, pogrešan, ključ druge dužine → 401 UNAUTHENTICATED_POS, 0 pristupa bazi; stationId iz tijela /
  query-ja / zaglavlja ignorisan ili 422 (tijelo strogo); bez posStanice → 500 (i03/P-11); log bez ključa (po uzoru na logBezPosKljuca).
- Tijelo (O-1, §20.1): ispravni rubovi (1 znak, 64 znaka, ".", "..", "__x__", "-_." kombinacije); neispravni (65 znakova, prazan string,
  ":", "/", razmak, Unicode, broj, null, niz, dodatno polje, bez tijela, ne-JSON, neispravan JSON i bez ključa) → 422, 0 pristupa bazi.
- voucherId iz putanje (O-22): velika slova, 63 / 65 znakova, "%2F", NUL, "__x__", Firebase UID (AC-04), prazno → 404 VOUCHER_NOT_FOUND,
  0 pristupa bazi; neispravno percent-kodiran → 404 NOT_FOUND (D-5); GET / PUT → 404 NOT_FOUND.
- Postojanje: ispravan format, ne postoji → 404 VOUCHER_NOT_FOUND, 0 upisa.
- Stanja (O-7): REDEEMED / CANCELLED / EXPIRED → 409 tačnog koda, 0 upisa (pripremljeno Admin SDK-om sa konzistentnim ledger-om);
  CANCELLED sa prošlim expiresAt → VOUCHER_CANCELLED.
- Nalog (O-25): ACTIVE voucher + DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS, 0 upisa (i za istekao — nema release-a);
  REDEEMED / CANCELLED / EXPIRED + DELETION_IN_PROGRESS → 409 voucher koda; users / loyaltyAccounts ne postoji → 409
  ACCOUNT_NOT_INITIALIZED; nepoznat accountStatus / neispravan loyaltyAccounts → 500; retry uspješnog zahtjeva kad je nalog u
  DELETION_IN_PROGRESS → 200 isto tijelo (O-24).
- Idempotentnost (O-24, O-8): nekonzistentan zapis (drugi stationId, resultStatus ≠ "REDEEMED", voucher ne postoji ili nije REDEEMED,
  uid ≠) → 500 bez upisa; neuspješan pokušaj ne pravi zapis, pa isti ID kasnije uspijeva za drugi voucher (O-8 (a)); requestKey
  deterministički i jednak SHA-256 (jedinični test sa poznatom vrijednošću).
- Nekonzistentno stanje → 500 bez upisa: redeem_ ili release_ već postoji a voucher ACTIVE; reservedPoints < costPoints; O-27 slučajevi
  (ACTIVE sa redeemedAt / redeemedAtStationId / cancelledAt, REDEEMED bez redeemedAt, ...) — za redeem, za cancel i za API-06 / API-03.
- Konkurentnost: 10 paralelnih identičnih zahtjeva → tačno jedan REDEEM i jedan zapis, svi uspješni odgovori identični, nijedan 500;
  redeem × redeem (dva ID-a, dvije stanice) → tačno jedan 200 i jedan 409 VOUCHER_ALREADY_REDEEMED (ili 503 + retry); redeem × cancel →
  tačno jedno od { REDEEMED + REDEEM, CANCELLED + RELEASE }, balance tačan; redeem × API-06 × issue nad isteklim → tačno jedan RELEASE,
  EXPIRED; redeem različitih voucher-a istog korisnika paralelno → reserved = zbir umanjenja. Svaki ≥ 20 ponavljanja, svaki put novi korisnik.
- Failure injection na svakom upisu (voucher, redeem_, loyaltyAccounts, redemptionRequests) i prije commit-a, i u §20.5 grani →
  stanje deepStrictEqual stanju prije, 500 bez stack-a; istekao rok prije transakcije → runTransaction se NE poziva, 503, 0 pristupa bazi;
  kasni commit poslije 503 + retry → 200 isto tijelo.
- Sat: sadaMs jednom po pokušaju za novi servis (po uzoru na I05-T13).
- Očuvanje bodova: niz od ≥ 200 nasumičnih operacija (kupovina, issue, cancel, API-06, redeem; fiksiran seed) nad jednim korisnikom →
  available + reserved = ukupno zarađeno − ukupno otkupljeno; nijedna vrijednost < 0; lanac availableAfter / reservedAfter uzastopan;
  broj REDEEM = broj zapisa = broj REDEEMED.
- Log i odgovori (svi ishodi, svi kanali): bez POS ključa, voucherId-a, redemptionRequestId-a, requestKey-a, uid-a, balance-a, stack-a.
- Rules: blok redemptionRequests; RULE-T12 i dopunski test (vlasnik, drugi korisnik, neautentifikovan → DENY za sve operacije).
Kontrolne mutacije (Builder izvršava lokalno kroz test:emu:ciljano / npm test, bez commit-a, svaku pa git restore; D 1/1, K n/10 po O-29 (b);
ishod u formatu O-29 (e)) — najmanje:
redeem bez provjere statusa ACTIVE; tx.create → tx.set za redeem_; tx.create → tx.set za zapis; bez provjere postojećeg redeem_ / release_;
mapping se provjerava poslije statusa voucher-a; mapping za drugi voucher ne daje 409; requestKey bez stationId; requestKey kao doslovan
string; zapis i pri §20.5 ili pri 409 (krši O-8 (a)); availablePoints se mijenja pri redeem-u; reservedPoints se ne smanjuje; pogrešan
predznak / deltaAvailable ≠ 0; redeemedAtStationId nije iz res.locals.stationId; redeemedAt se ne postavlja; cancelledAt se mijenja pri
redeem-u; ">" umjesto ">=" kod isteka; §20.5 grana bacanjem poništava release; §20.5 grana postavlja REDEEMED; CANCELLED → VOUCHER_EXPIRED
ili 404 (krši O-7); EXPIRED → VOUCHER_ALREADY_REDEEMED; provjera DELETION_IN_PROGRESS uklonjena; provjera naloga prije terminalnih stanja
(krši O-25); voucher ili loyaltyAccounts čitan van transakcije; O-27 uklonjena iz redeem-a; O-27 uklonjena iz cancel-a; O-27 uklonjena iz
procitajIstekleAktivne; redeem oslobađa druge istekle voucher-e korisnika (krši O-26); uid zapisa nije iz voucher-a; POS posrednik na
prefiksu /pos ili ruta bez posrednika; regex redemptionRequestId bez sidra / sa zastavicom i / bez gornje granice; voucherId ili
redemptionRequestId u log poruci; Rules blok redemptionRequests sa allow read: if signedIn().
Regresija: kompletne suite i01–i05 (backend jedinični + emulator, Rules, Android build kroz provjera.ps1).

8. KOMANDE ZA PROVJERU (PowerShell, iz korijena repozitorijuma)
# O-29 (a): prije dugih run-ova isključiti sleep, npr. powercfg /change standby-timeout-ac 0 (poslije vratiti)
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd backend; npm run test:emu:ciljano -- <fajl(ovi)>; cd ..      # tačan oblik po planu (O-29 (c)); samo za razvoj i mutacije
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE              # 0
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs                           # prazno
git diff i05 -- firebase/firestore.rules            # samo blok redemptionRequests
git grep -n "release_" -- backend/src               # samo servisi/oslobadjanjeVaucera.js
git grep -n "redeem_" -- backend/src                # samo jedan servis
# Checkpoint (poslije ITERATION ACCEPTED): .\skripte\provjera.ps1 → gh pr merge <N> --merge → git switch main; git pull →
# .\skripte\provjera.ps1 → git tag -a i06 -m "i06: Voucher redeem (API-04) - ITERATION ACCEPTED" → git push origin i06

9. ISPORUKA BUILDER-a
A. PR iteracija-06 → main; B. CHANGELOG (IMPLEMENTATION_LOG); C. dodati/izmijenjeni fajlovi;
D. izvršeni testovi i rezultat po ID-u (uključujući kontrolne mutacije i statistiku konkurentnih testova); E. neizvršeni testovi i zašto;
F. poznata ograničenja i odstupanja od plana; G. ažurirana docs/TRACEABILITY.md i docs/ODLUKE.md.
