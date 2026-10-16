import { GreskaApi } from './GreskaApi.js';

// Ograničava trajanje poziva zavisnog servisa (Firestore, Auth). Istek roka → SERVICE_UNAVAILABLE (§27, i02/P-5).
// Tajmer se uvijek čisti i ne drži proces živim.
export function saRokom(obecanje, ms) {
  let tajmer;
  const istek = new Promise((razrijesi, odbij) => {
    tajmer = setTimeout(() => odbij(new GreskaApi('SERVICE_UNAVAILABLE')), ms);
    tajmer.unref();
  });
  return Promise.race([obecanje, istek]).finally(() => clearTimeout(tajmer));
}

// Kodovi Admin SDK-a koji znače da token ili korisnik nije važeći (§3.3, NFR-01).
const AUTH_NEVAZECI_TOKEN_ILI_KORISNIK = new Set([
  'auth/argument-error',
  'auth/invalid-id-token',
  'auth/id-token-expired',
  'auth/id-token-revoked',
  'auth/user-disabled',
  'auth/user-not-found',
]);

// Kodovi Admin SDK-a koji znače da Auth servis nije dostupan.
const AUTH_NEDOSTUPAN = new Set(['app/network-error', 'app/network-timeout']);

// Greška verifikacije token-a → kod iz kataloga. Sve što nije prepoznato je INTERNAL_ERROR.
export function klasifikujGreskuAuth(err) {
  if (err instanceof GreskaApi) {
    return err.kod === 'SERVICE_UNAVAILABLE' ? 'SERVICE_UNAVAILABLE' : 'INTERNAL_ERROR';
  }
  const kod = err?.code;
  if (AUTH_NEVAZECI_TOKEN_ILI_KORISNIK.has(kod)) {
    return 'UNAUTHENTICATED';
  }
  if (AUTH_NEDOSTUPAN.has(kod)) {
    return 'SERVICE_UNAVAILABLE';
  }
  return 'INTERNAL_ERROR';
}

// gRPC kodovi Firestore-a: UNAVAILABLE (14), DEADLINE_EXCEEDED (4) i ABORTED (10, contention poslije svih pokušaja).
const FIRESTORE_NEDOSTUPAN = new Set([14, 4, 10]);

export function jeNedostupnostFirestore(err) {
  return FIRESTORE_NEDOSTUPAN.has(err?.code);
}
