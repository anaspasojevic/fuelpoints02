import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';
import { test } from 'node:test';
import { GreskaKonfiguracije, ucitajKonfiguraciju } from '../../src/konfiguracija/konfiguracija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

const KORIJEN_BACKENDA = fileURLToPath(new URL('../../', import.meta.url));
const POS_API_KLJUCEVI = posKonfiguracija([['SIM01', generisiPosKljuc()]]);

test('I01-T06 nedostaju PORT, FIREBASE_PROJECT_ID i VERZIJA_USLOVA → GreskaKonfiguracije navodi sve tri varijable', () => {
  assert.throws(
    () => ucitajKonfiguraciju({}),
    (greska) => {
      assert.ok(greska instanceof GreskaKonfiguracije);
      assert.match(greska.message, /PORT/);
      assert.match(greska.message, /FIREBASE_PROJECT_ID/);
      assert.match(greska.message, /VERZIJA_USLOVA/);
      assert.match(greska.message, /POS_API_KLJUCEVI/);
      return true;
    },
  );
});

test('I01-T06 neispravan PORT → greška formata bez ispisa vrijednosti', () => {
  assert.throws(
    () =>
      ucitajKonfiguraciju({
        PORT: 'TAJNA_VRIJEDNOST_PORT',
        FIREBASE_PROJECT_ID: 'demo-tajna-xyz',
        VERZIJA_USLOVA: '1.0',
        POS_API_KLJUCEVI,
      }),
    (greska) => {
      assert.ok(greska instanceof GreskaKonfiguracije);
      assert.match(greska.message, /PORT/);
      assert.ok(!greska.message.includes('TAJNA_VRIJEDNOST_PORT'));
      assert.ok(!greska.message.includes('demo-tajna-xyz'));
      return true;
    },
  );
  for (const port of ['0', '65536', '3000.5', '-1', ' ']) {
    assert.throws(
      () => ucitajKonfiguraciju({ PORT: port, FIREBASE_PROJECT_ID: 'demo-x', VERZIJA_USLOVA: '1.0', POS_API_KLJUCEVI }),
      GreskaKonfiguracije,
    );
  }
});

test('I01-T06 ispravne vrijednosti → zamrznut objekat konfiguracije', () => {
  const konfiguracija = ucitajKonfiguraciju({
    PORT: '3000',
    FIREBASE_PROJECT_ID: 'demo-fuelpoints',
    VERZIJA_USLOVA: '1.0',
    POS_API_KLJUCEVI,
  });
  assert.deepStrictEqual(konfiguracija, {
    port: 3000,
    projectId: 'demo-fuelpoints',
    host: '127.0.0.1',
    verzijaUslova: '1.0',
    posStanice: procitajPosKljuceve(POS_API_KLJUCEVI).stanice,
  });
  assert.ok(Object.isFrozen(konfiguracija));
});

test('I01-T06 pokretanje bez PORT → izlaz ≠ 0, poruka imenuje PORT, bez vrijednosti i stack-a', () => {
  const rezultat = spawnSync(process.execPath, ['src/pokreni.js'], {
    cwd: KORIJEN_BACKENDA,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      FIREBASE_PROJECT_ID: 'demo-tajna-xyz',
    },
    encoding: 'utf8',
    timeout: 10_000,
  });
  assert.equal(rezultat.error, undefined, 'proces nije završio u roku od 10 s');
  assert.notEqual(rezultat.status, 0);
  assert.notEqual(rezultat.status, null);
  assert.match(rezultat.stderr, /PORT/);
  for (const izlaz of [rezultat.stderr, rezultat.stdout]) {
    assert.ok(!izlaz.includes('demo-tajna-xyz'));
    assert.ok(!izlaz.includes('    at '));
  }
});

test('I01-T06 prazna ili samo razmaci VERZIJA_USLOVA → greška koja imenuje VERZIJA_USLOVA (i02/P-4)', () => {
  for (const verzija of ['', '   ']) {
    assert.throws(
      () => ucitajKonfiguraciju({ PORT: '3000', FIREBASE_PROJECT_ID: 'demo-fuelpoints', VERZIJA_USLOVA: verzija, POS_API_KLJUCEVI }),
      (greska) => {
        assert.ok(greska instanceof GreskaKonfiguracije);
        assert.match(greska.message, /VERZIJA_USLOVA/);
        return true;
      },
    );
  }
});

