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
| i04 Reward issue | u toku: brief | grana `iteracija-04` |
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
| O-14 | Interni reconcile isteklih voucher-a ide u ISTU transakciju kao reward issue, redoslijedom §13.1 (nalog → reward postoji → active → reconcile → bodovi); kad issue padne na `INSUFFICIENT_POINTS`, release-i se commit-uju, pa 409 (obrazac §20.5). | 2026-10-17, i04 | i04_brief |
| O-15 | `requestId` (§13) je samo kanonski UUID v4 malim slovima; velika slova i svaki drugi oblik → 422 `INVALID_REQUEST`. | 2026-10-17, i04 | i04_brief |
| O-16 | Reward issue: `rewardRequests` mapping se provjerava PRIJE preduslova §13.1 (analogno O-12); retry istog `(uid, requestId)` za isti reward vraća isti voucher i ništa ne upisuje, bez obzira na stanje naloga, nagrade, bodova i voucher-a; drugi reward → 409 `IDEMPOTENCY_CONFLICT`. | 2026-10-17, i04 | i04_brief |

## 3. Odluke Orchestrator-a (D-n)

| ID | Odluka | Od |
|---|---|---|
| D-1 | Interni reconcile isteklih voucher-a (§18.1) ide u Iteraciju 4 (preduslov §13.1); endpoint API-06 i cancel u Iteraciju 5. | prije i04 |
| D-2 | Security Rules se uvode postepeno, doslovno iz §31, u iteraciji u kojoj kolekcija nastaje: users, loyaltyAccounts (i02); purchases, loyaltyLedger, notifications (i03); rewardDefinitions, vouchers, rewardRequests (i04); redemptionRequests (i06); i08 je završni lockdown 12/12. | i01 |
| D-3 | Log greške bilježi šablon pogođene rute (npr. `/pos/purchases`) ili `(nepoznata ruta)`, nikad sirovu putanju, query, zaglavlja ni tijelo (tajne iz URL-a ne smiju u log). | i03 FIX LOOP 1 (R-04) |
| D-4 | `rewardId` iz putanje se provjerava općom provjerom ID-a (tehnika, tačka 5) prije upotrebe kao putanja; neispravan → 404 `REWARD_NOT_FOUND` bez pristupa bazi. | i04 brief |
| D-5 | Neispravno percent-kodiran parametar putanje (Express 5 `URIError`, status 400) mora dati deterministički 4xx bez stack-a i bez sirove vrijednosti u logu i odgovoru; ispravka globalna. Kod predlaže Planner i04 (preporuka 404 `NOT_FOUND`). | i04 brief |

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
- **(i) i10** — Android upit nad `vouchers` mora imati `where('uid', '==', auth.uid)` i `limit ≤ 20` (§31); prikaz aktivnih voucher-a
  filtrira `status == 'ACTIVE'` (nema ekrana istorije voucher-a, §1.3).

## 7. Poznata ograničenja (sažetak)

- Emulator token-i nisu potpisani: odbijanje pogrešnog potpisa se ne može testirati; `checkRevoked` se provjerava inspekcijom (i02/P-9).
- i02/R-03: van emulatora greška preuzimanja javnih ključeva daje 401 umjesto 503 — rješava se uz O-2.
- `size()` (UTF-16) i ponašanje transakcija pod kontencijom utvrđeni su nad emulatorom, ne nad produkcijom.
- 503 i latencija do ~10 s pod jakom kontencijom istog korisnika (prihvaćeno; stanje uvijek konzistentno, retry bezbjedan).
- `MetadataLookupWarning` (~3–4 s prvi poziv Admin SDK-a bez kredencijala); `npm warn install-scripts`; N-02 (seed CLI visi nad
  ne-Firestore servisom); Gradle daemon zadržava preusmjeren izlaz `provjera.ps1`.
- I02-T09 dozvoljava 503 i teoretski može ostaviti kasni commit poslije svog kraja (nije uočeno).

## 8. Backlog

| Oznaka | Prioritet | Opis | Ulazi u |
|---|---|---|---|
| F1-01 (i03_review_fix1) | P3 | `docs/TEST_REPORT.md` (linije ~1774, 1776, 1783): putanja `firebase\tests` upisana sa `\t` kao tabulatorom („`firebase<TAB>ests`”) | dokumentacioni korak i04 |

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
