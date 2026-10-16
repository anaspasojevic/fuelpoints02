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
docs/iteracije/i03_plan.md                          (samo sekcija 15)
docs/TRACEABILITY.md                                (samo redovi Iteracije 3)
docs/IMPLEMENTATION_LOG.md
docs/TEST_REPORT.md
```

Netaknuti: `docs/srs/*` (SHA-256 provjeren), `docs/iteracije/i03_brief.md`, `CLAUDE.md`, katalog grešaka, `GreskaApi.js`, `obradaGresaka.js`,
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
