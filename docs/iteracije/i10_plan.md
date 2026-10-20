# i10 — Plan (PLANNER)

Iteracija 10: Android 2 — Purchases, Rewards, Notifications, Settings. Grana `iteracija-10` (iz `main` = merge `7dab954`, tag `i09`).
Izvori: `CLAUDE.md`, `docs/iteracije/i10_brief.md` (obavezujući), `docs/ODLUKE.md` (verzija na tagu `i09`), SRS 3.1
(`docs/srs/FuelPoints_SRS_3_1.docx`, normativan, SHA-256 `7D866413…C60228` provjeren; `.md` čitljiva kopija), `docs/iteracije/i09_plan.md`
(struktura, sekcije 4–8), `docs/iteracije/i09_review.md`, `docs/dizajn/5_istorija.png` … `8_profil.png`, `docs/dizajn/prototip.html`,
`android-app/app/src` (arhitektura i09), `README.md` (API-03, API-05, API-06, API-07).
Datum plana: 2026-10-20. Uloga: PLANNER (bez koda). Režim: ekspresni (O-30, O-31). `provjera.ps1` nije pokretan.

Oznake: otvorena pitanja `i10/P-n` (sekcija 13); dopunski testovi `I10-T01 … I10-T16`; koraci `K1 … K6` (sekcija 7); smoke `S1 … S20`.
Mutacija nema (O-31 (c)). Probe su rađene u scratchpad-u sesije (privremena skripta i `firebase.json` sa portovima 8180 / 9199, van repoa,
nisu commit-ovane); ishod je u sekciji 3.2.

---

## 1. SRS zahtjevi u opsegu

| Zahtjev | Šta i10 isporučuje |
|---|---|
| UI-03 (dopuna), O-46 | Donja navigacija po prototipu: Početna · Istorija · **QR** (centralno dugme) · Nagrade · Profil; zvono „Obavještenja” u zaglavlju Home-a. API-06 pri otvaranju Home-a ostaje (O-43). Nema mrtvih dugmadi. |
| UI-05, §8.3, §25.4, (e) | Istorija kupovina: datum (`occurredAt`), količina goriva, iznos, valuta, `earnedPoints`; `where uid == auth.uid`, `orderBy occurredAt desc`, `limit 20`, „Učitaj starije kupovine” = `startAfter(posljednji snimak)`. |
| UI-06, §12, §13, §14, §17, §19, (i), (s), O-15, O-16, O-49, O-50 | Jedan ekran Nagrade: katalog (aktivne `rewardDefinitions`), eligibility (`availablePoints ≥ costPoints`), izdavanje API-03 sa `requestId` po O-50, aktivni voucher-i iz Firestore-a (`uid ==`, `status == ACTIVE`, `limit 20`), reward QR = tačno `voucherId`, odbrojavanje do `expiresAt` (samo prikaz), otkazivanje API-05; `409 VOUCHER_EXPIRED` → API-06 + osvježavanje. Bez ekrana istorije voucher-a (§1.3). |
| UI-07, §9.2, §21, §25.8, RULE-T10 | Obavještenja: do 50 najnovijih (`where uid ==`, `orderBy createdAt desc`, `limit 50`), bez paginacije i grupisanja; otvaranje stavke postavlja `readAt = serverTimestamp()` samo kad je `readAt == null`. |
| UI-08, §25.2, RULE-T04 | Profil: ime za prikaz (izmjena `users/{uid}` `{ displayName, updatedAt: serverTimestamp() }`, 1–100 UTF-16), Auth e-mail read-only, promjena lozinke, link za reset lozinke, Pomoć i česta pitanja (O-47), Odjava, Brisanje naloga (O-48). |
| AUTH-07, AC-01 | Odjava: `signOut()`, bez ijednog Backend poziva i Firestore upisa → Login (back stack obrisan). |
| AUTH-08, §3.6 | Promjena lozinke: `reauthenticate(EmailAuthProvider)` sa trenutnom lozinkom → `updatePassword(nova)`; klijentski validator §3.6 (i09/P-2). |
| AUTH-09 (iz Profila) | „Pošalji link za promjenu lozinke” na Auth e-mail → ista neutralna poruka kao u i09. |
| AUTH-05, §23, §23.4, API-07, O-33, O-35, O-48, (v) | Brisanje naloga: potvrda → lozinka → reauth → svjež token → `DELETE /api/v1/account` bez tijela → `204` → `signOut` → Login „Nalog je obrisan.”; 409 `REAUTHENTICATION_REQUIRED` → ponovo lozinka; 401 poslije pokrenutog DELETE-a → završeno; 503 / mreža → ponavljanje. Za vrijeme toka Android ne poziva init ni drugi API. |
| §27 (klijent) | Poruke za kodove Rewards / cancel / delete (sekcija 6.2); `message` i `correlationId` se ne prikazuju. |
| §2.2, AC-02 | Android piše u Firestore SAMO `users/{uid}.{displayName, updatedAt}` i `notifications/{id}.readAt`; bodove i voucher-e mijenja isključivo Backend. |
| §3.3, NFR-07, (h) | Bearer svjež token za svaki poziv; nema logovanja token-a, UID-a, e-maila ni `voucherId`-a (statička provjera I10-T15). |
| NFR-08 | Marker ostaje na Home-u (i09, nepromijenjeno). |
| NFR-09 (dio), NFR-10 | Smoke na API 35 (O-31 (d)); touch target ≥ 48 dp, `contentDescription` za ikone bez teksta; Layout Inspector u smoke-u. |

## 2. Van opsega

POS Simulator, pravi Firebase projekat, release build i R8 pravilo (i11); NFR-09 na API 26 (i11); izmjene `backend/`, `firebase/firestore.rules`,
`docs/srs/` (proba 3.2 potvrđuje da nisu potrebne); FCM; ekran istorije voucher-a; promjena e-maila; skener QR-a; offline scenariji osim NFR-08;
elementi prototipa koje SRS ne traži (§1.3, i10/P-4): mjerač (gauge) sa pragovima, „Do pranja”, kartica „Imate dovoljno za…”, „Posljednja
točenja”, mjesečni zbir („Oktobar: 72,83 litra…”), crvena tačka nepročitanih na zvonu, dugme za kopiranje UID-a; Compose UI / instrumentacioni
testovi (NFR-10 inspekcijom); nove Gradle zavisnosti (O-45, i09/P-1 — nijedna nije potrebna: UUID iz `java.util.UUID`, vrijeme iz `java.time`).

## 3. Polazno stanje i probe

### 3.1 Korak 0

`git fetch --all --tags`; `main` = `7dab954` = `i09^{commit}` (anotirani tag); SRS hash `7D866413968C2445BE532876E1F73AB307ACFFD96465C024982D458D41C60228`
odgovara; grana `iteracija-10`; brief doslovno u `docs/iteracije/i10_brief.md` (commit „i10: Iteration Brief (Orchestrator)”, push -u).

Stanje i09 (bitno za i10): `BackendApi` ima samo API-01 i API-06; `OkHttpBackendApi.posalji` zna samo `POST` i uvijek parsira tijelo uspjeha
(`204` bez tijela bi dao `GreskaBackenda(null, 204)` — mora se proširiti); 503 → jedan ponovni pokušaj poslije 1 000 ms (R-04).
`IzvorAutentikacije` nema odjavu, reauth ni promjenu lozinke; `IzvorNaloga` samo čita. `firestore.indexes.json` je prazan (`{"indexes": [], "fieldOverrides": []}`).
`EkranBrisanjaUToku` nema akciju (ODLUKE §7, i09). Ručni kontejner `Zavisnosti` (bez DI biblioteke).
Napomena: pri probi su portovi 8080 / 9099 / 3000 bili zauzeti Aninim `pokreniLokalno.ps1`; proba ga nije dirala (zasebni portovi).

### 3.2 Probe (scratchpad, nisu commit-ovane)

Firestore + Auth emulator (`firebase emulators:exec`, `firebase-tools` 15.32.1 iz `firebase/tests`, pravila = `firebase/firestore.rules`,
klijent `firebase` 12.19.0 JS — isti Rules / Auth emulator kao Android SDK; Kotlin poziv na uređaju nije probavan, vidi 11). Svih 25 provjera **OK**:

(a) **Oblici Android upita prema §31 — POTVRĐENO.**
- `purchases` `where('uid','==',A).orderBy('occurredAt','desc').limit(20)` → 20, najnovija prva; `startAfter(posljednji snimak).limit(20)` → preostalih 5;
  `limit(21)` → DENY; bez `where uid` → DENY; bez `limit` → DENY.
