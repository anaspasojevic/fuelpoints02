// I04-T16 (NFR-07, D-3, D-5, §3.3): za svaki ishod API-03 (201, 200, 401, 404, 409, 422, 500, 503) log (svi kanali) ne sadrži token,
// sentinel, requestId iz tijela, requestKey, voucherId ni sirovu putanju; nijedan odgovor nema stack, balance, uid ni requestKey.
// FIX LOOP 1 (R-04, O-18): I04-T16 (c) — log 500 iz commit-a bez putanje dokumenta.
import assert from 'node:assert/strict';
import crypto, { createHash, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';
import { envProcesa, pokreniBackend, slobodanPort } from '../pomocnici/procesBackenda.js';

const projectId = provjeriTestnoOkruzenje();
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const SENTINEL = 'SENTINEL_I04_5be27d90';
const ZABRANJENO_U_ODGOVORU = ['stack', '    at ', 'availablePoints', 'reservedPoints', 'availableAfter', 'reservedAfter'];
const RUTA = '/rewards/:rewardId/issue';

let firebase;

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

function kljucZahtjeva(uid, requestId) {
  return createHash('sha256').update(Buffer.from(`${uid}:${requestId}`, 'utf8')).digest('hex');
}

async function pripremiNalog(uid, availablePoints, reservedPoints, accountStatus = 'ACTIVE') {
  await firebase.db.doc(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await firebase.db.doc(`loyaltyAccounts/${uid}`).set({
    availablePoints,
    reservedPoints,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
  });
}

function tekstOdgovora(odgovor) {
  return `${odgovor.text}\n${JSON.stringify(odgovor.headers)}`;
}

// JSON zapisi loga grešaka sa datim correlationId-em.
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

test('I04-T16 (a) log (svi kanali) i odgovori za sve ishode API-03 bez token-a, sentinel-a, requestId-a, requestKey-a, voucherId-a i sirove putanje', async () => {
  const a = await napraviKorisnika('log-a@primjer.test');
  const b = await napraviKorisnika('log-b@primjer.test');
  const c = await napraviKorisnika('log-c@primjer.test');
  const d = await napraviKorisnika('log-d@primjer.test');
  await pripremiNalog(a.uid, 100, 0);
  await pripremiNalog(b.uid, 10, 0);
  await pripremiNalog(c.uid, 100, 0, 'DELETION_IN_PROGRESS');
  const app = (db = firebase.db) => napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' });
  const izdaj = (token, rewardId, tijelo, db) =>
    request(app(db)).post(`/api/v1/rewards/${rewardId}/issue`).set('Authorization', `Bearer ${token}`).send(tijelo);

  const R1 = randomUUID();
  const R2 = randomUUID();
  const R3 = randomUUID();
  const sviRequestId = [R1, R2, R3];
  const zapisi = presretniLog();
  const ishodi = [];
  ishodi.push([201, 'pogođena', await izdaj(a.idToken, 'CAR_WASH', { requestId: R1 })]);
  ishodi.push([200, 'pogođena', await izdaj(a.idToken, 'CAR_WASH', { requestId: R1 })]);
  ishodi.push([401, 'pogođena', await izdaj(SENTINEL, 'CAR_WASH', { requestId: R2 })]);
  ishodi.push([404, 'pogođena', await izdaj(a.idToken, 'FOO', { requestId: R2 })]);
  ishodi.push([404, 'pogođena', await izdaj(a.idToken, `__${SENTINEL}__`, { requestId: R2 })]);
  ishodi.push([404, 'nepoznata', await izdaj(a.idToken, `${SENTINEL}%E0`, { requestId: R2 })]);
  ishodi.push([409, 'pogođena', await izdaj(a.idToken, 'SHOWER', { requestId: R1 })]);
  ishodi.push([409, 'pogođena', await izdaj(b.idToken, 'CAR_WASH', { requestId: R2 })]);
  ishodi.push([409, 'pogođena', await izdaj(c.idToken, 'CAR_WASH', { requestId: R2 })]);
  ishodi.push([409, 'pogođena', await izdaj(d.idToken, 'CAR_WASH', { requestId: R2 })]);
  ishodi.push([422, 'pogođena', await izdaj(a.idToken, 'CAR_WASH', { requestId: SENTINEL })]);
  ishodi.push([422, 'pogođena', await izdaj(a.idToken, 'CAR_WASH', { requestId: R2, nepoznato: SENTINEL })]);
  ishodi.push([500, 'pogođena', await izdaj(a.idToken, 'SHOWER', { requestId: R2 }, omotacBaze(firebase.db, { baciNaUpisu: 2 }))]);
  ishodi.push([503, 'pogođena', await izdaj(a.idToken, 'SHOWER', { requestId: R3 }, omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } }))]);
  const log = tekstLoga(zapisi);
  mock.restoreAll();

  const voucherId = ishodi[0][2].body.voucherId;
  const tajneLoga = [a.idToken, b.idToken, c.idToken, d.idToken, SENTINEL, voucherId, 'Failed to decode', ...sviRequestId];
  for (const korisnik of [a, b, c, d]) {
    for (const requestId of sviRequestId) {
      tajneLoga.push(kljucZahtjeva(korisnik.uid, requestId));
    }
  }
  for (const tajna of tajneLoga) {
    assert.ok(!log.includes(tajna), `log sadrži zabranjenu vrijednost (${tajna.slice(0, 12)}…)`);
  }
  assert.ok(log.includes('INSUFFICIENT_POINTS'), 'log ne sadrži grešku (presretanje nije radilo)');

  const kodovi409 = [];
  for (const [i, [status, ruta, odgovor]] of ishodi.entries()) {
    assert.equal(odgovor.status, status, `ishod ${i}: ${odgovor.text}`);
    const tekst = tekstOdgovora(odgovor);
    for (const zabranjeno of [...ZABRANJENO_U_ODGOVORU, a.uid, b.uid, c.uid, d.uid, a.idToken, SENTINEL]) {
      assert.ok(!tekst.includes(zabranjeno), `ishod ${i} (${status}): odgovor sadrži zabranjenu vrijednost`);
    }
    for (const korisnik of [a, b, c, d]) {
      for (const requestId of sviRequestId) {
        assert.ok(!tekst.includes(kljucZahtjeva(korisnik.uid, requestId)), `ishod ${i}: odgovor sadrži requestKey`);
      }
    }
    if (status >= 400) {
      const zapis = zapisLoga(log, odgovor.body.error.correlationId);
      assert.equal(zapis.putanja, ruta === 'pogođena' ? RUTA : '(nepoznata ruta)', `ishod ${i}: putanja u logu`);
      assert.equal(zapis.code, odgovor.body.error.code, `ishod ${i}: kod u logu`);
      if (status < 500) {
        assert.ok(!Object.hasOwn(zapis, 'stack'), `ishod ${i}: 4xx sa stack-om u logu`);
      }
      if (status === 409) {
        kodovi409.push(odgovor.body.error.code);
      }
    }
  }
  assert.deepStrictEqual(kodovi409.sort(), [
    'ACCOUNT_DELETION_IN_PROGRESS',
    'ACCOUNT_NOT_INITIALIZED',
    'IDEMPOTENCY_CONFLICT',
    'INSUFFICIENT_POINTS',
  ]);
  assert.equal(ishodi[3][2].body.error.code, 'REWARD_NOT_FOUND');
  assert.equal(ishodi[5][2].body.error.code, 'NOT_FOUND');
});

