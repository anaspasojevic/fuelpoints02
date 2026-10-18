import { napraviProvjeruTokena } from '../posrednici/autentikacija.js';
import { otkaziVaucer } from '../servisi/otkazivanjeVaucera.js';
import { uskladiVaucere } from '../servisi/uskladjivanjeVaucera.js';
import { provjeriPraznoTijelo, provjeriVoucherId } from '../validacija/zahtjevVaucera.js';

// §26 API-05 POST /api/v1/vouchers/{voucherId}/cancel i API-06 POST /api/v1/account/vouchers/reconcile.
// Posrednik se veže samo na ove rute, ne na prefikse /vouchers ni /account.
// UID dolazi ISKLJUČIVO iz verifikovanog token-a (res.locals.uid), nikad iz tijela, query-ja ni drugih zaglavlja.
// Redoslijed (i05/P-4, kao API-03): token → tijelo (O-21) → format voucherId-a (O-22) → transakcija; validacija prethodi bazi.
export function dodajRuteVaucera(ruter, { servisi }) {
  // Odgovor (i05/P-1): 200 i za prvi i za ponovljen cancel, tijelo iz sačuvanog stanja voucher-a.
  ruter.post('/vouchers/:voucherId/cancel', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    const voucherId = provjeriVoucherId(req.params.voucherId);
    const odgovor = await otkaziVaucer(servisi.db, { uid: res.locals.uid, voucherId }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });

  // Odgovor (i05/P-1): 200 { reconciledCount }.
  ruter.post('/account/vouchers/reconcile', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    const odgovor = await uskladiVaucere(servisi.db, { uid: res.locals.uid }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });
}
