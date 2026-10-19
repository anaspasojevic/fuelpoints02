// Zajednički pomoćnici emulator testova i07 (brisanje naloga, §23): zahtjevi kroz prave API rute, primjer brief-a (korisnici A i B),
// snimak dokumenata po uid-u i provjera konačnog stanja primjera A (API-T12). Vezani za jedan Admin SDK (firebase) i POS ključ stanice SIM01.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { procitajPosKljuceve } from '../../src/konfiguracija/posKljucevi.js';
import { napraviKorisnika } from './authEmulator.js';
import { generisiPosKljuc, posKonfiguracija } from './posKljuc.js';
import { napraviPripremu } from './pripremaVaucera.js';

export const SVJEZINA = '/src/posrednici/svjezinaPrijave.js';
export const SERVIS_BRISANJA = '/src/servisi/brisanjeNaloga.js';
// Kolekcije §24 čiji dokumenti nose polje uid.
export const SA_UID = ['purchases', 'loyaltyLedger', 'vouchers', 'notifications', 'rewardRequests', 'redemptionRequests'];

export function authTimeTokena(idToken) {
  return JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8')).auth_time;
}

// Oznaka upisa iz dnevnika omotača: "<metod> <kolekcija>" ili "deleteUser".
export function oznakaUpisa(upis) {
  return upis.metod === 'deleteUser' ? 'deleteUser' : `${upis.metod} ${upis.putanja.split('/')[0]}`;
}

