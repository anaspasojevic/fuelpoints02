import assert from 'node:assert/strict';
import { test } from 'node:test';
import { envProcesa, pokreniBackend, portSlusa, slobodanPort } from '../pomocnici/procesBackenda.js';

const TAJNI_PROJEKAT = 'tajni-prod-xyz';

async function cekajKraj(backend, rokMs) {
  let tajmer;
  const rok = new Promise((razrijesi) => {
    tajmer = setTimeout(() => razrijesi(null), rokMs);
  });
  const rezultat = await Promise.race([backend.zavrsen, rok]);
  clearTimeout(tajmer);
  if (rezultat === null) {
    await backend.zaustavi();
  }
  return rezultat;
}

for (const varijabla of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
  test(`I02-T13 start sa ${varijabla} i projektom bez demo- → izlaz ≠ 0, port nikad ne sluša, bez vrijednosti i stack-a`, async () => {
    const port = await slobodanPort();
    const pocetak = Date.now();
    const backend = pokreniBackend(
      envProcesa({
        PORT: String(port),
        VERZIJA_USLOVA: '1.0',
        FIREBASE_PROJECT_ID: TAJNI_PROJEKAT,
        [varijabla]: '127.0.0.1:8080',
      }),
    );
    const rezultat = await cekajKraj(backend, 10_000);
    assert.notEqual(rezultat, null, 'proces nije završio u roku od 10 s');
    assert.ok(Date.now() - pocetak < 10_000);
    assert.notEqual(rezultat.kod, 0);
    assert.notEqual(rezultat.kod, null);
    assert.match(backend.stderr, /FIREBASE_PROJECT_ID/);
    assert.ok(backend.stderr.includes(varijabla), `stderr ne imenuje ${varijabla}`);
    for (const izlaz of [backend.stderr, backend.stdout]) {
      assert.ok(!izlaz.includes(TAJNI_PROJEKAT), 'izlaz sadrži ID projekta');
      assert.ok(!izlaz.includes('127.0.0.1:8080'), 'izlaz sadrži vrijednost emulator varijable');
      assert.ok(!izlaz.includes('    at '), 'izlaz sadrži stack');
    }
    assert.equal(await portSlusa(port), false, 'port sluša iako je start odbijen');
  });
}
