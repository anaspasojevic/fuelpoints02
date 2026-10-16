import { GreskaApi } from '../greske/GreskaApi.js';
import { klasifikujGreskuAuth, saRokom } from '../greske/greskeServisa.js';
import { ROK_ZAVISNOG_SERVISA_MS } from '../konfiguracija/konfiguracija.js';

// Šema je case-insensitive (i02/P-7); tačno jedan razmak i token bez whitespace-a.
const BEARER = /^Bearer (\S+)$/i;

// Posrednik za zaštićene Android endpointe (§3.3, NFR-01): Firebase ID token se verifikuje Admin SDK-om
// sa provjerom opoziva, a UID se uzima ISKLJUČIVO iz verifikovanog token-a (res.locals.uid).
// Token se ne upisuje nigdje (req, res.locals, log, odgovor); originalna greška SDK-a se ne prosljeđuje.
export function napraviProvjeruTokena(auth) {
  return async function provjeraTokena(req, res, next) {
    const zaglavlje = req.get('authorization');
    const poklapanje = typeof zaglavlje === 'string' ? BEARER.exec(zaglavlje) : null;
    if (poklapanje === null) {
      throw new GreskaApi('UNAUTHENTICATED');
    }
    let dekodiran;
    try {
      dekodiran = await saRokom(auth.verifyIdToken(poklapanje[1], true), ROK_ZAVISNOG_SERVISA_MS);
    } catch (greska) {
      throw new GreskaApi(klasifikujGreskuAuth(greska));
    }
    res.locals.uid = dekodiran.uid;
    next();
  };
}
