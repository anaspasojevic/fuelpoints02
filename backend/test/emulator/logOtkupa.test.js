// I06-T21 (§3.4, §6 (h), D-3, O-18, O-19, NFR-07): log (svi kanali) i odgovori otkupa ne sadrže POS ključ, voucherId,
// redemptionRequestId, requestKey, uid, balance ni stack, ni za jedan ishod; log bilježi šablon rute.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { izracunajRequestKey } from '../../src/servisi/vauceri.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { hex64, napraviPripremu } from '../pomocnici/pripremaVaucera.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';
import { envProcesa, pokreniBackend, slobodanPort } from '../pomocnici/procesBackenda.js';

const projectId = provjeriTestnoOkruzenje();
const SENTINEL_KLJUC = 'SENTINEL_POS_6e1b0c3d';
const SENTINEL_ID = 'SENTINEL_RDM_4a7f';
const SENTINEL_PUTANJA = '__SENTINEL_V_8c2e__';
const ZABRANJENO_U_ODGOVORU = ['stack', '    at ', 'requestKey', 'redemptionRequestId', 'availablePoints', 'reservedPoints', 'availableAfter', 'reservedAfter'];
const RUTA = '/pos/vouchers/:voucherId/redeem';
const TS = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 5, 0));

let firebase;
let p;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  p = napraviPripremu(firebase.db);
});

beforeEach(ocistiEmulatore);

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

function tekstOdgovora(odgovor) {
  return `${odgovor.text}\n${JSON.stringify(odgovor.headers)}`;
}

// JSON zapisi loga greške sa datim correlationId-em.
function zapisLoga(log, correlationId) {
  const zapisi = [];
  for (const linija of log.split('\n')) {
    try {
      const zapis = JSON.parse(linija);
      if (zapis?.correlationId === correlationId) {
        zapisi.push(zapis);
      }
    } catch {
      // linija koja nije JSON zapis greške
    }
  }
  assert.equal(zapisi.length, 1, `log: broj zapisa za ${correlationId}`);
  return zapisi[0];
}

async function vaucer(uid, opcije = {}) {
  const V = hex64();
  await p.pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000, ...opcije });
  return V;
}

