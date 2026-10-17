// POST /api/v1/rewards/{rewardId}/issue (§12 … §18, §26 API-03, O-14, O-15, O-16, D-4):
// API-T05, API-T06, I04-T01 … I04-T09 (emulator dio), I04-T03 (b).
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VOUCHER_ID = /^[0-9a-f]{64}$/;
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const KLJUCEVI_ODGOVORA = ['voucherId', 'rewardId', 'costPoints', 'status', 'issuedAt', 'expiresAt'];
const KLJUCEVI_VAUCERA = [
  'cancelledAt',
  'costPoints',
  'expiresAt',
  'issuedAt',
  'redeemedAt',
  'redeemedAtStationId',
  'rewardId',
  'status',
  'uid',
];
const KLJUCEVI_LEDGER = [
  'availableAfter',
  'createdAt',
  'deltaAvailable',
  'deltaReserved',
  'purchaseId',
  'reservedAfter',
  'type',
  'uid',
  'voucherId',
];
const KLJUCEVI_MAPPINGA = ['createdAt', 'requestId', 'rewardId', 'uid', 'voucherId'];
const KLJUCEVI_NALOGA = ['availablePoints', 'createdAt', 'reservedPoints', 'updatedAt'];
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const TRAJANJE_MS = 900_000;

let firebase;
let brojac = 0;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
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

function aplikacija(db = firebase.db) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' });
}

// rewardId je sirov segment putanje (može biti percent-kodiran).
function izdaj(rewardId, tijelo, { token, db, app } = {}) {
  const zahtjev = request(app ?? aplikacija(db)).post(`/api/v1/rewards/${rewardId}/issue`);
  if (token !== undefined) {
    zahtjev.set('Authorization', `Bearer ${token}`);
  }
  return zahtjev.send(tijelo);
}

// sirovo === undefined → bez tijela; contentType null → bez Content-Type zaglavlja.
function izdajSirovo(rewardId, sirovo, { token, db, contentType = 'application/json' } = {}) {
  const zahtjev = request(aplikacija(db)).post(`/api/v1/rewards/${rewardId}/issue`);
  if (token !== undefined) {
    zahtjev.set('Authorization', `Bearer ${token}`);
  }
  if (contentType !== null) {
    zahtjev.set('Content-Type', contentType);
  }
  return sirovo === undefined ? zahtjev : zahtjev.send(sirovo);
}

// §14 nezavisno od src/: SHA-256 hex nad UTF-8 uid + ":" + requestId.
function kljucZahtjeva(uid, requestId) {
  return createHash('sha256').update(Buffer.from(`${uid}:${requestId}`, 'utf8')).digest('hex');
}

async function korisnik() {
  brojac += 1;
  return napraviKorisnika(`izdavanje${brojac}@primjer.test`);
}

function provjeriTijeloGreske(odgovor, status, kod, opis = '') {
  assert.equal(odgovor.status, status, `${opis}: status (tijelo ${odgovor.text})`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
}

function provjeriBezInternihDetalja(odgovor, opis = '') {
  for (const zabranjeno of ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno', 'availablePoints', 'reservedPoints']) {
    assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
  }
}

function referenca(putanja) {
  return firebase.db.doc(putanja);
}

async function podaci(putanja) {
  const snimak = await referenca(putanja).get();
  return snimak.exists ? snimak.data() : undefined;
}

async function brojDokumenata(kolekcija) {
  return (await firebase.db.collection(kolekcija).get()).size;
}

// Svi dokumenti u bazi kao { putanja: data() }, za poređenje „ništa promijenjeno”.
async function snimakBaze() {
  const rezultat = {};
  for (const kolekcija of await firebase.db.listCollections()) {
    for (const dokument of (await kolekcija.get()).docs) {
      rezultat[dokument.ref.path] = dokument.data();
    }
  }
  return rezultat;
}

function kanonskiKorisnik(accountStatus = 'ACTIVE') {
  return {
    displayName: 'Ana',
    accountStatus,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  };
}

function kanonskiNalog(availablePoints, reservedPoints) {
  return { availablePoints, reservedPoints, createdAt: VRIJEME_PRIPREME, updatedAt: VRIJEME_PRIPREME };
}

// korisnik: objekat users dokumenta ili null (ne postoji); nalog: objekat loyaltyAccounts dokumenta ili null.
async function postaviNalog(uid, { korisnikDok = kanonskiKorisnik(), nalogDok = kanonskiNalog(50, 0) } = {}) {
  if (korisnikDok === null) {
    await referenca(`users/${uid}`).delete();
  } else {
    await referenca(`users/${uid}`).set(korisnikDok);
  }
  if (nalogDok === null) {
    await referenca(`loyaltyAccounts/${uid}`).delete();
  } else {
    await referenca(`loyaltyAccounts/${uid}`).set(nalogDok);
  }
}

async function pripremiNalog(uid, availablePoints, reservedPoints) {
  await postaviNalog(uid, { nalogDok: kanonskiNalog(availablePoints, reservedPoints) });
}

function kanonskiVaucer(uid, { rewardId = 'CAR_WASH', costPoints = 50, status = 'ACTIVE', expiresAtMs }) {
  return {
    uid,
    rewardId,
    costPoints,
    status,
    issuedAt: Timestamp.fromMillis(expiresAtMs - TRAJANJE_MS),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    redeemedAt: null,
    cancelledAt: null,
    redeemedAtStationId: null,
  };
}

async function pripremiVaucer(voucherId, uid, opcije) {
  await referenca(`vouchers/${voucherId}`).set(kanonskiVaucer(uid, opcije));
}

async function nalog(uid) {
  const n = await podaci(`loyaltyAccounts/${uid}`);
  return [n.availablePoints, n.reservedPoints];
}

async function dogadjajiKorisnika(uid) {
  return (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).get()).docs;
}

