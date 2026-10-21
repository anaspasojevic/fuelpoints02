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

---

## Iteracija 2 — Account lifecycle i granica autentikacije

Grana `iteracija-02`. Brief: `docs/iteracije/i02_brief.md`. Plan: `docs/iteracije/i02_plan.md`
(odobren uz odluke i02/P-1 … i02/P-9 i backlog N-01, N-02, sekcija 15). Uloga: BUILDER, 2026-10-15/16.

### CHANGELOG

- Firestore Security Rules (§25.2, §25.3, §31, NFR-03): helper funkcije `signedIn`, `isOwner`, `ownResource`, `changedOnly`
  i blokovi `/users/{uid}` i `/loyaltyAccounts/{uid}` doslovno iz §31 normativnog `.docx`-a (automatsko poređenje teksta:
  jednako); default deny ostaje posljednji. Blokovi ostalih kolekcija dolaze u i03–i06 (D-2).
- Rules testovi: RULE-T01 … RULE-T07 i I02-T15 (`firebase/tests/korisnikINalog.test.js`); I01-T10 sveden na `loyaltyLedger`.
- Konfiguracija Backend-a: obavezna `VERZIJA_USLOVA` bez podrazumijevane vrijednosti (AUTH-10, O-11, i02/P-4);
  zaštita NFR-01: start se odbija ako je definisana `FIRESTORE_EMULATOR_HOST` ili `FIREBASE_AUTH_EMULATOR_HOST`
  (i prazna), a `FIREBASE_PROJECT_ID` ne počinje sa `demo-`; poruke bez vrijednosti. Konstanta `ROK_ZAVISNOG_SERVISA_MS = 10 000`.
- `greske/greskeServisa.js`: `saRokom` (istek → `SERVICE_UNAVAILABLE`), `klasifikujGreskuAuth`
  (token/korisnik → `UNAUTHENTICATED`; `app/network-error`, `app/network-timeout`, istek → `SERVICE_UNAVAILABLE`; ostalo → `INTERNAL_ERROR`),
  `jeNedostupnostFirestore` (gRPC 14, 4, 10) — i02/P-5.
- Posrednik `napraviProvjeruTokena(auth)` (§3.3, NFR-01): `Authorization: Bearer <token>` (šema case-insensitive, i02/P-7),
  `verifyIdToken(token, true)` u roku od 10 s, UID samo iz verifikovanog token-a (`res.locals.uid`); posrednik uvijek baca novu
  `GreskaApi`, token se nigdje ne upisuje. Vezan samo na rutu `POST /account/init`.
- Validacija tijela API-01: tačno `{ displayName, acceptedTermsVersion }`; tijelo koje nije objekat ili ima bilo koje drugo polje
  → `INVALID_REQUEST`; `displayName` string dužine 1–100 UTF-16 jedinica (kao `size()` u Rules, i02/P-3) → inače
  `INVALID_DISPLAY_NAME`; `acceptedTermsVersion` strogo jednak `VERZIJA_USLOVA` → inače `INVALID_REQUEST`.
- Servis `inicijalizujNalog` (AUTH-02 … AUTH-05, §7.1, NFR-04): JEDNA Firestore transakcija; oba dokumenta se čitaju u
  transakciji, kreira se samo dokument koji nedostaje (`tx.create`, i02/P-2 varijanta A), postojeći dokument se ne piše;
  `DELETION_IN_PROGRESS` → 409; `accountStatus` van enum-a → 500 bez izmjene; svi timestamp-ovi serverski; bez ledger eventa;
  `maxAttempts: 5`; rok 10 s; nedostupnost/contention → 503.
- Ruta `POST /api/v1/account/init` (§26 API-01, i02/P-1): 201 kad je kreiran bar jedan dokument, 200 za ponovljeni init; tijelo tačno
  `{ displayName, accountStatus, acceptedTermsVersion, availablePoints, reservedPoints }` iz Firestore stanja.
- `napraviAplikaciju({ servisi, verzijaUslova })`; `pokreni.js` inicijalizuje Admin SDK tek poslije provjere konfiguracije.
- Testovi backend-a: I02-T11 (a), I02-T13 (unit); API-T01, I02-T01 … I02-T12, I02-T14, I02-T16 (emulator); I01-T06 proširen
  (samo ulaz i očekivanje, plus prazna `VERZIJA_USLOVA`); presretač loga premješten u `test/pomocnici/presretanjeLoga.js` bez promjene
  ponašanja; N-01 test za grešku parsera sa 5xx (I01-T03).
- `skripte/provjera.ps1`: `VERZIJA_USLOVA=1.0` za smoke (vraća se na kraju), dodatni smoke `POST /api/v1/account/init` bez token-a → 401
  `UNAUTHENTICATED`, zaglavlje bez „Iteracija 1”. `.env.example`: `VERZIJA_USLOVA=1.0`. README: konfiguracija, zaštita, API-01.
- Dokumentacija: `docs/TEST_REPORT.md` (sekcija i02), `docs/TRACEABILITY.md` (redovi Iteracije 2), ovaj unos.

Nijedan novi npm paket, kod greške ni endpoint; katalog grešaka, centralni rukovalac, `parsirajJson`, `dnevnik.js` i seed nepromijenjeni.

### Commit-i

| Commit | Korak plana |
|---|---|
| `1380b44` i02: odobrenje plana i odluke Orchestrator-a | sekcija 15 |
| `f0fc40c` i02: Security Rules za users i loyaltyAccounts doslovno po §31 (RULE-T01–T07) | 1 |
| `dcb590c` i02: verzija uslova iz konfiguracije i odbijanje emulator režima van demo projekta (I02-T13) | 2 |
| `fef9ab7` i02: rok i klasifikacija grešaka Firestore i Auth servisa (I02-T11) | 3 |
| `7344d92` i02: verifikacija Firebase ID token-a … (I02-T01–T03) + POST /account/init u jednoj Firestore transakciji, idempotentno (API-T01) | 4 i 5 (jedan commit, dozvoljeno planom) |
| `7a6ce98` i02: pokretanje sa Admin SDK-om, 503 kad servis nije dostupan i log bez token-a (I02-T11, I02-T12) | 6 |
| `dba886a` i02: provjera.ps1 sa smoke testom za /account/init i README | 7 |
| `0b833e5` i02: test za grešku parsera sa 5xx (backlog i01 N-01) | N-01 |
| (ovaj commit) i02: TEST_REPORT, IMPLEMENTATION_LOG i sljedivost za iteraciju 2 | 9 |

Korak 8 (kontrolne mutacije) nema commit; rezultat je u TEST_REPORT.

### Fajlovi

Dodati:

```
firebase/tests/korisnikINalog.test.js
backend/src/greske/greskeServisa.js
backend/src/posrednici/autentikacija.js
backend/src/validacija/tijeloInita.js
backend/src/servisi/inicijalizacijaNaloga.js
backend/src/rute/nalog.js
backend/test/pomocnici/procesBackenda.js
backend/test/pomocnici/authEmulator.js
backend/test/pomocnici/presretanjeLoga.js
backend/test/jedinicni/pokretanjeBackenda.test.js
backend/test/jedinicni/greskeServisa.test.js
backend/test/emulator/autentikacija.test.js
backend/test/emulator/inicijalizacijaNaloga.test.js
backend/test/emulator/nedostupnostServisa.test.js
backend/test/emulator/logBezTokena.test.js
```

Izmijenjeni:

```
firebase/firestore.rules
firebase/tests/podrazumijevanaZabrana.test.js     (I01-T10 bez users dijela)
backend/src/aplikacija.js
backend/src/pokreni.js
backend/src/konfiguracija/konfiguracija.js
backend/test/jedinicni/konfiguracija.test.js       (I01-T06 proširen; I02-T13 (a))
backend/test/jedinicni/aplikacija.test.js          (import presretača; N-01)
.env.example
README.md
skripte/provjera.ps1
docs/TRACEABILITY.md                               (samo redovi Iteracije 2)
docs/IMPLEMENTATION_LOG.md
docs/TEST_REPORT.md
```

`i02_brief.md` i `i02_plan.md` su dodati na grani u koracima Orchestrator-a i Planner-a; Builder je mijenjao samo sekciju 15 plana.
(Ispravka FIX LOOP 1, R-08: ranije su `i02_plan.md` naveden kao „izmijenjen”, a `i02_brief.md` kao „netaknut”.)

Netaknuti: `docs/srs/*` (SHA-256 provjeren), `CLAUDE.md`, katalog grešaka, `GreskaApi.js`,
`obradaGresaka.js`, `dnevnik.js`, `korelacija.js`, `kolekcije.js`, `firebase/inicijalizacija.js`, seed, `package.json`/`package-lock.json`, Android.

### Odstupanja od plana

**OD-1 — `displayName` se broji u UTF-16 jedinicama, ne u code point-ima (odluka i02/P-3).**
- Šta: Backend broji `String.prototype.length`. Granični slučajevi u I02-T06 i I02-T15 su postavljeni prema stvarnom `size()`:
  50 × 😀 (100 UTF-16 jedinica) → ALLOW / 201; 51 i 100 × 😀 → DENY / 422 `INVALID_DISPLAY_NAME`; 100 × `š` (BMP) → ALLOW / 201.
  Plan (8.2) je pretpostavljao code point-e (100 × 😀 → ALLOW / 201).
- Zašto: odluka Orchestrator-a i02/P-3 — normativno je `size()` iz §31, Backend se usklađuje sa Rules, ne obrnuto.
- Dokaz: sonda nad Firestore emulatorom (privremeni skript, nije commit-ovan): 25/26/33/34/50 × 😀 ALLOW, 51 i 100 × 😀 DENY;
  100 × `š` ALLOW, 101 DENY; 100 × `€` ALLOW, 101 DENY. Prvi RULE test sa pretpostavkom code point-a je pao (TEST_REPORT).
- Ponašanje `size()` je utvrđeno samo u emulatoru (poznato ograničenje).

**OD-2 — Konstanta `ROK_ZAVISNOG_SERVISA_MS` je dodata u commit-u koraka 3, ne koraka 2.**
- Plan (sekcija 4) je navodi u `konfiguracija.js`; korak 2 opisuje samo 5.6. Konstanta je uvedena zajedno sa prvim korisnikom
  (`greskeServisa.test.js`). Ne mijenja opseg ni ugovor.

**OD-3 — Dijagnostika stvarnog `err.code` za nedostupan Auth u I02-T11 (b) koristi privremenu Admin aplikaciju.**
- Plan (sekcija 3) navodi da se Auth emulator host čita pri svakom pozivu. Za već kreiranu Auth instancu to se nije pokazalo
  (prva verzija dijagnostike je vratila „PRIHVAĆEN” iako je host promijenjen); nova Admin aplikacija kreirana poslije izmjene
  env-a vraća `app/network-error`. Asercije testa se ne oslanjaju na dijagnostiku (testiraju spawn-ovan proces); produkcija
  čita env pri startu. Tehnička dopuna testa, bez promjene definicije testa.

**OD-4 — Smoke 401 je u istom koraku `provjera.ps1` kao smoke 404** (isti pokrenut proces; naziv koraka proširen).

Ostalo po planu: `maxAttempts` ostaje 5 (I02-T09 zelen u svim izvršavanjima); nijedan Auth kod nije dodat (svi stvarni kodovi
iz I02-T02/T03/T11 su već u listi); stvaran kod za nedostupan Auth (`app/network-error`) je u listi 503, pa nije bilo zastoja (plan 5.5).

### Status otvorenih pitanja iz plana

| Pitanje | Status |
|---|---|
| i02/P-1 ugovor API-01 | Riješeno po odluci: 201/200, tijelo sa 5 polja; API-T01, I02-T09, I02-T14 PASS. |
| i02/P-2 djelimično stanje | Riješeno: varijanta A; I02-T14 (a), (b), (c) i I02-T10 PASS. |
| i02/P-3 dužina displayName | Riješeno: `size()` u emulatoru broji UTF-16 jedinice → Backend `.length` (OD-1). |
| i02/P-4 `VERZIJA_USLOVA` | Riješeno: obavezna, bez podrazumijevane vrijednosti; I01-T06 samo proširen. |
| i02/P-5 rok i mapiranje | Riješeno: 10 s; I02-T11 (a) i (b) PASS. |
| i02/P-6 neispravan JSON bez token-a | Riješeno: 422 `INVALID_REQUEST`; I02-T16 PASS. |
| i02/P-7 šema Bearer | Riješeno: case-insensitive; I02-T02 PASS (uklj. pozitivnu kontrolu `bearer`). |
| i02/P-8 oznake | Prihvaćeno: I02-T01 … I02-T16. |
| i02/P-9 checkRevoked u emulatoru | Prihvaćeno kao ograničenje; mutacija M1 preživljava (TEST_REPORT); `verifyIdToken(token, true)` provjeren inspekcijom. |
| N-01 (backlog i01) | Urađeno kao test bez izmjene produkcionog koda; M-R01c obara test. |
| N-02 (backlog i01) | Ne ispravlja se (poznato ograničenje, ispod). |

### Ograničenja za buduće iteracije

- **Iteracija 7 (i02/P-2):** u DELETE workflow-u `users/{uid}` (sa `DELETION_IN_PROGRESS`) mora biti POSLJEDNJI obrisani Firestore
  dokument prije brisanja Auth naloga, da prekid brisanja nikad ne ostavi samo `loyaltyAccounts/{uid}`, koje bi init „oživio”
  (init iz stanja „postoji samo loyaltyAccounts” kreira `users` i zadržava bodove).
- **i02/P-5:** kasni commit transakcije poslije odgovora 503 (istek roka) je prihvatljiv SAMO zato što je init idempotentan.
  To nije opšte pravilo: kasnije mutacije (purchase, issue, redeem, cancel, delete) moraju same obezbijediti tačno ponašanje
  pri isteku roka (eksplicitna idempotentnost).

### Poznata ograničenja

- Emulator token-i nisu potpisani: odbijanje token-a sa pogrešnim potpisom (ili izmijenjenim payload-om) ne može se testirati
  u emulatoru (brief, tačka 5). Zaštita na startu (I02-T13) sprječava emulator režim van `demo-` projekta.
- i02/P-9: u emulator režimu Admin SDK uvijek provjerava opoziv i onemogućenje, pa test ne razlikuje `verifyIdToken(token, true)`
  od `verifyIdToken(token)`; upotreba `true` se provjerava inspekcijom (`backend/src/posrednici/autentikacija.js`).
- Ponašanje `size()` (UTF-16 jedinice) je utvrđeno nad Firestore emulatorom; produkcioni Rules engine nije dostupan testovima.
- Firestore na zatvorenom portu: gRPC klijent ponavlja konekciju, pa odgovor 503 stiže tek po isteku roka (~10 s), ne odmah.
- `MetadataLookupWarning` u procesima bez kredencijala (kao i01): produžava prvi poziv Admin SDK-a za ~3–4 s.
- N-02 (backlog i01, ne ispravlja se po odluci): seed CLI visi ako na `FIRESTORE_EMULATOR_HOST` sluša HTTP servis koji nije
  Firestore emulator (provjera dostupnosti prolazi, a gRPC poziv ne završava).
- `provjera.ps1`: kad se skripta pokreće sa preusmjerenim izlazom u procesu koji čeka EOF, Gradle daemon (naslijeđen handle)
  zadržava pipe otvorenim i pozivalac čeka; skripta sama završava normalno (TEST_REPORT). Ne utiče na direktno pokretanje.
- Ostala ograničenja iz i01 (ranjivosti razvojnih zavisnosti, `npm warn install-scripts`, putanja JBR-a) i dalje važe.

### FIX LOOP 1 (nalazi iz `docs/iteracije/i02_review.md`, commit 1759848)

Uloga: BUILDER, 2026-10-16. Opseg po odluci Orchestrator-a (2026-10-16): R-02 i R-04 ispraviti; R-01, R-05 i R-06 samo test;
R-03, R-07 i R-08 samo dokumentacija. Nijedan novi paket, kod greške ni endpoint. Detalji izvršavanja (crveno/zeleno, mutacije):
`docs/TEST_REPORT.md`, sekcija „Iteracija 2 — FIX LOOP 1”.

