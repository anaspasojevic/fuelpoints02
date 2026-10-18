// I04-T02 (a) strogo tijelo i requestId (§13, O-15, O-1) i I04-T03 (a) format rewardId (D-4, i04/P-9), bez emulatora.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { provjeriRewardId, provjeriTijeloIzdavanja } from '../../src/validacija/zahtjevIzdavanja.js';

const R = '3b241101-e2bb-4255-8caf-4136c566a962';

function ocekujGresku(funkcija, kod, opis) {
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

test('I04-T02 (a) kanonski UUID v4 malim slovima prolazi; rezultat je novi objekat { requestId }', () => {
  const ispravni = [
    R,
    '3b241101-e2bb-4255-9caf-4136c566a962',
    '3b241101-e2bb-4255-acaf-4136c566a962',
    '3b241101-e2bb-4255-bcaf-4136c566a962',
    ...Array.from({ length: 20 }, () => randomUUID()),
  ];
  for (const requestId of ispravni) {
    const tijelo = { requestId };
    const rezultat = provjeriTijeloIzdavanja(tijelo);
    assert.deepStrictEqual(rezultat, { requestId }, requestId);
    assert.notEqual(rezultat, tijelo, `${requestId}: vraćeno tijelo po referenci`);
  }
});

test('I04-T02 (a) tijelo koje nije običan objekat → 422 INVALID_REQUEST', () => {
  for (const [opis, tijelo] of [
    ['undefined', undefined],
    ['null', null],
    ['niz', []],
    ['niz sa objektom', [{ requestId: R }]],
    ['string', 'x'],
    ['broj', 5],
    ['boolean', true],
  ]) {
    ocekujGresku(() => provjeriTijeloIzdavanja(tijelo), 'INVALID_REQUEST', opis);
  }
});

test('I04-T02 (a) requestId nedostaje, nije string ili nije kanonski UUID v4 malim slovima (O-15) → 422 INVALID_REQUEST', () => {
  const neispravni = [
    ['nedostaje', {}],
    ['null', { requestId: null }],
    ['broj', { requestId: 5 }],
    ['niz', { requestId: [R] }],
    ['objekat', { requestId: { R } }],
    ['velika slova (cijeli)', { requestId: R.toUpperCase() }],
    ['jedno veliko slovo', { requestId: `3B${R.slice(2)}` }],
    ['v1', { requestId: 'c232ab00-9414-11ec-b3c8-9f6bdeced846' }],
    ['v7', { requestId: '017f22e2-79b0-7cc3-98c4-dc0c0c07398f' }],
    ['nil UUID', { requestId: '00000000-0000-0000-0000-000000000000' }],
    ['varijanta c', { requestId: '3b241101-e2bb-4255-ccaf-4136c566a962' }],
    ['varijanta 0', { requestId: '3b241101-e2bb-4255-0caf-4136c566a962' }],
    ['varijanta 7', { requestId: '3b241101-e2bb-4255-7caf-4136c566a962' }],
    ['vitičaste zagrade', { requestId: `{${R}}` }],
    ['URN prefiks', { requestId: `urn:uuid:${R}` }],
    ['bez crtica', { requestId: R.replaceAll('-', '') }],
    ['razmak ispred', { requestId: ` ${R}` }],
    ['razmak iza', { requestId: `${R} ` }],
    ['završni \\n', { requestId: `${R}\n` }],
    ['završni \\r\\n', { requestId: `${R}\r\n` }],
    ['35 znakova', { requestId: R.slice(0, 35) }],
    ['37 znakova', { requestId: `${R}a` }],
    ['arapsko-indijska cifra', { requestId: `٣${R.slice(1)}` }],
    ['prazan string', { requestId: '' }],
  ];
  for (const [opis, tijelo] of neispravni) {
    ocekujGresku(() => provjeriTijeloIzdavanja(tijelo), 'INVALID_REQUEST', opis);
  }
});

test('I04-T02 (a) bilo koje polje osim requestId (server-controlled ili nepoznato) → 422 INVALID_REQUEST', () => {
  const dodatna = [
    ['uid', 'korisnikB'],
    ['rewardId', 'SHOWER'],
    ['costPoints', 1],
    ['voucherId', 'a'.repeat(64)],
    ['status', 'ACTIVE'],
    ['issuedAt', '2026-10-17T10:00:00.000Z'],
    ['expiresAt', '2026-10-17T10:15:00.000Z'],
    ['nepoznato', 1],
    ['constructor', 1],
  ];
  for (const [polje, vrijednost] of dodatna) {
    ocekujGresku(() => provjeriTijeloIzdavanja({ requestId: R, [polje]: vrijednost }), 'INVALID_REQUEST', polje);
  }
  // __proto__ iz sirovog JSON-a je sopstveni ključ objekta.
  ocekujGresku(
    () => provjeriTijeloIzdavanja(JSON.parse(`{"requestId":"${R}","__proto__":{"costPoints":1}}`)),
    'INVALID_REQUEST',
    '__proto__',
  );
});

test('I04-T03 (a) ispravan format rewardId prolazi i vraća istu vrijednost', () => {
  for (const rewardId of ['CAR_WASH', 'SHOWER', 'FOO', 'x'.repeat(128), 'a.b', 'č', '...', '_x_', '__x', 'x__']) {
    assert.equal(provjeriRewardId(rewardId), rewardId, rewardId);
  }
});

test('I04-T03 (a) neispravan format rewardId (D-4, i04/P-9) → 404 REWARD_NOT_FOUND', () => {
  const neispravni = [
    ['prazan', ''],
    ['sadrži /', 'a/b'],
    ['.', '.'],
    ['..', '..'],
    ['__x__', '__x__'],
    ['____', '____'],
    ['__\\n__', '__\n__'],
    ['129 znakova', 'x'.repeat(129)],
    ['usamljeni surogat', '\uD800'],
    ['NUL u sredini', 'a\u0000b'],
    ['samo NUL', '\u0000'],
    ['\\n', '\n'],
    ['\\t', 'a\tb'],
    ['U+007F', '\u007f'],
    ['U+0085', '\u0085'],
    ['U+009F', 'a\u009f'],
    ['undefined', undefined],
    ['null', null],
    ['broj', 5],
    ['niz', ['CAR_WASH']],
  ];
  for (const [opis, rewardId] of neispravni) {
    ocekujGresku(() => provjeriRewardId(rewardId), 'REWARD_NOT_FOUND', opis);
  }
});
