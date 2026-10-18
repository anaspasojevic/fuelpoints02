import { GreskaApi } from '../greske/GreskaApi.js';
import { FORMAT_VOUCHER_ID } from '../servisi/vauceri.js';

function jeObicanObjekat(vrijednost) {
  return typeof vrijednost === 'object' && vrijednost !== null && !Array.isArray(vrijednost);
}

// O-21, i05/P-2 (§26 API-05, API-06 „без body-ја”): endpoint bez business input-a prihvata samo odsustvo tijela ili prazan JSON objekat.
// Globalni express.json() čita tijelo samo za JSON Content-Type; inače ostavlja req.body === undefined i tijelo NE čita. Zato „bez
// tijela” znači i da zahtjev ne nosi nepročitan sadržaj: Transfer-Encoding prisutan ili Content-Length različit od '0' → INVALID_REQUEST.
// Retrofit @POST bez @Body (Content-Length: 0, bez Content-Type) je ispravan zahtjev.
export function provjeriPraznoTijelo(tijelo, zaglavlja) {
  if (tijelo === undefined) {
    const duzina = zaglavlja['content-length'];
    if (zaglavlja['transfer-encoding'] !== undefined || (duzina !== undefined && duzina !== '0')) {
      throw new GreskaApi('INVALID_REQUEST');
    }
    return;
  }
  if (!jeObicanObjekat(tijelo) || Object.keys(tijelo).length !== 0) {
    throw new GreskaApi('INVALID_REQUEST');
  }
}

// O-22, ODLUKE §6 (k): voucherId iz putanje je 64 mala hex znaka (generisiVoucherId); svaki drugi oblik ne postoji kao voucher
// → VOUCHER_NOT_FOUND bez pristupa bazi. Vrijednost se ne stavlja ni u poruku ni u log.
export function provjeriVoucherId(voucherId) {
  if (typeof voucherId !== 'string' || !FORMAT_VOUCHER_ID.test(voucherId)) {
    throw new GreskaApi('VOUCHER_NOT_FOUND');
  }
  return voucherId;
}
