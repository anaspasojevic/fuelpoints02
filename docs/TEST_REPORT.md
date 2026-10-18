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

---

## Iteracija 2 — FIX LOOP 1 (nalazi R-01 … R-08 iz `docs/iteracije/i02_review.md`, commit 1759848)

Datum izvršavanja: 2026-10-16 (Windows 11 Pro 10.0.22621, Windows PowerShell 5.1). Uloga: BUILDER. Alati nepromijenjeni
(`node -v` → `v24.21.0`, `npx firebase --version` → `15.32.1`). Pojedinačni emulator testovi su pokretani komandom
`npx firebase emulators:exec --config ../firebase.json --project demo-fuelpoints --only firestore,auth "node --test --test-concurrency=1 [--test-name-pattern=<filter>] <fajl>"`
iz `backend` (JBR prvi u PATH-u). Mutacije su bile privremene (primijenjene u radnom stablu, vraćene sa `git restore`; `git status` poslije
svake bez izmjena u `backend/src`) i nisu commit-ovane.

### R-01 — I02-T09 dozvoljava 503 uz provjeru konzistentnosti (samo test)

Novi kriterijum: statusi ∈ {200, 201, 503} (nijedan 500; 503 sa tačnim tijelom `SERVICE_UNAVAILABLE`), najviše jedan 201, sva 200/201
tijela identična, na kraju tačno 1 `users` i 1 `loyaltyAccounts`, 0/0, `loyaltyLedger` prazan, naknadni sekvencijalni init → 200 sa istim tijelom.
Produkcioni kod nepromijenjen. Statusi u svih 5 završnih izvršavanja (3 × `npm run test:emu`, 2 × `provjera.ps1`; 15 ponavljanja):
svaki put `200×9, 201×1`, nijedan 503 ni 500, npr. `ℹ ponavljanje 1: statusi 200,200,200,201,200,200,200,200,200,200`.
503 nije izazvan u ovim izvršavanjima; ponašanje pod jačom kontencijom (30 paralelnih) je opisano u review-u (2.3 (f)) i u IMPLEMENTATION_LOG
kao poznato ograničenje.

### R-02 — jedan rok za cijeli zaštićeni zahtjev (I02-T11 (c))

Test: `backend/test/emulator/nedostupnostServisa.test.js`, spawn `src/pokreni.js`; Auth emulator iza `sporProksi` (kašnjenje po komadu
u oba smjera) + Firestore „crna rupa”; granica 12 s; tačno tri polja, bez stack-a, token nije u odgovoru ni u logu.

Crveno (test dodat, produkcioni kod kao u `96df140`):

```
✖ I02-T11 (c) Auth spor (4000 ms po komadu) + Firestore crna rupa → 503 SERVICE_UNAVAILABLE za < 12 s (19012.9978ms)
ℹ Auth spor 4000 ms + Firestore crna rupa: HTTP 503 za 18081 ms
✖ I02-T11 (c) Auth spor (2000 ms po komadu) + Firestore crna rupa → 503 SERVICE_UNAVAILABLE za < 12 s (14891.2963ms)
ℹ Auth spor 2000 ms + Firestore crna rupa: HTTP 503 za 14057 ms
  AssertionError [ERR_ASSERTION]: odgovor je stigao za 18081 ms (rok 12000 ms)
  AssertionError [ERR_ASSERTION]: odgovor je stigao za 14057 ms (rok 12000 ms)
ℹ tests 6  ℹ pass 4  ℹ fail 2
```

Zeleno poslije ispravke (cijela emulator suita `ℹ tests 34` `ℹ pass 34` `ℹ fail 0`; unit `ℹ tests 34` `ℹ pass 34` `ℹ fail 0`):

```
✔ I02-T11 (c) Auth spor (4000 ms po komadu) + Firestore crna rupa → 503 SERVICE_UNAVAILABLE za < 12 s (10984.5983ms)
ℹ Auth spor 4000 ms + Firestore crna rupa: HTTP 503 za 10037 ms
✔ I02-T11 (c) Auth spor (2000 ms po komadu) + Firestore crna rupa → 503 SERVICE_UNAVAILABLE za < 12 s (10883.6108ms)
ℹ Auth spor 2000 ms + Firestore crna rupa: HTTP 503 za 10029 ms
```

Završna izvršavanja (5 × po dvije varijante): 10 017 – 10 046 ms. Postojeće varijante I02-T11 (b) i dalje prolaze: Firestore 10 024 – 10 047 ms,
Auth zatvoren port 24 – 43 ms, Auth crna rupa 10 021 – 10 042 ms.

### R-04 — `displayName` mora biti ispravan UTF-16

Dopuna I02-T06 („neispravan displayName”): `"\uD800"` i `"a\uDC00"` → 422 `INVALID_DISPLAY_NAME`, baza prazna.

Crveno (test dodat, bez `isWellFormed()`):

```
✖ I02-T06 neispravan displayName → 422 INVALID_DISPLAY_NAME, ništa upisano (10738.0376ms)
  AssertionError [ERR_ASSERTION]: usamljeni visoki surogat \uD800: status
    actual: 503,
    expected: 422,
```

U ovom okruženju ishod je bio 503 po isteku roka (~10,7 s), a ne 500 kao u review-u; u oba slučaja zahtjev nije odbijen validacijom.
Zeleno poslije ispravke: `✔ I02-T06 neispravan displayName … (62.0518ms)` i `✔ I02-T06 granične vrijednosti displayName …`
(postojeći granični slučajevi i dalje prolaze); `inicijalizacijaNaloga.test.js`: `ℹ tests 14` `ℹ pass 14` `ℹ fail 0`.

### R-05 — UID se ne uzima iz query-ja ni zaglavlja (samo test)

Novi test `I02-T04 uid u query-ju i u zaglavljima X-User-Id / X-Uid se ignoriše → nalog samo za korisnika iz token-a`:
`?uid=<B>` → 201, `X-User-Id: <B>` → 200, `X-Uid: <B>` → 200, tijelo sa stanjem A; `users/B` i `loyaltyAccounts/B` ne postoje; ukupno 2 dokumenta.
Bez mutacije: PASS. „Crveno” mutacijom M16 (`rute/nalog.js`: `{ uid: req.query.uid ?? res.locals.uid, ...ulaz }`):

```
✖ I02-T04 uid u query-ju i u zaglavljima X-User-Id / X-Uid se ignoriše → nalog samo za korisnika iz token-a (75.4923ms)
  AssertionError [ERR_ASSERTION]: ?uid=<B>: users/B postoji
ℹ tests 2  ℹ pass 1  ℹ fail 1      EXIT=1
```

### R-06 — init ne prepisuje postojeći dokument (samo test)

Nova varijanta I02-T08: omotač transakcije čiji `tx.getAll` za postojeći dokument vraća snimak „ne postoji”, zasebno za `users/{uid}` i za
`loyaltyAccounts/{uid}` (oba dokumenta postoje, 42 boda) → 500/503 bez stack-a, oba dokumenta `deepStrictEqual` nepromijenjena.
Bez mutacije: `ℹ sakriven users/{uid}: HTTP 500 INTERNAL_ERROR`, `ℹ sakriven loyaltyAccounts/{uid}: HTTP 500 INTERNAL_ERROR`, PASS.

M04 (oba `tx.create` → `tx.set`, uslovi `exists` zadržani), cijeli `inicijalizacijaNaloga.test.js`:

```
✖ I02-T08 getAll vraća „ne postoji” za postojeći dokument → 500/503 bez stack-a, users i loyaltyAccounts nepromijenjeni (83.0091ms)
ℹ sakriven users/{uid}: HTTP 201 undefined
  AssertionError [ERR_ASSERTION]: users: status 201
ℹ tests 16  ℹ pass 15  ℹ fail 1      EXIT=1
```

Dodatno, M04-l (samo `tx.create(refNalog` → `tx.set(refNalog`): `ℹ sakriven users/{uid}: HTTP 500 INTERNAL_ERROR`,
`ℹ sakriven loyaltyAccounts/{uid}: HTTP 201 undefined`, `AssertionError [ERR_ASSERTION]: loyaltyAccounts: status 201` — test obara i jednolinijsku mutaciju.

### Mutacioni dokazi (sažetak)

| Mutacija | Ciljani test | Rezultat |
|---|---|---|
| M16: UID iz `req.query.uid ?? res.locals.uid` | I02-T04 (query/zaglavlja) | UBIJENA: `?uid=<B>: users/B postoji` |
| M04: oba `tx.create` → `tx.set` | I02-T08 (zastarjelo čitanje) | UBIJENA: `users: status 201` |
| M04-l: samo `loyaltyAccounts` `tx.create` → `tx.set` | isto | UBIJENA: `loyaltyAccounts: status 201` |
| Dva nezavisna roka (`git checkout 96df140 -- backend/src/posrednici/autentikacija.js backend/src/servisi/inicijalizacijaNaloga.js`) | I02-T11 (c) | UBIJENA: 18 056 ms i 14 076 ms (`odgovor je stigao za … ms (rok 12000 ms)`) |
| Uklonjen `displayName.isWellFormed() &&` | I02-T06 | UBIJENA: `usamljeni visoki surogat \uD800: status`, `actual: 503`, `expected: 422` |

Poslije svake: `git restore backend/src` (za checkout iz `96df140`: `git restore --source=HEAD --staged --worktree -- backend/src`);
`git status --short` bez izmjena u `backend/src`.

### Završno izvršavanje (checkpoint FIX LOOP 1)

Kod na commit-u `be9ba49` (dokumentacija necommit-ovana u trenutku izvršavanja). Komande redom iz jedne PowerShell skripte, izlaz u fajlove;
`provjera.ps1` kao zaseban proces (`Start-Process` + `$p.Handle` + `WaitForExit()`, kao u i02).

| Komanda | Rezultat | Exit code | Trajanje |
|---|---|---|---|
| `backend: npm ci` | `added 713 packages, and audited 714 packages in 22s`; `11 vulnerabilities (4 moderate, 7 high)` | 0 | 22 s |
| `backend: npm test` | `ℹ tests 34` `ℹ pass 34` `ℹ fail 0` | 0 | 2 s |
| `backend: npm run test:emu` (1) | `ℹ tests 36` `ℹ pass 36` `ℹ fail 0` | 0 | 126 s |
| `backend: npm run test:emu` (2) | `ℹ tests 36` `ℹ pass 36` `ℹ fail 0` | 0 | 130 s |
| `backend: npm run test:emu` (3) | `ℹ tests 36` `ℹ pass 36` `ℹ fail 0` | 0 | 133 s |
| `firebase\tests: npm ci` | `added 729 packages, and audited 730 packages in 28s`; `16 vulnerabilities (4 moderate, 12 high)` | 0 | 29 s |
| `firebase\tests: npm test` | `ℹ tests 17` `ℹ pass 17` `ℹ fail 0` | 0 | 9 s |
| `.\skripte\provjera.ps1` (1) | `SVE PROVJERE PROŠLE` (34/34, 36/36, 17/17, Android `BUILD SUCCESSFUL` ×2, smoke 404 i 401) | 0 | 198 s |
| `.\skripte\provjera.ps1` (2) | `SVE PROVJERE PROŠLE` (isti brojevi) | 0 | 198 s |

Emulator suita ima 36 testova (32 iz i02 + I02-T11 (c) × 2 + I02-T04 query/zaglavlja + I02-T08 zastarjelo čitanje).
stderr `provjera.ps1` sadrži samo `npm warn deprecated …` i `npm warn install-scripts` (kao ranije).

### Rezultat po ID-u (FIX LOOP 1)

| ID | Rezultat | Izvor |
|---|---|---|
| I02-T04 | PASS (2 testa: tijelo; query i zaglavlja); M16 ubijena | `npm run test:emu` ×3, `provjera.ps1` ×2 |
| I02-T06 | PASS (2 testa; dopuna: usamljeni surogati); mutacija `isWellFormed` ubijena | isto |
| I02-T08 | PASS (2 testa; nova varijanta → 500 za oba dokumenta); M04 i M04-l ubijene | isto |
| I02-T09 | PASS u 5/5 izvršavanja (15 ponavljanja, svaki put `200×9, 201×1`) | isto |
| I02-T11 | PASS: (a) unit; (b) 4 varijante; (c) 2 varijante, 503 za 10 017 – 10 046 ms; dva nezavisna roka ubijena | `npm test`, `npm run test:emu` ×3, `provjera.ps1` ×2 |
| Ostali i02 i regresija i01 | PASS (nepromijenjeni) | isto |

### Poznata ograničenja (dopuna FIX LOOP 1)

- **R-01:** 503 i latencija pod jakom kontencijom (30 paralelnih init-a za isti uid) su prihvaćeno ponašanje (i02/P-5); brojevi iz review-a
  su u IMPLEMENTATION_LOG. U ovim izvršavanjima I02-T09 (10 paralelnih) nije dobio 503.
- **R-03 (uz P-9):** van emulatora greška preuzimanja javnih ključeva (`KEY_FETCH_ERROR` → `auth/argument-error`) daje 401 `UNAUTHENTICATED`
  umjesto 503. Neizvodljivo u emulatoru (emulator ne preuzima ključeve), pa nije testirano. Rješava se uz O-2 (demo okruženje), prije Iteracije 9.
- **R-07:** `{}` ili prazno tijelo uz `application/json` → `INVALID_DISPLAY_NAME`; bez JSON Content-Type → `INVALID_REQUEST` (README, IMPLEMENTATION_LOG).

---

## Iteracija 3 — Purchase / EARN

Datum izvršavanja: 2026-10-16 (Windows 11 Pro 10.0.22621, Windows PowerShell 5.1). Grana `iteracija-03`, kod na commit-u `35c35f6`
(koraci 1–8; dokumentacija koraka 9 necommit-ovana u trenutku izvršavanja). `node -v` → `v24.21.0`.
Emulator komande sa JBR-om prvim u PATH-u (kao i01/i02).

### Završno izvršavanje (checkpoint)

