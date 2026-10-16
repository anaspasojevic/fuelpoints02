// Pomoćnici za Firebase Auth emulator (§2.4). Host je fiksan, kao u ocistiEmulatore().
// kljuc-emulatora nije tajna: Auth emulator prihvata bilo koji API ključ.

const ADRESA_AUTH_EMULATORA = 'http://127.0.0.1:9099';

// Registruje korisnika e-mailom i lozinkom (kao Android klijent) i vraća uid i Firebase ID token.
export async function napraviKorisnika(email, lozinka = 'Lozinka123') {
  const odgovor = await fetch(
    `${ADRESA_AUTH_EMULATORA}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=kljuc-emulatora`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: lozinka, returnSecureToken: true }),
    },
  );
  if (!odgovor.ok) {
    throw new Error(`Registracija u Auth emulatoru nije uspjela (HTTP ${odgovor.status}).`);
  }
  const tijelo = await odgovor.json();
  return { uid: tijelo.localId, idToken: tijelo.idToken };
}

function base64url(objekat) {
  return Buffer.from(JSON.stringify(objekat)).toString('base64url');
}

// Nepotpisan token u obliku koji izdaje Auth emulator (alg "none", prazan potpis).
export function napraviNepotpisanToken(payload) {
  return `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(payload)}.`;
}
