// Omotač oko pravog Firestore db za testove kupovine (plan i03, 8 „Pomoćnici”). Ide kroz isti parametar servisi
// kao produkcioni db; src/ nema nikakvo grananje za testove. Bez opcija omotač samo delegira i broji.
//
// Opcije:
// - baciNaUpisu: n          → n-ti upis u transakciji (create/set/update/delete) baca grešku sa internim detaljima;
// - baciPrijeCommita        → callback se izvrši do kraja, pa omotač baci grešku (commit se ne dešava);
// - sakrijPostojece: [put]  → tx.get/tx.getAll za te putanje vraćaju snimak „ne postoji” (zastarjelo čitanje);
//                             za tx.get(query) (i04/P-11) ti dokumenti se izostavljaju iz rezultata upita;
// - zadrziPrijeCommitaMs    → callback se izvrši, pa omotač čeka prije commit-a (commitZavrsen je promise kraja transakcije);
// - odbijTransakcijuSa      → runTransaction odmah odbija sa greškom koja nosi ta polja (npr. { code: 14 });
// - prijeCommita            → callback se izvrši, pa omotač sačeka prijeCommita(pokusaj) prije commit-a (pokusaj od 1);
// - prisiliPonovniPokusaj: n → prvih n pokušaja: callback se izvrši, pa omotač baci ABORTED (code 10), pa SDK ponavlja callback.
// - prijePokusaja          → omotač sačeka prijePokusaja(pokusaj) na POČETKU svakog pokušaja, prije callback-a (i06/P-7; uz
//                            prisiliPonovniPokusaj nameće redoslijed: druga operacija se izvrši između pokušaja 1 i 2).
// - dnevnik: niz             → (i07/P-7) svaki upis (transakcije i paketa) se dodaje i u ovaj niz, koji test može dijeliti sa
//                            omotacAutha, pa niz dokazuje redoslijed Firestore upisa i brisanja Auth naloga.
// batch() (i07/P-7): paket pravog db-a; operacije paketa se broje i bilježe u upisi kao { metod: 'batch.<op>', putanja, paket } i
// baciNaUpisu važi i za njih (greška se baci prije operacije, pa se paket ne commit-uje); paketi: [{ paket, brojOperacija, commitovan }].
// Servisi i01–i06 ne koriste pakete, pa je za njih ponašanje omotača bez opcija identično i06.
// brojPokusaja broji pozive callback-a (svih transakcija omotača).
// sveTransakcijeZavrsene čeka kraj SVIH pokrenutih transakcija, i onih čiji je zahtjev već dobio 503 (kasni commit).
import { setTimeout as pauza } from 'node:timers/promises';

const METODE_UPISA = ['create', 'set', 'update', 'delete'];

// Snimak dokumenta koji tvrdi da dokument ne postoji.
function lazanSnimakBezDokumenta(ref) {
  return { exists: false, ref, id: ref.id, data: () => undefined, get: () => undefined };
}

