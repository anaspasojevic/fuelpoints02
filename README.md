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
| `skripte/pokreniLokalno.ps1` | lokalno okruženje za Android aplikaciju: emulatori, seed i Backend |
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

`.env` se nikad ne commit-uje. `.env.example` sadrži samo ne-tajne vrijednosti i placeholder POS ključa
sa kojim Backend namjerno NE startuje: u `.env` ga zamijeniti ključem generisanim komandom ispod.

| Varijabla | Obavezna | Značenje |
|---|---|---|
| `PORT` | da | port na kojem Backend sluša (`127.0.0.1`) |
| `FIREBASE_PROJECT_ID` | da | Firebase projekat; za emulator `demo-fuelpoints` |
| `VERZIJA_USLOVA` | da | aktuelna verzija uslova korišćenja (AUTH-10, odluka O-11); `/account/init` prihvata samo nju (`1.0`) |
| `POS_API_KLJUCEVI` | da | mapa POS ključ → stationId (§3.4, NFR-02): `stationId:ključ[,stationId:ključ…]`, bez razmaka |
| `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST` | ne | emulator režim (`127.0.0.1:8080`, `127.0.0.1:9099`) |

Backend odbija start ako je postavljena bilo koja emulator varijabla, a `FIREBASE_PROJECT_ID` ne počinje sa `demo-`
(u emulator režimu Admin SDK prihvata nepotpisane token-e; NFR-01). Poslije izmjene `.env.example` ponovo ga kopirati u `.env`.

### POS ključevi

