// I05-T03 (a): politika tijela endpoint-a bez business input-a (O-21, i05/P-2) i format voucherId-a iz putanje (O-22, ODLUKE §6 (k)).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { provjeriPraznoTijelo, provjeriVoucherId } from '../../src/validacija/zahtjevVaucera.js';

const HEX64 = 'ab'.repeat(32);

function odbijaSa(funkcija, kod, opis) {
  assert.throws(
    funkcija,
    (greska) => {
      assert.ok(greska instanceof GreskaApi, `${opis}: nije GreskaApi`);
      assert.equal(greska.kod, kod, opis);
      return true;
    },
    opis,
  );
}

test('I05-T03 (a) provjeriPraznoTijelo: bez tijela (i Content-Length: 0) i {} prolaze', () => {
  for (const [opis, tijelo, zaglavlja] of [
    ['bez tijela, bez zaglavlja', undefined, {}],
    ['Content-Length: 0 bez Content-Type (Retrofit)', undefined, { 'content-length': '0' }],
    ['{} sa Content-Length', {}, { 'content-length': '2' }],
    ['{} chunked', {}, { 'transfer-encoding': 'chunked' }],
  ]) {
    assert.doesNotThrow(() => provjeriPraznoTijelo(tijelo, zaglavlja), opis);
  }
});

test('I05-T03 (a) provjeriPraznoTijelo: svako drugo tijelo → INVALID_REQUEST', () => {
  for (const [opis, tijelo, zaglavlja] of [
    ['objekat sa poljem', { a: 1 }, { 'content-length': '7' }],
    ['sopstveni ključ __proto__', JSON.parse('{"__proto__":1}'), { 'content-length': '15' }],
    ['niz', [], { 'content-length': '2' }],
    ['null', null, { 'content-length': '4' }],
    ['string', 'x', { 'content-length': '3' }],
    ['broj', 5, { 'content-length': '1' }],
    ['boolean', true, { 'content-length': '4' }],
    ['nepročitano tijelo (Content-Length > 0)', undefined, { 'content-length': '11' }],
    ['nepročitano tijelo (chunked)', undefined, { 'transfer-encoding': 'chunked' }],
    ["Content-Length '00'", undefined, { 'content-length': '00' }],
  ]) {
    odbijaSa(() => provjeriPraznoTijelo(tijelo, zaglavlja), 'INVALID_REQUEST', opis);
  }
});

test('I05-T03 (a) provjeriVoucherId: samo 64 mala hex znaka; sve ostalo → VOUCHER_NOT_FOUND', () => {
  assert.equal(provjeriVoucherId(HEX64), HEX64);
  assert.equal(provjeriVoucherId('0'.repeat(64)), '0'.repeat(64));
  for (const [opis, vrijednost] of [
    ['velika slova (cijeli)', HEX64.toUpperCase()],
    ['jedno veliko slovo', `A${HEX64.slice(1)}`],
    ['63 znaka', HEX64.slice(1)],
    ['65 znakova', `${HEX64}a`],
    ['prazno', ''],
    ['kosa crta', `a/b${HEX64.slice(3)}`],
    ['NUL', `\u0000${HEX64.slice(1)}`],
    ['završni prelom reda', `${HEX64}\n`],
    ['rezervisani oblik', '__x__'],
    ['Firebase UID oblik', 'aB3dE5fG7hI9jK1lM3nO5pQ7rS9t'],
    ['UUID', '3b241101-e2bb-4255-8caf-4136c566a962'],
    ['..', '..'],
    ['razmak', `${HEX64.slice(1)} `],
    ['arapsko-indijske cifre', '١'.repeat(64)],
    ['ne-string (broj)', 5],
    ['ne-string (undefined)', undefined],
  ]) {
    odbijaSa(() => provjeriVoucherId(vrijednost), 'VOUCHER_NOT_FOUND', opis);
  }
});
