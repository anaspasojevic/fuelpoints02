// POST /api/v1/pos/purchases (§1.5, §7.3, §8, §9, §10, §11, §26 API-02):
// API-T02, API-T03, API-T04, I03-T02 … I03-T09, I03-T14, I03-T18, I03-T19.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KLJUCEVI_ODGOVORA = [
  'purchaseId',
  'stationId',
  'posTransactionId',
  'volumeMl',
  'amountMinor',
  'currency',
  'earnedPoints',
  'occurredAt',
];
const KLJUCEVI_PURCHASE = [
  'amountMinor',
  'currency',
  'earnedPoints',
  'occurredAt',
  'posTransactionId',
  'recordedAt',
  'stationId',
  'uid',
  'volumeMl',
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
const KLJUCEVI_NOTIFIKACIJE = ['body', 'createdAt', 'readAt', 'relatedPurchaseId', 'title', 'type', 'uid'];
const KLJUCEVI_NALOGA = ['availablePoints', 'createdAt', 'reservedPoints', 'updatedAt'];
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));

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

function kupi(tijelo, { kljuc = K1, db } = {}) {
  return request(aplikacija(db)).post('/api/v1/pos/purchases').set('X-POS-API-Key', kljuc).send(tijelo);
}

// sirovo === undefined → bez tijela; contentType null → bez Content-Type zaglavlja.
function kupiSirovo(sirovo, { kljuc = K1, db, contentType = 'application/json' } = {}) {
  const zahtjev = request(aplikacija(db)).post('/api/v1/pos/purchases').set('X-POS-API-Key', kljuc);
  if (contentType !== null) {
    zahtjev.set('Content-Type', contentType);
  }
  return sirovo === undefined ? zahtjev : zahtjev.send(sirovo);
}

function prijeMinuta() {
  return new Date(Date.now() - 60_000).toISOString();
}

function tijeloKupovine(loyaltyUid, dodatno = {}) {
  return {
    loyaltyUid,
    posTransactionId: '000184',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAt: prijeMinuta(),
    ...dodatno,
  };
}

function bez(objekat, polje) {
  const kopija = { ...objekat };
  delete kopija[polje];
  return kopija;
}