| Nalaz | Izmjena | Fajlovi | Test |
|---|---|---|---|
| R-01 (P2) | Samo test. 503 pod kontencijom je dozvoljen ishod (i02/P-5, init je idempotentan). I02-T09: nijedan 500; statusi ∈ {200, 201, 503} (503 sa tačnim tijelom `SERVICE_UNAVAILABLE`); najviše jedan 201; sva 200/201 tijela identična; na kraju tačno 1 `users` i 1 `loyaltyAccounts`, 0/0, ledger prazan; naknadni sekvencijalni init → 200 sa istim tijelom. Produkcioni kod nepromijenjen. | `backend/test/emulator/inicijalizacijaNaloga.test.js` | I02-T09 |
| R-02 (P2) | Jedan rok `ROK_ZAVISNOG_SERVISA_MS` (10 000 ms) za cijeli zaštićeni zahtjev: posrednik autentikacije na ulazu postavlja `res.locals.rokDo`; `verifyIdToken` dobija `rokDo − sada`; ruta prosljeđuje `res.locals.rokDo` servisu; `inicijalizujNalog` ne pokreće transakciju kad je preostalo vrijeme ≤ 0 (→ 503 `SERVICE_UNAVAILABLE`), a inače joj daje samo preostalo vrijeme. Komentar u `konfiguracija.js`: „za cijeli zaštićeni zahtjev”. Test pomoćnik `sporProksi` (TCP proksi sa kašnjenjem po komadu, oba smjera). | `backend/src/posrednici/autentikacija.js`, `backend/src/rute/nalog.js`, `backend/src/servisi/inicijalizacijaNaloga.js`, `backend/src/konfiguracija/konfiguracija.js`, `backend/test/pomocnici/procesBackenda.js`, `backend/test/emulator/nedostupnostServisa.test.js` | I02-T11 (c): Auth spor 4 000 / 2 000 ms + Firestore „crna rupa” → 503 za < 12 s. Prije: 18 081 / 14 057 ms (crveno); poslije: 10 037 / 10 029 ms. |
| R-03 (P2) | Samo dokumentacija (poznato ograničenje, ispod). | ovaj fajl, `docs/TEST_REPORT.md` | — |
| R-04 (P2) | `jeIspravnoIme` dodatno traži `displayName.isWellFormed()`; usamljeni surogat → 422 `INVALID_DISPLAY_NAME`, ništa upisano. Brojanje `.length` (OD-1), bez trim-a i normalizacije, nepromijenjeno. | `backend/src/validacija/tijeloInita.js`, `backend/test/emulator/inicijalizacijaNaloga.test.js` | I02-T06: `"\uD800"` i `"a\uDC00"` → 422. Prije: 503 poslije ~10 s (crveno; review je u svom okruženju dobio 500); poslije: PASS. |
| R-05 (P2) | Samo test: korisnik A sa `?uid=<B>`, `X-User-Id: <B>`, `X-Uid: <B>` → 201/200 sa stanjem A; `users/B` i `loyaltyAccounts/B` ne postoje. | `backend/test/emulator/inicijalizacijaNaloga.test.js` | I02-T04 (novi test); mutacija M16 obara test. |
| R-06 (P2) | Samo test: omotač transakcije čiji `getAll` za postojeći dokument vraća snimak „ne postoji”, zasebno za `users/{uid}` i za `loyaltyAccounts/{uid}` → 500 `INTERNAL_ERROR` bez stack-a, oba dokumenta nepromijenjena (`deepStrictEqual`). | `backend/test/emulator/inicijalizacijaNaloga.test.js` | I02-T08 (nova varijanta); M04 (oba `tx.create` → `tx.set`) i jednolinijska varijanta (samo `loyaltyAccounts`) obaraju test. |
| R-07 (P3) | Samo dokumentacija (README, sekcija API; ovdje ispod). Ponašanje nepromijenjeno. | `README.md`, ovaj fajl | — |
| R-08 (P3) | Ispravljena rečenica o `i02_brief.md` / `i02_plan.md` u sekciji „Fajlovi” iznad. | ovaj fajl | — |

Commit-i FIX LOOP 1:

| Commit | Nalaz |
|---|---|
| `96df140` i02 fix: R-01 I02-T09 dozvoljava 503 uz provjeru konzistentnosti | R-01 |
| `a487c8a` i02 fix: R-02 jedan rok za cijeli zaštićeni zahtjev (I02-T11 c) | R-02 |
| `6c0139a` i02 fix: R-04 displayName mora biti ispravan UTF-16 | R-04 |
| `f351e1e` i02 fix: R-05 test da se UID ne uzima iz query-ja ni zaglavlja | R-05 |
| `be9ba49` i02 fix: R-06 test da init ne prepisuje postojeći dokument | R-06 |
| (ovaj commit) i02 fix: TEST_REPORT, IMPLEMENTATION_LOG, README i sljedivost za FIX LOOP 1 | R-01 ograničenje, R-03, R-07, R-08 |

Poznata ograničenja (dopuna FIX LOOP 1):

- **R-01 — latencija i 503 pod kontencijom (prihvaćeno ponašanje, i02/P-5).** Svaki init, i ponovljeni koji ništa ne piše, ide kroz
  transakciju koja zaključava oba dokumenta (`maxAttempts: 5`, rok 10 s). Izmjereno u review-u (`docs/iteracije/i02_review.md`, 2.3 (f)):
  30 paralelnih init-a za isti uid — u 1 od 12 serija 9 odgovora 503 poslije 10 063–10 153 ms; u ostalim serijama najduži odgovor
  3,5–7,4 s (N=30) i 3,5–6,4 s (N=10); I02-T09 u `provjera.ps1` traje 10,8–18,4 s za 3 × 10 zahtjeva. Stanje je uvijek konzistentno
  (1 `users`, 1 `loyaltyAccounts`, 0/0, nijedan 500); klijentski retry je bezbjedan jer je init idempotentan.
- **R-03 — van emulatora greška preuzimanja javnih ključeva daje 401 umjesto 503.** Kad Admin SDK ne može preuzeti javne ključeve
  (`KEY_FETCH_ERROR`), prijavljuje `auth/argument-error`, koji se mapira na `UNAUTHENTICATED` (i02/P-5 lista). U emulatoru je neizvodljivo
  (emulator ne preuzima ključeve; klasa P-9). Rješava se uz otvoreno pitanje O-2 (demo okruženje), prije Iteracije 9. Kod nije mijenjan.
- **R-07 — prazno JSON tijelo.** Tijelo `{}` (ili prazno tijelo) uz `Content-Type: application/json` → `422 INVALID_DISPLAY_NAME`
  (odobreni redoslijed provjera: nepoznata polja, pa `displayName`, pa `acceptedTermsVersion`); tijelo bez JSON `Content-Type` → `422 INVALID_REQUEST`.
- I02-T11 (c) zavisi od toga da spori proksi (kašnjenje po komadu u oba smjera) propusti verifikaciju token-a prije isteka roka;
  izmjereno ukupno vrijeme do 503 je ~10,03 s, pa je granica testa 12 s.

---

## Iteracija 3 — Purchase / EARN

Grana `iteracija-03`. Brief: `docs/iteracije/i03_brief.md`. Plan: `docs/iteracije/i03_plan.md`
(odobren uz odluke i03/P-1 … i03/P-15 i ispravke K-1, K-2, sekcija 15). Uloga: BUILDER, 2026-10-16.

### CHANGELOG

- Firestore Security Rules (§25.4, §25.5, §25.8, §31, NFR-03): blokovi `/purchases/{purchaseId}`, `/loyaltyLedger/{eventId}` i
  `/notifications/{notificationId}` doslovno iz §31 normativnog `.docx`-a, na mjestima kao u §31 (automatsko poređenje: `JEDNAKO_DOCX`,
  `IDENTICNO_PLANU`). Rules testovi RULE-T08, RULE-T10, RULE-T11 i I03-T20 (`firebase/tests/kupovineObavjestenjaLedger.test.js`);
  I01-T10 uklonjen u potpunosti (zamjenjuje ga RULE-T11).
- Konfiguracija POS ključeva (§3.4, NFR-02, i03/P-2): obavezna `POS_API_KLJUCEVI=stationId:ključ[,…]`; ključ kanonski base64url od
  32 bajta (43 znaka) sa najmanje 16 različitih znakova; `stationId` `^[A-Za-z0-9.-]{1,32}$` (O-13, bez `_`); ponovljen ključ ili
  `stationId` odbijen; poruke imenuju varijablu i stavku, nikad vrijednost. Konfiguracija čuva samo SHA-256 otiske (`posStanice`).
  `.env.example` ima placeholder sa kojim Backend ne startuje.
- POS posrednik `napraviProvjeruPosKljuca(posStanice)` (i03/P-3): ključ samo iz zaglavlja `X-POS-API-Key`; SHA-256 +
  `crypto.timingSafeEqual`, petlja kroz sve stanice bez ranog izlaska; `stationId` isključivo iz mape (`res.locals.stationId`);
  rok zahtjeva (i02 R-02) počinje u posredniku; bez `posStanice` → 500 (i03/P-11). Vezan samo na rutu `POST /pos/purchases`.
- Validacija tijela API-02 (i03/P-4 … P-6, P-9): tačno šest polja (bilo koje drugo → `INVALID_REQUEST`), redoslijed provjera po tabeli
  5.3; vlastiti RFC 3339 parser `occurredAt` (obavezna zona, kalendarska provjera, opseg `Timestamp`-a, najviše +5 min); format
  `loyaltyUid` → 404 bez pristupa bazi; `-0` → `0`. Validacija uvijek prethodi provjeri idempotentnosti (dopuna i03/P-6).
- Bodovanje i tekst notifikacije (§1.5, i03/P-8): `izracunajBodove`, `oblikRijeciBod` (bod/boda/bodova), `tekstObavjestenja`.
- Servis `evidentirajKupovinu` (§9, §10, §11, §7.3, O-3, O-4, O-10, O-12, O-13, i03/P-7, i03/P-15): JEDNA Firestore transakcija;
  prvo se čita `purchases/{stationId}__{posTransactionId}` (postoji → poređenje `uid`, `volumeMl`, `amountMinor`, `currency`:
  isti → prvi rezultat (200), različit → 409; `stationId`/`posTransactionId` dokumenta ≠ zahtjeva → 500); inače provjera ACTIVE
  naloga (404), provjera nekonzistentnog stanja (ledger/notifikacija bez purchase-a → 500), provjera ispravnosti balansa (→ 500),
  pa četiri upisa: `tx.create` purchase, `tx.update` `loyaltyAccounts` (`availablePoints`, `updatedAt`), `tx.create`
  `loyaltyLedger/earn_{purchaseId}` (EARN), `tx.create` `notifications/earn_{purchaseId}`; jedan serverski timestamp za sva četiri;
  bez preostalog roka transakcija se ne pokreće (503).
- Ruta `POST /api/v1/pos/purchases` (§26 API-02, i03/P-1): 201 za prvi zahtjev, 200 za retry; tijelo tačno
  `{ purchaseId, stationId, posTransactionId, volumeMl, amountMinor, currency, earnedPoints, occurredAt }` iz sačuvanog dokumenta.
- `napraviAplikaciju({ servisi, verzijaUslova, posStanice })`; `pokreni.js` prosljeđuje `posStanice` iz konfiguracije.
- Testovi backend-a: I03-T01 (a), I03-T03 (a), I03-T07 (a), I03-T15, I03-T21 (unit); API-T02 … API-T04, I03-T01 (b), I03-T02 … I03-T14,
  I03-T16 … I03-T19, I03-T22 (emulator). Pomoćnici `test/pomocnici/posKljuc.js` i `test/pomocnici/omotacBaze.js`.
  I01-T06, I02-T13 i I02-T11 prošireni samo ulazom (`POS_API_KLJUCEVI`); I01-T06 (a) dobio asercije da poruka imenuje i `POS_API_KLJUCEVI`.
- `skripte/provjera.ps1`: `POS_API_KLJUCEVI` generisan u toku izvršavanja (bez ispisa, vraća se na kraju; K-2 u koraku 2), treći smoke
  `POST /api/v1/pos/purchases` bez ključa → 401 `UNAUTHENTICATED_POS` (korak 7). README: POS ključevi, komanda za generisanje, API-02,
  pravilo „validacija prethodi idempotentnosti” (i03/P-6).
- Dokumentacija: `docs/TEST_REPORT.md` (sekcija i03), `docs/TRACEABILITY.md` (redovi Iteracije 3), ovaj unos.

Nijedan novi npm paket, kod greške ni endpoint; katalog grešaka, `GreskaApi`, centralni rukovalac, `dnevnik.js`, `greskeServisa.js`,
`inicijalizacijaNaloga.js`, `posrednici/autentikacija.js` i ugovor API-01 nepromijenjeni.

### Commit-i

| Commit | Korak plana |
|---|---|
| `01d574b` i03: odobrenje plana i odluke Orchestrator-a | sekcija 15 |
| `5f924d0` i03: Security Rules za purchases, loyaltyLedger i notifications doslovno po §31 (RULE-T08, T10, T11) | 1 |
| `1f55369` i03: POS ključevi iz konfiguracije sa provjerom formata i jedinstvenosti (I03-T15) | 2 (uklj. K-2) |
| `15a18cd` i03: obračun bodova po §1.5, tekst notifikacije i strogo čitanje occurredAt | 3 |
| `f539574` i03: POS autentikacija X-POS-API-Key, stroga validacija tijela i POST /pos/purchases u jednoj Firestore transakciji … | 4 i 5 (jedan commit, dozvoljeno planom) |
| `228ade1` i03: testovi isteklog roka prije transakcije (F1-01) i loga bez POS ključa (I03-T16, I03-T17) | 6 |
| `9adad02` i03: provjera.ps1 sa POS ključem iz izvršavanja i smoke 401 za /pos/purchases; README | 7 |
| `35c35f6` i03: ojačan RULE-T10 i izolacija I03-T11/T12 od kasnog commit-a poslije 503 (nalazi kontrolnih mutacija) | 8 (OD-4, OD-5) |
| (ovaj commit) i03: TEST_REPORT, IMPLEMENTATION_LOG i sljedivost za iteraciju 3 | 9 |

### Fajlovi

Dodati:

```
firebase/tests/kupovineObavjestenjaLedger.test.js
backend/src/konfiguracija/posKljucevi.js
backend/src/posrednici/posAutentikacija.js
backend/src/validacija/tijeloKupovine.js
backend/src/validacija/vrijemeKupovine.js
backend/src/servisi/bodovanje.js
backend/src/servisi/evidencijaKupovine.js
backend/src/rute/kupovine.js
backend/test/pomocnici/posKljuc.js
backend/test/pomocnici/omotacBaze.js
backend/test/jedinicni/posAutentikacija.test.js
backend/test/jedinicni/bodovanje.test.js
backend/test/jedinicni/vrijemeKupovine.test.js
backend/test/emulator/posAutentikacija.test.js
backend/test/emulator/kupovina.test.js
backend/test/emulator/kupovinaAtomicnost.test.js
backend/test/emulator/rokPrijeTransakcije.test.js
backend/test/emulator/logBezPosKljuca.test.js
```

Izmijenjeni:

```
firebase/firestore.rules
firebase/tests/podrazumijevanaZabrana.test.js      (I01-T10 uklonjen)
backend/src/aplikacija.js
backend/src/pokreni.js
backend/src/konfiguracija/konfiguracija.js
backend/test/jedinicni/konfiguracija.test.js        (I01-T06, I02-T13 (a): proširenje ulaza; I03-T15 (a))
backend/test/jedinicni/pokretanjeBackenda.test.js   (I02-T13 (b): proširenje ulaza; I03-T15 (b))
backend/test/emulator/nedostupnostServisa.test.js   (samo env spawn-ovanog procesa)
.env.example
README.md
skripte/provjera.ps1                                (UTF-8 sa BOM-om, CRLF)
docs/TRACEABILITY.md                                (samo redovi Iteracije 3)
docs/IMPLEMENTATION_LOG.md
docs/TEST_REPORT.md
```

`i03_brief.md` i `i03_plan.md` su dodati na grani u koracima Orchestrator-a i Planner-a; Builder je mijenjao samo sekciju 15 plana.
(Ispravka FIX LOOP 1, R-05: ranije je `i03_plan.md` naveden kao „izmijenjen”, a `i03_brief.md` kao „netaknut”.)

Netaknuti: `docs/srs/*` (SHA-256 provjeren), `CLAUDE.md`, katalog grešaka, `GreskaApi.js`, `obradaGresaka.js` (do FIX LOOP 1, R-04),
`dnevnik.js`, `greskeServisa.js`, `korelacija.js`, `kolekcije.js`, `firebase/inicijalizacija.js`, `inicijalizacijaNaloga.js`,
`posrednici/autentikacija.js`, `rute/nalog.js`, `validacija/tijeloInita.js`, seed, `package.json`/`package-lock.json`, Android.

### Odstupanja od plana

**OD-1 — Sekcija 15 nije postojala u `i03_plan.md`.** Zadatak traži zamjenu sadržaja sekcije „## 15. Odluke Orchestrator-a (odobrenje plana)”;
plan se završavao sekcijom 14. Sekcija je dodata na kraj sa tačno zadatim naslovom i doslovnim tekstom (kao u i02). Commit `01d574b`.

**OD-2 — Koraci 4 i 5 su jedan commit.** Testovi koraka 4 (I03-T01 (b) pozitivno: ključ SIM02 → 201; I03-T22) traže servis iz koraka 5,
pa bi commit koraka 4 bio crven (plan, korak 4 to dozvoljava).

**OD-3 — Korak 6 nije mogao biti crven prije koda.** Plan (korak 6) navodi „samo testovi (kod već postoji)”. Test-first je za I03-T16 i
I03-T17 dokazan kontrolnim mutacijama M24, MR02b i M25 (TEST_REPORT), koje obaraju te testove.

**OD-4 — RULE-T10 ojačan (M31).** Plan traži da M31 (`changedOnly(['readAt', 'title'])`) obori RULE-T10. Prvobitni RULE-T10 mijenja
samo `title`/`body` (bez `readAt`), što pod M31 i dalje pada na `request.resource.data.readAt is timestamp`, pa je M31 obarao samo I03-T20.
RULE-T10 je dopunjen slučajevima „`readAt: serverTimestamp()` + `title`” i „+ `body`” → DENY; sada M31 obara RULE-T10 i I03-T20.

