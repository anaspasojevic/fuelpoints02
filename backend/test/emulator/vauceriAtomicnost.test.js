// Atomičnost, konkurentnost, idempotentnost, rok, sat po pokušaju i očuvanje bodova za API-05 i API-06
// (§18.1, §19, NFR-04 … NFR-06, AC-08, AC-09, O-5, ODLUKE §6 (b), (j)): AC-08, I05-T10 … I05-T14, I05-T17 … I05-T19.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { setTimeout as pauza } from 'node:timers/promises';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { otkaziVaucer } from '../../src/servisi/otkazivanjeVaucera.js';
import { uskladiVaucere } from '../../src/servisi/uskladjivanjeVaucera.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
const TRAJANJE_MS = 900_000;
const K1 = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(posKonfiguracija([['SIM01', K1]])).stanice;

let firebase;
let brojac = 0;
let brojacKupovina = 0;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
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

const hex64 = () => randomBytes(32).toString('hex');

function aplikacija(db = firebase.db) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice: POS_STANICE });
}

function otkazi(voucherId, { token, db, app }) {
  return request(app ?? aplikacija(db)).post(`/api/v1/vouchers/${voucherId}/cancel`).set('Authorization', `Bearer ${token}`);
}

function uskladi({ token, db, app }) {
  return request(app ?? aplikacija(db)).post('/api/v1/account/vouchers/reconcile').set('Authorization', `Bearer ${token}`);
}

function izdaj(rewardId, { token, db, app, requestId = randomUUID() }) {
  return request(app ?? aplikacija(db)).post(`/api/v1/rewards/${rewardId}/issue`).set('Authorization', `Bearer ${token}`).send({ requestId });
}

function kupi(uid, volumeMl, { db, app } = {}) {
  brojacKupovina += 1;
  return request(app ?? aplikacija(db))
    .post('/api/v1/pos/purchases')
    .set('X-POS-API-Key', K1)
    .send({
      loyaltyUid: uid,
      posTransactionId: `I05-${brojacKupovina}`,
      volumeMl,
      amountMinor: 1000,
      currency: 'EUR',
      occurredAt: new Date(Date.now() - 60_000).toISOString(),
    });
}

async function korisnik() {
  brojac += 1;
  return napraviKorisnika(`vauceri${brojac}@primjer.test`);
}

