# Uputstvo: pravi Firebase projekat (Spark) i ručna provjera nad njim

Iteracija 11, korak K5, K6 i K7 (odluke O-2, i11/P-3, P-5, P-7). Sve komande su za PowerShell, iz korijena repozitorijuma
(`C:\Users\Elitebook\fuelpoints02`), osim ako piše drugačije. Ovo radi Ana ručno; testovi i `provjera.ps1` ostaju nad emulatorom.

## Šta se NIKAD ne commit-uje

| Fajl / vrijednost | Gdje živi |
|---|---|
| Service account ključ (`*.json`) | van repozitorijuma, npr. `C:\Users\Elitebook\fuelpoints-secrets\sa.json` |
| `android-app\firebase.local.properties` (Web API key, App ID, projectId, URL) | lokalno, `.gitignore` ga pokriva |
| `google-services.json` | ne preuzimati u repo (O-39); ako se preuzme radi čitanja vrijednosti, ostaje van repozitorijuma |
| POS API ključ stanice | samo u tekućoj PowerShell sesiji / `$env:`, nikad u fajlu u repou |
| `.env`, `.env.real*` | lokalno, `.gitignore` ih pokriva |
| slike konzole i smoke zapisi | prije commit-a prekriti API ključeve, e-mailove i UID-ove |

Provjera da ništa od ovoga nije praćeno: `cd backend; node --test test/jedinicni/tajneURepou.test.js` (I11-T08).

## 1. Projekat

1. https://console.firebase.google.com → **Add project**. Naziv/ID po izboru (npr. `fuelpoints-diplomski`; ID **ne** smije
   počinjati sa `demo-`). Google Analytics **isključiti**. Plan ostaje **Spark** (bez kartice).
2. Zapisati **Project ID** (Project settings → General).

## 2. Android aplikacija i lokalna konfiguracija

1. Project settings → General → **Add app** → Android. Package name: `io.github.anaspasojevic.fuelpoints`. Preskočiti
   preuzimanje `google-services.json` (nije potrebno).
2. Iz Project settings → Your apps pročitati **App ID** (`1:…:android:…`) i **Web API Key** (General → Web API Key).
3. Napraviti lokalni fajl (ne commit-uje se) od primjera:

```powershell
Copy-Item android-app\firebase.local.properties.example android-app\firebase.local.properties
notepad android-app\firebase.local.properties
```

Upisati `firebase.projectId`, `firebase.applicationId`, `firebase.apiKey`. `backend.baseUrl` ostaviti prazan (za pravi
`release` mora počinjati sa `https://`; hosting Backend-a nije dio rada, §33.3). Build `releaseProba` koristi
`http://10.0.2.2:3000/api/v1/`.

## 3. Authentication

1. Build → **Authentication** → Get started → Sign-in method → **Email/Password** = uključeno (Email link isključen). Bez verifikacije e-maila (§3.5).
2. **Email Enumeration Protection** (Authentication → Settings → User actions): postaviti na **Enabled**.
3. **Password policy** (Authentication → Settings → Password policy): *Enforcement mode* = **Require** (ne *Notify*),
   minimalna dužina **8**, *Require uppercase* = da, *Require numeric* = da, *lowercase* = ne, *non-alphanumeric* = ne.
4. **Odluka P-7: ne nadograđivati plan.** Ako konzola za Spark ne nudi opciju 2 ili 3 bez prelaska na Identity Platform / Blaze,
   **ne nadograđivati**: snimiti ekran konzole i javiti šta piše; stanje se upisuje kao poznato ograničenje (§3.5 / §3.6 tada nisu
   ispunjeni na server strani, zaštita je samo klijentska validacija). Builder to ne prikazuje kao ispunjen zahtjev.
5. Slike konzole (bez API ključeva i e-mailova u kadru): `docs\smoke\i11_konzola_eep.png`, `docs\smoke\i11_konzola_lozinka.png`.

## 4. Firestore (production mode), pravila i indeksi

1. Build → **Firestore Database** → Create database → **Native mode**, lokacija bliska (npr. `eur3`), **production mode**.
2. Prijava i deploy (firebase-tools je u `backend\node_modules`; `.firebaserc` se ne mijenja, projekat ide kroz `--project`):

```powershell
$fb = 'backend\node_modules\firebase-tools\lib\bin\firebase.js'
node $fb login
node $fb deploy --only "firestore:rules,firestore:indexes" --project <PROJECT_ID>
node $fb firestore:indexes --project <PROJECT_ID>
```

3. Pravila su identična `firebase\firestore.rules` (§31, I08-T01). Sačekati da u konzoli (Firestore → Indexes) sva **tri**
   composite indeksa (`purchases`, `notifications`, `vouchers`) budu **Enabled** (5–30 min). Slika: `docs\smoke\i11_konzola_indeksi.png`.
4. **P-5, ručni seed** (Firestore → Start collection `rewardDefinitions`, dva dokumenta, polja iz §12):

| Document ID | `displayName` (string) | `costPoints` (number) | `active` (boolean) |
|---|---|---|---|
| `CAR_WASH` | `Besplatno pranje` | `50` | `true` |
| `SHOWER` | `Besplatan tuš` | `30` | `true` |

   `costPoints` mora biti **number** (cijeli broj), ne string.