**OD-5 — I03-T11/T12 čekaju kraj svih transakcija prije provjera (izolacija testova).** Tokom mutacionog izvršavanja M19 (nad jednim
dugo pokrenutim emulatorom) I03-T12 je jednom pao sa `102 !== 60`: u I03-T11 je jedan od 10 paralelnih zahtjeva dobio dozvoljeni 503,
a njegova transakcija se commit-ovala tek poslije `ocistiEmulatore` za I03-T12 (prihvaćeni „kasni commit”, brief tačka 5 i I03-T13) i dodala
42 boda novom nalogu. To je curenje stanja između testova, ne greška proizvoda. `omotacBaze` je dobio `sveTransakcijeZavrsene`, a I03-T11 i
I03-T12 rade kroz omotač bez opcija i čekaju kraj svih transakcija prije asercija (time I03-T11 provjerava i stanje POSLIJE eventualnog
kasnog commit-a: i dalje tačno 1 purchase, 1 EARN, 1 notifikacija). Bez mutacije I03-T11/T12 nisu pali ni u jednom izvršavanju.

**OD-6 — I03-T10 (e) provjerava i da transakcija ne pokuša nijedan upis.** Bez te asercije M18 (uklonjena provjera postojećeg ledger
eventa/notifikacije) preživljava, jer `tx.create` ionako obara commit sa `ALREADY_EXISTS` (isto rezonovanje kao K-1). Dodata je asercija
`omotac.upisi` = `[]` (provjera nekonzistentnog stanja ide PRIJE upisa, plan 5.5).

**OD-7 — Dodatni test slučajevi van tabele plana (samo pojačanje):** I03-T01 (b) „dva ista ispravna zaglavlja” → 401; I03-T07 (a)
dodatni neispravni oblici (`+0200`, `+02`, `.Z`, vodeći/završni razmak, završni prelom, ne-ASCII cifre, godina 0000, prošireni oblik godine);
I03-T10 (d) i drugi `posTransactionId` u dokumentu; I03-T10 (f) `availablePoints: 1.5` i `reservedPoints: -1`; I03-T16 provjerava i
`brojPristupa === 0` (ne samo `brojTransakcija`).

**OD-8 — Format `loyaltyUid` `^__.*__$` provjeren sa zastavicom `s`** (`.` obuhvata i prelom reda), da se vrijednost tipa `"__\n__"`
ne propusti do Firestore-a; strože od doslovnog regex-a iz 5.3, isti smisao (rezervisani ID-evi).

### Status otvorenih pitanja iz plana

| Pitanje | Status |
|---|---|
| i03/P-1 ugovor API-02 | Riješeno po odluci: 201/200, tijelo sa 8 ključeva tim redoslijedom; API-T02, API-T03, I03-T13 PASS. |
| i03/P-2 konfiguracija ključeva | Riješeno: `POS_API_KLJUCEVI`, 43 znaka kanonski, ≥ 16 različitih znakova; I03-T15 PASS. |
| i03/P-3 konstantno vrijeme | Riješeno: SHA-256 + `timingSafeEqual`, petlja bez ranog izlaska; I03-T01 (a) PASS; M02, M03 ubijene. |
| i03/P-4 format `occurredAt` | Riješeno: vlastiti parser; I03-T07 (a)/(b) PASS; M11 ubijena. |
| i03/P-5 format `loyaltyUid` | Riješeno (OD-8); I03-T09 PASS; M14 ubijena. |
| i03/P-6 redoslijed + dopuna | Riješeno; I03-T02 (redoslijed), I03-T18 (validacija na retry-ju, 0 pristupa bazi) PASS; README i ovaj unos. |
| i03/P-7 ledger eventId | Riješeno: `earn_{purchaseId}`; prefiksi za i04–i06 nisu obavezujući. |
| i03/P-8 tekst notifikacije | Riješeno; I03-T21 PASS. |
| i03/P-9 `-0` | Riješeno; I03-T05 PASS; M09 ubijena. |
| i03/P-10 oznake | Prihvaćeno: I03-T01 … I03-T22. |
| i03/P-11 bez `posStanice` | Riješeno: 500; I03-T22 PASS. |
| i03/P-12 whitespace / duplo zaglavlje | Prihvaćeno; I03-T01 (b) PASS. |
| i03/P-13 trajanje I03-T13 | Prihvaćeno: ~10,7 s. |
| i03/P-14 poređenje Rules sa `.docx` | Urađeno privremenom skriptom van repoa: `JEDNAKO_DOCX`, `IDENTICNO_PLANU` (TEST_REPORT). |
| i03/P-15 neispravan nalog | Riješeno: 500, ništa upisano; I03-T10 (f) PASS. |
| K-1 (I03-T10 (c2)) | Urađeno; M17 obara (c2). |
| K-2 (`provjera.ps1` u koraku 2) | Urađeno; `provjera.ps1` → 0 na stanju koraka 2. |
| F1-01 (backlog i02) | Urađeno kao I03-T16 (init i kupovina); MR02b i M24 ubijene. |

### Ograničenja za buduće iteracije

- **i04–i06 (i03/P-7):** ledger `eventId` je `<tip>_<id>`; prefiks `earn_` je zauzet (`earn_{purchaseId}`). Prijedlog `reserve_`, `redeem_`,
  `release_` nije obavezujući — odluka pripada tim iteracijama.
- **i06:** isti `napraviProvjeruPosKljuca(posStanice)` se veže na rutu redeem (samo na rutu, ne na prefiks `/pos`); mapa i rok se ne dupliraju.
- **i07 (O-10a):** postojeći purchase sa `uid: null` i retry sa `loyaltyUid` → po i03 kodu 409 (poređenje `uid`); i07 odlučuje i mijenja.
- **i10:** Android upit `purchases`/`notifications` mora imati `where('uid', '==', auth.uid)` i `limit ≤ 20 / ≤ 50`; `orderBy` traži composite indeks.
- **Opšte (kasni commit):** odgovor 503 ne znači da mutacija nije upisana. Za kupovinu je to bezbjedno jer je idempotency ključ par
  `(stationId, posTransactionId)` (I03-T13). Testovi koji dozvoljavaju 503 pod kontencijom moraju sačekati kraj svih transakcija prije
  provjera i prije sljedećeg testa (OD-5).

### Poznata ograničenja

- i03/P-12: HTTP parser uklanja okolni whitespace vrijednosti `X-POS-API-Key`; unutrašnji znakovi se porede tačno; duplo zaglavlje → 401.
- i03/P-13: I03-T13 traje ~10,7 s (rok je konstanta).
- JSON brojevi: `1000.0` i `1e3` su u JSON-u isti broj kao `1000` i prihvataju se (provjera nad parsiranom vrijednošću); dokumentovano u README-u.
- `occurredAt`: mala slova `t`/`z` (dozvoljena u RFC 3339) se odbijaju — strože, odobreno (i03/P-4); donja granica je opseg `Timestamp`-a (0001-01-01).
- Konstantno vrijeme se dokazuje brojem poređenja i inspekcijom, ne mjerenjem vremena (mjerenje bi bilo nestabilno).
- Ponašanje transakcija pod kontencijom (`maxAttempts: 5`, 503) i `ALREADY_EXISTS` na `tx.create` utvrđeni su nad emulatorom.
- `I02-T09` (i02, nepromijenjen) dozvoljava 503 kao i I03-T11 i teoretski može ostaviti kasni commit poslije svog kraja; nije uočeno, a
  i02 testovi se po pravilima ne mijenjaju (napomena za Reviewer-a / FIX LOOP).
- Ostala ograničenja iz i01/i02 (nepotpisani emulator token-i, `MetadataLookupWarning`, `npm warn install-scripts`, Gradle daemon i preusmjeren
  izlaz `provjera.ps1`, N-02) i dalje važe.

### FIX LOOP 1 (nalazi iz `docs/iteracije/i03_review.md`, commit f3659f6)

Uloga: BUILDER, 2026-10-16. Opseg po odluci Orchestrator-a (2026-10-16): R-01, R-02 i R-03 samo test; R-04 ispravka koda (odluka D-3);
R-05 samo dokument; napomena review-a o kontenciji kao poznato ograničenje. Nijedan novi paket, kod greške ni endpoint. Detalji izvršavanja
(crveno/zeleno, mutacije): `docs/TEST_REPORT.md`, sekcija „Iteracija 3 — FIX LOOP 1”.

| Nalaz | Izmjena | Fajlovi | Test |
|---|---|---|---|
| R-01 (P2) | Samo test. Ključ SIM01 sa `?stationId=SIM02`, sa zaglavljem `X-Station-Id: SIM02` i sa zaglavljem `stationId: SIM02` (tri zasebna zahtjeva, `posTransactionId` Q1/Q2/Q3) → 201, `stationId` `SIM01`, `purchaseId` `SIM01__…`, `purchases/SIM01__…`.`stationId` = `SIM01`, `purchases/SIM02__…` ne postoji. Produkcioni kod nepromijenjen. | `backend/test/emulator/posAutentikacija.test.js` | I03-T01 (b) (novi test); M02 i M02b ubijene |
| R-02 (P3) | Samo test. `provjeriTijeloKupovine(tijelo, sadaMs)` sa fiksnim `sadaMs`: `occurredAt` = `sadaMs + 300 000` ms → bez greške (`occurredAtMs` tačan); `+ 300 001` ms → `GreskaApi` `INVALID_OCCURRED_AT`. | `backend/test/jedinicni/vrijemeKupovine.test.js` | I03-T07 (c) (novi unit test); M06 ubijena |
| R-03 (P3) | Samo test. I03-T09 (format, 0 pristupa bazi) dopunjen sa `"____"` i `"__\n__"` → 404 `LOYALTY_ACCOUNT_NOT_FOUND`. | `backend/test/emulator/kupovina.test.js` | I03-T09; M25 i M25s ubijene |
| R-04 (P3) | Polje `putanja` u logu greške više ne sadrži sirovu putanju zahtjeva: za pogođenu rutu bilježi se `req.route.path` — šablon relativan na ruter `/api/v1` (utvrđeno probom nad Express 5.2.1: u centralnom rukovaocu je `req.route.path` = `/pos/purchases`, a `req.baseUrl` = `""`), za zahtjev bez pogođene rute (NOT_FOUND, greška JSON parsera prije rutera, nepodržan metod) fiksno `(nepoznata ruta)`. Ostala polja loga i `dnevnik.js` nepromijenjeni. README: rečenica o sadržaju loga. | `backend/src/greske/obradaGresaka.js`, `backend/test/emulator/logBezPosKljuca.test.js`, `README.md` | I03-T17 (a) i (b): `POST /api/v1/pos/purchases/<K1>` sa ispravnim zaglavljem i `POST /api/v1/pos/<K2>` bez zaglavlja → 404 `NOT_FOUND`, log bez K1/K2, `putanja` = `(nepoznata ruta)`; 401 na `/pos/purchases` → `putanja` = `/pos/purchases`. Prije: crveno (`log sadrži POS ključ`); poslije: PASS; mutacija `putanja: req.path` ubijena. |
| R-05 (P3) | Ispravljena klasifikacija `i03_brief.md` / `i03_plan.md` u sekciji „Fajlovi” iznad. | ovaj fajl | — |

Nijedan postojeći test i01/i02/i03 ne zavisi od sirove putanje u logu (`grep` po `putanja` u `backend/test`: samo lokalne promjenljive i
putanje dokumenata), pa nijedna asercija nije uklonjena ni oslabljena. I03-T17 (b) očekivani statusi prošireni sa `[201, 401, 422]` na
`[201, 401, 422, 404, 404]`.

Commit-i FIX LOOP 1:

| Commit | Nalaz |
|---|---|
| `45f6884` i03 fix: R-01 test da se stationId ne uzima iz query-ja ni zaglavlja | R-01 |
| `4bd81da` i03 fix: R-02 test uključive granice +5 min za occurredAt | R-02 |
| `235323f` i03 fix: R-03 test rezervisanih oblika loyaltyUid (____, __\n__) | R-03 |
| `5b0cfa0` i03 fix: R-04 log greške bilježi šablon rute, ne sirovu putanju | R-04 |
| (ovaj commit) i03 fix: TEST_REPORT, IMPLEMENTATION_LOG, README i sljedivost za FIX LOOP 1 | R-04 (README), R-05, poznato ograničenje |

Poznata ograničenja (dopuna FIX LOOP 1):

- **503 i latencija pod jakom kontencijom istog korisnika (prihvaćeno ponašanje po brief-u i i02/P-5).** Transakcije istog korisnika se u
  emulatoru serijalizuju (zaključavanje). Izmjereno u review-u (`docs/iteracije/i03_review.md`, sekcija 3, napomena; 2.3 (f)): 20 paralelnih
  različitih kupovina istog korisnika → 36–123 odgovora 503 (uz retry do uspjeha), trajanje 48–98 s (47,6 s i 98,2 s); 10–30 identičnih
  paralelnih povremeno daje jedan 503 (1 od 3 serije) i latenciju do ~10 s. Stanje je uvijek konzistentno (nijedan dupli EARN ni
  notifikacija, nijedan 500, zbir bodova tačan), a POS retry je bezbjedan jer je idempotency ključ `(stationId, posTransactionId)`. Za realan
  POS (jedna kupovina po korisniku u trenutku) bez uticaja; ponašanje nad produkcionim Firestore-om nije provjerljivo u emulatoru. Kod nije mijenjan.
- **R-04:** log bilježi šablon rute relativan na ruter `/api/v1` (bez prefiksa `/api/v1`), npr. `/pos/purchases`, `/account/init`; za
  zahtjev na postojeću putanju sa nepodržanim metodom (npr. `GET /api/v1/pos/purchases`) ruta nije pogođena, pa je `putanja` `(nepoznata ruta)`.

## Iteracija 4 — Reward issue

Grana `iteracija-04`. Brief: `docs/iteracije/i04_brief.md`. Plan: `docs/iteracije/i04_plan.md`
(odobren uz odluke i04/P-1 … i04/P-16 i ispravke K-1 … K-3, sekcija 15). Uloga: BUILDER, 2026-10-17.

### CHANGELOG

- Firestore Security Rules (§25.6, §25.7, §25.9, §31, NFR-03, D-2): blokovi `/rewardDefinitions/{rewardId}`, `/vouchers/{voucherId}` i
  `/rewardRequests/{requestKey}` doslovno iz §31 normativnog `.docx`-a, na mjestima kao u §31 (automatsko poređenje: `JEDNAKO_DOCX`,
  `IDENTICNO_PLANU`); `/redemptionRequests` ostaje za i06. Rules testovi RULE-T09 i I04-T17 (`firebase/tests/nagradeIVauceri.test.js`);
  RULE-T12 (preliminarno) nepromijenjen i zelen.
- D-5 (i04/P-8, K-1): centralni rukovalac klasifikuje `URIError` sa `status 400` (neispravno percent-kodiran parametar putanje, Express 5)
  kao `404 NOT_FOUND` — globalno, bez stack-a i bez sirove vrijednosti u logu; `putanja` u logu `(nepoznata ruta)`. Neispravan JSON ima prednost (422).
- Validacija (§13, O-15, D-4, i04/P-9): `validacija/zahtjevIzdavanja.js` — tijelo tačno `{ requestId }`, `requestId` kanonski UUID v4 malim
  slovima (regex bez zastavica), sve ostalo `422 INVALID_REQUEST`; `provjeriRewardId` → `404 REWARD_NOT_FOUND` bez pristupa bazi
  (`jeIspravanIdDokumenta` + zabrana `\p{Cc}`). `jeIspravanIdDokumenta` premještena iz `tijeloKupovine.js` u `validacija/identifikator.js`
  bez promjene logike (I03-T09 regresija zelena).
- `servisi/vauceri.js` (§14, §15, §17, §18.1, i04/P-2 … P-4, P-6): `TRAJANJE_VAUCERA_MS = 900 000`, `generisiVoucherId()` =
  `crypto.randomBytes(32).toString('hex')`, `jeIstekao(expiresAtMs, sadaMs)` (`≥`), `poredakOslobadjanja`, `izracunajRequestKey(uid, requestId)`
  (SHA-256 hex nad UTF-8 `uid:requestId`).
- Servis `izdajNagradu` (`servisi/izdavanjeNagrade.js`; §13, §13.1, §13.2, §14, §15, §17, §18.1, §7.4, §7.6, §11, O-14, O-16, i04/P-1 …
  P-7, P-12): rok prije transakcije (503 bez `runTransaction`); JEDNA transakcija: mapping prvi (isti reward → isti voucher, ništa upisano;
  drugi → 409; nekonzistentan → 500), nalog (409 / 500), definicija (500 prije 409 `REWARD_INACTIVE`), upit ACTIVE voucher-a korisnika
  (`tx.get(query)`), provjera postojećih `release_*`, lanac release-a u memoriji, bodovi (O-14: release-i se commit-uju, pa 409
  `INSUFFICIENT_POINTS` poslije commit-a), novi `voucherId` sa provjerom zauzetosti, upisi tačnim redoslijedom (1 … 2k release-i, 2k+1 nalog,
  2k+2 voucher, 2k+3 `reserve_{voucherId}`, 2k+4 mapping); svi novi dokumenti `tx.create`, nalog i voucher samo `tx.update`; jedan
  `sadaMs` po pokušaju i jedan `serverTimestamp()` po transakciji.
- Ruta `POST /api/v1/rewards/:rewardId/issue` (`rute/nagrade.js`, §26 API-03, i04/P-1): posrednik `napraviProvjeruTokena` samo na ruti;
  UID samo iz token-a; 201 za novi voucher, 200 za retry; tijelo `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt }`.
  `aplikacija.js` dodaje rutu poslije API-02.
