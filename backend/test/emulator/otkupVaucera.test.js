// POST /api/v1/pos/vouchers/{voucherId}/redeem (§20, §20.1 … §20.5, §26 API-04, §3.4, O-7, O-8, O-24 … O-28):
// API-T08, API-T09, API-T10, I06-T08 … I06-T14.
import assert from 'node:assert/strict';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { otkupiVaucer } from '../../src/servisi/otkupVaucera.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import {
  KLJUCEVI_LEDGER,
  hex64,
  mockSataFajla,
  napraviPripremu,
  provjeriBezInternihDetalja,
  provjeriTijeloGreske,
} from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();
const KLJUCEVI_ODGOVORA = ['voucherId', 'rewardId', 'costPoints', 'status', 'issuedAt', 'expiresAt', 'redeemedAt', 'redeemedAtStationId'];
const KLJUCEVI_ZAPISA = ['createdAt', 'redemptionRequestId', 'resultStatus', 'stationId', 'uid', 'voucherId'];
// O-8 (b): SHA-256 UTF-8 "SIM01:POS-RDM-001" i "SIM02:POS-RDM-001" (plan 3.2 P-c).
const KLJUC_SIM01 = 'aefc7b83dbd1da18def47c0a4965f0e3a40752420325c5a3427b6d47946be20e';
const KLJUC_SIM02 = 'e3ce68ad64e896bbca473a2ea235ab3e9587854153138918f70daca61cfd61d2';
const TS = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 5, 0));
const BEZ_TIJELA = Symbol('bez tijela');
const SERVIS = '/src/servisi/otkupVaucera.js';

const K1 = generisiPosKljuc();
const K2 = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(
  posKonfiguracija([
    ['SIM01', K1],
    ['SIM02', K2],
  ]),
).stanice;

let firebase;
let p;
let brojac = 0;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  p = napraviPripremu(firebase.db);
});

beforeEach(async () => {
  await ocistiEmulatore();
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

function aplikacija(db = firebase.db, posStanice = POS_STANICE) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice });
}

// voucherId je sirov segment putanje. kljuc null → bez X-POS-API-Key. tijelo BEZ_TIJELA → zahtjev bez tijela; string → sirovo.
function otkupi(voucherId, { kljuc = K1, db, app, tijelo = { redemptionRequestId: 'POS-RDM-001' }, upit = '', zaglavlja = {}, metod = 'post' } = {}) {
  const zahtjev = request(app ?? aplikacija(db))[metod](`/api/v1/pos/vouchers/${voucherId}/redeem${upit}`);
  if (kljuc !== null) {
    zahtjev.set('X-POS-API-Key', kljuc);
  }
  for (const [naziv, vrijednost] of Object.entries(zaglavlja)) {
    zahtjev.set(naziv, vrijednost);
  }
  return tijelo === BEZ_TIJELA ? zahtjev : zahtjev.send(tijelo);
}

function noviUid() {
  brojac += 1;
  return `korisnik${brojac}${hex64().slice(0, 8)}`;
}

// Standardni primjer (brief tačka 1): nalog 30 / 50, ACTIVE CAR_WASH V (50, ističe za 10 min) sa konzistentnim RESERVE.
async function standard({ available = 30, reserved = 50, cijena = 50, expiresAtMs = Date.now() + 600_000, accountStatus = 'ACTIVE' } = {}) {
  const uid = noviUid();
  await p.pripremiNalog(uid, available, reserved, accountStatus);
  const V = hex64();
  await p.pripremiVaucer(V, uid, { costPoints: cijena, expiresAtMs });
  await p.pripremiReserve(V, uid, cijena, available, reserved);
  return { uid, V };
}

// Zahtjev kroz omotač: očekivana greška, nijedan pokušan upis, baza nepromijenjena.
async function ocekujBezUpisa(voucherId, status, kod, opis, opcije = {}) {
  const prije = await p.snimakBaze();
  const omotac = omotacBaze(firebase.db);
  const odgovor = await otkupi(voucherId, { db: omotac, ...opcije });
  provjeriTijeloGreske(odgovor, status, kod, opis);
  provjeriBezInternihDetalja(odgovor, opis);
  assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
  assert.deepStrictEqual(await p.snimakBaze(), prije, `${opis}: baza promijenjena`);
  return omotac;
}

// Validacija prije baze: očekivana greška i nijedan pristup bazi.
async function ocekujBezBaze(voucherId, status, kod, opis, opcije = {}) {
  const omotac = omotacBaze(firebase.db);
  const odgovor = await otkupi(voucherId, { db: omotac, ...opcije });
  provjeriTijeloGreske(odgovor, status, kod, opis);
  provjeriBezInternihDetalja(odgovor, opis);
  assert.equal(omotac.brojPristupa, 0, `${opis}: pristup bazi`);
}

