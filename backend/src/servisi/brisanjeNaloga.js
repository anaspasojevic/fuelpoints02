import { FieldValue } from 'firebase-admin/firestore';
import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNedostupnostFirestore, klasifikujGreskuAuth, saRokom } from '../greske/greskeServisa.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { pripremiOslobadjanja, procitajAktivneZaZatvaranje, upisiOslobadjanja } from './oslobadjanjeVaucera.js';
import { jeNenegativanCijeliBroj } from './vauceri.js';

const MAKSIMALNO_POKUSAJA = 5;
// O-36: paketi ispod Firestore granice od 500 upisa.
const NAJVISE_UPISA_PO_PAKETU = 400;
// §23.2, ODLUKE §6 (f), (m), (u): mapping-i rewardRequests i redemptionRequests PRIJE vouchers, pa retry izdavanja / otkupa u
// međustanju nikad ne nailazi na mapping bez voucher-a (i07/P-6).
const PRIVATNE_KOLEKCIJE = [KOLEKCIJE.rewardRequests, KOLEKCIJE.redemptionRequests, KOLEKCIJE.notifications, KOLEKCIJE.vouchers];
// §23.3: istorijski zapisi ostaju, samo uid → null.
const ISTORIJSKE_KOLEKCIJE = [KOLEKCIJE.purchases, KOLEKCIJE.loyaltyLedger];

// O-36: svaki korak dobija samo preostalo vrijeme roka zahtjeva; bez njega korak se ne pokreće (ništa pročitano ni upisano).
// GreskaApi prolazi; nedostupnost Firestore-a → 503; ostalo je neočekivano (500, izvorna greška u logu).
async function uRoku(rokDo, funkcija) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }
  try {
    return await saRokom(funkcija(), preostaloMs);
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

// K1 (§23.1 (1), AUTH-05): users → DELETION_IN_PROGRESS u transakciji. Od ovog commit-a svaka loyalty mutacija, koja users čita u
// svojoj transakciji, odbija se (K2). Već DELETION_IN_PROGRESS ili users ne postoji (O-34b) → ništa; van enum-a → 500 (ODLUKE §5).
function postaviBrisanjeUToku(db, uid, rokDo) {
  return uRoku(rokDo, () => {
    const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
    return db.runTransaction(
      async (tx) => {
        const snimak = await tx.get(refKorisnik);
        if (!snimak.exists) {
          return;
        }
        const status = snimak.get('accountStatus');
        if (status === 'DELETION_IN_PROGRESS') {
          return;
        }
        if (status !== 'ACTIVE') {
          throw new Error('Neočekivan accountStatus u users dokumentu.');
        }
        tx.update(refKorisnik, { accountStatus: 'DELETION_IN_PROGRESS', updatedAt: FieldValue.serverTimestamp() });
      },
      { maxAttempts: MAKSIMALNO_POKUSAJA },
    );
  });
}

// i07/P-3: koraci poslije K1 rade samo dok su mutacije blokirane (users DELETION_IN_PROGRESS ili ne postoji).
function provjeriBlokaduMutacija(snimakKorisnika) {
  if (snimakKorisnika.exists && snimakKorisnika.get('accountStatus') !== 'DELETION_IN_PROGRESS') {
    throw new Error('Neočekivan accountStatus u users dokumentu.');
  }
}

// K3 (O-9, O-34, AC-09, NFR-04): svaki ACTIVE voucher → CANCELLED + cancelledAt ili (istekao) EXPIRED, sa REWARD_RELEASE kroz
// zajednički mehanizam, u JEDNOJ transakciji sa loyaltyAccounts. Bez ACTIVE voucher-a → ništa. Nekonzistentno stanje (O-27, release
// postoji, nalog ne postoji ili je neispravan, reservedPoints < cost) → 500, ništa upisano.
function zatvoriAktivneVaucere(db, uid, rokDo) {
  return uRoku(rokDo, () => {
    const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
    const refNalog = db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid);
    return db.runTransaction(
      async (tx) => {
        // ODLUKE §6 (j): jedno čitanje sata Backend-a po pokušaju (istek i cancelledAt).
        const sadaMs = Date.now();
        const [snimakKorisnika, snimakNaloga] = await tx.getAll(refKorisnik, refNalog);
        provjeriBlokaduMutacija(snimakKorisnika);
        const zatvaranja = await procitajAktivneZaZatvaranje(tx, db, { uid, sadaMs });
        if (zatvaranja.length === 0) {
          return;
        }
        if (!snimakNaloga.exists) {
          throw new Error('Nekonzistentno stanje: ACTIVE voucher bez loyaltyAccounts dokumenta.');
        }
        const dostupnoPrije = snimakNaloga.get('availablePoints');
        const rezervisanoPrije = snimakNaloga.get('reservedPoints');
        if (!jeNenegativanCijeliBroj(dostupnoPrije) || !jeNenegativanCijeliBroj(rezervisanoPrije)) {
          throw new Error('Neispravan loyaltyAccounts dokument.');
        }
        const { oslobadjanja, dostupno, rezervisano } = await pripremiOslobadjanja(tx, db, {
          vauceri: zatvaranja,
          dostupno: dostupnoPrije,
          rezervisano: rezervisanoPrije,
        });
        // i04/P-2: jedan serverTimestamp po transakciji za ledger i updatedAt.
        const vrijeme = FieldValue.serverTimestamp();
        upisiOslobadjanja(tx, db, oslobadjanja, { uid, vrijeme });
        tx.update(refNalog, { availablePoints: dostupno, reservedPoints: rezervisano, updatedAt: vrijeme });
      },
      { maxAttempts: MAKSIMALNO_POKUSAJA },
    );
  });
}

