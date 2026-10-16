// I02-T11 (b), (c): produkcioni start (src/pokreni.js) kad Firestore ili Auth nije dostupan ili je spor → 503 SERVICE_UNAVAILABLE
// u roku, bez stack-a; log procesa ne sadrži token. Zaseban proces, jer Admin SDK čita emulator host-ove iz env-a.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { napraviKorisnika } from '../pomocnici/authEmulator.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { generisiPosKljuc, posKonfiguracija } from '../pomocnici/posKljuc.js';
import { crnaRupa, envProcesa, pokreniBackend, slobodanPort, sporProksi } from '../pomocnici/procesBackenda.js';

const projectId = provjeriTestnoOkruzenje();
const PRAVI_FIRESTORE = '127.0.0.1:8080';
const PRAVI_AUTH = '127.0.0.1:9099';
const ROK_ODGOVORA_MS = 15_000;
const ROK_CIJELOG_ZAHTJEVA_MS = 12_000;

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

// Vraća host:port servisa koji nije dostupan: zatvoren port ili „crna rupa” (prihvata konekciju, nikad ne odgovara).
async function nedostupanServis(vrsta) {
  if (vrsta === 'zatvoren port') {
    return { host: `127.0.0.1:${await slobodanPort()}`, zatvori: async () => {} };
  }
  const rupa = await crnaRupa();
  return { host: `127.0.0.1:${rupa.port}`, zatvori: rupa.zatvori };
}

// Stvaran err.code Admin SDK-a kad Auth nije dostupan (za TEST_REPORT, plan 5.5). Auth instanca zadržava host
// iz vremena kreiranja, pa se za dijagnostiku pravi nova Admin aplikacija sa privremeno izmijenjenim env-om.
async function kodNedostupnogAuth(host, token) {
  const staro = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST = host;
  let privremena;
  let tajmer;
  try {
    privremena = inicijalizujFirebaseAdmin({ projectId });
    const rok = new Promise((razrijesi) => {
      tajmer = setTimeout(() => razrijesi('bez odgovora u roku od 12 s'), 12_000);
    });
    const poziv = privremena.auth.verifyIdToken(token, true).then(
      () => 'PRIHVAĆEN',
      (greska) => greska.code ?? String(greska),
    );
    return await Promise.race([poziv, rok]);
  } finally {
    clearTimeout(tajmer);
    process.env.FIREBASE_AUTH_EMULATOR_HOST = staro;
    if (privremena !== undefined) {
      await deleteApp(privremena.app);
    }
  }
}

// Pokreće backend sa datim host-ovima, šalje jedan init i provjerava 503 SERVICE_UNAVAILABLE za < rokMs, tačno tri polja,
// bez stack-a i token-a u odgovoru i logu. poslijeOdgovora se izvršava dok proces još radi.
async function provjeri503(t, { opis, idToken, firestoreHost, authHost, rokMs, poslijeOdgovora = async () => {}, zatvori }) {
  const port = await slobodanPort();
  const backend = pokreniBackend(
    envProcesa({
      PORT: String(port),
      FIREBASE_PROJECT_ID: projectId,
      VERZIJA_USLOVA: '1.0',
      POS_API_KLJUCEVI: posKonfiguracija([['SIM01', generisiPosKljuc()]]),
      FIRESTORE_EMULATOR_HOST: firestoreHost,
      FIREBASE_AUTH_EMULATOR_HOST: authHost,
    }),
  );
  try {
    await backend.cekajSlusanje(port);
    const pocetak = Date.now();
    const odgovor = await fetch(`http://127.0.0.1:${port}/api/v1/account/init`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ displayName: 'Ana', acceptedTermsVersion: '1.0' }),
      signal: AbortSignal.timeout(rokMs + 15_000),
    });
    const tekst = await odgovor.text();
    const trajanje = Date.now() - pocetak;
    t.diagnostic(`${opis}: HTTP ${odgovor.status} za ${trajanje} ms`);

    assert.equal(odgovor.status, 503, `${opis}: tijelo ${tekst}`);
    assert.ok(trajanje < rokMs, `odgovor je stigao za ${trajanje} ms (rok ${rokMs} ms)`);
    const tijelo = JSON.parse(tekst);
    assert.deepStrictEqual(Object.keys(tijelo), ['error']);
    assert.deepStrictEqual(Object.keys(tijelo.error), ['code', 'message', 'correlationId']);
    assert.equal(tijelo.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(tijelo.error.message, KATALOG_GRESAKA.SERVICE_UNAVAILABLE.poruka);
    for (const zabranjeno of ['stack', '    at ', idToken]) {
      assert.ok(!tekst.includes(zabranjeno), `odgovor sadrži "${zabranjeno.slice(0, 20)}"`);
    }
    await poslijeOdgovora();
  } finally {
    await backend.zaustavi();
    await zatvori();
  }
  const log = backend.stdout + backend.stderr;
  assert.ok(log.includes('SERVICE_UNAVAILABLE'), 'log procesa ne sadrži grešku (presretanje nije radilo)');
  for (const segment of idToken.split('.').filter((dio) => dio.length > 0)) {
    assert.ok(!log.includes(segment), 'log procesa sadrži dio token-a');
  }
}

