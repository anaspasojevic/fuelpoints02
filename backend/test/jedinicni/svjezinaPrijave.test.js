// §23 recent auth, §27 REAUTHENTICATION_REQUIRED, O-35, i07/P-2: I07-T01.
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { MAKSIMALNA_STAROST_PRIJAVE_MS, jeSvjezaPrijava, provjeriSvjezinuPrijave } from '../../src/posrednici/svjezinaPrijave.js';

const T = 1_790_000_000;

afterEach(() => {
  mock.restoreAll();
});

test('I07-T01 jeSvjezaPrijava: granica uključiva (auth_time·1000 + 300 000), budući auth_time dozvoljen, neispravan auth_time → false', () => {
  assert.equal(MAKSIMALNA_STAROST_PRIJAVE_MS, 300_000);
  assert.equal(jeSvjezaPrijava(T, T * 1000), true, 'sada');
  assert.equal(jeSvjezaPrijava(T, T * 1000 + 300_000), true, 'tačno 5 min');
  assert.equal(jeSvjezaPrijava(T, T * 1000 + 300_001), false, '5 min + 1 ms');
  assert.equal(jeSvjezaPrijava(T, (T + 301) * 1000), false, '301 s');
  assert.equal(jeSvjezaPrijava(T + 60, T * 1000), true, 'budući auth_time (i07/P-2)');
  assert.equal(jeSvjezaPrijava(0, 300_000), true, 'auth_time 0');
  for (const neispravan of [undefined, null, String(T), 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, {}, [T], true]) {
    assert.equal(jeSvjezaPrijava(neispravan, T * 1000), false, `auth_time ${String(neispravan)}`);
  }
});

test('I07-T01 provjeriSvjezinuPrijave: po Date.now(); 409 REAUTHENTICATION_REQUIRED kao GreskaApi', () => {
  mock.method(Date, 'now', () => T * 1000 + 300_000);
  assert.doesNotThrow(() => provjeriSvjezinuPrijave(T));
  mock.restoreAll();
  mock.method(Date, 'now', () => T * 1000 + 300_001);
  assert.throws(
    () => provjeriSvjezinuPrijave(T),
    (greska) => greska instanceof GreskaApi && greska.kod === 'REAUTHENTICATION_REQUIRED',
  );
  assert.throws(
    () => provjeriSvjezinuPrijave(undefined),
    (greska) => greska instanceof GreskaApi && greska.kod === 'REAUTHENTICATION_REQUIRED',
  );
});
