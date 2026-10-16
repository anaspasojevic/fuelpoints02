// I03-T07 (a): strogo čitanje occurredAt (§8.4, i03/P-4) bez mreže; (c) uključiva granica +5 min (i03 FIX LOOP 1, R-02).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { provjeriTijeloKupovine } from '../../src/validacija/tijeloKupovine.js';
import { procitajOccurredAt } from '../../src/validacija/vrijemeKupovine.js';

const MIN_TIMESTAMP_MS = -62_135_596_800_000;
const MAX_TIMESTAMP_MS = 253_402_300_799_999;

test('I03-T07 (a) ispravan RFC 3339 sa zonom → milisekunde tog trenutka', () => {
  const slucajevi = [
    ['2026-10-16T10:00:00Z', Date.parse('2026-10-16T10:00:00.000Z')],
    ['2026-10-16T10:00:00.5Z', Date.parse('2026-10-16T10:00:00.500Z')],
    ['2026-10-16T10:00:00.05Z', Date.parse('2026-10-16T10:00:00.050Z')],
    ['2026-10-16T10:00:00.123Z', Date.parse('2026-10-16T10:00:00.123Z')],
    ['2026-10-16T10:00:00+02:00', Date.parse('2026-10-16T08:00:00.000Z')],
    ['2026-10-16T10:00:00-05:30', Date.parse('2026-10-16T15:30:00.000Z')],
    ['2026-10-16T10:00:00-00:00', Date.parse('2026-10-16T10:00:00.000Z')],
    ['2024-02-29T12:00:00Z', Date.parse('2024-02-29T12:00:00.000Z')],
    ['2000-02-29T00:00:00Z', Date.parse('2000-02-29T00:00:00.000Z')],
    ['0001-01-01T00:00:00Z', MIN_TIMESTAMP_MS],
    ['0099-06-15T00:00:00Z', -59_028_739_200_000],
    ['9999-12-31T23:59:59.999Z', MAX_TIMESTAMP_MS],
  ];
  for (const [tekst, ocekivano] of slucajevi) {
    assert.equal(procitajOccurredAt(tekst), ocekivano, tekst);
  }
});

test('I03-T07 (a) neispravan format, nepostojeći datum ili van opsega Timestamp-a → null', () => {
  const neispravni = [
    '2026-02-30T00:00:00Z',
    '2025-02-29T00:00:00Z',
    '2100-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '2026-00-10T00:00:00Z',
    '2026-13-10T00:00:00Z',
    '2026-10-00T00:00:00Z',
    '2026-10-16T24:00:00Z',
    '2026-10-16T10:60:00Z',
    '2026-10-16T10:00:60Z',
    '2026-10-16T10:00:00',
    '2026-10-16',
    '2026-10-16 10:00:00Z',
    '2026-10-16t10:00:00z',
    '2026-10-16T10:00:00z',
    '2026-10-16T10:00:00.Z',
    '2026-10-16T10:00:00.1234Z',
    '2026-10-16T10:00:00+24:00',
    '2026-10-16T10:00:00+02:60',
    '2026-10-16T10:00:00+0200',
    '2026-10-16T10:00:00+02',
    '0001-01-01T00:00:00+00:01',
    '0000-12-31T23:59:59Z',
    '+002026-10-16T10:00:00Z',
    ' 2026-10-16T10:00:00Z',
    '2026-10-16T10:00:00Z ',
    '2026-10-16T10:00:00Z\n',
    '２０２６-10-16T10:00:00Z',
    '',
  ];
  for (const tekst of neispravni) {
    assert.equal(procitajOccurredAt(tekst), null, JSON.stringify(tekst));
  }
  for (const vrijednost of [1_760_608_800_000, null, undefined, true, {}, ['2026-10-16T10:00:00Z']]) {
    assert.equal(procitajOccurredAt(vrijednost), null, JSON.stringify(vrijednost));
  }
});

test('I03-T07 (c) occurredAt tačno +5 min od vremena Backend-a prolazi, +5 min i 1 ms → INVALID_OCCURRED_AT (granica uključiva)', () => {
  const sadaMs = Date.UTC(2026, 9, 16, 10, 0, 0, 0);
  function tijelo(occurredAtMs) {
    return {
      loyaltyUid: 'korisnikA',
      posTransactionId: '000184',
      volumeMl: 42_730,
      amountMinor: 7050,
      currency: 'EUR',
      occurredAt: new Date(occurredAtMs).toISOString(),
    };
  }
  const naGranici = provjeriTijeloKupovine(tijelo(sadaMs + 300_000), sadaMs);
  assert.equal(naGranici.occurredAtMs, sadaMs + 300_000);
  assert.throws(
    () => provjeriTijeloKupovine(tijelo(sadaMs + 300_001), sadaMs),
    (greska) => greska instanceof GreskaApi && greska.kod === 'INVALID_OCCURRED_AT',
  );
});
