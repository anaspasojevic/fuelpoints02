# FuelPoints — dnevnik implementacije

---

## Iteracija 1 — Bootstrap i test infrastruktura

Grana `iteracija-01`. Brief: `docs/iteracije/i01_brief.md`. Plan: `docs/iteracije/i01_plan.md`
(odobren uz odluke P-1 … P-8 i ispravke K-1 … K-4, sekcija 14). Uloga: BUILDER, 2026-10-15.

### CHANGELOG

- Osnova repozitorijuma: `.gitignore`, `.gitattributes` (`*.docx` binary, `gradlew` LF, `*.bat`/`*.ps1` CRLF),
  `.env.example` (samo ne-tajne vrijednosti), `.firebaserc` i `firebase.json` (Firestore 127.0.0.1:8080,
  Auth 127.0.0.1:9099, projekat `demo-fuelpoints`, UI isključen).
- Firestore Security Rules: samo default deny (§25.1, §25.10, NFR-03). Rules testovi nad emulatorom:
  RULE-T12 (preliminarno: `rewardRequests`, `redemptionRequests`, nepoznata kolekcija) i privremeni I01-T10
  (`users`, `loyaltyLedger`), odluka P-2.
- Backend (Node.js 24, Express 5.2.1, firebase-admin 14.5.0, ESM):
  - katalog grešaka: 23 koda iz §27 i dopuna O-1 (`NOT_FOUND` 404, `INVALID_REQUEST` 422), generičke poruke na latinici;
  - Express fabrika `napraviAplikaciju()` sa base path `/api/v1` bez ijednog business endpointa (§26);
  - novi `correlationId` (UUID v4) za svaki zahtjev; dolazni ID se ignoriše;
  - centralni rukovalac greškama: tijelo tačno `{ error: { code, message, correlationId } }`, bez stack trace-a;
    greške JSON parsera (`express.json()`) sa statusom 400–499 → `INVALID_REQUEST` 422 (P-4); ostalo → `INTERNAL_ERROR` 500
    (ispravljeno u FIX LOOP 1: prvobitna implementacija je tražila `err.type`, pa greške dekompresije bez `type`
    nisu bile obuhvaćene, nalaz R-01);
  - serverski log grešaka kao JSON linija bez zaglavlja i tijela zahtjeva (§3.4, NFR-07);
  - konfiguracija samo iz env varijabli (`PORT`, `FIREBASE_PROJECT_ID`), fail fast bez ispisa vrijednosti;
    `npm start` sluša na `127.0.0.1:<PORT>`;
  - konstante 9 kanonskih kolekcija (§24);
  - `inicijalizujFirebaseAdmin({ projectId })` (Admin SDK, imenovana aplikacija);
  - seed `rewardDefinitions` po §12 (`CAR_WASH` 50, `SHOWER` 30, `active: true`, displayName latinicom po P-1):
    jedan batch, deterministički ID-evi, `set()` bez merge; CLI `npm run seed:emu` odbija rad bez
    `FIRESTORE_EMULATOR_HOST` ili sa projektom koji ne počinje sa `demo-`, prije učitavanja Firebase modula.
- Testovi backend-a: I01-T01 … I01-T06 (unit, `npm test`), I01-T07 … I01-T09 (`npm run test:emu`,
  serijski, čišćenje Firestore i Auth emulatora prije svakog testa).
- POS Simulator: kostur (`README.md`, prazna `index.html`), bez formi i mrežnih poziva (§2.5).
- Android App: projekat iz Android Studio čarobnjaka (R-1), Kotlin + Compose, `io.github.anaspasojevic.fuelpoints`
  (P-5), minSdk 26, compileSdk/targetSdk 35; `GlavnaAktivnost` sa praznim Compose sadržajem; uklonjeni
  `ui/theme/*`, `Greeting` i šablonski `Example*Test.kt` (P-3); Gradle wrapper commit-ovan.
- `skripte/provjera.ps1`: sve DoD provjere redom, exit code 1 na prvu grešku, 0 kad sve prođe; env varijable
  procesa se vraćaju na kraju.