Komande su izvršene redom iz jedne PowerShell skripte (van repoa), izlaz svake komande u poseban fajl; `provjera.ps1` dva puta zaredom,
svaki put kao zaseban proces (`Start-Process` + `WaitForExit()`, exit code iz procesa):

```powershell
cd backend; npm ci; npm test; npm run test:emu; npm run test:emu; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE    # dva puta zaredom
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs
```

| Komanda | Rezultat | Exit code | Trajanje |
|---|---|---|---|
| `backend: npm ci` | `added 713 packages, and audited 714 packages in 31s`; `11 vulnerabilities (4 moderate, 7 high)` | 0 | 31 s |
| `backend: npm test` | `ℹ tests 45` `ℹ pass 45` `ℹ fail 0` | 0 | 6 s |
| `backend: npm run test:emu` (1) | `ℹ tests 67` `ℹ pass 67` `ℹ fail 0` | 0 | 233 s |
| `backend: npm run test:emu` (2) | `ℹ tests 67` `ℹ pass 67` `ℹ fail 0` | 0 | 239 s |
| `backend: npm run test:emu` (3) | `ℹ tests 67` `ℹ pass 67` `ℹ fail 0` | 0 | 208 s |
| `firebase\tests: npm ci` | `added 729 packages, and audited 730 packages in 29s`; `16 vulnerabilities (4 moderate, 12 high)` | 0 | 30 s |
| `firebase\tests: npm test` | `ℹ tests 25` `ℹ pass 25` `ℹ fail 0` | 0 | 10 s |
| `.\skripte\provjera.ps1` (1) | `SVE PROVJERE PROŠLE` | 0 | 275 s |
| `.\skripte\provjera.ps1` (2) | `SVE PROVJERE PROŠLE` | 0 | 281 s |
| `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` | — | — |
| `git diff main -- docs/srs` | prazno (0 linija) | — | — |

#### `cd backend; npm test` — I03 testovi (izvod)

```
✔ I03-T03 (a) earnedPoints = floor(volumeMl / 1000), uvijek integer
✔ I03-T21 oblik riječi „bod” za 0 … 200 po pravilu 5.7
✔ I03-T21 tekst notifikacije: tačni title i body, bez internih podataka
✔ I03-T15 (a) neispravna POS_API_KLJUCEVI → GreskaKonfiguracije koja imenuje varijablu, bez vrijednosti
✔ I03-T15 (a) ispravna POS_API_KLJUCEVI → posStanice sa stationId i SHA-256 otiskom, bez sirovog ključa
✔ I03-T15 (b) start bez POS_API_KLJUCEVI → izlaz ≠ 0, stderr imenuje POS_API_KLJUCEVI, bez vrijednosti i stack-a, port ne sluša
✔ I03-T15 (b) start placeholder iz .env.example → izlaz ≠ 0, stderr imenuje POS_API_KLJUCEVI, bez vrijednosti i stack-a, port ne sluša
✔ I03-T15 (b) start ključ kojem fali jedan znak → izlaz ≠ 0, stderr imenuje POS_API_KLJUCEVI, bez vrijednosti i stack-a, port ne sluša
✔ I03-T01 (a) broj poređenja = broj stanica za pogodak prve, pogodak posljednje, promašaj, prazan i nedostajući ključ
✔ I03-T07 (a) ispravan RFC 3339 sa zonom → milisekunde tog trenutka
✔ I03-T07 (a) neispravan format, nepostojeći datum ili van opsega Timestamp-a → null
ℹ tests 45
ℹ pass 45
ℹ fail 0
```

I01-T06 (5 testova, prošireni ulazom), I02-T13 (2 unit + 2 spawn) i ostali i01/i02 unit testovi: svi ✔.

#### `cd backend; npm run test:emu` — izvršavanje 1, I03 testovi (izvod)

```
✔ API-T02 42 730 ml → 42 boda; purchase, EARN, balance i notifikacija tačno po §8.3, §11, §9.2
✔ API-T03 ponovljeni isti (stationId, posTransactionId) sa istim payload-om → 200 i tijelo prve operacije, ništa novo
✔ API-T04 isti purchase ID sa drugim uid, volumeMl, amountMinor ili currency → 409, ništa izmijenjeno; nevalidan ulaz odbijen
✔ I03-T02 server-controlled ili nepoznata polja, tijelo koje nije objekat, loyaltyUid nije string → 422 INVALID_REQUEST bez baze
✔ I03-T03 (b) bodovanje kroz API: 900, 999, 1000, 10 000, 10 990, 200 000 ml; 900 ml pravi sva četiri zapisa (O-4)
✔ I03-T04 volumeMl: 1 i 200000 prolaze, 1000.0 i 1e3 su 1000; van opsega, decimalno, string, null, nedostaje → INVALID_VOLUME
✔ I03-T05 amountMinor: 0, 1000000 i -0 prolaze (-0 sačuvan kao 0); van opsega, decimalno, string, null, nedostaje → INVALID_AMOUNT
✔ I03-T06 currency: "EUR" prolazi; "eur", "BAM", "", " EUR", broj, null, nedostaje → UNSUPPORTED_CURRENCY
✔ I03-T07 (b) occurredAt: sada, prošlost, +4:30 i offset prolaze kao Timestamp; +5:01 i neispravno → INVALID_OCCURRED_AT
✔ I03-T08 posTransactionId: 1 i 64 znaka, ".", "a.b-c_D9" prolaze; 65, prazan, "/", razmak, ne-ASCII, prelom, broj → INVALID_TRANSACTION_ID
✔ I03-T09 loyaltyUid bez ACTIVE naloga → 404 LOYALTY_ACCOUNT_NOT_FOUND, ništa upisano
✔ I03-T09 neispravan format loyaltyUid → 404 bez ikakvog pristupa bazi; uid od 128 znakova prolazi
✔ I03-T14 isti posTransactionId na dvije stanice → dvije kupovine; "a__b" radi ispravno
✔ I03-T18 (O-3) retry sa drugim occurredAt → prvo tijelo, sačuvani occurredAt nepromijenjen; neispravan ulaz na retry-ju → kod polja (i03/P-6)
✔ I03-T19 (O-12) nalog u DELETION_IN_PROGRESS: retry → prvo tijelo; drugi volumeMl → 409; nova kupovina → 404
✔ I03-T10 (a), (b) failure injection na svakom od četiri upisa i prije commit-a → 500 bez stack-a, nijedan novi zapis
✔ I03-T10 (c) zastarjelo čitanje purchase-a poslije uspješne kupovine → 500/503, i dalje jedan EARN i jedna notifikacija
ℹ (c) sakriven purchases/SIM01__X: HTTP 500 INTERNAL_ERROR
✔ I03-T10 (c2) sakriven postojeći purchase bez ledger eventa i notifikacije → 500, purchase nepromijenjen, ništa upisano
ℹ (c2) HTTP 500 INTERNAL_ERROR
✔ I03-T10 (d) purchase pod istim ID-em sa drugim stationId (O-13) → 500, ništa promijenjeno
✔ I03-T10 (e) postoji notifikacija ili ledger event za purchase koji ne postoji → 500, ništa upisano
✔ I03-T10 (f) neispravan loyaltyAccounts (negativan ili ne-integer balans) → 500, ništa upisano (i03/P-15)
✔ I03-T11 10 paralelnih identičnih zahtjeva → 1 purchase, 1 EARN, 1 notifikacija, bez 500, najviše jedan 201 (3 ponavljanja)
ℹ ponavljanje 1: statusi 200,200,201,200,200,200,200,200,200,200
ℹ ponavljanje 2: statusi 200,201,200,503,200,200,200,200,200,503
ℹ ponavljanje 3: statusi 200,201,200,200,200,200,200,200,200,200
✔ I03-T12 10 paralelnih različitih kupovina istog korisnika → tačan zbir i konzistentan niz availableAfter
ℹ statusi: 201,201,201,201,201,201,201,200,201,201; broj 503: 2
✔ I03-T13 kasni commit poslije 503 → POS retry vraća prvi rezultat, tačno jedan EARN
ℹ prvi zahtjev: HTTP 503 za 10010 ms
✔ I03-T17 (a) log (svi kanali) i odgovori ne sadrže POS ključ ni za jedan ishod; nijedan odgovor nema balance
✔ I03-T17 (b) produkcioni start (src/pokreni.js): stdout i stderr procesa ne sadrže POS ključeve
✔ I03-T01 (b) ključ nedostaje, pogrešan, prazan ili van zaglavlja X-POS-API-Key → 401 UNAUTHENTICATED_POS bez baze
✔ I03-T01 (b) stationId se izvodi iz ključa; naziv zaglavlja case-insensitive; okolni razmaci uklanja HTTP parser (i03/P-12)
✔ I03-T22 granice POS rute: GET i nepoznata /pos putanja → 404; neispravan JSON → 422 bez baze; bez posStanice → 500
✔ I03-T16 (a), (b) istekao rok → GreskaApi SERVICE_UNAVAILABLE, runTransaction se ne poziva, nijedan dokument
✔ I03-T16 (c) HTTP oblik: istekao rok → 503 tačno tijelo, bez transakcije; kontrola sa rokom u budućnosti → uspjeh
ℹ tests 67
ℹ pass 67
ℹ fail 0
```

Svi i01/i02 emulator testovi (API-T01, I02-T01 … I02-T16, I01-T07 … I01-T09) ✔ u sva tri izvršavanja; I02-T11 (b) i (c) 503 za ~10 s.

#### I03-T11, I03-T12, I03-T13 — tri uzastopna završna izvršavanja `npm run test:emu`

| Izvršavanje | I03-T11 statusi (3 ponavljanja) | I03-T12 statusi; broj 503 | I03-T13 prvi zahtjev |
|---|---|---|---|
| 1 | `200,200,201,…` / `200,201,200,503,200,200,200,200,200,503` / `200,201,…` | `201,201,201,201,201,201,201,200,201,201`; 2 | 503 za 10 010 ms |
| 2 | `…,201` / `…,201,…` / `…,201,…` (bez 503) | `201,201,201,201,200,200,200,201,201,200`; 12 | 503 za 10 012 ms |
| 3 | `…,201,…` / `…,201` / `…,201,…` (bez 503) | `201,201,201,201,201,201,201,201,201,201`; 0 | 503 za 10 017 ms |

Nijedan 500 ni u jednom izvršavanju. Ranija izvršavanja kompletnog `npm run test:emu` tokom koraka 5 (tri zaredom, prije izmjene OD-5):
`ℹ tests 63` `ℹ pass 63` `ℹ fail 0` ×3 (I03-T12: 0, 6 i 0 × 503). `maxAttempts` je ostao 5.

#### `cd firebase\tests; npm test` (Firestore emulator, `demo-fuelpoints`)

```
✔ RULE-T01 … RULE-T05 users/{uid}             (5 testova ✔)
✔ RULE-T06, RULE-T07 loyaltyAccounts/{uid}    (3 testa ✔)
✔ I02-T15 ostale granice users i loyaltyAccounts (5 testova ✔)
  ✔ RULE-T08 owner query (uid == auth.uid, limit 20) i owner get → ALLOW
  ✔ RULE-T08 direct purchase write (create, update, delete; i vlasnika) → DENY
  ✔ RULE-T10 owner read i update readAt null → request.time → ALLOW
  ✔ RULE-T10 izmjena title ili body → DENY
  ✔ RULE-T11 bilo kakav read/write nad loyaltyLedger (vlasnik, drugi, neautentifikovan) → DENY
  ✔ I03-T20 purchases: upit bez limit-a, limit 21, bez uid uslova, tuđi uid, tuđi dokument, neautentifikovan → DENY
  ✔ I03-T20 notifications: list limit 50 → ALLOW; limit 51, bez limit-a, bez uid uslova → DENY
  ✔ I03-T20 notifications update: drugi readAt, klijentsko vrijeme, readAt + title, uid, type, null → null → DENY
  ✔ I03-T20 notifications: create i delete vlasnika, pristup drugog korisnika i neautentifikovanog → DENY
  ✔ RULE-T12 rewardRequests / redemptionRequests / nepoznata kolekcija → DENY (3 testa ✔)
ℹ tests 25
ℹ pass 25
ℹ fail 0
```

I01-T10 više ne postoji (zamijenjen RULE-T11).

#### `.\skripte\provjera.ps1` — oba izvršavanja (izvod stdout-a, isto u oba)

```
==> Alati (Node 24, Java 21+, JDK za Gradle)
==> SRS integritet (SHA-256 normativnog .docx-a)
==> NFR-07 (bez tajni u repozitorijumu)
==> Bez TODO/FIXME
==> Portovi emulatora 8080 i 9099 su slobodni
==> Backend: npm ci, npm test, npm run test:emu
ℹ tests 45 / ℹ fail 0;  ℹ tests 67 / ℹ fail 0
==> Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1, 401 UNAUTHENTICATED na /account/init bez token-a, 401 UNAUTHENTICATED_POS na /pos/purchases bez ključa)
Smoke: 404 NOT_FOUND, correlationId 252573cd-c654-4b31-b050-0057b2ad53bb
Smoke: 401 UNAUTHENTICATED, correlationId 98a35700-3a92-4098-ab39-5b5580690721
Smoke: 401 UNAUTHENTICATED_POS, correlationId 63987679-30c2-4c8c-870a-20aa899e73d8
==> Firestore rules: npm ci, npm test
ℹ tests 25 / ℹ fail 0
==> Android: assembleDebug, testDebugUnitTest
BUILD SUCCESSFUL in 1s
BUILD SUCCESSFUL in 1s
SVE PROVJERE PROŠLE
```

(2. izvršavanje: correlationId `250e0e6f-…`, `86b47409-…`, `e58facc9-…`.) Na stanju koraka 2 (K-2, prije commit-a `1f55369`) `provjera.ps1`
je takođe vratio `SVE PROVJERE PROŠLE` / `EXIT=0` (sa dva smoke-a koja su tada postojala); na stanju koraka 7 (prije commit-a `9adad02`) dva
izvršavanja → `EXIT=0` (280 s i 281 s).

