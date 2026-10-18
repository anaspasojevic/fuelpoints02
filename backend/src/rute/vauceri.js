import { napraviProvjeruTokena } from '../posrednici/autentikacija.js';
import { otkaziVaucer } from '../servisi/otkazivanjeVaucera.js';
import { provjeriPraznoTijelo, provjeriVoucherId } from '../validacija/zahtjevVaucera.js';

// §26 API-05 POST /api/v1/vouchers/{voucherId}/cancel. Posrednik se veže samo na rutu, ne na prefiks /vouchers.
// UID dolazi ISKLJUČIVO iz verifikovanog token-a (res.locals.uid), nikad iz tijela, query-ja ni drugih zaglavlja.
// Redoslijed (i05/P-4, kao API-03): token → tijelo (O-21) → format voucherId-a (O-22) → transakcija; validacija prethodi bazi.
// Odgovor (i05/P-1): 200 i za prvi i za ponovljen cancel, tijelo iz sačuvanog stanja voucher-a.
export function dodajRuteVaucera(ruter, { servisi }) {
  ruter.post('/vouchers/:voucherId/cancel', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    provjeriPraznoTijelo(req.body, req.headers);
    const voucherId = provjeriVoucherId(req.params.voucherId);
    const odgovor = await otkaziVaucer(servisi.db, { uid: res.locals.uid, voucherId }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });
}
