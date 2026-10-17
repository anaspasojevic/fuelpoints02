// Atomičnost, konkurentnost, idempotentnost i rok izdavanja nagrade (§13.2, §14, §18.1, NFR-04 … NFR-06, AC-05, AC-06, O-14):
// API-T07 (uz K-3), I04-T10 … I04-T15.
import assert from 'node:assert/strict';
import crypto, { createHash, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { setTimeout as pauza } from 'node:timers/promises';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { izdajNagradu } from '../../src/servisi/izdavanjeNagrade.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const TRAJANJE_MS = 900_000;
const FIKSNO = Buffer.alloc(32, 0xcd);
const FIKSNO_HEX = FIKSNO.toString('hex');

const K1 = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(posKonfiguracija([['SIM01', K1]])).stanice;

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
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice: POS_STANICE });
}

function izdaj(rewardId, tijelo, { token, db, app } = {}) {
  return request(app ?? aplikacija(db))
    .post(`/api/v1/rewards/${rewardId}/issue`)
    .set('Authorization', `Bearer ${token}`)
    .send(tijelo);
}

function kljucZahtjeva(uid, requestId) {
  return createHash('sha256').update(Buffer.from(`${uid}:${requestId}`, 'utf8')).digest('hex');
}

async function korisnik() {
  brojac += 1;
  return napraviKorisnika(`atomicnost${brojac}@primjer.test`);
}

// randomBytes(32) (samo generisiVoucherId) vraća FIKSNO; ostali pozivi idu izvornoj funkciji.
function fiksirajVoucherId() {
  const izvorna = crypto.randomBytes;
  mock.method(crypto, 'randomBytes', (n, ...ostalo) => (n === 32 ? FIKSNO : izvorna(n, ...ostalo)));
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
  for (const zabranjeno of ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno', 'Nekonzistentno', 'availablePoints']) {
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

async function brojKorisnika(kolekcija, uid) {
  return (await firebase.db.collection(kolekcija).where('uid', '==', uid).get()).size;
}

async function brojDogadjaja(uid, type) {
  return (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).where('type', '==', type).get()).size;
}

async function pripremiNalog(uid, availablePoints, reservedPoints) {
  await referenca(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
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

test('API-T07 dva paralelna CAR_WASH sa 50 bodova (20 ponavljanja) → nikad oba uspješna; bar jednom {201, 409 INSUFFICIENT_POINTS} (K-3)', async (t) => {
  const raspodjela = {};
  let brojIshoda201i409 = 0;
  for (let ponavljanje = 1; ponavljanje <= 20; ponavljanje += 1) {
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 50, 0);
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const odgovori = await Promise.all([
      izdaj('CAR_WASH', { requestId: randomUUID() }, { token: idToken, app }),
      izdaj('CAR_WASH', { requestId: randomUUID() }, { token: idToken, app }),
    ]);
    await omotac.sveTransakcijeZavrsene;
    const opis = `ponavljanje ${ponavljanje}`;
    const statusi = odgovori.map((o) => o.status).sort();
    const kljucIshoda = odgovori
      .map((o) => (o.status === 201 ? '201' : `${o.status} ${o.body.error?.code}`))
      .sort()
      .join(' + ');
    raspodjela[kljucIshoda] = (raspodjela[kljucIshoda] ?? 0) + 1;
    t.diagnostic(`${opis}: ${kljucIshoda}`);

    assert.ok(statusi.every((s) => [201, 409, 503].includes(s)), `${opis}: statusi ${statusi.join(',')}`);
    assert.ok(statusi.filter((s) => s === 201).length <= 1, `${opis}: dva uspješna izdavanja`);
    for (const odgovor of odgovori) {
      if (odgovor.status === 409) {
        provjeriTijeloGreske(odgovor, 409, 'INSUFFICIENT_POINTS', opis);
      }
      if (odgovor.status === 503) {
        provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', opis);
      }
    }
    if (statusi[0] === 201 && statusi[1] === 409) {
      brojIshoda201i409 += 1;
    }
    const vauceri = await brojKorisnika('vouchers', uid);
    assert.equal(await brojDogadjaja(uid, 'REWARD_RESERVE'), vauceri, `${opis}: RESERVE ≠ voucher-i`);
    assert.equal(await brojKorisnika('rewardRequests', uid), vauceri, `${opis}: mapping ≠ voucher-i`);
    assert.ok(vauceri <= 1, `${opis}: ${vauceri} voucher-a`);
    assert.deepStrictEqual(await nalog(uid), vauceri === 1 ? [0, 50] : [50, 0], `${opis}: balance`);
  }
  t.diagnostic(`raspodjela ishoda: ${JSON.stringify(raspodjela)}`);
  // K-3: drugi zahtjev je bar jednom odbila provjera bodova u transakciji, a ne samo kontencija.
  assert.ok(brojIshoda201i409 >= 1, `K-3: nijedno ponavljanje sa ishodom {201, 409 INSUFFICIENT_POINTS}: ${JSON.stringify(raspodjela)}`);
});

test('I04-T10 (a) 10 paralelnih izdavanja sa istim isteklim voucher-om → tačno jedan REWARD_RELEASE, balance tačan', async (t) => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 50);
  const V = '1'.repeat(64);
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
  const omotac = omotacBaze(firebase.db);
  const app = aplikacija(omotac);
  const tijela = Array.from({ length: 10 }, () => ({ requestId: randomUUID() }));
  const odgovori = await Promise.all(tijela.map((tijelo) => izdaj('SHOWER', tijelo, { token: idToken, app })));
  await omotac.sveTransakcijeZavrsene;
  const statusi = odgovori.map((o) => o.status);
  t.diagnostic(`statusi: ${statusi.join(',')}`);
  assert.ok(statusi.every((s) => [201, 409, 503].includes(s)), `statusi: ${statusi.join(',')}`);
  for (const odgovor of odgovori.filter((o) => o.status === 409)) {
    provjeriTijeloGreske(odgovor, 409, 'INSUFFICIENT_POINTS', '409');
  }
  for (const odgovor of odgovori.filter((o) => o.status === 503)) {
    provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', '503');
  }
  let broj = (await podaci(`loyaltyLedger/release_${V}`)) ? 1 : 0;
  assert.equal(await brojKorisnika('vouchers', uid) - 1, broj, 'novi voucher-i ≠ release');
  assert.equal(await brojDogadjaja(uid, 'REWARD_RESERVE'), broj);
  assert.equal(await brojKorisnika('rewardRequests', uid), broj);
  if (broj === 0) {
    // Svi 503 bez kasnog commit-a: isti requestId se ponavlja do uspjeha (idempotentno).
    let uspjeh = false;
    for (let pokusaj = 1; pokusaj <= 20 && !uspjeh; pokusaj += 1) {
      uspjeh = (await izdaj('SHOWER', tijela[0], { token: idToken })).status === 201;
    }
    assert.ok(uspjeh, 'nema uspjeha poslije 20 pokušaja');
    broj = 1;
  }
  assert.equal(await brojDogadjaja(uid, 'REWARD_RELEASE'), 1);
  assert.equal((await podaci(`vouchers/${V}`)).status, 'EXPIRED');
  assert.deepStrictEqual(await nalog(uid), [20, 30]);
});

