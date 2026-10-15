# FuelPoints — izvještaj o testovima

Sadrži samo stvarno izvršene komande i njihov stvarni izlaz. Duži izlazi su skraćeni na relevantne
linije (rezultat testova, exit code); ništa nije dopisano.

---

## Iteracija 1 — Bootstrap i test infrastruktura

Datum izvršavanja: 2026-10-15 (Windows 11 Pro 10.0.22621, Windows PowerShell 5.1). Grana `iteracija-01`.

### Verzije alata

| Alat | Komanda | Izlaz |
|---|---|---|
| Node.js | `node -v` | `v24.21.0` |
| npm | `npm -v` | `11.19.0` |
| Java na izvornom PATH-u (Oracle `javapath` posrednik) | `java -version` | `java version "24.0.1" 2025-04-15` |
| Java za emulatore i Gradle (JBR Android Studio-a) | `java -version` (JBR prvi u PATH-u) | `openjdk version "21.0.6" 2025-01-21` |
| firebase-tools | `npx firebase --version` (u `backend/`) | `15.32.1` |
| Gradle | `.\gradlew.bat --version` | `Gradle 8.11.1`, Launcher JVM `21.0.6 (JetBrains s.r.o. 21.0.6+-13368085-b895.109)` |
| AGP / Kotlin (projekat) | `gradle/libs.versions.toml` | AGP `8.10.1`, Kotlin `2.0.21`, Compose BOM `2024.09.00` |
| Firestore emulator | log emulatora | `cloud-firestore-emulator-v1.22.0.jar` |

Napomena o JDK-u: emulator komande su izvršavane sa `$env:PATH = 'C:\Program Files\Android\Android Studio\jbr\bin;' + $env:PATH`
(vidi „Nalaz: Java proces emulatora ostaje aktivan” niže i IMPLEMENTATION_LOG, odstupanje OD-1).

### Završno izvršavanje (checkpoint)

Komande (PowerShell, iz korijena repozitorijuma):

```powershell
$env:PATH = 'C:\Program Files\Android\Android Studio\jbr\bin;' + $env:PATH
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug; .\gradlew.bat testDebugUnitTest; cd ..
```

Exit code-ovi:

```
backend npm ci EXIT=0
backend npm test EXIT=0
backend npm run test:emu EXIT=0
rules npm ci EXIT=0
rules npm test EXIT=0
assembleDebug EXIT=0
testDebugUnitTest EXIT=0
```

#### `cd backend; npm ci`

```
added 713 packages, and audited 714 packages in 21s
11 vulnerabilities (4 moderate, 7 high)
```

`npm audit --omit=dev` (samo produkcione zavisnosti express i firebase-admin):

```
found 0 vulnerabilities
```

#### `cd backend; npm test` (unit, bez emulatora)

```
✔ I01-T02 GET /api/v1/nepostojeca → 404 NOT_FOUND sa tačno tri polja (31.2761ms)
✔ I01-T02 nepodržan metod (DELETE /api/v1) i putanja van /api/v1 (GET /) → 404 NOT_FOUND (10.0193ms)
✔ I01-T03 neispravan JSON ("{") → 422 INVALID_REQUEST bez teksta greške parsera (16.3597ms)
✔ I01-T03 tijelo veće od limita parsera → 422 INVALID_REQUEST bez teksta greške parsera (P-4) (8.4274ms)
✔ I01-T04 sinhroni i async izuzetak → 500 INTERNAL_ERROR bez stack-a, putanje i originalne poruke (13.6276ms)
✔ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (4.4675ms)
✔ I01-T04 test rute ne postoje u podrazumijevanoj aplikaciji (bez dodajRute) → 404 (7.4858ms)
✔ I01-T05 dva zahtjeva → dva različita correlationId (UUID v4) (6.2416ms)
✔ I01-T05 dolazni X-Correlation-Id se ignoriše (4.1372ms)
✔ I01-T01 katalog: 23 koda iz §27 sa tačnim HTTP statusima (2.5663ms)
✔ I01-T01 katalog: tabela §27 iz čitljive kopije SRS-a odgovara katalogu (bez drifta) (1.8284ms)
✔ I01-T01 katalog: dopuna O-1 je tačno NOT_FOUND 404 i INVALID_REQUEST 422 (0.2571ms)
✔ I01-T01 katalog: ukupno 25 stavki, bez duplikata i bez kodova van §27 + O-1 (0.5025ms)
✔ I01-T01 katalog: svaka poruka je neprazna, na latinici (bez ćirilice) (0.5437ms)
✔ I01-T01 katalog: niz, stavke i mapa su zamrznuti (0.2609ms)
✔ I01-T06 nedostaju PORT i FIREBASE_PROJECT_ID → GreskaKonfiguracije navodi obje varijable (1.1624ms)
✔ I01-T06 neispravan PORT → greška formata bez ispisa vrijednosti (0.3741ms)
✔ I01-T06 ispravne vrijednosti → zamrznut objekat konfiguracije (1.6559ms)
✔ I01-T06 pokretanje bez PORT → izlaz ≠ 0, poruka imenuje PORT, bez vrijednosti i stack-a (189.3943ms)
ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 512.1725
```