- `README.md` (srpski): preduslovi, struktura, konfiguracija, pokretanje, testovi, provjera.
- Dokumentacija: `docs/TEST_REPORT.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/TRACEABILITY.md` (redovi Iteracije 1).

### Fajlovi

Dodati:

```
.gitignore
.gitattributes
.env.example
.firebaserc
firebase.json
README.md
skripte/provjera.ps1
firebase/firestore.rules
firebase/firestore.indexes.json
firebase/tests/package.json
firebase/tests/package-lock.json
firebase/tests/podrazumijevanaZabrana.test.js
backend/package.json
backend/package-lock.json
backend/src/aplikacija.js
backend/src/pokreni.js
backend/src/dnevnik.js
backend/src/konfiguracija/konfiguracija.js
backend/src/greske/katalogGresaka.js
backend/src/greske/GreskaApi.js
backend/src/greske/obradaGresaka.js
backend/src/posrednici/korelacija.js
backend/src/podaci/kolekcije.js
backend/src/firebase/inicijalizacija.js
backend/src/punjenje/zastitaEmulatora.js
backend/src/punjenje/rewardDefinitions.js
backend/skripte/napuniEmulator.js
backend/test/pomocnici/emulator.js
backend/test/jedinicni/katalogGresaka.test.js
backend/test/jedinicni/aplikacija.test.js
backend/test/jedinicni/konfiguracija.test.js
backend/test/emulator/adminSdk.test.js
backend/test/emulator/punjenje.test.js
pos-simulator/README.md
pos-simulator/index.html
android-app/.gitignore
android-app/build.gradle.kts
android-app/settings.gradle.kts
android-app/gradle.properties
android-app/gradle/libs.versions.toml
android-app/gradle/wrapper/gradle-wrapper.jar
android-app/gradle/wrapper/gradle-wrapper.properties
android-app/gradlew
android-app/gradlew.bat
android-app/app/.gitignore
android-app/app/build.gradle.kts
android-app/app/proguard-rules.pro
android-app/app/src/main/AndroidManifest.xml
android-app/app/src/main/java/io/github/anaspasojevic/fuelpoints/GlavnaAktivnost.kt
android-app/app/src/main/res/** (ikone, values/colors.xml, values/strings.xml, values/themes.xml, xml/backup_rules.xml, xml/data_extraction_rules.xml)
docs/TEST_REPORT.md
docs/IMPLEMENTATION_LOG.md
```

Izmijenjeni:

```
docs/iteracije/i01_plan.md   (sekcija 14 i ispravke K-1 … K-4)
docs/TRACEABILITY.md         (samo redovi Iteracije 1: Kod, Planirani test, Status; P-6)
```

Netaknuti: `docs/srs/*` (SHA-256 provjeren), `CLAUDE.md`, `.claude/settings.json`, `docs/dizajn/*`, `docs/iteracije/i01_brief.md`.

### Odstupanja od plana

**OD-1 — Pravi JDK na početku PATH-a za emulator komande (tehnička prepreka).**
- Šta: `skripte/provjera.ps1` u koraku „Alati” postavlja `JAVA_HOME` (ako nije postavljen) na JBR i stavlja
  `$env:JAVA_HOME\bin` na početak PATH-a za cijelu skriptu (na kraju se vraća). README to navodi kao preduslov za ručno
  pokretanje emulator testova. Plan (R8) je predviđao da emulatori koriste Javu 24 sa PATH-a.
- Zašto: `java` na PATH-u je Oracle `javapath` posrednik. `firebase emulators:exec` po završetku gasi posrednika,
  a stvarni `java.exe` emulatora ostaje i drži port 8080, pa sljedeće izvršavanje (npr. rules suite poslije backend suite-a
  u `provjera.ps1`) pada sa „Port 8080 is not open”.
- Dokaz: TEST_REPORT, „Nalazi tokom izvršavanja” (proces koji drži port, roditelj ne postoji; sa JBR-om port slobodan).
- Ne mijenja opseg, ugovor ni definiciju testa; npm skripte su ostale tačno po 10.2.

