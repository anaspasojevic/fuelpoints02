ITERATION BRIEF — FuelPoints — ITERACIJA 7: Brisanje naloga (API-07)

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-07 (iz main na tagu i06, merge 9aae907) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i07
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se; SHA-256 7d866413968c2445be532876e1f73ab307acffd96465c024982d458d41c60228)
Registar odluka: docs/ODLUKE.md (verzija na tagu i06) — sve odluke obavezujuće. Režim: ekspresni (O-30, O-31 — tačka 10).
Okruženje: Windows 11, PowerShell, Node.js 24 LTS, Firebase Emulator Suite (demo-fuelpoints). Repozitorijum je state, razgovor nije state.

1. CILJ
Implementirati API-07 DELETE /api/v1/account (§23): Android autentikacija + recent auth (auth_time ≤ 5 min), DELETION_IN_PROGRESS, blokada novih
loyalty mutacija, zatvaranje ACTIVE voucher-a sa REWARD_RELEASE (O-9), brisanje privatnih resursa, pseudonimizacija purchases i loyaltyLedger
(uid = null), Firebase Auth nalog briše se POSLJEDNJI; ponovljen DELETE nastavlja isti cleanup (§23.4). Uz to O-10a (retry kupovine poslije
pseudonimizacije) i obaveza (o) (test konkurentne promjene accountStatus).
Primjer (za API-T12): korisnik A: kupovine 42 730 ml (42) i 30 000 ml (30) → 72 / 0; issue CAR_WASH → 22 / 50; 2 notifikacije. DELETE → 204.
Poslije: users/A, loyaltyAccounts/A, notifikacije A, voucher-i A, rewardRequests A, redemptionRequests A ne postoje; 2 purchases i ledger
(2 EARN, RESERVE, RELEASE) postoje sa uid = null; Auth nalog A ne postoji; podaci korisnika B netaknuti (deepStrictEqual).

2. SRS ZAHTJEVI U OPSEGU
- §26 API-07, §3.3, NFR-01: postojeći napraviProvjeruTokena SAMO na ruti DELETE /account; tijelo po O-21 („без body-ја”, provjeriPraznoTijelo).
- §23 recent auth, §27 REAUTHENTICATION_REQUIRED: po O-35.
- §23.1 tok, §23.2 resursi, §23.3 historical resources, §23.4 resume: po O-32, O-34b, O-36.
- AUTH-04, AUTH-05: od trenutka upisa DELETION_IN_PROGRESS sve mutacije se odbijaju (već postoji: init 409, purchase 404 (O-10), issue / cancel /
  redeem / API-06 409); obaveza (o): deterministički test (omotacBaze.prijePokusaja) da issue, cancel i redeem ne mutiraju poslije promjene statusa.
- §16, §18.1, §19.1, §7.6, §11: zatvaranje ACTIVE voucher-a po O-9 / O-34 kroz servisi/oslobadjanjeVaucera.js (ograničenja (g), (q), (r)).
- §10, O-12, O-3: O-10a izmjena evidencijaKupovine.js (ograničenje (d)).
- NFR-04 (svaki korak konzistentan), AC-09 (RELEASE pri zatvaranju), AC-11, API-T12.
- §27 kodovi: UNAUTHENTICATED, REAUTHENTICATION_REQUIRED, INVALID_REQUEST (O-21), NOT_FOUND (O-1), INTERNAL_ERROR, SERVICE_UNAVAILABLE.

3. VAN OPSEGA
- Device registrations / FCM (nema kolekcije; §22 opciono, FCM ne radimo); Android (Delete Account ekran i reauth — i10); Rules izmjene
  (firestore.rules se ne mijenja; i08); B-1 (i08); B-2 (i09); admin, ručne korekcije; novi npm paketi; test-only kod u backend/src.
- Promjena ugovora API-01 … API-06 osim O-10a.

4. ZAVISNOSTI
i02 (init, i02/P-2, ograničenje (a)), i03 (evidencijaKupovine, O-10, O-12), i04 (rewardRequests, (f), (m)), i05 (oslobadjanjeVaucera, stanjeNaloga,
O-20, provjeriPraznoTijelo), i06 (otkupVaucera, redemptionRequests.uid, (u), omotacBaze.prijePokusaja, test:emu:ciljano, O-27).

5. ODLUKE ZA OVU ITERACIJU
- O-9 (Ana, 2026-10-19): ACTIVE voucher-i se pri brisanju zatvaraju sa REWARD_RELEASE kroz isti mehanizam (release_{voucherId}, tx.create,
  oslobadjanjeVaucera.js), u transakciji sa loyaltyAccounts; neistekao → CANCELLED + cancelledAt; zatim se voucher-i brišu (§23.2).
- O-34 (Orchestrator, dopuna O-9 radi O-5 / §18.1): ACTIVE voucher sa sadaMs ≥ expiresAt se pri brisanju zatvara kao EXPIRED + RELEASE (nikad
  CANCELLED za istekao rok). Ista transakcija kao ostali.