- `notifications` `where uid == A`, `orderBy('createdAt','desc')`, `limit(50)` → ALLOW; `limit(51)` → DENY.
- `vouchers` `where uid == A`, `where status == 'ACTIVE'`, `limit(20)` → samo ACTIVE (CANCELLED isključen); bez `limit` → DENY;
  sa `orderBy('expiresAt','asc')` → ALLOW; `onSnapshot` sa istim upitom → ALLOW.
- `rewardDefinitions` cijela kolekcija i `where('active','==',true)` → ALLOW (prijavljen korisnik).
- Emulator NE provjerava composite indekse → indeksi se dodaju u `firestore.indexes.json` (5.3) i provjeravaju statički (I10-T15) i u i11 nad pravim projektom.

(b) **Android upisi — POTVRĐENO.** `users/A` `update({displayName:'Ana S.', updatedAt: serverTimestamp()})` → ALLOW (RULE-T04);
samo `displayName` bez `updatedAt` → DENY; `displayName` 101 znak → DENY; `notifications/…` `update({readAt: serverTimestamp()})` → ALLOW
(RULE-T10); ponovni `readAt` na već pročitanoj → DENY (zato Android piše samo kad je `readAt == null`, 5.6).

(c) **Reauth i promjena lozinke nad Auth emulatorom — POTVRĐENO.** `reauthenticateWithCredential(EmailAuthProvider.credential(email, pogrešna))`
→ `auth/wrong-password`; sa tačnom → OK i `getIdToken(false)` odmah nosi NOV `auth_time` (t0 + 2 s); `updatePassword('Lozinka2')` → OK; stara
lozinka → odbijena, nova → prijava OK; slaba `abcdef` → PRIHVAĆENA (emulator nema policy, O-2 → klijentski §3.6 jedina kontrola do i11).
Za API-07 plan ipak traži `getIdToken(true)` poslije reauth-a (5.8) — ne oslanja se na to da SDK sam zamijeni keširani token.

## 4. Raspored fajlova

Sve u `android-app/app/src/main/java/io/github/anaspasojevic/fuelpoints/` (= `…/`) osim gdje je navedeno.

| Fajl / folder | Sadržaj |
|---|---|
| `…/domen/GeneratorZahtjeva.kt` | `requestId` = `UUID.randomUUID().toString()` (v4, mala slova, O-15); interfejs radi testova |
| `…/domen/PokusajIzdavanja.kt` | čista logika O-50: tekući logički pokušaj `(rewardId, requestId)`, šta je konačan odgovor (5.5, i10/P-2) |
| `…/domen/Odbrojavanje.kt` | `preostalo(expiresAtMs, sadaMs)` → `Preostalo(mm:ss)` / `Istekao` (O-49, 5.5) |
| `…/domen/Prikaz.kt` | formatiranje: litri, iznos + valuta, datum/vrijeme (`java.time`, zona uređaja), oblik riječi „bod” (kao Backend i03/P-8) |
| `…/domen/Prihvatljivost.kt` | eligibility i „nedostaje N bodova” (5.5) |
| `…/domen/TokBrisanja.kt` | mašina stanja brisanja naloga (O-48, (v), 5.8) |
| `…/domen/ZastavicaBrisanja.kt` | aplikacijska zastavica „brisanje u toku” (in-memory) koju poštuju API klijent i Home (5.8) |
| `…/domen/PorukeGresaka.kt` | dopuna poruka i `zaKod` (6.2) |
| `…/podaci/api/BackendApi.kt`, `OkHttpBackendApi.kt` | + `izdajNagradu(rewardId, requestId)`, `otkaziVoucher(voucherId)`, `obrisiNalog()`; `DELETE`; `204`; segmenti putanje kodirani (`HttpUrl.Builder.addPathSegment`); modeli `TijeloIzdavanja`, `OdgovorVouchera` |
| `…/podaci/autentikacija/*` | + `email()`, `odjavi()`, `potvrdiLozinku(lozinka)` (reauth), `promijeniLozinku(nova)`, `dobaviToken(osvjezi: Boolean)` |
| `…/podaci/nalog/*` | + `promijeniIme(uid, displayName)` — jedini upis u `users` (5.7) |
| `…/podaci/kupovine/IzvorKupovina.kt`, `FirestoreIzvorKupovina.kt` | `stranica(uid, kursor?)` → `Stranica(kupovine, sljedeciKursor?)`; kursor je neprozirni omotač `DocumentSnapshot`-a |
| `…/podaci/nagrade/IzvorNagrada.kt`, `FirestoreIzvorNagrada.kt` | `posmatrajKatalog()`, `posmatrajAktivneVouchere(uid)` (samo čitanje) |
| `…/podaci/obavjestenja/IzvorObavjestenja.kt`, `FirestoreIzvorObavjestenja.kt` | `posmatraj(uid)` (≤ 50), `oznaciProcitano(id)` — jedini upis u `notifications` |
| `…/ui/komponente/DonjaNavigacija.kt` | 5 stavki po prototipu (5.1) |
| `…/ui/istorija/` | `EkranIstorije`, `IstorijaViewModel` (UI-05) |
| `…/ui/nagrade/` | `EkranNagrada`, `NagradeViewModel`, `KarticaVouchera` (UI-06) |
| `…/ui/obavjestenja/` | `EkranObavjestenja`, `ObavjestenjaViewModel` (UI-07) |
| `…/ui/profil/` | `EkranProfila`, `EkranImena` + `ImeViewModel`, `EkranLozinke` + `LozinkaViewModel`, `EkranPomoci`, `EkranBrisanjaNaloga` + `BrisanjeNalogaViewModel`, `ProfilViewModel` (UI-08) |
| `…/ui/pocetna/*` | zvono, donja navigacija, poštovanje `ZastavicaBrisanja` (i10/P-4) |
| `…/ui/pokretanje/EkranBrisanjaUToku.kt` | akcije „Nastavi brisanje” i „Odjavi se” (i10/P-6) |
| `…/ui/navigacija/NavigacijaAplikacije.kt` | nove rute (5.1) |
| `…/Zavisnosti.kt` | novi izvori, generator, sat, zastavica |
| `app/src/main/res/values/strings.xml` | tekstovi ekrana, FAQ (O-47, i10/P-1) |
| `app/src/main/res/drawable/` | vektorske ikone Material Symbols (Apache 2.0, i09/P-5): home, receipt_long, redeem, notifications, close, chevron_right, badge, key, help, description, logout, delete_forever, local_car_wash, shower, local_gas_station; licenca već u `android-app/licence/` |
| `app/src/test/java/…/` | I10-T01 … I10-T15 + proširenje `lazni/Lazni.kt` |
| `firebase/firestore.indexes.json` | tri composite indeksa (5.3) |
| `docs/smoke/i10_smoke.md`, `docs/smoke/i10_*.png` | protokol S1 … S20 i screenshot-i za Sliku 4 rada (Login, Home, Customer QR, Rewards sa aktivnim voucher-om) |
| `README.md`, `docs/*` | Android ekrani; TRACEABILITY, ODLUKE, IMPLEMENTATION_LOG, TEST_REPORT |

Bez izmjene: `backend/`, `firebase/firestore.rules`, `firebase.json`, `docs/srs/`, `skripte/provjera.ps1`, `skripte/pokreniLokalno.ps1`, Gradle zavisnosti.

## 5. Detaljan dizajn

### 5.1 Navigacija i ekrani (O-46, i10/P-4)

- Donja navigacija (prototip, ekrani 3–8): **Početna** (home) · **Istorija** (receipt_long) · **QR** (centralno žuto okruglo dugme,
  `contentDescription` „Moj QR kod”) · **Nagrade** (redeem) · **Profil** (person). Stavke imaju vidljiv tekst (osim QR-a) i visinu ≥ 48 dp.
  Prelaz: `navigate(ruta) { popUpTo(pocetna) { saveState = true }; launchSingleTop = true; restoreState = true }`; „nazad” sa bilo kog taba → Početna; sa Početne → izlaz.
- Home zaglavlje: „Zdravo, {displayName}” + dugme zvono (48 dp, `contentDescription` „Obavještenja”) → `obavjestenja`. Veliko žuto
  dugme „Moj QR kod” iz i09 se uklanja (QR je centralna stavka navigacije, kao u prototipu) — i10/P-4.
- Rute: postojeće + `istorija`, `nagrade`, `profil`, `obavjestenja`, `profil/ime`, `profil/lozinka`, `profil/pomoc`, `brisanjeNaloga`
  (+ postojeća `uslovi`, i10/P-5). Tabovi (`pocetna`, `istorija`, `mojQr`, `nagrade`, `profil`) imaju donju navigaciju; ostali imaju strelicu nazad
  (48 dp, `contentDescription` „Nazad”) bez navigacije.
- Gubitak sesije (`posmatrajSesiju() == null`) na BILO kojoj prijavljenoj ruti → `prijava` (proširenje i09 5.2) — osim dok traje tok brisanja
  (tada tok sam vodi na Login sa porukom, 5.8).
