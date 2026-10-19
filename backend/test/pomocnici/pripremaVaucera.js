// Zajednički pomoćnici emulator testova i06 (otkup, O-27): priprema kanonskih dokumenata Admin SDK-om, snimak baze i §27 tijelo.
// Isti oblici kao lokalni pomoćnici i05 testova (kanonski §15 voucher sa sva tri polja stanja, konzistentan ledger).
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';

export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const VRIJEME_PRIPREME = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
export const TRAJANJE_MS = 900_000;
export const KLJUCEVI_LEDGER = [
  'availableAfter',
  'createdAt',
  'deltaAvailable',
  'deltaReserved',
  'purchaseId',
  'reservedAfter',
  'type',
  'uid',
  'voucherId',
];
export const ZABRANJENO_U_ODGOVORU = ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno', 'Nekonzistentno', 'availablePoints', 'reservedPoints'];

export const hex64 = () => randomBytes(32).toString('hex');

export function provjeriTijeloGreske(odgovor, status, kod, opis = '') {
  assert.equal(odgovor.status, status, `${opis}: status (tijelo ${odgovor.text})`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
}

export function provjeriBezInternihDetalja(odgovor, opis = '') {
  for (const zabranjeno of ZABRANJENO_U_ODGOVORU) {
    assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
  }
}

export function kanonskiKorisnik(accountStatus = 'ACTIVE') {
  return {
    displayName: 'Ana',
    accountStatus,
    createdAt: VRIJEME_PRIPREME,
    updatedAt: VRIJEME_PRIPREME,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: VRIJEME_PRIPREME,
  };
}

export function kanonskiVaucer(
  uid,
  { rewardId = 'CAR_WASH', costPoints = 50, status = 'ACTIVE', expiresAtMs, cancelledAt = null, redeemedAt = null, redeemedAtStationId = null },
) {
  return {
    uid,
    rewardId,
    costPoints,
    status,
    issuedAt: Timestamp.fromMillis(expiresAtMs - TRAJANJE_MS),
    expiresAt: Timestamp.fromMillis(expiresAtMs),
    redeemedAt,
    cancelledAt,
    redeemedAtStationId,
  };
}

// Fajl iz kojeg je neposredno pozvana mock funkcija (kao I04-T19, I05-T07); okviri ovog modula se preskaču.
export function fajlPozivaoca() {
  const izvorno = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, okviri) => okviri;
  const okviri = new Error().stack;
  Error.prepareStackTrace = izvorno;
  return okviri
    .map((okvir) => (okvir.getFileName() ?? '').replaceAll('\\', '/'))
    .find((fajl) => fajl !== '' && !fajl.startsWith('node:') && !fajl.endsWith('/pripremaVaucera.js'));
}

// Date.now za pozive iz zadatog src fajla vraća vrijednosti iz sat(); ostali pozivi idu na pravi sat. Vraća niz očitanih vrijednosti.
export function mockSataFajla(mock, sufiksFajla, sat) {
  const izvorni = Date.now;
  const ocitano = [];
  mock.method(Date, 'now', () => {
    if ((fajlPozivaoca() ?? '').endsWith(sufiksFajla)) {
      const vrijednost = sat(ocitano.length);
      ocitano.push(vrijednost);
      return vrijednost;
    }
    return izvorni.call(Date);
  });
  return ocitano;
}

// Pomoćnici vezani za jedan Admin SDK db (pravi, ne omotač).
export function napraviPripremu(db) {
  const referenca = (putanja) => db.doc(putanja);

  async function podaci(putanja) {
    const snimak = await referenca(putanja).get();
    return snimak.exists ? snimak.data() : undefined;
  }

  async function snimakBaze() {
    const rezultat = {};
    for (const kolekcija of await db.listCollections()) {
      for (const dokument of (await kolekcija.get()).docs) {
        rezultat[dokument.ref.path] = dokument.data();
      }
    }
    return rezultat;
  }

  async function pripremiNalog(uid, availablePoints, reservedPoints, accountStatus = 'ACTIVE') {
    await referenca(`users/${uid}`).set(kanonskiKorisnik(accountStatus));
    await referenca(`loyaltyAccounts/${uid}`).set({ availablePoints, reservedPoints, createdAt: VRIJEME_PRIPREME, updatedAt: VRIJEME_PRIPREME });
  }

  async function pripremiVaucer(voucherId, uid, opcije) {
    await referenca(`vouchers/${voucherId}`).set(kanonskiVaucer(uid, opcije));
  }

  async function pripremiDogadjaj(eventId, uid, type, voucherId, deltaAvailable, deltaReserved, availableAfter, reservedAfter) {
    await referenca(`loyaltyLedger/${eventId}`).set({
      uid,
      type,
      deltaAvailable,
      deltaReserved,
      availableAfter,
      reservedAfter,
      purchaseId: null,
      voucherId,
      createdAt: VRIJEME_PRIPREME,
    });
  }

  const pripremiReserve = (voucherId, uid, cijena, available, reserved) =>
    pripremiDogadjaj(`reserve_${voucherId}`, uid, 'REWARD_RESERVE', voucherId, -cijena, cijena, available, reserved);
  const pripremiRelease = (voucherId, uid, cijena, available, reserved) =>
    pripremiDogadjaj(`release_${voucherId}`, uid, 'REWARD_RELEASE', voucherId, cijena, -cijena, available, reserved);
  const pripremiRedeem = (voucherId, uid, cijena, available, reserved) =>
    pripremiDogadjaj(`redeem_${voucherId}`, uid, 'REWARD_REDEEM', voucherId, 0, -cijena, available, reserved);

  async function nalog(uid) {
    const n = await podaci(`loyaltyAccounts/${uid}`);
    return [n.availablePoints, n.reservedPoints];
  }

  async function brojDogadjaja(uid, type) {
    return (await db.collection('loyaltyLedger').where('uid', '==', uid).where('type', '==', type).get()).size;
  }

  async function brojDokumenata(kolekcija) {
    return (await db.collection(kolekcija).get()).size;
  }

  return {
    referenca,
    podaci,
    snimakBaze,
    pripremiNalog,
    pripremiVaucer,
    pripremiDogadjaj,
    pripremiReserve,
    pripremiRelease,
    pripremiRedeem,
    nalog,
    brojDogadjaja,
    brojDokumenata,
  };
}
