import { KOLEKCIJE } from '../podaci/kolekcije.js';

// Katalog nagrada po SRS §12. displayName je latinicom (odluka i01/P-1).
export const REWARD_DEFINITIONS = Object.freeze({
  CAR_WASH: Object.freeze({ displayName: 'Besplatno pranje', costPoints: 50, active: true }),
  SHOWER: Object.freeze({ displayName: 'Besplatan tuš', costPoints: 30, active: true }),
});

// Idempotentno punjenje: deterministički ID-evi (rewardId) i set() bez merge u jednom batch-u,
// pa svako pokretanje vraća tačno vrijednosti iz §12.
export async function napuniRewardDefinitions(db) {
  const batch = db.batch();
  for (const [rewardId, definicija] of Object.entries(REWARD_DEFINITIONS)) {
    batch.set(db.collection(KOLEKCIJE.rewardDefinitions).doc(rewardId), { ...definicija });
  }
  await batch.commit();
  return Object.keys(REWARD_DEFINITIONS).length;
}
