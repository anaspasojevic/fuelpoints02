# FuelPoints POS Simulator

Minimalni simulator kase benzinske pumpe (SRS §2.5, §33.2). Preporučeni oblik je jedna
jednostavna HTML stranica; QR skener nije potreban, a loyalty UID se unosi ručno ili kopira
sa Android QR ekrana.

Simulator je *controlled client* (§3.1): Loyalty Backend mu vjeruje samo za POS ulazne podatke,
i to tek poslije uspješne autentikacije POS API ključem (§3.4).

## Stanje u Iteraciji 1

Ovdje postoji samo kostur: prazna stranica `index.html`, bez formi i bez mrežnih poziva.
Forma za kupovinu (loyalty UID, POS transaction ID, količina goriva, iznos, valuta i vrijeme
kupovine) i forma za redemption (voucher ID i redemption request ID) dolaze u Iteraciji 11.
