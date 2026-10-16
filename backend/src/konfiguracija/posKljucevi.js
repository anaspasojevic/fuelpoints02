import { createHash } from 'node:crypto';

// POS ključevi (§3.4, NFR-02, i03/P-2): POS_API_KLJUCEVI=stationId:ključ[,stationId:ključ…], bez razmaka.
// ":" i "," nisu u alfabetu ni stationId-a ni base64url-a, pa je razdvajanje jednoznačno.
// Poruke imenuju varijablu, redni broj stavke i razlog, nikad vrijednost.

const NAZIV = 'POS_API_KLJUCEVI';

// O-13: podskup §8.2 bez "_", da purchase ID {stationId}__{posTransactionId} bude jednoznačan.
const STATION_ID = /^[A-Za-z0-9.-]{1,32}$/;
const KLJUC = /^[A-Za-z0-9_-]{43}$/;
const BAJTOVA_KLJUCA = 32;
// Heuristika protiv očiglednih placeholder-a (npr. "AAAA…"); slučajan ključ od 43 znaka ima ~30 različitih znakova.
const NAJMANJE_RAZLICITIH_ZNAKOVA = 16;

// Kanonski base64url od tačno 32 bajta (256 bita).
function jeIspravanKljuc(kljuc) {
  if (!KLJUC.test(kljuc)) {
    return false;
  }
  const bajtovi = Buffer.from(kljuc, 'base64url');
  return bajtovi.length === BAJTOVA_KLJUCA && bajtovi.toString('base64url') === kljuc;
}

function otisakKljuca(kljuc) {
  return createHash('sha256').update(kljuc, 'utf8').digest();
}

// Vraća { stanice, problemi }. stanice je zamrznut niz { stationId, otisakKljuca } (SHA-256 ključa, i03/P-3)
// samo kad nema problema; sirov ključ se ne čuva.
export function procitajPosKljuceve(vrijednost) {
  if (vrijednost === undefined || vrijednost === '') {
    return { stanice: null, problemi: [`nedostaje obavezna varijabla ${NAZIV}`] };
  }

  const problemi = [];
  const ispravne = [];
  vrijednost.split(',').forEach((stavka, indeks) => {
    const broj = indeks + 1;
    const dijelovi = stavka.split(':');
    if (stavka === '' || /\s/.test(stavka) || dijelovi.length !== 2) {
      problemi.push(`${NAZIV} nema ispravan format (stavka ${broj})`);
      return;
    }
    const [stationId, kljuc] = dijelovi;
    let ispravna = true;
    if (!STATION_ID.test(stationId)) {
      problemi.push(`${NAZIV}: stationId nije ispravan (stavka ${broj})`);
      ispravna = false;
    }
    if (!jeIspravanKljuc(kljuc)) {
      problemi.push(`${NAZIV}: POS ključ nije base64url od 32 bajta (stavka ${broj})`);
      ispravna = false;
    } else if (new Set(kljuc).size < NAJMANJE_RAZLICITIH_ZNAKOVA) {
      problemi.push(`${NAZIV}: POS ključ nije slučajan (stavka ${broj})`);
      ispravna = false;
    }
    if (ispravna) {
      ispravne.push({ broj, stationId, kljuc });
    }
  });

  for (const [i, prva] of ispravne.entries()) {
    for (const druga of ispravne.slice(i + 1)) {
      if (prva.stationId === druga.stationId) {
        problemi.push(`${NAZIV}: ponovljen stationId (stavke ${prva.broj} i ${druga.broj})`);
      }
      if (prva.kljuc === druga.kljuc) {
        problemi.push(`${NAZIV}: ponovljen POS ključ (stavke ${prva.broj} i ${druga.broj})`);
      }
    }
  }

  if (problemi.length > 0) {
    return { stanice: null, problemi };
  }
  const stanice = ispravne.map(({ stationId, kljuc }) =>
    Object.freeze({ stationId, otisakKljuca: otisakKljuca(kljuc) }),
  );
  return { stanice: Object.freeze(stanice), problemi };
}
