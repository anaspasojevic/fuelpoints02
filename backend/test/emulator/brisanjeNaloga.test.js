// DELETE /api/v1/account (§23, §23.1 … §23.4, §26 API-07, §3.3, O-9, O-21, O-32 … O-36): API-T12, I07-T02 … I07-T05, I07-T07, I07-T12.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napraviProvjeruTokena } from '../../src/posrednici/autentikacija.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { napraviNepotpisanToken } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacAutha } from '../pomocnici/omotacAutha.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { SERVIS_BRISANJA as SERVIS, SVJEZINA, napraviPripremuBrisanja, oznakaUpisa } from '../pomocnici/pripremaBrisanja.js';
import { hex64, mockSataFajla, provjeriBezInternihDetalja, provjeriTijeloGreske } from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();

let firebase;
let p;
let b;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  b = napraviPripremuBrisanja(firebase);
  ({ p } = b);
});

beforeEach(async () => {
  await ocistiEmulatore();
  await napuniRewardDefinitions(firebase.db);
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

test('API-T12 primjer A (72/0 → issue → 22/50, 2 notifikacije) → 204 bez tijela; sve A obrisano ili pseudonimizovano, Auth A ne postoji, B netaknut; ponovljen DELETE → 401 (i07/P-8)', async () => {
  const { k: A, V } = await b.pripremiKorisnikaA();
  const { k: B } = await b.pripremiKorisnikaB();
  assert.equal(await b.brojSaUid('notifications', A.uid), 2);
  const prijeA = await b.snimakPoUid(A.uid);
  const snimakB = await b.snimakPoUid(B.uid);

  const odgovor = await b.obrisi(A.idToken);
  assert.equal(odgovor.status, 204, odgovor.text);
  assert.equal(odgovor.text, '');
  assert.equal(odgovor.headers['content-type'], undefined);

  await b.provjeriObrisanA(A.uid, V, prijeA, 'prvo brisanje');
  assert.deepStrictEqual(await b.snimakPoUid(B.uid), snimakB, 'B promijenjen');
  assert.equal(await b.postojiAuth(B.uid), true, 'Auth B');

  provjeriTijeloGreske(await b.obrisi(A.idToken), 401, 'UNAUTHENTICATED', 'ponovljen DELETE poslije 204');
});

test('API-T12 nastavak (§23.4): prvi DELETE prekinut na prvom upisu K4a → 500; DELETION_IN_PROGRESS; drugi DELETE → 204 i isto konačno stanje', async () => {
  const { k: A, V } = await b.pripremiKorisnikaA();
  const { k: B } = await b.pripremiKorisnikaB();
  const prijeA = await b.snimakPoUid(A.uid);
  const snimakB = await b.snimakPoUid(B.uid);

  // Upisi: 1 users (K1), 2–4 voucher, release, loyaltyAccounts (K3), 5 prvi upis K4a.
  const omotac = omotacBaze(firebase.db, { baciNaUpisu: 5 });
  const prvi = await b.obrisi(A.idToken, { db: omotac });
  provjeriTijeloGreske(prvi, 500, 'INTERNAL_ERROR', 'prekinut DELETE');
  provjeriBezInternihDetalja(prvi, 'prekinut DELETE');
  assert.equal((await p.podaci(`users/${A.uid}`)).accountStatus, 'DELETION_IN_PROGRESS');
  assert.equal((await p.podaci(`vouchers/${V}`)).status, 'CANCELLED');
  assert.deepStrictEqual(await p.nalog(A.uid), [72, 0]);
  assert.equal(await b.postojiAuth(A.uid), true);

  const drugi = await b.obrisi(A.idToken);
  assert.equal(drugi.status, 204, drugi.text);
  assert.equal(drugi.text, '');
  await b.provjeriObrisanA(A.uid, V, prijeA, 'nastavak');
  assert.deepStrictEqual(await b.snimakPoUid(B.uid), snimakB, 'B promijenjen');
});

// Zahtjev kroz omotače: očekivana greška, nijedan pristup bazi, Auth nalog netaknut.
async function ocekujBezPristupa(k, status, kod, opis, opcije = {}) {
  const prije = await p.snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const auth = omotacAutha(firebase.auth);
  const odgovor = await b.obrisi(Object.hasOwn(opcije, 'idToken') ? opcije.idToken : k.idToken, { db: omotac, auth, ...opcije });
  provjeriTijeloGreske(odgovor, status, kod, opis);
  provjeriBezInternihDetalja(odgovor, opis);
  assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  assert.equal(auth.brisanja, 0, `${opis}: deleteUser`);
  assert.deepStrictEqual(await p.snimakBaze(), prije, `${opis}: baza promijenjena`);
  assert.equal(await b.postojiAuth(k.uid), true, `${opis}: Auth nalog`);
}

test('I07-T02 recent auth (O-35): auth_time + 300 s → 204; + 301 s i + 300 001 ms → 409 bez pristupa bazi; i za nastavak i nepostojeći users; token bez auth_time → 409', async () => {
  const k = await b.noviKorisnik();
  await b.init(k);
  await b.kupi(k.uid, 'POS-1', 10_000);
  const T = k.authTime;
  assert.ok(Number.isSafeInteger(T), 'auth_time token-a emulatora');

  mockSataFajla(mock, SVJEZINA, () => (T + 301) * 1000);
  await ocekujBezPristupa(k, 409, 'REAUTHENTICATION_REQUIRED', '301 s');
  mock.restoreAll();
  mockSataFajla(mock, SVJEZINA, () => T * 1000 + 300_001);
  await ocekujBezPristupa(k, 409, 'REAUTHENTICATION_REQUIRED', '300 001 ms');

  // Nastavak: users DELETION_IN_PROGRESS (stanje poslije K1).
  await p.referenca(`users/${k.uid}`).update({ accountStatus: 'DELETION_IN_PROGRESS' });
  await ocekujBezPristupa(k, 409, 'REAUTHENTICATION_REQUIRED', 'nastavak');
  mock.restoreAll();
  // users ne postoji (NOT_INITIALIZED); sat relativno na auth_time tog korisnika.
  const bezProfila = await b.noviKorisnik();
  mockSataFajla(mock, SVJEZINA, () => (bezProfila.authTime + 301) * 1000);
  await ocekujBezPristupa(bezProfila, 409, 'REAUTHENTICATION_REQUIRED', 'users ne postoji');
  mock.restoreAll();

  // Nepotpisan token bez auth_time (emulator ga propušta, plan 3.2 P-a) → fail closed.
  const sada = Math.floor(Date.now() / 1000);
  const bezAuthTime = napraviNepotpisanToken({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: k.uid,
    user_id: k.uid,
    iat: sada,
    exp: sada + 3600,
  });
  await ocekujBezPristupa(k, 409, 'REAUTHENTICATION_REQUIRED', 'bez auth_time', { idToken: bezAuthTime });

  // Granica uključiva: tačno 300 s → dozvoljeno (nastavak brisanja).
  const ocitano = mockSataFajla(mock, SVJEZINA, () => T * 1000 + 300_000);
  const odgovor = await b.obrisi(k.idToken);
  assert.equal(odgovor.status, 204, odgovor.text);
  assert.deepStrictEqual(ocitano, [T * 1000 + 300_000], 'jedno čitanje sata u provjeri svježine');
  assert.equal(await b.postojiAuth(k.uid), false);
  mock.restoreAll();

  // Kontrola bez mock-a.
  const kontrola = await b.noviKorisnik();
  await b.init(kontrola);
  assert.equal((await b.obrisi(kontrola.idToken)).status, 204);
  assert.equal(await b.postojiAuth(kontrola.uid), false);
});

test('I07-T03 token 401, tijelo 422 (O-21), redoslijed O-35 i nepoznate rute 404; POST /account/init netaknut; authTime samo uz opciju', async () => {
  const k = await b.noviKorisnik();
  await b.init(k);
  const sada = Math.floor(Date.now() / 1000);
  const istekao = napraviNepotpisanToken({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: k.uid,
    user_id: k.uid,
    auth_time: sada - 7200,
    iat: sada - 7200,
    exp: sada - 3600,
  });
  await ocekujBezPristupa(k, 401, 'UNAUTHENTICATED', 'bez token-a', { idToken: null });
  await ocekujBezPristupa(k, 401, 'UNAUTHENTICATED', 'Bearer abc', { idToken: 'abc' });
  await ocekujBezPristupa(k, 401, 'UNAUTHENTICATED', 'istekao', { idToken: istekao });

  const neispravnaTijela = [
    ['{"a":1}', { tijelo: { a: 1 } }],
    ['[]', { tijelo: [] }],
    ['text/plain', { tijelo: 'abc', zaglavlja: { 'Content-Type': 'text/plain' } }],
    ['form', { tijelo: 'a=1', zaglavlja: { 'Content-Type': 'application/x-www-form-urlencoded' } }],
  ];
  for (const [opis, opcije] of neispravnaTijela) {
    await ocekujBezPristupa(k, 422, 'INVALID_REQUEST', opis, opcije);
  }
  // Globalni parser prije token-a: neispravan JSON i null → 422 bez token-a.
  await ocekujBezPristupa(k, 422, 'INVALID_REQUEST', 'neispravan JSON', { idToken: null, tijelo: '{', zaglavlja: { 'Content-Type': 'application/json' } });
  await ocekujBezPristupa(k, 422, 'INVALID_REQUEST', 'null', { idToken: null, tijelo: 'null', zaglavlja: { 'Content-Type': 'application/json' } });
  // Redoslijed: token prije tijela, tijelo prije svježine.
  await ocekujBezPristupa(k, 401, 'UNAUTHENTICATED', 'objekat bez token-a', { idToken: null, tijelo: { a: 1 } });
  mockSataFajla(mock, SVJEZINA, () => (k.authTime + 301) * 1000);
  await ocekujBezPristupa(k, 422, 'INVALID_REQUEST', 'tijelo + star auth_time', { tijelo: { a: 1 } });
  mock.restoreAll();

  for (const [opis, metod, putanja] of [
    ['GET /account', 'get', '/api/v1/account'],
    ['POST /account', 'post', '/api/v1/account'],
    ['PUT /account', 'put', '/api/v1/account'],
    ['DELETE /account/init', 'delete', '/api/v1/account/init'],
  ]) {
    await ocekujBezPristupa(k, 404, 'NOT_FOUND', opis, { metod, putanja });
  }

  // Ispravni oblici bez tijela (svaki na novom korisniku): bez tijela, Content-Length: 0, {}.
  for (const [opis, opcije] of [
    ['bez tijela', {}],
    ['Content-Length: 0', { zaglavlja: { 'Content-Length': '0' } }],
    ['{}', { tijelo: {} }],
  ]) {
    const novi = await b.noviKorisnik();
    await b.init(novi);
    const odgovor = await b.obrisi(novi.idToken, opcije);
    assert.equal(odgovor.status, 204, `${opis}: ${odgovor.text}`);
    assert.equal(await b.postojiAuth(novi.uid), false, opis);
  }

  // POST /account/init netaknut (posrednik DELETE /account se ne veže na prefiks).
  const zaInit = await b.noviKorisnik();
  await b.init(zaInit);

  // Posrednik izlaže auth_time samo uz opciju (O-35 „samo za ovu rutu”).
  const app = b.aplikacija({
    dodajRute(ruter) {
      ruter.get('/test-bez-opcije', napraviProvjeruTokena(firebase.auth), (req, res) => {
        res.json({ ima: Object.hasOwn(res.locals, 'authTime') });
      });
      ruter.get('/test-sa-opcijom', napraviProvjeruTokena(firebase.auth, { izloziAuthTime: true }), (req, res) => {
        res.json({ authTime: res.locals.authTime });
      });
    },
  });
  const bez = await request(app).get('/api/v1/test-bez-opcije').set('Authorization', `Bearer ${zaInit.idToken}`);
  assert.deepStrictEqual(bez.body, { ima: false });
  const sa = await request(app).get('/api/v1/test-sa-opcijom').set('Authorization', `Bearer ${zaInit.idToken}`);
  assert.deepStrictEqual(sa.body, { authTime: zaInit.authTime });
});

test('I07-T04 (O-9, O-34) nalog 0/80: ACTIVE neistekao (50) → CANCELLED + RELEASE, ACTIVE istekao (30) → EXPIRED + RELEASE; terminalni bez novog događaja', async () => {
  const k = await b.noviKorisnik();
  const uid = k.uid;
  const sadaPrije = Date.now();
  const [V1, V2, V3, V4, V5] = [hex64(), hex64(), hex64(), hex64(), hex64()];
  await p.pripremiNalog(uid, 0, 80);
  await p.pripremiVaucer(V1, uid, { costPoints: 50, expiresAtMs: sadaPrije + 600_000 });
  await p.pripremiReserve(V1, uid, 50, 30, 50);
  await p.pripremiVaucer(V2, uid, { costPoints: 30, expiresAtMs: sadaPrije - 60_000 });
  await p.pripremiReserve(V2, uid, 30, 0, 80);
  const ts = Timestamp.fromMillis(sadaPrije - 300_000);
  await p.pripremiVaucer(V3, uid, { costPoints: 30, status: 'REDEEMED', expiresAtMs: sadaPrije - 120_000, redeemedAt: ts, redeemedAtStationId: 'SIM01' });
  await p.pripremiVaucer(V4, uid, { costPoints: 30, status: 'CANCELLED', expiresAtMs: sadaPrije - 120_000, cancelledAt: ts });
  await p.pripremiVaucer(V5, uid, { costPoints: 30, status: 'EXPIRED', expiresAtMs: sadaPrije - 120_000 });
  await p.pripremiRelease(V4, uid, 30, 0, 0);
  await p.pripremiRelease(V5, uid, 30, 0, 0);
  const dogadjajiTerminalnih = async () => (await firebase.db.collection('loyaltyLedger').where('voucherId', 'in', [V3, V4, V5]).get()).size;
  const terminalniPrije = await dogadjajiTerminalnih();

  const S = Date.now();
  mockSataFajla(mock, SERVIS, () => S);
  // Upisi: 1 users, 2–5 (voucher, release) × 2, 6 loyaltyAccounts, 7 prvi upis K4a.
  const prvi = await b.obrisi(k.idToken, { db: omotacBaze(firebase.db, { baciNaUpisu: 7 }) });
  provjeriTijeloGreske(prvi, 500, 'INTERNAL_ERROR', 'prekid poslije K3');
  mock.restoreAll();

  const v1 = await p.podaci(`vouchers/${V1}`);
  assert.equal(v1.status, 'CANCELLED');
  assert.equal(v1.cancelledAt.toMillis(), S, 'cancelledAt = sat pokušaja K3');
  const v2 = await p.podaci(`vouchers/${V2}`);
  assert.equal(v2.status, 'EXPIRED');
  assert.equal(v2.cancelledAt, null, 'istekao nema cancelledAt');
  assert.deepStrictEqual(await p.nalog(uid), [80, 0]);
  const r2 = await p.podaci(`loyaltyLedger/release_${V2}`);
  const r1 = await p.podaci(`loyaltyLedger/release_${V1}`);
  assert.deepStrictEqual([r2.availableAfter, r2.reservedAfter, r2.deltaAvailable, r2.uid], [30, 50, 30, uid], 'release V2 prvi (poredakOslobadjanja)');
  assert.deepStrictEqual([r1.availableAfter, r1.reservedAfter, r1.deltaAvailable, r1.uid], [80, 0, 50, uid], 'release V1 drugi');
  assert.equal(await dogadjajiTerminalnih(), terminalniPrije, 'novi događaj za terminalni voucher');
  for (const [V, status] of [[V3, 'REDEEMED'], [V4, 'CANCELLED'], [V5, 'EXPIRED']]) {
    assert.equal((await p.podaci(`vouchers/${V}`)).status, status);
  }

  const drugi = await b.obrisi(k.idToken);
  assert.equal(drugi.status, 204, drugi.text);
  const releaseNull = await firebase.db.collection('loyaltyLedger').where('uid', '==', null).where('type', '==', 'REWARD_RELEASE').get();
  assert.deepStrictEqual(releaseNull.docs.map((d) => d.id).sort(), [V1, V2, V4, V5].map((V) => `release_${V}`).sort(), 'RELEASE sa uid null');
  assert.equal(await b.brojSaUid('vouchers', uid), 0);
});

test('I07-T04 granica isteka u K3 (§18.1): sadaMs === expiresAt → EXPIRED; expiresAt − 1 → CANCELLED', async () => {
  for (const [pomak, status] of [[0, 'EXPIRED'], [-1, 'CANCELLED']]) {
    const k = await b.noviKorisnik();
    const V = hex64();
    const E = Date.now() - 1000;
    await p.pripremiNalog(k.uid, 0, 50);
    await p.pripremiVaucer(V, k.uid, { costPoints: 50, expiresAtMs: E });
    await p.pripremiReserve(V, k.uid, 50, 0, 50);
    mockSataFajla(mock, SERVIS, () => E + pomak);
    const odgovor = await b.obrisi(k.idToken, { db: omotacBaze(firebase.db, { baciNaUpisu: 5 }) });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `pomak ${pomak}`);
    mock.restoreAll();
    const vaucer = await p.podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, status, `pomak ${pomak}`);
    assert.equal(vaucer.cancelledAt === null ? null : vaucer.cancelledAt.toMillis(), status === 'CANCELLED' ? E - 1 : null);
    assert.equal((await b.obrisi(k.idToken)).status, 204);
  }
});

