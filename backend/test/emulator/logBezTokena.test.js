// I02-T12 (§3.4, NFR-07): token i Authorization se ne pojavljuju ni u logu (svi kanali) ni u odgovoru,
// za svaki ishod init-a: 201, 200, 401, 409, 422, 500 i 503.
import assert from 'node:assert/strict';
import { setTimeout as pauza } from 'node:timers/promises';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';

const projectId = provjeriTestnoOkruzenje();
const ISPRAVNO_TIJELO = Object.freeze({ displayName: 'Ana', acceptedTermsVersion: '1.0' });

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

function aplikacija(servisi = firebase) {
  return napraviAplikaciju({ servisi, verzijaUslova: '1.0' });
}

function init(zaglavlje, tijelo = ISPRAVNO_TIJELO, servisi = firebase) {
  return request(aplikacija(servisi)).post('/api/v1/account/init').set('Authorization', zaglavlje).send(tijelo);
}

// Firestore čija transakcija baca grešku na drugom upisu (kao I02-T08 (a)).
function bazaSaGreskom(db) {
  let upisi = 0;
  return {
    collection: (...argumenti) => db.collection(...argumenti),
    runTransaction(funkcija, opcije) {
      return db.runTransaction(
        (tx) =>
          funkcija(
            new Proxy(tx, {
              get(cilj, svojstvo) {
                const vrijednost = Reflect.get(cilj, svojstvo, cilj);
                if (svojstvo === 'create') {
                  return (...argumenti) => {
                    upisi += 1;
                    if (upisi === 2) {
                      throw new Error('ubrizgana greška');
                    }
                    return vrijednost.apply(cilj, argumenti);
                  };
                }
                return typeof vrijednost === 'function' ? vrijednost.bind(cilj) : vrijednost;
              },
            }),
          ),
        opcije,
      );
    },
  };
}

// Firestore koji nije dostupan (gRPC UNAVAILABLE).
function nedostupnaBaza(db) {
  return {
    collection: (...argumenti) => db.collection(...argumenti),
    runTransaction: () => Promise.reject(Object.assign(new Error('nedostupno'), { code: 14 })),
  };
}

function tekstOdgovora(odgovor) {
  return `${odgovor.text}\n${JSON.stringify(odgovor.headers)}`;
}

test('I02-T12 log (svi kanali) i odgovori ne sadrže token ni Authorization ni za jedan ishod', async () => {
  const korisnik = await napraviKorisnika('ana@primjer.test');
  const obrisan = await napraviKorisnika('obrisan@primjer.test');
  const opozvan = await napraviKorisnika('opozvan@primjer.test');
  const brisanje = await napraviKorisnika('brisanje@primjer.test');
  const greska500 = await napraviKorisnika('greska500@primjer.test');
  const greska503 = await napraviKorisnika('greska503@primjer.test');
  await firebase.db.collection('users').doc(brisanje.uid).set({
    displayName: 'Brisanje',
    accountStatus: 'DELETION_IN_PROGRESS',
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: Timestamp.now(),
  });
  await firebase.auth.deleteUser(obrisan.uid);
  await pauza(1100);
  await firebase.auth.revokeRefreshTokens(opozvan.uid);

  const sentinelToken = 'SENTINEL_TOKEN_7f3a9c';
  const sentinelBasic = 'SENTINEL_BASIC_4e1b2d';
  const tajne = [korisnik, obrisan, opozvan, brisanje, greska500, greska503].map((k) => k.idToken);

  const presretac = presretniLog();
  const ishodi = [
    [201, await init(`Bearer ${korisnik.idToken}`)],
    [200, await init(`Bearer ${korisnik.idToken}`)],
    [401, await init(`Bearer ${sentinelToken}`)],
    [401, await init(`Basic ${sentinelBasic}`)],
    [401, await init(`Bearer ${obrisan.idToken}`)],
    [401, await init(`Bearer ${opozvan.idToken}`)],
    [409, await init(`Bearer ${brisanje.idToken}`)],
    [422, await init(`Bearer ${korisnik.idToken}`, { ...ISPRAVNO_TIJELO, uid: 'x' })],
    [422, await init(`Bearer ${korisnik.idToken}`, { ...ISPRAVNO_TIJELO, displayName: '' })],
    [500, await init(`Bearer ${greska500.idToken}`, ISPRAVNO_TIJELO, { ...firebase, db: bazaSaGreskom(firebase.db) })],
    [503, await init(`Bearer ${greska503.idToken}`, ISPRAVNO_TIJELO, { ...firebase, db: nedostupnaBaza(firebase.db) })],
  ];
  const log = tekstLoga(presretac);
  mock.restoreAll();

  const kodovi422 = new Set();
  for (const [status, odgovor] of ishodi) {
    assert.equal(odgovor.status, status, `očekivan ${status}: ${odgovor.text}`);
    if (status >= 400) {
      assert.ok(log.includes(odgovor.body.error.correlationId), `log ne sadrži correlationId za ${status}`);
    }
    if (status === 422) {
      kodovi422.add(odgovor.body.error.code);
    }
    const tekst = tekstOdgovora(odgovor);
    for (const tajna of [...tajne, sentinelToken, sentinelBasic]) {
      assert.ok(!tekst.includes(tajna), `odgovor ${status} sadrži token`);
    }
  }
  assert.deepStrictEqual([...kodovi422].sort(), ['INVALID_DISPLAY_NAME', 'INVALID_REQUEST']);

  for (const tajna of [sentinelToken, sentinelBasic, 'Bearer ', 'Basic ']) {
    assert.ok(!log.includes(tajna), `log sadrži "${tajna}"`);
  }
  for (const token of tajne) {
    assert.ok(!log.includes(token), 'log sadrži token');
    for (const segment of token.split('.').filter((dio) => dio.length > 0)) {
      assert.ok(!log.includes(segment), 'log sadrži segment token-a');
    }
  }
});