function provjeriDogadjaj(dogadjaj, ocekivano, opis) {
  assert.deepStrictEqual(Object.keys(dogadjaj).sort(), KLJUCEVI_LEDGER, `${opis}: polja`);
  const { createdAt, ...ostalo } = dogadjaj;
  assert.ok(createdAt instanceof Timestamp, `${opis}: createdAt nije Timestamp`);
  assert.deepStrictEqual(ostalo, { purchaseId: null, ...ocekivano }, opis);
}

test('API-T08 nalog 30/50, ACTIVE CAR_WASH (50), SIM01, POS-RDM-001 → 200; REDEEMED, nalog 30/0, jedan REWARD_REDEEM i jedan zapis tačnih polja', async () => {
  const { uid, V } = await standard();
  const vaucerPrije = await p.podaci(`vouchers/${V}`);
  const nalogPrije = await p.podaci(`loyaltyAccounts/${uid}`);
  const omotac = omotacBaze(firebase.db);

  const prije = Date.now();
  const odgovor = await otkupi(V, { db: omotac });
  const poslije = Date.now();
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.deepStrictEqual(Object.keys(odgovor.body), KLJUCEVI_ODGOVORA);

  const vaucer = await p.podaci(`vouchers/${V}`);
  assert.ok(vaucer.redeemedAt instanceof Timestamp, 'redeemedAt nije Timestamp');
  const redeemedMs = vaucer.redeemedAt.toMillis();
  assert.ok(redeemedMs >= prije - 5000 && redeemedMs <= poslije + 5000, `redeemedAt van intervala zahtjeva: ${redeemedMs}`);
  assert.deepStrictEqual(
    vaucer,
    { ...vaucerPrije, status: 'REDEEMED', redeemedAt: vaucer.redeemedAt, redeemedAtStationId: 'SIM01' },
    'voucher: izmijenjeno više od status/redeemedAt/redeemedAtStationId',
  );
  assert.equal(vaucer.cancelledAt, null);
  assert.deepStrictEqual(odgovor.body, {
    voucherId: V,
    rewardId: 'CAR_WASH',
    costPoints: 50,
    status: 'REDEEMED',
    issuedAt: vaucerPrije.issuedAt.toDate().toISOString(),
    expiresAt: vaucerPrije.expiresAt.toDate().toISOString(),
    redeemedAt: vaucer.redeemedAt.toDate().toISOString(),
    redeemedAtStationId: 'SIM01',
  });

  const redeem = await p.podaci(`loyaltyLedger/redeem_${V}`);
  assert.ok(redeem, 'redeem_V ne postoji');
  provjeriDogadjaj(
    redeem,
    { uid, type: 'REWARD_REDEEM', deltaAvailable: 0, deltaReserved: -50, availableAfter: 30, reservedAfter: 0, voucherId: V },
    'redeem_V',
  );
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 0);

  const nalogPoslije = await p.podaci(`loyaltyAccounts/${uid}`);
  assert.equal(nalogPoslije.availablePoints, 30, 'availablePoints promijenjen');
  assert.equal(nalogPoslije.reservedPoints, 0);
  assert.deepStrictEqual(nalogPoslije.createdAt, nalogPrije.createdAt, 'createdAt naloga promijenjen');
  assert.deepStrictEqual(nalogPoslije.updatedAt, redeem.createdAt, 'updatedAt naloga ≠ createdAt događaja');

  const zapis = await p.podaci(`redemptionRequests/${KLJUC_SIM01}`);
  assert.ok(zapis, 'zapis redemptionRequests/<SHA-256(SIM01:POS-RDM-001)> ne postoji');
  assert.deepStrictEqual(Object.keys(zapis).sort(), KLJUCEVI_ZAPISA);
  assert.deepStrictEqual(
    { ...zapis, createdAt: undefined },
    { stationId: 'SIM01', uid, redemptionRequestId: 'POS-RDM-001', voucherId: V, resultStatus: 'REDEEMED', createdAt: undefined },
  );
  assert.deepStrictEqual(zapis.createdAt, redeem.createdAt, 'createdAt zapisa ≠ createdAt događaja');
  assert.equal(await p.brojDokumenata('redemptionRequests'), 1);

  assert.deepStrictEqual(omotac.upisi, [
    { metod: 'update', putanja: `vouchers/${V}` },
    { metod: 'create', putanja: `loyaltyLedger/redeem_${V}` },
    { metod: 'update', putanja: `loyaltyAccounts/${uid}` },
    { metod: 'create', putanja: `redemptionRequests/${KLJUC_SIM01}` },
  ]);
});

