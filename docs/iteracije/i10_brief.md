ITERATION BRIEF — FuelPoints — ITERACIJA 10: Android 2 — Purchases, Rewards, Notifications, Settings

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-10 (iz main na tagu i09, merge 7dab954) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i10
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (verzija na tagu i09) — sve odluke obavezujuće. Režim: ekspresni (O-30, O-31; Android bez mutacija; smoke Ana).
Okruženje: kao i09 (Android Studio JBR za Gradle, emulator API 35, Firebase Emulator Suite, lokalni Backend preko skripte/pokreniLokalno.ps1).

1. CILJ
Kompletirati Android klijent do svih 8 ekrana MVP-a nad postojećim Backend-om i Rules-ima: istorija kupovina, nagrade (izdavanje, aktivni voucher sa
reward QR-om i odbrojavanjem, otkazivanje), obavještenja (readAt), podešavanja (ime za prikaz, promjena lozinke, reset, Help/FAQ, odjava, brisanje
naloga). Android ostaje untrusted klijent (§2.2): bodove i voucher-e mijenja ISKLJUČIVO Backend; Android piše u Firestore SAMO users.displayName +
updatedAt i notifications.readAt (§25.2, §25.8, §31).
Primjer smoke-a (API 35): Ana 72 boda (kupovine 42 730 ml i 30 000 ml) → Istorija: 2 stavke, novija prva → Nagrade: CAR_WASH (50) dostupna, SHOWER
(30) dostupna → izdaj CAR_WASH → Home 22 / rezervisano 50, aktivni voucher sa QR-om i odbrojavanjem 15:00 → otkaži → 72 / 0 → obavještenja: 2,
otvaranje postavlja readAt → Podešavanja: promijeni ime u „Ana S.” → Home „Zdravo, Ana S.” → odjava → prijava → brisanje naloga (lozinka) → Login.

2. SRS ZAHTJEVI U OPSEGU
- UI-03 (dopuna, O-46): Home dobija ulaze za Purchases, Rewards, Notifications i Settings (po dizajnu); API-06 pri otvaranju ostaje (O-43).
- UI-05 Purchase History: datum, količina goriva, iznos, valuta, earnedPoints; occurredAt DESC, 20 po strani, cursor paginacija (startAfter);
  upit sa where('uid','==',auth.uid), orderBy occurredAt desc, limit 20 (ODLUKE (e), §31 limit ≤ 20).
- UI-06 Rewards (jedan ekran): katalog iz rewardDefinitions (aktivne), eligibility (availablePoints ≥ costPoints), izdavanje API-03 sa requestId
  (UUID v4 malim slovima, O-15) generisanim JEDNOM po logičkom pokušaju i ponovljenim pri retry-ju (§13, O-16; 503 → retry istim requestId-em),
  aktivni voucher-i iz Firestore-a (where uid ==, status == ACTIVE, limit ≤ 20 — ODLUKE (i)), reward QR = voucherId, odbrojavanje do expiresAt (prikaz;
  autoritet je server — §17), otkazivanje API-05 (POST bez tijela, (s)); 409 VOUCHER_EXPIRED → osvježavanje + API-06 (ODLUKE (s)); greške §27
  (INSUFFICIENT_POINTS, REWARD_INACTIVE, REWARD_NOT_FOUND, IDEMPOTENCY_CONFLICT, ACCOUNT_DELETION_IN_PROGRESS, SERVICE_UNAVAILABLE …) sa srpskim
  porukama. Nema ekrana istorije voucher-a (§1.3). voucherId se nikad ne loguje (ODLUKE (h)).
- UI-07 Notifications: do 50 najnovijih (orderBy createdAt desc, limit 50), bez paginacije i grupisanja; otvaranje postavlja readAt =
  serverTimestamp() (RULE-T10: samo readAt, null → request.time).
- UI-08 Settings / Profile / Help: displayName (izmjena direktno u users/{uid}: { displayName, updatedAt: serverTimestamp() }, validacija 1–100
  UTF-16), Auth e-mail read-only, promjena lozinke (AUTH-08: reauthenticate + updatePassword, §3.6 validator), password reset link (AUTH-09),
  Help/FAQ (statički tekst — O-47), Logout (AUTH-07: signOut, server se ne mijenja), Delete Account (O-48).
- AUTH-05 / ODLUKE (v): poslije pokretanja DELETE-a Android ne poziva init ni druge API-je do 204; 401 na ponovljen DELETE = brisanje završeno.
- §27, §3.3 (Bearer svjež token), NFR-07 (nikad u Logcat: token, UID, e-mail, voucherId), NFR-08 (marker ostaje na Home-u), NFR-10 (≥ 48 dp,
  contentDescription), NFR-09 (smoke na API 35 — O-31 (d); API 26 u i11), AC-01 (logout), AC-02 (Android ne povećava bodove).
- Composite indeksi u firebase/firestore.indexes.json za Android upite (ODLUKE (e), (i)); firestore.rules se NE mijenja.

3. VAN OPSEGA
POS Simulator, pravi Firebase projekat, release build i R8 pravilo (i11); izmjene Backend-a i firestore.rules (ako Planner nađe da su neophodne — STANI,
i10/P-n); FCM; ekran istorije voucher-a; promjena e-maila; skener QR-a; offline scenariji osim NFR-08.