- Testovi backend-a: I04-T02 (a), I04-T03 (a), (c), I04-T06 (a), I04-T09 (f) (unit); API-T05, API-T06, API-T07 (uz K-3), I04-T01 … I04-T16
  (emulator). `test/pomocnici/omotacBaze.js` proširen (i04/P-11): `sakrijPostojece` važi i za dokumente u rezultatu `tx.get(query)`.
- `skripte/provjera.ps1`: četvrti smoke `POST /api/v1/rewards/CAR_WASH/issue` bez token-a → 401 `UNAUTHENTICATED` (UTF-8 BOM, CRLF).
- README: API-03 (ugovor, redoslijed provjera, O-14, i04/P-13, 503 i retry istim `requestId`) i rečenica o D-5.
- Dokumentacija: `docs/TEST_REPORT.md` (sekcija i04; F1-01 ispravljen), `docs/TRACEABILITY.md` (redovi Iteracije 4, tabela O-1),
  `docs/ODLUKE.md`, ovaj unos.

Nijedan novi npm paket, kod greške ni Firestore indeks; katalog grešaka, `GreskaApi`, `dnevnik.js`, `greskeServisa.js`, posrednici,
API-01 i API-02 (ugovor i ponašanje) nepromijenjeni.

### Commit-i

| Commit | Korak plana |
|---|---|
| `ced79f0` i04: odobrenje plana i odluke Orchestrator-a | 0 |
| `972475c` i04: Security Rules za rewardDefinitions, vouchers i rewardRequests doslovno po §31 (RULE-T09) | 1 |
| `caefdff` i04: neispravno kodiran parametar putanje → 404 NOT_FOUND bez sirove vrijednosti u logu (D-5) | 2 |
| `7d9b457` i04: validacija requestId (O-15) i rewardId (D-4), generator voucherId i requestKey | 3 |
| `ea4f46e` i04: POST /rewards/{rewardId}/issue u jednoj Firestore transakciji sa reconcile-om, RESERVE i mapping-om (API-T05, API-T06) | 4 |
| `9725da8` i04: testovi double-spend-a, release-a najviše jednom, paralelnog retry-ja, kasnog commit-a i roka (API-T07) | 5 |
| `4e42bc8` i04: test loga bez tajni za API-03 i smoke 401 za /rewards/{rewardId}/issue | 6 |
| — (kontrolne mutacije M01 … M41 lokalno, bez commit-a; nijedna nije preživjela) | 7 |
| (ovaj commit) i04: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost, registar odluka i README za iteraciju 4 | 8 |

### Fajlovi

Dodati:

```
firebase/tests/nagradeIVauceri.test.js
backend/src/rute/nagrade.js
backend/src/servisi/izdavanjeNagrade.js
backend/src/servisi/vauceri.js
backend/src/validacija/identifikator.js
backend/src/validacija/zahtjevIzdavanja.js
backend/test/jedinicni/dekodiranjePutanje.test.js
backend/test/jedinicni/zahtjevIzdavanja.test.js
backend/test/jedinicni/vauceri.test.js
backend/test/emulator/izdavanjeNagrade.test.js
backend/test/emulator/izdavanjeAtomicnost.test.js
backend/test/emulator/logIzdavanja.test.js
```

Izmijenjeni:

```
firebase/firestore.rules
backend/src/aplikacija.js
backend/src/greske/obradaGresaka.js
backend/src/validacija/tijeloKupovine.js           (samo import jeIspravanIdDokumenta; ponašanje isto)
backend/test/pomocnici/omotacBaze.js               (proširenje, postojeće grane nepromijenjene)
skripte/provjera.ps1                               (UTF-8 sa BOM-om, CRLF)
README.md
docs/iteracije/i04_plan.md                         (samo sekcija 15)
docs/TRACEABILITY.md
docs/IMPLEMENTATION_LOG.md
docs/TEST_REPORT.md                                (sekcija i04; F1-01: tri putanje)
docs/ODLUKE.md
```

Netaknuti: `docs/srs/*` (SHA-256 provjeren), `docs/iteracije/i04_brief.md`, `CLAUDE.md`, `firebase/firestore.indexes.json`, katalog grešaka,
`GreskaApi.js`, `dnevnik.js`, `greskeServisa.js`, `korelacija.js`, `kolekcije.js`, posrednici, `rute/nalog.js`, `rute/kupovine.js`,
`servisi/evidencijaKupovine.js`, `servisi/inicijalizacijaNaloga.js`, seed, `package.json`/`package-lock.json`, Android, svi testovi i01–i03.

### Odstupanja od plana

**OD-1 — I04-T13 ojačan: izdavanje sa 409 se ponavlja istim `requestId`.** Po planu je 409 bio dozvoljen ishod izdavanja. U prvom izvršavanju
sva tri izdavanja su dobila 409 prije nego što su kupovine commit-ovane (nalog 0/0), pa lanac nije sadržao nijedan `REWARD_RESERVE` i test
nije provjeravao ono zbog čega postoji. Izdavanje sa `409 INSUFFICIENT_POINTS` se sada ponavlja ISTIM `requestId`-em (neuspjeh ne pravi
mapping, i04/P-13) sa pauzom 250 ms, najviše 120 pokušaja; test zahtijeva tačno 3 voucher-a, 3 mapping-a i lanac EARN/RESERVE od 0/0.
Pauza od 50 ms je u jednom punom izvršavanju izgladnjela kupovine (zaključavanje `loyaltyAccounts` u emulatoru; zaostale kupovine su poslije
`ocistiEmulatore` dobile 404), pa je povećana na 250 ms. Produkcioni kod nije mijenjan.

**OD-2 — I04-T08 (d), (e): `expiresAt` u tijelu retry-ja je iz sačuvanog (Admin SDK-om izmijenjenog) voucher-a.** Plan kaže „ostala polja tijela
jednaka prvom”, ali test sam pomjera `expiresAt` u prošlost (nema test knob-a za sat). Po i04/P-1 tijelo je slika SAČUVANOG dokumenta, pa test
provjerava `voucherId`, `rewardId`, `costPoints`, `issuedAt` jednake prvom, `status` i `expiresAt` jednake sačuvanom dokumentu; za (a)–(c)
cijelo tijelo je `deepStrictEqual` prvom.

**OD-3 — Koraci 5 i 6 nisu mogli biti crveni prije koda** (kod postoji od koraka 4; plan to predviđa za korak 5). Test-first je dokazan
kontrolnim mutacijama: M01–M07, M10, M18, M31, M32 (korak 5) i M21, M22, M36, M37 (korak 6) obaraju te testove. Isto važi za dopunu
I04-T03 (c) nad produkcionom rutom u koraku 4: D-5 je globalan od koraka 2, pa je ta dopuna bila zelena i prije rute (dokaz M21, M22).

**OD-4 — Checkpoint-i koraka 5 i 6 izvršeni uz `git stash` necommit-ovanih izmjena kasnijih koraka.** Izmjene za korake 6 i 8 (README, docs,
`provjera.ps1`, `logIzdavanja.test.js`) su pripremane tokom dugih izvršavanja; `provjera.ps1` svakog koraka je pokrenut nad stanjem tog
commit-a (ostalo sklonjeno `git stash` / van repoa), pa vraćeno.

**OD-5 — I04-T12: kad bi svih 10 zahtjeva dobilo 503 bez kasnog commit-a**, naknadni retry očekuje 201 (prvo izdavanje), inače 200; u svakom
slučaju na kraju tačno 1 voucher / 1 RESERVE / 1 mapping. Nije se desilo ni u jednom izvršavanju.

**OD-6 — Dodatni slučajevi van tabela plana (samo pojačanje):** I04-T02 (a) prazan string, objekat, niz sa objektom, `constructor`;
I04-T02 (b) `uid` u tijelu, `null` tijelo, bez tijela; I04-T03 (a) `\t`, U+009F, `...`, `_x_`, niz; I04-T03 (b) `%2E`, `%00`, `a%7Fb`;
I04-T05 `active: false` + `costPoints: 0` → 500 (i04/P-12); I04-T10 (c) `rewardId` nije string; I04-T16 (a) i `__SENTINEL__` kao `rewardId`
(404 formata); I04-T09 (a) i isti `createdAt` RELEASE i RESERVE (i04/P-6).

**OD-7 — Mutacije M13 i M15 imaju po dvije varijante (M13b `+ 900 001`, M15b bez provjere varijante)**, jer plan za njih kaže „zasebno”.
Mutacije su izvršene nad jednim dugo pokrenutim emulatorom (`firebase emulators:start`) sa `--test-name-pattern`, kao u i03.

### Status otvorenih pitanja iz plana

| Pitanje | Status |
|---|---|
| i04/P-1 ugovor API-03 | Riješeno po odluci; API-T06 (`Object.keys` tim redoslijedom), I04-T08, I04-T14 PASS; M29, M30, M36 ubijene. |
| i04/P-2 izvor vremena | Riješeno: jedan `sadaMs` po pokušaju; `serverTimestamp()` za ledger, mapping, `updatedAt`; API-T06 (razlika tačno 900 000 ms), I04-T09 (f); M09, M13, M13b ubijene. |
| i04/P-3 `voucherId` | Riješeno: 32 bajta hex; I04-T06 (a), (b), I04-T10 (d); M14, M03 ubijene. |
| i04/P-4 `requestKey` | Riješeno; vektor C3 u I04-T06 (a); M10 ubijena. |
| i04/P-5 ledger eventId | Riješeno: `reserve_{voucherId}`, `release_{voucherId}`, samo `tx.create` + provjera postojećeg release-a; M05, M06, M07 ubijene. Obavezuje i05/i06. |
| i04/P-6 redoslijed release-a | Riješeno; I04-T09 (d); M27 ubijena. |
| i04/P-7 poredak i nekonzistentna stanja | Riješeno; I04-T04, I04-T05, I04-T10 (b), (c), (d), I04-T11 (redoslijed upisa po putanjama); M11, M17, M32 … M35 ubijene. |
| i04/P-8 D-5 (opcija A) + K-1 | Riješeno: 404 `NOT_FOUND`; stvaran redoslijed JSON → D-5 (I04-T03 (c)); M21, M22 ubijene. |
| i04/P-9 D-4 + `\p{Cc}` | Riješeno; I04-T03 (a), (b), I03-T09 regresija PASS; M23, M24 ubijene. `loyaltyUid` nepromijenjen (B-1). |
| i04/P-10 `tx.get(query)` | Potvrđeno nad emulatorom; `firestore.indexes.json` nepromijenjen. |
| i04/P-11 `omotacBaze` | Urađeno; I04-T11 (z1)–(z4). |
| i04/P-12 definicija prije `active` | Riješeno; I04-T05; M34 ubijena. |
| i04/P-13 … P-16 | Prihvaćeno; P-13 upisan u README; P-14 i P-16 u poznata ograničenja. |
| K-2 (B-1 u ODLUKE.md) | Urađeno (sekcija 8). |
| K-3 (API-T07 {201, 409}) | Ispunjeno u svakom od 6 punih izvršavanja (20/20 ponavljanja `201 + 409 INSUFFICIENT_POINTS`). |
| F1-01 (backlog i03) | Zatvoren: tri putanje u TEST_REPORT ispravljene; `git grep -n -P "firebase\tests" -- docs` prazno. |

### Ograničenja za buduće iteracije

- **i05, i06 (g, i04/P-5):** svaki prelaz u EXPIRED / CANCELLED koristi `loyaltyLedger/release_{voucherId}` + `tx.create` (najviše jednom) i
  eksplicitnu provjeru postojećeg release-a; ledger `createdAt` = `serverTimestamp()`; prefiks `redeem_` je rezervisan za i06.
- **i05, i06 (vrijeme):** istek se procjenjuje `jeIstekao(expiresAt.toMillis(), sadaMs)` sa jednim `sadaMs = Date.now()` po pokušaju transakcije.
- **i05, i06 (voucherId u putanji):** format `^[0-9a-f]{64}$`; neispravan oblik → odgovarajući 404 bez pristupa bazi; D-5 već pokriva
  neispravno percent-kodiranje; vrijednost nikad u log ni poruku (h).
- **i07 (f):** retry issue-a kad mapping postoji a voucher ne → 500 (i04); i07 određuje redoslijed brisanja.
- **i10 (i):** Android upit `vouchers` mora imati `where('uid','==',auth.uid)` i `limit ≤ 20`; `rewardDefinitions` čita samo prijavljen korisnik.

### Poznata ograničenja

- i04/P-2: `issuedAt`/`expiresAt` i poređenje isteka su po satu Backend-a, ledger `createdAt` po Firestore-u; razlika satova je moguća (lokalno zanemarljiva).
- i04/P-9, i04/P-10: ponašanje Firestore-a za ID sa NUL/kontrolnim znakom i indeks za upit `uid ==, status ==` utvrđeni samo nad emulatorom.
- i04/P-14: Express ruter je case-insensitive i nije strict (`/REWARDS/CAR_WASH/ISSUE`, završna `/` pogađaju rutu).
- i04/P-16: broj ACTIVE voucher-a u upitu reconcile-a nije ograničen.
- **Otvoreno pitanje (uočeno tokom rada, kod nije mijenjan jer je van plana):** kad transakcija padne na `ALREADY_EXISTS` (samo nekonzistentno
  stanje ili zastarjelo čitanje — I04-T11 (z1)–(z4)), 500 u serverski log upisuje stack sa porukom Firestore-a koja sadrži putanju dokumenta
  (npr. `vouchers/<voucherId>` ili `rewardRequests/<requestKey>`). Odgovor je ne sadrži; u normalnom toku nije uočeno. Odnosi se na ograničenje (h)
  za i05/i06 — za odluku Orchestrator-a. **Zatvoreno u FIX LOOP 1 (R-04, O-18), vidi niže.**
- Pod kontencijom istog korisnika: 503 i latencija do ~10 s (I04-T12: jedan 503 u nekim serijama; I04-T13 do ~18 s zbog ponavljanja na 409),
  kao u i03; stanje uvijek konzistentno, nijedan 500. **Ispravljeno u FIX LOOP 1 (R-03, O-17): važi i za RAZLIČITE korisnike, vidi niže.**
- Ostala ograničenja iz i01–i03 (nepotpisani emulator token-i, `MetadataLookupWarning`, `npm warn install-scripts`, Gradle daemon, N-02) i dalje važe.

### FIX LOOP 1 (nalazi iz `docs/iteracije/i04_review.md`, commit d3e6d6a)

Review: ITERATION REJECTED (R-01, R-02 blokirajući; R-03, R-04 po odluci Orchestrator-a). Odluke Orchestrator-a O-17 i O-18 i napomene
N-01, N-08 upisane u `docs/iteracije/i04_plan.md`, sekcija 15, „FIX LOOP 1 — odluke Orchestrator-a”.

| Nalaz | Ispravka | Test | Dokaz |
|---|---|---|---|
| R-01 (MAJOR) API-T07 ne obara M02 pouzdano | Novi deterministički test: kupovina istog korisnika (ne čita `vouchers`) se pokreće dok izdavanje drži transakciju poslije čitanja (`omotacBaze({ prijeCommita })`); tačan balance i lanac. Kod nije mijenjan. | I04-T18 | nemutiran 10/10 prošao; M02 10/10 pao |
| R-02 (MINOR, blokira) MA21 preživljava | Test sa prisiljenim ponovnim pokušajem (`omotacBaze({ prisiliPonovniPokusaj })`, ABORTED code 10) i `mock.method(Date, 'now', …)` samo za pozive iz `izdavanjeNagrade.js`. Kod nije mijenjan. | I04-T19 | nemutiran 10/10 prošao; M42 (= MA21) 10/10 pao |
| R-03 (MINOR) netačno ograničenje kontencije | Samo dokumentacija (O-17): tehnika `tx.get(query)` se zadržava; ograničenje ispravljeno (važi i za različite korisnike u emulatoru); backlog B-2. | — | — |
| R-04 (MINOR) 500 iz commit-a upisuje requestKey / voucherId u log | `backend/src/greske/obradaGresaka.js`: za 5xx log nosi `name (code N): poruka` sa redakcijom putanja dokumenata (`path=…`, `documents/…`, `<kolekcija>/…` → `[putanja dokumenta]`) i samo okvire `at …` (O-18). Odgovor i status nepromijenjeni. | I04-T16 (c) | crveno prije ispravke; poslije 10/10 prošao; M43 10/10 pao |

Commit-i FIX LOOP-a 1:

| Commit | Poruka |
|---|---|
| `1811463` | i04 fix: odluke Orchestrator-a (FIX LOOP 1) |
| `070a1fc` | i04 fix: R-01 deterministički test čitanja stanja u transakciji (obara M02) |
| `b562245` | i04 fix: R-02 test sadaMs po pokušaju (obara MA21) |
| `5678e58` | i04 fix: R-04 redakcija putanja dokumenata u logu 5xx grešaka |
| (ovaj) | i04 fix: dokumentacija FIX LOOP-a 1 |

Fajlovi: `backend/src/greske/obradaGresaka.js` [I], `backend/test/pomocnici/omotacBaze.js` [I] (opcije `prijeCommita`, `prisiliPonovniPokusaj`,
brojač `brojPokusaja`; postojeće opcije nepromijenjene), `backend/test/emulator/izdavanjeAtomicnost.test.js` [I] (I04-T18, I04-T19),
`backend/test/emulator/logIzdavanja.test.js` [I] (I04-T16 (c)), `docs/iteracije/i04_plan.md`, `docs/TEST_REPORT.md`, `docs/IMPLEMENTATION_LOG.md`,
`docs/ODLUKE.md`, `docs/TRACEABILITY.md`. Postojeći testovi nisu oslabljeni; nijedan novi paket.