test('API-T09 isti zahtjev → 200 isto tijelo, 0 upisa; isti ID za drugi voucher → 409 IDEMPOTENCY_CONFLICT; novi ID ili druga stanica → 409 VOUCHER_ALREADY_REDEEMED', async () => {
  const { uid, V } = await standard({ reserved: 80 });
  const W = hex64();
  await p.pripremiVaucer(W, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: Date.now() + 600_000 });
  await p.pripremiReserve(W, uid, 30, 30, 80);
  const prvi = await otkupi(V);
  assert.equal(prvi.status, 200, prvi.text);
  const stanjePoslijePrvog = await p.snimakBaze();

  // (a)
  for (const opis of ['(a) retry 1', '(a) retry 2']) {
    const omotac = omotacBaze(firebase.db);
    const retry = await otkupi(V, { db: omotac });
    assert.equal(retry.status, 200, `${opis}: ${retry.text}`);
    assert.deepStrictEqual(retry.body, prvi.body, `${opis}: tijelo se razlikuje od prvog`);
    assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
    assert.deepStrictEqual(await p.snimakBaze(), stanjePoslijePrvog, `${opis}: stanje promijenjeno`);
  }

  // (b)
  const konflikt = await otkupi(W, { db: omotacBaze(firebase.db) });
  provjeriTijeloGreske(konflikt, 409, 'IDEMPOTENCY_CONFLICT', '(b)');
  assert.ok(!konflikt.text.includes(V) && !konflikt.text.includes(W), '(b) tijelo sadrži voucherId');
  await ocekujBezUpisa(W, 409, 'IDEMPOTENCY_CONFLICT', '(b) bez upisa');
  assert.equal((await p.podaci(`vouchers/${W}`)).status, 'ACTIVE');

  // (c)
  await ocekujBezUpisa(V, 409, 'VOUCHER_ALREADY_REDEEMED', '(c) novi ID', { tijelo: { redemptionRequestId: 'POS-RDM-002' } });

  // (d)
  await ocekujBezUpisa(V, 409, 'VOUCHER_ALREADY_REDEEMED', '(d) SIM02', { kljuc: K2 });
  assert.equal(await p.podaci(`redemptionRequests/${KLJUC_SIM02}`), undefined, '(d) zapis SIM02 postoji');
  assert.equal(await p.brojDokumenata('redemptionRequests'), 1);
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
  assert.deepStrictEqual(await p.snimakBaze(), stanjePoslijePrvog);
});

test('API-T10 istekao ACTIVE (50, nalog 0/50) → 409 VOUCHER_EXPIRED; EXPIRED + REWARD_RELEASE, nalog 50/0, bez zapisa i REDEEM; ponovljen → 409 bez upisa', async () => {
  const { uid, V } = await standard({ available: 0, reserved: 50, expiresAtMs: Date.now() - 60_000 });
  const vaucerPrije = await p.podaci(`vouchers/${V}`);

  const odgovor = await otkupi(V);
  provjeriTijeloGreske(odgovor, 409, 'VOUCHER_EXPIRED', 'prvi');
  assert.deepStrictEqual(await p.podaci(`vouchers/${V}`), { ...vaucerPrije, status: 'EXPIRED' });
  assert.deepStrictEqual(await p.nalog(uid), [50, 0]);
  provjeriDogadjaj(
    await p.podaci(`loyaltyLedger/release_${V}`),
    { uid, type: 'REWARD_RELEASE', deltaAvailable: 50, deltaReserved: -50, availableAfter: 50, reservedAfter: 0, voucherId: V },
    'release_V',
  );
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 1);
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 0);
  assert.equal(await p.brojDokumenata('redemptionRequests'), 0);

  await ocekujBezUpisa(V, 409, 'VOUCHER_EXPIRED', 'ponovljen');
});

