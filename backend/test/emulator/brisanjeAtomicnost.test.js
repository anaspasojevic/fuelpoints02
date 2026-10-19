// NFR-04, NFR-06, §23.4, O-36, ODLUKE §6 (b): prekid poslije svakog koraka i usred koraka brisanja, rok zahtjeva, nedostupnost i
// slobodna konkurentnost: I07-T06, I07-T11, I07-T13.
import assert from 'node:assert/strict';
import { setTimeout as pauza } from 'node:timers/promises';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { Timestamp } from 'firebase-admin/firestore';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../../src/konfiguracija/konfiguracija.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { obrisiNalog } from '../../src/servisi/brisanjeNaloga.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacAutha } from '../pomocnici/omotacAutha.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { napraviPripremuBrisanja } from '../pomocnici/pripremaBrisanja.js';
import { provjeriBezInternihDetalja, provjeriTijeloGreske } from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();
const TS = Timestamp.fromMillis(Date.UTC(2026, 9, 1, 8, 0, 0));

let firebase;
let p;
let b;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
  b = napraviPripremuBrisanja(firebase);
  ({ p } = b);
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

async function resetuj() {
  await ocistiEmulatore();
  await napuniRewardDefinitions(firebase.db);
}

// Opcija omotača: n-ti poziv prijeCommita (n-ta transakcija toka bez kontencije: 1 K1, 2 K3, 3 K4b) baca grešku, commit izostaje.
function prekidTransakcije(n) {
  let poziv = 0;
  return {
    prijeCommita() {
      poziv += 1;
      if (poziv === n) {
        throw new Error('ubrizgana greška prije commit-a C:\\tajno\\x.js');
      }
    },
  };
}

async function invarijante(uid, V) {
  const korisnik = await p.podaci(`users/${uid}`);
  const vaucer = await p.podaci(`vouchers/${V}`);
  const nalog = await p.podaci(`loyaltyAccounts/${uid}`);
  return {
    status: korisnik?.accountStatus ?? null,
    vaucer: vaucer?.status ?? null,
    nalog: nalog === undefined ? null : [nalog.availablePoints, nalog.reservedPoints],
    purchasesSaUid: await b.brojSaUid('purchases', uid),
    auth: await b.postojiAuth(uid),
  };
}

test('I07-T06 (a) prekid na granici svakog koraka (K1, K3, K4a, K5, K4b, K6) → 500, stanje prethodnih koraka; nastavak → 204 i konačno stanje API-T12', async () => {
  const DEL = 'DELETION_IN_PROGRESS';
  // Upisi primjera A: 1 users (K1); 2–4 voucher, release, nalog (K3); 5–9 K4a; 10–15 K5 (2 purchases, 4 ledger); 16 users (K4b).
  const slucajevi = [
    { opis: 'K1 prije commit-a', db: prekidTransakcije(1), stanje: { status: 'ACTIVE', vaucer: 'ACTIVE', nalog: [22, 50], purchasesSaUid: 2 } },
    { opis: 'prvi upis K3', db: { baciNaUpisu: 2 }, stanje: { status: DEL, vaucer: 'ACTIVE', nalog: [22, 50], purchasesSaUid: 2 } },
    { opis: 'K3 prije commit-a', db: prekidTransakcije(2), stanje: { status: DEL, vaucer: 'ACTIVE', nalog: [22, 50], purchasesSaUid: 2 } },
    { opis: 'prvi upis K4a', db: { baciNaUpisu: 5 }, stanje: { status: DEL, vaucer: 'CANCELLED', nalog: [72, 0], purchasesSaUid: 2 } },
    { opis: 'prvi upis K5', db: { baciNaUpisu: 10 }, stanje: { status: DEL, vaucer: null, nalog: null, purchasesSaUid: 2 } },
    { opis: 'upis K4b', db: { baciNaUpisu: 16 }, stanje: { status: DEL, vaucer: null, nalog: null, purchasesSaUid: 0 } },
    { opis: 'K4b prije commit-a', db: prekidTransakcije(3), stanje: { status: DEL, vaucer: null, nalog: null, purchasesSaUid: 0 } },
    { opis: 'deleteUser (K6)', auth: { baciNaBrisanju: true }, stanje: { status: null, vaucer: null, nalog: null, purchasesSaUid: 0 } },
  ];
  for (const slucaj of slucajevi) {
    await resetuj();
    const { k: A, V } = await b.pripremiKorisnikaA();
    const { k: B } = await b.pripremiKorisnikaB();
    const prijeA = await b.snimakPoUid(A.uid);
    const snimakB = await b.snimakPoUid(B.uid);

    const omotac = omotacBaze(firebase.db, slucaj.db ?? {});
    const auth = omotacAutha(firebase.auth, slucaj.auth ?? {});
    const prvi = await b.obrisi(A.idToken, { db: omotac, auth });
    provjeriTijeloGreske(prvi, 500, 'INTERNAL_ERROR', slucaj.opis);
    provjeriBezInternihDetalja(prvi, slucaj.opis);
    assert.deepStrictEqual(await invarijante(A.uid, V), { ...slucaj.stanje, auth: true }, `${slucaj.opis}: stanje poslije prekida`);

    const drugi = await b.obrisi(A.idToken);
    assert.equal(drugi.status, 204, `${slucaj.opis}: nastavak ${drugi.text}`);
    await b.provjeriObrisanA(A.uid, V, prijeA, slucaj.opis);
    assert.deepStrictEqual(await b.snimakPoUid(B.uid), snimakB, `${slucaj.opis}: B promijenjen`);
  }
});

