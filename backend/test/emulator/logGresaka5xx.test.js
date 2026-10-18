// I04-T20 (O-18, D-3, NFR-07; FIX LOOP 2, R-05, P-3): log 5xx grešaka ne zavisi od oblika poruke Firestore greške.
// Stvarne emulatorske gRPC greške (NOT_FOUND u transakciji i van nje) se bilježe bez poruke: name, code, ime gRPC statusa i okviri.
// Ne-gRPC greške (Error bez numeričkog code, bačen string) zadržavaju poruku, ali sa redigovanim putanjama dokumenata i hex nizovima.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, mock, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { centralniRukovalacGreskama } from '../../src/greske/obradaGresaka.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';

const projectId = provjeriTestnoOkruzenje();
const RUTA = '/rewards/:rewardId/issue';

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(async () => {
  await ocistiEmulatore();
});

afterEach(() => {
  mock.restoreAll();
});

after(async () => {
  await deleteApp(firebase.app);
});

const hex64 = () => randomBytes(32).toString('hex');

// ID dokumenta koji nije niz od ≥ 32 hex znaka (UUID ima crtice): hvata ga samo redakcija putanje ili izostavljena poruka.
const tajniIdBezHexa = () => `TAJNA-${randomUUID()}`;

// Grešku obrađuje centralni rukovalac (kao da je došla iz rute API-03); vraća odgovor i JSON zapis loga.
function obradi(greska) {
  const odgovor = {};
  const res = {
    headersSent: false,
    locals: { correlationId: randomUUID() },
    status(kod) {
      odgovor.status = kod;
      return this;
    },
    json(tijelo) {
      odgovor.tijelo = tijelo;
      return this;
    },
  };
  const zapisi = presretniLog();
  centralniRukovalacGreskama(greska, { method: 'POST', route: { path: RUTA } }, res, () => assert.fail('next(err) nije očekivan'));
  const log = tekstLoga(zapisi);
  mock.restoreAll();
  const zapis = log
    .split('\n')
    .map((linija) => {
      try {
        return JSON.parse(linija);
      } catch {
        return undefined;
      }
    })
    .find((z) => z?.correlationId === res.locals.correlationId);
  assert.ok(zapis, 'log bez zapisa greške');
  return { ...odgovor, log, zapis, correlationId: res.locals.correlationId };
}

// Odgovor po §27 (poruka iz kataloga) i zapis loga sa opisom greške i okvirima stack-a.
function provjeriOdgovorIZapis({ status, tijelo, zapis, correlationId }, opis) {
  const stavka = KATALOG_GRESAKA.INTERNAL_ERROR;
  assert.equal(status, 500, opis);
  assert.deepStrictEqual(tijelo, { error: { code: 'INTERNAL_ERROR', message: stavka.poruka, correlationId } }, opis);
  assert.equal(zapis.code, 'INTERNAL_ERROR', opis);
  assert.equal(zapis.status, 500, opis);
  assert.equal(zapis.putanja, RUTA, opis);
  assert.equal(typeof zapis.stack, 'string', `${opis}: log bez opisa greške`);
  assert.match(zapis.stack, /\n\s+at /, `${opis}: log bez okvira stack-a`);
}

// Stvarna gRPC greška: log sadrži name, code i ime statusa, ali ni ID dokumenta ni bilo koji red poruke Firestore-a.
function provjeriGrpcGresku(greska, tajne, opis) {
  assert.equal(greska.code, 5, `${opis}: očekivana stvarna NOT_FOUND greška emulatora, dobijeno ${greska.code}`);
  // Preduslov: sirova poruka emulatora nosi ID (oblik "path < Element { type: … name: "<id>" } >" iz re-reviewa, R-05).
  for (const tajna of tajne) {
    assert.ok(String(greska.message).includes(tajna), `${opis}: poruka emulatora ne sadrži ID (promijenjen oblik greške)`);
  }
  const rezultat = obradi(greska);
  provjeriOdgovorIZapis(rezultat, opis);
  assert.match(rezultat.zapis.stack, /NOT_FOUND|code 5/, `${opis}: log bez NOT_FOUND / code 5`);
  assert.ok(rezultat.zapis.stack.startsWith(`${greska.name} (code 5 NOT_FOUND)`), `${opis}: prvi red opisa: ${rezultat.zapis.stack.split('\n')[0]}`);
  for (const tajna of tajne) {
    assert.ok(!rezultat.log.includes(tajna), `${opis}: log sadrži ID dokumenta`);
  }
  // Zapis je JSON, pa se redovi poruke traže u parsiranom polju stack (kratki redovi poput "}" i ">" se preskaču).
  for (const red of String(greska.message).split('\n').map((r) => r.trim()).filter((r) => r.length >= 6)) {
    assert.ok(!rezultat.zapis.stack.includes(red),`${opis}: log sadrži red poruke gRPC greške ("${red.slice(0, 30)}…")`);
  }
}

