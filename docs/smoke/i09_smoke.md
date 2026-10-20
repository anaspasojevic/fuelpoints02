# i09 — Smoke protokol (O-31 (d)): Android aplikacija na emulatoru API 35

Izvršava: Ana, ručno. Rezultat (PASS/FAIL po koraku, napomene) upisuje Builder u `docs/TEST_REPORT.md`.
Screenshot-i Login, Home i QR idu u `docs/smoke/` (S12).

## Priprema

1. `.env` u korijenu repozitorijuma (jednom): `Copy-Item .env.example .env`, pa u `.env` zamijeniti placeholder `POS_API_KLJUCEVI`
   ključem generisanim komandom iz README-a (sekcija „POS ključevi”), npr. `POS_API_KLJUCEVI=SIM01:<ključ>`. `PORT` ostaje `3000`.
2. Portovi 8080, 9099 i 3000 slobodni (ugašeni ranije pokrenuti emulatori i Backend).
3. Lokalno okruženje (poseban PowerShell prozor, iz korijena):

   ```powershell
   .\skripte\pokreniLokalno.ps1
   ```

   Skripta pokreće Firebase emulatore (Firestore 8080, Auth 9099), puni `rewardDefinitions` i pokreće Backend na portu iz `.env`.
   Spremno je kad se ispiše `FuelPoints backend sluša na http://127.0.0.1:3000/api/v1`. Gašenje: Ctrl+C (gasi Backend i emulatore).
4. Android emulator API 35 (AVD `FuelPoints_API35`) pokrenut iz Android Studio-a (Device Manager).
5. Debug APK:
   - Android Studio: otvoriti `android-app`, konfiguracija `app`, uređaj API 35, **Run**; ili
   - PowerShell:

     ```powershell
     cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug; cd ..
     & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r android-app\app\build\outputs\apk\debug\app-debug.apk
     ```

## POS kupovina (za S4)

UID se prepisuje sa QR ekrana (tekst „Vaš identifikator”). Ključ se čita iz `.env` u promjenljivu i ne ispisuje se.

```powershell
$uid = '<UID sa QR ekrana>'
$kljuc = ((Get-Content .env | Where-Object { $_ -like 'POS_API_KLJUCEVI=*' }) -replace '^POS_API_KLJUCEVI=SIM01:', '')
$tijelo = @{ loyaltyUid = $uid; posTransactionId = "SMOKE-$(Get-Random)"; volumeMl = 42730; amountMinor = 6000; currency = 'EUR';
  occurredAt = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ') } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/api/v1/pos/purchases -Headers @{ 'X-POS-API-Key' = $kljuc } `
  -ContentType 'application/json' -Body $tijelo
```

Očekivano: odgovor sa `"earnedPoints": 42`.

## Nalog samo u Auth emulatoru (za S9)

```powershell
Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key' `
  -ContentType 'application/json' -Body '{"email":"marko@primjer.ba","password":"Lozinka1","displayName":"Marko","returnSecureToken":true}' | Out-Null
```

## Koraci

| # | Korak | Očekivano | PASS/FAIL |
|---|---|---|---|
| S1 | Prvo pokretanje aplikacije. | Ekran Prijava: polja e-mail i lozinka, „Prijavi se”, „Zaboravljena lozinka”, „Napravi nalog” (UI-01). | |
| S2 | „Napravi nalog”: „Ana” / ana@primjer.ba / „Lozinka” (bez cifre) u oba polja lozinke, prihvatiti uslove, „Napravi nalog”. Zatim lozinka „Lozinka1” u oba polja, „Napravi nalog”. | Prvo: poruka „Lozinka mora imati najmanje 8 znakova, bar jedno veliko slovo (A–Z) i bar jednu cifru.”, traka „cifra” ugašena, nalog se ne pravi. Zatim: Home „Zdravo, Ana”, 0 bodova, bez „Rezervisano”. Forma nema polja za telefon ni datum rođenja. | |
| S3 | Home → „Moj QR kod”. | QR kod i isti UID kao tekst ispod „Vaš identifikator”; bez dugmeta za kopiranje. „Nazad” vraća na Home. | |
| S4 | Dok je Home otvoren, POS kupovina 42 730 ml (blok iznad, UID iz S3). | Home pokazuje 42 bez ručnog osvježavanja (u roku od nekoliko sekundi). | |
| S5 | Zatvoriti aplikaciju (prevući iz Recents), ponovo pokrenuti. | Home „Zdravo, Ana”, 42, bez prijave (AUTH-06). | |
| S6 | Uključiti Airplane mode (emulator: Quick Settings). Sačekati do ~10 s. Isključiti Airplane mode. | Traka „Nema mreže. Prikazano posljednje poznato stanje.” se pojavi, bodovi (42) ostaju. Poslije vraćanja mreže traka nestaje. | |
| S7 | Settings → Apps → FuelPoints → Storage → Clear storage; pokrenuti aplikaciju. Prijava sa ana@primjer.ba / pogrešnom lozinkom; zatim nepostojeci@primjer.ba / Lozinka1; zatim ana@primjer.ba / Lozinka1. | Prva dva pokušaja: tačno ista poruka „E-mail adresa ili lozinka nisu ispravni.”. Treći: Home „Zdravo, Ana”, 42. | |
| S8 | Clear storage; na ekranu Prijava upisati ana@primjer.ba → „Zaboravljena lozinka”; zatim nepostojeci@primjer.ba → „Zaboravljena lozinka”. | Oba puta ista poruka „Ako postoji nalog sa ovom e-mail adresom, poslali smo uputstvo za promjenu lozinke.” | |
| S9 | Napraviti nalog samo u Auth emulatoru (blok iznad, „Marko”); u aplikaciji (Clear storage) prijava marko@primjer.ba / Lozinka1. | Home „Zdravo, Marko”, 0 bodova (init urađen pri prijavi, AUTH-03). | |
| S10 | Uključiti tamni režim sistema (Quick Settings → Dark theme), otvoriti Home i QR. | Tamna tema (tamna pozadina, svijetao tekst, LCD panel kao u `9_pocetna_tamna_offline.png`). | |
| S11 | Android Studio → Layout Inspector na Prijava, Registracija, Home i QR. | Dugmad, linkovi, ikona oka, „Nazad” i kvadratić uslova ≥ 48×48 dp; ikone bez teksta imaju contentDescription („Prikaži lozinku”, „Nazad”, „QR kod sa vašim identifikatorom”) (NFR-10, I09-T13). | |
| S12 | Screenshot-i (svijetla tema): Prijava, Home (sa 42), Moj QR. | Sačuvani kao `docs/smoke/i09_prijava.png`, `docs/smoke/i09_pocetna.png`, `docs/smoke/i09_qr.png`. | |
| S13 | Android Studio → Logcat, filter `package:io.github.anaspasojevic.fuelpoints`, poslije S2–S9. Pretraga: UID iz S3, `ana@primjer.ba`, `Bearer`, `eyJ`. | Nema pogodaka (NFR-07). | |

Kraj: Ctrl+C u prozoru `pokreniLokalno.ps1`; portovi 8080, 9099 i 3000 slobodni.