- `IzlazSaPocetne` / `409 ACCOUNT_DELETION_IN_PROGRESS` / `ACCOUNT_NOT_INITIALIZED` sa bilo kog ekrana (API-03, API-05) → isti prelazi kao Home u i09.

### 5.2 Istorija kupovina (UI-05, §25.4, (e))

- `FirestoreIzvorKupovina.stranica(uid, kursor)`: `collection("purchases").whereEqualTo("uid", uid).orderBy("occurredAt", DESCENDING)`
  `[.startAfter(kursor.snimak)].limit(20).get()`. `sljedeciKursor` = posljednji SIROVI snimak stranice ako je stranica imala tačno 20 dokumenata, inače `null`.
- Mapiranje (§8.3): `occurredAt` Timestamp, `volumeMl`, `amountMinor`, `earnedPoints` cijeli brojevi ≥ 0, `currency` string. Dokument kome
  nešto od toga nedostaje / ima pogrešan tip se PRESKAČE u prikazu (ne ruši stranicu), ali kursor i dalje ide od sirovog posljednjeg snimka.
- `IstorijaViewModel`: pri otvaranju učitava prvu stranicu; „Učitaj starije kupovine” (obrisno dugme, 48 dp) vidljivo samo kad `sljedeciKursor != null`;
  dok se učitava, dugme je onemogućeno (nema dvostrukog zahtjeva); greška čuva već učitane stavke i prikazuje poruku + „Pokušaj ponovo” za
  istu stranicu; prazna sljedeća stranica → dugme nestaje. Nova kupovina dok je ekran otvoren nije obavezna (ponovno otvaranje taba je osvježava).
- Prikaz po stavci (prototip „račun”): `06.10.2026. 08:12` (zona uređaja) · `42,73 l` · `68,37 EUR` · `+42`.
  Litri: `volumeMl / 1000` sa decimalnim zarezom, najmanje 2, najviše 3 decimale, bez gubitka (42 730 → „42,73 l”, 42 735 → „42,735 l”,
  30 000 → „30,00 l”). Iznos: `amountMinor / 100` sa 2 decimale + kod valute iz dokumenta (`EUR`; §8.4 whitelist); znak `€` se ne izvodi.
  `earnedPoints` 0 → „+0” prigušeno. Prazna lista: „Još nema kupovina. Pokažite QR kod na kasi.” Napomena dna: „1 bod za svaki pun litar”.

### 5.3 Firestore indeksi (ODLUKE (e), (i), i10/P-9)

`firebase/firestore.indexes.json`:
```json
{
  "indexes": [
    { "collectionGroup": "purchases", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "uid", "order": "ASCENDING" }, { "fieldPath": "occurredAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "notifications", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "uid", "order": "ASCENDING" }, { "fieldPath": "createdAt", "order": "DESCENDING" } ] },
    { "collectionGroup": "vouchers", "queryScope": "COLLECTION",
      "fields": [ { "fieldPath": "uid", "order": "ASCENDING" }, { "fieldPath": "status", "order": "ASCENDING" },
                  { "fieldPath": "expiresAt", "order": "ASCENDING" } ] }
  ],
  "fieldOverrides": []
}
```
Upit `vouchers`: `whereEqualTo("uid", uid).whereEqualTo("status", "ACTIVE").orderBy("expiresAt", ASCENDING).limit(20)` — prvo voucher koji
ističe najranije (i10/P-9). `rewardDefinitions` bez upita (cijela kolekcija, 2 dokumenta) — indeks nije potreban. `firestore.rules` se ne mijenja.

### 5.4 Katalog i eligibility (§12, UI-06, (i))

- `posmatrajKatalog()`: snapshot cijele `rewardDefinitions`; prikazuju se samo dokumenti sa `active == true`, `displayName` string,
  `costPoints` cijeli broj ≥ 1 (neispravan → preskočen, kao i04/P-12); redoslijed `costPoints` rastuće, pa ID.
- Bodovi: `IzvorNaloga.posmatrajLoyaltyNalog(uid)` (postojeći). `Prihvatljivost`: `availablePoints != null && availablePoints ≥ costPoints` →
  „dostupno” (žuti okvir); inače „nedostaje N bodova” (N = cost − available, samo prikaz); `availablePoints == null` → nijedna nije dostupna,
  poruka `STANJE_NEDOSTUPNO`. Zaglavlje: „Nagrade” + „{available} {bod/boda/bodova}”.
- Eligibility je samo UX: Backend je autoritet (§13.1); i „nedostupna” nagrada se ne može izdati iz UI-ja, a „dostupna” može dobiti 409.

### 5.5 Izdavanje, aktivni voucher, odbrojavanje, otkazivanje (UI-06, §13, §14, §17, §19, O-15, O-16, O-49, O-50, (s))

**Izdavanje (API-03).** Tap na dostupnu karticu → dijalog „Izdati voucher: {naziv} za {cost} bodova? Voucher važi 15 minuta.” [Odustani] [Izdaj]
(i10/P-8). Tap „Izdaj” = početak / nastavak logičkog pokušaja:
- `PokusajIzdavanja`: ako tekući NEZAVRŠENI pokušaj postoji za isti `rewardId` → koristi njegov `requestId` (retry); inače → novi `requestId`
  iz `GeneratorZahtjeva` (i prethodni nezavršeni pokušaj za drugu nagradu se napušta).
- `izdajNagradu(rewardId, requestId)` → `POST rewards/{rewardId}/issue`, tijelo TAČNO `{"requestId":"…"}`, `application/json`. API klijent
  na 503 sam ponavlja jednom poslije 1 000 ms SA ISTIM tijelom (isti `requestId`, R-04).
- KONAČAN odgovor (pokušaj se zatvara, sljedeći tap → novi `requestId`): `201`, `200`, svaki `4xx` (409 `INSUFFICIENT_POINTS`,
  `REWARD_INACTIVE`, `IDEMPOTENCY_CONFLICT`, `ACCOUNT_*`, 404 `REWARD_NOT_FOUND`, `NOT_FOUND`, 422, 401, 403).
  NEZAVRŠEN (pokušaj i `requestId` ostaju, dugme u poruci „Pokušaj ponovo” ponavlja ISTI `requestId`): `503` (poslije automatskog ponavljanja),
  `MreznaGreska` (uključujući rok 15 s), i — po i10/P-2 — `500` i odgovor bez čitljivog §27 tijela (ishod nepoznat; retry je bezbjedan, O-16).
- Uspjeh (`201`/`200`): poruka „Voucher je izdat. Pokažite QR kod na kasi.”; voucher i bodovi dolaze iz Firestore snapshot-a (tijelo odgovora
  se ne koristi za stanje; README „Preporučeni tok”). Za vrijeme zahtjeva kartice su onemogućene (nema paralelnih izdavanja iz UI-ja).
- `requestId` živi u `NagradeViewModel` (preživljava rotaciju); napuštanje ekrana napušta pokušaj — eventualno izdat voucher se ipak vidi u
  listi aktivnih iz Firestore-a (11).

**Aktivni voucher-i.** `posmatrajAktivneVouchere(uid)` (5.3); prikazuju se samo dokumenti sa `status == "ACTIVE"` i ispravnim `expiresAt`
(Timestamp) i `costPoints`. Kartica po prototipu: reward QR (`GeneratorQr.napravi(voucherId)` — sadržaj TAČNO `voucherId`, bez prefiksa),
„Aktivni voucher”, naziv nagrade (iz kataloga po `rewardId`, inače `rewardId`), „Rezervisano {cost} bodova. Pokažite na kasi.”, LCD
„Važi još mm:ss”, dugme „Otkaži” (≥ 48 dp). `voucherId` se NE prikazuje kao tekst i nigdje se ne loguje ((h)); QR slika ima
`contentDescription` „QR kod voucher-a” (bez vrijednosti).

**Odbrojavanje (O-49, §17).** `Odbrojavanje.preostalo(expiresAtMs, sadaMs)`: `r = expiresAtMs − sadaMs`; `r ≤ 0` → `Istekao`; inače
`s = ceil(r / 1000)` → `mm:ss` (`900 000` → „15:00”, `899 001` → „15:00”, `899 000` → „14:59”, `1` → „00:01”). Sat je ubrizgan
(`() -> Long`, u aplikaciji `System.currentTimeMillis()`); otkucaj svake sekunde u `viewModelScope` samo dok postoji aktivni voucher.
Kad voucher prvi put pređe u `Istekao`: kartica prikazuje „Voucher je istekao”, QR i „Otkaži” se sakrivaju, poziva se API-06 TAČNO jednom za taj
`voucherId` (skup već prijavljenih, u memoriji); lista se mijenja SAMO novim Firestore snapshot-om (status se nikad ne mijenja lokalno).
Greška API-06 se ne prikazuje (kao O-43). API-06 se poziva i pri svakom ON_START ekrana Nagrade ako postoji voucher prikazan kao istekao.

