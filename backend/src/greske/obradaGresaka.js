import { zabiljeziGresku } from '../dnevnik.js';
import { GreskaApi } from './GreskaApi.js';
import { KATALOG_GRESAKA } from './katalogGresaka.js';

// Svaki zahtjev koji nijedna ruta nije obradila (nepoznata putanja ili nepodržan metod).
export function nepoznataRuta(req, res, next) {
  next(new GreskaApi('NOT_FOUND'));
}

// Greške JSON parsera se klasifikuju na izvoru (aplikacija.js → parsirajJson);
// ovdje je sve što nije GreskaApi INTERNAL_ERROR.
function odrediKod(err) {
  if (err instanceof GreskaApi) {
    return err.kod;
  }
  return 'INTERNAL_ERROR';
}

// Centralni rukovalac: tijelo tačno po §27, poruka uvijek iz kataloga, bez stack trace-a.
export function centralniRukovalacGreskama(err, req, res, next) {
  if (res.headersSent) {
    next(err);
    return;
  }
  const stavka = KATALOG_GRESAKA[odrediKod(err)];
  const correlationId = res.locals.correlationId;
  zabiljeziGresku({
    correlationId,
    code: stavka.kod,
    status: stavka.http,
    metod: req.method,
    putanja: req.path,
    stack: stavka.http >= 500 ? String(err?.stack ?? err) : undefined,
  });
  res.status(stavka.http).json({
    error: { code: stavka.kod, message: stavka.poruka, correlationId },
  });
}
