// CLI za punjenje emulatora: zaštita → inicijalizacija Admin SDK-a → punjenje.
// Zaštita se izvršava prije učitavanja Firebase modula, pa odbijanje ne pravi nijedan mrežni poziv.
import { GreskaZastiteEmulatora, provjeriEmulatorskoOkruzenje } from '../src/punjenje/zastitaEmulatora.js';

async function napuni() {
  let projectId;
  try {
    ({ projectId } = provjeriEmulatorskoOkruzenje(process.env));
  } catch (greska) {
    console.error(greska instanceof GreskaZastiteEmulatora ? greska.message : 'Punjenje je odbijeno.');
    process.exitCode = 1;
    return;
  }

  const { deleteApp } = await import('firebase-admin/app');
  const { inicijalizujFirebaseAdmin } = await import('../src/firebase/inicijalizacija.js');
  const firebase = inicijalizujFirebaseAdmin({ projectId });
  await deleteApp(firebase.app);
}

await napuni();
