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

---

## Iteracija 1 — FIX LOOP 1 (nalazi R-01 … R-05 iz `docs/iteracije/i01_review.md`, commit 05d7d45)

Uloga: BUILDER, 2026-10-15. Polazni commit `05d7d45`. Svi izlazi ispod su stvarni; mutacije su bile privremene
(kopija fajla u scratchpad-u, vraćeno poslije izvršavanja, ništa od toga nije commit-ovano).

### R-01 — greške JSON parsera bez `err.type` → `INVALID_REQUEST`

Novi slučajevi u I01-T03 (`backend/test/jedinicni/aplikacija.test.js`): oštećeno komprimovano tijelo za
`Content-Encoding` `gzip`, `deflate` i `br` (→ 422, tačno tri polja, bez teksta zlib greške, bez `"stack"` i
`INTERNAL_ERROR` u logu) i greška sa statusom 400 i `type` koja NE dolazi iz parsera (→ 500 `INTERNAL_ERROR`;
dokaz da je klasifikacija vezana za izvor).

CRVENO, nad kodom iz 05d7d45 (`git stash` ispravke, konačna verzija testa;
`node --test --test-name-pattern="I01-T03" test/jedinicni/aplikacija.test.js`, izvod):

```
✔ I01-T03 neispravan JSON ("{") → 422 INVALID_REQUEST bez teksta greške parsera
✔ I01-T03 tijelo veće od limita parsera → 422 INVALID_REQUEST bez teksta greške parsera (P-4)
✖ I01-T03 oštećeno komprimovano tijelo (gzip, deflate, br) → 422 INVALID_REQUEST bez teksta zlib greške
✖ I01-T03 greška sa 4xx statusom koja ne dolazi iz JSON parsera → 500 INTERNAL_ERROR
ℹ pass 2
ℹ fail 2
  500 !== 422
  422 !== 500
```

Međukorak (zabilježen radi tačnosti): prva verzija asercije o tekstu zlib greške koristila je regex sa `invalid`
(bez razlikovanja slova), koji hvata i sam kod `INVALID_REQUEST`, pa je test poslije ispravke i dalje padao
(`AssertionError [ERR_ASSERTION]: gzip`). Regex je sužen na tekst zlib/brotli grešaka
(`header check|zlib|Z_[A-Z_]+|ecompress|stored block|unexpected end|JSON`).

ZELENO, poslije ispravke (ista komanda):

```
✔ I01-T03 neispravan JSON ("{") → 422 INVALID_REQUEST bez teksta greške parsera (50.7516ms)
✔ I01-T03 tijelo veće od limita parsera → 422 INVALID_REQUEST bez teksta greške parsera (P-4) (11.9374ms)
✔ I01-T03 oštećeno komprimovano tijelo (gzip, deflate, br) → 422 INVALID_REQUEST bez teksta zlib greške (32.3828ms)
✔ I01-T03 greška sa 4xx statusom koja ne dolazi iz JSON parsera → 500 INTERNAL_ERROR (13.7844ms)
ℹ pass 4
ℹ fail 0
```

Mutacioni dokaz M-R01: u `parsirajJson` (`backend/src/aplikacija.js`) privremeno vraćen stari uslov
`typeof err?.type === 'string' && …`; `node --test test/jedinicni/*.test.js` (izvod):

```
✖ I01-T03 oštećeno komprimovano tijelo (gzip, deflate, br) → 422 INVALID_REQUEST bez teksta zlib greške (13.5287ms)
ℹ pass 20
ℹ fail 1
  500 !== 422
```

Regression suite poslije R-01: `.\skripte\provjera.ps1` → `SVE PROVJERE PROŠLE`, `EXIT 0` (npm test 21/21,
test:emu 6/6, rules 5/5, Android BUILD SUCCESSFUL).

### R-02 — log asercija I01-T04 presreće sve izlazne kanale

Reprodukcija nad starim testom, mutacija M7d (`console.log(JSON.stringify(req.headers));` u `centralniRukovalacGreskama`),
`node --test --test-name-pattern="I01-T04 log" test/jedinicni/aplikacija.test.js` (izvod) — test PROLAZI iako su tajne u izlazu:

```
{"authorization":"Bearer SENTINEL_AUTH_123","x-pos-api-key":"SENTINEL_POS_456","host":"127.0.0.1:56465","accept-encoding":"gzip, deflate","connection":"close"}
✔ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (36.3062ms)
ℹ pass 1
ℹ fail 0
```

Poslije izmjene testa (presreću se `console.log/info/warn/error/debug` preko `util.format` i
`process.stdout.write`/`process.stderr.write`; asercija nad spojenim izlazom), ista komanda sa mutacijama (izvod):

```
== M7b: console.error(JSON.stringify(req.headers));
  AssertionError [ERR_ASSERTION]: log sadrži Authorization
✖ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (18.8982ms)
ℹ fail 1
== M7d: console.log(JSON.stringify(req.headers));
  AssertionError [ERR_ASSERTION]: log sadrži Authorization
✖ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (17.4038ms)
ℹ fail 1
== M7e: console.info(req.headers);
  AssertionError [ERR_ASSERTION]: log sadrži Authorization
✖ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (19.7881ms)
ℹ fail 1
== M7f: process.stdout.write(JSON.stringify(req.headers));
  AssertionError [ERR_ASSERTION]: log sadrži Authorization
✖ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (17.4246ms)
ℹ fail 1
== M7g: process.stderr.write(JSON.stringify(req.headers));
  AssertionError [ERR_ASSERTION]: log sadrži Authorization
✖ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (18.2115ms)
ℹ fail 1
== bez mutacije (node --test test/jedinicni/*.test.js)
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

Regression suite poslije R-02: `.\skripte\provjera.ps1` → `SVE PROVJERE PROŠLE`, `EXIT 0`.

### R-03 — seed brzo pada kad emulator nije dostupan (I01-T11)

Novi test I01-T11 (`backend/test/jedinicni/punjenjeBezEmulatora.test.js`, bez emulatora, dio `npm test`):
CLI sa `FIRESTORE_EMULATOR_HOST=127.0.0.1:<slobodan port>` i `FIREBASE_PROJECT_ID=demo-fuelpoints` → exit 1 za < 15 s,
stderr pominje emulator, bez stack-a i bez vrijednosti varijabli (rok `spawnSync` 20 s).

CRVENO, nad kodom iz 05d7d45 (`node --test test/jedinicni/punjenjeBezEmulatora.test.js`, izvod):

```
✖ I01-T11 seed CLI kad Firestore emulator nije dostupan → exit 1 za manje od 15 s, poruka o emulatoru, bez stack-a (20036.3782ms)
ℹ pass 0
ℹ fail 1
  AssertionError [ERR_ASSERTION]: proces nije završio u roku od 20 s
  + Error: spawnSync C:\Program Files\nodejs\node.exe ETIMEDOUT
```

ZELENO, poslije ispravke (ista komanda), i ručno pokretanje CLI-ja:

```
✔ I01-T11 seed CLI kad Firestore emulator nije dostupan → exit 1 za manje od 15 s, poruka o emulatoru, bez stack-a (93.8206ms)
ℹ pass 1
ℹ fail 0

