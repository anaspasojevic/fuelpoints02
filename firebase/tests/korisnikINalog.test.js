// Rules testovi za users i loyaltyAccounts nad Firestore emulatorom (projekat demo-fuelpoints).
// RULE-T01 … RULE-T07 (§30) i I02-T15 (ostale granice §25.2, §25.3, §31).
// Dokumenti se pripremaju bez pravila, u kanonskom obliku (AUTH-02, §7.1).
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
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';

const ID_PROJEKTA = 'demo-fuelpoints';
const VLASNIK = 'korisnikA';
const DRUGI = 'korisnikB';
const ASTRALNI_ZNAK = '\u{1F600}';

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

function kanonskiKorisnik() {
  const vrijeme = Timestamp.fromMillis(Date.UTC(2026, 9, 15, 10, 0, 0));
  return {
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    createdAt: vrijeme,
    updatedAt: vrijeme,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: vrijeme,
  };
}

function kanonskiNalog() {
  const vrijeme = Timestamp.fromMillis(Date.UTC(2026, 9, 15, 10, 0, 0));
  return { availablePoints: 0, reservedPoints: 0, createdAt: vrijeme, updatedAt: vrijeme };
}

async function pripremi(dokumenti) {
  await testnoOkruzenje.withSecurityRulesDisabled(async (kontekst) => {
    const db = kontekst.firestore();
    for (const [putanja, podaci] of dokumenti) {
      await setDoc(doc(db, putanja), podaci);
    }
  });
}