**Otkazivanje (API-05, §19, (s)).** „Otkaži” → dijalog „Otkazati voucher? Rezervisani bodovi se vraćaju.” [Ne] [Otkaži voucher] →
`otkaziVoucher(voucherId)` = `POST vouchers/{voucherId}/cancel`, `Content-Length: 0`, bez `Content-Type` (kao API-06). Ishodi:
`200` → „Voucher je otkazan. Bodovi su vraćeni.”; `409 VOUCHER_EXPIRED` → API-06 (jednom) + „Voucher je istekao. Bodovi su vraćeni.”;
`409 VOUCHER_ALREADY_REDEEMED` → „Voucher je već iskorišćen.”; `404 VOUCHER_NOT_FOUND` → „Voucher više ne postoji.”; `503` (poslije automatskog
ponavljanja) / mreža → poruka + „Pokušaj ponovo” (cancel je state-idempotentan, §19.2); ostalo → 6.2. U svim slučajevima stanje dolazi iz Firestore-a.

### 5.6 Obavještenja (UI-07, §21, RULE-T10, i10/P-3)

- `FirestoreIzvorObavjestenja.posmatraj(uid)`: snapshot `whereEqualTo("uid", uid).orderBy("createdAt", DESCENDING).limit(50)`; `readAt` se
  čita sa `ServerTimestampBehavior.ESTIMATE` (lokalni pending upis odmah izgleda pročitano). Prikaz: naslov (`title`), tekst (`body`), datum
  (`createdAt`: danas → „HH:mm”, inače `dd.MM.yyyy.`); nepročitano = žuta traka lijevo + podebljan naslov (prototip); bez grupisanja.
  Napomena dna: „Prikazuje se 50 najnovijih obavještenja.” Prazno: „Nema obavještenja.”
- „Otvaranje” = tap na stavku (§21.2 „otvaranje stavke”; i10/P-3): ako `readAt == null` → `oznaciProcitano(id)` =
  `update("readAt", FieldValue.serverTimestamp())` — jedino polje; ako je već pročitana → nijedan upis. ViewModel pamti ID-eve za koje je upis
  poslat, pa dvostruki tap pravi tačno jedan upis. Greška upisa se ne prikazuje (stavka ostaje nepročitana do sljedećeg tapa).
  Stavka nema poseban ekran detalja (tekst je već vidljiv u listi; tap ga samo označava pročitanim).

### 5.7 Profil (UI-08, AUTH-07, AUTH-08, AUTH-09, O-47)

`EkranProfila` (prototip 8): avatar sa prvim slovom imena, ime, Auth e-mail. Grupe:
1. **Ime za prikaz** (vrijednost, chevron) → `profil/ime`: polje sa trenutnim imenom; `ValidacijaImena` (i09, 1–100 UTF-16, bez trim-a) →
   greška `PorukeGresaka.IME`, 0 upisa; ispravno → `IzvorNaloga.promijeniIme(uid, ime)` = `users/{uid}.update(mapOf("displayName" to ime,
   "updatedAt" to FieldValue.serverTimestamp()))` (tačno ta dva polja, RULE-T04), čeka potvrdu servera najviše 10 s: uspjeh → „Ime je sačuvano.”
   i nazad (Home prikazuje novo ime iz snapshot-a); `PERMISSION_DENIED` → `IME_NEISPRAVNO`; rok → „Promjena će biti sačuvana kad veza bude dostupna.”
   Auth profil se ne mijenja (i10/P-10).
2. **E-mail** — `email()` iz Auth-a, tekst „ne može se mijenjati”, bez akcije (nije klikabilno).
3. **Promjena lozinke** → `profil/lozinka`: trenutna, nova, ponovljena (maskirane, oko 48 dp). Validacija: trenutna neprazna („Unesite trenutnu
   lozinku.”), nova §3.6 (`ValidacijaLozinke`, poruka `LOZINKA`), ponovljena jednaka (`LOZINKE_SE_NE_POKLAPAJU`) → greške = 0 Auth poziva.
   Zatim `potvrdiLozinku(trenutna)` → `promijeniLozinku(nova)`. Ishodi: uspjeh → „Lozinka je promijenjena.”; reauth `NeispravnaLozinka` /
   neispravni podaci → „Trenutna lozinka nije ispravna.”; `SlabaLozinka` → `LOZINKA`; `PrevisePokusaja` → „Previše pokušaja. Pokušajte kasnije.”;
   mreža → `MREZA`; ostalo → `OPSTA`. Sesija ostaje (nema odjave).
   Na istom ekranu link „Pošalji link za promjenu lozinke” (AUTH-09, UI-08 „ako je potrebno”) → `posaljiReset(email())` → `RESET_POSLAN` za
   uspjeh i svaku ne-mrežnu grešku (kao i09 5.3), mreža → `MREZA`.
4. **Pomoć i česta pitanja** → `profil/pomoc` (statički tekst, i10/P-1). **Uslovi korišćenja** → postojeća ruta `uslovi` (i10/P-5).
5. **Odjavi se** → `odjavi()` (`FirebaseAuth.signOut()`), bez Backend poziva i bez Firestore upisa (AUTH-07) → `prijava` sa brisanjem back stack-a.
   **Obriši nalog** (crveno) → `brisanjeNaloga` (5.8).

### 5.8 Brisanje naloga (AUTH-05, §23, API-07, O-33, O-35, O-48, (v), i10/P-6, i10/P-7)

`TokBrisanja` (domen, testabilno lažnim izvorima) — stanja: `Upozorenje` → `UnosLozinke` → `URadu` → {`Zavrseno`, `GreskaLozinke`,
`TraziPonovnuLozinku`, `MozePonoviti`}.
1. `Upozorenje` (dijalog): „Brisanje naloga je trajno. Bodovi, aktivni voucher-i i obavještenja se brišu; istorija kupovina ostaje bez veze sa
   vama. Nastaviti?” [Odustani] [Nastavi].
2. `UnosLozinke`: lozinka (prazna → „Unesite lozinku.”, 0 poziva) → `potvrdiLozinku(lozinka)`: pogrešna → `GreskaLozinke` „Lozinka nije ispravna.”;
   mreža → `MREZA`; `NepostojeciKorisnik` / `OnemogucenKorisnik` dok je brisanje već bilo pokrenuto (nastavak iz `BrisanjeUToku`) → `Zavrseno` (Auth nalog ne postoji, i10/P-7).
3. `URadu`: `ZastavicaBrisanja.ukljuci()` (od ovog trenutka API klijent odbija `inicijalizujNalog`, `uskladiVaucere`, `izdajNagradu`,
   `otkaziVoucher` bez mrežnog poziva, a Home ne zove API-06 ni ne navigira na `brisanjeUToku` — (v)); `dobaviToken(osvjezi = true)`;
   `obrisiNalog()` = `DELETE account` bez tijela (bez `Content-Type`, bez `Content-Length` tijela); oznaka `pokrenut = true`.
4. Ishodi: `204` → `odjavi()` → `Zavrseno`; `409 REAUTHENTICATION_REQUIRED` → `TraziPonovnuLozinku` (korak 2 sa porukom „Potvrdite lozinku
   još jednom.”); `401` i `pokrenut` (DELETE je u ovom toku već bio poslat, ili tok je nastavak iz `BrisanjeUToku`) → `odjavi()` → `Zavrseno` ((v));
   `401` na PRVOM DELETE-u svježeg toka → `odjavi()` → Login sa `SESIJA_ISTEKLA` (i10/P-7); `503` (poslije automatskog ponavljanja) /
   `MreznaGreska` / `500` → `MozePonoviti` „Brisanje nije završeno. Pokušajte ponovo.” + „Pokušaj ponovo” (ponovo korak 3 sa svježim tokenom;
   ako je prošlo > 5 min, Backend vraća 409 → lozinka, §23.4); ostali kodovi → `OPSTA` + „Pokušaj ponovo”.
5. `Zavrseno` → Login (back stack obrisan) sa porukom „Nalog je obrisan.” (Login prima jednokratnu poruku kroz argument rute ili
   `SavedStateHandle`); zastavica se gasi tek poslije `odjavi()`. Odustajanje u koracima 1–2 gasi zastavicu (ako je uključena) i vraća na Profil.
- `EkranBrisanjaUToku` (i10/P-6): poruka i09 + „Nastavi brisanje” (→ isti tok od koraka 2, `pokrenut = true` jer je status već DELETION_IN_PROGRESS)
  i „Odjavi se” (AUTH-07). Init se nikad ne poziva ((v), i09 5.4 nepromijenjen).

### 5.9 Backend API klijent (proširenje i09 5.6, bez nove zavisnosti)

