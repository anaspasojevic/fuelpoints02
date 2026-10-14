ITERATION BRIEF — FuelPoints — ITERACIJA 1: Bootstrap i test infrastruktura

Repozitorijum: github.com/anaspasojevic/fuelpoints02 (prazan, bez commit-a)
Grana: iteracija-01 → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i01
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se)
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Android Studio, Firebase Emulator Suite
Repozitorijum je state, razgovor nije state.

1. CILJ
Postaviti kostur repozitorijuma i kompletnu test infrastrukturu tako da backend testovi,
testovi nad emulatorom (firebase emulators:exec) i Android build prolaze — BEZ ijedne
business funkcionalnosti. Naredne iteracije samo dodaju logiku i testove u ovu infrastrukturu.

2. SRS ZAHTJEVI U OPSEGU
- §2.1, §34.1 — kostur svih obaveznih komponenti: Android App, Loyalty Backend, POS Simulator,
  Firebase Authentication, Cloud Firestore.
- §2.3 — Backend: Node.js 24 LTS + Express + Firebase Admin SDK, lokalni Node proces.
  Cloud Functions se ne koriste.
- §2.4 — Firebase Emulator Suite (Firestore + Auth); nijedan test ne koristi production projekat.
- §2.5 — POS Simulator: samo folder, README i prazna HTML stranica; bez formi i mrežnih poziva.
- §2.6, NFR-09 — Android projekat: minSdk 26, compileSdk/targetSdk 35; bez QR skenera.
- §12 — seed rewardDefinitions:
    CAR_WASH { displayName: "Besplatno pranje", costPoints: 50, active: true }
    SHOWER   { displayName: "Besplatan tuš",   costPoints: 30, active: true }
  idempotentan; radi isključivo nad emulatorom.
- §24 — nazivi 9 kanonskih kolekcija kao konstante na jednom mjestu (bez logike nad njima).
- §26 — Express aplikacija sa base path /api/v1, bez ijednog business endpointa.
- §27 — standardni error body { "error": { "code", "message", "correlationId" } };
  svih 23 koda iz §27 sa tačnim HTTP statusima kao konstante; centralni error handler;
  stack trace se nikad ne vraća klijentu.
- NFR-03 — firebase/firestore.rules sadrži SAMO default deny:
    match /{document=**} { allow read, write: if false; }
- NFR-07 — nijedan secret u repou: .env.example samo sa placeholder-ima; .gitignore.

TEHNIČKA DOPUNA VAN §27 (odobrila Ana, odluka O-1):
- NOT_FOUND 404 — nepoznata ruta ili nepodržan HTTP metod;
- INVALID_REQUEST 422 — neispravan JSON body (od kasnijih iteracija i nevalidan requestId,
  redemptionRequestId, acceptedTermsVersion).
U TRACEABILITY.md se vode kao „tehnička dopuna, nije SRS kod”. Druge kodove NE uvoditi.

3. VAN OPSEGA (NE SMIJE se implementirati)
- endpointi API-01 … API-07 i bilo kakva business logika (bodovi, kupovine, ledger, voucher-i,
  notifikacije, brisanje naloga);
- verifikacija Firebase ID token-a (Iteracija 2) i X-POS-API-Key autentikacija (Iteracija 3);
- Firestore transakcije i bilo koje pravilo osim default deny (Iteracije 2–8);
- Android: Firebase zavisnosti, google-services plugin, ekrani, navigacija, QR (Iteracije 9–10);
- POS forme i mrežni pozivi (Iteracija 11);
- FCM, Cloud Functions, production hosting, admin portal, GitHub Actions,
  health/status ili bilo koji dodatni endpoint (§26: tačno 7 business endpointa);
- sve iz SRS §1.3.

4. ZAVISNOSTI I PREDUSLOVI
- Prethodna iteracija: nema.
- Na računaru: node -v → v24.x; java -version → JDK koji traži instalirana firebase-tools
  (novije verzije traže JDK 21); Android Studio sa SDK 35.
- Prije početka Ana u lokalni klon kopira (Builder ih commit-uje i NE mijenja):
    docs/srs/FuelPoints_SRS_3_1.docx  (normativan)
    docs/srs/FuelPoints_SRS_3_1.md    (čitljiva kopija, nije normativna)
    docs/TRACEABILITY.md              (početna matrica od Orchestrator-a)

5. ODLUKE ORCHESTRATOR-a ZA OVU ITERACIJU
- Struktura:
    android-app/
    backend/ (src/, test/, package.json)
    pos-simulator/
    firebase/ (firestore.rules, firestore.indexes.json, tests/ sa sopstvenim package.json)
    docs/ (TRACEABILITY.md, IMPLEMENTATION_LOG.md, TEST_REPORT.md, srs/)
    skripte/provjera.ps1
    firebase.json, .firebaserc, .gitignore, .gitattributes (*.docx binary), .env.example, README.md
- Emulator projekat: demo-fuelpoints (prefiks demo- garantuje da emulator ne dira production).
  Firestore 127.0.0.1:8080, Auth 127.0.0.1:9099 — koristiti 127.0.0.1, ne localhost.
- Backend testovi: node:test (ugrađen u Node 24) + supertest. Testovi nad emulatorom idu kroz
  firebase emulators:exec, serijski, i prije svakog testa čiste Firestore emulator.
  firebase-tools je pinovan kao devDependency (npx firebase).
- Rules testovi: @firebase/rules-unit-testing u firebase/tests.
- Express aplikacija je fabrika (bez listen) radi supertest-a; listen je samo u ulaznoj tački.
- Konfiguracija samo iz environment varijabli (process.loadEnvFile / --env-file);
  nedostajuća obavezna varijabla → fail fast bez ispisa vrijednosti.
