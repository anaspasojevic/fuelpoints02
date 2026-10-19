// O-10a (§10, §10.3, §23.3, O-3, O-12, ODLUKE §6 (d)): retry kupovine poslije pseudonimizacije (purchases.uid = null): I07-T10.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { FieldValue } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { napraviPripremu, provjeriTijeloGreske } from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();
const K1 = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(posKonfiguracija([['SIM01', K1]])).stanice;
const PURCHASE_ID = 'SIM01__POS-1';

let firebase;
let p;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  p = napraviPripremu(firebase.db);
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

function kupi(tijelo, db = firebase.db) {
  return request(napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice: POS_STANICE }))
    .post('/api/v1/pos/purchases')
    .set('X-POS-API-Key', K1)
    .send(tijelo);
}

function tijeloKupovine(loyaltyUid, dodatno = {}) {
  return {
    loyaltyUid,
    posTransactionId: 'POS-1',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    ...dodatno,
  };
}

// Kupovina A kroz API, pa pseudonimizacija kao §23.3 (samo polje uid → null). A i B su ACTIVE nalozi.
async function pripremi() {
  await p.pripremiNalog('korisnikA', 0, 0);
  await p.pripremiNalog('korisnikB', 0, 0);
  const prvi = await kupi(tijeloKupovine('korisnikA'));
  assert.equal(prvi.status, 201, prvi.text);
  await p.referenca(`purchases/${PURCHASE_ID}`).update({ uid: null });
  await p.referenca(`loyaltyLedger/earn_${PURCHASE_ID}`).update({ uid: null });
  return prvi.body;
}

async function ocekujPrviRezultat(tijelo, prviOdgovor, opis) {
  const prije = await p.snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await kupi(tijelo, omotac);
  assert.equal(odgovor.status, 200, `${opis}: ${odgovor.text}`);
  assert.deepStrictEqual(odgovor.body, prviOdgovor, opis);
  assert.ok(!Object.hasOwn(odgovor.body, 'uid'), `${opis}: odgovor sadrži uid`);
  assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
  assert.deepStrictEqual(await p.snimakBaze(), prije, `${opis}: baza promijenjena`);
}

test('I07-T10 (O-10a) purchase sa uid null: isti payload → 200 prvi rezultat bez upisa; drugi occurredAt ili loyaltyUid → 200 (i07/P-5); drugi volumeMl, amountMinor, currency → 409', async () => {
  const prviOdgovor = await pripremi();

  await ocekujPrviRezultat(tijeloKupovine('korisnikA'), prviOdgovor, 'isti payload');
  await ocekujPrviRezultat(tijeloKupovine('korisnikA', { occurredAt: new Date(Date.now() - 120_000).toISOString() }), prviOdgovor, 'drugi occurredAt');
  await ocekujPrviRezultat(tijeloKupovine('korisnikB'), prviOdgovor, 'drugi loyaltyUid (i07/P-5)');
  assert.equal(await p.brojDogadjaja('korisnikB', 'EARN'), 0, 'EARN za B');
  assert.deepStrictEqual(await p.nalog('korisnikB'), [0, 0], 'nalog B');

  for (const [opis, dodatno] of [
    ['drugi volumeMl', { volumeMl: 30_000 }],
    ['drugi amountMinor', { amountMinor: 7051 }],
    ['drugi currency', { currency: 'BAM' }],
  ]) {
    const prije = await p.snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await kupi(tijeloKupovine('korisnikA', dodatno), omotac);
    if (dodatno.currency === undefined) {
      provjeriTijeloGreske(odgovor, 409, 'IDEMPOTENCY_CONFLICT', opis);
    } else {
      // Valuta van §8.2 se odbija validacijom prije baze (I03-T06); poređenje sa sačuvanom valutom nije dostižno kroz API.
      provjeriTijeloGreske(odgovor, 422, 'UNSUPPORTED_CURRENCY', opis);
    }
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await p.snimakBaze(), prije, `${opis}: baza promijenjena`);
  }
});

test('I07-T10 (O-10a) sačuvana valuta različita od zahtjeva uz uid null → 409; uid "" i nedostaje se i dalje porede → 409', async () => {
  await pripremi();
  await p.referenca(`purchases/${PURCHASE_ID}`).update({ currency: 'XXX' });
  let odgovor = await kupi(tijeloKupovine('korisnikA'));
  provjeriTijeloGreske(odgovor, 409, 'IDEMPOTENCY_CONFLICT', 'sačuvana valuta');

  await p.referenca(`purchases/${PURCHASE_ID}`).update({ currency: 'EUR', uid: '' });
  odgovor = await kupi(tijeloKupovine('korisnikA'));
  provjeriTijeloGreske(odgovor, 409, 'IDEMPOTENCY_CONFLICT', 'uid ""');

  await p.referenca(`purchases/${PURCHASE_ID}`).update({ uid: FieldValue.delete() });
  odgovor = await kupi(tijeloKupovine('korisnikA'));
  provjeriTijeloGreske(odgovor, 409, 'IDEMPOTENCY_CONFLICT', 'uid nedostaje');
});

test('I07-T10 regresija API-T04: purchase sa uid string i drugi loyaltyUid → 409; isti → 200', async () => {
  await p.pripremiNalog('korisnikA', 0, 0);
  await p.pripremiNalog('korisnikB', 0, 0);
  const prvi = await kupi(tijeloKupovine('korisnikA'));
  assert.equal(prvi.status, 201, prvi.text);
  provjeriTijeloGreske(await kupi(tijeloKupovine('korisnikB')), 409, 'IDEMPOTENCY_CONFLICT', 'drugi loyaltyUid');
  const ponovo = await kupi(tijeloKupovine('korisnikA'));
  assert.equal(ponovo.status, 200, ponovo.text);
  assert.deepStrictEqual(ponovo.body, prvi.body);
});