export function omotacBaze(
  db,
  {
    baciNaUpisu,
    baciPrijeCommita = false,
    sakrijPostojece = [],
    zadrziPrijeCommitaMs,
    odbijTransakcijuSa,
    prijeCommita,
    prisiliPonovniPokusaj = 0,
    prijePokusaja,
    dnevnik,
  } = {},
) {
  let brojPristupa = 0;
  let brojPokusaja = 0;
  let brojTransakcija = 0;
  let brojUpisa = 0;
  const upisi = [];
  const paketi = [];
  let commitZavrsen = Promise.resolve();
  const zavrseneTransakcije = [];

  function sakrij(snimak) {
    return sakrijPostojece.includes(snimak.ref.path) ? lazanSnimakBezDokumenta(snimak.ref) : snimak;
  }

  // Rezultat upita (QuerySnapshot nema ref, ima niz docs) bez dokumenata čija je putanja u sakrijPostojece.
  function sakrijIzUpita(rezultat) {
    if (sakrijPostojece.length === 0) {
      return rezultat;
    }
    const docs = rezultat.docs.filter((dokument) => !sakrijPostojece.includes(dokument.ref.path));
    return {
      docs,
      size: docs.length,
      empty: docs.length === 0,
      query: rezultat.query,
      forEach: (funkcija, ovo) => docs.forEach(funkcija, ovo),
    };
  }

  function zabiljeziUpis(upis) {
    brojUpisa += 1;
    upisi.push(upis);
    dnevnik?.push(upis);
    if (brojUpisa === baciNaUpisu) {
      throw new Error('ubrizgana greška C:\\tajno\\x.js');
    }
  }

  function posrednikPaketa(paket) {
    const stavka = { paket: paketi.length + 1, brojOperacija: 0, commitovan: false };
    paketi.push(stavka);
    const posrednik = new Proxy(paket, {
      get(cilj, svojstvo) {
        const vrijednost = Reflect.get(cilj, svojstvo, cilj);
        if (METODE_UPISA.includes(svojstvo)) {
          return (ref, ...ostalo) => {
            zabiljeziUpis({ metod: `batch.${svojstvo}`, putanja: ref.path, paket: stavka.paket });
            stavka.brojOperacija += 1;
            vrijednost.call(cilj, ref, ...ostalo);
            return posrednik;
          };
        }
        if (svojstvo === 'commit') {
          return async (...argumenti) => {
            const rezultat = await vrijednost.apply(cilj, argumenti);
            stavka.commitovan = true;
            return rezultat;
          };
        }
        return typeof vrijednost === 'function' ? vrijednost.bind(cilj) : vrijednost;
      },
    });
    return posrednik;
  }

  function posrednikTransakcije(tx) {
    return new Proxy(tx, {
      get(cilj, svojstvo) {
        const vrijednost = Reflect.get(cilj, svojstvo, cilj);
        if (svojstvo === 'get') {
          return async (...argumenti) => {
            const rezultat = await vrijednost.apply(cilj, argumenti);
            if (rezultat && rezultat.ref === undefined && Array.isArray(rezultat.docs)) {
              return sakrijIzUpita(rezultat);
            }
            return rezultat && rezultat.ref !== undefined ? sakrij(rezultat) : rezultat;
          };
        }
        if (svojstvo === 'getAll') {
          return async (...argumenti) => (await vrijednost.apply(cilj, argumenti)).map(sakrij);
        }
        if (METODE_UPISA.includes(svojstvo)) {
          return (ref, ...ostalo) => {
            zabiljeziUpis({ metod: svojstvo, putanja: ref.path });
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
    batch() {
      brojPristupa += 1;
      return posrednikPaketa(db.batch());
    },
    runTransaction(funkcija, opcije) {
      brojPristupa += 1;
      brojTransakcija += 1;
      if (odbijTransakcijuSa !== undefined) {
        return Promise.reject(Object.assign(new Error('ubrizgana nedostupnost C:\\tajno\\x.js'), odbijTransakcijuSa));
      }
      let pokusajTransakcije = 0;
      const transakcija = db.runTransaction(async (tx) => {
        brojPokusaja += 1;
        pokusajTransakcije += 1;
        if (prijePokusaja !== undefined) {
          await prijePokusaja(pokusajTransakcije);
        }
        const rezultat = await funkcija(posrednikTransakcije(tx));
        if (pokusajTransakcije <= prisiliPonovniPokusaj) {
          throw Object.assign(new Error('ubrizgan ABORTED'), { code: 10 });
        }
        if (prijeCommita !== undefined) {
          await prijeCommita(pokusajTransakcije);
        }
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
      zavrseneTransakcije.push(commitZavrsen);
      return transakcija;
    },
    get brojPristupa() {
      return brojPristupa;
    },
    get brojPokusaja() {
      return brojPokusaja;
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
    get paketi() {
      return paketi.map((stavka) => ({ ...stavka }));
    },
    get commitZavrsen() {
      return commitZavrsen;
    },
    get sveTransakcijeZavrsene() {
      return Promise.all(zavrseneTransakcije);
    },
  };
}