- `posalji(metod, segmenti, tijelo?)`: URL = `baznaAdresa` + segmenti kroz `HttpUrl.Builder.addPathSegment` (rewardId / voucherId kodirani;
  ništa iz korisničkog unosa ne ulazi u URL nekodirano). `POST` sa `RequestBody`, `DELETE` bez tijela (`Request.Builder().delete()`).
- `204` → `RezultatApi.Uspjeh(Unit)` bez parsiranja; ostali `2xx` parsiraju tijelo kao u i09.
- `izdajNagradu` → `OdgovorVouchera(voucherId, rewardId, costPoints, status, issuedAt, expiresAt)` (i04/P-1; `ignoreUnknownKeys`); `otkaziVoucher`
  → isti model (+ `cancelledAt` se ignoriše); `obrisiNalog` → `Unit`. Tijela odgovora se ne koriste za stanje (5.5).
- 503 → jedan ponovni pokušaj poslije 1 000 ms za SVE endpointe (svi su idempotentni: API-03 istim `requestId`-em, API-05 stanjem, API-07 §23.4).
- Token prije svakog poziva; `obrisiNalog` dobija `osvjezi = true` (svjež `auth_time`, O-35). `ZastavicaBrisanja` provjerava se na ulazu
  (`GreskaBackenda("ACCOUNT_DELETION_IN_PROGRESS", 0)` bez mreže za zabranjene metode).
- Nema logovanja; izuzeci se ne loguju (i09 nepromijenjeno).

### 5.10 Pomoć i česta pitanja (O-47, i10/P-1 — prijedlog teksta za Anu)

Resurs `pomoc_cesta_pitanja` (statički, u `strings.xml`), naslov „Pomoć i česta pitanja”:
> **Kako dobijam bodove?** Za svaki pun litar goriva dobijate jedan bod (42,73 l = 42 boda). Pokažite svoj QR kod na kasi prije plaćanja.
> **Kada bodovi stižu?** Odmah po evidentiranju kupovine na kasi. Obavještenje o bodovima vidite u odjeljku Obavještenja.
> **Kako uzimam nagradu?** U odjeljku Nagrade izaberite dostupnu nagradu. Dobijate voucher sa posebnim QR kodom; bodovi se rezervišu.
> **Koliko važi voucher?** 15 minuta. Ako ga ne iskoristite ili ga otkažete, rezervisani bodovi se vraćaju.
> **Koja je razlika između dva QR koda?** QR kod naloga služi samo za sakupljanje bodova. Voucher QR služi samo za preuzimanje jedne nagrade.
> **Šta se dešava kad obrišem nalog?** Bodovi, voucher-i i obavještenja se brišu. Istorija kupovina ostaje bez veze sa vama. Brisanje se ne može poništiti.
> **Kontakt** FuelPoints je diplomski projekat (PMF Banja Luka) i nema korisničku podršku.

## 6. Ugovor sa Backend-om (bez izmjene; README)

### 6.1 Endpointi

API-03 `POST /api/v1/rewards/{rewardId}/issue`, Bearer, tijelo tačno `{ requestId }` (UUID v4 malim slovima, O-15) → `201` novi / `200` retry
`{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt }` (i04/P-1); greške `401`, `404 REWARD_NOT_FOUND`, `404 NOT_FOUND`,
`409 ACCOUNT_NOT_INITIALIZED`, `409 ACCOUNT_DELETION_IN_PROGRESS`, `409 REWARD_INACTIVE`, `409 INSUFFICIENT_POINTS`, `409 IDEMPOTENCY_CONFLICT`,
`422 INVALID_REQUEST`, `500`, `503` („klijent ponavlja ISTIM `requestId`”).
API-05 `POST /api/v1/vouchers/{voucherId}/cancel`, bez tijela → `200` (prvi i ponovljeni, i05/P-1); `401`, `403 FORBIDDEN`, `404 VOUCHER_NOT_FOUND`,
`404 NOT_FOUND`, `409 VOUCHER_EXPIRED`, `409 VOUCHER_ALREADY_REDEEMED`, `409 ACCOUNT_*`, `422`, `500`, `503`.
API-06 kao i09. API-07 `DELETE /api/v1/account`, bez tijela → `204` (O-33); `401`, `409 REAUTHENTICATION_REQUIRED` (O-35), `422`, `500`, `503`;
ponovljen DELETE poslije brisanja Auth naloga → `401` (i07/P-8).

### 6.2 Poruke po §27 kodu (`PorukeGresaka`, dopuna i09)

| Kod | Poruka |
|---|---|
| `INSUFFICIENT_POINTS` | „Nemate dovoljno bodova za ovu nagradu.” |
| `REWARD_INACTIVE`, `REWARD_NOT_FOUND` | „Ova nagrada trenutno nije dostupna.” |
| `IDEMPOTENCY_CONFLICT` | „Zahtjev nije moguće ponoviti. Pokušajte ponovo.” (novi tap → novi `requestId`) |
| `VOUCHER_EXPIRED` | „Voucher je istekao. Bodovi su vraćeni.” |
| `VOUCHER_ALREADY_REDEEMED` | „Voucher je već iskorišćen.” |
| `VOUCHER_CANCELLED` | „Voucher je već otkazan.” (API-05 ga ne vraća — §19.2; samo potpunost) |
| `VOUCHER_NOT_FOUND` | „Voucher više ne postoji.” |
| `REAUTHENTICATION_REQUIRED` | „Potvrdite lozinku još jednom.” |
| `ACCOUNT_DELETION_IN_PROGRESS` | tok `brisanjeUToku` (poruka i09) |
| `ACCOUNT_NOT_INITIALIZED` | tok AUTH-03 (`pokretanje`), bez poruke |
| `UNAUTHENTICATED` | `SESIJA_ISTEKLA` → `prijava` (osim 5.8 korak 4) |
| `SERVICE_UNAVAILABLE` | `SERVIS_NEDOSTUPAN` + „Pokušaj ponovo” |
| `FORBIDDEN`, `INVALID_REQUEST`, `NOT_FOUND`, `INTERNAL_ERROR`, nepoznat / `null` | `OPSTA` |

Dodatne poruke tokova (konstante, I10-T doslovno): „Voucher je izdat. Pokažite QR kod na kasi.”, „Voucher je otkazan. Bodovi su vraćeni.”,
„Ime je sačuvano.”, „Promjena će biti sačuvana kad veza bude dostupna.”, „Unesite trenutnu lozinku.”, „Trenutna lozinka nije ispravna.”,
„Previše pokušaja. Pokušajte kasnije.”, „Lozinka je promijenjena.”, „Unesite lozinku.”, „Lozinka nije ispravna.”,
„Brisanje nije završeno. Pokušajte ponovo.”, „Nalog je obrisan.”

## 7. Koraci implementacije (jedan korak = jedan commit + push; testovi prije koda; O-30 (a): `provjera.ps1` tačno 2×)

Gradle iz `android-app` sa `$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'`.

| K | Sadržaj | Commit |
|---|---|---|
| K1 | I10-T11 (MockWebServer) i I10-T15 (statička, uključujući indekse) prije koda → crveni; `BackendApi` proširenje (5.9), `IzvorAutentikacije` / `IzvorNaloga` dopune, novi izvori (kupovine, nagrade, obavještenja), `firestore.indexes.json` (5.3); zeleni. | `i10: API klijent (API-03, API-05, API-07), izvori podataka i Firestore indeksi` |
| K2 | I10-T01 … T10, T12 … T14 prije koda → crveni; `domen/*` (generator, pokušaj, odbrojavanje, prikaz, prihvatljivost, tok brisanja, zastavica, poruke) i ViewModel-i; zeleni. | `i10: tokovi Nagrada, Istorije, Obavještenja i Profila u ViewModel-ima (I10-T01 … T14)` |
| K3 | Ekrani, donja navigacija, zvono, `EkranBrisanjaUToku` akcije, ikone, FAQ tekst (odobren), Login poruka „Nalog je obrisan.”; ručna provjera na emulatoru; **`provjera.ps1` #1**. | `i10: ekrani Istorija, Nagrade, Obavještenja i Profil (UI-05 … UI-08)` |
| K4 | `docs/smoke/i10_smoke.md` (S1 … S20), README (Android ekrani, tok smoke-a); **`provjera.ps1` #2 (završni)** na commit-u koda X; Builder traži od Ane smoke i screenshot-e. | `i10: protokol smoke-a i README (O-31 (d))` |
| K5 | Screenshot-i `docs/smoke/i10_login.png`, `i10_home.png`, `i10_qr.png`, `i10_nagrade_voucher.png`; TEST_REPORT (testovi po ID-u, oba `provjera.ps1`, commit X, smoke Ane), TRACEABILITY, ODLUKE (§1: i09 ACCEPTED tag `i09` merge `7dab954`, i10 status; O-46 … O-50; i10/P-n; §7 ograničenja iz sekcije 11), IMPLEMENTATION_LOG. PR → `main` bez merge-a. | `i10: TEST_REPORT, smoke, sljedivost i registar odluka` |

