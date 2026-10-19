// Omotač oko pravog Admin SDK auth za testove brisanja naloga (plan i07, i07/P-7). Ide kroz isti parametar servisi kao produkcioni
// auth; src/ nema nikakvo grananje za testove. Bez opcija omotač samo delegira i broji.
//
// Opcije:
// - dnevnik: niz        → svako brisanje dodaje { metod: 'deleteUser' } (zajednički niz sa omotacBaze, za redoslijed);
// - baciNaBrisanju      → deleteUser NE briše nalog i baca grešku: true → greška sa internim detaljima; objekat → greška sa tim
//                         poljima (npr. { code: 'app/network-error' }).
// brisanja broji pozive deleteUser (i neuspjele); verifikacije broji pozive verifyIdToken.
export function omotacAutha(auth, { dnevnik, baciNaBrisanju } = {}) {
  let brisanja = 0;
  let verifikacije = 0;
  return {
    verifyIdToken(...argumenti) {
      verifikacije += 1;
      return auth.verifyIdToken(...argumenti);
    },
    getUser(...argumenti) {
      return auth.getUser(...argumenti);
    },
    async deleteUser(uid) {
      brisanja += 1;
      dnevnik?.push({ metod: 'deleteUser' });
      if (baciNaBrisanju === true) {
        throw new Error('ubrizgana greška Auth-a C:\\tajno\\x.js');
      }
      if (baciNaBrisanju !== undefined) {
        throw Object.assign(new Error('ubrizgana nedostupnost Auth-a C:\\tajno\\x.js'), baciNaBrisanju);
      }
      return auth.deleteUser(uid);
    },
    get brisanja() {
      return brisanja;
    },
    get verifikacije() {
      return verifikacije;
    },
  };
}
