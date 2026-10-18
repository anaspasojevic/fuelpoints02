import { Timestamp } from 'firebase-admin/firestore';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { jeIstekao, jePozitivanCijeliBroj, poredakOslobadjanja } from './vauceri.js';

// Zajednički mehanizam „release najviše jednom” (§18.1, §19.1, i04/P-5, i04/P-6, ODLUKE §6 (g), (l); i05/P-5): jedina implementacija
// koju koriste API-03 (reconcile), API-06 i API-05 (cancel i O-5). Radi samo kroz tx pozivaoca; ne čita sat (sadaMs daje pozivalac,
// pročitan na početku njegovog pokušaja transakcije, ODLUKE §6 (j)). Stavka oslobađanja:
// { ref, voucherId, expiresAtMs, cijena, izmjena } — izmjena je jedina izmjena voucher dokumenta ({ status: 'EXPIRED' } ili
// { status: 'CANCELLED', cancelledAt }).

function refRelease(db, voucherId) {
  return db.collection(KOLEKCIJE.loyaltyLedger).doc(`release_${voucherId}`);
}

// §18.1, D-1, O-17: ACTIVE voucher-i korisnika upitom u transakciji; svaki mora biti ispravan (i04/P-7 (d)), pa oni za koje je
// sadaMs ≥ expiresAt, poredani po poredakOslobadjanja (i04/P-6).
export async function procitajIstekleAktivne(tx, db, { uid, sadaMs }) {
  const upitAktivnih = db.collection(KOLEKCIJE.vouchers).where('uid', '==', uid).where('status', '==', 'ACTIVE');
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
  return aktivni
    .filter((v) => jeIstekao(v.expiresAtMs, sadaMs))
    .sort(poredakOslobadjanja)
    .map((v) => ({ ...v, izmjena: { status: 'EXPIRED' } }));
}

// Čitanje release_{voucherId} za svaku stavku (već poredane) i lanac u memoriji (i04/P-6): postojeći release za ACTIVE voucher ili
// reservedPoints ispod 0 → nekonzistentno stanje (500), ništa upisano. Vraća stavke sa availableAfter/reservedAfter i novo stanje naloga.
export async function pripremiOslobadjanja(tx, db, { vauceri, dostupno, rezervisano }) {
  const snimciRelease = vauceri.length > 0 ? await tx.getAll(...vauceri.map((v) => refRelease(db, v.voucherId))) : [];
  if (snimciRelease.some((snimak) => snimak.exists)) {
    throw new Error('Nekonzistentno stanje: release postoji za ACTIVE voucher.');
  }
  const oslobadjanja = [];
  for (const v of vauceri) {
    if (rezervisano - v.cijena < 0) {
      throw new Error('Nekonzistentno stanje: reservedPoints bi pao ispod 0.');
    }
    dostupno += v.cijena;
    rezervisano -= v.cijena;
    oslobadjanja.push({ ...v, availableAfter: dostupno, reservedAfter: rezervisano });
  }
  return { oslobadjanja, dostupno, rezervisano };
}

// §11, §7.6: po voucher-u prvo izmjena voucher-a (tx.update), pa REWARD_RELEASE (samo tx.create, immutable).
export function upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme }) {
  for (const o of oslobadjanja) {
    tx.update(o.ref, o.izmjena);
    tx.create(refRelease(db, o.voucherId), {
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