test('I06-T21 (a) log (svi kanali) i odgovori otkupa bez ključa, ID-eva, uid-a i balance-a za sve ishode; šablon rute u logu', async () => {
  const k1 = generisiPosKljuc();
  const k2 = generisiPosKljuc();
  const posStanice = procitajPosKljuceve(
    posKonfiguracija([
      ['SIM01', k1],
      ['SIM02', k2],
    ]),
  ).stanice;
  const app = (db = firebase.db) => napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice });
  const otkupi = (V, { kljuc = k1, tijelo = { redemptionRequestId: 'POS-RDM-001' }, db } = {}) =>
    request(app(db)).post(`/api/v1/pos/vouchers/${V}/redeem`).set('X-POS-API-Key', kljuc).send(tijelo);

  const uidA = 'UIDLOGA7d3e91';
  const uidB = 'UIDLOGB5c2a08';
  const uidC = 'UIDLOGC1f9b44';
  await p.pripremiNalog(uidA, 30, 330);
  await p.pripremiNalog(uidB, 30, 50, 'DELETION_IN_PROGRESS');
  const V = await vaucer(uidA);
  const W = await vaucer(uidA);
  const Vc = await vaucer(uidA, { status: 'CANCELLED', cancelledAt: TS });
  const Ve = await vaucer(uidA, { status: 'EXPIRED' });
  const Vb = await vaucer(uidB);
  const Vn = await vaucer(uidC);
  const Vx = await vaucer(uidA);
  const Vy = await vaucer(uidA);
  const Vz = await vaucer(uidA);
  const Vk = await vaucer(uidA);
  const Vl = await vaucer(uidA);
  await p.pripremiRedeem(Vy, uidA, 50, 30, 0);
  const W9 = hex64();
  await p.referenca(`redemptionRequests/${izracunajRequestKey('SIM01', 'POS-RDM-077')}`).set({
    stationId: 'SIM01',
    uid: uidA,
    redemptionRequestId: 'POS-RDM-077',
    voucherId: W9,
    resultStatus: 'REDEEMED',
    createdAt: TS,
  });

  const kasni = omotacBaze(firebase.db, { zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500 });
  const zapisi = presretniLog();
  const ishodi = [
    [200, await otkupi(V)],
    [200, await otkupi(V)],
    [401, await otkupi(V, { kljuc: SENTINEL_KLJUC })],
    [404, await otkupi(SENTINEL_PUTANJA)],
    [404, await otkupi('%E0%A4%A')],
    [404, await otkupi(hex64(), { tijelo: { redemptionRequestId: 'POS-RDM-011' } })],
    [409, await otkupi(W)],
    [409, await otkupi(V, { tijelo: { redemptionRequestId: 'POS-RDM-002' } })],
    [409, await otkupi(Vc, { tijelo: { redemptionRequestId: 'POS-RDM-003' } })],
    [409, await otkupi(Ve, { tijelo: { redemptionRequestId: 'POS-RDM-004' } })],
    [409, await otkupi(Vn, { tijelo: { redemptionRequestId: 'POS-RDM-005' } })],
    [409, await otkupi(Vb, { tijelo: { redemptionRequestId: 'POS-RDM-006' } })],
    [422, await otkupi(V, { tijelo: { redemptionRequestId: `${SENTINEL_ID}:x`, stationId: SENTINEL_ID } })],
    [500, await otkupi(Vx, { tijelo: { redemptionRequestId: 'POS-RDM-007' }, db: omotacBaze(firebase.db, { baciNaUpisu: 2 }) })],
    [
      500,
      await otkupi(Vk, {
        tijelo: { redemptionRequestId: 'POS-RDM-077' },
        db: omotacBaze(firebase.db, { sakrijPostojece: [`redemptionRequests/${izracunajRequestKey('SIM01', 'POS-RDM-077')}`] }),
      }),
    ],
    [
      500,
      await otkupi(Vy, { tijelo: { redemptionRequestId: 'POS-RDM-008' }, db: omotacBaze(firebase.db, { sakrijPostojece: [`loyaltyLedger/redeem_${Vy}`] }) }),
    ],
    [503, await otkupi(Vz, { tijelo: { redemptionRequestId: 'POS-RDM-009' }, db: omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } }) })],
    [503, await otkupi(Vl, { tijelo: { redemptionRequestId: 'POS-RDM-010' }, db: kasni })],
  ];
  await kasni.sveTransakcijeZavrsene;
  const log = tekstLoga(zapisi);
  mock.restoreAll();

  const kodovi409 = ishodi.filter(([s]) => s === 409).map(([, o]) => o.body?.error?.code);
  assert.deepStrictEqual(kodovi409, [
    'IDEMPOTENCY_CONFLICT',
    'VOUCHER_ALREADY_REDEEMED',
    'VOUCHER_CANCELLED',
    'VOUCHER_EXPIRED',
    'ACCOUNT_NOT_INITIALIZED',
    'ACCOUNT_DELETION_IN_PROGRESS',
  ]);
  const idZahtjeva = ['POS-RDM-0', 'POS-RDM-077', SENTINEL_ID];
  const kljucevi = ['POS-RDM-001', 'POS-RDM-077'].map((id) => izracunajRequestKey('SIM01', id));
  const vauceri = [V, W, Vc, Ve, Vb, Vn, Vx, Vy, Vz, Vk, Vl, W9];
  for (const [i, [status, odgovor]] of ishodi.entries()) {
    assert.equal(odgovor.status, status, `ishod ${i}: ${odgovor.text}`);
    const tekst = tekstOdgovora(odgovor);
    for (const zabranjeno of [k1, k2, SENTINEL_KLJUC, SENTINEL_ID, uidA, uidB, uidC, ...kljucevi, ...ZABRANJENO_U_ODGOVORU]) {
      assert.ok(!tekst.includes(zabranjeno), `ishod ${i} (${status}): odgovor sadrži "${zabranjeno}"`);
    }
    if (status >= 400) {
      assert.ok(log.includes(odgovor.body.error.correlationId), `ishod ${i} (${status}): log ne sadrži correlationId`);
    }
  }
  for (const zabranjeno of [k1, k2, SENTINEL_KLJUC, SENTINEL_ID, SENTINEL_PUTANJA, uidA, uidB, uidC, ...idZahtjeva, ...kljucevi, ...vauceri]) {
    assert.ok(!log.includes(zabranjeno), `log sadrži "${zabranjeno}"`);
  }
  for (const zabranjeno of ['availablePoints', 'reservedPoints']) {
    assert.ok(!log.includes(zabranjeno), `log sadrži "${zabranjeno}"`);
  }
  assert.ok(log.includes('UNAUTHENTICATED_POS'), 'log ne sadrži grešku (presretanje nije radilo)');
  for (const [i, [status, odgovor]] of ishodi.entries()) {
    if (status >= 400) {
      const ocekivana = i === 4 ? '(nepoznata ruta)' : RUTA;
      assert.equal(zapisLoga(log, odgovor.body.error.correlationId).putanja, ocekivana, `ishod ${i}: putanja u logu`);
    }
  }
});

