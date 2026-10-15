import express from 'express';
import { centralniRukovalacGreskama, nepoznataRuta } from './greske/obradaGresaka.js';
import { korelacija } from './posrednici/korelacija.js';

// Fabrika Express aplikacije bez listen-a (§26: base path /api/v1).
// opcije.dodajRute služi samo testovima; ulazna tačka je ne prosljeđuje.
export function napraviAplikaciju(opcije = {}) {
  const aplikacija = express();
  aplikacija.disable('x-powered-by');

  aplikacija.use(korelacija);
  aplikacija.use(express.json());

  const ruterApi = express.Router();
  if (typeof opcije.dodajRute === 'function') {
    opcije.dodajRute(ruterApi);
  }
  aplikacija.use('/api/v1', ruterApi);

  aplikacija.use(nepoznataRuta);
  aplikacija.use(centralniRukovalacGreskama);
  return aplikacija;
}