**OD-2 — Android: dvije verzije biblioteka spuštene u `libs.versions.toml` (odluka Ane, 2026-10-15).**
- Šta: `coreKtx` 1.17.0 → 1.16.0 i `activityCompose` 1.11.0 → 1.10.1. Plan 10.5 je predviđao da verzije ostanu iz šablona.
- Zašto: šablon Android Studio-a je postavio biblioteke koje traže compileSdk 36, a brief propisuje compileSdk 35
  (`:app:checkDebugAarMetadata` pada, 5 problema). Builder je stao i pitao; Ana je izabrala spuštanje verzija,
  uz zadržavanje compileSdk/targetSdk 35.
- Dokaz: TEST_REPORT, „Android build sa verzijama iz šablona je pao” i uspješan build poslije izmjene.

**OD-3 — Uklonjena riječ „TODO:” iz komentara šablona `data_extraction_rules.xml`.**
- Šta: komentar Android šablona `<!-- TODO: Use <include> … -->` → `<!-- Use <include> … -->`; ponašanje nepromijenjeno.
  Urađeno posebnim commit-om `i01: uklonjena TODO oznaka iz komentara Android šablona` (između koraka 11 i 12).
- Zašto: DoD (plan, sekcija 8) traži prazan `git grep` za TODO/FIXME i u `android-app/app/src`; prvo izvršavanje
  `provjera.ps1` je to ispravno prijavilo.
- Dokaz: TEST_REPORT, prvo izvršavanje `provjera.ps1` (EXIT=1) i drugo (EXIT=0).

**OD-4 — I01-T10 je u commit-u koraka 2.**
- Commit poruka koraka 2 je ostala tačno iz plana („… i RULE-T12 (preliminarno)”), a isti commit sadrži i I01-T10
  (isti fajl, po P-2 i K-2).

### Status otvorenih pitanja iz plana

| Pitanje | Status |
|---|---|
| P-1 displayName | Riješeno: latinica („Besplatno pranje”, „Besplatan tuš”), odluka i01/P-1; I01-T08 PASS. |
| P-2 RULE-T12 | Riješeno: RULE-T12 = internal/unknown; I01-T10 = users/loyaltyLedger (privremen). |
| P-3 Android testovi | Riješeno: šablonski testovi obrisani; `testDebugUnitTest` NO-SOURCE, BUILD SUCCESSFUL. |
| P-4 body-parser greške | Riješeno: greške JSON parsera sa 4xx → `INVALID_REQUEST` 422, klasifikacija na izvoru (FIX LOOP 1, R-01); I01-T03 pokriva neispravan JSON, preveliko i oštećeno komprimovano tijelo (gzip, deflate, br). |
| P-5 package | Riješeno: `io.github.anaspasojevic.fuelpoints`. |
| P-6 sljedivost | Riješeno: I01 oznake upisane u „Planirani test” samo za redove Iteracije 1. |
| P-7 demo okruženje | Otvoreno (O-2), odluka prije Iteracije 9. Seed radi samo nad emulatorom. |
| P-8 verzije | Prihvaćeno; verzije iz 10.1 korišćene bez izmjene. |

### Poznata ograničenja

- `npm ci` prijavljuje ranjivosti u razvojnim zavisnostima (backend: 11, `firebase/tests`: 16). Za backend
  `npm audit --json` pokazuje da sve idu preko `firebase-tools` (devDependency); `npm audit --omit=dev` za backend: 0.
  Za `firebase/tests` (samo razvojne zavisnosti) lanac nije posebno analiziran. Verzije nisu mijenjane (pravilo P-8); ništa od toga ne ide u produkcioni kod.
- npm 11 ne izvršava install skripte zavisnosti bez odobrenja (`npm warn install-scripts`, npr. `re2`, `protobufjs`).
  Testovi i emulatori rade bez njih.
- `MetadataLookupWarning` u emulator testovima: google-auth-library pokušava otkriti GCE metadata server jer Admin SDK
  nema kredencijale (uz emulator nisu potrebni). Upozorenje ne utiče na rezultat, ali produžava prvi poziv za ~3–4 s.
