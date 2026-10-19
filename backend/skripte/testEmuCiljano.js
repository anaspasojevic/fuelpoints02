// O-29 (c), i06/P-8: ciljani emulator run; ista konfiguracija kao test:emu (isti emulators:exec, demo-fuelpoints, firestore+auth,
// --test-concurrency=1), samo zadati fajlovi. firebase-tools se pokreće kroz process.execPath (bez shell-a, bez PowerShell navodnika);
// unutrašnju komandu emulators:exec izvršava kroz shell, pa su dozvoljeni samo znakovi koje ni cmd ni sh ne tumače.
// Upotreba (iz backend): npm run test:emu:ciljano -- test/emulator/a.test.js [test/emulator/b.test.js …] [--test-name-pattern=<obrazac>]
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIREKTORIJUM_BACKENDA = fileURLToPath(new URL('..', import.meta.url));
export const FIREBASE_JS = path.join(DIREKTORIJUM_BACKENDA, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');

// Samo fajlovi iz test/emulator (dozvoljen * za glob koji razvija node --test); bez .., \, navodnika i razmaka.
const FAJL = /^test\/emulator\/[A-Za-z0-9_.*-]+\.test\.js$/;
const PREFIKS_OBRASCA = '--test-name-pattern=';
const OBRAZAC = /^[A-Za-z0-9 _.()-]+$/;

export function napraviArgumente(argumenti) {
  const fajlovi = [];
  let obrazac;
  for (const argument of argumenti) {
    if (argument.startsWith(PREFIKS_OBRASCA)) {
      const vrijednost = argument.slice(PREFIKS_OBRASCA.length);
      if (obrazac !== undefined || !OBRAZAC.test(vrijednost)) {
        throw new Error('Neispravan --test-name-pattern (dozvoljen jedan, slova, cifre, razmak i _ . ( ) -).');
      }
      obrazac = vrijednost;
    } else if (FAJL.test(argument)) {
      fajlovi.push(argument);
    } else {
      throw new Error('Neispravan argument: očekuje se test/emulator/<naziv>.test.js ili --test-name-pattern=<obrazac>.');
    }
  }
  if (fajlovi.length === 0) {
    throw new Error('Nije zadat nijedan test fajl.');
  }
  const komanda = [
    'node --test --test-concurrency=1',
    ...(obrazac === undefined ? [] : [`${PREFIKS_OBRASCA}"${obrazac}"`]),
    ...fajlovi.map((fajl) => `"${fajl}"`),
  ].join(' ');
  return [FIREBASE_JS, 'emulators:exec', '--config', '../firebase.json', '--project', 'demo-fuelpoints', '--only', 'firestore,auth', komanda];
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let argumenti;
  try {
    argumenti = napraviArgumente(process.argv.slice(2));
  } catch (greska) {
    console.error(greska.message);
    process.exit(2);
  }
  const dijete = spawn(process.execPath, argumenti, { cwd: DIREKTORIJUM_BACKENDA, stdio: 'inherit' });
  dijete.on('exit', (kod, signal) => process.exit(kod ?? (signal ? 1 : 0)));
}
