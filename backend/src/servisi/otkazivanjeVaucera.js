import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, saRokom } from '../greske/greskeServisa.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { pripremiOslobadjanja, upisiOslobadjanja } from './oslobadjanjeVaucera.js';
import { procitajStanjeNaloga } from './stanjeNaloga.js';
import { jeIspravanSacuvaniVaucer, jeIstekao } from './vauceri.js';

const MAKSIMALNO_POKUSAJA = 5;

// Tijelo uspješnog odgovora API-05 (i05/P-1): ista funkcija za prvi cancel (upisani objekat) i ponovljen cancel (SAČUVANI dokument,
// §19.2), pa su oba odgovora identična. Prvih 6 ključeva kao API-03 (i04/P-1). Bez uid-a, ID-eva ledger događaja i balance-a.
function tijeloOtkazanog(voucherId, vaucer) {
  return {
    voucherId,
    rewardId: vaucer.rewardId,
    costPoints: vaucer.costPoints,
    status: vaucer.status,
    issuedAt: vaucer.issuedAt.toDate().toISOString(),
    expiresAt: vaucer.expiresAt.toDate().toISOString(),
    cancelledAt: vaucer.cancelledAt.toDate().toISOString(),
  };
}

// §19, §16, §11 (API-05): cancel voucher-a u JEDNOJ Firestore transakciji. Poredak provjera (i05/P-4, O-20, O-6):
// postoji (404) → vlasnik (403) → ispravan voucher (500) → CANCELLED (200 bez upisa, §19.2) / REDEEMED / EXPIRED (409, §19.3)
// → nalog (AUTH-03, AUTH-05; samo za ACTIVE, jedini koji mutira) → istek (O-5) → release (zajednički mehanizam) → upisi.
// Upisi: 1 voucher (status [+ cancelledAt]), 2 release_{voucherId} (tx.create), 3 loyaltyAccounts. Sva čitanja prethode svim upisima.
// O-5: ACTIVE voucher kome je sadaMs ≥ expiresAt prelazi u EXPIRED sa release-om u istoj transakciji; 409 VOUCHER_EXPIRED se baca
// tek POSLIJE commit-a (ishod nikad nije CANCELLED). State-idempotentno: retry poslije 503 vidi CANCELLED/EXPIRED i ništa ne upisuje.
export async function otkaziVaucer(db, { uid, voucherId }, rokDo) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }

  const refVaucer = db.collection(KOLEKCIJE.vouchers).doc(voucherId);
  const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
  const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid);

  const transakcija = db.runTransaction(
    async (tx) => {
      // i05/P-3, ODLUKE §6 (j): jedno čitanje sata Backend-a po pokušaju (istek i cancelledAt).
      const sadaMs = Date.now();

      const snimak = await tx.get(refVaucer);
      if (!snimak.exists) {
        throw new GreskaApi('VOUCHER_NOT_FOUND');
      }
      const vaucer = snimak.data();

      // O-6: vlasništvo prije svega ostalog o tuđem voucher-u; voucher bez vlasnika je nekonzistentan, ne „tuđi”.
      if (typeof vaucer.uid !== 'string' || vaucer.uid === '') {
        throw new Error('Nekonzistentno stanje: voucher bez vlasnika.');
      }
      if (vaucer.uid !== uid) {
        throw new GreskaApi('FORBIDDEN');
      }
      if (!jeIspravanSacuvaniVaucer(vaucer) || typeof vaucer.rewardId !== 'string') {
        throw new Error('Nekonzistentno stanje: neispravan voucher.');
      }

      // §19.2, §19.3, O-20: terminalna stanja PRIJE provjere naloga; ništa se ne upisuje.
      if (vaucer.status === 'CANCELLED') {
        if (!(vaucer.cancelledAt instanceof Timestamp)) {
          throw new Error('Nekonzistentno stanje: otkazan voucher bez cancelledAt.');
        }
        return { ishod: 'OTKAZAN', odgovor: tijeloOtkazanog(voucherId, vaucer) };
      }
      if (vaucer.status === 'REDEEMED') {
        throw new GreskaApi('VOUCHER_ALREADY_REDEEMED');
      }
      if (vaucer.status === 'EXPIRED') {
        throw new GreskaApi('VOUCHER_EXPIRED');
      }

      // ACTIVE (status je u enum-u §15): nalog mora biti ACTIVE (AUTH-05: nova loyalty mutacija se odbija, ni O-5 release).
      const [snimakKorisnika, snimakNaloga] = await tx.getAll(refKorisnik, refNalog);
      const nalog = procitajStanjeNaloga(snimakKorisnika, snimakNaloga);

      const expiresAtMs = vaucer.expiresAt.toMillis();
      const istekao = jeIstekao(expiresAtMs, sadaMs);
      const izmjena = istekao ? { status: 'EXPIRED' } : { status: 'CANCELLED', cancelledAt: Timestamp.fromMillis(sadaMs) };

      const { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db, {
        vauceri: [{ ref: refVaucer, voucherId, expiresAtMs, cijena: vaucer.costPoints, izmjena }],
        dostupno: nalog.dostupno,
        rezervisano: nalog.rezervisano,
      });

      // i04/P-2: jedan serverTimestamp po transakciji za ledger i updatedAt.
      const vrijeme = FieldValue.serverTimestamp();
      upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme });
      tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme });
      if (istekao) {
        return { ishod: 'ISTEKAO' };
      }
      return { ishod: 'OTKAZAN', odgovor: tijeloOtkazanog(voucherId, { ...vaucer, ...izmjena }) };
    },
    { maxAttempts: MAKSIMALNO_POKUSAJA },
  );

  let rezultat;
  try {
    rezultat = await saRokom(transakcija, preostaloMs);
  } catch (greska) {
    if (greska instanceof GreskaApi) {
      throw greska;
    }
    if (jeNedostupnostFirestore(greska)) {
      throw new GreskaApi('SERVICE_UNAVAILABLE');
    }
    throw greska;
  }
  if (rezultat.ishod === 'ISTEKAO') {
    throw new GreskaApi('VOUCHER_EXPIRED');
  }
  return rezultat.odgovor;
}
