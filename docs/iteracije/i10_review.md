# i10 — Review (ADVERSARIAL REVIEWER)

Iteracija 10: Android 2 — Purchases, Rewards, Notifications, Settings. Grana `iteracija-10`, vrh `b10c469`.
Ulaz: `i10_brief.md`, `i10_plan.md` (sekcija 14 — odobrene preporuke), `TEST_REPORT.md`, `TRACEABILITY.md`, `ODLUKE.md`, SRS 3.1, kod K1 … K5.
Uloga: REVIEWER (kod nije mijenjan). Izvršeno u ovoj sesiji: `gradlew testDebugUnitTest --offline` (zeleno, rezultati u `build/test-results`: **156 testova, 0 failures, 0 errors, 0 skipped**),
`git diff main` nad `backend`, `firestore.rules`, `firebase.json`, `docs/srs`, `skripte`, `libs.versions.toml`, `build.gradle.kts`, `AndroidManifest.xml` (**prazno**),
grep na `Log.` / `println` / `printStackTrace` u `src/main` (**prazno**), tajne u repou (**nema**), potpisi alata u commit porukama (**nema**).
`provjera.ps1` i smoke nisam pokretao (kod je nepromijenjen od Aninog izvršenja prema TEST_REPORT-u).

## Odluka: **FIX LOOP** (1 MAJOR, 2 MINOR, 3 NOTE)

Funkcionalno jezgro je u skladu sa SRS-om i odobrenim planom; nalazi ispod su uski i brzo se ispravljaju. Poslije ispravki R-01 … R-03 očekujem ITERATION ACCEPTED bez novog punog kruga.

## Šta je provjereno i odgovara

- **Nepregovorljiva pravila.** Jedini Firestore upisi u `src/main`: `FirestoreIzvorNaloga.promijeniIme` (tačno `displayName` + `updatedAt = serverTimestamp()`, RULE-T04) i
  `FirestoreIzvorObavjestenja.oznaciProcitano` (tačno `readAt = serverTimestamp()`, RULE-T10; samo kad je `readAt == null`, jedan upis po ID-u). Nijedan upis u `purchases`, `loyaltyAccounts`,
  `vouchers`, `rewardRequests`, `redemptionRequests`, ledger (§2.2, AC-02). UID dolazi iz Auth-a, `stationId` se ne dotiče, vrijeme je `serverTimestamp()`.
- **Upiti (§31, ODLUKE (e), (i)).** `purchases`: `uid ==`, `orderBy occurredAt desc`, `limit(20)`, `startAfter(sirovi posljednji snimak)`; `notifications`: `uid ==`, `createdAt desc`, `limit(50)`;
  `vouchers`: `uid ==`, `status == ACTIVE`, `orderBy expiresAt asc`, `limit(20)` (i10/P-9). `firestore.indexes.json` = tačno tri indeksa iz plana 5.3; Rules, Backend i SRS nepromijenjeni.
- **API klijent.** API-03 tijelo tačno `{requestId}`; API-05 i API-06 `Content-Length: 0` bez `Content-Type`; API-07 `DELETE` bez tijela, `osvjezi = true` (O-35), `204` bez parsiranja;
  segmenti putanje kodirani (`addPathSegment`); jedan ponovni pokušaj na 503 sa istim tijelom; zastavica fail-closed za sve osim API-07 (ODLUKE (v)); Authorization se ne loguje (nema logovanja uopšte).
- **O-50 / i10/P-2.** `PokusajIzdavanja`: isti `requestId` za istu nagradu dok pokušaj nije zatvoren; zatvara ga `Uspjeh` i 4xx sa čitljivim §27 kodom; 503 / mreža / 500 / nečitljiv odgovor ostavljaju pokušaj otvorenim.
  Dijalog potvrde prije generisanja ID-a (i10/P-8); paralelni tapovi blokirani (`radi`).
- **O-49 / (s).** `Odbrojavanje` sa `ceil` na sekunde, `≤ 0` → istekao; tačno jedan API-06 po voucher-u (skup `prijavljeniIstekli`); lista se mijenja samo Firestore snimkom; `409 VOUCHER_EXPIRED` na cancel → API-06 + poruka.
  Reward QR = tačno `voucherId`; `voucherId` se ne prikazuje i ne loguje.
