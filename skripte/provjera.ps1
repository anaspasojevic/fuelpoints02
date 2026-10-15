# FuelPoints – provjera Definition of Done za Iteraciju 1.
# Pokretanje iz korijena repozitorijuma: .\skripte\provjera.ps1; $LASTEXITCODE
# Prekida se na prvu grešku i vraća exit code 1; kad sve prođe, vraća 0.

Set-StrictMode -Version Latest

$korijen = Split-Path -Parent $PSScriptRoot
$jbr = 'C:\Program Files\Android\Android Studio\jbr'
$ocekivaniHash = '7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228'
$portSmoke = '3999'

# Promjene env varijabli važe samo dok skripta radi; na kraju se vraćaju.
$naziviEnv = @('PATH', 'JAVA_HOME', 'PORT', 'FIREBASE_PROJECT_ID')
$sacuvanEnv = @{}
foreach ($naziv in $naziviEnv) {
    $sacuvanEnv[$naziv] = [Environment]::GetEnvironmentVariable($naziv, 'Process')
}

function Korak([string]$naziv, [scriptblock]$blok) {
    Write-Host "==> $naziv"
    $global:LASTEXITCODE = 0
    try {
        & $blok
    } catch {
        Write-Host $_.Exception.Message
        throw "NEUSPJEH: $naziv"
    }
    if ($global:LASTEXITCODE -ne 0) {
        throw "NEUSPJEH: $naziv (exit code $global:LASTEXITCODE)"
    }
}

# Pokreće nativnu komandu i baca grešku ako exit code nije 0.
function Nativno([string]$opis, [scriptblock]$komanda) {
    & $komanda
    if ($LASTEXITCODE -ne 0) {
        throw "$opis vratio exit code $LASTEXITCODE"
    }
}

function UDirektorijumu([string]$putanja, [scriptblock]$blok) {
    Push-Location (Join-Path $korijen $putanja)
    try {
        & $blok
    } finally {
        Pop-Location
    }
}