test('API-T10 granica u servisu: sadaMs === expiresAt → EXPIRED (409) + release; sadaMs === expiresAt − 1 → REDEEMED sa redeemedAt = sadaMs', async () => {
  for (const [opis, pomak, ocekivano] of [
    ['sadaMs === expiresAt', 0, 'EXPIRED'],
    ['sadaMs === expiresAt − 1', -1, 'REDEEMED'],
  ]) {
    const expiresAtMs = Date.now() + 600_000;
    const { uid, V } = await standard({ expiresAtMs });
    const sadaMs = expiresAtMs + pomak;
    mockSataFajla(mock, SERVIS, () => sadaMs);
    const rezultat = await otkupiVaucer(firebase.db, { stationId: 'SIM01', voucherId: V, redemptionRequestId: 'POS-RDM-001' }, sadaMs + 60_000).then(
      (odgovor) => ({ odgovor }),
      (greska) => ({ greska }),
    );
    mock.restoreAll();
    const vaucer = await p.podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, ocekivano, opis);
    if (ocekivano === 'EXPIRED') {
      assert.ok(rezultat.greska instanceof GreskaApi && rezultat.greska.kod === 'VOUCHER_EXPIRED', `${opis}: ${rezultat.greska ?? 'uspjeh'}`);
      assert.ok(await p.podaci(`loyaltyLedger/release_${V}`), `${opis}: release_V ne postoji`);
      assert.deepStrictEqual(await p.nalog(uid), [80, 0], opis);
      assert.equal(await p.brojDokumenata('redemptionRequests'), 0, opis);
    } else {
      assert.equal(rezultat.greska, undefined, `${opis}: ${rezultat.greska}`);
      assert.equal(vaucer.redeemedAt.toMillis(), sadaMs, `${opis}: redeemedAt`);
      assert.equal(rezultat.odgovor.redeemedAt, new Date(sadaMs).toISOString(), `${opis}: redeemedAt u odgovoru`);
      assert.deepStrictEqual(await p.nalog(uid), [30, 0], opis);
    }
    await ocistiEmulatore();
  }
});

test('I06-T08 tijelo (§20.1, O-1) i voucherId iz putanje (O-22, D-5, AC-04) → 422 / 404 bez pristupa bazi; redoslijed provjera', async () => {
  const { V } = await standard();
  const json = { 'Content-Type': 'application/json' };
  for (const [opis, tijelo, zaglavlja] of [
    ['bez tijela', BEZ_TIJELA, {}],
    ['Content-Length: 0', BEZ_TIJELA, { 'Content-Length': '0' }],
    ['{}', {}, {}],
    ['[]', [], {}],
    ['redemptionRequestId broj', { redemptionRequestId: 5 }, {}],
    ['redemptionRequestId sa :', { redemptionRequestId: 'a:b' }, {}],
    ['65 znakova', { redemptionRequestId: 'a'.repeat(65) }, {}],
    ['dodatno stationId', { redemptionRequestId: 'A', stationId: 'SIM02' }, {}],
    ['dodatno uid', { redemptionRequestId: 'A', uid: 'u' }, {}],
    ['dodatno voucherId', { redemptionRequestId: 'A', voucherId: V }, {}],
    ['text/plain sa ispravnim JSON-om', '{"redemptionRequestId":"A"}', { 'Content-Type': 'text/plain' }],
    ['merge-patch+json', '{"redemptionRequestId":"A"}', { 'Content-Type': 'application/merge-patch+json' }],
    ['null', 'null', json],
    ['skalar "x"', '"x"', json],
    ['broj 5', '5', json],
    ['neispravan JSON', '{"redemptionRequestId":', json],
  ]) {
    await ocekujBezBaze(V, 422, 'INVALID_REQUEST', opis, { tijelo, zaglavlja });
  }
  for (const [opis, tijelo] of [
    ['null bez ključa', 'null'],
    ['"x" bez ključa', '"x"'],
    ['5 bez ključa', '5'],
    ['neispravan JSON bez ključa', '{"a":'],
  ]) {
    await ocekujBezBaze(V, 422, 'INVALID_REQUEST', opis, { tijelo, zaglavlja: json, kljuc: null });
  }

  for (const [opis, segment] of [
    ['velika slova (%41)', `%41${'a'.repeat(63)}`],
    ['63 znaka', 'a'.repeat(63)],
    ['65 znakova', 'a'.repeat(65)],
    ['%2F', 'a%2Fb'],
    ['NUL', `%00${'a'.repeat(63)}`],
    ['__x__', '__x__'],
    ['Firebase UID (AC-04, Customer QR)', 'Xk3bQ9mZ2LrT7vYw1NcE5aPdH0s2'],
    ['..', '%2E%2E'],
  ]) {
    await ocekujBezBaze(segment, 404, 'VOUCHER_NOT_FOUND', opis);
  }
  await ocekujBezBaze('', 404, 'NOT_FOUND', 'prazan voucherId');
  await ocekujBezBaze('%E0%A4%A', 404, 'NOT_FOUND', 'D-5 neispravno percent-kodiran');
  await ocekujBezBaze(V, 404, 'NOT_FOUND', 'GET', { metod: 'get', tijelo: BEZ_TIJELA });
  await ocekujBezBaze(V, 404, 'NOT_FOUND', 'PUT', { metod: 'put' });

  await ocekujBezBaze('a'.repeat(63), 422, 'INVALID_REQUEST', 'redoslijed: tijelo prije voucherId-a', { tijelo: {} });
  await ocekujBezBaze('a'.repeat(63), 401, 'UNAUTHENTICATED_POS', 'redoslijed: ključ prije tijela', { tijelo: {}, kljuc: null });
});

