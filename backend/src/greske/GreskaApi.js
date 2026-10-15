import { KATALOG_GRESAKA } from './katalogGresaka.js';

// Greška koja nosi samo kod iz kataloga (§27 + O-1). Status i poruka za klijenta
// uvijek dolaze iz kataloga, nikad iz mjesta gdje je greška nastala.
export class GreskaApi extends Error {
  constructor(kod) {
    if (!Object.hasOwn(KATALOG_GRESAKA, kod)) {
      throw new TypeError(`Nepoznat kod greške: ${kod}`);
    }
    super(kod);
    this.name = 'GreskaApi';
    this.kod = kod;
  }
}
