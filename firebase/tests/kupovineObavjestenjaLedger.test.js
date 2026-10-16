// Rules testovi za purchases, notifications i loyaltyLedger nad Firestore emulatorom (projekat demo-fuelpoints).
// RULE-T08, RULE-T10, RULE-T11 (§30) i I03-T20 (ostale granice §25.4, §25.5, §25.8, §31).
// Dokumenti se pripremaju bez pravila, u kanonskom obliku (§8.3, §9.2, §11).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const ID_PROJEKTA = 'demo-fuelpoints';
const VLASNIK = 'korisnikA';
const DRUGI = 'korisnikB';
const VRIJEME = Timestamp.fromMillis(Date.UTC(2026, 9, 16, 10, 0, 0));

let testnoOkruzenje;

before(async () => {
  testnoOkruzenje = await initializeTestEnvironment({
    projectId: ID_PROJEKTA,
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testnoOkruzenje.clearFirestore();
});

after(async () => {
  await testnoOkruzenje.cleanup();
});

function kanonskaKupovina(uid, posTransactionId) {
  return {
    uid,
    stationId: 'SIM01',
    posTransactionId,
    volumeMl: 42730,
    amountMinor: 7050,
    currency: 'EUR',
    earnedPoints: 42,
    occurredAt: VRIJEME,
    recordedAt: VRIJEME,
  };
}

function kanonskaNotifikacija(uid, purchaseId, dodatno = {}) {
  return {
    uid,
    type: 'POINTS_EARNED',
    title: 'Bodovi za kupovinu goriva',
    body: 'Za kupovinu goriva dobili ste 42 boda.',
    createdAt: VRIJEME,
    readAt: null,
    relatedPurchaseId: purchaseId,
    ...dodatno,
  };
}

function kanonskiDogadjaj(uid, purchaseId) {
  return {
    uid,
    type: 'EARN',
    deltaAvailable: 42,
    deltaReserved: 0,
    availableAfter: 42,
    reservedAfter: 0,
    purchaseId,
    voucherId: null,
    createdAt: VRIJEME,
  };
}

async function pripremi(dokumenti) {
  await testnoOkruzenje.withSecurityRulesDisabled(async (kontekst) => {
    const db = kontekst.firestore();
    for (const [putanja, podaci] of dokumenti) {
      await setDoc(doc(db, putanja), podaci);
    }
  });
}

async function pripremiKupovine() {
  await pripremi([
    ['purchases/SIM01__A1', kanonskaKupovina(VLASNIK, 'A1')],
    ['purchases/SIM01__A2', kanonskaKupovina(VLASNIK, 'A2')],
    ['purchases/SIM01__B1', kanonskaKupovina(DRUGI, 'B1')],
  ]);
}

async function pripremiNotifikacije() {
  await pripremi([
    ['notifications/earn_SIM01__A1', kanonskaNotifikacija(VLASNIK, 'SIM01__A1')],
    ['notifications/earn_SIM01__A2', kanonskaNotifikacija(VLASNIK, 'SIM01__A2')],
    ['notifications/earn_SIM01__B1', kanonskaNotifikacija(DRUGI, 'SIM01__B1')],
  ]);
}

async function ocekujZabranu(operacija, opis) {
  try {
    await assertFails(operacija);
  } catch (greska) {
    throw new Error(`Očekivan DENY, a operacija je dozvoljena: ${opis}`, { cause: greska });
  }
}

async function ocekujDozvolu(operacija, opis) {
  try {
    return await assertSucceeds(operacija);
  } catch (greska) {
    throw new Error(`Očekivan ALLOW, a operacija je odbijena: ${opis}`, { cause: greska });
  }
}

function bazaVlasnika() {
  return testnoOkruzenje.authenticatedContext(VLASNIK).firestore();
}

function bazaDrugog() {
  return testnoOkruzenje.authenticatedContext(DRUGI).firestore();
}

function bazaNeautentifikovanog() {
  return testnoOkruzenje.unauthenticatedContext().firestore();
}

function konteksti() {
  return [
    [VLASNIK, bazaVlasnika()],
    [DRUGI, bazaDrugog()],
    ['unauthenticated', bazaNeautentifikovanog()],
  ];
}

describe('RULE-T08 purchases', () => {
  test('RULE-T08 owner query (uid == auth.uid, limit 20) i owner get → ALLOW', async () => {
    await pripremiKupovine();
    const db = bazaVlasnika();
    const rezultat = await ocekujDozvolu(
      getDocs(query(collection(db, 'purchases'), where('uid', '==', VLASNIK), limit(20))),
      'vlasnik list purchases where uid == A limit 20',
    );
    assert.deepStrictEqual(rezultat.docs.map((d) => d.id).sort(), ['SIM01__A1', 'SIM01__A2']);
    await ocekujDozvolu(getDoc(doc(db, 'purchases/SIM01__A1')), 'vlasnik get purchases/SIM01__A1');
  });

  test('RULE-T08 direct purchase write (create, update, delete; i vlasnika) → DENY', async () => {
    await pripremiKupovine();
    for (const [naziv, db] of konteksti()) {
      await ocekujZabranu(
        setDoc(doc(db, 'purchases/SIM01__A9'), kanonskaKupovina(VLASNIK, 'A9')),
        `${naziv}: create purchases/SIM01__A9 sa uid A`,
      );
      await ocekujZabranu(updateDoc(doc(db, 'purchases/SIM01__A1'), { earnedPoints: 999 }), `${naziv}: update earnedPoints`);
      await ocekujZabranu(deleteDoc(doc(db, 'purchases/SIM01__A1')), `${naziv}: delete purchases/SIM01__A1`);
    }
  });
});

describe('RULE-T10 notifications', () => {
  test('RULE-T10 owner read i update readAt null → request.time → ALLOW', async () => {
    await pripremiNotifikacije();
    const db = bazaVlasnika();
    await ocekujDozvolu(getDoc(doc(db, 'notifications/earn_SIM01__A1')), 'vlasnik get notifikacije');
    await ocekujDozvolu(
      updateDoc(doc(db, 'notifications/earn_SIM01__A1'), { readAt: serverTimestamp() }),
      'vlasnik update readAt = request.time',
    );
  });

  test('RULE-T10 izmjena title ili body → DENY', async () => {
    await pripremiNotifikacije();
    const referenca = doc(bazaVlasnika(), 'notifications/earn_SIM01__A2');
    await ocekujZabranu(updateDoc(referenca, { title: 'x' }), 'vlasnik update title');
    await ocekujZabranu(updateDoc(referenca, { body: 'x' }), 'vlasnik update body');
    // I uz inače ispravan readAt (null → request.time): title i body ne smiju biti dio izmjene.
    await ocekujZabranu(updateDoc(referenca, { readAt: serverTimestamp(), title: 'x' }), 'vlasnik update readAt + title');
    await ocekujZabranu(updateDoc(referenca, { readAt: serverTimestamp(), body: 'x' }), 'vlasnik update readAt + body');
  });
});

describe('RULE-T11 loyaltyLedger', () => {
  test('RULE-T11 bilo kakav read/write nad loyaltyLedger (vlasnik, drugi, neautentifikovan) → DENY', async () => {
    await pripremi([['loyaltyLedger/earn_SIM01__A1', kanonskiDogadjaj(VLASNIK, 'SIM01__A1')]]);
    for (const [naziv, db] of konteksti()) {
      await ocekujZabranu(getDoc(doc(db, 'loyaltyLedger/earn_SIM01__A1')), `${naziv}: get`);
      await ocekujZabranu(getDocs(collection(db, 'loyaltyLedger')), `${naziv}: list`);
      await ocekujZabranu(
        getDocs(query(collection(db, 'loyaltyLedger'), where('uid', '==', VLASNIK), limit(20))),
        `${naziv}: list where uid == A limit 20`,
      );
      await ocekujZabranu(
        setDoc(doc(db, 'loyaltyLedger/earn_SIM01__A9'), kanonskiDogadjaj(VLASNIK, 'SIM01__A9')),
        `${naziv}: create`,
      );
      await ocekujZabranu(updateDoc(doc(db, 'loyaltyLedger/earn_SIM01__A1'), { deltaAvailable: 1000 }), `${naziv}: update`);
      await ocekujZabranu(deleteDoc(doc(db, 'loyaltyLedger/earn_SIM01__A1')), `${naziv}: delete`);
    }
  });
});

describe('I03-T20 ostale granice purchases, notifications i loyaltyLedger (§25.4, §25.5, §25.8, §31)', () => {
  test('I03-T20 purchases: upit bez limit-a, limit 21, bez uid uslova, tuđi uid, tuđi dokument, neautentifikovan → DENY', async () => {
    await pripremiKupovine();
    const db = bazaVlasnika();
    const kupovine = collection(db, 'purchases');
    await ocekujZabranu(getDocs(query(kupovine, where('uid', '==', VLASNIK))), 'where uid == A bez limit-a');
    await ocekujZabranu(getDocs(query(kupovine, where('uid', '==', VLASNIK), limit(21))), 'where uid == A limit 21');
    await ocekujZabranu(getDocs(query(kupovine, limit(20))), 'bez where, limit 20');
    await ocekujZabranu(getDocs(query(kupovine, where('uid', '==', DRUGI), limit(20))), 'where uid == B limit 20');
    await ocekujZabranu(getDoc(doc(db, 'purchases/SIM01__B1')), 'A get kupovine B');
    const neautentifikovan = bazaNeautentifikovanog();
    await ocekujZabranu(getDoc(doc(neautentifikovan, 'purchases/SIM01__A1')), 'unauthenticated get');
    await ocekujZabranu(
      getDocs(query(collection(neautentifikovan, 'purchases'), where('uid', '==', VLASNIK), limit(20))),
      'unauthenticated list',
    );
  });

  test('I03-T20 notifications: list limit 50 → ALLOW; limit 51, bez limit-a, bez uid uslova → DENY', async () => {
    await pripremiNotifikacije();
    const obavjestenja = collection(bazaVlasnika(), 'notifications');
    const rezultat = await ocekujDozvolu(
      getDocs(query(obavjestenja, where('uid', '==', VLASNIK), limit(50))),
      'vlasnik list where uid == A limit 50',
    );
    assert.equal(rezultat.size, 2);
    await ocekujZabranu(getDocs(query(obavjestenja, where('uid', '==', VLASNIK), limit(51))), 'limit 51');
    await ocekujZabranu(getDocs(query(obavjestenja, where('uid', '==', VLASNIK))), 'bez limit-a');
    await ocekujZabranu(getDocs(query(obavjestenja, limit(50))), 'bez where');
  });

  test('I03-T20 notifications update: drugi readAt, klijentsko vrijeme, readAt + title, uid, type, null → null → DENY', async () => {
    await pripremiNotifikacije();
    const db = bazaVlasnika();
    const procitana = doc(db, 'notifications/earn_SIM01__A1');
    await ocekujDozvolu(updateDoc(procitana, { readAt: serverTimestamp() }), 'prvi update readAt');
    await ocekujZabranu(updateDoc(procitana, { readAt: serverTimestamp() }), 'drugi update readAt (već postavljen)');

    const nova = doc(db, 'notifications/earn_SIM01__A2');
    await ocekujZabranu(updateDoc(nova, { readAt: Timestamp.now() }), 'readAt klijentsko vrijeme');
    await ocekujZabranu(updateDoc(nova, { readAt: serverTimestamp(), title: 'x' }), 'readAt + title');
    await ocekujZabranu(updateDoc(nova, { readAt: serverTimestamp(), uid: DRUGI }), 'readAt + uid');
    await ocekujZabranu(updateDoc(nova, { uid: DRUGI }), 'izmjena uid');
    await ocekujZabranu(updateDoc(nova, { type: 'DRUGO' }), 'izmjena type');
    await ocekujZabranu(updateDoc(nova, { readAt: null }), 'readAt null → null');
  });

  test('I03-T20 notifications: create i delete vlasnika, pristup drugog korisnika i neautentifikovanog → DENY', async () => {
    await pripremiNotifikacije();
    const db = bazaVlasnika();
    await ocekujZabranu(
      setDoc(doc(db, 'notifications/earn_SIM01__A9'), kanonskaNotifikacija(VLASNIK, 'SIM01__A9')),
      'vlasnik create notifikacije sa uid A',
    );
    await ocekujZabranu(deleteDoc(doc(db, 'notifications/earn_SIM01__A1')), 'vlasnik delete svoje notifikacije');
    const drugi = bazaDrugog();
    await ocekujZabranu(getDoc(doc(drugi, 'notifications/earn_SIM01__A1')), 'B get notifikacije A');
    await ocekujZabranu(
      updateDoc(doc(drugi, 'notifications/earn_SIM01__A1'), { readAt: serverTimestamp() }),
      'B update readAt notifikacije A',
    );
    await ocekujZabranu(getDoc(doc(bazaNeautentifikovanog(), 'notifications/earn_SIM01__A1')), 'unauthenticated get');
  });
});