Odluke:
- **O-17** — `tx.get(query)` nad `vouchers` se zadržava (brief, tačka 5); opcija B (upit van transakcije + `tx.getAll` kandidata) se ne uvodi.
  Zaštita od double-spend-a se ne smije oslanjati na bravu upita (zato I04-T18). Backlog B-2.
- **O-18** — serverski log 5xx grešaka ne smije sadržati putanje dokumenata, requestKey ni voucherId (ni u poruci ni u stack-u); popravljeno
  globalno u centralnom rukovaocu greškama.
- **N-08** — u `docs/ODLUKE.md` §6 duple oznake „(f) potvrđeno” i „(g) potvrđeno” zamijenjene novim oznakama (m) i (l); N-01 upisano kao (n).

Poznata ograničenja (ispravka / dopuna):
- **Kontencija (R-03, O-17; zamjenjuje stavku „Pod kontencijom istog korisnika” gore):** u emulatoru `tx.get(query)` serijalizuje izdavanja i
  RAZLIČITIH korisnika — izmjereno u reviewu (K korisnika, po jedan SHOWER zahtjev, paralelno): K=2 → 3,6 s; K=5 → 9 pokušaja; K=10 → 2×503;
  K=15 → 11×503 (63 pokušaja); stanje uvijek konzistentno. Ponašanje produkcionog Firestore-a nije provjereno. Backlog B-2 (i09).
- **Log 5xx (R-04, O-18; zamjenjuje „Otvoreno pitanje” o `ALREADY_EXISTS` gore):** zatvoreno; log i dalje omogućava dijagnostiku
  (`Error (code 6): 6 ALREADY_EXISTS: … path=[putanja dokumenta]` + okviri `at …`). Redakcija se oslanja na oblik poruke Firestore-a
  (`path=…`, `documents/…`, naziv kolekcije §24 + `/`) utvrđen nad emulatorom.
- **N-01 (za i05):** O-16 retry vraća sačuvani `status: "ACTIVE"` i za voucher kojem je `expiresAt` prošao (ništa se ne upisuje); i05 (API-06)
  to zatvara; Android (i10) odlučuje po `expiresAt`.

### FIX LOOP 2 (nalazi iz `docs/iteracije/i04_review_fix1.md`, commit 54b2e0b)

Re-review: ITERATION REJECTED (R-06 blokirajući; R-05 po odluci Orchestrator-a P-3). R-01 … R-04 zatvoreni i nisu dirani. Odluke P-3, P-4 i
napomene N-10 … N-13 upisane doslovno u `docs/iteracije/i04_plan.md`, sekcija 15, „FIX LOOP 2 — odluke Orchestrator-a”.

| Nalaz | Ispravka | Test | Dokaz |
|---|---|---|---|
| R-06 (MINOR, blokira) M43-vr preživljava I04-T16 (c) | Samo test: I04-T16 (c) proširen slučajevima ALREADY_EXISTS na `vouchers/<noviVoucherId>` i `loyaltyLedger/reserve_<noviVoucherId>` (fiksiran `crypto.randomBytes`, dokument drugog uid-a pod tim ID-em, `omotacBaze({ sakrijPostojece })`). | I04-T16 (c) | nemutiran 10/10 prošao; M43-vr 10/10 pao (prije koraka 2); poslije koraka 2 ekvivalent M43-vr-g 10/10 pao |
| R-05 (MINOR) stvarni emulatorski NOT_FOUND (`name: "<id>"`) prolazi redakciju | `backend/src/greske/obradaGresaka.js`: greška sa numeričkim gRPC `code` se u log 5xx upisuje BEZ poruke — `name (code N IME_STATUSA)` (statička mapa 0 … 16) + okviri `at …`; ne-gRPC greške i bačeni ne-Error: poruka sa redakcijom putanja (kao FIX LOOP 1) i svakog niza od ≥ 32 hex znaka (`[hex]`, N-10). Odgovor klijentu i statusi nepromijenjeni (§27). | I04-T20 (a)–(c) (`logGresaka5xx.test.js`) | crveno prije ispravke (3/3 testa); poslije 10/10 prošao; M44, M45, M43-vr po 10/10 pali |
| P-4 (N-09) | Samo dokumentacija: obaveza za i07 u `docs/ODLUKE.md` §6 (o). | — | — |
| N-11, N-12, N-13 | `docs/ODLUKE.md`: N-11 u §7, N-12 kao §6 (p), N-13 redoslijed oznaka (j), (k), (l) ispravljen. | — | — |

Commit-i FIX LOOP-a 2:

| Commit | Poruka |
|---|---|
| `0c80582` | i04 fix2: odluke Orchestrator-a (FIX LOOP 2) |
| `458e720` | i04 fix2: R-06 test loga za vouchers/ i reserve_ (obara M43-vr) |
| `f27ab90` | i04 fix2: R-05 log 5xx bez poruke gRPC grešaka i redakcija hex nizova |
| (ovaj) | i04 fix2: dokumentacija FIX LOOP-a 2 |

Fajlovi: `backend/src/greske/obradaGresaka.js` [I] (jedini proizvodni fajl), `backend/test/emulator/logIzdavanja.test.js` [I] (I04-T16 (c)),
`backend/test/emulator/logGresaka5xx.test.js` [D] (I04-T20), `docs/iteracije/i04_plan.md`, `docs/TEST_REPORT.md`, `docs/IMPLEMENTATION_LOG.md`,
`docs/ODLUKE.md`, `docs/TRACEABILITY.md`. `omotacBaze.js` nije mijenjan. Nijedan novi paket, nijedna nova ruta, nijedan test oslabljen.

Odluke:
- **P-3** — R-05 u FIX LOOP-u 2 (opcija A); log 5xx ne smije zavisiti od oblika poruke Firestore greške; O-18 ostaje globalan.
- **P-4** — N-09 kao obaveza za i07 (ODLUKE §6 (o)).

Poznata ograničenja (dopuna):
- **Log 5xx (R-05, zamjenjuje rečenicu „Redakcija se oslanja na oblik poruke Firestore-a” iz FIX LOOP-a 1):** za gRPC greške (Firestore,
  numerički `code`) poruka se više ne bilježi, pa zaštita ne zavisi od njenog oblika; dijagnostika je `Error (code 6 ALREADY_EXISTS)` /
  `Error (code 5 NOT_FOUND)` + okviri. Redakcija hex nizova (≥ 32) za ne-gRPC poruke je heuristika: tajna kraća od 32 hex znaka ili
  drugog oblika (npr. putanja kolekcije van §24) bi ostala. Format grešaka produkcionog Firestore-a nije provjeren (samo emulator).
- **N-11:** Express `finalhandler` za `res.headersSent` ispisuje cijeli `err.stack` bez redakcije; nedostižno u i04 (ODLUKE §7).

## Iteracija 5 — Voucher cancel i account reconcile

Grana `iteracija-05`. Brief: `docs/iteracije/i05_brief.md`. Plan: `docs/iteracije/i05_plan.md`
(odobren uz odluke i05/P-1 … i05/P-14 i ispravke K-1 … K-3, sekcija 15). Uloga: BUILDER, 2026-10-18.

### CHANGELOG

- **O-19 (korak 1, PRIJE koda sa `voucherId` u putanji; ODLUKE §6 (h)):** `greske/obradaGresaka.js` — okviri stack-a se uzimaju tek POSLIJE
  zaglavlja `${name}: ${message}` (ili `${name}` za praznu poruku), pa nijedan red poruke (ni red koji počinje sa `at `) ne ulazi u log (R-07);
  stack koji ne počinje tim zaglavljem (ručno postavljen) → bez okvira; `name` i okviri se rediguju (R-08); opis neočekivane greške nikad ne
  baca — statički opis `(opis greške nedostupan)` (R-10). Odgovor klijentu, `odrediKod` i katalog nepromijenjeni.
- **Zajednički mehanizam oslobađanja (korak 2, i05/P-5, ODLUKE §6 (g), (p)):** `servisi/oslobadjanjeVaucera.js` (`procitajIstekleAktivne`,
  `pripremiOslobadjanja`, `upisiOslobadjanja`) — jedino mjesto u `src/` koje piše `loyaltyLedger/release_{voucherId}` (`tx.create`, 9 polja §11,
  eksplicitna provjera postojećeg release-a, lanac po `poredakOslobadjanja`); modul ne čita sat. `servisi/stanjeNaloga.js`
  (`procitajStanjeNaloga`, AUTH-03/AUTH-05). `servisi/vauceri.js` dobija `FORMAT_VOUCHER_ID`, `STATUSI_VAUCERA`, `jePozitivanCijeliBroj`,
  `jeNenegativanCijeliBroj`, `jeIspravanSacuvaniVaucer` (premješteno iz `izdavanjeNagrade.js` bez promjene logike). `izdavanjeNagrade.js` koristi
  ove module; redoslijed čitanja i upisa, poruke i ishodi API-03 nepromijenjeni (cijela i04 suite zelena 3× prije koraka 3; I04-T19 netaknut).
- **Validacija (korak 3):** `validacija/zahtjevVaucera.js` — `provjeriPraznoTijelo(tijelo, zaglavlja)` (O-21, i05/P-2: bez tijela ili `{}`;
  `req.body === undefined` uz `Transfer-Encoding` ili `Content-Length` ≠ `'0'` → 422) i `provjeriVoucherId` (O-22: `^[0-9a-f]{64}$` →
  inače `404 VOUCHER_NOT_FOUND` bez pristupa bazi).
- **API-05 (korak 4):** `servisi/otkazivanjeVaucera.js` (`otkaziVaucer`) — rok prije transakcije; JEDNA transakcija: voucher postoji (404) →
  `uid` ispravan (500) → vlasnik (403, O-6) → ispravan voucher (500) → CANCELLED (200 iz sačuvanog, §19.2) / REDEEMED / EXPIRED (409, §19.3) →
  tek za ACTIVE nalog (O-20) → istek (O-5: EXPIRED + release u istoj transakciji, 409 `VOUCHER_EXPIRED` POSLIJE commit-a) ili CANCELLED sa
  `cancelledAt = Timestamp.fromMillis(sadaMs)` (i05/P-3) → upisi (voucher, `release_`, nalog). Ruta `POST /vouchers/:voucherId/cancel`
  (`rute/vauceri.js`, posrednik samo na ruti), tijelo `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt, cancelledAt }` (i05/P-1).
  `aplikacija.js` dodaje `dodajRuteVaucera` poslije API-03.
- **API-06 (korak 5):** `servisi/uskladjivanjeVaucera.js` (`uskladiVaucere`) — nalog prvi (O-20), upit ACTIVE voucher-a korisnika u
  transakciji (O-17), release svakog isteklog, upis naloga; odgovor `{ reconciledCount }`. Ruta `POST /account/vouchers/reconcile`.
- **Testovi:** jedinični I05-T01, I05-T02, I05-T03 (a), proširenje ulaza I04-T03 (c) (novi test, postojeći netaknuti); emulator API-T11,
  AC-08, I05-T03 (b) … I05-T20. Postojeći testovi i01–i04 i pomoćnici nepromijenjeni (`git diff main --stat -- backend/test`: samo novi
  fajlovi i +9 redova u `dekodiranjePutanje.test.js`).
- `skripte/provjera.ps1`: smoke `POST /api/v1/vouchers/<'0'×64>/cancel` i `POST /api/v1/account/vouchers/reconcile` bez token-a → 401
  `UNAUTHENTICATED` (šest smoke provjera; UTF-8 BOM, CRLF).
- README: API-05, API-06, preporučeni tok klijenta (ODLUKE §6 (n)), i05/P-11 … P-14.
- Dokumentacija: `docs/TEST_REPORT.md` (sekcija i05), `docs/TRACEABILITY.md` (redovi Iteracije 5, tabela O-1), `docs/ODLUKE.md` (K-2), ovaj unos.

Nijedan novi npm paket, kod greške, Firestore indeks ni izmjena `firebase/firestore.rules`; katalog grešaka, `GreskaApi`, `dnevnik.js`,
`greskeServisa.js`, posrednici, `omotacBaze.js` (i05/P-10) i ugovori API-01 … API-03 nepromijenjeni.

### Commit-i

| Commit | Korak plana |
|---|---|
| `54ecc27` i05: odobrenje plana i odluke Orchestrator-a | 0 |
| `9b28b06` i05: log 5xx bez redova poruke u okvirima i bez bacanja iz opisa greške (O-19: R-07 … R-10) | 1 |
| `9f6a789` i05: zajednički mehanizam oslobađanja voucher-a i stanja naloga, API-03 bez promjene ponašanja (§18.1, ODLUKE §6 (g)) | 2 |
| `2f045e9` i05: validacija praznog tijela (O-21) i formata voucherId (O-22) | 3 |
| `5747aab` i05: POST /vouchers/{voucherId}/cancel u jednoj Firestore transakciji sa REWARD_RELEASE (API-T11, O-5, O-6, O-20) | 4 |
| `d8bb1ed` i05: POST /account/vouchers/reconcile — istekli ACTIVE voucher-i u EXPIRED sa REWARD_RELEASE u jednoj transakciji (§18.1) | 5 |
| `446ddd5` i05: testovi double-refund-a, kasnog commit-a, roka, sata po pokušaju i očuvanja bodova (AC-08, NFR-04 … NFR-06) | 6 |
| `12fe60e` i05: test loga bez voucherId-a za API-05 i API-06 i smoke 401 za nove rute | 7 |
| — (kontrolne mutacije N01 … N37, N40 … N44, R-M46, R-M47, R-M48, R-M53 lokalno, bez commit-a; nijedna nije preživjela) | 8 |
| (ovaj commit) i05: TEST_REPORT, IMPLEMENTATION_LOG, sljedivost, registar odluka i README za iteraciju 5 | 9 |

### Fajlovi

Dodati:

```
backend/src/rute/vauceri.js
backend/src/servisi/oslobadjanjeVaucera.js
backend/src/servisi/stanjeNaloga.js
backend/src/servisi/otkazivanjeVaucera.js
backend/src/servisi/uskladjivanjeVaucera.js
backend/src/validacija/zahtjevVaucera.js
backend/test/jedinicni/opisGreske5xx.test.js
backend/test/jedinicni/staticnePoruke.test.js
backend/test/jedinicni/zahtjevVaucera.test.js
backend/test/emulator/otkazivanjeVaucera.test.js
backend/test/emulator/uskladjivanjeVaucera.test.js
backend/test/emulator/vauceriAtomicnost.test.js
backend/test/emulator/logVaucera.test.js
```

Izmijenjeni:

```
backend/src/aplikacija.js
backend/src/greske/obradaGresaka.js
backend/src/servisi/izdavanjeNagrade.js            (koristi zajedničke module; ponašanje isto)
backend/src/servisi/vauceri.js                     (premješteni validatori i FORMAT_VOUCHER_ID)
backend/test/jedinicni/dekodiranjePutanje.test.js  (samo novi test: D-5 nad /vouchers/…/cancel)
skripte/provjera.ps1                               (UTF-8 sa BOM-om, CRLF)
README.md
docs/iteracije/i05_plan.md                         (samo sekcija 15)
docs/TRACEABILITY.md
docs/IMPLEMENTATION_LOG.md
docs/TEST_REPORT.md
docs/ODLUKE.md
```

Netaknuti: `docs/srs/*` (SHA-256 provjeren), `docs/iteracije/i05_brief.md`, `CLAUDE.md`, `firebase/*` (pravila, indeksi, Rules testovi),
katalog grešaka, `GreskaApi.js`, `dnevnik.js`, `greskeServisa.js`, posrednici, `rute/nalog.js`, `rute/kupovine.js`, `rute/nagrade.js`,
`servisi/evidencijaKupovine.js`, `servisi/inicijalizacijaNaloga.js`, `test/pomocnici/*`, `package.json`/`package-lock.json`, Android,
svi testovi i01–i04 (osim proširenja ulaza iznad).

### Odstupanja od plana

**OD-1 — API-06 dio I05-T03 (b) i I05-T04 je u `uskladjivanjeVaucera.test.js`.** Plan stavlja I05-T03 (b) „za OBA endpoint-a” u
`otkazivanjeVaucera.test.js` (korak 4), ali ruta API-06 nastaje tek u koraku 5; API-06 dio je zato dodat u fajl koraka 5 (isti sadržaj
provjera: bez tijela / `Content-Length: 0` / `{}` → 200; objekat, niz, `text/plain`, bez `Content-Type`, `merge-patch+json` → 422 bez
pristupa bazi; skalar / `null` / neispravan JSON → 422 bez token-a; `GET`/`PUT` → 404).

**OD-2 — I05-T20 (b) bez NOT_FOUND scenarija.** Plan traži i stvarni gRPC NOT_FOUND iz cancel-a (voucher obrisan Admin SDK-om iz
`prijeCommita`). U emulatoru brisanje čeka bravu transakcije (pesimistično zaključavanje pročitanog dokumenta), pa je transakcija
commit-ovana (HTTP 200, `pokušaja 1`), a brisanje izvršeno tek poslije — scenario nije izvodljiv bez izmjene produkcionog koda. Ostao je
scenario ALREADY_EXISTS na `loyaltyLedger/release_<V>` (stvarna emulatorska greška, `code 6`); stvaran NOT_FOUND sa ID-em u poruci za
`vouchers/<id>` već pokriva I04-T20 (a) (isti centralni rukovalac). Produkcioni kod nije mijenjan.

