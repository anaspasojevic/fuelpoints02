import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { GreskaKonfiguracije, ucitajKonfiguraciju } from '../../src/konfiguracija/konfiguracija.js';

const KORIJEN_BACKENDA = fileURLToPath(new URL('../../', import.meta.url));

test('I01-T06 nedostaju PORT, FIREBASE_PROJECT_ID i VERZIJA_USLOVA → GreskaKonfiguracije navodi sve tri varijable', () => {
  assert.throws(
    () => ucitajKonfiguraciju({}),
    (greska) => {
      assert.ok(greska instanceof GreskaKonfiguracije);
      assert.match(greska.message, /PORT/);
      assert.match(greska.message, /FIREBASE_PROJECT_ID/);
      assert.match(greska.message, /VERZIJA_USLOVA/);
      return true;
    },
  );
});

test('I01-T06 neispravan PORT → greška formata bez ispisa vrijednosti', () => {
  assert.throws(
    () => ucitajKonfiguraciju({ PORT: 'TAJNA_VRIJEDNOST_PORT', FIREBASE_PROJECT_ID: 'demo-tajna-xyz', VERZIJA_USLOVA: '1.0' }),
    (greska) => {
      assert.ok(greska instanceof GreskaKonfiguracije);
      assert.match(greska.message, /PORT/);
      assert.ok(!greska.message.includes('TAJNA_VRIJEDNOST_PORT'));
      assert.ok(!greska.message.includes('demo-tajna-xyz'));
      return true;
    },
  );
  for (const port of ['0', '65536', '3000.5', '-1', ' ']) {
    assert.throws(() => ucitajKonfiguraciju({ PORT: port, FIREBASE_PROJECT_ID: 'demo-x', VERZIJA_USLOVA: '1.0' }), GreskaKonfiguracije);
  }
});

test('I01-T06 ispravne vrijednosti → zamrznut objekat konfiguracije', () => {
  const konfiguracija = ucitajKonfiguraciju({ PORT: '3000', FIREBASE_PROJECT_ID: 'demo-fuelpoints', VERZIJA_USLOVA: '1.0' });
  assert.deepStrictEqual(konfiguracija, {
    port: 3000,
    projectId: 'demo-fuelpoints',
    host: '127.0.0.1',
    verzijaUslova: '1.0',
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
      () => ucitajKonfiguraciju({ PORT: '3000', FIREBASE_PROJECT_ID: 'demo-fuelpoints', VERZIJA_USLOVA: verzija }),
      (greska) => {
        assert.ok(greska instanceof GreskaKonfiguracije);
        assert.match(greska.message, /VERZIJA_USLOVA/);
        return true;
      },
    );
  }
});

const ISPRAVNO = { PORT: '3000', VERZIJA_USLOVA: '1.0' };

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
