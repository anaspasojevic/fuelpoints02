// I11-T01 (tijela zahtjeva i konverzije, §3.4, §8.4, §20.1) i I11-T04 (prikaz odgovora i grešaka).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  euroUCente,
  litreUMililitre,
  napraviZahtjevKupovine,
  napraviZahtjevOtkupa,
  novaTransakcijaId,
  opisiMreznuGresku,
  opisiOdgovor,
} from '../logika.js';

const VOUCHER = 'a'.repeat(64);
const UUID = '3f2b8c1e-9a4d-4e6b-8c1d-2f3a4b5c6d7e';
const ispravnaKupovina = () => ({
  loyaltyUid: 'korisnikA',
  posTransactionId: 'SIM-1',
  litri: '42,730',
  iznos: '70,50',
  occurredAt: '2026-10-21T08:30:00Z',
});

test('I11-T01: tijelo kupovine ima tačno 6 polja SRS-a, bez stationId i uid', () => {
  const zahtjev = napraviZahtjevKupovine(ispravnaKupovina());
  assert.equal(zahtjev.putanja, '/api/v1/pos/purchases');
  assert.deepEqual(Object.keys(zahtjev.tijelo).sort(), ['amountMinor', 'currency', 'loyaltyUid', 'occurredAt', 'posTransactionId', 'volumeMl']);
  assert.deepEqual(zahtjev.tijelo, {
    loyaltyUid: 'korisnikA',
    posTransactionId: 'SIM-1',
    volumeMl: 42_730,
    amountMinor: 7050,
    currency: 'EUR',
    occurredAt: '2026-10-21T08:30:00Z',
  });
  assert.ok(!('stationId' in zahtjev.tijelo) && !('uid' in zahtjev.tijelo));
});

test('I11-T01: tijelo otkupa je samo redemptionRequestId, voucherId je samo u putanji', () => {
  const zahtjev = napraviZahtjevOtkupa({ voucherId: VOUCHER, redemptionRequestId: UUID });
  assert.deepEqual(zahtjev.tijelo, { redemptionRequestId: UUID });
  assert.equal(zahtjev.putanja, `/api/v1/pos/vouchers/${VOUCHER}/redeem`);
});

test('I11-T01: konverzija litara u mililitre i EUR u cente', () => {
  assert.equal(litreUMililitre('42,730'), 42_730);
  assert.equal(litreUMililitre('42.73'), 42_730);
  assert.equal(litreUMililitre(' 0,001 '), 1);
  assert.equal(litreUMililitre('0,0004'), 0);
  assert.equal(litreUMililitre('0,0005'), 1);
  assert.equal(euroUCente('70,50'), 7050);
  assert.equal(euroUCente('0.1'), 10);
  assert.equal(euroUCente('1.005'), 101);
  assert.equal(euroUCente('0'), 0);
  for (const nevalidno of ['', 'abc', '-1', '1,2,3', '1e3', '١٢', undefined, null]) {
    assert.equal(litreUMililitre(nevalidno), null, String(nevalidno));
    assert.equal(euroUCente(nevalidno), null, String(nevalidno));
  }
});

test('I11-T01: nevalidan unos se odbija lokalno, prije slanja', () => {
  const lose = [
    { litri: '0' },
    { litri: '200,001' },
    { litri: 'dosta' },
    { iznos: '10000,01' },
    { iznos: '-5' },
    { posTransactionId: 'ima razmak' },
    { posTransactionId: '' },
    { posTransactionId: 'x'.repeat(65) },
    { loyaltyUid: '  ' },
    { occurredAt: '2026-10-21 08:30:00' },
    { occurredAt: '2026-10-21T08:30:00+02:00' },
    { occurredAt: '2026-13-45T08:30:00Z' },
  ];
  for (const izmjena of lose) {
    const zahtjev = napraviZahtjevKupovine({ ...ispravnaKupovina(), ...izmjena });
    assert.ok(zahtjev.greske?.length > 0, JSON.stringify(izmjena));
    assert.equal(zahtjev.tijelo, undefined, JSON.stringify(izmjena));
  }
  assert.ok(napraviZahtjevOtkupa({ voucherId: 'ABC', redemptionRequestId: UUID }).greske);
  assert.ok(napraviZahtjevOtkupa({ voucherId: VOUCHER, redemptionRequestId: UUID.toUpperCase() }).greske);
  assert.ok(napraviZahtjevOtkupa({ voucherId: VOUCHER, redemptionRequestId: 'nije-uuid' }).greske);
});

test('I11-T01: nova transakcija je jedinstvena i uklapa se u format §8.2', () => {
  const vrijednosti = new Set();
  for (let i = 0; i < 200; i += 1) {
    const id = novaTransakcijaId();
    assert.match(id, /^[A-Za-z0-9._-]{1,64}$/);
    vrijednosti.add(id);
  }
  assert.ok(vrijednosti.size > 190);
  assert.notEqual(novaTransakcijaId(1000, 0.1), novaTransakcijaId(1001, 0.1));
});

test('I11-T04: uspjeh i greška §27 prikazuju samo propisana polja', () => {
  const uspjeh = opisiOdgovor(201, JSON.stringify({ purchaseId: 'p1', earnedPoints: 42 }));
  assert.equal(uspjeh.vrsta, 'uspjeh');
  assert.deepEqual(uspjeh.tijelo, { purchaseId: 'p1', earnedPoints: 42 });

  const tijelo = { error: { code: 'INVALID_VOLUME', message: 'Količina nije ispravna.', correlationId: 'abc-123', stack: 'Error: at C:\\tajno' } };
  const greska = opisiOdgovor(422, JSON.stringify(tijelo));
  assert.deepEqual(greska, {
    vrsta: 'greska', status: 422, code: 'INVALID_VOLUME', message: 'Količina nije ispravna.', correlationId: 'abc-123', mozePonovo: false,
  });
  assert.ok(!JSON.stringify(greska).includes('tajno'));
});

test('I11-T04: neočekivano tijelo se ne prikazuje', () => {
  for (const tekst of ['<html>stack trace at C:\\tajno</html>', '', 'null', '[1,2]', '{"nesto":"drugo"}']) {
    const opis = opisiOdgovor(500, tekst);
    assert.equal(opis.vrsta, 'neocekivano', tekst);
    assert.ok(!JSON.stringify(opis).includes('tajno'));
  }
});

test('I11-T04: mreža nedostupna i 503 nude ponovni pokušaj istim ID-em', () => {
  assert.deepEqual(opisiMreznuGresku(), { vrsta: 'mreza', poruka: 'Backend nije dostupan.', mozePonovo: true });
  assert.equal(opisiOdgovor(502, JSON.stringify({ simulator: 'BACKEND_NEDOSTUPAN' })).poruka, 'Backend nije dostupan.');
  const tijelo503 = JSON.stringify({ error: { code: 'SERVICE_UNAVAILABLE', message: 'Servis nije dostupan.', correlationId: 'c1' } });
  assert.equal(opisiOdgovor(503, tijelo503).mozePonovo, true);
  assert.equal(opisiOdgovor(409, JSON.stringify({ error: { code: 'IDEMPOTENCY_CONFLICT', message: 'x', correlationId: 'c2' } })).mozePonovo, false);
});
