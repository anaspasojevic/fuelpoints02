// Atomičnost, idempotentnost pod greškama i konkurentnost otkupa (NFR-04, NFR-05, NFR-06, AC-07, AC-08, AC-09, §6 (b), (c), (j)):
// I06-T15 … I06-T20. Deterministički redoslijed (I06-T18) nameće omotacBaze.prijePokusaja (i06/P-7), ne tajming.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { otkupiVaucer } from '../../src/servisi/otkupVaucera.js';
import { jeKonzistentnoStanjeVaucera } from '../../src/servisi/vauceri.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import {
  VRIJEME_PRIPREME,
  hex64,
  mockSataFajla,
  napraviPripremu,
  provjeriBezInternihDetalja,
  provjeriTijeloGreske,
} from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();
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
  await napuniRewardDefinitions(firebase.db);
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

function aplikacija(db = firebase.db) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice: POS_STANICE });
}

function otkupi(voucherId, { kljuc = K1, db, redemptionRequestId = 'POS-RDM-001' } = {}) {
  return request(aplikacija(db)).post(`/api/v1/pos/vouchers/${voucherId}/redeem`).set('X-POS-API-Key', kljuc).send({ redemptionRequestId });
}

function otkazi(voucherId, token, db) {
  return request(aplikacija(db)).post(`/api/v1/vouchers/${voucherId}/cancel`).set('Authorization', `Bearer ${token}`);
}

function uskladi(token, db) {
  return request(aplikacija(db)).post('/api/v1/account/vouchers/reconcile').set('Authorization', `Bearer ${token}`);
}

function izdaj(rewardId, token, db) {
  return request(aplikacija(db)).post(`/api/v1/rewards/${rewardId}/issue`).set('Authorization', `Bearer ${token}`).send({ requestId: randomUUID() });
}

function kupi(uid, bodovi, posTransactionId) {
  return request(aplikacija())
    .post('/api/v1/pos/purchases')
    .set('X-POS-API-Key', K1)
    .send({
      loyaltyUid: uid,
      posTransactionId,
      volumeMl: bodovi * 1000 + 500,
      amountMinor: 100,
      currency: 'EUR',
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
    });
}

async function korisnik() {
  brojac += 1;
  return napraviKorisnika(`otkupatomicnost${brojac}${hex64().slice(0, 6)}@primjer.test`);
}

// Nalog + ACTIVE voucher-i sa konzistentnim RESERVE (bez Auth korisnika, osim ako je uid zadat).
async function pripremi({ uid, available = 30, reserved = 50, vauceri = [{ cijena: 50, expiresAtMs: Date.now() + 600_000 }] } = {}) {
  brojac += 1;
  const vlasnik = uid ?? `korisnik${brojac}${hex64().slice(0, 8)}`;
  await p.pripremiNalog(vlasnik, available, reserved);
  const id = [];
  for (const { cijena, expiresAtMs } of vauceri) {
    const V = hex64();
    await p.pripremiVaucer(V, vlasnik, { costPoints: cijena, rewardId: cijena === 50 ? 'CAR_WASH' : 'SHOWER', expiresAtMs });
    await p.pripremiReserve(V, vlasnik, cijena, available, reserved);
    id.push(V);
  }
  return { uid: vlasnik, V: id[0], id };
}

