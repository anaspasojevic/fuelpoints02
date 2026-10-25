// Čista logika POS Simulatora (SRS §2.5, §8.4, §20.1, §3.4): bez pristupa DOM-u i mreži, pa je testira Node (I11-T01, I11-T04),
// a učitava je i stranica. Tijelo zahtjeva sadrži tačno polja koja SRS traži; stationId nikad nije dio tijela (§3.4).

const POS_TRANSACTION_ID = /^[A-Za-z0-9._-]{1,64}$/;
const VOUCHER_ID = /^[0-9a-f]{64}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
// RFC 3339 u UTC: veliko T i Z, 0–3 decimale (i03/P-4).
const OCCURRED_AT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const DECIMALNI_BROJ = /^\d+([.,]\d+)?$/;

// Decimalni unos („42,730” ili „42.73”) → cijeli broj jedinica (cifre = 3 za ml, 2 za cente), zaokruženo na najbližu jedinicu
// (pola naviše). Računa se nad ciframa teksta, bez binarne aritmetike, pa „1.005” daje tačno 101 cent.
function decimalnoUCijele(tekst, cifre) {
  const ociscen = String(tekst ?? '').trim();
  if (!DECIMALNI_BROJ.test(ociscen)) {
    return null;
  }
  const [cijeli, razlomak = ''] = ociscen.replace(',', '.').split('.');
  const osnova = Number(cijeli + razlomak.padEnd(cifre, '0').slice(0, cifre));
  const zaokruzeno = osnova + (razlomak.length > cifre && razlomak[cifre] >= '5' ? 1 : 0);
  return Number.isSafeInteger(zaokruzeno) ? zaokruzeno : null;
}

export function litreUMililitre(tekst) {
  return decimalnoUCijele(tekst, 3);
}

export function euroUCente(tekst) {
  return decimalnoUCijele(tekst, 2);
}

// Jedinstven posTransactionId koji zadovoljava ^[A-Za-z0-9._-]{1,64}$ (§8.2).
export function novaTransakcijaId(sadaMs = Date.now(), nasumicno = Math.random()) {
  const sufiks = Math.floor(nasumicno * 36 ** 6)
    .toString(36)
    .padStart(6, '0');
  return `SIM-${sadaMs.toString(36)}-${sufiks}`.toUpperCase();
}

// Polja forme → tijelo API-02 (tačno 6 polja) ili lista grešaka prikazanih prije slanja.
export function napraviZahtjevKupovine(polja) {
  const greske = [];
  const loyaltyUid = String(polja.loyaltyUid ?? '').trim();
  if (loyaltyUid === '') {
    greske.push('Unesite loyalty UID (sa ekrana „Moj QR”).');
  }
  const posTransactionId = String(polja.posTransactionId ?? '').trim();
  if (!POS_TRANSACTION_ID.test(posTransactionId)) {
    greske.push('POS transaction ID: 1–64 znaka, dozvoljeni su slova, cifre, tačka, donja crta i crtica.');
  }
  const volumeMl = litreUMililitre(polja.litri);
  if (volumeMl === null || volumeMl < 1 || volumeMl > 200_000) {
    greske.push('Količina goriva: broj litara između 0,001 i 200 (npr. 42,730).');
  }
  const amountMinor = euroUCente(polja.iznos);
  if (amountMinor === null || amountMinor > 1_000_000) {
    greske.push('Iznos: broj EUR između 0 i 10000 (npr. 70,50).');
  }
  const occurredAt = String(polja.occurredAt ?? '').trim();
  if (!OCCURRED_AT.test(occurredAt) || Number.isNaN(Date.parse(occurredAt))) {
    greske.push('Vrijeme kupovine: ISO 8601 u UTC sa završnim Z (npr. 2026-10-21T08:30:00Z).');
  }
  if (greske.length > 0) {
    return { greske };
  }
  return {
    putanja: '/api/v1/pos/purchases',
    tijelo: { loyaltyUid, posTransactionId, volumeMl, amountMinor, currency: 'EUR', occurredAt },
  };
}

// voucherId ide samo u putanju (enkodiran); tijelo ima samo redemptionRequestId (§20.1).
export function napraviZahtjevOtkupa(polja) {
  const greske = [];
  const voucherId = String(polja.voucherId ?? '').trim();
  if (!VOUCHER_ID.test(voucherId)) {
    greske.push('Voucher ID: 64 heksadecimalna znaka (mala slova).');
  }
  const redemptionRequestId = String(polja.redemptionRequestId ?? '').trim();
  if (!UUID_V4.test(redemptionRequestId)) {
    greske.push('Redemption request ID: UUID v4 malim slovima.');
  }
  if (greske.length > 0) {
    return { greske };
  }
  return {
    putanja: `/api/v1/pos/vouchers/${encodeURIComponent(voucherId)}/redeem`,
    tijelo: { redemptionRequestId },
  };
}

// Odgovor Backend-a → ono što se prikazuje. Prikazuju se samo status, polja greške iz §27 i tijelo uspjeha;
// stack, zaglavlja i neočekivano tijelo se ne prikazuju.
export function opisiOdgovor(status, tekst) {
  let tijelo;
  try {
    tijelo = JSON.parse(tekst);
  } catch {
    tijelo = undefined;
  }
  const jeObjekat = typeof tijelo === 'object' && tijelo !== null && !Array.isArray(tijelo);
  if (status === 502 && jeObjekat && tijelo.simulator === 'BACKEND_NEDOSTUPAN') {
    return opisiMreznuGresku();
  }
  if (status >= 200 && status < 300 && jeObjekat) {
    return { vrsta: 'uspjeh', status, tijelo, mozePonovo: false };
  }
  const greska = jeObjekat ? tijelo.error : undefined;
  if (typeof greska === 'object' && greska !== null && typeof greska.code === 'string' && typeof greska.message === 'string') {
    return {
      vrsta: 'greska',
      status,
      code: greska.code,
      message: greska.message,
      correlationId: typeof greska.correlationId === 'string' ? greska.correlationId : null,
      // 503 ne znači da mutacija nije upisana (ODLUKE §6 (b)): ponovni pokušaj ide istim identifikatorom.
      mozePonovo: status === 503,
    };
  }
  return { vrsta: 'neocekivano', status, poruka: `Neočekivan odgovor (HTTP ${status}).`, mozePonovo: status === 503 };
}

export function opisiMreznuGresku() {
  return { vrsta: 'mreza', poruka: 'Backend nije dostupan.', mozePonovo: true };
}