test('I06-T21 (b) produkcioni start (src/pokreni.js): stdout i stderr bez POS ključeva i ID-eva otkupa', async () => {
  const k1 = generisiPosKljuc();
  const k2 = generisiPosKljuc();
  const port = await slobodanPort();
  const backend = pokreniBackend(
    envProcesa({
      PORT: String(port),
      FIREBASE_PROJECT_ID: projectId,
      VERZIJA_USLOVA: '1.0',
      POS_API_KLJUCEVI: posKonfiguracija([
        ['SIM01', k1],
        ['SIM02', k2],
      ]),
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    }),
  );
  const V = hex64();
  const statusi = [];
  try {
    await backend.cekajSlusanje(port);
    for (const [segment, zaglavlja, tijelo] of [
      [V, {}, { redemptionRequestId: 'POS-RDM-101' }],
      [V, { 'X-POS-API-Key': SENTINEL_KLJUC }, { redemptionRequestId: 'POS-RDM-102' }],
      [SENTINEL_PUTANJA, { 'X-POS-API-Key': k1 }, { redemptionRequestId: 'POS-RDM-103' }],
      [V, { 'X-POS-API-Key': k2 }, { redemptionRequestId: `${SENTINEL_ID}/x` }],
    ]) {
      const odgovor = await fetch(`http://127.0.0.1:${port}/api/v1/pos/vouchers/${segment}/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...zaglavlja },
        body: JSON.stringify(tijelo),
        signal: AbortSignal.timeout(15_000),
      });
      const tekst = await odgovor.text();
      statusi.push(odgovor.status);
      for (const tajna of [k1, k2, SENTINEL_KLJUC, SENTINEL_ID]) {
        assert.ok(!tekst.includes(tajna), 'odgovor sadrži tajnu');
      }
    }
  } finally {
    await backend.zaustavi();
  }
  assert.deepStrictEqual(statusi, [401, 401, 404, 422]);
  const log = backend.stdout + backend.stderr;
  assert.ok(log.includes('UNAUTHENTICATED_POS'), 'log procesa ne sadrži grešku (presretanje nije radilo)');
  for (const zabranjeno of [k1, k2, SENTINEL_KLJUC, SENTINEL_ID, SENTINEL_PUTANJA, V, 'POS-RDM-1']) {
    assert.ok(!log.includes(zabranjeno), `log procesa sadrži "${zabranjeno}"`);
  }
});
