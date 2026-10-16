import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { jeNedostupnostFirestore, klasifikujGreskuAuth, saRokom } from '../../src/greske/greskeServisa.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';

test('I02-T11 rok zavisnog servisa je 10 s (i02/P-5)', () => {
  assert.equal(ROK_ZAVISNOG_SERVISA_MS, 10_000);
});

test('I02-T11 saRokom: obećanje koje nikad ne završi → GreskaApi SERVICE_UNAVAILABLE za < 1 s', async () => {
  const pocetak = Date.now();
  await assert.rejects(saRokom(new Promise(() => {}), 50), (greska) => {
    assert.ok(greska instanceof GreskaApi);
    assert.equal(greska.kod, 'SERVICE_UNAVAILABLE');
    return true;
  });
  assert.ok(Date.now() - pocetak < 1000);
});

test('I02-T11 saRokom: uspjeh i greška u roku prolaze nepromijenjeni', async () => {
  assert.equal(await saRokom(Promise.resolve(1), 50), 1);
  const izvorna = new Error('izvorna');
  await assert.rejects(saRokom(Promise.reject(izvorna), 50), (greska) => greska === izvorna);
});

test('I02-T11 klasifikujGreskuAuth: token ili korisnik nije važeći → UNAUTHENTICATED', () => {
  for (const kod of [
    'auth/argument-error',
    'auth/invalid-id-token',
    'auth/id-token-expired',
    'auth/id-token-revoked',
    'auth/user-disabled',
    'auth/user-not-found',
  ]) {
    assert.equal(klasifikujGreskuAuth({ code: kod }), 'UNAUTHENTICATED', kod);
  }
});

test('I02-T11 klasifikujGreskuAuth: nedostupnost i istek roka → SERVICE_UNAVAILABLE; ostalo → INTERNAL_ERROR', () => {
  assert.equal(klasifikujGreskuAuth({ code: 'app/network-error' }), 'SERVICE_UNAVAILABLE');
  assert.equal(klasifikujGreskuAuth({ code: 'app/network-timeout' }), 'SERVICE_UNAVAILABLE');
  assert.equal(klasifikujGreskuAuth(new GreskaApi('SERVICE_UNAVAILABLE')), 'SERVICE_UNAVAILABLE');
  for (const greska of [
    { code: 'auth/internal-error' },
    { code: 'app/invalid-credential' },
    { code: 'nepoznat' },
    new Error('bez koda'),
    new GreskaApi('INTERNAL_ERROR'),
    undefined,
    null,
  ]) {
    assert.equal(klasifikujGreskuAuth(greska), 'INTERNAL_ERROR', String(greska?.code ?? greska));
  }
});

test('I02-T11 jeNedostupnostFirestore: UNAVAILABLE (14), DEADLINE_EXCEEDED (4), ABORTED (10) → true; ostalo → false', () => {
  for (const kod of [14, 4, 10]) {
    assert.equal(jeNedostupnostFirestore({ code: kod }), true, String(kod));
  }
  for (const greska of [{ code: 5 }, { code: 7 }, { code: 6 }, { code: '14' }, {}, new Error('x'), undefined, null]) {
    assert.equal(jeNedostupnostFirestore(greska), false, String(greska?.code));
  }
});
