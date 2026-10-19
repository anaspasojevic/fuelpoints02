import { GreskaApi } from '../greske/GreskaApi.js';

// §20.1: format redemptionRequestId, doslovno, bez zastavica (JS $ bez m ne prihvata završni prelom reda).
export const FORMAT_REDEMPTION_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

function jeObicanObjekat(vrijednost) {
  return typeof vrijednost === 'object' && vrijednost !== null && !Array.isArray(vrijednost);
}

// Strogo tijelo API-04 (§20, O-1): tačno jedno polje redemptionRequestId. stationId (iz POS ključa), uid (iz voucher-a) i voucherId
// (iz putanje) određuje Backend, pa svako drugo polje → INVALID_REQUEST. Vrijednost se ne stavlja u poruku ni log.
// Vraća novi objekat (nikad tijelo po referenci).
export function provjeriTijeloOtkupa(tijelo) {
  if (!jeObicanObjekat(tijelo)) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  if (Object.keys(tijelo).length !== 1 || !Object.hasOwn(tijelo, 'redemptionRequestId')) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  const { redemptionRequestId } = tijelo;
  if (typeof redemptionRequestId !== 'string' || !FORMAT_REDEMPTION_REQUEST_ID.test(redemptionRequestId)) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  return { redemptionRequestId };
}
