// Rules testovi nad Firestore emulatorom (projekat demo-fuelpoints).
// RULE-T12 (§30): client access nad internal/unknown kolekcijom (i podkolekcijom) → DENY.
// I08-T02 (AC-02, §25.3 … §25.5, §25.7, §25.9, NFR-03): Android ne može povećati bodove ni upisati kritično loyalty stanje.
// I01-T10 (privremen) je uklonjen u Iteraciji 3; loyaltyLedger pokriva RULE-T11 (kupovineObavjestenjaLedger.test.js).
// users dio je uklonjen u Iteraciji 2; zamjenjuju ga RULE-T01 … RULE-T05 i I02-T15 (korisnikINalog.test.js).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  collectionGroup,
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
const VRIJEME = Timestamp.fromMillis(Date.UTC(2026, 9, 19, 10, 0, 0));
const VA1 = 'a1'.repeat(32);
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

async function pripremi(dokumenti) {
  await testnoOkruzenje.withSecurityRulesDisabled(async (kontekst) => {
    const db = kontekst.firestore();
    for (const [putanja, podaci] of dokumenti) {
      await setDoc(doc(db, putanja), podaci);
    }
  });
}

async function ocekujZabranu(operacija, opis) {
  try {
    await assertFails(operacija);
  } catch (greska) {
    throw new Error(`Očekivan DENY, a operacija je dozvoljena: ${opis}`, { cause: greska });
  }
}

function konteksti() {
  return [
    ['unauthenticated', testnoOkruzenje.unauthenticatedContext()],
    [`vlasnik (${VLASNIK})`, testnoOkruzenje.authenticatedContext(VLASNIK)],
    [`drugi korisnik (${DRUGI})`, testnoOkruzenje.authenticatedContext(DRUGI)],
  ];
}

// „Vlasnik” je dokument sa uid == auth.uid; kolekcija za list je roditeljska putanja (radi i za podkolekcije).
async function provjeriZabranu(putanjeDokumenata) {
  await pripremi(putanjeDokumenata.map((putanja) => [putanja, { uid: VLASNIK, proba: true }]));
  for (const [naziv, kontekst] of konteksti()) {
    const db = kontekst.firestore();
    for (const putanja of putanjeDokumenata) {
      const kolekcija = putanja.split('/').slice(0, -1).join('/');
      await ocekujZabranu(getDoc(doc(db, putanja)), `${naziv}: get ${putanja}`);
      await ocekujZabranu(getDocs(collection(db, kolekcija)), `${naziv}: list ${kolekcija}`);
      await ocekujZabranu(
        getDocs(query(collection(db, kolekcija), where('uid', '==', VLASNIK), limit(20))),
        `${naziv}: list ${kolekcija} where uid == A limit 20`,
      );
      await ocekujZabranu(setDoc(doc(db, putanja), { uid: VLASNIK, izmjena: 1 }), `${naziv}: set ${putanja}`);
      await ocekujZabranu(
        setDoc(doc(db, `${putanja}_novi`), { uid: VLASNIK, proba: true }),
        `${naziv}: create ${putanja}_novi`,
      );
      await ocekujZabranu(updateDoc(doc(db, putanja), { izmjena: 1 }), `${naziv}: update ${putanja}`);
      await ocekujZabranu(deleteDoc(doc(db, putanja)), `${naziv}: delete ${putanja}`);
    }
  }
}

describe('RULE-T12 client access nad internal/unknown kolekcijom → DENY', () => {
  test('RULE-T12 rewardRequests: get, list, create, set, update, delete → DENY', async () => {
    await provjeriZabranu(['rewardRequests/kljuc1']);
  });

  test('RULE-T12 redemptionRequests: get, list, create, set, update, delete → DENY', async () => {
    await provjeriZabranu(['redemptionRequests/kljuc1']);
  });

  test('RULE-T12 nepoznata kolekcija: get, list, create, set, update, delete → DENY', async () => {
    await provjeriZabranu(['nepoznataKolekcija/dok1']);
  });

  test('RULE-T12 podkolekcije (i ispod dozvoljenih users/{uid} i loyaltyAccounts/{uid}) → DENY', async () => {
    await provjeriZabranu([
      'nepoznataKolekcija/dok1/podkolekcija/dok2',
      `users/${VLASNIK}/privatno/dok1`,
      `loyaltyAccounts/${VLASNIK}/istorija/dok1`,
      'rewardRequests/kljuc1/pod/dok1',
    ]);
  });

  test('RULE-T12 collectionGroup upit nad podkolekcijom → DENY', async () => {
    await pripremi([['nepoznataKolekcija/dok1/podkolekcija/dok2', { uid: VLASNIK, proba: true }]]);
    for (const [naziv, kontekst] of konteksti()) {
      const db = kontekst.firestore();
      await ocekujZabranu(getDocs(collectionGroup(db, 'podkolekcija')), `${naziv}: collectionGroup podkolekcija`);
      await ocekujZabranu(
        getDocs(query(collectionGroup(db, 'podkolekcija'), where('uid', '==', VLASNIK), limit(20))),
        `${naziv}: collectionGroup podkolekcija where uid == A limit 20`,
      );
    }
  });
});

function kanonskiNalog(availablePoints = 100) {
  return { availablePoints, reservedPoints: 0, createdAt: VRIJEME, updatedAt: VRIJEME };
}