### Inspekcije

| Komanda | Izlaz |
|---|---|
| `git grep -n -E "/rewards/\|/vouchers\|reconcile\|redeem\|REWARD_RESERVE\|vouchers\|rewardRequests\|redemptionRequests" -- backend/src` | samo `backend/src/podaci/kolekcije.js:8,10,11` (konstante) |
| `git grep -n -i -E "process\.env\.(NODE_ENV\|TEST)\|inject\|ubriz\|mock" -- backend/src` | prazno (exit 1) |
| `git diff main -- '*package*.json'` | prazno |
| `git grep -n -E "[A-Za-z0-9_-]{43}" -- .env.example README.md` | prazno (exit 1) |
| `git grep -n -E "TODO\|FIXME" -- backend firebase pos-simulator skripte android-app/app/src README.md ':!skripte/provjera.ps1'` | prazno (exit 1) |
| `git log main..HEAD --format=%B \| grep -i -E "Co-Authored-By\|Generated with\|claude"` | prazno (exit 1) |
| `git grep -n -E "tx\.(create\|set\|update\|delete)" -- backend/src/servisi/evidencijaKupovine.js` | `tx.create` (purchase), `tx.update` (loyaltyAccounts), `tx.create` (ledger), `tx.create` (notifikacija); nijedan `set`/`delete` |
| `git grep -n "timingSafeEqual\|createHash" -- backend/src` | `posKljucevi.js` (SHA-256 ključa), `posAutentikacija.js:21` (SHA-256 kandidata), `:24` (`crypto.timingSafeEqual(otisak, stanica.otisakKljuca)`) |
| `python -I uporedi_rules.py docs\srs\FuelPoints_SRS_3_1.docx firebase\firestore.rules` (privremena skripta van repoa: §31 iz `word/document.xml`, `w:br`/`w:p` → `\n`, uklonjeni blokovi `rewardDefinitions`, `vouchers`, `rewardRequests`, `redemptionRequests` sa praznim redom ispred) | `JEDNAKO_DOCX` (prije izmjene rules: `RAZLIKA` — nedostaju tačno tri bloka) |
| `diff firebase/firestore.rules <plan 11.3, linije 546–617>` | prazno → `IDENTICNO_PLANU` |

### Test-first (crveno prije koda)

| Korak | Komanda | Rezultat prije implementacije |
|---|---|---|
| 1 | `firebase\tests: npm test` nad starim rules | `ℹ tests 25` `ℹ pass 21` `ℹ fail 4`: `✖ RULE-T08 owner query …` (Očekivan ALLOW … list purchases where uid == A limit 20), `✖ RULE-T10 owner read …`, `✖ I03-T20 notifications: list limit 50 …`, `✖ I03-T20 notifications update …` (svi ALLOW slučajevi) |
| 2 | `backend: npm test` | `ERR_MODULE_NOT_FOUND … src\konfiguracija\posKljucevi.js` (`✖ test\jedinicni\konfiguracija.test.js`); `✖ I03-T15 (b)` ×3 (`proces nije završio u roku od 10 s`); `ℹ tests 31` `ℹ pass 27` `ℹ fail 4` |
| 3 | `backend: npm test` | `ERR_MODULE_NOT_FOUND … bodovanje.js`, `… vrijemeKupovine.js`; `ℹ tests 41` `ℹ pass 39` `ℹ fail 2` |
| 4–5 | `backend: npm test` | `ERR_MODULE_NOT_FOUND … posAutentikacija.js`; `ℹ tests 45` `ℹ pass 44` `ℹ fail 1` |
| 4–5 | `npx firebase emulators:exec … "node --test --test-concurrency=1 test/emulator/posAutentikacija.test.js test/emulator/kupovina.test.js test/emulator/kupovinaAtomicnost.test.js"` | `ℹ tests 27` `ℹ pass 0` `ℹ fail 27` (ruta ne postoji) |
| 6 | — | kod je već postojao (plan, korak 6); crvenilo dokazano mutacijama M24, MR02b, M25 (ispod) |

Prvo izvršavanje novih emulator testova poslije koda: `ℹ tests 27` `ℹ pass 26` `ℹ fail 1` — `✖ I03-T22 … bez posStanice: status`
(dobijen `LOYALTY_ACCOUNT_NOT_FOUND`): greška testnog pomoćnika (podrazumijevani parametar je `undefined` zamijenio konfiguracijom stanica);
ispravljen je test, produkcioni kod nije mijenjan. Zatim `ℹ pass 27`.

### Kontrolne mutacije (plan 8.4, K-1, MR02b)

Emulatori su jednom pokrenuti (`npx firebase emulators:start --config ../firebase.json --project demo-fuelpoints --only firestore,auth`);
svaka mutacija je primijenjena privremenom skriptom (tačna zamjena teksta, provjera da se tekst javlja tačno jednom), pokrenut je ciljani fajl
(`node --test --test-concurrency=1 <fajl>` sa `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`,
`GCLOUD_PROJECT=demo-fuelpoints`), pa vraćeno `git restore backend/src firebase/firestore.rules` (`git status --short` za te putanje prazan
poslije svake). Exit code je exit code `node --test`.

| Mutacija | Ciljani test (fajl) | Exit | Oboreni testovi | Ishod |
|---|---|---|---|---|
| M01 `stationId` = prva stanica iz mape | `emulator/posAutentikacija.test.js` | 1 | `I03-T01 (b) stationId se izvodi iz ključa …`; pass 2 fail 1 | UBIJENA |
| M02 `break` na pogodak | `jedinicni/posAutentikacija.test.js` | 1 | `I03-T01 (a)`; pass 0 fail 1 | UBIJENA |
| M03 `kandidat === stanica.kljuc`, konfiguracija čuva ključ | `jedinicni/posAutentikacija.test.js`, `jedinicni/konfiguracija.test.js` | 1 | `I03-T01 (a)`; `I03-T15 (a) ispravna … bez sirovog ključa` | UBIJENA |
| M04 ključ i iz `req.query['X-POS-API-Key']` | `emulator/posAutentikacija.test.js` | 1 | `I03-T01 (b) ključ nedostaje … van zaglavlja` | UBIJENA |
| M05 bez provjere nepoznatih ključeva | `emulator/kupovina.test.js` | 1 | `I03-T02`; pass 14 fail 1 | UBIJENA |
| M06 pristup bazi (transakcija sa `tx.get`) prije validacije | `emulator/kupovina.test.js` | 1 | `I03-T02`, `I03-T04` … `I03-T09` (format), `I03-T18`; pass 7 fail 8 | UBIJENA |
| M07 `Math.round` | `jedinicni/bodovanje.test.js`, `emulator/kupovina.test.js` | 1 | `I03-T03 (a)`, `I03-T03 (b)`, `API-T02`, `API-T03`, `I03-T14` | UBIJENA |
| M08 bez gornje granice `volumeMl` | `emulator/kupovina.test.js` | 1 | `I03-T04` | UBIJENA |
| M09 bez normalizacije `-0` | `emulator/kupovina.test.js` | 1 | `I03-T05` | UBIJENA |
| M10 `currency.toUpperCase() === 'EUR'` | `emulator/kupovina.test.js` | 1 | `I03-T06` | UBIJENA |
| M11 `Date.parse` umjesto vlastitog parsera | `jedinicni/vrijemeKupovine.test.js`, `emulator/kupovina.test.js` | 1 | `I03-T07 (a) neispravan …`, `I03-T07 (b)` | UBIJENA |
| M12 bez granice +5 min | `emulator/kupovina.test.js` | 1 | `I03-T07 (b)`, `I03-T18` | UBIJENA |
| M13 regex `posTransactionId` bez `$` | `emulator/kupovina.test.js` | 1 | `I03-T08` | UBIJENA |
| M14 bez provjere formata `loyaltyUid` | `emulator/kupovina.test.js` | 1 | `I03-T09 neispravan format …`, `I03-T18` | UBIJENA |
| M15 provjera naloga bez `loyaltyAccounts` | `emulator/kupovina.test.js` | 1 | `I03-T09 loyaltyUid bez ACTIVE naloga` | UBIJENA |
| M16 notifikacija van transakcije (poslije commit-a) | `emulator/kupovinaAtomicnost.test.js` | 1 | `I03-T10 (a), (b)`, `I03-T13` (2. izvršavanje i `I03-T12`) | UBIJENA |
| M17 `tx.create` purchase → `tx.set` | `emulator/kupovinaAtomicnost.test.js` | 1 | `I03-T10 (c2)`, `I03-T10 (a), (b)` (zabilježeni metod) | UBIJENA (K-1: (c2) obara) |
| M18 bez provjere postojećeg ledger/notifikacije | `emulator/kupovinaAtomicnost.test.js` | 1 | `I03-T10 (e)` (asercija OD-6) | UBIJENA |
| M19 bez odbrane O-13 | `emulator/kupovinaAtomicnost.test.js` | 1 | `I03-T10 (d)` (oba izvršavanja); 1. izvršavanje i `I03-T12` (`102 !== 60`, vidi nalaze) | UBIJENA |
| M20 `FieldValue.increment` + `availableAfter` iz čitanja van transakcije | `emulator/kupovinaAtomicnost.test.js` | 1 | `I03-T12` (oba izvršavanja) | UBIJENA |
| M21 poređenje bez `currency` | `emulator/kupovina.test.js` | 1 | `API-T04` | UBIJENA |
| M22 `occurredAt` u poređenju | `emulator/kupovina.test.js` | 1 | `I03-T18` | UBIJENA |
| M23 provjera naloga prije čitanja purchase-a | `emulator/kupovina.test.js` | 1 | `I03-T19` | UBIJENA |
| M24 bez provjere roka u `evidentirajKupovinu` | `emulator/rokPrijeTransakcije.test.js` | 1 | `I03-T16 (a), (b)`, `I03-T16 (c)` | UBIJENA |
| MR02b bez provjere roka u `inicijalizujNalog` | `emulator/rokPrijeTransakcije.test.js` | 1 | `I03-T16 (a), (b)`, `I03-T16 (c)` | UBIJENA |
| M25 `zabiljeziGresku` dobija `zaglavlja: req.headers` (i `dnevnik.js` ih upisuje) | `emulator/logBezPosKljuca.test.js` | 1 | `I03-T17 (a)`, `I03-T17 (b)` | UBIJENA |
| M26a bez provjere „manje od 16 različitih” | `jedinicni/konfiguracija.test.js` | 1 | `I03-T15 (a) neispravna …` | UBIJENA |
| M26b bez provjere ponovljenog ključa | `jedinicni/konfiguracija.test.js` | 1 | `I03-T15 (a) neispravna …` | UBIJENA |
| M26c `stationId` regex sa `_` (bez O-13) | `jedinicni/konfiguracija.test.js` | 1 | `I03-T15 (a) neispravna …` | UBIJENA |
| M27 ledger `availableAfter = dostupno` | `emulator/kupovina.test.js` | 1 | `API-T02`, `I03-T03 (b)` | UBIJENA |
| M28 rules `/purchases` `allow list: if ownResource();` | `firebase/tests/kupovineObavjestenjaLedger.test.js` | 1 | `I03-T20 purchases …` | UBIJENA |
| M29 rules `/notifications` bez `resource.data.readAt == null` | isti | 1 | `I03-T20 notifications update …` | UBIJENA |
| M30 rules `/loyaltyLedger` `allow read: if signedIn();` | isti | 1 | `RULE-T11` | UBIJENA |
| M31 rules `changedOnly(['readAt', 'title'])` | isti | 1 | prvo izvršavanje: samo `I03-T20 notifications update …`; poslije ojačanja RULE-T10 (OD-4): `RULE-T10 izmjena title ili body`, `I03-T20 notifications update …` | UBIJENA (RULE-T10 tek poslije OD-4) |

Poslije izmjena OD-4/OD-5 (commit `35c35f6`) ponovo su izvršene M16 … M20 i M31 nad novim testovima — sve UBIJENE (tabela navodi i ta izvršavanja);
`kupovineObavjestenjaLedger.test.js` i `kupovinaAtomicnost.test.js` bez mutacije: `ℹ pass 9` `ℹ fail 0` (oba).

### Nalazi tokom izvršavanja

- **Kasni commit iz I03-T11 je „procurio” u I03-T12 (OD-5).** Pri mutaciji M19 (dugo pokrenut emulator) I03-T12 je pao:
  `AssertionError … 102 !== 60` (`kupovinaAtomicnost.test.js:315`); u istom izvršavanju I03-T11 ponavljanje 3 je imalo status `503`.
  Drugo izvršavanje M19 je oborilo samo I03-T10 (d); četiri izvršavanja bez mutacije: `ℹ pass 9` `ℹ fail 0`. Tumačenje: transakcija zahtjeva
  koji je dobio 503 (istek roka) se commit-ovala poslije `ocistiEmulatore` sljedećeg testa (+42 boda novom nalogu) — prihvaćeno ponašanje
  proizvoda (brief, I03-T13), ali nedostatak izolacije testa. Ispravka: I03-T11/T12 čekaju kraj svih transakcija (`omotacBaze.sveTransakcijeZavrsene`)
  prije asercija. Poslije ispravke I03-T11 je u završnom izvršavanju 1 imao dva 503 i prošao (stanje provjereno poslije kasnih commit-a).
- **R18 (plan 7):** `ALREADY_EXISTS` → 500 pod kontencijom nije uočen: I03-T11 nijednom nije dao 500 (≥ 9 izvršavanja × 3 ponavljanja).
  `ALREADY_EXISTS` se pojavljuje samo gdje je namjerno izazvan (I03-T10 (c2): `500 INTERNAL_ERROR`).
- **I03-T10 (c):** sakriven postojeći purchase uvijek je dao 500 (provjera nekonzistentnog stanja), nikad 503.
- **Supertest i dupla zaglavlja:** dva poziva `.set()` sa istim nazivom (različita veličina slova) šalju samo posljednje zaglavlje; dupla zaglavlja
  se zato šalju nizom (`.set('X-POS-API-Key', [a, b])`), što Node spaja u `"a, b"` → 401 (i03/P-12).