Svaka stanica ima poseban slučajan ključ: base64url od 32 slučajna bajta (tačno 43 znaka, kanonski oblik).
`stationId` odgovara `^[A-Za-z0-9.-]{1,32}$` (bez `_`, odluka O-13), npr. `POS_API_KLJUCEVI=SIM01:<ključ1>,SIM02:<ključ2>`.
Ključ se generiše u PowerShell-u (svaki poziv daje novi ključ):

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
[Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')
```

Backend odbija start ako `POS_API_KLJUCEVI` nedostaje ili je prazna, ako stavka nema oblik `stationId:ključ`, ako ključ nije
base64url od 32 bajta ili ima manje od 16 različitih znakova, ako se ključ ili `stationId` ponavlja, ili ako `stationId`
nije ispravan. Poruka greške imenuje varijablu i stavku, nikad vrijednost. Ključ se ne loguje i ne vraća u odgovoru;
konfiguracija u memoriji čuva samo SHA-256 otiske ključeva.

## API

Base path `/api/v1` (§26). Greške imaju tijelo `{ "error": { "code", "message", "correlationId" } }` (§27).
Serverski log greške je JSON linija sa vremenom, `correlationId`, kodom, statusom, metodom i šablonom pogođene rute
(npr. `/pos/purchases`, ili `(nepoznata ruta)`), a za 5xx i stack — nikad sirova putanja, query, zaglavlja ni tijelo zahtjeva.
Neispravno percent-kodiran parametar putanje (npr. `/api/v1/rewards/%E0%A4%A/issue`) → `404 NOT_FOUND`, bez stack-a i bez
sirove vrijednosti u logu (D-5); neispravan JSON ima prednost (`422 INVALID_REQUEST`).

**API-01 `POST /api/v1/account/init`** — zaglavlje `Authorization: Bearer <Firebase ID token>`, tijelo tačno
`{ "displayName", "acceptedTermsVersion" }`. U jednoj Firestore transakciji kreira `users/{uid}` i `loyaltyAccounts/{uid}`
(UID samo iz verifikovanog token-a). Odgovor: `201` kad je nalog kreiran, `200` za ponovljeni init (stanje se ne mijenja);
tijelo `{ "displayName", "accountStatus", "acceptedTermsVersion", "availablePoints", "reservedPoints" }`.
Greške: `401 UNAUTHENTICATED`, `409 ACCOUNT_DELETION_IN_PROGRESS`, `422 INVALID_DISPLAY_NAME`, `422 INVALID_REQUEST`,
`500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`.
Tijelo `{}` (ili prazno tijelo) uz `Content-Type: application/json` → `422 INVALID_DISPLAY_NAME` (odobreni redoslijed provjera),
a tijelo bez JSON `Content-Type` → `422 INVALID_REQUEST`.

**API-02 `POST /api/v1/pos/purchases`** — zaglavlje `X-POS-API-Key: <ključ stanice>` (samo zaglavlje; ključ u query-ju, drugom
zaglavlju, tijelu ili Firebase token nisu zamjena). `stationId` se izvodi isključivo iz ključa. Tijelo tačno
`{ "loyaltyUid", "posTransactionId", "volumeMl", "amountMinor", "currency", "occurredAt" }`; bilo koje drugo polje
(`stationId`, `earnedPoints`, `recordedAt`, `uid`, …) → `422 INVALID_REQUEST`. U jednoj Firestore transakciji nastaju
`purchases/{stationId}__{posTransactionId}`, EARN ledger event, in-app notifikacija i mijenja se `availablePoints`
(`earnedPoints = floor(volumeMl / 1000)`). Odgovor: `201` za prvi zahtjev, `200` za ponovljeni isti
`(stationId, posTransactionId)` sa istim `loyaltyUid`, `volumeMl`, `amountMinor` i `currency` (bodovi se ne dodaju ponovo);
tijelo uvijek iz sačuvane kupovine:
`{ "purchaseId", "stationId", "posTransactionId", "volumeMl", "amountMinor", "currency", "earnedPoints", "occurredAt" }`.

- Formati: `posTransactionId` `^[A-Za-z0-9._-]{1,64}$`; `volumeMl` cijeli broj 1–200000; `amountMinor` cijeli broj 0–1000000;
  `currency` tačno `"EUR"`; `occurredAt` RFC 3339 sa obaveznom zonom (`Z` ili `±hh:mm`, veliko `T` i `Z`, 0–3 decimale),
  postojeći kalendarski datum, najviše 5 minuta u budućnosti po vremenu Backend-a; vraća se kao UTC `YYYY-MM-DDTHH:mm:ss.sssZ`.
  `loyaltyUid` je string od 1–128 znakova bez `/` (nije `.`, `..` ni `__…__`) koji pripada ACTIVE nalogu.
- Cijeli brojevi se provjeravaju nad parsiranim JSON-om: `1000.0` i `1e3` su u JSON-u isti broj kao `1000` i prihvataju se;
  `-0` se čuva kao `0`.
- Validacija ulaza uvijek prethodi provjeri idempotentnosti, i kad kupovina već postoji (i03/P-6): ponovljeni zahtjev sa
  neispravnim poljem dobija kod tog polja (npr. `occurredAt` > +5 min → `422 INVALID_OCCURRED_AT`, neispravan format
  `loyaltyUid` → `404 LOYALTY_ACCOUNT_NOT_FOUND`), a ne prvi rezultat ni `409`.
- `occurredAt` nije dio poređenja ponovljenog zahtjeva (O-3): vraća se sačuvana vrijednost. Ponovljeni zahtjev za već upisanu
  kupovinu vraća prvi rezultat i kad je nalog u brisanju; nova kupovina za takav nalog → `404` (O-12).
- HTTP parser uklanja razmake oko vrijednosti zaglavlja; dva `X-POS-API-Key` zaglavlja → `401`.

Greške: `401 UNAUTHENTICATED_POS`, `404 LOYALTY_ACCOUNT_NOT_FOUND`, `409 IDEMPOTENCY_CONFLICT`, `422 INVALID_REQUEST`,
`422 INVALID_TRANSACTION_ID`, `422 INVALID_VOLUME`, `422 INVALID_AMOUNT`, `422 UNSUPPORTED_CURRENCY`, `422 INVALID_OCCURRED_AT`,
`500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`. Kad klijent dobije `503`, kupovina je možda ipak upisana: POS ponavlja isti
zahtjev i dobija prvi rezultat bez ponovnog dodavanja bodova.

**API-03 `POST /api/v1/rewards/{rewardId}/issue`** — zaglavlje `Authorization: Bearer <Firebase ID token>` (UID samo iz
verifikovanog token-a), tijelo tačno `{ "requestId" }`: kanonski UUID v4 malim slovima (O-15), generisan jednom po logičkom
pokušaju izdavanja i ponovljen pri svakom retry-ju. Bilo koje drugo polje (`uid`, `costPoints`, `voucherId`, `status`, …),
velika slova ili drugi oblik UUID-a → `422 INVALID_REQUEST`. `rewardId` iz putanje (npr. `CAR_WASH`, `SHOWER`) mora biti
ispravan ID dokumenta bez kontrolnih znakova; inače `404 REWARD_NOT_FOUND` bez pristupa bazi.
U JEDNOJ Firestore transakciji: istekli ACTIVE voucher-i korisnika prelaze u `EXPIRED` i vraćaju bodove (`REWARD_RELEASE`,
najviše jednom po voucher-u), pa se `availablePoints` umanjuje i `reservedPoints` uvećava za `costPoints` iz definicije, nastaje
ACTIVE voucher (`expiresAt = issuedAt + 15 min` po satu Backend-a), `REWARD_RESERVE` i `rewardRequests` zapis
(`SHA-256(uid:requestId)`). Odgovor: `201` za novi voucher, `200` za ponovljeni isti `(uid, requestId)` i isti `rewardId`
(ništa se ne upisuje, bez obzira na trenutno stanje naloga, nagrade i bodova — O-16); tijelo uvijek iz sačuvanog voucher-a:
`{ "voucherId", "rewardId", "costPoints", "status", "issuedAt", "expiresAt" }` (`status` je trenutni status voucher-a,
vremena UTC `YYYY-MM-DDTHH:mm:ss.sssZ`). Bodove Android čita iz `loyaltyAccounts`.

- Redoslijed provjera: neispravan JSON (`422`) → neispravno kodiran parametar (`404 NOT_FOUND`) → token (`401`) → tijelo i
  `requestId` (`422`) → format `rewardId` (`404`) → rok (`503`) → u transakciji: postojeći zahtjev (isti reward → `200`, drugi →
  `409 IDEMPOTENCY_CONFLICT`) → nalog (`409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`) → nagrada
  (`404 REWARD_NOT_FOUND`, `409 REWARD_INACTIVE`) → oslobađanje isteklih voucher-a → bodovi (`409 INSUFFICIENT_POINTS`).
  Validacija ulaza uvijek prethodi provjeri idempotentnosti.
- `409 INSUFFICIENT_POINTS` može doći uz već vraćene bodove isteklih voucher-a (O-14): oslobađanje se upisuje, novi voucher ne.
- Neuspješan zahtjev (`404`, `409`, `500`) ne ostavlja zapis o zahtjevu, pa isti `requestId` može kasnije uspjeti (npr. poslije
  nove kupovine).

Greške: `401 UNAUTHENTICATED`, `404 REWARD_NOT_FOUND`, `404 NOT_FOUND`, `409 ACCOUNT_NOT_INITIALIZED`,
`409 ACCOUNT_DELETION_IN_PROGRESS`, `409 REWARD_INACTIVE`, `409 INSUFFICIENT_POINTS`, `409 IDEMPOTENCY_CONFLICT`,
`422 INVALID_REQUEST`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`. Kad klijent dobije `503`, voucher je možda ipak izdat:
klijent ponavlja zahtjev ISTIM `requestId` i dobija isti voucher bez nove rezervacije.

**API-04 `POST /api/v1/pos/vouchers/{voucherId}/redeem`** — zaglavlje `X-POS-API-Key` (isti POS ključevi kao API-02; `stationId`
samo iz ključa, nikad iz tijela, query-ja ni zaglavlja), tijelo tačno `{ "redemptionRequestId" }`: `^[A-Za-z0-9._-]{1,64}$`
(§20.1), generisan jednom po pokušaju otkupa na kasi i ponovljen pri svakom retry-ju. Bilo koje drugo polje (`stationId`, `uid`,
`voucherId`, …), bez tijela, niz, `null` ili ne-JSON → `422 INVALID_REQUEST`. `voucherId` je tačno 64 mala hex znaka; svaki drugi
oblik — uključujući Firebase UID iz Customer QR koda (AC-04) — → `404 VOUCHER_NOT_FOUND` bez pristupa bazi.
U JEDNOJ Firestore transakciji ACTIVE voucher prelazi u `REDEEMED` (`redeemedAt` po satu Backend-a, `redeemedAtStationId`),
`reservedPoints −= costPoints` (`availablePoints` se ne mijenja), nastaje `REWARD_REDEEM` i zapis `redemptionRequests/{requestKey}`
(`requestKey` = SHA-256 nad UTF-8 `stationId:redemptionRequestId`, hex malim slovima; O-8 (b)). Odgovor `200` i za prvi i za
ponovljeni isti `(stationId, redemptionRequestId)` za isti voucher (ništa se ne upisuje, bez obzira na stanje naloga i rok — O-24);
tijelo uvijek iz sačuvanog voucher-a: `{ "voucherId", "rewardId", "costPoints", "status": "REDEEMED", "issuedAt", "expiresAt",
"redeemedAt", "redeemedAtStationId" }` (i06/P-6).

```powershell
$tijelo = '{"redemptionRequestId":"POS-RDM-001"}'
Invoke-RestMethod "http://127.0.0.1:3000/api/v1/pos/vouchers/<voucherId>/redeem" -Method Post `
  -Headers @{ 'X-POS-API-Key' = $env:POS_KLJUC_SIM01 } -ContentType 'application/json' -Body $tijelo
```

- Isti `redemptionRequestId` za DRUGI voucher → `409 IDEMPOTENCY_CONFLICT`; novi ID (ili ista vrijednost sa druge stanice, što je
  drugi `requestKey`) za već otkupljen voucher → `409 VOUCHER_ALREADY_REDEEMED`.
- `CANCELLED` → `409 VOUCHER_CANCELLED`; `EXPIRED` → `409 VOUCHER_EXPIRED`; status ima prednost nad rokom (O-7).
- ACTIVE voucher kome je rok istekao: u istoj transakciji prelazi u `EXPIRED` i bodovi se vraćaju (`REWARD_RELEASE`), pa
  `409 VOUCHER_EXPIRED` (§20.5); drugi voucher-i korisnika se ne diraju (O-26).
- Zapis o zahtjevu nastaje SAMO pri uspješnom otkupu (O-8 (a)). Posljedica: `redemptionRequestId` upotrijebljen za neuspješan pokušaj
  (`404`, `409`, `500`, `503` bez commit-a) može se kasnije upotrijebiti za drugi voucher.
- Tijelo sa dvostrukim ključem (`{"redemptionRequestId":"A","redemptionRequestId":"B"}`) prihvata se sa POSLJEDNJOM vrijednošću
  (`JSON.parse`, i06/P-4).
- Redoslijed provjera: neispravan JSON ili JSON skalar/`null` (`422`, i bez ključa) → neispravno kodiran parametar (`404 NOT_FOUND`)
  → POS ključ (`401`) → tijelo (`422`) → format `voucherId` (`404`) → rok (`503`) → u transakciji: postojeći zahtjev (isti voucher →
  `200`, drugi → `409 IDEMPOTENCY_CONFLICT`) → voucher postoji (`404`) → `REDEEMED` / `CANCELLED` / `EXPIRED` (`409`) → tek za ACTIVE
  stanje naloga vlasnika (`409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`; O-25) → istek (§20.5) → otkup.

Greške: `401 UNAUTHENTICATED_POS`, `404 VOUCHER_NOT_FOUND`, `404 NOT_FOUND`, `409 IDEMPOTENCY_CONFLICT`,
`409 VOUCHER_ALREADY_REDEEMED`, `409 VOUCHER_CANCELLED`, `409 VOUCHER_EXPIRED`, `409 ACCOUNT_NOT_INITIALIZED`,
`409 ACCOUNT_DELETION_IN_PROGRESS`, `422 INVALID_REQUEST`, `500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`. Kad kasa dobije `503`,
otkup je možda ipak upisan: kasa ponavlja zahtjev ISTIM `redemptionRequestId` i dobija `200` sa istim tijelom bez novog otkupa.

**API-05 `POST /api/v1/vouchers/{voucherId}/cancel`** — zaglavlje `Authorization: Bearer <Firebase ID token>` (UID samo iz
verifikovanog token-a; `?uid=`, `X-User-Id` i slično se ignorišu). Bez tijela: zahtjev bez tijela (i `Content-Length: 0` bez
`Content-Type`, kako šalje Retrofit `@POST` bez `@Body`) ili tijelo `{}`; svako drugo tijelo → `422 INVALID_REQUEST`, i kada
`Content-Type` nije JSON (O-21). `voucherId` je tačno 64 mala hex znaka; svaki drugi oblik → `404 VOUCHER_NOT_FOUND` bez pristupa
bazi (O-22). U JEDNOJ Firestore transakciji ACTIVE voucher prelazi u `CANCELLED` (`cancelledAt` po satu Backend-a), bodovi se
vraćaju (`reservedPoints −= costPoints`, `availablePoints += costPoints`) i nastaje `REWARD_RELEASE` (§19.1). Odgovor `200` i za
prvi i za ponovljeni cancel (§19.2: ponovljen cancel ništa ne upisuje i ne vraća bodove ponovo); tijelo uvijek iz sačuvanog
voucher-a: `{ "voucherId", "rewardId", "costPoints", "status": "CANCELLED", "issuedAt", "expiresAt", "cancelledAt" }`.

- Voucher kome je rok istekao (`expiresAt` ≤ sat Backend-a), a još je ACTIVE: u istoj transakciji prelazi u `EXPIRED` i bodovi se
  vraćaju, pa odgovor `409 VOUCHER_EXPIRED` (O-5) — klijent osvježava stanje (bodovi su već vraćeni). Ishod nikad nije `CANCELLED`.
- `REDEEMED` → `409 VOUCHER_ALREADY_REDEEMED`; `EXPIRED` → `409 VOUCHER_EXPIRED`; ništa se ne upisuje (§19.3).
- Voucher drugog korisnika → `403 FORBIDDEN` (O-6), tijelo bez ikakvih podataka o voucher-u. `403` (umjesto `404`) svjesno otkriva
  da voucher postoji (i05/P-13); `voucherId` ima 256 bita i nije pogodljiv. Nepostojeći voucher → `404 VOUCHER_NOT_FOUND`.
- Redoslijed provjera: neispravan JSON ili JSON skalar/`null` (`422`, i bez token-a) → neispravno kodiran parametar
  (`404 NOT_FOUND`) → token (`401`) → tijelo (`422`; objekat sa poljem ili niz bez token-a daje `401`, i05/P-11) → format
  `voucherId` (`404`) → rok (`503`) → u transakciji: postoji (`404`) → vlasnik (`403`) → `CANCELLED` (`200`) / `REDEEMED` /
  `EXPIRED` (`409`) → tek za ACTIVE voucher stanje naloga (`409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`;
  O-20) → istek (O-5) → oslobađanje. Ponovljen cancel vraća `200` i kad je nalog u brisanju (ništa se ne mijenja).
- `/api/v1/vouchers//cancel` (prazan segment) nije ruta → `404 NOT_FOUND`, ne `VOUCHER_NOT_FOUND` (i05/P-12).

Greške: `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 VOUCHER_NOT_FOUND`, `404 NOT_FOUND`, `409 VOUCHER_EXPIRED`,
`409 VOUCHER_ALREADY_REDEEMED`, `409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`, `422 INVALID_REQUEST`,
`500 INTERNAL_ERROR`, `503 SERVICE_UNAVAILABLE`. Kad klijent dobije `503`, cancel je možda ipak upisan: isti poziv je bezbjedan retry
(stanje voucher-a je ključ idempotentnosti) i vraća sačuvano stanje.

**API-06 `POST /api/v1/account/vouchers/reconcile`** — isto zaglavlje i isto pravilo tijela kao API-05. U JEDNOJ Firestore
transakciji svaki ACTIVE voucher korisnika kome je rok istekao prelazi u `EXPIRED` sa `REWARD_RELEASE` (najviše jednom po voucher-u,
redom po `expiresAt`, pa `voucherId`); ostali voucher-i se ne diraju (§18.1). Odgovor `200 { "reconciledCount" }` — broj voucher-a
koje je oslobodio OVAJ poziv; pod istovremenim pozivima broji samo ono što je ta transakcija zaista oslobodila (i05/P-14), pa se ne
koristi za balance. Stanje naloga se provjerava prvo (`409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`).
Gornja granica broja voucher-a ne postoji (§18.1 traži jednu transakciju; vidi poznata ograničenja). Greške: `401 UNAUTHENTICATED`,
`404 NOT_FOUND`, `409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`, `422 INVALID_REQUEST`, `500 INTERNAL_ERROR`,
`503 SERVICE_UNAVAILABLE` (retry je bezbjedan; ponovljen poziv vraća `0` za već oslobođene).

**Preporučeni tok klijenta** (ODLUKE §6 (n)): na Home ekranu Android poziva API-06, pa čita `loyaltyAccounts` i ACTIVE voucher-e iz
Firestore-a (bodovi se nikad ne računaju iz odgovora). Retry API-03 može vratiti `"status": "ACTIVE"` za voucher kome je `expiresAt`
prošao (sačuvano stanje, O-16) — klijent tada odlučuje po `expiresAt` i poziva API-06. Cancel: poziv API-05; na
`409 VOUCHER_EXPIRED` klijent osvježava stanje, jer su bodovi već vraćeni.

**API-07 `DELETE /api/v1/account`** — zaglavlje `Authorization: Bearer <Firebase ID token>` (UID samo iz verifikovanog token-a), bez
tijela (dozvoljeni su i `Content-Length: 0` i `{}`; svako drugo tijelo → `422 INVALID_REQUEST`, O-21). Prijava mora biti svježa
(§23): `auth_time` token-a najviše 5 minuta prije sata Backend-a (granica uključiva); inače ili kad `auth_time` nedostaje
`409 REAUTHENTICATION_REQUIRED` bez ikakvog pristupa bazi — klijent traži ponovnu prijavu i ponavlja poziv. Redoslijed: neispravan JSON
(`422`, i bez token-a) → token (`401`) → tijelo (`422`) → svježina (`409`) → brisanje.

```powershell
Invoke-WebRequest "http://127.0.0.1:3000/api/v1/account" -Method Delete -Headers @{ Authorization = "Bearer $idToken" } -UseBasicParsing
# StatusCode 204, bez tijela
```

Tok (§23.1, O-32), svaki korak idempotentan i konzistentan sam za sebe (nije jedna transakcija, O-36): `users.accountStatus` →
`DELETION_IN_PROGRESS` (od tog trenutka init, kupovina, issue, cancel, redeem i reconcile tog korisnika se odbijaju) → svaki ACTIVE
voucher se zatvara sa `REWARD_RELEASE` u jednoj transakciji sa nalogom (neistekao `CANCELLED`, istekao `EXPIRED`; O-9, O-34) → brišu se
`rewardRequests`, `redemptionRequests`, `notifications`, `vouchers`, `loyaltyAccounts` → u `purchases` i `loyaltyLedger` se samo
`uid` postavlja na `null` (§23.3) → briše se `users/{uid}` → briše se Firebase Auth nalog (posljednji). Odgovor `204` bez tijela.
Ako poziv vrati `500` ili `503`, ponovljen `DELETE` (uz svježu prijavu) nastavlja isti cleanup i vraća `204` (§23.4, O-33); korisnik
čiji `users` dokument više ne postoji takođe dobija `204` (O-34b). Kad je Auth nalog već obrisan, ponovljen `DELETE` dobija
`401 UNAUTHENTICATED` — to znači da je brisanje završeno (i07/P-8, ograničenje (v)).

Greške: `401 UNAUTHENTICATED`, `404 NOT_FOUND` (`GET`/`POST`/`PUT` na `/account`), `409 REAUTHENTICATION_REQUIRED`,
`422 INVALID_REQUEST`, `500 INTERNAL_ERROR` (npr. neispravno stanje naloga ili voucher-a; ništa se ne „popravlja”),
`503 SERVICE_UNAVAILABLE`. Nikad `ACCOUNT_NOT_INITIALIZED` ni `ACCOUNT_DELETION_IN_PROGRESS`.

Posljedice brisanja za druge endpointe: POS retry kupovine istog `(stationId, posTransactionId)` poslije pseudonimizacije sa istim
`volumeMl`, `amountMinor` i `currency` vraća prvi rezultat (`200`, bez novog EARN-a) i kad je `loyaltyUid` drugačiji, jer se `uid = null`
ne poredi (O-10a, i07/P-5); drugačiji iznos → `409 IDEMPOTENCY_CONFLICT`. Retry izdavanja / otkupa poslije brisanja mapping-a više ne
vraća prvi rezultat nego `409` / `404` (i07/P-6). Android (i10) poslije pokretanja brisanja ne poziva init ni drugi API dok ne dobije
`204` (ili `401` na ponovljen `DELETE`).

## Pokretanje

```powershell
# Emulatori (Firestore + Auth), u posebnom prozoru
cd backend; npx firebase emulators:start --config ..\firebase.json --project demo-fuelpoints --only firestore,auth

# Backend (sluša na http://127.0.0.1:<PORT>/api/v1)
cd backend; npm start

# Punjenje rewardDefinitions (samo nad emulatorom; emulator mora biti pokrenut)
cd backend; npm run seed:emu
```

Seed postavlja tačno stavke iz SRS §12 (`CAR_WASH`, `SHOWER`) i ne briše druge dokumente u kolekciji `rewardDefinitions`.

### Android aplikacija lokalno

Sve tri komande iznad u jednom koraku (emulatori → seed → Backend sa `.env`; gašenje sa Ctrl+C):

```powershell
.\skripte\pokreniLokalno.ps1
```

Debug APK (Android emulator, preporučeno API 35) koristi Auth i Firestore emulator na `10.0.2.2:9099` / `10.0.2.2:8080`
i Backend na `http://10.0.2.2:3000/api/v1/` (`10.0.2.2` je ovaj računar viđen sa Android emulatora; `PORT` u `.env` mora biti `3000`).
Firebase se inicijalizuje u kodu iz demo vrijednosti, bez `google-services.json` (O-39); cleartext HTTP je dozvoljen samo u debug
build-u i samo za `10.0.2.2` (O-40). Pokretanje: Android Studio → `android-app` → **Run** na emulatoru, ili:

```powershell
cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug; cd ..
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" install -r android-app\app\build\outputs\apk\debug\app-debug.apk
```

Smoke protokol Iteracije 9: `docs/smoke/i09_smoke.md`.

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
- `npm run test:emu:ciljano -- test/emulator/<fajl>.test.js [drugi fajlovi] [--test-name-pattern=<obrazac>]` (backend, O-29 (c)):
  ista konfiguracija kao `test:emu`, samo zadati fajlovi; za razvoj i kontrolne mutacije. Dokaz za DoD ostaju `test:emu` i
  `provjera.ps1`. Ako je na PATH-u Oracle `javapath`, prije pokretanja postaviti pravi JDK prvi na PATH
  (`$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"`), inače Java proces emulatora ostaje i drži port 8080.

## Provjera

```powershell
.\skripte\provjera.ps1; $LASTEXITCODE
```

Skripta redom provjerava alate, SHA-256 SRS-a, odsustvo tajni i nedovršenih oznaka, slobodne portove,
backend testove, start Backend-a (`node src/pokreni.js` sa POS ključem generisanim u toku izvršavanja: 404 na nepoznatoj ruti,
401 na `/account/init` bez token-a i 401 `UNAUTHENTICATED_POS` na `/pos/purchases` bez POS ključa),
rules testove i Android build. Na prvu grešku vraća exit code 1,
a kad sve prođe, ispisuje `SVE PROVJERE PROŠLE` i vraća 0.
