# FuelPoints – pravila projekta (fuelpoints02)

Diplomski rad: Android aplikacija za sistem lojalnosti na benzinskim pumpama.
Autor: Ana Spasojević, PMF Banja Luka.

## Izvor istine
- Jedini normativni dokument je FuelPoints SRS 3.1: `docs/srs/FuelPoints_SRS_3_1.docx`.
  Čitljiva kopija za rad: `docs/srs/FuelPoints_SRS_3_1.md` (ćirilica). Oba fajla se NIKAD ne mijenjaju.
- Kad god nešto nije jasno, pročitaj odgovarajuću sekciju SRS-a i navedi je (npr. "§13.2").
- SRS ima prednost nad postojećim kodom, ranijim pretpostavkama i tvojim arhitektonskim preferencijama.
- Ne dodaji ništa što SRS ne traži (§1.3). FCM se ne radi.
- Ako je SRS nejasan ili kontradiktoran: STANI, označi to eksplicitno i pitaj. Ne izmišljaj i ne "pomiruj" sam.

## Tok rada (agentne petlje mentora)
- Rad ide u 11 iteracija. Svaka iteracija ima Iteration Brief od Orchestrator-a u
  `docs/iteracije/iNN_brief.md`. Radi SAMO ono što je u brief-u i odobrenom planu tekuće iteracije.
- Svaka iteracija prolazi kroz: LOOP 1 PLANNER (bez koda) → LOOP 2 BUILDER → LOOP 3 ADVERSARIAL REVIEWER → FIX LOOP.
  Uloga u sesiji je navedena u prvoj poruci. Drži se svoje uloge:
  - PLANNER ne piše kod; plan upisuje u `docs/iteracije/iNN_plan.md`.
  - BUILDER implementira samo odobreni plan.
  - REVIEWER ne mijenja kod; izvještaj upisuje u `docs/iteracije/iNN_review.md`.
- Grana po iteraciji: `iteracija-NN`. U `main` se spaja i anotirani tag `iNN` postavlja TEK
  poslije ITERATION ACCEPTED i kad svi testovi prolaze. Nijedna iteracija ne počinje bez zelenog checkpointa.
- Svaki checkpoint sadrži ažurirane `docs/TRACEABILITY.md`, `docs/IMPLEMENTATION_LOG.md`, `docs/TEST_REPORT.md`.
  TEST_REPORT sadrži samo stvarno izvršene komande i njihov stvarni rezultat.
- Repozitorijum je state, razgovor nije state.

## Git i GitHub
- Poslije SVAKOG commit-a uradi `git push` (i `git push --tags` kad dodaš tag).
- Commit poruke, opisi PR-a i fajlovi NE sadrže nikakav potpis alata: bez "Co-Authored-By",
  bez "Generated with Claude Code", bez pominjanja AI alata. Autor commit-a je samo vlasnik repozitorijuma.
- Commit poruke na srpskom, kratko i jasno (npr. "i01: katalog grešaka po §27").

## Nepregovorljiva pravila (SRS)
- Android je untrusted client i NIKAD ne mijenja direktno kritično loyalty stanje (bodovi, purchases,
  loyaltyLedger, vouchers, rewardRequests, redemptionRequests). Backend je trusted authority.
- Svaka promjena loyalty stanja ide u JEDNOJ Firestore transakciji, zajedno sa ledger eventom.
- UID se uzima iz verifikovanog Firebase ID tokena, nikad iz tijela zahtjeva.
- stationId se uzima iz mape POS API ključ → stanica, nikad iz tijela zahtjeva.
- Vrijeme je uvijek serversko.
- Idempotentnost je eksplicitna, ne implicitna.
- Tajne (POS ključevi, service account, google-services.json, .env) nikad u kodu, repou ni logovima.
  Nikad ne loguj Authorization ni X-POS-API-Key zaglavlje.
- Greške po §27, bez stack trace-a prema klijentu. Tehnička dopuna van §27 (odluka O-1):
  NOT_FOUND 404 i INVALID_REQUEST 422 – drugi kodovi se ne uvode.
- Za svako business-critical ponašanje postoji automatski test (API-Txx iz §29, RULE-Txx iz §30,
  dopunski testovi I<iteracija>-T<broj>).
- Nema TODO/FIXME za funkcionalnost tekuće iteracije.
- Testovi rade isključivo nad Firebase Emulator Suite (projekat demo-fuelpoints), nikad nad produkcijom.

## Imenovanje
- Sve što SRS imenuje ostaje tačno kako piše u SRS-u, na engleskom: kolekcije, polja, endpointi,
  kodovi grešaka, ledger eventi, statusi, ID-evi testova.
- Sve ostalo na srpskom, latinicom, ijekavicom: folderi unutar src, fajlovi, klase, funkcije,
  promjenljive, komentari, poruke grešaka (npr. `izracunajBodove(volumeMl)`, `ServisNagrada`).
- Rezervisane riječi jezika i konvencionalni fajlovi alata (package.json, firebase.json,
  build.gradle.kts, AndroidManifest.xml...) ostaju kako jesu.

## Okruženje
- Windows 11, PowerShell. Komande koje predlažeš moraju raditi u PowerShell-u.
- Node.js 24 LTS, Android Studio (JDK iz Android Studio-a za Gradle), Firebase Emulator Suite.

## Dizajn Android aplikacije (koristi se tek u Iteracijama 9 i 10)
- Referenca: `docs/dizajn/*.png` i `docs/dizajn/prototip.html`. Aplikacija izgleda kao displej benzinske pumpe.

## Izvještaj na kraju svake sesije
Kratko, na srpskom: šta je urađeno, koji fajlovi, koji SRS zahtjevi, rezultat testova, šta je ostalo otvoreno.
