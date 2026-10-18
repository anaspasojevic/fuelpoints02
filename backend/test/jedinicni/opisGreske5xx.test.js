// I05-T01 (O-19, ODLUKE §6 (h), NFR-07, D-3, O-18): opis 5xx greške u logu.
// R-07: okviri stack-a se uzimaju tek POSLIJE zaglavlja "<name>: <message>", pa nijedan red poruke (ni red koji počinje sa "at ") ne ulazi u log;
// R-08: err.name i okviri ručno postavljenog stack-a se rediguju; R-09: prag 32 hex i velika slova; R-10: opis greške nikad ne baca.
// Bez emulatora: grešku obrađuje centralni rukovalac (kao da je došla iz rute API-05), log je presretnut (svi kanali).
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterEach, mock, test } from 'node:test';
import { GreskaApi } from '../../src/greske/GreskaApi.js';
import { KATALOG_GRESAKA } from '../../src/greske/katalogGresaka.js';
import { centralniRukovalacGreskama } from '../../src/greske/obradaGresaka.js';
import { presretniLog, tekstLoga } from '../pomocnici/presretanjeLoga.js';

const RUTA = '/vouchers/:voucherId/cancel';
const NEDOSTUPAN_OPIS = '(opis greške nedostupan)';

afterEach(() => {
  mock.restoreAll();
});

const hex64 = () => randomBytes(32).toString('hex');
const tajna = () => `TAJNA-${randomUUID()}`;

// Grešku obrađuje centralni rukovalac; vraća odgovor, cijeli log i jedini JSON zapis loga ovog zahtjeva.
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
  try {
    centralniRukovalacGreskama(greska, { method: 'POST', route: { path: RUTA } }, res, () => assert.fail('next(err) nije očekivan'));
  } finally {
    mock.restoreAll();
  }
  const log = tekstLoga(zapisi);
  const zapisiZahtjeva = log
    .split('\n')
    .map((linija) => {
      try {
        return JSON.parse(linija);
      } catch {
        return undefined;
      }
    })
    .filter((z) => z?.correlationId === res.locals.correlationId);
  assert.equal(zapisiZahtjeva.length, 1, 'broj zapisa loga');
  return { ...odgovor, log, zapis: zapisiZahtjeva[0], correlationId: res.locals.correlationId };
}

function provjeri500(rezultat, opis) {
  assert.equal(rezultat.status, 500, opis);
  assert.deepStrictEqual(
    rezultat.tijelo,
    { error: { code: 'INTERNAL_ERROR', message: KATALOG_GRESAKA.INTERNAL_ERROR.poruka, correlationId: rezultat.correlationId } },
    opis,
  );
  assert.equal(rezultat.zapis.code, 'INTERNAL_ERROR', opis);
  assert.equal(rezultat.zapis.status, 500, opis);
  assert.equal(rezultat.zapis.putanja, RUTA, opis);
  assert.equal(typeof rezultat.zapis.stack, 'string', `${opis}: log bez opisa greške`);
}

function provjeriBezTajni(rezultat, tajne, opis) {
  for (const t of tajne) {
    assert.ok(!rezultat.log.includes(t), `${opis}: log sadrži tajnu (${t.slice(0, 12)}…)`);
  }
}

// Greška čija poruka ima više redova; stack se formira lijeno, pa nosi i redove poruke (oblik "Error: prvi\n    at TAJNA…\n    at f (…)").
function greskaSaPorukom(poruka, dodatno = {}) {
  return Object.assign(new Error(poruka), dodatno);
}