Ako Ana prijavi FAIL u smoke-u: ispravka u novom commit-u koda; ponovljeni `provjera.ps1` se računa kao #2 samo ako je prvi #2 poništen izmjenom
koda — Builder bilježi OD-n (kao i09).

## 8. Testovi (JVM, `testDebugUnitTest`; ulaze u `provjera.ps1`)

Konvencije kao i09 8: JUnit 4, `runTest` + `StandardTestDispatcher`, `Dispatchers.setMain`; lažni izvori u `src/test/…/lazni/` (proširenje
`LazniIzvorAutentikacije`, `LazniIzvorNaloga`, `LazniBackendApi` + novi `LazniIzvorKupovina`, `LazniIzvorNagrada`, `LazniIzvorObavjestenja`,
`LazniGeneratorZahtjeva`, lažni sat) broje pozive i čuvaju argumente. Naziv svake test klase / metode počinje ID-em.

| ID | SRS / odluka | Asercije |
|---|---|---|
| I10-T01 | §13, O-15 | `GeneratorZahtjeva`: 1 000 vrijednosti — svaka odgovara `^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`, sve različite. |
| I10-T02 | §13, §14, O-16, O-50, i10/P-2 | `NagradeViewModel` + lažni API: 503 → „Pokušaj ponovo” šalje ISTI `requestId`; isto za `MreznaGreska`, `500`, `kod = null`; poslije `201` / `200` / 409 (`INSUFFICIENT_POINTS`, `REWARD_INACTIVE`, `IDEMPOTENCY_CONFLICT`) / 404 / 422 sljedeći tap → NOV `requestId`; nezavršen pokušaj za CAR_WASH pa tap na SHOWER → nov `requestId` za SHOWER; dijalog „Odustani” → 0 poziva i 0 generisanih ID-eva; dok zahtjev traje, drugi tap → 0 dodatnih poziva. |
| I10-T03 | UI-06, §12, (i) | Katalog: `active=false` skriven; `costPoints` 0 / −1 / 1.5 / string skriven; `displayName` ne-string skriven; redoslijed po `costPoints`. Eligibility: 72 → CAR_WASH (50) i SHOWER (30) dostupne; 42 → SHOWER dostupna, CAR_WASH „nedostaje 8 bodova”; 50 = 50 dostupna; `null` → nijedna + `STANJE_NEDOSTUPNO`; tap na nedostupnu → 0 dijaloga / poziva. Oblik riječi: 1 bod, 2 / 22 / 42 boda, 0 / 5 / 11 / 12 / 111 bodova. |
| I10-T04 | §17, O-49 | `Odbrojavanje`: 900 000 → „15:00”; 899 001 → „15:00”; 899 000 → „14:59”; 60 000 → „01:00”; 1 → „00:01”; 0 → `Istekao`; −1 → `Istekao`. ViewModel (virtuelni sat): prelaz u `Istekao` → TAČNO jedan API-06 za taj voucher i dalje tačno jedan poslije još 10 s; lista i status se mijenjaju tek novim snapshot-om lažnog izvora (bez snapshot-a voucher ostaje u listi kao „istekao”); otkucaj nema kad nema voucher-a. |
| I10-T05 | §27, 6.2 | `PorukeGresaka.zaKod` za sve kodove tabele 6.2 doslovno; nepoznat / `null` → `OPSTA`; nijedna poruka ne sadrži `voucherId` / UID iz ulaza. |
| I10-T06 | §19, (s), O-5 | Cancel: `200` → poruka otkazan, 0 API-06; `409 VOUCHER_EXPIRED` → tačno 1 API-06 + poruka istekao; `VOUCHER_ALREADY_REDEEMED`, `VOUCHER_NOT_FOUND` → poruke; 503 / mreža → „Pokušaj ponovo” ponavlja cancel za isti voucher; dijalog „Ne” → 0 poziva; `409 ACCOUNT_DELETION_IN_PROGRESS` → događaj `brisanjeUToku`. |
| I10-T07 | UI-05, (e) | `IstorijaViewModel` + lažni izvor: prvi poziv `kursor = null`; dugme vidljivo tačno kad izvor vrati `sljedeciKursor`; „Učitaj starije” šalje kursor posljednje stranice; stranice se nadovezuju bez duplikata i redom; dvostruki tap dok traje učitavanje → 1 poziv; greška druge stranice → prva ostaje + poruka, „Pokušaj ponovo” šalje isti kursor; prazna stranica → dugme nestaje. |
| I10-T08 | UI-05, §8.3 | `Prikaz`: 42 730 → „42,73 l”; 42 735 → „42,735 l”; 30 000 → „30,00 l”; 1 → „0,001 l”; 6 837 + „EUR” → „68,37 EUR”; 0 → „0,00 EUR”; datum `2026-10-06T06:12Z` u zoni `Europe/Sarajevo` → „06.10.2026. 08:12”; dokument bez `earnedPoints` → preskočen (izvorni maper, čista funkcija nad mapom). |
| I10-T09 | UI-07, §21.2, RULE-T10, i10/P-3 | `ObavjestenjaViewModel`: tap na nepročitanu → tačno 1 `oznaciProcitano(id)`; dvostruki tap → 1; tap na pročitanu → 0; redoslijed i broj stavki = izvor (do 50); prikaz nepročitano / pročitano prati `readAt`. |
| I10-T10 | UI-08, §25.2, RULE-T04, i02/P-3 | `ImeViewModel`: `""`, 101 znak, usamljeni surogat → poruka, 0 upisa; „Ana S.” → tačno 1 `promijeniIme(uid, "Ana S.")`; odbijeno → `IME_NEISPRAVNO`; rok → poruka veze. `LozinkaViewModel`: prazna trenutna / nova bez cifre / bez A–Z / 7 znakova / nepoklapanje → 0 reauth poziva; ispravno → redoslijed `potvrdiLozinku(trenutna)` → `promijeniLozinku(nova)`; pogrešna trenutna → poruka, 0 `promijeniLozinku`; slaba (Firebase) → `LOZINKA`; reset link → `posaljiReset(email())` i `RESET_POSLAN` za uspjeh i ne-mrežnu grešku. |
| I10-T11 | API-03, API-05, API-07, §3.3, O-15, O-21, O-33, (s), R-04 | MockWebServer: API-03 — `POST /api/v1/rewards/CAR_WASH/issue`, `Bearer <token>`, `Content-Type: application/json`, tijelo parsirano = TAČNO `{requestId}` (bez `uid`, `costPoints`…); `201` i `200` parsirani; `503`,`201` → 2 zahtjeva sa ISTIM tijelom; rewardId `A/B` → kodiran segment `A%2FB`. API-05 — `POST /api/v1/vouchers/<64 hex>/cancel`, `Content-Length: 0`, bez `Content-Type`; `200` parsiran. API-07 — `DELETE /api/v1/account`, bez tijela (`bodySize == 0`), `Bearer`; `204` → `Uspjeh(Unit)`; `409 REAUTHENTICATION_REQUIRED` → `GreskaBackenda`; `obrisiNalog` traži token sa `osvjezi = true`. Zastavica uključena → `izdajNagradu` / `otkaziVoucher` / `inicijalizujNalog` / `uskladiVaucere` → 0 zahtjeva ka serveru. |
| I10-T12 | AUTH-05, §23.4, API-07, O-48, (v), i10/P-6, i10/P-7 | `TokBrisanja`: Upozorenje „Odustani” → 0 poziva; prazna lozinka → 0 reauth; pogrešna lozinka → poruka, 0 DELETE; `204` → `odjavi` 1× → `Zavrseno`; `409 REAUTH` → `TraziPonovnuLozinku`, nova lozinka → drugi DELETE → `204`; `503` → `MozePonoviti`, ponavljanje → 2. DELETE; mreža pa `401` → `Zavrseno` (pokrenut); `401` na prvom DELETE-u → `SESIJA_ISTEKLA`; nastavak iz `BrisanjeUToku` + `401` → `Zavrseno`; nastavak + reauth `NepostojeciKorisnik` → `Zavrseno`, 0 DELETE; za sve vrijeme toka: 0 poziva init-a i API-06 (`LazniBackendApi` brojač). |
| I10-T13 | AUTH-07, AC-01, AC-02 | Odjava (Profil i `BrisanjeUToku`): `odjavi` 1×, 0 Backend poziva, 0 Firestore upisa (brojači lažnih izvora); događaj navigacije na `prijava`. |
| I10-T14 | UI-03, O-43, O-46, (v) | Regresija i09-T09 + `PocetnaViewModel`: zastavica brisanja uključena → `priOtvaranju()` 0 API-06 i snapshot `DELETION_IN_PROGRESS` ne emituje `BrisanjeUToku`; isključena → ponašanje i09 (1 API-06 po otvaranju). |
| I10-T15 | NFR-07, (h), §2.2, AC-02, (e), (i), O-45 | Statička provjera (proširenje I09-T12): u `src/main` nema `Log.`, `println`, `printStackTrace`, `HttpLoggingInterceptor`; Firestore upisi (`.set(`, `.update(`, `.delete(`, `.add(`, `runTransaction`, `batch(`) postoje SAMO u `FirestoreIzvorNaloga.promijeniIme` (ključevi tačno `displayName`, `updatedAt`) i `FirestoreIzvorObavjestenja.oznaciProcitano` (ključ tačno `readAt`); svaki `collection("purchases"/"notifications"/"vouchers")` upit ima `whereEqualTo("uid"` i `limit(` ≤ 20 / 50 / 20; `firebase/firestore.indexes.json` sadrži tačno tri indeksa iz 5.3; Gradle zavisnosti nepromijenjene u odnosu na i09 (lista iz `libs.versions.toml`); manifest: jedina dozvola `INTERNET`. |
| I10-T16 | NFR-10, NFR-09 | Inspekcija u smoke-u (S17, S18) — Compose UI testovi su van opsega. |