function provjeriTijeloGreske(odgovor, status, kod, opis = '') {
  assert.equal(odgovor.status, status, `${opis}: status (tijelo ${odgovor.text})`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
}

function provjeriBezInternihDetalja(odgovor, opis = '') {
  for (const zabranjeno of ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno', 'Nekonzistentno', 'availablePoints']) {
    assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
  }
}

function referenca(putanja) {
  return firebase.db.doc(putanja);
}

async function podaci(putanja) {
  const snimak = await referenca(putanja).get();
  return snimak.exists ? snimak.data() : undefined;
}

async function snimakBaze() {
  const rezultat = {};
  for (const kolekcija of await firebase.db.listCollections()) {
    for (const dokument of (await kolekcija.get()).docs) {
      rezultat[dokument.ref.path] = dokument.data();
    }
  }
  return rezultat;
}

async function pripremiNalog(uid, availablePoints, reservedPoints) {
  await referenca(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await referenca(`loyaltyAccounts/${uid}`).set({ availablePoints, reservedPoints, createdAt: VRIJEME_PRIPREME, updatedAt: VRIJEME_PRIPREME });
}

function kanonskiVaucer(uid, { rewardId = 'CAR_WASH', costPoints = 50, status = 'ACTIVE', expiresAtMs }) {
  return {
    uid,
    rewardId,
    costPoints,
    status,
    issuedAt: Timestamp.fromMillis(expiresAtMs - TRAJANJE_MS),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    redeemedAt: null,
    cancelledAt: null,
    redeemedAtStationId: null,
  };
}

async function pripremiVaucer(voucherId, uid, opcije) {
  await referenca(`vouchers/${voucherId}`).set(kanonskiVaucer(uid, opcije));
}

async function nalog(uid) {
  const n = await podaci(`loyaltyAccounts/${uid}`);
  return [n.availablePoints, n.reservedPoints];
}

async function dogadjajiKorisnika(uid) {
  return (await firebase.db.collection('loyaltyLedger').where('uid', '==', uid).get()).docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function brojReleaseZa(voucherId) {
  return (await firebase.db.collection('loyaltyLedger').where('voucherId', '==', voucherId).where('type', '==', 'REWARD_RELEASE').get()).size;
}

// Lanac ledger-a (§7.6): počev od (a0, r0), svaki događaj = prethodno stanje + delta. Događaji su poredani po createdAt (commit
// transakcije); unutar iste transakcije (isti createdAt) redoslijed se rekonstruiše: sljedeći je onaj čije stanje prije odgovara tekućem.
// Vraća krajnje stanje; baca ako lanac nije uzastopan.
function provjeriLanac(dogadjaji, [a0, r0], opis) {
  const grupe = new Map();
  for (const d of dogadjaji) {
    assert.ok(d.createdAt instanceof Timestamp, `${opis}: createdAt nije Timestamp (${d.id})`);
    const k = `${d.createdAt.seconds}.${String(d.createdAt.nanoseconds).padStart(9, '0')}`;
    grupe.set(k, [...(grupe.get(k) ?? []), d]);
  }
  let [a, r] = [a0, r0];
  for (const k of [...grupe.keys()].sort()) {
    const preostali = [...grupe.get(k)];
    while (preostali.length > 0) {
      const i = preostali.findIndex((d) => d.availableAfter - d.deltaAvailable === a && d.reservedAfter - d.deltaReserved === r);
      assert.ok(i >= 0, `${opis}: lanac prekinut na stanju ${a}/${r} (${preostali.map((d) => `${d.type} ${d.availableAfter}/${d.reservedAfter}`).join(', ')})`);
      const [d] = preostali.splice(i, 1);
      assert.ok(d.availableAfter >= 0 && d.reservedAfter >= 0, `${opis}: invarijanta ≥ 0 (${d.id})`);
      [a, r] = [d.availableAfter, d.reservedAfter];
    }
  }
  return [a, r];
}

// Fajl iz kojeg je neposredno pozvana mock funkcija (kao I04-T19).
function fajlPozivaoca() {
  const izvorno = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, okviri) => okviri;
  const okviri = new Error().stack;
  Error.prepareStackTrace = izvorno;
  return okviri
    .map((okvir) => okvir.getFileName() ?? '')
    .find((fajl) => fajl !== '' && !fajl.startsWith('node:') && !fajl.endsWith('/vauceriAtomicnost.test.js'));
}

// Ponavlja zahtjev dok ne dobije odgovor koji nije 503 (najviše 20 pokušaja).
async function doIshoda(posalji, opis) {
  for (let pokusaj = 1; pokusaj <= 20; pokusaj += 1) {
    const odgovor = await posalji();
    if (odgovor.status !== 503) {
      return odgovor;
    }
    provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', `${opis} pokušaj ${pokusaj}`);
  }
  throw new Error(`${opis}: nema ishoda poslije 20 pokušaja`);
}

test('AC-08 istekao ACTIVE voucher vraća bodove tačno jednom kroz cancel (O-5), API-06 i API-03 reconcile, bilo kojim redoslijedom', async () => {
  const scenariji = [
    ['(a) cancel → API-06 → issue → cancel', ['cancel409', 'uskladi0', 'izdaj201', 'cancel409']],
    ['(b) API-06 → cancel → issue', ['uskladi1', 'cancel409', 'izdaj201']],
    ['(c) issue → cancel → API-06', ['izdaj201', 'cancel409', 'uskladi0']],
  ];
  for (const [opis, koraci] of scenariji) {
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
    let releaseNapravljen = false;
    for (const korak of koraci) {
      const omotac = omotacBaze(firebase.db);
      if (korak === 'cancel409') {
        provjeriTijeloGreske(await otkazi(V, { token: idToken, db: omotac }), 409, 'VOUCHER_EXPIRED', `${opis} ${korak}`);
      } else if (korak.startsWith('uskladi')) {
        const odgovor = await uskladi({ token: idToken, db: omotac });
        assert.deepStrictEqual(odgovor.body, { reconciledCount: Number(korak.slice(7)) }, `${opis} ${korak}`);
      } else {
        const odgovor = await izdaj('SHOWER', { token: idToken, db: omotac });
        assert.equal(odgovor.status, 201, `${opis} ${korak}: ${odgovor.text}`);
      }
      const pisaoRelease = omotac.upisi.some((u) => u.putanja === `loyaltyLedger/release_${V}`);
      assert.ok(!(releaseNapravljen && pisaoRelease), `${opis} ${korak}: drugi release za V`);
      if (releaseNapravljen && korak === 'cancel409') {
        assert.deepStrictEqual(omotac.upisi, [], `${opis} ${korak}: ponovljen cancel je pisao`);
      }
      releaseNapravljen ||= pisaoRelease;
    }
    assert.equal(await brojReleaseZa(V), 1, `${opis}: broj release-a za V`);
    const vaucer = await podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, 'EXPIRED', opis);
    assert.equal(vaucer.cancelledAt, null, opis);
    const [dostupno, rezervisano] = await nalog(uid);
    assert.equal(dostupno + rezervisano, 50, `${opis}: zbir bodova`);
    assert.deepStrictEqual([dostupno, rezervisano], [20, 30], `${opis}: balance`);
    assert.deepStrictEqual(provjeriLanac(await dogadjajiKorisnika(uid), [0, 50], opis), [20, 30], `${opis}: kraj lanca`);
  }

  // Dopuna: neistekao ACTIVE → cancel (CANCELLED) → API-06 → issue: tačno jedan release, V ostaje CANCELLED.
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 50);
  const V = hex64();
  await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
  assert.equal((await otkazi(V, { token: idToken })).status, 200);
  assert.deepStrictEqual((await uskladi({ token: idToken })).body, { reconciledCount: 0 });
  assert.equal((await izdaj('SHOWER', { token: idToken })).status, 201);
  assert.equal(await brojReleaseZa(V), 1);
  assert.equal((await podaci(`vouchers/${V}`)).status, 'CANCELLED');
  assert.deepStrictEqual(await nalog(uid), [20, 30]);
});

