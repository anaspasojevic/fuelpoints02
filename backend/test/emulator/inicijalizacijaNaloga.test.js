// POST /api/v1/account/init (§5 AUTH-02 … AUTH-05, AUTH-10, §7.1, §7.2, §26 API-01, NFR-04):
// API-T01, I02-T04 … I02-T10, I02-T14.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import request from 'supertest';
import { napraviAplikaciju } from '../../src/aplikacija.js';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';

const projectId = provjeriTestnoOkruzenje();
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KLJUCEVI_ODGOVORA = ['displayName', 'accountStatus', 'acceptedTermsVersion', 'availablePoints', 'reservedPoints'];
const KLJUCEVI_USERS = ['acceptedTermsAt', 'acceptedTermsVersion', 'accountStatus', 'createdAt', 'displayName', 'updatedAt'];
const KLJUCEVI_NALOGA = ['availablePoints', 'createdAt', 'reservedPoints', 'updatedAt'];
const ASTRALNI_ZNAK = '\u{1F600}';

let firebase;
let brojac = 0;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

function aplikacija(servisi = firebase) {
  return napraviAplikaciju({ servisi, verzijaUslova: '1.0' });
}

function noviKorisnik() {
  brojac += 1;
  return napraviKorisnika(`korisnik${brojac}@primjer.test`);
}

function init(token, tijelo, servisi) {
  return request(aplikacija(servisi)).post('/api/v1/account/init').set('Authorization', `Bearer ${token}`).send(tijelo);
}

// contentType null → zahtjev bez Content-Type zaglavlja.
function initSirovo(token, sirovo, contentType = 'application/json') {
  const zahtjev = request(aplikacija()).post('/api/v1/account/init').set('Authorization', `Bearer ${token}`);
  if (contentType !== null) {
    zahtjev.set('Content-Type', contentType);
  }
  return sirovo === undefined ? zahtjev : zahtjev.send(sirovo);
}

function provjeriTijeloGreske(odgovor, status, kod, opis = '') {
  assert.equal(odgovor.status, status, `${opis}: status`);
  assert.deepStrictEqual(Object.keys(odgovor.body), ['error'], opis);
  assert.deepStrictEqual(Object.keys(odgovor.body.error), ['code', 'message', 'correlationId'], opis);
  assert.equal(odgovor.body.error.code, kod, opis);
  assert.equal(odgovor.body.error.message, KATALOG_GRESAKA[kod].poruka, opis);
  assert.match(odgovor.body.error.correlationId, UUID_V4, opis);
}

function referenca(kolekcija, uid) {
  return firebase.db.collection(kolekcija).doc(uid);
}

async function podaci(kolekcija, uid) {
  const snimak = await referenca(kolekcija, uid).get();
  return snimak.exists ? snimak.data() : undefined;
}

async function brojDokumenata(kolekcija) {
  return (await firebase.db.collection(kolekcija).get()).size;
}

async function ukupnoDokumenata() {
  let ukupno = 0;
  for (const kolekcija of await firebase.db.listCollections()) {
    ukupno += (await kolekcija.get()).size;
  }
  return ukupno;
}

async function provjeriPraznuBazu(opis = '') {
  assert.equal(await ukupnoDokumenata(), 0, `${opis}: baza nije prazna`);
}

function provjeriInvarijante(nalog) {
  assert.ok(Number.isInteger(nalog.availablePoints) && nalog.availablePoints >= 0, 'availablePoints < 0');
  assert.ok(Number.isInteger(nalog.reservedPoints) && nalog.reservedPoints >= 0, 'reservedPoints < 0');
}

function kanonskiKorisnik(dodatno = {}) {
  const vrijeme = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
  return {
    displayName: 'Postojeće ime',
    accountStatus: 'ACTIVE',
    createdAt: vrijeme,
    updatedAt: vrijeme,
    acceptedTermsVersion: '1.0',
    acceptedTermsAt: vrijeme,
    ...dodatno,
  };
}

function kanonskiNalog(dodatno = {}) {
  const vrijeme = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));
  return { availablePoints: 0, reservedPoints: 0, createdAt: vrijeme, updatedAt: vrijeme, ...dodatno };
}

