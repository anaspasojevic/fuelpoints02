// I08-T01 (§31, O-37, i08/P-1, i08/P-2): firestore.rules je sadržinski identičan normativnoj politici §31.
// Izvor je čitljiva kopija SRS-a (.md) sa uklonjenim markdown escape-ovima; jednokratna provjera prema .docx-u je u TEST_REPORT.
// Ne koristi emulator; pokreće se istom komandom kao ostali Rules testovi.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

const NASLOV_31 = '# 31. FIRESTORE RULES';
const NASLOV_32 = '# 32. ACCEPTANCE CRITERIA';
const POCETAK_BLOKA = '```javascript';
const KRAJ_BLOKA = '```';

function procitaj(relativnaPutanja) {
  return readFileSync(new URL(relativnaPutanja, import.meta.url), 'utf8');
}

// Isijeca jedini javascript blok iz §31 i uklanja markdown escape-ove (\ ispred ASCII interpunkcije, CommonMark).
function tekstPravilaIzSrs(srs) {
  const pocetak = srs.indexOf(NASLOV_31);
  assert.notEqual(pocetak, -1, `U SRS-u nije nađen naslov "${NASLOV_31}"`);
  const kraj = srs.indexOf(NASLOV_32, pocetak);
  assert.notEqual(kraj, -1, `U SRS-u nije nađen naslov "${NASLOV_32}"`);
  const sekcija = srs.slice(pocetak, kraj);

  const dijelovi = sekcija.split(POCETAK_BLOKA);
  assert.equal(dijelovi.length, 2, '§31 mora sadržati tačno jedan javascript blok');
  const krajBloka = dijelovi[1].indexOf(KRAJ_BLOKA);
  assert.notEqual(krajBloka, -1, 'javascript blok u §31 nije zatvoren');

  const blok = dijelovi[1].slice(0, krajBloka).replace(/\\([!-/:-@[-`{-~])/g, '$1');
  assert.ok(!blok.includes('\\'), 'poslije uklanjanja markdown escape-ova u §31 ne smije ostati kosa crta');
  return blok;
}

// i08/P-2: red po red, trim, niz bijelih znakova → jedan razmak, bez praznih redova.
function normalizujRedove(tekst) {
  return tekst
    .split(/\r?\n/)
    .map((red) => red.trim().replace(/\s+/g, ' '))
    .filter((red) => red !== '');
}

describe('I08-T01 firestore.rules = §31', () => {
  test('I08-T01 (a) normalizovani redovi firestore.rules jednaki su normativnom tekstu §31', () => {
    const redoviSrs = normalizujRedove(tekstPravilaIzSrs(procitaj('../../docs/srs/FuelPoints_SRS_3_1.md')));
    const redoviPravila = normalizujRedove(procitaj('../firestore.rules'));
    assert.ok(redoviSrs.length > 0, 'normativni tekst §31 je prazan');
    assert.deepStrictEqual(redoviPravila, redoviSrs);
  });

  test('I08-T01 (b) kontrola komparatora: sadržinska izmjena → razlika; samo razmaci i prazni redovi → jednakost', () => {
    const redoviSrs = normalizujRedove(tekstPravilaIzSrs(procitaj('../../docs/srs/FuelPoints_SRS_3_1.md')));
    const pravila = procitaj('../firestore.rules');
    assert.ok(pravila.includes('<= 20'), 'firestore.rules ne sadrži "<= 20"');

    const izmijenjena = pravila.replace('<= 20', '<= 21');
    assert.notDeepStrictEqual(normalizujRedove(izmijenjena), redoviSrs);

    const drugiRazmaci = pravila
      .split(/\r?\n/)
      .map((red) => `\t  ${red.replace(/ /g, '   ')}  `)
      .join('\n\n');
    assert.deepStrictEqual(normalizujRedove(drugiRazmaci), redoviSrs);
  });
});
