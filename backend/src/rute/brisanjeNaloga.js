import { napraviProvjeruTokena } from '../posrednici/autentikacija.js';
import { provjeriSvjezinuPrijave } from '../posrednici/svjezinaPrijave.js';
import { obrisiNalog } from '../servisi/brisanjeNaloga.js';
import { provjeriPraznoTijelo } from '../validacija/zahtjevVaucera.js';

// §26 API-07 DELETE /api/v1/account. Posrednik se veže samo na ovu rutu i metod, ne na prefiks /account.
// UID dolazi ISKLJUČIVO iz verifikovanog token-a (res.locals.uid). Redoslijed (O-35): token → tijelo (O-21) → recent auth (§23) → tok.
// Odgovor (O-33): 204 bez tijela, i za nastavljeno brisanje (§23.4).
export function dodajRuteBrisanja(ruter, { servisi }) {
  ruter.delete('/account', napraviProvjeruTokena(servisi?.auth, { izloziAuthTime: true }), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    provjeriSvjezinuPrijave(res.locals.authTime);
    await obrisiNalog(servisi.db, servisi.auth, { uid: res.locals.uid }, res.locals.rokDo);
    res.status(204).end();
  });
}