test('I05-T10 failure injection cancel-a na svakom upisu i prije commit-a (neistekao i O-5) → 500 bez stack-a, stanje nepromijenjeno', async () => {
  const { uid, idToken } = await korisnik();
  const V = hex64();
  for (const [opis, expiresAtMs, kontrolniStatus] of [
    ['(a) neistekao', Date.now() + 600_000, 200],
    ['(b) O-5 istekao', Date.now() - 60_000, 409],
  ]) {
    await pripremiNalog(uid, 0, 50);
    await referenca(`loyaltyLedger/release_${V}`).delete();
    await pripremiVaucer(V, uid, { expiresAtMs });
    const pocetno = await snimakBaze();
    const ocekivaniUpisi = [
      { metod: 'update', putanja: `vouchers/${V}` },
      { metod: 'create', putanja: `loyaltyLedger/release_${V}` },
      { metod: 'update', putanja: `loyaltyAccounts/${uid}` },
    ];
    for (let upis = 1; upis <= ocekivaniUpisi.length; upis += 1) {
      const omotac = omotacBaze(firebase.db, { baciNaUpisu: upis });
      const odgovor = await otkazi(V, { token: idToken, db: omotac });
      provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `${opis} upis ${upis}`);
      provjeriBezInternihDetalja(odgovor, `${opis} upis ${upis}`);
      assert.deepStrictEqual(omotac.upisi, ocekivaniUpisi.slice(0, upis), `${opis} upis ${upis}: zabilježeni upisi`);
      assert.deepStrictEqual(await snimakBaze(), pocetno, `${opis} upis ${upis}: baza promijenjena`);
    }
    const prijeCommita = omotacBaze(firebase.db, { baciPrijeCommita: true });
    const odgovor = await otkazi(V, { token: idToken, db: prijeCommita });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `${opis} (c) prije commit-a`);
    provjeriBezInternihDetalja(odgovor, `${opis} (c)`);
    assert.deepStrictEqual(prijeCommita.upisi, ocekivaniUpisi, `${opis} (c): callback nije upisao sve`);
    assert.deepStrictEqual(await snimakBaze(), pocetno, `${opis} (c): baza promijenjena`);

    const kontrola = omotacBaze(firebase.db);
    const uspjeh = await otkazi(V, { token: idToken, db: kontrola });
    assert.equal(uspjeh.status, kontrolniStatus, `${opis} kontrola: ${uspjeh.text}`);
    assert.deepStrictEqual(kontrola.upisi, ocekivaniUpisi, `${opis} kontrola: upisi`);
  }
});

test('I05-T11 (a) 10 paralelnih cancel-a istog voucher-a (20 ponavljanja) → tačno jedan RELEASE, identična 200 tijela, nijedan 500', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 1; ponavljanje <= 20; ponavljanje += 1) {
    const opis = `ponavljanje ${ponavljanje}`;
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    await pripremiVaucer(V, uid, { expiresAtMs: Date.now() + 600_000 });
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const odgovori = await Promise.all(Array.from({ length: 10 }, () => otkazi(V, { token: idToken, app })));
    await omotac.sveTransakcijeZavrsene;
    const statusi = odgovori.map((o) => o.status);
    const kljuc = statusi.slice().sort().join(',');
    raspodjela[kljuc] = (raspodjela[kljuc] ?? 0) + 1;
    t.diagnostic(`${opis}: statusi ${statusi.join(',')}`);
    assert.ok(statusi.every((s) => s === 200 || s === 503), `${opis}: statusi ${statusi.join(',')}`);
    for (const o of odgovori.filter((x) => x.status === 503)) {
      provjeriTijeloGreske(o, 503, 'SERVICE_UNAVAILABLE', opis);
    }
    const uspjesni = odgovori.filter((o) => o.status === 200);
    for (const o of uspjesni) {
      assert.deepStrictEqual(o.body, uspjesni[0].body, `${opis}: različita 200 tijela`);
    }
    const naknadni = await doIshoda(() => otkazi(V, { token: idToken }), `${opis} naknadni`);
    assert.equal(naknadni.status, 200, `${opis}: naknadni ${naknadni.text}`);
    if (uspjesni.length > 0) {
      assert.deepStrictEqual(naknadni.body, uspjesni[0].body, `${opis}: naknadni ≠ 200 tijelo`);
    }
    assert.equal(await brojReleaseZa(V), 1, `${opis}: broj release-a`);
    assert.equal((await podaci(`vouchers/${V}`)).status, 'CANCELLED', opis);
    assert.deepStrictEqual(await nalog(uid), [50, 0], `${opis}: balance`);
  }
  t.diagnostic(`raspodjela ishoda: ${JSON.stringify(raspodjela)}`);
});