async function dogadjajiKorisnika(uid) {
  return (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Lanac availableAfter / reservedAfter (§11): počev od pocetno, svaki događaj nastavlja tačno stanje prethodnog; kraj = nalog.
// Redoslijed transakcija daje createdAt (jedan serverTimestamp po transakciji = vrijeme commit-a); unutar iste transakcije (isti
// createdAt) događaji se nižu po stanju. Pripremljeni događaji (createdAt = VRIJEME_PRIPREME) su prije početnog stanja.
async function provjeriLanac(uid, pocetno, opis) {
  const dogadjaji = (await dogadjajiKorisnika(uid))
    .filter((d) => !d.createdAt.isEqual(VRIJEME_PRIPREME))
    .sort((x, y) => x.createdAt.toMillis() - y.createdAt.toMillis() || x.createdAt.nanoseconds - y.createdAt.nanoseconds);
  let [a, r] = pocetno;
  while (dogadjaji.length > 0) {
    const grupa = dogadjaji.filter((d) => d.createdAt.isEqual(dogadjaji[0].createdAt));
    while (grupa.length > 0) {
      const i = grupa.findIndex((d) => d.availableAfter - d.deltaAvailable === a && d.reservedAfter - d.deltaReserved === r);
      const opisGrupe = grupa.map((d) => `${d.type} Δ(${d.deltaAvailable}, ${d.deltaReserved}) → (${d.availableAfter}, ${d.reservedAfter})`);
      assert.ok(i >= 0, `${opis}: lanac prekinut kod (${a}, ${r}); transakcija: ${opisGrupe.join('; ')}`);
      const [d] = grupa.splice(i, 1);
      dogadjaji.splice(dogadjaji.indexOf(d), 1);
      assert.ok(d.availableAfter >= 0 && d.reservedAfter >= 0, `${opis}: vrijednost < 0`);
      [a, r] = [d.availableAfter, d.reservedAfter];
    }
  }
  assert.deepStrictEqual(await p.nalog(uid), [a, r], `${opis}: nalog ≠ kraj lanca`);
}

async function brojZapisa() {
  return p.brojDokumenata('redemptionRequests');
}

// Ponavlja zahtjev dok je 503 (najviše 20 puta); vraća posljednji odgovor.
async function doKrajaBez503(zahtjev) {
  let odgovor = await zahtjev();
  for (let i = 0; i < 20 && odgovor.status === 503; i += 1) {
    odgovor = await zahtjev();
  }
  return odgovor;
}

test('I06-T15 failure injection na svakom upisu i prije commit-a (uspjeh i §20.5) → 500 bez stack-a, stanje identično početnom', async () => {
  for (const [opis, expiresAtMs, upisi, kontrola] of [
    ['(a) otkup', Date.now() + 600_000, 4, 200],
    ['(b) §20.5', Date.now() - 60_000, 3, 409],
  ]) {
    for (const opcije of [...Array.from({ length: upisi }, (_, i) => ({ baciNaUpisu: i + 1 })), { baciPrijeCommita: true }]) {
      const { V } = await pripremi({ vauceri: [{ cijena: 50, expiresAtMs }] });
      const prije = await p.snimakBaze();
      const omotac = omotacBaze(firebase.db, opcije);
      const odgovor = await otkupi(V, { db: omotac });
      const oznaka = `${opis} ${JSON.stringify(opcije)}`;
      provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', oznaka);
      provjeriBezInternihDetalja(odgovor, oznaka);
      assert.deepStrictEqual(await p.snimakBaze(), prije, `${oznaka}: stanje promijenjeno`);
      if (opcije.baciNaUpisu !== undefined) {
        assert.equal(omotac.upisi.length, opcije.baciNaUpisu, oznaka);
      }
      await ocistiEmulatore();
    }
    const { V } = await pripremi({ vauceri: [{ cijena: 50, expiresAtMs }] });
    const omotac = omotacBaze(firebase.db);
    const odgovor = await otkupi(V, { db: omotac });
    assert.equal(odgovor.status, kontrola, `${opis} kontrola: ${odgovor.text}`);
    assert.equal(omotac.upisi.length, upisi, `${opis} kontrola: broj upisa`);
    if (upisi === 3) {
      assert.deepStrictEqual(
        omotac.upisi.map((u) => u.putanja.split('/')[0]),
        ['vouchers', 'loyaltyLedger', 'loyaltyAccounts'],
        `${opis}: redoslijed upisa`,
      );
    }
    await ocistiEmulatore();
  }
});

test('I06-T16 (a), (b) kasni commit poslije 503 + retry istim ID-em → isti ishod jednom (200 isto tijelo / 409 EXPIRED)', async () => {
  for (const [opis, expiresAtMs] of [
    ['(a) otkup', Date.now() + 600_000],
    ['(b) §20.5', Date.now() - 60_000],
  ]) {
    const { uid, V } = await pripremi({ vauceri: [{ cijena: 50, expiresAtMs }] });
    const omotac = omotacBaze(firebase.db, { zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500 });
    const prvi = await otkupi(V, { db: omotac });
    provjeriTijeloGreske(prvi, 503, 'SERVICE_UNAVAILABLE', opis);
    await omotac.commitZavrsen;
    const retry1 = await otkupi(V);
    const retry2 = await otkupi(V);
    if (opis === '(a) otkup') {
      const vaucer = await p.podaci(`vouchers/${V}`);
      assert.equal(vaucer.status, 'REDEEMED', opis);
      assert.equal(retry1.status, 200, `${opis}: ${retry1.text}`);
      assert.equal(retry1.body.redeemedAt, vaucer.redeemedAt.toDate().toISOString(), opis);
      assert.deepStrictEqual(retry2.body, retry1.body, opis);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1, opis);
      assert.equal(await brojZapisa(), 1, opis);
      assert.deepStrictEqual(await p.nalog(uid), [30, 0], opis);
    } else {
      provjeriTijeloGreske(retry1, 409, 'VOUCHER_EXPIRED', opis);
      provjeriTijeloGreske(retry2, 409, 'VOUCHER_EXPIRED', opis);
      assert.equal((await p.podaci(`vouchers/${V}`)).status, 'EXPIRED', opis);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 1, opis);
      assert.equal(await brojZapisa(), 0, opis);
      assert.deepStrictEqual(await p.nalog(uid), [80, 0], opis);
    }
    await ocistiEmulatore();
  }
});

