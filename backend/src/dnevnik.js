// Serverski log grešaka kao JSON linija. Prima samo eksplicitna polja:
// nikad zaglavlja (Authorization, X-POS-API-Key) ni tijelo zahtjeva (§3.4, NFR-07).
export function zabiljeziGresku({ correlationId, code, status, metod, putanja, stack }) {
  const zapis = {
    vrijeme: new Date().toISOString(),
    nivo: 'greska',
    correlationId,
    code,
    status,
    metod,
    putanja,
  };
  if (stack !== undefined) {
    zapis.stack = stack;
  }
  console.error(JSON.stringify(zapis));
}
