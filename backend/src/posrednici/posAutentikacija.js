import crypto from 'node:crypto';
import { GreskaApi } from '../greske/GreskaApi.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../konfiguracija/konfiguracija.js';

// Posrednik za POS endpoint-e (§3.4, NFR-02): ključ se čita ISKLJUČIVO iz zaglavlja X-POS-API-Key (naziv je
// case-insensitive po HTTP-u), a stationId se uzima ISKLJUČIVO iz mape u konfiguraciji (res.locals.stationId).
// posStanice je zamrznut niz { stationId, otisakKljuca } (SHA-256 ključa, i03/P-3).
// Poređenje u konstantnom vremenu: SHA-256 otisci fiksne dužine, crypto.timingSafeEqual, petlja uvijek kroz SVE stanice
// bez ranog izlaska, odluka tek poslije petlje. Nedostajući i prazan ključ prolaze istu petlju.
// Ključ se ne upisuje nigdje (req, res.locals, log, odgovor, poruka greške).
// Rok cijelog POS zahtjeva (i02 R-02) počinje ovdje i prenosi se kroz res.locals.rokDo.
export function napraviProvjeruPosKljuca(posStanice) {
  return function provjeraPosKljuca(req, res, next) {
    res.locals.rokDo = Date.now() + ROK_ZAVISNOG_SERVISA_MS;
    // i03/P-11: bez POS konfiguracije ruta odbija sve (fail closed) kao INTERNAL_ERROR, ne kao klijentsku grešku.
    if (!Array.isArray(posStanice) || posStanice.length === 0) {
      throw new Error('POS konfiguracija nije proslijeđena.');
    }
    const vrijednost = req.get('x-pos-api-key');
    const kandidat = typeof vrijednost === 'string' ? vrijednost : '';
    const otisak = crypto.createHash('sha256').update(kandidat, 'utf8').digest();
    let pronadjena = null;
    for (const stanica of posStanice) {
      const jednako = crypto.timingSafeEqual(otisak, stanica.otisakKljuca);
      if (jednako && pronadjena === null) {
        pronadjena = stanica.stationId;
      }
    }
    if (kandidat === '' || pronadjena === null) {
      throw new GreskaApi('UNAUTHENTICATED_POS');
    }
    res.locals.stationId = pronadjena;
    next();
  };
}
