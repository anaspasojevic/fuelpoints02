// I04-T03 (c), D-5 (i04/P-8): neispravno percent-kodiran parametar putanje → 404 NOT_FOUND (O-1), bez stack-a i bez sirove
// vrijednosti u logu (svi kanali) i odgovoru; globalno, za svaku rutu sa parametrom. Stvaran redoslijed: neispravan JSON (422) → D-5 (404).
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SENTINEL = 'SENTINEL_D5_7c41e09b';
const ZABRANJENO_U_LOGU = ['%E0%A4%A', '%ZZ', SENTINEL, 'Failed to decode', 'URIError'];

afterEach(() => {
  mock.restoreAll();
});

function provjeriTijeloGreske(odgovor, status, kod, opis) {
  assert.equal(odgovor.status, status, `${opis}: status (tijelo ${odgovor.text})`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
}

// Svi JSON zapisi loga grešaka sa datim correlationId-em.
function zapisiLoga(log, correlationId) {
  const zapisi = [];
  for (const linija of log.split('\n')) {
    try {
      const zapis = JSON.parse(linija);
      if (zapis?.correlationId === correlationId) {
        zapisi.push(zapis);
      }
    } catch {
      // linija koja nije JSON zapis greške
    }
  }
  return zapisi;
}

function aplikacijaSaTestRutom() {
  return napraviAplikaciju({
    dodajRute(ruter) {
      ruter.post('/test/:id', (req, res) => {
        res.json({ id: req.params.id });
      });
      ruter.get('/test-urierror', () => {
        throw new URIError('interna poruka C:\\tajno\\x.js');
      });
    },
  });
}

// Zahtjevi sa neispravno percent-kodiranim parametrom (metod, putanja).
const NEISPRAVNO_KODIRANI = [
  ['post', '/api/v1/test/%E0%A4%A'],
  ['get', '/api/v1/test/%E0%A4%A'],
  ['post', '/api/v1/test/%ZZ'],
  ['post', `/api/v1/test/${SENTINEL}%E0`],
];

async function provjeriD5(app, zahtjevi) {
  for (const [metod, putanja] of zahtjevi) {
    const opis = `${metod.toUpperCase()} ${putanja}`;
    const zapisi = presretniLog();
    const odgovor = await request(app)[metod](putanja).set('Content-Type', 'application/json').send('{"a":1}');
    const log = tekstLoga(zapisi);
    mock.restoreAll();

    provjeriTijeloGreske(odgovor, 404, 'NOT_FOUND', opis);
    const tekstOdgovora = `${odgovor.text}\n${JSON.stringify(odgovor.headers)}`;
    for (const zabranjeno of [...ZABRANJENO_U_LOGU, 'stack', '    at ']) {
      assert.ok(!tekstOdgovora.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
    }
    const zapisiZahtjeva = zapisiLoga(log, odgovor.body.error.correlationId);
    assert.equal(zapisiZahtjeva.length, 1, `${opis}: broj zapisa u logu`);
    const [zapis] = zapisiZahtjeva;
    assert.equal(zapis.code, 'NOT_FOUND', `${opis}: kod u logu`);
    assert.equal(zapis.status, 404, `${opis}: status u logu`);
    assert.equal(zapis.putanja, '(nepoznata ruta)', `${opis}: putanja u logu`);
    assert.ok(!Object.hasOwn(zapis, 'stack'), `${opis}: log sadrži stack`);
    for (const zabranjeno of ZABRANJENO_U_LOGU) {
      assert.ok(!log.includes(zabranjeno), `${opis}: log sadrži "${zabranjeno}"`);
    }
  }
}

test('I04-T03 (c) D-5: neispravno percent-kodiran parametar test rute → 404 NOT_FOUND, log bez stack-a i sirove vrijednosti', async () => {
  await provjeriD5(aplikacijaSaTestRutom(), NEISPRAVNO_KODIRANI);
});

test('I04-T03 (c) D-5: neispravno percent-kodiran rewardId na produkcionoj ruti API-03 → 404 NOT_FOUND, log bez stack-a i sirove vrijednosti', async () => {
  await provjeriD5(napraviAplikaciju(), [
    ['post', '/api/v1/rewards/%E0%A4%A/issue'],
    ['get', '/api/v1/rewards/%E0%A4%A/issue'],
    ['post', '/api/v1/rewards/%ZZ/issue'],
    ['post', `/api/v1/rewards/${SENTINEL}%E0/issue`],
  ]);
});

test('I04-T03 (c) D-5 (proširenje ulaza, i05): neispravno percent-kodiran voucherId na ruti API-05 → 404 NOT_FOUND, log bez stack-a i sirove vrijednosti', async () => {
  await provjeriD5(napraviAplikaciju(), [
    ['post', '/api/v1/vouchers/%E0%A4%A/cancel'],
    ['get', '/api/v1/vouchers/%E0%A4%A/cancel'],
    ['post', '/api/v1/vouchers/%ZZ/cancel'],
    ['post', `/api/v1/vouchers/${SENTINEL}%E0/cancel`],
  ]);
});

test('I04-T03 (c) D-5: neispravan JSON uz neispravno kodiran rewardId produkcione rute → 422 INVALID_REQUEST (i04/P-8)', async () => {
  presretniLog();
  const odgovor = await request(napraviAplikaciju())
    .post('/api/v1/rewards/%E0%A4%A/issue')
    .set('Content-Type', 'application/json')
    .send('{neispravan');
  provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', 'neispravan JSON + D-5 na API-03');
});

test('I04-T03 (c) D-5: neispravan JSON uz neispravno kodiran parametar → 422 INVALID_REQUEST (stvaran redoslijed, i04/P-8)', async () => {
  presretniLog();
  const odgovor = await request(aplikacijaSaTestRutom())
    .post('/api/v1/test/%E0%A4%A')
    .set('Content-Type', 'application/json')
    .send('{neispravan');
  provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', 'neispravan JSON + D-5');
});

test('I04-T03 (c) kontrola: ispravno kodiran parametar pogađa rutu; URIError bez status 400 iz rute → 500 (ostale greške nepromijenjene)', async () => {
  presretniLog();
  const app = aplikacijaSaTestRutom();
  const ispravan = await request(app).post('/api/v1/test/%C4%8D').send({});
  assert.equal(ispravan.status, 200);
  assert.deepStrictEqual(ispravan.body, { id: 'č' });
  provjeriTijeloGreske(await request(app).get('/api/v1/test-urierror'), 500, 'INTERNAL_ERROR', 'URIError iz rute');
});