- Android: Kotlin + Jetpack Compose, Gradle wrapper commit-ovan, jedna prazna početna aktivnost.
- Imenovanje: sve što SRS imenuje ostaje na engleskom (kolekcije, polja, endpointi, error kodovi,
  ID-evi testova, nazivi komponenti). Sve ostalo — folderi unutar src, fajlovi, klase, funkcije,
  promjenljive, komentari, poruke grešaka — na srpskom, latinicom, ijekavicom.
  Rezervisane riječi i konvencionalni fajlovi alata (package.json, firebase.json,
  build.gradle.kts, AndroidManifest.xml …) ostaju kako jesu.
- Poruke grešaka za klijenta: srpski, latinica, generičke, bez internih detalja.
- Logovanje: correlationId uz svaku grešku; NIKAD ne logovati Authorization ni X-POS-API-Key
  header (§3.4).

6. DEFINITION OF DONE
[ ] Struktura kao u tački 5; nema TODO/FIXME za funkcionalnost ove iteracije.
[ ] backend: npm test prolazi (unit, bez emulatora).
[ ] backend: npm run test:emu prolazi kroz firebase emulators:exec (Firestore + Auth, demo-fuelpoints).
[ ] firebase/tests: npm test prolazi (rules smoke nad emulatorom).
[ ] android-app: .\gradlew.bat assembleDebug i .\gradlew.bat testDebugUnitTest → BUILD SUCCESSFUL.
[ ] backend: npm start podiže server na 127.0.0.1:<PORT iz .env>; /api/v1 nema business ruta.
[ ] Seed: dvostruko pokretanje daje tačno 2 dokumenta sa vrijednostima iz §12; seed odbija rad
    ako FIRESTORE_EMULATOR_HOST nije postavljen ili ID projekta ne počinje sa demo-.
[ ] Error body tačno po §27 (samo polja code, message, correlationId); stack trace se nikad ne vraća;
    correlationId je jedinstven po zahtjevu.
[ ] Katalog: 23 koda iz §27 + NOT_FOUND + INVALID_REQUEST, sa tačnim HTTP statusima.
[ ] firestore.rules = samo default deny; rules smoke zeleno.
[ ] NFR-07: git ls-files ne sadrži .env, service account JSON ni google-services.json;
    .env.example sadrži samo placeholder-e.
[ ] SRS nepromijenjen: SHA-256 od docs/srs/FuelPoints_SRS_3_1.docx =
    7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228
[ ] skripte/provjera.ps1 pokreće sve provjere redom i vraća exit code ≠ 0 na prvu grešku.
[ ] docs/TRACEABILITY.md: kolona „Kod” popunjena za stavke Iteracije 1.
    docs/IMPLEMENTATION_LOG.md: unos za i01 (CHANGELOG, fajlovi, ograničenja).
    docs/TEST_REPORT.md: stvarni izlaz komandi, datum, verzije Node/Java/firebase-tools/Gradle;
    PASS samo za stvarno izvršeno.
[ ] README.md (srpski): preduslovi i komande.
[ ] Reviewer: ITERATION ACCEPTED (bez P0/P1) → merge u main → anotirani tag i01.

7. OBAVEZNI TESTOVI
Backend unit (npm test):
- I01-T01 Katalog: 23 koda iz §27 + NOT_FOUND/INVALID_REQUEST, tačni HTTP statusi, bez duplikata;
          test poredi katalog sa tabelom §27.
- I01-T02 GET /api/v1/nepostojeca → 404 { error: { code: "NOT_FOUND", message, correlationId } }.
- I01-T03 POST sa tijelom "{" i Content-Type application/json → 422 INVALID_REQUEST.
- I01-T04 Neočekivani izuzetak (ruta montirana SAMO u testu, nikad u produkcionoj aplikaciji)
          → 500 INTERNAL_ERROR; odgovor ne sadrži stack, putanju fajla ni originalnu poruku.
- I01-T05 Dva zahtjeva → dva različita correlationId.
- I01-T06 Nedostajuća obavezna env varijabla → greška pri startu, bez ispisa vrijednosti.
Backend nad emulatorom (npm run test:emu):
- I01-T07 Admin SDK radi nad emulatorima: upis/čitanje/brisanje probnog dokumenta u Firestore-u;
          kreiranje/brisanje test korisnika u Auth emulatoru.
- I01-T08 Seed rewardDefinitions: 2 dokumenta, vrijednosti iz §12; drugo pokretanje ne mijenja stanje.
- I01-T09 Seed odbija rad bez emulator varijable / sa ne-demo projektom.
Rules (firebase/tests, npm test):
- RULE-T12 (preliminarno) Neautentifikovan i autentifikovan read/write nad users, loyaltyLedger
          i nepoznatom kolekcijom → DENY. Konačna verzija ide u Iteraciju 8.

8. KOMANDE ZA PROVJERU (PowerShell, iz korijena repozitorijuma)
node -v
java -version
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
cd android-app; .\gradlew.bat assembleDebug; .\gradlew.bat testDebugUnitTest; cd ..
git ls-files | Select-String -Pattern '(^|/)\.env$|service-?account|google-services\.json'   # očekivano: bez izlaza
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
.\skripte\provjera.ps1        # sve gore navedeno; očekivano: exit code 0

9. ISPORUKA BUILDER-a
A. PR iteracija-01 → main
B. CHANGELOG iteracije (u IMPLEMENTATION_LOG.md)
C. spisak dodatih/izmijenjenih fajlova
D. izvršeni testovi i rezultat
E. testovi koji nisu mogli biti izvršeni i zašto
F. poznata ograničenja
G. ažurirana docs/TRACEABILITY.md
Iteracija se ne proglašava završenom ako bilo koji test iz tačke 7 ne prolazi.