- `MetadataLookupWarning` i `npm warn install-scripts` (`re2`) se pojavljuju kao u i01/i02; ne utiču na rezultat.

### Testovi koji nisu izvršeni

- Mjerenje vremena poređenja POS ključa (timing): nije izvedeno (nestabilno na dijeljenoj mašini); konstantno vrijeme je dokazano brojem poziva
  `timingSafeEqual` (I03-T01 (a), M02/M03) i inspekcijom.
- Ponašanje nad produkcionim Firestore-om i produkcionim Rules engine-om: testovi rade isključivo nad emulatorom (`demo-fuelpoints`).

### Rezultat po ID-u (Iteracija 3)

| ID | Rezultat | Izvor |
|---|---|---|
| API-T02 | PASS | `npm run test:emu` ×3 |
| API-T03 | PASS | `npm run test:emu` ×3 |
| API-T04 | PASS ((a)–(d) 409; validacija 422) | `npm run test:emu` ×3 |
| RULE-T08 | PASS (2 testa) | `firebase\tests: npm test` |
| RULE-T10 | PASS (2 testa; ojačan, OD-4) | `firebase\tests: npm test` |
| RULE-T11 | PASS | `firebase\tests: npm test` |
| I03-T01 | PASS: (a) unit; (b) 2 emulator testa | `npm test`, `npm run test:emu` |
| I03-T02 | PASS | `npm run test:emu` |
| I03-T03 | PASS: (a) unit; (b) emulator | `npm test`, `npm run test:emu` |
| I03-T04 … I03-T06 | PASS | `npm run test:emu` |
| I03-T07 | PASS: (a) 2 unit testa; (b) emulator | `npm test`, `npm run test:emu` |
| I03-T08, I03-T09 | PASS (I03-T09: 2 testa) | `npm run test:emu` |
| I03-T10 | PASS: (a)–(f), uklj. (c2) (K-1) | `npm run test:emu` ×3 |
| I03-T11 | PASS u 3/3 završna izvršavanja (+3/3 u koraku 5); nijedan 500 | `npm run test:emu` |
| I03-T12 | PASS u 3/3 završna izvršavanja (+3/3 u koraku 5) | `npm run test:emu` |
| I03-T13 | PASS (503 za ~10,0 s; retry 200, isto tijelo) | `npm run test:emu` |
| I03-T14 | PASS | `npm run test:emu` |
| I03-T15 | PASS: (a) 2 unit testa; (b) 3 spawn testa | `npm test` |
| I03-T16 | PASS (init i kupovina; 2 testa) | `npm run test:emu` |
| I03-T17 | PASS: (a) in-process, (b) spawn | `npm run test:emu` |
| I03-T18, I03-T19 | PASS | `npm run test:emu` |
| I03-T20 | PASS (4 testa) | `firebase\tests: npm test` |
| I03-T21 | PASS (2 testa) | `npm test` |
| I03-T22 | PASS (+ smoke 401 `UNAUTHENTICATED_POS` u `provjera.ps1` ×2) | `npm run test:emu`, `provjera.ps1` |
| Regresija i01/i02 | PASS: I01-T01 … I01-T09, I01-T11 (I01-T06 proširen ulazom), API-T01, I02-T01 … I02-T16, RULE-T01 … RULE-T07, I02-T15, RULE-T12 (preliminarno), Android `assembleDebug` i `testDebugUnitTest`; I01-T10 uklonjen (zamijenjen RULE-T11) | `npm test`, `npm run test:emu`, `firebase\tests: npm test`, `provjera.ps1` |
| Kontrolne mutacije | 35/35 UBIJENE (M01 … M31 sa M26a/b/c, MR02b, M17 nad (c2)) | gore |
| `provjera.ps1` | exit 0, dva puta zaredom | — |

### Poznata ograničenja

- Vidi IMPLEMENTATION_LOG, Iteracija 3, „Poznata ograničenja” (i03/P-12, i03/P-13, JSON `1e3`, strožiji RFC 3339, emulator-only ponašanje,
  I02-T09 i kasni commit).


---

## Iteracija 3 — FIX LOOP 1 (nalazi R-01 … R-05 iz `docs/iteracije/i03_review.md`, commit f3659f6)

Datum izvršavanja: 2026-10-16 (Windows 11 Pro 10.0.22621, Windows PowerShell 5.1). Uloga: BUILDER. Alati nepromijenjeni
(`node` `v24.21.0`, firebase-tools `15.32.1`). Pojedinačni emulator testovi su pokretani komandom
`npx firebase emulators:exec --config ../firebase.json --project demo-fuelpoints --only firestore,auth "node --test --test-concurrency=1 <fajl>"`
iz `backend` (JBR prvi u PATH-u). Mutacije su bile privremene (primijenjene u radnom stablu i vraćene; za R-01 … R-03 sa
`git restore -- backend/src`, za R-04 vraćanjem ispravke jer ona tada još nije bila commit-ovana; `git status --porcelain` poslije svake bez
neželjenih izmjena u `backend/src`) i nisu commit-ovane.

### R-01 — stationId se ne uzima iz query-ja ni zaglavlja (samo test)

Reprodukcija (test još nije dodat), `posAutentikacija.test.js` + `kupovina.test.js`:

| Mutacija u `backend/src/rute/kupovine.js` | Rezultat |
|---|---|
| M02 `{ stationId: req.query.stationId ?? res.locals.stationId, ...ulaz }` | `ℹ tests 18` `ℹ pass 18` `ℹ fail 0`, `EXIT=0` — PREŽIVJELA |
| M02b `{ stationId: req.get('x-station-id') ?? res.locals.stationId, ...ulaz }` | `ℹ tests 18` `ℹ pass 18` `ℹ fail 0`, `EXIT=0` — PREŽIVJELA |

Novi test `I03-T01 (b) stationId u query-ju ili zaglavljima X-Station-Id / stationId se ignoriše → stanica samo iz ključa`
(ključ SIM01; `?stationId=SIM02`, `X-Station-Id: SIM02`, `stationId: SIM02`; `posTransactionId` Q1/Q2/Q3). Bez mutacije:

```
✔ I03-T01 (b) stationId u query-ju ili zaglavljima X-Station-Id / stationId se ignoriše → stanica samo iz ključa (283.4375ms)
ℹ tests 4  ℹ pass 4  ℹ fail 0      EXIT=0
```

Sa mutacijom:

```
M02:  ✖ I03-T01 (b) stationId u query-ju ili zaglavljima X-Station-Id / stationId se ignoriše → stanica samo iz ključa (82.8891ms)
      AssertionError [ERR_ASSERTION]: ?stationId=SIM02: stationId u odgovoru
      ℹ tests 4  ℹ pass 3  ℹ fail 1      EXIT=1      → UBIJENA
M02b: ✖ I03-T01 (b) stationId u query-ju ili zaglavljima X-Station-Id / stationId se ignoriše → stanica samo iz ključa (171.5619ms)
      AssertionError [ERR_ASSERTION]: X-Station-Id: SIM02: stationId u odgovoru
      ℹ tests 4  ℹ pass 3  ℹ fail 1      EXIT=1      → UBIJENA
```

Regresija prije commit-a `45f6884`: `npm test` `ℹ tests 45` `ℹ pass 45` `ℹ fail 0`; `npm run test:emu` `ℹ tests 68` `ℹ pass 68` `ℹ fail 0`.

### R-02 — uključiva granica +5 min (samo test)

Reprodukcija: M06 (`occurredAtMs > sadaMs + …` → `>=` u `backend/src/validacija/tijeloKupovine.js`) → `npm test`:
`ℹ tests 45` `ℹ pass 45` `ℹ fail 0`, `EXIT=0` — PREŽIVJELA.

Novi unit test (`backend/test/jedinicni/vrijemeKupovine.test.js`), `sadaMs = Date.UTC(2026, 9, 16, 10, 0, 0, 0)`:

```
✔ I03-T07 (c) occurredAt tačno +5 min od vremena Backend-a prolazi, +5 min i 1 ms → INVALID_OCCURRED_AT (granica uključiva) (1.2317ms)
ℹ tests 46  ℹ pass 46  ℹ fail 0      EXIT=0
```

Sa M06:

```
✖ I03-T07 (c) occurredAt tačno +5 min od vremena Backend-a prolazi, +5 min i 1 ms → INVALID_OCCURRED_AT (granica uključiva) (0.9501ms)
ℹ tests 46  ℹ pass 45  ℹ fail 1      EXIT=1      → UBIJENA
```

Regresija prije commit-a `4bd81da`: `npm test` 46/46 (izmijenjen samo unit test; emulator suita izvršena uz R-03).

### R-03 — rezervisani oblici `loyaltyUid` (samo test)

Reprodukcija, `kupovina.test.js`:

| Mutacija u `jeIspravanFormatUid` | Rezultat |
|---|---|
| M25 `/^__.*__$/s` → `/^__.+__$/s` | `✔ I03-T09 neispravan format …`, `ℹ tests 15` `ℹ pass 15` `ℹ fail 0`, `EXIT=0` — PREŽIVJELA |
| M25s `/^__.*__$/s` → `/^__.*__$/` (bez zastavice `s`) | `ℹ tests 15` `ℹ pass 15` `ℹ fail 0`, `EXIT=0` — PREŽIVJELA |

I03-T09 (format, 0 pristupa bazi) dopunjen sa `"____"` i `"__\n__"`. Bez mutacije: `✔ I03-T09 neispravan format loyaltyUid …`, 15/15, `EXIT=0`.
Sa mutacijom:

```
M25:  ✖ I03-T09 neispravan format loyaltyUid → 404 bez ikakvog pristupa bazi; uid od 128 znakova prolazi (86.1698ms)
      AssertionError [ERR_ASSERTION]: ____: pristup bazi
      ℹ tests 15  ℹ pass 14  ℹ fail 1      EXIT=1      → UBIJENA
M25s: ✖ I03-T09 neispravan format loyaltyUid → 404 bez ikakvog pristupa bazi; uid od 128 znakova prolazi (7527.1322ms)
      AssertionError [ERR_ASSERTION]: __\n__: status (tijelo {"error":{"code":"INTERNAL_ERROR",…}})
      ℹ tests 15  ℹ pass 14  ℹ fail 1      EXIT=1      → UBIJENA
```

(Sa M25s vrijednost `"__\n__"` stiže do Firestore-a i završava sa 500; bez mutacije → 404 bez pristupa bazi.)
Regresija prije commit-a `235323f`: `npm test` 46/46; `npm run test:emu` `ℹ tests 68` `ℹ pass 68` `ℹ fail 0`.

### R-04 — log greške bilježi šablon rute, ne sirovu putanju

Stvaran oblik šablona je utvrđen probom nad Express 5.2.1 (skripta van repoa): u centralnom rukovaocu greškama je za pogođenu rutu
`req.route.path` = `/pos/purchases` (relativno na ruter montiran na `/api/v1`), a `req.baseUrl` = `""`; za `GET /api/v1/pos/purchases`,
`POST /api/v1/pos/purchases/<K>`, `POST /api/v1/pos/<K>` i grešku JSON parsera `req.route` ne postoji. Log zato bilježi `req.route.path`,
a bez pogođene rute `(nepoznata ruta)`.

I03-T17 (a) (in-process) i (b) (spawn `src/pokreni.js`) su dopunjeni: `POST /api/v1/pos/purchases/<K1>` sa ispravnim zaglavljem i
`POST /api/v1/pos/<K2>` bez zaglavlja → 404 `NOT_FOUND`, log (svi kanali) bez K1/K2. U (a) zapis loga za oba 404 ima `code` `NOT_FOUND` i
`putanja` `(nepoznata ruta)`. U (a) i (b) zapis loga za 401 na `/pos/purchases` ima `putanja` `/pos/purchases`. Statusi u (b): `[201, 401, 422, 404, 404]`.

Crveno (test dodat, kod kao u `235323f`, `putanja: req.path`):

```
✖ I03-T17 (a) log (svi kanali) i odgovori ne sadrže POS ključ ni za jedan ishod; nijedan odgovor nema balance (4569.0182ms)
✖ I03-T17 (b) produkcioni start (src/pokreni.js): stdout i stderr procesa ne sadrže POS ključeve (3788.4565ms)
  AssertionError [ERR_ASSERTION]: log sadrži POS ključ
  AssertionError [ERR_ASSERTION]: log procesa sadrži POS ključ
ℹ tests 2  ℹ pass 0  ℹ fail 2      EXIT=1
```

Zeleno poslije ispravke (`backend/src/greske/obradaGresaka.js`, funkcija `putanjaZaLog`):

```
✔ I03-T17 (a) log (svi kanali) i odgovori ne sadrže POS ključ ni za jedan ishod; nijedan odgovor nema balance (4160.3983ms)
✔ I03-T17 (b) produkcioni start (src/pokreni.js): stdout i stderr procesa ne sadrže POS ključeve (3807.0132ms)
ℹ tests 2  ℹ pass 2  ℹ fail 0      EXIT=0
```

Mutacija `putanja: req.path` nad ispravljenim kodom: `✖ I03-T17 (a)`, `✖ I03-T17 (b)`, `AssertionError [ERR_ASSERTION]: log sadrži POS ključ`,
`ℹ tests 2` `ℹ pass 0` `ℹ fail 2` → UBIJENA (izlazni kod cjevovoda 255 jer je `Select-Object -First 8` prekinuo izlaz). Ispravka zatim vraćena.
Nijedan postojeći test ne zavisi od sirove putanje u logu. Regresija prije commit-a `5b0cfa0`: `npm test` 46/46; `npm run test:emu` 68/68.

### Mutacioni dokazi (sažetak)