test('API-T05 49 available → CAR_WASH (50) → 409 INSUFFICIENT_POINTS, stanje nepromijenjeno, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 49, 0);
  const prije = await snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await izdaj('CAR_WASH', { requestId: randomUUID() }, { token: idToken, db: omotac });
  provjeriTijeloGreske(odgovor, 409, 'INSUFFICIENT_POINTS', 'API-T05');
  provjeriBezInternihDetalja(odgovor, 'API-T05');
  assert.deepStrictEqual(omotac.upisi, []);
  assert.deepStrictEqual(await snimakBaze(), prije);
  assert.equal(await brojDokumenata('vouchers'), 0);
  assert.equal(await brojDokumenata('rewardRequests'), 0);
  assert.equal(await brojDokumenata('loyaltyLedger'), 0);
});

test('API-T06 50 available → CAR_WASH → 201: rezervacija, ACTIVE voucher, REWARD_RESERVE i mapping tačnih polja; retry → 200 isti voucher', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 50, 0);
  const requestId = randomUUID();
  const prije = Date.now();
  const odgovor = await izdaj('CAR_WASH', { requestId }, { token: idToken });
  const poslije = Date.now();
  assert.equal(odgovor.status, 201, odgovor.text);

  // Ugovor (i04/P-1): tačno šest ključeva tim redoslijedom.
  assert.deepStrictEqual(Object.keys(odgovor.body), KLJUCEVI_ODGOVORA);
  const { voucherId } = odgovor.body;
  assert.match(voucherId, VOUCHER_ID);
  assert.equal(odgovor.body.rewardId, 'CAR_WASH');
  assert.equal(odgovor.body.costPoints, 50);
  assert.equal(odgovor.body.status, 'ACTIVE');
  assert.match(odgovor.body.issuedAt, ISO_UTC);
  assert.match(odgovor.body.expiresAt, ISO_UTC);

  // §15, §17
  const vaucer = await podaci(`vouchers/${voucherId}`);
  assert.deepStrictEqual(Object.keys(vaucer).sort(), KLJUCEVI_VAUCERA);
  assert.equal(vaucer.uid, uid);
  assert.equal(vaucer.rewardId, 'CAR_WASH');
  assert.equal(vaucer.costPoints, 50);
  assert.equal(vaucer.status, 'ACTIVE');
  assert.equal(vaucer.redeemedAt, null);
  assert.equal(vaucer.cancelledAt, null);
  assert.equal(vaucer.redeemedAtStationId, null);
  assert.ok(vaucer.issuedAt instanceof Timestamp);
  assert.ok(vaucer.expiresAt instanceof Timestamp);
  assert.equal(vaucer.expiresAt.toMillis() - vaucer.issuedAt.toMillis(), 900_000);
  assert.ok(vaucer.issuedAt.toMillis() >= prije - 5000 && vaucer.issuedAt.toMillis() <= poslije + 5000, 'issuedAt van intervala');
  assert.equal(odgovor.body.issuedAt, vaucer.issuedAt.toDate().toISOString());
  assert.equal(odgovor.body.expiresAt, vaucer.expiresAt.toDate().toISOString());

  // §11, §7.4
  const reserve = await podaci(`loyaltyLedger/reserve_${voucherId}`);
  assert.deepStrictEqual(Object.keys(reserve).sort(), KLJUCEVI_LEDGER);
  assert.equal(reserve.uid, uid);
  assert.equal(reserve.type, 'REWARD_RESERVE');
  assert.equal(reserve.deltaAvailable, -50);
  assert.equal(reserve.deltaReserved, 50);
  assert.equal(reserve.availableAfter, 0);
  assert.equal(reserve.reservedAfter, 50);
  assert.equal(reserve.purchaseId, null);
  assert.equal(reserve.voucherId, voucherId);
  assert.ok(reserve.createdAt instanceof Timestamp);

  // §13.2: balance i updatedAt
  const stanjeNaloga = await podaci(`loyaltyAccounts/${uid}`);
  assert.deepStrictEqual(Object.keys(stanjeNaloga).sort(), KLJUCEVI_NALOGA);
  assert.equal(stanjeNaloga.availablePoints, 0);
  assert.equal(stanjeNaloga.reservedPoints, 50);
  assert.ok(stanjeNaloga.createdAt.isEqual(VRIJEME_PRIPREME));
  assert.ok(stanjeNaloga.updatedAt.isEqual(reserve.createdAt), 'updatedAt ≠ ledger createdAt');

  // §14: mapping pod ključem izračunatim u testu
  const mapping = await podaci(`rewardRequests/${kljucZahtjeva(uid, requestId)}`);
  assert.ok(mapping, 'mapping ne postoji pod SHA-256(uid:requestId)');
  assert.deepStrictEqual(Object.keys(mapping).sort(), KLJUCEVI_MAPPINGA);
  assert.equal(mapping.uid, uid);
  assert.equal(mapping.requestId, requestId);
  assert.equal(mapping.rewardId, 'CAR_WASH');
  assert.equal(mapping.voucherId, voucherId);
  assert.ok(mapping.createdAt.isEqual(reserve.createdAt));

  assert.equal(await brojDokumenata('vouchers'), 1);
  assert.equal(await brojDokumenata('rewardRequests'), 1);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);

  // Retry istog requestId (O-16, §14): 200, isto tijelo, ništa upisano.
  const stanje = await snimakBaze();
  for (let i = 0; i < 2; i += 1) {
    const omotac = omotacBaze(firebase.db);
    const retry = await izdaj('CAR_WASH', { requestId }, { token: idToken, db: omotac });
    assert.equal(retry.status, 200, retry.text);
    assert.deepStrictEqual(retry.body, odgovor.body);
    assert.deepStrictEqual(Object.keys(retry.body), KLJUCEVI_ODGOVORA);
    assert.deepStrictEqual(omotac.upisi, [], 'retry je pokušao upis');
    assert.deepStrictEqual(await snimakBaze(), stanje);
  }
  assert.equal(await brojDokumenata('vouchers'), 1);
  assert.equal(await brojDokumenata('rewardRequests'), 1);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  const [dostupno, rezervisano] = await nalog(uid);
  assert.ok(dostupno >= 0 && rezervisano >= 0);
});

