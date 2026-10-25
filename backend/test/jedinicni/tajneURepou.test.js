// I11-T08 (NFR-07, §3.4, §34.1): nijedan praćeni fajl ne sadrži API ključ, privatni ključ ni POS ključ;
// zabranjeni fajlovi nisu praćeni; .gitignore pokriva lokalne fajlove sa tajnama.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const KORIJEN = fileURLToPath(new URL('../../../', import.meta.url));

function git(...argumenti) {
  const rezultat = spawnSync('git', argumenti, { cwd: KORIJEN, encoding: 'utf8' });
  assert.ok(rezultat.status === 0 || rezultat.status === 1, `git ${argumenti[0]}: ${rezultat.stderr}`);
  return rezultat;
}

// Obrasci se sastavljaju iz dijelova da ovaj fajl ne pogađa sam sebe.
const OBRASCI = [
  ['Google API ključ', 'AIza' + '[0-9A-Za-z_-]{35}'],
  ['privatni ključ (PEM)', '-----BEGIN (RSA |EC )?PRIVATE' + ' KEY-----'],
  ['privatni ključ (service account JSON)', '"private' + '_key"'],
  ['POS ključ u zaglavlju', 'X-POS-API-Key:[ \t]*[A-Za-z0-9_-]{43}([^A-Za-z0-9_-]|$)'],
];

test('I11-T08: praćeni fajlovi ne sadrže ključeve', () => {
  for (const [naziv, obrazac] of OBRASCI) {
    const rezultat = git('grep', '-n', '-I', '-E', '-e', obrazac, '--', '.');
    assert.equal(rezultat.status, 1, `${naziv}: pronađeno u praćenim fajlovima (${rezultat.stdout.split('\n').map((red) => red.split(':').slice(0, 2).join(':')).join(', ')})`);
  }
});

test('I11-T08: zabranjeni fajlovi nisu praćeni', () => {
  const fajlovi = git('ls-files').stdout.split('\n').filter(Boolean);
  const zabranjeni = fajlovi.filter((fajl) => /(^|\/)(google-services\.json|\.env|firebase\.local\.properties|local\.properties)$|\.(keystore|jks)$|service-?account.*\.json$|-firebase-adminsdk-.*\.json$|\.apk$/i.test(fajl));
  assert.deepEqual(zabranjeni, []);
  assert.ok(fajlovi.includes('.env.example'));
});

test('I11-T08: .gitignore pokriva lokalne fajlove sa tajnama', () => {
  const lokalni = [
    '.env',
    '.env.real',
    'backend/.env',
    'android-app/firebase.local.properties',
    'android-app/fuelpoints.keystore',
    'android-app/izdanje.jks',
    'android-app/app/google-services.json',
    'fuelpoints-service-account.json',
    'projekat-firebase-adminsdk-abc.json',
    'docs/smoke/fuelpoints.apk',
  ];
  for (const fajl of lokalni) {
    assert.equal(git('check-ignore', '-q', fajl).status, 0, `${fajl} nije u .gitignore`);
  }
  assert.equal(git('check-ignore', '-q', '.env.example').status, 1, '.env.example mora ostati praćen');
});