| Mutacija | Ciljani test | Prije FIX LOOP 1 | Poslije |
|---|---|---|---|
| M02 `req.query.stationId ?? res.locals.stationId` | I03-T01 (b) query/zaglavlja | PREŽIVJELA (18/18) | UBIJENA |
| M02b `req.get('x-station-id') ?? res.locals.stationId` | isto | PREŽIVJELA (18/18) | UBIJENA |
| M06 `>` → `>=` | I03-T07 (c) | PREŽIVJELA (45/45) | UBIJENA |
| M25 `^__.*__$` → `^__.+__$` | I03-T09 (format) | PREŽIVJELA (15/15) | UBIJENA |
| M25s bez zastavice `s` | I03-T09 (format) | PREŽIVJELA (15/15) | UBIJENA |
| `putanja: req.path` | I03-T17 (a), (b) | crveno (kod prije ispravke) | UBIJENA |

### Završno izvršavanje (checkpoint FIX LOOP 1)

Kod na commit-u `5b0cfa0` (dokumentacija necommit-ovana u trenutku izvršavanja). `npm test` i `npm run test:emu` ×3 iz jedne PowerShell
komande u pozadini (JBR prvi u PATH-u), izlaz u fajlove; zatim `firebase\tests npm test` i `provjera.ps1` dva puta zaredom, svaki put kao
zaseban proces (`powershell -NoProfile -ExecutionPolicy Bypass -File .\skripte\provjera.ps1`, exit code iz `$LASTEXITCODE`). `npm ci` nije
ponovljen ručno (paketi nepromijenjeni; `provjera.ps1` ga izvršava).

| Komanda | Rezultat | Exit code | Trajanje |
|---|---|---|---|
| `backend: npm test` | `ℹ tests 46` `ℹ pass 46` `ℹ fail 0` | 0 | — |
| `backend: npm run test:emu` (1) | `ℹ tests 68` `ℹ pass 68` `ℹ fail 0` | 0 | 198 s |
| `backend: npm run test:emu` (2) | `ℹ tests 68` `ℹ pass 68` `ℹ fail 0` | 0 | 202 s |
| `backend: npm run test:emu` (3) | `ℹ tests 68` `ℹ pass 68` `ℹ fail 0` | 0 | 194 s |
| `firebase\tests: npm test` (prvi pokušaj, bez JBR-a na PATH-u) | `ℹ tests 25` `ℹ pass 25` `ℹ fail 0` | 0 | 12 s |
| `.\skripte\provjera.ps1` (prvi pokušaj, odmah poslije) ×2 | `Port 8080 ili 9099 je zauzet: zaustavi pokrenute emulatore.` `NEUSPJEH: Portovi emulatora 8080 i 9099 su slobodni` | 1, 1 | 2 s, 1 s |
| `firebase\tests: npm test` (ponovljeno, JBR prvi u PATH-u) | `ℹ tests 25` `ℹ pass 25` `ℹ fail 0` | 0 | 9 s |
| `.\skripte\provjera.ps1` (1) | `SVE PROVJERE PROŠLE` (46/46, 68/68, 25/25, tri smoke-a, Android `BUILD SUCCESSFUL` ×2) | 0 | 282 s |
| `.\skripte\provjera.ps1` (2) | `SVE PROVJERE PROŠLE` (isti brojevi) | 0 | 288 s |
| `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` | — | — |
| `git diff main -- docs/srs` | prazno (0 linija) | — | — |
| `Get-NetTCPConnection -LocalPort 8080,9099,3999 -State Listen` na kraju | 0 (slobodni) | — | — |

Prvi pokušaj `firebase\tests npm test` je pokrenut bez JBR-a na PATH-u: koristio je Oracle `javapath` posrednik (`C:\Program Files\Java\jdk-24`),
pa Firestore emulator (PID 16624, `--project_id demo-fuelpoints`) nije ugašen poslije `emulators:exec` i držao je port 8080 — poznat razlog
zbog kojeg `provjera.ps1` stavlja JDK prvi u PATH. `provjera.ps1` je ispravno odbio start (exit 1). Zaostali proces je zaustavljen
(`Stop-Process -Id 16624`), port provjeren (0), a Rules testovi i oba `provjera.ps1` ponovljeni sa JBR-om prvim u PATH-u (redovi iznad).

Emulator suita ima 68 testova (67 iz i03 + novi I03-T01 (b) query/zaglavlja); unit suita 46 (45 + I03-T07 (c)).
U tri samostalna izvršavanja `test:emu`: I03-T11 svaki put `200×9, 201×1` (9 ponavljanja, nijedan 503); I03-T12 broj 503: 0, 0, 0;
I03-T13 503 za 10 019 / 10 024 / 10 013 ms; I02-T09 svaki put `200×9, 201×1`. U logu `provjera.ps1` zapisi grešaka imaju novi oblik, npr.
`"putanja":"/account/init"`, `"putanja":"/pos/purchases"`, `"putanja":"(nepoznata ruta)"`.

### Rezultat po ID-u (FIX LOOP 1)

| ID | Rezultat | Izvor |
|---|---|---|
| I03-T01 | PASS (unit (a); emulator (b) 3 testa, uključujući novi query/zaglavlja); M02, M02b ubijene | `npm test`, `npm run test:emu` ×3, `provjera.ps1` ×2 |
| I03-T07 | PASS ((a) unit, (b) emulator, (c) novi unit test granice); M06 ubijena | isto |
| I03-T09 | PASS (2 testa; dopuna `"____"`, `"__\n__"`); M25, M25s ubijene | isto |
| I03-T17 | PASS ((a) i (b), dopuna 404 sa ključem u putanji i `putanja` = šablon rute); `putanja: req.path` ubijena | isto |
| Ostali i03 i regresija i01/i02 | PASS (nepromijenjeni) | isto |

### Poznata ograničenja (dopuna FIX LOOP 1)

- **503 i latencija pod jakom kontencijom istog korisnika** (napomena review-a; prihvaćeno ponašanje po brief-u i i02/P-5). U review-u:
  20 paralelnih različitih kupovina istog korisnika → 36–123 odgovora 503 (uz retry do uspjeha), 48–98 s; 10–30 identičnih paralelnih
  povremeno daju jedan 503 (1 od 3 serije) i latenciju do ~10 s. Stanje je uvijek konzistentno, a POS retry bezbjedan. U ovim
  izvršavanjima (10 paralelnih) I03-T11/T12 nisu dobili 503. Detalji su u IMPLEMENTATION_LOG.
- **R-04:** u logu je šablon rute bez prefiksa `/api/v1`; nepodržan metod na postojećoj putanji se bilježi kao `(nepoznata ruta)`.

## Iteracija 4 — Reward issue

Datum izvršavanja: 2026-10-17 (Windows 11 Pro 10.0.22621, Windows PowerShell 5.1). Grana `iteracija-04`, kod na commit-u `4e42bc8`
(koraci 0–6; korak 7 bez commit-a; dokumentacija koraka 8 necommit-ovana u trenutku izvršavanja). `node -v` → `v24.21.0`.
Emulator komande sa JBR-om prvim u PATH-u (`$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; $env:PATH="$env:JAVA_HOME\bin;$env:PATH"`).
Izlaz svake komande preusmjeren u fajl van repoa; ovdje su prepisane linije sa rezultatom.

### Završno izvršavanje (checkpoint)

```powershell
cd backend; npm test; npm run test:emu; npm run test:emu; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
.\skripte\provjera.ps1; $LASTEXITCODE    # dva puta zaredom (uključuje backend npm ci)
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff main -- docs/srs
```

| Komanda | Rezultat | Exit code | Trajanje (`ℹ duration_ms`) |
|---|---|---|---|
| `backend: npm test` | `ℹ tests 63` `ℹ pass 63` `ℹ fail 0` | 0 | 4,2 s |
| `backend: npm run test:emu` (1) | `ℹ tests 99` `ℹ pass 99` `ℹ fail 0` | 0 | 349 s |
| `backend: npm run test:emu` (2) | `ℹ tests 99` `ℹ pass 99` `ℹ fail 0` | 0 | 364 s |
| `backend: npm run test:emu` (3) | `ℹ tests 99` `ℹ pass 99` `ℹ fail 0` | 0 | 343 s |
| `firebase\tests: npm ci` | `added 729 packages, and audited 730 packages in 28s` | 0 | 28 s |
| `firebase\tests: npm test` | `ℹ tests 30` `ℹ pass 30` `ℹ fail 0` | 0 | 8,1 s |
| `.\skripte\provjera.ps1` (1) | `SVE PROVJERE PROŠLE`; backend `ℹ tests 63`/`ℹ pass 63`, `ℹ tests 99`/`ℹ pass 99`; rules `ℹ tests 30`/`ℹ pass 30`; 4 smoke-a; Android 2× `BUILD SUCCESSFUL` | 0 | 440 s |
| `.\skripte\provjera.ps1` (2) | isto kao (1) | 0 | 414 s |
| `(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash` | `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228` (`sha256sum`: `7d866413…c41c60228`) | — | — |
| `git diff main -- docs/srs` | prazno (0 linija) | — | — |

Prije završnog izvršavanja, na commit-u koraka 5 (`9725da8`, kod isti kao završni; bez `logIzdavanja.test.js`), `npm run test:emu` je izvršen još
3 puta zaredom: `ℹ tests 97` `ℹ pass 97` `ℹ fail 0`, exit 0, sva tri. Ukupno 6 punih izvršavanja emulator suite-a bez ijednog pada
poslije OD-1 (vidi „Nalazi tokom izvršavanja”).

#### `.\skripte\provjera.ps1` — oba izvršavanja (izvod stdout-a, isto u oba osim `correlationId`)

```
==> Alati (Node 24, Java 21+, JDK za Gradle)
==> SRS integritet (SHA-256 normativnog .docx-a)
==> NFR-07 (bez tajni u repozitorijumu)
==> Bez TODO/FIXME
==> Portovi emulatora 8080 i 9099 su slobodni
==> Backend: npm ci, npm test, npm run test:emu
==> Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1, 401 UNAUTHENTICATED na /account/init, …, 401 UNAUTHENTICATED na /rewards/CAR_WASH/issue bez token-a)
Smoke: 404 NOT_FOUND, correlationId abe7bc29-1599-4286-b9a4-0f57a9e0cd52
Smoke: 401 UNAUTHENTICATED, correlationId dc6065ea-117f-4e2f-a33d-3a1d0497df79
Smoke: 401 UNAUTHENTICATED_POS, correlationId 5c2de4c2-acb3-4b92-9db5-29a248698026
Smoke: 401 UNAUTHENTICATED, correlationId 4452febc-d4e7-4a64-95a2-8dd1702fa662
==> Firestore rules: npm ci, npm test
==> Android: assembleDebug, testDebugUnitTest
SVE PROVJERE PROŠLE
```

Log smoke koraka (1): `"code":"UNAUTHENTICATED","status":401,"metod":"POST","putanja":"/rewards/:rewardId/issue"` (šablon rute, D-3).
`provjera.ps1` → 0 je izvršen i poslije svakog koraka 1–6 (i03/K-2).

#### Statistika konkurentnih testova (završna 3 izvršavanja; `t.diagnostic`)

| Test | Izvršavanje 1 | Izvršavanje 2 | Izvršavanje 3 |
|---|---|---|---|
| API-T07 (20 ponavljanja; raspodjela) | `{"201 + 409 INSUFFICIENT_POINTS":20}` | `{"201 + 409 INSUFFICIENT_POINTS":20}` | `{"201 + 409 INSUFFICIENT_POINTS":20}` |
| API-T07 trajanje | 74,9 s | 71,2 s | 77,3 s |
| I04-T10 (a) statusi (10 paralelnih) | `201,409,409,409,409,409,409,409,409,409` | `409,409,409,409,409,201,409,409,409,409` | `201,409,409,409,409,409,409,409,409,409` |
| I04-T12 ponavljanje 1 | `200,200,200,200,201,200,200,200,200,200` | `200,201,200,200,200,200,200,200,200,200` | `200,200,200,201,200,200,200,200,200,200` |
| I04-T12 ponavljanje 2 | `201,200,200,200,200,200,200,200,200,200` | `200,200,200,201,200,200,200,200,200,200` | `200,200,200,200,200,200,200,200,200,201` |
| I04-T12 ponavljanje 3 | `200,200,200,200,200,200,200,200,200,201` | `200,200,503,200,200,201,200,200,200,200` | `200,200,200,200,200,200,200,200,201,200` |
| I04-T13 statusi (5 kupovina, 3 izdavanja) | `201×8`; 503: 1; 409 prije uspjeha: 62 | `201×8`; 503: 0; 409 prije uspjeha: 30 | `201×8`; 503: 1; 409 prije uspjeha: 31 |
| I04-T14 prvi zahtjev | HTTP 503 za 10 011 ms | HTTP 503 za 10 011 ms | HTTP 503 za 10 023 ms |

Izvršavanja na commit-u koraka 5 (3×): API-T07 `{"201 + 409 INSUFFICIENT_POINTS":20}` sva tri puta; I04-T10 (a) uvijek tačno jedan 201 i 9×409;
I04-T12 jedan 503 u ponavljanju 2 drugog izvršavanja (`200,201,200,200,200,503,200,200,200,200`), ostalo 200/201.
Ni u jednom izvršavanju nijedan 500 (R18 se nije pojavio). **K-3 ispunjen** u svih 6 izvršavanja (svako ima ≥ 1, tačnije 20 ponavljanja sa
ishodom tačno {201, 409 `INSUFFICIENT_POINTS`}); 503 pod kontencijom se u API-T07 nije pojavio.

### Test-first (crveno prije koda)

