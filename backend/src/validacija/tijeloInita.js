import { GreskaApi } from '../greske/GreskaApi.js';

const DOZVOLJENA_POLJA = new Set(['displayName', 'acceptedTermsVersion']);

function jeObicanObjekat(vrijednost) {
  return typeof vrijednost === 'object' && vrijednost !== null && !Array.isArray(vrijednost);
}

// Dužina se broji kao string.size() u Security Rules (§31): UTF-16 jedinice, utvrđeno u I02-T15 (i02/P-3).
// String mora biti ispravan UTF-16 (bez usamljenih surogata, FIX LOOP 1 R-04); bez trim-a i normalizacije.
function jeIspravnoIme(displayName) {
  return (
    typeof displayName === 'string' &&
    displayName.isWellFormed() &&
    displayName.length >= 1 &&
    displayName.length <= 100
  );
}

// Strogo tijelo API-01 (§3.2, §3.3, AUTH-10, O-11). Redoslijed provjera određuje kod greške.
// Vraća novi objekat sa tačno dva polja; tijelo zahtjeva se ne prosljeđuje dalje.
export function provjeriTijeloInita(tijelo, verzijaUslova) {
  if (!jeObicanObjekat(tijelo)) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  if (Object.keys(tijelo).some((kljuc) => !DOZVOLJENA_POLJA.has(kljuc))) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  const { displayName, acceptedTermsVersion } = tijelo;
  if (!jeIspravnoIme(displayName)) {
    throw new GreskaApi('INVALID_DISPLAY_NAME');
  }
  if (typeof acceptedTermsVersion !== 'string' || acceptedTermsVersion !== verzijaUslova) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  return { displayName, acceptedTermsVersion };
}
