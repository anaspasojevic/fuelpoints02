// I11-T02: ključ se ne čuva ni ne loguje; poslužitelj prosljeđuje samo dvije dozvoljene rute.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import { napraviPosSimulator } from '../server.js';

const SENTINEL_KLJUC = 'SENTINEL_KLJUC_7c41e9';
const SENTINEL_TIJELO = 'SENTINEL_TIJELO_55aa';
const VOUCHER = 'b'.repeat(64);

let lazniBackend;
let simulator;
let simulatorUrl;
const primljeno = [];
const logovi = [];

function slusaj(server) {
  return new Promise((razrijesi) => {
    server.listen(0, '127.0.0.1', () => razrijesi(`http://127.0.0.1:${server.address().port}`));
  });
}

before(async () => {
  lazniBackend = createServer((zahtjev, odgovor) => {
    primljeno.push({ metod: zahtjev.method, url: zahtjev.url, kljuc: zahtjev.headers['x-pos-api-key'] });
    odgovor.writeHead(201, { 'content-type': 'application/json' });
    odgovor.end(JSON.stringify({ ok: true }));
  });
  const backendUrl = await slusaj(lazniBackend);
  simulator = napraviPosSimulator({ backendUrl, log: (red) => logovi.push(red) });
  simulatorUrl = await slusaj(simulator);
});

after(() => {
  simulator.close();
  lazniBackend.close();
});

test('I11-T02: izvori stranice ne čuvaju ključ (bez localStorage, sessionStorage, kolačića, console.) i polje je password', async () => {
  const izvori = [await readFile(new URL('../index.html', import.meta.url), 'utf8'), await readFile(new URL('../logika.js', import.meta.url), 'utf8')];
  for (const izvor of izvori) {
    assert.doesNotMatch(izvor, /localStorage|sessionStorage|document\.cookie|indexedDB|console\./);
  }
  assert.match(izvori[0], /<input id="posKljuc" type="password"/);
});

test('I11-T02: prosljeđuju se samo dvije rute, ostalo je 404 i ne stiže do Backend-a', async () => {
  primljeno.length = 0;
  const kupovina = await fetch(`${simulatorUrl}/api/v1/pos/purchases`, { method: 'POST', headers: { 'x-pos-api-key': SENTINEL_KLJUC }, body: '{}' });
  assert.equal(kupovina.status, 201);
  const otkup = await fetch(`${simulatorUrl}/api/v1/pos/vouchers/${VOUCHER}/redeem`, { method: 'POST', headers: { 'x-pos-api-key': SENTINEL_KLJUC }, body: '{}' });
  assert.equal(otkup.status, 201);
  assert.equal(primljeno.length, 2);
  assert.equal(primljeno[0].kljuc, SENTINEL_KLJUC);

  primljeno.length = 0;
  const nedozvoljeno = [
    ['POST', '/api/v1/account/init'],
    ['POST', '/api/v1/rewards/CAR_WASH/issue'],
    ['GET', '/api/v1/pos/purchases'],
    ['POST', '/api/v1/pos/vouchers/a/b/redeem'],
    ['POST', '/api/v1/pos/purchases/extra'],
    ['DELETE', '/api/v1/account'],
    ['POST', '/'],
  ];
  for (const [metod, putanja] of nedozvoljeno) {
    const odgovor = await fetch(`${simulatorUrl}${putanja}`, { method: metod, headers: { 'x-pos-api-key': SENTINEL_KLJUC }, body: metod === 'POST' ? '{}' : undefined });
    assert.equal(odgovor.status, 404, `${metod} ${putanja}`);
  }
  assert.equal(primljeno.length, 0);
});

test('I11-T02: servira stranicu i logiku', async () => {
  const stranica = await fetch(`${simulatorUrl}/`);
  assert.equal(stranica.status, 200);
  assert.match(await stranica.text(), /FuelPoints POS Simulator/);
  assert.equal((await fetch(`${simulatorUrl}/logika.js`)).status, 200);
  assert.equal((await fetch(`${simulatorUrl}/server.js`)).status, 404);
});

test('I11-T02: log sadrži samo metod, šablon rute i status, nikad ključ, tijelo ni voucherId', async () => {
  logovi.length = 0;
  await fetch(`${simulatorUrl}/api/v1/pos/purchases?kljuc=${SENTINEL_KLJUC}`, {
    method: 'POST',
    headers: { 'x-pos-api-key': SENTINEL_KLJUC, authorization: `Bearer ${SENTINEL_KLJUC}` },
    body: JSON.stringify({ loyaltyUid: SENTINEL_TIJELO }),
  });
  await fetch(`${simulatorUrl}/api/v1/pos/vouchers/${VOUCHER}/redeem`, { method: 'POST', headers: { 'x-pos-api-key': SENTINEL_KLJUC }, body: '{}' });
  await fetch(`${simulatorUrl}/nepoznato/${SENTINEL_TIJELO}`, { method: 'POST', body: '{}' });
  assert.deepEqual(logovi, ['POST /pos/purchases 201', 'POST /pos/vouchers/{voucherId}/redeem 201', 'POST (nepoznata ruta) 404']);
  const log = logovi.join('\n');
  assert.ok(!log.includes(SENTINEL_KLJUC) && !log.includes(SENTINEL_TIJELO) && !log.includes(VOUCHER));
});

test('I11-T02: Backend nedostupan daje 502 sa oznakom simulatora', async () => {
  const slobodan = createServer();
  const nedostupniUrl = await slusaj(slobodan);
  await new Promise((razrijesi) => slobodan.close(razrijesi));
  const lokalniLog = [];
  const drugi = napraviPosSimulator({ backendUrl: nedostupniUrl, log: (red) => lokalniLog.push(red) });
  const url = await slusaj(drugi);
  try {
    const odgovor = await fetch(`${url}/api/v1/pos/purchases`, { method: 'POST', headers: { 'x-pos-api-key': SENTINEL_KLJUC }, body: '{}' });
    assert.equal(odgovor.status, 502);
    assert.deepEqual(await odgovor.json(), { simulator: 'BACKEND_NEDOSTUPAN' });
    assert.deepEqual(lokalniLog, ['POST /pos/purchases 502']);
  } finally {
    drugi.close();
  }
});