| Korak | Komanda | Rezultat prije implementacije |
|---|---|---|
| 1 | `firebase\tests: npm test` nad starim rules | `ℹ tests 30` `ℹ pass 28` `ℹ fail 2`: `✖ RULE-T09 owner get sopstvenog voucher-a i owner list …`, `✖ I04-T17 rewardDefinitions: prijavljen get/list → ALLOW …` (ALLOW slučajevi; default deny) |
| 2 | `backend: node --test test/jedinicni/dekodiranjePutanje.test.js` | `ℹ tests 3` `ℹ pass 2` `ℹ fail 1`: `✖ I04-T03 (c) D-5 …` — `actual: 500, expected: 404` (tijelo `INTERNAL_ERROR`) |
| 3 | `backend: npm test` | `ERR_MODULE_NOT_FOUND … src\servisi\vauceri.js`, `… src\validacija\zahtjevIzdavanja.js`; `ℹ tests 51` `ℹ pass 49` `ℹ fail 2` |
| 4 | `npx firebase emulators:exec … "node --test --test-concurrency=1 test/emulator/izdavanjeNagrade.test.js"` | `ℹ tests 18` `ℹ pass 0` `ℹ fail 18` — ruta ne postoji (`actual: 404` `NOT_FOUND`, `expected: 409/201/401`) |
| 4 | `backend: npm test` (dopuna I04-T03 (c) nad produkcionom rutom) | `ℹ tests 63` `ℹ pass 63` — zeleno i prije rute jer je D-5 globalan od koraka 2 (OD-3); crvenilo dokazano M21, M22 |
| 5, 6 | — | kod postoji od koraka 4 (plan, korak 5); crvenilo dokazano mutacijama (OD-3) |

Poslije koda koraka 4: `npm test` `ℹ tests 63` `ℹ pass 63`; emulator `izdavanjeNagrade.test.js` `ℹ tests 18` `ℹ pass 18` `ℹ fail 0`.
Prvo izvršavanje `izdavanjeAtomicnost.test.js` (korak 5, samostalno): `ℹ tests 11` `ℹ pass 11` `ℹ fail 0`.

### Nalazi tokom izvršavanja

- **I04-T13 (OD-1).** U prvom samostalnom izvršavanju I04-T13 je prošao, ali sa `statusi: 201,201,201,201,201,409,409,409` — nijedno izdavanje
  nije uspjelo, pa lanac nije sadržao RESERVE. Test je ojačan (409 → ponavljanje istim `requestId`, pauza 50 ms, 40 pokušaja). U punom
  izvršavanju (`npm run test:emu`, 1. od 3) I04-T13 je pao: `Error: 73b90f94-…: nema ishoda poslije 40 pokušaja` (`ℹ tests 97` `ℹ pass 96`
  `ℹ fail 1`); kupovine su pod kontencijom ponavljale 503, a zaostale su poslije `ocistiEmulatore` sljedećeg testa dobile 404
  `LOYALTY_ACCOUNT_NOT_FOUND` (log). Pauza je povećana na 250 ms, budžet na 120 pokušaja; samostalno: `ℹ pass 1` za 15,6 s; zatim 6 punih
  izvršavanja bez pada. Produkcioni kod nije mijenjan.
- **Kodiranje privremene skripte za mutacije** (Python `-I`, konzola cp1250): ispis JSON-a prebačen na ASCII; nema uticaja na rezultate.

### Security Rules i §31

| Komanda | Izlaz |
|---|---|
| `python -I uporedi_rules.py docs\srs\FuelPoints_SRS_3_1.docx firebase\firestore.rules` (privremena skripta van repoa: §31 iz `word/document.xml`, paragrafi `w:p` i `w:br` → `\n`, `w:t` tekst, HTML entiteti; uklonjen blok `/redemptionRequests/{requestKey}` sa praznim redom ispred; CRLF → LF) | `JEDNAKO_DOCX` |
| ista skripta nad `firebase/firestore.rules` prije izmjene (`git show HEAD:firebase/firestore.rules`, korak 1) | `RAZLIKA` — `unified_diff` pokazuje tačno tri nedostajuća bloka: `rewardDefinitions`, `vouchers` (poslije `loyaltyLedger`) i `rewardRequests` (poslije `notifications`) |
| `diff <(tr -d '\r' < firebase/firestore.rules) <(sed -n 636,724p docs/iteracije/i04_plan.md)` | prazno → `IDENTICNO_PLANU` |

### Inspekcije (plan, sekcija 9)

| Komanda | Izlaz |
|---|---|
| `git grep -n -E "/vouchers/\|/redeem\|/cancel\|account/vouchers\|REWARD_REDEEM\|redemptionRequests" -- backend/src` | samo `backend/src/podaci/kolekcije.js:11:  redemptionRequests: 'redemptionRequests',` |
| `git grep -n -i -E "process\.env\.(NODE_ENV\|TEST)\|inject\|ubriz\|mock" -- backend/src` | prazno (exit 1) |
| `git grep -n randomUUID -- backend/src` | samo `backend/src/firebase/inicijalizacija.js:1,9` i `backend/src/posrednici/korelacija.js:1,5` |
| `git diff --stat main -- '*package*.json'` | prazno |
| `git diff --stat main -- firebase/firestore.indexes.json` | prazno |
| `git grep -n -E "TODO\|FIXME" -- backend firebase skripte README.md ':!skripte/provjera.ps1'` | prazno (exit 1) |
| `git grep -n -P "firebase\tests" -- docs` (F1-01) | prazno (exit 1); ispravljene linije 1774, 1776, 1783 (samo `firebase<TAB>ests` → `firebase\tests`) |
| `git diff --stat main -- backend/test firebase/tests` | samo novi fajlovi i04 + `backend/test/pomocnici/omotacBaze.js` (`19 +`, 0 obrisanih linija) |

### Kontrolne mutacije (plan 8.4)

Emulatori su jednom pokrenuti (`npx firebase emulators:start --config ../firebase.json --project demo-fuelpoints --only firestore,auth`,
JBR prvi u PATH-u). Privremena skripta van repoa (`mutacije.py`) za svaku mutaciju: tačna zamjena teksta (provjera da se tekst javlja tačno
jednom; M11 premješta blok mapping-a iza provjera naloga i nagrade), ciljani test
(`node --test --test-concurrency=1 --test-name-pattern=<ID> <fajl>` sa `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`,
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `GCLOUD_PROJECT=demo-fuelpoints`; Rules testovi iz `firebase\tests`), pa
`git restore -- <izmijenjeni fajlovi>` i provjera `git diff --quiet -- backend/src firebase/firestore.rules`. Kontrolni prolaz istih ciljanih
testova bez mutacija: svi `ℹ fail 0`, exit 0. Poslije svih mutacija `git status --short` prazan.

| # | Mutacija | Ciljani test(ovi) | Ishod (`tests` / `fail`, exit) | Pao test |
|---|---|---|---|---|
| M01 | uklonjena provjera `dostupno < cijena` | API-T05 | 1 / 1, exit 1 | API-T05 |
| M02 | bodovi pročitani van transakcije; nalog se u transakciji ne čita | API-T07; I04-T13; I04-T18 (FIX LOOP 1) | ispravka (FIX LOOP 1, R-01): prvobitni red „1 / 1; 1 / 1” nije ponovljiv — po reviewu (`i04_review.md` 4.2) API-T07 obara M02 u 1 od 7 izvršavanja, I04-T13 u 4 od 5; I04-T18 10 od 10 | I04-T18 (pouzdano); API-T07 nad emulatorom ne razlikuje M02 (brava `tx.get(query)` serijalizuje izdavanja, O-17) |
| M03 | `tx.create` → `tx.set` za novi voucher | I04-T11 (z1)–(z4) | 1 / 1 | I04-T11 (z1)–(z4) |
| M04 | `tx.create` → `tx.set` za mapping | I04-T11 (z1)–(z4) | 1 / 1 | I04-T11 (z1)–(z4) |
| M05 | `tx.create` → `tx.set` za RESERVE | I04-T11 (z1)–(z4) | 1 / 1 | I04-T11 (z1)–(z4) |
| M06 | `tx.create` → `tx.set` za RELEASE | I04-T11 (z1)–(z4) | 1 / 1 | I04-T11 (z1)–(z4) |
| M07 | uklonjena provjera postojećeg `release_{id}` | I04-T10 (b) | 1 / 1 | I04-T10 (b) |
| M08 | upit bez `status == ACTIVE` i bez provjere statusa | I04-T09 (b), (c) | 1 / 1 | I04-T09 (b), (c) |
| M09 | `jeIstekao`: `>` umjesto `>=` | I04-T09 (f) | 3 / 1 | I04-T09 (f) jeIstekao |
| M10 | `requestKey` = SHA-256(`requestId`) | API-T06, I04-T06 (b); I04-T06 (a) | 2 / 2; 3 / 1 | API-T06, I04-T06 (b), I04-T06 (a) izracunajRequestKey |
| M11 | mapping se čita POSLIJE naloga i nagrade | I04-T08 (a)–(e) | 1 / 1 | I04-T08 (a)–(e) |
| M12 | validacija tijela i `rewardId` poslije čitanja mapping-a | I04-T08 (f), I04-T02 (b), I04-T03 (b) | 4 / 3 | I04-T02 (b), I04-T03 (b) neispravan format, I04-T08 (f) |
| M13 | `expiresAt = sadaMs + 15 * 60` | API-T06 | 1 / 1 | API-T06 |
| M13b | `expiresAt = sadaMs + 900 001` | API-T06 | 1 / 1 | API-T06 |
| M14 | `generisiVoucherId` = `crypto.randomUUID()` | I04-T06 (a); API-T06, I04-T06 (b) | 3 / 2; 2 / 2 | I04-T06 (a) ×2, API-T06, I04-T06 (b) |
| M15 | UUID regex bez provjere verzije | I04-T02 (a); I04-T02 (b) | 4 / 1; 1 / 1 | I04-T02 (a), I04-T02 (b) |
| M15b | UUID regex bez provjere varijante | I04-T02 (a) | 4 / 1 | I04-T02 (a) |
| M16 | UUID regex sa zastavicom `i` | I04-T02 (a); I04-T02 (b) | 4 / 1; 1 / 1 | I04-T02 (a), I04-T02 (b) |
| M17 | `active` provjeren poslije reconcile-a, ishod vraćen (commit) | I04-T05 nagrada | 1 / 1 | I04-T05 nagrada |
| M18 | O-14 grana baca u callback-u (rollback release-a) | I04-T09 (e) | 1 / 1 | I04-T09 (e) |
| M19 | `uid = req.query.uid ?? res.locals.uid` | I04-T01 UID | 1 / 1 | I04-T01 UID samo iz token-a |
| M20 | posrednik na prefiksu `/rewards` | I04-T03 (b) format | 1 / 1 | I04-T03 (b) neispravan format |
| M21 | uklonjena D-5 klauzula | I04-T03 (c); I04-T16 | 5 / 2; 2 / 2 | I04-T03 (c) test ruta i produkciona ruta, I04-T16 (a), (b) |
| M22 | D-5 → NOT_FOUND, ali stack se loguje uvijek | I04-T03 (c); I04-T16 | 5 / 2; 2 / 2 | isto kao M21 |
| M23 | uklonjena provjera kontrolnih znakova za `rewardId` | I04-T03 (a); I04-T03 (b) | 2 / 1; 1 / 1 | I04-T03 (a), I04-T03 (b) |
| M24 | uklonjena cijela provjera formata `rewardId` | I04-T03 (b) | 1 / 1 | I04-T03 (b) |
| M25 | release koristi `costPoints` iz definicije | I04-T05 SHOWER/snapshot | 1 / 1 | I04-T05 snapshot |
| M26 | `availableAfter` RESERVE-a iz stanja prije release-a | I04-T09 (a) | 1 / 1 | I04-T09 (a) |
| M27 | bez sortiranja release-a | I04-T09 (d) | 1 / 1 | I04-T09 (d) |
| M28 | reconcile postavlja i `cancelledAt` | I04-T09 (a) | 1 / 1 | I04-T09 (a) |
| M29 | `status` u odgovoru konstantno `ACTIVE` | I04-T08 (a)–(e) | 1 / 1 | I04-T08 (a)–(e) |
| M30 | odgovor retry-ja: `costPoints` iz definicije | I04-T05 SHOWER/snapshot | 1 / 1 | I04-T05 snapshot |
| M31 | uklonjena provjera preostalog roka | I04-T15 | 1 / 1 | I04-T15 |
| M32 | uklonjena provjera `mapping.uid`/`requestId` | I04-T10 (c) | 1 / 1 | I04-T10 (c) |
| M33 | uklonjeno poređenje `mapping.rewardId !== rewardId` | I04-T07 | 1 / 1 | I04-T07 |
| M34 | definicija bez provjere tipa (`"50"` prolazi) | I04-T05 nagrada | 1 / 1 | I04-T05 nagrada |
| M35 | `loyaltyAccounts` ne postoji provjereno prije DELETION | I04-T04 | 1 / 1 | I04-T04 |
| M36 | `odgovorVaucera` uključuje `uid` | API-T06; I04-T16 (a) | 1 / 1; 1 / 1 | API-T06, I04-T16 (a) |
| M37 | `putanja: req.originalUrl` u logu | I04-T16 | 2 / 2 | I04-T16 (a), (b) |
| M38 | Rules: `/vouchers` `allow list: if ownResource();` | I04-T17 | 3 / 1 | I04-T17 vouchers |
| M39 | Rules: `/rewardDefinitions` `allow read: if true;` | I04-T17 | 3 / 1 | I04-T17 rewardDefinitions |
| M40 | Rules: `/vouchers` `allow update: if ownResource();` | RULE-T09 | 2 / 1 | RULE-T09 voucher write |
| M41 | Rules: `/rewardRequests` `allow read: if signedIn();` | I04-T17 | 3 / 1 | I04-T17 rewardRequests |
| M42 (= MA21, FIX LOOP 1) | `const sadaMs = rokDo - 10000;` (jednom po zahtjevu, ne po pokušaju; krši i04/P-2) | I04-T19 | 10 izvršavanja: 10 × 1 / 1, exit 1 | I04-T19 |
| M43 (FIX LOOP 1) | `redigujPutanje` bez redakcije (`return tekst;`) u `obradaGresaka.js` | I04-T16 (c) | 10 izvršavanja: 10 × 1 / 1, exit 1 | I04-T16 (c) |

Ubijeno 43/43 (M01 … M41 + M13b, M15b); svaka je oborila ciljani test imenovan ID-em (nijedna nije „ubijena” greškom učitavanja fajla).
Nijedna mutacija nije preživjela, pa korak 7 nema commit ojačanja testova.

