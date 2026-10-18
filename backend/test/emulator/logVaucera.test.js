// I05-T20 (NFR-07, D-3, D-5, ODLUKE §6 (h), O-19): za ishode API-05 i API-06 log (svi kanali, in-process i produkcioni start) ne sadrži
// token, sentinel, voucherId (iz putanje, tuđi, oslobođeni), uid ni balance; nijedan odgovor nema stack, uid ni balance; šabloni ruta u logu.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';
import { envProcesa, pokreniBackend, slobodanPort } from '../pomocnici/procesBackenda.js';

const projectId = provjeriTestnoOkruzenje();
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const SENTINEL = 'SENTINEL_I05_3f9a61c2';
const ZABRANJENO_U_ODGOVORU = ['stack', '    at ', 'availablePoints', 'reservedPoints', 'availableAfter', 'reservedAfter'];
const RUTA_CANCEL = '/vouchers/:voucherId/cancel';
const RUTA_RECONCILE = '/account/vouchers/reconcile';

let firebase;

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

async function pripremiNalog(uid, availablePoints, reservedPoints, accountStatus = 'ACTIVE') {
  await firebase.db.doc(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await firebase.db.doc(`loyaltyAccounts/${uid}`).set({ availablePoints, reservedPoints, createdAt: VRIJEME_PRIPREME, updatedAt: VRIJEME_PRIPREME });
}

async function pripremiVaucer(voucherId, uid, { status = 'ACTIVE', expiresAtMs, redeemedAt = null, redeemedAtStationId = null }) {
  await firebase.db.doc(`vouchers/${voucherId}`).set({
    uid,
    rewardId: 'CAR_WASH',
    costPoints: 50,
    status,
    issuedAt: Timestamp.fromMillis(expiresAtMs - 900_000),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    redeemedAt,
    cancelledAt: null,
    redeemedAtStationId,
  });
}

function tekstOdgovora(odgovor) {
  return `${odgovor.text}\n${JSON.stringify(odgovor.headers)}`;
}

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

test('I05-T20 (a) log (svi kanali) i odgovori za sve ishode API-05 i API-06 bez token-a, sentinel-a, voucherId-a, uid-a i balance-a; šabloni ruta', async () => {
  const a = await napraviKorisnika('log5-a@primjer.test');
  const b = await napraviKorisnika('log5-b@primjer.test');
  const c = await napraviKorisnika('log5-c@primjer.test');
  const d = await napraviKorisnika('log5-d@primjer.test');
  const sada = Date.now();
  await pripremiNalog(a.uid, 0, 150);
  await pripremiNalog(b.uid, 0, 50);
  await pripremiNalog(c.uid, 0, 50, 'DELETION_IN_PROGRESS');
  const V = {
    aktivan: hex64(),
    aktivan2: hex64(),
    istekao: hex64(),
    iskoriscen: hex64(),
    tudji: hex64(),
    obrisanNalog: hex64(),
    uBrisanju: hex64(),
    nepostojeci: hex64(),
    zaUskladjivanje: hex64(),
  };
  await pripremiVaucer(V.aktivan, a.uid, { expiresAtMs: sada + 600_000 });
  await pripremiVaucer(V.aktivan2, a.uid, { expiresAtMs: sada + 600_000 });
  await pripremiVaucer(V.istekao, a.uid, { expiresAtMs: sada - 60_000 });
  await pripremiVaucer(V.iskoriscen, a.uid, { status: 'REDEEMED', expiresAtMs: sada + 600_000, redeemedAt: Timestamp.fromMillis(sada), redeemedAtStationId: 'SIM01' });
  await pripremiVaucer(V.tudji, b.uid, { expiresAtMs: sada + 600_000 });
  await pripremiVaucer(V.obrisanNalog, d.uid, { expiresAtMs: sada + 600_000 });
  await pripremiVaucer(V.uBrisanju, c.uid, { expiresAtMs: sada + 600_000 });
  await pripremiVaucer(V.zaUskladjivanje, b.uid, { expiresAtMs: sada - 60_000 });
  const app = (db = firebase.db) => napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' });
  const otkazi = (token, segment, { db, tijelo } = {}) => {
    const z = request(app(db)).post(`/api/v1/vouchers/${segment}/cancel`).set('Authorization', `Bearer ${token}`);
    return tijelo === undefined ? z : z.send(tijelo);
  };
  const uskladi = (token, { db, tijelo } = {}) => {
    const z = request(app(db)).post('/api/v1/account/vouchers/reconcile').set('Authorization', `Bearer ${token}`);
    return tijelo === undefined ? z : z.send(tijelo);
  };

  const zapisi = presretniLog();
  const ishodi = [];
  ishodi.push([200, RUTA_CANCEL, await otkazi(a.idToken, V.aktivan)]);
  ishodi.push([200, RUTA_CANCEL, await otkazi(a.idToken, V.aktivan)]);
  ishodi.push([401, RUTA_CANCEL, await otkazi(SENTINEL, V.aktivan2)]);
  ishodi.push([403, RUTA_CANCEL, await otkazi(a.idToken, V.tudji)]);
  ishodi.push([404, RUTA_CANCEL, await otkazi(a.idToken, V.nepostojeci)]);
  ishodi.push([404, RUTA_CANCEL, await otkazi(a.idToken, `__${SENTINEL}__`)]);
  ishodi.push([404, '(nepoznata ruta)', await otkazi(a.idToken, `${SENTINEL}%E0`)]);
  ishodi.push([409, RUTA_CANCEL, await otkazi(a.idToken, V.istekao)]);
  ishodi.push([409, RUTA_CANCEL, await otkazi(a.idToken, V.istekao)]);
  ishodi.push([409, RUTA_CANCEL, await otkazi(a.idToken, V.iskoriscen)]);
  ishodi.push([409, RUTA_CANCEL, await otkazi(d.idToken, V.obrisanNalog)]);
  ishodi.push([409, RUTA_CANCEL, await otkazi(c.idToken, V.uBrisanju)]);
  ishodi.push([422, RUTA_CANCEL, await otkazi(a.idToken, V.aktivan2, { tijelo: { uid: SENTINEL } })]);
  ishodi.push([500, RUTA_CANCEL, await otkazi(a.idToken, V.aktivan2, { db: omotacBaze(firebase.db, { baciNaUpisu: 2 }) })]);
  ishodi.push([503, RUTA_CANCEL, await otkazi(a.idToken, V.aktivan2, { db: omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } }) })]);
  ishodi.push([200, RUTA_RECONCILE, await uskladi(b.idToken)]);
  ishodi.push([401, RUTA_RECONCILE, await uskladi(SENTINEL)]);
  ishodi.push([409, RUTA_RECONCILE, await uskladi(c.idToken)]);
  ishodi.push([422, RUTA_RECONCILE, await uskladi(a.idToken, { tijelo: { voucherId: SENTINEL } })]);
  ishodi.push([500, RUTA_RECONCILE, await uskladi(a.idToken, { db: omotacBaze(firebase.db, { baciPrijeCommita: true }) })]);
  ishodi.push([503, RUTA_RECONCILE, await uskladi(a.idToken, { db: omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } }) })]);
  const log = tekstLoga(zapisi);
  mock.restoreAll();

  const tajne = [a.idToken, b.idToken, c.idToken, d.idToken, SENTINEL, 'Failed to decode', 'availablePoints', a.uid, b.uid, c.uid, d.uid, ...Object.values(V)];
  for (const tajna of tajne) {
    assert.ok(!log.includes(tajna), `log sadrži zabranjenu vrijednost (${tajna.slice(0, 12)}…)`);
  }
  assert.ok(log.includes('VOUCHER_EXPIRED'), 'log ne sadrži grešku (presretanje nije radilo)');

  const kodovi409 = [];
  for (const [i, [status, ruta, odgovor]] of ishodi.entries()) {
    assert.equal(odgovor.status, status, `ishod ${i}: ${odgovor.text}`);
    const tekst = tekstOdgovora(odgovor);
    for (const zabranjeno of [...ZABRANJENO_U_ODGOVORU, a.uid, b.uid, c.uid, d.uid, a.idToken, SENTINEL]) {
      assert.ok(!tekst.includes(zabranjeno), `ishod ${i} (${status}): odgovor sadrži zabranjenu vrijednost`);
    }
    if (status >= 400) {
      const zapis = zapisLoga(log, odgovor.body.error.correlationId);
      assert.equal(zapis.putanja, ruta, `ishod ${i}: putanja u logu`);
      assert.equal(zapis.code, odgovor.body.error.code, `ishod ${i}: kod u logu`);
      if (status < 500) {
        assert.ok(!Object.hasOwn(zapis, 'stack'), `ishod ${i}: 4xx sa stack-om u logu`);
      }
      if (status === 409 && ruta === RUTA_CANCEL) {
        kodovi409.push(odgovor.body.error.code);
      }
    }
  }
  assert.deepStrictEqual(kodovi409.sort(), [
    'ACCOUNT_DELETION_IN_PROGRESS',
    'ACCOUNT_NOT_INITIALIZED',
    'VOUCHER_ALREADY_REDEEMED',
    'VOUCHER_EXPIRED',
    'VOUCHER_EXPIRED',
  ]);
  assert.equal(ishodi[4][2].body.error.code, 'VOUCHER_NOT_FOUND');
  assert.equal(ishodi[5][2].body.error.code, 'VOUCHER_NOT_FOUND');
  assert.equal(ishodi[6][2].body.error.code, 'NOT_FOUND');
  assert.deepStrictEqual(ishodi[15][2].body, { reconciledCount: 1 });
});

