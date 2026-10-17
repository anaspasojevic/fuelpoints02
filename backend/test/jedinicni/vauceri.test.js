// I04-T06 (a) voucherId (§15, i04/P-3) i requestKey (§14, i04/P-4); I04-T09 (f) granica isteka (§18.1) i redoslijed release-a (i04/P-6).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, mock, test } from 'node:test';
import {
  TRAJANJE_VAUCERA_MS,
  generisiVoucherId,
  izracunajRequestKey,
  jeIstekao,
  poredakOslobadjanja,
} from '../../src/servisi/vauceri.js';

const R = '3b241101-e2bb-4255-8caf-4136c566a962';
const VOUCHER_ID = /^[0-9a-f]{64}$/;

afterEach(() => {
  mock.restoreAll();
});

function nezavisanKljuc(uid, requestId) {
  return crypto.createHash('sha256').update(Buffer.from(`${uid}:${requestId}`, 'utf8')).digest('hex');
}

test('I04-T06 (a) generisiVoucherId: 1000 poziva → svi ^[0-9a-f]{64}$ i svi različiti', () => {
  const idjevi = Array.from({ length: 1000 }, () => generisiVoucherId());
  for (const id of idjevi) {
    assert.match(id, VOUCHER_ID);
  }
  assert.equal(new Set(idjevi).size, 1000);
});

test('I04-T06 (a) generisiVoucherId je samo hex od crypto.randomBytes(32) (256 bita iz CSPRNG-a, ništa izvedeno)', () => {
  const fiksno = Buffer.alloc(32, 0xab);
  const izvorna = crypto.randomBytes;
  const lazna = mock.method(crypto, 'randomBytes', (n, ...ostalo) => (n === 32 ? fiksno : izvorna(n, ...ostalo)));
  assert.equal(generisiVoucherId(), fiksno.toString('hex'));
  assert.equal(generisiVoucherId(), 'ab'.repeat(32));
  assert.equal(lazna.mock.callCount(), 2);
  for (const poziv of lazna.mock.calls) {
    assert.deepStrictEqual(poziv.arguments, [32]);
  }
});

test('I04-T06 (a) izracunajRequestKey: SHA-256 hex (mala slova) nad UTF-8 uid + ":" + requestId (vektor C3)', () => {
  assert.equal(izracunajRequestKey('U', R), '631e80fe93e6fd96cd78653da1d09604ac2acd0c12db25ef15596ac2738e5628');
  for (const uid of ['korisnikA', 'Bi8G9CD72KlnS02pMBTrUgdZNlnX', 'č€😀', 'a:b']) {
    const kljuc = izracunajRequestKey(uid, R);
    assert.match(kljuc, VOUCHER_ID, uid);
    assert.equal(kljuc, nezavisanKljuc(uid, R), uid);
  }
  // uid sa ":" daje ključ različit od podjela na drugom mjestu (requestId po O-15 nema ":", pa je podjela jednoznačna).
  assert.notEqual(izracunajRequestKey('a:b', R), izracunajRequestKey('a', R));
  assert.notEqual(izracunajRequestKey('a:b', R), izracunajRequestKey('b', R));
  // Isti requestId, drugi korisnik → drugi ključ; drugi requestId → drugi ključ.
  assert.notEqual(izracunajRequestKey('korisnikA', R), izracunajRequestKey('korisnikB', R));
  assert.notEqual(izracunajRequestKey('korisnikA', R), izracunajRequestKey('korisnikA', crypto.randomUUID()));
});

test('I04-T09 (f) TRAJANJE_VAUCERA_MS je tačno 15 minuta (§17)', () => {
  assert.equal(TRAJANJE_VAUCERA_MS, 900_000);
});

test('I04-T09 (f) jeIstekao: serverTime ≥ expiresAt (granica uključiva, §18.1)', () => {
  const T = Date.UTC(2026, 9, 17, 10, 15, 0);
  assert.equal(jeIstekao(T, T), true, 'sadaMs == expiresAt');
  assert.equal(jeIstekao(T, T - 1), false, 'sadaMs = expiresAt − 1 ms');
  assert.equal(jeIstekao(T, T + 1), true, 'sadaMs = expiresAt + 1 ms');
});

test('I04-T09 (f) poredakOslobadjanja: expiresAt rastuće, pa voucherId rastuće (poređenje stringova)', () => {
  const T = Date.UTC(2026, 9, 17, 10, 0, 0);
  const vauceri = [
    { voucherId: 'b'.repeat(64), expiresAtMs: T - 60_000 },
    { voucherId: '0'.repeat(64), expiresAtMs: T - 120_000 },
    { voucherId: 'a'.repeat(64), expiresAtMs: T - 60_000 },
    { voucherId: 'f'.repeat(64), expiresAtMs: T - 180_000 },
  ];
  const sortirano = [...vauceri].sort(poredakOslobadjanja).map((v) => v.voucherId[0]);
  assert.deepStrictEqual(sortirano, ['f', '0', 'a', 'b']);
  // Isti expiresAt: samo po voucherId, nezavisno od početnog redoslijeda.
  const isti = [
    { voucherId: 'b1', expiresAtMs: T },
    { voucherId: 'B1', expiresAtMs: T },
    { voucherId: 'a1', expiresAtMs: T },
  ];
  assert.deepStrictEqual([...isti].sort(poredakOslobadjanja).map((v) => v.voucherId), ['B1', 'a1', 'b1']);
  assert.deepStrictEqual([...isti].reverse().sort(poredakOslobadjanja).map((v) => v.voucherId), ['B1', 'a1', 'b1']);
  assert.equal(poredakOslobadjanja(isti[0], { ...isti[0] }), 0);
});