test('I04-T10 (b) nekonzistentno stanje voucher-a i naloga → 500, ništa upisano', async () => {
  const { uid, idToken } = await korisnik();
  const V = '1'.repeat(64);
  const istekao = Date.now() - 60_000;
  const slucajevi = [
    [
      'release_V postoji a V ACTIVE i istekao',
      async () => {
        await pripremiVaucer(V, uid, { expiresAtMs: istekao });
        await referenca(`loyaltyLedger/release_${V}`).set({ uid, type: 'REWARD_RELEASE', voucherId: V });
      },
    ],
    ['ACTIVE voucher costPoints 0', async () => pripremiVaucer(V, uid, { costPoints: 0, expiresAtMs: istekao })],
    ["ACTIVE voucher costPoints '50'", async () => pripremiVaucer(V, uid, { costPoints: '50', expiresAtMs: istekao })],
    [
      'ACTIVE voucher bez expiresAt',
      async () => {
        const vaucer = kanonskiVaucer(uid, { expiresAtMs: istekao });
        delete vaucer.expiresAt;
        await referenca(`vouchers/${V}`).set(vaucer);
      },
    ],
    [
      'reservedPoints manji od cijene isteklog voucher-a',
      async () => {
        await pripremiVaucer(V, uid, { expiresAtMs: istekao });
        await referenca(`loyaltyAccounts/${uid}`).update({ reservedPoints: 20 });
      },
    ],
  ];
  for (const [opis, pripremi] of slucajevi) {
    await referenca(`vouchers/${V}`).delete();
    await referenca(`loyaltyLedger/release_${V}`).delete();
    await pripremiNalog(uid, 100, 50);
    await pripremi();
    const prije = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdaj('SHOWER', { requestId: randomUUID() }, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
  }
});

test('I04-T10 (c) nekonzistentan mapping → 500, ništa upisano', async () => {
  const a = await korisnik();
  const b = await korisnik();
  await pripremiNalog(a.uid, 100, 50);
  const R = randomUUID();
  const kljuc = kljucZahtjeva(a.uid, R);
  const V = '2'.repeat(64);
  const mapping = (dodatno = {}) => ({ uid: a.uid, requestId: R, rewardId: 'CAR_WASH', voucherId: V, createdAt: VRIJEME_PRIPREME, ...dodatno });
  const buduci = Date.now() + 600_000;
  const slucajevi = [
    ['mapping sa drugim uid', mapping({ uid: b.uid }), kanonskiVaucer(a.uid, { expiresAtMs: buduci })],
    ['mapping sa drugim requestId', mapping({ requestId: randomUUID() }), kanonskiVaucer(a.uid, { expiresAtMs: buduci })],
    ['voucher iz mapping-a ne postoji', mapping(), null],
    ['voucher sa drugim uid', mapping(), kanonskiVaucer(b.uid, { expiresAtMs: buduci })],
    ['voucher sa drugim rewardId', mapping(), kanonskiVaucer(a.uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: buduci })],
    ["voucherId 'a/b'", mapping({ voucherId: 'a/b' }), null],
    ['rewardId nije string', mapping({ rewardId: 5 }), kanonskiVaucer(a.uid, { expiresAtMs: buduci })],
  ];
  for (const [opis, dokumentMappinga, vaucer] of slucajevi) {
    await referenca(`rewardRequests/${kljuc}`).set(dokumentMappinga);
    if (vaucer === null) {
      await referenca(`vouchers/${V}`).delete();
    } else {
      await referenca(`vouchers/${V}`).set(vaucer);
    }
    const prije = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdaj('CAR_WASH', { requestId: R }, { token: a.idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
  }
});

test('I04-T10 (d) prisilan sudar voucherId (vouchers/{id} ili reserve_{id} postoji) → 500, ništa upisano', async () => {
  for (const [opis, putanja, dokument] of [
    ['reserve_ postoji', `loyaltyLedger/reserve_${FIKSNO_HEX}`, { uid: 'drugi', type: 'REWARD_RESERVE', voucherId: FIKSNO_HEX }],
    ['voucher postoji', `vouchers/${FIKSNO_HEX}`, kanonskiVaucer('drugi', { expiresAtMs: Date.now() + 600_000 })],
  ]) {
    await ocistiEmulatore();
    await napuniRewardDefinitions(firebase.db);
    const k = await korisnik();
    await pripremiNalog(k.uid, 50, 0);
    await referenca(putanja).set(dokument);
    const prije = await snimakBaze();
    fiksirajVoucherId();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await izdaj('CAR_WASH', { requestId: randomUUID() }, { token: k.idToken, db: omotac });
    mock.restoreAll();
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await podaci(putanja), dokument, `${opis}: pripremljeni dokument promijenjen`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
  }
});

test('I04-T11 failure injection na svakom upisu i prije commit-a → 500 bez stack-a, stanje nepromijenjeno', async () => {
  const { uid, idToken } = await korisnik();
  const V = '1'.repeat(64);
  const R = randomUUID();
  const kljuc = kljucZahtjeva(uid, R);
  const scenariji = [
    [
      '(a) bez isteklih',
      async () => pripremiNalog(uid, 50, 0),
      'CAR_WASH',
      [
        ['update', `loyaltyAccounts/${uid}`],
        ['create', `vouchers/${FIKSNO_HEX}`],
        ['create', `loyaltyLedger/reserve_${FIKSNO_HEX}`],
        ['create', `rewardRequests/${kljuc}`],
      ],
    ],
    [
      '(b) jedan istekao',
      async () => {
        await pripremiNalog(uid, 0, 50);
        await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
      },
      'SHOWER',
      [
        ['update', `vouchers/${V}`],
        ['create', `loyaltyLedger/release_${V}`],
        ['update', `loyaltyAccounts/${uid}`],
        ['create', `vouchers/${FIKSNO_HEX}`],
        ['create', `loyaltyLedger/reserve_${FIKSNO_HEX}`],
        ['create', `rewardRequests/${kljuc}`],
      ],
    ],
    [
      '(c) O-14 grana',
      async () => {
        await pripremiNalog(uid, 5, 30);
        await pripremiVaucer(V, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: Date.now() - 60_000 });
      },
      'CAR_WASH',
      [
        ['update', `vouchers/${V}`],
        ['create', `loyaltyLedger/release_${V}`],
        ['update', `loyaltyAccounts/${uid}`],
      ],
    ],
  ];
  fiksirajVoucherId();
  for (const [opis, pripremi, rewardId, upisi] of scenariji) {
    await referenca(`vouchers/${V}`).delete();
    await pripremi();
    const pocetno = await snimakBaze();
    const ocekivaniUpisi = upisi.map(([metod, putanja]) => ({ metod, putanja }));
    for (let upis = 1; upis <= upisi.length; upis += 1) {
      const omotac = omotacBaze(firebase.db, { baciNaUpisu: upis });
      const odgovor = await izdaj(rewardId, { requestId: R }, { token: idToken, db: omotac });
      provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `${opis} upis ${upis}`);
      provjeriBezInternihDetalja(odgovor, `${opis} upis ${upis}`);
      assert.deepStrictEqual(omotac.upisi, ocekivaniUpisi.slice(0, upis), `${opis} upis ${upis}: zabilježeni upisi`);
      assert.deepStrictEqual(await snimakBaze(), pocetno, `${opis} upis ${upis}: baza promijenjena`);
    }
    const prijeCommita = omotacBaze(firebase.db, { baciPrijeCommita: true });
    const odgovor = await izdaj(rewardId, { requestId: R }, { token: idToken, db: prijeCommita });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `${opis} (d) prije commit-a`);
    provjeriBezInternihDetalja(odgovor, `${opis} (d)`);
    assert.deepStrictEqual(prijeCommita.upisi, ocekivaniUpisi, `${opis} (d): callback nije upisao sve`);
    assert.deepStrictEqual(await snimakBaze(), pocetno, `${opis} (d): baza promijenjena`);

    // Kontrola: omotač bez opcija → uspjeh (201) ili O-14 (409).
    const kontrola = omotacBaze(firebase.db);
    const uspjeh = await izdaj(rewardId, { requestId: R }, { token: idToken, db: kontrola });
    assert.equal(uspjeh.status, opis.startsWith('(c)') ? 409 : 201, `${opis} kontrola: ${uspjeh.text}`);
    assert.deepStrictEqual(kontrola.upisi, ocekivaniUpisi, `${opis} kontrola: upisi`);
    // Stanje za sljedeći scenario: bez voucher-a, mapping-a i ledger-a ovog scenarija.
    for (const putanja of [`vouchers/${FIKSNO_HEX}`, `loyaltyLedger/reserve_${FIKSNO_HEX}`, `loyaltyLedger/release_${V}`, `rewardRequests/${kljuc}`]) {
      await referenca(putanja).delete();
    }
  }
});

