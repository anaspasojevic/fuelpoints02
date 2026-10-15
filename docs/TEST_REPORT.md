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
