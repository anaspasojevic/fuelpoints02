// Presretač svih izlaznih kanala procesa (premješten iz aplikacija.test.js, i01 FIX LOOP 1, R-02; ponašanje nepromijenjeno).
import { mock } from 'node:test';
import { format } from 'node:util';

const METODE_KONZOLE = ['log', 'info', 'warn', 'error', 'debug'];

// Bilježi sve izlazne kanale procesa da testovi mogu provjeriti šta se loguje: console.* se utišava,
// a process.stdout/stderr.write se bilježi i prosljeđuje (njima piše i test runner).
// Vraćanje originala: mock.restoreAll() u afterEach testa.
export function presretniLog() {
  const zapisi = [];
  for (const metoda of METODE_KONZOLE) {
    mock.method(console, metoda, (...argumenti) => {
      zapisi.push(format(...argumenti));
    });
  }
  for (const tok of [process.stdout, process.stderr]) {
    const pisi = tok.write;
    mock.method(tok, 'write', (komad, ...ostalo) => {
      zapisi.push(String(komad));
      return pisi.call(tok, komad, ...ostalo);
    });
  }
  return zapisi;
}

export function tekstLoga(zapisi) {
  return zapisi.join('\n');
}
