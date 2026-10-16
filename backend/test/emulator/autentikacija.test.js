// Granica autentikacije Android → Backend (§3.3, NFR-01): I02-T01, I02-T02, I02-T03, I02-T16.
import assert from 'node:assert/strict';
import { setTimeout as pauza } from 'node:timers/promises';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { napraviKorisnika, napraviNepotpisanToken } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ISPRAVNO_TIJELO = Object.freeze({ displayName: 'Ana', acceptedTermsVersion: '1.0' });

let firebase;
let aplikacija;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  aplikacija = napraviAplikaciju({ servisi: firebase, verzijaUslova: '1.0' });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

function provjeriTijeloGreske(odgovor, status, kod) {
  assert.equal(odgovor.status, status);
  assert.match(odgovor.headers['content-type'], /^application\/json/);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error']);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId']);
  assert.equal(odgovor.body.error.code, kod);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka);
  assert.match(odgovor.body.error.correlationId, UUID_V4);
}

async function brojDokumenata(kolekcija) {
  return (await firebase.db.collection(kolekcija).get()).size;
}

async function provjeriPraznuBazu() {
  assert.equal(await brojDokumenata('users'), 0, 'users nije prazan');
  assert.equal(await brojDokumenata('loyaltyAccounts'), 0, 'loyaltyAccounts nije prazan');
}

function init(zaglavlje) {
  const zahtjev = request(aplikacija).post('/api/v1/account/init');
  if (zaglavlje !== undefined) {
    zahtjev.set('Authorization', zaglavlje);
  }
  return zahtjev.send(ISPRAVNO_TIJELO);
}

// Stvaran err.code Admin SDK-a za token (za TEST_REPORT).
async function kodVerifikacije(token) {
  try {
    await firebase.auth.verifyIdToken(token, true);
    return 'PRIHVAĆEN';
  } catch (greska) {
    return greska.code;
  }
}

test('I02-T01 bez Authorization zaglavlja → 401 UNAUTHENTICATED, ništa upisano', async () => {
  provjeriTijeloGreske(await init(undefined), 401, 'UNAUTHENTICATED');
  await provjeriPraznuBazu();
});

test('I02-T01 važeći token van Authorization zaglavlja (query, X-Firebase-Token) → 401, ništa upisano', async () => {
  const { idToken } = await napraviKorisnika('ana@primjer.test');
  provjeriTijeloGreske(
    await request(aplikacija).post(`/api/v1/account/init?token=${idToken}`).send(ISPRAVNO_TIJELO),
    401,
    'UNAUTHENTICATED',
  );
  provjeriTijeloGreske(
    await request(aplikacija).post('/api/v1/account/init').set('X-Firebase-Token', idToken).send(ISPRAVNO_TIJELO),
    401,
    'UNAUTHENTICATED',
  );
  await provjeriPraznuBazu();
});

test('I02-T02 pogrešna šema ili oblik zaglavlja → 401, ništa upisano', async () => {
  const { idToken } = await napraviKorisnika('ana@primjer.test');
  const zaglavlja = [
    `Basic ${Buffer.from('ana:lozinka').toString('base64')}`,
    'Bearer',
    'Bearer ',
    `Bearer  ${idToken}`,
    `Bearer ${idToken} x`,
    `Token ${idToken}`,
    idToken,
    '',
  ];
  for (const zaglavlje of zaglavlja) {
    provjeriTijeloGreske(await init(zaglavlje), 401, 'UNAUTHENTICATED');
  }
  await provjeriPraznuBazu();
});

test('I02-T02 neispravan, istekao i token drugog projekta → 401, ništa upisano (stvarni err.code u dijagnostici)', async (t) => {
  const { uid } = await napraviKorisnika('ana@primjer.test');
  const sada = Math.floor(Date.now() / 1000);
  const osnova = {
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: uid,
    user_id: uid,
    auth_time: sada - 7200,
    iat: sada - 7200,
  };
  const tokeni = [
    ['Bearer abc', 'abc'],
    ['Bearer a.b.c', 'a.b.c'],
    ['istekao (exp u prošlosti)', napraviNepotpisanToken({ ...osnova, exp: sada - 3600 })],
    ['aud drugog projekta (demo-drugi)', napraviNepotpisanToken({ ...osnova, aud: 'demo-drugi', exp: sada + 3600 })],
  ];
  for (const [opis, token] of tokeni) {
    t.diagnostic(`err.code za "${opis}": ${await kodVerifikacije(token)}`);
    provjeriTijeloGreske(await init(`Bearer ${token}`), 401, 'UNAUTHENTICATED');
  }
  await provjeriPraznuBazu();
});

test('I02-T02 pozitivna kontrola: šema bearer malim slovima → 201 (i02/P-7)', async () => {
  const { uid, idToken } = await napraviKorisnika('ana@primjer.test');
  const odgovor = await init(`bearer ${idToken}`);
  assert.equal(odgovor.status, 201);
  assert.equal((await firebase.db.collection('users').doc(uid).get()).exists, true);
});

test('I02-T03 token obrisanog, onemogućenog i opozvanog korisnika → 401 (checkRevoked)', async (t) => {
  const obrisan = await napraviKorisnika('obrisan@primjer.test');
  const onemogucen = await napraviKorisnika('onemogucen@primjer.test');
  const opozvan = await napraviKorisnika('opozvan@primjer.test');

  // Kontrola: isti token prije izmjene prolazi.
  for (const korisnik of [obrisan, onemogucen, opozvan]) {
    assert.equal((await init(`Bearer ${korisnik.idToken}`)).status, 201);
  }
  const prije = new Map();
  for (const kolekcija of ['users', 'loyaltyAccounts']) {
    for (const snimak of (await firebase.db.collection(kolekcija).get()).docs) {
      prije.set(`${kolekcija}/${snimak.id}`, snimak.data());
    }
  }

  await firebase.auth.deleteUser(obrisan.uid);
  await firebase.auth.updateUser(onemogucen.uid, { disabled: true });
  // auth_time ima granularnost od 1 s; opoziv mora biti u kasnijoj sekundi od izdavanja token-a.
  await pauza(1100);
  await firebase.auth.revokeRefreshTokens(opozvan.uid);

  for (const [opis, korisnik] of [['obrisan', obrisan], ['onemogućen', onemogucen], ['opozvan', opozvan]]) {
    t.diagnostic(`err.code za ${opis} korisnik: ${await kodVerifikacije(korisnik.idToken)}`);
    provjeriTijeloGreske(await init(`Bearer ${korisnik.idToken}`), 401, 'UNAUTHENTICATED');
  }

  const poslije = new Map();
  for (const kolekcija of ['users', 'loyaltyAccounts']) {
    for (const snimak of (await firebase.db.collection(kolekcija).get()).docs) {
      poslije.set(`${kolekcija}/${snimak.id}`, snimak.data());
    }
  }
  assert.equal(prije.size, 6);
  assert.deepStrictEqual(poslije, prije);
});

test('I02-T16 granice rute: GET init → 404, nepostojeća ruta bez token-a → 404, neispravan JSON bez token-a → 422', async () => {
  provjeriTijeloGreske(await request(aplikacija).get('/api/v1/account/init'), 404, 'NOT_FOUND');
  provjeriTijeloGreske(await request(aplikacija).post('/api/v1/account/nepostojeca').send({}), 404, 'NOT_FOUND');
  provjeriTijeloGreske(
    await request(aplikacija).post('/api/v1/account/init').set('Content-Type', 'application/json').send('{'),
    422,
    'INVALID_REQUEST',
  );
  await provjeriPraznuBazu();
});