test('I06-T16 (c), (d) istekao rok prije transakcije → 503 bez ijednog pristupa bazi; UNAVAILABLE → 503 bez upisa', async () => {
  const { V } = await pripremi();
  for (const [opis, rokDo] of [
    ['rok − 1 ms', () => Date.now() - 1],
    ['rok = sada', () => Date.now()],
    ['undefined', () => undefined],
    ['NaN', () => Number.NaN],
  ]) {
    const omotac = omotacBaze(firebase.db);
    await assert.rejects(
      otkupiVaucer(omotac, { stationId: 'SIM01', voucherId: V, redemptionRequestId: 'POS-RDM-001' }, rokDo()),
      (greska) => greska instanceof GreskaApi && greska.kod === 'SERVICE_UNAVAILABLE',
      opis,
    );
    assert.equal(omotac.brojTransakcija, 0, opis);
    assert.equal(omotac.brojPristupa, 0, opis);
  }
  const prije = await p.snimakBaze();
  const omotac = omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } });
  const odgovor = await otkupi(V, { db: omotac });
  provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', '(d)');
  provjeriBezInternihDetalja(odgovor, '(d)');
  assert.deepStrictEqual(await p.snimakBaze(), prije, '(d)');

  const kontrola = await otkupiVaucer(firebase.db, { stationId: 'SIM01', voucherId: V, redemptionRequestId: 'POS-RDM-001' }, Date.now() + 10_000);
  assert.equal(kontrola.status, 'REDEEMED', 'kontrola');
});

test('I06-T17 sadaMs se čita na početku svakog pokušaja: voucher istekao između pokušaja → 409 EXPIRED; redeemedAt iz posljednjeg pokušaja', async () => {
  for (const [opis, pomakIsteka] of [
    ['istek između pokušaja', 15_000],
    ['bez isteka', 600_000],
  ]) {
    const T0 = Date.now();
    const { uid, V } = await pripremi({ vauceri: [{ cijena: 50, expiresAtMs: T0 + pomakIsteka }] });
    const ocitano = mockSataFajla(mock, SERVIS, (n) => T0 + 10_000 * n);
    const omotac = omotacBaze(firebase.db, { prisiliPonovniPokusaj: 1 });
    const rezultat = await otkupiVaucer(omotac, { stationId: 'SIM01', voucherId: V, redemptionRequestId: 'POS-RDM-001' }, T0 + 60_000).then(
      (odgovor) => ({ odgovor }),
      (greska) => ({ greska }),
    );
    mock.restoreAll();
    assert.deepStrictEqual(ocitano, [T0, T0 + 10_000, T0 + 20_000], `${opis}: čitanja sata (ulaz + po pokušaju)`);
    assert.equal(omotac.brojPokusaja, 2, opis);
    const vaucer = await p.podaci(`vouchers/${V}`);
    if (pomakIsteka === 15_000) {
      assert.ok(rezultat.greska instanceof GreskaApi && rezultat.greska.kod === 'VOUCHER_EXPIRED', `${opis}: ${rezultat.greska ?? 'uspjeh'}`);
      assert.equal(vaucer.status, 'EXPIRED', opis);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 1, opis);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 0, opis);
      assert.equal(await brojZapisa(), 0, opis);
    } else {
      assert.equal(rezultat.greska, undefined, `${opis}: ${rezultat.greska}`);
      assert.equal(vaucer.redeemedAt.toMillis(), T0 + 20_000, `${opis}: redeemedAt iz posljednjeg pokušaja`);
    }
    await ocistiEmulatore();
  }
});

