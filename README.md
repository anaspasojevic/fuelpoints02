# FuelPoints

Android aplikacija za sistem lojalnosti na benzinskim pumpama: diplomski rad, PMF Banja Luka.
Jedini normativni dokument je FuelPoints SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`).

## Struktura

| Folder / fajl | Sadržaj |
|---|---|
| `android-app/` | Android App (Kotlin, Jetpack Compose, minSdk 26, compileSdk/targetSdk 35) |
| `backend/` | Loyalty Backend (Node.js 24 LTS, Express, Firebase Admin SDK), testovi u `backend/test/` |
| `pos-simulator/` | POS Simulator (kostur; forme dolaze u Iteraciji 11) |
| `firebase/` | `firestore.rules`, `firestore.indexes.json` i rules testovi u `firebase/tests/` |
| `firebase.json`, `.firebaserc` | Firebase Emulator Suite: Firestore `127.0.0.1:8080`, Auth `127.0.0.1:9099`, projekat `demo-fuelpoints` |
| `skripte/provjera.ps1` | sve provjere redom (Definition of Done) |
| `docs/` | SRS, sljedivost, dnevnik implementacije, izvještaj o testovima, iteracije, dizajn |

## Preduslovi

- Windows 11 i PowerShell.
- Node.js 24 LTS (`node -v` → `v24.x`).
- JDK 21 ili noviji za Firebase emulatore.
- Android Studio sa Android SDK 35. Gradle se pokreće sa JDK-om iz Android Studio-a (JBR):
  `$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'`.
- Ako je `java` na PATH-u Oracle `javapath` posrednik (`where.exe java`), prije emulator komandi
  staviti pravi JDK na početak PATH-a, inače Java proces emulatora ostaje aktivan poslije testova:
  `$env:PATH = "$env:JAVA_HOME\bin;" + $env:PATH`.
- Internet pri prvom pokretanju emulatora (preuzima se JAR Firestore emulatora).

## Konfiguracija

Konfiguracija se čita samo iz environment varijabli. Za ručno pokretanje:

```powershell
Copy-Item .env.example .env
```

`.env` se nikad ne commit-uje. `.env.example` sadrži samo ne-tajne vrijednosti.

## Pokretanje

```powershell
# Emulatori (Firestore + Auth), u posebnom prozoru
cd backend; npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth

# Backend (sluša na http://127.0.0.1:<PORT>/api/v1)
cd backend; npm start

# Punjenje rewardDefinitions (samo nad emulatorom; emulator mora biti pokrenut)
cd backend; npm run seed:emu
```

## Testovi

```powershell
cd backend; npm ci; npm test; npm run test:emu; cd ..
cd firebase\tests; npm ci; npm test; cd ..\..
cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug; .\gradlew.bat testDebugUnitTest; cd ..
```

- `npm test` (backend): unit testovi bez emulatora.
- `npm run test:emu` (backend) i `npm test` (`firebase\tests`): testovi kroz `firebase emulators:exec`
  nad projektom `demo-fuelpoints`; nikad nad production projektom. Ne pokretati ih dok su emulatori
  već pokrenuti (portovi 8080 i 9099).

## Provjera

```powershell
.\skripte\provjera.ps1; $LASTEXITCODE
```

Skripta redom provjerava alate, SHA-256 SRS-a, odsustvo tajni i nedovršenih oznaka, slobodne portove,
backend testove, `npm start`, rules testove i Android build. Na prvu grešku vraća exit code 1,
a kad sve prođe, ispisuje `SVE PROVJERE PROŠLE` i vraća 0.
