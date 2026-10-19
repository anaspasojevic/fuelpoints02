// AUTH-04, AUTH-05, O-10, O-16, O-24, ODLUKE §6 (f), (m), (o), (u): blokada loyalty mutacija za vrijeme brisanja naloga, deterministička
// promjena accountStatus usred transakcije i međustanja brisanja: I07-T08, I07-T09, I07-T15.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { napuniRewardDefinitions } from '../../src/punjenje/rewardDefinitions.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { omotacBaze } from '../pomocnici/omotacBaze.js';
import { napraviPripremuBrisanja } from '../pomocnici/pripremaBrisanja.js';
import { hex64, kanonskiKorisnik, provjeriBezInternihDetalja, provjeriTijeloGreske } from '../pomocnici/pripremaVaucera.js';

const projectId = provjeriTestnoOkruzenje();

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

// Primjer A + kupovina 30 000 ml (52 / 50) + istekao ACTIVE voucher Vx (20) za API-06: nalog 32 / 70, V (CAR_WASH) ACTIVE.
async function pripremiStanje() {
  const { k, V } = await b.pripremiKorisnikaA();
  await b.kupi(k.uid, 'POS-A3', 30_000);
  const Vx = hex64();
  await p.pripremiVaucer(Vx, k.uid, { costPoints: 20, expiresAtMs: Date.now() - 60_000 });
  await p.pripremiReserve(Vx, k.uid, 20, 32, 70);
  await p.referenca(`loyaltyAccounts/${k.uid}`).update({ availablePoints: 32, reservedPoints: 70 });
  return { k, V, Vx };
}

const postaviBrisanjeUToku = (uid) => p.referenca(`users/${uid}`).update({ accountStatus: 'DELETION_IN_PROGRESS' });

// Mutacije AUTH-05 (sve čitaju users u svojoj transakciji): zahtjev, očekivana greška za nalog u brisanju i uspjeh kontrole.
const MUTACIJE = [
  { naziv: 'issue', zahtjev: ({ k }, db) => b.zahtjevIzdavanja(k, 'SHOWER', { db }), greska: [409, 'ACCOUNT_DELETION_IN_PROGRESS'], uspjeh: 201 },
  { naziv: 'cancel', zahtjev: ({ k, V }, db) => b.zahtjevOtkazivanja(k, V, { db }), greska: [409, 'ACCOUNT_DELETION_IN_PROGRESS'], uspjeh: 200 },
  { naziv: 'redeem', zahtjev: ({ V }, db) => b.zahtjevOtkupa(V, 'POS-RDM-9', { db }), greska: [409, 'ACCOUNT_DELETION_IN_PROGRESS'], uspjeh: 200 },
  { naziv: 'purchase', zahtjev: ({ k }, db) => b.zahtjevKupovine(k.uid, 'POS-NOVA', 30_000, { db }), greska: [404, 'LOYALTY_ACCOUNT_NOT_FOUND'], uspjeh: 201 },
  { naziv: 'API-06', zahtjev: ({ k }, db) => b.zahtjevUskladjivanja(k, { db }), greska: [409, 'ACCOUNT_DELETION_IN_PROGRESS'], uspjeh: 200 },
];

test('I07-T08 (AUTH-05) stanje poslije K1: init 409, nova kupovina 404, issue / cancel / redeem / API-06 409; 0 upisa, baza nepromijenjena', async () => {
  const stanje = await pripremiStanje();
  await postaviBrisanjeUToku(stanje.k.uid);
  const sve = [
    { naziv: 'init', zahtjev: ({ k }, db) => b.zahtjevInita(k, { db }), greska: [409, 'ACCOUNT_DELETION_IN_PROGRESS'] },
    ...MUTACIJE,
  ];
  for (const { naziv, zahtjev, greska } of sve) {
    const prije = await p.snimakBaze();
    const omotac = omotacBaze(firebase.db);
    const odgovor = await zahtjev(stanje, omotac);
    provjeriTijeloGreske(odgovor, greska[0], greska[1], naziv);
    assert.deepStrictEqual(omotac.upisi, [], `${naziv}: pokušan upis`);
    assert.deepStrictEqual(await p.snimakBaze(), prije, `${naziv}: baza promijenjena`);
  }
});