async function pripremiVlasnika() {
  await pripremi([
    [`users/${VLASNIK}`, kanonskiKorisnik()],
    [`loyaltyAccounts/${VLASNIK}`, kanonskiNalog()],
    [`users/${DRUGI}`, { ...kanonskiKorisnik(), displayName: 'Bojan' }],
    [`loyaltyAccounts/${DRUGI}`, kanonskiNalog()],
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
    await assertSucceeds(operacija);
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

describe('RULE-T01 … RULE-T05 users/{uid}', () => {
  test('RULE-T01 neautentifikovan read users/{uid} → DENY', async () => {
    await pripremiVlasnika();
    await ocekujZabranu(getDoc(doc(bazaNeautentifikovanog(), `users/${VLASNIK}`)), 'unauthenticated get users/korisnikA');
  });

  test('RULE-T02 owner read sopstvenog profila → ALLOW', async () => {
    await pripremiVlasnika();
    await ocekujDozvolu(getDoc(doc(bazaVlasnika(), `users/${VLASNIK}`)), 'vlasnik get users/korisnikA');
  });

  test('RULE-T03 cross-user read profila → DENY; list users → DENY i za vlasnika', async () => {
    await pripremiVlasnika();
    await ocekujZabranu(getDoc(doc(bazaDrugog(), `users/${VLASNIK}`)), 'korisnikB get users/korisnikA');
    await ocekujZabranu(getDocs(collection(bazaVlasnika(), 'users')), 'korisnikA list users');
    await ocekujZabranu(getDocs(collection(bazaDrugog(), 'users')), 'korisnikB list users');
  });

  test('RULE-T04 owner update samo displayName + updatedAt (= request.time) → ALLOW', async () => {
    await pripremiVlasnika();
    const referenca = doc(bazaVlasnika(), `users/${VLASNIK}`);
    for (const ime of ['Novo', 'x', 'y'.repeat(100)]) {
      await ocekujDozvolu(
        updateDoc(referenca, { displayName: ime, updatedAt: serverTimestamp() }),
        `vlasnik update displayName dužine ${ime.length}`,
      );
    }
  });

  test('RULE-T05 update koji dodaje ili mijenja server/unknown polje → DENY', async () => {
    await pripremiVlasnika();
    const referenca = doc(bazaVlasnika(), `users/${VLASNIK}`);
    const dodaci = {
      accountStatus: 'DELETION_IN_PROGRESS',
      acceptedTermsVersion: '2.0',
      acceptedTermsAt: Timestamp.fromMillis(Date.UTC(2026, 9, 16)),
      createdAt: Timestamp.fromMillis(Date.UTC(2026, 9, 16)),
      uloga: 'admin',
    };
    for (const [polje, vrijednost] of Object.entries(dodaci)) {
      await ocekujZabranu(
        updateDoc(referenca, { displayName: 'Novo', updatedAt: serverTimestamp(), [polje]: vrijednost }),
        `vlasnik update sa poljem ${polje}`,
      );
    }
    await ocekujZabranu(
      setDoc(referenca, { ...kanonskiKorisnik(), displayName: 'Novo', updatedAt: serverTimestamp(), uloga: 'admin' }),
      'vlasnik setDoc cijelog dokumenta sa dodatnim poljem',
    );
  });
});

describe('RULE-T06, RULE-T07 loyaltyAccounts/{uid}', () => {
  test('RULE-T06 owner read sopstvenog loyaltyAccounts/{uid} → ALLOW', async () => {
    await pripremiVlasnika();
    await ocekujDozvolu(getDoc(doc(bazaVlasnika(), `loyaltyAccounts/${VLASNIK}`)), 'vlasnik get loyaltyAccounts/korisnikA');
  });

  test('RULE-T07 client create loyaltyAccounts (i za sopstveni uid) → DENY', async () => {
    const pokusaji = [
      ['korisnikA', bazaVlasnika(), VLASNIK],
      ['korisnikB', bazaDrugog(), VLASNIK],
      ['korisnikB', bazaDrugog(), DRUGI],
      ['unauthenticated', bazaNeautentifikovanog(), VLASNIK],
    ];
    for (const [naziv, db, uid] of pokusaji) {
      await ocekujZabranu(
        setDoc(doc(db, `loyaltyAccounts/${uid}`), kanonskiNalog()),
        `${naziv}: create loyaltyAccounts/${uid}`,
      );
    }
  });

  test('RULE-T07 client update, merge i delete postojećeg loyaltyAccounts (i od strane vlasnika) → DENY', async () => {
    await pripremiVlasnika();
    const konteksti = [
      ['korisnikA', bazaVlasnika()],
      ['korisnikB', bazaDrugog()],
      ['unauthenticated', bazaNeautentifikovanog()],
    ];
    for (const [naziv, db] of konteksti) {
      const referenca = doc(db, `loyaltyAccounts/${VLASNIK}`);
      await ocekujZabranu(updateDoc(referenca, { availablePoints: 1000 }), `${naziv}: update availablePoints`);
      await ocekujZabranu(setDoc(referenca, { availablePoints: 1000 }, { merge: true }), `${naziv}: set merge`);
      await ocekujZabranu(deleteDoc(referenca), `${naziv}: delete`);
    }
  });
});

describe('I02-T15 ostale granice users i loyaltyAccounts (§25.2, §25.3, §31)', () => {
  test('I02-T15 users: create i delete vlasnika → DENY', async () => {
    await ocekujZabranu(
      setDoc(doc(bazaVlasnika(), `users/${VLASNIK}`), kanonskiKorisnik()),
      'vlasnik create users/korisnikA',
    );
    await pripremiVlasnika();
    await ocekujZabranu(deleteDoc(doc(bazaVlasnika(), `users/${VLASNIK}`)), 'vlasnik delete users/korisnikA');
  });

  test('I02-T15 users update vlasnika: neispravan displayName ili klijentski updatedAt → DENY', async () => {
    await pripremiVlasnika();
    const referenca = doc(bazaVlasnika(), `users/${VLASNIK}`);
    for (const ime of ['', 'y'.repeat(101), 5]) {
      await ocekujZabranu(
        updateDoc(referenca, { displayName: ime, updatedAt: serverTimestamp() }),
        `vlasnik update displayName ${JSON.stringify(ime).slice(0, 20)}`,
      );
    }
    await ocekujZabranu(
      updateDoc(referenca, { displayName: 'Novo', updatedAt: Timestamp.now() }),
      'vlasnik update sa klijentskim updatedAt',
    );
  });

  test('I02-T15 users update drugog korisnika i neautentifikovan update → DENY', async () => {
    await pripremiVlasnika();
    await ocekujZabranu(
      updateDoc(doc(bazaDrugog(), `users/${VLASNIK}`), { displayName: 'Novo', updatedAt: serverTimestamp() }),
      'korisnikB update users/korisnikA',
    );
    await ocekujZabranu(
      updateDoc(doc(bazaNeautentifikovanog(), `users/${VLASNIK}`), { displayName: 'Novo', updatedAt: serverTimestamp() }),
      'unauthenticated update users/korisnikA',
    );
  });

  test('I02-T15 loyaltyAccounts: get drugog korisnika, neautentifikovan get i list → DENY', async () => {
    await pripremiVlasnika();
    await ocekujZabranu(getDoc(doc(bazaDrugog(), `loyaltyAccounts/${VLASNIK}`)), 'korisnikB get loyaltyAccounts/korisnikA');
    await ocekujZabranu(
      getDoc(doc(bazaNeautentifikovanog(), `loyaltyAccounts/${VLASNIK}`)),
      'unauthenticated get loyaltyAccounts/korisnikA',
    );
    await ocekujZabranu(getDocs(collection(bazaVlasnika(), 'loyaltyAccounts')), 'vlasnik list loyaltyAccounts');
  });

  // Odluka i02/P-3: size() je normativna mjera. Emulator broji UTF-16 jedinice (astralni znak = 2),
  // pa Backend broji isto (String.prototype.length).
  test('I02-T15 displayName od astralnih znakova: size() broji UTF-16 jedinice (50 → ALLOW, 51 i 100 → DENY)', async () => {
    await pripremiVlasnika();
    const referenca = doc(bazaVlasnika(), `users/${VLASNIK}`);
    await ocekujDozvolu(
      updateDoc(referenca, { displayName: ASTRALNI_ZNAK.repeat(50), updatedAt: serverTimestamp() }),
      '50 astralnih znakova (100 UTF-16 jedinica)',
    );
    for (const broj of [51, 100]) {
      await ocekujZabranu(
        updateDoc(referenca, { displayName: ASTRALNI_ZNAK.repeat(broj), updatedAt: serverTimestamp() }),
        `${broj} astralnih znakova (${2 * broj} UTF-16 jedinica)`,
      );
    }
    await ocekujDozvolu(
      updateDoc(referenca, { displayName: 'š'.repeat(100), updatedAt: serverTimestamp() }),
      '100 znakova š (BMP)',
    );
  });
});