test('API-T01 validan init kreira profil i balance 0/0 sa tačnim poljima; ponovljeni init ne resetuje stanje', async () => {
  const { uid, idToken } = await noviKorisnik();

  // (a) prvi init
  const prije = Date.now();
  const prvi = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' });
  const poslije = Date.now();
  assert.equal(prvi.status, 201);
  assert.deepStrictEqual(Object.keys(prvi.body), KLJUCEVI_ODGOVORA);
  assert.deepStrictEqual(prvi.body, {
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    acceptedTermsVersion: '1.0',
    availablePoints: 0,
    reservedPoints: 0,
  });

  const korisnik = await podaci('users', uid);
  assert.deepStrictEqual(Object.keys(korisnik).sort(), KLJUCEVI_USERS);
  assert.equal(korisnik.displayName, 'Ana');
  assert.equal(korisnik.accountStatus, 'ACTIVE');
  assert.equal(korisnik.acceptedTermsVersion, '1.0');
  for (const polje of ['createdAt', 'updatedAt', 'acceptedTermsAt']) {
    assert.ok(korisnik[polje] instanceof Timestamp, `${polje} nije Timestamp`);
    assert.ok(korisnik[polje].isEqual(korisnik.createdAt), `${polje} se razlikuje od createdAt`);
  }
  const milis = korisnik.createdAt.toMillis();
  assert.ok(milis >= prije - 5000 && milis <= poslije + 5000, 'createdAt nije serversko vrijeme zahtjeva');

  const nalog = await podaci('loyaltyAccounts', uid);
  assert.deepStrictEqual(Object.keys(nalog).sort(), KLJUCEVI_NALOGA);
  assert.equal(nalog.availablePoints, 0);
  assert.equal(nalog.reservedPoints, 0);
  assert.ok(nalog.createdAt.isEqual(korisnik.createdAt));
  assert.ok(nalog.updatedAt.isEqual(korisnik.createdAt));
  provjeriInvarijante(nalog);

  assert.equal(await brojDokumenata('loyaltyLedger'), 0, 'init je napravio ledger event');
  assert.equal(await brojDokumenata('users'), 1);
  assert.equal(await brojDokumenata('loyaltyAccounts'), 1);
  assert.equal(await ukupnoDokumenata(), 2);

  // (b) ponovljeni init poslije ručne izmjene bodova
  await referenca('loyaltyAccounts', uid).update({ availablePoints: 42 });
  const korisnikPrije = await podaci('users', uid);
  const nalogPrije = await podaci('loyaltyAccounts', uid);

  const drugi = await init(idToken, { displayName: 'Drugo ime', acceptedTermsVersion: '1.0' });
  assert.equal(drugi.status, 200);
  assert.deepStrictEqual(Object.keys(drugi.body), KLJUCEVI_ODGOVORA);
  assert.deepStrictEqual(drugi.body, {
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    acceptedTermsVersion: '1.0',
    availablePoints: 42,
    reservedPoints: 0,
  });
  assert.deepStrictEqual(await podaci('users', uid), korisnikPrije);
  assert.deepStrictEqual(await podaci('loyaltyAccounts', uid), nalogPrije);
  provjeriInvarijante(await podaci('loyaltyAccounts', uid));
  assert.equal(await ukupnoDokumenata(), 2);
});

