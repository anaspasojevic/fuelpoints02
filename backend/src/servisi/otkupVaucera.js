import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, saRokom } from '../greske/greskeServisa.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { pripremiOslobadjanja, refRelease, upisiOslobadjanja } from './oslobadjanjeVaucera.js';
import { procitajStanjeNaloga } from './stanjeNaloga.js';
import { FORMAT_VOUCHER_ID, izracunajRequestKey, jeIstekao, jeKonzistentnoStanjeVaucera } from './vauceri.js';

const MAKSIMALNO_POKUSAJA = 5;
const KLJUCEVI_ZAPISA = ['createdAt', 'redemptionRequestId', 'resultStatus', 'stationId', 'uid', 'voucherId'];

// Tijelo uspješnog odgovora API-04 (i06/P-6): ista funkcija za prvi otkup (upisani objekat) i retry (SAČUVANI voucher dokument,
// §20.2), pa su oba odgovora identična. Bez uid-a, redemptionRequestId-a, requestKey-a, ID-eva ledger događaja i balance-a.
function tijeloOtkupljenog(voucherId, vaucer) {
  return {
    voucherId,
    rewardId: vaucer.rewardId,
    costPoints: vaucer.costPoints,
    status: vaucer.status,
    issuedAt: vaucer.issuedAt.toDate().toISOString(),
    expiresAt: vaucer.expiresAt.toDate().toISOString(),
    redeemedAt: vaucer.redeemedAt.toDate().toISOString(),
    redeemedAtStationId: vaucer.redeemedAtStationId,
  };
}

// §20.2, i06/P-3: zapis mora tačno odgovarati svom ključu i imati oblik koji upisuje samo uspješan otkup (O-8 (a)).
function jeIspravanZapis(zapis, stationId, redemptionRequestId) {
  return (
    Object.keys(zapis).sort().join() === KLJUCEVI_ZAPISA.join() &&
    zapis.stationId === stationId &&
    zapis.redemptionRequestId === redemptionRequestId &&
    typeof zapis.voucherId === 'string' &&
    FORMAT_VOUCHER_ID.test(zapis.voucherId) &&
    typeof zapis.uid === 'string' &&
    zapis.uid !== '' &&
    zapis.resultStatus === 'REDEEMED' &&
    zapis.createdAt instanceof Timestamp
  );
}

