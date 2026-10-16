import { napraviAplikaciju } from './aplikacija.js';
import { inicijalizujFirebaseAdmin } from './firebase/inicijalizacija.js';
import { GreskaKonfiguracije, ucitajKonfiguraciju } from './konfiguracija/konfiguracija.js';

function pokreni() {
  let konfiguracija;
  try {
    konfiguracija = ucitajKonfiguraciju(process.env);
  } catch (greska) {
    if (greska instanceof GreskaKonfiguracije) {
      console.error(`Greška konfiguracije: ${greska.message}`);
    } else {
      console.error('Greška konfiguracije.');
    }
    process.exitCode = 1;
    return;
  }

  // Admin SDK se inicijalizuje tek POSLIJE provjere konfiguracije (zaštita emulator/demo, NFR-01).
  const { host, port, projectId, verzijaUslova } = konfiguracija;
  const { db, auth } = inicijalizujFirebaseAdmin({ projectId });
  const server = napraviAplikaciju({ servisi: { db, auth }, verzijaUslova }).listen(port, host, () => {
    console.log(`FuelPoints backend sluša na http://${host}:${port}/api/v1`);
  });
  server.on('error', (greska) => {
    console.error(`Server nije pokrenut (${greska.code ?? 'nepoznat razlog'}).`);
    process.exitCode = 1;
  });
}

pokreni();
