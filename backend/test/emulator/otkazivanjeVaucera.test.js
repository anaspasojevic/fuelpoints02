// POST /api/v1/vouchers/{voucherId}/cancel (§19, §16, §11, §26 API-05, O-5, O-6, O-20, O-21, O-22):
// API-T11, I05-T03 (b) (cancel), I05-T04 (cancel), I05-T05 … I05-T09.
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
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { otkaziVaucer } from '../../src/servisi/otkazivanjeVaucera.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KLJUCEVI_ODGOVORA = ['voucherId', 'rewardId', 'costPoints', 'status', 'issuedAt', 'expiresAt', 'cancelledAt'];
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

// voucherId je sirov segment putanje (može biti percent-kodiran). tijelo undefined → bez tijela.
function otkazi(voucherId, { token, db, app, tijelo, upit = '', zaglavlja = {} } = {}) {
  const zahtjev = request(app ?? aplikacija(db)).post(`/api/v1/vouchers/${voucherId}/cancel${upit}`);
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
  return napraviKorisnika(`otkazivanje${brojac}@primjer.test`);
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

// users, loyaltyAccounts, svi vouchers i svi loyaltyLedger događaji korisnika.
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

async function pripremiNalog(uid, availablePoints, reservedPoints, accountStatus = 'ACTIVE') {
  await referenca(`users/${uid}`).set(kanonskiKorisnik(accountStatus));
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

async function pripremiDogadjaj(eventId, uid, type, voucherId, deltaAvailable, deltaReserved, availableAfter, reservedAfter) {
  await referenca(`loyaltyLedger/${eventId}`).set({
    uid,
    type,
    deltaAvailable,
    deltaReserved,
    availableAfter,
    reservedAfter,
    purchaseId: null,
    voucherId,
    createdAt: VRIJEME_PRIPREME,
  });
}

// Konzistentan ledger ACTIVE voucher-a: RESERVE koji je doveo nalog na (available, reserved).
async function pripremiReserve(voucherId, uid, cijena, available, reserved) {
  await pripremiDogadjaj(`reserve_${voucherId}`, uid, 'REWARD_RESERVE', voucherId, -cijena, cijena, available, reserved);
}

async function pripremiRelease(voucherId, uid, cijena, available, reserved) {
  await pripremiDogadjaj(`release_${voucherId}`, uid, 'REWARD_RELEASE', voucherId, cijena, -cijena, available, reserved);
}

async function nalog(uid) {
  const n = await podaci(`loyaltyAccounts/${uid}`);
  return [n.availablePoints, n.reservedPoints];
}

async function brojDogadjaja(uid, type) {
  return (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).where('type', '==', type).get()).size;
}

function provjeriRelease(dogadjaj, { uid, voucherId, cijena, availableAfter, reservedAfter }, opis) {
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

// Fajl iz kojeg je neposredno pozvana mock funkcija (kao I04-T19).
function fajlPozivaoca() {
  const izvorno = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, okviri) => okviri;
  const okviri = new Error().stack;
  Error.prepareStackTrace = izvorno;
  return okviri
    .map((okvir) => okvir.getFileName() ?? '')
    .find((fajl) => fajl !== '' && !fajl.startsWith('node:') && !fajl.endsWith('/otkazivanjeVaucera.test.js'));
}

test('API-T11 ACTIVE CAR_WASH voucher → cancel → 200, CANCELLED sa cancelledAt, bodovi vraćeni, jedan REWARD_RELEASE; ponovljen cancel → isto tijelo, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 50);
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
  await pripremiReserve(V, uid, 50, 0, 50);
  const vaucerPrije = await podaci(`vouchers/${V}`);
  const nalogPrije = await podaci(`loyaltyAccounts/${uid}`);

  const prije = Date.now();
  const odgovor = await otkazi(V, { token: idToken });
  const poslije = Date.now();
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.deepStrictEqual(Object.keys(odgovor.body), KLJUCEVI_ODGOVORA);

  const vaucer = await podaci(`vouchers/${V}`);
  assert.ok(vaucer.cancelledAt instanceof Timestamp, 'cancelledAt nije Timestamp');
  const cancelledMs = vaucer.cancelledAt.toMillis();
  assert.ok(cancelledMs >= prije - 5000 && cancelledMs <= poslije + 5000, `cancelledAt van intervala zahtjeva: ${cancelledMs}`);
  assert.ok(cancelledMs < vaucer.expiresAt.toMillis(), 'cancelledAt nije prije expiresAt');
  assert.deepStrictEqual(vaucer, { ...vaucerPrije, status: 'CANCELLED', cancelledAt: vaucer.cancelledAt }, 'voucher: izmijenjeno više od status/cancelledAt');
  assert.equal(vaucer.redeemedAt, null);
  assert.equal(vaucer.redeemedAtStationId, null);
  assert.deepStrictEqual(odgovor.body, {
    voucherId: V,
    rewardId: 'CAR_WASH',
    costPoints: 50,
    status: 'CANCELLED',
    issuedAt: vaucerPrije.issuedAt.toDate().toISOString(),
    expiresAt: vaucerPrije.expiresAt.toDate().toISOString(),
    cancelledAt: vaucer.cancelledAt.toDate().toISOString(),
  });

  const release = await podaci(`loyaltyLedger/release_${V}`);
  assert.ok(release, 'release_V ne postoji');
  provjeriRelease(release, { uid, voucherId: V, cijena: 50, availableAfter: 50, reservedAfter: 0 }, 'release_V');
  assert.equal(await brojDogadjaja(uid, 'REWARD_RELEASE'), 1);
  const nalogPoslije = await podaci(`loyaltyAccounts/${uid}`);
  assert.equal(nalogPoslije.availablePoints, 50);
  assert.equal(nalogPoslije.reservedPoints, 0);
  assert.deepStrictEqual(nalogPoslije.createdAt, nalogPrije.createdAt, 'createdAt naloga promijenjen');
  assert.deepStrictEqual(nalogPoslije.updatedAt, release.createdAt, 'updatedAt naloga ≠ createdAt release-a');
  assert.ok(nalogPoslije.availablePoints >= 0 && nalogPoslije.reservedPoints >= 0, 'invarijanta ≥ 0');

  const stanjePoslijePrvog = await snimakKorisnika(uid);
  for (const [opis, tijelo] of [
    ['retry bez tijela', undefined],
    ['retry sa {}', {}],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const retry = await otkazi(V, { token: idToken, db: omotac, tijelo });
    assert.equal(retry.status, 200, `${opis}: ${retry.text}`);
    assert.deepStrictEqual(retry.body, odgovor.body, `${opis}: tijelo se razlikuje od prvog`);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakKorisnika(uid), stanjePoslijePrvog, `${opis}: stanje promijenjeno`);
  }
  assert.equal(await brojDogadjaja(uid, 'REWARD_RELEASE'), 1, 'ponovljen cancel je napravio novi RELEASE');
});