test('I05-T11 (b) isti istekao voucher: 4 cancel-a + 3 API-06 + 3 SHOWER issue-a paralelno (20 ponavljanja) → tačno jedan RELEASE, bez 500', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 1; ponavljanje <= 20; ponavljanje += 1) {
    const opis = `ponavljanje ${ponavljanje}`;
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    await pripremiVaucer(V, uid, { expiresAtMs: Date.now() - 60_000 });
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const odgovori = await Promise.all([
      ...Array.from({ length: 4 }, () => otkazi(V, { token: idToken, app }).then((o) => ['cancel', o])),
      ...Array.from({ length: 3 }, () => uskladi({ token: idToken, app }).then((o) => ['uskladi', o])),
      ...Array.from({ length: 3 }, () => izdaj('SHOWER', { token: idToken, app }).then((o) => ['izdaj', o])),
    ]);
    await omotac.sveTransakcijeZavrsene;
    const opisi = odgovori.map(([vrsta, o]) => `${vrsta} ${o.status}${o.body?.error ? ` ${o.body.error.code}` : ''}`);
    for (const o of opisi) {
      raspodjela[o] = (raspodjela[o] ?? 0) + 1;
    }
    t.diagnostic(`${opis}: ${opisi.join(', ')}`);
    let zbirUskladjenih = 0;
    for (const [vrsta, o] of odgovori) {
      assert.notEqual(o.status, 500, `${opis}: ${vrsta} 500 ${o.text}`);
      if (o.status === 503) {
        provjeriTijeloGreske(o, 503, 'SERVICE_UNAVAILABLE', `${opis} ${vrsta}`);
      } else if (vrsta === 'cancel') {
        provjeriTijeloGreske(o, 409, 'VOUCHER_EXPIRED', `${opis} cancel`);
      } else if (vrsta === 'uskladi') {
        assert.equal(o.status, 200, `${opis} uskladi: ${o.text}`);
        zbirUskladjenih += o.body.reconciledCount;
      } else if (o.status !== 201) {
        provjeriTijeloGreske(o, 409, 'INSUFFICIENT_POINTS', `${opis} izdaj`);
      }
    }
    assert.ok(zbirUskladjenih <= 1, `${opis}: zbir reconciledCount ${zbirUskladjenih}`);
    if ((await podaci(`vouchers/${V}`)).status === 'ACTIVE') {
      // Svi zahtjevi koji su ga mogli osloboditi dobili su 503 bez commit-a: isti poziv se ponavlja (state-idempotentno).
      provjeriTijeloGreske(await doIshoda(() => otkazi(V, { token: idToken }), `${opis} naknadni`), 409, 'VOUCHER_EXPIRED', `${opis} naknadni`);
    }
    assert.equal(await brojReleaseZa(V), 1, `${opis}: broj release-a`);
    const vaucer = await podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, 'EXPIRED', opis);
    assert.equal(vaucer.cancelledAt, null, opis);
    const noviVauceri = (await firebase.db.collection('vouchers').where('uid', '==', uid).get()).size - 1;
    assert.ok(noviVauceri <= 1, `${opis}: ${noviVauceri} novih voucher-a`);
    const [dostupno, rezervisano] = await nalog(uid);
    assert.equal(dostupno + rezervisano, 50, `${opis}: zbir bodova`);
    assert.equal(rezervisano, 30 * noviVauceri, `${opis}: reservedPoints`);
    assert.deepStrictEqual(provjeriLanac(await dogadjajiKorisnika(uid), [0, 50], opis), [dostupno, rezervisano], `${opis}: kraj lanca`);
  }
  t.diagnostic(`raspodjela ishoda: ${JSON.stringify(raspodjela)}`);
});

test('I05-T11 (c) tri voucher-a istog korisnika otkazana paralelno (5 ponavljanja) → balance je zbir, tri release-a u uzastopnom lancu', async (t) => {
  for (let ponavljanje = 1; ponavljanje <= 5; ponavljanje += 1) {
    const opis = `ponavljanje ${ponavljanje}`;
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 0, 110);
    const vauceri = [
      [hex64(), 'CAR_WASH', 50],
      [hex64(), 'SHOWER', 30],
      [hex64(), 'SHOWER', 30],
    ];
    for (const [id, rewardId, costPoints] of vauceri) {
      await pripremiVaucer(id, uid, { rewardId, costPoints, expiresAtMs: Date.now() + 600_000 });
    }
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const odgovori = await Promise.all(vauceri.map(([id]) => doIshoda(() => otkazi(id, { token: idToken, app }), `${opis} ${id.slice(0, 6)}`)));
    await omotac.sveTransakcijeZavrsene;
    t.diagnostic(`${opis}: statusi ${odgovori.map((o) => o.status).join(',')}, pokušaja ${omotac.brojPokusaja}`);
    for (const o of odgovori) {
      assert.equal(o.status, 200, `${opis}: ${o.text}`);
    }
    for (const [id] of vauceri) {
      assert.equal(await brojReleaseZa(id), 1, `${opis}: release ${id.slice(0, 6)}`);
    }
    assert.deepStrictEqual(await nalog(uid), [110, 0], `${opis}: balance`);
    assert.deepStrictEqual(provjeriLanac(await dogadjajiKorisnika(uid), [0, 110], opis), [110, 0], `${opis}: kraj lanca`);
  }
});

test('I05-T12 (a)–(c) kasni commit poslije 503 → retry je bezbjedan: tačno jedan RELEASE, retry vraća sačuvano stanje', async (t) => {
  const scenariji = [
    ['(a) cancel neistekao', Date.now() + 600_000],
    ['(b) cancel O-5', Date.now() - 60_000],
    ['(c) API-06', Date.now() - 60_000],
  ];
  for (const [opis, expiresAtMs] of scenariji) {
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    await pripremiVaucer(V, uid, { expiresAtMs });
    const posalji = (db) => (opis.startsWith('(c)') ? uskladi({ token: idToken, db }) : otkazi(V, { token: idToken, db }));
    const omotac = omotacBaze(firebase.db, { zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500 });
    const pocetak = Date.now();
    const odgovor = await posalji(omotac);
    const trajanje = Date.now() - pocetak;
    t.diagnostic(`${opis}: prvi zahtjev HTTP ${odgovor.status} za ${trajanje} ms`);
    provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', `${opis} prvi`);
    assert.ok(trajanje < 12_000, `${opis}: 503 je stigao za ${trajanje} ms`);
    await omotac.sveTransakcijeZavrsene;

    const vaucer = await podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, opis.startsWith('(a)') ? 'CANCELLED' : 'EXPIRED', `${opis}: kasni commit nije upisan`);
    assert.equal(await brojReleaseZa(V), 1, `${opis}: release poslije kasnog commit-a`);
    assert.deepStrictEqual(await nalog(uid), [50, 0], opis);

    const stanje = await snimakBaze();
    const retry = await posalji(firebase.db);
    const drugiRetry = await posalji(firebase.db);
    if (opis.startsWith('(a)')) {
      assert.equal(retry.status, 200, `${opis} retry: ${retry.text}`);
      assert.equal(retry.body.status, 'CANCELLED');
      assert.equal(retry.body.cancelledAt, vaucer.cancelledAt.toDate().toISOString(), `${opis}: cancelledAt ≠ sačuvani`);
      assert.equal(drugiRetry.text, retry.text, `${opis}: drugi retry se razlikuje`);
    } else if (opis.startsWith('(b)')) {
      provjeriTijeloGreske(retry, 409, 'VOUCHER_EXPIRED', `${opis} retry`);
      provjeriTijeloGreske(drugiRetry, 409, 'VOUCHER_EXPIRED', `${opis} drugi retry`);
    } else {
      assert.deepStrictEqual(retry.body, { reconciledCount: 0 }, `${opis} retry`);
      assert.deepStrictEqual(drugiRetry.body, { reconciledCount: 0 }, `${opis} drugi retry`);
    }
    assert.deepStrictEqual(await snimakBaze(), stanje, `${opis}: retry je upisao`);
    assert.equal(await brojReleaseZa(V), 1, `${opis}: release poslije retry-ja`);
  }
});

