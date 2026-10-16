// occurredAt (§8.4, i03/P-4): samo RFC 3339 date-time sa obaveznom zonom (Z ili ±hh:mm), veliko T i Z, 0–3 decimale.
// Date.parse i new Date(tekst) se ne koriste: tiho pomjeraju nepostojeće datume (30. februar → 2. mart),
// a Date.UTC godine 0–99 tumači kao 1900–1999.
const RFC3339 = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

// Opseg Firestore Timestamp-a: 0001-01-01T00:00:00Z … 9999-12-31T23:59:59.999Z.
const NAJMANJE_MS = -62_135_596_800_000;
const NAJVISE_MS = 253_402_300_799_999;

const DANA_U_MJESECU = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function jePrestupna(godina) {
  return (godina % 4 === 0 && godina % 100 !== 0) || godina % 400 === 0;
}

function brojDana(godina, mjesec) {
  return mjesec === 2 && jePrestupna(godina) ? 29 : DANA_U_MJESECU[mjesec - 1];
}

// Vraća milisekunde od epohe (UTC) ili null ako tekst nije ispravan trenutak u opsegu Timestamp-a.
export function procitajOccurredAt(tekst) {
  if (typeof tekst !== 'string') {
    return null;
  }
  const dijelovi = RFC3339.exec(tekst);
  if (dijelovi === null) {
    return null;
  }
  const [godina, mjesec, dan, sat, minut, sekunda] = dijelovi.slice(1, 7).map(Number);
  const milisekunde = dijelovi[7] === undefined ? 0 : Number(dijelovi[7].padEnd(3, '0'));
  // Kalendarska ispravnost se provjerava prije računanja; sekunda 60 se odbija.
  if (mjesec < 1 || mjesec > 12 || dan < 1 || dan > brojDana(godina, mjesec)) {
    return null;
  }
  if (sat > 23 || minut > 59 || sekunda > 59) {
    return null;
  }
  let pomakMs = 0;
  if (dijelovi[8] !== undefined) {
    const satiPomaka = Number(dijelovi[9]);
    const minutaPomaka = Number(dijelovi[10]);
    if (satiPomaka > 23 || minutaPomaka > 59) {
      return null;
    }
    // -00:00 se tumači kao UTC.
    pomakMs = (dijelovi[8] === '+' ? 1 : -1) * (satiPomaka * 60 + minutaPomaka) * 60_000;
  }

  const datum = new Date(0);
  datum.setUTCFullYear(godina, mjesec - 1, dan);
  datum.setUTCHours(sat, minut, sekunda, milisekunde);
  const rezultat = datum.getTime() - pomakMs;
  if (rezultat < NAJMANJE_MS || rezultat > NAJVISE_MS) {
    return null;
  }
  return rezultat;
}
