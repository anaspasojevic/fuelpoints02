// I03-T17 (§3.4, NFR-07): vrijednost X-POS-API-Key se ne pojavljuje ni u logu (svi kanali) ni u odgovoru, ni kad je
// poslata u query-ju, tijelu ili URL putanji, za svaki ishod kupovine: 201, 200, 401, 404, 409, 422, 500 i 503. Nijedan odgovor nema balance.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';
import { envProcesa, pokreniBackend, slobodanPort } from '../pomocnici/procesBackenda.js';

const projectId = provjeriTestnoOkruzenje();
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const SENTINEL = 'SENTINEL_POS_9d2f1a7c';
const ZABRANJENO_U_ODGOVORU = ['availablePoints', 'reservedPoints', 'availableAfter', 'reservedAfter', 'stack', '    at '];

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

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

function tijeloKupovine(dodatno = {}) {
  return {
    loyaltyUid: 'korisnikA',
    posTransactionId: 'LOG1',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    ...dodatno,
  };
}

function tekstOdgovora(odgovor) {
  return `${odgovor.text}\n${JSON.stringify(odgovor.headers)}`;
}

// JSON zapis loga greške sa datim correlationId-em (i03 FIX LOOP 1, R-04: provjera polja putanja).
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

test('I03-T17 (a) log (svi kanali) i odgovori ne sadrže POS ključ ni za jedan ishod; nijedan odgovor nema balance', async () => {
  const k1 = generisiPosKljuc();
  const k2 = generisiPosKljuc();
  const posStanice = procitajPosKljuceve(
    posKonfiguracija([
      ['SIM01', k1],
      ['SIM02', k2],
    ]),
  ).stanice;
  await pripremiNalog('korisnikA');
  await pripremiNalog('korisnikB');
  const putanja = '/api/v1/pos/purchases';
  function app(db = firebase.db) {
    return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice });
  }

  const zapisi = presretniLog();
  const ishodi = [
    [201, await request(app()).post(putanja).set('X-POS-API-Key', k1).send(tijeloKupovine())],
    [200, await request(app()).post(putanja).set('X-POS-API-Key', k1).send(tijeloKupovine())],
    [401, await request(app()).post(putanja).set('X-POS-API-Key', SENTINEL).send(tijeloKupovine())],
    [401, await request(app()).post(`${putanja}?X-POS-API-Key=${k1}`).send(tijeloKupovine())],
    [401, await request(app()).post(putanja).send(tijeloKupovine({ 'X-POS-API-Key': k1 }))],
    [401, await request(app()).post(putanja).set('Authorization', `Bearer ${k1}`).send(tijeloKupovine())],
    [404, await request(app()).post(putanja).set('X-POS-API-Key', k1).send(tijeloKupovine({ loyaltyUid: 'nepostojeci', posTransactionId: 'LOG2' }))],
    [409, await request(app()).post(putanja).set('X-POS-API-Key', k1).send(tijeloKupovine({ volumeMl: 1000 }))],
    [422, await request(app()).post(putanja).set('X-POS-API-Key', k1).send(tijeloKupovine({ nepoznato: k2 }))],
    [422, await request(app()).post(putanja).set('X-POS-API-Key', k1).send(tijeloKupovine({ volumeMl: 0 }))],
    [
      422,
      await request(app())
        .post(putanja)
        .set('X-POS-API-Key', k2)
        .set('Content-Type', 'application/json')
        .send(`{"loyaltyUid":"${k1}`),
    ],
    [
      500,
      await request(app(omotacBaze(firebase.db, { baciNaUpisu: 2 })))
        .post(putanja)
        .set('X-POS-API-Key', k2)
        .send(tijeloKupovine({ loyaltyUid: 'korisnikB', posTransactionId: 'LOG3' })),
    ],
    [
      503,
      await request(app(omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } })))
        .post(putanja)
        .set('X-POS-API-Key', k2)
        .send(tijeloKupovine({ loyaltyUid: 'korisnikB', posTransactionId: 'LOG4' })),
    ],
    // R-04: ključ u URL putanji nepostojeće rute (sa ispravnim zaglavljem i bez zaglavlja).
    [404, await request(app()).post(`${putanja}/${k1}`).set('X-POS-API-Key', k1).send(tijeloKupovine())],
    [404, await request(app()).post(`/api/v1/pos/${k2}`).send(tijeloKupovine())],
  ];
  const log = tekstLoga(zapisi);
  mock.restoreAll();

  for (const [i, [status, odgovor]] of ishodi.entries()) {
    assert.equal(odgovor.status, status, `ishod ${i}: ${odgovor.text}`);
    const tekst = tekstOdgovora(odgovor);
    for (const tajna of [k1, k2, SENTINEL]) {
      assert.ok(!tekst.includes(tajna), `ishod ${i} (${status}): odgovor sadrži POS ključ`);
    }
    for (const zabranjeno of ZABRANJENO_U_ODGOVORU) {
      assert.ok(!tekst.includes(zabranjeno), `ishod ${i} (${status}): odgovor sadrži "${zabranjeno}"`);
    }
    if (status >= 400) {
      assert.ok(log.includes(odgovor.body.error.correlationId), `ishod ${i} (${status}): log ne sadrži correlationId`);
    }
  }
  for (const tajna of [k1, k2, SENTINEL]) {
    assert.ok(!log.includes(tajna), 'log sadrži POS ključ');
  }
  assert.ok(log.includes('UNAUTHENTICATED_POS'), 'log ne sadrži grešku (presretanje nije radilo)');
  // R-04: log bilježi šablon pogođene rute, a za zahtjev bez pogođene rute fiksnu vrijednost.
  assert.equal(zapisLoga(log, ishodi[2][1].body.error.correlationId).putanja, '/pos/purchases', '401: putanja u logu');
  for (const i of [13, 14]) {
    const zapis = zapisLoga(log, ishodi[i][1].body.error.correlationId);
    assert.equal(zapis.code, 'NOT_FOUND', `ishod ${i}: kod u logu`);
    assert.equal(zapis.putanja, '(nepoznata ruta)', `ishod ${i}: putanja u logu`);
  }
});

