// Pomoćnici za testove nad Firebase Emulator Suite-om (§2.4).
// Testovi koji diraju podatke nikad ne smiju gađati production projekat.

const OCEKIVANI_FIRESTORE_HOST = '127.0.0.1:8080';
const OCEKIVANI_AUTH_HOST = '127.0.0.1:9099';

function idProjekta() {
  const projekat = process.env.GCLOUD_PROJECT ?? '';
  if (!projekat.startsWith('demo-')) {
    throw new Error('Testovi nad emulatorom zahtijevaju projekat čiji ID počinje sa demo-.');
  }
  return projekat;
}

// Poziva se na vrhu svakog emulator test fajla, prije bilo kakvog poziva prema Firebase-u.
export function provjeriTestnoOkruzenje() {
  if (process.env.FIRESTORE_EMULATOR_HOST !== OCEKIVANI_FIRESTORE_HOST) {
    throw new Error(`FIRESTORE_EMULATOR_HOST mora biti ${OCEKIVANI_FIRESTORE_HOST}; pokreni testove kroz npm run test:emu.`);
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== OCEKIVANI_AUTH_HOST) {
    throw new Error(`FIREBASE_AUTH_EMULATOR_HOST mora biti ${OCEKIVANI_AUTH_HOST}; pokreni testove kroz npm run test:emu.`);
  }
  return idProjekta();
}

// Briše sve Firestore dokumente i sve Auth korisnike u emulatoru. Host je fiksan (nikad iz env-a).
export async function ocistiEmulatore() {
  const projekat = idProjekta();
  const adrese = [
    `http://127.0.0.1:8080/emulator/v1/projects/${projekat}/databases/(default)/documents`,
    `http://127.0.0.1:9099/emulator/v1/projects/${projekat}/accounts`,
  ];
  for (const adresa of adrese) {
    const odgovor = await fetch(adresa, { method: 'DELETE' });
    if (!odgovor.ok) {
      throw new Error(`Čišćenje emulatora nije uspjelo (HTTP ${odgovor.status}).`);
    }
  }
}
