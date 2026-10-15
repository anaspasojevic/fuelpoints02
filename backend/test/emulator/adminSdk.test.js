import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';

const projectId = provjeriTestnoOkruzenje();

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

test('I01-T07 Admin SDK: upis, čitanje i brisanje probnog dokumenta u Firestore emulatoru', async () => {
  const referenca = firebase.db.collection('probaI01').doc('dok1');
  await referenca.set({ tekst: 'proba', broj: 1 });

  const procitan = await referenca.get();
  assert.equal(procitan.exists, true);
  assert.deepStrictEqual(procitan.data(), { tekst: 'proba', broj: 1 });

  await referenca.delete();
  assert.equal((await referenca.get()).exists, false);
});

test('I01-T07 Admin SDK: kreiranje i brisanje test korisnika u Auth emulatoru', async () => {
  const korisnik = await firebase.auth.createUser({ email: 'proba@primjer.test', password: 'Proba1234' });
  const procitan = await firebase.auth.getUser(korisnik.uid);
  assert.equal(procitan.email, 'proba@primjer.test');

  await firebase.auth.deleteUser(korisnik.uid);
  await assert.rejects(firebase.auth.getUser(korisnik.uid), { code: 'auth/user-not-found' });
});
