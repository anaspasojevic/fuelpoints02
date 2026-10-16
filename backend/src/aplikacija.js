import express from 'express';
import { GreskaApi } from './greske/GreskaApi.js';
import { centralniRukovalacGreskama, nepoznataRuta } from './greske/obradaGresaka.js';
import { korelacija } from './posrednici/korelacija.js';
import { dodajRuteNaloga } from './rute/nalog.js';

const parserJson = express.json();

// Greška JSON parsera sa statusom 400–499 (neispravan JSON, preveliko ili oštećeno komprimovano tijelo)
// → INVALID_REQUEST (odluka P-4, O-1), bez obzira na err.type. Greška parsera sa 5xx ide dalje kao INTERNAL_ERROR.
function parsirajJson(req, res, next) {
  parserJson(req, res, (err) => {
    const status = err?.status ?? err?.statusCode;
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      next(new GreskaApi('INVALID_REQUEST'));
      return;
    }
    next(err);
  });
}

// Fabrika Express aplikacije bez listen-a (§26: base path /api/v1).
// opcije.servisi ({ db, auth } iz inicijalizujFirebaseAdmin) i opcije.verzijaUslova (AUTH-10) koristi API-01.
// opcije.dodajRute služi samo testovima; ulazna tačka je ne prosljeđuje.
export function napraviAplikaciju(opcije = {}) {
  const aplikacija = express();
  aplikacija.disable('x-powered-by');

  aplikacija.use(korelacija);
  aplikacija.use(parsirajJson);

  const ruterApi = express.Router();
  dodajRuteNaloga(ruterApi, { servisi: opcije.servisi, verzijaUslova: opcije.verzijaUslova });
  if (typeof opcije.dodajRute === 'function') {
    opcije.dodajRute(ruterApi);
  }
  aplikacija.use('/api/v1', ruterApi);

  aplikacija.use(nepoznataRuta);
  aplikacija.use(centralniRukovalacGreskama);
  return aplikacija;
}