- O-10a (Ana, 2026-10-19): kad sačuvani purchase ima uid = null, uid se NE poredi; isti volumeMl, amountMinor, currency → prvi rezultat (200, bez
  novog EARN, bez upisa); drugačiji → 409 IDEMPOTENCY_CONFLICT; occurredAt se ne poredi (O-3). Odgovor bez uid-a (i03/P-1). Ostali slučajevi nepromijenjeni.
- O-32 (Ana, 2026-10-19): redoslijed (§23.1 + §23.4 + ograničenje (a)):
  1 users.accountStatus → DELETION_IN_PROGRESS (+ updatedAt) u transakciji (ako već jeste — preskače se);
  2 blokada mutacija (posljedica koraka 1; postojeće provjere);
  3 zatvaranje ACTIVE voucher-a (O-9, O-34) u transakciji sa loyaltyAccounts;
  4a brisanje: rewardRequests i redemptionRequests sa uid PRIJE vouchers (ograničenja (f), (m), (u)), notifications, vouchers, loyaltyAccounts;
  5 pseudonimizacija: purchases i loyaltyLedger sa uid → uid = null (samo to polje);
  4b users/{uid} kao POSLJEDNJI Firestore dokument;
  6 auth.deleteUser(uid) POSLJEDNJI.
- O-33 (Ana, 2026-10-19): uspješno završeno brisanje (prvo i nastavljeno) → 204 bez tijela.
- O-35 (Orchestrator; Planner potvrđuje): recent auth = auth_time iz VERIFIKOVANOG token-a (sekunde); dozvoljeno ako Date.now()/1000 − auth_time ≤ 300
  (granica uključiva, §23 „auth_time <= 5 min”); inače 409 REAUTHENTICATION_REQUIRED, ništa pročitano ni upisano. Važi za SVAKI DELETE, i za nastavak.
  Posrednik izlaže auth_time samo za ovu rutu (bez promjene ponašanja ostalih ruta). Redoslijed: neispravan JSON 422 → token 401 → tijelo 422 →
  recent auth 409 → tok brisanja.
- O-36 (Orchestrator): tok NIJE jedna transakcija (granice Firestore-a); svaki korak je idempotentan i ponovljiv; koraci 1 i 3 su transakcije,
  4a / 5 / 4b upiti + batch-evi ≤ 400 upisa; rok zahtjeva 10 s važi — istek → 503, stanje konzistentno, ponovljen DELETE nastavlja (§23.4, (b)).
- O-34b (Orchestrator; Planner potvrđuje ili predlaže bolje): DELETE kad users/{uid} NE postoji (pad između 4b i 6, ili nalog NOT_INITIALIZED) →
  izvršava preostale idempotentne korake nad onim što je ostalo (upiti po uid) i briše Auth nalog → 204. Ne vraća ACCOUNT_NOT_INITIALIZED, jer bi Auth
  nalog ostao zauvijek (krši „Auth posljednji” i §23.4).
- Planner analizira i predlaže (i07/P-n): prozor između 4b i 6 u kome bi API-01 init mogao ponovo kreirati users/loyaltyAccounts (verifyIdToken prolazi
  dok Auth nalog postoji); opcije + preporuka; onemogućavanje Auth naloga prije kraja NIJE dozvoljeno ako ruši autentifikovan nastavak (§23.4).
- Ugovor greške i log: uid se ne loguje; poruke statičke (I05-T02); šablon rute /account.
- O-30, O-31 važe; ključne mutacije za i07 (D 1/1): status se ne postavlja prvi; users obrisan prije pseudonimizacije; Auth obrisan prije Firestore
  cleanup-a; rewardRequests obrisan poslije vouchers; ACTIVE voucher obrisan bez RELEASE; istekao zatvoren kao CANCELLED; provjera svježine uklonjena
  ili „<” umjesto „<=”; O-10a vraćen (poređenje uid null); ledger nije pseudonimizovan; nastavak sa nepostojećim users vraća 409; DELETION provjera
  uklonjena u issue (obara test (o)).
- TRACEABILITY: §23, §26 API-07, AUTH-04/05 (i07 dio), §27 REAUTHENTICATION_REQUIRED, AC-11, AC-09, NFR-04, §10 (O-10a). ODLUKE: O-9, O-10a, O-32 …
  O-36, i07/P-n, zatvara O-9, O-10a, (a), (d), (f), (m), (o), (r), (u); §1 stanje (i06 ACCEPTED, tag i06).