### Testovi koji nisu izvršeni

- Ponašanje nad produkcionim Firestore-om i produkcionim Rules engine-om (ID sa NUL/kontrolnim znakom, potreba za indeksom upita
  `uid ==, status ==`, kontencija): testovi rade isključivo nad emulatorom (`demo-fuelpoints`), po pravilima projekta.
- Razlika satova Backend/Firestore (i04/P-2): nije provjerljiva lokalno (emulator i Backend na istoj mašini).

### Rezultat po ID-u (Iteracija 4)

| ID | Rezultat | Izvor |
|---|---|---|
| API-T05 | PASS | `npm run test:emu` ×3 (+3 na commit-u koraka 5) |
| API-T06 | PASS (uklj. retry ×2 → 200, `upisi === []`) | `npm run test:emu` ×3 |
| API-T07 | PASS (20 ponavljanja; K-3: 20/20 `201 + 409 INSUFFICIENT_POINTS` u svakom izvršavanju) | `npm run test:emu` ×3 (+3) |
| RULE-T09 | PASS (2 testa) | `firebase\tests: npm test` |
| I04-T01 | PASS (2 testa) | `npm run test:emu` ×3 |
| I04-T02 | PASS — (a) 4 unit testa; (b) emulator | `npm test`, `npm run test:emu` ×3 |
| I04-T03 | PASS — (a) 2 unit testa; (b) 2 emulator testa; (c) 5 unit testova (test ruta + produkciona ruta API-03) | `npm test`, `npm run test:emu` ×3 |
| I04-T04 | PASS (11 slučajeva) | `npm run test:emu` ×3 |
| I04-T05 | PASS (2 testa; 10 slučajeva definicije + snapshot) | `npm run test:emu` ×3 |
| I04-T06 | PASS — (a) 3 unit testa; (b) 100 izdavanja + dva korisnika | `npm test`, `npm run test:emu` ×3 |
| I04-T07 | PASS | `npm run test:emu` ×3 |
| I04-T08 | PASS — (a)–(e), (f) | `npm run test:emu` ×3 |
| I04-T09 | PASS — (a), (b)+(c), (d), (e) emulator; (f) 3 unit testa | `npm test`, `npm run test:emu` ×3 |
| I04-T10 | PASS — (a), (b), (c), (d) | `npm run test:emu` ×3 (+3) |
| I04-T11 | PASS — (a)–(d) failure injection; (z1)–(z4) | `npm run test:emu` ×3 (+3) |
| I04-T12 | PASS (3 ponavljanja; jedan dozvoljen 503 u 2 od 6 izvršavanja, nijedan 500) | `npm run test:emu` ×3 (+3) |
| I04-T13 | PASS (svih 8 zahtjeva uspješno u svakom izvršavanju — 8×201 u završna 3, jednom `200` za kupovinu poslije 503 i kasnog commit-a na commit-u koraka 5; 3 voucher-a; lanac EARN/RESERVE od 0/0) | `npm run test:emu` ×3 (+3) |
| I04-T14 | PASS (503 za ~10,0 s; kasni commit + retry → isti voucher) | `npm run test:emu` ×3 (+3) |
| I04-T15 | PASS | `npm run test:emu` ×3 (+3) |
| I04-T16 | PASS — (a) in-process, (b) spawn | `npm run test:emu` ×3 |
| I04-T17 | PASS (3 testa) | `firebase\tests: npm test` |
| Smoke 401 `/rewards/CAR_WASH/issue` | PASS | `provjera.ps1` (korak 6 i završno) |
| Regresija I01–I03 (backend unit + emulator, Rules RULE-T01 … T08, T10 … T12, I02-T15, I03-T20) | PASS, bez izmjene postojećih testova | `npm test`, `npm run test:emu` ×3, `firebase\tests: npm test` |
| Android `assembleDebug`, `testDebugUnitTest` | `BUILD SUCCESSFUL` | `provjera.ps1` |

### Poznata ograničenja

- Vidi `docs/IMPLEMENTATION_LOG.md`, Iteracija 4, „Poznata ograničenja” (satovi, emulator vs produkcija, P-14, P-16, `ALREADY_EXISTS` u logu).

## Iteracija 4 — FIX LOOP 1 (nalazi R-01 … R-04 iz `docs/iteracije/i04_review.md`, commit d3e6d6a)

Odluke Orchestrator-a O-17 i O-18 (`docs/iteracije/i04_plan.md`, sekcija 15, „FIX LOOP 1 — odluke Orchestrator-a”). Proizvodni kod je
izmijenjen samo u `backend/src/greske/obradaGresaka.js` (R-04); `izdavanjeNagrade.js` nije mijenjan.

Polazno stanje (vrh `d3e6d6a`, `git status` čist): `.\skripte\provjera.ps1` → `SVE PROVJERE PROŠLE`, `EXIT=0`; `ℹ tests 63 / pass 63 / fail 0`
(unit), `ℹ tests 99 / pass 99 / fail 0` (emulator), `ℹ tests 30 / pass 30 / fail 0` (Rules).

Ponavljanja i mutacije: privremena skripta van repoa (`ponovi.mjs`), unutar
`npx firebase emulators:exec --config ../firebase.json --project demo-fuelpoints --only firestore,auth` (JBR prvi u PATH-u), pokreće
`node --test --test-concurrency=1 --test-name-pattern=<ID> <fajl>` N puta i bilježi exit, `ℹ pass`, `ℹ fail` i prvu poruku greške.
Mutacije M02 i M42 (`izdavanjeNagrade.js`) su vraćene sa `git restore`; M43 je vraćena na tekst ispravke prije commit-a koraka 3.
Na kraju `git status --short` prazan.

### R-01 — I04-T18 (`izdavanjeAtomicnost.test.js`): stanje se čita u transakciji, nezavisno od brave upita

Mehanizam: nova opcija `omotacBaze({ prijeCommita })` — callback izdavanja se izvrši (sva čitanja gotova), pa omotač u prvom pokušaju
pokrene kupovinu (API-02, isti korisnik, 20 bodova) i čeka njen ishod najviše 2 s prije commit-a izdavanja. Kupovina ne čita `vouchers`,
pa brava `tx.get(query)` ne utiče na ishod (O-17). Asercije: 201 + 201, balance `[20, 50]`, tačno EARN + REWARD_RESERVE, lanac od 50/0 do
20/50, 1 voucher, 1 mapping; 10 ponavljanja po izvršavanju.

| Izvršavanje | Kod | Rezultat |
|---|---|---|
| proba ×1 sa dijagnostikom | M02 | `exit=1 pass=0 fail=1`: `ponavljanje 1: balance (izgubljen upis kupovine ili izdavanja)`; `izdavanje 201, kupovina 201, pokušaja izdavanja 1, kupovina čekala izdavanje: false` |
| 10 izvršavanja | M02 | 10 × `exit=1 pass=0 fail=1` (`ponavljanje 1: balance …`) — **pao 10/10** |
| proba ×1 sa dijagnostikom | nemutiran | `exit=0 pass=1 fail=0`; u svih 10 ponavljanja `izdavanje 201, kupovina 201, pokušaja izdavanja 1, kupovina čekala izdavanje: true` |
| 10 izvršavanja | nemutiran | 10 × `exit=0 pass=1 fail=0` (35 747 – 38 992 ms) — **prošao 10/10** |

Napomena: API-T07 nad emulatorom ne razlikuje M02 (review: 1 od 7 izvršavanja pada), jer brava `tx.get(query)` serijalizuje dva izdavanja;
dokaz za M02 je I04-T18.

### R-02 — I04-T19 (`izdavanjeAtomicnost.test.js`): `sadaMs` po pokušaju (i04/P-2)

Mehanizam: nova opcija `omotacBaze({ prisiliPonovniPokusaj: 1 })` — poslije prvog pokušaja callback-a omotač baci ABORTED (code 10), pa
Admin SDK ponavlja callback. `mock.method(Date, 'now', …)`: pozivi neposredno iz `src/servisi/izdavanjeNagrade.js` dobijaju T0, T0 + 10 s,
T0 + 20 s; ostali stvarno vrijeme; `mock.restoreAll()` u testu i u `afterEach`. Asercije: 2 pokušaja, čitanja `Date.now` po pokušaju
`[0, 1, 2]`, `issuedAt` = T0 + 20 s i `expiresAt` = T0 + 20 s + 900 000 ms (odgovor i dokument), voucher sa `expiresAt` T0 + 15 s
oslobođen (EXPIRED, `release_`), balance `[30, 50]`.

| Izvršavanje | Kod | Rezultat |
|---|---|---|
| 10 izvršavanja | nemutiran | 10 × `exit=0 pass=1 fail=0` — **prošao 10/10** |
| 10 izvršavanja | M42 (= MA21) `const sadaMs = rokDo - 10000;` | 10 × `exit=1 pass=0 fail=1`: `čitanja Date.now po pokušaju: [{"vrijednost":…,"pokusaj":0}]` — **pao 10/10** |

### R-04 — I04-T16 (c) (`logIzdavanja.test.js`) i redakcija u `obradaGresaka.js` (O-18)

Ispravka: za 5xx log polje `stack` = `name (code N): poruka` sa redigovanim putanjama dokumenata (`path=…`, `documents/…`,
`<kolekcija §24>/…` → `[putanja dokumenta]`) + samo okviri `at …`. Odgovor klijentu i statusni kod nepromijenjeni.
Poruka Firestore greške u emulatoru (proba van repoa): `6 ALREADY_EXISTS: entity already exists: EntityRef[partitionRef=dev~demo-fuelpoints, path=/rewardRequests/<ID>]`.
Test: dva slučaja (`sakrijPostojece` za `rewardRequests/<requestKey>` i za `loyaltyLedger/release_<voucherId>`) → 500 `INTERNAL_ERROR`;
log bez oba requestKey-a, postojećeg i novog voucherId-a, requestId-a i putanje; log sadrži `ALREADY_EXISTS` ili `code 6` i okvire `at`.

| Izvršavanje | Kod | Rezultat |
|---|---|---|
| ×1 prije ispravke (test-first) | zatečen `obradaGresaka.js` | `exit=1 pass=0 fail=1`: `mapping: log sadrži requestKey (mapping)` |
| 10 izvršavanja (prva verzija testa) | ispravka | 10 × `fail=1`: `release: … UNAUTHENTICATED` — greška u testu (`ocistiEmulatore()` u pripremi drugog slučaja brisao je i Auth korisnika); uklonjeno iz testa, kod nepromijenjen |
| 10 izvršavanja | ispravka | 10 × `exit=0 pass=1 fail=0` — **prošao 10/10** |
| 10 izvršavanja | M43 (bez redakcije) | 10 × `exit=1 pass=0 fail=1`: `mapping: log sadrži requestKey (mapping)` — **pao 10/10** |

### `.\skripte\provjera.ps1` poslije svakog koraka

| Korak (commit) | Rezultat |
|---|---|
| 0 `1811463` odluke | `EXIT=0`; 63 / 99 / 30, `fail 0` |
| 1 `070a1fc` R-01 | `EXIT=0`; 63 / 100 / 30, `fail 0`; I04-T18 ✔ (31 747 ms) |
| 2 `b562245` R-02 | `EXIT=0`; 63 / 101 / 30, `fail 0`; I04-T19 ✔ |
| 3 `5678e58` R-04 | `EXIT=0`; 63 / 102 / 30, `fail 0` (emulator `duration_ms 386181.965`); API-T07 `raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":19,"201 + 503 SERVICE_UNAVAILABLE":1}`; I04-T16 (a), (b), (c) ✔ |

Izvod završnog izvršavanja (korak 3): `ℹ tests 63` `ℹ pass 63` `ℹ fail 0`; `ℹ tests 102` `ℹ pass 102` `ℹ fail 0`; smoke `404 NOT_FOUND`,
`401 UNAUTHENTICATED`, `401 UNAUTHENTICATED_POS`, `401 UNAUTHENTICATED` (`/rewards/:rewardId/issue`); `ℹ tests 30` `ℹ pass 30` `ℹ fail 0`;
Android `BUILD SUCCESSFUL`; `SVE PROVJERE PROŠLE`.

### Rezultat po ID-u (FIX LOOP 1)

| ID | Rezultat | Izvor |
|---|---|---|
| I04-T18 (R-01; NFR-06, AC-06, API-T07) | PASS 10/10; obara M02 10/10 | `ponovi.mjs` ×10 ×2; `provjera.ps1` koraci 1–3 |
| I04-T19 (R-02; i04/P-2) | PASS 10/10; obara M42 (= MA21) 10/10 | `ponovi.mjs` ×10 ×2; `provjera.ps1` koraci 2–3 |
| I04-T16 (c) (R-04; D-3, O-18) | PASS 10/10; obara M43 10/10 | `ponovi.mjs` ×10 ×2; `provjera.ps1` korak 3 |
| Svi ostali (API-T05 … T07, RULE-T09, I04-T01 … T17, regresija I01–I03) | PASS, postojeći testovi nisu mijenjani | `provjera.ps1` korak 3 |

## Iteracija 4 — FIX LOOP 2 (nalazi R-06 i R-05 iz `docs/iteracije/i04_review_fix1.md`, commit 54b2e0b)

Odluke Orchestrator-a P-3 i P-4 (`docs/iteracije/i04_plan.md`, sekcija 15, „FIX LOOP 2 — odluke Orchestrator-a”). Proizvodni kod je
izmijenjen samo u `backend/src/greske/obradaGresaka.js` (R-05); `omotacBaze.js` nije mijenjan.

Polazno stanje (vrh `54b2e0b`, `git status` čist): `.\skripte\provjera.ps1` → `SVE PROVJERE PROŠLE`, `EXIT=0`; `ℹ tests 63 / pass 63 / fail 0`
(unit), `ℹ tests 102 / pass 102 / fail 0` (emulator), `ℹ tests 30 / pass 30 / fail 0` (Rules), Android `BUILD SUCCESSFUL`.
Napomena: za vrijeme ovog izvršavanja (prije emulatorskog dijela) radno stablo je već sadržalo proširenje `logIzdavanja.test.js` iz koraka 1,
pa je u njemu izvršena proširena I04-T16 (c) (✔ 365 ms) nad nemutiranim kodom iz `54b2e0b`.