test('I05-T12 (d) istekao rok prije transakcije → GreskaApi SERVICE_UNAVAILABLE, runTransaction se ne poziva, 0 pristupa bazi', async () => {
  await pripremiNalog('korisnikA', 0, 50);
  const V = hex64();
  await pripremiVaucer(V, 'korisnikA', { expiresAtMs: Date.now() + 600_000 });
  const stanje = await snimakBaze();
  for (const [naziv, poziv] of [
    ['otkaziVaucer', (db, rok) => otkaziVaucer(db, { uid: 'korisnikA', voucherId: V }, rok)],
    ['uskladiVaucere', (db, rok) => uskladiVaucere(db, { uid: 'korisnikA' }, rok)],
  ]) {
    for (const [opisRoka, rok] of [
      ['Date.now() − 1', () => Date.now() - 1],
      ['Date.now()', () => Date.now()],
      ['undefined', () => undefined],
      ['NaN', () => Number.NaN],
    ]) {
      const omotac = omotacBaze(firebase.db);
      await assert.rejects(
        poziv(omotac, rok()),
        (greska) => greska instanceof GreskaApi && greska.kod === 'SERVICE_UNAVAILABLE',
        `${naziv} ${opisRoka}`,
      );
      assert.equal(omotac.brojTransakcija, 0, `${naziv} ${opisRoka}: runTransaction je pozvan`);
      assert.equal(omotac.brojPristupa, 0, `${naziv} ${opisRoka}: pristup bazi`);
    }
    assert.deepStrictEqual(await snimakBaze(), stanje, `${naziv}: baza promijenjena`);
  }
  // Kontrola: rok od 10 s → uspjeh.
  const kontrolaUskladi = omotacBaze(firebase.db);
  assert.deepStrictEqual(await uskladiVaucere(kontrolaUskladi, { uid: 'korisnikA' }, Date.now() + 10_000), { reconciledCount: 0 });
  assert.equal(kontrolaUskladi.brojTransakcija, 1);
  const kontrolaOtkazi = omotacBaze(firebase.db);
  assert.equal((await otkaziVaucer(kontrolaOtkazi, { uid: 'korisnikA', voucherId: V }, Date.now() + 10_000)).status, 'CANCELLED');
  assert.equal(kontrolaOtkazi.brojTransakcija, 1);
});

test('I05-T13 sadaMs se čita na početku svakog pokušaja: voucher istekao između pokušaja → cancel EXPIRED (409), API-06 ga oslobađa', async () => {
  for (const [opis, fajl, poziv] of [
    ['cancel', '/src/servisi/otkazivanjeVaucera.js', (db, uid, V, rok) => otkaziVaucer(db, { uid, voucherId: V }, rok)],
    ['API-06', '/src/servisi/uskladjivanjeVaucera.js', (db, uid, V, rok) => uskladiVaucere(db, { uid }, rok)],
  ]) {
    const T0 = Date.now();
    const uid = `korisnikT13-${opis}`;
    await pripremiNalog(uid, 0, 50);
    const V = hex64();
    // Ističe između prvog (T0 + 10 s) i drugog pokušaja (T0 + 20 s).
    await pripremiVaucer(V, uid, { expiresAtMs: T0 + 15_000 });
    const omotac = omotacBaze(firebase.db, { prisiliPonovniPokusaj: 1 });
    const izvorni = Date.now;
    const ocitavanja = [];
    mock.method(Date, 'now', () => {
      if (!(fajlPozivaoca() ?? '').endsWith(fajl)) {
        return izvorni.call(Date);
      }
      const vrijednost = T0 + 10_000 * ocitavanja.length;
      ocitavanja.push({ vrijednost, pokusaj: omotac.brojPokusaja });
      return vrijednost;
    });
    const rezultat = await poziv(omotac, uid, V, T0 + 60_000).then(
      (odgovor) => ({ odgovor }),
      (greska) => ({ greska }),
    );
    mock.restoreAll();
    assert.equal(omotac.brojPokusaja, 2, `${opis}: broj pokušaja`);
    assert.deepStrictEqual(ocitavanja.map((o) => o.pokusaj), [0, 1, 2], `${opis}: čitanja Date.now po pokušaju: ${JSON.stringify(ocitavanja)}`);
    if (opis === 'cancel') {
      assert.ok(rezultat.greska instanceof GreskaApi && rezultat.greska.kod === 'VOUCHER_EXPIRED', `${opis}: ${rezultat.greska ?? JSON.stringify(rezultat.odgovor)}`);
    } else {
      assert.deepStrictEqual(rezultat.odgovor, { reconciledCount: 1 }, opis);
    }
    const vaucer = await podaci(`vouchers/${V}`);
    assert.equal(vaucer.status, 'EXPIRED', opis);
    assert.equal(vaucer.cancelledAt, null, opis);
    assert.equal(await brojReleaseZa(V), 1, opis);
    assert.deepStrictEqual(await nalog(uid), [50, 0], opis);
  }
});

