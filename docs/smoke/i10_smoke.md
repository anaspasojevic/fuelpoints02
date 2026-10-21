# i10 — Smoke protokol (O-31 (d)): Android aplikacija na emulatoru API 35

Izvršava: Ana, ručno. Rezultat (PASS/FAIL po koraku, napomene) upisuje Builder u `docs/TEST_REPORT.md`.
Screenshot-i (S20 i S7) idu u `docs/smoke/`: `i10_login.png`, `i10_home.png`, `i10_qr.png`, `i10_nagrade_voucher.png`.

## Priprema

Kao u `docs/smoke/i09_smoke.md` (`.env` sa `POS_API_KLJUCEVI`, slobodni portovi 8080 / 9099 / 3000, emulator API 35,
`.\skripte\pokreniLokalno.ps1`, debug APK). Za Rewards upite nije potreban composite indeks (emulator ih ne provjerava).

## POS kupovine

PowerShell blok iz i09 (sekcija „POS kupovina”) uz promjenu `volumeMl` i jedinstven `posTransactionId` po pozivu.
UID se prepisuje sa ekrana Moj QR (tekst „Vaš identifikator”).

- S2: dvije kupovine, `volumeMl = 42730` i `volumeMl = 30000`.
- S4: još 20 kupovina po `volumeMl = 1000`, npr. `1..20 | ForEach-Object { <isti poziv sa "SMOKE-S4-$_"> }`.

## Koraci

| # | Korak | Očekivano |
|---|---|---|
| S1 | Registracija „Ana” / `ana@primjer.ba` / „Lozinka1” | Home „Zdravo, Ana”, 0 bodova, donja navigacija sa 5 stavki (Početna, Istorija, QR, Nagrade, Profil), zvono u zaglavlju |
| S2 | POS kupovine 42 730 ml i 30 000 ml | Home: 72 boda |
| S3 | Istorija | 2 stavke, novija prva, „30,00 l”, iznos + EUR, „+30” / „+42”; nema „Učitaj starije kupovine” |
| S4 | 20 dodatnih kupovina, Istorija | 20 stavki + „Učitaj starije kupovine”; poslije dodira 22 ukupno, dugme nestaje |
| S5 | Nagrade | bodovi u zaglavlju; CAR_WASH (50) i SHOWER (30) „dostupno” (sa 92 boda poslije S4) |
| S6 | Izdaj CAR_WASH → dijalog → Izdaj | „Voucher je izdat. Pokažite QR kod na kasi.”; aktivni voucher sa QR-om i „Važi još 15:00 → 14:59 …”; Home: dostupno −50, „Rezervisano 50” |
| S7 | Screenshot Nagrade sa voucher-om | `docs/smoke/i10_nagrade_voucher.png` |
| S8 | Otkaži → dijalog → Otkaži voucher | „Voucher je otkazan. Bodovi su vraćeni.”; voucher nestaje; Home bez „Rezervisano”, bodovi vraćeni |
| S9 | (opciono, 15 min) izdati SHOWER, sačekati 00:00 | „Voucher je istekao”, poslije API-06 nestaje, bodovi vraćeni |
| S10 | Obavještenja (zvono) | broj = broj kupovina, novija prva, nepročitane sa žutom trakom; tap na stavku → traka nestaje; zatvoriti i ponovo otvoriti ekran → ostaje pročitana |
| S11 | Profil: ime, e-mail „ne može se mijenjati”; Ime za prikaz → „Ana S.” | Home „Zdravo, Ana S.”; 101 znak → poruka greške |
| S12 | Promjena lozinke: pogrešna trenutna → poruka; „Lozinka2” → „Lozinka je promijenjena.”; link za reset | neutralna poruka za reset |
| S13 | Pomoć i česta pitanja, Uslovi korišćenja | otvaraju se i vraćaju nazad |
| S14 | Odjavi se | Login; „nazad” ne vraća u aplikaciju; prijava sa „Lozinka2” → Home (AC-01) |
| S15 | Obriši nalog: Odustani → ništa; pogrešna lozinka → poruka; tačna → Login „Nalog je obrisan.”; prijava istim podacima | poruka §3.5 (neispravni podaci) |
| S16 | Tamni režim sistema | ekrani Istorija, Nagrade, Obavještenja, Profil u tamnoj temi |
| S17 | Layout Inspector (NFR-10) | stavke navigacije, zvono, QR dugme, Otkaži, redovi sa chevronom, „Učitaj starije”, oko lozinke ≥ 48 dp; ikone bez teksta imaju `contentDescription` |
| S18 | NFR-09 lista na API 35: login, Home, QR, purchases, reward, notifications, Settings/logout | zbirno PASS/FAIL |
| S19 | Logcat filtriran po paketu aplikacije | nema tokena (`Bearer`), `voucherId`-a (64 hex), UID-a ni e-maila iz koda aplikacije (nalaz SDK-a iz i09/K-3 se bilježi, ne ruši smoke) |
| S20 | Screenshot-i Login, Home (72 boda), Moj QR | `docs/smoke/i10_login.png`, `i10_home.png`, `i10_qr.png` |
