import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const INTERNA_PORUKA = 'interna tajna poruka C:\\tajno\\putanja\\fajl.js';

afterEach(() => {
  mock.restoreAll();
});

// Utišava i bilježi serverski log da testovi mogu provjeriti šta se loguje.
function presretniLog() {
  return mock.method(console, 'error', () => {});
}

function tekstLoga(presretac) {
  return presretac.mock.calls.map((poziv) => poziv.arguments.map(String).join(' ')).join('\n');
}

function provjeriTijeloGreske(odgovor, status, kod) {
  assert.equal(odgovor.status, status);
  assert.match(odgovor.headers['content-type'], /^application\/json/);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error']);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId']);
  assert.equal(odgovor.body.error.code, kod);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka);
  assert.match(odgovor.body.error.correlationId, UUID_V4);
}

function aplikacijaSaTestRutama() {
  return napraviAplikaciju({
    dodajRute(ruter) {
      ruter.get('/test-greska', () => {
        throw new Error(INTERNA_PORUKA);
      });
      ruter.get('/test-greska-async', async () => {
        await Promise.resolve();
        throw new Error(INTERNA_PORUKA);
      });
    },
  });
}

test('I01-T02 GET /api/v1/nepostojeca → 404 NOT_FOUND sa tačno tri polja', async () => {
  presretniLog();
  const odgovor = await request(napraviAplikaciju()).get('/api/v1/nepostojeca');
  provjeriTijeloGreske(odgovor, 404, 'NOT_FOUND');
});

test('I01-T02 nepodržan metod (DELETE /api/v1) i putanja van /api/v1 (GET /) → 404 NOT_FOUND', async () => {
  presretniLog();
  const aplikacija = napraviAplikaciju();
  provjeriTijeloGreske(await request(aplikacija).delete('/api/v1'), 404, 'NOT_FOUND');
  provjeriTijeloGreske(await request(aplikacija).get('/'), 404, 'NOT_FOUND');
});

test('I01-T03 neispravan JSON ("{") → 422 INVALID_REQUEST bez teksta greške parsera', async () => {
  presretniLog();
  const odgovor = await request(napraviAplikaciju())
    .post('/api/v1/nepostojeca')
    .set('Content-Type', 'application/json')
    .send('{');
  provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST');
  assert.doesNotMatch(odgovor.text, /JSON|position|Unexpected/);
});

test('I01-T03 tijelo veće od limita parsera → 422 INVALID_REQUEST bez teksta greške parsera (P-4)', async () => {
  presretniLog();
  const veliko = JSON.stringify({ podaci: 'x'.repeat(200 * 1024) });
  const odgovor = await request(napraviAplikaciju())
    .post('/api/v1/nepostojeca')
    .set('Content-Type', 'application/json')
    .send(veliko);
  provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST');
  assert.doesNotMatch(odgovor.text, /too large|entity|limit|JSON/i);
});

test('I01-T04 sinhroni i async izuzetak → 500 INTERNAL_ERROR bez stack-a, putanje i originalne poruke', async () => {
  presretniLog();
  const aplikacija = aplikacijaSaTestRutama();
  for (const putanja of ['/api/v1/test-greska', '/api/v1/test-greska-async']) {
    const odgovor = await request(aplikacija).get(putanja);
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR');
    for (const zabranjeno of ['stack', 'interna tajna poruka', 'C:\\', '.js', '    at ']) {
      assert.ok(!odgovor.text.includes(zabranjeno), `odgovor za ${putanja} sadrži "${zabranjeno}"`);
    }
  }
});

test('I01-T04 log sadrži correlationId, a ne sadrži Authorization ni X-POS-API-Key', async () => {
  const presretac = presretniLog();
  const odgovor = await request(aplikacijaSaTestRutama())
    .get('/api/v1/test-greska')
    .set('Authorization', 'Bearer SENTINEL_AUTH_123')
    .set('X-POS-API-Key', 'SENTINEL_POS_456');
  assert.equal(odgovor.status, 500);
  const log = tekstLoga(presretac);
  assert.ok(log.includes(odgovor.body.error.correlationId), 'log ne sadrži correlationId');
  assert.ok(!log.includes('SENTINEL_AUTH_123'), 'log sadrži Authorization');
  assert.ok(!log.includes('SENTINEL_POS_456'), 'log sadrži X-POS-API-Key');
});

test('I01-T04 test rute ne postoje u podrazumijevanoj aplikaciji (bez dodajRute) → 404', async () => {
  presretniLog();
  const aplikacija = napraviAplikaciju();
  provjeriTijeloGreske(await request(aplikacija).get('/api/v1/test-greska'), 404, 'NOT_FOUND');
  provjeriTijeloGreske(await request(aplikacija).get('/api/v1/test-greska-async'), 404, 'NOT_FOUND');
});

test('I01-T05 dva zahtjeva → dva različita correlationId (UUID v4)', async () => {
  presretniLog();
  const aplikacija = napraviAplikaciju();
  const prvi = await request(aplikacija).get('/api/v1/nepostojeca');
  const drugi = await request(aplikacija).get('/api/v1/nepostojeca');
  assert.match(prvi.body.error.correlationId, UUID_V4);
  assert.match(drugi.body.error.correlationId, UUID_V4);
  assert.notEqual(prvi.body.error.correlationId, drugi.body.error.correlationId);
});

test('I01-T05 dolazni X-Correlation-Id se ignoriše', async () => {
  presretniLog();
  const odgovor = await request(napraviAplikaciju())
    .get('/api/v1/nepostojeca')
    .set('X-Correlation-Id', 'zadato');
  assert.notEqual(odgovor.body.error.correlationId, 'zadato');
  assert.match(odgovor.body.error.correlationId, UUID_V4);
});
