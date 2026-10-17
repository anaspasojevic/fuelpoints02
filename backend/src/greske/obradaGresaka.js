import { zabiljeziGresku } from '../dnevnik.js';
import { KOLEKCIJE } from '../podaci/kolekcije.js';
import { GreskaApi } from './GreskaApi.js';
import { KATALOG_GRESAKA } from './katalogGresaka.js';

// Svaki zahtjev koji nijedna ruta nije obradila (nepoznata putanja ili nepodržan metod).
export function nepoznataRuta(req, res, next) {
  next(new GreskaApi('NOT_FOUND'));
}

// Greške JSON parsera se klasifikuju na izvoru (aplikacija.js → parsirajJson);
// ovdje je sve što nije GreskaApi INTERNAL_ERROR, osim D-5.
// D-5 (i04/P-8): Express 5 baca URIError sa status 400 kad parametar putanje nije ispravno percent-kodiran, prije bilo koje rute.
// Zahtjev ne pogađa nijednu rutu → NOT_FOUND (O-1); kao 4xx bez stack-a, pa poruka sa sirovom vrijednošću ne ide u log.
function odrediKod(err) {
  if (err instanceof GreskaApi) {
    return err.kod;
  }
  if (err instanceof URIError && err.status === 400) {
    return 'NOT_FOUND';
  }
  return 'INTERNAL_ERROR';
}

// Log nikad ne bilježi sirovu putanju zahtjeva: klijent može u nju staviti tajnu (§3.4, NFR-07; i03 FIX LOOP 1, R-04).
// Za pogođenu rutu bilježi se njen šablon relativan na ruter /api/v1 (npr. "/pos/purchases"); inače fiksna vrijednost.
function putanjaZaLog(req) {
  return typeof req.route?.path === 'string' ? req.route.path : '(nepoznata ruta)';
}

// O-18 (i04 FIX LOOP 1, R-04): putanja dokumenta u poruci Firestore greške (npr. "path=/rewardRequests/<requestKey>",
// "documents/…", "/loyaltyLedger/release_<voucherId>") može nositi requestKey ili voucherId, pa se u logu rediguje.
const PUTANJA_DOKUMENTA = new RegExp(
  [
    String.raw`path=[^\s\]}),]*`,
    String.raw`documents/[^\s\]}),]*`,
    String.raw`\b(?:${Object.values(KOLEKCIJE).join('|')})/[^\s\]}),]*`,
  ].join('|'),
  'g',
);

function redigujPutanje(tekst) {
  return tekst.replace(PUTANJA_DOKUMENTA, '[putanja dokumenta]');
}

// Opis neočekivane (5xx) greške za log: name, numerički code (gRPC, npr. 6 za ALREADY_EXISTS), poruka sa redigovanim
// putanjama dokumenata i okviri stack-a ("at …"). Ostali redovi stack-a se ne bilježe (u njima se ponavlja poruka).
function opisNeocekivaneGreske(err) {
  if (!(err instanceof Error)) {
    return redigujPutanje(String(err));
  }
  const kod = Number.isInteger(err.code) ? ` (code ${err.code})` : '';
  const okviri = String(err.stack ?? '')
    .split('\n')
    .filter((linija) => /^\s+at /.test(linija));
  return [`${err.name}${kod}: ${redigujPutanje(String(err.message))}`, ...okviri.map(redigujPutanje)].join('\n');
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
    putanja: putanjaZaLog(req),
    stack: stavka.http >= 500 ? opisNeocekivaneGreske(err) : undefined,
  });
  res.status(stavka.http).json({
    error: { code: stavka.kod, message: stavka.poruka, correlationId },
  });
}
