// O-27 (ODLUKE §6 (t), O-23): jedna provjera konzistentnosti stanja voucher-a kod svih korisnika osim redeem-a
// (redeem: otkupVaucera.test.js, I06-T14 (a)): I06-T03 (cancel), I06-T04 (procitajIstekleAktivne: API-06 i API-03), I06-T05 (O-16 retry API-03).
// Nekonzistentno stanje je nedostižno kroz API; priprema Admin SDK-om. Ishod: 500 bez stack-a, ništa upisano.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { hex64, napraviPripremu, provjeriBezInternihDetalja, provjeriTijeloGreske } from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();
const TS = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 5, 0));

let firebase;
let p;
let brojac = 0;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  p = napraviPripremu(firebase.db);
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
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0' });
}

function posalji(putanja, token, db, tijelo) {
  const zahtjev = request(aplikacija(db)).post(putanja).set('Authorization', `Bearer ${token}`);
  return tijelo === undefined ? zahtjev : zahtjev.send(tijelo);
}

async function korisnik() {
  brojac += 1;
  return napraviKorisnika(`konzistentnost${brojac}@primjer.test`);
}

// Zahtjev kroz omotač: 500 bez internih detalja, nijedan pokušan upis, baza nepromijenjena.
async function ocekujNekonzistentno(putanja, token, tijelo, opis) {
  const prije = await p.snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await posalji(putanja, token, omotac, tijelo);
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
  provjeriBezInternihDetalja(odgovor, opis);
  assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
  assert.deepStrictEqual(await p.snimakBaze(), prije, `${opis}: baza promijenjena`);
}

test('I06-T03 cancel: ACTIVE sa tragom redeem-a / cancel-a, REDEEMED bez redeemedAt, EXPIRED sa cancelledAt → 500, ništa upisano; kanonski ACTIVE → 200', async () => {
  const sada = Date.now();
  for (const [opis, opcije, bezPolja] of [
    ['(a) ACTIVE sa redeemedAt', { redeemedAt: TS }],
    ['(b) ACTIVE sa redeemedAtStationId', { redeemedAtStationId: 'SIM01' }],
    ['(c) ACTIVE sa cancelledAt', { cancelledAt: TS }],
    ['(d) ACTIVE bez polja cancelledAt', {}, 'cancelledAt'],
    ['REDEEMED bez redeemedAt', { status: 'REDEEMED', redeemedAtStationId: 'SIM01' }],
    ['EXPIRED sa cancelledAt', { status: 'EXPIRED', cancelledAt: TS }],
    ['(a) istekao ACTIVE sa redeemedAt (bez O-5 release-a)', { redeemedAt: TS, expiresAtMs: sada - 60_000 }],
  ]) {
    const { uid, idToken } = await korisnik();
    await p.pripremiNalog(uid, 0, 50);
    const V = hex64();
    await p.pripremiVaucer(V, uid, { expiresAtMs: sada + 600_000, ...opcije });
    if (bezPolja !== undefined) {
      await p.referenca(`vouchers/${V}`).update({ [bezPolja]: FieldValue.delete() });
    }
    await p.pripremiReserve(V, uid, 50, 0, 50);
    await ocekujNekonzistentno(`/api/v1/vouchers/${V}/cancel`, idToken, undefined, opis);
  }

  const { uid, idToken } = await korisnik();
  await p.pripremiNalog(uid, 0, 50);
  const V = hex64();
  await p.pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
  await p.pripremiReserve(V, uid, 50, 0, 50);
  const kontrola = await posalji(`/api/v1/vouchers/${V}/cancel`, idToken);
  assert.equal(kontrola.status, 200, `kontrola: ${kontrola.text}`);
  assert.deepStrictEqual(await p.nalog(uid), [50, 0]);
});