test('I04-T11 (z1)–(z4) zastarjelo čitanje postojećeg dokumenta → 500, postojeći dokument nepromijenjen (tx.create)', async () => {
  const { uid, idToken } = await korisnik();
  const R = randomUUID();
  const kljuc = kljucZahtjeva(uid, R);
  const V = '1'.repeat(64);
  const scenariji = [
    ['(z1) vouchers/{FIKSNO}', `vouchers/${FIKSNO_HEX}`, kanonskiVaucer('drugi', { expiresAtMs: Date.now() + 600_000 }), 'CAR_WASH'],
    [
      '(z2) mapping',
      `rewardRequests/${kljuc}`,
      { uid, requestId: R, rewardId: 'CAR_WASH', voucherId: '9'.repeat(64), createdAt: VRIJEME_PRIPREME },
      'CAR_WASH',
    ],
    ['(z3) reserve_{FIKSNO}', `loyaltyLedger/reserve_${FIKSNO_HEX}`, { uid: 'drugi', type: 'REWARD_RESERVE', voucherId: FIKSNO_HEX }, 'CAR_WASH'],
    ['(z4) release_V', `loyaltyLedger/release_${V}`, { uid, type: 'REWARD_RELEASE', voucherId: V }, 'SHOWER'],
  ];
  fiksirajVoucherId();
  for (const [opis, putanja, dokument, rewardId] of scenariji) {
    await referenca(`vouchers/${V}`).delete();
    for (const [, p] of scenariji) {
      await referenca(p).delete();
    }
    if (opis.startsWith('(z4)')) {
      await pripremiNalog(uid, 0, 50);
      await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
    } else {
      await pripremiNalog(uid, 50, 0);
    }
    await referenca(putanja).set(dokument);
    const prije = await snimakBaze();
    const omotac = omotacBaze(firebase.db, { sakrijPostojece: [putanja] });
    const odgovor = await izdaj(rewardId, { requestId: R }, { token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.ok(omotac.upisi.length >= 1, `${opis}: transakcija nije pokušala upis`);
    assert.deepStrictEqual(await podaci(putanja), dokument, `${opis}: dokument promijenjen`);
    assert.deepStrictEqual(await snimakBaze(), prije, `${opis}: baza promijenjena`);
    if (opis.startsWith('(z2)')) {
      assert.equal(await brojKorisnika('vouchers', uid), 0);
    }
    if (opis.startsWith('(z4)')) {
      assert.equal((await podaci(`vouchers/${V}`)).status, 'ACTIVE');
    }
  }
  mock.restoreAll();
  // Kontrola: omotač bez opcija → 201.
  for (const [, p] of scenariji) {
    await referenca(p).delete();
  }
  await referenca(`vouchers/${V}`).delete();
  await pripremiNalog(uid, 50, 0);
  assert.equal((await izdaj('CAR_WASH', { requestId: R }, { token: idToken, db: omotacBaze(firebase.db) })).status, 201);
});

test('I04-T12 10 paralelnih ISTIH zahtjeva (3 ponavljanja) → 1 voucher, 1 RESERVE, 1 mapping, bez 500, najviše jedan 201', async (t) => {
  for (let ponavljanje = 1; ponavljanje <= 3; ponavljanje += 1) {
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 50, 0);
    const tijelo = { requestId: randomUUID() };
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const odgovori = await Promise.all(Array.from({ length: 10 }, () => izdaj('CAR_WASH', tijelo, { token: idToken, app })));
    await omotac.sveTransakcijeZavrsene;
    const statusi = odgovori.map((o) => o.status);
    t.diagnostic(`ponavljanje ${ponavljanje}: statusi ${statusi.join(',')}`);
    assert.ok(statusi.every((s) => [200, 201, 503].includes(s)), `statusi: ${statusi.join(',')}`);
    assert.ok(statusi.filter((s) => s === 201).length <= 1, `statusi: ${statusi.join(',')}`);
    for (const odgovor of odgovori.filter((o) => o.status === 503)) {
      provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', '503 pod kontencijom');
    }
    const uspjesni = odgovori.filter((o) => o.status === 200 || o.status === 201);
    for (const odgovor of uspjesni) {
      assert.deepStrictEqual(odgovor.body, uspjesni[0].body);
    }
    const postojao = (await brojKorisnika('vouchers', uid)) === 1;
    const naknadni = await izdaj('CAR_WASH', tijelo, { token: idToken });
    assert.equal(naknadni.status, postojao ? 200 : 201, `naknadni retry: ${naknadni.text}`);
    if (uspjesni.length > 0) {
      assert.deepStrictEqual(naknadni.body, uspjesni[0].body);
    }
    assert.equal(await brojKorisnika('vouchers', uid), 1);
    assert.equal(await brojDogadjaja(uid, 'REWARD_RESERVE'), 1);
    assert.equal(await brojKorisnika('rewardRequests', uid), 1);
    assert.deepStrictEqual(await nalog(uid), [0, 50]);
  }
});

test('I04-T13 izdavanja paralelno sa kupovinama istog korisnika → tačan balance i konzistentan lanac EARN/RESERVE', async (t) => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 0);
  const omotac = omotacBaze(firebase.db);
  const app = aplikacija(omotac);
  const kupovine = Array.from({ length: 5 }, (_, i) => ({
    loyaltyUid: uid,
    posTransactionId: `I13-${i}`,
    volumeMl: 20_000,
    amountMinor: 3000,
    currency: 'EUR',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
  }));
  const izdavanja = Array.from({ length: 3 }, () => ({ requestId: randomUUID() }));
  let broj503 = 0;
  let broj409 = 0;
  // 503 se ponavlja ISTIM zahtjevom. Izdavanje sa 409 INSUFFICIENT_POINTS se ponavlja istim requestId-em dok kupovine ne donesu
  // bodove (neuspjeh ne pravi mapping, i04/P-13), da se RESERVE događaji prepliću sa EARN-ovima. Pauza od 250 ms ostavlja kupovinama
  // prostor (čitanje istog loyaltyAccounts u transakciji je kontencija i za 409).
  async function doIshoda(posalji, opis, ponoviNa409 = false) {
    for (let pokusaj = 1; pokusaj <= 120; pokusaj += 1) {
      const odgovor = await posalji();
      if (odgovor.status === 503) {
        provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', `${opis} pokušaj ${pokusaj}`);
        broj503 += 1;
        continue;
      }
      if (ponoviNa409 && odgovor.status === 409) {
        provjeriTijeloGreske(odgovor, 409, 'INSUFFICIENT_POINTS', `${opis} pokušaj ${pokusaj}`);
        broj409 += 1;
        await pauza(250);
        continue;
      }
      return odgovor;
    }
    throw new Error(`${opis}: nema ishoda poslije 120 pokušaja`);
  }
  const odgovori = await Promise.all([
    ...kupovine.map((tijelo) =>
      doIshoda(() => request(app).post('/api/v1/pos/purchases').set('X-POS-API-Key', K1).send(tijelo), tijelo.posTransactionId),
    ),
    ...izdavanja.map((tijelo) => doIshoda(() => izdaj('SHOWER', tijelo, { token: idToken, app }), tijelo.requestId, true)),
  ]);
  await omotac.sveTransakcijeZavrsene;
  t.diagnostic(`statusi: ${odgovori.map((o) => o.status).join(',')}; broj 503: ${broj503}; broj 409 prije uspjeha: ${broj409}`);
  for (const odgovor of odgovori.slice(0, 5)) {
    assert.ok([200, 201].includes(odgovor.status), `kupovina: ${odgovor.text}`);
  }
  for (const [i, odgovor] of odgovori.slice(5).entries()) {
    assert.ok([200, 201].includes(odgovor.status), `izdavanje: ${odgovor.text}`);
    assert.ok(await podaci(`rewardRequests/${kljucZahtjeva(uid, izdavanja[i].requestId)}`), 'uspješno izdavanje bez mapping-a');
  }

  const vauceri = await brojKorisnika('vouchers', uid);
  assert.equal(vauceri, 3);
  assert.equal(await brojKorisnika('rewardRequests', uid), 3);
  const [dostupno, rezervisano] = await nalog(uid);
  assert.equal(dostupno + rezervisano, 100);
  assert.equal(rezervisano, 30 * vauceri);
  const dogadjaji = (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).get()).docs.map((d) => d.data());
  assert.equal(dogadjaji.length, 5 + vauceri);
  // Lanac po commit vremenu (serverTimestamp, jedan događaj po transakciji): svaki = prethodni + delta, počev od 0/0.
  dogadjaji.sort((x, y) => x.createdAt.toMillis() - y.createdAt.toMillis() || x.createdAt.nanoseconds - y.createdAt.nanoseconds);
  let [a, r] = [0, 0];
  for (const dogadjaj of dogadjaji) {
    assert.ok(['EARN', 'REWARD_RESERVE'].includes(dogadjaj.type));
    assert.equal(dogadjaj.availableAfter, a + dogadjaj.deltaAvailable, `lanac availableAfter (${dogadjaj.type})`);
    assert.equal(dogadjaj.reservedAfter, r + dogadjaj.deltaReserved, `lanac reservedAfter (${dogadjaj.type})`);
    assert.ok(dogadjaj.availableAfter >= 0 && dogadjaj.reservedAfter >= 0, 'invarijanta ≥ 0');
    [a, r] = [dogadjaj.availableAfter, dogadjaj.reservedAfter];
  }
  assert.deepStrictEqual([a, r], [dostupno, rezervisano]);
});