test('I04-T01 bez token-a, neispravan token, druga šema, token u query-ju → 401 UNAUTHENTICATED, 0 pristupa bazi', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 50, 0);
  const prije = await snimakBaze();
  const tijelo = { requestId: randomUUID() };
  const slucajevi = [
    ['bez Authorization', (z) => z],
    ['Bearer neispravan', (z) => z.set('Authorization', 'Bearer neispravan')],
    ['Basic <token>', (z) => z.set('Authorization', `Basic ${idToken}`)],
    ['Bearer bez token-a', (z) => z.set('Authorization', 'Bearer ')],
  ];
  for (const [opis, podesi] of slucajevi) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await podesi(request(aplikacija(omotac)).post('/api/v1/rewards/CAR_WASH/issue')).send(tijelo);
    provjeriTijeloGreske(odgovor, 401, 'UNAUTHENTICATED', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  const omotac = omotacBaze(firebase.db);
  const uQueryju = await request(aplikacija(omotac)).post(`/api/v1/rewards/CAR_WASH/issue?token=${idToken}`).send(tijelo);
  provjeriTijeloGreske(uQueryju, 401, 'UNAUTHENTICATED', 'token u query-ju');
  assert.equal(omotac.brojPristupa, 0);
  assert.deepStrictEqual(await snimakBaze(), prije);
});

test('I04-T01 UID samo iz token-a: ?uid=<B> i X-User-Id: <B> se ignorišu → voucher korisnika A, ništa za B', async () => {
  const a = await korisnik();
  const b = await korisnik();
  await pripremiNalog(a.uid, 50, 0);
  await pripremiNalog(b.uid, 50, 0);
  const nalogB = await podaci(`loyaltyAccounts/${b.uid}`);
  const requestId = randomUUID();
  const odgovor = await request(aplikacija())
    .post(`/api/v1/rewards/CAR_WASH/issue?uid=${b.uid}`)
    .set('Authorization', `Bearer ${a.idToken}`)
    .set('X-User-Id', b.uid)
    .send({ requestId });
  assert.equal(odgovor.status, 201, odgovor.text);
  assert.equal((await podaci(`vouchers/${odgovor.body.voucherId}`)).uid, a.uid);
  assert.deepStrictEqual(await nalog(a.uid), [0, 50]);
  assert.deepStrictEqual(await podaci(`loyaltyAccounts/${b.uid}`), nalogB);
  assert.ok(await podaci(`rewardRequests/${kljucZahtjeva(a.uid, requestId)}`));
  assert.equal(await podaci(`rewardRequests/${kljucZahtjeva(b.uid, requestId)}`), undefined);
  assert.equal((await firebase.db.collection('vouchers').where('uid', '==', b.uid).get()).size, 0);
  assert.equal((await dogadjajiKorisnika(b.uid)).length, 0);
});