test('I07-T05 (O-32) redoslijed upisa: users → zatvaranje voucher-a → mapping-i → notifications → vouchers → loyaltyAccounts → purchases → ledger → users → deleteUser', async () => {
  const { k: A, V } = await b.pripremiKorisnikaA();
  await b.otkupi(V, 'POS-RDM-1');
  await b.kupi(A.uid, 'POS-A3', 30_000);
  const V2 = await b.izdaj(A, 'SHOWER');
  assert.deepStrictEqual(await p.nalog(A.uid), [22, 30]);

  const dnevnik = [];
  const omotac = omotacBaze(firebase.db, { dnevnik });
  const auth = omotacAutha(firebase.auth, { dnevnik });
  const odgovor = await b.obrisi(A.idToken, { db: omotac, auth });
  assert.equal(odgovor.status, 204, odgovor.text);

  const niz = dnevnik.map(oznakaUpisa);
  const puta = (stavka, n) => Array.from({ length: n }, () => stavka);
  assert.deepStrictEqual(niz, [
    'update users',
    'update vouchers',
    'create loyaltyLedger',
    'update loyaltyAccounts',
    ...puta('batch.delete rewardRequests', 2),
    'batch.delete redemptionRequests',
    ...puta('batch.delete notifications', 3),
    ...puta('batch.delete vouchers', 2),
    'batch.delete loyaltyAccounts',
    ...puta('batch.update purchases', 3),
    ...puta('batch.update loyaltyLedger', 7),
    'delete users',
    'deleteUser',
  ]);
  assert.equal(dnevnik[1].putanja, `vouchers/${V2}`, 'zatvoren je ACTIVE voucher');
  assert.equal(dnevnik[2].putanja, `loyaltyLedger/release_${V2}`);
  assert.equal(await b.postojiAuth(A.uid), false);
});