// Stvarna emulatorska greška Firestore-a iz transakcije cancel-a: ALREADY_EXISTS (release_<V> postoji, sakriven omotačem).
// NOT_FOUND nad vouchers/<V> se iz cancel-a ne može izazvati: brisanje Admin SDK-om čeka bravu transakcije (emulator), pa se
// transakcija commit-uje; stvaran NOT_FOUND sa ID-em u poruci za vouchers/<id> pokriva I04-T20 (a) (odstupanje OD-2, i05).
test('I05-T20 (b) stvarna emulatorska 500 iz cancel-a (ALREADY_EXISTS na loyaltyLedger/release_<V>) → log bez voucherId-a, sa code 6', async (t) => {
  const { uid, idToken } = await napraviKorisnika('log5-500@primjer.test');
  const app = (db) => napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' });
  const scenariji = [
    [
      'ALREADY_EXISTS',
      /ALREADY_EXISTS|code 6/,
      async (V) => {
        await firebase.db.doc(`loyaltyLedger/release_${V}`).set({ uid, type: 'REWARD_RELEASE', voucherId: V });
        return omotacBaze(firebase.db, { sakrijPostojece: [`loyaltyLedger/release_${V}`] });
      },
    ],
  ];
  for (const [opis, ocekivano, pripremi] of scenariji) {
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
    const omotac = await pripremi(V);
    const zapisi = presretniLog();
    const odgovor = await request(app(omotac)).post(`/api/v1/vouchers/${V}/cancel`).set('Authorization', `Bearer ${idToken}`);
    await omotac.sveTransakcijeZavrsene;
    const log = tekstLoga(zapisi);
    mock.restoreAll();
    t.diagnostic(`${opis}: HTTP ${odgovor.status}, pokušaja ${omotac.brojPokusaja}`);
    assert.equal(odgovor.status, 500, `${opis}: ${odgovor.text}`);
    const zapis = zapisLoga(log, odgovor.body.error.correlationId);
    assert.equal(zapis.putanja, RUTA_CANCEL, opis);
    assert.match(zapis.stack, ocekivano, `${opis}: log bez gRPC koda`);
    assert.match(zapis.stack, /\n\s+at /, `${opis}: log bez okvira stack-a`);
    assert.ok(!log.includes(V), `${opis}: log sadrži voucherId`);
    assert.ok(!log.includes(uid), `${opis}: log sadrži uid`);
    // Šablon rute (/vouchers/:voucherId/cancel) je dozvoljen (D-3); putanja dokumenta nije.
    const putanjaDokumenta = /path=\/|documents\/|\/(loyaltyLedger|vouchers|loyaltyAccounts)\/(?!:voucherId\/cancel")/.exec(log);
    assert.equal(putanjaDokumenta, null, `${opis}: log sadrži putanju dokumenta (${log.slice(Math.max(0, (putanjaDokumenta?.index ?? 0) - 80), (putanjaDokumenta?.index ?? 0) + 40)})`);
    for (const zabranjeno of ZABRANJENO_U_ODGOVORU) {
      assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
    }
  }
});

test('I05-T20 (c) produkcioni start (src/pokreni.js): stdout i stderr bez sentinel-a, token-a i voucherId-a za ishode API-05 i API-06', async () => {
  const port = await slobodanPort();
  const backend = pokreniBackend(
    envProcesa({
      PORT: String(port),
      FIREBASE_PROJECT_ID: projectId,
      VERZIJA_USLOVA: '1.0',
      POS_API_KLJUCEVI: posKonfiguracija([['SIM01', generisiPosKljuc()]]),
      FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
      FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    }),
  );
  const { uid, idToken } = await napraviKorisnika('log5-spawn@primjer.test');
  await pripremiNalog(uid, 0, 50);
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
  const osnova = `http://127.0.0.1:${port}/api/v1`;
  const statusi = [];
  const correlationId = [];
  try {
    await backend.cekajSlusanje(port);
    const pozivi = [
      [`${osnova}/vouchers/${V}/cancel`, SENTINEL, undefined],
      [`${osnova}/vouchers/__${SENTINEL}__/cancel`, idToken, undefined],
      [`${osnova}/vouchers/${SENTINEL}%E0/cancel`, idToken, undefined],
      [`${osnova}/vouchers/${V}/cancel`, idToken, { uid: SENTINEL }],
      [`${osnova}/account/vouchers/reconcile`, SENTINEL, undefined],
    ];
    for (const [url, token, tijelo] of pozivi) {
      const odgovor = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: tijelo === undefined ? undefined : JSON.stringify(tijelo),
        signal: AbortSignal.timeout(15_000),
      });
      const tekst = await odgovor.text();
      statusi.push(odgovor.status);
      assert.ok(!tekst.includes(SENTINEL), 'odgovor sadrži sentinel');
      correlationId.push(JSON.parse(tekst).error.correlationId);
    }
  } finally {
    await backend.zaustavi();
  }
  assert.deepStrictEqual(statusi, [401, 404, 404, 422, 401]);
  const log = backend.stdout + backend.stderr;
  assert.ok(log.includes('UNAUTHENTICATED'), 'log procesa ne sadrži grešku (presretanje nije radilo)');
  for (const zabranjeno of [SENTINEL, idToken, V, uid, 'Failed to decode', '%E0']) {
    assert.ok(!log.includes(zabranjeno), 'log procesa sadrži zabranjenu vrijednost');
  }
  assert.equal(zapisLoga(log, correlationId[0]).putanja, RUTA_CANCEL);
  assert.equal(zapisLoga(log, correlationId[1]).putanja, RUTA_CANCEL);
  assert.equal(zapisLoga(log, correlationId[2]).putanja, '(nepoznata ruta)');
  assert.equal(zapisLoga(log, correlationId[3]).putanja, RUTA_CANCEL);
  assert.equal(zapisLoga(log, correlationId[4]).putanja, RUTA_RECONCILE);
});