// Obaveza (o), i05/K-1: pokušaj 1 čita ACTIVE nalog, prisilni ABORTED; prijePokusaja(2) Admin SDK-om mijenja users; pokušaj 2 mora vidjeti
// novo stanje. Baza poslije = baza prije uz jedinu razliku users.accountStatus.
test('I07-T09 (ODLUKE §6 (o)) DELETION_IN_PROGRESS postavljen između pokušaja 1 i 2: issue, cancel, redeem, API-06 → 409, purchase → 404, ništa upisano; kontrola → uspjeh', async () => {
  for (const { naziv, zahtjev, greska, uspjeh } of MUTACIJE) {
    const stanje = await pripremiStanje();
    const prije = await p.snimakBaze();
    let promijenjeno = false;
    const omotac = omotacBaze(firebase.db, {
      prisiliPonovniPokusaj: 1,
      async prijePokusaja(pokusaj) {
        if (pokusaj === 2) {
          await postaviBrisanjeUToku(stanje.k.uid);
          promijenjeno = true;
        }
      },
    });
    const odgovor = await zahtjev(stanje, omotac);
    provjeriTijeloGreske(odgovor, greska[0], greska[1], naziv);
    assert.ok(promijenjeno, `${naziv}: drugi pokušaj nije izvršen`);
    const putanjaKorisnika = `users/${stanje.k.uid}`;
    assert.deepStrictEqual(
      await p.snimakBaze(),
      { ...prije, [putanjaKorisnika]: { ...prije[putanjaKorisnika], accountStatus: 'DELETION_IN_PROGRESS' } },
      `${naziv}: baza promijenjena`,
    );

    await ocistiEmulatore();
    await napuniRewardDefinitions(firebase.db);
    const kontrola = await pripremiStanje();
    const odgovorKontrole = await zahtjev(kontrola, omotacBaze(firebase.db, { prisiliPonovniPokusaj: 1 }));
    assert.equal(odgovorKontrole.status, uspjeh, `${naziv} kontrola: ${odgovorKontrole.text}`);
    await ocistiEmulatore();
    await napuniRewardDefinitions(firebase.db);
  }
});

test('I07-T09 (f) init: users DELETION_IN_PROGRESS napravljen između pokušaja → 409, loyaltyAccounts nije kreiran; kontrola → 201', async () => {
  const k = await b.noviKorisnik();
  const omotac = omotacBaze(firebase.db, {
    prisiliPonovniPokusaj: 1,
    async prijePokusaja(pokusaj) {
      if (pokusaj === 2) {
        await p.referenca(`users/${k.uid}`).set(kanonskiKorisnik('DELETION_IN_PROGRESS'));
      }
    },
  });
  provjeriTijeloGreske(await b.zahtjevInita(k, { db: omotac }), 409, 'ACCOUNT_DELETION_IN_PROGRESS', 'init');
  assert.equal(await p.podaci(`loyaltyAccounts/${k.uid}`), undefined);
  assert.equal((await p.podaci(`users/${k.uid}`)).accountStatus, 'DELETION_IN_PROGRESS');

  const kontrola = await b.noviKorisnik();
  const odgovor = await b.zahtjevInita(kontrola, { db: omotacBaze(firebase.db, { prisiliPonovniPokusaj: 1 }) });
  assert.equal(odgovor.status, 201, odgovor.text);
});

test('I07-T09 (g) cijeli DELETE između pokušaja 1 i 2 issue-a → 409 ACCOUNT_NOT_INITIALIZED, 0 voucher-a, 0 dokumenata sa uid A', async () => {
  const { k } = await pripremiStanje();
  let odgovorBrisanja;
  const omotac = omotacBaze(firebase.db, {
    prisiliPonovniPokusaj: 1,
    async prijePokusaja(pokusaj) {
      if (pokusaj === 2) {
        odgovorBrisanja = await b.obrisi(k.idToken);
      }
    },
  });
  const odgovor = await b.zahtjevIzdavanja(k, 'SHOWER', { db: omotac });
  assert.equal(odgovorBrisanja?.status, 204, odgovorBrisanja?.text);
  provjeriTijeloGreske(odgovor, 409, 'ACCOUNT_NOT_INITIALIZED', 'issue poslije brisanja');
  await b.bezDokumenataKorisnika(k.uid, 'poslije issue-a');
  assert.equal(await b.postojiAuth(k.uid), false);
});

// Međustanja (plan 5.6): A sa V (CAR_WASH, requestId R1) ACTIVE i V2 (SHOWER, R2) otkupljen sa POS-RDM-1. Nalog 22 / 50.
async function pripremiMedjustanje() {
  const k = await b.noviKorisnik();
  await b.init(k);
  await b.kupi(k.uid, 'POS-A1', 42_730);
  await b.kupi(k.uid, 'POS-A2', 30_000);
  await b.kupi(k.uid, 'POS-A3', 30_000);
  const R1 = randomUUID();
  const V = await b.izdaj(k, 'CAR_WASH', { requestId: R1 });
  const V2 = await b.izdaj(k, 'SHOWER');
  await b.otkupi(V2, 'POS-RDM-1');
  assert.deepStrictEqual(await p.nalog(k.uid), [22, 50]);
  return { k, R1, V, V2 };
}

