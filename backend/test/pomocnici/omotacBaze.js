// Omotač oko pravog Firestore db za testove kupovine (plan i03, 8 „Pomoćnici”). Ide kroz isti parametar servisi
// kao produkcioni db; src/ nema nikakvo grananje za testove. Bez opcija omotač samo delegira i broji.
//
// Opcije:
// - baciNaUpisu: n          → n-ti upis u transakciji (create/set/update/delete) baca grešku sa internim detaljima;
// - baciPrijeCommita        → callback se izvrši do kraja, pa omotač baci grešku (commit se ne dešava);
// - sakrijPostojece: [put]  → tx.get/tx.getAll za te putanje vraćaju snimak „ne postoji” (zastarjelo čitanje);
// - zadrziPrijeCommitaMs    → callback se izvrši, pa omotač čeka prije commit-a (commitZavrsen je promise kraja transakcije);
// - odbijTransakcijuSa      → runTransaction odmah odbija sa greškom koja nosi ta polja (npr. { code: 14 }).
import { setTimeout as pauza } from 'node:timers/promises';

const METODE_UPISA = ['create', 'set', 'update', 'delete'];

// Snimak dokumenta koji tvrdi da dokument ne postoji.
function lazanSnimakBezDokumenta(ref) {
  return { exists: false, ref, id: ref.id, data: () => undefined, get: () => undefined };
}

export function omotacBaze(
  db,
  { baciNaUpisu, baciPrijeCommita = false, sakrijPostojece = [], zadrziPrijeCommitaMs, odbijTransakcijuSa } = {},
) {
  let brojPristupa = 0;
  let brojTransakcija = 0;
  let brojUpisa = 0;
  const upisi = [];
  let commitZavrsen = Promise.resolve();

  function sakrij(snimak) {
    return sakrijPostojece.includes(snimak.ref.path) ? lazanSnimakBezDokumenta(snimak.ref) : snimak;
  }

  function posrednikTransakcije(tx) {
    return new Proxy(tx, {
      get(cilj, svojstvo) {
        const vrijednost = Reflect.get(cilj, svojstvo, cilj);
        if (svojstvo === 'get') {
          return async (...argumenti) => {
            const rezultat = await vrijednost.apply(cilj, argumenti);
            return rezultat && rezultat.ref !== undefined ? sakrij(rezultat) : rezultat;
          };
        }
        if (svojstvo === 'getAll') {
          return async (...argumenti) => (await vrijednost.apply(cilj, argumenti)).map(sakrij);
        }
        if (METODE_UPISA.includes(svojstvo)) {
          return (ref, ...ostalo) => {
            brojUpisa += 1;
            upisi.push({ metod: svojstvo, putanja: ref.path });
            if (brojUpisa === baciNaUpisu) {
              throw new Error('ubrizgana greška C:\\tajno\\x.js');
            }
            return vrijednost.call(cilj, ref, ...ostalo);
          };
        }
        return typeof vrijednost === 'function' ? vrijednost.bind(cilj) : vrijednost;
      },
    });
  }

  return {
    collection(...argumenti) {
      brojPristupa += 1;
      return db.collection(...argumenti);
    },
    doc(...argumenti) {
      brojPristupa += 1;
      return db.doc(...argumenti);
    },
    getAll(...argumenti) {
      brojPristupa += 1;
      return db.getAll(...argumenti);
    },
    runTransaction(funkcija, opcije) {
      brojPristupa += 1;
      brojTransakcija += 1;
      if (odbijTransakcijuSa !== undefined) {
        return Promise.reject(Object.assign(new Error('ubrizgana nedostupnost C:\\tajno\\x.js'), odbijTransakcijuSa));
      }
      const transakcija = db.runTransaction(async (tx) => {
        const rezultat = await funkcija(posrednikTransakcije(tx));
        if (baciPrijeCommita) {
          throw new Error('ubrizgana greška prije commit-a C:\\tajno\\x.js');
        }
        if (zadrziPrijeCommitaMs !== undefined) {
          await pauza(zadrziPrijeCommitaMs);
        }
        return rezultat;
      }, opcije);
      commitZavrsen = transakcija.then(
        () => undefined,
        () => undefined,
      );
      return transakcija;
    },
    get brojPristupa() {
      return brojPristupa;
    },
    get brojTransakcija() {
      return brojTransakcija;
    },
    get brojUpisa() {
      return brojUpisa;
    },
    get upisi() {
      return upisi.slice();
    },
    get commitZavrsen() {
      return commitZavrsen;
    },
  };
}
