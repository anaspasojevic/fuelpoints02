// I03-T16 (F1-01, i02 R-02): kad je rok zahtjeva istekao prije transakcije, runTransaction se NE poziva, odgovor je 503
// SERVICE_UNAVAILABLE i ne nastaje nijedan dokument — za init (API-01) i za kupovinu (API-02).
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { evidentirajKupovinu } from '../../src/servisi/evidencijaKupovine.js';
import { inicijalizujNalog } from '../../src/servisi/inicijalizacijaNaloga.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

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

function ulazKupovine() {
  return {
    stationId: 'SIM01',
    loyaltyUid: 'korisnikA',
    posTransactionId: 'ROK1',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAtMs: Date.now() - 60_000,
  };
}

const SERVISI = [
  ['(a) inicijalizujNalog', (db, rokDo) => inicijalizujNalog(db, { uid: 'korisnikN', displayName: 'Ana', acceptedTermsVersion: '1.0' }, rokDo)],
  ['(b) evidentirajKupovinu', (db, rokDo) => evidentirajKupovinu(db, ulazKupovine(), rokDo)],
];

const ISTEKLI_ROKOVI = [
  ['Date.now() − 1', () => Date.now() - 1],
  ['Date.now() − 10 000', () => Date.now() - 10_000],
  ['Date.now()', () => Date.now()],
  ['undefined', () => undefined],
  ['NaN', () => Number.NaN],
];

test('I03-T16 (a), (b) istekao rok → GreskaApi SERVICE_UNAVAILABLE, runTransaction se ne poziva, nijedan dokument', async () => {
  await pripremiNalog('korisnikA');
  const stanje = await snimakBaze();
  for (const [servis, pozovi] of SERVISI) {
    for (const [opisRoka, rok] of ISTEKLI_ROKOVI) {
      const opis = `${servis}, rokDo = ${opisRoka}`;
      const omotac = omotacBaze(firebase.db);
      await assert.rejects(
        pozovi(omotac, rok()),
        (greska) => {
          assert.ok(greska instanceof GreskaApi, `${opis}: nije GreskaApi`);
          assert.equal(greska.kod, 'SERVICE_UNAVAILABLE', opis);
          assert.equal(KATALOG_GRESAKA[greska.kod].http, 503, opis);
          return true;
        },
        opis,
      );
      assert.equal(omotac.brojTransakcija, 0, `${opis}: runTransaction je pozvan`);
      assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
      assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: baza promijenjena`);
    }
  }
});

test('I03-T16 (c) HTTP oblik: istekao rok → 503 tačno tijelo, bez transakcije; kontrola sa rokom u budućnosti → uspjeh', async () => {
  await pripremiNalog('korisnikA');
  const stanje = await snimakBaze();
  let omotac;
  let pomakRokaMs;
  function dodajRute(ruter) {
    ruter.post('/test-rok/init', async (req, res) => {
      res.json(await SERVISI[0][1](omotac, Date.now() + pomakRokaMs));
    });
    ruter.post('/test-rok/kupovina', async (req, res) => {
      res.json(await SERVISI[1][1](omotac, Date.now() + pomakRokaMs));
    });
  }
  const app = napraviAplikaciju({ servisi: firebase, verzijaUslova: '1.0', dodajRute });

  for (const putanja of ['/api/v1/test-rok/init', '/api/v1/test-rok/kupovina']) {
    omotac = omotacBaze(firebase.db);
    pomakRokaMs = -1;
    const odgovor = await request(app).post(putanja);
    assert.equal(odgovor.status, 503, `${putanja}: ${odgovor.text}`);
    assert.deepStrictEqual(Object.keys(odgovor.body), ['error']);
    assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId']);
    assert.equal(odgovor.body.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(odgovor.body.error.message, KATALOG_GRESAKA.SERVICE_UNAVAILABLE.poruka);
    assert.match(odgovor.body.error.correlationId, UUID_V4);
    assert.equal(omotac.brojTransakcija, 0, `${putanja}: runTransaction je pozvan`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `${putanja}: baza promijenjena`);
  }

  for (const putanja of ['/api/v1/test-rok/init', '/api/v1/test-rok/kupovina']) {
    omotac = omotacBaze(firebase.db);
    pomakRokaMs = 10_000;
    const odgovor = await request(app).post(putanja);
    assert.equal(odgovor.status, 200, `kontrola ${putanja}: ${odgovor.text}`);
    assert.equal(odgovor.body.kreirano, true, `kontrola ${putanja}`);
    assert.equal(omotac.brojTransakcija, 1, `kontrola ${putanja}`);
  }
  assert.ok((await firebase.db.doc('users/korisnikN').get()).exists);
  assert.ok((await firebase.db.doc('purchases/SIM01__ROK1').get()).exists);
});
