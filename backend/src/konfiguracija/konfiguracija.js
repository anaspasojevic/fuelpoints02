// Konfiguracija isključivo iz environment varijabli, sa fail fast provjerom.
// Poruke greške imenuju samo varijablu i razlog, nikad vrijednost.

export class GreskaKonfiguracije extends Error {
  constructor(problemi) {
    super(problemi.join('; '));
    this.name = 'GreskaKonfiguracije';
  }
}

function procitajPort(vrijednost) {
  if (!/^\d+$/.test(vrijednost)) {
    return null;
  }
  const port = Number(vrijednost);
  return port >= 1 && port <= 65535 ? port : null;
}

export function ucitajKonfiguraciju(env) {
  const problemi = [];
  const port = env.PORT;
  const projectId = env.FIREBASE_PROJECT_ID;

  if (port === undefined || port === '') {
    problemi.push('nedostaje obavezna varijabla PORT');
  } else if (procitajPort(port) === null) {
    problemi.push('varijabla PORT nema ispravan format (cijeli broj 1–65535)');
  }
  if (projectId === undefined || projectId.trim() === '') {
    problemi.push('nedostaje obavezna varijabla FIREBASE_PROJECT_ID');
  }
  if (problemi.length > 0) {
    throw new GreskaKonfiguracije(problemi);
  }

  return Object.freeze({ port: procitajPort(port), projectId, host: '127.0.0.1' });
}
