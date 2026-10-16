// Atomičnost, konkurentnost i kasni commit kupovine (§9, §9.3, §10, NFR-04, NFR-05): I03-T10, I03-T11, I03-T12, I03-T13.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));

const K1 = generisiPosKljuc();
const POS_STANICE = procitajPosKljuceve(posKonfiguracija([['SIM01', K1]])).stanice;

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

function aplikacija(db = firebase.db) {
  return napraviAplikaciju({ servisi: { ...firebase, db }, verzijaUslova: '1.0', posStanice: POS_STANICE });
}

function kupi(tijelo, { db, app } = {}) {
  return request(app ?? aplikacija(db)).post('/api/v1/pos/purchases').set('X-POS-API-Key', K1).send(tijelo);
}

function tijeloKupovine(dodatno = {}) {
  return {
    loyaltyUid: 'korisnikA',
    posTransactionId: 'X',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAt: new Date(Date.now() - 60_000).toISOString(),
    ...dodatno,
  };
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
  for (const zabranjeno of ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno', 'Nekonzistentno', 'loyaltyAccounts']) {
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

async function brojDokumenata(kolekcija) {
  return (await firebase.db.collection(kolekcija).get()).size;
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

async function pripremiNalog(uid, { availablePoints = 10, reservedPoints = 3 } = {}) {
  await referenca(`users/${uid}`).set({
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  });
  await referenca(`loyaltyAccounts/${uid}`).set({
    availablePoints,
    reservedPoints,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
  });
}

function kanonskaKupovina(posTransactionId, dodatno = {}) {
  return {
    uid: 'korisnikA',
    stationId: 'SIM01',
    posTransactionId,
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    earnedPoints: 42,
    occurredAt: VRIJEME_PRIPREME,
    recordedAt: VRIJEME_PRIPREME,
    ...dodatno,
  };
}

const PUTANJE_UPISA = [
  { metod: 'create', putanja: 'purchases/SIM01__X' },
  { metod: 'update', putanja: 'loyaltyAccounts/korisnikA' },
  { metod: 'create', putanja: 'loyaltyLedger/earn_SIM01__X' },
  { metod: 'create', putanja: 'notifications/earn_SIM01__X' },
];

test('I03-T10 (a), (b) failure injection na svakom od četiri upisa i prije commit-a → 500 bez stack-a, nijedan novi zapis', async () => {
  await pripremiNalog('korisnikA');
  const pocetno = await snimakBaze();
  const tijelo = tijeloKupovine();

  for (let upis = 1; upis <= 4; upis += 1) {
    const omotac = omotacBaze(firebase.db, { baciNaUpisu: upis });
    const odgovor = await kupi(tijelo, { db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `(a) upis ${upis}`);
    provjeriBezInternihDetalja(odgovor, `(a) upis ${upis}`);
    assert.deepStrictEqual(omotac.upisi, PUTANJE_UPISA.slice(0, upis), `(a) upis ${upis}: zabilježeni upisi`);
    assert.deepStrictEqual(await snimakBaze(), pocetno, `(a) upis ${upis}: baza promijenjena`);
  }

  const prijeCommita = omotacBaze(firebase.db, { baciPrijeCommita: true });
  const odgovor = await kupi(tijelo, { db: prijeCommita });
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', '(b) prije commit-a');
  provjeriBezInternihDetalja(odgovor, '(b)');
  assert.deepStrictEqual(prijeCommita.upisi, PUTANJE_UPISA, '(b) callback nije upisao sva četiri dokumenta');
  assert.deepStrictEqual(await snimakBaze(), pocetno, '(b) baza promijenjena');
  assert.equal(await brojDokumenata('purchases'), 0);
  assert.equal(await brojDokumenata('loyaltyLedger'), 0);
  assert.equal(await brojDokumenata('notifications'), 0);

  const kontrola = omotacBaze(firebase.db);
  assert.equal((await kupi(tijelo, { db: kontrola })).status, 201, 'kontrola: omotač bez opcija');
  assert.deepStrictEqual(kontrola.upisi, PUTANJE_UPISA);
  assert.equal(await brojDokumenata('purchases'), 1);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  assert.equal(await brojDokumenata('notifications'), 1);
});

test('I03-T10 (c) zastarjelo čitanje purchase-a poslije uspješne kupovine → 500/503, i dalje jedan EARN i jedna notifikacija', async (t) => {
  await pripremiNalog('korisnikA');
  const tijelo = tijeloKupovine();
  assert.equal((await kupi(tijelo)).status, 201);
  const stanje = await snimakBaze();

  const omotac = omotacBaze(firebase.db, { sakrijPostojece: ['purchases/SIM01__X'] });
  const odgovor = await kupi(tijelo, { db: omotac });
  t.diagnostic(`(c) sakriven purchases/SIM01__X: HTTP ${odgovor.status} ${odgovor.body.error?.code}`);
  assert.ok([500, 503].includes(odgovor.status), `status ${odgovor.status}`);
  provjeriTijeloGreske(odgovor, odgovor.status, odgovor.status === 500 ? 'INTERNAL_ERROR' : 'SERVICE_UNAVAILABLE', '(c)');
  provjeriBezInternihDetalja(odgovor, '(c)');
  assert.deepStrictEqual(await snimakBaze(), stanje);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  assert.equal(await brojDokumenata('notifications'), 1);
});

// K-1 (Orchestrator): postoji SAMO purchase (bez ledger eventa i notifikacije), a čitanje ga ne vidi. tx.create purchase-a
// mora oboriti cijeli commit; tx.set bi prepisao purchase i dodao bodove.
test('I03-T10 (c2) sakriven postojeći purchase bez ledger eventa i notifikacije → 500, purchase nepromijenjen, ništa upisano', async (t) => {
  await pripremiNalog('korisnikA');
  await referenca('purchases/SIM01__Z').set(kanonskaKupovina('Z'));
  const stanje = await snimakBaze();

  const omotac = omotacBaze(firebase.db, { sakrijPostojece: ['purchases/SIM01__Z'] });
  const odgovor = await kupi(tijeloKupovine({ posTransactionId: 'Z' }), { db: omotac });
  t.diagnostic(`(c2) HTTP ${odgovor.status} ${odgovor.body.error?.code}`);
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', '(c2)');
  provjeriBezInternihDetalja(odgovor, '(c2)');
  assert.ok(omotac.upisi.length >= 1, '(c2) transakcija nije pokušala upis');
  assert.deepStrictEqual(await podaci('purchases/SIM01__Z'), kanonskaKupovina('Z'));
  assert.equal(await brojDokumenata('loyaltyLedger'), 0);
  assert.equal(await brojDokumenata('notifications'), 0);
  assert.deepStrictEqual(await snimakBaze(), stanje);
});

test('I03-T10 (d) purchase pod istim ID-em sa drugim stationId (O-13) → 500, ništa promijenjeno', async () => {
  await pripremiNalog('korisnikA');
  await referenca('purchases/SIM01__X').set(kanonskaKupovina('X', { stationId: 'SIM02' }));
  const stanje = await snimakBaze();
  const odgovor = await kupi(tijeloKupovine());
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', '(d)');
  provjeriBezInternihDetalja(odgovor, '(d)');
  assert.deepStrictEqual(await snimakBaze(), stanje);

  await referenca('purchases/SIM01__X').set(kanonskaKupovina('X', { posTransactionId: 'drugi' }));
  const stanje2 = await snimakBaze();
  provjeriTijeloGreske(await kupi(tijeloKupovine()), 500, 'INTERNAL_ERROR', '(d) drugi posTransactionId');
  assert.deepStrictEqual(await snimakBaze(), stanje2);
});

test('I03-T10 (e) postoji notifikacija ili ledger event za purchase koji ne postoji → 500, ništa upisano', async () => {
  for (const [opis, putanja, dokument] of [
    ['notifikacija', 'notifications/earn_SIM01__Y', { uid: 'korisnikA', type: 'POINTS_EARNED' }],
    ['ledger event', 'loyaltyLedger/earn_SIM01__Y', { uid: 'korisnikA', type: 'EARN' }],
  ]) {
    await ocistiEmulatore();
    await pripremiNalog('korisnikA');
    await referenca(putanja).set(dokument);
    const stanje = await snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await kupi(tijeloKupovine({ posTransactionId: 'Y' }), { db: omotac });
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `(e) ${opis}`);
    provjeriBezInternihDetalja(odgovor, `(e) ${opis}`);
    // Transakcija pada na provjeri nekonzistentnog stanja PRIJE upisa (ne tek na commit-u zbog tx.create).
    assert.deepStrictEqual(omotac.upisi, [], `(e) ${opis}: transakcija je pokušala upis`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `(e) ${opis}: baza promijenjena`);
  }
});

test('I03-T10 (f) neispravan loyaltyAccounts (negativan ili ne-integer balans) → 500, ništa upisano (i03/P-15)', async () => {
  for (const [opis, nalog] of [
    ['availablePoints -1', { availablePoints: -1 }],
    ["availablePoints '10'", { availablePoints: '10' }],
    ['availablePoints 1.5', { availablePoints: 1.5 }],
    ['reservedPoints -1', { reservedPoints: -1 }],
  ]) {
    await ocistiEmulatore();
    await pripremiNalog('korisnikA');
    await referenca('loyaltyAccounts/korisnikA').update(nalog);
    const stanje = await snimakBaze();
    const odgovor = await kupi(tijeloKupovine());
    provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR', `(f) ${opis}`);
    provjeriBezInternihDetalja(odgovor, `(f) ${opis}`);
    assert.deepStrictEqual(await snimakBaze(), stanje, `(f) ${opis}: baza promijenjena`);
  }
});

test('I03-T11 10 paralelnih identičnih zahtjeva → 1 purchase, 1 EARN, 1 notifikacija, bez 500, najviše jedan 201 (3 ponavljanja)', async (t) => {
  for (let ponavljanje = 0; ponavljanje < 3; ponavljanje += 1) {
    await ocistiEmulatore();
    await pripremiNalog('korisnikA', { availablePoints: 10, reservedPoints: 3 });
    const tijelo = tijeloKupovine();
    const app = aplikacija();
    const odgovori = await Promise.all(Array.from({ length: 10 }, () => kupi(tijelo, { app })));
    const statusi = odgovori.map((odgovor) => odgovor.status);
    t.diagnostic(`ponavljanje ${ponavljanje + 1}: statusi ${statusi.join(',')}`);
    assert.ok(statusi.every((status) => [200, 201, 503].includes(status)), `statusi: ${statusi.join(',')}`);
    assert.ok(statusi.filter((status) => status === 201).length <= 1, `statusi: ${statusi.join(',')}`);
    for (const odgovor of odgovori.filter((o) => o.status === 503)) {
      provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', '503 pod kontencijom');
    }
    const uspjesni = odgovori.filter((odgovor) => odgovor.status === 200 || odgovor.status === 201);
    for (const odgovor of uspjesni) {
      assert.deepStrictEqual(odgovor.body, uspjesni[0].body);
    }

    assert.equal(await brojDokumenata('purchases'), 1);
    assert.equal(await brojDokumenata('loyaltyLedger'), 1);
    assert.equal(await brojDokumenata('notifications'), 1);
    assert.equal((await podaci('loyaltyAccounts/korisnikA')).availablePoints, 52);
    assert.equal((await podaci('loyaltyAccounts/korisnikA')).reservedPoints, 3);

    const naknadni = await kupi(tijelo);
    assert.equal(naknadni.status, 200, 'naknadni sekvencijalni retry');
    if (uspjesni.length > 0) {
      assert.deepStrictEqual(naknadni.body, uspjesni[0].body);
    }
    assert.equal(naknadni.body.earnedPoints, 42);
    assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  }
});

test('I03-T12 10 paralelnih različitih kupovina istog korisnika → tačan zbir i konzistentan niz availableAfter', async (t) => {
  await pripremiNalog('korisnikA', { availablePoints: 5, reservedPoints: 3 });
  const app = aplikacija();
  const zahtjevi = Array.from({ length: 10 }, (_, i) =>
    tijeloKupovine({ posTransactionId: `R${i}`, volumeMl: 1000 * (i + 1) + i }),
  );
  let broj503 = 0;
  // Svaki 503 se ponavlja ISTIM zahtjevom (idempotentno), najviše 20 pokušaja po zahtjevu.
  async function doUspjeha(tijelo) {
    for (let pokusaj = 1; pokusaj <= 20; pokusaj += 1) {
      const odgovor = await kupi(tijelo, { app });
      if (odgovor.status === 503) {
        provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', `${tijelo.posTransactionId} pokušaj ${pokusaj}`);
        broj503 += 1;
        continue;
      }
      return odgovor;
    }
    throw new Error(`${tijelo.posTransactionId}: nema uspjeha poslije 20 pokušaja`);
  }
  const odgovori = await Promise.all(zahtjevi.map(doUspjeha));
  t.diagnostic(`statusi: ${odgovori.map((o) => o.status).join(',')}; broj 503: ${broj503}`);
  for (const [i, odgovor] of odgovori.entries()) {
    assert.ok([200, 201].includes(odgovor.status), `R${i}: status ${odgovor.status}`);
    assert.equal(odgovor.body.earnedPoints, i + 1);
  }

  const nalog = await podaci('loyaltyAccounts/korisnikA');
  assert.equal(nalog.availablePoints, 5 + 55);
  assert.equal(nalog.reservedPoints, 3);
  const dogadjaji = (await firebase.db.collection('loyaltyLedger').get()).docs.map((d) => d.data());
  assert.equal(dogadjaji.length, 10);
  dogadjaji.sort((a, b) => a.availableAfter - b.availableAfter);
  let prethodni = 5;
  for (const dogadjaj of dogadjaji) {
    assert.equal(dogadjaj.type, 'EARN');
    assert.equal(dogadjaj.availableAfter, prethodni + dogadjaj.deltaAvailable, `niz availableAfter (${dogadjaj.purchaseId})`);
    assert.equal(dogadjaj.reservedAfter, 3);
    prethodni = dogadjaj.availableAfter;
  }
  assert.equal(prethodni, 60);
  assert.equal(await brojDokumenata('purchases'), 10);
  assert.equal(await brojDokumenata('notifications'), 10);
});

test('I03-T13 kasni commit poslije 503 → POS retry vraća prvi rezultat, tačno jedan EARN', async (t) => {
  await pripremiNalog('korisnikA', { availablePoints: 10, reservedPoints: 3 });
  const tijelo = tijeloKupovine({ posTransactionId: 'KASNO' });
  const omotac = omotacBaze(firebase.db, { zadrziPrijeCommitaMs: ROK_ZAVISNOG_SERVISA_MS + 500 });
  const pocetak = Date.now();
  const odgovor = await kupi(tijelo, { db: omotac });
  const trajanje = Date.now() - pocetak;
  t.diagnostic(`prvi zahtjev: HTTP ${odgovor.status} za ${trajanje} ms`);
  provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', 'prvi zahtjev');
  assert.ok(trajanje < 12_000, `503 je stigao za ${trajanje} ms`);

  await omotac.commitZavrsen;
  for (const putanja of ['purchases/SIM01__KASNO', 'loyaltyLedger/earn_SIM01__KASNO', 'notifications/earn_SIM01__KASNO']) {
    assert.ok(await podaci(putanja), `${putanja} ne postoji poslije kasnog commit-a`);
  }
  assert.equal((await podaci('loyaltyAccounts/korisnikA')).availablePoints, 52);

  const ocekivano = {
    purchaseId: 'SIM01__KASNO',
    stationId: 'SIM01',
    posTransactionId: 'KASNO',
    volumeMl: tijelo.volumeMl,
    amountMinor: tijelo.amountMinor,
    currency: 'EUR',
    earnedPoints: 42,
    occurredAt: tijelo.occurredAt,
  };
  const retry = await kupi(tijelo);
  assert.equal(retry.status, 200);
  assert.deepStrictEqual(retry.body, ocekivano);
  const drugiRetry = await kupi(tijelo);
  assert.equal(drugiRetry.status, 200);
  assert.equal(drugiRetry.text, retry.text);
  assert.equal(await brojDokumenata('loyaltyLedger'), 1);
  assert.equal(await brojDokumenata('notifications'), 1);
  assert.equal((await podaci('loyaltyAccounts/korisnikA')).availablePoints, 52);
});
