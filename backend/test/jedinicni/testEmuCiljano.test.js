// I06-T01: argumenti ciljanog emulator run-a (O-29 (c), i06/P-8) — ista konfiguracija kao test:emu, samo zadati fajlovi.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FIREBASE_JS, napraviArgumente } from '../../skripte/testEmuCiljano.js';

const OSNOVA = ['emulators:exec', '--config', '../firebase.json', '--project', 'demo-fuelpoints', '--only', 'firestore,auth'];

test('I06-T01 napraviArgumente: jedan fajl, dva fajla, glob i --test-name-pattern daju tačan niz argumenata', () => {
  assert.match(FIREBASE_JS.replaceAll('\\', '/'), /\/node_modules\/firebase-tools\/lib\/bin\/firebase\.js$/);
  for (const [opis, ulaz, komanda] of [
    ['jedan fajl', ['test/emulator/a.test.js'], 'node --test --test-concurrency=1 "test/emulator/a.test.js"'],
    [
      'dva fajla',
      ['test/emulator/a.test.js', 'test/emulator/b_c-d.test.js'],
      'node --test --test-concurrency=1 "test/emulator/a.test.js" "test/emulator/b_c-d.test.js"',
    ],
    ['glob', ['test/emulator/*.test.js'], 'node --test --test-concurrency=1 "test/emulator/*.test.js"'],
    [
      'obrazac imena',
      ['test/emulator/a.test.js', '--test-name-pattern=API-T09'],
      'node --test --test-concurrency=1 --test-name-pattern="API-T09" "test/emulator/a.test.js"',
    ],
    [
      'obrazac sa razmakom i zagradom',
      ['--test-name-pattern=I06-T18 (a)', 'test/emulator/a.test.js'],
      'node --test --test-concurrency=1 --test-name-pattern="I06-T18 (a)" "test/emulator/a.test.js"',
    ],
  ]) {
    assert.deepStrictEqual(napraviArgumente(ulaz), [FIREBASE_JS, ...OSNOVA, komanda], opis);
  }
});

test('I06-T01 napraviArgumente: odbija prazan ulaz, putanje van test/emulator i znakove koje shell tumači', () => {
  for (const [opis, ulaz] of [
    ['bez fajlova', []],
    ['samo obrazac', ['--test-name-pattern=API-T09']],
    ['roditeljski direktorijum', ['../x.test.js']],
    ['apsolutna Windows putanja', ['C:\\x.test.js']],
    ['obrnuta kosa crta', ['test\\emulator\\a.test.js']],
    ['jedinični test', ['test/jedinicni/x.test.js']],
    ['poddirektorijum', ['test/emulator/../jedinicni/x.test.js']],
    ['navodnik', ['test/emulator/a"b.test.js']],
    ['ampersand', ['test/emulator/a&b.test.js']],
    ['razmak', ['test/emulator/a b.test.js']],
    ['bez .test.js', ['test/emulator/a.js']],
    ['obrazac sa |', ['test/emulator/a.test.js', '--test-name-pattern=a|b']],
    ['obrazac sa navodnikom', ['test/emulator/a.test.js', '--test-name-pattern=a"b']],
    ['prazan obrazac', ['test/emulator/a.test.js', '--test-name-pattern=']],
    ['dva obrasca', ['test/emulator/a.test.js', '--test-name-pattern=a', '--test-name-pattern=b']],
    ['nepoznata opcija', ['test/emulator/a.test.js', '--only=x']],
  ]) {
    assert.throws(() => napraviArgumente(ulaz), Error, opis);
  }
});
