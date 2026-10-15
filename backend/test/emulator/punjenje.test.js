import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, describe, test } from 'node:test';
import { deleteApp } from 'firebase-admin/app';
import { inicijalizujFirebaseAdmin } from '../../src/firebase/inicijalizacija.js';
import { KOLEKCIJE } from '../../src/podaci/kolekcije.js';
import { GreskaZastiteEmulatora, provjeriEmulatorskoOkruzenje } from '../../src/punjenje/zastitaEmulatora.js';
import { ocistiEmulatore, provjeriTestnoOkruzenje } from '../pomocnici/emulator.js';

const projectId = provjeriTestnoOkruzenje();
const KORIJEN_BACKENDA = fileURLToPath(new URL('../../', import.meta.url));

let firebase;

before(() => {
  firebase = inicijalizujFirebaseAdmin({ projectId });
});

beforeEach(ocistiEmulatore);

after(async () => {
  await deleteApp(firebase.app);
});

// Pokreće CLI sa eksplicitno sastavljenim env-om (bez nasljeđivanja ostalih varijabli procesa).
function pokreniPunjenje(dodatniEnv) {
  return spawnSync(process.execPath, ['skripte/napuniEmulator.js'], {
    cwd: KORIJEN_BACKENDA,
    env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...dodatniEnv },
    encoding: 'utf8',
    timeout: 60_000,
  });
}

async function brojRewardDefinitions() {
  return (await firebase.db.collection(KOLEKCIJE.rewardDefinitions).get()).size;
}

describe('I01-T09 seed odbija rad van emulatora i van demo projekta', () => {
  test('I01-T09 provjeriEmulatorskoOkruzenje: bez emulator host-a i sa ne-demo projektom → greška', () => {
    assert.throws(
      () => provjeriEmulatorskoOkruzenje({ FIREBASE_PROJECT_ID: 'demo-fuelpoints' }),
      GreskaZastiteEmulatora,
    );
    assert.throws(
      () => provjeriEmulatorskoOkruzenje({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'fuelpoints-prod' }),
      GreskaZastiteEmulatora,
    );
    assert.throws(
      () => provjeriEmulatorskoOkruzenje({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' }),
      GreskaZastiteEmulatora,
    );
    assert.deepStrictEqual(
      provjeriEmulatorskoOkruzenje({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'demo-fuelpoints' }),
      { projectId: 'demo-fuelpoints' },
    );
  });

  test('I01-T09 CLI bez FIRESTORE_EMULATOR_HOST i CLI sa ne-demo projektom → exit 1, ništa upisano', async () => {
    const bezEmulatora = pokreniPunjenje({ FIREBASE_PROJECT_ID: 'demo-fuelpoints' });
    assert.equal(bezEmulatora.status, 1);
    assert.match(bezEmulatora.stderr, /FIRESTORE_EMULATOR_HOST/);
    assert.ok(!bezEmulatora.stderr.includes('demo-fuelpoints'));

    const neDemo = pokreniPunjenje({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080', FIREBASE_PROJECT_ID: 'fuelpoints-prod' });
    assert.equal(neDemo.status, 1);
    assert.match(neDemo.stderr, /FIREBASE_PROJECT_ID/);
    assert.ok(!neDemo.stderr.includes('fuelpoints-prod'));
    assert.ok(!neDemo.stderr.includes('127.0.0.1:8080'));

    for (const rezultat of [bezEmulatora, neDemo]) {
      assert.ok(!rezultat.stderr.includes('    at '));
    }
    assert.equal(await brojRewardDefinitions(), 0);
  });
});

describe('I01-T08 seed rewardDefinitions po §12 je idempotentan', () => {
  const OCEKIVANO = {
    CAR_WASH: { displayName: 'Besplatno pranje', costPoints: 50, active: true },
    SHOWER: { displayName: 'Besplatan tuš', costPoints: 30, active: true },
  };
  const ENV_EMULATORA = {
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT,
    FIREBASE_PROJECT_ID: 'demo-fuelpoints',
  };

  async function stanjeKataloga() {
    const snimak = await firebase.db.collection(KOLEKCIJE.rewardDefinitions).get();
    return Object.fromEntries(snimak.docs.map((d) => [d.id, d.data()]));
  }

  function pokreniUspjesno() {
    const rezultat = pokreniPunjenje(ENV_EMULATORA);
    assert.equal(rezultat.status, 0, rezultat.stderr);
    assert.match(rezultat.stdout, /Upisano 2 dokumenta u rewardDefinitions\./);
  }

  test('I01-T08 dvostruko pokretanje → tačno 2 dokumenta sa vrijednostima iz §12, bez dodatnih polja', async () => {
    pokreniUspjesno();
    const poslijePrvog = await stanjeKataloga();
    assert.deepStrictEqual(poslijePrvog, OCEKIVANO);

    pokreniUspjesno();
    const poslijeDrugog = await stanjeKataloga();
    assert.deepStrictEqual(poslijeDrugog, OCEKIVANO);
    assert.deepStrictEqual(poslijeDrugog, poslijePrvog);
  });

  test('I01-T08 ručno izmijenjen dokument vraća se na §12 vrijednosti pri ponovnom punjenju', async () => {
    pokreniUspjesno();
    await firebase.db.collection(KOLEKCIJE.rewardDefinitions).doc('CAR_WASH').update({ active: false, visak: 1 });
    pokreniUspjesno();
    assert.deepStrictEqual(await stanjeKataloga(), OCEKIVANO);
  });
});
