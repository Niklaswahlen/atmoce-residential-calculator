## Kontext

I förra turnen skapade jag redan koefficientmodellen, men lade hook + build-funktion i en ny fil `src/lib/useCalculatorPricing.ts` och döpte helpern till `priceFromCoeffs`. Detta steg flyttar/​döper om enligt användarens spec så att admin-sidan förblir orörd och kalkylatorn använder `useCalculatorPricing` + `buildSystemsPublic` från de befintliga modulerna.

## Ändringar

**`src/lib/pricing-public.ts`**
- Byt namn `priceFromCoeffs` → `sidePrice` (samma signatur, samma implementation).

**`src/lib/usePricing.ts`** (admin-hooken bor här idag)
- Lägg till `useCalculatorPricing()` som anropar `getCalculatorPricing` från `./pricing-public.functions` och returnerar `PublicPricingPayload` med `queryKey: ["calculator-pricing"]`, `staleTime: 15_000`.
- Behåll `usePricingData` orörd.

**`src/lib/usePrices.ts`**
- Lägg till `buildSystemsPublic({ pricing, panels, batteryModules })` som mappar `pricing.systems` → `SystemSpec` via `sidePrice(...)` och `batteryKwhPerModule * modules`.
- Behåll befintlig `buildSystems`.
- Re-exportera `useCalculatorPricing` för symmetri med nuvarande `usePricingData`-re-export.

**`src/routes/index.tsx`**
- Byt import från `useCalculatorPricing.ts` → `usePrices` (`useCalculatorPricing`, `buildSystemsPublic`, `BatteryModulesMap`, `findPublicSystem`).
- Anropet till `buildSystemsPublic({ payload, ... })` justeras till nya signaturen `{ pricing, panels, batteryModules }`.
- Panelantalets default kan tas från `pricing.defaults.panels` i initial state (om `pricing` finns när komponenten mountas — annars fortsätt med `DEFAULT_PARAMS.panels` som fallback). Inga UI-fält i kalkylatorn läser `settings.margin_pct` eller komponentlistan idag, så inget behöver tas bort.

**`src/lib/useCalculatorPricing.ts`**
- Tas bort — dess innehåll flyttar in i `usePricing.ts` + `usePrices.ts`. `findPublicSystem` flyttar till `usePrices.ts`.

## Verifiering

- `tsgo --noEmit` rent.
- Öppna `/`: ändra antal paneler och batterimoduler → priser i topprutan uppdateras direkt.
- `/priser` fungerar oförändrat (fortsatt via `usePricingData`).

## Ej i scope

Ingen ändring i `pricing.functions.ts`, `getPricingData`, `routes/priser.tsx`, `components/priser/*` eller borttagning av befintliga funktioner.