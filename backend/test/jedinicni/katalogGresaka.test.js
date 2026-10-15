import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { KATALOG_GRESAKA, STAVKE_KATALOGA } from '../../src/greske/katalogGresaka.js';

// Tabela §27, prepisana iz normativnog SRS 3.1 (.docx).
const TABELA_27 = {
  UNAUTHENTICATED: 401,
  UNAUTHENTICATED_POS: 401,
  FORBIDDEN: 403,
  ACCOUNT_NOT_INITIALIZED: 409,
  ACCOUNT_DELETION_IN_PROGRESS: 409,
  REAUTHENTICATION_REQUIRED: 409,
  INVALID_DISPLAY_NAME: 422,
  INVALID_TRANSACTION_ID: 422,
  INVALID_VOLUME: 422,
  INVALID_AMOUNT: 422,
  UNSUPPORTED_CURRENCY: 422,
  INVALID_OCCURRED_AT: 422,
  LOYALTY_ACCOUNT_NOT_FOUND: 404,
  IDEMPOTENCY_CONFLICT: 409,
  REWARD_NOT_FOUND: 404,
  REWARD_INACTIVE: 409,
  INSUFFICIENT_POINTS: 409,
  VOUCHER_NOT_FOUND: 404,
  VOUCHER_EXPIRED: 409,
  VOUCHER_CANCELLED: 409,
  VOUCHER_ALREADY_REDEEMED: 409,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
};

// Tehnička dopuna van §27 (odluka O-1).
const DOPUNA_O1 = { NOT_FOUND: 404, INVALID_REQUEST: 422 };

function parovi(stavke) {
  return Object.fromEntries(stavke.map((s) => [s.kod, s.http]));
}

function tabelaIzCitljiveKopije() {
  const tekst = readFileSync(new URL('../../../docs/srs/FuelPoints_SRS_3_1.md', import.meta.url), 'utf8');
  const linije = tekst.split(/\r?\n/);
  const pocetak = linije.findIndex((l) => l.startsWith('# 27.'));
  const kraj = linije.findIndex((l, i) => i > pocetak && l.startsWith('# 28.'));
  assert.ok(pocetak >= 0 && kraj > pocetak, 'sekcija §27 nije pronađena u .md kopiji');
  const rezultat = {};
  for (const linija of linije.slice(pocetak, kraj)) {
    const poklapanje = /^\|\s*([A-Z_]+)\s*\|\s*(\d{3})\s*\|/.exec(linija);
    if (poklapanje) {
      assert.ok(!(poklapanje[1] in rezultat), `duplikat u .md tabeli: ${poklapanje[1]}`);
      rezultat[poklapanje[1]] = Number(poklapanje[2]);
    }
  }
  return rezultat;
}

test('I01-T01 katalog: 23 koda iz §27 sa tačnim HTTP statusima', () => {
  const izSrs = STAVKE_KATALOGA.filter((s) => s.izvor === '§27');
  assert.equal(Object.keys(TABELA_27).length, 23);
  assert.deepStrictEqual(parovi(izSrs), TABELA_27);
  assert.equal(izSrs.length, 23);
});

test('I01-T01 katalog: tabela §27 iz čitljive kopije SRS-a odgovara katalogu (bez drifta)', () => {
  assert.deepStrictEqual(tabelaIzCitljiveKopije(), TABELA_27);
});

test('I01-T01 katalog: dopuna O-1 je tačno NOT_FOUND 404 i INVALID_REQUEST 422', () => {
  const dopuna = STAVKE_KATALOGA.filter((s) => s.izvor === 'O-1');
  assert.deepStrictEqual(parovi(dopuna), DOPUNA_O1);
  assert.equal(dopuna.length, 2);
});

test('I01-T01 katalog: ukupno 25 stavki, bez duplikata i bez kodova van §27 + O-1', () => {
  assert.equal(STAVKE_KATALOGA.length, 25);
  const kodovi = STAVKE_KATALOGA.map((s) => s.kod);
  assert.equal(new Set(kodovi).size, kodovi.length);
  assert.deepStrictEqual(
    new Set(kodovi),
    new Set([...Object.keys(TABELA_27), ...Object.keys(DOPUNA_O1)]),
  );
  for (const s of STAVKE_KATALOGA) {
    assert.ok(s.izvor === '§27' || s.izvor === 'O-1', `nepoznat izvor za ${s.kod}`);
  }
  assert.deepStrictEqual(Object.keys(KATALOG_GRESAKA).sort(), [...kodovi].sort());
  assert.deepStrictEqual(parovi(Object.values(KATALOG_GRESAKA)), parovi(STAVKE_KATALOGA));
});

test('I01-T01 katalog: svaka poruka je neprazna, na latinici (bez ćirilice)', () => {
  for (const s of STAVKE_KATALOGA) {
    assert.equal(typeof s.poruka, 'string');
    assert.ok(s.poruka.trim().length > 0, `prazna poruka za ${s.kod}`);
    assert.doesNotMatch(s.poruka, /[Ѐ-ӿ]/, `ćirilica u poruci za ${s.kod}`);
  }
});

test('I01-T01 katalog: niz, stavke i mapa su zamrznuti', () => {
  assert.ok(Object.isFrozen(STAVKE_KATALOGA));
  assert.ok(Object.isFrozen(KATALOG_GRESAKA));
  for (const s of STAVKE_KATALOGA) {
    assert.ok(Object.isFrozen(s), `stavka ${s.kod} nije zamrznuta`);
  }
});
