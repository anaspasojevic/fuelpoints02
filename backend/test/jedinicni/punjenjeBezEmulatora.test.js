import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const KORIJEN_BACKENDA = fileURLToPath(new URL('../../', import.meta.url));

// Port na kojem sigurno niko ne sluša: OS dodijeli slobodan port, server se odmah zatvori.
async function slobodanPort() {
  const server = createServer();
  await new Promise((razrijesi) => server.listen(0, '127.0.0.1', razrijesi));
  const { port } = server.address();
  await new Promise((razrijesi) => server.close(razrijesi));
  return port;
}

test('I01-T11 seed CLI kad Firestore emulator nije dostupan → exit 1 za manje od 15 s, poruka o emulatoru, bez stack-a', async () => {
  const emulatorHost = `127.0.0.1:${await slobodanPort()}`;
  const pocetak = Date.now();
  const rezultat = spawnSync(process.execPath, ['skripte/napuniEmulator.js'], {
    cwd: KORIJEN_BACKENDA,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      FIRESTORE_EMULATOR_HOST: emulatorHost,
      FIREBASE_PROJECT_ID: 'demo-fuelpoints',
    },
    encoding: 'utf8',
    timeout: 20_000,
  });
  const trajanje = Date.now() - pocetak;
  assert.equal(rezultat.error, undefined, 'proces nije završio u roku od 20 s');
  assert.ok(trajanje < 15_000, `proces je trajao ${trajanje} ms`);
  assert.equal(rezultat.status, 1);
  assert.match(rezultat.stderr, /emulator/);
  for (const izlaz of [rezultat.stderr, rezultat.stdout]) {
    assert.ok(!izlaz.includes('    at '), 'izlaz sadrži stack');
    assert.ok(!izlaz.includes(emulatorHost), 'izlaz sadrži vrijednost FIRESTORE_EMULATOR_HOST');
    assert.ok(!izlaz.includes('demo-fuelpoints'), 'izlaz sadrži vrijednost FIREBASE_PROJECT_ID');
  }
});
