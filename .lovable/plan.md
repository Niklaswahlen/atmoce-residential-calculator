# Tillåt 0 solpaneler i kalkylatorn

## Mål
Användaren ska kunna välja 0 paneler (t.ex. för att räkna på ett rent batteriutbyggnads-case utan solceller).

## Ändringar

### 1. Sänk minimivärdet på panelantalet
- `src/routes/index.tsx` (~rad 595): ändra `min={1}` till `min={0}` på NumField "Antal solpaneler". Upp/ner-pilarna och inmatningen tillåter då 0. NumField-clampen (`Math.max(min, ...)`) ser till att värdet aldrig går under 0.

### 2. Skydda kr/Wp-raden mot division med noll
- `src/routes/index.tsx` (~rad 1390-1396): raden "kr/Wp" delar `pvPrice` med `panels * wpPerPanel`. Vid 0 paneler blir detta `Infinity` och visar "∞ kr/Wp". Lägg till villkor: när `panels === 0` visas "–" i stället för ett tal på båda sidorna (Atmoce och referens).

## Vad som redan fungerar vid 0 paneler (verifierat, ingen ändring)
- Produktionsberäkningen (`src/lib/calc.ts`): kWp = 0 → produktion 0 kWh, inga divisioner med panels.
- Snösmältningen (`src/lib/snowmelt.ts`): 0 paneler → 0 kWh smältning, inga divisioner.
- PDF:en (`src/lib/pdf.ts`): visar "0,00 kWp" och "0 paneler × 460 W" utan fel.
- Snabbvalsknapparna (10/15/20 paneler) påverkas inte.

## Verifiering
- Typecheck utan fel.
- Playwright: sätt 0 paneler → kalkylatorn visar 0 kWp, 0 kWh produktion, "–" på kr/Wp-raden, inga krascher eller ∞-värden; PDF genereras utan fel.
