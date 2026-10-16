import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
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
        POS_API_KLJUCEVI: posKonfiguracija([['SIM01', generisiPosKljuc()]]),
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

function placeholderIzEnvPrimjera() {
  const tekst = readFileSync(new URL('../../../.env.example', import.meta.url), 'utf8');
  const linija = tekst.split(/\r?\n/).find((red) => red.startsWith('POS_API_KLJUCEVI='));
  assert.ok(linija !== undefined, '.env.example nema liniju POS_API_KLJUCEVI=');
  return linija.slice('POS_API_KLJUCEVI='.length);
}

// I03-T15 (b): produkcioni start sa neispravnom POS konfiguracijom. Ključ kojem fali jedan znak je inače tajan (sentinel).
const KLJUC_BEZ_ZNAKA = generisiPosKljuc().slice(0, 42);
const NEISPRAVNE_POS_KONFIGURACIJE = [
  ['bez POS_API_KLJUCEVI', undefined],
  ['placeholder iz .env.example', placeholderIzEnvPrimjera()],
  ['ključ kojem fali jedan znak', `SIM01:${KLJUC_BEZ_ZNAKA}`],
];

for (const [opis, vrijednost] of NEISPRAVNE_POS_KONFIGURACIJE) {
  test(`I03-T15 (b) start ${opis} → izlaz ≠ 0, stderr imenuje POS_API_KLJUCEVI, bez vrijednosti i stack-a, port ne sluša`, async () => {
    const port = await slobodanPort();
    const pocetak = Date.now();
    const varijable = { PORT: String(port), VERZIJA_USLOVA: '1.0', FIREBASE_PROJECT_ID: 'demo-fuelpoints' };
    if (vrijednost !== undefined) {
      varijable.POS_API_KLJUCEVI = vrijednost;
    }
    const backend = pokreniBackend(envProcesa(varijable));
    const rezultat = await cekajKraj(backend, 10_000);
    assert.notEqual(rezultat, null, 'proces nije završio u roku od 10 s');
    assert.ok(Date.now() - pocetak < 10_000);
    assert.notEqual(rezultat.kod, 0);
    assert.notEqual(rezultat.kod, null);
    assert.match(backend.stderr, /POS_API_KLJUCEVI/);
    for (const izlaz of [backend.stderr, backend.stdout]) {
      if (vrijednost !== undefined) {
        assert.ok(!izlaz.includes(vrijednost), 'izlaz sadrži vrijednost POS_API_KLJUCEVI');
      }
      assert.ok(!izlaz.includes(KLJUC_BEZ_ZNAKA), 'izlaz sadrži ključ');
      assert.ok(!izlaz.includes('    at '), 'izlaz sadrži stack');
    }
    assert.equal(await portSlusa(port), false, 'port sluša iako je start odbijen');
  });
}
