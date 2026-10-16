// POS ključevi za testove (§3.4, NFR-02): generišu se u toku izvršavanja, nikad nisu u repozitorijumu.
import { randomBytes } from 'node:crypto';

// Kanonski base64url od 32 slučajna bajta (43 znaka, i03/P-2).
export function generisiPosKljuc() {
  return randomBytes(32).toString('base64url');
}

// [[stationId, ključ], …] → vrijednost varijable POS_API_KLJUCEVI.
export function posKonfiguracija(parovi) {
  return parovi.map(([stationId, kljuc]) => `${stationId}:${kljuc}`).join(',');
}