async function ocekujRetry(zahtjev, provjera, opis) {
  const omotac = omotacBaze(firebase.db);
  const odgovor = await zahtjev(omotac);
  assert.notEqual(odgovor.status, 500, `${opis}: 500`);
  provjera(odgovor);
  provjeriBezInternihDetalja(odgovor, opis);
  assert.deepStrictEqual(omotac.upisi, [], `${opis}: pokušan upis`);
}

test('I07-T15 (ODLUKE §6 (f), (m), (u), i07/P-6) retry izdavanja i otkupa u međustanjima brisanja → tačni kodovi, nikad 500, 0 upisa', async () => {
  // Upisi prekinutog DELETE-a: 1 users (K1); 2–4 zatvaranje V (K3); K4a: 5–6 rewardRequests, 7 redemptionRequests, 8–10 notifications,
  // 11–12 vouchers, 13 loyaltyAccounts.
  const faze = [
    {
      opis: 'poslije K1 / K3',
      baciNaUpisu: 5,
      issue: (o, { V }) => {
        assert.equal(o.status, 200, o.text);
        assert.deepStrictEqual([o.body.voucherId, o.body.status], [V, 'CANCELLED']);
      },
      redeem: (o, { V2 }) => {
        assert.equal(o.status, 200, o.text);
        assert.deepStrictEqual([o.body.voucherId, o.body.status], [V2, 'REDEEMED']);
      },
    },
    {
      opis: 'poslije mapping-a, prije vouchers',
      baciNaUpisu: 8,
      issue: (o) => provjeriTijeloGreske(o, 409, 'ACCOUNT_DELETION_IN_PROGRESS', 'issue'),
      redeem: (o) => provjeriTijeloGreske(o, 409, 'VOUCHER_ALREADY_REDEEMED', 'redeem'),
    },
    {
      opis: 'poslije vouchers',
      baciNaUpisu: 13,
      issue: (o) => provjeriTijeloGreske(o, 409, 'ACCOUNT_DELETION_IN_PROGRESS', 'issue'),
      redeem: (o) => provjeriTijeloGreske(o, 404, 'VOUCHER_NOT_FOUND', 'redeem'),
    },
    {
      opis: 'poslije K6',
      baciNaUpisu: undefined,
      issue: (o) => provjeriTijeloGreske(o, 401, 'UNAUTHENTICATED', 'issue'),
      redeem: (o) => provjeriTijeloGreske(o, 404, 'VOUCHER_NOT_FOUND', 'redeem'),
    },
  ];
  for (const faza of faze) {
    await ocistiEmulatore();
    await napuniRewardDefinitions(firebase.db);
    const stanje = await pripremiMedjustanje();
    const { k, R1, V2 } = stanje;
    const brisanje = await b.obrisi(k.idToken, { db: omotacBaze(firebase.db, { baciNaUpisu: faza.baciNaUpisu }) });
    assert.equal(brisanje.status, faza.baciNaUpisu === undefined ? 204 : 500, `${faza.opis}: DELETE`);
    if (faza.baciNaUpisu === 8) {
      assert.equal(await b.brojSaUid('rewardRequests', k.uid), 0, 'mapping-i obrisani');
      assert.equal(await b.brojSaUid('redemptionRequests', k.uid), 0, 'zapisi otkupa obrisani');
      assert.equal(await b.brojSaUid('vouchers', k.uid), 2, 'voucher-i još postoje');
    }
    if (faza.baciNaUpisu === 13) {
      assert.equal(await b.brojSaUid('vouchers', k.uid), 0, 'voucher-i obrisani');
      assert.notEqual(await p.podaci(`loyaltyAccounts/${k.uid}`), undefined, 'nalog još postoji');
    }
    await ocekujRetry((db) => b.zahtjevIzdavanja(k, 'CAR_WASH', { db, requestId: R1 }), (o) => faza.issue(o, stanje), `${faza.opis}: issue`);
    await ocekujRetry((db) => b.zahtjevOtkupa(V2, 'POS-RDM-1', { db }), (o) => faza.redeem(o, stanje), `${faza.opis}: redeem`);
  }
});
