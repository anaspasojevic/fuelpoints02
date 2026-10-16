import { napraviProvjeruTokena } from '../posrednici/autentikacija.js';
import { inicijalizujNalog } from '../servisi/inicijalizacijaNaloga.js';
import { provjeriTijeloInita } from '../validacija/tijeloInita.js';

// §26 API-01 POST /api/v1/account/init. Posrednik se veže samo na ovu rutu, ne na prefiks /account.
// Odgovor (i02/P-1): 201 kad je kreiran bar jedan dokument, 200 za ponovljeni init.
export function dodajRuteNaloga(ruter, { servisi, verzijaUslova }) {
  ruter.post('/account/init', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    const ulaz = provjeriTijeloInita(req.body, verzijaUslova);
    const { kreirano, stanje } = await inicijalizujNalog(servisi.db, { uid: res.locals.uid, ...ulaz }, res.locals.rokDo);
    res.status(kreirano ? 201 : 200).json(stanje);
  });
}