Regresija: I09-T01 … T12 i backend / Rules suite kroz `provjera.ps1` (nepromijenjeni).

## 9. Ključne mutacije

Nema (O-31 (c): Android iteracije bez mutacija).

## 10. Definition of Done (komande iz korijena, PowerShell)

```
cd android-app; $env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'; .\gradlew.bat assembleDebug testDebugUnitTest checkDebugAarMetadata; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE                                   # 0, tačno 2× u sesiji
git diff i09 -- backend firebase/firestore.rules firebase.json docs/srs skripte/provjera.ps1   # prazno
git diff i09 -- android-app/gradle/libs.versions.toml android-app/app/build.gradle.kts           # prazno (nema novih zavisnosti)
git ls-files | Select-String -Pattern 'google-services\.json|\.env$|service-?account'               # prazno
git grep -n -E 'android\.util\.Log|Log\.[dviwe]\(|println\(' -- android-app/app/src/main               # prazno
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash   # 7D866413…C60228
git log i09..HEAD --format=%B | Select-String -Pattern 'Co-Authored|Claude|Generated'                  # prazno
```

[ ] I10-T01 … I10-T15 i I09-T01 … T12 zeleni. [ ] Smoke S1 … S20 PASS (Ana, API 35) u TEST_REPORT. [ ] Screenshot-i za Sliku 4 u `docs/smoke/`.
[ ] Dokumentacija (K5). [ ] PR bez merge-a.

### Smoke protokol (`docs/smoke/i10_smoke.md`, emulator API 35, debug APK, `.\skripte\pokreniLokalno.ps1`)

S1 Registracija „Ana” / ana@primjer.ba / „Lozinka1” → Home „Zdravo, Ana”, 0, donja navigacija sa 5 stavki, zvono. S2 POS kupovine 42 730 ml i
30 000 ml (PowerShell blok iz i09, dva `posTransactionId`) → Home 72. S3 Istorija: 2 stavke, novija prva, „30,00 l”, iznos + EUR, „+30” / „+42”;
nema „Učitaj starije”. S4 (paginacija) skripta sa još 20 kupovina po 1 000 ml → Istorija 20 stavki + „Učitaj starije” → 22 ukupno, dugme nestaje.
S5 Nagrade: bodovi u zaglavlju; CAR_WASH (50) i SHOWER (30) „dostupno” (sa 92 boda poslije S4 — oba). S6 Izdaj CAR_WASH → dijalog → Izdaj →
poruka; aktivni voucher sa QR-om i „Važi još 15:00 → 14:59 …”; Home: dostupno −50, „Rezervisano 50”. S7 screenshot Nagrade sa voucher-om.
S8 Otkaži → dijalog → poruka; voucher nestaje; Home bez „Rezervisano”, bodovi vraćeni. S9 (opciono, 15 min) izdaj SHOWER i sačekaj 0:00 →
„Voucher je istekao”, poslije API-06 nestaje, bodovi vraćeni. S10 Obavještenja (zvono): broj = broj kupovina, novija prva, nepročitane sa žutom
trakom; tap → traka nestaje; zatvoriti i otvoriti ekran → ostaje pročitana. S11 Profil: ime, e-mail „ne može se mijenjati”; Ime za prikaz →
„Ana S.” → Home „Zdravo, Ana S.”; 101 znak → poruka. S12 Promjena lozinke: pogrešna trenutna → poruka; „Lozinka2” → „Lozinka je promijenjena.”;
link za reset → neutralna poruka. S13 Pomoć i česta pitanja i Uslovi korišćenja se otvaraju i vraćaju nazad. S14 Odjavi se → Login; „nazad” ne vraća
u aplikaciju; prijava sa „Lozinka2” → Home (AC-01). S15 Obriši nalog: Odustani → ništa; pogrešna lozinka → poruka; tačna → Login „Nalog je
obrisan.”; prijava istim podacima → poruka §3.5. S16 tamni režim sistema → ekrani 5–8 u tamnoj temi. S17 Layout Inspector (NFR-10): stavke
navigacije, zvono, QR, Otkaži, chevron redovi, „Učitaj starije”, oko lozinke ≥ 48 dp; ikone bez teksta imaju `contentDescription`. S18 NFR-09
lista na API 35: login, Home, QR, purchases, reward, notifications, Settings/logout — zbirno PASS/FAIL. S19 Logcat filtriran po paketu: nema
tokena (`Bearer`), `voucherId`-a (64 hex), UID-a ni e-maila iz koda aplikacije (SDK nalaz i09/K-3 se bilježi, ne ruši smoke). S20 screenshot-i
Login, Home (72 boda), Moj QR → `docs/smoke/`.

## 11. Rizici i poznata ograničenja

- Proba 3.2 je rađena JS SDK-om nad istim emulatorima i pravilima; Kotlin `whereEqualTo/orderBy/startAfter/limit`, `ServerTimestampBehavior.ESTIMATE`
  i `reauthenticate` na uređaju prvi put potvrđuju K3 i smoke (S3, S4, S10, S12, S15).
- Composite indeksi se nad emulatorom ne provjeravaju (3.2 (a)); pogrešan indeks bi se vidio tek u i11 nad pravim projektom (I10-T15 provjerava oblik).
- Odbrojavanje koristi lokalni sat samo za prikaz (§17, O-49): ako sat uređaja žuri, voucher se prikazuje kao istekao dok je na serveru još
  ACTIVE (POS ga može otkupiti); API-06 tada ne mijenja ništa i voucher ostaje „istekao” do sljedećeg ON_START-a / snapshot-a. Ako sat kasni,
  prikaz može pokazati > 15:00 — prikazuje se stvarna razlika, bez sječenja.
- `requestId` živi u ViewModel-u: gašenje aplikacije poslije 503 napušta logički pokušaj; ako je Backend ipak izdao voucher, on je vidljiv u listi
  aktivnih i može se otkazati — novi tap pravi novi `requestId` (nova rezervacija ako korisnik to izabere).
- Izmjena imena bez mreže: Firestore upis čeka u redu; poslije 10 s poruka „…kad veza bude dostupna” (upis se šalje kasnije; Rules ga tada provjeravaju).
- Emulator nema password policy (3.2 (c)): slabu novu lozinku zaustavlja samo klijent do i11 (O-2).
- Firebase Auth SDK loguje e-mail / UID (i09/K-3) — nepromijenjeno; R8 pravilo u i11.
- Prikaz valute: kod iz dokumenta (`EUR`), bez lokalizovanog simbola; iznos pretpostavlja 2 decimale (EUR, §8.4 whitelist).

## 12. TRACEABILITY redovi (Builder popunjava „Status”)

