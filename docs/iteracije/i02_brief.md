ITERATION BRIEF — FuelPoints — ITERACIJA 2: Account lifecycle + authentication boundary

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-02 (iz main na tagu i01) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i02
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se)
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints)
Preduslov: tag i01 postoji; .\skripte\provjera.ps1 na main vraća 0.
Repozitorijum je state, razgovor nije state.

1. CILJ
Uspostaviti granicu povjerenja Android → Backend (verifikacija Firebase ID token-a, UID isključivo iz token-a)
i API-01 POST /api/v1/account/init, koji u JEDNOJ Firestore transakciji kreira users/{uid} i loyaltyAccounts/{uid},
idempotentno i ispravno pod konkurentnim pozivima. Uvesti Security Rules za users i loyaltyAccounts doslovno iz §31.

2. SRS ZAHTJEVI U OPSEGU
- §3.1–§3.3, NFR-01 — middleware za zaštićene Android endpointe:
  Authorization: Bearer <Firebase-ID-token>; verifikacija Admin SDK-om SA provjerom opoziva (checkRevoked);
  UID se uzima ISKLJUČIVO iz verifikovanog token-a. Nedostajući header, pogrešna šema, neispravan, istekao ili
  opozvan token, kao i token obrisanog ili onemogućenog korisnika → 401 UNAUTHENTICATED.
  Token se nikad ne loguje i ne vraća u odgovoru.
- §5 AUTH-02, §26 API-01 — POST /api/v1/account/init, ulaz { displayName, acceptedTermsVersion }.
  U jednoj Firestore transakciji:
    users/{uid}           { displayName, accountStatus: "ACTIVE", createdAt, updatedAt,
                            acceptedTermsVersion, acceptedTermsAt }
    loyaltyAccounts/{uid} { availablePoints: 0, reservedPoints: 0, createdAt, updatedAt }
  Svi timestamp-ovi su serverski. Nijedan od dva dokumenta ne smije ostati samostalno kreiran.
  Polja accountStatus, createdAt, acceptedTermsVersion i acceptedTermsAt su server-controlled.
- AUTH-03 — Auth nalog postoji, a users/{uid} ne postoji: init kreira nalog. (Android retry je Iteracija 9.)
- AUTH-04 — ACTIVE nalog.
- AUTH-05 — ako users/{uid}.accountStatus == "DELETION_IN_PROGRESS": init → 409 ACCOUNT_DELETION_IN_PROGRESS,
  ništa se ne mijenja.
- AUTH-10 + odluka O-11 (Ana) — acceptedTermsVersion mora biti JEDNAK aktuelnoj verziji uslova iz konfiguracije
  Backend-a (env varijabla; vrijednost "1.0"); u suprotnom 422 INVALID_REQUEST. acceptedTermsAt = server timestamp.
- API-T01 idempotentnost — ponovljeni init za postojeći ACTIVE nalog ne mijenja NIJEDNO polje
  (ni displayName, ni bodove, ni timestamp-ove) i vraća postojeće stanje.
- §7.1, §7.2 — loyaltyAccount schema (bez lifetimeEarnedPoints) i invarijante ≥ 0.
- Validacija ulaza:
  · displayName: string dužine 1–100 (ista granica kao §31 za update); inače 422 INVALID_DISPLAY_NAME;
  · tijelo mora biti JSON objekat sa TAČNO poljima displayName i acceptedTermsVersion; bilo koje drugo polje
    (uid, accountStatus, availablePoints, reservedPoints, …) → 422 INVALID_REQUEST i ništa se ne upisuje
    (zaštita od mass assignment-a, §3.2–§3.3).
- §27 kodovi u opsegu: UNAUTHENTICATED, ACCOUNT_DELETION_IN_PROGRESS, INVALID_DISPLAY_NAME, INVALID_REQUEST,
  INTERNAL_ERROR, SERVICE_UNAVAILABLE.
- SERVICE_UNAVAILABLE 503 — ako Firestore ili Auth nisu dostupni, zahtjev se završava u ograničenom roku sa 503
  (ne visi, nije 500 i nije 401).
