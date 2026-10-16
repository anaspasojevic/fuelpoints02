// I03-T01 (a): POS posrednik bez mreže. Poređenje ključa ide kroz sve stanice bez ranog izlaska (i03/P-3):
// broj poziva crypto.timingSafeEqual je uvijek jednak broju stanica.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, mock, test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napraviProvjeruPosKljuca } from '../../src/posrednici/posAutentikacija.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

afterEach(() => {
  mock.restoreAll();
});

const KLJUCEVI = [generisiPosKljuc(), generisiPosKljuc(), generisiPosKljuc()];
const POS_STANICE = procitajPosKljuceve(
  posKonfiguracija([
    ['SIM01', KLJUCEVI[0]],
    ['SIM02', KLJUCEVI[1]],
    ['SIM03', KLJUCEVI[2]],
  ]),
).stanice;

// Poziva posrednik sa datom vrijednošću zaglavlja (undefined → zaglavlje ne postoji).
function pozovi(vrijednost) {
  const req = {
    get(naziv) {
      return naziv.toLowerCase() === 'x-pos-api-key' ? vrijednost : undefined;
    },
  };
  const res = { locals: {} };
  let pozvanNext = false;
  let greska;
  try {
    napraviProvjeruPosKljuca(POS_STANICE)(req, res, () => {
      pozvanNext = true;
    });
  } catch (izuzetak) {
    greska = izuzetak;
  }
  return { res, pozvanNext, greska };
}

test('I03-T01 (a) broj poređenja = broj stanica za pogodak prve, pogodak posljednje, promašaj, prazan i nedostajući ključ', () => {
  const poredjenje = mock.method(crypto, 'timingSafeEqual');
  const slucajevi = [
    ['ključ prve stanice', KLJUCEVI[0], 'SIM01'],
    ['ključ posljednje stanice', KLJUCEVI[2], 'SIM03'],
    ['nepoznat ključ', generisiPosKljuc(), null],
    ['prazan ključ', '', null],
    ['nedostaje', undefined, null],
  ];
  for (const [opis, vrijednost, ocekivanaStanica] of slucajevi) {
    poredjenje.mock.resetCalls();
    const { res, pozvanNext, greska } = pozovi(vrijednost);
    assert.equal(poredjenje.mock.callCount(), POS_STANICE.length, `${opis}: broj poređenja`);
    for (const poziv of poredjenje.mock.calls) {
      assert.equal(poziv.arguments[0].length, 32, `${opis}: poređenje nije nad SHA-256 otiscima`);
      assert.equal(poziv.arguments[1].length, 32, `${opis}: poređenje nije nad SHA-256 otiscima`);
    }
    if (ocekivanaStanica === null) {
      assert.ok(greska instanceof GreskaApi, `${opis}: nije GreskaApi`);
      assert.equal(greska.kod, 'UNAUTHENTICATED_POS', opis);
      assert.equal(pozvanNext, false, opis);
      assert.equal(res.locals.stationId, undefined, opis);
    } else {
      assert.equal(greska, undefined, opis);
      assert.equal(pozvanNext, true, opis);
      assert.equal(res.locals.stationId, ocekivanaStanica, opis);
    }
    assert.ok(Number.isFinite(res.locals.rokDo), `${opis}: rok nije postavljen`);
    assert.deepStrictEqual(Object.keys(res.locals).sort(), ocekivanaStanica === null ? ['rokDo'] : ['rokDo', 'stationId'], opis);
  }
});
