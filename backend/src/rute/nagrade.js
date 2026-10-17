import { napraviProvjeruTokena } from '../posrednici/autentikacija.js';
import { izdajNagradu } from '../servisi/izdavanjeNagrade.js';
import { provjeriRewardId, provjeriTijeloIzdavanja } from '../validacija/zahtjevIzdavanja.js';

// §26 API-03 POST /api/v1/rewards/{rewardId}/issue. Posrednik se veže samo na ovu rutu, ne na prefiks /rewards.
// UID dolazi ISKLJUČIVO iz verifikovanog token-a (res.locals.uid), nikad iz tijela, query-ja ni drugih zaglavlja.
// Validacija tijela i formata rewardId prethodi transakciji, pa i provjeri idempotentnosti (i03/P-6).
// Odgovor (i04/P-1): 201 za novi voucher, 200 za retry istog (uid, requestId) i istog rewardId.
export function dodajRuteNagrada(ruter, { servisi }) {
  ruter.post('/rewards/:rewardId/issue', napraviProvjeruTokena(servisi?.auth), async (req, res) => {
    const { requestId } = provjeriTijeloIzdavanja(req.body);
    const rewardId = provjeriRewardId(req.params.rewardId);
    const { kreirano, odgovor } = await izdajNagradu(servisi.db, { uid: res.locals.uid, rewardId, requestId }, res.locals.rokDo);
    res.status(kreirano ? 201 : 200).json(odgovor);
  });
}