test('I04-T02 (b) neispravno tijelo ili requestId sa važećim token-om → 422 INVALID_REQUEST, 0 pristupa bazi; neispravan JSON bez token-a → 422', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 50, 0);
  const prije = await snimakBaze();
  const R = randomUUID();
  const slucajevi = [
    ['nedostaje requestId', JSON.stringify({})],
    ['velika slova', JSON.stringify({ requestId: R.toUpperCase() })],
    ['v1', JSON.stringify({ requestId: 'c232ab00-9414-11ec-b3c8-9f6bdeced846' })],
    ['nil UUID', JSON.stringify({ requestId: '00000000-0000-0000-0000-000000000000' })],
    ['costPoints u tijelu', JSON.stringify({ requestId: R, costPoints: 1 })],
    ['voucherId u tijelu', JSON.stringify({ requestId: R, voucherId: 'a'.repeat(64) })],
    ['uid u tijelu', JSON.stringify({ requestId: R, uid })],
    ['__proto__ (sirov JSON)', `{"requestId":"${R}","__proto__":{"costPoints":1}}`],
    ['niz', '[]'],
    ['null', 'null'],
  ];
  for (const [opis, sirovo] of slucajevi) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdajSirovo('CAR_WASH', sirovo, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  for (const [opis, sirovo, contentType] of [
    ['text/plain', JSON.stringify({ requestId: R }), 'text/plain'],
    ['bez tijela', undefined, null],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdajSirovo('CAR_WASH', sirovo, { token: idToken, db: omotac, contentType });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  const omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(
    await izdajSirovo('CAR_WASH', '{neispravan', { db: omotac }),
    422,
    'INVALID_REQUEST',
    'neispravan JSON bez token-a',
  );
  // Redoslijed (i04/P-7): tijelo prije formata rewardId.
  provjeriTijeloGreske(
    await izdaj('__x__', { nepoznato: 1 }, { token: idToken, db: omotac }),
    422,
    'INVALID_REQUEST',
    'nepoznato polje + rewardId __x__',
  );
  assert.equal(omotac.brojPristupa, 0);
  assert.deepStrictEqual(await snimakBaze(), prije);
  assert.equal(await brojDokumenata('vouchers'), 0);
});

test('I04-T03 (b) nepostojeći rewardId ispravnog formata → 404 REWARD_NOT_FOUND, ništa upisano ni reconcile-ovano', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 50);
  await pripremiVaucer('e'.repeat(64), uid, { expiresAtMs: Date.now() - 60_000 });
  const prije = await snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await izdaj('FOO', { requestId: randomUUID() }, { token: idToken, db: omotac });
  provjeriTijeloGreske(odgovor, 404, 'REWARD_NOT_FOUND', 'FOO');
  assert.deepStrictEqual(omotac.upisi, []);
  assert.deepStrictEqual(await snimakBaze(), prije);
  assert.equal((await podaci(`vouchers/${'e'.repeat(64)}`)).status, 'ACTIVE');
});

test('I04-T03 (b) neispravan format rewardId (D-4) → 404 REWARD_NOT_FOUND bez pristupa bazi; GET i POST bez /issue → 404 NOT_FOUND', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 50, 0);
  const prije = await snimakBaze();
  for (const rewardId of ['a%2Fb', '__x__', '%2E%2E', '%2E', 'x'.repeat(129), 'a%00b', '%00', '%0A', 'a%7Fb']) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdaj(rewardId, { requestId: randomUUID() }, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 404, 'REWARD_NOT_FOUND', rewardId);
    assert.equal(omotac.brojPristupa, 0, `${rewardId}: pristup bazi`);
  }
  // Posrednik je vezan samo na POST /rewards/:rewardId/issue, ne na prefiks /rewards.
  provjeriTijeloGreske(await request(aplikacija()).get('/api/v1/rewards/CAR_WASH/issue'), 404, 'NOT_FOUND', 'GET issue');
  provjeriTijeloGreske(
    await request(aplikacija()).post('/api/v1/rewards/CAR_WASH').send({ requestId: randomUUID() }),
    404,
    'NOT_FOUND',
    'POST /rewards/CAR_WASH',
  );
  assert.deepStrictEqual(await snimakBaze(), prije);
});

