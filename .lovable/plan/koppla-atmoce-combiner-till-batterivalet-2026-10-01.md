# Koppla Atmoce Combiner till batterivalet

## Mål
Atmoce Combiner (5 900 kr) ska bara ingå i Atmoce-systemets ESS-pris när vald batterikonfiguration är en Atmoce-modell (M-ELV 7 kWh, 8 kWh eller 8 kWh PRO). Väljs ett annat batteri (t.ex. SAJ HS3) tas Combiner-raden bort ur beräkningen automatiskt — och kommer tillbaka när en Atmoce-modell väljs igen.

## Ändringar

### 1. `src/lib/pricing.ts` (admin-sidan /priser)
- I `computeSystemPrice()`: filtrera bort den manuella ESS-raden med komponent-id `atmoce_combiner` när en batterikonfiguration är vald vars id **inte** börjar på `atmoce`.
- Raden syns då inte i SystemConfigCard och räknas inte in i delsumman när SAJ eller annat icke-Atmoce-batteri är valt.

### 2. `src/lib/pricing-public.functions.ts` (kalkylatorn)
- Samma regel i `essFor()`/`reduceSide()`: exkludera `atmoce_combiner` ur ESS-koefficienterna för batterialternativ vars konfig-id inte börjar på `atmoce`.
- Eftersom varje batterialternativ i rullistan får egna ESS-koefficienter följer priset automatiskt med när användaren byter batterimodell i kalkylatorn.

## Tekniska detaljer
- Regeln bygger på konfig-id-prefixet `atmoce_` (gäller atmoce_melv, atmoce_8, atmoce_8_pro) — samma familjemönster som redan används för batterialternativen.
- Ingen databasändring, ingen ändring av komponenten eller raden i sig — den ligger kvar och kan användas igen.
- Ingen ändring i UI-layout, PDF eller övriga system.

## Verifiering
- Typecheck (`bunx tsgo --noEmit`).
- Kontrollera i /priser att Atmoce med SAJ-batteri visar ESS-delsumma utan Combiner (37 395 kr istället för 43 295 kr) och att Combiner-raden återkommer vid val av Atmoce-batteri.
- Kontrollera att kalkylatorns Atmoce-pris ändras vid byte av batterimodell.