- Firestore klijent u rules testovima ispisuje `PERMISSION_DENIED` upozorenja za odbijene upise; to su očekivani DENY ishodi.
- `provjera.ps1` i README pretpostavljaju podrazumijevanu putanju Android Studio-a (`C:\Program Files\Android\Android Studio\jbr`)
  kad `JAVA_HOME` nije postavljen.
- Android nema testova u Iteraciji 1 (P-3); NFR-09 smoke je Iteracija 10–11.
- Pokretanje `npm run test:emu` i `npm test` u `firebase\tests` paralelno ili uz već pokrenut `emulators:start` nije
  podržano (isti port 8080); `provjera.ps1` to provjerava prije emulator koraka.

### FIX LOOP 1 (nalazi iz `docs/iteracije/i01_review.md`, commit 05d7d45)

Uloga: BUILDER, 2026-10-15. Opseg po odluci Orchestrator-a: R-01, R-02, R-03 ispraviti; R-04 i R-05 samo dokumentovati/preimenovati.

| Nalaz | Izmjena | Fajlovi | Test |
|---|---|---|---|
| R-01 (P2) | Klasifikacija vezana za izvor: omotač `parsirajJson` oko `express.json()` pretvara grešku parsera sa statusom 400–499 u `GreskaApi('INVALID_REQUEST')` bez obzira na `err.type`; greška parsera sa 5xx ide dalje kao `INTERNAL_ERROR`. Iz centralnog rukovaoca uklonjena provjera „ima `type` i 4xx status”, pa greška van parsera sa 4xx statusom ostaje `INTERNAL_ERROR`. | `backend/src/aplikacija.js`, `backend/src/greske/obradaGresaka.js`, `backend/test/jedinicni/aplikacija.test.js` | I01-T03: gzip/deflate/br sa neispravno komprimovanim tijelom → 422, tačno tri polja, bez teksta zlib greške i bez stack-a u logu; 4xx greška van parsera → 500. Crveno → zeleno; mutacija (stari uslov `err.type`) obara test. |
| R-02 (P2) | Presretač loga u testu bilježi `console.log/info/warn/error/debug` (preko `util.format`) i `process.stdout.write`/`process.stderr.write`; asercija nad spojenim izlazom. Produkcioni kod nije mijenjan. | `backend/test/jedinicni/aplikacija.test.js` | I01-T04: M7b (`console.error`) i M7d (`console.log`), kao i M7e/M7f/M7g (`console.info`, `stdout.write`, `stderr.write`) obaraju test; bez mutacije PASS. |
| R-03 (P3) | Seed CLI poslije zaštite samo-emulator (I01-T09 ostaje prva provjera), a prije učitavanja Admin SDK-a, provjerava dostupnost `FIRESTORE_EMULATOR_HOST` (`fetch` sa `AbortSignal.timeout(5000)`); nedostupan → postojeća poruka, exit 1, bez stack-a i vrijednosti varijabli. | `backend/skripte/napuniEmulator.js`, `backend/test/jedinicni/punjenjeBezEmulatora.test.js` (novi) | I01-T11 (novi, jedinični): exit 1 za < 15 s (izmjereno ~0,1 s); prije ispravke ETIMEDOUT poslije 20 s. |
| R-04 (P3) | Samo dokumentacija: seed postavlja tačno §12 stavke i ne briše druge dokumente u `rewardDefinitions`. Ponašanje nepromijenjeno. | `backend/src/punjenje/rewardDefinitions.js`, `README.md` | — |
| R-05 (P3) | Samo naziv koraka: „Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1)”. Logika nepromijenjena. | `skripte/provjera.ps1` | — |

Ispravljena netačna tvrdnja iz CHANGELOG-a i tabele otvorenih pitanja („sve greške body-parser-a → `INVALID_REQUEST`”):
prvobitna implementacija je obuhvatala samo greške sa `err.type`, a greške dekompresije (`createError(400, zlibGreska)`) su
završavale kao 500 `INTERNAL_ERROR`. Nisu dodati paketi, kodovi grešaka ni endpointi. Detalji izvršavanja: `docs/TEST_REPORT.md`, sekcija FIX LOOP 1.