test('I04-T20 (a) stvarna emulatorska NOT_FOUND (tx.update nepostojećeg vouchers/<id> u transakciji) → log bez ID-a i bez poruke, sa NOT_FOUND / code 5', async () => {
  for (const id of [hex64(), tajniIdBezHexa()]) {
    let greska;
    try {
      await firebase.db.runTransaction(async (tx) => {
        tx.update(firebase.db.doc(`vouchers/${id}`), { status: 'EXPIRED' });
      });
    } catch (e) {
      greska = e;
    }
    assert.ok(greska instanceof Error, 'transakcija nije pala');
    provjeriGrpcGresku(greska, [id], `vouchers/${id.slice(0, 6)}…`);
  }
});

test('I04-T20 (b) stvarna emulatorska NOT_FOUND van transakcije (update nepostojećeg rewardRequests/<id>) → log bez ID-a i bez poruke', async () => {
  for (const id of [hex64(), tajniIdBezHexa()]) {
    const greska = await firebase.db
      .doc(`rewardRequests/${id}`)
      .update({ voucherId: 'x' })
      .then(
        () => undefined,
        (e) => e,
      );
    assert.ok(greska instanceof Error, 'update nije pao');
    provjeriGrpcGresku(greska, [id], `rewardRequests/${id.slice(0, 6)}…`);
  }
});

test('I04-T20 (c) ne-gRPC Error i bačen string: log bez golog hex-a, release_<hex>, vouchers/<id>, reserve_<id>, sa porukom i okvirima', () => {
  const hex = hex64();
  const tajna = tajniIdBezHexa();
  const slucajevi = [
    ['goli hex', new Error(`neočekivano stanje ${hex}`), [hex]],
    ['release_<hex> bez kolekcije', new Error(`dokument release_${hex} već postoji`), [hex]],
    ['vouchers/<hex>', new Error(`neočekivano: vouchers/${hex}`), [hex]],
    ['reserve_<hex>', new Error(`neočekivano: loyaltyLedger/reserve_${hex}`), [hex]],
    ['vouchers/<id bez hex-a>', new Error(`neočekivano: vouchers/${tajna}`), [tajna]],
    ['reserve_<id bez hex-a>', new Error(`neočekivano: loyaltyLedger/reserve_${tajna}`), [tajna]],
    ['Error sa string code', Object.assign(new Error(`neočekivano ${hex}`), { code: 'ERR_NEPOZNATO' }), [hex]],
  ];
  for (const [opis, greska, tajne] of slucajevi) {
    const rezultat = obradi(greska);
    provjeriOdgovorIZapis(rezultat, opis);
    // Ne-gRPC greška zadržava poruku (dijagnostika), samo bez tajni.
    assert.match(rezultat.zapis.stack, /^Error: neočekivan|^Error: dokument/, `${opis}: log bez poruke greške`);
    for (const t of tajne) {
      assert.ok(!rezultat.log.includes(t), `${opis}: log sadrži tajnu`);
    }
  }

  for (const [opis, bacen, t] of [
    ['string sa golim hex-om', `greska ${hex}`, hex],
    ['string sa vouchers/<id>', `greska vouchers/${tajna}`, tajna],
  ]) {
    const rezultat = obradi(bacen);
    const stavka = KATALOG_GRESAKA.INTERNAL_ERROR;
    assert.equal(rezultat.status, 500, opis);
    assert.deepStrictEqual(rezultat.tijelo, { error: { code: 'INTERNAL_ERROR', message: stavka.poruka, correlationId: rezultat.correlationId } });
    assert.equal(typeof rezultat.zapis.stack, 'string', opis);
    assert.ok(!rezultat.log.includes(t), `${opis}: log sadrži tajnu`);
  }
});
