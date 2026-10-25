// Lokalni poslužitelj POS Simulatora (P-1 A): servira stranicu i prosljeđuje SAMO dvije POS rute na Backend,
// jer Backend nema CORS, a zaglavlje X-POS-API-Key aktivira preflight. Bez zavisnosti (samo node:http).
// X-POS-API-Key se prosljeđuje, ali se nikad ne loguje ni ne čuva; u log idu samo metod, šablon rute i status (u duhu D-3).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const STATICKI = new Map([
  ['/', { fajl: 'index.html', tip: 'text/html; charset=utf-8' }],
  ['/index.html', { fajl: 'index.html', tip: 'text/html; charset=utf-8' }],
  ['/logika.js', { fajl: 'logika.js', tip: 'text/javascript; charset=utf-8' }],
]);
const RUTA_KUPOVINE = /^\/api\/v1\/pos\/purchases$/;
const RUTA_OTKUPA = /^\/api\/v1\/pos\/vouchers\/[^/?#]+\/redeem$/;
const NAJVECE_TIJELO_BAJTOVA = 16 * 1024;

function posaljiJson(odgovor, status, objekat) {
  odgovor.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  odgovor.end(JSON.stringify(objekat));
}

function procitajTijelo(zahtjev) {
  return new Promise((razrijesi, odbij) => {
    const komadi = [];
    let ukupno = 0;
    zahtjev.on('data', (komad) => {
      ukupno += komad.length;
      if (ukupno > NAJVECE_TIJELO_BAJTOVA) {
        zahtjev.destroy();
        odbij(new Error('tijelo preveliko'));
        return;
      }
      komadi.push(komad);
    });
    zahtjev.on('end', () => razrijesi(Buffer.concat(komadi)));
    zahtjev.on('error', odbij);
  });
}

export function napraviPosSimulator({ backendUrl = 'http://127.0.0.1:3000', log = (red) => console.log(red) } = {}) {
  const baza = new URL(backendUrl);
  const putanjaFajla = (fajl) => fileURLToPath(new URL(fajl, import.meta.url));

  return createServer(async (zahtjev, odgovor) => {
    const putanja = (zahtjev.url ?? '').split('?')[0];
    const stranica = zahtjev.method === 'GET' ? STATICKI.get(putanja) : undefined;
    if (stranica) {
      odgovor.writeHead(200, { 'content-type': stranica.tip, 'cache-control': 'no-store' });
      odgovor.end(await readFile(putanjaFajla(stranica.fajl)));
      return;
    }

    const sablon = RUTA_KUPOVINE.test(putanja) ? '/pos/purchases' : RUTA_OTKUPA.test(putanja) ? '/pos/vouchers/{voucherId}/redeem' : null;
    if (zahtjev.method !== 'POST' || sablon === null) {
      log(`${zahtjev.method} (nepoznata ruta) 404`);
      posaljiJson(odgovor, 404, { simulator: 'NEPOZNATA_RUTA' });
      return;
    }

    try {
      const tijelo = await procitajTijelo(zahtjev);
      const zaglavlja = { 'content-type': 'application/json' };
      if (typeof zahtjev.headers['x-pos-api-key'] === 'string') {
        zaglavlja['x-pos-api-key'] = zahtjev.headers['x-pos-api-key'];
      }
      const odgovorBackenda = await fetch(new URL(putanja, baza), { method: 'POST', headers: zaglavlja, body: tijelo });
      const tekst = await odgovorBackenda.text();
      log(`POST ${sablon} ${odgovorBackenda.status}`);
      odgovor.writeHead(odgovorBackenda.status, { 'content-type': 'application/json; charset=utf-8' });
      odgovor.end(tekst);
    } catch {
      log(`POST ${sablon} 502`);
      posaljiJson(odgovor, 502, { simulator: 'BACKEND_NEDOSTUPAN' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.POS_SIMULATOR_PORT ?? 3001);
  const backendUrl = process.env.BACKEND_URL ?? 'http://127.0.0.1:3000';
  napraviPosSimulator({ backendUrl }).listen(port, '127.0.0.1', () => {
    console.log(`POS Simulator: http://127.0.0.1:${port} (Backend: ${new URL(backendUrl).origin})`);
  });
}