| Red | Kod | Test |
|---|---|---|
| UI-03 (ulazi), O-46 | `ui/komponente/DonjaNavigacija.kt`, `ui/pocetna/*`, `ui/navigacija/*` | I10-T14, smoke S1, S18 |
| UI-05, §25.4, (e) | `ui/istorija/*`, `podaci/kupovine/*`, `domen/Prikaz.kt` | I10-T07, T08, T15, smoke S3, S4 |
| UI-06, §12, §13, §14 (klijent), O-15, O-16, O-50 | `ui/nagrade/*`, `domen/GeneratorZahtjeva.kt`, `PokusajIzdavanja.kt`, `Prihvatljivost.kt`, `podaci/nagrade/*`, `podaci/api/*` | I10-T01, T02, T03, T11, smoke S5, S6 |
| §17, O-49, §18 (klijent) | `domen/Odbrojavanje.kt`, `ui/nagrade/NagradeViewModel.kt` | I10-T04, smoke S6, S9 |
| §19 (klijent), (s) | `ui/nagrade/*`, `podaci/api/*` | I10-T06, T11, smoke S8 |
| UI-07, §21, RULE-T10 (klijent) | `ui/obavjestenja/*`, `podaci/obavjestenja/*` | I10-T09, T15, smoke S10 |
| UI-08, §25.2, RULE-T04 (klijent) | `ui/profil/*`, `podaci/nalog/*` | I10-T10, T15, smoke S11, S13 |
| AUTH-07, AC-01 (logout) | `ui/profil/ProfilViewModel.kt`, `ui/pokretanje/EkranBrisanjaUToku.kt`, `podaci/autentikacija/*` | I10-T13, smoke S14 |
| AUTH-08, §3.6 (klijent) | `ui/profil/LozinkaViewModel.kt`, `podaci/autentikacija/*` | I10-T10, smoke S12 |
| AUTH-09 (Profil) | `ui/profil/LozinkaViewModel.kt` | I10-T10, smoke S12 |
| AUTH-05, §23 (klijent), API-07, O-48, (v) | `domen/TokBrisanja.kt`, `domen/ZastavicaBrisanja.kt`, `ui/profil/EkranBrisanjaNaloga.kt`, `podaci/api/*` | I10-T11, T12, T14, smoke S15 |
| §27 (klijent, Rewards / cancel / delete) | `domen/PorukeGresaka.kt` | I10-T05 |
| §2.2, AC-02 (Android ne mijenja bodove) | samo dva upisa (5.6, 5.7) | I10-T13, T15, RULE-T04 … T10 |
| NFR-07, (h) | bez logovanja; `voucherId` samo u QR-u | I10-T15, smoke S19 |
| NFR-09 (API 35 dio) | — | smoke S18 |
| NFR-10 | `ui/*` | I10-T16 (smoke S17) |
| O-47 | `res/values/strings.xml` `pomoc_cesta_pitanja` | smoke S13 |
| ODLUKE (e), (i) — indeksi | `firebase/firestore.indexes.json` | I10-T15 |

## 13. Otvorena pitanja (`i10/P-n`)

SRS nije kontradiktoran u opsegu i10; izmjena Backend-a i `firestore.rules` nije potrebna (proba 3.2). Nejasnoće i izbori koji traže odluku:

**i10/P-1 — tekst Pomoći i čestih pitanja (O-47; Ana odobrava).** Prijedlog je u 5.10 (7 stavki: bodovi, kada stižu, nagrada, 15 min, dva QR
koda, brisanje naloga, kontakt = „diplomski projekat”). **Preporuka:** odobriti kako stoji (ili Ana ispravlja tekst pri odobrenju).

**i10/P-2 — da li je `500 INTERNAL_ERROR` (i odgovor bez §27 tijela) konačan za API-03?** O-50 kaže „konačan: 201/200/409/4xx; 503 ili
mrežna → isti `requestId`”; `500` nije naveden. §13: „retry istog logičkog zahtjeva mora ponovo koristiti isti requestId”.
A) `500` i nečitljiv odgovor = NEZAVRŠEN (isti `requestId` pri „Pokušaj ponovo”): ishod je nepoznat, a retry je bezbjedan (O-16 — isti voucher, bez nove rezervacije).
B) `500` = konačan (sljedeći tap → novi `requestId`): ako je transakcija ipak upisana prije greške, korisnik može dobiti drugu rezervaciju.
**Preporuka: A.**

**i10/P-3 — šta je „otvaranje” obavještenja (UI-07, §21.2).** §21.2: „Otvaranje STAVKE postavlja readAt”.
A) Tap na pojedinačnu stavku → `readAt` samo za nju (lista prikazuje i tekst; nema ekrana detalja).
B) Otvaranje ekrana označava sve prikazane kao pročitane (do 50 upisa).
**Preporuka: A** (doslovno §21.2; jedan upis po akciji korisnika). Brief primjer smoke-a („otvaranje postavlja readAt”) se čita kao tap na stavku (S10).

**i10/P-4 — oblik ulaza na Home-u (O-46) i elementi prototipa van SRS-a.**
A) Donja navigacija iz prototipa (Početna · Istorija · QR centralno · Nagrade · Profil) + zvono na Home-u za Obavještenja; veliko dugme „Moj QR kod”
iz i09 se uklanja (QR je u navigaciji). Ne prave se: mjerač sa pragovima, „Do pranja”, „Imate dovoljno za…”, „Posljednja točenja”, mjesečni
zbir na Istoriji, crvena tačka nepročitanih na zvonu, kopiranje UID-a (§1.3).
B) Kao A, ali dugme „Moj QR kod” na Home-u ostaje (dva ulaza na QR).
C) Kartice na Home-u umjesto donje navigacije.
**Preporuka: A** (prototip; najmanje odstupanje; SRS ništa od izostavljenog ne traži).

**i10/P-5 — red „Uslovi korišćenja” na Profilu (prototip 8).** UI-08 ga ne navodi; ekran `uslovi` postoji od i09 (AUTH-10, O-44).
A) Red otvara postojeći ekran (nova ruta nije potrebna, nova funkcija ne nastaje). B) Bez reda. **Preporuka: A.**

**i10/P-6 — akcije na ekranu „Nalog se briše” (`BrisanjeUToku`).** i09 ga je ostavio bez akcije (ODLUKE §7). AUTH-05 / §23.4: ponovljen DELETE
nastavlja brisanje; O-48: 503 → mogućnost ponavljanja. Ako aplikacija bude ugašena poslije 503, korisnik pri sljedećem pokretanju završava ovdje.
A) Dugmad „Nastavi brisanje” (tok 5.8 od unosa lozinke) i „Odjavi se” (AUTH-07). B) Samo „Odjavi se”. **Preporuka: A.**

**i10/P-7 — tumačenje `401` na DELETE i nepostojećeg Auth naloga pri reauth-u ((v), O-48).**
A) `401` = brisanje završeno kad je DELETE u tom toku već bio poslat ILI je tok nastavak iz `BrisanjeUToku`; `401` na prvom DELETE-u svježeg
toka sa Profila = istekla sesija („Sesija je istekla. Prijavite se ponovo.”). U nastavku iz `BrisanjeUToku`, reauth sa ishodom „korisnik ne
postoji / onemogućen” = završeno. U svim slučajevima `signOut` → Login.
B) Svaki `401` na DELETE = „Nalog je obrisan.” (jednostavnije, ali može pogrešno javiti brisanje kad je sesija samo istekla).
**Preporuka: A.**

**i10/P-8 — dijalog potvrde za izdavanje i otkazivanje (nema ga u prototipu).** Izdavanje rezerviše bodove, otkazivanje ih vraća; slučajan tap
je moguć. A) Dijalog za oba; `requestId` se pravi na tap „Izdaj” u dijalogu (O-50 „prvi tap Izdaj”). B) Bez dijaloga — tap na karticu odmah
izdaje. **Preporuka: A.**

**i10/P-9 — redoslijed aktivnih voucher-a i indeks.** A) `orderBy('expiresAt','asc')` + composite indeks (uid, status, expiresAt) — sa `limit 20`
deterministički se prikazuju voucher-i koji prvi ističu. B) Bez `orderBy` (bez indeksa), sortiranje u aplikaciji — kod > 20 aktivnih nije
određeno kojih 20 se vidi. **Preporuka: A.**

**i10/P-10 — izmjena imena: samo Firestore ili i Auth profil?** UI-08 / §25.2 traže `users/{uid}`; Auth `displayName` služi samo AUTH-03 ponovnom
init-u prije postojanja `users` (i09/P-3). A) Samo `users/{uid}` (`displayName` + `updatedAt`); rok potvrde 10 s, poslije toga poruka o kasnijem slanju.
B) I `updateProfile` u Auth-u (dva izvora istine, nije traženo). **Preporuka: A.**

**i10/P-11 (informativno) — format prikaza Istorije.** Litri sa 2–3 decimale bez gubitka (42 730 → „42,73 l”, 42 735 → „42,735 l”), iznos
`amountMinor/100` + kod valute („68,37 EUR”), datum `dd.MM.yyyy. HH:mm` u zoni uređaja. Preporuka: prihvatiti.

**Procjena (Builder):** K1 1,5 h, K2 2,5 h, K3 3–3,5 h, K4 0,5 h + `provjera.ps1` 2× (~2 × 12 min), K5 0,5–1 h → **~8,5–9,5 h** rada +
smoke Ane ~45 min (S9 opciono +15 min).

## 14. Odluke Orchestrator-a (odobrenje plana)