- NFR-04 — atomičnost init-a dokazana failure injection testom.
- NFR-01 zaštita — Backend odbija start ako je postavljena FIRESTORE_EMULATOR_HOST ili FIREBASE_AUTH_EMULATOR_HOST,
  a FIREBASE_PROJECT_ID ne počinje sa "demo-" (u emulator režimu Admin SDK prihvata NEPOTPISANE token-e).
- §25.2, §25.3, §31 — u firebase/firestore.rules dodati DOSLOVNO iz §31: helper funkcije signedIn, isOwner,
  ownResource, changedOnly i match blokove /users/{uid} i /loyaltyAccounts/{uid}. Default deny ostaje.

3. VAN OPSEGA (NE SMIJE se implementirati)
- API-02 … API-07 i svaka loyalty mutacija; init NE pravi ledger event (§11 nema tip za kreiranje naloga);
- zajednički "account gate" (ACCOUNT_NOT_INITIALIZED) za druge endpointe — Iteracija 4, prvi endpoint koji ga vraća;
- POS autentikacija (Iteracija 3); recent auth i DELETE /account (Iteracija 7);
- Android (registracija, login, retry init-a, promjena displayName-a) — Iteracije 9–10;
- pravila za kolekcije osim users i loyaltyAccounts (Iteracije 3–8);
- password policy, e-mail verifikacija, Email Enumeration Protection (§1.3, Iteracija 9 / O-2);
- FCM, Cloud Functions, health/status ili bilo koji dodatni endpoint.

4. ZAVISNOSTI
- i01: katalog grešaka i centralni handler (§27, O-1, P-4, ispravka R-01), emulator test infrastruktura,
  zaštita samo-emulator, provjera.ps1, log test sa svim kanalima (R-02).
- Odluke: O-1, O-11, D-2.

5. ODLUKE ORCHESTRATOR-a ZA OVU ITERACIJU
- O-11 (Ana, 2026-10-15): prihvata se samo aktuelna verzija uslova iz konfiguracije.
- verifyIdToken sa checkRevoked = true.
- Strogo tijelo: nepoznata polja → INVALID_REQUEST.
- Zaštita od emulator režima sa ne-demo projektom (tačka 2).
- SRS NE definiše response body ni statusni kod uspjeha za API-01. Planner predlaže minimalan ugovor
  (samo SRS-imenovana polja, bez internih detalja; npr. razlikovanje prvog i ponovljenog init-a),
  a Orchestrator/Ana ga odobravaju u planu. Builder ga ne mijenja bez odobrenja.
- Djelimično stanje (postoji samo jedan od users/loyaltyAccounts, npr. ručno unesen): Planner predlaže
  ponašanje, Orchestrator odobrava. Init NE smije resetovati postojeće bodove.
- I01-T10: dio za users se uklanja (zamjenjuju ga RULE-T01 i RULE-T03); dio za loyaltyLedger ostaje do Iteracije 3.
- TRACEABILITY: Builder smije u redovima Iteracije 2 popuniti „Kod”, „Status” i „Planirani test” i u redu AUTH-03
  zamijeniti „I02 ACCOUNT_NOT_INITIALIZED” sa „I02 init iz stanja NOT_INITIALIZED; ACCOUNT_NOT_INITIALIZED u i04”.
- Ograničenje koje se dokumentuje (ne ispravlja): u emulatoru se ne može testirati odbijanje token-a sa pogrešnim
  potpisom, jer emulator token-i nisu potpisani. To ide u TEST_REPORT kao poznato ograničenje.

6. DEFINITION OF DONE
[ ] Sve iz tačke 2 implementirano; ništa iz tačke 3.
[ ] Svi testovi iz tačke 7 prolaze; regresija i01 prolazi (I01-T01 … I01-T11, RULE-T12, Android build).
[ ] Transakciona granica: oba dokumenta nastaju u istoj transakciji; failure injection test pokazuje 0 dokumenata.
[ ] Konkurentni init ne pravi duplikate, ne vraća 500 i ne resetuje stanje.
[ ] Nijedan odgovor ne sadrži stack, token ni internu poruku; nijedan log ne sadrži token (svi kanali).
[ ] firestore.rules: users i loyaltyAccounts doslovno iz §31 + default deny; RULE-T01 … RULE-T07 zeleni.
[ ] Test-only hook-ovi (failure injection, test rute) ne postoje u produkcionoj aplikaciji.
[ ] .\skripte\provjera.ps1 → exit 0; SRS hash nepromijenjen.
[ ] docs/TRACEABILITY.md, docs/IMPLEMENTATION_LOG.md (unos i02), docs/TEST_REPORT.md (stvarni izlaz) ažurirani.
[ ] Commit-i bez potpisa alata; PR iteracija-02 → main otvoren (bez merge-a).
[ ] Reviewer: ITERATION ACCEPTED → merge → anotirani tag i02.

