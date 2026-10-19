// I06-T06: requestKey otkupa (O-8 (b), §20.2) i regresija API-03 (§14); I06-T07: strogo tijelo API-04 (§20.1, O-1).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { izracunajRequestKey } from '../../src/servisi/vauceri.js';
import { FORMAT_REDEMPTION_REQUEST_ID, provjeriTijeloOtkupa } from '../../src/validacija/zahtjevOtkupa.js';

const HEX64_MALA = /^[0-9a-f]{64}$/;

test('I06-T06 requestKey = SHA-256(UTF-8 stationId:redemptionRequestId), hex malim slovima, deterministički', () => {
  const k1 = izracunajRequestKey('SIM01', 'POS-RDM-001');
  assert.equal(k1, 'aefc7b83dbd1da18def47c0a4965f0e3a40752420325c5a3427b6d47946be20e');
  assert.equal(izracunajRequestKey('SIM02', 'POS-RDM-001'), 'e3ce68ad64e896bbca473a2ea235ab3e9587854153138918f70daca61cfd61d2');
  assert.equal(izracunajRequestKey('SIM01', 'POS-RDM-001'), k1, 'drugi poziv');
  assert.notEqual(izracunajRequestKey('SIM01', 'POS-RDM-002'), k1);
  assert.match(k1, HEX64_MALA);
  // API-03 regresija (§14, i04/P-4): uid:requestId.
  const uid = 'Xk3bQ9mZ2LrT7vYw1NcE5aPdH0s2';
  const requestId = '3f2c8a1e-7b4d-4c9e-a2f1-6d8e0b5c9a7f';
  assert.equal(izracunajRequestKey(uid, requestId), createHash('sha256').update(`${uid}:${requestId}`, 'utf8').digest('hex'));
});

test('I06-T07 provjeriTijeloOtkupa prihvata ispravne rubove §20.1 i vraća novi objekat', () => {
  const bezPrototipa = Object.create(null);
  bezPrototipa.redemptionRequestId = 'A';
  for (const [opis, tijelo] of [
    ['jedan znak', { redemptionRequestId: 'A' }],
    ['64 znaka', { redemptionRequestId: 'a'.repeat(64) }],
    ['tačka', { redemptionRequestId: '.' }],
    ['dvije tačke', { redemptionRequestId: '..' }],
    ['__x__', { redemptionRequestId: '__x__' }],
    ['-_.', { redemptionRequestId: '-_.' }],
    ['a.b-c_d', { redemptionRequestId: 'a.b-c_d' }],
    ['POS-RDM-001', { redemptionRequestId: 'POS-RDM-001' }],
    ['objekat bez prototipa', bezPrototipa],
  ]) {
    const rezultat = provjeriTijeloOtkupa(tijelo);
    assert.deepStrictEqual(rezultat, { redemptionRequestId: tijelo.redemptionRequestId }, opis);
    assert.notEqual(rezultat, tijelo, `${opis}: vraćeno tijelo po referenci`);
  }
  assert.equal(FORMAT_REDEMPTION_REQUEST_ID.flags, '', 'regex ima zastavice');
});

test('I06-T07 provjeriTijeloOtkupa: sve ostalo → INVALID_REQUEST', () => {
  for (const [opis, tijelo] of [
    ['65 znakova', { redemptionRequestId: 'a'.repeat(65) }],
    ['prazan string', { redemptionRequestId: '' }],
    ['dvotačka', { redemptionRequestId: 'a:b' }],
    ['kosa crta', { redemptionRequestId: 'a/b' }],
    ['razmak', { redemptionRequestId: 'a b' }],
    ['š', { redemptionRequestId: 'š' }],
    ['matematička cifra', { redemptionRequestId: '𝟘' }],
    ['završni prelom reda', { redemptionRequestId: 'a\n' }],
    ['broj', { redemptionRequestId: 5 }],
    ['null', { redemptionRequestId: null }],
    ['boolean', { redemptionRequestId: true }],
    ['niz kao vrijednost', { redemptionRequestId: [] }],
    ['objekat kao vrijednost', { redemptionRequestId: {} }],
    ['niz sa stringom kao vrijednost', { redemptionRequestId: ['A'] }],
    ['prazan objekat', {}],
    ['undefined', undefined],
    ['null tijelo', null],
    ['skalar', 'x'],
    ['niz', ['A']],
    ['dodatno stationId', { redemptionRequestId: 'A', stationId: 'SIM02' }],
    ['dodatno uid', { redemptionRequestId: 'A', uid: 'u' }],
    ['dodatno voucherId', { redemptionRequestId: 'A', voucherId: 'ab'.repeat(32) }],
    ['dodatno x', { redemptionRequestId: 'A', x: 1 }],
    ['sopstveni __proto__', JSON.parse('{"__proto__":1,"redemptionRequestId":"A"}')],
    ['samo drugo polje', { requestId: 'A' }],
  ]) {
    assert.throws(
      () => provjeriTijeloOtkupa(tijelo),
      (greska) => greska instanceof GreskaApi && greska.kod === 'INVALID_REQUEST',
      opis,
    );
  }
});