- **Brisanje naloga (tok).** Redoslijed upozorenje → lozinka → reauth → svjež token → `DELETE`; `204` → `odjavi` → Login „Nalog je obrisan.”; `409 REAUTH` → ponovo lozinka; `401` poslije pokrenutog DELETE-a → završeno,
  `401` na prvom DELETE-u → istekla sesija (i10/P-7); 503 / mreža / 500 → „Pokušaj ponovo”. Home ne zove API-06 niti navigira dok je zastavica uključena.
- **Profil / Logout / lozinka.** Odjava bez Backend poziva i Firestore upisa (I10-T13); promjena lozinke `reauth → updatePassword` uz §3.6 validator; reset neutralna poruka; ime 1–100 UTF-16 bez trim-a.
- **Zavisnosti / dozvole.** Nema novih Gradle zavisnosti ni dozvola (O-45); nema TODO/FIXME-a za funkcionalnost i10 u novom kodu.

## Nalazi

### R-01 — MAJOR — Zastavica „brisanje u toku” ostaje uključena kad korisnik izađe iz toka sistemskim „nazad” (ODLUKE (v), P-6, nepregovorljivo: stanje aplikacije mora biti tačno)

`TokBrisanja.obrisi()` uključuje zastavicu prije DELETE-a, a gasi je samo u `zavrsi()` i `odustani()`. `EkranBrisanjaNaloga` (`ui/profil/EkraniProfila.kt:161`) nema `BackHandler`, a
`onDismissRequest = vm::odustani` pokriva samo dijalog upozorenja. Scenarij:

1. Profil → Obriši nalog → Nastavi → lozinka → DELETE vrati `409 REAUTHENTICATION_REQUIRED` (prošlo > 5 min od prijave; Backend **nije ništa pokrenuo**, O-35). Stanje `UnosLozinke(POTVRDITE_LOZINKU)`, zastavica **uključena**.
2. Korisnik pritisne sistemsko „nazad” (ne „Odustani”) → vraća se na Profil; `ViewModel` se uništava, zastavica ostaje `true` (živi u `Zavisnosti`, do kraja procesa).
3. Posljedice: `OkHttpBackendApi` vraća lažni `ACCOUNT_DELETION_IN_PROGRESS` (status 0) za init / API-06 / API-03 / API-05 → tap na „Izdaj” u Nagradama navodi na ekran „Nalog se briše” za nalog koji se ne briše;
   Home više ne zove API-06; `NavigacijaAplikacije` ignoriše gubitak sesije (`!zastavicaBrisanja.jeUkljucena()`), pa istekla/odjavljena sesija ne vodi na Login. Oporavak je samo ubijanje procesa.

Isto važi za `MozePonoviti` (503 / mreža) + „nazad”: tu je zastavica djelimično opravdana (DELETE je možda pokrenut), ali je i tada ostavljena bez ikakvog puta ka „Nastavi brisanje”, osim kroz lažne ACCOUNT_DELETION_IN_PROGRESS izlaze.
Plan 5.8 (kraj tačke 5): „Odustajanje … gasi zastavicu”; test `odustajanje poslije 409 gasi zastavicu` pokriva samo dugme, ne „nazad”.

**Ispravka:** `BackHandler` na `EkranBrisanjaNaloga` koji poziva `vm.odustani()` (ili gašenje zastavice u `onCleared()` ViewModel-a kad stanje nije `Zavrseno` i DELETE nije potvrđeno kao pokrenut; za `MozePonoviti` zadržati
zastavicu samo ako se obezbijedi put do „Nastavi brisanje”). Dodati JVM test (npr. `I10-T12` varijanta: `ViewModel.onCleared` / `odustani` poslije 409 → zastavica ugašena).

### R-02 — MINOR — „Nastavi brisanje” odstupa od odobrenog plana i odstupanje nije zabilježeno (i10/P-6, plan 5.8, I10-T12)