test('I04-T04 stanje naloga → 409 ACCOUNT_NOT_INITIALIZED / ACCOUNT_DELETION_IN_PROGRESS ili 500; ništa upisano, ni reconcile', async () => {
  const { uid, idToken } = await korisnik();
  const V = 'e'.repeat(64);
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
  const slucajevi = [
    ['users i loyaltyAccounts ne postoje', null, null, 409, 'ACCOUNT_NOT_INITIALIZED'],
    ['users ACTIVE bez loyaltyAccounts', kanonskiKorisnik(), null, 409, 'ACCOUNT_NOT_INITIALIZED'],
    ['loyaltyAccounts bez users', null, kanonskiNalog(100, 50), 409, 'ACCOUNT_NOT_INITIALIZED'],
    ['DELETION_IN_PROGRESS + loyaltyAccounts', kanonskiKorisnik('DELETION_IN_PROGRESS'), kanonskiNalog(100, 50), 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    ['DELETION_IN_PROGRESS bez loyaltyAccounts', kanonskiKorisnik('DELETION_IN_PROGRESS'), null, 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    ['accountStatus NEPOZNAT + loyaltyAccounts', kanonskiKorisnik('NEPOZNAT'), kanonskiNalog(100, 50), 500, 'INTERNAL_ERROR'],
    ['accountStatus NEPOZNAT bez loyaltyAccounts', kanonskiKorisnik('NEPOZNAT'), null, 500, 'INTERNAL_ERROR'],
    ['availablePoints -1', kanonskiKorisnik(), { ...kanonskiNalog(100, 50), availablePoints: -1 }, 500, 'INTERNAL_ERROR'],
    ["availablePoints '50'", kanonskiKorisnik(), { ...kanonskiNalog(100, 50), availablePoints: '50' }, 500, 'INTERNAL_ERROR'],
    ['availablePoints 1.5', kanonskiKorisnik(), { ...kanonskiNalog(100, 50), availablePoints: 1.5 }, 500, 'INTERNAL_ERROR'],
    ['reservedPoints null', kanonskiKorisnik(), { ...kanonskiNalog(100, 50), reservedPoints: null }, 500, 'INTERNAL_ERROR'],
  ];
  for (const [opis, korisnikDok, nalogDok, status, kod] of slucajevi) {
    await postaviNalog(uid, { korisnikDok, nalogDok });
    const prije = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdaj('SHOWER', { requestId: randomUUID() }, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, status, kod, opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
    assert.equal((await podaci(`vouchers/${V}`)).status, 'ACTIVE', opis);
  }
  assert.equal(await brojDokumenata('loyaltyLedger'), 0);
  assert.equal(await brojDokumenata('rewardRequests'), 0);
});

test('I04-T05 nagrada: active false → 409 REWARD_INACTIVE; neispravna definicija → 500; ništa upisano, ni reconcile', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 100, 50);
  const V = 'e'.repeat(64);
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
  const definicija = { displayName: 'Besplatno pranje', costPoints: 50, active: true };
  const bezPolja = (polje) => Object.fromEntries(Object.entries(definicija).filter(([k]) => k !== polje));
  const slucajevi = [
    ['active false', { ...definicija, active: false }, 409, 'REWARD_INACTIVE'],
    ['costPoints 0', { ...definicija, costPoints: 0 }, 500, 'INTERNAL_ERROR'],
    ['costPoints -1', { ...definicija, costPoints: -1 }, 500, 'INTERNAL_ERROR'],
    ['costPoints 1.5', { ...definicija, costPoints: 1.5 }, 500, 'INTERNAL_ERROR'],
    ["costPoints '50'", { ...definicija, costPoints: '50' }, 500, 'INTERNAL_ERROR'],
    ['costPoints null', { ...definicija, costPoints: null }, 500, 'INTERNAL_ERROR'],
    ['costPoints nedostaje', bezPolja('costPoints'), 500, 'INTERNAL_ERROR'],
    ["active 'true'", { ...definicija, active: 'true' }, 500, 'INTERNAL_ERROR'],
    ['active nedostaje', bezPolja('active'), 500, 'INTERNAL_ERROR'],
    // i04/P-12: neispravna definicija ima prednost nad active == false.
    ['active false i costPoints 0', { ...definicija, active: false, costPoints: 0 }, 500, 'INTERNAL_ERROR'],
  ];
  for (const [opis, dokument, status, kod] of slucajevi) {
    await referenca('rewardDefinitions/CAR_WASH').set(dokument);
    const prije = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdaj('CAR_WASH', { requestId: randomUUID() }, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, status, kod, opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
  }
  assert.equal((await podaci(`vouchers/${V}`)).status, 'ACTIVE');
  assert.equal(await brojDokumenata('loyaltyLedger'), 0);
});

test('I04-T05 SHOWER (30) se izdaje ispravno; costPoints na voucher-u je snapshot (izmjena definicije ne mijenja voucher ni release)', async () => {
  const a = await korisnik();
  await pripremiNalog(a.uid, 30, 0);
  const tus = await izdaj('SHOWER', { requestId: randomUUID() }, { token: a.idToken });
  assert.equal(tus.status, 201, tus.text);
  assert.equal(tus.body.costPoints, 30);
  assert.equal(tus.body.rewardId, 'SHOWER');
  assert.deepStrictEqual(await nalog(a.uid), [0, 30]);

  const b = await korisnik();
  await pripremiNalog(b.uid, 50, 0);
  const R = randomUUID();
  const prvi = await izdaj('CAR_WASH', { requestId: R }, { token: b.idToken });
  assert.equal(prvi.status, 201, prvi.text);
  const V = prvi.body.voucherId;
  await referenca('rewardDefinitions/CAR_WASH').update({ costPoints: 70 });
  assert.equal((await podaci(`vouchers/${V}`)).costPoints, 50);
  const retry = await izdaj('CAR_WASH', { requestId: R }, { token: b.idToken });
  assert.equal(retry.status, 200, retry.text);
  assert.equal(retry.body.costPoints, 50);
  assert.deepStrictEqual(retry.body, prvi.body);

  // Istek voucher-a (Admin SDK) i reconcile kroz novo izdavanje: release vraća costPoints sa voucher-a (50), ne iz definicije (70).
  await referenca(`vouchers/${V}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
  const novi = await izdaj('SHOWER', { requestId: randomUUID() }, { token: b.idToken });
  assert.equal(novi.status, 201, novi.text);
  const release = await podaci(`loyaltyLedger/release_${V}`);
  assert.equal(release.deltaAvailable, 50);
  assert.equal(release.deltaReserved, -50);
  assert.deepStrictEqual(await nalog(b.uid), [20, 30]);
});

test('I04-T06 (b) 100 izdavanja → 100 različitih voucherId-eva u formatu, bez uid-a i requestId-a; isti requestId dva korisnika → dva voucher-a', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 3000, 0);
  const app = aplikacija();
  const idjevi = [];
  for (let i = 0; i < 100; i += 1) {
    const requestId = randomUUID();
    const odgovor = await izdaj('SHOWER', { requestId }, { token: idToken, app });
    assert.equal(odgovor.status, 201, odgovor.text);
    const { voucherId } = odgovor.body;
    assert.match(voucherId, VOUCHER_ID);
    assert.ok(!voucherId.includes(uid.toLowerCase()), 'voucherId sadrži uid');
    assert.ok(!voucherId.includes(requestId.replaceAll('-', '')), 'voucherId sadrži requestId');
    assert.notEqual(voucherId, kljucZahtjeva(uid, requestId));
    idjevi.push(voucherId);
  }
  assert.equal(new Set(idjevi).size, 100);
  assert.deepStrictEqual(await nalog(uid), [0, 3000]);

  const a = await korisnik();
  const b = await korisnik();
  await pripremiNalog(a.uid, 50, 0);
  await pripremiNalog(b.uid, 50, 0);
  const R = randomUUID();
  const odgovorA = await izdaj('CAR_WASH', { requestId: R }, { token: a.idToken });
  const odgovorB = await izdaj('CAR_WASH', { requestId: R }, { token: b.idToken });
  assert.equal(odgovorA.status, 201, odgovorA.text);
  assert.equal(odgovorB.status, 201, odgovorB.text);
  assert.notEqual(odgovorA.body.voucherId, odgovorB.body.voucherId);
  assert.notEqual(kljucZahtjeva(a.uid, R), kljucZahtjeva(b.uid, R));
  assert.equal((await podaci(`rewardRequests/${kljucZahtjeva(a.uid, R)}`)).voucherId, odgovorA.body.voucherId);
  assert.equal((await podaci(`rewardRequests/${kljucZahtjeva(b.uid, R)}`)).voucherId, odgovorB.body.voucherId);
  assert.deepStrictEqual(await nalog(a.uid), [0, 50]);
  assert.deepStrictEqual(await nalog(b.uid), [0, 50]);
});

test('I04-T07 isti requestId za drugi rewardId → 409 IDEMPOTENCY_CONFLICT, ništa upisano; isti rewardId → 200 isti voucher', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 100, 0);
  const R = randomUUID();
  const prvi = await izdaj('CAR_WASH', { requestId: R }, { token: idToken });
  assert.equal(prvi.status, 201, prvi.text);
  const prije = await snimakBaze();
  const omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(
    await izdaj('SHOWER', { requestId: R }, { token: idToken, db: omotac }),
    409,
    'IDEMPOTENCY_CONFLICT',
    'SHOWER sa istim requestId',
  );
  assert.deepStrictEqual(omotac.upisi, []);
  assert.deepStrictEqual(await snimakBaze(), prije);
  const ponovo = await izdaj('CAR_WASH', { requestId: R }, { token: idToken });
  assert.equal(ponovo.status, 200, ponovo.text);
  assert.deepStrictEqual(ponovo.body, prvi.body);
  assert.deepStrictEqual(await snimakBaze(), prije);
});

test('I04-T08 (a)–(e) O-16: retry pri promijenjenom stanju vraća isti voucher i ništa ne upisuje', async () => {
  const slucajevi = [
    ['(a) available pao na 0', async ({ uid }) => referenca(`loyaltyAccounts/${uid}`).update({ availablePoints: 0, reservedPoints: 0 })],
    ['(b) reward active = false', async () => referenca('rewardDefinitions/CAR_WASH').update({ active: false })],
    ['(c) nalog DELETION_IN_PROGRESS', async ({ uid }) => referenca(`users/${uid}`).update({ accountStatus: 'DELETION_IN_PROGRESS' })],
    [
      '(d) voucher EXPIRED kroz drugo izdavanje',
      async ({ idToken, V }) => {
        await referenca(`vouchers/${V}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
        const drugo = await izdaj('SHOWER', { requestId: randomUUID() }, { token: idToken });
        assert.equal(drugo.status, 201, drugo.text);
        assert.equal((await podaci(`vouchers/${V}`)).status, 'EXPIRED');
      },
    ],
    ['(e) voucher ACTIVE a istekao', async ({ V }) => referenca(`vouchers/${V}`).update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) })],
  ];
  for (const [opis, promijeni] of slucajevi) {
    await napuniRewardDefinitions(firebase.db);
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 50, 0);
    const R = randomUUID();
    const prvi = await izdaj('CAR_WASH', { requestId: R }, { token: idToken });
    assert.equal(prvi.status, 201, `${opis}: ${prvi.text}`);
    const V = prvi.body.voucherId;
    await promijeni({ uid, idToken, V });

    const prije = await snimakBaze();
    const vaucer = await podaci(`vouchers/${V}`);
    const omotac = omotacBaze(firebase.db);
    const retry = await izdaj('CAR_WASH', { requestId: R }, { token: idToken, db: omotac });
    assert.equal(retry.status, 200, `${opis}: ${retry.text}`);
    assert.deepStrictEqual(Object.keys(retry.body), KLJUCEVI_ODGOVORA, opis);
    // Tijelo je slika SAČUVANOG voucher-a (i04/P-1).
    assert.deepStrictEqual(
      retry.body,
      {
        voucherId: V,
        rewardId: 'CAR_WASH',
        costPoints: 50,
        status: vaucer.status,
        issuedAt: prvi.body.issuedAt,
        expiresAt: vaucer.expiresAt.toDate().toISOString(),
      },
      opis,
    );
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
    if (opis.startsWith('(d)')) {
      assert.equal(retry.body.status, 'EXPIRED');
    } else {
      assert.equal(retry.body.status, 'ACTIVE', opis);
    }
    if (opis.startsWith('(e)')) {
      assert.equal(await podaci(`loyaltyLedger/release_${V}`), undefined, '(e) release nastao');
    }
    if (opis.startsWith('(a)') || opis.startsWith('(b)') || opis.startsWith('(c)')) {
      assert.deepStrictEqual(retry.body, prvi.body, opis);
    }
  }
});