#### `cd backend; npm run test:emu` (Firestore + Auth emulator, `demo-fuelpoints`)

```
i  Running script: node --test --test-concurrency=1 test/emulator/*.test.js
(node:25536) MetadataLookupWarning: received unexpected error = All promises were rejected code = ETIMEDOUT, ENOTFOUND
✔ I01-T07 Admin SDK: upis, čitanje i brisanje probnog dokumenta u Firestore emulatoru (3905.237ms)
✔ I01-T07 Admin SDK: kreiranje i brisanje test korisnika u Auth emulatoru (62.8724ms)
  ✔ I01-T09 provjeriEmulatorskoOkruzenje: bez emulator host-a i sa ne-demo projektom → greška (37.8937ms)
(node:17192) MetadataLookupWarning: received unexpected error = All promises were rejected code = ETIMEDOUT, ENOTFOUND
  ✔ I01-T09 CLI bez FIRESTORE_EMULATOR_HOST i CLI sa ne-demo projektom → exit 1, ništa upisano (3309.5202ms)
✔ I01-T09 seed odbija rad van emulatora i van demo projekta (3348.2928ms)
  ✔ I01-T08 dvostruko pokretanje → tačno 2 dokumenta sa vrijednostima iz §12, bez dodatnih polja (7542.3963ms)
  ✔ I01-T08 ručno izmijenjen dokument vraća se na §12 vrijednosti pri ponovnom punjenju (7518.51ms)
✔ I01-T08 seed rewardDefinitions po §12 je idempotentan (15061.3889ms)
ℹ tests 6
ℹ suites 2
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 23801.9886
+  Script exited successfully (code 0)
```

#### `cd firebase\tests; npm ci`

```
added 729 packages, and audited 730 packages in 26s
16 vulnerabilities (4 moderate, 12 high)
```

#### `cd firebase\tests; npm test` (Firestore emulator, `demo-fuelpoints`)

```
i  Running script: node --test --test-concurrency=1 *.test.js
  ✔ RULE-T12 rewardRequests: get, set, delete, list → DENY (715.1174ms)
  ✔ RULE-T12 redemptionRequests: get, set, delete, list → DENY (152.0766ms)
  ✔ RULE-T12 nepoznata kolekcija: get, set, delete, list → DENY (204.8355ms)
✔ RULE-T12 (preliminarno) client access nad internal/unknown kolekcijom → DENY (1664.4232ms)
  ✔ I01-T10 users: get, set, delete, list → DENY (i za vlasnika) (201.3925ms)
  ✔ I01-T10 loyaltyLedger: get, set, delete, list → DENY (203.0271ms)
✔ I01-T10 default deny za kolekcije još bez pravila (404.8461ms)
ℹ tests 5
ℹ suites 2
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2436.4694
+  Script exited successfully (code 0)
```

Učitana pravila: komandna linija procesa Firestore emulatora (`Get-CimInstance Win32_Process`) sadrži
`--rules C:\Users\Elitebook\fuelpoints02\firebase\firestore.rules`, pa se putanja iz `firebase.json`
razrješava relativno na direktorijum `firebase.json` i uz `--config ../../firebase.json`.

#### Android: `.\gradlew.bat assembleDebug` i `.\gradlew.bat testDebugUnitTest` (JAVA_HOME = JBR)

```
> Task :app:assembleDebug
BUILD SUCCESSFUL in 49s
34 actionable tasks: 33 executed, 1 up-to-date
```

(prvi uspješan build, korak 11; u završnom izvršavanju: `BUILD SUCCESSFUL in 1s`, `34 actionable tasks: 34 up-to-date`)

```
> Task :app:preDebugUnitTestBuild UP-TO-DATE
> Task :app:testDebugUnitTest NO-SOURCE
BUILD SUCCESSFUL in 1s
19 actionable tasks: 19 up-to-date
```

`testDebugUnitTest` je **NO-SOURCE**: u Iteraciji 1 Android nema testova (odluka P-3).

### Kontrolni (negativni) testovi

#### Rules kontrola: privremeno `allow read: if true;` (lokalno, bez commit-a, poslije vraćeno)