// 401 notifikacija i 401 kupovina korisnika (Admin SDK), pa svaki od K4a i K5 ima dva paketa (400 + 1).
async function pripremiVelikiNalog() {
  const k = await b.noviKorisnik();
  await b.init(k);
  for (const [kolekcija, dokument] of [
    ['notifications', (i) => ({ uid: k.uid, type: 'POINTS_EARNED', title: 'Naslov', body: 'Tekst', createdAt: TS, readAt: null, relatedPurchaseId: `SIM01__P${i}` })],
    ['purchases', (i) => ({ uid: k.uid, stationId: 'SIM01', posTransactionId: `P${i}`, volumeMl: 1000, amountMinor: 100, currency: 'EUR', earnedPoints: 1, occurredAt: TS, recordedAt: TS })],
  ]) {
    const paket = firebase.db.batch();
    for (let i = 0; i < 401; i += 1) {
      paket.set(firebase.db.doc(`${kolekcija}/${kolekcija === 'purchases' ? `SIM01__P${i}` : `n${i}`}`), dokument(i));
    }
    await paket.commit();
  }
  return k;
}

test('I07-T06 (b) prekid usred K4a i usred K5 (drugi paket) → 500; nastavak → 204, 0 dokumenata sa uid; (c) svaki paket ≤ 400 operacija', async () => {
  // Upisi: 1 users (K1); K3 bez ACTIVE voucher-a 0; K4a notifications 2–401 (paket 1) i 402 (paket 2), 403 loyaltyAccounts;
  // K5 purchases 404–803 (paket 1) i 804 (paket 2).
  for (const [opis, baciNaUpisu, kolekcija] of [
    ['usred K4a', 402, 'notifications'],
    ['usred K5', 804, 'purchases'],
  ]) {
    await resetuj();
    const k = await pripremiVelikiNalog();
    const prvi = await b.obrisi(k.idToken, { db: omotacBaze(firebase.db, { baciNaUpisu }) });
    provjeriTijeloGreske(prvi, 500, 'INTERNAL_ERROR', opis);
    assert.equal(await b.brojSaUid(kolekcija, k.uid), 1, `${opis}: preostalo poslije prvog paketa`);
    assert.equal((await p.podaci(`users/${k.uid}`)).accountStatus, 'DELETION_IN_PROGRESS', opis);
    const drugi = await b.obrisi(k.idToken);
    assert.equal(drugi.status, 204, `${opis}: ${drugi.text}`);
    await b.bezDokumenataKorisnika(k.uid, opis);
    assert.equal(await b.brojSaUid('purchases', null), 401, `${opis}: purchases sa uid null`);
    assert.equal(await p.brojDokumenata('notifications'), 0, `${opis}: notifikacije`);
  }

  await resetuj();
  const k = await pripremiVelikiNalog();
  const omotac = omotacBaze(firebase.db);
  assert.equal((await b.obrisi(k.idToken, { db: omotac })).status, 204);
  const paketi = omotac.paketi;
  assert.ok(paketi.every((paket) => paket.brojOperacija >= 1 && paket.brojOperacija <= 400 && paket.commitovan), JSON.stringify(paketi));
  assert.deepStrictEqual(paketi.map((paket) => paket.brojOperacija), [400, 1, 1, 400, 1]);
});

