import { FieldValue } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, saRokom } from '../greske/greskeServisa.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../konfiguracija/konfiguracija.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';

const MAKSIMALNO_POKUSAJA = 5;

function stanjeNaloga(korisnik, nalog) {
  return {
    displayName: korisnik.displayName,
    accountStatus: korisnik.accountStatus,
    acceptedTermsVersion: korisnik.acceptedTermsVersion,
    availablePoints: nalog.availablePoints,
    reservedPoints: nalog.reservedPoints,
  };
}

// AUTH-02 … AUTH-05, §7.1: users/{uid} i loyaltyAccounts/{uid} u JEDNOJ Firestore transakciji.
// Kreira se samo dokument koji nedostaje (i02/P-2); postojeći dokument se nikad ne piše. Bez ledger eventa.
// Callback nema sporednih efekata van tx, jer se može izvršiti više puta.
export async function inicijalizujNalog(db, { uid, displayName, acceptedTermsVersion }) {
  const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
  const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid);

  const transakcija = db.runTransaction(
    async (tx) => {
      const [snimakKorisnika, snimakNaloga] = await tx.getAll(refKorisnik, refNalog);

      if (snimakKorisnika.exists) {
        const status = snimakKorisnika.get('accountStatus');
        if (status === 'DELETION_IN_PROGRESS') {
          throw new GreskaApi('ACCOUNT_DELETION_IN_PROGRESS');
        }
        if (status !== 'ACTIVE') {
          throw new Error('Neočekivan accountStatus u users dokumentu.');
        }
      }

      const vrijeme = FieldValue.serverTimestamp();
      let kreirano = false;
      let korisnik = snimakKorisnika.data();
      let nalog = snimakNaloga.data();

      if (!snimakKorisnika.exists) {
        korisnik = {
          displayName,
          accountStatus: 'ACTIVE',
          createdAt: vrijeme,
          updatedAt: vrijeme,
          acceptedTermsVersion,
          acceptedTermsAt: vrijeme,
        };
        tx.create(refKorisnik, korisnik);
        kreirano = true;
      }
      if (!snimakNaloga.exists) {
        nalog = { availablePoints: 0, reservedPoints: 0, createdAt: vrijeme, updatedAt: vrijeme };
        tx.create(refNalog, nalog);
        kreirano = true;
      }

      return { kreirano, stanje: stanjeNaloga(korisnik, nalog) };
    },
    { maxAttempts: MAKSIMALNO_POKUSAJA },
  );

  try {
    return await saRokom(transakcija, ROK_ZAVISNOG_SERVISA_MS);
  } catch (greska) {
    if (greska instanceof GreskaApi) {
      throw greska;
    }
    if (jeNedostupnostFirestore(greska)) {
      throw new GreskaApi('SERVICE_UNAVAILABLE');
    }
    throw greska;
  }
}