```
EXIT=1
✖ RULE-T12 (preliminarno) client access nad internal/unknown kolekcijom → DENY (1300.8088ms)
✖ I01-T10 default deny za kolekcije još bez pravila (124.3713ms)
ℹ tests 5
ℹ pass 0
ℹ fail 5
  Error: Očekivan DENY, a operacija je dozvoljena: unauthenticated: get rewardRequests/kljuc1
  Error: Očekivan DENY, a operacija je dozvoljena: unauthenticated: get redemptionRequests/kljuc1
  Error: Očekivan DENY, a operacija je dozvoljena: unauthenticated: get nepoznataKolekcija/dok1
  Error: Očekivan DENY, a operacija je dozvoljena: unauthenticated: get users/korisnikA
```

Poslije vraćanja: `git diff --stat -- firebase/firestore.rules` je prazan.

#### Unit testovi I01-T01 prije implementacije kataloga (korak 4, test-first)

```
✖ test\jedinicni\katalogGresaka.test.js (130.1057ms)
  'test failed'
EXIT=1
```

### Ručni smoke `npm start` (korak 6; `.env` kopiran iz `.env.example`, lokalno, ignorisan)

```
> fuelpoints-backend@0.1.0 start
> node --env-file-if-exists=../.env src/pokreni.js

FuelPoints backend sluša na http://127.0.0.1:3000/api/v1
```

`Invoke-WebRequest http://127.0.0.1:3000/api/v1/nepostojeca -UseBasicParsing`:

```
STATUS=404
{"error":{"code":"NOT_FOUND","message":"Traženi resurs ne postoji.","correlationId":"c6f6e6bf-9e93-4aa0-a2bf-1df3d6d07bc4"}}
```

Serverski log greške (stderr) iz prvog od dva smoke pokretanja (u prvom je PowerShell vratio prazno tijelo
zbog načina čitanja odgovora, pa je zahtjev ponovljen), bez zaglavlja i tijela:

```
{"vrijeme":"2026-10-15T18:07:34.504Z","nivo":"greska","correlationId":"a141f45d-4823-4802-a78f-499ebcfab791","code":"NOT_FOUND","status":404,"metod":"GET","putanja":"/api/v1/nepostojeca"}
```

### Inspekcije

```powershell
git ls-files | Select-String -Pattern '(^|/)\.env$|service-?account|google-services\.json'
```
Izlaz: prazan (NFR-07).

```powershell
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
```
```
7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228
```

`git diff main -- docs/srs` → 0 linija.

```powershell
git grep -n -E "TODO|FIXME" -- backend firebase pos-simulator skripte android-app/app/src README.md ':!skripte/provjera.ps1'
```
Izlaz: prazan, exit code 1 (nema pogodaka).

`git ls-files android-app | Select-String 'local.properties|/build/|\.idea'` → prazno.

`Select-String -Path pos-simulator\index.html -Pattern '<form|<script|fetch'` → prazno.

`git check-attr`: `android-app/gradlew: eol: lf`, `android-app/gradlew.bat: eol: crlf`,
`android-app/gradle/wrapper/gradle-wrapper.jar: binary: set`, `docs/srs/FuelPoints_SRS_3_1.docx: binary: set`,
`skripte/provjera.ps1: eol: crlf`.

`git log main..HEAD --format=%B | Select-String -Pattern 'Co-Authored-By|Generated with|claude\.com'` → prazno.

### `.\skripte\provjera.ps1`

Uspješno izvršavanje (izvod; `$LASTEXITCODE` poslije skripte):

```
EXIT=0
==> Alati (Node 24, Java 21+, JDK za Gradle)
==> SRS integritet (SHA-256 normativnog .docx-a)
==> NFR-07 (bez tajni u repozitorijumu)
==> Bez TODO/FIXME
==> Portovi emulatora 8080 i 9099 su slobodni
==> Backend: npm ci, npm test, npm run test:emu
ℹ tests 19
ℹ pass 19
ℹ fail 0
ℹ tests 6
ℹ pass 6
ℹ fail 0
==> Backend: npm start smoke (404 NOT_FOUND na /api/v1)
Smoke: 404 NOT_FOUND, correlationId 79704dba-c140-42ed-90d6-a6d57d2880ae
==> Firestore rules: npm ci, npm test
ℹ tests 5
ℹ pass 5
ℹ fail 0
==> Android: assembleDebug, testDebugUnitTest
BUILD SUCCESSFUL in 1s
BUILD SUCCESSFUL in 1s
SVE PROVJERE PROŠLE
```

Poslije skripte `PATH` je vraćen na prethodnu vrijednost, a `JAVA_HOME` i `PORT` nisu ostali postavljeni.

Prvo izvršavanje (prije uklanjanja TODO oznake iz komentara Android šablona) je ispravno palo:

