// Rules testovi za rewardDefinitions, vouchers i rewardRequests nad Firestore emulatorom (projekat demo-fuelpoints).
// RULE-T09 (§30) i I04-T17 (ostale granice §25.6, §25.7, §25.9, §31).
// Dokumenti se pripremaju bez pravila, u kanonskom obliku (§12, §14, §15).
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
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';

const ID_PROJEKTA = 'demo-fuelpoints';
const VLASNIK = 'korisnikA';
const DRUGI = 'korisnikB';
const IZDAT = Timestamp.fromMillis(Date.UTC(2026, 9, 17, 10, 0, 0));
const ISTICE = Timestamp.fromMillis(Date.UTC(2026, 9, 17, 10, 15, 0));
const VA1 = 'a1'.repeat(32);
const VA2 = 'a2'.repeat(32);
const VB1 = 'b1'.repeat(32);
const VA9 = 'a9'.repeat(32);

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

function kanonskiVaucer(uid, rewardId = 'CAR_WASH', costPoints = 50) {
  return {
    uid,
    rewardId,
    costPoints,
    status: 'ACTIVE',
    issuedAt: IZDAT,
    expiresAt: ISTICE,
    redeemedAt: null,
    cancelledAt: null,
    redeemedAtStationId: null,
  };
}