test('I06-T09 POS ključ (§3.4, NFR-02): nedostaje / pogrešan → 401 bez pristupa bazi; stationId isključivo iz ključa; bez konfiguracije → 500', async () => {
  const { uid, V } = await standard();
  const prije = await p.snimakBaze();
  for (const [opis, opcije] of [
    ['bez zaglavlja', { kljuc: null }],
    ['prazan', { kljuc: '' }],
    ['pogrešan iste dužine', { kljuc: generisiPosKljuc() }],
    ['kraći', { kljuc: K1.slice(1) }],
    ['duži', { kljuc: `${K1}A` }],
    ['ključ u Authorization', { kljuc: null, zaglavlja: { Authorization: K1 } }],
    ['ključ u query-ju', { kljuc: null, upit: `?key=${K1}` }],
  ]) {
    await ocekujBezBaze(V, 401, 'UNAUTHENTICATED_POS', opis, opcije);
  }
  assert.deepStrictEqual(await p.snimakBaze(), prije);

  for (const [opis, posStanice] of [
    ['bez posStanice', undefined],
    ['prazna posStanice', []],
  ]) {
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkupi(V, { app: napraviAplikaciju({ servisi: { ...firebase, db: omotac }, verzijaUslova: '1.0', posStanice }) });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', opis);
    provjeriBezInternihDetalja(odgovor, opis);
    assert.equal(omotac.brojPristupa, 0, opis);
  }

  const odgovor = await otkupi(V, { upit: '?stationId=SIM02', zaglavlja: { 'X-Station-Id': 'SIM02' } });
  assert.equal(odgovor.status, 200, odgovor.text);
  assert.equal(odgovor.body.redeemedAtStationId, 'SIM01');
  assert.equal((await p.podaci(`vouchers/${V}`)).redeemedAtStationId, 'SIM01');
  assert.equal((await p.podaci(`redemptionRequests/${KLJUC_SIM01}`)).stationId, 'SIM01');
  assert.equal(await p.brojDokumenata('redemptionRequests'), 1);
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);

  const drugi = await standard();
  const odgovor2 = await otkupi(drugi.V, { kljuc: K2 });
  assert.equal(odgovor2.status, 200, odgovor2.text);
  assert.equal(odgovor2.body.redeemedAtStationId, 'SIM02');
  assert.equal((await p.podaci(`redemptionRequests/${KLJUC_SIM02}`)).stationId, 'SIM02');
});

test('I06-T10 ispravan format, voucher ne postoji → 404 VOUCHER_NOT_FOUND, ništa upisano', async () => {
  await standard();
  await ocekujBezUpisa(hex64(), 404, 'VOUCHER_NOT_FOUND', 'nepostojeći');
  assert.equal(await p.brojDokumenata('redemptionRequests'), 0);
});

test('I06-T11 O-7, §20.4: REDEEMED / CANCELLED / EXPIRED → 409 tačnog koda; status ima prednost nad rokom; ništa upisano', async () => {
  const sada = Date.now();
  for (const [opis, status, opcije, kod] of [
    ['REDEEMED', 'REDEEMED', { redeemedAt: TS, redeemedAtStationId: 'SIM02', expiresAtMs: sada + 600_000 }, 'VOUCHER_ALREADY_REDEEMED'],
    ['CANCELLED', 'CANCELLED', { cancelledAt: TS, expiresAtMs: sada + 600_000 }, 'VOUCHER_CANCELLED'],
    ['EXPIRED', 'EXPIRED', { expiresAtMs: sada - 600_000 }, 'VOUCHER_EXPIRED'],
    ['CANCELLED sa prošlim expiresAt', 'CANCELLED', { cancelledAt: TS, expiresAtMs: sada - 600_000 }, 'VOUCHER_CANCELLED'],
    ['REDEEMED sa prošlim expiresAt', 'REDEEMED', { redeemedAt: TS, redeemedAtStationId: 'SIM01', expiresAtMs: sada - 600_000 }, 'VOUCHER_ALREADY_REDEEMED'],
  ]) {
    const uid = noviUid();
    const V = hex64();
    await p.pripremiVaucer(V, uid, { status, ...opcije });
    await p.pripremiReserve(V, uid, 50, 30, 50);
    if (status === 'REDEEMED') {
      await p.pripremiNalog(uid, 30, 0);
      await p.pripremiRedeem(V, uid, 50, 30, 0);
    } else {
      await p.pripremiNalog(uid, 80, 0);
      await p.pripremiRelease(V, uid, 50, 80, 0);
    }
    await ocekujBezUpisa(V, 409, kod, opis);
    assert.equal(await p.brojDokumenata('redemptionRequests'), 0, opis);
  }
});