Odobreno (P-6 A, plan 5.8): „Nastavi brisanje” → *isti tok od koraka 2* (unos lozinke → reauth → DELETE), a test „nastavak + reauth `NepostojeciKorisnik` → `Zavrseno`, **0 DELETE**”.
Implementirano: `TokBrisanja(nastavak = true)` počinje u `URadu` i **odmah** šalje DELETE sa svježim tokenom (`pokreniNastavak()`), a lozinku traži tek poslije `409`; test `nastavak sa 409 REAUTH …` očekuje **1 DELETE**.
Ponašanje je razumno (§23.4: nastavak je ponovljen DELETE), ali je ono što je Ana odobrila drugačije, a `IMPLEMENTATION_LOG` i10 nema odjeljak „Odstupanja od plana” (OD-n) niti pominje ovu izmjenu.
**Ispravka:** ili uskladiti kod sa planom, ili (jednostavnije) upisati OD-n u `IMPLEMENTATION_LOG` i i10 napomenu u `ODLUKE` §3 (i10/P-6: realizacija = DELETE odmah, lozinka tek na 409), uz ažuriranu formulaciju u TRACEABILITY.

### R-03 — MINOR — TEST_REPORT: nedostaje commit završnog `provjera.ps1` run-a, brojači, i ostali su zastarjeli iskazi (CLAUDE.md „Izvor istine”; O-30 (a); plan K5)

- Brief 5 / O-30 (a): „u TEST_REPORT commit koda završnog run-a”. Sekcija „`provjera.ps1` (O-30) — Ana” ga ne sadrži, niti brojače i trajanje („nisu dostavljeni”). Trenutno je to prepričan, ne izvršen rezultat; CLAUDE.md traži samo stvarno izvršene komande i stvarni rezultat.
  Kod je poslije originalnog JVM run-a mijenjan (`0c882c3` „ispravke prije smoke-a”), pa treba biti jasno na kojem commit-u su oba `provjera.ps1` run-a i smoke izvršeni.
- Gornji dio sekcije i dalje tvrdi „Builder NIJE pokretao `provjera.ps1`… ručna provjera nije izvršena … PR prema `main` nije otvoren”, a donji dio kaže suprotno; JVM brojka je „154”, a danas `testDebugUnitTest` daje **156** (nova testovi iz `0c882c3`?).
- PR: `gh pr list --state all --head iteracija-10` ne vraća nijedan PR (grana je na `origin`, PR-a nema). Brief 6 traži „PR iteracija-10 → main bez merge-a”.

**Ispravka:** upisati hash koda (npr. `b10c469` ili posljednji commit koji dira `android-app/`), stvarni izlaz jednog `provjera.ps1` run-a (ili jasno naznačiti da su brojači Anina usmena prijava), uskladiti 154 → 156 i zastarjele rečenice, otvoriti PR bez merge-a.

### R-04 — NOTE — S9 (isticanje voucher-a na uređaju) nije izvršen

Ostaje samo JVM pokrivenost (I10-T04, T06, T11) i backend testovi; ručno nije potvrđen put „0:00 → istekao → API-06 → nestaje”. Prihvatljivo (S9 je opcioni u protokolu, dokumentovano), ali Orchestrator neka svjesno potvrdi; preporuka je da se S9 odradi u i11 smoke-u.

### R-05 — NOTE — Composite indeksi i Kotlin SDK upiti provjereni samo oblikom

Emulator ne provjerava indekse (plan 11); `I10-T15` provjerava oblik JSON-a, smoke S3/S4/S10 potvrđuju upite nad emulatorom. Prava provjera u i11 (već u „Otvorenim stavkama za i11”). Bez akcije u i10.

### R-06 — NOTE — Home `ViewModel` u back stack-u tokom brisanja

Poslije `204` dokument `users/{uid}` nestaje; `PocetnaViewModel` (živ u back stack-u ispod `brisanjeNaloga`) može emitovati `IzlazSaPocetne.Pokretanje` jer provjera `!zastavica.jeUkljucena()` štiti samo granu `DELETION_IN_PROGRESS`.
Posljedica je neškodljiva (izlaz se ne potroši dok ekran nije prikazan, a API klijent je fail-closed, pa init ne izlazi), a `zavrsi()` odmah vodi na Login. Bez akcije; spomenuto radi potpunosti.

## Pokrivenost zahtjeva (sažetak)

