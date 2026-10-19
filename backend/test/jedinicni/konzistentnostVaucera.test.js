// I06-T02: jedina definicija konzistentnog voucher dokumenta (O-27, §15, §16; ODLUKE §6 (t)).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { jeKonzistentnoStanjeVaucera } from '../../src/servisi/vauceri.js';

const TS = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));

function vaucer(izmjene = {}, bezPolja = []) {
  const v = {
    uid: 'korisnikA',
    rewardId: 'CAR_WASH',
    costPoints: 50,
    status: 'ACTIVE',
    issuedAt: TS,
    expiresAt: Timestamp.fromMillis(TS.toMillis() + 900_000),
    redeemedAt: null,
    cancelledAt: null,
    redeemedAtStationId: null,
    ...izmjene,
  };
  for (const polje of bezPolja) {
    delete v[polje];
  }
  return v;
}

test('I06-T02 konzistentna stanja ACTIVE, REDEEMED, CANCELLED i EXPIRED', () => {
  for (const [opis, v] of [
    ['ACTIVE', vaucer()],
    ['REDEEMED', vaucer({ status: 'REDEEMED', redeemedAt: TS, redeemedAtStationId: 'SIM01' })],
    ['CANCELLED', vaucer({ status: 'CANCELLED', cancelledAt: TS })],
    ['EXPIRED', vaucer({ status: 'EXPIRED' })],
    ['SHOWER 30', vaucer({ rewardId: 'SHOWER', costPoints: 30 })],
  ]) {
    assert.equal(jeKonzistentnoStanjeVaucera(v), true, opis);
  }
});

test('I06-T02 nekonzistentna stanja (svako zasebno) i neispravan ulaz → false bez bacanja', () => {
  for (const [opis, v] of [
    ['ACTIVE sa redeemedAt', vaucer({ redeemedAt: TS })],
    ['ACTIVE sa redeemedAtStationId', vaucer({ redeemedAtStationId: 'S' })],
    ['ACTIVE sa cancelledAt', vaucer({ cancelledAt: TS })],
    ['ACTIVE bez polja redeemedAt', vaucer({}, ['redeemedAt'])],
    ['ACTIVE bez polja cancelledAt', vaucer({}, ['cancelledAt'])],
    ['ACTIVE bez polja redeemedAtStationId', vaucer({}, ['redeemedAtStationId'])],
    ['REDEEMED bez redeemedAt', vaucer({ status: 'REDEEMED', redeemedAtStationId: 'SIM01' })],
    ['REDEEMED redeemedAt string', vaucer({ status: 'REDEEMED', redeemedAt: '2026-10-01T08:00:00.000Z', redeemedAtStationId: 'SIM01' })],
    ['REDEEMED redeemedAtStationId prazan', vaucer({ status: 'REDEEMED', redeemedAt: TS, redeemedAtStationId: '' })],
    ['REDEEMED redeemedAtStationId null', vaucer({ status: 'REDEEMED', redeemedAt: TS })],
    ['REDEEMED redeemedAtStationId broj', vaucer({ status: 'REDEEMED', redeemedAt: TS, redeemedAtStationId: 5 })],
    ['REDEEMED sa cancelledAt', vaucer({ status: 'REDEEMED', redeemedAt: TS, redeemedAtStationId: 'SIM01', cancelledAt: TS })],
    ['REDEEMED bez polja cancelledAt', vaucer({ status: 'REDEEMED', redeemedAt: TS, redeemedAtStationId: 'SIM01' }, ['cancelledAt'])],
    ['CANCELLED bez cancelledAt', vaucer({ status: 'CANCELLED' })],
    ['CANCELLED sa redeemedAt', vaucer({ status: 'CANCELLED', cancelledAt: TS, redeemedAt: TS })],
    ['CANCELLED sa redeemedAtStationId', vaucer({ status: 'CANCELLED', cancelledAt: TS, redeemedAtStationId: 'SIM01' })],
    ['CANCELLED bez polja redeemedAt', vaucer({ status: 'CANCELLED', cancelledAt: TS }, ['redeemedAt'])],
    ['EXPIRED sa redeemedAt', vaucer({ status: 'EXPIRED', redeemedAt: TS })],
    ['EXPIRED sa redeemedAtStationId', vaucer({ status: 'EXPIRED', redeemedAtStationId: 'SIM01' })],
    ['EXPIRED sa cancelledAt', vaucer({ status: 'EXPIRED', cancelledAt: TS })],
    ['EXPIRED bez polja cancelledAt', vaucer({ status: 'EXPIRED' }, ['cancelledAt'])],
    ['uid prazan', vaucer({ uid: '' })],
    ['uid broj', vaucer({ uid: 5 })],
    ['bez uid', vaucer({}, ['uid'])],
    ['rewardId broj', vaucer({ rewardId: 5 })],
    ['bez rewardId', vaucer({}, ['rewardId'])],
    ['costPoints 0', vaucer({ costPoints: 0 })],
    ['costPoints 1.5', vaucer({ costPoints: 1.5 })],
    ['costPoints string', vaucer({ costPoints: '50' })],
    ['status PENDING', vaucer({ status: 'PENDING' })],
    ['issuedAt string', vaucer({ issuedAt: '2026-10-01T08:00:00.000Z' })],
    ['expiresAt string', vaucer({ expiresAt: '2026-10-01T08:15:00.000Z' })],
    ['undefined', undefined],
    ['null', null],
  ]) {
    assert.equal(jeKonzistentnoStanjeVaucera(v), false, opis);
  }
});