test('I06-T12 O-25: nalog se provjerava samo za ACTIVE; DELETION / ne postoji → 409, neispravan → 500; retry uspješnog → 200 bez obzira na nalog i rok', async () => {
  const sada = Date.now();
  // ACTIVE voucher, nalog nije ACTIVE.
  for (const [opis, priprema, status, kod] of [
    ['ACTIVE + DELETION_IN_PROGRESS', { accountStatus: 'DELETION_IN_PROGRESS' }, 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    ['istekao ACTIVE + DELETION_IN_PROGRESS (bez release-a)', { accountStatus: 'DELETION_IN_PROGRESS', expiresAtMs: sada - 60_000 }, 409, 'ACCOUNT_DELETION_IN_PROGRESS'],
    ['accountStatus NEPOZNAT', { accountStatus: 'NEPOZNAT' }, 500, 'INTERNAL_ERROR'],
  ]) {
    const { V } = await standard(priprema);
    await ocekujBezUpisa(V, status, kod, opis);
    assert.equal((await p.podaci(`vouchers/${V}`)).status, 'ACTIVE', opis);
  }
  for (const [opis, izmjena, status, kod] of [
    ['users ne postoji', async (uid) => p.referenca(`users/${uid}`).delete(), 409, 'ACCOUNT_NOT_INITIALIZED'],
    ['loyaltyAccounts ne postoji', async (uid) => p.referenca(`loyaltyAccounts/${uid}`).delete(), 409, 'ACCOUNT_NOT_INITIALIZED'],
    [
      'ni users ni loyaltyAccounts',
      async (uid) => {
        await p.referenca(`users/${uid}`).delete();
        await p.referenca(`loyaltyAccounts/${uid}`).delete();
      },
      409,
      'ACCOUNT_NOT_INITIALIZED',
    ],
    ['reservedPoints -1', async (uid) => p.referenca(`loyaltyAccounts/${uid}`).update({ reservedPoints: -1 }), 500, 'INTERNAL_ERROR'],
    ['reservedPoints "50"', async (uid) => p.referenca(`loyaltyAccounts/${uid}`).update({ reservedPoints: '50' }), 500, 'INTERNAL_ERROR'],
  ]) {
    const { uid, V } = await standard();
    await izmjena(uid);
    await ocekujBezUpisa(V, status, kod, opis);
  }

  // Terminalna stanja + DELETION_IN_PROGRESS → 409 voucher koda (O-25).
  for (const [status, opcije, kod] of [
    ['REDEEMED', { redeemedAt: TS, redeemedAtStationId: 'SIM01' }, 'VOUCHER_ALREADY_REDEEMED'],
    ['CANCELLED', { cancelledAt: TS }, 'VOUCHER_CANCELLED'],
    ['EXPIRED', {}, 'VOUCHER_EXPIRED'],
  ]) {
    const uid = noviUid();
    await p.pripremiNalog(uid, 30, 0, 'DELETION_IN_PROGRESS');
    const V = hex64();
    await p.pripremiVaucer(V, uid, { status, expiresAtMs: sada + 600_000, ...opcije });
    await ocekujBezUpisa(V, 409, kod, `${status} + DELETION_IN_PROGRESS`);
  }

  // Retry uspješnog zahtjeva (O-24) poslije promjene naloga / roka → 200 isto tijelo, ništa upisano.
  for (const [opis, izmjena] of [
    ['nalog u DELETION_IN_PROGRESS', async (uid) => p.referenca(`users/${uid}`).update({ accountStatus: 'DELETION_IN_PROGRESS' })],
    ['users obrisan', async (uid) => p.referenca(`users/${uid}`).delete()],
    ['expiresAt u prošlosti', async (uid, V) => p.referenca(`vouchers/${V}`).update({ expiresAt: Timestamp.fromMillis(sada - 60_000) })],
  ]) {
    const { uid, V } = await standard();
    const prvi = await otkupi(V);
    assert.equal(prvi.status, 200, `${opis}: ${prvi.text}`);
    await izmjena(uid, V);
    const prije = await p.snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const retry = await otkupi(V, { db: omotac });
    assert.equal(retry.status, 200, `${opis}: ${retry.text}`);
    assert.deepStrictEqual(retry.body, { ...prvi.body, expiresAt: retry.body.expiresAt }, opis);
    assert.deepStrictEqual(omotac.upisi, [], opis);
    assert.deepStrictEqual(await p.snimakBaze(), prije, opis);
    await ocistiEmulatore();
  }
});

test('I06-T13 (a) O-24: nekonzistentan zapis za isti voucher → 500, ništa upisano', async () => {
  const zapisRef = () => p.referenca(`redemptionRequests/${KLJUC_SIM01}`);
  for (const [opis, izmjena] of [
    ['stationId SIM02 pod ključem SIM01', () => zapisRef().update({ stationId: 'SIM02' })],
    ['drugi redemptionRequestId', () => zapisRef().update({ redemptionRequestId: 'POS-RDM-002' })],
    ['resultStatus FAILED', () => zapisRef().update({ resultStatus: 'FAILED' })],
    ['uid prazan', () => zapisRef().update({ uid: '' })],
    ['dodatno polje', () => zapisRef().update({ x: 1 })],
    ['voucherId nije 64 hex', () => zapisRef().update({ voucherId: 'X' })],
    ['voucher ne postoji', (V) => p.referenca(`vouchers/${V}`).delete()],
    ['voucher ACTIVE', (V) => p.referenca(`vouchers/${V}`).update({ status: 'ACTIVE', redeemedAt: null, redeemedAtStationId: null })],
    ['voucher REDEEMED na SIM02', (V) => p.referenca(`vouchers/${V}`).update({ redeemedAtStationId: 'SIM02' })],
    ['uid voucher-a ≠ uid zapisa', () => zapisRef().update({ uid: 'drugiKorisnik' })],
    ['voucher REDEEMED bez redeemedAt (O-27)', (V) => p.referenca(`vouchers/${V}`).update({ redeemedAt: null })],
  ]) {
    const { V } = await standard();
    const prvi = await otkupi(V);
    assert.equal(prvi.status, 200, `${opis}: ${prvi.text}`);
    await izmjena(V);
    await ocekujBezUpisa(V, 500, 'INTERNAL_ERROR', opis);
    await ocistiEmulatore();
  }
});

test('I06-T13 (b) O-8 (a): neuspješni pokušaji ne prave zapis, pa isti ID kasnije uspijeva za drugi voucher', async () => {
  const sada = Date.now();
  const uid = noviUid();
  await p.pripremiNalog(uid, 30, 80);
  const W1 = hex64();
  const W2 = hex64();
  const W3 = hex64();
  const V = hex64();
  await p.pripremiVaucer(W1, uid, { status: 'EXPIRED', expiresAtMs: sada - 600_000 });
  await p.pripremiVaucer(W2, uid, { status: 'CANCELLED', cancelledAt: TS, expiresAtMs: sada + 600_000 });
  await p.pripremiVaucer(W3, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: sada - 60_000 });
  await p.pripremiVaucer(V, uid, { expiresAtMs: sada + 600_000 });
  const tijelo = { redemptionRequestId: 'POS-RDM-009' };
  for (const [opis, voucherId, status, kod] of [
    ['EXPIRED W1', W1, 409, 'VOUCHER_EXPIRED'],
    ['CANCELLED W2', W2, 409, 'VOUCHER_CANCELLED'],
    ['nepostojeći', hex64(), 404, 'VOUCHER_NOT_FOUND'],
    ['§20.5 istekao ACTIVE W3', W3, 409, 'VOUCHER_EXPIRED'],
  ]) {
    provjeriTijeloGreske(await otkupi(voucherId, { tijelo }), status, kod, opis);
    assert.equal(await p.brojDokumenata('redemptionRequests'), 0, `${opis}: napravljen zapis`);
  }
  assert.equal((await p.podaci(`vouchers/${W3}`)).status, 'EXPIRED');
  assert.deepStrictEqual(await p.nalog(uid), [60, 50]);
  const uspjeh = await otkupi(V, { tijelo });
  assert.equal(uspjeh.status, 200, uspjeh.text);
  const zapisi = await firebase.db.collection('redemptionRequests').get();
  assert.equal(zapisi.size, 1);
  assert.equal(zapisi.docs[0].get('voucherId'), V);
  assert.deepStrictEqual(await p.nalog(uid), [60, 0]);
  const redeemed = (await firebase.db.collection('vouchers').where('status', '==', 'REDEEMED').get()).size;
  assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
  assert.equal(redeemed, 1, 'invarijanta #zapisa = #REDEEM = #REDEEMED');
});

