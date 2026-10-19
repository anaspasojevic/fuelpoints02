// POST /api/v1/account/vouchers/reconcile (§18, §18.1, §26 API-06, O-20, O-21): I05-T03 (b) (API-06), I05-T04 (API-06), I05-T15, I05-T16.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import net from 'node:net';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PUTANJA = '/api/v1/account/vouchers/reconcile';
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
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const TRAJANJE_MS = 900_000;

let firebase;
let brojac = 0;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(async () => {
  await ocistiEmulatore();
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

const hex64 = () => randomBytes(32).toString('hex');

// Briše samo Firestore dokumente (Auth korisnici i njihovi token-i ostaju važeći). Host je fiksan, kao u ocistiEmulatore().
async function ocistiFirestore() {
  const odgovor = await fetch(`http://127.0.0.1:8080/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  assert.ok(odgovor.ok, `čišćenje Firestore emulatora: HTTP ${odgovor.status}`);
}

function aplikacija(db = firebase.db) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' });
}

function uskladi({ token, db, app, tijelo, upit = '', zaglavlja = {} } = {}) {
  const zahtjev = request(app ?? aplikacija(db)).post(`${PUTANJA}${upit}`);
  if (token !== undefined) {
    zahtjev.set('Authorization', `Bearer ${token}`);
  }
  for (const [naziv, vrijednost] of Object.entries(zaglavlja)) {
    zahtjev.set(naziv, vrijednost);
  }
  return tijelo === undefined ? zahtjev : zahtjev.send(tijelo);
}

// Sirov HTTP/1.1 zahtjev kroz TCP soket (tačno kontrolisana zaglavlja i tijelo, plan 3, proba B1). Vraća { status, body, text }.
async function sirovZahtjev(app, { metod = 'POST', putanja, zaglavlja = {}, tijelo = '' }) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const { port } = server.address();
    const linije = [
      `${metod} ${putanja} HTTP/1.1`,
      `Host: 127.0.0.1:${port}`,
      'Connection: close',
      ...Object.entries(zaglavlja).map(([naziv, vrijednost]) => `${naziv}: ${vrijednost}`),
    ];
    const sirovo = await new Promise((razrijesi, odbij) => {
      let podaci = '';
      const soket = net.connect({ host: '127.0.0.1', port }, () => soket.write(`${linije.join('\r\n')}\r\n\r\n${tijelo}`));
      soket.setEncoding('utf8');
      soket.on('data', (komad) => {
        podaci += komad;
      });
      soket.on('end', () => razrijesi(podaci));
      soket.on('error', odbij);
    });
    const granica = sirovo.indexOf('\r\n\r\n');
    const status = Number(sirovo.slice(9, 12));
    const text = sirovo.slice(granica + 4);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    return { status, body, text };
  } finally {
    await new Promise((razrijesi) => server.close(razrijesi));
  }
}

async function korisnik() {
  brojac += 1;
  return napraviKorisnika(`uskladjivanje${brojac}@primjer.test`);
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
  for (const zabranjeno of ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno', 'Nekonzistentno', 'availablePoints', 'reservedPoints']) {
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

async function snimakBaze() {
  const rezultat = {};
  for (const kolekcija of await firebase.db.listCollections()) {
    for (const dokument of (await kolekcija.get()).docs) {
      rezultat[dokument.ref.path] = dokument.data();
    }
  }
  return rezultat;
}

async function snimakKorisnika(uid) {
  const vauceri = {};
  for (const d of (await firebase.db.collection('vouchers').where('uid', '==', uid).get()).docs) {
    vauceri[d.id] = d.data();
  }
  const dogadjaji = {};
  for (const d of (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).get()).docs) {
    dogadjaji[d.id] = d.data();
  }
  return { korisnik: await podaci(`users/${uid}`), nalog: await podaci(`loyaltyAccounts/${uid}`), vauceri, dogadjaji };
}

async function pripremiNalog(uid, availablePoints, reservedPoints, accountStatus = 'ACTIVE') {
  await referenca(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await referenca(`loyaltyAccounts/${uid}`).set({ availablePoints, reservedPoints, createdAt: VRIJEME_PRIPREME, updatedAt: VRIJEME_PRIPREME });
}

function kanonskiVaucer(uid, { rewardId = 'CAR_WASH', costPoints = 50, status = 'ACTIVE', expiresAtMs, cancelledAt = null, redeemedAt = null, redeemedAtStationId = null }) {
  return {
    uid,
    rewardId,
    costPoints,
    status,
    issuedAt: Timestamp.fromMillis(expiresAtMs - TRAJANJE_MS),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    redeemedAt,
    cancelledAt,
    redeemedAtStationId,
  };
}

async function pripremiVaucer(voucherId, uid, opcije) {
  await referenca(`vouchers/${voucherId}`).set(kanonskiVaucer(uid, opcije));
}

async function nalog(uid) {
  const n = await podaci(`loyaltyAccounts/${uid}`);
  return [n.availablePoints, n.reservedPoints];
}

async function brojDogadjaja(uid, type) {
  return (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).where('type', '==', type).get()).size;
}

function provjeriRelease(dogadjaj, { uid, voucherId, cijena, availableAfter, reservedAfter }, opis) {
  assert.ok(dogadjaj, `${opis}: release ne postoji`);
  assert.deepStrictEqual(Object.keys(dogadjaj).sort(), KLJUCEVI_LEDGER, `${opis}: polja RELEASE`);
  assert.equal(dogadjaj.uid, uid, opis);
  assert.equal(dogadjaj.type, 'REWARD_RELEASE', opis);
  assert.equal(dogadjaj.deltaAvailable, cijena, `${opis}: deltaAvailable`);
  assert.equal(dogadjaj.deltaReserved, -cijena, `${opis}: deltaReserved`);
  assert.equal(dogadjaj.availableAfter, availableAfter, `${opis}: availableAfter`);
  assert.equal(dogadjaj.reservedAfter, reservedAfter, `${opis}: reservedAfter`);
  assert.equal(dogadjaj.purchaseId, null, opis);
  assert.equal(dogadjaj.voucherId, voucherId, opis);
  assert.ok(dogadjaj.createdAt instanceof Timestamp, `${opis}: createdAt nije Timestamp`);
}

test('I05-T03 (b) API-06: tijelo (O-21) — bez tijela, Content-Length: 0, {} ispravni; svako drugo tijelo → 422 bez pristupa bazi; drugi metodi → 404', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 0);
  const auth = { Authorization: `Bearer ${idToken}` };
  for (const [opis, zaglavlja, tijelo] of [
    ['bez tijela', {}, ''],
    ['Content-Length: 0 bez Content-Type (Retrofit)', { 'Content-Length': '0' }, ''],
    ['application/json {}', { 'Content-Type': 'application/json', 'Content-Length': '2' }, '{}'],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await sirovZahtjev(aplikacija(omotac), { putanja: PUTANJA, zaglavlja: { ...auth, ...zaglavlja }, tijelo });
    assert.equal(odgovor.status, 200, `${opis}: ${odgovor.text}`);
    assert.deepStrictEqual(odgovor.body, { reconciledCount: 0 }, opis);
    assert.ok(omotac.brojPristupa > 0, `${opis}: kontrola bez pristupa bazi`);
  }
  for (const [opis, zaglavlja, tijelo] of [
    ['{"a":1}', { 'Content-Type': 'application/json' }, '{"a":1}'],
    ['{"uid":"x"}', { 'Content-Type': 'application/json' }, '{"uid":"x"}'],
    ['[]', { 'Content-Type': 'application/json' }, '[]'],
    ['text/plain sa {"uid":"x"}', { 'Content-Type': 'text/plain' }, '{"uid":"x"}'],
    ['bez Content-Type sa tijelom', {}, '{"uid":"x"}'],
    ['application/merge-patch+json {}', { 'Content-Type': 'application/merge-patch+json' }, '{}'],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await sirovZahtjev(aplikacija(omotac), {
      putanja: PUTANJA,
      zaglavlja: { ...auth, 'Content-Length': String(Buffer.byteLength(tijelo)), ...zaglavlja },
      tijelo,
    });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  for (const tijelo of ['null', '"x"', '5', '{neispravan']) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await sirovZahtjev(aplikacija(omotac), {
      putanja: PUTANJA,
      zaglavlja: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(tijelo)) },
      tijelo,
    });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', `${tijelo} bez token-a`);
    assert.equal(omotac.brojPristupa, 0);
  }
  for (const [opis, metod, putanja] of [
    ['GET na rutu', 'get', PUTANJA],
    ['PUT na rutu', 'put', PUTANJA],
    ['POST /account/vouchers', 'post', '/api/v1/account/vouchers'],
  ]) {
    const omotac = omotacBaze(firebase.db);
    provjeriTijeloGreske(await request(aplikacija(omotac))[metod](putanja), 404, 'NOT_FOUND', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
});

test('I05-T04 API-06: bez važećeg token-a → 401 bez pristupa bazi; UID samo iz token-a (?uid, X-User-Id ne mijenjaju ishod)', async () => {
  const a = await korisnik();
  const b = await korisnik();
  await pripremiNalog(a.uid, 0, 50);
  await pripremiNalog(b.uid, 0, 50);
  await pripremiVaucer(hex64(), a.uid, { expiresAtMs: Date.now() + 600_000 });
  await pripremiVaucer(hex64(), b.uid, { expiresAtMs: Date.now() - 60_000 });
  const stanje = await snimakBaze();
  for (const [opis, zaglavlje, upit] of [
    ['bez Authorization', undefined, ''],
    ['Bearer neispravan', 'Bearer neispravan', ''],
    ['Basic <token>', `Basic ${a.idToken}`, ''],
    ['Bearer bez token-a', 'Bearer ', ''],
    ['?token=', undefined, `?token=${a.idToken}`],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const zahtjev = request(aplikacija(omotac)).post(`${PUTANJA}${upit}`);
    if (zaglavlje !== undefined) {
      zahtjev.set('Authorization', zaglavlje);
    }
    provjeriTijeloGreske(await zahtjev, 401, 'UNAUTHENTICATED', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  assert.deepStrictEqual(await snimakBaze(), stanje);

  const odgovor = await uskladi({ token: a.idToken, upit: `?uid=${b.uid}`, zaglavlja: { 'X-User-Id': b.uid } });
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.deepStrictEqual(odgovor.body, { reconciledCount: 0 }, 'reconcile po B umjesto po A');
  assert.deepStrictEqual(await snimakBaze(), stanje, 'B (ili A) promijenjen');
});

test('I05-T15 (a), (d) API-06: nalog bez voucher-a → 200 { reconciledCount: 0 }, ništa upisano; drugi poziv poslije reconcile-a → 0 bez upisa', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 10, 0);
  const stanje = await snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await uskladi({ token: idToken, db: omotac });
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['reconciledCount']);
  assert.deepStrictEqual(odgovor.body, { reconciledCount: 0 });
  assert.deepStrictEqual(omotac.upisi, []);
  assert.deepStrictEqual(await snimakBaze(), stanje);

  await referenca(`loyaltyAccounts/${uid}`).update({ reservedPoints: 50 });
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
  assert.deepStrictEqual((await uskladi({ token: idToken })).body, { reconciledCount: 1 });
  const poslije = await snimakBaze();
  const drugi = omotacBaze(firebase.db);
  const ponovljen = await uskladi({ token: idToken, db: drugi });
  assert.deepStrictEqual(ponovljen.body, { reconciledCount: 0 }, 'drugi poziv');
  assert.deepStrictEqual(drugi.upisi, [], 'drugi poziv: pokušan upis');
  assert.deepStrictEqual(await snimakBaze(), poslije, 'drugi poziv: baza promijenjena');
});

test('I05-T15 (b) API-06: tačno istekli ACTIVE voucher-i korisnika → EXPIRED sa RELEASE lancem po (expiresAt, voucherId); ostali netaknuti', async () => {
  const a = await korisnik();
  const b = await korisnik();
  const T = Date.now();
  await pripremiNalog(a.uid, 5, 140);
  await pripremiNalog(b.uid, 0, 50);
  const F = 'f'.repeat(64);
  const Z = '0'.repeat(64);
  const neistekao = hex64();
  const otkazan = hex64();
  const iskoriscen = hex64();
  const istekaoRanije = hex64();
  const tudji = hex64();
  await pripremiVaucer(F, a.uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: T - 180_000 });
  await pripremiVaucer(Z, a.uid, { expiresAtMs: T - 120_000 });
  await pripremiVaucer(neistekao, a.uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: T + 600_000 });
  await pripremiVaucer(otkazan, a.uid, { status: 'CANCELLED', expiresAtMs: T - 300_000, cancelledAt: Timestamp.fromMillis(T - 400_000) });
  await pripremiVaucer(iskoriscen, a.uid, { status: 'REDEEMED', expiresAtMs: T - 300_000, redeemedAt: Timestamp.fromMillis(T - 400_000), redeemedAtStationId: 'SIM01' });
  await pripremiVaucer(istekaoRanije, a.uid, { status: 'EXPIRED', expiresAtMs: T - 300_000 });
  await pripremiVaucer(tudji, b.uid, { expiresAtMs: T - 300_000 });
  const prije = await snimakBaze();
  const prijeB = await snimakKorisnika(b.uid);

  const odgovor = await uskladi({ token: a.idToken });
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.deepStrictEqual(odgovor.body, { reconciledCount: 2 });

  provjeriRelease(await podaci(`loyaltyLedger/release_${F}`), { uid: a.uid, voucherId: F, cijena: 30, availableAfter: 35, reservedAfter: 110 }, 'release F (prvi)');
  provjeriRelease(await podaci(`loyaltyLedger/release_${Z}`), { uid: a.uid, voucherId: Z, cijena: 50, availableAfter: 85, reservedAfter: 60 }, 'release Z (drugi)');
  assert.equal(await brojDogadjaja(a.uid, 'REWARD_RELEASE'), 2);
  for (const id of [F, Z]) {
    assert.deepStrictEqual(await podaci(`vouchers/${id}`), { ...prije[`vouchers/${id}`], status: 'EXPIRED' }, `voucher ${id.slice(0, 4)}`);
  }
  for (const id of [neistekao, otkazan, iskoriscen, istekaoRanije, tudji]) {
    assert.deepStrictEqual(await podaci(`vouchers/${id}`), prije[`vouchers/${id}`], `voucher ${id.slice(0, 6)} promijenjen`);
  }
  assert.deepStrictEqual(await nalog(a.uid), [85, 60]);
  const n = await podaci(`loyaltyAccounts/${a.uid}`);
  assert.deepStrictEqual(n.updatedAt, (await podaci(`loyaltyLedger/release_${F}`)).createdAt, 'updatedAt ≠ createdAt release-a');
  assert.deepStrictEqual(await snimakKorisnika(b.uid), prijeB, 'B promijenjen');
});

test('I05-T15 (c) API-06: isti expiresAt → release redom po voucherId (a…a, pa b…b)', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 80);
  const A = 'a'.repeat(64);
  const B = 'b'.repeat(64);
  const istek = Date.now() - 60_000;
  await pripremiVaucer(B, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: istek });
  await pripremiVaucer(A, uid, { expiresAtMs: istek });
  assert.deepStrictEqual((await uskladi({ token: idToken })).body, { reconciledCount: 2 });
  provjeriRelease(await podaci(`loyaltyLedger/release_${A}`), { uid, voucherId: A, cijena: 50, availableAfter: 50, reservedAfter: 30 }, 'release a…a');
  provjeriRelease(await podaci(`loyaltyLedger/release_${B}`), { uid, voucherId: B, cijena: 30, availableAfter: 80, reservedAfter: 0 }, 'release b…b');
});

test('I05-T15 (e) API-06: 200 isteklih voucher-a jednog korisnika → reconciledCount 200 u jednoj transakciji, nalog tačan', async (t) => {
  const { uid, idToken } = await korisnik();
  const N = 200;
  await pripremiNalog(uid, 7, 30 * N);
  const istek = Date.now() - 60_000;
  let paket = firebase.db.batch();
  for (let i = 0; i < N; i += 1) {
    paket.set(referenca(`vouchers/${hex64()}`), kanonskiVaucer(uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: istek - i }));
    if ((i + 1) % 100 === 0) {
      await paket.commit();
      paket = firebase.db.batch();
    }
  }
  const omotac = omotacBaze(firebase.db);
  const pocetak = Date.now();
  const odgovor = await uskladi({ token: idToken, db: omotac });
  const trajanje = Date.now() - pocetak;
  t.diagnostic(`200 isteklih: HTTP ${odgovor.status} za ${trajanje} ms, upisa ${omotac.upisi.length}`);
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.deepStrictEqual(odgovor.body, { reconciledCount: N });
  assert.ok(trajanje < 10_000, `trajanje ${trajanje} ms`);
  assert.equal(omotac.brojTransakcija, 1);
  assert.equal(omotac.upisi.length, 2 * N + 1);
  assert.deepStrictEqual(await nalog(uid), [7 + 30 * N, 0]);
  assert.equal(await brojDogadjaja(uid, 'REWARD_RELEASE'), N);
  assert.equal((await firebase.db.collection('vouchers').where('uid', '==', uid).where('status', '==', 'EXPIRED').get()).size, N);
});

test('I05-T16 (a), (b) O-20 API-06: nalog nije ACTIVE ili neispravan → 409 / 409 / 500 prije upita, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  const scenariji = [
    ['users ne postoji', async () => {}, 409, 'ACCOUNT_NOT_INITIALIZED'],
    [
      'users ACTIVE bez loyaltyAccounts',
      async () => {
        await pripremiNalog(uid, 0, 50);
        await referenca(`loyaltyAccounts/${uid}`).delete();
      },
      409,
      'ACCOUNT_NOT_INITIALIZED',
    ],
    [
      'loyaltyAccounts bez users',
      async () => {
        await pripremiNalog(uid, 0, 50);
        await referenca(`users/${uid}`).delete();
      },
      409,
      'ACCOUNT_NOT_INITIALIZED',
    ],
    ['DELETION_IN_PROGRESS', () => pripremiNalog(uid, 0, 50, 'DELETION_IN_PROGRESS'), 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    [
      'DELETION_IN_PROGRESS bez loyaltyAccounts',
      async () => {
        await pripremiNalog(uid, 0, 50, 'DELETION_IN_PROGRESS');
        await referenca(`loyaltyAccounts/${uid}`).delete();
      },
      409,
      'ACCOUNT_DELETION_IN_PROGRESS',
    ],
    ["accountStatus 'NEPOZNAT'", () => pripremiNalog(uid, 0, 50, 'NEPOZNAT'), 500, 'INTERNAL_ERROR'],
    ["availablePoints '0'", () => pripremiNalog(uid, '0', 50), 500, 'INTERNAL_ERROR'],
    ['reservedPoints -1', () => pripremiNalog(uid, 0, -1), 500, 'INTERNAL_ERROR'],
  ];
  for (const [opis, pripremi, status, kod] of scenariji) {
    for (const saVaucerom of [true, false]) {
      await ocistiFirestore();
      await pripremi();
      if (saVaucerom) {
        await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
      }
      const stanje = await snimakBaze();
      const omotac = omotacBaze(firebase.db);
      const odgovor = await uskladi({ token: idToken, db: omotac });
      const o = `${opis}${saVaucerom ? ' (istekao voucher)' : ' (bez voucher-a)'}`;
      provjeriTijeloGreske(odgovor, status, kod, o);
      provjeriBezInternihDetalja(odgovor, o);
      assert.deepStrictEqual(omotac.upisi, [], `${o}: pokušan upis`);
      assert.deepStrictEqual(await snimakBaze(), stanje, `${o}: baza promijenjena`);
    }
  }
});

test('I05-T16 (c) API-06: nekonzistentan ACTIVE voucher, postojeći release ili premalo rezervisanih bodova → 500, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  const W = hex64();
  const istek = Date.now() - 60_000;
  const vaucerSa = (izmjena, expiresAtMs = istek) => async () => {
    const vaucer = kanonskiVaucer(uid, { expiresAtMs });
    izmjena(vaucer);
    await referenca(`vouchers/${V}`).set(vaucer);
  };
  const slucajevi = [
    ['istekao ACTIVE sa costPoints 0', vaucerSa((v) => (v.costPoints = 0))],
    ['neistekao ACTIVE sa costPoints 0', vaucerSa((v) => (v.costPoints = 0), Date.now() + 600_000)],
    ['ACTIVE bez expiresAt', vaucerSa((v) => delete v.expiresAt)],
    [
      'release_ postoji za istekao ACTIVE',
      async () => {
        await pripremiVaucer(V, uid, { expiresAtMs: istek });
        await referenca(`loyaltyLedger/release_${V}`).set({ uid, type: 'REWARD_RELEASE', voucherId: V });
      },
    ],
    [
      'reservedPoints manji od zbira isteklih',
      async () => {
        await pripremiVaucer(V, uid, { expiresAtMs: istek });
        await pripremiVaucer(W, uid, { expiresAtMs: istek - 1 });
        await referenca(`loyaltyAccounts/${uid}`).update({ reservedPoints: 60 });
      },
    ],
  ];
  for (const [opis, pripremi] of slucajevi) {
    await ocistiFirestore();
    await pripremiNalog(uid, 0, 100);
    await pripremi();
    const stanje = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await uskladi({ token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
    assert.equal((await podaci(`vouchers/${V}`)).status, 'ACTIVE', opis);
  }
});