test('I04-T14 kasni commit poslije 503 → retry istim requestId vraća isti voucher, tačno jedan RESERVE i jedan mapping', async (t) => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 50, 0);
  const tijelo = { requestId: randomUUID() };
  const omotac = omotacBaze(firebase.db, { zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500 });
  const pocetak = Date.now();
  const odgovor = await izdaj('CAR_WASH', tijelo, { token: idToken, db: omotac });
  const trajanje = Date.now() - pocetak;
  t.diagnostic(`prvi zahtjev: HTTP ${odgovor.status} za ${trajanje} ms`);
  provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', 'prvi zahtjev');
  assert.ok(trajanje < 12_000, `503 je stigao za ${trajanje} ms`);

  await omotac.commitZavrsen;
  const mapping = await podaci(`rewardRequests/${kljucZahtjeva(uid, tijelo.requestId)}`);
  assert.ok(mapping, 'mapping ne postoji poslije kasnog commit-a');
  const vaucer = await podaci(`vouchers/${mapping.voucherId}`);
  assert.ok(vaucer, 'voucher ne postoji poslije kasnog commit-a');
  assert.ok(await podaci(`loyaltyLedger/reserve_${mapping.voucherId}`));
  assert.deepStrictEqual(await nalog(uid), [0, 50]);

  const retry = await izdaj('CAR_WASH', tijelo, { token: idToken });
  assert.equal(retry.status, 200, retry.text);
  assert.deepStrictEqual(retry.body, {
    voucherId: mapping.voucherId,
    rewardId: 'CAR_WASH',
    costPoints: 50,
    status: 'ACTIVE',
    issuedAt: vaucer.issuedAt.toDate().toISOString(),
    expiresAt: vaucer.expiresAt.toDate().toISOString(),
  });
  const drugiRetry = await izdaj('CAR_WASH', tijelo, { token: idToken });
  assert.equal(drugiRetry.status, 200);
  assert.equal(drugiRetry.text, retry.text);
  assert.equal(await brojKorisnika('vouchers', uid), 1);
  assert.equal(await brojDogadjaja(uid, 'REWARD_RESERVE'), 1);
  assert.equal(await brojKorisnika('rewardRequests', uid), 1);
  assert.deepStrictEqual(await nalog(uid), [0, 50]);
});

