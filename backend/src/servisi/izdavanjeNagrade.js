import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, saRokom } from '../greske/greskeServisa.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { TRAJANJE_VAUCERA_MS, generisiVoucherId, izracunajRequestKey, jeIstekao, poredakOslobadjanja } from './vauceri.js';

const MAKSIMALNO_POKUSAJA = 5;
const FORMAT_VOUCHER_ID = /^[0-9a-f]{64}$/;
// §15: enum statusa voucher-a.
const STATUSI_VAUCERA = new Set(['ACTIVE', 'REDEEMED', 'EXPIRED', 'CANCELLED']);

function jeNenegativanCijeliBroj(vrijednost) {
  return Number.isSafeInteger(vrijednost) && vrijednost >= 0;
}

function jePozitivanCijeliBroj(vrijednost) {
  return Number.isSafeInteger(vrijednost) && vrijednost >= 1;
}

function jeIspravanSacuvaniVaucer(vaucer) {
  return (
    jePozitivanCijeliBroj(vaucer.costPoints) &&
    STATUSI_VAUCERA.has(vaucer.status) &&
    vaucer.issuedAt instanceof Timestamp &&
    vaucer.expiresAt instanceof Timestamp
  );
}

// Tijelo uspješnog odgovora API-03 (i04/P-1): ista funkcija za 201 (upisani objekat) i 200 (SAČUVANI voucher dokument).
// status je trenutni status voucher-a. Bez uid-a, requestId-a, requestKey-a, ID-eva ledger događaja i balance-a.
function odgovorVaucera(voucherId, vaucer) {
  return {
    voucherId,
    rewardId: vaucer.rewardId,
    costPoints: vaucer.costPoints,
    status: vaucer.status,
    issuedAt: vaucer.issuedAt.toDate().toISOString(),
    expiresAt: vaucer.expiresAt.toDate().toISOString(),
  };
}

// §18.1, i04/P-5, i04/P-6: po voucher-u prvo status EXPIRED (jedina izmjena voucher-a), pa REWARD_RELEASE (samo tx.create).
function upisiOslobadjanja(tx, refLedger, oslobadjanja, uid, vrijeme) {
  for (const o of oslobadjanja) {
    tx.update(o.ref, { status: 'EXPIRED' });
    tx.create(refLedger(`release_${o.voucherId}`), {
      uid,
      type: 'REWARD_RELEASE',
      deltaAvailable: o.cijena,
      deltaReserved: -o.cijena,
      availableAfter: o.availableAfter,
      reservedAfter: o.reservedAfter,
      purchaseId: null,
      voucherId: o.voucherId,
      createdAt: vrijeme,
    });
  }
}