// K-1 (pouka i04 R-01, O-17): nalog se čita i mijenja u transakciji; dokaz ne zavisi od kontencije ni od brave upita nad vouchers.
// Kupovina (API-02) ne čita vouchers, a mijenja isti loyaltyAccounts dok cancel / API-06 drži svoju transakciju poslije svih čitanja.
// Ako bi se nalog čitao van transakcije, kupovina bi se commit-ovala, a cancel bi prepisao nalog zastarjelim stanjem (izgubljen EARN).
test('I05-T14 kupovina istog korisnika dok cancel ili API-06 drži transakciju poslije čitanja (10 ponavljanja) → tačan balance i lanac', async (t) => {
  for (const vrsta of ['cancel', 'API-06']) {
    for (let ponavljanje = 1; ponavljanje <= 10; ponavljanje += 1) {
      const opis = `${vrsta} ponavljanje ${ponavljanje}`;
      const { uid, idToken } = await korisnik();
      await pripremiNalog(uid, 0, 50);
      const V = hex64();
      await pripremiVaucer(V, uid, { expiresAtMs: vrsta === 'cancel' ? Date.now() + 600_000 : Date.now() - 60_000 });
      let kupovina;
      let kupovinaCekala = false;
      const omotac = omotacBaze(firebase.db, {
        async prijeCommita(pokusaj) {
          if (pokusaj !== 1) {
            return;
          }
          kupovina = kupi(uid, 20_000).then((o) => o);
          // Kupovina dobija do 2 s da se commit-uje dok je cancel / API-06 zadržan prije svog commit-a.
          kupovinaCekala = await Promise.race([kupovina.then(() => false), pauza(2000).then(() => true)]);
        },
      });
      const odgovor = vrsta === 'cancel' ? await otkazi(V, { token: idToken, db: omotac }) : await uskladi({ token: idToken, db: omotac });
      const odgovorKupovine = await kupovina;
      await omotac.sveTransakcijeZavrsene;
      t.diagnostic(`${opis}: ${odgovor.status}, kupovina ${odgovorKupovine.status}, pokušaja ${omotac.brojPokusaja}, kupovina čekala: ${kupovinaCekala}`);
      assert.equal(odgovor.status, 200, `${opis}: ${odgovor.text}`);
      assert.equal(odgovorKupovine.status, 201, `${opis}: kupovina ${odgovorKupovine.text}`);
      assert.deepStrictEqual(await nalog(uid), [70, 0], `${opis}: balance (izgubljen upis kupovine ili oslobađanja)`);
      const dogadjaji = await dogadjajiKorisnika(uid);
      assert.deepStrictEqual(dogadjaji.map((d) => d.type).sort(), ['EARN', 'REWARD_RELEASE'], `${opis}: događaji`);
      assert.deepStrictEqual(provjeriLanac(dogadjaji, [0, 50], opis), [70, 0], `${opis}: kraj lanca`);
      assert.equal(await brojReleaseZa(V), 1, opis);
    }
  }
});

test('I05-T17 failure injection API-06 (dva istekla) na svakom upisu, prije commit-a i zastarjelo čitanje → 500, stanje nepromijenjeno', async () => {
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 80);
  const V1 = '1'.repeat(64);
  const V2 = '2'.repeat(64);
  await pripremiVaucer(V1, uid, { expiresAtMs: Date.now() - 120_000 });
  await pripremiVaucer(V2, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: Date.now() - 60_000 });
  const pocetno = await snimakBaze();
  const ocekivaniUpisi = [
    { metod: 'update', putanja: `vouchers/${V1}` },
    { metod: 'create', putanja: `loyaltyLedger/release_${V1}` },
    { metod: 'update', putanja: `vouchers/${V2}` },
    { metod: 'create', putanja: `loyaltyLedger/release_${V2}` },
    { metod: 'update', putanja: `loyaltyAccounts/${uid}` },
  ];
  for (let upis = 1; upis <= ocekivaniUpisi.length; upis += 1) {
    const omotac = omotacBaze(firebase.db, { baciNaUpisu: upis });
    const odgovor = await uskladi({ token: idToken, db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `upis ${upis}`);
    provjeriBezInternihDetalja(odgovor, `upis ${upis}`);
    assert.deepStrictEqual(omotac.upisi, ocekivaniUpisi.slice(0, upis), `upis ${upis}: zabilježeni upisi`);
    assert.deepStrictEqual(await snimakBaze(), pocetno, `upis ${upis}: baza promijenjena`);
  }
  const prijeCommita = omotacBaze(firebase.db, { baciPrijeCommita: true });
  provjeriTijeloGreske(await uskladi({ token: idToken, db: prijeCommita }), 500, 'INTERNAL_ERROR', 'prije commit-a');
  assert.deepStrictEqual(prijeCommita.upisi, ocekivaniUpisi);
  assert.deepStrictEqual(await snimakBaze(), pocetno, 'prije commit-a: baza promijenjena');

  // Zastarjelo čitanje: release_V2 postoji, transakcija ga ne vidi → ALREADY_EXISTS na commit-u → 500.
  const release = { uid, type: 'REWARD_RELEASE', voucherId: V2 };
  await referenca(`loyaltyLedger/release_${V2}`).set(release);
  const saReleaseom = await snimakBaze();
  const zastarjelo = omotacBaze(firebase.db, { sakrijPostojece: [`loyaltyLedger/release_${V2}`] });
  provjeriTijeloGreske(await uskladi({ token: idToken, db: zastarjelo }), 500, 'INTERNAL_ERROR', 'zastarjelo čitanje');
  assert.deepStrictEqual(await snimakBaze(), saReleaseom, 'zastarjelo čitanje: baza promijenjena');
  await referenca(`loyaltyLedger/release_${V2}`).delete();

  const kontrola = omotacBaze(firebase.db);
  const uspjeh = await uskladi({ token: idToken, db: kontrola });
  assert.deepStrictEqual(uspjeh.body, { reconciledCount: 2 }, `kontrola: ${uspjeh.text}`);
  assert.deepStrictEqual(kontrola.upisi, ocekivaniUpisi, 'kontrola: upisi');
  assert.deepStrictEqual(await nalog(uid), [80, 0]);
});

