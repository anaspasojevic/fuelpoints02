// I11-T03 (§2.5, §33.2, §34.1, §3.4, §20): POS Simulator (preko server.js) → pravi Backend nad emulatorom.
// API-02 201 pa retry 200, pogrešan ključ 401 UNAUTHENTICATED_POS, API-04 200 pa retry 200, drugi voucher isti
// redemptionRequestId 409 IDEMPOTENCY_CONFLICT; ključ i Authorization ne završavaju u logu.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napraviZahtjevKupovine, napraviZahtjevOtkupa } from '../../../pos-simulator/logika.js';
import { napraviPosSimulator } from '../../../pos-simulator/server.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { hex64, napraviPripremu } from '../pomocnici/pripremaVaucera.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';

const projectId = provjeriTestnoOkruzenje();
const KLJUC = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(posKonfiguracija([['SIM01', KLJUC]])).stanice;
const UUID_1 = '3f2b8c1e-9a4d-4e6b-8c1d-2f3a4b5c6d7e';
const UUID_2 = '9a1c2d3e-4f50-4a6b-9c7d-8e9f0a1b2c3d';

let firebase;
let p;
let backend;
let simulator;
let simulatorUrl;

function slusaj(server) {
  return new Promise((razrijesi) => {
    server.listen(0, '127.0.0.1', () => razrijesi(`http://127.0.0.1:${server.address().port}`));
  });
}

before(async () => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  p = napraviPripremu(firebase.db);
  backend = napraviAplikaciju({ servisi: firebase, verzijaUslova: '1.0', posStanice: POS_STANICE }).listen(0, '127.0.0.1');
  await new Promise((razrijesi) => backend.once('listening', razrijesi));
});

beforeEach(async () => {
  await ocistiEmulatore();
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  backend.close();
  await deleteApp(firebase.app);
});

// Simulator sa vlastitim zapisom loga (log simulatora ne smije sadržati ključ).
async function pokreniSimulator(logSimulatora) {
  simulator = napraviPosSimulator({ backendUrl: `http://127.0.0.1:${backend.address().port}`, log: (red) => logSimulatora.push(red) });
  simulatorUrl = await slusaj(simulator);
}

async function posalji(zahtjev, kljuc = KLJUC) {
  const odgovor = await fetch(`${simulatorUrl}${zahtjev.putanja}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-pos-api-key': kljuc, authorization: 'Bearer SENTINEL_TOKEN_3e8a' },
    body: JSON.stringify(zahtjev.tijelo),
  });
  return { status: odgovor.status, tijelo: await odgovor.json() };
}

test('I11-T03: kupovina i otkup kroz POS Simulator, sa idempotentnim retry-jem i greškama', async () => {
  const log = presretniLog();
  const logSimulatora = [];
  await pokreniSimulator(logSimulatora);
  try {
    const uid = 'korisnikSim1';
    await p.pripremiNalog(uid, 0, 60);

    const kupovina = napraviZahtjevKupovine({
      loyaltyUid: uid,
      posTransactionId: 'SIM-T03-1',
      litri: '42,730',
      iznos: '70,50',
      occurredAt: new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z'),
    });
    const prva = await posalji(kupovina);
    assert.equal(prva.status, 201);
    assert.equal(prva.tijelo.earnedPoints, 42);
    assert.equal(prva.tijelo.stationId, 'SIM01');
    const ponovljena = await posalji(kupovina);
    assert.equal(ponovljena.status, 200);
    assert.deepEqual(ponovljena.tijelo, prva.tijelo);
    assert.deepEqual(await p.nalog(uid), [42, 60]);
    assert.equal(await p.brojDokumenata('purchases'), 1);

    const pogresan = await posalji(kupovina, generisiPosKljuc());
    assert.equal(pogresan.status, 401);
    assert.equal(pogresan.tijelo.error.code, 'UNAUTHENTICATED_POS');

    const V1 = hex64();
    const V2 = hex64();
    const istice = Date.now() + 600_000;
    await p.pripremiVaucer(V1, uid, { costPoints: 30, rewardId: 'SHOWER', expiresAtMs: istice });
    await p.pripremiVaucer(V2, uid, { costPoints: 30, rewardId: 'SHOWER', expiresAtMs: istice });
    await p.pripremiReserve(V1, uid, 30, 0, 30);
    await p.pripremiReserve(V2, uid, 30, 0, 60);

    const otkup = napraviZahtjevOtkupa({ voucherId: V1, redemptionRequestId: UUID_1 });
    const prviOtkup = await posalji(otkup);
    assert.equal(prviOtkup.status, 200);
    assert.equal(prviOtkup.tijelo.status, 'REDEEMED');
    assert.equal(prviOtkup.tijelo.redeemedAtStationId, 'SIM01');
    const ponovljenOtkup = await posalji(otkup);
    assert.equal(ponovljenOtkup.status, 200);
    assert.deepEqual(ponovljenOtkup.tijelo, prviOtkup.tijelo);

    const drugiVaucer = await posalji(napraviZahtjevOtkupa({ voucherId: V2, redemptionRequestId: UUID_1 }));
    assert.equal(drugiVaucer.status, 409);
    assert.equal(drugiVaucer.tijelo.error.code, 'IDEMPOTENCY_CONFLICT');
    assert.equal((await posalji(napraviZahtjevOtkupa({ voucherId: V2, redemptionRequestId: UUID_2 }), KLJUC)).status, 200);

    const sve = `${tekstLoga(log)}\n${logSimulatora.join('\n')}`;
    assert.ok(!sve.includes(KLJUC), 'POS ključ u logu');
    assert.ok(!sve.includes('SENTINEL_TOKEN_3e8a'), 'Authorization u logu');
    assert.ok(!sve.includes(V1) && !sve.includes(V2), 'voucherId u logu');
  } finally {
    simulator.close();
  }
});