// Svaki slučaj počinje od prazne baze (isti redemptionRequestId u više slučajeva bi inače bio O-24 konflikt).
async function novoStanje() {
  await ocistiEmulatore();
  await napuniRewardDefinitions(firebase.db);
}

// Glavna operacija ide kroz omotač { prisiliPonovniPokusaj: 1, prijePokusaja }: pokušaj 1 čita i prisilno se poništava, pa se druga
// operacija izvrši DO KRAJA nad pravim db, pa pokušaj 2 čita novo stanje. Jedno izvršavanje po slučaju (deterministički).
function redoslijed(druga) {
  return {
    prisiliPonovniPokusaj: 1,
    prijePokusaja: async (pokusaj) => {
      if (pokusaj === 2) {
        await druga();
      }
    },
  };
}

test('I06-T18 deterministički redoslijed (i05/K-1): redeem × cancel, cancel × redeem, redeem × redeem, redeem × API-06 / issue, zastarjeli nalog, O-26', async () => {
  // Kontrola (i06/P-7): isti omotač bez prijePokusaja → otkup uspijeva u drugom pokušaju.
  {
    const { V } = await pripremi();
    const omotac = omotacBaze(firebase.db, { prisiliPonovniPokusaj: 1 });
    const odgovor = await otkupi(V, { db: omotac });
    assert.equal(odgovor.status, 200, `kontrola: ${odgovor.text}`);
    assert.equal(omotac.brojPokusaja, 2, 'kontrola: broj pokušaja');
  }

  // (a) redeem ← cancel
  await novoStanje();
  {
    const { uid, idToken } = await korisnik();
    const { V } = await pripremi({ uid });
    const druga = () => otkazi(V, idToken);
    let cancel;
    const odgovor = await otkupi(V, { db: omotacBaze(firebase.db, redoslijed(async () => (cancel = await druga()))) });
    assert.equal(cancel.status, 200, `(a) cancel: ${cancel.text}`);
    provjeriTijeloGreske(odgovor, 409, 'VOUCHER_CANCELLED', '(a)');
    assert.equal((await p.podaci(`vouchers/${V}`)).status, 'CANCELLED');
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 1);
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 0);
    assert.equal(await brojZapisa(), 0);
    assert.deepStrictEqual(await p.nalog(uid), [80, 0]);
  }

  // (b) cancel ← redeem
  await novoStanje();
  {
    const { uid, idToken } = await korisnik();
    const { V } = await pripremi({ uid });
    let otkup;
    const odgovor = await otkazi(V, idToken, omotacBaze(firebase.db, redoslijed(async () => (otkup = await otkupi(V)))));
    assert.equal(otkup.status, 200, `(b) redeem: ${otkup.text}`);
    provjeriTijeloGreske(odgovor, 409, 'VOUCHER_ALREADY_REDEEMED', '(b)');
    assert.equal((await p.podaci(`vouchers/${V}`)).status, 'REDEEMED');
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 0);
    assert.deepStrictEqual(await p.nalog(uid), [30, 0]);
  }

  // (c) redeem SIM01 "A" ← redeem SIM02 "B"
  await novoStanje();
  {
    const { uid, V } = await pripremi();
    let drugi;
    const odgovor = await otkupi(V, {
      redemptionRequestId: 'A',
      db: omotacBaze(firebase.db, redoslijed(async () => (drugi = await otkupi(V, { kljuc: K2, redemptionRequestId: 'B' })))),
    });
    assert.equal(drugi.status, 200, `(c) SIM02: ${drugi.text}`);
    provjeriTijeloGreske(odgovor, 409, 'VOUCHER_ALREADY_REDEEMED', '(c)');
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
    const zapisi = await firebase.db.collection('redemptionRequests').get();
    assert.equal(zapisi.size, 1);
    assert.equal(zapisi.docs[0].get('stationId'), 'SIM02');
    assert.deepStrictEqual(await p.nalog(uid), [30, 0]);
  }

  // (d) redeem "A" ← isti redeem "A"
  await novoStanje();
  {
    const { uid, V } = await pripremi();
    let drugi;
    const odgovor = await otkupi(V, { db: omotacBaze(firebase.db, redoslijed(async () => (drugi = await otkupi(V)))) });
    assert.equal(drugi.status, 200, `(d) drugi: ${drugi.text}`);
    assert.equal(odgovor.status, 200, `(d) prvi: ${odgovor.text}`);
    assert.deepStrictEqual(odgovor.body, drugi.body, '(d) tijela se razlikuju');
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
    assert.equal(await brojZapisa(), 1);
  }

  // (e) istekao V: redeem ← API-06; redeem ← issue SHOWER (reconcile V)
  await novoStanje();
  for (const [opis, druga, ocekivanStatus] of [
    ['API-06', uskladi, 200],
    ['issue SHOWER', (token) => izdaj('SHOWER', token), 201],
  ]) {
    await novoStanje();
    const { uid, idToken } = await korisnik();
    const { V } = await pripremi({ uid, available: 0, reserved: 50, vauceri: [{ cijena: 50, expiresAtMs: Date.now() - 60_000 }] });
    let rezultatDruge;
    const odgovor = await otkupi(V, { db: omotacBaze(firebase.db, redoslijed(async () => (rezultatDruge = await druga(idToken)))) });
    assert.equal(rezultatDruge.status, ocekivanStatus, `(e) ${opis}: ${rezultatDruge.text}`);
    provjeriTijeloGreske(odgovor, 409, 'VOUCHER_EXPIRED', `(e) ${opis}`);
    assert.equal((await p.podaci(`vouchers/${V}`)).status, 'EXPIRED');
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 1, `(e) ${opis}: broj RELEASE`);
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 0);
    assert.equal(await brojZapisa(), 0);
    await provjeriLanac(uid, [0, 50], `(e) ${opis}`);
  }

  // (f) zastarjeli nalog: redeem V1 ← redeem V2
  await novoStanje();
  {
    const { uid, id } = await pripremi({
      available: 0,
      reserved: 80,
      vauceri: [
        { cijena: 50, expiresAtMs: Date.now() + 600_000 },
        { cijena: 30, expiresAtMs: Date.now() + 600_000 },
      ],
    });
    const [V1, V2] = id;
    let drugi;
    const odgovor = await otkupi(V1, {
      redemptionRequestId: 'R1',
      db: omotacBaze(firebase.db, redoslijed(async () => (drugi = await otkupi(V2, { redemptionRequestId: 'R2' })))),
    });
    assert.equal(drugi.status, 200, `(f) V2: ${drugi.text}`);
    assert.equal(odgovor.status, 200, `(f) V1: ${odgovor.text}`);
    assert.deepStrictEqual(await p.nalog(uid), [0, 0]);
    assert.equal((await p.podaci(`loyaltyLedger/redeem_${V2}`)).reservedAfter, 50);
    assert.equal((await p.podaci(`loyaltyLedger/redeem_${V1}`)).reservedAfter, 0);
    await provjeriLanac(uid, [0, 80], '(f)');
  }

  // (g) O-26: istekli W istog korisnika ostaje ACTIVE poslije otkupa V
  await novoStanje();
  {
    const { uid, id } = await pripremi({
      reserved: 80,
      vauceri: [
        { cijena: 50, expiresAtMs: Date.now() + 600_000 },
        { cijena: 30, expiresAtMs: Date.now() - 60_000 },
      ],
    });
    const [V, W] = id;
    const odgovor = await otkupi(V);
    assert.equal(odgovor.status, 200, odgovor.text);
    assert.equal((await p.podaci(`vouchers/${W}`)).status, 'ACTIVE', '(g) W oslobođen');
    assert.equal(await p.podaci(`loyaltyLedger/release_${W}`), undefined, '(g) release W');
    assert.deepStrictEqual(await p.nalog(uid), [30, 30]);
  }
});

