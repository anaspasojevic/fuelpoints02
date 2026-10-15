// Seed smije raditi isključivo nad Firebase Emulator Suite-om (§2.4) i demo- projektom.
// Poruke ne sadrže vrijednosti varijabli.

export class GreskaZastiteEmulatora extends Error {
  constructor(poruka) {
    super(poruka);
    this.name = 'GreskaZastiteEmulatora';
  }
}

export function provjeriEmulatorskoOkruzenje(env) {
  const emulatorHost = env.FIRESTORE_EMULATOR_HOST;
  if (typeof emulatorHost !== 'string' || emulatorHost.trim() === '') {
    throw new GreskaZastiteEmulatora(
      'Punjenje je odbijeno: varijabla FIRESTORE_EMULATOR_HOST nije postavljena, a punjenje radi samo nad emulatorom.',
    );
  }
  const projectId = env.FIREBASE_PROJECT_ID;
  if (typeof projectId !== 'string' || !projectId.startsWith('demo-')) {
    throw new GreskaZastiteEmulatora(
      'Punjenje je odbijeno: ID projekta u varijabli FIREBASE_PROJECT_ID mora počinjati sa demo-.',
    );
  }
  return { projectId };
}
