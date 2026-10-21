---
ITERATION BRIEF — FuelPoints — ITERACIJA 11: POS Simulator, pravi Firebase projekat, Release, završna NFR provjera

Repozitorijum: github.com/anaspasojevic/fuelpoints02
Grana: iteracija-11 (iz main na tagu i10) → PR u main → tek nakon ITERATION ACCEPTED: merge + anotirani tag i11
Normativni dokument: FuelPoints SRS 3.1 — docs/srs/FuelPoints_SRS_3_1.docx (ne mijenja se)
Registar odluka: docs/ODLUKE.md — sve odluke obavezujuće.

1. CILJ
Poslednja iteracija. Zatvoriti sve stavke ostavljene za i11 kroz i06-i10: POS Simulator (§2.5, §33.2, obavezna MVP komponenta iz §34.1), pravi
Firebase Spark projekat (O-2) sa Email Enumeration Protection i password policy "Require" (§3.5, §3.6), release build Android-a sa R8 pravilom koje
uklanja Log.v/d/i pozive uključujući SDK (i09/K-3 obaveza), composite indeksi provjereni nad pravim projektom (ne samo emulatorom), završna NFR-09
smoke provjera na API 26 i API 35 za SVE ekrane (i09 + i10), završna NFR-10 Layout Inspector provjera na API 35 za sve ekrane, AC-12 završna potvrda
(12/12 API + 12/12 Rules nad pravim/emulator okruženjem po odluci Plannera), S9 (isticanje vaučera) ručno na uređaju, kozmetička doterivanja ekrana
"Pomoć i česta pitanja" (otvorena stavka iz S13 i10).

2. SRS ZAHTJEVI U OPSEGU
- §2.5, §33.2: POS Simulator — minimalna implementacija (jedna HTML stranica, preporučeno), ručni unos/kopiranje Customer UID-a (bez QR skenera),
  poziva POS API (§3.4) sa POS API ključem.
- §34.1: potvrditi da su sve obavezne MVP komponente prisutne i funkcionalne.
- O-2: pravi Firebase Spark projekat (van repoa, lokalna konfiguracija), Email Enumeration Protection i password policy "Require" u konzoli.
- NFR-09: puna smoke provjera na API 26 i API 35 (svi ekrani i09 i i10).
- NFR-10: Layout Inspector na API 35 za sve ekrane (dodirne zone ≥ 48dp, contentDescription).
- i09/K-3: release build, R8/ProGuard pravilo koje uklanja Log.v/Log.d/Log.i pozive (uključujući Firebase/Auth SDK logovanje e-maila i UID-a).
- Composite indeksi (firebase/firestore.indexes.json) provjereni nad pravim projektom, ne samo oblikom.
- AC-12: završna potvrda (12/12 API testova + 12/12 Rules testova u jednom run-u).
- S9 (opcioni smoke korak iz i10): ručna provjera isticanja vaučera na uređaju (0:00 → istekao → API-06 → nestaje).
- Kozmetička doradnja rasporeda ekrana "Pomoć i česta pitanja" (otvoreno iz i10/S13).

3. VAN OPSEGA
FCM push notifikacije (§33.4, nije dio core acceptance-a), promjena e-maila, QR skener u aplikaciji, ekran istorije vaučera, bilo šta što SRS §1.3
eksplicitno isključuje.

4. NAPOMENA
Ovo je poslednja planirana iteracija (11 od 11). Poslije ITERATION ACCEPTED i11, projekat je završen prema planu iz docs/ODLUKE.md.
---
