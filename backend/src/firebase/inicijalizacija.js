import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Inicijalizuje imenovanu Firebase Admin aplikaciju (Admin SDK, §2.3).
// Emulator se bira kroz FIRESTORE_EMULATOR_HOST i FIREBASE_AUTH_EMULATOR_HOST koje SDK sam čita.
export function inicijalizujFirebaseAdmin({ projectId }) {
  const app = initializeApp({ projectId }, `fuelpoints-${randomUUID()}`);
  return { app, db: getFirestore(app), auth: getAuth(app) };
}