function kanonskaKupovina(posTransactionId) {
  return {
    uid: VLASNIK,
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

function kanonskiDogadjaj(purchaseId) {
  return {
    uid: VLASNIK,
    type: 'EARN',
    deltaAvailable: 42,
    deltaReserved: 0,
    availableAfter: 142,
    reservedAfter: 0,
    purchaseId,
    voucherId: null,
    createdAt: VRIJEME,
  };
}

function kanonskiVaucer() {
  return {
    uid: VLASNIK,
    rewardId: 'CAR_WASH',
    costPoints: 50,
    status: 'ACTIVE',
    issuedAt: VRIJEME,
    expiresAt: Timestamp.fromMillis(VRIJEME.toMillis() + 15 * 60 * 1000),
    redeemedAt: null,
    cancelledAt: null,
    redeemedAtStationId: null,
  };
}

function kanonskiZahtjevNagrade() {
  return {
    uid: VLASNIK,
    requestId: '3b241101-e2bb-4255-8caf-4136c566a962',
    rewardId: 'CAR_WASH',
    voucherId: VA1,
    createdAt: VRIJEME,
  };
}

function kanonskiZahtjevOtkupa() {
  return {
    stationId: 'SIM01',
    uid: VLASNIK,
    redemptionRequestId: 'POS-RDM-001',
    voucherId: VA1,
    resultStatus: 'REDEEMED',
    createdAt: VRIJEME,
  };
}

// [postojeći dokument, novi dokument (create), izmjena koja bi povećala bodove ili upisala kritično stanje]
function kriticneKolekcije() {
  return [
    [[`loyaltyAccounts/${VLASNIK}`, kanonskiNalog()], [`loyaltyAccounts/${DRUGI}`, kanonskiNalog(1000)], { availablePoints: 1100 }],
    [['purchases/SIM01__A1', kanonskaKupovina('A1')], ['purchases/SIM01__X', kanonskaKupovina('X')], { earnedPoints: 1000 }],
    [
      ['loyaltyLedger/earn_SIM01__A1', kanonskiDogadjaj('SIM01__A1')],
      ['loyaltyLedger/earn_SIM01__X', kanonskiDogadjaj('SIM01__X')],
      { deltaAvailable: 1000 },
    ],
    [[`vouchers/${VA1}`, kanonskiVaucer()], [`vouchers/${VA9}`, kanonskiVaucer()], { status: 'ACTIVE', costPoints: 0 }],
    [
      [`rewardRequests/${VLASNIK}__kljuc1`, kanonskiZahtjevNagrade()],
      [`rewardRequests/${VLASNIK}__kljuc9`, kanonskiZahtjevNagrade()],
      { voucherId: VA9 },
    ],
    [
      ['redemptionRequests/SIM01__POS-RDM-001', kanonskiZahtjevOtkupa()],
      ['redemptionRequests/SIM01__POS-RDM-009', kanonskiZahtjevOtkupa()],
      { resultStatus: 'REDEEMED' },
    ],
  ];
}

async function procitajBezPravila(putanja) {
  let podaci;
  await testnoOkruzenje.withSecurityRulesDisabled(async (kontekst) => {
    const snimak = await getDoc(doc(kontekst.firestore(), putanja));
    podaci = snimak.exists() ? snimak.data() : undefined;
  });
  return podaci;
}

describe('I08-T02 AC-02 Android ne može povećati bodove ni upisati kritično loyalty stanje', () => {
  test('I08-T02 create, update, set merge i delete nad 6 kritičnih kolekcija (vlasnik, drugi, neautentifikovan) → DENY; stanje nepromijenjeno', async () => {
    const kolekcije = kriticneKolekcije();
    await pripremi(kolekcije.map(([postojeci]) => postojeci));
    const prije = new Map();
    for (const [[putanja]] of kolekcije) {
      prije.set(putanja, await procitajBezPravila(putanja));
    }

    for (const [naziv, kontekst] of konteksti()) {
      const db = kontekst.firestore();
      for (const [[putanja], [novaPutanja, noviPodaci], izmjena] of kolekcije) {
        await ocekujZabranu(setDoc(doc(db, novaPutanja), noviPodaci), `${naziv}: create ${novaPutanja} sa uid A`);
        await ocekujZabranu(updateDoc(doc(db, putanja), izmjena), `${naziv}: update ${putanja}`);
        await ocekujZabranu(setDoc(doc(db, putanja), izmjena, { merge: true }), `${naziv}: set merge ${putanja}`);
        await ocekujZabranu(deleteDoc(doc(db, putanja)), `${naziv}: delete ${putanja}`);
      }
      await ocekujZabranu(
        updateDoc(doc(db, `loyaltyAccounts/${VLASNIK}`), { availablePoints: 100 + 1000 }),
        `${naziv}: povećanje availablePoints za 1000 (update)`,
      );
      await ocekujZabranu(
        setDoc(doc(db, `loyaltyAccounts/${VLASNIK}`), { availablePoints: 100 + 1000 }, { merge: true }),
        `${naziv}: povećanje availablePoints za 1000 (set merge)`,
      );
    }

    for (const [[putanja], [novaPutanja]] of kolekcije) {
      assert.deepStrictEqual(await procitajBezPravila(putanja), prije.get(putanja), `${putanja} je promijenjen`);
      assert.equal(await procitajBezPravila(novaPutanja), undefined, `${novaPutanja} je kreiran`);
    }
  });
});