test('I04-T15 istekao rok prije transakcije → GreskaApi SERVICE_UNAVAILABLE, runTransaction se ne poziva, 0 pristupa bazi', async () => {
  await pripremiNalog('korisnikA', 50, 0);
  const stanje = await snimakBaze();
  const ulaz = { uid: 'korisnikA', rewardId: 'CAR_WASH', requestId: randomUUID() };
  for (const [opisRoka, rok] of [
    ['Date.now() − 1', () => Date.now() - 1],
    ['Date.now() − 10 000', () => Date.now() - 10_000],
    ['Date.now()', () => Date.now()],
    ['undefined', () => undefined],
    ['NaN', () => Number.NaN],
  ]) {
    const omotac = omotacBaze(firebase.db);
    await assert.rejects(
      izdajNagradu(omotac, ulaz, rok()),
      (greska) => {
        assert.ok(greska instanceof GreskaApi, `${opisRoka}: nije GreskaApi`);
        assert.equal(greska.kod, 'SERVICE_UNAVAILABLE', opisRoka);
        return true;
      },
      opisRoka,
    );
    assert.equal(omotac.brojTransakcija, 0, `${opisRoka}: runTransaction je pozvan`);
    assert.equal(omotac.brojPristupa, 0, `${opisRoka}: pristup bazi`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opisRoka}: baza promijenjena`);
  }

  let omotac;
  let pomakRokaMs;
  const app = napraviAplikaciju({
    servisi: firebase,
    verzijaUslova: '1.0',
    dodajRute(ruter) {
      ruter.post('/test-rok/izdavanje', async (req, res) => {
        res.json(await izdajNagradu(omotac, ulaz, Date.now() + pomakRokaMs));
      });
    },
  });
  omotac = omotacBaze(firebase.db);
  pomakRokaMs = -1;
  provjeriTijeloGreske(await request(app).post('/api/v1/test-rok/izdavanje'), 503, 'SERVICE_UNAVAILABLE', 'HTTP istekao rok');
  assert.equal(omotac.brojTransakcija, 0);
  assert.deepStrictEqual(await snimakBaze(), stanje);

  omotac = omotacBaze(firebase.db);
  pomakRokaMs = 10_000;
  const kontrola = await request(app).post('/api/v1/test-rok/izdavanje');
  assert.equal(kontrola.status, 200, kontrola.text);
  assert.equal(kontrola.body.kreirano, true);
  assert.equal(omotac.brojTransakcija, 1);
});