// Raspodjela ishoda: { 'status kod': broj }.
function zabiljezi(raspodjela, odgovor) {
  const kljuc = odgovor.status >= 400 ? `${odgovor.status} ${odgovor.body?.error?.code}` : String(odgovor.status);
  raspodjela[kljuc] = (raspodjela[kljuc] ?? 0) + 1;
}

function bez500(odgovori, opis) {
  for (const o of odgovori) {
    assert.ok(o.status !== 500, `${opis}: 500 pod kontencijom (${o.text})`);
  }
}

test('I06-T19 (a) 10 identičnih paralelnih otkupa (10 ponavljanja) → tačno 1 REDEEM i 1 zapis, sva 200 tijela identična, 0×500', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 0; ponavljanje < 10; ponavljanje += 1) {
    const { uid, V } = await pripremi();
    const omotac = omotacBaze(firebase.db);
    const odgovori = await Promise.all(Array.from({ length: 10 }, () => otkupi(V, { db: omotac })));
    await omotac.sveTransakcijeZavrsene;
    odgovori.forEach((o) => zabiljezi(raspodjela, o));
    bez500(odgovori, '(a)');
    for (const o of odgovori) {
      assert.ok([200, 503].includes(o.status), `(a) neočekivan status ${o.status}: ${o.text}`);
    }
    let uspjesni = odgovori.filter((o) => o.status === 200);
    if (uspjesni.length === 0) {
      uspjesni = [await doKrajaBez503(() => otkupi(V))];
    }
    for (const o of uspjesni) {
      assert.deepStrictEqual(o.body, uspjesni[0].body, '(a) tijela se razlikuju');
    }
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
    assert.equal(await brojZapisa(), 1);
    assert.deepStrictEqual(await p.nalog(uid), [30, 0]);
    await ocistiEmulatore();
  }
  t.diagnostic(`I06-T19 (a) raspodjela: ${JSON.stringify(raspodjela)}`);
});

