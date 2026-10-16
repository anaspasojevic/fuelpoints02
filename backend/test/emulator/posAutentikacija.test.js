// POS autentikacija (§3.4, NFR-02) kroz HTTP: I03-T01 (b) i granice POS rute I03-T22.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const K1 = generisiPosKljuc();
const K2 = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(
  posKonfiguracija([
    ['SIM01', K1],
    ['SIM02', K2],
  ]),
).stanice;

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

function aplikacija(db = firebase.db) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice: POS_STANICE });
}

function tijeloKupovine(dodatno = {}) {
  return {
    loyaltyUid: 'korisnikA',
    posTransactionId: '000184',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    ...dodatno,
  };
}

function provjeriTijeloGreske(odgovor, status, kod, opis = '') {
  assert.equal(odgovor.status, status, `${opis}: status (tijelo ${odgovor.text})`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
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

async function pripremiNalog(uid) {
  await firebase.db.doc(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await firebase.db.doc(`loyaltyAccounts/${uid}`).set({
    availablePoints: 10,
    reservedPoints: 3,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
  });
}

// Isti ključ sa jednim izmijenjenim znakom u sredini (validan oblik, nije u mapi).
function izmijenjenJedanZnak(kljuc) {
  const indeks = 20;
  const zamjena = BASE64URL[(BASE64URL.indexOf(kljuc[indeks]) + 1) % 64];
  return kljuc.slice(0, indeks) + zamjena + kljuc.slice(indeks + 1);
}

test('I03-T01 (b) ključ nedostaje, pogrešan, prazan ili van zaglavlja X-POS-API-Key → 401 UNAUTHENTICATED_POS bez baze', async () => {
  await pripremiNalog('korisnikA');
  const { idToken } = await napraviKorisnika('ana@primjer.test');
  const stanje = await snimakBaze();
  const tijelo = tijeloKupovine();
  const putanja = '/api/v1/pos/purchases';
  const pokusaji = [
    ['bez zaglavlja', (app) => request(app).post(putanja).send(tijelo)],
    ['nepoznat ključ', (app) => request(app).post(putanja).set('X-POS-API-Key', generisiPosKljuc()).send(tijelo)],
    ['ključ SIM01 sa jednim izmijenjenim znakom', (app) => request(app).post(putanja).set('X-POS-API-Key', izmijenjenJedanZnak(K1)).send(tijelo)],
    ['ključ SIM01 + "x"', (app) => request(app).post(putanja).set('X-POS-API-Key', `${K1}x`).send(tijelo)],
    ['prazno zaglavlje', (app) => request(app).post(putanja).set('X-POS-API-Key', '').send(tijelo)],
    ['ključ samo u query-ju', (app) => request(app).post(`${putanja}?X-POS-API-Key=${K1}`).send(tijelo)],
    ['ključ samo u X-Api-Key', (app) => request(app).post(putanja).set('X-Api-Key', K1).send(tijelo)],
    ['ključ kao Bearer', (app) => request(app).post(putanja).set('Authorization', `Bearer ${K1}`).send(tijelo)],
    ['ključ samo u tijelu', (app) => request(app).post(putanja).send({ ...tijelo, 'X-POS-API-Key': K1 })],
    ['Firebase ID token umjesto ključa', (app) => request(app).post(putanja).set('Authorization', `Bearer ${idToken}`).send(tijelo)],
    [
      'dva zaglavlja (ispravan + pogrešan)',
      (app) => request(app).post(putanja).set('X-POS-API-Key', [K1, generisiPosKljuc()]).send(tijelo),
    ],
    ['dva ista ispravna zaglavlja', (app) => request(app).post(putanja).set('X-POS-API-Key', [K1, K1]).send(tijelo)],
  ];
  for (const [opis, posalji] of pokusaji) {
    const omotac = omotacBaze(firebase.db);
    provjeriTijeloGreske(await posalji(aplikacija(omotac)), 401, 'UNAUTHENTICATED_POS', opis);
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
  }
});

test('I03-T01 (b) stationId se izvodi iz ključa; naziv zaglavlja case-insensitive; okolni razmaci uklanja HTTP parser (i03/P-12)', async () => {
  await pripremiNalog('korisnikA');
  const putanja = '/api/v1/pos/purchases';

  const saK2 = await request(aplikacija()).post(putanja).set('X-POS-API-Key', K2).send(tijeloKupovine({ posTransactionId: 'P1' }));
  assert.equal(saK2.status, 201, saK2.text);
  assert.equal(saK2.body.stationId, 'SIM02');
  assert.equal(saK2.body.purchaseId, 'SIM02__P1');
  assert.equal((await firebase.db.doc('purchases/SIM02__P1').get()).get('stationId'), 'SIM02');
  assert.equal((await firebase.db.doc('purchases/SIM01__P1').get()).exists, false);

  const malaSlova = await request(aplikacija()).post(putanja).set('x-pos-api-key', K1).send(tijeloKupovine({ posTransactionId: 'P2' }));
  assert.equal(malaSlova.status, 201, malaSlova.text);
  assert.equal(malaSlova.body.stationId, 'SIM01');

  const razmaci = await request(aplikacija()).post(putanja).set('X-POS-API-Key', `  ${K1}  `).send(tijeloKupovine({ posTransactionId: 'P3' }));
  assert.equal(razmaci.status, 201, razmaci.text);
  assert.equal(razmaci.body.stationId, 'SIM01');
});

test('I03-T22 granice POS rute: GET i nepoznata /pos putanja → 404; neispravan JSON → 422 bez baze; bez posStanice → 500', async () => {
  const omotacGet = omotacBaze(firebase.db);
  provjeriTijeloGreske(
    await request(aplikacija(omotacGet)).get('/api/v1/pos/purchases').set('X-POS-API-Key', K1),
    404,
    'NOT_FOUND',
    'GET /pos/purchases sa ispravnim ključem',
  );
  assert.equal(omotacGet.brojPristupa, 0);
  provjeriTijeloGreske(
    await request(aplikacija()).post('/api/v1/pos/nepostojeca').send(tijeloKupovine()),
    404,
    'NOT_FOUND',
    'POST /pos/nepostojeca bez ključa',
  );

  const omotacJson = omotacBaze(firebase.db);
  provjeriTijeloGreske(
    await request(aplikacija(omotacJson)).post('/api/v1/pos/purchases').set('Content-Type', 'application/json').send('{"loyaltyUid":'),
    422,
    'INVALID_REQUEST',
    'neispravan JSON bez ključa',
  );
  assert.equal(omotacJson.brojPristupa, 0);

  for (const [opis, opcijePos] of [
    ['bez posStanice', {}],
    ['prazan niz posStanice', { posStanice: [] }],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const app = napraviAplikaciju({ servisi: { ...firebase, db: omotac }, verzijaUslova: '1.0', ...opcijePos });
    const odgovor = await request(app)
      .post('/api/v1/pos/purchases')
      .set('X-POS-API-Key', K1)
      .send(tijeloKupovine());
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    for (const zabranjeno of ['stack', '    at ', 'konfiguracija']) {
      assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
    }
    assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  }
  assert.deepStrictEqual(await snimakBaze(), {});
});