**OD-3 — Test-first gdje kod već postoji.** Servisni test granice I05-T07 je bio zelen u crvenom izvršavanju koraka 4 (servis je pisan prije
testa, ruta nije postojala); testovi koraka 6 i I05-T02 nisu mogli biti crveni (kod postoji od koraka 4/5, pravilo statičkih poruka već važi).
Test-first je dokazan kontrolnim mutacijama: N04 (I05-T07 granica), N01, N03, N11a/b, N12, N20a/b, N29a/b, N30 (korak 6), N26 i N26-k1
(I05-T02) — sve 10/10.

**OD-4 — Checkpoint-i koraka 2–7 izvršeni uz sklanjanje necommit-ovanih fajlova kasnijih koraka van repoa** (scratchpad sesije), kao i04
OD-4: `provjera.ps1` svakog koraka je pokrenut nad stanjem tog commit-a, pa su fajlovi vraćeni. Za korak 4 je `rute/vauceri.js` imao samo
rutu cancel (sačuvana verzija koraka 4), ruta API-06 je dodata u koraku 5.

**OD-5 — Prvo izvršavanje 3 × `test:emu` u koraku 6 je nevažeće (sleep računara).** Run 1 je trajao 19 293 s (računar u sleep-u) i pao je
I02-T09 (`0 !== 1` za broj `users` dokumenata, trajanje testa ≈ 5,1 h); runovi 2 i 3 tog shell-a su prošli, ali se ne računaju. Po uputstvu
Ane ponovljena su tri čista uzastopna izvršavanja (bez sleep-a): 138/138 svako. Kod nije mijenjan.

**OD-6 — Ispravke testova prije prvog commit-a (samo test kod):** (a) I05-T03 (b): `..` kao segment putanje je izbačen iz HTTP liste, jer
klijentski URL parser normalizuje dot-segmente (`/vouchers/../cancel` → druga putanja); `..` ostaje u jediničnom testu `provjeriVoucherId`.
(b) testovi koji u petlji čiste bazu koriste lokalni `ocistiFirestore()` (samo Firestore), jer `ocistiEmulatore()` briše i Auth korisnike pa
bi token-i postali nevažeći. (c) I05-T20 (b): regex „putanja dokumenta” je pogađao šablon rute `/vouchers/:voucherId/cancel` (dozvoljen, D-3)
— šablon je izuzet. Produkcioni kod nije mijenjan.

**OD-7 — Definicije pojedinih mutacija (plan 8.4 ih opisuje riječima):** N06 = provjera vlasnika premještena iza svih upisa (prije
`return`); N07 = CANCELLED grana bez `return` + `tx.set` + bez eksplicitne provjere release-a; N11a/N11b = `db.getAll` umjesto `tx.getAll` za
users/nalog u cancel-u / API-06 (cilj I05-T14, K-1); N19a = rani izlaz vraća 1 umjesto 0 (brojanje ACTIVE umjesto isteklih nije izvodljivo bez
drugog upita); N19b = `+ 1`; N21 = provjera naloga uklonjena iz API-06 (varijanta „provjera poslije oslobađanja u istoj transakciji” je
ekvivalentna zbog rollback-a); N22a/N22b, N29a/N29b, N10a/N10b, N16a/N16b, N20a/N20b, N25a/N25b, N44a/N44b — „zasebno” varijante iz plana.
Mutacije su izvršene nad jednim dugo pokrenutim emulatorom sa `--test-name-pattern`, svaka 10×, pa `git restore src`.

**OD-8 — Dodatni slučajevi van tabela plana (samo pojačanje):** I05-T03 (b) `{"__proto__":1}`, `%0A` na kraju `voucherId`-a,
`/VOUCHERS/<HEX>/CANCEL` (ruter case-insensitive, `voucherId` nije), `application/json` sa `Content-Length: 0`; I05-T04 tuđi voucher sa
`?uid=<B>` → 403; I05-T12 (a)–(c) drugi retry; I05-T15 (e) tačno `2N + 1` upisa i jedna transakcija; I05-T16 slučajevi sa i bez isteklog
voucher-a.

### Status otvorenih pitanja iz plana

| Pitanje | Status |
|---|---|
| i05/P-1 ugovor API-05 / API-06 | Riješeno po odluci; API-T11 (`Object.keys` 7 ključeva, retry `deepStrictEqual` prvom), I05-T15 (a); N08, N09, N19a/b, N32 ubijene. |
| i05/P-2 politika tijela | Riješeno: `provjeriPraznoTijelo`; I05-T03 (a), (b) (sirovi HTTP zahtjevi kroz TCP soket); N25a/b ubijene. |
| i05/P-3 `cancelledAt` | Riješeno: `Timestamp.fromMillis(sadaMs)`; I05-T07 granica (`cancelledAt === sadaMs`), API-T11; N09, N20a ubijene. |
| i05/P-4 redoslijed provjera | Riješeno; I05-T05, I05-T06, I05-T08 (a), (b), I05-T16; N05, N06, N14, N15, N16a/b, N21, N33, N34 ubijene. Retry bez provjere `release_`. |
| i05/P-5 raspored i refaktor | Riješeno; i04 suite 3× zelena prije koraka 3; I05-T21 inspekcija; N44a/b ubijene; I04-T19 netaknut. |
| i05/P-6 O-19 i statičke poruke | Riješeno u koraku 1; I05-T01, I05-T02; R-M46, R-M47, R-M48, R-M53, N40 … N43, N26 ubijene. |
| i05/P-7 | Prihvaćeno; I05-T01 (e). |
| i05/P-8 bez granice | Riješeno; I05-T15 (e) 200 isteklih u jednoj transakciji (90–106 ms); ograničenje u ODLUKE §7. |
| i05/P-9 indeksi / pravila | Nepromijenjeni (`git diff main --stat -- firebase` prazno); RULE-T01 … RULE-T12 zeleni. |
| i05/P-10 `omotacBaze` | Nije proširen. |
| i05/P-11 … P-14 | Prihvaćeno; upisano u README i ODLUKE §7. P-12 (prazan segment → `NOT_FOUND`) testiran u I05-T03 (b). |
| K-1 (I05-T14) | Ispunjeno: test ne dozvoljava 503 i ne zavisi od upita (kupovina ne čita `vouchers`); N11a/N11b (nalog van transakcije) ga obaraju 10/10. |
| K-2 (ODLUKE.md) | Urađeno (§1, §2, §3, §4, §6 (g), (h), (j), (k), (n), (p) zatvoreni, (o) ostaje za i07, novo (q), (r), (s), §7, §9). |
| K-3 | Ispunjeno: nijedan 500 pod kontencijom ni u jednom izvršavanju; svaka mutacija 10/10, a ciljani testovi zeleni bez mutacije (3 čista + 3 završna `test:emu`). |

### Ograničenja za buduće iteracije

- **i06 (q):** istekao redeem (§20.5) koristi `servisi/oslobadjanjeVaucera.js` (`pripremiOslobadjanja` + `upisiOslobadjanja` sa
  `{ status: 'EXPIRED' }`) i `servisi/stanjeNaloga.js`; nijedan drugi kod ne piše `release_`. `provjeriVoucherId` je format za redeem.
- **i06 (h):** pravilo statičkih poruka važi automatski (I05-T02 skenira cijeli `backend/src`).
- **i07 (r, O-9):** ako brisanje zatvara ACTIVE voucher-e kao CANCELLED / EXPIRED, mora proći kroz isti mehanizam (release najviše jednom) ili
  O-9 mora reći da RELEASE izostaje; cancel retry ne provjerava `release_` (i05/P-4). Obaveza (o) ostaje za i07.
- **i10 (s):** Android poziva API-06 na Home-u i poslije `409 VOUCHER_EXPIRED` iz API-05 osvježava stanje; `Content-Length: 0` bez tijela
  (Retrofit `@POST` bez `@Body`) je ispravan zahtjev.

### Poznata ograničenja

- i05/P-3: `cancelledAt` i odluka o isteku po satu Backend-a, ledger `createdAt` / `updatedAt` po Firestore-u (razlika satova moguća).
- i05/P-8: API-06 nema gornju granicu broja voucher-a; Firestore granice (10 MiB po zahtjevu, 270 s po transakciji) i rok od 10 s ostaju;
  produkcija neprovjerljiva (samo emulator).
- i05/P-9: upit `uid ==, status ==` bez složenog indeksa utvrđen samo nad emulatorom (kao i04/P-10).
- i05/P-11: dva oblika 422 zavisno od tipa tijela; i05/P-12: `/vouchers//cancel` → `NOT_FOUND`; i05/P-13: 403 otkriva postojanje tuđeg
  voucher-a; i05/P-14: `reconciledCount` pod kontencijom.
- OD-2: stvaran gRPC NOT_FOUND iz cancel transakcije nije izvodljiv u emulatoru (brava).
- I05-T19: niz VRSTA operacija je deterministički (seed `0x1505`: 71 kupovina, 68 izdavanja, 38 pomjeranja isteka u svakom izvršavanju), ali
  ishodi cancel-a se razlikuju između izvršavanja jer se voucher bira iz liste poredane po (slučajnom) `voucherId`-u.
- R-11, R-12 (ODLUKE §7) ostaju; R-10 zatvoren.
- Pod kontencijom istog korisnika: 503 i latencija do ~10 s (I05-T11 (b): 8–42 odgovora 503 od 200 po izvršavanju, 6 važećih), stanje uvijek
  konzistentno, nijedan 500, retry bezbjedan (B-2 ostaje otvoren).
- Ostala ograničenja iz i01–i04 (nepotpisani emulator token-i, `MetadataLookupWarning`, `npm warn install-scripts`, Gradle daemon, N-02, N-11)
  i dalje važe.


## Iteracija 6 — Voucher redeem (API-04)

Grana `iteracija-06`. Brief: `docs/iteracije/i06_brief.md`. Plan: `docs/iteracije/i06_plan.md` (odobren uz i06/P-1 … P-9, K-1, K-3, K-5 i
O-30 — BRZI REŽIM, sekcija 14). Uloga: BUILDER, 2026-10-19. Unos je sažet po O-30 (d).

### CHANGELOG

- **`test:emu:ciljano` (O-29 (c), i06/P-8):** `backend/skripte/testEmuCiljano.js` + skript u `package.json` — isti `emulators:exec` kao `test:emu`,
  samo zadati `test/emulator/*.test.js` fajlovi i opcioni `--test-name-pattern`; bijela lista argumenata (I06-T01). `test:emu` nepromijenjen.
- **O-27 (O-23, §6 (t)):** `jeKonzistentnoStanjeVaucera` u `servisi/vauceri.js` — jedina definicija konzistentnog voucher-a; koriste je cancel
  (zamjenjuje `jeIspravanSacuvaniVaucer || rewardId` i zasebnu CANCELLED/`cancelledAt` provjeru), `procitajIstekleAktivne` (API-03 reconcile,
  API-06), O-16 retry API-03 (i06/P-1) i redeem. Promjena ponašanja samo za nedostižno nekonzistentno stanje (→ 500, ništa upisano); nijedan
  postojeći test i01–i05 nije mijenjan (`git diff i05 -- backend/test` = novi fajlovi + `omotacBaze.js`).
- **Rules (D-2):** blok `match /redemptionRequests/{requestKey} { allow read, write: if false; }` doslovno iz §31.
- **API-04:** `validacija/zahtjevOtkupa.js` (strogo tijelo `{ redemptionRequestId }`, §20.1); `servisi/otkupVaucera.js` (`otkupiVaucer`: rok →
  JEDNA transakcija: zapis O-24 (i06/P-3) → postoji → O-27 → O-7 / §20.4 → nalog (O-25) → `redeem_`/`release_` (O-28, i06/P-5) → §20.5 kroz
  `oslobadjanjeVaucera.js` ili otkup; upisi voucher → `redeem_` (`tx.create`) → nalog → zapis (`tx.create`)); `rute/otkupVaucera.js` (POS posrednik
  samo na ruti); `aplikacija.js`. `izracunajRequestKey(prviDio, drugiDio)` (samo imena/komentar), `refRelease` izvezen samo za čitanje. Smoke red u
  `provjera.ps1` (i06/P-2). Odgovor po i06/P-6.
- **Testovi:** jedinični I06-T01, I06-T02, I06-T06, I06-T07; emulator API-T08 … API-T10, I06-T03 … I06-T05, I06-T08 … I06-T21; Rules I06-T22.
  Test-only: `omotacBaze.prijePokusaja` (i06/P-7), novi pomoćnik `test/pomocnici/pripremaVaucera.js`.

### Commit-i