4. ZAVISNOSTI
i04 (API-03, O-15, O-16, i04/P-1), i05 (API-05, API-06, i05/P-1, (s)), i07 (API-07, O-33, O-35, (v)), i08 (Rules = §31), i09 (arhitektura, O-39 …
O-45, i09/P-n, PorukeGresaka, ProvjeraNaloga, pokreniLokalno.ps1), tabela zavisnosti i09 (5.10) — nove zavisnosti samo uz i10/P-n.

5. ODLUKE ZA OVU ITERACIJU
- O-46 (Orchestrator): Home dobija ulaze za Purchases, Rewards, Notifications, Settings u obliku iz dizajna (bottom navigacija ili kartice — Planner
  bira po prototipu); nema mrtvih dugmadi.
- O-47 (Orchestrator): Help/FAQ je kratak statički tekst u resursima (5–8 pitanja: bodovi, nagrade i voucher 15 min, QR, brisanje naloga, kontakt =
  „diplomski projekat”); Planner predlaže tekst, Ana odobrava pri odobrenju plana.
- O-48 (Orchestrator): Delete Account tok — potvrda (dijalog sa upozorenjem) → unos lozinke → reauthenticate (svjež auth_time) → DELETE /api/v1/account
  (bez tijela) → 204 → signOut → Login sa porukom „Nalog je obrisan.”; 409 REAUTHENTICATION_REQUIRED → ponovo traži lozinku; 401 poslije pokrenutog
  DELETE-a → tretira se kao završeno (ODLUKE (v)); 503 → poruka i mogućnost ponavljanja (nastavak brisanja, §23.4); za vrijeme brisanja ne poziva init.
- O-49 (Orchestrator): odbrojavanje voucher-a se računa iz expiresAt (server) i lokalnog sata samo za PRIKAZ; kad dođe do 0 → voucher se prikazuje kao
  istekao, poziva se API-06 i lista se osvježava iz Firestore-a (nikad lokalna promjena statusa).
- O-50 (Orchestrator): requestId za API-03 se pravi pri prvom tapu „Izdaj” i čuva se dok taj logički pokušaj ne dobije konačan odgovor (201/200/409/
  4xx); 503 ili mrežna greška → isti requestId pri ponovnom pokušaju; novi pokušaj (novi tap poslije konačnog odgovora) → novi requestId.
- Testovi (O-31 (c), (d)): JVM unit testovi za: requestId (UUID v4 malim slovima, isti pri retry-ju, novi poslije konačnog odgovora), eligibility,
  odbrojavanje (granice 0, istek), mapiranje §27 kodova Rewards / cancel / delete, paginacija (cursor), validacija imena i lozinke na Settings-u,
  tok brisanja (204 / 409 reauth / 401 poslije DELETE-a / 503), API klijent (MockWebServer: API-03 tijelo tačno { requestId }, API-05 i API-07 bez tijela,
  Bearer), ViewModel-i bez Android uređaja. Smoke (Ana, API 35): protokol docs/smoke/i10_smoke.md po primjeru iz tačke 1 + NFR-09 lista (login, Home,
  QR, purchases, reward, notifications, Settings/logout) + tamna tema (S10 iz i09) + Layout Inspector NFR-10 (S11 iz i09) + screenshot-i za Sliku 4 rada
  (Login, Home, Customer QR, Rewards sa aktivnim voucher-om) u docs/smoke/.
- O-30 (a): provjera.ps1 tačno 2×; u TEST_REPORT commit koda završnog run-a.
- Dokumentacija: TRACEABILITY (UI-05 … UI-08, AUTH-07, AUTH-08, §12 / §21 Android dio, NFR-09 dio, NFR-10, AC-01, AC-02), ODLUKE (O-46 … O-50, i10/P-n,
  §1 i09 ACCEPTED tag i09 merge 7dab954), IMPLEMENTATION_LOG, TEST_REPORT, README (Android ekrani).

6. DEFINITION OF DONE
[ ] UI-05 … UI-08 i tokovi Rewards / cancel / notifications / settings / logout / delete rade nad emulatorima (smoke API 35 PASS, upisan u TEST_REPORT).
[ ] JVM testovi prolaze; backend i Rules regresija prolazi (provjera.ps1 2×, exit 0); checkDebugAarMetadata zelen.
[ ] Android piše u Firestore samo displayName + updatedAt i readAt; nijedan drugi upis; nema logovanja token-a / UID-a / e-maila / voucherId-a u kodu.
[ ] firestore.indexes.json sadrži indekse za Android upite; firestore.rules, Backend i SRS nepromijenjeni.
[ ] Screenshot-i za Sliku 4 rada u docs/smoke/.
[ ] PR iteracija-10 → main bez merge-a; commit-i bez potpisa alata. Reviewer (O-31): ACCEPTED → merge → git diff <vrh PR-a> main prazno → tag i10.

7. KOMANDE (PowerShell, iz korijena)
cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug testDebugUnitTest checkDebugAarMetadata; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE
.\skripte\pokreniLokalno.ps1               # smoke; Ctrl+C gasi
git diff i09 -- backend firebase/firestore.rules docs/srs    # prazno

8. ISPORUKA: PR; kratak sažetak; testovi po ID-u; smoke rezultat (Ana); screenshot-i za Sliku 4 rada.