test('I05-T03 (b) cancel: tijelo (O-21) — bez tijela, Content-Length: 0, {} ispravni; svako drugo tijelo → 422 bez pristupa bazi', async () => {
  const { uid, idToken } = await korisnik();
  const B = await korisnik();
  await pripremiNalog(uid, 0, 50);
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
  await pripremiReserve(V, uid, 50, 0, 50);
  const putanja = `/api/v1/vouchers/${V}/cancel`;
  const auth = { Authorization: `Bearer ${idToken}` };

  for (const [opis, zaglavlja, tijelo] of [
    ['bez tijela, bez Content-Length/Transfer-Encoding/Content-Type', {}, ''],
    ['Content-Length: 0 bez Content-Type (Retrofit)', { 'Content-Length': '0' }, ''],
    ['application/json {}', { 'Content-Type': 'application/json', 'Content-Length': '2' }, '{}'],
    ['application/json, Content-Length: 0', { 'Content-Type': 'application/json', 'Content-Length': '0' }, ''],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await sirovZahtjev(aplikacija(omotac), { putanja, zaglavlja: { ...auth, ...zaglavlja }, tijelo });
    assert.equal(odgovor.status, 200, `${opis}: ${odgovor.text}`);
    assert.equal(odgovor.body.status, 'CANCELLED', opis);
    assert.ok(omotac.brojPristupa > 0, `${opis}: kontrola bez pristupa bazi`);
  }
  assert.equal(await brojDogadjaja(uid, 'REWARD_RELEASE'), 1);

  const stanje = await snimakBaze();
  const neispravna = [
    ['{"a":1}', { 'Content-Type': 'application/json' }, '{"a":1}'],
    ['{"uid":"<B>"}', { 'Content-Type': 'application/json' }, JSON.stringify({ uid: B.uid })],
    ['{"voucherId":…}', { 'Content-Type': 'application/json' }, JSON.stringify({ voucherId: V })],
    ['{"__proto__":1}', { 'Content-Type': 'application/json' }, '{"__proto__":1}'],
    ['[]', { 'Content-Type': 'application/json' }, '[]'],
    ['text/plain sa {"uid":"x"}', { 'Content-Type': 'text/plain' }, '{"uid":"x"}'],
    ['bez Content-Type sa tijelom', {}, '{"uid":"x"}'],
    ['application/merge-patch+json {}', { 'Content-Type': 'application/merge-patch+json' }, '{}'],
    ['chunked 0 bajtova bez Content-Type', { 'Transfer-Encoding': 'chunked' }, '0\r\n\r\n'],
  ];
  for (const [opis, zaglavlja, tijelo] of neispravna) {
    const omotac = omotacBaze(firebase.db);
    const duzina = zaglavlja['Transfer-Encoding'] ? {} : { 'Content-Length': String(Buffer.byteLength(tijelo)) };
    const odgovor = await sirovZahtjev(aplikacija(omotac), { putanja, zaglavlja: { ...auth, ...duzina, ...zaglavlja }, tijelo });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }

  // JSON skalar, null i neispravan JSON → 422 iz globalnog parsera, i bez token-a (i05/P-11).
  for (const [opis, tijelo] of [
    ['null', 'null'],
    ['"x"', '"x"'],
    ['5', '5'],
    ['neispravan JSON', '{neispravan'],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await sirovZahtjev(aplikacija(omotac), {
      putanja,
      zaglavlja: { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(tijelo)) },
      tijelo,
    });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', `${opis} bez token-a`);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  // Objekat sa poljem bez token-a → 401 (tijelo se provjerava tek poslije token-a, i05/P-11).
  const bezTokena = await sirovZahtjev(aplikacija(), {
    putanja,
    zaglavlja: { 'Content-Type': 'application/json', 'Content-Length': '7' },
    tijelo: '{"a":1}',
  });
  provjeriTijeloGreske(bezTokena, 401, 'UNAUTHENTICATED', '{"a":1} bez token-a');
  assert.deepStrictEqual(await snimakBaze(), stanje, 'baza promijenjena');
});

test('I05-T03 (b) cancel: voucherId iz putanje (O-22) — neispravan oblik → 404 VOUCHER_NOT_FOUND bez baze; prazan segment, D-5 i drugi metodi → 404 NOT_FOUND', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 50);
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
  const stanje = await snimakBaze();

  for (const [opis, segment] of [
    ['%41 (veliko slovo)', `%41${V.slice(1)}`],
    ['velika slova', V.toUpperCase()],
    ['63 znaka', V.slice(1)],
    ['65 znakova', `${V}a`],
    ['a%2Fb', `a%2Fb${V.slice(3)}`],
    ['%00 + 63 hex', `%00${V.slice(1)}`],
    ['%0A na kraju', `${V}%0A`],
    ['__x__', '__x__'],
    ['UID oblik', uid],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(segment, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 404, 'VOUCHER_NOT_FOUND', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
    assert.ok(!odgovor.text.includes(V), `${opis}: odgovor sadrži voucherId`);
  }

  for (const [opis, metod, putanja] of [
    ['prazan segment (i05/P-12)', 'post', '/api/v1/vouchers//cancel'],
    ['D-5 neispravno percent-kodiran', 'post', '/api/v1/vouchers/%E0%A4%A/cancel'],
    ['GET na rutu', 'get', `/api/v1/vouchers/${V}/cancel`],
    ['PUT na rutu', 'put', `/api/v1/vouchers/${V}/cancel`],
    ['POST /vouchers/<hex> bez /cancel', 'post', `/api/v1/vouchers/${V}`],
  ]) {
    const omotac = omotacBaze(firebase.db);
    // Bez token-a: posrednik je samo na ruti, pa nepoznata ruta daje 404, ne 401.
    const odgovor = await request(aplikacija(omotac))[metod](putanja);
    provjeriTijeloGreske(odgovor, 404, 'NOT_FOUND', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }

  // Redoslijed: tijelo (422) prije formata voucherId-a (404).
  const omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(await otkazi('__x__', { token: idToken, db: omotac, tijelo: { a: 1 } }), 422, 'INVALID_REQUEST', 'tijelo + neispravan voucherId');
  assert.equal(omotac.brojPristupa, 0);

  // Ruter nije osjetljiv na veličinu slova putanje (i04/P-14), voucherId jeste.
  const veliko = await request(aplikacija(omotacBaze(firebase.db))).post(`/api/v1/VOUCHERS/${V.toUpperCase()}/CANCEL`).set('Authorization', `Bearer ${idToken}`);
  provjeriTijeloGreske(veliko, 404, 'VOUCHER_NOT_FOUND', '/VOUCHERS/<HEX>/CANCEL');
  assert.deepStrictEqual(await snimakBaze(), stanje, 'baza promijenjena');
});

test('I05-T04 cancel: bez važećeg token-a → 401 bez pristupa bazi; UID samo iz token-a (?uid, X-User-Id ne mijenjaju ishod)', async () => {
  const a = await korisnik();
  const b = await korisnik();
  await pripremiNalog(a.uid, 0, 50);
  await pripremiNalog(b.uid, 0, 50);
  const VA = hex64();
  const VB = hex64();
  await pripremiVaucer(VA, a.uid, { expiresAtMs: Date.now() + 600_000 });
  await pripremiVaucer(VB, b.uid, { expiresAtMs: Date.now() + 600_000 });
  const stanje = await snimakBaze();

  for (const [opis, zaglavlje, upit] of [
    ['bez Authorization', undefined, ''],
    ['Bearer neispravan', 'Bearer neispravan', ''],
    ['Basic <token>', `Basic ${a.idToken}`, ''],
    ['Bearer bez token-a', 'Bearer ', ''],
    ['?token=', undefined, `?token=${a.idToken}`],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const zahtjev = request(aplikacija(omotac)).post(`/api/v1/vouchers/${VA}/cancel${upit}`);
    if (zaglavlje !== undefined) {
      zahtjev.set('Authorization', zaglavlje);
    }
    const odgovor = await zahtjev;
    provjeriTijeloGreske(odgovor, 401, 'UNAUTHENTICATED', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  assert.deepStrictEqual(await snimakBaze(), stanje, 'baza promijenjena poslije 401');

  const stanjeB = await snimakKorisnika(b.uid);
  const odgovor = await otkazi(VA, { token: a.idToken, upit: `?uid=${b.uid}`, zaglavlja: { 'X-User-Id': b.uid } });
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.equal(odgovor.body.voucherId, VA);
  assert.equal((await podaci(`loyaltyLedger/release_${VA}`)).uid, a.uid);
  assert.deepStrictEqual(await nalog(a.uid), [50, 0]);
  assert.deepStrictEqual(await snimakKorisnika(b.uid), stanjeB, 'B promijenjen');

  // B-ov voucher sa A-ovim token-om i ?uid=<B> → 403, ne cancel.
  provjeriTijeloGreske(await otkazi(VB, { token: a.idToken, upit: `?uid=${b.uid}`, zaglavlja: { 'X-User-Id': b.uid } }), 403, 'FORBIDDEN', 'tuđi voucher sa ?uid');
  assert.deepStrictEqual(await snimakKorisnika(b.uid), stanjeB, 'B promijenjen');
});

test('I05-T05 (a), (b) O-6: nepostojeći voucher → 404 VOUCHER_NOT_FOUND; voucher drugog korisnika (svako stanje) → 403 FORBIDDEN, ništa upisano ni otkriveno', async () => {
  const a = await korisnik();
  const b = await korisnik();
  await pripremiNalog(a.uid, 100, 0);

  const omotacNepostojeci = omotacBaze(firebase.db);
  const stanje = await snimakBaze();
  provjeriTijeloGreske(await otkazi(hex64(), { token: a.idToken, db: omotacNepostojeci }), 404, 'VOUCHER_NOT_FOUND', 'ne postoji');
  assert.deepStrictEqual(omotacNepostojeci.upisi, []);
  assert.deepStrictEqual(await snimakBaze(), stanje);

  const sada = Date.now();
  for (const [opis, opcije] of [
    ['ACTIVE neistekao', { expiresAtMs: sada + 600_000 }],
    ['ACTIVE istekao (bez O-5 release-a)', { expiresAtMs: sada - 60_000 }],
    ['CANCELLED (403, ne 200)', { status: 'CANCELLED', expiresAtMs: sada + 600_000, cancelledAt: Timestamp.fromMillis(sada - 1000) }],
    ['REDEEMED', { status: 'REDEEMED', expiresAtMs: sada + 600_000, redeemedAt: Timestamp.fromMillis(sada - 1000), redeemedAtStationId: 'SIM01' }],
    ['EXPIRED', { status: 'EXPIRED', expiresAtMs: sada - 60_000 }],
  ]) {
    await ocistiFirestore();
    await pripremiNalog(a.uid, 100, 0);
    await pripremiNalog(b.uid, 0, 50);
    const VB = hex64();
    await pripremiVaucer(VB, b.uid, opcije);
    await pripremiReserve(VB, b.uid, 50, 0, 50);
    const prijeA = await snimakKorisnika(a.uid);
    const prijeB = await snimakKorisnika(b.uid);
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(VB, { token: a.idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 403, 'FORBIDDEN', opis);
    for (const zabranjeno of [VB, b.uid, 'CAR_WASH', 'costPoints', 'status', 'ACTIVE', 'CANCELLED', 'REDEEMED', 'EXPIRED']) {
      assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor otkriva "${zabranjeno.slice(0, 12)}"`);
    }
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakKorisnika(a.uid), prijeA, `${opis}: A promijenjen`);
    assert.deepStrictEqual(await snimakKorisnika(b.uid), prijeB, `${opis}: B promijenjen`);
  }
});

test('I05-T05 (c) voucher bez ispravnog vlasnika (uid nedostaje, null, 5, \'\') → 500 bez stack-a, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  for (const [opis, izmijeni] of [
    ['bez uid', (v) => delete v.uid],
    ['uid null', (v) => (v.uid = null)],
    ['uid 5', (v) => (v.uid = 5)],
    ["uid ''", (v) => (v.uid = '')],
  ]) {
    await pripremiNalog(uid, 0, 50);
    const vaucer = kanonskiVaucer(uid, { expiresAtMs: Date.now() + 600_000 });
    izmijeni(vaucer);
    await referenca(`vouchers/${V}`).set(vaucer);
    const stanje = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(V, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
  }
});

test('I05-T06 §19.3 i §19.2: REDEEMED → 409 VOUCHER_ALREADY_REDEEMED, EXPIRED → 409 VOUCHER_EXPIRED, CANCELLED → 200 iz sačuvanog stanja; ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  const sada = Date.now();
  const scenariji = [
    [
      'REDEEMED',
      async (V) => {
        await pripremiNalog(uid, 0, 0);
        await pripremiVaucer(V, uid, { status: 'REDEEMED', expiresAtMs: sada + 600_000, redeemedAt: Timestamp.fromMillis(sada - 1000), redeemedAtStationId: 'SIM01' });
        await pripremiReserve(V, uid, 50, 0, 50);
      },
      (odgovor) => provjeriTijeloGreske(odgovor, 409, 'VOUCHER_ALREADY_REDEEMED', 'REDEEMED'),
    ],
    [
      'EXPIRED',
      async (V) => {
        await pripremiNalog(uid, 50, 0);
        await pripremiVaucer(V, uid, { status: 'EXPIRED', expiresAtMs: sada - 60_000 });
        await pripremiReserve(V, uid, 50, 0, 50);
        await pripremiRelease(V, uid, 50, 50, 0);
      },
      (odgovor) => provjeriTijeloGreske(odgovor, 409, 'VOUCHER_EXPIRED', 'EXPIRED'),
    ],
    [
      'CANCELLED',
      async (V) => {
        await pripremiNalog(uid, 50, 0);
        await pripremiVaucer(V, uid, { status: 'CANCELLED', expiresAtMs: sada + 600_000, cancelledAt: Timestamp.fromMillis(sada - 1000) });
        await pripremiReserve(V, uid, 50, 0, 50);
        await pripremiRelease(V, uid, 50, 50, 0);
      },
      (odgovor, V, vaucer) => {
        assert.equal(odgovor.status, 200, odgovor.text);
        assert.deepStrictEqual(odgovor.body, {
          voucherId: V,
          rewardId: 'CAR_WASH',
          costPoints: 50,
          status: 'CANCELLED',
          issuedAt: vaucer.issuedAt.toDate().toISOString(),
          expiresAt: vaucer.expiresAt.toDate().toISOString(),
          cancelledAt: vaucer.cancelledAt.toDate().toISOString(),
        });
      },
    ],
  ];
  for (const [opis, pripremi, provjeri] of scenariji) {
    await ocistiFirestore();
    const V = hex64();
    await pripremi(V);
    const vaucer = await podaci(`vouchers/${V}`);
    const prije = await snimakKorisnika(uid);
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(V, { token: idToken, db: omotac });
    provjeri(odgovor, V, vaucer);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakKorisnika(uid), prije, `${opis}: stanje promijenjeno`);
  }
});

test('I05-T07 O-5: ACTIVE voucher sa prošlim expiresAt → EXPIRED + RELEASE u istoj transakciji, 409 VOUCHER_EXPIRED; ponovljen → 409 bez upisa', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 50);
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
  await pripremiReserve(V, uid, 50, 0, 50);
  const vaucerPrije = await podaci(`vouchers/${V}`);

  provjeriTijeloGreske(await otkazi(V, { token: idToken }), 409, 'VOUCHER_EXPIRED', 'prvi');
  assert.deepStrictEqual(await podaci(`vouchers/${V}`), { ...vaucerPrije, status: 'EXPIRED' }, 'voucher: očekivan samo status EXPIRED (cancelledAt null)');
  provjeriRelease(await podaci(`loyaltyLedger/release_${V}`), { uid, voucherId: V, cijena: 50, availableAfter: 50, reservedAfter: 0 }, 'release_V');
  assert.deepStrictEqual(await nalog(uid), [50, 0]);
  assert.equal(await brojDogadjaja(uid, 'REWARD_RELEASE'), 1);

  const stanje = await snimakKorisnika(uid);
  const omotac = omotacBaze(firebase.db);
  provjeriTijeloGreske(await otkazi(V, { token: idToken, db: omotac }), 409, 'VOUCHER_EXPIRED', 'ponovljen');
  assert.deepStrictEqual(omotac.upisi, [], 'ponovljen: pokušan upis');
  assert.deepStrictEqual(await snimakKorisnika(uid), stanje, 'ponovljen: stanje promijenjeno');
});

test('I05-T07 granica u servisu: sadaMs === expiresAt → EXPIRED (409); sadaMs === expiresAt − 1 → CANCELLED sa cancelledAt = sadaMs', async () => {
  const uid = 'korisnikT07';
  const expiresAtMs = Date.now() + 600_000;
  for (const [opis, sadaMs, ocekivano] of [
    ['sadaMs === expiresAt', expiresAtMs, 'EXPIRED'],
    ['sadaMs === expiresAt − 1', expiresAtMs - 1, 'CANCELLED'],
  ]) {
    await ocistiFirestore();
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    await pripremiVaucer(V, uid, { expiresAtMs });
    const izvorni = Date.now;
    mock.method(Date, 'now', () => ((fajlPozivaoca() ?? '').endsWith('/src/servisi/otkazivanjeVaucera.js') ? sadaMs : izvorni.call(Date)));
    const rezultat = await otkaziVaucer(firebase.db, { uid, voucherId: V }, sadaMs + 60_000).then(
      (odgovor) => ({ odgovor }),
      (greska) => ({ greska }),
    );
    mock.restoreAll();
    const vaucer = await podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, ocekivano, opis);
    assert.ok(await podaci(`loyaltyLedger/release_${V}`), `${opis}: release_V ne postoji`);
    if (ocekivano === 'EXPIRED') {
      assert.ok(rezultat.greska instanceof GreskaApi && rezultat.greska.kod === 'VOUCHER_EXPIRED', `${opis}: ${rezultat.greska ?? 'uspjeh'}`);
      assert.equal(vaucer.cancelledAt, null, opis);
    } else {
      assert.equal(rezultat.greska, undefined, `${opis}: ${rezultat.greska}`);
      assert.equal(vaucer.cancelledAt.toMillis(), sadaMs, `${opis}: cancelledAt`);
      assert.equal(rezultat.odgovor.cancelledAt, new Date(sadaMs).toISOString(), `${opis}: cancelledAt u odgovoru`);
    }
    assert.deepStrictEqual(await nalog(uid), [50, 0], opis);
  }
});

test('I05-T08 (a) O-20: ACTIVE voucher i nalog nije ACTIVE → 409 ACCOUNT_* / 500, ništa upisano (ni O-5 release)', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  const sada = Date.now();
  const scenariji = [
    ['DELETION_IN_PROGRESS, neistekao', sada + 600_000, () => pripremiNalog(uid, 0, 50, 'DELETION_IN_PROGRESS'), 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    ['DELETION_IN_PROGRESS, istekao', sada - 60_000, () => pripremiNalog(uid, 0, 50, 'DELETION_IN_PROGRESS'), 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    ['users i loyaltyAccounts ne postoje', sada + 600_000, async () => {}, 409, 'ACCOUNT_NOT_INITIALIZED'],
    [
      'users ACTIVE bez loyaltyAccounts',
      sada + 600_000,
      async () => {
        await pripremiNalog(uid, 0, 50);
        await referenca(`loyaltyAccounts/${uid}`).delete();
      },
      409,
      'ACCOUNT_NOT_INITIALIZED',
    ],
    ["accountStatus 'NEPOZNAT'", sada + 600_000, () => pripremiNalog(uid, 0, 50, 'NEPOZNAT'), 500, 'INTERNAL_ERROR'],
    ['availablePoints -1', sada + 600_000, () => pripremiNalog(uid, -1, 50), 500, 'INTERNAL_ERROR'],
    ["availablePoints '50'", sada + 600_000, () => pripremiNalog(uid, '50', 50), 500, 'INTERNAL_ERROR'],
    ['reservedPoints 1.5', sada + 600_000, () => pripremiNalog(uid, 0, 1.5), 500, 'INTERNAL_ERROR'],
  ];
  for (const [opis, expiresAtMs, pripremi, status, kod] of scenariji) {
    await ocistiFirestore();
    await pripremi();
    await pripremiVaucer(V, uid, { expiresAtMs });
    const stanje = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(V, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, status, kod, opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
    assert.equal((await podaci(`vouchers/${V}`)).status, 'ACTIVE', opis);
  }
});

test('I05-T08 (b) O-20: idempotentni CANCELLED i terminalni 409 PRIJE provjere naloga, bez upisa', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  const sada = Date.now();
  const cancelledAt = Timestamp.fromMillis(sada - 1000);
  const scenariji = [
    ['CANCELLED + DELETION_IN_PROGRESS', { status: 'CANCELLED', expiresAtMs: sada + 600_000, cancelledAt }, () => pripremiNalog(uid, 50, 0, 'DELETION_IN_PROGRESS'), 200],
    ['CANCELLED + users ne postoji', { status: 'CANCELLED', expiresAtMs: sada + 600_000, cancelledAt }, async () => {}, 200],
    [
      'REDEEMED + DELETION_IN_PROGRESS',
      { status: 'REDEEMED', expiresAtMs: sada + 600_000, redeemedAt: cancelledAt, redeemedAtStationId: 'SIM01' },
      () => pripremiNalog(uid, 0, 0, 'DELETION_IN_PROGRESS'),
      'VOUCHER_ALREADY_REDEEMED',
    ],
    ['EXPIRED + DELETION_IN_PROGRESS', { status: 'EXPIRED', expiresAtMs: sada - 60_000 }, () => pripremiNalog(uid, 50, 0, 'DELETION_IN_PROGRESS'), 'VOUCHER_EXPIRED'],
  ];
  for (const [opis, opcije, pripremi, ishod] of scenariji) {
    await ocistiFirestore();
    await pripremi();
    await pripremiVaucer(V, uid, opcije);
    const stanje = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(V, { token: idToken, db: omotac });
    if (ishod === 200) {
      assert.equal(odgovor.status, 200, `${opis}: ${odgovor.text}`);
      assert.equal(odgovor.body.status, 'CANCELLED', opis);
      assert.equal(odgovor.body.cancelledAt, cancelledAt.toDate().toISOString(), opis);
    } else {
      provjeriTijeloGreske(odgovor, 409, ishod, opis);
    }
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
  }
});

test('I05-T09 nekonzistentno stanje voucher-a ili naloga → 500 bez stack-a, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  const buduci = Date.now() + 600_000;
  const vaucerSa = (izmjena) => async () => {
    const vaucer = kanonskiVaucer(uid, { expiresAtMs: buduci });
    izmjena(vaucer);
    await referenca(`vouchers/${V}`).set(vaucer);
  };
  const slucajevi = [
    [
      'release_V postoji a V ACTIVE',
      async () => {
        await pripremiVaucer(V, uid, { expiresAtMs: buduci });
        await pripremiRelease(V, uid, 50, 50, 0);
      },
    ],
    [
      'reservedPoints 20 uz V 50',
      async () => {
        await pripremiVaucer(V, uid, { expiresAtMs: buduci });
        await referenca(`loyaltyAccounts/${uid}`).update({ reservedPoints: 20 });
      },
    ],
    ['costPoints 0', vaucerSa((v) => (v.costPoints = 0))],
    ['costPoints -1', vaucerSa((v) => (v.costPoints = -1))],
    ['costPoints 1.5', vaucerSa((v) => (v.costPoints = 1.5))],
    ["costPoints '50'", vaucerSa((v) => (v.costPoints = '50'))],
    ['costPoints nedostaje', vaucerSa((v) => delete v.costPoints)],
    ["status 'PENDING'", vaucerSa((v) => (v.status = 'PENDING'))],
    ['expiresAt nedostaje', vaucerSa((v) => delete v.expiresAt)],
    ['expiresAt string', vaucerSa((v) => (v.expiresAt = '2026-10-18T10:00:00Z'))],
    ['rewardId 5', vaucerSa((v) => (v.rewardId = 5))],
    ['CANCELLED bez cancelledAt', vaucerSa((v) => (v.status = 'CANCELLED'))],
    [
      "CANCELLED sa cancelledAt 'x'",
      vaucerSa((v) => {
        v.status = 'CANCELLED';
        v.cancelledAt = 'x';
      }),
    ],
  ];
  for (const [opis, pripremi] of slucajevi) {
    await ocistiFirestore();
    await pripremiNalog(uid, 0, 50);
    await pripremi();
    const stanje = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkazi(V, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
  }

  // Zastarjelo čitanje: release_V postoji, ali ga transakcija ne vidi → tx.create pada na commit-u (ALREADY_EXISTS) → 500.
  await ocistiFirestore();
  await pripremiNalog(uid, 0, 50);
  await pripremiVaucer(V, uid, { expiresAtMs: buduci });
  await pripremiRelease(V, uid, 50, 50, 0);
  const release = await podaci(`loyaltyLedger/release_${V}`);
  const stanje = await snimakBaze();
  const omotac = omotacBaze(firebase.db, { sakrijPostojece: [`loyaltyLedger/release_${V}`] });
  const odgovor = await otkazi(V, { token: idToken, db: omotac });
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', 'zastarjelo čitanje release_V');
  provjeriBezInternihDetalja(odgovor, 'zastarjelo čitanje');
  assert.ok(omotac.upisi.some((u) => u.metod === 'create' && u.putanja === `loyaltyLedger/release_${V}`), 'release nije pokušan sa create');
  assert.deepStrictEqual(await podaci(`loyaltyLedger/release_${V}`), release, 'release promijenjen');
  assert.equal((await podaci(`vouchers/${V}`)).status, 'ACTIVE');
  assert.deepStrictEqual(await snimakBaze(), stanje);

  // Kontrola: isti voucher bez postojećeg release-a → 200.
  await referenca(`loyaltyLedger/release_${V}`).delete();
  assert.equal((await otkazi(V, { token: idToken, db: omotacBaze(firebase.db) })).status, 200);
});