| Commit | Korak |
|---|---|
| `79b9c55` i06: odobrenje plana i odluke Orchestrator-a | 0 |
| `762587a` i06: test:emu:ciljano (O-29 (c)) | 1 |
| `194928f` i06: zajednička provjera stanja voucher-a (O-27) | 2 (+ `provjera.ps1` #1) |
| `add4ae4` i06: Rules blok redemptionRequests i validacija zahtjeva otkupa (§31, §20.1, O-8 (b)) | 3 (K-3) |
| `c1b9ba0` i06: API-04 redeem (§20, O-24 … O-28) | 4 |
| `8c232be` i06: atomičnost, konkurentnost i log otkupa (NFR-04 … NFR-06, §6 (h)) | 5 (K-3) |
| (bez commit-a) kontrolne mutacije, O-30 (b) | 6 |
| dokumentacija (ovaj unos) | 7 |

### Odstupanja (OD-n, bez promjene ponašanja)

- **OD-1** — Novi test pomoćnik `backend/test/pomocnici/pripremaVaucera.js` (priprema kanonskih dokumenata, §27 tijelo, `mockSataFajla`), umjesto
  lokalnih pomoćnika u svakom od četiri nova emulator fajla; plan (sekcija 4) ga ne navodi. Postojeći fajlovi netaknuti.
- **OD-2** — `refRelease` export i preimenovanje parametara `izracunajRequestKey` ušli su u commit koraka 2 (plan: koraci 4/5); ponašanje isto.
- **OD-3** — Redoslijed „test prije koda”: servis i ruta API-04 napisani su dok je trajao `provjera.ps1` #1 (da se ne dira kod koji suite učitava);
  crveni run je ipak izvršen prije commit-a, na stablu bez uvezane rute: `otkupVaucera.test.js` 12/13 pada. I06-T22 ne može biti crven (default
  deny već pokriva kolekciju, RULE-T12); obara ga M41.
- **OD-4** — Ručni i ciljani emulator run-ovi traže pravi JDK prvi na PATH-u: sa Oracle `javapath` posrednikom `emulators:exec` ostavlja Java proces
  na portu 8080 (poznato od i01; `provjera.ps1` to već radi). Prvi ručni run je ostavio takav proces (moj, ugašen); upisano u README i ODLUKE §7.
- **OD-5** — I06-T19 (e) 10 ponavljanja (plan: 5), po O-30 (c) „ostali dijelovi po 10”.
- **OD-6** — Provjera lanca `availableAfter`/`reservedAfter` u I06-T19/T20 reda događaje po `createdAt` (jedan serverTimestamp po transakciji), a
  unutar transakcije po stanju. Prva verzija (samo po stanju) je u jednom run-u I06-T20 prijavila prekid kod ponovljenog stanja (80, 130) — lažan
  nalaz pomoćnika (isto stanje posjećeno dva puta), ne koda; poslije ispravke pomoćnika I06-T20 zelen u svim run-ovima.
- **OD-7** — Ispravke testova tokom razvoja (samo test kod, kod nepromijenjen): isti `redemptionRequestId` u više slučajeva jednog testa davao je
  ispravan 409 `IDEMPOTENCY_CONFLICT` (O-24) umjesto očekivanog ishoda (I06-T14 (d) kontrola, I06-T15, I06-T18, I06-T21 ishod 5) → svaki slučaj
  dobija sopstveni ID ili praznu bazu; I06-T09 „bez posStanice” je zbog podrazumijevanog parametra slao mapu → aplikacija se pravi direktno.
- **OD-8** — I06-T21 (a) provjerava odsustvo balance-a u logu po nazivima polja (`availablePoints`, `reservedPoints`); same vrijednosti (30, 50)
  se ne mogu razlikovati od drugih brojeva u logu (status, trajanje).
- **OD-9** — Uz M20 izvršena je i M20b (plan je navodi u istom redu). Mutacije su primjenjivane skriptom van repoa (scratchpad), svaka se vraća
  originalnim bajtovima fajla (ekvivalent `git restore`); `git status` poslije: samo necommit-ovana dokumentacija.

### Ispravka (i06) — R-06 iz review-a i05

U unosu i05 (OD-6 (a)) i u TEST_REPORT i05 piše da je `..` izbačen iz HTTP liste I05-T03 (b) jer ga klijentski URL parser normalizuje. To je
netačno: supertest/superagent NE normalizuje `..` — `/api/v1/vouchers/../cancel` stiže do rute i daje `404 VOUCHER_NOT_FOUND` bez pristupa bazi
(review i05, N8). Pokrivenost nije bila umanjena (jedinični `provjeriVoucherId('..')`). U i06 I06-T08 šalje `%2E%2E` kao segment → 404
`VOUCHER_NOT_FOUND`, `brojPristupa 0`. Postojeći tekst i05 se ne prepisuje.

### Status pitanja i06/P-n

P-1 … P-9 riješeni po sekciji 14 plana (P-1 A, P-2 A, P-3 A, P-4 README + §7, P-5, P-6 ugovor, P-7 `prijePokusaja`, P-8 skripta, P-9 ograničenje (u)).
K-1: M45 izvršena kao D 1/1 nad I06-T18 (TEST_REPORT). K-3: koraci spojeni. K-5: nijedan 500 pod kontencijom (raspodjela u TEST_REPORT).

### Ograničenja za i07+

- **(u)** brisanje naloga uklanja voucher-e i `redemptionRequests` (§23.2); retry otkupa nad zapisom bez voucher-a → 500 (O-24); i07 određuje
  redoslijed brisanja.
- (o) ostaje: test konkurentnog brisanja naloga za vrijeme transakcija (sada i redeem: nalog se čita u transakciji samo za ACTIVE).
- (r) važi i za redeem: ako brisanje zatvara ACTIVE voucher-e, mora kroz isti mehanizam release-a.

### Poznata ograničenja

- O-8 (a): ID neuspješnog pokušaja otkupa može se kasnije upotrijebiti za drugi voucher (README).
- i06/P-4: dupli ključ u JSON tijelu → posljednja vrijednost (`JSON.parse`).
- `redeemedAt` po satu Backend-a, ledger i zapis `createdAt` po Firestore-u.
- 503 pod kontencijom istog voucher-a/naloga je moguć (I06-T19 raspodjela); stanje konzistentno, retry bezbjedan. Ponašanje utvrđeno nad emulatorom.
- `prijePokusaja` zavisi od toga da Admin SDK poništi pokušaj prije ponavljanja; kontrola u I06-T18 bi pala glasno.

## Iteracija 7 — Brisanje naloga (API-07)

Grana `iteracija-07`. Brief: `docs/iteracije/i07_brief.md`. Plan: `docs/iteracije/i07_plan.md` (odobren uz i07/P-1 … P-9, K-1 … K-4, sekcija 14).
Uloga: BUILDER, 2026-10-19. Režim: ekspresni (O-30, O-31). Unos je sažet po O-30 (d).

### CHANGELOG

- **O-10a (§10, ograničenje (d)):** `servisi/evidencijaKupovine.js` — kad sačuvani purchase ima `uid === null`, `uid` se ne poredi; ostala
  polja i O-3 nepromijenjeni (I07-T10).
- **Test pomoćnici (i07/P-7):** `omotacBaze.batch()` (operacije paketa u `upisi` kao `batch.<op>`, `baciNaUpisu` važi i za njih, `paketi`) i opcija
  `dnevnik`; `test/pomocnici/omotacAutha.js` (`deleteUser` sa `dnevnik`, `baciNaBrisanju`, brojači); `test/pomocnici/pripremaBrisanja.js` (OD-2).
  Bez opcija omotač za i01–i06 servise radi identično i06 (oni ne koriste pakete).
- **API-07 (§23, §26, O-32 … O-36):** `posrednici/svjezinaPrijave.js` (O-35, i07/P-2); `posrednici/autentikacija.js` opcija `izloziAuthTime`
  (samo API-07); `servisi/oslobadjanjeVaucera.js` — zajednička privatna `procitajAktivne` + nova `procitajAktivneZaZatvaranje` (O-9, O-34),
  `procitajIstekleAktivne` nepromijenjenog ponašanja; `servisi/brisanjeNaloga.js` (`obrisiNalog`: K1 tx → K3 tx (release kroz zajednički mehanizam)
  → K4a upiti + paketi ≤ 400 (`rewardRequests`, `redemptionRequests`, `notifications`, `vouchers`, pa `loyaltyAccounts` ako postoji) → K5
  pseudonimizacija `purchases`, `loyaltyLedger` → K4b tx → K6 `deleteUser` (`auth/user-not-found` = već obrisan)); `rute/brisanjeNaloga.js`
  (token → prazno tijelo → svježina → tok → 204); `aplikacija.js`. Smoke red u `provjera.ps1` (i07/P-9).
- **Testovi:** jedinični I07-T01; emulator API-T12, I07-T02 … I07-T15 (6 novih fajlova). Postojeći test fajlovi i01–i06 netaknuti.
- **Dokumentacija:** README (API-07), TRACEABILITY, ODLUKE (§1 i06 ACCEPTED; §2, §3 O-9, O-10a, O-31 … O-36, O-2, i07/P-n, K-n; §6 zatvoreni
  (a), (d), (f), (m), (o), (r), (u), novo (v); §7; §8 R-02 … R-04 i06, B-1 → i08; §9; §10 O-31).

### Commit-i

| Commit | Korak |
|---|---|
| `00b148d` i07: odobrenje plana i odluke Orchestrator-a | 0 |
| `56db910` i07: O-10a retry kupovine poslije pseudonimizacije | 1 |
| `806f810` i07: test pomoćnici za brisanje (batch, dnevnik, omotacAutha) | 2 |
| `e336652` i07: API-07 brisanje naloga (§23, O-32 … O-36) | 3 (+ `provjera.ps1` #1) |
| `74c4227` i07: atomičnost, nastavak, blokade, konkurentnost i log brisanja (NFR-04, AUTH-05, §6 (o), §6 (h)) | 4 (K-1: koraci 4 + 5 plana) |
| (bez commit-a) ključne mutacije D01 … D11, D07b, D11b | 5 |
| dokumentacija (ovaj unos) | 6 (+ `provjera.ps1` #2) |

### Odstupanja (OD-n, bez promjene ponašanja)

- **OD-1** — I07-T10 (korak 1, prije API-07) pseudonimizuje purchase i EARN Admin SDK-om (`uid → null`, isto što radi K5), ne kroz DELETE; kroz
  DELETE pseudonimizaciju dokazuju API-T12 i I07-T06 (b).
- **OD-2** — Novi pomoćnik `test/pomocnici/pripremaBrisanja.js` (zahtjevi kroz prave rute, primjer A/B, `snimakPoUid`, `provjeriObrisanA`) umjesto
  lokalnih pomoćnika u pet fajlova; ušao u commit koraka 2.
- **OD-3** — Ciljani run koraka 2 (18 fajlova sa omotačem): 149/150, I06-T19 (c) jednom dobio 401 na cancel-u sa svježim token-om (i06 fajl i
  kod cancel-a netaknuti); ponovljen `otkupAtomicnost.test.js` 11/11, a `provjera.ps1` #1 i #2 zeleni. Upisano u ODLUKE §7.
- **OD-4** — K4a briše `loyaltyAccounts/{uid}` samo ako postoji (čitanje, pa paket); plan 5.4 je imao bezuslovno brisanje (no-op). Razlog: I07-T07
  traži da nastavak nad očišćenim stanjem ne upiše ništa (dnevnik = samo `deleteUser`). Konačno stanje isto.
- **OD-5** — Korak 4 (testovi I07-T06, T08, T09, T11, T13, T14, T15) nije imao crveni run: ponašanje je uveo korak 3, prvi run 11/11, kod nije
  mijenjan (plan: „kod se mijenja samo ako test otkrije grešku”). Snagu testova dokazuju mutacije D01 … D11b.
- **OD-6** — I07-T10: zahtjev sa drugom valutom (`BAM`) odbija validacija prije baze (422 `UNSUPPORTED_CURRENCY`, I03-T06), pa je poređenje
  valute uz `uid = null` dokazano izmjenom sačuvane valute (`XXX`) → 409.
- **OD-7** — API-T12 (b) „konačno stanje normalizuj-jednako (a)” je realizovano istom provjerom `provjeriObrisanA` (iste asercije po dokumentu)
  za prvo i nastavljeno brisanje, umjesto poređenja normalizovanih snimaka dva run-a.
- **OD-8** — I07-T03: „`Content-Length: 5` bez JSON-a” realizovan kao `text/plain` i `application/x-www-form-urlencoded` tijelo (parser ga ne čita,
  `Content-Length ≠ 0`); I07-T13 lanac ledger-a provjerava se pretragom niza stanja (od (0, 0) do `reserved 0`), ne po `createdAt`.
- **OD-9** — I07-T14: 503 „rok” je u log testu Firestore UNAVAILABLE (14) i Auth `app/network-error`; istek roka usred K3 je u I07-T11 (b).
- **OD-10** — Ispravke testova tokom razvoja (kod nepromijenjen): I07-T02 mock sata za korisnika bez profila bio je vezan za `auth_time` drugog
  korisnika (kreiran sekundu kasnije) → mock relativan na sopstveni `auth_time`; I07-T05 broj ledger događaja 7 (ne 8).
- **OD-11** — Mutacije primjenjuje skripta van repoa (scratchpad), svaka vraćena `git restore`; D11 je prvo pokrenuta sa obrascem koji sadrži `(`,
  pa run nije izvršio nijedan test (exit 1 bez brojača — nevažeće); ponovljena sa `--test-name-pattern=I07-T09` → ubijena.

### Status pitanja i07/P-n

P-1 A (§7 + (v), bez koda); P-2 (`svjezinaPrijave.js`, I07-T01/T02); P-3 (K3 i K4b `provjeriBlokaduMutacija`, I07-T12 (a)); P-4 (§7); P-5 (README,
§7, I07-T10); P-6 (I07-T15); P-7 (pomoćnici); P-8 (API-T12 (a): ponovljen DELETE → 401); P-9 (smoke). K-1 spojen korak 4; K-2 JDK prvi i portovi
8080/9099 provjereni prije i poslije svakog run-a; K-3 crveni run-ovi u TEST_REPORT; K-4 commit koda završnog `provjera.ps1` u TEST_REPORT.

### Ograničenja za i08+

- **(v) i10** — Android poslije pokretanja DELETE-a ne poziva init ni drugi API do 204; 401 na ponovljen DELETE = završeno brisanje; 409
  `REAUTHENTICATION_REQUIRED` → ponovna prijava.
- B-1 → i08 (zabrana `\p{Cc}` za `loyaltyUid`).

### Poznata ograničenja

- Prozor K4b → K6 (i07/P-1): init sa važećim token-om može ponovo napraviti `users` / `loyaltyAccounts` prije brisanja Auth naloga.
- Budući `auth_time` dozvoljen (i07/P-2); svježina se u emulatoru testira mock-om sata (emulator ne izdaje star `auth_time` koji prolazi `checkRevoked`).
- Granica 500 upisa po paketu nije provjerljiva u emulatoru; ≤ 400 dokazano brojanjem operacija (I07-T06 (c)).
- Veliki nalog: rok 10 s → 503, nastavak bezbjedan; produkcija neprovjerljiva. K3 bez gornje granice ACTIVE voucher-a (i07/P-4).
- Konkurentni DELETE istog korisnika: oba mogu dobiti 204 (`auth/user-not-found` = već obrisan); 503 moguć, retry bezbjedan.

## Iteracija 8 — Security Rules lockdown 12/12 i B-1

Grana `iteracija-08`. Brief: `docs/iteracije/i08_brief.md`. Plan: `docs/iteracije/i08_plan.md` (odobren uz i08/P-1 … P-4, K-1, sekcija 14).
Uloga: BUILDER, 2026-10-19. Režim: ekspresni (O-30, O-31). Unos je sažet po O-30 (d).

### CHANGELOG

- **§31 (O-37):** `firebase/firestore.rules` bez izmjene — sadržinski identičan §31 (`.md` i `.docx`, TEST_REPORT i08). Novi test
  `firebase/tests/normativnaPravila.test.js` (I08-T01: isijecanje jedinog javascript bloka §31 iz `.md`, uklanjanje markdown escape-ova,
  normalizacija red po red po i08/P-2; kontrola komparatora); samo `node:fs`, bez novog paketa, pokreće se istim `npm test`.
- **§30 RULE-T01 … RULE-T12 konačno:** RULE-T01 + neautentifikovan list `users`; nov RULE-T04 granice (0 / 101 / ne-string, klijentski
  `updatedAt`, bez `updatedAt`); novi RULE-T08, RULE-T09 granice upita (limit 20 / 21, bez limit-a, bez `where uid`, tuđi uid); nov RULE-T10
  list 50 / 51 i granice `readAt` (klijentsko vrijeme, null → null, drugi put); RULE-T12 bez „preliminarno” — konteksti neautentifikovan /
  vlasnik (dokument sa `uid == auth.uid`) / drugi, operacije get, list, list `where uid limit 20`, set, create, update, delete, podkolekcije
  (i ispod `users/{uid}`, `loyaltyAccounts/{uid}`, `rewardRequests/{key}`) i `collectionGroup`. Postojeće asercije nepromijenjene.
- **AC-02:** I08-T02 u `podrazumijevanaZabrana.test.js` — create, update, set merge, delete nad 6 kritičnih kolekcija za 3 konteksta i
  konkretno povećanje `availablePoints`; stanje poslije provjereno bez pravila (nepromijenjeno, ništa kreirano).
- **B-1 (§8.2, i03/P-5, i08/P-3 B):** `backend/src/validacija/identifikator.js` — `jeIspravanIdDokumenta` odbija `\p{Cc}` (jedino mjesto
  provjere); `zahtjevIzdavanja.js` — uklonjena lokalna `KONTROLNI_ZNAK` provjera (duplikat). `loyaltyUid` sa kontrolnim znakom → 404
  `LOYALTY_ACCOUNT_NOT_FOUND` bez pristupa bazi, redoslijed provjera i03/P-6 nepromijenjen; `rewardId` ponašanje identično (I04-T03 (a), (b)
  zeleni bez izmjene). Test I08-T03 u `backend/test/emulator/kupovina.test.js`.
- **NFR-07:** inspekcija I08-T04 (TEST_REPORT i08), bez izmjene koda.
- **Dokumentacija:** TEST_REPORT (AC-12 tabela), TRACEABILITY, ODLUKE (§1 i07 ACCEPTED, i08 status; B-1 zatvoren; O-37, O-38, i08/P-n, K-1;
  §7 R-01 i07; §8 R-02 i07), ovaj unos.

### Commit-i

| Commit | Korak |
|---|---|
| `ff4072c` i08: odobrenje plana i odluke Orchestrator-a | 0 |
| `3dde696` i08: RULE-T01 … RULE-T12 konačno i test pravila = §31 (I08-T01, I08-T02) | K1 |
| `e8d10d0` i08: B-1 zabrana kontrolnih znakova u loyaltyUid (§8.2, i03/P-5) | K2 (+ `provjera.ps1` #1) |
| (bez commit-a) mutacije D01 … D06, NFR-07 inspekcija, `provjera.ps1` #2 (završni, kod `e8d10d0`) | K3 |
| dokumentacija (ovaj unos) | K4 |

### Odstupanja (OD-n, bez promjene ponašanja)

- **OD-1** — Naziv postojećeg testa RULE-T01 proširen u „RULE-T01 neautentifikovan read users/{uid} (get i list) → DENY” jer je dodata
  asercija za list (§30 „read”); oznaka RULE-T01 ostaje, postojeća asercija netaknuta.
- **OD-2** — Ručna `.docx` provjera (i08/P-1: „red po red”) urađena sa `<w:br/>` → prelom reda, pa poređenjem red po red (77 = 77, 0 razlika);
  poređenje bez bijelih znakova iz plana 3.2 (b) zadržano kao kontrola (1756 = 1756).
- **OD-3** — Prvi pokušaj mutacija D01 … D05 nevažeći: `--test-name-pattern=A|B|…` je `emulators:exec` izvršio kroz `cmd`, koji je `|`
  protumačio kao pipe (exit 255, nijedan test). Ponovljeno sa više `--test-name-pattern` opcija; pravila vraćena `git restore` poslije svakog.
- **OD-4** — U mutacionim run-ovima sa filterom imena, fajlovi bez izabranog testa prijavljuju grešku nivoa fajla (`after` poziva
  `cleanup` nad neinicijalizovanim okruženjem jer `before` nije izvršen). Artefakt filtera; ishod mutacije se čita samo iz imenovanih testova.
- **OD-5** — I08-T02 za `loyaltyAccounts` kao „create” koristi `loyaltyAccounts/korisnikB` (ID dokumenta = uid, kolekcija nema polje `uid`);
  ostale kolekcije nov dokument sa `uid == A`. Konteksti uključuju i drugog korisnika i neautentifikovanog (plan 5.4).

### Status pitanja i08/P-n

P-1 A (I08-T01 nad `.md`; `.docx` provjera u TEST_REPORT, bez razlike); P-2 A (red po red); P-3 B (`jeIspravanIdDokumenta`, duplikat uklonjen;
I04-T03 (a), (b) zeleni bez izmjene); P-4 (AC-12 tabela iz `provjera.ps1` #2). K-1: D06 obara I08-T03 i I04-T03 (a).

### Poznata ograničenja

- I08-T01 zavisi od `.md` kopije SRS-a (nepromjenljiva); regeneracija drugim alatom može oboriti test zbog formata (plan 11).
- Normalizacija red po red je stroža od „samo razmaci”: drugačiji prelom reda u `firestore.rules` obara I08-T01.
- AC-12 je ovdje backend dio nad emulatorom; završna potvrda u i11 (pravi projekat, O-2).

## Iteracija 9 — Android 1: Prijava, Registracija, Home, Customer QR

Grana `iteracija-09` (iz `main` = merge `2e98999`, tag `i08`). Brief: `docs/iteracije/i09_brief.md`. Plan: `docs/iteracije/i09_plan.md`
(odobren uz i09/P-1 … P-7, K-1, K-2, sekcija 14; K-3 poslije smoke-a). Uloga: BUILDER, 2026-10-19 – 2026-10-20. Režim: ekspresni (O-30, O-31).
Unos je sažet po O-30 (d).

### CHANGELOG

- **Toolchain i zavisnosti (O-45, i09/P-1 A):** Kotlin 2.3.21 + `compilerOptions` (`jvmTarget` JVM_11); AGP 8.10.1, Gradle 8.11.1,
  compileSdk/targetSdk 35, minSdk 26 nepromijenjeni; Firebase BoM 34.19.0 (auth, firestore), Navigation Compose, lifecycle-viewmodel-compose,
  kotlinx-coroutines (+ play-services), OkHttp 5.3.2 + kotlinx.serialization, ZXing core; test: kotlinx-coroutines-test, mockwebserver.
- **Konfiguracija (O-39, O-40):** bez `google-services.json` i plugin-a; `FuelPointsAplikacija` inicijalizuje `FirebaseApp` iz BuildConfig
  (`demo-fuelpoints`, demo vrijednosti); debug: Auth `10.0.2.2:9099`, Firestore `10.0.2.2:8080`, Backend `http://10.0.2.2:3000/api/v1/`;
  cleartext samo u debug `network_security_config` za `10.0.2.2`; main manifest samo `INTERNET`. Release bez konfiguracije (i09/P-7).
- **Domen:** `ValidacijaLozinke` (§3.6, i09/P-2 A), `ValidacijaImena` (1–100 UTF-16, i02/P-3), `GeneratorQr` (ZXing, sadržaj = UID),
  `PorukeGresaka` (§3.5, §27 → srpske poruke, i09/P-4 B), `ProvjeraNaloga` (AUTH-06, AUTH-03 sa i09/P-3 A+B, AUTH-05 (v)).
- **Podaci:** `OkHttpBackendApi` (API-01, API-06; Bearer `getIdToken` po pozivu; init tijelo tačno `{ displayName, acceptedTermsVersion }`;
  API-06 `Content-Length: 0` bez `Content-Type`; §27 parsiranje; 503 → jedan ponovni pokušaj poslije 1 000 ms, R-04), `FirebaseIzvorAutentikacije`
  (prijava, registracija, Auth profil, `sendPasswordResetEmail`), `FirestoreIzvorNaloga` (samo snapshot `users/{uid}`, `loyaltyAccounts/{uid}`,
  `isFromCache`; nijedan upis, §2.2).
- **UI (UI-01 … UI-04, O-41, O-44):** ekrani Prijava, Registracija (+ Uslovi 1.0, i09/P-6), Pokretanje / Dovršetak registracije / Brisanje u
  toku, Home (`displayName`, `availablePoints`, `reservedPoints` > 0, marker NFR-08, API-06 pri ON_START, O-43), Moj QR (QR + UID kao tekst);
  navigacija u jednoj aktivnosti; tema „displej pumpe” svijetla i tamna, fontovi i ikone kao resursi sa licencama (i09/P-5 A).
- **Smoke (O-31 (d)):** `skripte/pokreniLokalno.ps1` (emulatori + seed + Backend iz `.env`), `docs/smoke/i09_smoke.md`, README.
- **Testovi:** I09-T01 … I09-T12 (67 JVM testova, `testDebugUnitTest`, ulaze u `provjera.ps1`); I09-T13 je ručna inspekcija S11 (nije izvršena, OD-4).
- **Dokumentacija (K7):** TEST_REPORT i09, TRACEABILITY, ODLUKE (§1 i08 ACCEPTED, i09 status; O-39 … O-45; i09/P-n, K-n; §4 dopuna i01/P-8;
  §7 nalaz S13), ovaj unos. Backend, Rules, SRS i `provjera.ps1` nepromijenjeni.

### Commit-i

| Commit | Korak |
|---|---|
| `dfec2fc` i09: odobrenje plana i odluke Orchestrator-a | 0 |
| `c3d53a8` i09: zavisnosti, Firebase konfiguracija bez google-services i tema (O-39, O-40, O-45) | K1 |
| `142cae0` i09: validacija, generator QR-a, API klijent i izvori podataka (I09-T01, T02, T06, T07) | K2 + K3 (i09/K-1) |
| `28c3fa9` i09: tokovi AUTH-01/03/06/09, Home i QR u ViewModel-ima (I09-T03 … T11) | K4 |
| `5a36837` i09: ekrani Prijava, Registracija, Home i Moj QR (UI-01 … UI-04) | K5 (+ `provjera.ps1` #1) |
| `b083e7f` i09: skripta za lokalni smoke i protokol (O-31 (d)) | K6 (+ `provjera.ps1` #2, završni, kod `b083e7f`) |
| (bez commit-a) smoke S1 … S13 — Ana, 2026-10-20 | i09/K-2 |
| i09: TEST_REPORT, smoke, sljedivost i registar odluka (ovaj unos) | K7 |

### Odstupanja (OD-n)

- **OD-1** — Smoke je izvršen na emulatoru **API 26**, a ne API 35 kako traže O-31 (d), i09/K-2 i protokol. S1 … S9 i S13 PASS na API 26;
  S10 (tamna tema) N/A jer API 26 nema sistemski tamni režim → provjera na API 35 u i11 (uz NFR-09).
- **OD-2** — U S4 (i dalje u smoke-u) registracija je urađena sa `ana@primjer.com` umjesto `ana@primjer.ba` iz protokola; bez uticaja na
  ishod (kupovina 42 730 ml → `earnedPoints` 42, Home 42 bez osvježavanja).
- **OD-3** — S12 odložen: screenshot-i Prijava, Home i Moj QR nisu u `docs/smoke/` (brief, isporuka; plan K7 i DoD). Snimaju se konačni
  ekrani poslije i10.
- **OD-4** — S11 nije ručno izvršen (N/A). Prema planu (sekcija 8) I09-T13 nije automatski test nego upravo inspekcija S11 (Compose UI
  testovi van opsega), pa za NFR-10 (touch target ≥ 48×48 dp, contentDescription) u i09 nema izvršene provjere. TRACEABILITY: NFR-10
  „IMPLEMENTIRANO, neprovjereno”. Odluku o tome gdje se provjera nadoknađuje (i10 smoke ili i11) donosi Orchestrator / Reviewer.
- **OD-5** — `EkranBrisanjaUToku` je funkcija u `ui/pokretanje/EkranPokretanja.kt`, a ne poseban fajl `EkranBrisanjaUToku.kt` iz plana
  (sekcija 12); ponašanje isto.
- **Napomena (bez odstupanja):** u K7 komanda `testDebugUnitTest` je za rezultat po ID-u pokrenuta jednom; Gradle je task prijavio kao
  UP-TO-DATE, pa su pročitani XML izvještaji izvršavanja nad kodom `b083e7f` (TEST_REPORT i09). `provjera.ps1` nije ponovo pokretan.

### Status pitanja i09/P-n

P-1 A (Kotlin 2.3.21; dopuna i01/P-8 u ODLUKE §4); P-2 A (I09-T01); P-3 A sa B kao rezervom (I09-T08, S9); P-4 B (I09-T11); P-5 A
(`res/font`, `res/drawable`, `android-app/licence/`); P-6 tekst uslova kako je odobren (resurs `uslovi_1_0`); P-7 prihvaćeno. K-1 primijenjen
(commit `142cae0`); K-2 primijenjen (smoke prije K7, uz OD-1); K-3 upisan (ODLUKE §3, §7).

### Poznata ograničenja

- **Nalaz S13 (i09/K-3):** Firebase Auth SDK (tag `FirebaseAuth`) ispisuje u Logcat e-mail (INFO: „Creating user with …”, „Logging in as …”,
  „Password reset request …”) i UID (DEBUG: „Notifying id token / auth state listeners about user ( <UID> )”). Token se ne ispisuje; kod
  aplikacije ne loguje (I09-T12). E-mail i UID nisu tajne u smislu NFR-07, ali je nalaz bitan za sigurnosni fokus rada. Kod se u i09 ne
  mijenja. **Obaveza za i11:** release build sa R8 pravilom koje uklanja `Log.v` / `Log.d` / `Log.i` pozive (uključujući SDK).
- NFR-10 u i09 neprovjeren (OD-4); tamna tema neprovjerena na uređaju (OD-1); screenshot-i odloženi (OD-3).
- Emulator nema password policy ni Email Enumeration Protection: slabu lozinku zaustavlja samo klijent; konačno u i11 (O-2).
- `isFromCache` marker se pali tek kad Firestore SDK zaključi da je offline (do ~10 s; S6 PASS).
- `BrisanjeUToku` nema akciju (logout je i10).
- QR-06: statični UID se može fotografisati — prihvaćen rizik; QR nosi samo UID (AC-04).
- Kombinacija AGP 8.10.1 + Kotlin 2.3.21 radi, ali nije zvanično testirana za svaku buduću biblioteku; Firebase BoM 35.x i novije androidx
  linije traže viši AGP / compileSdk (i09/P-1).
- Debug APK bez minifikacije; release i minifikacija u i11.

---

## Iteracija 10 — Android 2 (Builder, 2026-10-20)

Grana `iteracija-10`, commit-i: K1 `918bebe` (API klijent, izvori, indeksi), K2 `39aa7fb` (domen i ViewModel-i), K3 `ce21ab6` (ekrani), K4 `ca2f508` (smoke protokol, README), K5 (dokumentacija).

- API klijent: `izdajNagradu`, `otkaziVoucher`, `obrisiNalog` (DELETE, svjež token); segmenti putanje kodirani; 503 → jedan ponovni pokušaj sa istim tijelom; `ZastavicaBrisanja` blokira sve osim API-07.
- Izvori (samo čitanje, osim dva upisa): `FirestoreIzvorKupovina` (limit 20, `startAfter`), `FirestoreIzvorNagrada` (katalog; voucher-i `uid`, `status == ACTIVE`, `orderBy expiresAt`, limit 20), `FirestoreIzvorObavjestenja` (limit 50; `readAt` sa `ESTIMATE`; jedini upis `readAt`), `FirestoreIzvorNaloga.promijeniIme` (jedini upis u `users`, rok 10 s).
- `firebase/firestore.indexes.json`: tri composite indeksa (nisu provjereni nad emulatorom; provjera nad pravim projektom u i11).
- Domen: `GeneratorZahtjeva`, `PokusajIzdavanja` (i10/P-2), `Odbrojavanje`, `Prihvatljivost`, `Prikaz`, `TokBrisanja` (i10/P-7), `PorukaZaPrijavu` (jednokratna poruka za Login), `PorukeGresaka` (dopuna §27).
- UI: donja navigacija (QR centralno), zvono na Home-u (dugme „Moj QR kod” uklonjeno, i10/P-4), ekrani Istorija, Nagrade (QR = tačno `voucherId`), Obavještenja, Profil (+ ime, lozinka, pomoć, brisanje), `EkranBrisanjaUToku` sa akcijama; globalni prelaz na Login pri gubitku sesije (osim za vrijeme brisanja).
- Bez promjena: `backend/`, `firestore.rules`, `docs/srs/`, Gradle zavisnosti (I10-T15).
- Poznato: poruka „Ime je sačuvano.” se ne vidi jer se ekran odmah zatvara; 401 na Rewards ekranu vodi na Login bez poruke; Kotlin pozivi `startAfter`, `ESTIMATE`, `reauthenticate` prvi put na uređaju u smoke-u.


### Iteracija 10 — smoke i zatvaranje (2026-10-21)

Ana je izvršila smoke S1 … S20 na API 35: 19 PASS, S9 (opciono, isticanje voucher-a) nije rađen, 0 FAIL. `provjera.ps1` 2× PASS (O-30). Screenshot-i
u `docs/smoke/`. Rezultati su upisani u TEST_REPORT i10; TRACEABILITY redovi i10 prebačeni u PASS. Kod nije mijenjan.

**Otvorena stavka za i11:** raspored ekrana „Pomoć i česta pitanja” nije najpregledniji (kozmetička primjedba iz S13, ne blokira).

### Iteracija 10 — FIX LOOP 1 (nalazi R-01 … R-03 iz `docs/iteracije/i10_review.md`)

- **R-01:** `EkranBrisanjaNaloga` ima `BackHandler` koji poziva `vm.odustani()` (gasi zastavicu „brisanje u toku”); onemogućen dok je stanje `URadu` (DELETE u toku) i poslije `Zavrseno`. Novi JVM testovi u `I10T12TokBrisanjaTest`: `ViewModel odustani poslije 409` i `poslije 503` → zastavica ugašena.
- **R-02:** zabilježeno odstupanje OD-1 ispod; kod nije mijenjan.
- **R-03:** TEST_REPORT i10 usklađen (zastarjele rečenice uklonjene, hash koda, broj JVM testova); PR `iteracija-10` → `main` otvoren bez merge-a.

#### Odstupanja od plana

**OD-1 — „Nastavi brisanje” šalje DELETE odmah, lozinka se traži tek na 409 (i10/P-6, plan 5.8).** Plan: nastavak ide od unosa lozinke (reauth → DELETE) i
test „nastavak + `NepostojeciKorisnik` → `Zavrseno`, 0 DELETE”. Implementirano (`TokBrisanja(nastavak = true)`, `pokreniNastavak()`, commit `0c882c3`): DELETE
odmah sa svježim tokenom, lozinka tek poslije `409 REAUTHENTICATION_REQUIRED`; test očekuje 1 DELETE. Razlog: §23.4 — nastavak je ponovljen DELETE, a Backend
sam odlučuje o svježini prijave (O-35). Ponašanje je prihvaćeno kao razumno; kod nije mijenjan.

## Iteracija 11 — POS Simulator, pravi Firebase projekat, Release, završna NFR provjera (Builder, 2026-10-21)

Grana `iteracija-11`. Backend (`backend/src`) i `firebase/firestore.rules` nisu mijenjani (P-1 A).

- **K1** (`f436cfc`): odluke P-1 … P-9 u `ODLUKE.md`, status i10/i11; `.gitignore` za `firebase.local.properties`, `*.keystore`, `*.jks`, `.env.real*`, `docs/**/*.apk`.
- **K2** (`f31c78d`): `pos-simulator/` — `index.html` (forme API-02 i API-04, ključ samo u memoriji, `type=password`), `logika.js` (čista logika: konverzije litara/EUR u `volumeMl`/`amountMinor` nad ciframa teksta, tijela zahtjeva, prikaz odgovora), `server.js` (`node:http`, proxy samo za dvije POS rute, bez logovanja ključa/tijela). Testovi I11-T01, T02, T04 (`pos-simulator/test/`), I11-T03 (`backend/test/emulator/posSimulator.test.js`). Korak „POS Simulator: npm test” u `provjera.ps1`.
- **K3** (`9865c7e`): Pomoć kao padajuća pitanja (P-6): `pomoc_p1…p6`, `pomoc_o1…o6`, `pomoc_kontakt_naslov`, `pomoc_kontakt`; zaglavlje pitanja ima ulogu dugmeta, `stateDescription` (Prošireno/Skupljeno), `heading()`, ≥ 48 dp, podrazumijevano skupljeno. I11-T07.
- **K4** (`1901635`): `release` — `isMinifyEnabled`/`isShrinkResources`, `-assumenosideeffects` za `Log.v/d/i`, Firebase konfiguracija i `backend.baseUrl` iz `android-app/firebase.local.properties` (`https://` obavezan); `releaseProba` (`initWith(release)`, debug potpis, cleartext samo `10.0.2.2`). Demo vrijednosti ostaju samo u `debug`. I11-T05, T06.
- **K5/K8** : `docs/uputstva/pravi_firebase_projekat.md`, `android-app/firebase.local.properties.example`, `docs/smoke/i11_smoke.md`.
- **K6/K9 (statika)**: I11-T09 (Android upiti sa `orderBy` ↔ `firestore.indexes.json`), I11-T08 (tajne u praćenim fajlovima).

#### Odstupanja od plana

**OD-1 — FAQ ima 6 pitanja, ne 7.** Plan (K3, I11-T07) navodi 7 pitanja/odgovora (`pomoc_p1…p7`), ali odobreni tekst iz i10 ima 6 pitanja i blok „Kontakt” (ukupno 7 blokova; „Kontakt” nije pitanje i ne završava sa „?”). Tekst nije mijenjan; I11-T07 provjerava 6 pitanja + Kontakt i doslovnu jednakost sa tekstom iz taga `i10`.

**OD-2 — I11-T08 koristi PEM marker sa crticama** (`-----BEGIN … PRIVATE KEY-----`) umjesto `BEGIN … PRIVATE KEY` iz plana, jer su stariji `docs/iteracije/*.md` samo pominjali taj izraz kao tekst obrasca (nije ključ).

**OD-3 — `releaseProba` nije jedini build type sa cleartext-om:** `debug` ga ima od i09 (O-40); testovi I11-T06 traže tačno skup {debug, releaseProba}, oba samo za `10.0.2.2`.

**OD-4 — I11-T03 neprovjeren** (vidi TEST_REPORT i11).

**Otvoreno:** K5 … K8 i AC-12 završni run čekaju Aninu ručnu akciju; dokumentacija K10 (TRACEABILITY redovi u PASS, README, ODLUKE §7) se dovršava poslije njih.

