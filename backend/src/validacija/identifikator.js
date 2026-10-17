// Format ID-a dokumenta iz zahtjeva (i03/P-5, i04/P-9) prije bilo kakvog pristupa Firestore-u: ispravan UTF-16, 1–128 jedinica,
// bez "/", nije "." ni "..", ne odgovara rezervisanom obliku __…__ (zaštita putanje dokumenta). Očekuje string.
export function jeIspravanIdDokumenta(vrijednost) {
  return (
    vrijednost.isWellFormed() &&
    vrijednost.length >= 1 &&
    vrijednost.length <= 128 &&
    !vrijednost.includes('/') &&
    vrijednost !== '.' &&
    vrijednost !== '..' &&
    !/^__.*__$/s.test(vrijednost)
  );
}
