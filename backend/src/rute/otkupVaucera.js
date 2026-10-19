import { napraviProvjeruPosKljuca } from '../posrednici/posAutentikacija.js';
import { otkupiVaucer } from '../servisi/otkupVaucera.js';
import { provjeriTijeloOtkupa } from '../validacija/zahtjevOtkupa.js';
import { provjeriVoucherId } from '../validacija/zahtjevVaucera.js';

// §26 API-04 POST /api/v1/pos/vouchers/{voucherId}/redeem. POS posrednik se veže samo na ovu rutu, ne na prefiks /pos.
// stationId dolazi ISKLJUČIVO iz posrednika (res.locals.stationId), nikad iz tijela, query-ja ni drugih zaglavlja.
// Redoslijed (plan i06, 5.1): POS ključ → tijelo (§20.1) → format voucherId-a (O-22) → transakcija; validacija prethodi bazi.
// Odgovor (i06/P-6): 200 i za prvi otkup i za retry istog (stationId, redemptionRequestId), tijelo iz sačuvanog stanja voucher-a.
export function dodajRuteOtkupa(ruter, { servisi, posStanice }) {
  ruter.post('/pos/vouchers/:voucherId/redeem', napraviProvjeruPosKljuca(posStanice), async (req, res) => {
    const { redemptionRequestId } = provjeriTijeloOtkupa(req.body);
    const voucherId = provjeriVoucherId(req.params.voucherId);
    const odgovor = await otkupiVaucer(servisi.db, { stationId: res.locals.stationId, voucherId, redemptionRequestId }, res.locals.rokDo);
    res.status(200).json(odgovor);
  });
}