test('I02-T04 uid u tijelu → 422 INVALID_REQUEST; dokument za uid iz tijela nikad ne nastaje', async () => {
  const a = await noviKorisnik();
  const b = await noviKorisnik();
  for (const uidUTijelu of [b.uid, a.uid]) {
    const odgovor = await init(a.idToken, { uid: uidUTijelu, displayName: 'Ana', acceptedTermsVersion: '1.0' });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', `uid ${uidUTijelu === a.uid ? 'iz token-a' : 'drugog korisnika'}`);
    await provjeriPraznuBazu();
  }

  assert.equal((await init(a.idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' })).status, 201);
  const korisnikA = await podaci('users', a.uid);
  const nalogA = await podaci('loyaltyAccounts', a.uid);
  provjeriTijeloGreske(
    await init(a.idToken, { uid: b.uid, displayName: 'Ana', acceptedTermsVersion: '1.0' }),
    422,
    'INVALID_REQUEST',
    'postojeći nalog A, uid B u tijelu',
  );
  assert.deepStrictEqual(await podaci('users', a.uid), korisnikA);
  assert.deepStrictEqual(await podaci('loyaltyAccounts', a.uid), nalogA);
  assert.equal(await podaci('users', b.uid), undefined);
  assert.equal(await podaci('loyaltyAccounts', b.uid), undefined);
});

test('I02-T05 server-controlled ili nepoznato polje u tijelu → 422 INVALID_REQUEST, ništa upisano', async () => {
  const { idToken } = await noviKorisnik();
  const dodaci = {
    accountStatus: 'ACTIVE',
    availablePoints: 1000,
    reservedPoints: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    acceptedTermsAt: '2026-01-01T00:00:00Z',
    uloga: 'admin',
    constructor: 1,
  };
  for (const [polje, vrijednost] of Object.entries(dodaci)) {
    const odgovor = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0', [polje]: vrijednost });
    provjeriTijeloGreske(odgovor, 422, 'INVALID_REQUEST', polje);
  }
  provjeriTijeloGreske(
    await initSirovo(idToken, '{"displayName":"Ana","acceptedTermsVersion":"1.0","__proto__":{"accountStatus":"ACTIVE"}}'),
    422,
    'INVALID_REQUEST',
    '__proto__',
  );
  await provjeriPraznuBazu();
});

test('I02-T05 tijelo nije JSON objekat → 422 INVALID_REQUEST, ništa upisano; nepoznato polje ima prednost nad displayName', async () => {
  const { idToken } = await noviKorisnik();
  for (const sirovo of ['[]', 'null', '"tekst"', '5', 'true']) {
    provjeriTijeloGreske(await initSirovo(idToken, sirovo), 422, 'INVALID_REQUEST', sirovo);
  }
  provjeriTijeloGreske(await initSirovo(idToken, undefined, null), 422, 'INVALID_REQUEST', 'prazno tijelo');
  provjeriTijeloGreske(
    await initSirovo(idToken, '{"displayName":"Ana","acceptedTermsVersion":"1.0"}', 'text/plain'),
    422,
    'INVALID_REQUEST',
    'text/plain',
  );
  provjeriTijeloGreske(
    await init(idToken, { uloga: 1, displayName: '', acceptedTermsVersion: '1.0' }),
    422,
    'INVALID_REQUEST',
    'redoslijed provjera',
  );
  await provjeriPraznuBazu();
});

test('I02-T06 neispravan displayName → 422 INVALID_DISPLAY_NAME, ništa upisano', async () => {
  const { idToken } = await noviKorisnik();
  const neispravni = [
    ['nedostaje', undefined],
    ['prazan', ''],
    ['101 znak', 'a'.repeat(101)],
    ['null', null],
    ['broj', 5],
    ['niz', ['a']],
    ['objekat', {}],
    ['51 astralni znak (102 UTF-16 jedinice)', ASTRALNI_ZNAK.repeat(51)],
    ['100 astralnih znakova (200 UTF-16 jedinica)', ASTRALNI_ZNAK.repeat(100)],
    ['101 astralni znak', ASTRALNI_ZNAK.repeat(101)],
  ];
  for (const [opis, displayName] of neispravni) {
    const tijelo = { acceptedTermsVersion: '1.0' };
    if (displayName !== undefined) {
      tijelo.displayName = displayName;
    }
    provjeriTijeloGreske(await init(idToken, tijelo), 422, 'INVALID_DISPLAY_NAME', opis);
  }
  provjeriTijeloGreske(
    await init(idToken, { displayName: '', acceptedTermsVersion: '9.9' }),
    422,
    'INVALID_DISPLAY_NAME',
    'redoslijed: displayName prije verzije uslova',
  );
  await provjeriPraznuBazu();
});

test('I02-T06 granične vrijednosti displayName → 201, upisano tačno (bez trim-a); brojanje kao size() u Rules (i02/P-3)', async () => {
  const ispravni = ['A', 'a'.repeat(100), ASTRALNI_ZNAK.repeat(50), '\u0161'.repeat(100), '  Ana  '];
  for (const displayName of ispravni) {
    const { uid, idToken } = await noviKorisnik();
    const odgovor = await init(idToken, { displayName, acceptedTermsVersion: '1.0' });
    assert.equal(odgovor.status, 201, `dužina ${displayName.length}`);
    assert.equal(odgovor.body.displayName, displayName);
    assert.equal((await podaci('users', uid)).displayName, displayName);
  }
});

test('I02-T07 acceptedTermsVersion različit od aktuelne verzije → 422 INVALID_REQUEST, ništa upisano', async () => {
  const { uid, idToken } = await noviKorisnik();
  const neispravne = [['nedostaje', undefined], ['broj 1.0', 1.0], ['null', null], ['0.9', '0.9'], ['2.0', '2.0'], ['"1.0 "', '1.0 '], ['prazan', '']];
  async function provjeriSve() {
    for (const [opis, verzija] of neispravne) {
      const tijelo = { displayName: 'Ana' };
      if (verzija !== undefined) {
        tijelo.acceptedTermsVersion = verzija;
      }
      provjeriTijeloGreske(await init(idToken, tijelo), 422, 'INVALID_REQUEST', opis);
    }
  }
  await provjeriSve();
  await provjeriPraznuBazu();

  assert.equal((await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' })).status, 201);
  const korisnik = await podaci('users', uid);
  const nalog = await podaci('loyaltyAccounts', uid);
  await provjeriSve();
  assert.deepStrictEqual(await podaci('users', uid), korisnik);
  assert.deepStrictEqual(await podaci('loyaltyAccounts', uid), nalog);
});

// Omotač oko pravog db: transakcija dobija proxy čiji upisi (create/set/update) se broje globalno za omotač.
function omotacBaze(db, { baciNaUpisu, baciPrijeCommita = false } = {}) {
  let upisi = 0;
  return {
    collection: (...argumenti) => db.collection(...argumenti),
    doc: (...argumenti) => db.doc(...argumenti),
    runTransaction(funkcija, opcije) {
      return db.runTransaction(async (tx) => {
        const posrednik = new Proxy(tx, {
          get(cilj, svojstvo) {
            const vrijednost = Reflect.get(cilj, svojstvo, cilj);
            if (['create', 'set', 'update'].includes(svojstvo)) {
              return (...argumenti) => {
                upisi += 1;
                if (upisi === baciNaUpisu) {
                  throw new Error('ubrizgana greška C:\\tajno\\x.js');
                }
                return vrijednost.apply(cilj, argumenti);
              };
            }
            return typeof vrijednost === 'function' ? vrijednost.bind(cilj) : vrijednost;
          },
        });
        const rezultat = await funkcija(posrednik);
        if (baciPrijeCommita) {
          throw new Error('ubrizgana greška prije commit-a C:\\tajno\\x.js');
        }
        return rezultat;
      }, opcije);
    },
    get brojUpisa() {
      return upisi;
    },
  };
}

function provjeriBezInternihDetalja(odgovor) {
  for (const zabranjeno of ['stack', '    at ', 'ubrizgana', 'C:\\', 'tajno']) {
    assert.ok(!odgovor.text.includes(zabranjeno), `odgovor sadrži "${zabranjeno}"`);
  }
}

test('I02-T08 failure injection između dva upisa i prije commit-a → 500 bez stack-a, nijedan dokument', async () => {
  const { idToken } = await noviKorisnik();

  const izmedjuUpisa = omotacBaze(firebase.db, { baciNaUpisu: 2 });
  const prvi = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' }, { ...firebase, db: izmedjuUpisa });
  provjeriTijeloGreske(prvi, 500, 'INTERNAL_ERROR', '(a) greška na drugom upisu');
  provjeriBezInternihDetalja(prvi);
  assert.equal(izmedjuUpisa.brojUpisa, 2, 'greška nije ubrizgana na drugom upisu');
  await provjeriPraznuBazu('(a)');

  const prijeCommita = omotacBaze(firebase.db, { baciPrijeCommita: true });
  const drugi = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' }, { ...firebase, db: prijeCommita });
  provjeriTijeloGreske(drugi, 500, 'INTERNAL_ERROR', '(b) greška prije commit-a');
  provjeriBezInternihDetalja(drugi);
  assert.equal(prijeCommita.brojUpisa, 2, 'callback nije upisao oba dokumenta');
  await provjeriPraznuBazu('(b)');

  const kontrola = omotacBaze(firebase.db);
  const treci = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' }, { ...firebase, db: kontrola });
  assert.equal(treci.status, 201, 'kontrola: omotač bez greške');
  assert.equal(await brojDokumenata('users'), 1);
  assert.equal(await brojDokumenata('loyaltyAccounts'), 1);
  assert.equal(await ukupnoDokumenata(), 2);
});

// 503 pod kontencijom je dozvoljen ishod (i02/P-5, init je idempotentan; FIX LOOP 1, R-01); konzistentnost se provjerava uvijek.
test('I02-T09 10 paralelnih init-a za isti uid → bez 500, najviše jedan 201, ista uspješna tijela, jedan users i jedan loyaltyAccounts (3 ponavljanja)', async (t) => {
  for (let ponavljanje = 0; ponavljanje < 3; ponavljanje += 1) {
    await ocistiEmulatore();
    const { uid, idToken } = await noviKorisnik();
    const app = aplikacija();
    const odgovori = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/v1/account/init')
          .set('Authorization', `Bearer ${idToken}`)
          .send({ displayName: `Ime-${i}`, acceptedTermsVersion: '1.0' }),
      ),
    );
    const statusi = odgovori.map((odgovor) => odgovor.status);
    t.diagnostic(`ponavljanje ${ponavljanje + 1}: statusi ${statusi.join(',')}`);
    assert.ok(statusi.every((status) => [200, 201, 503].includes(status)), `statusi: ${statusi.join(',')}`);
    for (const odgovor of odgovori.filter((o) => o.status === 503)) {
      provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', '503 pod kontencijom');
    }
    const kreirani = odgovori.map((odgovor, i) => [odgovor, i]).filter(([odgovor]) => odgovor.status === 201);
    assert.ok(kreirani.length <= 1, `broj 201: ${kreirani.length}`);
    const uspjesni = odgovori.filter((odgovor) => odgovor.status === 200 || odgovor.status === 201);
    for (const odgovor of uspjesni) {
      assert.deepStrictEqual(odgovor.body, uspjesni[0].body);
    }
    if (kreirani.length === 1) {
      const [pobjednik, indeks] = kreirani[0];
      assert.equal(pobjednik.body.displayName, `Ime-${indeks}`);
    }

    assert.equal(await brojDokumenata('users'), 1);
    assert.equal(await brojDokumenata('loyaltyAccounts'), 1);
    assert.equal(await brojDokumenata('loyaltyLedger'), 0);
    const korisnik = await podaci('users', uid);
    assert.match(korisnik.displayName, /^Ime-\d$/);
    const nalog = await podaci('loyaltyAccounts', uid);
    assert.equal(nalog.availablePoints, 0);
    assert.equal(nalog.reservedPoints, 0);

    const naknadni = await init(idToken, { displayName: 'Naknadno', acceptedTermsVersion: '1.0' });
    assert.equal(naknadni.status, 200, 'naknadni sekvencijalni init');
    assert.deepStrictEqual(naknadni.body, {
      displayName: korisnik.displayName,
      accountStatus: 'ACTIVE',
      acceptedTermsVersion: '1.0',
      availablePoints: 0,
      reservedPoints: 0,
    });
    if (uspjesni.length > 0) {
      assert.deepStrictEqual(naknadni.body, uspjesni[0].body);
    }
  }
});

test('I02-T10 nalog u DELETION_IN_PROGRESS → 409 ACCOUNT_DELETION_IN_PROGRESS, dokumenti nepromijenjeni', async () => {
  const { uid, idToken } = await noviKorisnik();
  await referenca('users', uid).set(kanonskiKorisnik({ accountStatus: 'DELETION_IN_PROGRESS' }));
  await referenca('loyaltyAccounts', uid).set(kanonskiNalog({ availablePoints: 7 }));
  const korisnik = await podaci('users', uid);
  const nalog = await podaci('loyaltyAccounts', uid);
  provjeriTijeloGreske(
    await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' }),
    409,
    'ACCOUNT_DELETION_IN_PROGRESS',
  );
  assert.deepStrictEqual(await podaci('users', uid), korisnik);
  assert.deepStrictEqual(await podaci('loyaltyAccounts', uid), nalog);
});

test('I02-T10 DELETION_IN_PROGRESS bez loyaltyAccounts → 409, loyaltyAccounts i dalje ne postoji', async () => {
  const { uid, idToken } = await noviKorisnik();
  await referenca('users', uid).set(kanonskiKorisnik({ accountStatus: 'DELETION_IN_PROGRESS' }));
  const korisnik = await podaci('users', uid);
  provjeriTijeloGreske(
    await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' }),
    409,
    'ACCOUNT_DELETION_IN_PROGRESS',
  );
  assert.deepStrictEqual(await podaci('users', uid), korisnik);
  assert.equal(await podaci('loyaltyAccounts', uid), undefined);
});

test('I02-T14 (a) postoji samo users ACTIVE → 201, nastaje loyaltyAccounts 0/0, users nepromijenjen (i02/P-2)', async () => {
  const { uid, idToken } = await noviKorisnik();
  await referenca('users', uid).set(kanonskiKorisnik());
  const korisnik = await podaci('users', uid);
  const odgovor = await init(idToken, { displayName: 'Novo ime', acceptedTermsVersion: '1.0' });
  assert.equal(odgovor.status, 201);
  assert.deepStrictEqual(odgovor.body, {
    displayName: 'Postojeće ime',
    accountStatus: 'ACTIVE',
    acceptedTermsVersion: '1.0',
    availablePoints: 0,
    reservedPoints: 0,
  });
  assert.deepStrictEqual(await podaci('users', uid), korisnik);
  const nalog = await podaci('loyaltyAccounts', uid);
  assert.deepStrictEqual(Object.keys(nalog).sort(), KLJUCEVI_NALOGA);
  assert.equal(nalog.availablePoints, 0);
  assert.equal(nalog.reservedPoints, 0);
  assert.ok(nalog.createdAt instanceof Timestamp && nalog.createdAt.isEqual(nalog.updatedAt));
});

test('I02-T14 (b) postoji samo loyaltyAccounts sa 42 boda → 201, nastaje users, bodovi ostaju 42 (i02/P-2)', async () => {
  const { uid, idToken } = await noviKorisnik();
  await referenca('loyaltyAccounts', uid).set(kanonskiNalog({ availablePoints: 42 }));
  const nalog = await podaci('loyaltyAccounts', uid);
  const prije = Date.now();
  const odgovor = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' });
  const poslije = Date.now();
  assert.equal(odgovor.status, 201);
  assert.deepStrictEqual(odgovor.body, {
    displayName: 'Ana',
    accountStatus: 'ACTIVE',
    acceptedTermsVersion: '1.0',
    availablePoints: 42,
    reservedPoints: 0,
  });
  assert.deepStrictEqual(await podaci('loyaltyAccounts', uid), nalog);
  const korisnik = await podaci('users', uid);
  assert.deepStrictEqual(Object.keys(korisnik).sort(), KLJUCEVI_USERS);
  assert.equal(korisnik.displayName, 'Ana');
  assert.equal(korisnik.accountStatus, 'ACTIVE');
  assert.equal(korisnik.acceptedTermsVersion, '1.0');
  const milis = korisnik.createdAt.toMillis();
  assert.ok(milis >= prije - 5000 && milis <= poslije + 5000);
  assert.ok(korisnik.updatedAt.isEqual(korisnik.createdAt) && korisnik.acceptedTermsAt.isEqual(korisnik.createdAt));
});

test('I02-T14 (c) users sa accountStatus van SRS enum-a → 500, ništa promijenjeno', async () => {
  const { uid, idToken } = await noviKorisnik();
  await referenca('users', uid).set(kanonskiKorisnik({ accountStatus: 'NEPOZNAT' }));
  const korisnik = await podaci('users', uid);
  const odgovor = await init(idToken, { displayName: 'Ana', acceptedTermsVersion: '1.0' });
  provjeriTijeloGreske(odgovor, 500, 'INTERNAL_ERROR');
  provjeriBezInternihDetalja(odgovor);
  assert.deepStrictEqual(await podaci('users', uid), korisnik);
  assert.equal(await podaci('loyaltyAccounts', uid), undefined);
});
