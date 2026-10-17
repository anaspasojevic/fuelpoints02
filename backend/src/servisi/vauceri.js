// Default import: crypto.randomBytes se poziva kao svojstvo modula (i04/P-3).
import crypto from 'node:crypto';

// §17: voucher važi tačno 15 minuta od izdavanja.
export const TRAJANJE_VAUCERA_MS = 900_000;

// §15, i04/P-3: opaque voucherId iz CSPRNG-a, 32 bajta (256 bita) → 64 hex znaka malim slovima.
// Nije izveden iz requestId-a, uid-a ni vremena; ispravan Firestore doc ID i bezbjedan segment putanje.
export function generisiVoucherId() {
  return crypto.randomBytes(32).toString('hex');
}

// §18.1: voucher je istekao kad je serverTime ≥ expiresAt (granica uključiva).
export function jeIstekao(expiresAtMs, sadaMs) {
  return sadaMs >= expiresAtMs;
}

// i04/P-6: deterministički redoslijed release-a — expiresAt rastuće, pa voucherId rastuće (poređenje UTF-16 stringova).
// Elementi: { voucherId, expiresAtMs }.
export function poredakOslobadjanja(a, b) {
  if (a.expiresAtMs !== b.expiresAtMs) {
    return a.expiresAtMs - b.expiresAtMs;
  }
  if (a.voucherId < b.voucherId) {
    return -1;
  }
  return a.voucherId > b.voucherId ? 1 : 0;
}

// §14, i04/P-4: requestKey = SHA-256 nad UTF-8 bajtovima uid + ":" + requestId, hex malim slovima.
// requestId (O-15) nema ":", pa je podjela jednoznačna.
export function izracunajRequestKey(uid, requestId) {
  return crypto.createHash('sha256').update(`${uid}:${requestId}`, 'utf8').digest('hex');
}
