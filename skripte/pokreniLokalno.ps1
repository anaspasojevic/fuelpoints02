# FuelPoints – lokalno okruženje za smoke Android aplikacije (O-31 (d)):
# Firebase emulatori (Firestore + Auth) → seed rewardDefinitions → Backend sa lokalnim .env.
# Pokretanje iz korijena repozitorijuma: .\skripte\pokreniLokalno.ps1   (gasi se sa Ctrl+C)
# Vrijednosti iz .env se nikad ne ispisuju.

Set-StrictMode -Version Latest

$korijen = Split-Path -Parent $PSScriptRoot
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
$envFajl = Join-Path $korijen '.env'
$backend = Join-Path $korijen 'backend'
$rokEmulatoraS = 60
# Debug APK koristi ovaj port Backend-a (app/build.gradle.kts, BACKEND_BAZNI_URL).
$portAplikacije = '3000'

function PortJeZauzet([int]$port) {
    @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue).Count -gt 0
}

function UgasiSlusaoce([int[]]$portovi) {
    foreach ($veza in @(Get-NetTCPConnection -State Listen -LocalPort $portovi -ErrorAction SilentlyContinue)) {
        Stop-Process -Id $veza.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path $envFajl)) {
    Write-Host 'Kopirajte .env.example u .env i upišite POS ključ (README).'
    exit 1
}

# Iz .env se čita samo PORT (nije tajna); ostalo čitaju Backend i seed sami (--env-file-if-exists).
$port = $null
foreach ($red in Get-Content $envFajl) {
    if ($red -match '^\s*PORT\s*=\s*(\d+)\s*$') { $port = $Matches[1] }
}
if (-not $port) {
    Write-Host 'U .env nedostaje PORT (vidi .env.example).'
    exit 1
}
if ($port -ne $portAplikacije) {
    Write-Host "Upozorenje: debug aplikacija očekuje Backend na portu $portAplikacije, a .env ima PORT=$port."
}

foreach ($p in @(8080, 9099, [int]$port)) {
    if (PortJeZauzet $p) {
        Write-Host "Port $p je zauzet: zaustavite pokrenute emulatore ili Backend."
        exit 1
    }
}

$sacuvanPath = $env:PATH
$sacuvanJavaHome = $env:JAVA_HOME
# Pravi JDK prvi na PATH-u (kao provjera.ps1): inače Java proces emulatora ostaje i drži port 8080.
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = $jbr }
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH

$emulatori = $null
try {
    Write-Host '==> Firebase emulatori (Firestore 8080, Auth 9099)'
    $emulatori = Start-Process cmd.exe -WorkingDirectory $backend -PassThru -NoNewWindow -ArgumentList @(
        '/c', 'npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth'
    )
    $kraj = (Get-Date).AddSeconds($rokEmulatoraS)
    while (-not ((PortJeZauzet 8080) -and (PortJeZauzet 9099))) {
        if ((Get-Date) -gt $kraj) { throw "Emulatori nisu startovali u roku od $rokEmulatoraS s." }
        if ($emulatori.HasExited) { throw 'Emulatori su se ugasili pri startu.' }
        Start-Sleep -Milliseconds 500
    }

    Write-Host '==> Seed rewardDefinitions (npm run seed:emu)'
    Push-Location $backend
    try {
        npm run seed:emu
        if ($LASTEXITCODE -ne 0) { throw "seed:emu vratio exit code $LASTEXITCODE" }
    } finally {
        Pop-Location
    }

    Write-Host ''
    Write-Host 'Adrese sa Android emulatora (10.0.2.2 = ovaj računar):'
    Write-Host "  Backend:   http://10.0.2.2:$port/api/v1  (lokalno http://127.0.0.1:$port/api/v1)"
    Write-Host '  Auth:      10.0.2.2:9099'
    Write-Host '  Firestore: 10.0.2.2:8080'
    Write-Host 'Gašenje: Ctrl+C'
    Write-Host ''

    Write-Host '==> Backend (npm start)'
    Push-Location $backend
    try {
        npm start
    } finally {
        Pop-Location
    }
} catch {
    Write-Host $_.Exception.Message
    exit 1
} finally {
    Write-Host '==> Gašenje Backend-a i emulatora'
    if ($null -ne $emulatori -and -not $emulatori.HasExited) {
        & taskkill.exe /T /F /PID $emulatori.Id 2>&1 | Out-Null
    }
    UgasiSlusaoce @(8080, 9099, [int]$port)
    $env:PATH = $sacuvanPath
    $env:JAVA_HOME = $sacuvanJavaHome
}
