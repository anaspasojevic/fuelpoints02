// §1.5: za svaki puni litar goriva jedan bod; ulaz je validiran integer 1–200000, rezultat 0–200.
export function izracunajBodove(volumeMl) {
  return Math.floor(volumeMl / 1000);
}

// Oblik riječi „bod” uz broj (i03/P-8): 1, 21, 101 bod; 2–4, 22, 42 boda; 0, 5–20, 111–114 bodova.
export function oblikRijeciBod(broj) {
  const jedinice = broj % 10;
  const desetice = broj % 100;
  if (jedinice === 1 && desetice !== 11) {
    return 'bod';
  }
  if (jedinice >= 2 && jedinice <= 4 && (desetice < 12 || desetice > 14)) {
    return 'boda';
  }
  return 'bodova';
}

// Tekst in-app notifikacije POINTS_EARNED (§9.2, i03/P-8): bez UID-a, stationId-a, iznosa i ključa.
export function tekstObavjestenja(bodovi) {
  return {
    title: 'Bodovi za kupovinu goriva',
    body: `Za kupovinu goriva dobili ste ${bodovi} ${oblikRijeciBod(bodovi)}.`,
  };
}