PS> $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:1'; $env:FIREBASE_PROJECT_ID='demo-fuelpoints'; node skripte/napuniEmulator.js; "exit $LASTEXITCODE"
Punjenje nije uspjelo. Provjeri da li je emulator pokrenut.
exit 1
```

Regression suite poslije R-03: `.\skripte\provjera.ps1` → `SVE PROVJERE PROŠLE`, `EXIT 0`; I01-T08 (seed nad pokrenutim
emulatorom) i I01-T09 (zaštita ostaje prva provjera) i dalje PASS.

### R-04, R-05

Samo dokumentacija/naziv, bez promjene ponašanja: komentar u `backend/src/punjenje/rewardDefinitions.js` i rečenica u
`README.md` (seed postavlja tačno stavke iz §12 i ne briše druge dokumente u `rewardDefinitions`); korak u
`skripte/provjera.ps1` preimenovan u „Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1)”.

### Rezultat po ID-u (FIX LOOP 1)

| ID | Komanda | Rezultat |
|---|---|---|
| I01-T01 | `cd backend; npm test` | PASS (6/6) |
| I01-T02 | `cd backend; npm test` | PASS (2/2) |
| I01-T03 | `cd backend; npm test` | PASS (4/4, uklj. gzip/deflate/br i 4xx van parsera) |
| I01-T04 | `cd backend; npm test` | PASS (3/3; M7b, M7d, M7e, M7f, M7g obaraju test) |
| I01-T05 | `cd backend; npm test` | PASS (2/2) |
| I01-T06 | `cd backend; npm test` | PASS (4/4) |
| I01-T07 | `cd backend; npm run test:emu` | PASS (2/2) |
| I01-T08 | `cd backend; npm run test:emu` | PASS (2/2) |
| I01-T09 | `cd backend; npm run test:emu` | PASS (2/2) |
| I01-T11 | `cd backend; npm test` | PASS (1/1) |
| RULE-T12 (preliminarno) | `cd firebase\tests; npm test` | PASS (3/3) |
| I01-T10 | `cd firebase\tests; npm test` | PASS (2/2) |
| assembleDebug, testDebugUnitTest | `.\gradlew.bat …` | BUILD SUCCESSFUL (testDebugUnitTest NO-SOURCE) |
| provjera.ps1 | `.\skripte\provjera.ps1; $LASTEXITCODE` | 0 |

### `.\skripte\provjera.ps1` — kompletan izlaz (commit 642b8a6, `EXIT 0`)

Komanda: `.\skripte\provjera.ps1 *>&1 | Out-File -Encoding utf8 <scratchpad>\provjera_final.txt; "EXIT $LASTEXITCODE"`.
Smoke server (`node src/pokreni.js`, `Start-Process -NoNewWindow`) piše direktno na konzolu, pa njegove linije nisu
u preusmjerenom fajlu; na konzoli je bilo:

```
FuelPoints backend sluša na http://127.0.0.1:3999/api/v1
{"vrijeme":"2026-10-15T19:26:44.502Z","nivo":"greska","correlationId":"c6004eee-058b-46cb-be3c-6dac59f6bdf2","code":"NOT_FOUND","status":404,"metod":"GET","putanja":"/api/v1/nepostojeca"}
EXIT 0
```

Sadržaj fajla:

```
==> Alati (Node 24, Java 21+, JDK za Gradle)
==> SRS integritet (SHA-256 normativnog .docx-a)
==> NFR-07 (bez tajni u repozitorijumu)
==> Bez TODO/FIXME
==> Portovi emulatora 8080 i 9099 su slobodni
==> Backend: npm ci, npm test, npm run test:emu
node.exe : npm warn deprecated json-ptr@3.1.1: Package no longer supported. Contact Support at https://www.npmjs.com/su
pport for more info.
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Program Files\nodejs/node_mo ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm warn deprec... for more info.:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnera
bilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at ex
orbitant rates) by contacting i@izs.me
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  F
or CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).

added 713 packages, and audited 714 packages in 22s

115 packages are looking for funding
  run `npm fund` for details

