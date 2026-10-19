// I05-T02 (O-19, ODLUKE §6 (h), i05/P-6): pravilo statičkih poruka. Identifikatori (requestKey, voucherId, uid, requestId …) se ne
// umeću u poruku new …Error( ni u log. Statička analiza svih backend/src/**/*.js: prvi argument svakog new …Error( je JEDAN string
// literal ('…' ili "…"); argumenti poziva console.* i zabiljeziGresku( ne pominju nijedan identifikator iz zahtjeva ili baze.
// Jedini izuzetak je greske/GreskaApi.js (TypeError sa kodom kataloga iz koda, ne identifikator iz zahtjeva/baze).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const KORIJEN_SRC = fileURLToPath(new URL('../../src/', import.meta.url));
const IZUZECI_ZA_GRESKE = new Set(['greske/GreskaApi.js']);
const POZIV_GRESKE = /new\s+(?:[A-Z][A-Za-z]*)?Error\s*\(/g;
const POZIV_LOGA = /\b(?:console\.[a-z]+|zabiljeziGresku)\s*\(/g;
const JEDAN_STRING_LITERAL = /^\s*(?:'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")\s*$/s;
const IDENTIFIKATOR = /\b(?:requestKey|voucherId|uid|loyaltyUid|requestId|purchaseId|posTransactionId|eventId|rewardId|idToken|token)\b/;

// Indeks iza završnog navodnika literala koji počinje na i ('…', "…" ili `…` sa ugniježđenim ${ … }).
function krajLiterala(izvor, i) {
  const navod = izvor[i];
  let j = i + 1;
  while (j < izvor.length) {
    const znak = izvor[j];
    if (znak === '\\') {
      j += 2;
      continue;
    }
    if (znak === navod) {
      return j + 1;
    }
    if (navod === '`' && znak === '$' && izvor[j + 1] === '{') {
      let dubina = 1;
      j += 2;
      while (j < izvor.length && dubina > 0) {
        const z = izvor[j];
        if (z === "'" || z === '"' || z === '`') {
          j = krajLiterala(izvor, j);
          continue;
        }
        if (z === '{') {
          dubina += 1;
        }
        if (z === '}') {
          dubina -= 1;
        }
        j += 1;
      }
      continue;
    }
    j += 1;
  }
  throw new Error('Nezatvoren literal u izvoru.');
}

// Argumenti poziva (tekst) od indeksa iza "(" do odgovarajuće ")".
function argumentiPoziva(izvor, pocetak) {
  const argumenti = [];
  let tekuci = '';
  let dubina = 0;
  let i = pocetak;
  while (i < izvor.length) {
    const znak = izvor[i];
    if (znak === "'" || znak === '"' || znak === '`') {
      const kraj = krajLiterala(izvor, i);
      tekuci += izvor.slice(i, kraj);
      i = kraj;
      continue;
    }
    if ('([{'.includes(znak)) {
      dubina += 1;
    } else if (')]}'.includes(znak)) {
      if (dubina === 0) {
        argumenti.push(tekuci);
        return argumenti;
      }
      dubina -= 1;
    } else if (znak === ',' && dubina === 0) {
      argumenti.push(tekuci);
      tekuci = '';
      i += 1;
      continue;
    }
    tekuci += znak;
    i += 1;
  }
  throw new Error('Nezatvoren poziv u izvoru.');
}

function brojLinije(izvor, indeks) {
  return izvor.slice(0, indeks).split('\n').length;
}

// Kršenja pravila u jednom izvoru: [{ linija, poziv, razlog }]. dozvoliNestatickuGresku: izuzetak (GreskaApi.js).
export function krsenjaPravila(izvor, { dozvoliNestatickuGresku = false } = {}) {
  const krsenja = [];
  for (const poklapanje of izvor.matchAll(POZIV_GRESKE)) {
    const [prvi = ''] = argumentiPoziva(izvor, poklapanje.index + poklapanje[0].length);
    if (!dozvoliNestatickuGresku && !JEDAN_STRING_LITERAL.test(prvi)) {
      krsenja.push({ linija: brojLinije(izvor, poklapanje.index), poziv: poklapanje[0], razlog: 'poruka nije jedan string literal' });
    }
  }
  for (const poklapanje of izvor.matchAll(POZIV_LOGA)) {
    const argumenti = argumentiPoziva(izvor, poklapanje.index + poklapanje[0].length).join(',');
    if (IDENTIFIKATOR.test(argumenti)) {
      krsenja.push({ linija: brojLinije(izvor, poklapanje.index), poziv: poklapanje[0], razlog: 'identifikator u logu' });
    }
  }
  return krsenja;
}

function sviIzvori(direktorijum) {
  const fajlovi = [];
  for (const unos of readdirSync(direktorijum, { withFileTypes: true })) {
    const puna = path.join(direktorijum, unos.name);
    if (unos.isDirectory()) {
      fajlovi.push(...sviIzvori(puna));
    } else if (unos.name.endsWith('.js')) {
      fajlovi.push(puna);
    }
  }
  return fajlovi;
}

test('I05-T02 kontrola: provjera prepoznaje interpolaciju i spajanje identifikatora u poruci greške i u logu', () => {
  assert.deepStrictEqual(krsenjaPravila("throw new Error('Nekonzistentno stanje: neispravan voucher.');"), []);
  assert.deepStrictEqual(krsenjaPravila('throw new TypeError("statično");\nconsole.error(JSON.stringify(zapis));'), []);
  for (const izvor of [
    'throw new Error(`Nekonzistentno ${voucherId}`);',
    "throw new Error('a' + uid);",
    'throw new Error(poruka);',
    'throw new Error(`bez interpolacije, ali template`);',
    "throw new RangeError(String(requestKey), { cause });",
    'console.error(`zahtjev ${requestId}`);',
    "console.log('uid', uid);",
    'zabiljeziGresku({ correlationId, voucherId });',
  ]) {
    assert.equal(krsenjaPravila(izvor).length, 1, `kršenje nije prepoznato: ${izvor}`);
  }
  assert.deepStrictEqual(krsenjaPravila('throw new TypeError(`Nepoznat kod: ${kod}`);', { dozvoliNestatickuGresku: true }), []);
});

test('I05-T02 backend/src: svaka poruka new …Error( je statički string literal, log bez identifikatora', () => {
  const izvori = sviIzvori(KORIJEN_SRC);
  let brojGresaka = 0;
  const sva = [];
  for (const fajl of izvori) {
    const relativan = path.relative(KORIJEN_SRC, fajl).split(path.sep).join('/');
    const izvor = readFileSync(fajl, 'utf8');
    brojGresaka += [...izvor.matchAll(POZIV_GRESKE)].length;
    for (const k of krsenjaPravila(izvor, { dozvoliNestatickuGresku: IZUZECI_ZA_GRESKE.has(relativan) })) {
      sva.push(`${relativan}:${k.linija} ${k.poziv} — ${k.razlog}`);
    }
  }
  // Provjera je zaista skenirala izvor (servisi bacaju statičke greške od i02).
  assert.ok(brojGresaka >= 15, `pronađeno samo ${brojGresaka} poziva new …Error(`);
  assert.deepStrictEqual(sva, []);
});