test('I06-T19 (b) redeem SIM01 × redeem SIM02 (20 ponavljanja) → tačno jedan 200, drugi 409 VOUCHER_ALREADY_REDEEMED; 1 REDEEM, 1 zapis, 0×500', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 0; ponavljanje < 20; ponavljanje += 1) {
    const { uid, V } = await pripremi();
    const omotac = omotacBaze(firebase.db);
    const zahtjevi = [() => otkupi(V, { db: omotac, redemptionRequestId: 'A' }), () => otkupi(V, { db: omotac, kljuc: K2, redemptionRequestId: 'B' })];
    const odgovori = await Promise.all(zahtjevi.map((z) => z()));
    await omotac.sveTransakcijeZavrsene;
    odgovori.forEach((o) => zabiljezi(raspodjela, o));
    bez500(odgovori, '(b)');
    assert.ok(odgovori.filter((o) => o.status === 200).length <= 1, '(b) dva 200');
    const konacni = [];
    for (const [i, o] of odgovori.entries()) {
      assert.ok(
        o.status === 200 || o.status === 503 || (o.status === 409 && o.body.error.code === 'VOUCHER_ALREADY_REDEEMED'),
        `(b) neočekivan ishod ${o.status}: ${o.text}`,
      );
      konacni.push(o.status === 503 ? await doKrajaBez503(zahtjevi[i]) : o);
    }
    bez500(konacni, '(b) retry');
    assert.equal(konacni.filter((o) => o.status === 200).length, 1, '(b) poslije retry-ja nije tačno jedan 200');
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
    assert.equal(await brojZapisa(), 1);
    assert.deepStrictEqual(await p.nalog(uid), [30, 0]);
    await ocistiEmulatore();
  }
  t.diagnostic(`I06-T19 (b) raspodjela: ${JSON.stringify(raspodjela)}`);
});

test('I06-T19 (c) redeem × cancel (20 ponavljanja) → tačno jedan terminalni prelaz, balance tačan, 0×500', async (t) => {
  const raspodjela = {};
  const pobjednici = { REDEEMED: 0, CANCELLED: 0 };
  for (let ponavljanje = 0; ponavljanje < 20; ponavljanje += 1) {
    const { uid, idToken } = await korisnik();
    const { V } = await pripremi({ uid });
    const omotac = omotacBaze(firebase.db);
    const odgovori = await Promise.all([otkupi(V, { db: omotac }), otkazi(V, idToken, omotac)]);
    await omotac.sveTransakcijeZavrsene;
    odgovori.forEach((o) => zabiljezi(raspodjela, o));
    bez500(odgovori, '(c)');
    const status = (await p.podaci(`vouchers/${V}`)).status;
    pobjednici[status] += 1;
    if (status === 'REDEEMED') {
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 1);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 0);
      assert.equal(await brojZapisa(), 1);
      assert.deepStrictEqual(await p.nalog(uid), [30, 0]);
      assert.ok([409, 503].includes(odgovori[1].status), `(c) cancel gubitnik: ${odgovori[1].text}`);
    } else {
      assert.equal(status, 'CANCELLED', `(c) status ${status}`);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_RELEASE'), 1);
      assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 0);
      assert.equal(await brojZapisa(), 0);
      assert.deepStrictEqual(await p.nalog(uid), [80, 0]);
      assert.ok([409, 503].includes(odgovori[0].status), `(c) redeem gubitnik: ${odgovori[0].text}`);
    }
    await ocistiEmulatore();
    await napuniRewardDefinitions(firebase.db);
  }
  t.diagnostic(`I06-T19 (c) raspodjela: ${JSON.stringify(raspodjela)}; pobjednik: ${JSON.stringify(pobjednici)}`);
});

