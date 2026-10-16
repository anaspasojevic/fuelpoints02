// Rules testovi nad Firestore emulatorom (projekat demo-fuelpoints).
// RULE-T12 (preliminarno, §30): internal/unknown kolekcije → DENY. Konačan oblik u Iteraciji 8.
// I01-T10 (privremen) je uklonjen u Iteraciji 3; loyaltyLedger pokriva RULE-T11 (kupovineObavjestenjaLedger.test.js).
// users dio je uklonjen u Iteraciji 2; zamjenjuju ga RULE-T01 … RULE-T05 i I02-T15 (korisnikINalog.test.js).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from 'firebase/firestore';

const ID_PROJEKTA = 'demo-fuelpoints';
const VLASNIK = 'korisnikA';

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

async function pripremiDokumente(putanje) {
  await testnoOkruzenje.withSecurityRulesDisabled(async (kontekst) => {
    const db = kontekst.firestore();
    for (const putanja of putanje) {
      await setDoc(doc(db, putanja), { proba: true });
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
    [`authenticated (${VLASNIK})`, testnoOkruzenje.authenticatedContext(VLASNIK)],
  ];
}

async function provjeriZabranu(putanjeDokumenata) {
  await pripremiDokumente(putanjeDokumenata);
  for (const [naziv, kontekst] of konteksti()) {
    const db = kontekst.firestore();
    for (const putanja of putanjeDokumenata) {
      const kolekcija = putanja.split('/')[0];
      await ocekujZabranu(getDoc(doc(db, putanja)), `${naziv}: get ${putanja}`);
      await ocekujZabranu(getDocs(collection(db, kolekcija)), `${naziv}: list ${kolekcija}`);
      await ocekujZabranu(setDoc(doc(db, putanja), { izmjena: 1 }), `${naziv}: set ${putanja}`);
      await ocekujZabranu(deleteDoc(doc(db, putanja)), `${naziv}: delete ${putanja}`);
    }
  }
}

describe('RULE-T12 (preliminarno) client access nad internal/unknown kolekcijom → DENY', () => {
  test('RULE-T12 rewardRequests: get, set, delete, list → DENY', async () => {
    await provjeriZabranu(['rewardRequests/kljuc1']);
  });

  test('RULE-T12 redemptionRequests: get, set, delete, list → DENY', async () => {
    await provjeriZabranu(['redemptionRequests/kljuc1']);
  });

  test('RULE-T12 nepoznata kolekcija: get, set, delete, list → DENY', async () => {
    await provjeriZabranu(['nepoznataKolekcija/dok1']);
  });
});
