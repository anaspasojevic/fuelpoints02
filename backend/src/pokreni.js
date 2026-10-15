import { napraviAplikaciju } from './aplikacija.js';
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

  const { host, port } = konfiguracija;
  const server = napraviAplikaciju().listen(port, host, () => {
    console.log(`FuelPoints backend sluša na http://${host}:${port}/api/v1`);
  });
  server.on('error', (greska) => {
    console.error(`Server nije pokrenut (${greska.code ?? 'nepoznat razlog'}).`);
    process.exitCode = 1;
  });
}

pokreni();
