// CLI za punjenje emulatora: zaštita → provjera dostupnosti emulatora → inicijalizacija Admin SDK-a → punjenje.
// Zaštita se izvršava prije učitavanja Firebase modula, pa odbijanje ne pravi nijedan mrežni poziv.
import { GreskaZastiteEmulatora, provjeriEmulatorskoOkruzenje } from '../src/punjenje/zastitaEmulatora.js';

const PORUKA_NEUSPJEHA = 'Punjenje nije uspjelo. Provjeri da li je emulator pokrenut.';
const ROK_PROVJERE_MS = 5_000;

// Firestore klijent ponavlja pokušaje bez kraja kad emulator ne sluša, pa se dostupnost
// provjerava unaprijed: bilo koji HTTP odgovor u roku znači da emulator radi.
async function emulatorJeDostupan(emulatorHost) {
  try {
    await fetch(`http://${emulatorHost}/`, { signal: AbortSignal.timeout(ROK_PROVJERE_MS) });
    return true;
  } catch {
    return false;
  }
}

async function napuni() {
  let projectId;
  try {
    ({ projectId } = provjeriEmulatorskoOkruzenje(process.env));
  } catch (greska) {
    console.error(greska instanceof GreskaZastiteEmulatora ? greska.message : 'Punjenje je odbijeno.');
    process.exitCode = 1;
    return;
  }

  if (!(await emulatorJeDostupan(process.env.FIRESTORE_EMULATOR_HOST))) {
    console.error(PORUKA_NEUSPJEHA);
    process.exitCode = 1;
    return;
  }

  const { deleteApp } = await import('firebase-admin/app');
  const { inicijalizujFirebaseAdmin } = await import('../src/firebase/inicijalizacija.js');
  const { napuniRewardDefinitions } = await import('../src/punjenje/rewardDefinitions.js');
  const firebase = inicijalizujFirebaseAdmin({ projectId });
  try {
    const broj = await napuniRewardDefinitions(firebase.db);
    console.log(`Upisano ${broj} dokumenta u rewardDefinitions.`);
  } catch {
    console.error(PORUKA_NEUSPJEHA);
    process.exitCode = 1;
  } finally {
    await deleteApp(firebase.app);
  }
}

await napuni();