const ISPRAVNO = { PORT: '3000', VERZIJA_USLOVA: '1.0', POS_API_KLJUCEVI };

test('I02-T13 emulator varijabla uz projekat koji ne počinje sa demo- → GreskaKonfiguracije bez vrijednosti', () => {
  const slucajevi = [
    { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' },
    { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
    { FIRESTORE_EMULATOR_HOST: '' },
    { FIREBASE_AUTH_EMULATOR_HOST: '' },
    { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099' },
  ];
  for (const emulator of slucajevi) {
    assert.throws(
      () => ucitajKonfiguraciju({ ...ISPRAVNO, FIREBASE_PROJECT_ID: 'fuelpoints-prod', ...emulator }),
      (greska) => {
        assert.ok(greska instanceof GreskaKonfiguracije);
        assert.match(greska.message, /FIRESTORE_EMULATOR_HOST/);
        assert.match(greska.message, /FIREBASE_AUTH_EMULATOR_HOST/);
        assert.match(greska.message, /FIREBASE_PROJECT_ID/);
        assert.ok(!greska.message.includes('fuelpoints-prod'));
        assert.ok(!greska.message.includes('127.0.0.1:8080'));
        assert.ok(!greska.message.includes('127.0.0.1:9099'));
        return true;
      },
      JSON.stringify(emulator),
    );
  }
});

test('I02-T13 emulator varijable uz demo- projekat i produkcioni projekat bez emulator varijabli → prolazi', () => {
  const saEmulatorom = ucitajKonfiguraciju({
    ...ISPRAVNO,
    FIREBASE_PROJECT_ID: 'demo-fuelpoints',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  });
  assert.equal(saEmulatorom.projectId, 'demo-fuelpoints');
  const produkcija = ucitajKonfiguraciju({ ...ISPRAVNO, FIREBASE_PROJECT_ID: 'fuelpoints-prod' });
  assert.equal(produkcija.projectId, 'fuelpoints-prod');
});

const BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Isti ključ sa posljednjim znakom koji nosi ne-nulte višak-bitove: dekodira se u 32 bajta, ali nije kanonski oblik.
function nekanonskiKljuc() {
  const kljuc = generisiPosKljuc();
  const indeks = BASE64URL.indexOf(kljuc.at(-1));
  return kljuc.slice(0, -1) + BASE64URL[indeks + 1];
}

function placeholderIzEnvPrimjera() {
  const tekst = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
  const linija = tekst.split(/\r?\n/).find((red) => red.startsWith('POS_API_KLJUCEVI='));
  assert.ok(linija !== undefined, '.env.example nema liniju POS_API_KLJUCEVI=');
  return linija.slice('POS_API_KLJUCEVI='.length);
}

function otisak(kljuc) {
  return createHash('sha256').update(kljuc, 'utf8').digest();
}

test('I03-T15 (a) neispravna POS_API_KLJUCEVI → GreskaKonfiguracije koja imenuje varijablu, bez vrijednosti', () => {
  const k1 = generisiPosKljuc();
  const k2 = generisiPosKljuc();
  const nekanonski = nekanonskiKljuc();
  const slucajevi = [
    ['nedostaje', undefined, []],
    ['prazna', '', []],
    ['bez dvotačke', 'SIM01', ['SIM01']],
    ['bez ključa', 'SIM01:', ['SIM01']],
    ['bez stationId', `:${k1}`, [k1]],
    ['prazna stavka na kraju', `SIM01:${k1},`, [k1]],
    ['prazna stavka u sredini', `SIM01:${k1},,SIM02:${k2}`, [k1, k2]],
    ['dvije dvotačke', `SIM01:${k1}:x`, [k1]],
    ['razmak u vrijednosti', `SIM01:${k1}, SIM02:${k2}`, [k1, k2]],
    ['razmak na kraju', `SIM01:${k1} `, [k1]],
    ['ključ od 42 znaka', `SIM01:${k1.slice(0, 42)}`, [k1.slice(0, 42)]],
    ['ključ od 44 znaka', `SIM01:${k1}A`, [k1]],
    ['ključ sa +', `SIM01:${k1.slice(0, 42)}+`, [k1.slice(0, 42)]],
    ['ključ sa /', `SIM01:${k1.slice(0, 42)}/`, [k1.slice(0, 42)]],
    ['ključ sa =', `SIM01:${k1.slice(0, 42)}=`, [k1.slice(0, 42)]],
    ['nekanonski 43. znak', `SIM01:${nekanonski}`, [nekanonski]],
    ['manje od 16 različitih znakova', `SIM01:${'A'.repeat(43)}`, ['A'.repeat(43)]],
    ['ponovljen ključ', `SIM01:${k1},SIM02:${k1}`, [k1]],
    ['ponovljen stationId', `SIM01:${k1},SIM01:${k2}`, [k1, k2]],
    ['stationId sa _', `SIM_01:${k1}`, ['SIM_01', k1]],
    ['stationId sa razmakom', `SIM 01:${k1}`, ['SIM 01', k1]],
    ['stationId sa /', `SIM/01:${k1}`, ['SIM/01', k1]],
    ['stationId od 33 znaka', `${'S'.repeat(33)}:${k1}`, ['S'.repeat(33), k1]],
    ['placeholder iz .env.example', placeholderIzEnvPrimjera(), [placeholderIzEnvPrimjera()]],
  ];
  for (const [opis, vrijednost, tajne] of slucajevi) {
    const env = { PORT: '3000', FIREBASE_PROJECT_ID: 'demo-fuelpoints', VERZIJA_USLOVA: '1.0' };
    if (vrijednost !== undefined) {
      env.POS_API_KLJUCEVI = vrijednost;
    }
    assert.throws(
      () => ucitajKonfiguraciju(env),
      (greska) => {
        assert.ok(greska instanceof GreskaKonfiguracije, opis);
        assert.match(greska.message, /POS_API_KLJUCEVI/, opis);
        for (const tajna of tajne) {
          assert.ok(!greska.message.includes(tajna), `${opis}: poruka sadrži vrijednost`);
        }
        if (vrijednost) {
          assert.ok(!greska.message.includes(vrijednost), `${opis}: poruka sadrži cijelu vrijednost`);
        }
        return true;
      },
      opis,
    );
  }
});

test('I03-T15 (a) ispravna POS_API_KLJUCEVI → posStanice sa stationId i SHA-256 otiskom, bez sirovog ključa', () => {
  const kljucevi = [generisiPosKljuc(), generisiPosKljuc(), generisiPosKljuc()];
  const slucajevi = [
    [['SIM01', kljucevi[0]]],
    [
      ['S', kljucevi[0]],
      ['a.b-C9', kljucevi[1]],
      ['X'.repeat(32), kljucevi[2]],
    ],
  ];
  for (const parovi of slucajevi) {
    const konfiguracija = ucitajKonfiguraciju({
      PORT: '3000',
      FIREBASE_PROJECT_ID: 'demo-fuelpoints',
      VERZIJA_USLOVA: '1.0',
      POS_API_KLJUCEVI: posKonfiguracija(parovi),
    });
    assert.ok(Object.isFrozen(konfiguracija.posStanice));
    assert.deepStrictEqual(
      konfiguracija.posStanice.map((stanica) => Object.keys(stanica)),
      parovi.map(() => ['stationId', 'otisakKljuca']),
    );
    assert.deepStrictEqual(
      konfiguracija.posStanice.map((stanica) => stanica.stationId),
      parovi.map(([stationId]) => stationId),
    );
    for (const [i, [, kljuc]] of parovi.entries()) {
      assert.ok(Object.isFrozen(konfiguracija.posStanice[i]));
      assert.ok(konfiguracija.posStanice[i].otisakKljuca.equals(otisak(kljuc)));
      for (const ispis of [JSON.stringify(konfiguracija), inspect(konfiguracija, { depth: null }), String(konfiguracija.posStanice)]) {
        assert.ok(!ispis.includes(kljuc), 'ispis konfiguracije sadrži sirov ključ');
      }
    }
  }
});