```
EXIT=1
==> Bez TODO/FIXME
Pronađeni TODO/FIXME:
android-app/app/src/main/res/xml/data_extraction_rules.xml:8:        <!-- TODO: Use <include> and <exclude> to control what is backed up.
NEUSPJEH: Bez TODO/FIXME
```

Demonstracija exit code ≠ 0: privremena lokalna kopija `skripte\provjera_demo.ps1` sa pogrešnim
očekivanim hash-om (nije commit-ovana, obrisana poslije izvršavanja):

```
EXIT=1
==> Alati (Node 24, Java 21+, JDK za Gradle)
==> SRS integritet (SHA-256 normativnog .docx-a)
SHA-256 SRS-a je 7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228, očekivan 0000000000000000000000000000000000000000000000000000000000000000.
NEUSPJEH: SRS integritet (SHA-256 normativnog .docx-a)
```

### Nalazi tokom izvršavanja

**Java proces emulatora ostaje aktivan (Oracle `javapath`).** Prvo izvršavanje `npm test` u `firebase\tests`
sa izvornim PATH-om je prošlo (5/5), ali je poslije završetka port 8080 i dalje bio zauzet; sljedeće izvršavanje je palo:

```
!  firestore: Port 8080 is not open on 127.0.0.1, could not start Firestore Emulator.
```

Port je držao `C:\Program Files\Java\jdk-24\bin\java.exe … cloud-firestore-emulator-v1.22.0.jar … --rules C:\Users\Elitebook\fuelpoints02\firebase\firestore.rules`,
čiji roditeljski proces (posrednik `C:\Program Files\Common Files\Oracle\Java\javapath\java.exe`) više nije postojao.
Sa JBR-om prvim u PATH-u (`(Get-Command java).Source` → `C:\Program Files\Android\Android Studio\jbr\bin\java.exe`):

```
EXIT=0
LISTEN:
ℹ pass 5
ℹ fail 0
```

(port 8080 slobodan 5 s poslije završetka). Rješenje je opisano kao OD-1 u IMPLEMENTATION_LOG.

**Android build sa verzijama iz šablona je pao** (korak 11, prije odluke):

```
Execution failed for task ':app:checkDebugAarMetadata'.
   > 5 issues were found when checking AAR metadata:
       1.  Dependency 'androidx.activity:activity-ktx:1.11.0' requires libraries and applications that
       2.  Dependency 'androidx.activity:activity:1.11.0' requires libraries and applications that
       3.  Dependency 'androidx.activity:activity-compose:1.11.0' requires libraries and applications that
       4.  Dependency 'androidx.core:core:1.17.0' requires libraries and applications that
       5.  Dependency 'androidx.core:core-ktx:1.17.0' requires libraries and applications that
           depend on it to compile against version 36 or later of the
           Android APIs.
BUILD FAILED in 12s
```

Poslije Anine odluke (OD-2: `coreKtx` 1.16.0, `activityCompose` 1.10.1) oba Gradle zadatka su BUILD SUCCESSFUL (gore).

### Rezultat po ID-u

| ID | Komanda | Rezultat |
|---|---|---|
| I01-T01 | `cd backend; npm test` | PASS (6/6 slučajeva) |
| I01-T02 | `cd backend; npm test` | PASS (2/2) |
| I01-T03 | `cd backend; npm test` | PASS (2/2, uklj. preveliko tijelo, P-4) |
| I01-T04 | `cd backend; npm test` | PASS (3/3) |
| I01-T05 | `cd backend; npm test` | PASS (2/2) |
| I01-T06 | `cd backend; npm test` | PASS (4/4) |
| I01-T07 | `cd backend; npm run test:emu` | PASS (2/2) |
| I01-T08 | `cd backend; npm run test:emu` | PASS (2/2) |
| I01-T09 | `cd backend; npm run test:emu` | PASS (2/2) |
| RULE-T12 (preliminarno) | `cd firebase\tests; npm test` | PASS (3/3) |
| I01-T10 | `cd firebase\tests; npm test` | PASS (2/2) |
| assembleDebug | `.\gradlew.bat assembleDebug` | BUILD SUCCESSFUL |
| testDebugUnitTest | `.\gradlew.bat testDebugUnitTest` | BUILD SUCCESSFUL, NO-SOURCE |
| npm start smoke | ručno i u `provjera.ps1` | PASS (404 NOT_FOUND) |
| provjera.ps1 | `.\skripte\provjera.ps1; $LASTEXITCODE` | 0 (i ≠ 0 demonstrirano) |

Nije izvršeno: ništa iz brief-a i plana nije preskočeno. Android instrumentisani testovi i smoke na
emulatorima API 26/35 (NFR-09) nisu dio Iteracije 1.