// R-04 (review i04), O-18: 500 iz commit-a (ALREADY_EXISTS zbog zastarjelog čitanja, omotacBaze sakrijPostojece) loguje name, code i
// okvire stack-a, ali ne putanju dokumenta: ni requestKey, ni voucherId, ni sirovo ni u putanji.
test('I04-T16 (c) 500 ALREADY_EXISTS na rewardRequests/<requestKey> i loyaltyLedger/release_<voucherId> → log bez putanje, requestKey-a i voucherId-a, sa ALREADY_EXISTS', async () => {
  const { uid, idToken } = await napraviKorisnika('log-500@primjer.test');
  const FIKSNO = Buffer.alloc(32, 0xab);
  const noviVoucherId = FIKSNO.toString('hex');
  const V = '5'.repeat(64);
  const R1 = randomUUID();
  const R2 = randomUUID();
  const kljuc1 = kljucZahtjeva(uid, R1);
  const kljuc2 = kljucZahtjeva(uid, R2);
  const izvorna = crypto.randomBytes;
  mock.method(crypto, 'randomBytes', (n, ...ostalo) => (n === 32 ? FIKSNO : izvorna(n, ...ostalo)));
  const izdaj = (rewardId, tijelo, db) =>
    request(napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' }))
      .post(`/api/v1/rewards/${rewardId}/issue`)
      .set('Authorization', `Bearer ${idToken}`)
      .send(tijelo);

  const scenariji = [
    [
      'mapping',
      async () => {
        await pripremiNalog(uid, 100, 0);
        await firebase.db.doc(`rewardRequests/${kljuc1}`).set({ uid, requestId: R1, rewardId: 'CAR_WASH', voucherId: V, createdAt: VRIJEME_PRIPREME });
        return `rewardRequests/${kljuc1}`;
      },
      'CAR_WASH',
      R1,
    ],
    [
      'release',
      async () => {
        await pripremiNalog(uid, 0, 50);
        const expiresAtMs = Date.now() - 60_000;
        await firebase.db.doc(`vouchers/${V}`).set({
          uid,
          rewardId: 'CAR_WASH',
          costPoints: 50,
          status: 'ACTIVE',
          issuedAt: Timestamp.fromMillis(expiresAtMs - 900_000),
          expiresAt: Timestamp.fromMillis(expiresAtMs),
          redeemedAt: null,
          cancelledAt: null,
          redeemedAtStationId: null,
        });
        await firebase.db.doc(`loyaltyLedger/release_${V}`).set({ uid, type: 'REWARD_RELEASE', voucherId: V });
        return `loyaltyLedger/release_${V}`;
      },
      'SHOWER',
      R2,
    ],
  ];
  for (const [opis, pripremi, rewardId, requestId] of scenariji) {
    const putanja = await pripremi();
    const zapisi = presretniLog();
    const odgovor = await izdaj(rewardId, { requestId }, omotacBaze(firebase.db, { sakrijPostojece: [putanja] }));
    const log = tekstLoga(zapisi);
    mock.restoreAll();
    mock.method(crypto, 'randomBytes', (n, ...ostalo) => (n === 32 ? FIKSNO : izvorna(n, ...ostalo)));

    assert.equal(odgovor.status, 500, `${opis}: ${odgovor.text}`);
    assert.equal(odgovor.body.error.code, 'INTERNAL_ERROR', opis);
    const zapis = zapisLoga(log, odgovor.body.error.correlationId);
    assert.equal(zapis.code, 'INTERNAL_ERROR', opis);
    assert.equal(zapis.putanja, RUTA, opis);
    assert.equal(typeof zapis.stack, 'string', `${opis}: log bez opisa greške`);
    // Dijagnostika ostaje moguća: vrsta greške Firestore-a (ALREADY_EXISTS, gRPC code 6) i okviri stack-a.
    assert.match(zapis.stack, /ALREADY_EXISTS|code 6/, `${opis}: log bez ALREADY_EXISTS / code 6`);
    assert.match(zapis.stack, /\n\s+at /, `${opis}: log bez okvira stack-a`);
    for (const [naziv, tajna] of [
      ['requestKey (mapping)', kljuc1],
      ['requestKey (release)', kljuc2],
      ['voucherId (postojeći)', V],
      ['voucherId (novi)', noviVoucherId],
      ['requestId', requestId],
      ['putanja dokumenta', putanja],
    ]) {
      assert.ok(!log.includes(tajna), `${opis}: log sadrži ${naziv}`);
    }
    assert.doesNotMatch(log, /path=\/|documents\/|\/(rewardRequests|loyaltyLedger|vouchers|loyaltyAccounts)\//, `${opis}: log sadrži putanju dokumenta`);
    for (const zabranjeno of ZABRANJENO_U_ODGOVORU) {
      assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
    }
  }
});

test('I04-T16 (b) produkcioni start (src/pokreni.js): stdout i stderr bez sentinel-a, token-a i sirove putanje', async () => {
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
  const { uid, idToken } = await napraviKorisnika('log-spawn@primjer.test');
  await pripremiNalog(uid, 50, 0);
  const osnova = `http://127.0.0.1:${port}/api/v1/rewards`;
  const statusi = [];
  const correlationId = [];
  try {
    await backend.cekajSlusanje(port);
    const pozivi = [
      [`${osnova}/CAR_WASH/issue`, SENTINEL, { requestId: randomUUID() }],
      [`${osnova}/${SENTINEL}%E0/issue`, idToken, { requestId: randomUUID() }],
      [`${osnova}/CAR_WASH/issue`, idToken, { requestId: SENTINEL }],
    ];
    for (const [url, token, tijelo] of pozivi) {
      const odgovor = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(tijelo),
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
  assert.deepStrictEqual(statusi, [401, 404, 422]);
  const log = backend.stdout + backend.stderr;
  assert.ok(log.includes('UNAUTHENTICATED'), 'log procesa ne sadrži grešku (presretanje nije radilo)');
  for (const zabranjeno of [SENTINEL, idToken, 'Failed to decode', '%E0']) {
    assert.ok(!log.includes(zabranjeno), 'log procesa sadrži zabranjenu vrijednost');
  }
  assert.equal(zapisLoga(log, correlationId[0]).putanja, RUTA);
  assert.equal(zapisLoga(log, correlationId[1]).putanja, '(nepoznata ruta)');
  assert.equal(zapisLoga(log, correlationId[2]).putanja, RUTA);
});