function provjeriTijeloGreske(odgovor, status, kod, opis = '') {
  assert.equal(odgovor.status, status, `${opis}: status (tijelo ${odgovor.text})`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
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

async function pripremiNalog(uid, { availablePoints = 10, reservedPoints = 3, accountStatus = 'ACTIVE' } = {}) {
  await referenca(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await referenca(`loyaltyAccounts/${uid}`).set({
    availablePoints,
    reservedPoints,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
  });
}

function provjeriInvarijante(nalog) {
  assert.ok(Number.isInteger(nalog.availablePoints) && nalog.availablePoints >= 0, 'availablePoints < 0');
  assert.ok(Number.isInteger(nalog.reservedPoints) && nalog.reservedPoints >= 0, 'reservedPoints < 0');
}

function ocekivanoTijelo(stationId, tijelo, earnedPoints) {
  return {
    purchaseId: `${stationId}__${tijelo.posTransactionId}`,
    stationId,
    posTransactionId: tijelo.posTransactionId,
    volumeMl: tijelo.volumeMl,
    amountMinor: tijelo.amountMinor,
    currency: tijelo.currency,
    earnedPoints,
    occurredAt: new Date(Date.parse(tijelo.occurredAt)).toISOString(),
  };
}

// Šalje zahtjev kroz omotač baze i provjerava tačnu grešku, 0 pristupa bazi i nepromijenjenu bazu.
async function provjeriOdbijanjeBezBaze(posalji, status, kod, opis) {
  const prije = await snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await posalji(omotac);
  provjeriTijeloGreske(odgovor, status, kod, opis);
  assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
  assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
}

test('API-T02 42 730 ml → 42 boda; purchase, EARN, balance i notifikacija tačno po §8.3, §11, §9.2', async () => {
  await pripremiNalog('korisnikA', { availablePoints: 10, reservedPoints: 3 });
  const tijelo = tijeloKupovine('korisnikA');
  const prije = Date.now();
  const odgovor = await kupi(tijelo);
  const poslije = Date.now();

  assert.equal(odgovor.status, 201, odgovor.text);
  assert.deepStrictEqual(Object.keys(odgovor.body), KLJUCEVI_ODGOVORA);
  assert.deepStrictEqual(odgovor.body, ocekivanoTijelo('SIM01', tijelo, 42));
  assert.equal(odgovor.body.purchaseId, 'SIM01__000184');

  const kupovina = await podaci('purchases/SIM01__000184');
  assert.deepStrictEqual(Object.keys(kupovina).sort(), KLJUCEVI_PURCHASE);
  assert.equal(kupovina.uid, 'korisnikA');
  assert.equal(kupovina.stationId, 'SIM01');
  assert.equal(kupovina.posTransactionId, '000184');
  assert.equal(kupovina.volumeMl, 42_730);
  assert.equal(kupovina.amountMinor, 7050);
  assert.equal(kupovina.currency, 'EUR');
  assert.equal(kupovina.earnedPoints, 42);
  assert.ok(Number.isInteger(kupovina.earnedPoints));
  assert.ok(kupovina.occurredAt instanceof Timestamp, 'occurredAt nije Timestamp');
  assert.equal(kupovina.occurredAt.toMillis(), Date.parse(tijelo.occurredAt));
  assert.ok(kupovina.recordedAt instanceof Timestamp, 'recordedAt nije Timestamp');
  const recordedAt = kupovina.recordedAt.toMillis();
  assert.ok(recordedAt >= prije - 5000 && recordedAt <= poslije + 5000, 'recordedAt nije serversko vrijeme zahtjeva');

  const nalog = await podaci('loyaltyAccounts/korisnikA');
  assert.deepStrictEqual(Object.keys(nalog).sort(), KLJUCEVI_NALOGA);
  assert.equal(nalog.availablePoints, 52);
  assert.equal(nalog.reservedPoints, 3);
  assert.ok(nalog.updatedAt.isEqual(kupovina.recordedAt), 'updatedAt ≠ recordedAt');
  assert.ok(nalog.createdAt.isEqual(VRIJEME_PRIPREME), 'createdAt promijenjen');
  provjeriInvarijante(nalog);

  const dogadjaj = await podaci('loyaltyLedger/earn_SIM01__000184');
  assert.deepStrictEqual(Object.keys(dogadjaj).sort(), KLJUCEVI_LEDGER);
  assert.deepStrictEqual(
    { ...dogadjaj, createdAt: undefined },
    {
      uid: 'korisnikA',
      type: 'EARN',
      deltaAvailable: 42,
      deltaReserved: 0,
      availableAfter: 52,
      reservedAfter: 3,
      purchaseId: 'SIM01__000184',
      voucherId: null,
      createdAt: undefined,
    },
  );
  assert.ok(dogadjaj.createdAt instanceof Timestamp && dogadjaj.createdAt.isEqual(kupovina.recordedAt));

  const obavjestenje = await podaci('notifications/earn_SIM01__000184');
  assert.deepStrictEqual(Object.keys(obavjestenje).sort(), KLJUCEVI_NOTIFIKACIJE);
  assert.deepStrictEqual(
    { ...obavjestenje, createdAt: undefined },
    {
      uid: 'korisnikA',
      type: 'POINTS_EARNED',
      title: 'Bodovi za kupovinu goriva',
      body: 'Za kupovinu goriva dobili ste 42 boda.',
      createdAt: undefined,
      readAt: null,
      relatedPurchaseId: 'SIM01__000184',
    },
  );
  assert.ok(obavjestenje.createdAt instanceof Timestamp && obavjestenje.createdAt.isEqual(kupovina.recordedAt));

  assert.equal(await brojDokumenata('purchases'), 1);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  assert.equal(await brojDokumenata('notifications'), 1);
});

test('API-T03 ponovljeni isti (stationId, posTransactionId) sa istim payload-om → 200 i tijelo prve operacije, ništa novo', async () => {
  await pripremiNalog('korisnikA');
  const tijelo = tijeloKupovine('korisnikA');
  const prvi = await kupi(tijelo);
  assert.equal(prvi.status, 201);
  const stanje = await snimakBaze();

  for (let i = 0; i < 2; i += 1) {
    const ponovljeni = await kupi(tijelo);
    assert.equal(ponovljeni.status, 200, `retry ${i + 1}`);
    assert.deepStrictEqual(Object.keys(ponovljeni.body), KLJUCEVI_ODGOVORA);
    assert.deepStrictEqual(ponovljeni.body, prvi.body, `retry ${i + 1}: tijelo`);
    assert.equal(ponovljeni.text, prvi.text, `retry ${i + 1}: tijelo nije bajt-po-bajt jednako`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `retry ${i + 1}: baza promijenjena`);
  }
  assert.equal(await brojDokumenata('purchases'), 1);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  assert.equal(await brojDokumenata('notifications'), 1);
  assert.equal((await podaci('loyaltyAccounts/korisnikA')).availablePoints, 52);
});

test('API-T04 isti purchase ID sa drugim uid, volumeMl, amountMinor ili currency → 409, ništa izmijenjeno; nevalidan ulaz odbijen', async () => {
  await pripremiNalog('korisnikA');
  await pripremiNalog('korisnikB', { availablePoints: 5, reservedPoints: 0 });
  const tijelo = tijeloKupovine('korisnikA');
  assert.equal((await kupi(tijelo)).status, 201);
  // (d) currency se ne može razlikovati a da prođe validaciju (whitelist EUR), pa se konflikt pravi nad pripremljenim dokumentom.
  await referenca('purchases/SIM01__USD1').set({
    uid: 'korisnikA',
    stationId: 'SIM01',
    posTransactionId: 'USD1',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'USD',
    earnedPoints: 42,
    occurredAt: VRIJEME_PRIPREME,
    recordedAt: VRIJEME_PRIPREME,
  });
  const stanje = await snimakBaze();

  const konflikti = [
    ['(a) drugi loyaltyUid', { ...tijelo, loyaltyUid: 'korisnikB' }],
    ['(b) volumeMl + 1', { ...tijelo, volumeMl: tijelo.volumeMl + 1 }],
    ['(c) amountMinor + 1', { ...tijelo, amountMinor: tijelo.amountMinor + 1 }],
    ['(d) currency USD u dokumentu, EUR u zahtjevu', { ...tijelo, posTransactionId: 'USD1' }],
  ];
  for (const [opis, zahtjev] of konflikti) {
    provjeriTijeloGreske(await kupi(zahtjev), 409, 'IDEMPOTENCY_CONFLICT', opis);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
  }

  const nevalidni = [
    ['volumeMl 0', { volumeMl: 0 }, 'INVALID_VOLUME'],
    ['currency BAM', { currency: 'BAM' }, 'UNSUPPORTED_CURRENCY'],
    ['occurredAt nije vrijeme', { occurredAt: 'nije-vrijeme' }, 'INVALID_OCCURRED_AT'],
  ];
  for (const [opis, dodatno, kod] of nevalidni) {
    provjeriTijeloGreske(await kupi({ ...tijelo, posTransactionId: 'NOVA1', ...dodatno }), 422, kod, opis);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
  }
});

test('I03-T02 server-controlled ili nepoznata polja, tijelo koje nije objekat, loyaltyUid nije string → 422 INVALID_REQUEST bez baze', async () => {
  await pripremiNalog('korisnikA');
  const tijelo = tijeloKupovine('korisnikA');
  const dodaci = {
    stationId: 'SIM02',
    earnedPoints: 1000,
    recordedAt: '2026-10-16T10:00:00Z',
    uid: 'korisnikA',
    'X-POS-API-Key': K1,
    nepoznato: 1,
    constructor: 1,
  };
  for (const [polje, vrijednost] of Object.entries(dodaci)) {
    await provjeriOdbijanjeBezBaze((db) => kupi({ ...tijelo, [polje]: vrijednost }, { db }), 422, 'INVALID_REQUEST', polje);
  }
  const sirovoSaProto = JSON.stringify(tijelo).replace(/^\{/, '{"__proto__":{"earnedPoints":1000},');
  await provjeriOdbijanjeBezBaze((db) => kupiSirovo(sirovoSaProto, { db }), 422, 'INVALID_REQUEST', '__proto__');

  for (const sirovo of ['[]', 'null', '"tekst"', '5', 'true']) {
    await provjeriOdbijanjeBezBaze((db) => kupiSirovo(sirovo, { db }), 422, 'INVALID_REQUEST', sirovo);
  }
  await provjeriOdbijanjeBezBaze((db) => kupiSirovo(undefined, { db, contentType: null }), 422, 'INVALID_REQUEST', 'prazno tijelo');
  await provjeriOdbijanjeBezBaze(
    (db) => kupiSirovo(JSON.stringify(tijelo), { db, contentType: 'text/plain' }),
    422,
    'INVALID_REQUEST',
    'text/plain',
  );

  for (const [opis, vrijednost] of [
    ['nedostaje', undefined],
    ['null', null],
    ['broj', 5],
    ['niz', ['korisnikA']],
  ]) {
    const zahtjev = vrijednost === undefined ? bez(tijelo, 'loyaltyUid') : { ...tijelo, loyaltyUid: vrijednost };
    await provjeriOdbijanjeBezBaze((db) => kupi(zahtjev, { db }), 422, 'INVALID_REQUEST', `loyaltyUid ${opis}`);
  }

  await provjeriOdbijanjeBezBaze(
    (db) => kupi({ nepoznato: 1, ...tijelo, volumeMl: 0 }, { db }),
    422,
    'INVALID_REQUEST',
    'redoslijed: nepoznato polje prije volumeMl',
  );
  await provjeriOdbijanjeBezBaze(
    (db) => kupi({ ...tijelo, loyaltyUid: 5, volumeMl: 0 }, { db }),
    422,
    'INVALID_REQUEST',
    'redoslijed: loyaltyUid tip prije volumeMl',
  );
  assert.equal(await brojDokumenata('purchases'), 0);
});

test('I03-T03 (b) bodovanje kroz API: 900, 999, 1000, 10 000, 10 990, 200 000 ml; 900 ml pravi sva četiri zapisa (O-4)', async () => {
  await pripremiNalog('korisnikA', { availablePoints: 10, reservedPoints: 3 });
  const slucajevi = [
    [900, 0],
    [999, 0],
    [1000, 1],
    [10_000, 10],
    [10_990, 10],
    [200_000, 200],
  ];
  let ocekivanoStanje = 10;
  for (const [i, [volumeMl, bodovi]] of slucajevi.entries()) {
    const posTransactionId = `B${i}`;
    const nalogPrije = await podaci('loyaltyAccounts/korisnikA');
    const odgovor = await kupi(tijeloKupovine('korisnikA', { posTransactionId, volumeMl }));
    assert.equal(odgovor.status, 201, `${volumeMl} ml`);
    assert.equal(odgovor.body.earnedPoints, bodovi, `${volumeMl} ml: earnedPoints u odgovoru`);
    ocekivanoStanje += bodovi;
    const kupovina = await podaci(`purchases/SIM01__${posTransactionId}`);
    const dogadjaj = await podaci(`loyaltyLedger/earn_SIM01__${posTransactionId}`);
    const obavjestenje = await podaci(`notifications/earn_SIM01__${posTransactionId}`);
    const nalog = await podaci('loyaltyAccounts/korisnikA');
    assert.ok(kupovina && dogadjaj && obavjestenje, `${volumeMl} ml: nedostaje zapis`);
    assert.equal(kupovina.earnedPoints, bodovi);
    assert.equal(dogadjaj.deltaAvailable, bodovi);
    assert.equal(dogadjaj.availableAfter, ocekivanoStanje);
    assert.equal(nalog.availablePoints, ocekivanoStanje);
    assert.ok(!nalog.updatedAt.isEqual(nalogPrije.updatedAt), `${volumeMl} ml: updatedAt nije pomjeren`);
    assert.ok(nalog.updatedAt.isEqual(kupovina.recordedAt));
    provjeriInvarijante(nalog);
    if (volumeMl === 900) {
      assert.equal(dogadjaj.deltaAvailable, 0);
      assert.equal(dogadjaj.availableAfter, nalogPrije.availablePoints);
      assert.equal(obavjestenje.body, 'Za kupovinu goriva dobili ste 0 bodova.');
    }
  }
  assert.equal(await brojDokumenata('purchases'), slucajevi.length);
  assert.equal(await brojDokumenata('loyaltyLedger'), slucajevi.length);
  assert.equal(await brojDokumenata('notifications'), slucajevi.length);
});

test('I03-T04 volumeMl: 1 i 200000 prolaze, 1000.0 i 1e3 su 1000; van opsega, decimalno, string, null, nedostaje → INVALID_VOLUME', async () => {
  await pripremiNalog('korisnikA');
  for (const [i, [volumeMl, bodovi]] of [
    [1, 0],
    [200_000, 200],
  ].entries()) {
    const odgovor = await kupi(tijeloKupovine('korisnikA', { posTransactionId: `V${i}`, volumeMl }));
    assert.equal(odgovor.status, 201, `volumeMl ${volumeMl}`);
    assert.equal(odgovor.body.earnedPoints, bodovi);
  }
  for (const [i, zapis] of ['1000.0', '1e3'].entries()) {
    const sirovo = JSON.stringify(tijeloKupovine('korisnikA', { posTransactionId: `VJ${i}` })).replace('42730', zapis);
    const odgovor = await kupiSirovo(sirovo);
    assert.equal(odgovor.status, 201, zapis);
    assert.equal(odgovor.body.volumeMl, 1000);
    assert.equal((await podaci(`purchases/SIM01__VJ${i}`)).volumeMl, 1000);
  }
  const tijelo = tijeloKupovine('korisnikA', { posTransactionId: 'VX' });
  for (const [opis, vrijednost] of [
    ['0', 0],
    ['200001', 200_001],
    ['-1', -1],
    ['1.5', 1.5],
    ['"1000"', '1000'],
    ['null', null],
    ['true', true],
    ['nedostaje', undefined],
  ]) {
    const zahtjev = vrijednost === undefined ? bez(tijelo, 'volumeMl') : { ...tijelo, volumeMl: vrijednost };
    await provjeriOdbijanjeBezBaze((db) => kupi(zahtjev, { db }), 422, 'INVALID_VOLUME', `volumeMl ${opis}`);
  }
});

test('I03-T05 amountMinor: 0, 1000000 i -0 prolaze (-0 sačuvan kao 0); van opsega, decimalno, string, null, nedostaje → INVALID_AMOUNT', async () => {
  await pripremiNalog('korisnikA');
  for (const [i, amountMinor] of [0, 1_000_000].entries()) {
    const odgovor = await kupi(tijeloKupovine('korisnikA', { posTransactionId: `A${i}`, amountMinor }));
    assert.equal(odgovor.status, 201, `amountMinor ${amountMinor}`);
    assert.equal((await podaci(`purchases/SIM01__A${i}`)).amountMinor, amountMinor);
  }
  const sirovo = JSON.stringify(tijeloKupovine('korisnikA', { posTransactionId: 'ANULA' })).replace('"amountMinor":7050', '"amountMinor":-0');
  const odgovor = await kupiSirovo(sirovo);
  assert.equal(odgovor.status, 201, odgovor.text);
  assert.ok(Object.is(odgovor.body.amountMinor, 0));
  assert.ok(Object.is((await podaci('purchases/SIM01__ANULA')).amountMinor, 0), '-0 je sačuvan kao double -0');

  const tijelo = tijeloKupovine('korisnikA', { posTransactionId: 'AX' });
  for (const [opis, vrijednost] of [
    ['-1', -1],
    ['1000001', 1_000_001],
    ['1.5', 1.5],
    ['"100"', '100'],
    ['null', null],
    ['nedostaje', undefined],
  ]) {
    const zahtjev = vrijednost === undefined ? bez(tijelo, 'amountMinor') : { ...tijelo, amountMinor: vrijednost };
    await provjeriOdbijanjeBezBaze((db) => kupi(zahtjev, { db }), 422, 'INVALID_AMOUNT', `amountMinor ${opis}`);
  }
});

test('I03-T06 currency: "EUR" prolazi; "eur", "BAM", "", " EUR", broj, null, nedostaje → UNSUPPORTED_CURRENCY', async () => {
  await pripremiNalog('korisnikA');
  assert.equal((await kupi(tijeloKupovine('korisnikA', { posTransactionId: 'C0' }))).status, 201);
  const tijelo = tijeloKupovine('korisnikA', { posTransactionId: 'CX' });
  for (const [opis, vrijednost] of [
    ['eur', 'eur'],
    ['BAM', 'BAM'],
    ['prazan', ''],
    ['" EUR"', ' EUR'],
    ['978', 978],
    ['null', null],
    ['nedostaje', undefined],
  ]) {
    const zahtjev = vrijednost === undefined ? bez(tijelo, 'currency') : { ...tijelo, currency: vrijednost };
    await provjeriOdbijanjeBezBaze((db) => kupi(zahtjev, { db }), 422, 'UNSUPPORTED_CURRENCY', `currency ${opis}`);
  }
});

test('I03-T07 (b) occurredAt: sada, prošlost, +4:30 i offset prolaze kao Timestamp; +5:01 i neispravno → INVALID_OCCURRED_AT', async () => {
  await pripremiNalog('korisnikA');
  const ispravni = [
    ['sada', new Date().toISOString()],
    ['prošlost 2020', '2020-03-01T08:15:30.250Z'],
    ['+4:30', new Date(Date.now() + 270_000).toISOString()],
  ];
  for (const [i, [opis, occurredAt]] of ispravni.entries()) {
    const odgovor = await kupi(tijeloKupovine('korisnikA', { posTransactionId: `T${i}`, occurredAt }));
    assert.equal(odgovor.status, 201, opis);
    const sacuvano = (await podaci(`purchases/SIM01__T${i}`)).occurredAt;
    assert.ok(sacuvano instanceof Timestamp, `${opis}: nije Timestamp`);
    assert.equal(sacuvano.toMillis(), Date.parse(occurredAt), opis);
    assert.equal(odgovor.body.occurredAt, new Date(Date.parse(occurredAt)).toISOString(), opis);
  }
  const saOffsetom = await kupi(tijeloKupovine('korisnikA', { posTransactionId: 'TOFF', occurredAt: '2025-01-15T12:00:00+02:00' }));
  assert.equal(saOffsetom.status, 201);
  assert.equal(saOffsetom.body.occurredAt, '2025-01-15T10:00:00.000Z');
  assert.equal((await podaci('purchases/SIM01__TOFF')).occurredAt.toMillis(), Date.parse('2025-01-15T10:00:00.000Z'));

  const tijelo = tijeloKupovine('korisnikA', { posTransactionId: 'TX' });
  for (const [opis, vrijednost] of [
    ['+5:01', () => new Date(Date.now() + 301_000).toISOString()],
    ['neispravan string', () => 'nije-vrijeme'],
    ['30. februar', () => '2026-02-30T00:00:00Z'],
    ['broj', () => Date.now()],
    ['bez vremenske zone', () => '2026-01-15T10:00:00'],
    ['prazan string', () => ''],
    ['nedostaje', () => undefined],
  ]) {
    const occurredAt = vrijednost();
    const zahtjev = occurredAt === undefined ? bez(tijelo, 'occurredAt') : { ...tijelo, occurredAt };
    await provjeriOdbijanjeBezBaze((db) => kupi(zahtjev, { db }), 422, 'INVALID_OCCURRED_AT', `occurredAt ${opis}`);
  }
});

test('I03-T08 posTransactionId: 1 i 64 znaka, ".", "a.b-c_D9" prolaze; 65, prazan, "/", razmak, ne-ASCII, prelom, broj → INVALID_TRANSACTION_ID', async () => {
  await pripremiNalog('korisnikA');
  for (const posTransactionId of ['1', 'x'.repeat(64), 'a.b-c_D9', '.']) {
    const odgovor = await kupi(tijeloKupovine('korisnikA', { posTransactionId }));
    assert.equal(odgovor.status, 201, `posTransactionId dužine ${posTransactionId.length}`);
    assert.equal(odgovor.body.purchaseId, `SIM01__${posTransactionId}`);
    assert.ok(await podaci(`purchases/SIM01__${posTransactionId}`), posTransactionId);
  }
  const tijelo = tijeloKupovine('korisnikA');
  for (const [opis, vrijednost] of [
    ['65 znakova', 'x'.repeat(65)],
    ['prazan', ''],
    ['a/b', 'a/b'],
    ['a b', 'a b'],
    ['č', 'č'],
    ['a\\n', 'a\n'],
    ['broj 184', 184],
    ['null', null],
    ['nedostaje', undefined],
  ]) {
    const zahtjev = vrijednost === undefined ? bez(tijelo, 'posTransactionId') : { ...tijelo, posTransactionId: vrijednost };
    await provjeriOdbijanjeBezBaze((db) => kupi(zahtjev, { db }), 422, 'INVALID_TRANSACTION_ID', `posTransactionId ${opis}`);
  }
});

test('I03-T09 loyaltyUid bez ACTIVE naloga → 404 LOYALTY_ACCOUNT_NOT_FOUND, ništa upisano', async () => {
  await pripremiNalog('brisanje', { accountStatus: 'DELETION_IN_PROGRESS' });
  await pripremiNalog('nepoznatStatus', { accountStatus: 'NEPOZNAT' });
  await pripremiNalog('samoUsers');
  await referenca('loyaltyAccounts/samoUsers').delete();
  await pripremiNalog('samoNalog');
  await referenca('users/samoNalog').delete();
  for (const uid of ['nepostojeci', 'brisanje', 'samoUsers', 'samoNalog', 'nepoznatStatus']) {
    const prije = await snimakBaze();
    provjeriTijeloGreske(await kupi(tijeloKupovine(uid)), 404, 'LOYALTY_ACCOUNT_NOT_FOUND', uid);
    assert.deepStrictEqual(await snimakBaze(), prije, `${uid}: baza promijenjena`);
  }
  assert.equal(await brojDokumenata('purchases'), 0);
});

test('I03-T09 neispravan format loyaltyUid → 404 bez ikakvog pristupa bazi; uid od 128 znakova prolazi', async () => {
  for (const [opis, uid] of [
    ['a/b', 'a/b'],
    ['prazan', ''],
    ['.', '.'],
    ['..', '..'],
    ['__x__', '__x__'],
    ['129 znakova', 'u'.repeat(129)],
    ['usamljen surogat', '\uD800'],
  ]) {
    await provjeriOdbijanjeBezBaze((db) => kupi(tijeloKupovine(uid), { db }), 404, 'LOYALTY_ACCOUNT_NOT_FOUND', opis);
  }
  const dugUid = 'u'.repeat(128);
  await pripremiNalog(dugUid);
  const odgovor = await kupi(tijeloKupovine(dugUid));
  assert.equal(odgovor.status, 201);
  assert.equal((await podaci('purchases/SIM01__000184')).uid, dugUid);
});

test('I03-T14 isti posTransactionId na dvije stanice → dvije kupovine; "a__b" radi ispravno', async () => {
  await pripremiNalog('korisnikA', { availablePoints: 0, reservedPoints: 0 });
  const tijelo = tijeloKupovine('korisnikA');
  const prva = await kupi(tijelo, { kljuc: K1 });
  const druga = await kupi(tijelo, { kljuc: K2 });
  assert.equal(prva.status, 201);
  assert.equal(druga.status, 201);
  assert.equal(prva.body.purchaseId, 'SIM01__000184');
  assert.equal(druga.body.purchaseId, 'SIM02__000184');
  assert.equal((await podaci('purchases/SIM01__000184')).stationId, 'SIM01');
  assert.equal((await podaci('purchases/SIM02__000184')).stationId, 'SIM02');
  assert.equal(await brojDokumenata('loyaltyLedger'), 2);
  assert.equal(await brojDokumenata('notifications'), 2);
  assert.equal((await podaci('loyaltyAccounts/korisnikA')).availablePoints, 84);

  const saCrtama = { ...tijelo, posTransactionId: 'a__b' };
  const treca = await kupi(saCrtama);
  assert.equal(treca.status, 201);
  assert.equal(treca.body.purchaseId, 'SIM01__a__b');
  assert.equal((await podaci('purchases/SIM01__a__b')).posTransactionId, 'a__b');
  assert.equal((await podaci('loyaltyLedger/earn_SIM01__a__b')).purchaseId, 'SIM01__a__b');
  assert.equal((await podaci('notifications/earn_SIM01__a__b')).relatedPurchaseId, 'SIM01__a__b');
  const ponovljena = await kupi(saCrtama);
  assert.equal(ponovljena.status, 200);
  assert.deepStrictEqual(ponovljena.body, treca.body);
  assert.equal(await brojDokumenata('purchases'), 3);
});

test('I03-T18 (O-3) retry sa drugim occurredAt → prvo tijelo, sačuvani occurredAt nepromijenjen; neispravan ulaz na retry-ju → kod polja (i03/P-6)', async () => {
  await pripremiNalog('korisnikA');
  const t1 = new Date(Date.now() - 120_000).toISOString();
  const t2 = new Date(Date.now() - 30_000).toISOString();
  const prvi = await kupi(tijeloKupovine('korisnikA', { occurredAt: t1 }));
  assert.equal(prvi.status, 201);
  const stanje = await snimakBaze();

  const retry = await kupi(tijeloKupovine('korisnikA', { occurredAt: t2 }));
  assert.equal(retry.status, 200);
  assert.deepStrictEqual(retry.body, prvi.body);
  assert.equal(retry.body.occurredAt, t1);
  assert.equal((await podaci('purchases/SIM01__000184')).occurredAt.toMillis(), Date.parse(t1));
  assert.deepStrictEqual(await snimakBaze(), stanje);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);

  // i03/P-6 dopuna: validacija prethodi provjeri idempotentnosti i kad purchase već postoji.
  await provjeriOdbijanjeBezBaze(
    (db) => kupi(tijeloKupovine('korisnikA', { occurredAt: new Date(Date.now() + 301_000).toISOString() }), { db }),
    422,
    'INVALID_OCCURRED_AT',
    'retry sa occurredAt > +5 min',
  );
  await provjeriOdbijanjeBezBaze(
    (db) => kupi(tijeloKupovine('a/b'), { db }),
    404,
    'LOYALTY_ACCOUNT_NOT_FOUND',
    'retry sa neispravnim formatom loyaltyUid',
  );
  assert.deepStrictEqual(await snimakBaze(), stanje);
});

test('I03-T19 (O-12) nalog u DELETION_IN_PROGRESS: retry → prvo tijelo; drugi volumeMl → 409; nova kupovina → 404', async () => {
  await pripremiNalog('korisnikA');
  const tijelo = tijeloKupovine('korisnikA');
  const prvi = await kupi(tijelo);
  assert.equal(prvi.status, 201);
  await referenca('users/korisnikA').update({ accountStatus: 'DELETION_IN_PROGRESS' });
  const stanje = await snimakBaze();

  const retry = await kupi(tijelo);
  assert.equal(retry.status, 200);
  assert.deepStrictEqual(retry.body, prvi.body);
  assert.deepStrictEqual(await snimakBaze(), stanje);

  provjeriTijeloGreske(await kupi({ ...tijelo, volumeMl: tijelo.volumeMl + 1 }), 409, 'IDEMPOTENCY_CONFLICT', 'drugi volumeMl');
  assert.deepStrictEqual(await snimakBaze(), stanje);

  provjeriTijeloGreske(await kupi({ ...tijelo, posTransactionId: 'NOVA' }), 404, 'LOYALTY_ACCOUNT_NOT_FOUND', 'nova kupovina');
  assert.deepStrictEqual(await snimakBaze(), stanje);
  assert.equal(await brojDokumenata('purchases'), 1);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  assert.equal(await brojDokumenata('notifications'), 1);
});
