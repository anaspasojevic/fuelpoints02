// I07-T14 (§6 (h), D-3, O-18, NFR-07): log (svi kanali) i odgovori API-07 ne sadrže uid, token, auth_time, e-mail, displayName, voucherId
// ni requestKey, ni za jedan ishod; zapis greške bilježi šablon rute /account; nijedan odgovor nema stack.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { izracunajRequestKey } from '../../src/servisi/vauceri.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacAutha } from '../pomocnici/omotacAutha.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { SVJEZINA, napraviPripremuBrisanja } from '../pomocnici/pripremaBrisanja.js';
import { mockSataFajla } from '../pomocnici/pripremaVaucera.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';

const projectId = provjeriTestnoOkruzenje();
const SENTINEL_IME = 'SENTINEL_IME_5d1e';
const ZABRANJENO_U_ODGOVORU = ['stack', '    at ', 'ubrizgana', 'tajno', 'Nekonzistentno', 'uid'];

let firebase;
let b;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  b = napraviPripremuBrisanja(firebase);
});

beforeEach(async () => {
  await ocistiEmulatore();
  await napuniRewardDefinitions(firebase.db);
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

// Korisnik sa profilom (displayName sentinel), dvije kupovine i ACTIVE voucher; vraća i vrijednosti koje se ne smiju pojaviti u logu.
async function korisnikZaLog() {
  const k = await b.noviKorisnik();
  await b.init(k, { displayName: SENTINEL_IME });
  await b.kupi(k.uid, `POS-L${k.uid.slice(0, 4)}`, 42_730);
  await b.kupi(k.uid, `POS-M${k.uid.slice(0, 4)}`, 30_000);
  const requestId = randomUUID();
  const V = await b.izdaj(k, 'CAR_WASH', { requestId });
  const email = (await firebase.auth.getUser(k.uid)).email;
  return { k, zabranjeno: [k.uid, k.idToken, String(k.authTime), email, SENTINEL_IME, V, izracunajRequestKey(k.uid, requestId), requestId] };
}

function zapisiLoga(log) {
  const zapisi = [];
  for (const linija of log.split('\n')) {
    try {
      const zapis = JSON.parse(linija);
      if (typeof zapis?.correlationId === 'string') {
        zapisi.push(zapis);
      }
    } catch {
      // linija koja nije JSON zapis greške
    }
  }
  return zapisi;
}

test('I07-T14 log i odgovori brisanja bez uid-a, token-a, auth_time, e-maila, displayName-a, voucherId-a i requestKey-a za 204, 401, 409, 422, 404, 500 i 503', async () => {
  const korisnici = [];
  const odgovori = [];
  const log = presretniLog();
  // Sat provjere svježine: pravi, osim za slučaj 409 (zastarjelo ≠ null).
  const izvorniSat = Date.now;
  let zastarjelo = null;
  mockSataFajla(mock, SVJEZINA, () => zastarjelo ?? izvorniSat.call(Date));
  const zahtjev = async (opis, ocekivano, obecanje) => {
    const odgovor = await obecanje;
    assert.equal(odgovor.status, ocekivano, `${opis}: ${odgovor.text}`);
    odgovori.push({ opis, odgovor });
    return odgovor;
  };

  // 204, pa 401 za obrisan Auth nalog.
  let x = await korisnikZaLog();
  korisnici.push(x);
  await zahtjev('204', 204, b.obrisi(x.k.idToken));
  await zahtjev('401 obrisan korisnik', 401, b.obrisi(x.k.idToken));
  await zahtjev('401 neispravan token', 401, b.obrisi('abc'));

  // 409 reauth, 422, 404.
  x = await korisnikZaLog();
  korisnici.push(x);
  zastarjelo = (x.k.authTime + 301) * 1000;
  await zahtjev('409 reauth', 409, b.obrisi(x.k.idToken));
  zastarjelo = null;
  await zahtjev('422', 422, b.obrisi(x.k.idToken, { tijelo: { uid: x.k.uid } }));
  await zahtjev('404 metod', 404, b.obrisi(x.k.idToken, { metod: 'get' }));

  // 500: prekid u K3, u K4a i na deleteUser (K6).
  for (const [opis, opcije] of [
    ['500 K3', { db: omotacBaze(firebase.db, { baciNaUpisu: 2 }) }],
    ['500 K4a', { db: omotacBaze(firebase.db, { baciNaUpisu: 5 }) }],
    ['500 K6', { auth: omotacAutha(firebase.auth, { baciNaBrisanju: true }) }],
  ]) {
    x = await korisnikZaLog();
    korisnici.push(x);
    await zahtjev(opis, 500, b.obrisi(x.k.idToken, opcije));
  }

  // 503: Firestore nedostupan, Auth nedostupan.
  x = await korisnikZaLog();
  korisnici.push(x);
  await zahtjev('503 Firestore', 503, b.obrisi(x.k.idToken, { db: omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } }) }));
  await zahtjev('503 Auth', 503, b.obrisi(x.k.idToken, { auth: omotacAutha(firebase.auth, { baciNaBrisanju: { code: 'app/network-error' } }) }));
  mock.restoreAll();

  const tekst = tekstLoga(log);
  for (const { zabranjeno } of korisnici) {
    for (const vrijednost of zabranjeno) {
      assert.ok(!tekst.includes(vrijednost), `log sadrži zabranjenu vrijednost (${vrijednost.length} znakova)`);
    }
  }
  const zapisi = zapisiLoga(tekst);
  for (const { opis, odgovor } of odgovori) {
    for (const zabranjeno of ZABRANJENO_U_ODGOVORU) {
      assert.ok(!odgovor.text.includes(zabranjeno), `${opis}: odgovor sadrži "${zabranjeno}"`);
    }
    for (const { zabranjeno } of korisnici) {
      for (const vrijednost of zabranjeno) {
        assert.ok(!odgovor.text.includes(vrijednost), `${opis}: odgovor sadrži zabranjenu vrijednost`);
      }
    }
    if (odgovor.status === 204) {
      continue;
    }
    const zapis = zapisi.filter((z) => z.correlationId === odgovor.body.error.correlationId);
    assert.equal(zapis.length, 1, `${opis}: broj zapisa loga`);
    assert.equal(zapis[0].putanja, opis === '404 metod' ? '(nepoznata ruta)' : '/account', `${opis}: putanja u logu`);
    assert.equal(zapis[0].code, odgovor.body.error.code, opis);
  }
});