function kanonskiMapping(uid) {
  return {
    uid,
    requestId: '3b241101-e2bb-4255-8caf-4136c566a962',
    rewardId: 'CAR_WASH',
    voucherId: VA1,
    createdAt: IZDAT,
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

async function pripremiVaucere() {
  await pripremi([
    [`vouchers/${VA1}`, kanonskiVaucer(VLASNIK)],
    [`vouchers/${VA2}`, kanonskiVaucer(VLASNIK, 'SHOWER', 30)],
    [`vouchers/${VB1}`, kanonskiVaucer(DRUGI)],
  ]);
}

async function pripremiDefinicije() {
  await pripremi([
    ['rewardDefinitions/CAR_WASH', { displayName: 'Besplatno pranje', costPoints: 50, active: true }],
    ['rewardDefinitions/SHOWER', { displayName: 'Besplatan tuš', costPoints: 30, active: true }],
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

describe('RULE-T09 vouchers', () => {
  test('RULE-T09 owner get sopstvenog voucher-a i owner list (uid == auth.uid, limit 20) → ALLOW', async () => {
    await pripremiVaucere();
    const db = bazaVlasnika();
    await ocekujDozvolu(getDoc(doc(db, `vouchers/${VA1}`)), 'vlasnik get vouchers/VA1');
    const rezultat = await ocekujDozvolu(
      getDocs(query(collection(db, 'vouchers'), where('uid', '==', VLASNIK), limit(20))),
      'vlasnik list vouchers where uid == A limit 20',
    );
    assert.deepStrictEqual(rezultat.docs.map((d) => d.id).sort(), [VA1, VA2]);
  });

  test('RULE-T09 voucher write (create, update status/costPoints, delete; i vlasnika) → DENY', async () => {
    await pripremiVaucere();
    for (const [naziv, db] of konteksti()) {
      await ocekujZabranu(setDoc(doc(db, `vouchers/${VA9}`), kanonskiVaucer(VLASNIK)), `${naziv}: create voucher-a sa uid A`);
      await ocekujZabranu(updateDoc(doc(db, `vouchers/${VA1}`), { status: 'EXPIRED' }), `${naziv}: update status`);
      await ocekujZabranu(updateDoc(doc(db, `vouchers/${VA1}`), { costPoints: 1 }), `${naziv}: update costPoints`);
      await ocekujZabranu(deleteDoc(doc(db, `vouchers/${VA1}`)), `${naziv}: delete`);
    }
  });
});

describe('I04-T17 ostale granice vouchers, rewardDefinitions i rewardRequests (§25.6, §25.7, §25.9, §31)', () => {
  test('I04-T17 vouchers: upit bez limit-a, limit 21, bez uid uslova, tuđi uid, tuđi dokument, neautentifikovan → DENY', async () => {
    await pripremiVaucere();
    const db = bazaVlasnika();
    const vauceri = collection(db, 'vouchers');
    await ocekujZabranu(getDocs(query(vauceri, where('uid', '==', VLASNIK))), 'where uid == A bez limit-a');
    await ocekujZabranu(getDocs(query(vauceri, where('uid', '==', VLASNIK), limit(21))), 'where uid == A limit 21');
    await ocekujZabranu(getDocs(query(vauceri, limit(20))), 'bez where, limit 20');
    await ocekujZabranu(getDocs(query(vauceri, where('uid', '==', DRUGI), limit(20))), 'where uid == B limit 20');
    await ocekujZabranu(getDoc(doc(db, `vouchers/${VB1}`)), 'A get voucher-a B');
    const neautentifikovan = bazaNeautentifikovanog();
    await ocekujZabranu(getDoc(doc(neautentifikovan, `vouchers/${VA1}`)), 'unauthenticated get');
    await ocekujZabranu(
      getDocs(query(collection(neautentifikovan, 'vouchers'), where('uid', '==', VLASNIK), limit(20))),
      'unauthenticated list',
    );
  });

  test('I04-T17 rewardDefinitions: prijavljen get/list → ALLOW; neautentifikovan → DENY; create/update/delete → DENY', async () => {
    await pripremiDefinicije();
    for (const db of [bazaVlasnika(), bazaDrugog()]) {
      await ocekujDozvolu(getDoc(doc(db, 'rewardDefinitions/CAR_WASH')), 'prijavljen get CAR_WASH');
      const rezultat = await ocekujDozvolu(getDocs(collection(db, 'rewardDefinitions')), 'prijavljen list rewardDefinitions');
      assert.deepStrictEqual(rezultat.docs.map((d) => d.id).sort(), ['CAR_WASH', 'SHOWER']);
    }
    const neautentifikovan = bazaNeautentifikovanog();
    await ocekujZabranu(getDoc(doc(neautentifikovan, 'rewardDefinitions/CAR_WASH')), 'unauthenticated get');
    await ocekujZabranu(getDocs(collection(neautentifikovan, 'rewardDefinitions')), 'unauthenticated list');
    for (const [naziv, db] of konteksti()) {
      await ocekujZabranu(
        setDoc(doc(db, 'rewardDefinitions/NOVA'), { displayName: 'Nova', costPoints: 1, active: true }),
        `${naziv}: create nove definicije`,
      );
      await ocekujZabranu(updateDoc(doc(db, 'rewardDefinitions/CAR_WASH'), { costPoints: 1 }), `${naziv}: update costPoints`);
      await ocekujZabranu(deleteDoc(doc(db, 'rewardDefinitions/CAR_WASH')), `${naziv}: delete`);
    }
  });

  test('I04-T17 rewardRequests: i dokument sa uid == auth.uid → DENY za get, list, set, update, delete', async () => {
    const kljuc = 'f'.repeat(64);
    await pripremi([[`rewardRequests/${kljuc}`, kanonskiMapping(VLASNIK)]]);
    for (const [naziv, db] of konteksti()) {
      await ocekujZabranu(getDoc(doc(db, `rewardRequests/${kljuc}`)), `${naziv}: get`);
      await ocekujZabranu(
        getDocs(query(collection(db, 'rewardRequests'), where('uid', '==', VLASNIK), limit(20))),
        `${naziv}: list where uid == A limit 20`,
      );
      await ocekujZabranu(setDoc(doc(db, `rewardRequests/${'e'.repeat(64)}`), kanonskiMapping(VLASNIK)), `${naziv}: set`);
      await ocekujZabranu(updateDoc(doc(db, `rewardRequests/${kljuc}`), { rewardId: 'SHOWER' }), `${naziv}: update`);
      await ocekujZabranu(deleteDoc(doc(db, `rewardRequests/${kljuc}`)), `${naziv}: delete`);
    }
  });
});
