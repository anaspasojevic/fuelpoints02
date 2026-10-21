# FuelPoints POS Simulator

Simulator kase benzinske pumpe (SRS §2.5, §33.2): jedna HTML stranica (`index.html`, bez framework-a i bez
eksternih resursa) i mali lokalni poslužitelj (`server.js`, samo `node:http`, bez zavisnosti).
QR skener nije potreban: loyalty UID se kopira sa ekrana „Moj QR” u Android aplikaciji.

Simulator je *controlled client* (§3.1): Loyalty Backend mu vjeruje samo za POS ulazne podatke, i to tek poslije
autentikacije POS API ključem (§3.4). `stationId` se nikad ne šalje; Backend ga određuje iz ključa.

## Zašto poslužitelj

Backend nema CORS, a zaglavlje `X-POS-API-Key` aktivira preflight, pa stranica ne može direktno zvati Backend.
`server.js` servira stranicu i prosljeđuje SAMO `POST /api/v1/pos/purchases` i
`POST /api/v1/pos/vouchers/{voucherId}/redeem`; sve ostalo je 404. Sluša samo na `127.0.0.1`. Zaglavlje
`X-POS-API-Key` se prosljeđuje, a ne loguje se i ne čuva; u log idu samo metod, šablon rute i status.

## Pokretanje

Backend mora biti pokrenut (`.\skripte\pokreniLokalno.ps1` ili `cd backend; npm start`). Zatim iz korijena repozitorijuma:

```powershell
node pos-simulator/server.js
```

Stranica je na `http://127.0.0.1:3001`. Varijable: `POS_SIMULATOR_PORT` (podrazumijevano 3001) i
`BACKEND_URL` (podrazumijevano `http://127.0.0.1:3000`).

## Korišćenje

1. Unesite POS API ključ stanice (polje je tipa `password`; ključ ostaje samo u memoriji stranice).
2. **Kupovina (API-02)**: loyalty UID, količina goriva u litrama (npr. `42,730` → `volumeMl` 42730), iznos u EUR
   (npr. `70,50` → `amountMinor` 7050), valuta je uvijek EUR, vrijeme kupovine (UTC, podrazumijevano „sada”).
   „Nova transakcija” generiše novi `posTransactionId`; „Ponovi isti zahtjev” šalje isti payload (200 umjesto 201,
   bodovi se ne dodaju dvaput).
3. **Otkup (API-04)**: `voucherId` (64 heksadecimalna znaka) i `redemptionRequestId` (UUID v4, „Novi zahtjev”
   generiše novi). Isti ID ponovljen za isti voucher daje 200 sa istim tijelom; za drugi voucher 409 `IDEMPOTENCY_CONFLICT`.
4. Prikaz odgovora: HTTP status i tijelo uspjeha ili `code` / `message` / `correlationId` greške (§27). Kad Backend vrati
   503 ili nije dostupan, nudi se ponovni pokušaj ISTIM identifikatorom (503 ne znači da mutacija nije upisana).

## Testovi

```powershell
cd pos-simulator; npm test
```

I11-T01 (tijela zahtjeva i konverzije), I11-T02 (ključ se ne čuva ni ne loguje, dozvoljene samo dvije rute),
I11-T04 (prikaz odgovora). I11-T03 (kroz pravi Backend nad emulatorom) je u `backend/test/emulator/posSimulator.test.js`.