test('I04-T08 (f) retry sa neispravnim requestId ili formatom rewardId → 422 / 404 bez pristupa bazi (i03/P-6)', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 50, 0);
  const R = randomUUID();
  assert.equal((await izdaj('CAR_WASH', { requestId: R }, { token: idToken })).status, 201);
  const prije = await snimakBaze();
  let omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(
    await izdaj('CAR_WASH', { requestId: R.toUpperCase() }, { token: idToken, db: omotac }),
    422,
    'INVALID_REQUEST',
    'velika slova',
  );
  assert.equal(omotac.brojPristupa, 0);
  omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(await izdaj('__x__', { requestId: R }, { token: idToken, db: omotac }), 404, 'REWARD_NOT_FOUND', '__x__');
  assert.equal(omotac.brojPristupa, 0);
  assert.deepStrictEqual(await snimakBaze(), prije);
});

test('I04-T09 (a) istekao voucher se oslobađa prije izdavanja: samo status EXPIRED, REWARD_RELEASE tačnih polja, uzastopan lanac', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 20, 50);
  const V = '1'.repeat(64);
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
  const vaucerPrije = await podaci(`vouchers/${V}`);
  const odgovor = await izdaj('SHOWER', { requestId: randomUUID() }, { token: idToken });
  assert.equal(odgovor.status, 201, odgovor.text);

  assert.deepStrictEqual(await podaci(`vouchers/${V}`), { ...vaucerPrije, status: 'EXPIRED' });
  const release = await podaci(`loyaltyLedger/release_${V}`);
  assert.deepStrictEqual(Object.keys(release).sort(), KLJUCEVI_LEDGER);
  assert.equal(release.uid, uid);
  assert.equal(release.type, 'REWARD_RELEASE');
  assert.equal(release.deltaAvailable, 50);
  assert.equal(release.deltaReserved, -50);
  assert.equal(release.availableAfter, 70);
  assert.equal(release.reservedAfter, 0);
  assert.equal(release.purchaseId, null);
  assert.equal(release.voucherId, V);
  assert.ok(release.createdAt instanceof Timestamp);
  const reserve = await podaci(`loyaltyLedger/reserve_${odgovor.body.voucherId}`);
  assert.equal(reserve.availableAfter, 40);
  assert.equal(reserve.reservedAfter, 30);
  assert.ok(reserve.createdAt.isEqual(release.createdAt), 'događaji transakcije nemaju isti createdAt');
  assert.deepStrictEqual(await nalog(uid), [40, 30]);
  assert.equal(await brojDokumenata('loyaltyLedger'), 2);
});

