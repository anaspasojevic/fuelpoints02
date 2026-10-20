ITERATION BRIEF — FuelPoints — ITERACIJA 9: Android 1 — Login, Registracija, Home, Customer QR

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-09 (iz main na tagu i08, merge 2e98999) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i09
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (verzija na tagu i08) — sve odluke obavezujuće. Režim: ekspresni (O-30, O-31; Android bez mutacija, smoke samo API 35).
Okruženje: Windows 11, PowerShell, Android Studio (JDK iz Android Studio-a za Gradle), Android emulator API 35, Firebase Emulator Suite (demo-fuelpoints),
lokalni Backend (Node.js 24). Repozitorijum je state, razgovor nije state. Dizajn: docs/dizajn/*.png i docs/dizajn/prototip.html (displej benzinske pumpe).

1. CILJ
Prvi upotrebljiv Android klijent nad postojećim Backend-om i emulatorima: registracija sa init-om naloga, prijava, obnova sesije, reset lozinke, Home sa
stanjem bodova (direktno iz Firestore-a, uz offline/stale marker) i pozivom API-06 pri otvaranju, i Customer Loyalty QR sa UID-om. Android ostaje
untrusted klijent (§2.2, §3.2): ne mijenja bodove ni bilo koje kritično stanje.
Primjer smoke-a: registracija „Ana” / ana@primjer.ba / „Lozinka1” → Home 0 bodova; kupovina 42 730 ml preko PowerShell POST-a na /api/v1/pos/purchases
(lokalni POS ključ iz .env) → Home pokazuje 42 bez ručnog osvježavanja; QR ekran pokazuje UID kao QR i kao tekst; prekid mreže → marker „offline”.

2. SRS ZAHTJEVI U OPSEGU
- UI-01 Welcome/Login: e-mail, lozinka, Login, Register, Forgotten password. Pogrešna prijava → TAČNO „E-mail adresa ili lozinka nisu ispravni.” (§3.5)
  za svaki ishod prijave osim mrežne greške (posebna poruka).
- UI-02 Registration: display name, e-mail, password, password confirmation, prihvatanje uslova; NE prikuplja telefon ni datum rođenja.
  §3.6 klijentska validacija: ≥ 8 znakova, ≥ 1 veliko slovo, ≥ 1 cifra (isto pravilo kao Firebase policy „Require”, koje se podešava u i11 — O-2);
  displayName 1–100 UTF-16 jedinica (i02/P-3); acceptedTermsVersion = "1.0" (O-11).
- AUTH-01: validacija → Firebase Auth nalog → ID token → POST /api/v1/account/init (Authorization: Bearer). AUTH-10 uslovi se šalju pri init-u.
- AUTH-03: Auth nalog postoji, users/{uid} ne postoji (ili API vrati 409 ACCOUNT_NOT_INITIALIZED) → Android ponovo poziva init (O-42).
- AUTH-06: postojeća Auth sesija + ACTIVE nalog → Home bez ponovne prijave. DELETION_IN_PROGRESS → poruka, bez Home funkcija.
- AUTH-09: Forgotten password → Firebase sendPasswordResetEmail; Backend ne učestvuje; poruka ne otkriva da li e-mail postoji (§3.5 duh).
- UI-03 Home (O-41): displayName, availablePoints, reservedPoints samo ako > 0, offline/stale marker (NFR-08: metadata.isFromCache == true na
  snapshot-u loyaltyAccounts/{uid}), ulaz na QR; pri otvaranju Home-a poziv API-06 (§18, O-43).
- UI-04 / QR-01 … QR-05: QR sa Firebase UID-om generisan lokalno (ZXing ili ekvivalent, §2.6 — samo generisanje, bez skenera i bez dozvole za kameru),
  UID i kao tekst; bez Auth sesije nema QR-a; nema guest QR-a. QR-06 rizik je prihvaćen (bez dodatnih mjera).
- §2.2, §25.2, §25.3: Android čita samo users/{uid} i loyaltyAccounts/{uid} (owner get); ne piše ništa u Firestore u i09.
- §3.3, NFR-01: svaki Backend poziv nosi svjež ID token (Firebase SDK getIdToken), UID se nikad ne šalje u tijelu.
- NFR-07: u APK-u i repou nema tajni (nema google-services.json, POS ključeva, service account-a); token, UID i e-mail se ne pišu u Logcat.
- NFR-10: svaki važan touch target ≥ 48×48 dp; funkcionalne ikone bez teksta imaju contentDescription.
- AC-01 (dio: registracija, prijava, obnova sesije), AC-04 (Android dio: QR sadrži UID, nije voucher).

3. VAN OPSEGA
- UI-05 … UI-08, AUTH-07 logout, AUTH-08 promjena lozinke, Delete Account, Rewards / issue / cancel / reward QR (i10); POS Simulator (i11);
  pravi Firebase projekat, Email Enumeration Protection i password policy u konzoli (O-2 → i11); NFR-09 smoke na API 26 (i11); FCM; QR skener;
  izmjene Backend-a i Rules-a (ako Planner nađe da je izmjena Backend-a neophodna — STANI i upiši i09/P-n); Android upisi u Firestore.

4. ZAVISNOSTI
i01 (android-app kostur, i01/P-5 namespace, i01/P-8 verzije), i02 (API-01, i02/P-1 ugovor, i02/P-3), i05 (API-06, i05/P-1, O-21, (s)), i07 ((v):
Android ne poziva init za vrijeme brisanja), O-2 (emulator), O-31 (d), R-04 i05 (503 → ponoviti poziv), docs/dizajn.

5. ODLUKE ZA OVU ITERACIJU
- O-39 (Orchestrator; Planner potvrđuje probom (a)): bez google-services.json i bez google-services plugin-a; FirebaseApp se inicijalizuje u kodu
  iz BuildConfig vrijednosti (projectId demo-fuelpoints i demo vrijednosti koje nisu tajne); debug build koristi Auth i Firestore emulator na 10.0.2.2
  (portovi iz firebase.json). Konfiguracija za pravi projekat dolazi u i11 iz lokalnog fajla van repoa (O-2).
- O-40 (Orchestrator): Backend base URL iz BuildConfig (debug: http://10.0.2.2:<port lokalnog Backend-a>); cleartext HTTP dozvoljen SAMO u debug
  network_security_config i SAMO za 10.0.2.2; main manifest bez cleartext-a (NFR-01: HTTPS je obaveza produkcije, koja nije dio MVP-a §1.3).
- O-41 (Orchestrator): Home u i09 prikazuje samo funkcije čiji ekrani postoje (QR); ulazi za Purchases, Rewards, Notifications i Settings dodaju se u i10.
  Nema „mrtvih” dugmadi ni TODO ekrana.
- O-42 (Orchestrator; Planner predlaže tačan tok kao i09/P-n): AUTH-03 ponovni init treba displayName; Planner predlaže odakle (npr. Firebase Auth
  profil postavljen pri registraciji, ili kratka forma „dovrši registraciju”) uz obrazloženje.
- O-43 (Orchestrator): API-06 se poziva pri svakom otvaranju Home-a (ON_START), POST bez tijela (Content-Length: 0, ODLUKE (s)); greška API-06 ne
  blokira prikaz stanja; 503 → jedan ponovni pokušaj sa kratkom pauzom (R-04); 409 ACCOUNT_DELETION_IN_PROGRESS / ACCOUNT_NOT_INITIALIZED → AUTH-05 / AUTH-03 tok.
- O-44 (Orchestrator): tekst uslova korišćenja verzije "1.0" je kratak statički tekst u resursima; Planner predlaže tekst, Ana odobrava pri odobrenju plana.
- O-45 (Orchestrator): dozvoljene Android zavisnosti (minimalan skup, verzije po i01/P-8): Firebase BoM (auth, firestore), Navigation Compose,
  lifecycle-viewmodel-compose, kotlinx-coroutines (+ play-services za await), HTTP klijent (OkHttp sa kotlinx.serialization ILI Retrofit — Planner
  bira jedno), ZXing core; testImplementation: kotlinx-coroutines-test, okhttp mockwebserver. Ništa drugo bez i09/P-n. Dozvola samo INTERNET.
- Arhitektura: Kotlin + Jetpack Compose, Material3 sa sopstvenom temom po prototipu (svijetla i tamna), jedna aktivnost (GlavnaAktivnost), nazivi na
  srpskom (paketi, klase, funkcije), SRS nazivi na engleskom (polja, kodovi grešaka, endpointi).
- Greške §27: Android parsira { error: { code, message, correlationId } } i prikazuje srpsku poruku po kodu; nikad ne prikazuje stack ni sirov odgovor.
- Testovi (O-31 (c), (d)): JVM unit testovi (testDebugUnitTest, ulaze u provjera.ps1) za: §3.6 validator (granice: 7 / 8 znakova, bez velikog slova,
  bez cifre), displayName (0 / 1 / 100 / 101, UTF-16), poruku prijave §3.5, QR sadržaj = UID (generisanje + dekodiranje ZXing-om), API klijent
  (MockWebServer: Bearer zaglavlje, init tijelo tačno { displayName, acceptedTermsVersion }, API-06 bez tijela, parsiranje §27 greške, 503 → jedan retry),
  logika AUTH-03 / AUTH-06 / O-43 u ViewModel-ima (bez Android uređaja), NFR-08 mapiranje isFromCache → marker. Bez mutacija.
  Smoke (ručno, Ana, emulator API 35): skripta skripte/pokreniLokalno.ps1 (emulatori + seed + Backend sa lokalnim .env) i protokol
  docs/smoke/i09_smoke.md (koraci + očekivano); Builder na kraju traži od Ane da ga izvrši i upisuje rezultat u TEST_REPORT.
- O-30 (a): provjera.ps1 tačno 2×; u TEST_REPORT commit koda završnog run-a.
- Dokumentacija: TRACEABILITY (UI-01 … UI-04, AUTH-01/03/06/09 Android dio, §2.6, §3.6 klijent, QR-01 … QR-06, NFR-08, NFR-10 dio, AC-01 dio,
  AC-04), ODLUKE (O-39 … O-45, i09/P-n, §1 i08 ACCEPTED tag i08 merge 2e98999), IMPLEMENTATION_LOG, TEST_REPORT, README (pokretanje aplikacije lokalno).

6. DEFINITION OF DONE
[ ] UI-01 … UI-04 i tokovi AUTH-01 / 03 / 06 / 09 rade nad emulatorima (smoke API 35 PASS, upisan u TEST_REPORT).
[ ] JVM unit testovi iz tačke 5 prolaze; backend i Rules regresija prolazi (provjera.ps1 2×, exit 0).
[ ] Nema google-services.json ni tajni u repou (git ls-files); nema logovanja token-a / UID-a / e-maila; cleartext samo debug i samo 10.0.2.2.
[ ] Backend, Rules i SRS nepromijenjeni (git diff i08 -- backend firebase docs/srs prazno).
[ ] PR iteracija-09 → main bez merge-a; commit-i bez potpisa alata. Reviewer (O-31): ACCEPTED → merge → git diff <vrh PR-a> main prazno → tag i09.

7. KOMANDE (PowerShell, iz korijena)
cd android-app; .\gradlew.bat assembleDebug testDebugUnitTest; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE
.\skripte\pokreniLokalno.ps1              # za smoke; gasi se Ctrl+C
git diff i08 -- backend firebase docs/srs  # prazno

8. ISPORUKA: PR; kratak sažetak; testovi po ID-u; smoke rezultat (Ana); screenshot-i Login, Home, QR (za kasniji rad) u docs/smoke/; OD-n; commit
koda završnog provjera.ps1 run-a (Reviewer).