6. DEFINITION OF DONE
[ ] Tačka 2 implementirana, tačka 3 ne; API-T12 i I07-Txx prolaze; regresija i01–i06 prolazi (provjera.ps1 po O-30 (a)).
[ ] Prekid poslije SVAKOG koraka (1, 3, 4a, 5, 4b, 6 — failure injection / mock) + ponovljen DELETE → isto konačno stanje kao bez prekida.
[ ] Obaveza (o): deterministički testovi za issue, cancel, redeem i purchase uz promjenu statusa usred transakcije.
[ ] Ključne mutacije D 1/1; tabela u TEST_REPORT (O-30 (d)).
[ ] Log bez uid-a i token-a za sve ishode; nema test-only koda u src/; nema novih paketa; firestore.rules nepromijenjen; SRS hash nepromijenjen.
[ ] Sažeta dokumentacija (O-30 (d)); PR iteracija-07 → main bez merge-a; commit-i bez potpisa alata.
[ ] Reviewer (O-31): ITERATION ACCEPTED → merge → git diff <vrh PR-a> main prazno → tag i07.

7. OBAVEZNI TESTOVI
- API-T12 po primjeru iz tačke 1 (sve kolekcije provjerene po uid-u i po broju dokumenata; B netaknut; Auth A ne postoji; ponovljen DELETE poslije
  prekida nastavlja).
- Recent auth: auth_time = sada − 300 s → dozvoljeno; − 301 s → 409 REAUTHENTICATION_REQUIRED, 0 pristupa bazi; i za nastavak brisanja.
- Autentikacija / tijelo: bez token-a, neispravan → 401; tijelo ≠ prazno → 422; GET / POST na /account → 404 NOT_FOUND (POST /account/init netaknut).
- O-9 / O-34: nalog 0 / 80 sa ACTIVE neistekao (50) i ACTIVE istekao (30) → CANCELLED + RELEASE i EXPIRED + RELEASE prije brisanja (ledger: 2 RELEASE
  sa uid = null na kraju); REDEEMED / CANCELLED / EXPIRED voucher-i bez novog događaja.
- O-32 redoslijed: snimak upisa (omotacBaze) dokazuje 1 → 3 → 4a (mapping-i prije vouchers) → 5 → 4b → 6.
- O-34b: users ne postoji, ostali resursi postoje (pad između) → 204, sve očišćeno, Auth obrisan; nalog NOT_INITIALIZED → 204, Auth obrisan.
- Blokade za vrijeme brisanja (status postavljen, ostalo još nije): init 409, purchase 404, issue / cancel / redeem / API-06 409, 0 upisa.
- O-10a: purchase sa uid = null + retry istog payload-a → 200 prvi rezultat, 0 upisa; drugi volumeMl → 409; regresija API-T03 / API-T04 zelena.
- Rok: istek usred toka → 503, konzistentno; ponovljen DELETE → 204.
- Log svih ishoda bez uid-a i token-a.

8. KOMANDE (PowerShell, iz korijena)
cd backend; npm test; npm run test:emu:ciljano -- <fajl>; cd ..
.\skripte\provjera.ps1; $LASTEXITCODE          # po O-30 (a): 2×
(Get-FileHash docs\srs\FuelPoints_SRS_3_1.docx -Algorithm SHA256).Hash
git diff i06 -- firebase/firestore.rules         # prazno
git grep -n "release_" -- backend/src            # kod samo u servisi/oslobadjanjeVaucera.js (komentari drugdje dozvoljeni)

9. ISPORUKA BUILDER-a: PR; kratak sažetak; testovi po ID-u; tabela mutacija; OD-n i poznata ograničenja; TRACEABILITY i ODLUKE ažurirani.

10. DOPUNA BRIEF-a (Orchestrator, 2026-10-19, poslije review-a i06)
- O-31 (Ana, 2026-10-19) — EKSPRESNI REŽIM, važi od Reviewer-a i06 do i11, uz O-30: (a) Reviewer ne ponavlja provjera.ps1 ako TEST_REPORT ima
  završni run na kodu X i git diff X..<vrh PR-a> sadrži samo docs/*.md i README.md; napadi kroz test:emu:ciljano; okvir 30–45 min (max 60);
  (b) checkpoint: merge, pa git diff <vrh PR-a> main mora biti prazno (umjesto dva provjera.ps1), pa anotirani tag; (c) mutacije: i07 ~10
  ključnih, i08 ~5, Android iteracije bez mutacija; (d) smoke u i09 i i10 samo na API 35; puni NFR-09 (API 26 i API 35) u i11.
- Builder i07 u dokumentacionom koraku upisuje O-31 u docs/ODLUKE.md (§3 i §10) — zatvara R-01 iz review-a i06; R-02, R-03, R-04 (review i06,
  NOTE) u backlog §8 bez roka; §1: i06 ITERATION ACCEPTED, tag i06 (merge PR #6, 9aae907).
- O-2 (Ana, 2026-10-19): razvoj i testovi i09–i10 nad emulatorom; pravi Firebase Spark projekat se podešava u i11 (demo i ručna provjera §3.5,
  §3.6). Builder i07 zatvara O-2 u ODLUKE §9.
- B-1 (Ana, 2026-10-19): u i08 zabrana \p{Cc} za loyaltyUid (kao i04/P-9) → 404 LOYALTY_ACCOUNT_NOT_FOUND bez pristupa bazi. Builder i07
  upisuje odluku u ODLUKE §8 (B-1 → i08).