test('I04-T09 (b), (c) neistekao ACTIVE, ne-ACTIVE voucher-i i voucher-i drugog korisnika se ne diraju', async () => {
  const a = await korisnik();
  const b = await korisnik();
  const sada = Date.now();
  await pripremiNalog(a.uid, 30, 50);
  await pripremiNalog(b.uid, 0, 50);
  const neistekao = 'a'.repeat(64);
  await pripremiVaucer(neistekao, a.uid, { expiresAtMs: sada + 600_000 });
  await pripremiVaucer('b'.repeat(64), a.uid, { status: 'EXPIRED', expiresAtMs: sada - 600_000 });
  await pripremiVaucer('c'.repeat(64), a.uid, { status: 'CANCELLED', expiresAtMs: sada - 600_000 });
  await pripremiVaucer('d'.repeat(64), a.uid, { status: 'REDEEMED', expiresAtMs: sada - 600_000 });
  await pripremiVaucer('e'.repeat(64), b.uid, { expiresAtMs: sada - 600_000 });
  const vauceriPrije = {};
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    vauceriPrije[id] = await podaci(`vouchers/${id.repeat(64)}`);
  }
  const nalogB = await podaci(`loyaltyAccounts/${b.uid}`);

  const odgovor = await izdaj('SHOWER', { requestId: randomUUID() }, { token: a.idToken });
  assert.equal(odgovor.status, 201, odgovor.text);
  for (const id of ['a', 'b', 'c', 'd', 'e']) {
    assert.deepStrictEqual(await podaci(`vouchers/${id.repeat(64)}`), vauceriPrije[id], `voucher ${id}`);
    assert.equal(await podaci(`loyaltyLedger/release_${id.repeat(64)}`), undefined, `release ${id}`);
  }
  assert.deepStrictEqual(await nalog(a.uid), [0, 80]);
  assert.deepStrictEqual(await podaci(`loyaltyAccounts/${b.uid}`), nalogB);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
});

