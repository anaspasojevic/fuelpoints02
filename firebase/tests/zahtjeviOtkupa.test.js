// Rules test za redemptionRequests nad Firestore emulatorom (projekat demo-fuelpoints): I06-T22 (§24, §25.9, §31, D-2).
// Kolekcija je internal: ni vlasnik zapisa (uid u zapisu == auth.uid), ni drugi korisnik, ni neautentifikovan nemaju nijednu operaciju.
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

const ID_PROJEKTA = 'demo-fuelpoints';
const VLASNIK = 'vlasnik';
const DRUGI = 'drugi';
const KLJUC = 'aefc7b83dbd1da18def47c0a4965f0e3a40752420325c5a3427b6d47946be20e';
const VRIJEME = Timestamp.fromMillis(Date.UTC(2026, 9, 19, 10, 0, 0));

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
  await testnoOkruzenje.withSecurityRulesDisabled(async (kontekst) => {
    await setDoc(doc(kontekst.firestore(), `redemptionRequests/${KLJUC}`), zapis());
  });
});

after(async () => {
  await testnoOkruzenje.cleanup();
});

function zapis() {
  return {
    stationId: 'SIM01',
    uid: VLASNIK,
    redemptionRequestId: 'POS-RDM-001',
    voucherId: 'ab'.repeat(32),
    resultStatus: 'REDEEMED',
    createdAt: VRIJEME,
  };
}

async function ocekujZabranu(operacija, opis) {
  try {
    await assertFails(operacija);
  } catch (greska) {
    throw new Error(`Očekivan DENY, a operacija je dozvoljena: ${opis}`, { cause: greska });
  }
}

test('I06-T22 redemptionRequests: vlasnik, drugi korisnik i neautentifikovan → get, list, create, update, delete DENY', async () => {
  for (const [naziv, db] of [
    ['vlasnik', testnoOkruzenje.authenticatedContext(VLASNIK).firestore()],
    ['drugi korisnik', testnoOkruzenje.authenticatedContext(DRUGI).firestore()],
    ['neautentifikovan', testnoOkruzenje.unauthenticatedContext().firestore()],
  ]) {
    const zahtjevi = collection(db, 'redemptionRequests');
    await ocekujZabranu(getDoc(doc(db, `redemptionRequests/${KLJUC}`)), `${naziv}: get`);
    await ocekujZabranu(getDocs(zahtjevi), `${naziv}: list`);
    await ocekujZabranu(getDocs(query(zahtjevi, where('uid', '==', VLASNIK))), `${naziv}: list where uid == vlasnik`);
    await ocekujZabranu(setDoc(doc(db, 'redemptionRequests/novi'), zapis()), `${naziv}: create`);
    await ocekujZabranu(updateDoc(doc(db, `redemptionRequests/${KLJUC}`), { resultStatus: 'REDEEMED' }), `${naziv}: update`);
    await ocekujZabranu(deleteDoc(doc(db, `redemptionRequests/${KLJUC}`)), `${naziv}: delete`);
  }
});
