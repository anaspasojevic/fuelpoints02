import { GreskaApi } from '../greske/GreskaApi.js';
import { jeNenegativanCijeliBroj } from './vauceri.js';

// AUTH-03, AUTH-05, §7.2 (i02/P-2, i03/P-15, i04/P-7): stanje naloga za loyalty mutaciju, iz snimaka users/{uid} i loyaltyAccounts/{uid}
// pročitanih u transakciji pozivaoca. Jedna implementacija za API-03, API-05 i API-06 (i05/P-5).
// users ne postoji → ACCOUNT_NOT_INITIALIZED; DELETION_IN_PROGRESS → ACCOUNT_DELETION_IN_PROGRESS (nova mutacija se odbija);
// accountStatus van enum-a → 500; loyaltyAccounts ne postoji → ACCOUNT_NOT_INITIALIZED; neispravan nalog se ne „popravlja” → 500.
export function procitajStanjeNaloga(snimakKorisnika, snimakNaloga) {
  if (!snimakKorisnika.exists) {
    throw new GreskaApi('ACCOUNT_NOT_INITIALIZED');
  }
  const status = snimakKorisnika.get('accountStatus');
  if (status === 'DELETION_IN_PROGRESS') {
    throw new GreskaApi('ACCOUNT_DELETION_IN_PROGRESS');
  }
  if (status !== 'ACTIVE') {
    throw new Error('Neočekivan accountStatus u users dokumentu.');
  }
  if (!snimakNaloga.exists) {
    throw new GreskaApi('ACCOUNT_NOT_INITIALIZED');
  }
  const dostupno = snimakNaloga.get('availablePoints');
  const rezervisano = snimakNaloga.get('reservedPoints');
  if (!jeNenegativanCijeliBroj(dostupno) || !jeNenegativanCijeliBroj(rezervisano)) {
    throw new Error('Neispravan loyaltyAccounts dokument.');
  }
  return { dostupno, rezervisano };
}