test('I05-T01 (a) R-07: red poruke koji počinje sa "at " ne ulazi u log (gRPC i ne-gRPC), okviri stack-a ostaju', () => {
  const h = hex64();
  const t1 = tajna();
  const t2 = tajna();
  const poruka = `prvi red\n    at ${h}\n    at ${t1}\n    at vouchers/${t2}`;
  const tajne = [h, t1, t2, 'TAJNA'];

  const grpc = obradi(greskaSaPorukom(poruka, { code: 5 }));
  provjeri500(grpc, 'gRPC');
  assert.ok(grpc.zapis.stack.startsWith('Error (code 5 NOT_FOUND)'), `gRPC prvi red: ${grpc.zapis.stack.split('\n')[0]}`);
  assert.match(grpc.zapis.stack, /\n\s+at /, 'gRPC: log bez okvira stack-a');
  assert.ok(!grpc.zapis.stack.includes('prvi red'), 'gRPC: log sadrži red poruke');
  assert.ok(!grpc.zapis.stack.includes('[hex]'), 'gRPC: red poruke sa hex-om je ušao u okvire (redigovan)');
  assert.ok(!grpc.zapis.stack.includes('[putanja dokumenta]'), 'gRPC: red poruke sa putanjom je ušao u okvire (redigovan)');
  provjeriBezTajni(grpc, tajne, 'gRPC');

  const neGrpc = obradi(greskaSaPorukom(`prvi red\n    at ${h}`));
  provjeri500(neGrpc, 'ne-gRPC');
  assert.match(neGrpc.zapis.stack, /\n\s+at /, 'ne-gRPC: log bez okvira stack-a');
  // Poruka ne-gRPC greške je zaglavlje opisa (redigovana); okviri poslije zaglavlja ne ponavljaju nijedan red poruke.
  const zaglavlje = 'Error: prvi red\n    at [hex]';
  assert.ok(neGrpc.zapis.stack.startsWith(`${zaglavlje}\n`), `ne-gRPC zaglavlje: ${neGrpc.zapis.stack.slice(0, 60)}`);
  const okviri = neGrpc.zapis.stack.slice(zaglavlje.length);
  assert.match(okviri, /\n\s+at /, 'ne-gRPC: nema okvira');
  assert.ok(!okviri.includes('[hex]'), `ne-gRPC: red poruke sa hex-om u okvirima: ${okviri.slice(0, 80)}`);
  provjeriBezTajni(neGrpc, [h], 'ne-gRPC');
});

test('I05-T01 (b) R-08: err.name i okviri ručno postavljenog stack-a se rediguju; stack sa drugim zaglavljem → bez okvira', () => {
  const h = hex64();
  const t = tajna();

  // name postavljen prije prvog čitanja stack-a (V8 formira zaglavlje lijeno sa trenutnim name).
  for (const [opis, dodatno] of [
    ['gRPC', { code: 5 }],
    ['ne-gRPC', {}],
  ]) {
    const greska = new Error('poruka');
    greska.name = `Greska ${h} vouchers/${t}`;
    Object.assign(greska, dodatno);
    const rezultat = obradi(greska);
    provjeri500(rezultat, `name (${opis})`);
    provjeriBezTajni(rezultat, [h, t], `name (${opis})`);
    assert.match(rezultat.zapis.stack, /\n\s+at /, `name (${opis}): log bez okvira`);
  }

  // Ručno postavljen stack sa ispravnim zaglavljem: okviri se zadržavaju, ali redigovani.
  for (const [opis, dodatno] of [
    ['gRPC', { code: 5 }],
    ['ne-gRPC', {}],
  ]) {
    const greska = Object.assign(new Error('poruka'), dodatno);
    greska.stack = `Error: poruka\n    at f (vouchers/${t})\n    at ${h} (x.js:1:1)`;
    const rezultat = obradi(greska);
    provjeri500(rezultat, `ručni stack (${opis})`);
    provjeriBezTajni(rezultat, [h, t], `ručni stack (${opis})`);
    assert.ok(rezultat.zapis.stack.includes('    at f ([putanja dokumenta]'), `ručni stack (${opis}): okvir sa putanjom: ${rezultat.zapis.stack}`);
    assert.ok(rezultat.zapis.stack.includes('    at [hex] (x.js:1:1)'), `ručni stack (${opis}): okvir sa hex-om: ${rezultat.zapis.stack}`);
  }

  // Ručno postavljen stack koji ne počinje zaglavljem greške → 0 okvira, bez tajne.
  for (const [opis, dodatno] of [
    ['gRPC', { code: 5 }],
    ['ne-gRPC', {}],
  ]) {
    const greska = Object.assign(new Error('poruka'), dodatno);
    greska.stack = `DrugoZaglavlje: x\n    at ${t}\n    at g (y.js:2:2)`;
    const rezultat = obradi(greska);
    provjeri500(rezultat, `drugo zaglavlje (${opis})`);
    provjeriBezTajni(rezultat, [t, 'y.js'], `drugo zaglavlje (${opis})`);
    assert.doesNotMatch(rezultat.zapis.stack, /\n\s+at /, `drugo zaglavlje (${opis}): okviri prisutni`);
  }
});