Ponavljanja i mutacije: privremena skripta van repoa (`ponovi.mjs` u scratchpad-u sesije), uz ručno pokrenut
`npx firebase emulators:start --config ../firebase.json --project demo-fuelpoints --only firestore,auth` (JBR prvi u PATH-u). Skripta primijeni
zamjenu teksta u `obradaGresaka.js`, N puta pokrene `node --test --test-concurrency=1 [--test-name-pattern=<ID>] <fajl>` (env
`FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`, `GCLOUD_PROJECT=demo-fuelpoints`), zabilježi exit,
`ℹ pass`, `ℹ fail` i prvu poruku greške, pa vrati fajl. Poslije svake serije `git restore backend/src`; `git status --short` bez izmjena u `backend/src`.

### R-06 — I04-T16 (c) (`logIzdavanja.test.js`): slučajevi `vouchers/<voucherId>` i `loyaltyLedger/reserve_<voucherId>`

Mehanizam: kao postojeći slučajevi — `mock.method(crypto, 'randomBytes')` vraća fiksnih 32 bajta (`ab…`), pa je novi voucherId poznat unaprijed;
dokument drugog uid-a pod tim ID-em (`vouchers/<noviVoucherId>`, odnosno `loyaltyLedger/reserve_<noviVoucherId>`) je pripremljen i sakriven
`omotacBaze({ sakrijPostojece })`, pa `tx.create` pada na commit-u sa ALREADY_EXISTS. Priprema slučaja `voucher` briše istekli voucher i
`release_` iz slučaja `release` (inače bi reconcile pao na postojećem `release_` prije commit-a); slučaj `reserve` briše `vouchers/<noviVoucherId>`.
Asercije po slučaju (iste kao za postojeće): 500 `INTERNAL_ERROR` po §27; log bez requestKey-a (četiri), postojećeg i novog voucherId-a,
requestId-a i putanje (sirovo ni u putanji); log sadrži `ALREADY_EXISTS` ili `code 6` i okvire `at`.

Mutacija M43-vr (tačno iz re-reviewa) u `redigujPutanje`:
`return tekst.replace(PUTANJA_DOKUMENTA, '[putanja dokumenta]');` →
`return tekst.replace(PUTANJA_DOKUMENTA, (m) => (/vouchers\/|reserve_/.test(m) ? m : '[putanja dokumenta]'));`

| Izvršavanje (kod iz `0c80582` = `54b2e0b` u `src/`) | Kod | Rezultat |
|---|---|---|
| 10 × `--test-name-pattern=I04-T16 \(c\)` | nemutiran | 10 × `exit=0 pass=1 fail=0` — **prošao 10/10** |
| 10 × isto | M43-vr | 10 × `exit=1 pass=0 fail=1`: `voucher: log sadrži voucherId (novi)` — **pao 10/10** |
| 3 × isto (dopuna) | M43-r: redakcija isključena samo za `reserve_` | 3 × `exit=1`: `reserve: log sadrži voucherId (novi)` — pao 3/3 (slučaj `reserve` sam obara) |
| 3 × isto (dopuna) | M43-v: redakcija isključena samo za `vouchers/` | 3 × `exit=1`: `voucher: log sadrži voucherId (novi)` — pao 3/3 |

### R-05 — I04-T20 (`logGresaka5xx.test.js`) i log 5xx bez poruke gRPC grešaka (`obradaGresaka.js`)

Ispravka: greška sa numeričkim gRPC `code` (`Number.isInteger(err.code)`) → polje `stack` = `name (code N IME_STATUSA)` (statička mapa
0 OK … 16 UNAUTHENTICATED) + okviri `at …`; poruka se NE bilježi. Ostale greške (Error bez numeričkog `code`, bačen ne-Error) → poruka uz
redakciju putanja (FIX LOOP 1) i svakog niza od ≥ 32 uzastopna hex znaka (`[hex]`); `name` i okviri idu kroz istu redakciju. Odgovor
klijentu i statusni kodovi nepromijenjeni (§27, poruka iz kataloga).

Test (grešku obrađuje `centralniRukovalacGreskama` direktno, `req.route.path = '/rewards/:rewardId/issue'`; log se presreće `presretniLog`):
- **(a)** stvarna emulatorska NOT_FOUND: `db.runTransaction` sa `tx.update` nad nepostojećim `vouchers/<id>`, za `<id>` = 64 hex i za
  `TAJNA-<uuid>` (ID koji nije hex niz, pa ga ne hvata hex redakcija). Preduslov: `code === 5` i sirova poruka emulatora sadrži ID.
  Asercije: odgovor 500 `{ error: { code: 'INTERNAL_ERROR', message: <katalog>, correlationId } }`; log bez ID-a; prvi red
  `Error (code 5 NOT_FOUND)`; nijedan red poruke emulatora (≥ 6 znakova) u `stack`; okviri `at`.
- **(b)** isto van transakcije: `db.doc('rewardRequests/<id>').update(…)`.
- **(c)** ne-gRPC: `Error` sa golim 64-hex, `release_<hex>` bez kolekcije, `vouchers/<hex>`, `loyaltyLedger/reserve_<hex>`,
  `vouchers/TAJNA-<uuid>`, `loyaltyLedger/reserve_TAJNA-<uuid>`, `Error` sa string `code`; bačen string sa golim hex-om i sa `vouchers/TAJNA-…`.
  Asercije: 500 `INTERNAL_ERROR` po §27; log bez tajne; za `Error` poruka ostaje (`Error: neočekivan…`) i okviri `at`.

Stvarna poruka emulatora (iz pada testa prije ispravke): `Error (code 5): 5 NOT_FOUND: no entity to update: app: "dev~demo-fuelpoints"` + redovi
`path < Element { type: … name: "<id>" } >` (potvrđen oblik iz re-reviewa).

Mutacije u `obradaGresaka.js` (kod iz `f27ab90`):
- **M44** — grana (a) uklonjena: `  if (Number.isInteger(err.code)) {` → `  if (false) {` (gRPC poruka se opet loguje, sa redakcijom).
- **M44b** (dopuna) — grana (a) zadržava prvi red, ali dodaje redigovanu poruku: `[…, rediguj(String(err.message)), ...okviri]`.
- **M45** — bez hex redakcije: `return redigujPutanje(tekst).replace(HEX_NIZ, '[hex]');` → `return redigujPutanje(tekst);`.
- **M43-vr** — tekst iz koraka 1, nepromijenjen (važi za ne-gRPC putanje).
- **M43-vr-g** — ekvivalent M43-vr za novu gRPC granu (vidi ispod): `return [`${ime} (code ${err.code} ${status})`, ...okviri].join('\n');` →
  `return [`${ime} (code ${err.code} ${status})`, ...(/vouchers\/|reserve_/.test(String(err.message)) ? [String(err.message)] : []), ...okviri].join('\n');`
- **M43** (FIX LOOP 1, ponovljena) — `redigujPutanje`: `return tekst;`.

| Izvršavanje (kod iz `f27ab90`) | Test | Kod | Rezultat |
|---|---|---|---|
| ×1 prije ispravke (test-first; `obradaGresaka.js` iz `458e720`) | I04-T20 cijeli fajl | zatečen | `pass 0 fail 3`: (a) `vouchers/aeadcd…: prvi red opisa: Error (code 5): 5 NOT_FOUND: no entity to update: app: "dev~demo-fuelpoints"`; (b) isto za `rewardRequests/…`; (c) `goli hex: log sadrži tajnu` |
| 10 izvršavanja | I04-T20 cijeli fajl | nemutiran | `REZULTAT … pao 0/10` (svako izvršavanje exit 0, fail 0) — **prošao 10/10** |
| 10 izvršavanja | I04-T16 (c) | nemutiran | `pao 0/10` (exit 0, fail 0) — **prošao 10/10** |
| 10 izvršavanja | I04-T20 | M44 | `pao 10/10`, prva poruka: `vouchers/b67b4a…: prvi red opisa: Error: 5 NOT_FOUND: no entity to update: …` — **pao 10/10** |
| 3 izvršavanja (dopuna) | I04-T20 | M44b | `pao 3/3`, prva poruka: `vouchers/6deaf4…: log sadrži red poruke gRPC greške ("5 NOT_FOUND: no entity to upda…")` — pao 3/3 |
| 10 izvršavanja | I04-T20 | M45 | `pao 10/10`, prva poruka: `goli hex: log sadrži tajnu` — **pao 10/10** |
| 10 izvršavanja | I04-T20 | M43-vr | `pao 10/10`, prva poruka: `vouchers/<id bez hex-a>: log sadrži tajnu` — **pao 10/10** |
| 10 izvršavanja | I04-T16 (c) | M43-vr-g | `pao 10/10`, prva poruka: `voucher: log sadrži voucherId (novi)` — **pao 10/10** |
| 10 izvršavanja | I04-T16 (c) | M43-vr | `pao 0/10` (exit 0, fail 0) — 0/10 (očekivano, vidi ispod) |
| 10 izvršavanja | I04-T20 | M43 | `pao 10/10`, prva poruka: `vouchers/<id bez hex-a>: log sadrži tajnu` — **pao 10/10** |
| 10 izvršavanja | I04-T16 (c) | M43 | `pao 0/10` (exit 0, fail 0) — 0/10 (očekivano, vidi ispod) |
| ×1 | `logIzdavanja.test.js` + `logGresaka5xx.test.js` cijeli | nemutiran | `exit=0`, `fail 0` |

**M43-vr i M43 poslije koraka 2.** Greške u I04-T16 (c) su stvarne Firestore ALREADY_EXISTS (gRPC `code 6`), a njihova poruka se više ne
bilježi. Zato `redigujPutanje` za njih nije na putu podataka, pa M43-vr i M43 nad I04-T16 (c) više ne mijenjaju ponašanje (0/10, ekvivalentne
mutacije za taj test). Obje i dalje obara I04-T20 (c) 10/10, preko ne-gRPC poruka `vouchers/TAJNA-<uuid>` i `loyaltyLedger/reserve_TAJNA-<uuid>`.
Taj ID nije hex niz, pa ga hex redakcija ne prikriva. Ekvivalent M43-vr na novom mjestu (selektivno puštanje `vouchers/` i `reserve_` kroz
gRPC granu) je M43-vr-g, koju I04-T16 (c) obara 10/10.

**Ispravka napomena o redakciji iz FIX LOOP-a 1 (R-04):** opis „`name (code N): poruka` sa redigovanim putanjama” više ne važi za gRPC
greške. One se bilježe kao `Error (code 6 ALREADY_EXISTS)` / `Error (code 5 NOT_FOUND)` + okviri, bez poruke, i ne zavise od njenog oblika.
Redakcija putanja i hex nizova važi samo za ne-gRPC poruke. Primjer iz FIX LOOP-a 1 (`… path=/rewardRequests/<ID>`) je ostao tačan opis
sirove poruke emulatora, ali ta poruka više ne ide u log.

### `.\skripte\provjera.ps1` poslije svakog koraka

| Korak (commit) | Rezultat |
|---|---|
| polazno `54b2e0b` | `EXIT=0`; 63 / 102 / 30, `fail 0` (vidi napomenu gore) |
| 0 `0c80582` odluke | samo dokumentacija; nije izvršavano zasebno (polazno izvršavanje je trajalo preko ovog commit-a) |
| 1 `458e720` R-06 | `EXIT=0`; 63 / 102 / 30, `fail 0` |
| 2 `f27ab90` R-05 | `EXIT=0`; 63 / 105 / 30, `fail 0` (emulator `duration_ms 382289.2735`); API-T07 `raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":20}`; I04-T20 (a) ✔ 3 162 ms, (b) ✔, (c) ✔; I04-T16 (c) ✔ 353 ms |
| 3 `00cf0c1` dokumentacija (vrh grane poslije commit-a) | `EXIT=0`, `SVE PROVJERE PROŠLE`; `ℹ tests 63` `ℹ pass 63` `ℹ fail 0`; `ℹ tests 105` `ℹ pass 105` `ℹ fail 0` (emulator `duration_ms 372633.2719`); API-T07 `raspodjela ishoda: {"201 + 409 INSUFFICIENT_POINTS":20}`; I04-T20 (a) ✔ 3 159 ms, (b) ✔, (c) ✔; I04-T16 (c) ✔ 364 ms; smoke `404 NOT_FOUND`, `401 UNAUTHENTICATED`, `401 UNAUTHENTICATED_POS`, `401 UNAUTHENTICATED`; `ℹ tests 30` `ℹ pass 30` `ℹ fail 0`; Android `BUILD SUCCESSFUL` ×2 |

Ishod koraka 3 je upisan posebnim commit-om („i04 fix2: TEST_REPORT ishod završne provjere”), jer se provjera izvršava tek poslije commit-a
dokumentacije; taj commit mijenja samo ovaj red i ovu napomenu.

### Rezultat po ID-u (FIX LOOP 2)

| ID | Rezultat | Izvor |
|---|---|---|
| I04-T16 (c) (R-06; D-3, O-18) | PASS 10/10; obara M43-vr 10/10 (kod prije koraka 2) i M43-vr-g 10/10 (kod poslije) | `ponovi.mjs`; `provjera.ps1` koraci 1–2 |
| I04-T20 (a)–(c) (R-05, P-3; D-3, O-18, NFR-07) | PASS 10/10; obara M44, M45, M43-vr, M43 po 10/10 | `ponovi.mjs`; `provjera.ps1` korak 2 |
| Svi ostali (API-T05 … T07, RULE-T09, I04-T01 … T19, regresija I01–I03) | PASS, postojeći testovi nisu mijenjani (I04-T16 (c) samo proširen) | `provjera.ps1` korak 2 |
