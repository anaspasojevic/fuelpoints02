import { GreskaApi } from '../greske/GreskaApi.js';
import { jeIspravanIdDokumenta } from './identifikator.js';

// O-15: samo kanonski UUID v4 malim slovima, bez zastavica (JS $ bez m ne prihvata završni prelom reda).
// Jedan UUID tako daje tačno jedan requestKey (§14).
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function jeObicanObjekat(vrijednost) {
  return typeof vrijednost === 'object' && vrijednost !== null && !Array.isArray(vrijednost);
}

// Strogo tijelo API-03 (§13): tačno jedno polje requestId. UID, cost, voucherId, status i timestamp-ove određuje Backend,
// pa svako drugo polje → INVALID_REQUEST (O-1). Vraća novi objekat (nikad tijelo po referenci).
export function provjeriTijeloIzdavanja(tijelo) {
  if (!jeObicanObjekat(tijelo)) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  if (Object.keys(tijelo).some((kljuc) => kljuc !== 'requestId')) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  const { requestId } = tijelo;
  if (typeof requestId !== 'string' || !UUID_V4.test(requestId)) {
    throw new GreskaApi('INVALID_REQUEST');
  }
  return { requestId };
}

// D-4: rewardId iz putanje se provjerava prije upotrebe kao ID dokumenta; neispravan oblik ne postoji kao nagrada (§12)
// → REWARD_NOT_FOUND bez pristupa bazi (kontrolni znakovi: i04/P-9, u jeIspravanIdDokumenta).
export function provjeriRewardId(rewardId) {
  if (typeof rewardId !== 'string' || !jeIspravanIdDokumenta(rewardId)) {
    throw new GreskaApi('REWARD_NOT_FOUND');
  }
  return rewardId;
}
