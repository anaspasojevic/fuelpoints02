import { FieldValue } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, saRokom } from '../greske/greskeServisa.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { pripremiOslobadjanja, procitajIstekleAktivne, upisiOslobadjanja } from './oslobadjanjeVaucera.js';
import { procitajStanjeNaloga } from './stanjeNaloga.js';

const MAKSIMALNO_POKUSAJA = 5;

// §18, §18.1 (API-06): svaki ACTIVE voucher korisnika za koji je serverTime ≥ expiresAt prelazi u EXPIRED sa REWARD_RELEASE, u JEDNOJ
// Firestore transakciji, najviše jednom (zajednički mehanizam, oslobadjanjeVaucera.js). Poredak (i05/P-4, O-20): nalog PRVI (AUTH-03,
// AUTH-05: nalog u brisanju ne dobija release), pa upit i release-i. Upisi (k isteklih): 1 … 2k voucher/release, 2k+1 nalog.
// Odgovor (i05/P-1, i05/P-14): { reconciledCount } = broj voucher-a koje je oslobodio commit-ovan pokušaj OVOG zahtjeva.
export async function uskladiVaucere(db, { uid }, rokDo) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }

  const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
  const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid);

  const transakcija = db.runTransaction(
    async (tx) => {
      // ODLUKE §6 (j): jedno čitanje sata Backend-a po pokušaju.
      const sadaMs = Date.now();

      const [snimakKorisnika, snimakNaloga] = await tx.getAll(refKorisnik, refNalog);
      const nalog = procitajStanjeNaloga(snimakKorisnika, snimakNaloga);

      const istekli = await procitajIstekleAktivne(tx, db, { uid, sadaMs });
      if (istekli.length === 0) {
        return { reconciledCount: 0 };
      }
      const { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db, {
        vauceri: istekli,
        dostupno: nalog.dostupno,
        rezervisano: nalog.rezervisano,
      });

      // i04/P-2: jedan serverTimestamp po transakciji za ledger i updatedAt.
      const vrijeme = FieldValue.serverTimestamp();
      upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme });
      tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme });
      return { reconciledCount: oslobadjanja.length };
    },
    { maxAttempts: MAKSIMALNO_POKUSAJA },
  );

  try {
    return await saRokom(transakcija, preostaloMs);
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