test('I06-T14 (a), (b), (c) nekonzistentno stanje (O-27, O-28, reservedPoints) → 500 bez stack-a, ništa upisano', async () => {
  const sada = Date.now();
  // (a) O-27 za redeem
  for (const [opis, opcije, bezPolja] of [
    ['ACTIVE sa redeemedAt', { redeemedAt: TS }],
    ['ACTIVE sa redeemedAtStationId', { redeemedAtStationId: 'SIM01' }],
    ['ACTIVE sa cancelledAt', { cancelledAt: TS }],
    ['ACTIVE bez polja redeemedAt', {}, 'redeemedAt'],
    ['REDEEMED bez redeemedAt', { status: 'REDEEMED', redeemedAtStationId: 'SIM01' }],
    ['costPoints 0', { costPoints: 0 }],
  ]) {
    const { V } = await standard();
    await p.referenca(`vouchers/${V}`).update(bezPolja === undefined ? opcije : { [bezPolja]: FieldValue.delete() });
    await ocekujBezUpisa(V, 500, 'INTERNAL_ERROR', `(a) ${opis}`);
  }
  const { V: Vuid } = await standard();
  await p.referenca(`vouchers/${Vuid}`).update({ uid: '' });
  await ocekujBezUpisa(Vuid, 500, 'INTERNAL_ERROR', '(a) uid prazan');

  // (b) redeem_ / release_ postoji a voucher ACTIVE (neistekao i istekao)
  for (const [opis, dogadjaj, expiresAtMs] of [
    ['redeem_ + neistekao', 'redeem', sada + 600_000],
    ['redeem_ + istekao', 'redeem', sada - 60_000],
    ['release_ + neistekao', 'release', sada + 600_000],
    ['release_ + istekao', 'release', sada - 60_000],
  ]) {
    const { uid, V } = await standard({ expiresAtMs });
    if (dogadjaj === 'redeem') {
      await p.pripremiRedeem(V, uid, 50, 30, 0);
    } else {
      await p.pripremiRelease(V, uid, 50, 80, 0);
    }
    await ocekujBezUpisa(V, 500, 'INTERNAL_ERROR', `(b) ${opis}`);
  }

  // (c) reservedPoints 20 < cost 50
  for (const [opis, expiresAtMs] of [
    ['neistekao', sada + 600_000],
    ['istekao', sada - 60_000],
  ]) {
    const { V } = await standard({ reserved: 20 });
    await p.referenca(`vouchers/${V}`).update({ expiresAt: Timestamp.fromMillis(expiresAtMs) });
    await ocekujBezUpisa(V, 500, 'INTERNAL_ERROR', `(c) reservedPoints 20, ${opis}`);
  }
});

