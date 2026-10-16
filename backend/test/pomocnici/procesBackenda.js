// Pokretanje produkcione ulazne tačke (src/pokreni.js) kao zasebnog procesa, sa eksplicitno sastavljenim env-om.
// Služi testovima starta (I02-T13) i nedostupnosti ili sporosti zavisnih servisa (I02-T11).
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const KORIJEN_BACKENDA = fileURLToPath(new URL('../../', import.meta.url));

// Minimalan env procesa: samo ono što Windows i Node traže, plus varijable testa. Ništa iz env-a test runner-a.
export function envProcesa(varijable) {
  return {
    PATH: process.env.PATH,
    SystemRoot: process.env.SystemRoot,
    ...varijable,
  };
}

export function pokreniBackend(env) {
  const proces = spawn(process.execPath, ['src/pokreni.js'], {
    cwd: KORIJEN_BACKENDA,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const izlaz = { stdout: '', stderr: '' };
  proces.stdout.setEncoding('utf8').on('data', (komad) => {
    izlaz.stdout += komad;
  });
  proces.stderr.setEncoding('utf8').on('data', (komad) => {
    izlaz.stderr += komad;
  });
  const zavrsen = new Promise((razrijesi) => {
    proces.on('exit', (kod, signal) => razrijesi({ kod, signal }));
  });

  return {
    zavrsen,
    get stdout() {
      return izlaz.stdout;
    },
    get stderr() {
      return izlaz.stderr;
    },
    // Čeka da proces sluša na portu; baca grešku ako proces završi ili rok istekne.
    async cekajSlusanje(port, rokMs = 10_000) {
      let zavrsio = false;
      zavrsen.then(() => {
        zavrsio = true;
      });
      const kraj = Date.now() + rokMs;
      while (Date.now() < kraj) {
        if (zavrsio) {
          throw new Error(`Backend je završio prije slušanja. stderr: ${izlaz.stderr}`);
        }
        if (await portSlusa(port)) {
          return;
        }
        await new Promise((razrijesi) => setTimeout(razrijesi, 100));
      }
      throw new Error(`Backend nije počeo da sluša u roku od ${rokMs} ms.`);
    },
    async zaustavi() {
      if (proces.exitCode === null && proces.signalCode === null) {
        proces.kill();
      }
      await zavrsen;
    },
  };
}

// Jedan pokušaj TCP konekcije na 127.0.0.1:port.
export function portSlusa(port) {
  return new Promise((razrijesi) => {
    const soket = net.connect({ host: '127.0.0.1', port });
    soket.once('connect', () => {
      soket.destroy();
      razrijesi(true);
    });
    soket.once('error', () => {
      soket.destroy();
      razrijesi(false);
    });
  });
}

export function slobodanPort() {
  return new Promise((razrijesi, odbij) => {
    const server = net.createServer();
    server.once('error', odbij);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => razrijesi(port));
    });
  });
}

// TCP proksi prema 127.0.0.1:ciljniPort koji svaki komad podataka, u oba smjera, prosljeđuje sa kašnjenjem kasnjenjeMs
// (spor, ali dostupan servis). Redoslijed komada je očuvan jer svi tajmeri imaju isto kašnjenje.
export function sporProksi(ciljniPort, kasnjenjeMs) {
  return new Promise((razrijesi, odbij) => {
    const soketi = new Set();
    function prati(soket) {
      soketi.add(soket);
      soket.on('error', () => {});
      soket.on('close', () => soketi.delete(soket));
    }
    function prosljedjuj(izvor, odrediste) {
      izvor.on('data', (komad) => {
        setTimeout(() => {
          if (!odrediste.destroyed) {
            odrediste.write(komad);
          }
        }, kasnjenjeMs);
      });
      izvor.on('end', () => setTimeout(() => odrediste.end(), kasnjenjeMs));
    }
    const server = net.createServer((klijent) => {
      const cilj = net.connect({ host: '127.0.0.1', port: ciljniPort });
      prati(klijent);
      prati(cilj);
      prosljedjuj(klijent, cilj);
      prosljedjuj(cilj, klijent);
      klijent.on('close', () => cilj.destroy());
      cilj.on('close', () => setTimeout(() => klijent.destroy(), kasnjenjeMs));
    });
    server.once('error', odbij);
    server.listen(0, '127.0.0.1', () => {
      razrijesi({
        port: server.address().port,
        zatvori() {
          for (const soket of soketi) {
            soket.destroy();
          }
          return new Promise((gotovo) => server.close(() => gotovo()));
        },
      });
    });
  });
}

// TCP server koji prihvata konekcije i nikad ne odgovara (servis koji „visi”).
export function crnaRupa() {
  return new Promise((razrijesi, odbij) => {
    const soketi = new Set();
    const server = net.createServer((soket) => {
      soketi.add(soket);
      soket.on('error', () => {});
      soket.on('close', () => soketi.delete(soket));
    });
    server.once('error', odbij);
    server.listen(0, '127.0.0.1', () => {
      razrijesi({
        port: server.address().port,
        zatvori() {
          for (const soket of soketi) {
            soket.destroy();
          }
          return new Promise((gotovo) => server.close(() => gotovo()));
        },
      });
    });
  });
}
