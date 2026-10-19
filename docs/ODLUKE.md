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
| i04 Reward issue | ITERATION ACCEPTED (re-review 2, poslije FIX LOOP-a 2) | tag `i04` (merge `d445fe8`, PR #4) |
| i05 Voucher cancel i account reconcile | ITERATION ACCEPTED (re-review nije bio potreban) | tag `i05` (merge `5a2f8cc`, PR #5) |
| i06 Voucher redeem (API-04) | ITERATION ACCEPTED (O-31: bez re-run-a `provjera.ps1`; NOTE R-01 … R-04) | tag `i06` (merge `9aae907`, PR #6) |
| i07 Brisanje naloga (API-07) | BUILDER ZAVRŠIO — čeka review | grana `iteracija-07` (PR → main, bez merge-a i taga) |
| i08 – i11 | nije počelo | — |

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
| O-5 | Cancel voucher-a koji je u bazi ACTIVE, a `serverTime ≥ expiresAt`, tretira se kao §20.5: u ISTOJ transakciji ACTIVE → EXPIRED, `reservedPoints −= cost`, `availablePoints += cost`, `REWARD_RELEASE`; poslije commit-a 409 `VOUCHER_EXPIRED`. Ishod nikad nije CANCELLED za voucher kome je istekao rok. Status: implementirano u i05 (`servisi/otkazivanjeVaucera.js`), I05-T07, I05-T12 (b), AC-08. | 2026-10-18, i05 | i05_brief |
| O-7 | Redeem CANCELLED voucher-a → 409 `VOUCHER_CANCELLED`; redeem EXPIRED voucher-a (status) → 409 `VOUCHER_EXPIRED`; ništa se ne upisuje. Status u bazi ima prednost nad rokom. Status: implementirano u i06 (`servisi/otkupVaucera.js`), I06-T11. | 2026-10-19, i06 | i06_brief |
| O-8 | (a) `redemptionRequests` zapis SAMO pri uspješnom otkupu (`resultStatus: "REDEEMED"`); neuspjeh ne pravi zapis; invarijanta #zapisa = #REWARD_REDEEM = #REDEEMED; posljedica: ID neuspješnog pokušaja može se kasnije upotrijebiti za drugi voucher (README). (b) `requestKey` = SHA-256 nad UTF-8 `stationId:redemptionRequestId`, hex malim slovima (`izracunajRequestKey`). Status: implementirano u i06, API-T08 … API-T10, I06-T06, I06-T13 (b). | 2026-10-19, i06 | i06_brief |
| O-29 | Skraćenje trajanja iteracija (od i06): sleep isključen tokom dugih run-ova, prekinut run se ponavlja; mutacije D 1/1, K n/10; `npm run test:emu:ciljano` (backend) za razvoj i mutacije; vremenski okviri uloga; sažet TEST_REPORT. Vidi §10. | 2026-10-19, i06 | i06_brief |
| O-30 | BRZI REŽIM za i06, i07 i i08 (ima prednost nad i03/K-2, O-29 (b) i planom): `provjera.ps1` tačno 2× po Builder sesiji; ključni skup mutacija; smanjena ponavljanja; sažeta dokumentacija; Reviewer 60–90 min. Vidi §10. | 2026-10-19, i06 | i06_plan (sekcija 14) |
| O-9 | ACTIVE voucher-i se pri brisanju naloga zatvaraju sa `REWARD_RELEASE` kroz isti mehanizam (`release_{voucherId}`, `tx.create`, `oslobadjanjeVaucera.js`), u transakciji sa `loyaltyAccounts`; neistekao → CANCELLED + `cancelledAt`; zatim se voucher-i brišu (§23.2). Dopuna O-34. Status: implementirano u i07 (`servisi/brisanjeNaloga.js` K3, `procitajAktivneZaZatvaranje`), I07-T04, API-T12. | 2026-10-19, i07 | i07_brief |
| O-10a | Kad sačuvani purchase ima `uid = null`, `uid` se NE poredi; isti `volumeMl`, `amountMinor`, `currency` → prvi rezultat (200, bez EARN-a i upisa); drugačiji → 409 `IDEMPOTENCY_CONFLICT`; `occurredAt` se ne poredi (O-3); odgovor bez `uid`-a. Posljedica i07/P-5. Status: implementirano u i07 (`servisi/evidencijaKupovine.js`), I07-T10. | 2026-10-19, i07 | i07_brief |
| O-32 | Redoslijed brisanja (§23.1, §23.4, ograničenje (a)): 1 `users` → DELETION_IN_PROGRESS (tx; preskače se ako već jeste) → 2 blokada (posljedica) → 3 zatvaranje ACTIVE voucher-a (O-9, O-34) → 4a `rewardRequests`, `redemptionRequests` PRIJE `vouchers`, `notifications`, `vouchers`, `loyaltyAccounts` → 5 pseudonimizacija `purchases`, `loyaltyLedger` (`uid = null`) → 4b `users/{uid}` posljednji Firestore dokument → 6 `auth.deleteUser` posljednji. Status: implementirano u i07, I07-T05. | 2026-10-19, i07 | i07_brief |
| O-33 | Uspješno brisanje (prvo i nastavljeno) → 204 bez tijela. Status: implementirano u i07, API-T12. | 2026-10-19, i07 | i07_brief |
| O-31 | EKSPRESNI REŽIM od Reviewer-a i06 do i11 (uz O-30): Reviewer ne ponavlja `provjera.ps1` kad TEST_REPORT ima završni run na kodu X i `git diff X..<vrh PR-a>` sadrži samo `docs/*.md` i `README.md`; checkpoint: merge, pa `git diff <vrh PR-a> main` prazno, pa tag; mutacije i07 ~10, i08 ~5, Android bez mutacija; smoke i09/i10 samo API 35, puni NFR-09 u i11. Vidi §3 i §10. | 2026-10-19, i06 review | i07_brief (tačka 10) |
| O-2 | Razvoj i testovi i09–i10 nad emulatorom; pravi Firebase Spark projekat se podešava u i11 (demo i ručna provjera §3.5, §3.6). | 2026-10-19 | i07_brief (tačka 10) |
| B-1 (odluka) | i08: zabrana `\p{Cc}` za `loyaltyUid` (kao i04/P-9) → 404 `LOYALTY_ACCOUNT_NOT_FOUND` bez pristupa bazi. Vidi §8. | 2026-10-19 | i07_brief (tačka 10) |
| O-6 | Voucher postoji, ali pripada drugom korisniku → 403 `FORBIDDEN`, ništa upisano ni otkriveno u tijelu odgovora; voucher koji ne postoji → 404 `VOUCHER_NOT_FOUND`. Status: implementirano u i05, I05-T05. | 2026-10-18, i05 | i05_brief |

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
| O-19 (Orchestrator, re-review 2 i04) | P-5 (opcija B): R-07, R-08, R-09 su OBAVEZA za i05. Prvi korak i05, PRIJE koda koji stavlja `voucherId` u putanju (API-05 / API-06): u `backend/src/greske/obradaGresaka.js` za gRPC grane odsjeći poruku tako da se iz `err.stack` ne uzima nijedan red poruke (samo okviri stack-a; R-07: npr. ako `stack` počinje sa `${name}: ${message}`, odsjeći taj prefiks, inače odbaciti okvire); testovi koji obaraju mutacije R-M47 (okviri bez redakcije) i R-M48 (`err.name` bez redakcije), uključujući red `\n    at <hex>` / `\n    at <ne-hex ID>` u poruci gRPC greške; R-08: `err.name` sa hex-om i ručno postavljen `err.stack` sa hex-om / putanjom u okviru; R-09: slučajevi sa tačno 32 hex znaka i sa velikim slovima (obaraju R-M46 i R-M53). Testovi u I04-T20 (c) ili prvi test i05 po uzoru na njega. P-6: R-10, R-11, R-12 se upisuju kao poznata ograničenja (§7); uz to pravilo statičkih poruka loga 5xx (§6 (h)). Status: §6 (h), §7 ažurirani; IZVRŠENO u i05, korak 1 (commit `9b28b06`, prije koda sa `voucherId` u putanji): okviri tek poslije zaglavlja `${name}: ${message}` (R-07), redakcija `name` i okvira (R-08), prag 32 hex i velika slova testirani (R-09), opis greške nikad ne baca (R-10); I05-T01 obara R-M46, R-M47, R-M48, R-M53, N40 … N43 10/10; I05-T02 (statička analiza poruka). | i04 re-review 2 |
| O-20 (Orchestrator, brief i05) | Stanje naloga za API-05 / API-06 (po uzoru na O-16): CANCEL — voucher CANCELLED → 200 sa postojećim stanjem bez upisa i REDEEMED / EXPIRED → 409 bez upisa, bez obzira na stanje naloga; tek za ACTIVE voucher nalog mora biti ACTIVE (DELETION_IN_PROGRESS → 409 `ACCOUNT_DELETION_IN_PROGRESS`, users ili loyaltyAccounts ne postoji → 409 `ACCOUNT_NOT_INITIALIZED`, neispravno stanje → 500; ništa upisano, ni O-5 release). RECONCILE — provjera naloga prva (409 / 409 / 500), nalog ACTIVE bez isteklih → 200, brojač 0. Status: implementirano u i05 (`servisi/stanjeNaloga.js`, `otkazivanjeVaucera.js`, `uskladjivanjeVaucera.js`), I05-T08, I05-T16. | i05 brief |
| O-21 (Orchestrator, brief i05) | Politika tijela za endpoint-e bez business input-a: bez tijela i `{}` su ispravni; svako drugo tijelo → 422 `INVALID_REQUEST`; neispravan JSON → 422 i bez token-a. Tačno pravilo: i05/P-2. Status: implementirano (`validacija/zahtjevVaucera.js`), I05-T03. | i05 brief |
| O-22 (Orchestrator, brief i05) | `voucherId` iz putanje: `^[0-9a-f]{64}$`; neispravan → 404 `VOUCHER_NOT_FOUND` bez pristupa Firestore-u; neispravno percent-kodiran → D-5 (404 `NOT_FOUND`); vrijednost nikad u log ni u odgovor greške. Status: implementirano (`validacija/zahtjevVaucera.js`, `FORMAT_VOUCHER_ID` u `servisi/vauceri.js`), I05-T03, I05-T20. | i05 brief |
| O-23 (Orchestrator, i05 review R-01) | R-01 (MINOR): ACTIVE voucher sa već popunjenim `redeemedAt`, `redeemedAtStationId` ili `cancelledAt` se na cancel-u ipak otkazuje (200) i postojeći `cancelledAt` se prepisuje. Kroz API nije dostižno i ne vodi u double-refund. Odluka: u i05 se NE mijenja kod (i05 ostaje ITERATION ACCEPTED). Obaveza za i06: kad redeem počne pisati `redeemedAt` / `redeemedAtStationId`, redeem i cancel moraju koristiti zajedničku provjeru stanja ACTIVE voucher-a (voucher sa `redeemedAt`, `redeemedAtStationId` ili `cancelledAt` ne smije se otkazati ni otkupiti), uz test koji obara mutaciju bez te provjere (§6 (t)). | i05 review |
| O-24 (Orchestrator, brief i06) | Redeem: `redemptionRequests/{requestKey}` se provjerava PRIJE stanja voucher-a (§20.2); isti voucher → 200 isto tijelo iz sačuvanog voucher-a, ništa upisano, bez obzira na nalog i rok; drugi voucher → 409 `IDEMPOTENCY_CONFLICT`; nekonzistentan zapis → 500. Status: implementirano u i06, API-T09, I06-T12, I06-T13 (a). | i06 brief |
| O-25 (Orchestrator, brief i06) | Redeem: REDEEMED / CANCELLED / EXPIRED → 409 voucher koda PRIJE naloga; nalog (uid iz voucher-a) tek za ACTIVE (409 / 409 / 500, ništa upisano, ni §20.5 release). Status: implementirano u i06, I06-T12. | i06 brief |
| O-26 (Orchestrator, brief i06) | Redeem reconcile-uje SAMO voucher iz putanje (§20.5); bez `tx.get(query)`. Status: implementirano u i06, I06-T18 (g). | i06 brief |
| O-27 (Orchestrator, brief i06; izvršenje O-23) | JEDNA funkcija konzistentnosti stanja voucher-a `jeKonzistentnoStanjeVaucera` (`servisi/vauceri.js`, §15): ACTIVE / EXPIRED ⇒ `redeemedAt`, `redeemedAtStationId`, `cancelledAt` === null; REDEEMED ⇒ `redeemedAt` Timestamp, `redeemedAtStationId` neprazan string, `cancelledAt` null; CANCELLED ⇒ `cancelledAt` Timestamp, ostala dva null; polja moraju postojati. Koriste je redeem, cancel, `procitajIstekleAktivne` (API-03, API-06) i O-16 retry API-03 (i06/P-1). Nekonzistentno → 500, ništa upisano. Status: implementirano u i06, I06-T02 … I06-T05, I06-T14 (a). | i06 brief |
| O-28 (Orchestrator, brief i06) | Ledger `loyaltyLedger/redeem_{voucherId}`, samo `tx.create`, uz eksplicitnu provjeru da ni `redeem_` ni `release_` ne postoje (→ 500); jedan modul piše `redeem_` (`servisi/otkupVaucera.js`). Upisi uspjeha: voucher → `redeem_` → loyaltyAccounts → zapis. Status: implementirano u i06, API-T08, I06-T14, I06-T15. | i06 brief |
| i06/P-1 … P-9, K-1, K-3, K-5 (Orchestrator, odobrenje plana i06) | P-1 A: O-27 i u O-16 retry grani; P-2 A: u `provjera.ps1` samo novi smoke red (redeem bez ključa → 401); P-3 A: strukturna ispravnost zapisa (500) prije poređenja `voucherId`-a (409); P-4: dupli ključ u JSON tijelu → posljednji pobjeđuje (§7); P-5: provjera `redeem_`/`release_` prije grananja na istek; P-6 (Ana): ugovor odgovora API-04 = 200 `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt, redeemedAt, redeemedAtStationId }` iz sačuvanog voucher-a i za retry; P-7: `omotacBaze.prijePokusaja` (test-only); P-8: `backend/skripte/testEmuCiljano.js`; P-9: ograničenje (u). K-1: M45 je D (I06-T18 (c)); K-3: spajanje koraka; K-5: 500 pod kontencijom → Builder staje. Detalji: `docs/iteracije/i06_plan.md`, sekcija 14. | i06 plan |
| O-31 (Ana; upis po brief-u i07, zatvara R-01 review-a i06) | Ekspresni režim od Reviewer-a i06 do i11 — tekst u §2 i §10. | i06 review |
| O-34 (Orchestrator, brief i07) | Dopuna O-9 radi O-5 / §18.1: ACTIVE voucher sa `sadaMs ≥ expiresAt` se pri brisanju zatvara kao EXPIRED + RELEASE (nikad CANCELLED za istekao rok); ista transakcija. Status: implementirano u i07, I07-T04 (granica). | i07 brief |
| O-34b (Orchestrator, brief i07; Planner potvrdio, i07/P-3) | DELETE kad `users/{uid}` ne postoji (pad između 4b i 6 ili NOT_INITIALIZED) → preostali idempotentni koraci po `uid`, pa brisanje Auth naloga → 204; nikad `ACCOUNT_NOT_INITIALIZED`. Status: implementirano u i07, I07-T07. | i07 brief |
| O-35 (Orchestrator, brief i07; i07/P-2) | Recent auth: `auth_time` verifikovanog token-a; dozvoljeno ako `Date.now() ≤ auth_time·1000 + 300 000` (uključivo); inače 409 `REAUTHENTICATION_REQUIRED` bez pristupa bazi, i za nastavak; posrednik izlaže `auth_time` samo za API-07; redoslijed 422 JSON → 401 → 422 tijelo → 409 → tok. Status: implementirano u i07 (`posrednici/svjezinaPrijave.js`), I07-T01 … I07-T03. | i07 brief |
| O-36 (Orchestrator, brief i07) | Tok brisanja NIJE jedna transakcija; koraci idempotentni i ponovljivi; K1, K3 (i K4b) transakcije, K4a / K5 upiti + paketi ≤ 400 upisa; rok 10 s → 503, stanje konzistentno, nastavak bezbjedan (§23.4, §6 (b)). Status: implementirano u i07, I07-T06, I07-T11. | i07 brief |
| i07/P-1 … P-9, K-1 … K-4 (Orchestrator, odobrenje plana i07) | P-1 A: prozor K4b → K6 prihvaćen (§7) + ograničenje (v) za i10, bez koda (B, C, D odbačeni); P-2: oblik O-35, fail closed za `auth_time` koji nije nenegativan siguran cijeli broj, budući `auth_time` dozvoljen; P-3: nastavak uvijek cijeli tok od K1, K3 i K4b traže users DELETION_IN_PROGRESS ili nepostojeći (inače 500), `accountStatus` van enum-a → 500; P-4: K3 bez gornje granice broja ACTIVE voucher-a; P-5: posljedica O-10a (drugi `loyaltyUid` → 200 prvi rezultat); P-6: retry izdavanja / otkupa poslije brisanja mapping-a → 409 / 404, nikad 500 (zatvara (f), (m), (u)); P-7: `omotacBaze.batch()` + `dnevnik`, `test/pomocnici/omotacAutha.js` (test-only); P-8: ponovljen DELETE poslije K6 → 401; P-9: smoke `DELETE /account` bez token-a → 401. K-1: koraci 4 i 5 spojeni; K-2: JDK prvi na PATH-u i provjera portova; K-3: crveni run prije koda; K-4: commit koda završnog `provjera.ps1` u TEST_REPORT. Detalji: `docs/iteracije/i07_plan.md`, sekcija 14. | i07 plan |
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
| i05/P-1 | API-05: 200 i za prvi cancel i za retry; tijelo tačno `{ voucherId, rewardId, costPoints, status, issuedAt, expiresAt, cancelledAt }` tim redoslijedom, ista funkcija za prvi odgovor (upisani objekat) i retry (SAČUVANI dokument). API-06: 200 `{ reconciledCount }`. |
| i05/P-2 | O-21: prazno tijelo ili `{}` je valjano, sve ostalo 422 `INVALID_REQUEST`; kad je `req.body === undefined`, zahtjev ne smije nositi nepročitan sadržaj (`Transfer-Encoding` prisutan ili `Content-Length` različit od `'0'` → 422). Retrofit oblik (`Content-Length: 0`, bez `Content-Type`) se prihvata. |
| i05/P-3 | `cancelledAt = Timestamp.fromMillis(sadaMs)`; jedan `sadaMs` po pokušaju transakcije (i04/P-2, §6 (j)). |
| i05/P-4 | Redoslijed provjera (O-20): cancel — postoji (404) → `uid` ispravan (500) → vlasnik (403) → ispravan voucher (500) → CANCELLED (200) / REDEEMED / EXPIRED (409) → nalog (samo ACTIVE) → istek (O-5) → `release_` postoji (500) → `reserved < cost` (500) → upisi; API-06 — nalog prvi. Na retry-ju CANCELLED / EXPIRED se NE provjerava postojanje `release_{voucherId}`. |
| i05/P-5 | Raspored: `servisi/oslobadjanjeVaucera.js` (jedini kod koji piše `release_`), `servisi/stanjeNaloga.js`, `servisi/otkazivanjeVaucera.js`, `servisi/uskladjivanjeVaucera.js`, `validacija/zahtjevVaucera.js`, `rute/vauceri.js`. Refaktor zajedničkog mehanizma ne mijenja ponašanje API-03; I04-T19 i test kod i01–i04 netaknuti. |
| i05/P-6 | O-19 u koraku 1 (okviri bez linija poruke; opis nikad ne baca) uz I05-T01 i I05-T02 (statička analiza: identifikatori se ne interpoliraju u `new Error` poruke ni u logove). |
| i05/P-7 | Informativno: 503 `GreskaApi` zapis zadržava zaglavlje `GreskaApi: SERVICE_UNAVAILABLE` i okvire. |
| i05/P-8 | API-06 bez gornje granice broja voucher-a (§18.1 jedna transakcija); ograničenje (Firestore 10 MiB / 270 s po transakciji) u poznatim ograničenjima. |
| i05/P-9 | `firestore.indexes.json` i `firestore.rules` se ne mijenjaju. |
| i05/P-10 | `omotacBaze.js` bez proširenja (u i05 nije bilo potrebe). |
| i05/P-11 | Dva oblika 422: JSON skalar / `null` / neispravan JSON → 422 i bez token-a; objekat sa poljem / niz / ne-JSON tijelo → 401 bez token-a, 422 sa token-om. |
| i05/P-12 | DOKUMENTOVANO ODSTUPANJE od brief-a: `/api/v1/vouchers//cancel` → 404 `NOT_FOUND` (ne `VOUCHER_NOT_FOUND`), jer prazan segment nije ruta. U README. |
| i05/P-13 | Informativno: 403 otkriva postojanje tuđeg voucher-a (O-6); `voucherId` ima 256 bita. U README. |
| i05/P-14 | Informativno: `reconciledCount` pod kontencijom broji samo voucher-e koje je ta transakcija zaista oslobodila. U README. |
| i05/K-1 | I05-T14 dokazuje ishod bez oslanjanja na kontenciju / 503 i bez oslanjanja na to da upit nad `vouchers` serijalizuje transakcije (pouka i04 R-01). |
| i05/K-3 | Test pod kontencijom sa 500 (R19) ili test koji nije 10/10 u oba smjera → Builder staje i javlja. |

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
  ZATVORENO u i07 (O-32): K4b poslije svih ostalih Firestore koraka, K6 posljednji (I07-T05, mutacija D02); prozor K4b → K6 je poznato
  ograničenje (i07/P-1, §7) uz (v).
- **(b) sve mutacije** — odgovor 503 ne znači da mutacija nije upisana (kasni commit). Svaka mutacija to mora pokriti idempotency
  ključem i testom; testovi koji dozvoljavaju 503 čekaju kraj svih transakcija prije asercija i prije sljedećeg testa (i03 OD-5).
- **(c) i06** — redeem koristi isti `napraviProvjeruPosKljuca(posStanice)`, vezan samo na rutu; mapa i rok se ne dupliraju.
- **(d) i07 (O-10a)** — retry kupovine poslije pseudonimizacije (`uid = null`) po trenutnom kodu daje 409 (poređenje `uid`); i07 odlučuje.
  ZATVORENO u i07 (O-10a): `uid === null` se ne poredi (I07-T10, mutacija D08).
- **(e) i10** — Android upiti nad `purchases`/`notifications` moraju imati `where('uid', '==', auth.uid)` i `limit ≤ 20` / `≤ 50`;
  `orderBy` traži composite indeks.
- **(f) i07** — kad brisanje ukloni voucher prije `rewardRequests` mapping-a, retry issue-a bi naišao na mapping bez voucher-a
  (u i04 → 500); i07 određuje redoslijed brisanja i ponašanje issue-a u tom međustanju.
  ZATVORENO u i07 (O-32, i07/P-6): mapping-i se brišu PRIJE `vouchers`; retry u međustanju → 200 / 409 / 401, nikad 500 (I07-T15, D04).
- **(g) i05, i06** — svaki prelaz u EXPIRED / CANCELLED (uključujući istekao redeem, §20.5) koristi isti mehanizam „release najviše
  jednom” koji odobri plan i04 (preporuka `release_{voucherId}` + `tx.create`).
  ZATVORENO za i05: jedna implementacija `servisi/oslobadjanjeVaucera.js` koju koriste API-03, API-05 (CANCELLED i O-5) i API-06
  (`git grep "release_"` u `backend/src` → kod samo u tom modulu); i06 nastavlja po (q).
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
  ZATVORENO u i05 (korak 1, `9b28b06`): O-19 izvršen PRIJE koda sa `voucherId` u putanji; pravilo statičkih poruka se provjerava
  automatski (I05-T02 skenira cijeli `backend/src`: poruka svakog `new …Error(` je jedan string literal, `console.*` / `zabiljeziGresku`
  ne pominju identifikatore), pa važi i za i06; log API-05 / API-06 bez `voucherId`-a, `uid`-a i token-a (I05-T20).
- **(i) i10** — Android upit nad `vouchers` mora imati `where('uid', '==', auth.uid)` i `limit ≤ 20` (§31); prikaz aktivnih voucher-a
  filtrira `status == 'ACTIVE'` (nema ekrana istorije voucher-a, §1.3); `rewardDefinitions` čita samo prijavljen korisnik.
- **(j) i05, i06 (vrijeme)** — istek se procjenjuje `jeIstekao(expiresAt.toMillis(), sadaMs)` (`servisi/vauceri.js`) sa jednim
  `sadaMs = Date.now()` po pokušaju transakcije (isti izvor kao `issuedAt`, i04/P-2).
  ZATVORENO u i05: cancel i API-06 čitaju `sadaMs` na početku svakog pokušaja svog callback-a (I05-T13); zajednički modul
  `servisi/oslobadjanjeVaucera.js` ne čita sat. Za i06 (istekao redeem, §20.5) važi isto.
- **(k) i05, i06 (voucherId u putanji)** — format je `^[0-9a-f]{64}$`; neispravan oblik → odgovarajući 404 bez pristupa bazi; D-5 već
  pokriva neispravno percent-kodiranje; vrijednost nikad u log ni poruku (h).
  ZATVORENO za i05 (O-22): `provjeriVoucherId` (`validacija/zahtjevVaucera.js`) sa `FORMAT_VOUCHER_ID` iz `servisi/vauceri.js` → 404
  `VOUCHER_NOT_FOUND`; I05-T03 (a), (b). i06 (redeem) koristi istu funkciju.
- **(l) potvrda (g) u i04 (i04/P-5)** — mehanizam je `loyaltyLedger/release_{voucherId}` + `tx.create` + eksplicitna provjera postojećeg
  release-a; ledger `createdAt` = `serverTimestamp()`.
- **(m) potvrda (f) u i04** — retry issue-a kad mapping postoji a voucher ne → 500 (i04); i07 određuje redoslijed brisanja.
  ZATVORENO u i07 kao (f).
- **(n) i05 (N-01, review i04)** — O-16 retry vraća sačuvani `status: "ACTIVE"` i za voucher kojem je `expiresAt` prošao (ništa se ne
  upisuje); i05 (API-06) to zatvara; Android (i10) odlučuje po `expiresAt`.
  ZATVORENO u i05: API-06 implementiran; README opisuje preporučeni tok (Home → API-06 → čitanje iz Firestore-a; API-03 retry sa
  `ACTIVE` i prošlim `expiresAt` → API-06; API-05 `409 VOUCHER_EXPIRED` → osvježavanje stanja).
- **(o) i07 — OBAVEZA (P-4, N-09 re-review i04)** — poseban test po uzoru na I04-T18: konkurentna promjena `accountStatus` naloga ili
  brisanje naloga dok izdavanje (API-03) drži transakciju; voucher ne smije biti izdat poslije početka brisanja. Jednako za čitanje
  `users` i `rewardDefinitions` u transakciji: čim neki API počne mijenjati te dokumente, mora postojati test koji pokazuje da se čitaju
  u transakciji (u i04 obilaznice V1-b/V1-c iz re-reviewa nijedan test ne obara, jer nijedan API ne mijenja te dokumente).
  Status poslije i05: OSTAJE za i07. i05 ne mijenja `users` ni `rewardDefinitions` (cancel i API-06 ih samo čitaju u transakciji,
  kroz zajednički `procitajStanjeNaloga`); test konkurentnog brisanja naloga dolazi sa API-07.
  ZATVORENO u i07: I07-T09 (deterministički, `prijePokusaja`): issue, cancel, redeem, purchase, API-06 i init poslije promjene `users`
  između pokušaja 1 i 2 ne mutiraju; (g) cijeli DELETE između pokušaja → issue 409 bez voucher-a; mutacija D11 (users van transakcije)
  ubijena. Dio o `rewardDefinitions` ostaje neprimjenjiv (nijedan API ih ne mijenja).
- **(p) i05, i06 (N-12)** — I04-T19 je vezan za implementaciju: mock `Date.now` prepoznaje pozivaoca po fajlu
  `src/servisi/izdavanjeNagrade.js` i očekuje tačno jedno čitanje pri ulasku. Refaktor sata (npr. pomoćna funkcija u `vauceri.js`) mora
  u istom koraku uskladiti I04-T19, bez slabljenja njegove provjere (`sadaMs` po pokušaju).
  ZATVORENO u i05 bez usklađivanja: refaktor (korak 2, `9f6a789`) ne dira sat — `izdavanjeNagrade.js` čita `Date.now()` kao u i04,
  zajednički modul ne čita sat, pa je I04-T19 nepromijenjen (`git diff i04 -- backend/test/emulator/izdavanjeAtomicnost.test.js`
  prazno) i zelen. Novi servisi imaju isti test po svom fajlu (I05-T13).
- **(q) i06 (g, i05)** — istekao redeem (§20.5) koristi `servisi/oslobadjanjeVaucera.js` (`pripremiOslobadjanja` + `upisiOslobadjanja`
  sa `{ status: 'EXPIRED' }`) i `servisi/stanjeNaloga.js`; nijedan drugi kod ne piše `release_`.
- **(r) i07 (O-9, i05)** — ako brisanje naloga zatvara ACTIVE voucher-e kao CANCELLED / EXPIRED, mora proći kroz isti mehanizam
  (release najviše jednom) ili odluka O-9 mora reći da RELEASE izostaje; cancel retry ne provjerava `release_` (i05/P-4).
  ZATVORENO u i07 (O-9, O-34): K3 kroz `pripremiOslobadjanja` / `upisiOslobadjanja` (eksplicitna provjera `release_`, `tx.create`); I07-T04, D05, D06.
- **(s) i10 (i05)** — Android poziva API-06 na Home-u i poslije `409 VOUCHER_EXPIRED` iz API-05 osvježava stanje; `Content-Length: 0`
  bez tijela (Retrofit `@POST` bez `@Body`) je ispravan zahtjev za API-05 i API-06.
- **(t) i06 — OBAVEZA (O-23, i05 review R-01)** — kad redeem počne pisati `redeemedAt` / `redeemedAtStationId`, redeem i cancel moraju
  koristiti zajedničku provjeru stanja ACTIVE voucher-a: voucher sa `redeemedAt`, `redeemedAtStationId` ili `cancelledAt` ne smije se
  otkazati ni otkupiti; uz test koji obara mutaciju bez te provjere. ZATVORENO u i06 (O-27): `jeKonzistentnoStanjeVaucera` koriste redeem,
  cancel, `procitajIstekleAktivne` i O-16 retry; mutacije M30, M31, M32 ubijene (TEST_REPORT i06).
- **(u) i07 (i06/P-9)** — brisanje naloga uklanja voucher-e i `redemptionRequests` (§23.2); retry otkupa koji naiđe na zapis bez
  voucher-a daje 500 (O-24); i07 određuje redoslijed brisanja (analogno (f), (m)).
  ZATVORENO u i07 kao (f): `redemptionRequests` prije `vouchers`; retry otkupa → 200 / 409 `VOUCHER_ALREADY_REDEEMED` / 404 (I07-T15).
- **(v) i10 (i07/P-1, P-8)** — Android poslije pokretanja `DELETE /api/v1/account` ne poziva init ni drugi API dok ne dobije 204, a 401
  na ponovljen DELETE tumači kao završeno brisanje (Auth nalog ne postoji). Na 409 `REAUTHENTICATION_REQUIRED` traži ponovnu prijavu.

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
- R-10: ZATVORENO u i05 (O-19, korak 1): opis greške nikad ne baca (statički opis `(opis greške nedostupan)`), I05-T01 (d).
  R-11 i R-12 ostaju poznata ograničenja; R-12 je za nove servise pokriven pravilom statičkih poruka (I05-T02).
- i05/P-3: `cancelledAt` i odluka o isteku po satu Backend-a, ledger `createdAt` i `updatedAt` po Firestore-u (razlika satova moguća).
- i05/P-8: API-06 nema gornju granicu broja isteklih voucher-a u jednoj transakciji; ostaju Firestore granice 10 MiB po zahtjevu i
  270 s po transakciji (60 s neaktivnosti); praktična granica je rok zahtjeva od 10 s (→ 503, stanje konzistentno, retry bezbjedan).
  Izmjereno nad emulatorom: 200 isteklih u jednoj transakciji (I05-T15 (e)); produkcija nije provjerljiva.
- i05/P-9: upit `uid ==, status ==` (API-06) i potreba za indeksom utvrđeni samo nad emulatorom (kao i04/P-10).
- i05/P-11: dva oblika 422 zavisno od tipa tijela (skalar / `null` → 422 i bez token-a; objekat / niz → 401 bez token-a).
- i05/P-12: `/vouchers//cancel` → 404 `NOT_FOUND` (prazan segment nije ruta), ne `VOUCHER_NOT_FOUND`.
- i05/P-13: 403 `FORBIDDEN` otkriva da tuđi voucher postoji (O-6).
- i05/P-14: `reconciledCount` pod kontencijom broji samo voucher-e koje je oslobodila ta transakcija; zbir kroz paralelne pozive ≤ broj isteklih.
- i05: brisanje voucher-a Admin SDK-om dok cancel drži transakciju čeka bravu u emulatoru, pa se stvarni gRPC NOT_FOUND iz cancel
  transakcije ne može izazvati testom (I05-T20 (b) pokriva ALREADY_EXISTS; NOT_FOUND nad `vouchers/<id>` pokriva I04-T20 (a)).

- i06/P-4: tijelo API-04 sa dvostrukim ključem (`{"redemptionRequestId":"A","redemptionRequestId":"B"}`) prihvata se sa posljednjom
  vrijednošću (`JSON.parse`); otkrivanje bi tražilo sopstveni parser.
- i06 (O-8 (a)): `redemptionRequestId` neuspješnog pokušaja otkupa može se kasnije upotrijebiti za drugi voucher (zapis samo pri uspjehu).
- i06: redeem `redeemedAt` po satu Backend-a, ledger `createdAt` i zapis `createdAt` po Firestore-u (kao i05/P-3).
- i06: 503 pod kontencijom istog voucher-a / naloga (paralelni redeem, redeem × cancel, redeem × API-06 × issue) je moguć (TEST_REPORT i06,
  raspodjela I06-T19); stanje konzistentno, retry istim `redemptionRequestId` bezbjedan.
- i06: `firebase emulators:exec` ostavlja Java proces emulatora na portu 8080 kad je na PATH-u Oracle `javapath` (poznato od i01,
  `provjera.ps1` to rješava); za `test:emu:ciljano` i ručne run-ove pravi JDK mora biti prvi na PATH-u (README).

- i07/P-1: prozor između K4b (`users` obrisan) i K6 (Auth obrisan): init sa još važećim token-om tog korisnika može ponovo napraviti
  `users` / `loyaltyAccounts`; ako K6 zatim uspije, ostaju dokumenti bez Auth naloga. Prozor je jedan Auth RPC; ublažava ga (v).
- i07/P-2: budući `auth_time` (razlika satova) je dozvoljen; Admin SDK provjerava `iat` / `exp`, ne `auth_time`. Emulator ne izdaje
  token sa starim `auth_time` koji prolazi `checkRevoked`, pa se svježina testira mock-om sata modula `svjezinaPrijave.js`.
- i07/P-4: K3 je jedna transakcija bez gornje granice broja ACTIVE voucher-a (kao i05/P-8).
- i07/P-5: poslije pseudonimizacije isti POS payload sa drugim `loyaltyUid` → 200 prvi rezultat, bez EARN-a (O-10a; README).
- i07/P-6: §20.2 / O-16 „isti rezultat” prestaje kad §23.2 obriše mapping (retry → 409 / 404).
- i07/P-8: ponovljen DELETE poslije uspješnog K6 → 401 (i kad je 503 nastao poslije commit-a K6).
- i07: emulator ne provjerava granicu od 500 upisa po paketu; ≤ 400 se dokazuje brojanjem operacija u omotaču (I07-T06 (c)).
- i07: veliki nalog — rok 10 s ograničava broj dokumenata po zahtjevu (→ 503, nastavak bezbjedan); produkcija neprovjerljiva.
- i07: rijetka prolazna 401 na zahtjevu sa svježim token-om pod opterećenjem emulatora (uočeno jednom, I06-T19 (c), OD-3 i07; ponovljen run zelen).

## 8. Backlog

| Oznaka | Prioritet | Opis | Ulazi u |
|---|---|---|---|
| F1-01 (i03_review_fix1) | P3 | `docs/TEST_REPORT.md` (linije ~1774, 1776, 1783): putanja `firebase\tests` upisana sa `\t` kao tabulatorom („`firebase<TAB>ests`”) | ZATVORENO u i04 (dokumentacioni korak; `git grep -n -P "firebase\tests" -- docs` prazno) |
| B-2 (i04 review R-03, O-17) | P3 | Kontencija `tx.get(query)` nad `vouchers` između različitih korisnika u emulatoru; ako se pokaže u demu, razmotriti opciju B (upit van transakcije + `tx.getAll` kandidata i ponovna provjera u transakciji) uz novu odluku | i09 |
| B-1 (i04/P-9) | P3 | `loyaltyUid` (API-02) sa NUL ili kontrolnim znakom prolazi provjeru formata i ide do Firestore-a (u emulatoru 404 iz transakcije; produkcija neprovjerljiva). ODLUKA (Ana, 2026-10-19): zabrana `\p{Cc}` (kao i04/P-9) → 404 `LOYALTY_ACCOUNT_NOT_FOUND` bez pristupa bazi | i08 |
| R-02 (i05 review, NOTE) | P4 | Retry cancel-a nad CANCELLED / EXPIRED ne provjerava postojanje `release_{voucherId}` (po odluci i05/P-4); svjesna granica detekcije nekonzistentnog stanja, veza sa §6 (r) | bez roka |
| R-03 (i05 review, NOTE) | P4 | Redakcija hex-a u logu ne-gRPC poruka ostavlja prefiks < 32 znaka (npr. hex razdvojen crticom); nedostižno u kodu i05 (statičke poruke, I05-T02); ostaje poznato ograničenje R-12 | bez roka |
| R-04 (i05 review, NOTE) | P4 | 503 pod kontencijom istog naloga (paralelni cancel, cancel × API-06, cancel × issue); dozvoljeno po §27, stanje konzistentno, retry bezbjedan; Android (i09/i10) treba ponoviti poziv na 503 | bez roka |
| R-05 (i05 review, NOTE) | P4 | 409 grana pri konkurentnom početku brisanja naloga za vrijeme cancel transakcije nije dostižna testom u emulatoru (brava, kao OD-2); obaveza §6 (o) ostaje za i07 | bez roka |
| R-02 (i06 review, NOTE) | P4 | i06 OD-3: kod API-04 napisan prije prvog crvenog run-a; za i07+ i07/K-3 (crveni run se bilježi prije koda) | bez roka |
| R-03 (i06 review, NOTE) | P4 | DoD `git grep "release_"` doslovno vraća i komentare; u briefovima formulisati „kod (bez komentara)” | bez roka |
| R-04 (i06 review, NOTE) | P4 | Ishod slobodne trke redeem × cancel u emulatoru je pristrasan (cancel pobjeđuje); invarijanta važi, grana „redeem pobjeđuje” deterministički pokrivena (I06-T18 (b)) | bez roka |
| R-06, R-07 (i05 review, NOTE) | P4 | Kozmetika TEST_REPORT / OD-6 (a) tačnost opisa: netačno obrazloženje da klijentski URL parser normalizuje `..` (R-06); isti opis za obje varijante mutacija u tabeli TEST_REPORT-a (R-07) | bez roka |

## 9. Otvorena pitanja

| ID | Pitanje | Odlučiti prije |
|---|---|---|
| O-2 | ZATVORENO 2026-10-19 (Ana, brief i07 tačka 10): i09–i10 nad emulatorom, pravi Spark projekat u i11 (uz i02/R-03) — vidi §2. | i09 |
| O-5 | ZATVORENO 2026-10-18 (Ana, brief i05): kao §20.5 (EXPIRED + RELEASE, pa 409 `VOUCHER_EXPIRED`) — vidi §2. | i05 |
| O-6 | ZATVORENO 2026-10-18 (Ana, brief i05): 403 `FORBIDDEN` za tuđi, 404 `VOUCHER_NOT_FOUND` za nepostojeći — vidi §2. | i05 |
| O-7 | ZATVORENO 2026-10-19 (Ana, brief i06): 409 `VOUCHER_CANCELLED` / `VOUCHER_EXPIRED`, status prije roka — vidi §2. | i06 |
| O-8 | ZATVORENO 2026-10-19 (Ana, brief i06): zapis samo pri uspjehu; `requestKey` = SHA-256(`stationId:redemptionRequestId`) — vidi §2. | i06 |
| O-9 | ZATVORENO 2026-10-19 (Ana, brief i07): CANCELLED (istekao EXPIRED, O-34) + `REWARD_RELEASE`, pa brisanje — vidi §2. | i07 |
| O-10a | ZATVORENO 2026-10-19 (Ana, brief i07): `uid = null` se ne poredi — vidi §2. | i07 |

## 10. Konvencije toka rada

- Grana `iteracija-NN`; `docs/iteracije/iNN_brief.md` (Orchestrator), `iNN_plan.md` (Planner; posljednja sekcija
  „Odluke Orchestrator-a (odobrenje plana)”), `iNN_review.md` (Reviewer), `iNN_review_fix1.md` (ponovni review).
- Tok: brief → PLANNER (bez koda; „PLAN SPREMAN ZA ODOBRENJE”) → odobrenje Orchestrator-a → BUILDER (prvo doslovno upisuje odluke
  u plan, commit „iNN: odobrenje plana i odluke Orchestrator-a”; jedan korak = jedan commit + push; testovi prije koda; kontrolne
  mutacije; bez merge-a i taga; „BUILDER ZAVRŠIO — SPREMNO ZA REVIEW”) → REVIEWER (nova sesija; SRS, brief, kod i obavezujuće odluke;
  ITERATION ACCEPTED / REJECTED) → FIX LOOP („iNN fix: R-0x …”) → ponovni review.
- P0/P1 (a po odluci i P2) idu u FIX LOOP; P3 u FIX LOOP ili backlog.
- O-29 (od i06): prije dugih run-ova laptop ne smije u sleep (`powercfg /change standby-timeout-ac 0`, poslije vratiti); prekinut run se
  ponavlja; kontrolne mutacije: deterministička 1/1, konkurentna n/10; `cd backend; npm run test:emu:ciljano -- <test/emulator/…>
  [--test-name-pattern=<obrazac>]` za razvoj i mutacije (`test:emu` i `provjera.ps1` ostaju dokaz za DoD); TEST_REPORT sažet (komanda,
  exit, tests/pass/fail, trajanje, raspodjela konkurentnih testova; jedan red po mutaciji).
- O-30 (i06, i07, i08 — BRZI REŽIM): `provjera.ps1` tačno 2× po Builder sesiji (poslije koraka koji dira zajednički kod prethodnih
  iteracija i na kraju prije PR-a), između koraka `npm test` + ciljani emulator run; samo ključni skup mutacija iz odobrenja plana;
  sažeta dokumentacija; Builder staje samo na blokerima; Reviewer 60–90 min, `provjera.ps1` 1×, bez ponavljanja Builder-ovih mutacija.
- O-31 (od Reviewer-a i06 do i11 — EKSPRESNI REŽIM, uz O-30): (a) Reviewer ne ponavlja `provjera.ps1` ako TEST_REPORT ima završni run
  na kodu X i `git diff X..<vrh PR-a>` sadrži samo `docs/*.md` i `README.md`; napadi kroz `test:emu:ciljano`; okvir 30–45 min (max 60);
  (b) checkpoint: merge, pa `git diff <vrh PR-a> main` mora biti prazno (umjesto dva `provjera.ps1`), pa anotirani tag; (c) mutacije:
  i07 ~10 ključnih, i08 ~5, Android iteracije bez mutacija; (d) smoke u i09 i i10 samo na API 35; puni NFR-09 (API 26 i API 35) u i11.
- Commit-i bez potpisa alata. Checkpoint: `provjera.ps1` → `gh pr merge N --merge` → `provjera.ps1` na main →
  `git tag -a iNN -m "…"` → `git push origin iNN`.
