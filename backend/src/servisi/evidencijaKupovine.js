import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, saRokom } from '../greske/greskeServisa.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { izracunajBodove, tekstObavjestenja } from './bodovanje.js';

const MAKSIMALNO_POKUSAJA = 5;

function jeNenegativanCijeliBroj(vrijednost) {
  return Number.isSafeInteger(vrijednost) && vrijednost >= 0;
}

// Tijelo uspješnog odgovora API-02 (i03/P-1): uvijek iz sačuvanog purchase dokumenta, isti oblik za prvi zahtjev i retry.
// Bez uid-a, balance-a, recordedAt-a i ID-eva ledger eventa i notifikacije.
function odgovorKupovine(purchaseId, kupovina) {
  return {
    purchaseId,
    stationId: kupovina.stationId,
    posTransactionId: kupovina.posTransactionId,
    volumeMl: kupovina.volumeMl,
    amountMinor: kupovina.amountMinor,
    currency: kupovina.currency,
    earnedPoints: kupovina.earnedPoints,
    occurredAt: kupovina.occurredAt.toDate().toISOString(),
  };
}

// §9, §10, §11, §7.3: purchase, loyalty balance, EARN ledger event i notifikacija u JEDNOJ Firestore transakciji.
// O-12: postojeća kupovina se provjerava PRIJE naloga; retry istog payload-a vraća prvi rezultat bez obzira na stanje naloga.
// Svi novi dokumenti se pišu sa tx.create (postojeći se nikad ne prepisuju), loyaltyAccounts samo tx.update.
// Callback nema sporednih efekata van tx, jer se može izvršiti više puta.
// rokDo je kraj roka cijelog zahtjeva (res.locals.rokDo); bez preostalog vremena transakcija se ne pokreće.
export async function evidentirajKupovinu(db, ulaz, rokDo) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }
  const { stationId, loyaltyUid, posTransactionId, volumeMl, amountMinor, currency, occurredAtMs } = ulaz;

  // §8.1; O-13 garantuje da stationId nema "_", pa je ID jednoznačan. §9.1 i i03/P-7: deterministički ID-evi.
  const purchaseId = `${stationId}__${posTransactionId}`;
  const refKupovina = db.collection(KOLEKCIJE.purchases).doc(purchaseId);
  const refKorisnik = db.collection(KOLEKCIJE.users).doc(loyaltyUid);
  const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(loyaltyUid);
  const refDogadjaj = db.collection(KOLEKCIJE.loyaltyLedger).doc(`earn_${purchaseId}`);
  const refObavjestenje = db.collection(KOLEKCIJE.notifications).doc(`earn_${purchaseId}`);

  const transakcija = db.runTransaction(
    async (tx) => {
      const snimakKupovine = await tx.get(refKupovina);
      if (snimakKupovine.exists) {
        const postojeca = snimakKupovine.data();
        // O-13, odbrana u dubinu: dokument pod ovim ID-em mora pripadati istom paru (stationId, posTransactionId).
        if (postojeca.stationId !== stationId || postojeca.posTransactionId !== posTransactionId) {
          throw new Error('Purchase dokument ne odgovara svom ID-u.');
        }
        // §10.3; occurredAt nije dio poređenja (O-3).
        if (
          postojeca.uid !== loyaltyUid ||
          postojeca.volumeMl !== volumeMl ||
          postojeca.amountMinor !== amountMinor ||
          postojeca.currency !== currency
        ) {
          throw new GreskaApi('IDEMPOTENCY_CONFLICT');
        }
        // §10.2: rezultat prve operacije, bez novog EARN-a; ništa se ne piše.
        return { kreirano: false, odgovor: odgovorKupovine(purchaseId, postojeca) };
      }

      const [snimakKorisnika, snimakNaloga, snimakDogadjaja, snimakObavjestenja] = await tx.getAll(
        refKorisnik,
        refNalog,
        refDogadjaj,
        refObavjestenje,
      );
      // §8.4, O-10: samo postojeći ACTIVE nalog (users ACTIVE i postoji loyaltyAccounts).
      if (!snimakKorisnika.exists || snimakKorisnika.get('accountStatus') !== 'ACTIVE' || !snimakNaloga.exists) {
        throw new GreskaApi('LOYALTY_ACCOUNT_NOT_FOUND');
      }
      if (snimakDogadjaja.exists || snimakObavjestenja.exists) {
        throw new Error('Nekonzistentno stanje: ledger event ili notifikacija postoji bez purchase dokumenta.');
      }
      const dostupno = snimakNaloga.get('availablePoints');
      const rezervisano = snimakNaloga.get('reservedPoints');
      // §7.2, i03/P-15: neispravan nalog se ne „popravlja”.
      if (!jeNenegativanCijeliBroj(dostupno) || !jeNenegativanCijeliBroj(rezervisano)) {
        throw new Error('Neispravan loyaltyAccounts dokument.');
      }

      const bodovi = izracunajBodove(volumeMl);
      const availableAfter = dostupno + bodovi;
      const reservedAfter = rezervisano;
      const vrijeme = FieldValue.serverTimestamp();
      const kupovina = {
        uid: loyaltyUid,
        stationId,
        posTransactionId,
        volumeMl,
        amountMinor,
        currency,
        earnedPoints: bodovi,
        occurredAt: Timestamp.fromMillis(occurredAtMs),
        recordedAt: vrijeme,
      };
      const { title, body } = tekstObavjestenja(bodovi);

      tx.create(refKupovina, kupovina);
      tx.update(refNalog, { availablePoints: availableAfter, updatedAt: vrijeme });
      tx.create(refDogadjaj, {
        uid: loyaltyUid,
        type: 'EARN',
        deltaAvailable: bodovi,
        deltaReserved: 0,
        availableAfter,
        reservedAfter,
        purchaseId,
        voucherId: null,
        createdAt: vrijeme,
      });
      tx.create(refObavjestenje, {
        uid: loyaltyUid,
        type: 'POINTS_EARNED',
        title,
        body,
        createdAt: vrijeme,
        readAt: null,
        relatedPurchaseId: purchaseId,
      });
      return { kreirano: true, odgovor: odgovorKupovine(purchaseId, kupovina) };
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