test('I05-T18 (a) 10 paralelnih API-06 nad nalogom sa 3 istekla voucher-a (10 ponavljanja) → svaki voucher tačno jednom, bez 500', async (t) => {
  const raspodjela = {};
  for (let ponavljanje = 1; ponavljanje <= 10; ponavljanje += 1) {
    const opis = `ponavljanje ${ponavljanje}`;
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 5, 110);
    const vauceri = [
      [hex64(), 'CAR_WASH', 50],
      [hex64(), 'SHOWER', 30],
      [hex64(), 'SHOWER', 30],
    ];
    for (const [i, [id, rewardId, costPoints]] of vauceri.entries()) {
      await pripremiVaucer(id, uid, { rewardId, costPoints, expiresAtMs: Date.now() - 60_000 - i });
    }
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const odgovori = await Promise.all(Array.from({ length: 10 }, () => uskladi({ token: idToken, app })));
    await omotac.sveTransakcijeZavrsene;
    const statusi = odgovori.map((o) => o.status);
    const zbir = odgovori.filter((o) => o.status === 200).reduce((s, o) => s + o.body.reconciledCount, 0);
    const kljuc = `${statusi.filter((s) => s === 503).length}×503, zbir ${zbir}`;
    raspodjela[kljuc] = (raspodjela[kljuc] ?? 0) + 1;
    t.diagnostic(`${opis}: statusi ${statusi.join(',')}, zbir reconciledCount ${zbir}`);
    assert.ok(statusi.every((s) => s === 200 || s === 503), `${opis}: statusi ${statusi.join(',')}`);
    if (statusi.every((s) => s === 200)) {
      assert.equal(zbir, 3, `${opis}: zbir reconciledCount bez 503`);
    } else {
      assert.ok(zbir <= 3, `${opis}: zbir ${zbir}`);
    }
    const naknadni = await doIshoda(() => uskladi({ token: idToken }), `${opis} naknadni`);
    assert.ok(zbir + naknadni.body.reconciledCount <= 3, `${opis}: ukupno oslobođeno > 3`);
    for (const [id] of vauceri) {
      assert.equal(await brojReleaseZa(id), 1, `${opis}: release ${id.slice(0, 6)}`);
      assert.equal((await podaci(`vouchers/${id}`)).status, 'EXPIRED', opis);
    }
    assert.deepStrictEqual(await nalog(uid), [115, 0], `${opis}: balance`);
    assert.deepStrictEqual(provjeriLanac(await dogadjajiKorisnika(uid), [5, 110], opis), [115, 0], opis);
  }
  t.diagnostic(`raspodjela ishoda: ${JSON.stringify(raspodjela)}`);
});

test('I05-T18 (b) API-06 i 3 izdavanja istog korisnika paralelno (10 ponavljanja) → bez duplog release-a, balance i lanac tačni', async (t) => {
  for (let ponavljanje = 1; ponavljanje <= 10; ponavljanje += 1) {
    const opis = `ponavljanje ${ponavljanje}`;
    const { uid, idToken } = await korisnik();
    await pripremiNalog(uid, 10, 80);
    const V1 = hex64();
    const V2 = hex64();
    await pripremiVaucer(V1, uid, { expiresAtMs: Date.now() - 120_000 });
    await pripremiVaucer(V2, uid, { rewardId: 'SHOWER', costPoints: 30, expiresAtMs: Date.now() - 60_000 });
    const omotac = omotacBaze(firebase.db);
    const app = aplikacija(omotac);
    const izdavanja = Array.from({ length: 3 }, () => randomUUID());
    const odgovori = await Promise.all([
      doIshoda(() => uskladi({ token: idToken, app }), `${opis} uskladi`),
      ...izdavanja.map((requestId) => doIshoda(() => izdaj('SHOWER', { token: idToken, app, requestId }), `${opis} izdaj`)),
    ]);
    await omotac.sveTransakcijeZavrsene;
    t.diagnostic(`${opis}: ${odgovori.map((o) => `${o.status}${o.body?.error ? ` ${o.body.error.code}` : ''}`).join(', ')}`);
    assert.equal(odgovori[0].status, 200, `${opis}: uskladi ${odgovori[0].text}`);
    for (const o of odgovori.slice(1)) {
      if (o.status !== 201 && o.status !== 200) {
        provjeriTijeloGreske(o, 409, 'INSUFFICIENT_POINTS', `${opis} izdaj`);
      }
    }
    for (const id of [V1, V2]) {
      assert.equal(await brojReleaseZa(id), 1, `${opis}: release ${id.slice(0, 6)}`);
    }
    const novi = (await firebase.db.collection('vouchers').where('uid', '==', uid).where('status', '==', 'ACTIVE').get()).size;
    assert.equal(novi, 3, `${opis}: novih voucher-a (90 bodova = 3 × SHOWER)`);
    const [dostupno, rezervisano] = await nalog(uid);
    assert.equal(dostupno + rezervisano, 90, `${opis}: zbir`);
    assert.equal(rezervisano, 30 * novi, `${opis}: reservedPoints`);
    assert.deepStrictEqual(provjeriLanac(await dogadjajiKorisnika(uid), [10, 80], opis), [dostupno, rezervisano], opis);
  }
});

