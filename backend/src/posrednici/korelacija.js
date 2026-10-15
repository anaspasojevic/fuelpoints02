import { randomUUID } from 'node:crypto';

// Svaki zahtjev dobija novi correlationId (§27). Dolazni ID od klijenta se ne prihvata.
export function korelacija(req, res, next) {
  res.locals.correlationId = randomUUID();
  next();
}
