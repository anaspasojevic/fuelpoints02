# FuelPoints — registar odluka

Jedan pregled svih odluka, ograničenja, backlog-a i otvorenih pitanja, da predaja između razgovora bude kratka.
Normativni izvor je i dalje samo SRS 3.1 (`docs/srs/FuelPoints_SRS_3_1.docx`); registar ga ne mijenja i ne tumači šire od
navedenih odluka. Detalji i obrazloženja su u sekcijama „Odluke Orchestrator-a” planova (`docs/iteracije/iNN_plan.md`),
u brief-ovima (`docs/iteracije/iNN_brief.md`) i u `docs/IMPLEMENTATION_LOG.md`.

Vođenje: nove stavke dodaje Orchestrator (uz brief ili odobrenje plana), a Builder ih upisuje u dokumentacionom koraku iteracije.
Postojeće stavke se ne brišu; promjena se upisuje kao nova stavka koja navodi šta zamjenjuje.
Oznake: **O-n** odluka Ane (autor SRS-a); **D-n** odluka Orchestrator-a; **iNN/P-n** odluka iz plana iteracije NN;
**K-n** ispravka plana; ograničenja **(a)…**; backlog po oznaci review-a.

## 1. Stanje iteracija

| Iteracija | Status | Checkpoint |
|---|---|---|
| i01 Bootstrap i test infrastruktura | ITERATION ACCEPTED | tag `i01` (commit `dabe3c0`) |
| i02 Account lifecycle + auth boundary | ITERATION ACCEPTED | tag `i02` (merge `700b155`) |
| i03 Purchase / EARN | ITERATION ACCEPTED | tag `i03` (merge `43e604a`, PR #3) |
| i04 Reward issue | review: ITERATION REJECTED (R-01, R-02); FIX LOOP 1 završen; re-review: ITERATION REJECTED (R-06, R-05); FIX LOOP 2 završen, čeka ponovni review | grana `iteracija-04` (PR → main, bez merge-a i taga) |
| i05 – i11 | nije počelo | — |

## 2. Odluke Ane (O-n)

| ID | Odluka | Od | Gdje |
|---|---|---|---|
| O-1 | Van §27 uvode se samo `NOT_FOUND` 404 (nepoznata ruta / nepodržan metod) i `INVALID_REQUEST` 422 (neispravan JSON body, nevalidan `requestId`, `redemptionRequestId`, `acceptedTermsVersion`). Drugi kodovi se ne uvode. | i01 | TRACEABILITY, CLAUDE.md |
| O-3 | Ponovljena kupovina sa drugim `occurredAt` → prvi rezultat; `occurredAt` nije dio poređenja §10. | i03 | i03_brief |
| O-4 | Kupovina sa 0 bodova pravi sva četiri zapisa (purchase, balance update, EARN sa delta 0, notifikacija). | i03 | i03_brief |
| O-10 | POS kupovina za UID bez ACTIVE naloga (users ACTIVE + loyaltyAccounts) → 404 `LOYALTY_ACCOUNT_NOT_FOUND`. | i03 | i03_brief |
| O-11 | `acceptedTermsVersion` = `VERZIJA_USLOVA` iz konfiguracije (`"1.0"`). | i02 | i02_brief |
| O-12 | U transakciji kupovine prvo se čita postojeća kupovina (idempotency), pa tek onda nalog; retry iste kupovine kad nalog više nije ACTIVE → prvi rezultat; nova kupovina za takav nalog → 404. | i03 | i03_brief |
| O-13 | `stationId` u konfiguraciji `^[A-Za-z0-9.-]{1,32}$` (bez `_`), zbog jednoznačnosti `{stationId}__{posTransactionId}`; purchase čiji `stationId`/`posTransactionId` ne odgovara ID-u → 500. | i03 | i03_brief |
| O-14 | Interni reconcile isteklih voucher-a ide u ISTU transakciju kao reward issue, redoslijedom §13.1 (nalog → reward postoji → active → reconcile → bodovi); kad issue padne na `INSUFFICIENT_POINTS`, release-i se commit-uju, pa 409 (obrazac §20.5). Status: implementirano u i04 (`servisi/izdavanjeNagrade.js`), I04-T09 (e), I04-T11 (c). | 2026-10-17, i04 | i04_brief |
| O-15 | `requestId` (§13) je samo kanonski UUID v4 malim slovima; velika slova i svaki drugi oblik → 422 `INVALID_REQUEST`. Status: implementirano u i04 (`validacija/zahtjevIzdavanja.js`), I04-T02. | 2026-10-17, i04 | i04_brief |
| O-16 | Reward issue: `rewardRequests` mapping se provjerava PRIJE preduslova §13.1 (analogno O-12); retry istog `(uid, requestId)` za isti reward vraća isti voucher i ništa ne upisuje, bez obzira na stanje naloga, nagrade, bodova i voucher-a; drugi reward → 409 `IDEMPOTENCY_CONFLICT`. Status: implementirano u i04, I04-T07, I04-T08. | 2026-10-17, i04 | i04_brief |

## 3. Odluke Orchestrator-a (D-n)

| ID | Odluka | Od |
|---|---|---|
| D-1 | Interni reconcile isteklih voucher-a (§18.1) ide u Iteraciju 4 (preduslov §13.1); endpoint API-06 i cancel u Iteraciju 5. | prije i04 |
| D-2 | Security Rules se uvode postepeno, doslovno iz §31, u iteraciji u kojoj kolekcija nastaje: users, loyaltyAccounts (i02); purchases, loyaltyLedger, notifications (i03); rewardDefinitions, vouchers, rewardRequests (i04); redemptionRequests (i06); i08 je završni lockdown 12/12. | i01 |
| D-3 | Log greške bilježi šablon pogođene rute (npr. `/pos/purchases`) ili `(nepoznata ruta)`, nikad sirovu putanju, query, zaglavlja ni tijelo (tajne iz URL-a ne smiju u log). | i03 FIX LOOP 1 (R-04) |
| D-4 | `rewardId` iz putanje se provjerava općom provjerom ID-a (tehnika, tačka 5) prije upotrebe kao putanja; neispravan → 404 `REWARD_NOT_FOUND` bez pristupa bazi. Status: implementirano u i04 (`validacija/identifikator.js` + zabrana kontrolnih znakova, i04/P-9), I04-T03 (a), (b). | i04 brief |
| O-17 (Orchestrator) | Odgovor na review i04 P-1 / R-03: tehnika `tx.get(query)` nad `vouchers` se ZADRŽAVA (brief i04, tačka 5); opcija B (upit van transakcije + `tx.getAll` kandidata) se NE uvodi. Ispravlja se samo dokumentovano ograničenje (kontencija i RAZLIČITIH korisnika u emulatoru, §7). Zaštita od double-spend-a ne smije zavisiti od brave upita (I04-T18). Backlog B-2. | i04 FIX LOOP 1 |
| O-18 (Orchestrator) | Odgovor na review i04 P-2 / R-04: serverski log 5xx grešaka NE SMIJE sadržati putanje dokumenata, requestKey ni voucherId, ni u poruci ni u stack-u; globalno u centralnom rukovaocu greškama. Status: implementirano u i04 FIX LOOP 1 (`greske/obradaGresaka.js`), I04-T16 (c). Dopuna FIX LOOP 2 (P-3): vidi red P-3 ispod. | i04 FIX LOOP 1 |
| P-3 (Orchestrator, re-review i04) | R-05 se ispravlja u FIX LOOP-u 2 zajedno sa R-06 (opcija A). Redakcija loga 5xx grešaka NE SMIJE zavisiti od oblika poruke Firestore greške (emulator i produkcija se razlikuju); O-18 ostaje globalan. Status: implementirano — gRPC greške (numerički `code`) bez poruke, ne-gRPC poruke sa redakcijom putanja i hex nizova ≥ 32 (§6 (h)); I04-T16 (c), I04-T20. | i04 FIX LOOP 2 |
| P-4 (Orchestrator, re-review i04) | N-09: obaveza za i07 — test konkurentne promjene `accountStatus` / brisanja naloga za vrijeme izdavanja; isto za čitanje `users` i `rewardDefinitions` u transakciji čim ih neki API mijenja (§6 (o)). | i04 FIX LOOP 2 |
| O-19 (Orchestrator, re-review 2 i04) | P-5 (opcija B): R-07, R-08, R-09 su OBAVEZA za i05. Prvi korak i05, PRIJE koda koji stavlja `voucherId` u putanju (API-05 / API-06): u `backend/src/greske/obradaGresaka.js` za gRPC grane odsjeći poruku tako da se iz `err.stack` ne uzima nijedan red poruke (samo okviri stack-a; R-07: npr. ako `stack` počinje sa `${name}: ${message}`, odsjeći taj prefiks, inače odbaciti okvire); testovi koji obaraju mutacije R-M47 (okviri bez redakcije) i R-M48 (`err.name` bez redakcije), uključujući red `\n    at <hex>` / `\n    at <ne-hex ID>` u poruci gRPC greške; R-08: `err.name` sa hex-om i ručno postavljen `err.stack` sa hex-om / putanjom u okviru; R-09: slučajevi sa tačno 32 hex znaka i sa velikim slovima (obaraju R-M46 i R-M53). Testovi u I04-T20 (c) ili prvi test i05 po uzoru na njega. P-6: R-10, R-11, R-12 se upisuju kao poznata ograničenja (§7); uz to pravilo statičkih poruka loga 5xx (§6 (h)). Status: §6 (h), §7 ažurirani; kod i testovi u i05. | i04 re-review 2 |
| D-5 | Neispravno percent-kodiran parametar putanje (Express 5 `URIError`, status 400) mora dati deterministički 4xx bez stack-a i bez sirove vrijednosti u logu i odgovoru; ispravka globalna. Kod predlaže Planner i04 (preporuka 404 `NOT_FOUND`). Status: implementirano u i04 — 404 `NOT_FOUND` u `odrediKod` (i04/P-8, K-1), I04-T03 (c), I04-T16. | i04 brief |

## 4. Odluke iz planova bitne za buduće iteracije

| ID | Odluka |
|---|---|
| i01/P-1 | Seed `rewardDefinitions` latinicom: CAR_WASH „Besplatno pranje” (50), SHOWER „Besplatan tuš” (30). |
| i01/P-4 | Svaka 4xx greška body-parser-a → 422 `INVALID_REQUEST` (O-1); 5xx parsera → 500. |
| i01/P-5 | Android namespace/applicationId `io.github.anaspasojevic.fuelpoints`. |
| i01/P-7 | Seed radi isključivo nad emulatorom; demo okruženje je otvoreno pitanje O-2. |
| i01/P-8 | Verzije zavisnosti: posljednja stabilna verzija starija od 14 dana. |
| i02/P-1 | API-01: 201 kad je kreiran bar jedan dokument, 200 za ponovljeni init; tijelo `{ displayName, accountStatus, acceptedTermsVersion, availablePoints, reservedPoints }`. |
| i02/P-2 | Init kreira samo dokument koji nedostaje; postojeći se ne mijenja; `DELETION_IN_PROGRESS` → 409; `accountStatus` van enum-a → 500. |
| i02/P-3 | Dužina `displayName` se broji u UTF-16 jedinicama (kao `size()` u Rules). |
| i02/P-4 | `VERZIJA_USLOVA` je obavezna env varijabla bez podrazumijevane vrijednosti. |
| i02/P-5 | Rok 10 s (konstanta); 503 za istek roka, `app/network-error`, `app/network-timeout` i Firestore UNAVAILABLE / DEADLINE_EXCEEDED / ABORTED; sve ostalo 500. |
| i02/P-6 | Neispravan JSON bez token-a → 422 `INVALID_REQUEST` (parser je globalan, prije autentikacije). |
| i02/P-7 | Šema `Bearer` je case-insensitive; sve ostalo → 401. |
| i03/P-1 | API-02: 201 prvi put, 200 retry; tijelo `{ purchaseId, stationId, posTransactionId, volumeMl, amountMinor, currency, earnedPoints, occurredAt }` iz sačuvanog dokumenta. |
| i03/P-2, P-3 | `POS_API_KLJUCEVI=stationId:ključ[,…]`, ključ base64url od 32 bajta; u konfiguraciji samo SHA-256 otisci; poređenje `timingSafeEqual` bez ranog izlaska. |
| i03/P-4 | `occurredAt`: RFC 3339 sa obaveznom zonom, veliko `T`/`Z`, 0–3 decimale, vlastita kalendarska provjera. |
| i03/P-5 | Format ID-a iz zahtjeva (`loyaltyUid`): string, `isWellFormed`, 1–128 UTF-16 jedinica, bez `/`, nije `.`/`..`, ne `^__.*__$` (zastavica `s`); neispravan → 404 bez pristupa bazi. |
| i03/P-6 | Validacija ulaza (uključujući format ID-eva) UVIJEK prethodi provjeri idempotentnosti i ide bez pristupa bazi. |
| i03/P-7 | Ledger `eventId` je deterministički `<tip>_<id>`; `earn_{purchaseId}` zauzet. Za i04 se predlaže `reserve_{voucherId}` i `release_{voucherId}` (odluka pri odobrenju plana i04). |
| i03/P-8 | Notifikacija: title „Bodovi za kupovinu goriva”, body „Za kupovinu goriva dobili ste {p} {bod/boda/bodova}.” |
| i03/P-11 | Aplikacija bez `posStanice` → POS ruta 500 (fail closed). |
| i03/P-15 | Neispravan `loyaltyAccounts` (vrijednost nije nenegativan siguran cijeli broj) → 500, ništa upisano. |
| i04/P-1 | API-03: 201 novi voucher, 200 retry; tijelo tačno `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt }` tim redoslijedom, ista funkcija za 201 (upisani objekat) i 200 (SAČUVANI voucher); vremena `toDate().toISOString()`; `status` = trenutni status voucher-a; bez uid-a, requestId-a, requestKey-a, ID-eva ledger događaja, balance-a i `redeemedAt`/`cancelledAt`/`redeemedAtStationId`. |
| i04/P-2 | `sadaMs = Date.now()` jednom po pokušaju transakcije; `issuedAt = Timestamp.fromMillis(sadaMs)`, `expiresAt = sadaMs + 900 000`; reconcile poredi isti `sadaMs` (`sadaMs ≥ expiresAt`); ledger `createdAt`, mapping `createdAt` i `loyaltyAccounts.updatedAt` = jedan `serverTimestamp()` po transakciji. |
| i04/P-3 | `voucherId = crypto.randomBytes(32).toString('hex')` (64 znaka `[0-9a-f]`, 256 bita), u callback-u, preko default importa `crypto`; zauzet `vouchers/{id}` ili `reserve_{id}` → 500. |
| i04/P-4 | `requestKey` = SHA-256 nad UTF-8 `uid + ":" + requestId`, hex malim slovima. |
| i04/P-5 | OBAVEZUJE i05 i i06: `loyaltyLedger/reserve_{voucherId}` i `loyaltyLedger/release_{voucherId}`, samo `tx.create`, uz eksplicitnu provjeru postojećeg `release_{voucherId}` prije upisa (→ 500); prefiks `redeem_` rezervisan za i06. |
| i04/P-6 | Release-i po `expiresAt` rastuće, pa `voucherId` rastuće (poređenje stringova); po voucher-u update statusa, pa create `release_`; lanac release-i → RESERVE; isti `createdAt` za sve događaje transakcije. |
| i04/P-7 | Poredak provjera i čitanja po planu 5.1/5.5; upisi: 1 … 2k release-i, 2k+1 nalog, 2k+2 voucher, 2k+3 RESERVE, 2k+4 mapping (O-14 grana: 1 … 2k, 2k+1 nalog). Nekonzistentna stanja → 500, ništa upisano. |
| i04/P-8 | D-5: `err instanceof URIError && err.status === 400` → `NOT_FOUND`, globalno; stvaran redoslijed neispravan JSON (422) → D-5 (404) (K-1). |
| i04/P-9 | Zajednička `jeIspravanIdDokumenta` (`validacija/identifikator.js`); za `rewardId` dodatno zabrana `\p{Cc}`; `loyaltyUid` nepromijenjen (B-1). |
| i04/P-10 | `tx.get(query)` (uid ==, status == ACTIVE) radi nad emulatorom; `firestore.indexes.json` se ne mijenja. |
| i04/P-11 | `omotacBaze.sakrijPostojece` važi i za dokumente u rezultatu `tx.get(query)`; mock `crypto.randomBytes` samo iz testova. |
| i04/P-12 | Neispravna definicija nagrade (`costPoints` nije siguran cijeli broj ≥ 1, `active` nije boolean) → 500 prije provjere `active === false` (409 `REWARD_INACTIVE`). |
| i04/P-13 … P-16 | Informativno: neuspješan issue ne pravi mapping (isti `requestId` može kasnije uspjeti); 409 uz već vraćene bodove (O-14); Express ruter case-insensitive i nije strict; oznake I04-T01 … I04-T17; broj ACTIVE voucher-a u upitu nije ograničen. |
| i04/K-1 | Redoslijed: neispravan JSON (422) → D-5 (404 `NOT_FOUND`) → token (401) → …; ima prednost nad brief-om i04, tačka 5. |
| i04/K-3 | API-T07 traži bar jedno ponavljanje sa ishodom tačno {201, 409 `INSUFFICIENT_POINTS`}. |

## 5. Tehnika (obavezujuća za sve iteracije, i02–i03)

- Jedan rok od 10 s za CIJELI zahtjev, od ulaska u posrednik (Android ili POS); ako je istekao prije transakcije, transakcija se
  ne pokreće → 503; transakcija dobija samo preostalo vrijeme.
- `verifyIdToken(token, true)`; UID isključivo iz verifikovanog token-a.
- Strogo tijelo: JSON objekat sa tačno propisanim poljima; nepoznato polje → `INVALID_REQUEST`.
- Svi novi dokumenti u transakciji se pišu sa `tx.create`; postojeći se mijenjaju samo `tx.update` navedenih polja.
- ID-evi iz zahtjeva se provjeravaju prije upotrebe kao putanja (string, `isWellFormed`, bez `/`, nije `.`/`..`, ne `^__.*__$`).
- POS ključevi samo kao SHA-256 otisci + `timingSafeEqual`; ključ se nikad ne loguje ni vraća.
- Callback transakcije nema sporednih efekata van `tx` (može se izvršiti više puta); `maxAttempts: 5`.
- Nekonzistentno stanje baze se ne „popravlja”: 500, ništa upisano.
- Testovi samo nad emulatorom (`demo-fuelpoints`); test-only kod samo u `backend/test` (npr. `omotacBaze`), bez hook-ova u `src/`.
- Svaki korak plana ostavlja `provjera.ps1` zelenim (i03/K-2).

## 6. Ograničenja za buduće iteracije

- **(a) i07** — `users/{uid}` je POSLJEDNJI obrisani Firestore dokument prije brisanja Auth naloga (i02/P-2), da init ne „oživi” nalog.
- **(b) sve mutacije** — odgovor 503 ne znači da mutacija nije upisana (kasni commit). Svaka mutacija to mora pokriti idempotency
  ključem i testom; testovi koji dozvoljavaju 503 čekaju kraj svih transakcija prije asercija i prije sljedećeg testa (i03 OD-5).
- **(c) i06** — redeem koristi isti `napraviProvjeruPosKljuca(posStanice)`, vezan samo na rutu; mapa i rok se ne dupliraju.
- **(d) i07 (O-10a)** — retry kupovine poslije pseudonimizacije (`uid = null`) po trenutnom kodu daje 409 (poređenje `uid`); i07 odlučuje.
- **(e) i10** — Android upiti nad `purchases`/`notifications` moraju imati `where('uid', '==', auth.uid)` i `limit ≤ 20` / `≤ 50`;
  `orderBy` traži composite indeks.
- **(f) i07** — kad brisanje ukloni voucher prije `rewardRequests` mapping-a, retry issue-a bi naišao na mapping bez voucher-a
  (u i04 → 500); i07 određuje redoslijed brisanja i ponašanje issue-a u tom međustanju.
- **(g) i05, i06** — svaki prelaz u EXPIRED / CANCELLED (uključujući istekao redeem, §20.5) koristi isti mehanizam „release najviše
  jednom” koji odobri plan i04 (preporuka `release_{voucherId}` + `tx.create`).
- **(h) i05, i06** — `voucherId` u putanji je podatak kojim se voucher iskorišćava: ne smije u log ni u poruku greške (D-3, D-5).
  Ažurirano u i04 FIX LOOP 1 (O-18): i log 5xx grešaka rediguje putanje dokumenata (`greske/obradaGresaka.js`); nove kolekcije i oblici
  poruka moraju ostati pokriveni redakcijom (test po uzoru na I04-T16 (c)).
  Ažurirano u i04 FIX LOOP 2 (R-05, P-3; O-18 ostaje globalan): greška sa numeričkim gRPC `code` (Firestore) se u log 5xx upisuje BEZ
  poruke — samo `name`, `code`, ime gRPC statusa (npr. `Error (code 5 NOT_FOUND)`) i okviri `at …`, pa zaštita ne zavisi od oblika
  poruke (emulator i produkcija se razlikuju). Poruka ne-gRPC greške (i bačen ne-Error) se bilježi sa redigovanim putanjama dokumenata
  i svakim nizom od ≥ 32 uzastopna hex znaka (`[hex]`; heuristika). Testovi: I04-T16 (c), I04-T20 (`logGresaka5xx.test.js`).
  Ažurirano poslije re-review 2 i04 (O-19, P-5, P-6): poruke za 5xx greške u logu su STATIČKI tekstovi — identifikatori (`requestKey`,
  `voucherId`, `uid`, `requestId`) se ne umeću u poruku loga (ni u poruku `new Error` u servisima; provjerava se u review-u).
  OBAVEZA i05 (R-07, R-08, R-09), prvi korak, PRIJE koda koji stavlja `voucherId` u putanju (API-05 / API-06): gRPC grana u
  `greske/obradaGresaka.js` iz `err.stack` ne uzima nijedan red poruke (samo okvire stack-a; danas filter `/^\s+at /` propušta red poruke
  koji počinje sa `at `), uz testove koji obaraju R-M47 i R-M48 i slučajeve praga 32 hex i velikih slova (R-09); detalji u O-19.
- **(i) i10** — Android upit nad `vouchers` mora imati `where('uid', '==', auth.uid)` i `limit ≤ 20` (§31); prikaz aktivnih voucher-a
  filtrira `status == 'ACTIVE'` (nema ekrana istorije voucher-a, §1.3); `rewardDefinitions` čita samo prijavljen korisnik.
- **(j) i05, i06 (vrijeme)** — istek se procjenjuje `jeIstekao(expiresAt.toMillis(), sadaMs)` (`servisi/vauceri.js`) sa jednim
  `sadaMs = Date.now()` po pokušaju transakcije (isti izvor kao `issuedAt`, i04/P-2).
- **(k) i05, i06 (voucherId u putanji)** — format je `^[0-9a-f]{64}$`; neispravan oblik → odgovarajući 404 bez pristupa bazi; D-5 već
  pokriva neispravno percent-kodiranje; vrijednost nikad u log ni poruku (h).
- **(l) potvrda (g) u i04 (i04/P-5)** — mehanizam je `loyaltyLedger/release_{voucherId}` + `tx.create` + eksplicitna provjera postojećeg
  release-a; ledger `createdAt` = `serverTimestamp()`.
- **(m) potvrda (f) u i04** — retry issue-a kad mapping postoji a voucher ne → 500 (i04); i07 određuje redoslijed brisanja.
- **(n) i05 (N-01, review i04)** — O-16 retry vraća sačuvani `status: "ACTIVE"` i za voucher kojem je `expiresAt` prošao (ništa se ne
  upisuje); i05 (API-06) to zatvara; Android (i10) odlučuje po `expiresAt`.
- **(o) i07 — OBAVEZA (P-4, N-09 re-review i04)** — poseban test po uzoru na I04-T18: konkurentna promjena `accountStatus` naloga ili
  brisanje naloga dok izdavanje (API-03) drži transakciju; voucher ne smije biti izdat poslije početka brisanja. Jednako za čitanje
  `users` i `rewardDefinitions` u transakciji: čim neki API počne mijenjati te dokumente, mora postojati test koji pokazuje da se čitaju
  u transakciji (u i04 obilaznice V1-b/V1-c iz re-reviewa nijedan test ne obara, jer nijedan API ne mijenja te dokumente).
- **(p) i05, i06 (N-12)** — I04-T19 je vezan za implementaciju: mock `Date.now` prepoznaje pozivaoca po fajlu
  `src/servisi/izdavanjeNagrade.js` i očekuje tačno jedno čitanje pri ulasku. Refaktor sata (npr. pomoćna funkcija u `vauceri.js`) mora
  u istom koraku uskladiti I04-T19, bez slabljenja njegove provjere (`sadaMs` po pokušaju).

## 7. Poznata ograničenja (sažetak)

- Emulator token-i nisu potpisani: odbijanje pogrešnog potpisa se ne može testirati; `checkRevoked` se provjerava inspekcijom (i02/P-9).
- i02/R-03: van emulatora greška preuzimanja javnih ključeva daje 401 umjesto 503 — rješava se uz O-2.
- `size()` (UTF-16) i ponašanje transakcija pod kontencijom utvrđeni su nad emulatorom, ne nad produkcijom.
- 503 i latencija do ~10 s pod jakom kontencijom istog korisnika (prihvaćeno; stanje uvijek konzistentno, retry bezbjedan).
  Ispravka (i04 FIX LOOP 1, R-03, O-17): u emulatoru `tx.get(query)` nad `vouchers` serijalizuje izdavanja i RAZLIČITIH korisnika
  (review i04: K=2 → 3,6 s; K=5 → 9 pokušaja; K=10 → 2×503; K=15 → 11×503); ponašanje produkcionog Firestore-a nije provjereno (B-2).
- `MetadataLookupWarning` (~3–4 s prvi poziv Admin SDK-a bez kredencijala); `npm warn install-scripts`; N-02 (seed CLI visi nad
  ne-Firestore servisom); Gradle daemon zadržava preusmjeren izlaz `provjera.ps1`.
- I02-T09 dozvoljava 503 i teoretski može ostaviti kasni commit poslije svog kraja (nije uočeno).
- i04/P-2: `issuedAt`/`expiresAt` i poređenje isteka po satu Backend-a, ledger `createdAt` po Firestore-u; razlika satova moguća
  (lokalno zanemarljiva).
- i04/P-9, i04/P-10: ponašanje Firestore-a za ID sa NUL/kontrolnim znakom i potreba za indeksom upita `uid ==, status ==` utvrđeni
  nad emulatorom; nad produkcijom neprovjerljivo.
- i04/P-14: Express ruter je case-insensitive i nije strict (`/REWARDS/CAR_WASH/ISSUE`, završna `/` pogađaju rutu).
- i04/P-16: broj ACTIVE voucher-a u upitu reconcile-a nije ograničen (2 upisa po isteklom voucher-u; limit transakcije praktično nedostižan).
- i04: 500 pri `ALREADY_EXISTS` (samo nekonzistentno stanje / zastarjelo čitanje) upisuje u serverski log stack sa porukom Firestore-a
  koja sadrži putanju dokumenta (može biti `voucherId` ili `requestKey`); odgovor ga ne sadrži. Nije uočeno u normalnom toku; za odluku.
  ZATVORENO u i04 FIX LOOP 1 (O-18): putanje dokumenata se u logu rediguju, I04-T16 (c).
  i04 FIX LOOP 2 (R-05): gRPC greške se bilježe bez poruke (ne zavisi od oblika poruke); hex redakcija ne-gRPC poruka je heuristika
  (niz < 32 hex znaka ili tajna drugog oblika ostaje); format grešaka produkcionog Firestore-a nije provjeren.
- N-11 (re-review i04): kad je `res.headersSent`, centralni rukovalac prosljeđuje grešku Express-ovom `finalhandler`-u, koji van
  `NODE_ENV=test` ispisuje cijeli `err.stack` bez redakcije. Nije dostižno: nijedna ruta ne šalje zaglavlja prije greške; ruta koja bi
  to radila (npr. streaming) mora to riješiti uz novu odluku.
- R-10 (re-review 2 i04, O-19 / P-6): centralni rukovalac baca za ne-Error bez primitivne vrijednosti (`Object.create(null)`, `toString`
  koji baca): `opisNeocekivaneGreske` baca iz `String(err)`, zapis se ne upisuje, odgovor po §27 izostaje, a Express grešku predaje
  `finalhandler`-u (ne-§27 odgovor; van `NODE_ENV=test` nerediguje `err.stack`). Nedostižno: kod i04 baca samo `Error` / `GreskaApi`;
  Firestore i Express bacaju `Error`. Predlog: `try { … } catch { return '(opis greške nedostupan)'; }` oko opisa, sa testom.
- R-11 (re-review 2 i04, O-19 / P-6): numerički `code` na ne-gRPC grešci daje pogrešnu dijagnozu (obični `Error` sa `code = 5` →
  `Error (code 5 NOT_FOUND)`, poruka izostavljena). Smjer je bezbjedan (manje u logu). Nedostižno u i04 (nijedan kod ne postavlja
  numerički `code`; Node errno je string).
- R-12 (re-review 2 i04, O-19 / P-6): identifikatori koji nisu niz ≥ 32 hex (requestId UUID, uid, 64 hex razdvojen crticama ili
  razmacima) ostaju u poruci ne-gRPC greške u logu; veličina loga nije ograničena (poruka od ~1 MB se upisuje cijela). requestId i uid
  nisu u opsegu O-18, ali I04-T16 (a) zabranjuje requestId u logu za sve ishode API-03. Nedostižno: sve ne-gRPC poruke u i04 su
  statičke; za i05+ važi pravilo statičkih poruka (§6 (h)); opciono ograničiti dužinu opisa u logu.

## 8. Backlog

| Oznaka | Prioritet | Opis | Ulazi u |
|---|---|---|---|
| F1-01 (i03_review_fix1) | P3 | `docs/TEST_REPORT.md` (linije ~1774, 1776, 1783): putanja `firebase\tests` upisana sa `\t` kao tabulatorom („`firebase<TAB>ests`”) | ZATVORENO u i04 (dokumentacioni korak; `git grep -n -P "firebase\tests" -- docs` prazno) |
| B-2 (i04 review R-03, O-17) | P3 | Kontencija `tx.get(query)` nad `vouchers` između različitih korisnika u emulatoru; ako se pokaže u demu, razmotriti opciju B (upit van transakcije + `tx.getAll` kandidata i ponovna provjera u transakciji) uz novu odluku | i09 |
| B-1 (i04/P-9) | P3 | `loyaltyUid` (API-02) sa NUL ili kontrolnim znakom prolazi provjeru formata i ide do Firestore-a (u emulatoru 404 iz transakcije; produkcija neprovjerljiva) | odluka prije i08 |

## 9. Otvorena pitanja

| ID | Pitanje | Odlučiti prije |
|---|---|---|
| O-2 | Demo nad emulatorom ili nad stvarnim Firebase Spark projektom (§3.5, §3.6); uz to i02/R-03. | i09 |
| O-5 | Cancel voucher-a koji je ACTIVE ali istekao — kao §20.5 (EXPIRED + RELEASE, pa 409 `VOUCHER_EXPIRED`)? | i05 |
| O-6 | Cancel tuđeg voucher-a — 403 `FORBIDDEN` ili 404 `VOUCHER_NOT_FOUND`? | i05 |
| O-7 | Kada redeem vraća `VOUCHER_CANCELLED`. | i06 |
| O-8 | `redemptionRequests` zapis i pri neuspjehu; `requestKey` SHA-256 kao §14? | i06 |
| O-9 | U koje stanje se zatvaraju ACTIVE voucher-i pri brisanju naloga i da li se piše `REWARD_RELEASE`. | i07 |
| O-10a | Retry kupovine poslije pseudonimizacije (`uid = null`) — vidi ograničenje (d). | i07 |

## 10. Konvencije toka rada

- Grana `iteracija-NN`; `docs/iteracije/iNN_brief.md` (Orchestrator), `iNN_plan.md` (Planner; posljednja sekcija
  „Odluke Orchestrator-a (odobrenje plana)”), `iNN_review.md` (Reviewer), `iNN_review_fix1.md` (ponovni review).
- Tok: brief → PLANNER (bez koda; „PLAN SPREMAN ZA ODOBRENJE”) → odobrenje Orchestrator-a → BUILDER (prvo doslovno upisuje odluke
  u plan, commit „iNN: odobrenje plana i odluke Orchestrator-a”; jedan korak = jedan commit + push; testovi prije koda; kontrolne
  mutacije; bez merge-a i taga; „BUILDER ZAVRŠIO — SPREMNO ZA REVIEW”) → REVIEWER (nova sesija; SRS, brief, kod i obavezujuće odluke;
  ITERATION ACCEPTED / REJECTED) → FIX LOOP („iNN fix: R-0x …”) → ponovni review.
- P0/P1 (a po odluci i P2) idu u FIX LOOP; P3 u FIX LOOP ili backlog.
- Commit-i bez potpisa alata. Checkpoint: `provjera.ps1` → `gh pr merge N --merge` → `provjera.ps1` na main →
  `git tag -a iNN -m "…"` → `git push origin iNN`.
