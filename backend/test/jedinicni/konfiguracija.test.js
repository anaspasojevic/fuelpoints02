import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { GreskaKonfiguracije, ucitajKonfiguraciju } from '../../src/konfiguracija/konfiguracija.js';

const KORIJEN_BACKENDA = fileURLToPath(new URL('../../', import.meta.url));

test('I01-T06 nedostaju PORT i FIREBASE_PROJECT_ID → GreskaKonfiguracije navodi obje varijable', () => {
  assert.throws(
    () => ucitajKonfiguraciju({}),
    (greska) => {
      assert.ok(greska instanceof GreskaKonfiguracije);
      assert.match(greska.message, /PORT/);
      assert.match(greska.message, /FIREBASE_PROJECT_ID/);
      return true;
    },
  );
});

test('I01-T06 neispravan PORT → greška formata bez ispisa vrijednosti', () => {
  assert.throws(
    () => ucitajKonfiguraciju({ PORT: 'TAJNA_VRIJEDNOST_PORT', FIREBASE_PROJECT_ID: 'demo-tajna-xyz' }),
    (greska) => {
      assert.ok(greska instanceof GreskaKonfiguracije);
      assert.match(greska.message, /PORT/);
      assert.ok(!greska.message.includes('TAJNA_VRIJEDNOST_PORT'));
      assert.ok(!greska.message.includes('demo-tajna-xyz'));
      return true;
    },
  );
  for (const port of ['0', '65536', '3000.5', '-1', ' ']) {
    assert.throws(() => ucitajKonfiguraciju({ PORT: port, FIREBASE_PROJECT_ID: 'demo-x' }), GreskaKonfiguracije);
  }
});

test('I01-T06 ispravne vrijednosti → zamrznut objekat konfiguracije', () => {
  const konfiguracija = ucitajKonfiguraciju({ PORT: '3000', FIREBASE_PROJECT_ID: 'demo-fuelpoints' });
  assert.deepStrictEqual(konfiguracija, { port: 3000, projectId: 'demo-fuelpoints', host: '127.0.0.1' });
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