UI-03/O-46, UI-05, UI-06, UI-07, UI-08, AUTH-05, AUTH-07, AUTH-08, AUTH-09, §12–§14, §17, §19, §21, §23, §27 (klijent), §2.2/AC-02, NFR-07 — implementirano i pokriveno testovima I10-T01 … T15 (156 JVM testova zeleno).
NFR-10 (I10-T16) i NFR-09 (API 35) — smoke S17/S18 PASS prema TEST_REPORT-u (Ana). NFR-09 na API 26 ostaje i11.

## Uslovi za ITERATION ACCEPTED

1. R-01 ispravljen + test; `testDebugUnitTest` zelen.
2. R-02 zabilježen (ili kod usklađen) u IMPLEMENTATION_LOG / ODLUKE / TRACEABILITY.
3. R-03 ispravljen (TEST_REPORT dosljedan, commit završnog run-a, PR otvoren bez merge-a).
4. Ako R-01 mijenja kod u `android-app/`: ponovni `provjera.ps1` je potreban samo ako Orchestrator tako odluči (O-30 (a)/O-31 — promjena je u Android sloju koji `provjera.ps1` ne pokriva osim backend/Rules regresije); JVM testovi obavezni.

---

## Ponovni pregled poslije FIX LOOP-a 1 (commit `3129b67`)

Pregledan diff `fb182cc..3129b67` (`EkraniProfila.kt`, `I10T12TokBrisanjaTest.kt`, IMPLEMENTATION_LOG, ODLUKE, TEST_REPORT, TRACEABILITY).

- **R-01 — ISPRAVLJEN.** `EkranBrisanjaNaloga` ima `BackHandler(enabled = stanje != URadu && stanje !is Zavrseno) { vm.odustani() }`; sistemsko „nazad” gasi zastavicu isto kao „Odustani”,
  a dok traje DELETE (`URadu`) je onemogućeno, pa se ne ostavlja nepoznato stanje. Dodata dva JVM testa (`ViewModel odustani poslije 409` i `poslije 503`) koja provjeravaju ugašenu zastavicu.
  Napomena: testovi pozivaju `vm.odustani()` direktno, a ne sam `BackHandler`; povezanost „nazad” → `odustani()` pokriva kod (jedan red) i Anina ručna provjera (unos lozinke → „nazad”, bez 409).
  Ručna reprodukcija 409 + „nazad” nije izvodljiva na Auth emulatoru (ne poštuje realan `auth_time`); prihvatam to kao dokumentovano ograničenje.
- **R-02 — ISPRAVLJEN.** OD-1 upisan u IMPLEMENTATION_LOG („Odstupanja od plana”), napomena uz i10/P-6 u ODLUKE §3, TRACEABILITY red za §23 ažuriran.
- **R-03 — ISPRAVLJEN.** TEST_REPORT: zastarjele rečenice uklonjene, 154 → 156 → 158 objašnjeno, naveden commit `0c882c3` za `provjera.ps1` i smoke, a Anina prijava `provjera.ps1`
  izričito označena kao usmena (ne izvršena komanda u evidenciji), što je iskreno i prihvatljivo. PR #10 `iteracija-10` → `main` otvoren (OPEN, bez merge-a).
- **Provjera testova (Reviewer).** `gradlew.bat testDebugUnitTest --offline` sa `JAVA_HOME` = JDK iz Android Studio-a, na `3129b67`, poslije brisanja starih izvještaja:
  BUILD SUCCESSFUL, **158 testova, 0 failures/errors, 0 skipped**. (Prvi pokušaj bez `JAVA_HOME` pao je u konfiguraciji Gradle-a, ne u testovima; ponovljen sa ispravnim JDK-om.)
- Novi nalazi: nema. R-04 … R-06 (NOTE) ostaju kao ranije (S9 i API 26 u i11).

## Konačna odluka: **ITERATION ACCEPTED**

Svi uslovi iz odjeljka „Uslovi za ITERATION ACCEPTED” su ispunjeni. Merge `iteracija-10` → `main` i anotirani tag `i10` rade se po CLAUDE.md tek poslije ove odluke (Orchestrator/Ana); otvorene stavke za i11 ostaju u TEST_REPORT-u.