11 vulnerabilities (4 moderate, 7 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 3 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @firebase/util@1.15.3 (postinstall: node ./postinstall.js)
npm warn install-scripts   protobufjs@7.6.6 (postinstall: node scripts/postinstall)
npm warn install-scripts   re2@1.27.0 (install: install-from-cache --artifact build/Release/re2.node --host-var RE2_DOW
NLOAD_MIRROR --skip-path-var RE2_DOWNLOAD_SKIP_PATH --skip-ver-var RE2_DOWNLOAD_SKIP_VER --force-build-var RE2_DOWNLOAD
_FORCE_BUILD || node-gyp -j max rebuild)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.

> fuelpoints-backend@0.1.0 test
> node --test test/jedinicni/*.test.js

✔ I01-T02 GET /api/v1/nepostojeca → 404 NOT_FOUND sa tačno tri polja (19.5911ms)
✔ I01-T02 nepodržan metod (DELETE /api/v1) i putanja van /api/v1 (GET /) → 404 NOT_FOUND (6.3222ms)
✔ I01-T03 neispravan JSON ("{") → 422 INVALID_REQUEST bez teksta greške parsera (11.6046ms)
✔ I01-T03 tijelo veće od limita parsera → 422 INVALID_REQUEST bez teksta greške parsera (P-4) (6.2229ms)
✔ I01-T03 oštećeno komprimovano tijelo (gzip, deflate, br) → 422 INVALID_REQUEST bez teksta zlib greške (14.9605ms)
✔ I01-T03 greška sa 4xx statusom koja ne dolazi iz JSON parsera → 500 INTERNAL_ERROR (3.8501ms)
✔ I01-T04 sinhroni i async izuzetak → 500 INTERNAL_ERROR bez stack-a, putanje i originalne poruke (6.0917ms)
✔ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (2.7645ms)
✔ I01-T04 test rute ne postoje u podrazumijevanoj aplikaciji (bez dodajRute) → 404 (4.8271ms)
✔ I01-T05 dva zahtjeva → dva različita correlationId (UUID v4) (4.454ms)
✔ I01-T05 dolazni X-Correlation-Id se ignoriše (2.3421ms)
✔ I01-T01 katalog: 23 koda iz §27 sa tačnim HTTP statusima (1.7757ms)
✔ I01-T01 katalog: tabela §27 iz čitljive kopije SRS-a odgovara katalogu (bez drifta) (1.0211ms)
✔ I01-T01 katalog: dopuna O-1 je tačno NOT_FOUND 404 i INVALID_REQUEST 422 (0.1373ms)
✔ I01-T01 katalog: ukupno 25 stavki, bez duplikata i bez kodova van §27 + O-1 (0.2607ms)
✔ I01-T01 katalog: svaka poruka je neprazna, na latinici (bez ćirilice) (0.2605ms)
✔ I01-T01 katalog: niz, stavke i mapa su zamrznuti (0.1149ms)
✔ I01-T06 nedostaju PORT i FIREBASE_PROJECT_ID → GreskaKonfiguracije navodi obje varijable (0.9149ms)
✔ I01-T06 neispravan PORT → greška formata bez ispisa vrijednosti (0.2581ms)
✔ I01-T06 ispravne vrijednosti → zamrznut objekat konfiguracije (1.14ms)
✔ I01-T06 pokretanje bez PORT → izlaz ≠ 0, poruka imenuje PORT, bez vrijednosti i stack-a (152.272ms)
✔ I01-T11 seed CLI kad Firestore emulator nije dostupan → exit 1 za manje od 15 s, poruka o emulatoru, bez stack-a (97.8965ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 642.0099

> fuelpoints-backend@0.1.0 test:emu
> firebase emulators:exec --config ../firebase.json --project demo-fuelpoints --only firestore,auth "node --test --test-concurrency=1 test/emulator/*.test.js"

i  emulators: Starting emulators: auth, firestore
i  emulators: Detected demo project ID "demo-fuelpoints", emulated services will use a demo configuration and attempts to access non-emulated services for this project will fail.
i  firestore: Firestore Emulator logging to firestore-debug.log
+  firestore: Firestore Emulator was started in standard edition.
+  firestore: Firestore Emulator UI websocket is running on 9150.
i  Running script: node --test --test-concurrency=1 test/emulator/*.test.js
(node:28676) MetadataLookupWarning: received unexpected error = All promises were rejected code = ETIMEDOUT, ENOTFOUND
(Use `node --trace-warnings ...` to show where the warning was created)
✔ I01-T07 Admin SDK: upis, čitanje i brisanje probnog dokumenta u Firestore emulatoru (3786.0475ms)
✔ I01-T07 Admin SDK: kreiranje i brisanje test korisnika u Auth emulatoru (47.6705ms)
▶ I01-T09 seed odbija rad van emulatora i van demo projekta
  ✔ I01-T09 provjeriEmulatorskoOkruzenje: bez emulator host-a i sa ne-demo projektom → greška (32.1985ms)
(node:8428) MetadataLookupWarning: received unexpected error = All promises were rejected code = ETIMEDOUT, ENOTFOUND
(Use `node --trace-warnings ...` to show where the warning was created)
  ✔ I01-T09 CLI bez FIRESTORE_EMULATOR_HOST i CLI sa ne-demo projektom → exit 1, ništa upisano (3261.9885ms)
✔ I01-T09 seed odbija rad van emulatora i van demo projekta (3294.8986ms)
▶ I01-T08 seed rewardDefinitions po §12 je idempotentan
  ✔ I01-T08 dvostruko pokretanje → tačno 2 dokumenta sa vrijednostima iz §12, bez dodatnih polja (7215.1191ms)
  ✔ I01-T08 ručno izmijenjen dokument vraća se na §12 vrijednosti pri ponovnom punjenju (7196.2411ms)
✔ I01-T08 seed rewardDefinitions po §12 je idempotentan (14411.7306ms)
ℹ tests 6
ℹ suites 2
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 22733.9516
+  Script exited successfully (code 0)
i  emulators: Shutting down emulators.
i  firestore: Stopping Firestore Emulator
!  Firestore Emulator has exited upon receiving signal: SIGINT
i  auth: Stopping Authentication Emulator
i  hub: Stopping emulator hub
i  logging: Stopping Logging Emulator
==> Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1)
Smoke: 404 NOT_FOUND, correlationId c6004eee-058b-46cb-be3c-6dac59f6bdf2
==> Firestore rules: npm ci, npm test
node.exe : npm warn deprecated json-ptr@3.1.1: Package no longer supported. Contact Support at https://www.npmjs.com/su
pport for more info.
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Program Files\nodejs/node_mo ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm warn deprec... for more info.:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@10.5.0: Old versions of glob are not supported, and contain widely publicized security vulnera
bilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at ex
orbitant rates) by contacting i@izs.me
npm warn deprecated uuid@9.0.1: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  F
or CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).

added 729 packages, and audited 730 packages in 28s

100 packages are looking for funding
  run `npm fund` for details

16 vulnerabilities (4 moderate, 12 high)

To address all issues (including breaking changes), run:
  npm audit fix --force

Run `npm audit` for details.
npm warn install-scripts 3 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   @firebase/util@1.15.3 (postinstall: node ./postinstall.js)
npm warn install-scripts   protobufjs@7.6.6 (postinstall: node scripts/postinstall)
npm warn install-scripts   re2@1.27.0 (install: install-from-cache --artifact build/Release/re2.node --host-var RE2_DOW
NLOAD_MIRROR --skip-path-var RE2_DOWNLOAD_SKIP_PATH --skip-ver-var RE2_DOWNLOAD_SKIP_VER --force-build-var RE2_DOWNLOAD
_FORCE_BUILD || node-gyp -j max rebuild)
npm warn install-scripts
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.

> fuelpoints-firestore-rules-testovi@0.1.0 test
> firebase emulators:exec --config ../../firebase.json --project demo-fuelpoints --only firestore "node --test --test-concurrency=1 *.test.js"

i  emulators: Starting emulators: firestore
i  emulators: Detected demo project ID "demo-fuelpoints", emulated services will use a demo configuration and attempts to access non-emulated services for this project will fail.
i  firestore: Firestore Emulator logging to firestore-debug.log
+  firestore: Firestore Emulator was started in standard edition.
+  firestore: Firestore Emulator UI websocket is running on 9150.
i  Running script: node --test --test-concurrency=1 *.test.js
[2026-10-15T19:27:17.065Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf50a error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.082Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf50b error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
[2026-10-15T19:27:17.136Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf50d error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.145Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf50e error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
▶ RULE-T12 (preliminarno) client access nad internal/unknown kolekcijom → DENY
  ✔ RULE-T12 rewardRequests: get, set, delete, list → DENY (621.5997ms)
[2026-10-15T19:27:17.242Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf511 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.250Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf512 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
[2026-10-15T19:27:17.333Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf514 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.346Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf515 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
  ✔ RULE-T12 redemptionRequests: get, set, delete, list → DENY (200.8341ms)
[2026-10-15T19:27:17.428Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf518 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.435Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf519 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
[2026-10-15T19:27:17.516Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf51b error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.534Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf51c error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
  ✔ RULE-T12 nepoznata kolekcija: get, set, delete, list → DENY (187.833ms)
✔ RULE-T12 (preliminarno) client access nad internal/unknown kolekcijom → DENY (1486.4631ms)
[2026-10-15T19:27:17.613Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf51f error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.620Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf520 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
[2026-10-15T19:27:17.698Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf522 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.705Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf523 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
▶ I01-T10 default deny za kolekcije još bez pravila
  ✔ I01-T10 users: get, set, delete, list → DENY (i za vlasnika) (170.1373ms)
[2026-10-15T19:27:17.769Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf526 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.782Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf527 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
[2026-10-15T19:27:17.830Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf529 error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'create' @ L5, false for 'update' @ L5
[2026-10-15T19:27:17.843Z]  @firebase/firestore: Firestore (12.19.0): GrpcConnection RPC 'Write' stream 0x42eaf52a error. Code: 7 Message: 7 PERMISSION_DENIED: 
false for 'delete' @ L5
  ✔ I01-T10 loyaltyLedger: get, set, delete, list → DENY (137.9086ms)
✔ I01-T10 default deny za kolekcije još bez pravila (308.4035ms)
ℹ tests 5
ℹ suites 2
ℹ pass 5
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2155.1719
+  Script exited successfully (code 0)
i  emulators: Shutting down emulators.
i  firestore: Stopping Firestore Emulator
!  Firestore Emulator has exited upon receiving signal: SIGINT
i  hub: Stopping emulator hub
i  logging: Stopping Logging Emulator
==> Android: assembleDebug, testDebugUnitTest
> Task :app:preBuild UP-TO-DATE
> Task :app:preDebugBuild UP-TO-DATE
> Task :app:mergeDebugNativeDebugMetadata NO-SOURCE
> Task :app:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :app:checkDebugAarMetadata UP-TO-DATE
> Task :app:generateDebugResValues UP-TO-DATE
> Task :app:mapDebugSourceSetPaths UP-TO-DATE
> Task :app:generateDebugResources UP-TO-DATE
> Task :app:mergeDebugResources UP-TO-DATE
> Task :app:packageDebugResources UP-TO-DATE
> Task :app:parseDebugLocalResources UP-TO-DATE
> Task :app:createDebugCompatibleScreenManifests UP-TO-DATE
> Task :app:extractDeepLinksDebug UP-TO-DATE
> Task :app:processDebugMainManifest UP-TO-DATE
> Task :app:processDebugManifest UP-TO-DATE
> Task :app:processDebugManifestForPackage UP-TO-DATE
> Task :app:processDebugResources UP-TO-DATE
> Task :app:compileDebugKotlin UP-TO-DATE
> Task :app:javaPreCompileDebug UP-TO-DATE
> Task :app:compileDebugJavaWithJavac NO-SOURCE
> Task :app:mergeDebugShaders UP-TO-DATE
> Task :app:compileDebugShaders NO-SOURCE
> Task :app:generateDebugAssets UP-TO-DATE
> Task :app:mergeDebugAssets UP-TO-DATE
> Task :app:compressDebugAssets UP-TO-DATE
> Task :app:processDebugJavaRes UP-TO-DATE
> Task :app:mergeDebugJavaResource UP-TO-DATE
> Task :app:checkDebugDuplicateClasses UP-TO-DATE
> Task :app:desugarDebugFileDependencies UP-TO-DATE
> Task :app:mergeExtDexDebug UP-TO-DATE
> Task :app:mergeLibDexDebug UP-TO-DATE
> Task :app:dexBuilderDebug UP-TO-DATE
> Task :app:mergeProjectDexDebug UP-TO-DATE
> Task :app:mergeDebugJniLibFolders UP-TO-DATE
> Task :app:mergeDebugNativeLibs UP-TO-DATE
> Task :app:stripDebugDebugSymbols UP-TO-DATE
> Task :app:validateSigningDebug UP-TO-DATE
> Task :app:writeDebugAppMetadata UP-TO-DATE
> Task :app:writeDebugSigningConfigVersions UP-TO-DATE
> Task :app:packageDebug UP-TO-DATE
> Task :app:createDebugApkListingFileRedirect UP-TO-DATE
> Task :app:assembleDebug UP-TO-DATE

BUILD SUCCESSFUL in 951ms
34 actionable tasks: 34 up-to-date
> Task :app:checkKotlinGradlePluginConfigurationErrors SKIPPED
> Task :app:preBuild UP-TO-DATE
> Task :app:preDebugBuild UP-TO-DATE
> Task :app:checkDebugAarMetadata UP-TO-DATE
> Task :app:generateDebugResValues UP-TO-DATE
> Task :app:mapDebugSourceSetPaths UP-TO-DATE
> Task :app:generateDebugResources UP-TO-DATE
> Task :app:mergeDebugResources UP-TO-DATE
> Task :app:packageDebugResources UP-TO-DATE
> Task :app:parseDebugLocalResources UP-TO-DATE
> Task :app:createDebugCompatibleScreenManifests UP-TO-DATE
> Task :app:extractDeepLinksDebug UP-TO-DATE
> Task :app:processDebugMainManifest UP-TO-DATE
> Task :app:processDebugManifest UP-TO-DATE
> Task :app:processDebugManifestForPackage UP-TO-DATE
> Task :app:processDebugResources UP-TO-DATE
> Task :app:compileDebugKotlin UP-TO-DATE
> Task :app:javaPreCompileDebug UP-TO-DATE
> Task :app:compileDebugJavaWithJavac NO-SOURCE
> Task :app:bundleDebugClassesToRuntimeJar UP-TO-DATE
> Task :app:bundleDebugClassesToCompileJar UP-TO-DATE
> Task :app:compileDebugUnitTestKotlin NO-SOURCE
> Task :app:preDebugUnitTestBuild UP-TO-DATE
> Task :app:javaPreCompileDebugUnitTest UP-TO-DATE
> Task :app:compileDebugUnitTestJavaWithJavac NO-SOURCE
> Task :app:processDebugJavaRes UP-TO-DATE
> Task :app:processDebugUnitTestJavaRes NO-SOURCE
> Task :app:testDebugUnitTest NO-SOURCE

BUILD SUCCESSFUL in 937ms
19 actionable tasks: 19 up-to-date
SVE PROVJERE PROŠLE
```

---

## Iteracija 2 — Account lifecycle i granica autentikacije

Datum izvršavanja: 2026-10-15/16 (Windows 11 Pro 10.0.22621, Windows PowerShell 5.1). Grana `iteracija-02`,
kod na commit-u `0b833e5` (svi koraci 1–7 i N-01; dokumentacija necommit-ovana u trenutku izvršavanja).
Verzije alata nepromijenjene u odnosu na i01: `node -v` → `v24.21.0`, `npm -v` → `11.19.0`, `npx firebase --version` → `15.32.1`.
Emulator komande sa JBR-om prvim u PATH-u (kao i01, OD-1).

### Završno izvršavanje (checkpoint)

Komande su izvršene redom iz jedne PowerShell skripte (izlaz svake komande u poseban fajl; ovdje skraćeno na rezultat):

```powershell
cd backend; npm ci; npm test; npm run test:emu; npm run test:emu; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1   # dva puta zaredom, svaki put kao zaseban proces; exit code iz procesa
```

| Komanda | Rezultat | Exit code | Trajanje |
|---|---|---|---|
| `backend: npm ci` | `added 713 packages, and audited 714 packages in 25s`; `11 vulnerabilities (4 moderate, 7 high)` | 0 | — |
| `backend: npm test` | `ℹ tests 34` `ℹ pass 34` `ℹ fail 0` | 0 | 2 s |
| `backend: npm run test:emu` (1) | `ℹ tests 32` `ℹ pass 32` `ℹ fail 0` | 0 | 112 s |
| `backend: npm run test:emu` (2) | `ℹ tests 32` `ℹ pass 32` `ℹ fail 0` | 0 | 107 s |
| `backend: npm run test:emu` (3) | `ℹ tests 32` `ℹ pass 32` `ℹ fail 0` | 0 | 113 s |
| `firebase\tests: npm ci` | `added 729 packages, and audited 730 packages in 29s`; `16 vulnerabilities (4 moderate, 12 high)` | 0 | — |
| `firebase\tests: npm test` | `ℹ tests 17` `ℹ pass 17` `ℹ fail 0` | 0 | 8 s |
| `.\skripte\provjera.ps1` (1) | `SVE PROVJERE PROŠLE` | 0 | 177 s |
| `.\skripte\provjera.ps1` (2) | `SVE PROVJERE PROŠLE` | 0 | 175 s |

#### `cd backend; npm test` (unit, bez emulatora) — izvod

```
✔ I01-T02 GET /api/v1/nepostojeca → 404 NOT_FOUND sa tačno tri polja (26.2982ms)
✔ I01-T02 nepodržan metod (DELETE /api/v1) i putanja van /api/v1 (GET /) → 404 NOT_FOUND (11.5517ms)
✔ I01-T03 neispravan JSON ("{") → 422 INVALID_REQUEST bez teksta greške parsera (19.9637ms)
✔ I01-T03 tijelo veće od limita parsera → 422 INVALID_REQUEST bez teksta greške parsera (P-4) (8.8643ms)
✔ I01-T03 oštećeno komprimovano tijelo (gzip, deflate, br) → 422 INVALID_REQUEST bez teksta zlib greške (18.4013ms)
✔ I01-T03 greška sa 4xx statusom koja ne dolazi iz JSON parsera → 500 INTERNAL_ERROR (6.3728ms)
✔ I01-T03 greška JSON parsera sa 5xx statusom → 500 INTERNAL_ERROR, ne INVALID_REQUEST (N-01) (7.6584ms)
✔ I01-T04 sinhroni i async izuzetak → 500 INTERNAL_ERROR bez stack-a, putanje i originalne poruke (10.6473ms)
✔ I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key (10.0566ms)
✔ I01-T04 test rute ne postoje u podrazumijevanoj aplikaciji (bez dodajRute) → 404 (10.3207ms)
✔ I01-T05 dva zahtjeva → dva različita correlationId (UUID v4) (10.0289ms)
✔ I01-T05 dolazni X-Correlation-Id se ignoriše (4.3323ms)
✔ I02-T11 rok zavisnog servisa je 10 s (i02/P-5) (0.6776ms)
✔ I02-T11 saRokom: obećanje koje nikad ne završi → GreskaApi SERVICE_UNAVAILABLE za < 1 s (56.8731ms)
✔ I02-T11 saRokom: uspjeh i greška u roku prolaze nepromijenjeni (0.3413ms)
✔ I02-T11 klasifikujGreskuAuth: token ili korisnik nije važeći → UNAUTHENTICATED (0.1878ms)
✔ I02-T11 klasifikujGreskuAuth: nedostupnost i istek roka → SERVICE_UNAVAILABLE; ostalo → INTERNAL_ERROR (0.1909ms)
✔ I02-T11 jeNedostupnostFirestore: UNAVAILABLE (14), DEADLINE_EXCEEDED (4), ABORTED (10) → true; ostalo → false (0.1829ms)
✔ I01-T01 katalog: 23 koda iz §27 sa tačnim HTTP statusima (3.3424ms)
✔ I01-T01 katalog: tabela §27 iz čitljive kopije SRS-a odgovara katalogu (bez drifta) (1.165ms)
✔ I01-T01 katalog: dopuna O-1 je tačno NOT_FOUND 404 i INVALID_REQUEST 422 (0.1522ms)
✔ I01-T01 katalog: ukupno 25 stavki, bez duplikata i bez kodova van §27 + O-1 (0.2774ms)
✔ I01-T01 katalog: svaka poruka je neprazna, na latinici (bez ćirilice) (0.2829ms)
✔ I01-T01 katalog: niz, stavke i mapa su zamrznuti (0.1243ms)
✔ I01-T06 nedostaju PORT, FIREBASE_PROJECT_ID i VERZIJA_USLOVA → GreskaKonfiguracije navodi sve tri varijable (1.0395ms)
✔ I01-T06 neispravan PORT → greška formata bez ispisa vrijednosti (0.7729ms)
✔ I01-T06 ispravne vrijednosti → zamrznut objekat konfiguracije (0.7954ms)
✔ I01-T06 pokretanje bez PORT → izlaz ≠ 0, poruka imenuje PORT, bez vrijednosti i stack-a (683.1737ms)
✔ I01-T06 prazna ili samo razmaci VERZIJA_USLOVA → greška koja imenuje VERZIJA_USLOVA (i02/P-4) (0.2342ms)
✔ I02-T13 emulator varijabla uz projekat koji ne počinje sa demo- → GreskaKonfiguracije bez vrijednosti (0.2698ms)
✔ I02-T13 emulator varijable uz demo- projekat i produkcioni projekat bez emulator varijabli → prolazi (0.1095ms)
✔ I02-T13 start sa FIRESTORE_EMULATOR_HOST i projektom bez demo- → izlaz ≠ 0, port nikad ne sluša, bez vrijednosti i stack-a (635.933ms)
✔ I02-T13 start sa FIREBASE_AUTH_EMULATOR_HOST i projektom bez demo- → izlaz ≠ 0, port nikad ne sluša, bez vrijednosti i stack-a (511.6698ms)
✔ I01-T11 seed CLI kad Firestore emulator nije dostupan → exit 1 za manje od 15 s, poruka o emulatoru, bez stack-a (139.6875ms)
ℹ tests 34
ℹ pass 34
ℹ fail 0
```

#### `cd backend; npm run test:emu` (Firestore + Auth emulator, `demo-fuelpoints`) — izvršavanje 1, izvod

```
✔ I01-T07 Admin SDK: upis, čitanje i brisanje probnog dokumenta u Firestore emulatoru (3877.4163ms)
✔ I01-T07 Admin SDK: kreiranje i brisanje test korisnika u Auth emulatoru (54.9177ms)
✔ I02-T01 bez Authorization zaglavlja → 401 UNAUTHENTICATED, ništa upisano (3194.297ms)
✔ I02-T01 važeći token van Authorization zaglavlja (query, X-Firebase-Token) → 401, ništa upisano (43.6632ms)
✔ I02-T02 pogrešna šema ili oblik zaglavlja → 401, ništa upisano (46.4162ms)
✔ I02-T02 neispravan, istekao i token drugog projekta → 401, ništa upisano (stvarni err.code u dijagnostici) (42.3371ms)
ℹ err.code za "Bearer abc": auth/argument-error
ℹ err.code za "Bearer a.b.c": auth/argument-error
ℹ err.code za "istekao (exp u prošlosti)": auth/id-token-expired
ℹ err.code za "aud drugog projekta (demo-drugi)": auth/argument-error
✔ I02-T02 pozitivna kontrola: šema bearer malim slovima → 201 (i02/P-7) (96.3968ms)
✔ I02-T03 token obrisanog, onemogućenog i opozvanog korisnika → 401 (checkRevoked) (1355.4213ms)
ℹ err.code za obrisan korisnik: auth/user-not-found
ℹ err.code za onemogućen korisnik: auth/user-disabled
ℹ err.code za opozvan korisnik: auth/id-token-revoked
✔ I02-T16 granice rute: GET init → 404, nepostojeća ruta bez token-a → 404, neispravan JSON bez token-a → 422 (47.238ms)
✔ API-T01 validan init kreira profil i balance 0/0 sa tačnim poljima; ponovljeni init ne resetuje stanje (3452.0961ms)
✔ I02-T04 uid u tijelu → 422 INVALID_REQUEST; dokument za uid iz tijela nikad ne nastaje (140.9964ms)
✔ I02-T05 server-controlled ili nepoznato polje u tijelu → 422 INVALID_REQUEST, ništa upisano (51.9525ms)
✔ I02-T05 tijelo nije JSON objekat → 422 INVALID_REQUEST, ništa upisano; nepoznato polje ima prednost nad displayName (35.153ms)
✔ I02-T06 neispravan displayName → 422 INVALID_DISPLAY_NAME, ništa upisano (52.9752ms)
✔ I02-T06 granične vrijednosti displayName → 201, upisano tačno (bez trim-a); brojanje kao size() u Rules (i02/P-3) (342.5123ms)
✔ I02-T07 acceptedTermsVersion različit od aktuelne verzije → 422 INVALID_REQUEST, ništa upisano (124.2732ms)
✔ I02-T08 failure injection između dva upisa i prije commit-a → 500 bez stack-a, nijedan dokument (188.2373ms)
✔ I02-T09 10 paralelnih init-a za isti uid → jedan users i jedan loyaltyAccounts, bez 500, isto stanje (3 ponavljanja) (14712.0309ms)
✔ I02-T10 nalog u DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS, dokumenti nepromijenjeni (92.4718ms)
✔ I02-T10 DELETION_IN_PROGRESS bez loyaltyAccounts → 409, loyaltyAccounts i dalje ne postoji (76.4747ms)
✔ I02-T14 (a) postoji samo users ACTIVE → 201, nastaje loyaltyAccounts 0/0, users nepromijenjen (i02/P-2) (94.0001ms)
✔ I02-T14 (b) postoji samo loyaltyAccounts sa 42 boda → 201, nastaje users, bodovi ostaju 42 (i02/P-2) (92.7946ms)
✔ I02-T14 (c) users sa accountStatus van SRS enum-a → 500, ništa promijenjeno (93.3152ms)
✔ I02-T12 log (svi kanali) i odgovori ne sadrže token ni Authorization ni za jedan ishod (4481.259ms)
✔ I02-T11 Firestore nedostupan (zatvoren port) → 503 SERVICE_UNAVAILABLE za < 15 s, bez stack-a i token-a (10784.4833ms)
ℹ Firestore – zatvoren port: HTTP 503 za 10038 ms
✔ I02-T11 Firestore nedostupan (crna rupa) → 503 SERVICE_UNAVAILABLE za < 15 s, bez stack-a i token-a (10748.326ms)
ℹ Firestore – crna rupa: HTTP 503 za 10041 ms
✔ I02-T11 Auth nedostupan (zatvoren port) → 503 SERVICE_UNAVAILABLE za < 15 s, bez stack-a i token-a (4000.7847ms)
ℹ Auth – zatvoren port: HTTP 503 za 29 ms
ℹ err.code Admin SDK-a (Auth – zatvoren port): app/network-error
✔ I02-T11 Auth nedostupan (crna rupa) → 503 SERVICE_UNAVAILABLE za < 15 s, bez stack-a i token-a (22636.175ms)
ℹ Auth – crna rupa: HTTP 503 za 10018 ms
ℹ err.code Admin SDK-a (Auth – crna rupa): bez odgovora u roku od 12 s
✔ I01-T09 seed odbija rad van emulatora i van demo projekta (3313.1302ms)
✔ I01-T08 seed rewardDefinitions po §12 je idempotentan (14767.2008ms)
ℹ tests 32
ℹ pass 32
ℹ fail 0
```

(I01-T08 i I01-T09 imaju po dva podtesta, svi ✔.) Trajanje testa I02-T11 „Auth – crna rupa” (22,6 s) uključuje dijagnostički
poziv sa rokom od 12 s; mjereni odgovor Backend-a je 10 018 ms.

#### I02-T09 — tri uzastopna izvršavanja `npm run test:emu`

```
(1) ✔ I02-T09 10 paralelnih init-a za isti uid → … (3 ponavljanja) (14712.0309ms)   ℹ pass 32  ℹ fail 0
(2) ✔ I02-T09 10 paralelnih init-a za isti uid → … (3 ponavljanja) (10589.073ms)    ℹ pass 32  ℹ fail 0
(3) ✔ I02-T09 10 paralelnih init-a za isti uid → … (3 ponavljanja) (17801.696ms)    ℹ pass 32  ℹ fail 0
```

Dodatno je I02-T09 zelen u ranijim izvršavanjima tokom koraka 5–7 i u oba `provjera.ps1` izvršavanja (ukupno ≥ 7 puta × 3 ponavljanja,
nijedan pad). `maxAttempts` je ostao 5.

#### `cd firebase\tests; npm test` (Firestore emulator, `demo-fuelpoints`)

```
  ✔ RULE-T01 neautentifikovan read users/{uid} → DENY (447.6516ms)
  ✔ RULE-T02 owner read sopstvenog profila → ALLOW (95.6415ms)
  ✔ RULE-T03 cross-user read profila → DENY; list users → DENY i za vlasnika (139.6868ms)
  ✔ RULE-T04 owner update samo displayName + updatedAt (= request.time) → ALLOW (102.5416ms)
  ✔ RULE-T05 update koji dodaje ili mijenja server/unknown polje → DENY (170.8429ms)
  ✔ RULE-T06 owner read sopstvenog loyaltyAccounts/{uid} → ALLOW (73.458ms)
  ✔ RULE-T07 client create loyaltyAccounts (i za sopstveni uid) → DENY (137.823ms)
  ✔ RULE-T07 client update, merge i delete postojećeg loyaltyAccounts (i od strane vlasnika) → DENY (215.0458ms)
  ✔ I02-T15 users: create i delete vlasnika → DENY (94.282ms)
  ✔ I02-T15 users update vlasnika: neispravan displayName ili klijentski updatedAt → DENY (139.8052ms)
  ✔ I02-T15 users update drugog korisnika i neautentifikovan update → DENY (97.3259ms)
  ✔ I02-T15 loyaltyAccounts: get drugog korisnika, neautentifikovan get i list → DENY (164.9077ms)
  ✔ I02-T15 displayName od astralnih znakova: size() broji UTF-16 jedinice (50 → ALLOW, 51 i 100 → DENY) (123.315ms)
  ✔ RULE-T12 rewardRequests: get, set, delete, list → DENY (343.3114ms)
  ✔ RULE-T12 redemptionRequests: get, set, delete, list → DENY (193.8001ms)
  ✔ RULE-T12 nepoznata kolekcija: get, set, delete, list → DENY (213.6119ms)
  ✔ I01-T10 loyaltyLedger: get, set, delete, list → DENY (170.6526ms)
ℹ tests 17
ℹ pass 17
ℹ fail 0
```

Emulator nije prijavio upozorenje o nekorišćenoj funkciji `ownResource()`.

#### `.\skripte\provjera.ps1` — oba izvršavanja (izvod stdout-a)

```
==> Alati (Node 24, Java 21+, JDK za Gradle)
==> SRS integritet (SHA-256 normativnog .docx-a)
==> NFR-07 (bez tajni u repozitorijumu)
==> Bez TODO/FIXME
==> Portovi emulatora 8080 i 9099 su slobodni
==> Backend: npm ci, npm test, npm run test:emu
==> Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1, 401 UNAUTHENTICATED na /account/init bez token-a)
Smoke: 404 NOT_FOUND, correlationId 6b837715-7eb6-46ab-8ad6-410ab30097d2        (2. put: 93212601-0ce9-46a1-896e-df4920d33400)
Smoke: 401 UNAUTHENTICATED, correlationId cddf5864-d899-4987-abbf-4059051bd112  (2. put: c40a1143-9ce6-4b86-9641-79fc5942967c)
==> Firestore rules: npm ci, npm test
==> Android: assembleDebug, testDebugUnitTest
BUILD SUCCESSFUL in 1s
BUILD SUCCESSFUL in 1s
SVE PROVJERE PROŠLE
```

Exit code procesa: `0` i `0` (177 s, 175 s). Ranije, poslije koraka 7, `provjera.ps1` je izvršena dva puta: prvi put `EXIT=0`
(`SVE PROVJERE PROŠLE`); drugi put je ispisano `SVE PROVJERE PROŠLE`, ali exit code nije uhvaćen (vidi „Nalazi tokom izvršavanja”).

### Inspekcije

| Komanda | Izlaz |
|---|---|
| `git grep -n -i -E "process\.env\.(NODE_ENV\|TEST)\|inject\|ubriz" -- backend/src` | prazno (exit 1) |
| `git grep -n -E "/pos/\|/rewards/\|/vouchers\|reconcile\|loyaltyLedger" -- backend/src` | samo `backend/src/podaci/kolekcije.js:6:  loyaltyLedger: 'loyaltyLedger',` |
| `git grep -n "verifyIdToken" -- backend/src` | `backend/src/posrednici/autentikacija.js:20:      dekodiran = await saRokom(auth.verifyIdToken(poklapanje[1], true), ROK_ZAVISNOG_SERVISA_MS);` (checkRevoked = `true`, i02/P-9) |
| `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` |
| `git diff main -- docs/srs` | prazno |
| `git log main..HEAD --format=%B \| Select-String -Pattern 'Co-Authored-By\|Generated with\|claude\.com'` | prazno |
| `git grep -n -E "TODO\|FIXME" -- backend firebase skripte README.md ':!skripte/provjera.ps1'` | prazno (exit 1) |
| `firebase/firestore.rules` vs §31 `.docx` (`word/document.xml`, prelomi `w:br`, bez blokova purchases … redemptionRequests) | Python poređenje: `JEDNAKO_DOCX`; `diff` sa planom 11.3: `IDENTICNO_PLANU` |

### i02/P-3 — stvarno ponašanje `size()` u Firestore emulatoru

Privremena sonda (`firebase/tests/_sonda_size.mjs`, obrisana poslije izvršavanja, nije commit-ovana), `updateDoc` vlasnika sa
`displayName = znak × n` i `updatedAt: serverTimestamp()` nad pravilima iz §31:

```
SONDA %uD83D%uDE00 x 25: ALLOW
SONDA %uD83D%uDE00 x 26: ALLOW
SONDA %uD83D%uDE00 x 33: ALLOW
SONDA %uD83D%uDE00 x 34: ALLOW
SONDA %uD83D%uDE00 x 50: ALLOW
SONDA %uD83D%uDE00 x 51: DENY
SONDA %uD83D%uDE00 x 100: DENY
SONDA %u0161 x 50: ALLOW
SONDA %u0161 x 51: ALLOW
SONDA %u0161 x 100: ALLOW
SONDA %u0161 x 101: DENY
SONDA %u20AC x 33: ALLOW
SONDA %u20AC x 34: ALLOW
SONDA %u20AC x 100: ALLOW
SONDA %u20AC x 101: DENY
SONDA a x 100: ALLOW
SONDA a x 101: DENY
```

Zaključak: `size()` broji UTF-16 jedinice (😀 = 2), ne code point-e ni UTF-8 bajtove. Po odluci i02/P-3 Backend broji
`String.prototype.length`; I02-T06 i I02-T15 provjeravaju istu granicu u oba sloja (50 × 😀 prolazi, 51 i 100 × 😀 ne prolaze).
Prva verzija I02-T15 (pretpostavka code point-a: 100 × 😀 → ALLOW) je pala: `✖ I02-T15 displayName od astralnih znakova …`
(`ℹ pass 16`, `ℹ fail 1`), što je i dovelo do sonde.

### Stvarni `err.code`-ovi Admin SDK-a

| Test | Slučaj | `err.code` | Mapiranje |
|---|---|---|---|
| I02-T02 | `Bearer abc` | `auth/argument-error` | 401 |
| I02-T02 | `Bearer a.b.c` | `auth/argument-error` | 401 |
| I02-T02 | nepotpisan token, `exp` u prošlosti | `auth/id-token-expired` | 401 |
| I02-T02 | nepotpisan token, `aud` = `demo-drugi` | `auth/argument-error` | 401 |
| I02-T03 | obrisan korisnik | `auth/user-not-found` | 401 |
| I02-T03 | onemogućen korisnik | `auth/user-disabled` | 401 |
| I02-T03 | opozvan korisnik (`revokeRefreshTokens` 1,1 s poslije izdavanja) | `auth/id-token-revoked` | 401 |
| I02-T11 | Auth emulator host → zatvoren port | `app/network-error` | 503 (u listi; nije bilo zastoja po planu 5.5) |
| I02-T11 | Auth emulator host → „crna rupa” | bez odgovora u 12 s (nema koda) | 503 preko `saRokom` (10 018 ms) |

Slučajevi oblika zaglavlja (`Basic …`, `Bearer`, `Bearer `, dva razmaka, dodatni dio, `Token …`, token bez šeme, prazno) se odbijaju
u posredniku prije poziva Admin SDK-a (401, bez `err.code`).

### Kontrolne mutacije (plan 8.4 + M-R01c + dodatna M10)

Svaka mutacija je primijenjena lokalno, pokrenut je ciljani test fajl, pa je stanje vraćeno sa `git checkout -- backend/src firebase/firestore.rules`
(poslije svih: `git status --short` → samo ` M docs/TRACEABILITY.md`, tada necommit-ovan). Prvo izvršavanje višelinijskih mutacija
(M2b, M4, M5, M8, M9, M10) nije primijenilo izmjenu (greška u pomoćnom skriptu: `\n` nije pretvoren u prelom reda; za M10 je fajl
postao sintaksno neispravan pa je test fajl pao u cjelini — rezultat odbačen); ponovljene su ispravljenim skriptom. U tabeli su samo važeći rezultati.

| Mutacija | Ciljani test | Rezultat | Očekivano po planu |
|---|---|---|---|
| M1 `verifyIdToken(token, true)` → `verifyIdToken(token)` | `emulator/autentikacija.test.js` | `ℹ pass 7` `ℹ fail 0` — preživljava | da (i02/P-9: emulator uvijek provjerava opoziv); `true` potvrđeno inspekcijom |
| M2 `res.locals.uid = req.body?.uid ?? dekodiran.uid` | `emulator/inicijalizacijaNaloga.test.js` | `ℹ pass 14` `ℹ fail 0` — preživljava | plan: I02-T04. Ne obara jer stroga validacija tijela odbija `uid` (422) prije servisa; drugi sloj zaštite drži granicu. Vidi M2b. |
| M2b M2 + uklonjena provjera nepoznatih ključeva | isti | `✖ I02-T04`, `✖ I02-T05` (oba testa); `ℹ pass 11` `ℹ fail 3` | da: bez validacije uid iz tijela prolazi i I02-T04 pada |
| M3 `users` upis van transakcije (`await refKorisnik.create(korisnik)`) | isti | `✖ API-T01`, `✖ I02-T04`, `✖ I02-T06`, `✖ I02-T07`, `✖ I02-T08`, `✖ I02-T09`, `✖ I02-T14 (b)`, `✖ I02-T14 (c)`; `ℹ pass 6` `ℹ fail 8` | da (I02-T08 (a)) |
| M4 `loyaltyAccounts`: `tx.set` bez provjere postojanja | isti | `✖ API-T01`, `✖ I02-T09`, `✖ I02-T14 (b)`; `ℹ pass 11` `ℹ fail 3` | da (API-T01 (b) / I02-T14 (b)) |
| M5 uklonjena provjera nepoznatih ključeva | isti | `✖ I02-T04`, `✖ I02-T05` (oba testa); `ℹ pass 11` `ℹ fail 3` | da |
| M6 uklonjen `saRokom` oko transakcije | `emulator/nedostupnostServisa.test.js` | `✖ I02-T11 Firestore nedostupan (crna rupa)` (20 596 ms), `✖ I02-T11 Firestore nedostupan (zatvoren port)` (21 347 ms); `ℹ pass 2` `ℹ fail 2` | da |
| M7 uklonjena zaštita emulator/demo | `jedinicni/konfiguracija.test.js`, `jedinicni/pokretanjeBackenda.test.js` | `✖ I02-T13` (unit i oba spawn testa); `ℹ pass 6` `ℹ fail 3` | da |
| M8 rules: `allow get: if signedIn();` u `/users/{uid}` | `firebase/tests/korisnikINalog.test.js` | `✖ RULE-T03`; `ℹ pass 12` `ℹ fail 1` | da |
| M9 rules: `/users/{uid}` update bez `changedOnly(...)` | isti | `✖ RULE-T05`; `ℹ pass 12` `ℹ fail 1` | da |
| M10 (dodatna) posrednik `console.log(zaglavlje)` | `emulator/logBezTokena.test.js` | `✖ I02-T12`; `ℹ pass 0` `ℹ fail 1` | da |
| M7b/M7d (i01) `console.error/console.log(req.get('authorization'))` u centralnom rukovaocu, poslije premještanja presretača | `jedinicni/aplikacija.test.js` | oba: `✖ I01-T04 log sadrži correlationId, a ne sadrži Authorization …`; `ℹ pass 10` `ℹ fail 1` | da (korak 6) |
| M-R01c `status >= 400 && status < 500` → `status >= 400` (N-01) | `npm test` | `✖ I01-T03 greška JSON parsera sa 5xx statusom → 500 INTERNAL_ERROR, ne INVALID_REQUEST (N-01)`; `ℹ pass 33` `ℹ fail 1` | da |

(Za mutacije nad `inicijalizacijaNaloga.test.js` tada je fajl imao 14 testova jer je izvršen samostalno.)

### Test-first (crveno prije koda)

| Korak | Komanda | Rezultat prije implementacije |
|---|---|---|
| 1 | `firebase\tests: npm test` nad default deny | `✖ RULE-T02`, `✖ RULE-T04`, `✖ RULE-T06`, `✖ I02-T15 … astralnih` (ostali DENY testovi zeleni) |
| 2 | `backend: npm test` | `ℹ tests 27` `ℹ pass 21` `ℹ fail 6` (I01-T06 ×3, I02-T13 ×3) |
| 3 | `backend: npm test` | `ERR_MODULE_NOT_FOUND … greskeServisa.js`; `ℹ fail 1` |
| 4–5 | `backend: npm run test:emu` | `ℹ tests 27` `ℹ pass 7` `ℹ fail 20` (svi novi osim I02-T16, koji važi i bez rute) |
| 6 | I02-T11 (b) i I02-T12 nad starim `pokreni.js` | I02-T11: 4 × `✖` (HTTP 500 za 14–16 ms); I02-T12 zelen (in-process, zavisi od koraka 4–5) |
| N-01 | test sa M-R01c | vidi tabelu mutacija |

### Nalazi tokom izvršavanja

- **I02-T05, prazno tijelo:** prvo izvršavanje poslije koraka 4–5 je palo (`prazno tijelo: actual 'INVALID_DISPLAY_NAME', expected 'INVALID_REQUEST'`).
  Uzrok je bio testni pomoćnik (podrazumijevani parametar je postavljao `Content-Type: application/json`, pa je parser dao `{}`).
  Sonda: bez Content-Type `req.body` je `undefined`; sa `application/json` i praznim tijelom `{}`. Ispravljen je pomoćnik
  (`null` = bez Content-Type); produkcioni kod nije mijenjan. Prazno JSON tijelo `{}` daje `INVALID_DISPLAY_NAME` (objekat bez nepoznatih ključeva).
- **Auth host i postojeća instanca:** dijagnostika u I02-T11 koja je mijenjala `FIREBASE_AUTH_EMULATOR_HOST` u procesu testa nad postojećom
  Auth instancom je vratila `PRIHVAĆEN`; sa novom Admin aplikacijom → `app/network-error` (IMPLEMENTATION_LOG, OD-3).
- **Firestore na zatvorenom portu** ne vraća grešku odmah: odgovor 503 stiže po isteku roka (10 038 ms), jer gRPC klijent ponavlja konekciju.
- **`provjera.ps1` i Gradle daemon:** kad je skripta pokrenuta sa preusmjerenim izlazom (`*> fajl`) iz drugog PowerShell-a, pozivalac je čekao
  628 s iako je skripta ispisala `SVE PROVJERE PROŠLE` i izašla sa 0: Gradle daemon je naslijedio handle izlaza. `.\gradlew.bat --stop`
  (`1 Daemon stopped`) je oslobodio pozivaoca. Drugo izvršavanje preko `Start-Process -PassThru` bez keširanog handle-a nije vratilo
  exit code (prazan `ExitCode`). Završna izvršavanja koriste `Start-Process` + `$p.Handle` + `WaitForExit()` → exit code 0 i 0.
- `MetadataLookupWarning` (kao i01) i `npm warn install-scripts` (`re2`) se pojavljuju; ne utiču na rezultat.

### Testovi koji nisu izvršeni

- Odbijanje token-a sa pogrešnim potpisom ili izmijenjenim payload-om (tuđi uid): emulator token-i nisu potpisani i emulator ih prihvata
  (poznato ograničenje iz brief-a, tačka 5).
- Razlika `verifyIdToken(token, true)` / `verifyIdToken(token)`: neizvodljiva u emulatoru (i02/P-9, M1 preživljava); provjera inspekcijom.
- `size()` nad produkcionim Rules engine-om: testovi rade samo nad emulatorom.

### Rezultat po ID-u (Iteracija 2)

| ID | Rezultat | Izvor |
|---|---|---|
| API-T01 | PASS | `npm run test:emu` ×3 |
| RULE-T01 … RULE-T07 | PASS (7/7) | `firebase\tests: npm test` |
| I02-T01 | PASS (2 testa) | `npm run test:emu` |
| I02-T02 | PASS (3 testa, stvarni kodovi iznad) | `npm run test:emu` |
| I02-T03 | PASS (stvarni kodovi iznad) | `npm run test:emu` |
| I02-T04 | PASS | `npm run test:emu` |
| I02-T05 | PASS (2 testa) | `npm run test:emu` |
| I02-T06 | PASS (2 testa; granica po `size()`) | `npm run test:emu` |
| I02-T07 | PASS | `npm run test:emu` |
| I02-T08 | PASS (0 dokumenata u (a) i (b); kontrola 201) | `npm run test:emu` |
| I02-T09 | PASS u 3/3 uzastopna izvršavanja | `npm run test:emu` ×3 |
| I02-T10 | PASS (2 testa) | `npm run test:emu` |
| I02-T11 | PASS: (a) 6 unit testova; (b) 4 varijante, 503 za 29–10 041 ms | `npm test`, `npm run test:emu` |
| I02-T12 | PASS | `npm run test:emu` |
| I02-T13 | PASS: (a) 2 unit testa; (b) 2 spawn testa | `npm test` |
| I02-T14 | PASS ((a), (b), (c)) | `npm run test:emu` |
| I02-T15 | PASS (5 testova) | `firebase\tests: npm test` |
| I02-T16 | PASS (+ smoke 401 u `provjera.ps1` ×2) | `npm run test:emu`, `provjera.ps1` |
| N-01 (I01-T03, parser 5xx) | PASS; M-R01c obara test | `npm test` |
| Regresija i01 | PASS: I01-T01 … I01-T09, I01-T11 (I01-T06 proširen), I01-T10 (samo loyaltyLedger), RULE-T12 (preliminarno), Android `assembleDebug` i `testDebugUnitTest` (NO-SOURCE) | `npm test`, `npm run test:emu`, `firebase\tests: npm test`, `provjera.ps1` |
| `provjera.ps1` | exit 0, dva puta zaredom | — |

### Poznata ograničenja

- Nepotpisani emulator token-i (gore); zaštita I02-T13 sprječava emulator režim van `demo-` projekta.
- i02/P-9: checkRevoked se ne može razlikovati u emulatoru (M1 preživljava).
- `size()` utvrđen samo u emulatoru.
- N-02 (backlog i01): seed CLI visi kad na `FIRESTORE_EMULATOR_HOST` sluša servis koji nije Firestore emulator — ne ispravlja se (odluka).
- N-01 je izvodljiv bez izmjene produkcionog koda (spoljna Express aplikacija postavlja kodiranje toka), pa nema ograničenja po N-01.