test('I04-T09 (d) više isteklih voucher-a → release-i po expiresAt pa voucherId, deterministički lanac, pa RESERVE', async () => {
  const { uid, idToken } = await korisnik();
  const T = Date.now();
  await pripremiNalog(uid, 0, 160);
  await pripremiVaucer('f'.repeat(64), uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: T - 180_000 });
  await pripremiVaucer('0'.repeat(64), uid, { costPoints: 50, expiresAtMs: T - 120_000 });
  await pripremiVaucer('a'.repeat(64), uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: T - 60_000 });
  await pripremiVaucer('b'.repeat(64), uid, { costPoints: 50, expiresAtMs: T - 60_000 });
  const odgovor = await izdaj('SHOWER', { requestId: randomUUID() }, { token: idToken });
  assert.equal(odgovor.status, 201, odgovor.text);

  const ocekivano = [
    ['f', 30, 130],
    ['0', 80, 80],
    ['a', 110, 50],
    ['b', 160, 0],
  ];
  for (const [id, availableAfter, reservedAfter] of ocekivano) {
    const release = await podaci(`loyaltyLedger/release_${id.repeat(64)}`);
    assert.ok(release, `release ${id} ne postoji`);
    assert.equal(release.availableAfter, availableAfter, `release ${id}: availableAfter`);
    assert.equal(release.reservedAfter, reservedAfter, `release ${id}: reservedAfter`);
    assert.equal((await podaci(`vouchers/${id.repeat(64)}`)).status, 'EXPIRED');
  }
  // Rekonstrukcija lanca: svaki događaj = prethodni + delta, počev od 0/160.
  const dogadjaji = (await dogadjajiKorisnika(uid)).map((d) => d.data());
  dogadjaji.sort((x, y) => (x.type === y.type ? x.availableAfter - y.availableAfter : x.type === 'REWARD_RELEASE' ? -1 : 1));
  let [dostupno, rezervisano] = [0, 160];
  for (const dogadjaj of dogadjaji) {
    assert.equal(dogadjaj.availableAfter, dostupno + dogadjaj.deltaAvailable);
    assert.equal(dogadjaj.reservedAfter, rezervisano + dogadjaj.deltaReserved);
    [dostupno, rezervisano] = [dogadjaj.availableAfter, dogadjaj.reservedAfter];
  }
  assert.equal(dogadjaji.at(-1).type, 'REWARD_RESERVE');
  assert.deepStrictEqual([dostupno, rezervisano], [130, 30]);
  assert.deepStrictEqual(await nalog(uid), [130, 30]);
});

test('I04-T09 (e) O-14: release + INSUFFICIENT_POINTS → release commit-ovan, 409, nema voucher-a, mapping-a ni RESERVE', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 5, 30);
  const V = '7'.repeat(64);
  await pripremiVaucer(V, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: Date.now() - 60_000 });
  const R = randomUUID();
  const odgovor = await izdaj('CAR_WASH', { requestId: R }, { token: idToken });
  provjeriTijeloGreske(odgovor, 409, 'INSUFFICIENT_POINTS', 'O-14');
  assert.equal((await podaci(`vouchers/${V}`)).status, 'EXPIRED');
  const release = await podaci(`loyaltyLedger/release_${V}`);
  assert.equal(release.availableAfter, 35);
  assert.equal(release.reservedAfter, 0);
  assert.deepStrictEqual(await nalog(uid), [35, 0]);
  assert.equal(await brojDokumenata('vouchers'), 1);
  assert.equal(await brojDokumenata('rewardRequests'), 0);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);

  const prije = await snimakBaze();
  const omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(await izdaj('CAR_WASH', { requestId: R }, { token: idToken, db: omotac }), 409, 'INSUFFICIENT_POINTS', 'retry');
  assert.deepStrictEqual(omotac.upisi, []);
  assert.deepStrictEqual(await snimakBaze(), prije);
});