test('I05-T01 (c) R-09: ne-gRPC poruka — tačno 32 hex i 64 hex velikim slovima se rediguju; 31 hex ostaje (granica heuristike)', () => {
  const h32 = randomBytes(16).toString('hex');
  const h64v = hex64().toUpperCase();
  const h31 = randomBytes(16).toString('hex').slice(0, 31);

  const r32 = obradi(new Error(`stanje ${h32}`));
  provjeri500(r32, '32 hex');
  provjeriBezTajni(r32, [h32], '32 hex');
  assert.ok(r32.zapis.stack.startsWith('Error: stanje [hex]'), `32 hex: ${r32.zapis.stack.split('\n')[0]}`);

  const rv = obradi(new Error(`stanje ${h64v}`));
  provjeri500(rv, '64 hex velikim slovima');
  provjeriBezTajni(rv, [h64v], '64 hex velikim slovima');
  assert.ok(rv.zapis.stack.startsWith('Error: stanje [hex]'), `velika slova: ${rv.zapis.stack.split('\n')[0]}`);

  const r31 = obradi(new Error(`stanje ${h31}`));
  provjeri500(r31, '31 hex');
  assert.ok(r31.zapis.stack.startsWith(`Error: stanje ${h31}`), `31 hex: ${r31.zapis.stack.split('\n')[0]}`);
});

test('I05-T01 (d) R-10: ne-Error bez primitivne vrijednosti, toString koji baca, stack getter koji baca → 500 po §27 sa statičkim opisom', () => {
  const h = hex64();
  const bezPrototipa = Object.create(null);
  const bacaToString = {
    toString() {
      throw new Error(`baca ${h}`);
    },
  };
  const bacaStack = new Error('poruka');
  Object.defineProperty(bacaStack, 'stack', {
    get() {
      throw new Error(`stack baca ${h}`);
    },
  });
  for (const [opis, greska] of [
    ['Object.create(null)', bezPrototipa],
    ['toString baca', bacaToString],
    ['stack getter baca', bacaStack],
  ]) {
    const rezultat = obradi(greska);
    provjeri500(rezultat, opis);
    assert.equal(rezultat.zapis.stack, NEDOSTUPAN_OPIS, opis);
    provjeriBezTajni(rezultat, [h], opis);
  }
});

test('I05-T01 (e) regresija: GreskaApi SERVICE_UNAVAILABLE → 503 sa zaglavljem "GreskaApi: SERVICE_UNAVAILABLE" i okvirima', () => {
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
  centralniRukovalacGreskama(new GreskaApi('SERVICE_UNAVAILABLE'), { method: 'POST', route: { path: RUTA } }, res, () =>
    assert.fail('next(err) nije očekivan'),
  );
  mock.restoreAll();
  const zapis = JSON.parse(tekstLoga(zapisi).split('\n').find((l) => l.includes(res.locals.correlationId)));
  assert.equal(odgovor.status, 503);
  assert.equal(odgovor.tijelo.error.code, 'SERVICE_UNAVAILABLE');
  assert.ok(zapis.stack.startsWith('GreskaApi: SERVICE_UNAVAILABLE\n'), zapis.stack.split('\n')[0]);
  assert.match(zapis.stack, /\n\s+at /);
});