test('I06-T19 (d) istekao V: 3 redeem + 3 API-06 + 3 issue SHOWER paralelno (10 ponavljanja) → tačno 1 release, EXPIRED, 0 REDEEM, 0×500', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 0; ponavljanje < 10; ponavljanje += 1) {
    const { uid, idToken } = await korisnik();
    const { V } = await pripremi({ uid, available: 0, reserved: 50, vauceri: [{ cijena: 50, expiresAtMs: Date.now() - 60_000 }] });
    const omotac = omotacBaze(firebase.db);
    const zahtjevi = [];
    for (let i = 0; i < 3; i += 1) {
      zahtjevi.push(otkupi(V, { db: omotac, redemptionRequestId: `R${i}` }), uskladi(idToken, omotac), izdaj('SHOWER', idToken, omotac));
    }
    const odgovori = await Promise.all(zahtjevi);
    await omotac.sveTransakcijeZavrsene;
    odgovori.forEach((o) => zabiljezi(raspodjela, o));
    bez500(odgovori, '(d)');
    assert.equal((await p.podaci(`vouchers/${V}`)).status, 'EXPIRED');
    assert.ok(await p.podaci(`loyaltyLedger/release_${V}`), '(d) release_V');
    const dogadjaji = await dogadjajiKorisnika(uid);
    assert.equal(dogadjaji.filter((d) => d.type === 'REWARD_RELEASE' && d.voucherId === V).length, 1);
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 0);
    assert.equal(await brojZapisa(), 0);
    const [a, r] = await p.nalog(uid);
    assert.equal(a + r, 50, '(d) available + reserved');
    await provjeriLanac(uid, [0, 50], '(d)');
    await ocistiEmulatore();
    await napuniRewardDefinitions(firebase.db);
  }
  t.diagnostic(`I06-T19 (d) raspodjela: ${JSON.stringify(raspodjela)}`);
});

test('I06-T19 (e) 3 ACTIVE voucher-a istog korisnika paralelno otkupljena (10 ponavljanja) → nalog 0/0, 3 REDEEM, 3 zapisa, lanac uzastopan', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 0; ponavljanje < 10; ponavljanje += 1) {
    const istek = Date.now() + 600_000;
    const { uid, id } = await pripremi({
      available: 0,
      reserved: 110,
      vauceri: [
        { cijena: 50, expiresAtMs: istek },
        { cijena: 30, expiresAtMs: istek },
        { cijena: 30, expiresAtMs: istek },
      ],
    });
    const omotac = omotacBaze(firebase.db);
    const zahtjevi = id.map((V, i) => () => otkupi(V, { db: omotac, redemptionRequestId: `E${i}` }));
    const odgovori = await Promise.all(zahtjevi.map((z) => z()));
    await omotac.sveTransakcijeZavrsene;
    odgovori.forEach((o) => zabiljezi(raspodjela, o));
    bez500(odgovori, '(e)');
    for (const [i, o] of odgovori.entries()) {
      const konacan = o.status === 503 ? await doKrajaBez503(zahtjevi[i]) : o;
      assert.equal(konacan.status, 200, `(e) ${konacan.text}`);
    }
    assert.deepStrictEqual(await p.nalog(uid), [0, 0]);
    assert.equal(await p.brojDogadjaja(uid, 'REWARD_REDEEM'), 3);
    assert.equal(await brojZapisa(), 3);
    await provjeriLanac(uid, [0, 110], '(e)');
    await ocistiEmulatore();
  }
  t.diagnostic(`I06-T19 (e) raspodjela: ${JSON.stringify(raspodjela)}`);
});

