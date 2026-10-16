// Konfiguracija isključivo iz environment varijabli, sa fail fast provjerom.
// Poruke greške imenuju samo varijablu i razlog, nikad vrijednost.

// Rok za cijeli zaštićeni zahtjev, od ulaska u posrednik autentikacije: verifikacija token-a i Firestore transakcija
// zajedno dobijaju najviše ovoliko vremena (i02/P-5, FIX LOOP 1 R-02). Konstanta, nije env varijabla.
export const ROK_ZAVISNOG_SERVISA_MS = 10_000;

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

// NFR-01: u emulator režimu Admin SDK prihvata NEPOTPISANE token-e. Zato je emulator režim (varijabla definisana,
// i kad je prazna) dozvoljen samo za projekat čiji ID počinje sa demo-.
function jeEmulatorRezim(env) {
  return env.FIRESTORE_EMULATOR_HOST !== undefined || env.FIREBASE_AUTH_EMULATOR_HOST !== undefined;
}

export function ucitajKonfiguraciju(env) {
  const problemi = [];
  const port = env.PORT;
  const projectId = env.FIREBASE_PROJECT_ID;
  const verzijaUslova = env.VERZIJA_USLOVA;

  if (port === undefined || port === '') {
    problemi.push('nedostaje obavezna varijabla PORT');
  } else if (procitajPort(port) === null) {
    problemi.push('varijabla PORT nema ispravan format (cijeli broj 1–65535)');
  }
  if (projectId === undefined || projectId.trim() === '') {
    problemi.push('nedostaje obavezna varijabla FIREBASE_PROJECT_ID');
  } else if (jeEmulatorRezim(env) && !projectId.startsWith('demo-')) {
    problemi.push(
      'emulator varijable (FIRESTORE_EMULATOR_HOST/FIREBASE_AUTH_EMULATOR_HOST) su postavljene, a FIREBASE_PROJECT_ID ne počinje sa demo-',
    );
  }
  // AUTH-10, odluka O-11: aktuelna verzija uslova, bez podrazumijevane vrijednosti u kodu (i02/P-4).
  if (verzijaUslova === undefined || verzijaUslova.trim() === '') {
    problemi.push('nedostaje obavezna varijabla VERZIJA_USLOVA');
  }
  if (problemi.length > 0) {
    throw new GreskaKonfiguracije(problemi);
  }

  return Object.freeze({ port: procitajPort(port), projectId, host: '127.0.0.1', verzijaUslova });
}
