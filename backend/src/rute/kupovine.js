import { napraviProvjeruPosKljuca } from '../posrednici/posAutentikacija.js';
import { evidentirajKupovinu } from '../servisi/evidencijaKupovine.js';
import { provjeriTijeloKupovine } from '../validacija/tijeloKupovine.js';

// §26 API-02 POST /api/v1/pos/purchases. POS posrednik se veže samo na ovu rutu, ne na prefiks /pos.
// stationId dolazi ISKLJUČIVO iz posrednika (res.locals.stationId), nikad iz tijela, query-ja ni drugih zaglavlja.
// Odgovor (i03/P-1): 201 za prvi zahtjev, 200 za retry istog (stationId, posTransactionId) sa istim payload-om.
export function dodajRuteKupovina(ruter, { servisi, posStanice }) {
  ruter.post('/pos/purchases', napraviProvjeruPosKljuca(posStanice), async (req, res) => {
    const ulaz = provjeriTijeloKupovine(req.body, Date.now());
    const { kreirano, odgovor } = await evidentirajKupovinu(
      servisi.db,
      { stationId: res.locals.stationId, ...ulaz },
      res.locals.rokDo,
    );
    res.status(kreirano ? 201 : 200).json(odgovor);
  });
}
