import { GreskaApi } from '../greske/GreskaApi.js';
import { procitajOccurredAt } from './vrijemeKupovine.js';

// Strogo tijelo API-02 (§8.4, §8.5, §3.1): stationId, earnedPoints i recordedAt su isključivo serverski.
const DOZVOLJENA_POLJA = new Set(['loyaltyUid', 'posTransactionId', 'volumeMl', 'amountMinor', 'currency', 'occurredAt']);

// §8.2 (JS $ bez m zastavice ne prihvata završni prelom reda).
const POS_TRANSACTION_ID = /^[A-Za-z0-9._-]{1,64}$/;
// §8.4: occurredAt najviše 5 minuta u budućnosti po vremenu Backend-a (granica uključiva).
const NAJVISE_U_BUDUCNOSTI_MS = 300_000;

function jeObicanObjekat(vrijednost) {
  return typeof vrijednost === 'object' && vrijednost !== null && !Array.isArray(vrijednost);
}

function jeIntegerUOpsegu(vrijednost, najmanje, najvise) {
  return Number.isInteger(vrijednost) && vrijednost >= najmanje && vrijednost <= najvise;
}

// JSON -0 je integer, ali bi ga Firestore upisao kao double (i03/P-9).
function bezNegativneNule(vrijednost) {
  return vrijednost === 0 ? 0 : vrijednost;
}

// Format loyaltyUid (i03/P-5) prije bilo kakvog pristupa Firestore-u: ispravan UTF-16, 1–128 jedinica,
// bez "/", nije "." ni "..", ne odgovara rezervisanom obliku __…__ (zaštita putanje dokumenta).
function jeIspravanFormatUid(loyaltyUid) {
  return (
    loyaltyUid.isWellFormed() &&
    loyaltyUid.length >= 1 &&
    loyaltyUid.length <= 128 &&
    !loyaltyUid.includes('/') &&
    loyaltyUid !== '.' &&
    loyaltyUid !== '..' &&
    !/^__.*__$/s.test(loyaltyUid)
  );
}

// Redoslijed provjera je obavezujući (i03/P-6, tabela 5.3); prvi neuspjeh određuje kod.
// Validacija uvijek prethodi transakciji, pa i provjeri idempotentnosti. Vraća novi objekat (nikad tijelo po referenci).
export function provjeriTijeloKupovine(tijelo, sadaMs) {
  if (!jeObicanObjekat(tijelo)) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  if (Object.keys(tijelo).some((kljuc) => !DOZVOLJENA_POLJA.has(kljuc))) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  const { loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAt } = tijelo;
  if (typeof loyaltyUid !== 'string') {
    throw new GreskaApi('INVALID_REQUEST');
  }
  if (typeof posTransactionId !== 'string' || !POS_TRANSACTION_ID.test(posTransactionId)) {
    throw new GreskaApi('INVALID_TRANSACTION_ID');
  }
  if (!jeIntegerUOpsegu(volumeMl, 1, 200_000)) {
    throw new GreskaApi('INVALID_VOLUME');
  }
  if (!jeIntegerUOpsegu(amountMinor, 0, 1_000_000)) {
    throw new GreskaApi('INVALID_AMOUNT');
  }
  if (currency !== 'EUR') {
    throw new GreskaApi('UNSUPPORTED_CURRENCY');
  }
  const occurredAtMs = procitajOccurredAt(occurredAt);
  if (occurredAtMs === null || occurredAtMs > sadaMs + NAJVISE_U_BUDUCNOSTI_MS) {
    throw new GreskaApi('INVALID_OCCURRED_AT');
  }
  // O-10: neispravan format i nepostojeći nalog daju isti kod; ovdje bez pristupa bazi.
  if (!jeIspravanFormatUid(loyaltyUid)) {
    throw new GreskaApi('LOYALTY_ACCOUNT_NOT_FOUND');
  }
  return {
    loyaltyUid,
    posTransactionId,
    volumeMl: bezNegativneNule(volumeMl),
    amountMinor: bezNegativneNule(amountMinor),
    currency,
    occurredAtMs,
  };
}