$uspjeh = $false
Push-Location $korijen
try {
    Korak 'Alati (Node 24, Java 21+, JDK za Gradle)' {
        $verzijaNode = (& node -v)
        if ($verzijaNode -notlike 'v24.*') { throw "Potreban je Node.js 24, a pronađen je $verzijaNode." }
        $javaIzlaz = (cmd /c "java -version 2>&1") -join "`n"
        if ($javaIzlaz -notmatch 'version "(\d+)') { throw 'Java nije pronađena na PATH-u.' }
        if ([int]$Matches[1] -lt 21) { throw "Firebase emulatori traže JDK 21+, a pronađena je Java $($Matches[1])." }
        if (-not $env:JAVA_HOME) {
            if (-not (Test-Path (Join-Path $jbr 'bin\java.exe'))) { throw "JAVA_HOME nije postavljen i ne postoji $jbr." }
            $env:JAVA_HOME = $jbr
        }
        # Pravi JDK ide prvi u PATH: kad je na PATH-u Oracle javapath posrednik, emulators:exec
        # gasi samo posrednika, a Java proces emulatora ostaje i drži port 8080.
        $env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
        $global:LASTEXITCODE = 0
    }

    Korak 'SRS integritet (SHA-256 normativnog .docx-a)' {
        $hash = (Get-FileHash 'docs\srs\FuelPoints_SRS_3_1.docx' -Algorithm SHA256).Hash
        if ($hash -ne $ocekivaniHash) { throw "SHA-256 SRS-a je $hash, očekivan $ocekivaniHash." }
    }

    Korak 'NFR-07 (bez tajni u repozitorijumu)' {
        $pogoci = @(git ls-files | Select-String -Pattern '(^|/)\.env$|service-?account|google-services\.json')
        if ($LASTEXITCODE -ne 0) { throw 'git ls-files nije uspio.' }
        if ($pogoci.Count -gt 0) { throw "Praćeni fajlovi sa tajnama: $($pogoci -join ', ')" }
        if (Select-String -Path '.env.example' -Pattern 'PRIVATE KEY|private_key' -Quiet) {
            throw '.env.example sadrži privatni ključ.'
        }
    }

    Korak 'Bez TODO/FIXME' {
        $izlaz = @(git grep -n -E 'TODO|FIXME' -- backend firebase pos-simulator skripte android-app/app/src README.md ':!skripte/provjera.ps1')
        $kod = $LASTEXITCODE
        if ($kod -eq 0) { throw "Pronađeni TODO/FIXME:`n$($izlaz -join "`n")" }
        if ($kod -ne 1) { throw "git grep je vratio exit code $kod." }
        $global:LASTEXITCODE = 0
    }

    Korak 'Portovi emulatora 8080 i 9099 su slobodni' {
        $zauzeti = @(Get-NetTCPConnection -State Listen -LocalPort 8080, 9099 -ErrorAction SilentlyContinue)
        if ($zauzeti.Count -gt 0) { throw 'Port 8080 ili 9099 je zauzet: zaustavi pokrenute emulatore.' }
    }

    Korak 'Backend: npm ci, npm test, npm run test:emu' {
        UDirektorijumu 'backend' {
            Nativno 'npm ci' { npm ci }
            Nativno 'npm test' { npm test }
            Nativno 'npm run test:emu' { npm run test:emu }
        }
    }

    Korak 'Backend: backend start smoke (node src/pokreni.js) (404 NOT_FOUND na /api/v1)' {
        $env:PORT = $portSmoke
        $env:FIREBASE_PROJECT_ID = 'demo-fuelpoints'
        $proces = Start-Process node -ArgumentList 'src/pokreni.js' -WorkingDirectory (Join-Path $korijen 'backend') -PassThru -NoNewWindow
        try {
            $odgovor = $null
            for ($i = 0; $i -lt 20 -and $null -eq $odgovor; $i++) {
                Start-Sleep -Milliseconds 500
                try {
                    Invoke-WebRequest "http://127.0.0.1:$portSmoke/api/v1/nepostojeca" -UseBasicParsing | Out-Null
                    throw 'Očekivan je status 404, a zahtjev je uspio.'
                } catch [System.Net.WebException] {
                    if ($null -ne $_.Exception.Response) {
                        $odgovor = @{ status = [int]$_.Exception.Response.StatusCode; tijelo = $_.ErrorDetails.Message }
                    }
                }
            }
            if ($null -eq $odgovor) { throw 'Server nije odgovorio u roku od 10 s.' }
            if ($odgovor.status -ne 404) { throw "Očekivan status 404, dobijen $($odgovor.status)." }
            $greska = ($odgovor.tijelo | ConvertFrom-Json).error
            if ($greska.code -ne 'NOT_FOUND') { throw "Očekivan kod NOT_FOUND, dobijen $($greska.code)." }
            Write-Host "Smoke: 404 $($greska.code), correlationId $($greska.correlationId)"
        } finally {
            Stop-Process -Id $proces.Id -Force -ErrorAction SilentlyContinue
        }
    }

    Korak 'Firestore rules: npm ci, npm test' {
        UDirektorijumu 'firebase\tests' {
            Nativno 'npm ci' { npm ci }
            Nativno 'npm test' { npm test }
        }
    }

    Korak 'Android: assembleDebug, testDebugUnitTest' {
        UDirektorijumu 'android-app' {
            Nativno 'gradlew assembleDebug' { .\gradlew.bat assembleDebug }
            Nativno 'gradlew testDebugUnitTest' { .\gradlew.bat testDebugUnitTest }
        }
    }

    $uspjeh = $true
} catch {
    Write-Host $_.Exception.Message
} finally {
    Pop-Location
    foreach ($naziv in $naziviEnv) {
        [Environment]::SetEnvironmentVariable($naziv, $sacuvanEnv[$naziv], 'Process')
    }
}

if ($uspjeh) {
    Write-Host 'SVE PROVJERE PROŠLE'
    exit 0
}
exit 1