async function provjeriNedostupnost(t, { servis, vrsta }) {
  const { idToken } = await napraviKorisnika('ana@primjer.test');
  const nedostupan = await nedostupanServis(vrsta);
  await provjeri503(t, {
    opis: `${servis} – ${vrsta}`,
    idToken,
    firestoreHost: servis === 'Firestore' ? nedostupan.host : PRAVI_FIRESTORE,
    authHost: servis === 'Auth' ? nedostupan.host : PRAVI_AUTH,
    rokMs: ROK_ODGOVORA_MS,
    zatvori: nedostupan.zatvori,
    async poslijeOdgovora() {
      if (servis === 'Auth') {
        t.diagnostic(`err.code Admin SDK-a (Auth – ${vrsta}): ${await kodNedostupnogAuth(nedostupan.host, idToken)}`);
        assert.equal((await firebase.db.collection('users').get()).size, 0);
        assert.equal((await firebase.db.collection('loyaltyAccounts').get()).size, 0);
      }
    },
  });
}

for (const servis of ['Firestore', 'Auth']) {
  for (const vrsta of ['zatvoren port', 'crna rupa']) {
    test(`I02-T11 ${servis} nedostupan (${vrsta}) → 503 SERVICE_UNAVAILABLE za < 15 s, bez stack-a i token-a`, async (t) => {
      await provjeriNedostupnost(t, { servis, vrsta });
    });
  }
}

// I02-T11 (c), FIX LOOP 1 R-02: jedan rok (ROK_ZAVISNOG_SERVISA_MS) za cijeli zaštićeni zahtjev. Auth je spor, ali verifikacija
// uspijeva prije isteka roka; Firestore „visi” → 503 mora stići u roku cijelog zahtjeva, a ne poslije zbira dva roka.
for (const kasnjenjeMs of [4000, 2000]) {
  test(`I02-T11 (c) Auth spor (${kasnjenjeMs} ms po komadu) + Firestore crna rupa → 503 SERVICE_UNAVAILABLE za < 12 s`, async (t) => {
    const { idToken } = await napraviKorisnika('ana@primjer.test');
    const proksi = await sporProksi(Number(PRAVI_AUTH.split(':')[1]), kasnjenjeMs);
    const rupa = await crnaRupa();
    await provjeri503(t, {
      opis: `Auth spor ${kasnjenjeMs} ms + Firestore crna rupa`,
      idToken,
      firestoreHost: `127.0.0.1:${rupa.port}`,
      authHost: `127.0.0.1:${proksi.port}`,
      rokMs: ROK_CIJELOG_ZAHTJEVA_MS,
      async zatvori() {
        await rupa.zatvori();
        await proksi.zatvori();
      },
    });
    assert.equal((await firebase.db.collection('users').get()).size, 0);
    assert.equal((await firebase.db.collection('loyaltyAccounts').get()).size, 0);
  });
}