test('I07-T07 (O-34b) pad između K4b i K6 → 500, nastavak → 204 samo deleteUser; users obrisan uz ostatke → 204 sve očišćeno; NOT_INITIALIZED → 204', async () => {
  // (a) deleteUser pada poslije K4b.
  const { k: A } = await b.pripremiKorisnikaA();
  const prvi = await b.obrisi(A.idToken, { auth: omotacAutha(firebase.auth, { baciNaBrisanju: true }) });
  provjeriTijeloGreske(prvi, 500, 'INTERNAL_ERROR', 'deleteUser pao');
  provjeriBezInternihDetalja(prvi, 'deleteUser pao');
  assert.equal(await p.podaci(`users/${A.uid}`), undefined);
  assert.equal(await b.postojiAuth(A.uid), true);
  let dnevnik = [];
  let odgovor = await b.obrisi(A.idToken, { db: omotacBaze(firebase.db, { dnevnik }), auth: omotacAutha(firebase.auth, { dnevnik }) });
  assert.equal(odgovor.status, 204, odgovor.text);
  assert.deepStrictEqual(dnevnik, [{ metod: 'deleteUser' }], 'nastavak: samo deleteUser');
  assert.equal(await b.postojiAuth(A.uid), false);

  // (b) users obrisan, ostali resursi (terminalni voucher, notifikacije, purchases, nalog) postoje.
  await ocistiEmulatore();
  await napuniRewardDefinitions(firebase.db);
  const { k: A2, V } = await b.pripremiKorisnikaA();
  await b.otkazi(A2, V);
  const prije = await b.snimakPoUid(A2.uid);
  await p.referenca(`users/${A2.uid}`).delete();
  odgovor = await b.obrisi(A2.idToken);
  assert.equal(odgovor.status, 204, odgovor.text);
  await b.provjeriObrisanA(A2.uid, V, prije, 'users ne postoji');

  // (c) NOT_INITIALIZED: samo Auth nalog.
  const k = await b.noviKorisnik();
  dnevnik = [];
  odgovor = await b.obrisi(k.idToken, { db: omotacBaze(firebase.db, { dnevnik }), auth: omotacAutha(firebase.auth, { dnevnik }) });
  assert.equal(odgovor.status, 204, odgovor.text);
  assert.deepStrictEqual(dnevnik, [{ metod: 'deleteUser' }], 'NOT_INITIALIZED: samo deleteUser');
  assert.equal(await b.postojiAuth(k.uid), false);
});

