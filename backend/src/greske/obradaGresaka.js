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

// O-18 (i04 FIX LOOP 1, R-04): putanja dokumenta u poruci ne-gRPC greške (npr. "path=/rewardRequests/<requestKey>",
// "documents/…", "/loyaltyLedger/release_<voucherId>") može nositi requestKey ili voucherId, pa se u logu rediguje.
const PUTANJA_DOKUMENTA = new RegExp(
  [
    String.raw`path=[^\s\]}),]*`,
    String.raw`documents/[^\s\]}),]*`,
    String.raw`\b(?:${Object.values(KOLEKCIJE).join('|')})/[^\s\]}),]*`,
  ].join('|'),
  'g',
);

// i04 FIX LOOP 2 (R-05, N-10): requestKey i voucherId su 64 hex znaka; svaki niz od ≥ 32 uzastopna hex znaka se rediguje
// i bez kolekcije ispred (goli hex, release_<hex>, bačen string). Heuristika samo za poruke ne-gRPC grešaka.
const HEX_NIZ = /[0-9a-fA-F]{32,}/g;

function redigujPutanje(tekst) {
  return tekst.replace(PUTANJA_DOKUMENTA, '[putanja dokumenta]');
}

function rediguj(tekst) {
  return redigujPutanje(tekst).replace(HEX_NIZ, '[hex]');
}

// Imena gRPC statusa po numeričkom code (0 … 16), za dijagnostiku bez poruke.
const GRPC_STATUSI = [
  'OK',
  'CANCELLED',
  'UNKNOWN',
  'INVALID_ARGUMENT',
  'DEADLINE_EXCEEDED',
  'NOT_FOUND',
  'ALREADY_EXISTS',
  'PERMISSION_DENIED',
  'RESOURCE_EXHAUSTED',
  'FAILED_PRECONDITION',
  'ABORTED',
  'OUT_OF_RANGE',
  'UNIMPLEMENTED',
  'INTERNAL',
  'UNAVAILABLE',
  'DATA_LOSS',
  'UNAUTHENTICATED',
];

// Opis neočekivane (5xx) greške za log, sa okvirima stack-a ("at …"); ostali redovi stack-a se ne bilježe (u njima se ponavlja poruka).
// R-05 (i04 FIX LOOP 2, P-3): greška sa numeričkim gRPC code (Firestore) se bilježi BEZ poruke, jer oblik poruke zavisi od
// emulatora/produkcije i može nositi ID dokumenta (npr. NOT_FOUND: path < Element { name: "<voucherId>" } >):
// name, code i ime statusa (npr. "Error (code 6 ALREADY_EXISTS)"). Ostale greške: poruka sa redigovanim putanjama i hex nizovima.
function opisNeocekivaneGreske(err) {
  if (!(err instanceof Error)) {
    return rediguj(String(err));
  }
  const okviri = String(err.stack ?? '')
    .split('\n')
    .filter((linija) => /^\s+at /.test(linija))
    .map(rediguj);
  const ime = rediguj(String(err.name));
  if (Number.isInteger(err.code)) {
    const status = GRPC_STATUSI[err.code] ?? 'nepoznat status';
    return [`${ime} (code ${err.code} ${status})`, ...okviri].join('\n');
  }
  return [`${ime}: ${rediguj(String(err.message))}`, ...okviri].join('\n');
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