test('I03-T17 (b) produkcioni start (src/pokreni.js): stdout i stderr procesa ne sadrže POS ključeve', async () => {
  const k1 = generisiPosKljuc();
  const k2 = generisiPosKljuc();
  await pripremiNalog('korisnikA');
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
  const adresa = `http://127.0.0.1:${port}/api/v1/pos/purchases`;
  const statusi = [];
  const correlationId401 = [];
  try {
    await backend.cekajSlusanje(port);
    const pozivi = [
      [adresa, { 'X-POS-API-Key': k1 }, tijeloKupovine()],
      [`${adresa}?X-POS-API-Key=${k1}`, {}, tijeloKupovine()],
      [adresa, { 'X-POS-API-Key': k2 }, tijeloKupovine({ 'X-POS-API-Key': k1 })],
      // R-04: ključ u URL putanji nepostojeće rute.
      [`${adresa}/${k1}`, { 'X-POS-API-Key': k1 }, tijeloKupovine()],
      [`http://127.0.0.1:${port}/api/v1/pos/${k2}`, {}, tijeloKupovine()],
    ];
    for (const [url, zaglavlja, tijelo] of pozivi) {
      const odgovor = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...zaglavlja },
        body: JSON.stringify(tijelo),
        signal: AbortSignal.timeout(15_000),
      });
      const tekst = await odgovor.text();
      statusi.push(odgovor.status);
      for (const tajna of [k1, k2]) {
        assert.ok(!tekst.includes(tajna), 'odgovor sadrži POS ključ');
      }
      if (odgovor.status === 401) {
        correlationId401.push(JSON.parse(tekst).error.correlationId);
      }
      if (odgovor.status === 404) {
        assert.equal(JSON.parse(tekst).error.code, 'NOT_FOUND', '404: kod greške');
      }
    }
  } finally {
    await backend.zaustavi();
  }
  assert.deepStrictEqual(statusi, [201, 401, 422, 404, 404]);
  const log = backend.stdout + backend.stderr;
  assert.ok(log.includes('UNAUTHENTICATED_POS'), 'log procesa ne sadrži grešku (presretanje nije radilo)');
  for (const tajna of [k1, k2]) {
    assert.ok(!log.includes(tajna), 'log procesa sadrži POS ključ');
  }
  assert.equal(zapisLoga(log, correlationId401[0]).putanja, '/pos/purchases', '401: putanja u logu procesa');
});