test('I07-T11 (a) rok već istekao, NaN ili undefined → 503 prije ikakvog pristupa bazi i Auth-u', async () => {
  const { k } = await b.pripremiKorisnikaA();
  const prije = await p.snimakBaze();
  for (const rokDo of [Date.now() - 1, Number.NaN, undefined]) {
    const omotac = omotacBaze(firebase.db);
    const auth = omotacAutha(firebase.auth);
    await assert.rejects(
      obrisiNalog(omotac, auth, { uid: k.uid }, rokDo),
      (greska) => greska instanceof GreskaApi && greska.kod === 'SERVICE_UNAVAILABLE',
      `rokDo ${rokDo}`,
    );
    assert.equal(omotac.brojPristupa, 0, `rokDo ${rokDo}: pristup bazi`);
    assert.equal(auth.brisanja, 0, `rokDo ${rokDo}: deleteUser`);
  }
  assert.deepStrictEqual(await p.snimakBaze(), prije);
  assert.equal(await b.postojiAuth(k.uid), true);
});

test('I07-T11 (b) istek roka usred K3 → 503, kasni commit konzistentan; nastavak → 204; (c) Auth nedostupan → 503; (d) Firestore UNAVAILABLE → 503 bez upisa', async () => {
  // (b) K3 čeka duže od roka prije commit-a.
  const { k: A, V } = await b.pripremiKorisnikaA();
  const prijeA = await b.snimakPoUid(A.uid);
  let poziv = 0;
  const omotac = omotacBaze(firebase.db, {
    async prijeCommita() {
      poziv += 1;
      if (poziv === 2) {
        await pauza(ROK_ZAVISNOG_SERVISA_MS + 500);
      }
    },
  });
  const odgovor = await b.obrisi(A.idToken, { db: omotac });
  provjeriTijeloGreske(odgovor, 503, 'SERVICE_UNAVAILABLE', 'istek u K3');
  await omotac.sveTransakcijeZavrsene;
  const [dostupno, rezervisano] = await p.nalog(A.uid);
  assert.equal(dostupno + rezervisano, 72, 'zbir bodova');
  assert.equal((await p.podaci(`vouchers/${V}`)).status, 'CANCELLED', 'kasni commit K3');
  assert.notEqual(await p.podaci(`loyaltyLedger/release_${V}`), undefined, 'release uz zatvoren voucher');
  assert.equal((await b.obrisi(A.idToken)).status, 204);
  await b.provjeriObrisanA(A.uid, V, prijeA, 'nastavak poslije 503');

  // (c) Auth nedostupan pri brisanju naloga.
  await resetuj();
  const { k: A2, V: V2 } = await b.pripremiKorisnikaA();
  const prijeA2 = await b.snimakPoUid(A2.uid);
  const nedostupan = await b.obrisi(A2.idToken, { auth: omotacAutha(firebase.auth, { baciNaBrisanju: { code: 'app/network-error' } }) });
  provjeriTijeloGreske(nedostupan, 503, 'SERVICE_UNAVAILABLE', 'Auth nedostupan');
  assert.equal(await p.podaci(`users/${A2.uid}`), undefined);
  assert.equal(await b.postojiAuth(A2.uid), true);
  assert.equal((await b.obrisi(A2.idToken)).status, 204);
  await b.provjeriObrisanA(A2.uid, V2, prijeA2, 'nastavak poslije Auth 503');

  // (d) Firestore UNAVAILABLE (14) na prvoj transakciji.
  await resetuj();
  const { k: A3 } = await b.pripremiKorisnikaA();
  const prije = await p.snimakBaze();
  const odbijen = omotacBaze(firebase.db, { odbijTransakcijuSa: { code: 14 } });
  provjeriTijeloGreske(await b.obrisi(A3.idToken, { db: odbijen }), 503, 'SERVICE_UNAVAILABLE', 'Firestore 14');
  assert.deepStrictEqual(odbijen.upisi, []);
  assert.deepStrictEqual(await p.snimakBaze(), prije);
  assert.equal(await b.postojiAuth(A3.uid), true);
});

// Ponavlja DELETE dok ne dobije 204 ili 401 (Auth nalog već obrisan paralelnim zahtjevom); 503 je dozvoljen međuishod.
async function zavrsiBrisanje(k) {
  for (let pokusaj = 0; pokusaj < 5; pokusaj += 1) {
    const odgovor = await b.obrisi(k.idToken);
    if (odgovor.status === 204 || odgovor.status === 401) {
      return;
    }
    assert.equal(odgovor.status, 503, odgovor.text);
  }
  assert.fail('brisanje nije završeno');
}