## 5. REST dokazi za §3.5 i §3.6 (nad pravim projektom)

Web API key se čita iz lokalnog fajla i ne ispisuje se. Ovo kreira i briše jedan probni nalog.

```powershell
$kljuc = ((Get-Content android-app\firebase.local.properties | Where-Object { $_ -like 'firebase.apiKey=*' }) -replace '^firebase\.apiKey=', '').Trim()
$baza = 'https://identitytoolkit.googleapis.com/v1'
function Pozovi($putanja, $tijelo) {
    try {
        $o = Invoke-RestMethod -Method Post -Uri "$baza/$putanja`?key=$kljuc" -ContentType 'application/json' -Body ($tijelo | ConvertTo-Json)
        return @{ ok = $true; odgovor = $o }
    } catch {
        $poruka = ($_.ErrorDetails.Message | ConvertFrom-Json).error.message
        return @{ ok = $false; poruka = $poruka }
    }
}

# 5a (§3.6): slabe lozinke moraju biti odbijene NA SERVERU; Lozinka1 prolazi.
foreach ($lozinka in 'abcdefg1', 'Abcdefgh', 'Ab1') {
    $r = Pozovi 'accounts:signUp' @{ email = 'probni.politika@example.com'; password = $lozinka; returnSecureToken = $true }
    "$lozinka -> $($r.poruka)"
}
$r = Pozovi 'accounts:signUp' @{ email = 'probni.politika@example.com'; password = 'Lozinka1'; returnSecureToken = $true }
"Lozinka1 -> ok=$($r.ok)"
if ($r.ok) { $null = Pozovi 'accounts:delete' @{ idToken = $r.odgovor.idToken } }   # briše probni nalog

# 5b (§3.5): nepostojeći e-mail i pogrešna lozinka daju ISTI odgovor.
$a = Pozovi 'accounts:signInWithPassword' @{ email = 'ne.postoji.123@example.com'; password = 'Lozinka1'; returnSecureToken = $true }
"nepostojeci e-mail -> $($a.poruka)"
# Za pogrešnu lozinku koristite e-mail naloga koji postoji u projektu (npr. vaš test nalog iz aplikacije).
$b = Pozovi 'accounts:signInWithPassword' @{ email = '<POSTOJECI_TEST_EMAIL>'; password = 'PogresnaLozinka9'; returnSecureToken = $true }
"postojeci e-mail, pogresna lozinka -> $($b.poruka)"
```

Očekivano: tri slabe lozinke → `PASSWORD_DOES_NOT_MEET_REQUIREMENTS`, `Lozinka1` → `ok=True`, a oba `signInWithPassword` odgovora
→ **isti** `INVALID_LOGIN_CREDENTIALS`. Upisati tačan ispis (bez e-mailova) u `docs\smoke\i11_smoke.md`. Ako je odgovor drugačiji
(npr. slaba lozinka prođe), to je nalaz i stanje iz tačke 3.4 (P-7).

## 6. Service account i Backend nad pravim projektom

1. Project settings → **Service accounts** → *Generate new private key* → snimiti **van repozitorijuma**
   (npr. `C:\Users\Elitebook\fuelpoints-secrets\sa.json`). Fajl nikad ne ide u repo, log ni chat.
2. Generisati **novi** POS ključ stanice (komanda iz README, odjeljak „POS ključevi”); ne koristiti ključ iz `.env`.
3. U **novoj** PowerShell sesiji (Backend se pokreće direktno, bez `npm start`, da se `.env` sa emulator varijablama ne učita):

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\Users\Elitebook\fuelpoints-secrets\sa.json'
$env:FIREBASE_PROJECT_ID = '<PROJECT_ID>'
$env:PORT = '3000'
$env:VERZIJA_USLOVA = '1.0'
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
$env:POS_KLJUC = [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')
$env:POS_API_KLJUCEVI = "REAL01:$env:POS_KLJUC"
Remove-Item Env:FIRESTORE_EMULATOR_HOST, Env:FIREBASE_AUTH_EMULATOR_HOST -ErrorAction SilentlyContinue
cd backend
node src/pokreni.js
```

   (Ključ za POS Simulator je `$env:POS_KLJUC`; ne ispisivati ga, nego ga zalijepiti u polje simulatora.)
4. U drugom prozoru: `Invoke-WebRequest http://127.0.0.1:3000/api/v1/account/init -Method Post -ContentType application/json -Body '{}'`
   mora dati **401** `UNAUTHENTICATED` (Backend radi nad pravim projektom).

Poznato ponašanje produkcije (i02/R-03, ODLUKE §7): kad Backend ne može preuzeti javne ključeve za provjeru ID token-a, odgovor je 401
umjesto 503. To nije dostižno bez ometanja mreže i ne mijenja se.

## 7. Ručni end-to-end (K7): `releaseProba` + Backend + POS Simulator

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
cd android-app
.\gradlew.bat installReleaseProba        # emulator API 35 mora biti pokrenut
cd ..
node pos-simulator/server.js              # u trećem prozoru; stranica http://127.0.0.1:3001
```

Scenarij i polja za zapis su u `docs\smoke\i11_smoke.md`, odjeljak „K7”.
Poslije testa **obrisati probne naloge** (Authentication → Users) i probne dokumente po želji.