// §13, §13.1, §13.2, §14, §15, §17, §18.1: reconcile isteklih voucher-a, rezervacija bodova, ACTIVE voucher, REWARD_RESERVE i
// rewardRequests mapping u JEDNOJ Firestore transakciji. Poredak provjera je obavezujući (i04/P-7):
// mapping (O-16) → nalog → nagrada → reconcile → bodovi (O-14) → upisi. Sva čitanja prethode svim upisima.
// Upisi (k isteklih): 1 … 2k release-i, 2k+1 nalog, 2k+2 voucher, 2k+3 RESERVE, 2k+4 mapping; O-14 grana: 1 … 2k, 2k+1 nalog.
// Callback nema sporednih efekata van tx, jer se može izvršiti više puta.
// rokDo je kraj roka cijelog zahtjeva (res.locals.rokDo); bez preostalog vremena transakcija se ne pokreće.
export async function izdajNagradu(db, { uid, rewardId, requestId }, rokDo) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }

  const requestKey = izracunajRequestKey(uid, requestId);
  const refMapping = db.collection(KOLEKCIJE.rewardRequests).doc(requestKey);
  const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
  const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid);
  const refNagrada = db.collection(KOLEKCIJE.rewardDefinitions).doc(rewardId);
  const upitAktivnih = db.collection(KOLEKCIJE.vouchers).where('uid', '==', uid).where('status', '==', 'ACTIVE');
  const refVaucer = (voucherId) => db.collection(KOLEKCIJE.vouchers).doc(voucherId);
  const refLedger = (eventId) => db.collection(KOLEKCIJE.loyaltyLedger).doc(eventId);

  const transakcija = db.runTransaction(
    async (tx) => {
      // i04/P-2: jedno čitanje sata Backend-a po pokušaju (issuedAt, expiresAt i reconcile).
      const sadaMs = Date.now();

      // O-16: mapping PRIJE preduslova; retry istog (uid, requestId, rewardId) ništa ne upisuje.
      const snimakMapping = await tx.get(refMapping);
      if (snimakMapping.exists) {
        const mapping = snimakMapping.data();
        if (mapping.uid !== uid || mapping.requestId !== requestId) {
          throw new Error('Nekonzistentno stanje: mapping ne odgovara svom ključu.');
        }
        if (typeof mapping.rewardId !== 'string' || typeof mapping.voucherId !== 'string' || !FORMAT_VOUCHER_ID.test(mapping.voucherId)) {
          throw new Error('Nekonzistentno stanje: neispravan mapping.');
        }
        if (mapping.rewardId !== rewardId) {
          throw new GreskaApi('IDEMPOTENCY_CONFLICT');
        }
        const snimakVaucera = await tx.get(refVaucer(mapping.voucherId));
        if (!snimakVaucera.exists) {
          throw new Error('Nekonzistentno stanje: mapping postoji bez voucher-a.');
        }
        const vaucer = snimakVaucera.data();
        if (vaucer.uid !== uid || vaucer.rewardId !== mapping.rewardId || !jeIspravanSacuvaniVaucer(vaucer)) {
          throw new Error('Nekonzistentno stanje: voucher ne odgovara mapping-u.');
        }
        return { ishod: 'POSTOJECI', odgovor: odgovorVaucera(mapping.voucherId, vaucer) };
      }

      // §13.1, AUTH-03 … AUTH-05: stanje naloga, pa definicija nagrade.
      const [snimakKorisnika, snimakNaloga, snimakNagrade] = await tx.getAll(refKorisnik, refNalog, refNagrada);
      if (!snimakKorisnika.exists) {
        throw new GreskaApi('ACCOUNT_NOT_INITIALIZED');
      }
      const status = snimakKorisnika.get('accountStatus');
      if (status === 'DELETION_IN_PROGRESS') {
        throw new GreskaApi('ACCOUNT_DELETION_IN_PROGRESS');
      }
      if (status !== 'ACTIVE') {
        throw new Error('Neočekivan accountStatus u users dokumentu.');
      }
      if (!snimakNaloga.exists) {
        throw new GreskaApi('ACCOUNT_NOT_INITIALIZED');
      }
      let dostupno = snimakNaloga.get('availablePoints');
      let rezervisano = snimakNaloga.get('reservedPoints');
      // §7.2, i03/P-15: neispravan nalog se ne „popravlja”.
      if (!jeNenegativanCijeliBroj(dostupno) || !jeNenegativanCijeliBroj(rezervisano)) {
        throw new Error('Neispravan loyaltyAccounts dokument.');
      }
      if (!snimakNagrade.exists) {
        throw new GreskaApi('REWARD_NOT_FOUND');
      }
      // i04/P-12: prvo ispravnost definicije (500), tek onda active == false (409).
      const cijena = snimakNagrade.get('costPoints');
      const aktivna = snimakNagrade.get('active');
      if (!jePozitivanCijeliBroj(cijena) || typeof aktivna !== 'boolean') {
        throw new Error('Neispravan rewardDefinitions dokument.');
      }
      if (aktivna === false) {
        throw new GreskaApi('REWARD_INACTIVE');
      }

      // §18.1, D-1: reconcile — čitanja.
      const snimakAktivnih = await tx.get(upitAktivnih);
      const aktivni = snimakAktivnih.docs.map((dokument) => {
        const expiresAt = dokument.get('expiresAt');
        const costPoints = dokument.get('costPoints');
        if (
          dokument.get('uid') !== uid ||
          dokument.get('status') !== 'ACTIVE' ||
          !(expiresAt instanceof Timestamp) ||
          !jePozitivanCijeliBroj(costPoints)
        ) {
          throw new Error('Nekonzistentno stanje: neispravan ACTIVE voucher.');
        }
        return { ref: dokument.ref, voucherId: dokument.id, expiresAtMs: expiresAt.toMillis(), cijena: costPoints };
      });
      const istekli = aktivni.filter((v) => jeIstekao(v.expiresAtMs, sadaMs)).sort(poredakOslobadjanja);
      const snimciRelease = istekli.length > 0 ? await tx.getAll(...istekli.map((v) => refLedger(`release_${v.voucherId}`))) : [];
      if (snimciRelease.some((snimak) => snimak.exists)) {
        throw new Error('Nekonzistentno stanje: release postoji za ACTIVE voucher.');
      }

      // Lanac release-a u memoriji (i04/P-6); upisi tek poslije svih čitanja.
      const oslobadjanja = [];
      for (const v of istekli) {
        if (rezervisano - v.cijena < 0) {
          throw new Error('Nekonzistentno stanje: reservedPoints bi pao ispod 0.');
        }
        dostupno += v.cijena;
        rezervisano -= v.cijena;
        oslobadjanja.push({ ...v, availableAfter: dostupno, reservedAfter: rezervisano });
      }

      // i04/P-2: jedan serverTimestamp po transakciji za ledger, mapping i updatedAt.
      const vrijeme = FieldValue.serverTimestamp();

      // O-14: nedovoljno bodova poslije reconcile-a → release-i se commit-uju, 409 se baca POSLIJE transakcije.
      if (dostupno < cijena) {
        if (oslobadjanja.length > 0) {
          upisiOslobadjanja(tx, refLedger, oslobadjanja, uid, vrijeme);
          tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme });
        }
        return { ishod: 'NEDOVOLJNO' };
      }

      // §15, i04/P-3: novi voucherId po pokušaju; zauzetost se provjerava prije upisa.
      const voucherId = generisiVoucherId();
      const refNovi = refVaucer(voucherId);
      const refReserve = refLedger(`reserve_${voucherId}`);
      const [snimakNovog, snimakReserve] = await tx.getAll(refNovi, refReserve);
      if (snimakNovog.exists || snimakReserve.exists) {
        throw new Error('Nekonzistentno stanje: voucherId je zauzet.');
      }
      const availableAfter = dostupno - cijena;
      const reservedAfter = rezervisano + cijena;
      const vaucer = {
        uid,
        rewardId,
        costPoints: cijena,
        status: 'ACTIVE',
        issuedAt: Timestamp.fromMillis(sadaMs),
        expiresAt: Timestamp.fromMillis(sadaMs + TRAJANJE_VAUCERA_MS),
        redeemedAt: null,
        cancelledAt: null,
        redeemedAtStationId: null,
      };

      upisiOslobadjanja(tx, refLedger, oslobadjanja, uid, vrijeme);
      tx.update(refNalog, { availablePoints: availableAfter, reservedPoints: reservedAfter, updatedAt: vrijeme });
      tx.create(refNovi, vaucer);
      tx.create(refReserve, {
        uid,
        type: 'REWARD_RESERVE',
        deltaAvailable: -cijena,
        deltaReserved: cijena,
        availableAfter,
        reservedAfter,
        purchaseId: null,
        voucherId,
        createdAt: vrijeme,
      });
      tx.create(refMapping, { uid, requestId, rewardId, voucherId, createdAt: vrijeme });
      return { ishod: 'KREIRAN', odgovor: odgovorVaucera(voucherId, vaucer) };
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
  if (rezultat.ishod === 'NEDOVOLJNO') {
    throw new GreskaApi('INSUFFICIENT_POINTS');
  }
  return { kreirano: rezultat.ishod === 'KREIRAN', odgovor: rezultat.odgovor };
}
