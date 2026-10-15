import { zabiljeziGresku } from '../dnevnik.js';
import { GreskaApi } from './GreskaApi.js';
import { KATALOG_GRESAKA } from './katalogGresaka.js';

// Svaki zahtjev koji nijedna ruta nije obradila (nepoznata putanja ili nepodržan metod).
export function nepoznataRuta(req, res, next) {
  next(new GreskaApi('NOT_FOUND'));
}

function jeGreskaParsera(err) {
  const status = err?.status ?? err?.statusCode;
  return typeof err?.type === 'string' && Number.isInteger(status) && status >= 400 && status < 500;
}

function odrediKod(err) {
  if (err instanceof GreskaApi) {
    return err.kod;
  }
  // Svaka greška body-parser-a → INVALID_REQUEST (odluka P-4, O-1).
  if (jeGreskaParsera(err)) {
    return 'INVALID_REQUEST';
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