// Lanac ledger-a od (0, 0): svaki događaj počinje od stanja poslije prethodnog (availableAfter − deltaAvailable, reservedAfter − deltaReserved).
function postojiLanac(dogadjaji, dostupno = 0, rezervisano = 0) {
  if (dogadjaji.length === 0) {
    return rezervisano === 0;
  }
  return dogadjaji.some(
    (d, i) =>
      d.availableAfter - d.deltaAvailable === dostupno &&
      d.reservedAfter - d.deltaReserved === rezervisano &&
      postojiLanac([...dogadjaji.slice(0, i), ...dogadjaji.slice(i + 1)], d.availableAfter, d.reservedAfter),
  );
}

test('I07-T13 (NFR-06) slobodna konkurentnost, 10 ponavljanja: (a) 2 paralelna DELETE; (b) DELETE ‖ 3× issue ‖ 2× kupovina ‖ cancel → 0×500, sve očišćeno, ledger konzistentan', async (t) => {
  const raspodjela = {};
  const zabiljezi = (naziv, status) => {
    raspodjela[naziv] ??= {};
    raspodjela[naziv][status] = (raspodjela[naziv][status] ?? 0) + 1;
  };

  for (let i = 0; i < 10; i += 1) {
    // (a)
    await resetuj();
    const { k: A, V } = await b.pripremiKorisnikaA();
    const prijeA = await b.snimakPoUid(A.uid);
    const odgovori = await Promise.all([b.obrisi(A.idToken), b.obrisi(A.idToken)]);
    for (const odgovor of odgovori) {
      zabiljezi('(a) DELETE', odgovor.status);
      assert.ok([204, 503].includes(odgovor.status), `(a) ${i}: ${odgovor.status} ${odgovor.text}`);
    }
    if (odgovori.some((odgovor) => odgovor.status === 503)) {
      await zavrsiBrisanje(A);
    }
    await b.provjeriObrisanA(A.uid, V, prijeA, `(a) ${i}`);

    // (b)
    await resetuj();
    const { k, V: Vb } = await b.pripremiKorisnikaA();
    const zahtjevi = [
      ['DELETE', b.obrisi(k.idToken)],
      ['issue', b.zahtjevIzdavanja(k, 'SHOWER')],
      ['issue', b.zahtjevIzdavanja(k, 'SHOWER')],
      ['issue', b.zahtjevIzdavanja(k, 'SHOWER')],
      ['purchase', b.zahtjevKupovine(k.uid, `POS-K${i}a`, 30_000)],
      ['purchase', b.zahtjevKupovine(k.uid, `POS-K${i}b`, 30_000)],
      ['cancel', b.zahtjevOtkazivanja(k, Vb)],
    ];
    const rezultati = await Promise.all(zahtjevi.map(([, zahtjev]) => zahtjev));
    const dozvoljeno = { DELETE: [204, 503], issue: [201, 401, 409, 503], purchase: [201, 404, 503], cancel: [200, 401, 404, 409, 503] };
    rezultati.forEach((odgovor, j) => {
      const naziv = zahtjevi[j][0];
      zabiljezi(`(b) ${naziv}`, odgovor.body?.error?.code ? `${odgovor.status} ${odgovor.body.error.code}` : odgovor.status);
      assert.ok(dozvoljeno[naziv].includes(odgovor.status), `(b) ${i} ${naziv}: ${odgovor.status} ${odgovor.text}`);
    });
    if (rezultati[0].status === 503) {
      await zavrsiBrisanje(k);
    }
    await b.bezDokumenataKorisnika(k.uid, `(b) ${i}`);
    assert.equal(await b.postojiAuth(k.uid), false, `(b) ${i}: Auth`);

    const dogadjaji = (await firebase.db.collection('loyaltyLedger').where('uid', '==', null).get()).docs.map((d) => d.data());
    const poVauceru = {};
    for (const d of dogadjaji.filter((dogadjaj) => dogadjaj.voucherId !== null)) {
      poVauceru[d.voucherId] ??= [];
      poVauceru[d.voucherId].push(d.type);
    }
    for (const [voucherId, tipovi] of Object.entries(poVauceru)) {
      const sortirani = tipovi.sort();
      assert.ok(
        JSON.stringify(sortirani) === JSON.stringify(['REWARD_RELEASE', 'REWARD_RESERVE']) ||
          JSON.stringify(sortirani) === JSON.stringify(['REWARD_REDEEM', 'REWARD_RESERVE']),
        `(b) ${i}: voucher ${voucherId.slice(0, 8)}: ${sortirani}`,
      );
    }
    assert.ok(postojiLanac(dogadjaji), `(b) ${i}: lanac ledger-a nije uzastopan`);
  }
  t.diagnostic(`raspodjela I07-T13: ${JSON.stringify(raspodjela)}`);
});
