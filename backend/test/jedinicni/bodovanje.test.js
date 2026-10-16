// I03-T03 (a) pravilo bodovanja (§1.5) i I03-T21 tekst notifikacije sa oblikom riječi „bod” (i03/P-8).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { izracunajBodove, oblikRijeciBod, tekstObavjestenja } from '../../src/servisi/bodovanje.js';

test('I03-T03 (a) earnedPoints = floor(volumeMl / 1000), uvijek integer', () => {
  const slucajevi = [
    [1, 0],
    [900, 0],
    [999, 0],
    [1000, 1],
    [1999, 1],
    [10_000, 10],
    [10_990, 10],
    [42_730, 42],
    [200_000, 200],
  ];
  for (const [volumeMl, ocekivano] of slucajevi) {
    const bodovi = izracunajBodove(volumeMl);
    assert.equal(bodovi, ocekivano, `${volumeMl} ml`);
    assert.ok(Number.isInteger(bodovi), `${volumeMl} ml: nije integer`);
  }
});

test('I03-T21 oblik riječi „bod” za 0 … 200 po pravilu 5.7', () => {
  const tabela = [
    [0, 'bodova'],
    [1, 'bod'],
    [2, 'boda'],
    [3, 'boda'],
    [4, 'boda'],
    [5, 'bodova'],
    [10, 'bodova'],
    [11, 'bodova'],
    [12, 'bodova'],
    [13, 'bodova'],
    [14, 'bodova'],
    [15, 'bodova'],
    [20, 'bodova'],
    [21, 'bod'],
    [22, 'boda'],
    [25, 'bodova'],
    [42, 'boda'],
    [100, 'bodova'],
    [101, 'bod'],
    [102, 'boda'],
    [111, 'bodova'],
    [112, 'bodova'],
    [113, 'bodova'],
    [114, 'bodova'],
    [121, 'bod'],
    [200, 'bodova'],
  ];
  for (const [broj, oblik] of tabela) {
    assert.equal(oblikRijeciBod(broj), oblik, String(broj));
  }
});

test('I03-T21 tekst notifikacije: tačni title i body, bez internih podataka', () => {
  assert.deepStrictEqual(tekstObavjestenja(42), {
    title: 'Bodovi za kupovinu goriva',
    body: 'Za kupovinu goriva dobili ste 42 boda.',
  });
  assert.deepStrictEqual(tekstObavjestenja(1), {
    title: 'Bodovi za kupovinu goriva',
    body: 'Za kupovinu goriva dobili ste 1 bod.',
  });
  assert.deepStrictEqual(tekstObavjestenja(0), {
    title: 'Bodovi za kupovinu goriva',
    body: 'Za kupovinu goriva dobili ste 0 bodova.',
  });
});
