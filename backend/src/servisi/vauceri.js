// Default import: crypto.randomBytes se poziva kao svojstvo modula (i04/P-3).
import crypto from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

// §17: voucher važi tačno 15 minuta od izdavanja.
export const TRAJANJE_VAUCERA_MS = 900_000;

// ODLUKE §6 (k): oblik voucherId-a (generisiVoucherId), bez zastavica (JS $ bez m ne prihvata završni prelom reda).
export const FORMAT_VOUCHER_ID = /^[0-9a-f]{64}$/;

// §15: enum statusa voucher-a.
export const STATUSI_VAUCERA = new Set(['ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED']);

export function jeNenegativanCijeliBroj(vrijednost) {
  return Number.isSafeInteger(vrijednost) && vrijednost >= 0;
}

export function jePozitivanCijeliBroj(vrijednost) {
  return Number.isSafeInteger(vrijednost) && vrijednost >= 1;
}

export function jeIspravanSacuvaniVaucer(vaucer) {
  return (
    jePozitivanCijeliBroj(vaucer.costPoints) &&
    STATUSI_VAUCERA.has(vaucer.status) &&
    vaucer.issuedAt instanceof Timestamp &&
    vaucer.expiresAt instanceof Timestamp
  );
}

// §15, §16, O-27 (O-23, ODLUKE §6 (t)): jedina definicija konzistentnog voucher dokumenta; koriste je redeem, cancel,
// procitajIstekleAktivne (API-03 reconcile, API-06) i O-16 retry API-03 (i06/P-1). Polja stanja moraju POSTOJATI (undefined ≠ null).
export function jeKonzistentnoStanjeVaucera(vaucer) {
  if (
    typeof vaucer?.uid !== 'string' ||
    vaucer.uid === '' ||
    typeof vaucer.rewardId !== 'string' ||
    !jeIspravanSacuvaniVaucer(vaucer)
  ) {
    return false;
  }
  const jeTs = (vrijednost) => vrijednost instanceof Timestamp;
  switch (vaucer.status) {
    case 'ACTIVE':
    case 'EXPIRED':
      return vaucer.redeemedAt === null && vaucer.redeemedAtStationId === null && vaucer.cancelledAt === null;
    case 'REDEEMED':
      return (
        jeTs(vaucer.redeemedAt) &&
        typeof vaucer.redeemedAtStationId === 'string' &&
        vaucer.redeemedAtStationId !== '' &&
        vaucer.cancelledAt === null
      );
    case 'CANCELLED':
      return jeTs(vaucer.cancelledAt) && vaucer.redeemedAt === null && vaucer.redeemedAtStationId === null;
    default:
      return false;
  }
}

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

// requestKey = SHA-256 nad UTF-8 bajtovima prviDio + ":" + drugiDio, hex malim slovima.
// §14, i04/P-4 (API-03): uid:requestId — requestId (O-15) nema ":". §20.2, O-8 (b) (API-04): stationId:redemptionRequestId — ni
// stationId (O-13) ni redemptionRequestId (§20.1) nema ":". Podjela je jednoznačna.
export function izracunajRequestKey(prviDio, drugiDio) {
  return crypto.createHash('sha256').update(`${prviDio}:${drugiDio}`, 'utf8').digest('hex');
}