// Ponavlja upit „uid == …” (najviše NAJVISE_UPISA_PO_PAKETU dokumenata) i paket nad rezultatom dok upit ne vrati prazan skup.
// Postupak završava jer svaki commit-ovan paket uklanja svoje dokumente iz rezultata upita; prekid poslije bilo kog paketa je
// konzistentan, a ponovljeno izvršavanje nastavlja od preostalih dokumenata (§23.4).
async function obradiPoUid(db, kolekcija, uid, rokDo, operacija) {
  for (;;) {
    const snimak = await uRoku(rokDo, () =>
      db.collection(kolekcija).where('uid', '==', uid).limit(NAJVISE_UPISA_PO_PAKETU).get(),
    );
    if (snimak.empty) {
      return;
    }
    await uRoku(rokDo, () => {
      const paket = db.batch();
      for (const dokument of snimak.docs) {
        operacija(paket, dokument.ref);
      }
      return paket.commit();
    });
  }
}

// K4a (§23.2): privatni resursi korisnika (mapping-i, notifications, vouchers), pa loyaltyAccounts/{uid} ako postoji (nastavak nad
// već očišćenim stanjem ništa ne upisuje).
async function obrisiPrivatneResurse(db, uid, rokDo) {
  for (const kolekcija of PRIVATNE_KOLEKCIJE) {
    await obradiPoUid(db, kolekcija, uid, rokDo, (paket, ref) => paket.delete(ref));
  }
  const snimakNaloga = await uRoku(rokDo, () => db.collection(KOLEKCIJE.loyaltyAccounts).doc(uid).get());
  if (snimakNaloga.exists) {
    await uRoku(rokDo, () => {
      const paket = db.batch();
      paket.delete(snimakNaloga.ref);
      return paket.commit();
    });
  }
}

// K5 (§23.3, AC-11): purchases i loyaltyLedger korisnika ostaju; mijenja se samo polje uid → null.
async function pseudonimizuj(db, uid, rokDo) {
  for (const kolekcija of ISTORIJSKE_KOLEKCIJE) {
    await obradiPoUid(db, kolekcija, uid, rokDo, (paket, ref) => paket.update(ref, { uid: null }));
  }
}

// K4b (ODLUKE §6 (a)): users/{uid} je POSLJEDNJI Firestore dokument, pa init (i02/P-2) do kraja cleanup-a vraća 409.
function obrisiKorisnika(db, uid, rokDo) {
  return uRoku(rokDo, () => {
    const refKorisnik = db.collection(KOLEKCIJE.users).doc(uid);
    return db.runTransaction(
      async (tx) => {
        const snimak = await tx.get(refKorisnik);
        if (!snimak.exists) {
          return;
        }
        provjeriBlokaduMutacija(snimak);
        tx.delete(refKorisnik);
      },
      { maxAttempts: MAKSIMALNO_POKUSAJA },
    );
  });
}

// K6 (§23.1 (6)): Firebase Auth nalog se briše POSLJEDNJI. Nalog koji više ne postoji (paralelan DELETE) je već obrisan.
async function obrisiAuthNalog(auth, uid, rokDo) {
  const preostaloMs = rokDo - Date.now();
  if (!(preostaloMs > 0)) {
    throw new GreskaApi('SERVICE_UNAVAILABLE');
  }
  try {
    await saRokom(auth.deleteUser(uid), preostaloMs);
  } catch (greska) {
    if (greska?.code === 'auth/user-not-found') {
      return;
    }
    if (klasifikujGreskuAuth(greska) === 'SERVICE_UNAVAILABLE') {
      throw new GreskaApi('SERVICE_UNAVAILABLE');
    }
    throw greska;
  }
}

// §23, §23.1 … §23.4 (API-07), O-32, O-34b, O-36: brisanje naloga kao niz idempotentnih koraka K1 → K3 → K4a → K5 → K4b → K6. Tok nije
// jedna transakcija; svaki korak je konzistentan sam za sebe, a ponovljen DELETE uvijek izvršava cijeli tok od K1 (nad već očišćenim
// stanjem korak ništa ne upisuje). users ne postoji (NOT_INITIALIZED ili pad između K4b i K6) → preostali koraci, pa Auth (O-34b).
// rokDo je kraj roka cijelog zahtjeva (res.locals.rokDo); istek → 503, stanje konzistentno, nastavak bezbjedan.
export async function obrisiNalog(db, auth, { uid }, rokDo) {
  await postaviBrisanjeUToku(db, uid, rokDo);
  await zatvoriAktivneVaucere(db, uid, rokDo);
  await obrisiPrivatneResurse(db, uid, rokDo);
  await pseudonimizuj(db, uid, rokDo);
  await obrisiKorisnika(db, uid, rokDo);
  await obrisiAuthNalog(auth, uid, rokDo);
}
