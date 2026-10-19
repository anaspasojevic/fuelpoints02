import { GreskaApi } from '../greske/GreskaApi.js';

// §23 „auth_time <= 5 min”, O-35, i07/P-2.
export const MAKSIMALNA_STAROST_PRIJAVE_MS = 300_000;

// auth_time verifikovanog token-a je u sekundama. Cjelobrojno poređenje u ms je ekvivalent O-35 (Date.now()/1000 − auth_time ≤ 300)
// bez razlomaka; granica je uključiva. auth_time koji nije nenegativan siguran cijeli broj (nedostaje, string …) → nije svježa (fail closed);
// budući auth_time (razlika satova) je dozvoljen.
export function jeSvjezaPrijava(authTime, sadaMs) {
  return Number.isSafeInteger(authTime) && authTime >= 0 && sadaMs <= authTime * 1000 + MAKSIMALNA_STAROST_PRIJAVE_MS;
}

// Jedino čitanje sata Backend-a u ovom modulu. auth_time se ne loguje.
export function provjeriSvjezinuPrijave(authTime) {
  if (!jeSvjezaPrijava(authTime, Date.now())) {
    throw new GreskaApi('REAUTHENTICATION_REQUIRED');
  }
}