test('I06-T14 (d) zastarjelo čitanje: sakriven redeem_V ili zapis drugog voucher-a → tx.create pada (ALREADY_EXISTS) → 500, ništa promijenjeno', async () => {
  // Kontrola: isti omotač bez sakrivanja → 200.
  const kontrola = await standard();
  assert.equal((await otkupi(kontrola.V, { db: omotacBaze(firebase.db), tijelo: { redemptionRequestId: 'KONTROLA' } })).status, 200);

  const { uid, V } = await standard();
  await p.pripremiRedeem(V, uid, 50, 30, 0);
  const redeemPrije = await p.podaci(`loyaltyLedger/redeem_${V}`);
  const prije = await p.snimakBaze();
  const omotac = omotacBaze(firebase.db, { sakrijPostojece: [`loyaltyLedger/redeem_${V}`] });
  const odgovor = await otkupi(V, { db: omotac });
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', 'sakriven redeem_V');
  provjeriBezInternihDetalja(odgovor, 'sakriven redeem_V');
  assert.deepStrictEqual(await p.podaci(`loyaltyLedger/redeem_${V}`), redeemPrije);
  assert.equal((await p.podaci(`vouchers/${V}`)).status, 'ACTIVE');
  assert.deepStrictEqual(await p.snimakBaze(), prije);

  const drugi = await standard();
  const W = hex64();
  await p.referenca(`redemptionRequests/${KLJUC_SIM01}`).set({
    stationId: 'SIM01',
    uid: drugi.uid,
    redemptionRequestId: 'POS-RDM-001',
    voucherId: W,
    resultStatus: 'REDEEMED',
    createdAt: TS,
  });
  const prije2 = await p.snimakBaze();
  const omotac2 = omotacBaze(firebase.db, { sakrijPostojece: [`redemptionRequests/${KLJUC_SIM01}`] });
  const odgovor2 = await otkupi(drugi.V, { db: omotac2 });
  provjeriTijeloGreske(odgovor2, 500, 'INTERNAL_ERROR', 'sakriven zapis');
  assert.equal((await p.podaci(`redemptionRequests/${KLJUC_SIM01}`)).voucherId, W);
  assert.equal((await p.podaci(`vouchers/${drugi.V}`)).status, 'ACTIVE');
  assert.deepStrictEqual(await p.snimakBaze(), prije2);
});