export function napraviPripremuBrisanja(firebase) {
  const kljucPos = generisiPosKljuc();
  const posStanice = procitajPosKljuceve(posKonfiguracija([['SIM01', kljucPos]])).stanice;
  const p = napraviPripremu(firebase.db);
  let brojac = 0;

  function aplikacija({ db = firebase.db, auth = firebase.auth, dodajRute } = {}) {
    return napraviAplikaciju({ servisi: { ...firebase, db, auth }, verzijaUslova: '1.0', posStanice, dodajRute });
  }

  // idToken null → bez Authorization; tijelo undefined → bez tijela; string → sirovo.
  function obrisi(idToken, { db, auth, tijelo, zaglavlja = {}, metod = 'delete', putanja = '/api/v1/account' } = {}) {
    const zahtjev = request(aplikacija({ db, auth }))[metod](putanja);
    if (idToken !== null) {
      zahtjev.set('Authorization', `Bearer ${idToken}`);
    }
    for (const [naziv, vrijednost] of Object.entries(zaglavlja)) {
      zahtjev.set(naziv, vrijednost);
    }
    return tijelo === undefined ? zahtjev : zahtjev.send(tijelo);
  }

  async function noviKorisnik() {
    brojac += 1;
    const korisnik = await napraviKorisnika(`korisnik${brojac}@primjer.test`);
    return { ...korisnik, authTime: authTimeTokena(korisnik.idToken) };
  }

  async function postojiAuth(uid) {
    try {
      await firebase.auth.getUser(uid);
      return true;
    } catch (greska) {
      if (greska?.code === 'auth/user-not-found') {
        return false;
      }
      throw greska;
    }
  }

  function zahtjevInita(k, { db, displayName = 'Ana' } = {}) {
    return request(aplikacija({ db }))
      .post('/api/v1/account/init')
      .set('Authorization', `Bearer ${k.idToken}`)
      .send({ displayName, acceptedTermsVersion: '1.0' });
  }

  function zahtjevKupovine(uid, posTransactionId, volumeMl, { db } = {}) {
    return request(aplikacija({ db }))
      .post('/api/v1/pos/purchases')
      .set('X-POS-API-Key', kljucPos)
      .send({ loyaltyUid: uid, posTransactionId, volumeMl, amountMinor: 7050, currency: 'EUR', occurredAt: new Date(Date.now() - 60_000).toISOString() });
  }

  function zahtjevIzdavanja(k, rewardId, { db, requestId = randomUUID() } = {}) {
    return request(aplikacija({ db }))
      .post(`/api/v1/rewards/${rewardId}/issue`)
      .set('Authorization', `Bearer ${k.idToken}`)
      .send({ requestId });
  }

  function zahtjevOtkupa(voucherId, redemptionRequestId, { db } = {}) {
    return request(aplikacija({ db }))
      .post(`/api/v1/pos/vouchers/${voucherId}/redeem`)
      .set('X-POS-API-Key', kljucPos)
      .send({ redemptionRequestId });
  }

  function zahtjevOtkazivanja(k, voucherId, { db } = {}) {
    return request(aplikacija({ db })).post(`/api/v1/vouchers/${voucherId}/cancel`).set('Authorization', `Bearer ${k.idToken}`);
  }

  function zahtjevUskladjivanja(k, { db } = {}) {
    return request(aplikacija({ db })).post('/api/v1/account/vouchers/reconcile').set('Authorization', `Bearer ${k.idToken}`);
  }

  async function init(k, opcije) {
    const odgovor = await zahtjevInita(k, opcije);
    assert.equal(odgovor.status, 201, odgovor.text);
  }

  async function kupi(uid, posTransactionId, volumeMl) {
    const odgovor = await zahtjevKupovine(uid, posTransactionId, volumeMl);
    assert.equal(odgovor.status, 201, odgovor.text);
  }

  async function izdaj(k, rewardId, opcije) {
    const odgovor = await zahtjevIzdavanja(k, rewardId, opcije);
    assert.equal(odgovor.status, 201, odgovor.text);
    return odgovor.body.voucherId;
  }

  async function otkupi(voucherId, redemptionRequestId) {
    const odgovor = await zahtjevOtkupa(voucherId, redemptionRequestId);
    assert.equal(odgovor.status, 200, odgovor.text);
  }

  async function otkazi(k, voucherId) {
    const odgovor = await zahtjevOtkazivanja(k, voucherId);
    assert.equal(odgovor.status, 200, odgovor.text);
  }

  // Primjer brief-a (tačka 1) kroz prave API pozive: 42 730 ml (42) i 30 000 ml (30) → 72 / 0; issue CAR_WASH → 22 / 50; 2 notifikacije.
  async function pripremiKorisnikaA() {
    const k = await noviKorisnik();
    await init(k);
    await kupi(k.uid, 'POS-A1', 42_730);
    await kupi(k.uid, 'POS-A2', 30_000);
    assert.deepStrictEqual(await p.nalog(k.uid), [72, 0]);
    const V = await izdaj(k, 'CAR_WASH');
    assert.deepStrictEqual(await p.nalog(k.uid), [22, 50]);
    return { k, V };
  }

  // Korisnik B: init, 30 000 ml (30), issue SHOWER → 0 / 30.
  async function pripremiKorisnikaB() {
    const k = await noviKorisnik();
    await init(k);
    await kupi(k.uid, 'POS-B1', 30_000);
    const V = await izdaj(k, 'SHOWER');
    return { k, V };
  }

  // Svi dokumenti korisnika: users i loyaltyAccounts po ID-u, ostale kolekcije §24 po polju uid.
  async function snimakPoUid(uid) {
    const rezultat = {};
    for (const kolekcija of ['users', 'loyaltyAccounts']) {
      const snimak = await firebase.db.doc(`${kolekcija}/${uid}`).get();
      if (snimak.exists) {
        rezultat[snimak.ref.path] = snimak.data();
      }
    }
    for (const kolekcija of SA_UID) {
      for (const dokument of (await firebase.db.collection(kolekcija).where('uid', '==', uid).get()).docs) {
        rezultat[dokument.ref.path] = dokument.data();
      }
    }
    return rezultat;
  }

  async function brojSaUid(kolekcija, uid) {
    return (await firebase.db.collection(kolekcija).where('uid', '==', uid).get()).size;
  }

  async function bezDokumenataKorisnika(uid, opis = '') {
    assert.equal(await p.podaci(`users/${uid}`), undefined, `${opis}: users postoji`);
    assert.equal(await p.podaci(`loyaltyAccounts/${uid}`), undefined, `${opis}: loyaltyAccounts postoji`);
    for (const kolekcija of SA_UID) {
      assert.equal(await brojSaUid(kolekcija, uid), 0, `${opis}: ${kolekcija} sa uid korisnika`);
    }
  }

  // Konačno stanje primjera A poslije brisanja (API-T12): ništa sa uid A, 2 purchases i 4 ledger događaja sa uid null, ostala polja
  // nepromijenjena (osim novog release_V), Auth nalog ne postoji. Ista provjera za prvo i nastavljeno brisanje.
  async function provjeriObrisanA(uid, V, prije, opis = '') {
    await bezDokumenataKorisnika(uid, opis);
    for (const putanja of [`vouchers/${V}`, 'notifications/earn_SIM01__POS-A1', 'notifications/earn_SIM01__POS-A2']) {
      assert.equal(await p.podaci(putanja), undefined, `${opis}: ${putanja} postoji`);
    }
    const pseudonimizovani = [
      'purchases/SIM01__POS-A1',
      'purchases/SIM01__POS-A2',
      'loyaltyLedger/earn_SIM01__POS-A1',
      'loyaltyLedger/earn_SIM01__POS-A2',
      `loyaltyLedger/reserve_${V}`,
    ];
    for (const putanja of pseudonimizovani) {
      assert.ok(prije[putanja] !== undefined, `${opis}: ${putanja} nije bio u snimku prije`);
      assert.deepStrictEqual(await p.podaci(putanja), { ...prije[putanja], uid: null }, `${opis}: ${putanja}`);
    }
    const { createdAt, ...release } = await p.podaci(`loyaltyLedger/release_${V}`);
    assert.ok(createdAt instanceof Timestamp, `${opis}: release createdAt`);
    assert.deepStrictEqual(
      release,
      { uid: null, type: 'REWARD_RELEASE', deltaAvailable: 50, deltaReserved: -50, availableAfter: 72, reservedAfter: 0, purchaseId: null, voucherId: V },
      `${opis}: release_V`,
    );
    assert.equal(await brojSaUid('purchases', null), 2, `${opis}: purchases sa uid null`);
    assert.equal(await brojSaUid('loyaltyLedger', null), 4, `${opis}: ledger sa uid null`);
    assert.equal(await postojiAuth(uid), false, `${opis}: Auth nalog postoji`);
  }

  return {
    p,
    aplikacija,
    obrisi,
    noviKorisnik,
    postojiAuth,
    zahtjevInita,
    zahtjevKupovine,
    zahtjevIzdavanja,
    zahtjevOtkupa,
    zahtjevOtkazivanja,
    zahtjevUskladjivanja,
    init,
    kupi,
    izdaj,
    otkupi,
    otkazi,
    pripremiKorisnikaA,
    pripremiKorisnikaB,
    snimakPoUid,
    brojSaUid,
    bezDokumenataKorisnika,
    provjeriObrisanA,
  };
}