// §20, §20.1 … §20.5, §7.5, §11, §16 (API-04): otkup voucher-a u JEDNOJ Firestore transakciji. Poredak provjera (O-24, O-25, i06/P-5):
// zapis redemptionRequests (O-24: isti voucher → isti rezultat, drugi → 409) → voucher postoji (404) → konzistentnost (O-27, 500)
// → REDEEMED / CANCELLED / EXPIRED (409, O-7) → nalog (samo ACTIVE; AUTH-03, AUTH-05) → redeem_ / release_ ne postoje (O-28, 500)
// → istek (§20.5: EXPIRED + RELEASE, 409 poslije commit-a) → reservedPoints ≥ cost (500) → upisi.
// Upisi uspjeha: 1 voucher (status, redeemedAt, redeemedAtStationId), 2 redeem_{voucherId} (tx.create), 3 loyaltyAccounts
// (reservedPoints, updatedAt), 4 redemptionRequests/{requestKey} (tx.create). Sva čitanja prethode svim upisima; nikad tx.get(query) (O-26).
// stationId je ISKLJUČIVO iz POS ključa; uid je iz voucher dokumenta.
export async function otkupiVaucer(db, { stationId, voucherId, redemptionRequestId }, rokDo) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }

  // O-8 (b): requestKey = SHA-256(stationId:redemptionRequestId).
  const requestKey = izracunajRequestKey(stationId, redemptionRequestId);
  const refZapis = db.collection(KOLEKCIJE.redemptionRequests).doc(requestKey);
  const refVaucer = db.collection(KOLEKCIJE.vouchers).doc(voucherId);
  const refRedeem = db.collection(KOLEKCIJE.loyaltyLedger).doc(`redeem_${voucherId}`);

  const transakcija = db.runTransaction(
    async (tx) => {
      // ODLUKE §6 (j): jedno čitanje sata Backend-a po pokušaju (istek i redeemedAt).
      const sadaMs = Date.now();

      const [snimakZapisa, snimakVaucera] = await tx.getAll(refZapis, refVaucer);

      // O-24, §20.2: idempotentnost PRIJE stanja voucher-a; retry ništa ne upisuje, bez obzira na nalog i rok.
      if (snimakZapisa.exists) {
        const zapis = snimakZapisa.data();
        if (!jeIspravanZapis(zapis, stationId, redemptionRequestId)) {
          throw new Error('Nekonzistentno stanje: neispravan zapis otkupa.');
        }
        if (zapis.voucherId !== voucherId) {
          throw new GreskaApi('IDEMPOTENCY_CONFLICT');
        }
        if (!snimakVaucera.exists) {
          throw new Error('Nekonzistentno stanje: zapis otkupa bez voucher-a.');
        }
        const sacuvani = snimakVaucera.data();
        if (
          !jeKonzistentnoStanjeVaucera(sacuvani) ||
          sacuvani.status !== 'REDEEMED' ||
          sacuvani.redeemedAtStationId !== stationId ||
          sacuvani.uid !== zapis.uid
        ) {
          throw new Error('Nekonzistentno stanje: voucher ne odgovara zapisu otkupa.');
        }
        return { ishod: 'OTKUPLJEN', odgovor: tijeloOtkupljenog(voucherId, sacuvani) };
      }

      if (!snimakVaucera.exists) {
        throw new GreskaApi('VOUCHER_NOT_FOUND');
      }
      const vaucer = snimakVaucera.data();
      if (!jeKonzistentnoStanjeVaucera(vaucer)) {
        throw new Error('Nekonzistentno stanje: neispravan voucher.');
      }

      // §20.4, O-7, O-25: terminalna stanja PRIJE naloga; status ima prednost nad rokom; ništa se ne upisuje.
      if (vaucer.status === 'REDEEMED') {
        throw new GreskaApi('VOUCHER_ALREADY_REDEEMED');
      }
      if (vaucer.status === 'CANCELLED') {
        throw new GreskaApi('VOUCHER_CANCELLED');
      }
      if (vaucer.status === 'EXPIRED') {
        throw new GreskaApi('VOUCHER_EXPIRED');
      }

      // ACTIVE: nalog vlasnika voucher-a (AUTH-05: nova mutacija se odbija, ni §20.5 release).
      const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(vaucer.uid);
      const [snimakKorisnika, snimakNaloga] = await tx.getAll(db.collection(KOLEKCIJE.users).doc(vaucer.uid), refNalog);
      const nalog = procitajStanjeNaloga(snimakKorisnika, snimakNaloga);

      // O-28, i06/P-5: ACTIVE voucher nema terminalni ledger događaj (obje grane).
      const [snimakRedeem, snimakRelease] = await tx.getAll(refRedeem, refRelease(db, voucherId));
      if (snimakRedeem.exists || snimakRelease.exists) {
        throw new Error('Nekonzistentno stanje: ledger događaj postoji za ACTIVE voucher.');
      }

      const expiresAtMs = vaucer.expiresAt.toMillis();
      // i04/P-2: jedan serverTimestamp po transakciji za ledger, zapis i updatedAt.
      const vrijeme = FieldValue.serverTimestamp();

      // §20.5, §18 (samo voucher iz putanje, O-26): istekao ACTIVE → EXPIRED + RELEASE (zajednički mehanizam); bez zapisa (O-8 (a)).
      if (jeIstekao(expiresAtMs, sadaMs)) {
        const { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db, {
          vauceri: [{ ref: refVaucer, voucherId, expiresAtMs, cijena: vaucer.costPoints, izmjena: { status: 'EXPIRED' } }],
          dostupno: nalog.dostupno,
          rezervisano: nalog.rezervisano,
        });
        upisiOslobadjanja(tx, db, oslobadjanja, { uid: vaucer.uid, vrijeme });
        tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme });
        return { ishod: 'ISTEKAO' };
      }

      // §20.3, §7.5: reservedPoints −= cost, availablePoints se NE mijenja.
      const rezervisano = nalog.rezervisano - vaucer.costPoints;
      if (rezervisano < 0) {
        throw new Error('Nekonzistentno stanje: reservedPoints bi pao ispod 0.');
      }
      const izmjena = { status: 'REDEEMED', redeemedAt: Timestamp.fromMillis(sadaMs), redeemedAtStationId: stationId };

      tx.update(refVaucer, izmjena);
      tx.create(refRedeem, {
        uid: vaucer.uid,
        type: 'REWARD_REDEEM',
        deltaAvailable: 0,
        deltaReserved: -vaucer.costPoints,
        availableAfter: nalog.dostupno,
        reservedAfter: rezervisano,
        purchaseId: null,
        voucherId,
        createdAt: vrijeme,
      });
      tx.update(refNalog, { reservedPoints: rezervisano, updatedAt: vrijeme });
      tx.create(refZapis, {
        stationId,
        uid: vaucer.uid,
        redemptionRequestId,
        voucherId,
        resultStatus: 'REDEEMED',
        createdAt: vrijeme,
      });
      return { ishod: 'OTKUPLJEN', odgovor: tijeloOtkupljenog(voucherId, { ...vaucer, ...izmjena }) };
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
  // §20.5: 409 tek POSLIJE commit-a EXPIRED + RELEASE.
  if (rezultat.ishod === 'ISTEKAO') {
    throw new GreskaApi('VOUCHER_EXPIRED');
  }
  return rezultat.odgovor;
}