7. OBAVEZNI TESTOVI
SRS katalog:
- API-T01  Validan init kreira profile i balance 0/0 sa tačnim poljima; ponovljeni init ne resetuje stanje
           (prethodno ručno postavljen availablePoints = 42 ostaje 42; displayName i timestamp-ovi nepromijenjeni).
- RULE-T01 Neautentifikovan read users/{uid} → DENY.
- RULE-T02 Owner read sopstvenog profila → ALLOW.
- RULE-T03 Cross-user read profila → DENY.
- RULE-T04 Owner update samo displayName + updatedAt (= request.time) → ALLOW.
- RULE-T05 Update koji dodaje server/unknown polje (npr. accountStatus) → DENY.
- RULE-T06 Owner read sopstvenog loyaltyAccounts/{uid} → ALLOW.
- RULE-T07 Client write nad loyaltyAccounts (create, update, delete, i od strane vlasnika) → DENY.
Dopunski (konačne oznake određuje Planner):
- I02-T01 Bez Authorization header-a → 401 UNAUTHENTICATED, ništa upisano.
- I02-T02 Pogrešna šema ("Basic …", "Bearer" bez token-a) i neispravan token → 401.
- I02-T03 Token obrisanog i token onemogućenog korisnika → 401 (checkRevoked).
- I02-T04 uid u tijelu (drugačiji od token-a) → odbijeno (INVALID_REQUEST); ni u jednom slučaju se ne kreira
          dokument za uid iz tijela.
- I02-T05 Server-controlled polja u tijelu (accountStatus, availablePoints, reservedPoints, createdAt,
          acceptedTermsAt) → 422 INVALID_REQUEST, ništa upisano.
- I02-T06 displayName: nedostaje, "", 101 znak, nije string → 422 INVALID_DISPLAY_NAME; 1 i 100 znakova → uspjeh.
- I02-T07 acceptedTermsVersion: nedostaje, nije string, različit od aktuelne verzije → 422 INVALID_REQUEST.
- I02-T08 Failure injection između upisa dva dokumenta → nijedan dokument ne postoji, odgovor 500/503 bez stack-a.
- I02-T09 10 paralelnih init-a za isti uid (različiti displayName) → tačno jedan users i jedan loyaltyAccounts
          dokument, stanje 0/0, nijedan odgovor 500; svi uspješni odgovori vraćaju isto stanje.
- I02-T10 Nalog u DELETION_IN_PROGRESS (pripremljen Admin SDK-om) → 409 ACCOUNT_DELETION_IN_PROGRESS,
          dokumenti nepromijenjeni.
- I02-T11 Firestore ili Auth nedostupan → 503 SERVICE_UNAVAILABLE u roku (npr. < 15 s), bez stack-a.
- I02-T12 Log asercija (svi kanali): token i Authorization se ne pojavljuju ni u logu ni u odgovoru.
- I02-T13 Backend odbija start sa emulator varijablama i projektom koji ne počinje sa "demo-".
Regresija: kompletna i01 suita; I01-T10 bez users dijela.

8. KOMANDE ZA PROVJERU (PowerShell, iz korijena repozitorijuma)
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE              # 0
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs                           # prazno

9. ISPORUKA BUILDER-a
A. PR iteracija-02 → main; B. CHANGELOG (IMPLEMENTATION_LOG); C. dodati/izmijenjeni fajlovi;
D. izvršeni testovi i rezultat po ID-u; E. neizvršeni testovi i zašto; F. poznata ograničenja i odstupanja od plana;
G. ažurirana docs/TRACEABILITY.md.