test('I06-T04 procitajIstekleAktivne (API-06 i API-03): ACTIVE sa tragom redeem-a / cancel-a → 500, nijedan release; kanonski → 200 / 201', async () => {
  const sada = Date.now();
  for (const [opis, opcije] of [
    ['istekao ACTIVE sa redeemedAt', { redeemedAt: TS, expiresAtMs: sada - 60_000 }],
    ['NEistekao ACTIVE sa cancelledAt', { cancelledAt: TS, expiresAtMs: sada + 600_000 }],
    ['istekao ACTIVE sa redeemedAtStationId', { redeemedAtStationId: 'SIM01', expiresAtMs: sada - 60_000 }],
  ]) {
    for (const [endpoint, putanja, tijelo] of [
      ['API-06', '/api/v1/account/vouchers/reconcile', undefined],
      ['API-03', '/api/v1/rewards/SHOWER/issue', { requestId: randomUUID() }],
    ]) {
      const { uid, idToken } = await korisnik();
      await p.pripremiNalog(uid, 30, 50);
      const V = hex64();
      await p.pripremiVaucer(V, uid, opcije);
      await p.pripremiReserve(V, uid, 50, 30, 50);
      await ocekujNekonzistentno(putanja, idToken, tijelo, `${endpoint}: ${opis}`);
      assert.equal(await p.podaci(`loyaltyLedger/release_${V}`), undefined, `${endpoint}: ${opis}: release`);
    }
  }

  const a = await korisnik();
  await p.pripremiNalog(a.uid, 30, 50);
  const V = hex64();
  await p.pripremiVaucer(V, a.uid, { expiresAtMs: sada - 60_000 });
  await p.pripremiReserve(V, a.uid, 50, 30, 50);
  const api06 = await posalji('/api/v1/account/vouchers/reconcile', a.idToken);
  assert.equal(api06.status, 200, `kontrola API-06: ${api06.text}`);
  assert.deepStrictEqual(api06.body, { reconciledCount: 1 });

  const b = await korisnik();
  await p.pripremiNalog(b.uid, 30, 50);
  const W = hex64();
  await p.pripremiVaucer(W, b.uid, { expiresAtMs: sada - 60_000 });
  await p.pripremiReserve(W, b.uid, 50, 30, 50);
  const api03 = await posalji('/api/v1/rewards/SHOWER/issue', b.idToken, firebase.db, { requestId: randomUUID() });
  assert.equal(api03.status, 201, `kontrola API-03: ${api03.text}`);
  assert.deepStrictEqual(await p.nalog(b.uid), [50, 30]);
});

test('I06-T05 O-16 retry API-03: voucher iz mapping-a REDEEMED bez redeemedAt → 500, ništa upisano; konzistentan REDEEMED → 200 sa status REDEEMED', async () => {
  for (const [opis, izmjena, ocekivano] of [
    ['REDEEMED bez redeemedAt', { status: 'REDEEMED', redeemedAtStationId: 'SIM01' }, 500],
    ['ACTIVE sa cancelledAt', { cancelledAt: TS }, 500],
    ['kontrola: konzistentan REDEEMED', { status: 'REDEEMED', redeemedAt: TS, redeemedAtStationId: 'SIM01' }, 200],
  ]) {
    const { uid, idToken } = await korisnik();
    await p.pripremiNalog(uid, 80, 0);
    const requestId = randomUUID();
    const prvi = await posalji('/api/v1/rewards/CAR_WASH/issue', idToken, firebase.db, { requestId });
    assert.equal(prvi.status, 201, `${opis}: issue ${prvi.text}`);
    await p.referenca(`vouchers/${prvi.body.voucherId}`).update(izmjena);
    if (ocekivano === 500) {
      await ocekujNekonzistentno('/api/v1/rewards/CAR_WASH/issue', idToken, { requestId }, opis);
    } else {
      const omotac = omotacBaze(firebase.db);
      const retry = await posalji('/api/v1/rewards/CAR_WASH/issue', idToken, omotac, { requestId });
      assert.equal(retry.status, 200, `${opis}: ${retry.text}`);
      assert.deepStrictEqual(retry.body, { ...prvi.body, status: 'REDEEMED' }, opis);
      assert.deepStrictEqual(omotac.upisi, [], opis);
    }
  }
});