test('I07-T12 (ODLUKE §5, O-27) nekonzistentno stanje → 500 bez stack-a, Auth postoji; kontrola → 204', async () => {
  async function ocekuj500(k, opis, ocekivaniUpisi) {
    const omotac = omotacBaze(firebase.db);
    const auth = omotacAutha(firebase.auth);
    const odgovor = await b.obrisi(k.idToken, { db: omotac, auth });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi.map(oznakaUpisa), ocekivaniUpisi, `${opis}: upisi`);
    assert.equal(auth.brisanja, 0, `${opis}: deleteUser`);
    assert.equal(await b.postojiAuth(k.uid), true, `${opis}: Auth`);
  }
  async function saVaucerom({ available = 0, reserved = 50, izmjena = {}, bezNaloga = false, release = false } = {}) {
    const k = await b.noviKorisnik();
    const V = hex64();
    await p.pripremiNalog(k.uid, available, reserved);
    await p.pripremiVaucer(V, k.uid, { costPoints: 50, expiresAtMs: Date.now() + 600_000 });
    await p.pripremiReserve(V, k.uid, 50, available, reserved);
    if (Object.keys(izmjena).length > 0) {
      await p.referenca(`vouchers/${V}`).update(izmjena);
    }
    if (bezNaloga) {
      await p.referenca(`loyaltyAccounts/${k.uid}`).delete();
    }
    if (release) {
      await p.pripremiRelease(V, k.uid, 50, 50, 0);
    }
    return k;
  }

  const nepoznat = await b.noviKorisnik();
  await p.pripremiNalog(nepoznat.uid, 0, 0, 'NEPOZNAT');
  await ocekuj500(nepoznat, 'accountStatus van enum-a', []);
  assert.equal((await p.podaci(`users/${nepoznat.uid}`)).accountStatus, 'NEPOZNAT');

  await ocekuj500(await saVaucerom({ release: true }), 'release_ postoji', ['update users']);
  await ocekuj500(await saVaucerom({ izmjena: { cancelledAt: Timestamp.now() } }), 'O-27 ACTIVE sa cancelledAt', ['update users']);
  await ocekuj500(await saVaucerom({ bezNaloga: true }), 'ACTIVE bez loyaltyAccounts', ['update users']);
  await ocekuj500(await saVaucerom({ reserved: 20 }), 'reservedPoints 20 < 50', ['update users']);

  const kontrola = await saVaucerom();
  assert.equal((await b.obrisi(kontrola.idToken)).status, 204);
  assert.equal(await b.postojiAuth(kontrola.uid), false);
});