// mulberry32 (fiksiran seed, deterministički niz).
function mulberry32(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('I06-T20 očuvanje bodova: 100 sekvencijalnih nasumičnih operacija (seed 0x1606) → invarijante §7 poslije svake', async (t) => {
  const slucajno = mulberry32(0x1606);
  const izaberi = (niz) => niz[Math.floor(slucajno() * niz.length)];
  const { uid, idToken } = await korisnik();
  await p.pripremiNalog(uid, 0, 0);
  const korisceniId = [];
  const raspodjela = {};

  for (let korak = 0; korak < 100; korak += 1) {
    const vauceri = (await firebase.db.collection('vouchers').where('uid', '==', uid).get()).docs;
    const aktivni = vauceri.filter((d) => d.get('status') === 'ACTIVE');
    const operacija = izaberi(['kupovina', 'kupovina', 'issue', 'issue', 'cancel', 'API-06', 'redeem', 'redeem', 'redeem', 'istek']);
    let odgovor;
    if (operacija === 'kupovina') {
      odgovor = await kupi(uid, Math.floor(slucajno() * 61), `T20-${korak}`);
    } else if (operacija === 'issue') {
      odgovor = await izdaj(izaberi(['CAR_WASH', 'SHOWER']), idToken);
    } else if (operacija === 'cancel' && vauceri.length > 0) {
      odgovor = await otkazi(izaberi(vauceri).id, idToken);
    } else if (operacija === 'API-06') {
      odgovor = await uskladi(idToken);
    } else if (operacija === 'redeem' && vauceri.length > 0) {
      const ponovljen = korisceniId.length > 0 && slucajno() < 0.3;
      const redemptionRequestId = ponovljen ? izaberi(korisceniId) : `T20-R${korak}`;
      korisceniId.push(redemptionRequestId);
      odgovor = await otkupi(izaberi(vauceri).id, { kljuc: izaberi([K1, K2]), redemptionRequestId });
    } else if (operacija === 'istek' && aktivni.length > 0) {
      await izaberi(aktivni).ref.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
    }
    const oznaka = `${operacija} ${odgovor === undefined ? '-' : odgovor.status >= 400 ? `${odgovor.status} ${odgovor.body.error.code}` : odgovor.status}`;
    raspodjela[oznaka] = (raspodjela[oznaka] ?? 0) + 1;
    assert.ok(odgovor === undefined || odgovor.status < 500, `korak ${korak} ${operacija}: ${odgovor?.text}`);

    // Invarijante poslije svakog koraka.
    const dogadjaji = await dogadjajiKorisnika(uid);
    const stanje = (await firebase.db.collection('vouchers').where('uid', '==', uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
    const [a, r] = await p.nalog(uid);
    const zarada = dogadjaji.filter((d) => d.type === 'EARN').reduce((zbir, d) => zbir + d.deltaAvailable, 0);
    const otkupljeno = stanje.filter((v) => v.status === 'REDEEMED').reduce((zbir, v) => zbir + v.costPoints, 0);
    const rezervisano = stanje.filter((v) => v.status === 'ACTIVE').reduce((zbir, v) => zbir + v.costPoints, 0);
    assert.ok(a >= 0 && r >= 0, `korak ${korak}: negativan balance`);
    assert.equal(a + r, zarada - otkupljeno, `korak ${korak}: available + reserved ≠ zarađeno − otkupljeno`);
    assert.equal(r, rezervisano, `korak ${korak}: reserved ≠ Σcost(ACTIVE)`);
    for (const v of stanje) {
      assert.ok(jeKonzistentnoStanjeVaucera(v), `korak ${korak}: voucher nije O-27 konzistentan`);
      const tragovi = dogadjaji.filter((d) => d.voucherId === v.id);
      assert.equal(tragovi.filter((d) => d.type === 'REWARD_RESERVE').length, 1, `korak ${korak}: RESERVE`);
      const terminalni = tragovi.filter((d) => d.type === 'REWARD_REDEEM' || d.type === 'REWARD_RELEASE');
      assert.equal(terminalni.length, v.status === 'ACTIVE' ? 0 : 1, `korak ${korak}: terminalni događaji za ${v.status}`);
      if (v.status === 'REDEEMED') {
        assert.equal(terminalni[0].type, 'REWARD_REDEEM', `korak ${korak}`);
      }
    }
    const brojRedeem = dogadjaji.filter((d) => d.type === 'REWARD_REDEEM').length;
    assert.equal(brojRedeem, await brojZapisa(), `korak ${korak}: #REDEEM ≠ #zapisa`);
    assert.equal(brojRedeem, stanje.filter((v) => v.status === 'REDEEMED').length, `korak ${korak}: #REDEEM ≠ #REDEEMED`);
    await provjeriLanac(uid, [0, 0], `korak ${korak}`);
  }
  t.diagnostic(`I06-T20 raspodjela: ${JSON.stringify(raspodjela)}`);
});