// PRNG mulberry32 (fiksan seed, deterministički niz operacija).
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('I05-T19 očuvanje bodova: 250 nasumičnih operacija (seed 0x1505) → available + reserved = Σ EARN, reserved = Σ ACTIVE, release najviše jednom, lanac uzastopan', async (t) => {
  const slucajno = mulberry32(0x1505);
  const izaberi = (niz) => niz[Math.floor(slucajno() * niz.length)];
  const { uid, idToken } = await korisnik();
  await pripremiNalog(uid, 0, 0);
  const app = aplikacija();
  const raspodjela = {};
  for (let korak = 1; korak <= 250; korak += 1) {
    const vauceri = (await firebase.db.collection('vouchers').where('uid', '==', uid).get()).docs;
    const aktivni = vauceri.filter((d) => d.get('status') === 'ACTIVE');
    const operacija = izaberi(['kupovina', 'kupovina', 'izdavanje', 'izdavanje', 'cancel', 'cancel', 'uskladi', 'istek']);
    let ishod;
    if (operacija === 'kupovina') {
      const odgovor = await kupi(uid, 1 + Math.floor(slucajno() * 60_999), { app });
      assert.equal(odgovor.status, 201, `korak ${korak} kupovina: ${odgovor.text}`);
      ishod = '201';
    } else if (operacija === 'izdavanje') {
      const odgovor = await izdaj(izaberi(['CAR_WASH', 'SHOWER']), { token: idToken, app });
      assert.ok(odgovor.status === 201 || odgovor.body?.error?.code === 'INSUFFICIENT_POINTS', `korak ${korak} izdavanje: ${odgovor.text}`);
      ishod = odgovor.status === 201 ? '201' : '409';
    } else if (operacija === 'cancel' && vauceri.length > 0) {
      const odgovor = await otkazi(izaberi(vauceri).id, { token: idToken, app });
      assert.ok(
        odgovor.status === 200 || ['VOUCHER_EXPIRED', 'VOUCHER_ALREADY_REDEEMED'].includes(odgovor.body?.error?.code),
        `korak ${korak} cancel: ${odgovor.text}`,
      );
      ishod = odgovor.status === 200 ? '200' : '409';
    } else if (operacija === 'uskladi') {
      const odgovor = await uskladi({ token: idToken, app });
      assert.equal(odgovor.status, 200, `korak ${korak} API-06: ${odgovor.text}`);
      ishod = `200 (${odgovor.body.reconciledCount})`;
    } else if (operacija === 'istek' && aktivni.length > 0) {
      // Simulacija proteka vremena: expiresAt nasumičnog ACTIVE voucher-a u prošlost (status i bodovi se ne diraju).
      await izaberi(aktivni).ref.update({ expiresAt: Timestamp.fromMillis(Date.now() - 1000) });
      ishod = 'pomjeren';
    } else {
      ishod = 'preskočeno';
    }
    const kljuc = `${operacija} ${ishod}`;
    raspodjela[kljuc] = (raspodjela[kljuc] ?? 0) + 1;

    const opis = `korak ${korak} (${kljuc})`;
    const [dostupno, rezervisano] = await nalog(uid);
    assert.ok(dostupno >= 0 && rezervisano >= 0, `${opis}: negativan balance ${dostupno}/${rezervisano}`);
    const dogadjaji = await dogadjajiKorisnika(uid);
    const zaradjeno = dogadjaji.filter((d) => d.type === 'EARN').reduce((s, d) => s + d.deltaAvailable, 0);
    assert.equal(dostupno + rezervisano, zaradjeno, `${opis}: available + reserved ≠ Σ EARN`);
    const sviVauceri = (await firebase.db.collection('vouchers').where('uid', '==', uid).get()).docs;
    const rezervisanoAktivnih = sviVauceri.filter((d) => d.get('status') === 'ACTIVE').reduce((s, d) => s + d.get('costPoints'), 0);
    assert.equal(rezervisano, rezervisanoAktivnih, `${opis}: reservedPoints ≠ Σ costPoints ACTIVE`);
    for (const d of sviVauceri) {
      const reserve = dogadjaji.filter((e) => e.voucherId === d.id && e.type === 'REWARD_RESERVE').length;
      const release = dogadjaji.filter((e) => e.voucherId === d.id && e.type === 'REWARD_RELEASE').length;
      assert.equal(reserve, 1, `${opis}: RESERVE za ${d.id.slice(0, 6)}`);
      assert.equal(release, d.get('status') === 'ACTIVE' ? 0 : 1, `${opis}: RELEASE za ${d.id.slice(0, 6)} (${d.get('status')})`);
    }
    assert.deepStrictEqual(provjeriLanac(dogadjaji, [0, 0], opis), [dostupno, rezervisano], `${opis}: kraj lanca`);
  }
  t.diagnostic(`raspodjela operacija: ${JSON.stringify(raspodjela)}`);
});
