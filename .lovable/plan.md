## Mål

Lägg till de två nya server functions (`getCalculatorPricing`, `getAdminPricing`) som separata filer och koppla **kalkylatorn** (`/`) till den publika endpointen så att kostnadsbas + marginal aldrig skickas till klienten. `/priser` (admin) rör vi inte i den här ändringen — den fortsätter använda befintlig `getPricingData`.

## Nya filer

**`src/lib/pricing-public.ts`** — client-safe typer:
```ts
export interface SidePriceCoeffs { base: number; perPanel: number; perModule: number }
export interface PublicSystemPricing {
  id: string; name: string; short: string;
  pv: SidePriceCoeffs; ess: SidePriceCoeffs;
  batteryKwhPerModule: number;
  defaultBatteryModules: number;
  minModules: number; maxModules: number;
  sortOrder: number;
}
export interface PublicPricingPayload {
  systems: PublicSystemPricing[];
  defaults: { panels: number; wpPanel: number };
}
```

**`src/lib/pricing-public.functions.ts`** — exakt koden användaren klistrade in. Importerar typerna från `pricing-public.ts` och delar `verifyAdmin` från `pricing-admin.server.ts`. `supabaseAdmin` laddas fortsatt inuti handler (client-reachable modul).

## Kalkylator-integration

Ny hook `src/lib/useCalculatorPricing.ts`:
- `useQuery(['pricing-public'], getCalculatorPricing)` med `staleTime: 15s`.
- Helper `priceFromCoeffs(c, panels, modules) = c.base + c.perPanel*panels + c.perModule*modules`.
- Ny `buildSystemsPublic(payload, panels, batteryModules)` som returnerar samma `Record<SystemId, SystemSpec>`-form som befintliga `buildSystems`, men räknar `pvPrice`/`essPrice` via koefficienterna och `batteryKwh = batteryKwhPerModule * modules`.

`src/routes/index.tsx`:
- Byt `usePricingData` → nya hooken; byt `buildSystems(...)` → `buildSystemsPublic(...)`.
- `defaultBatteryModules` byggs från `payload.systems` (`defaultBatteryModules` fältet).
- `refUnitKwh` / atmoce-modul-kWh läses från `batteryKwhPerModule` i payloaden.
- Inga andra beteendeförändringar (tusentalsseparator, 3-kolumnslayout, snowmelt osv orörda).

## Admin

`/priser` fortsätter använda `getPricingData` + befintliga admin-mutations. `getAdminPricing` läggs till som exporterad server function men konsumeras inte i den här ändringen (redo att användas om vi senare vill härda även admin-flödet via lösenord istället för att lita på att sidan är lösenordsskyddad i UI:t).

## Verifiering

- `tsgo` typecheck rent.
- Öppna `/` i preview: priser i vänster/mitt-kolumn matchar dagens siffror för samma paneler + batterimoduler (spot-check 1–2 system).
- `/priser` fungerar oförändrat.

## Ej i scope

- Byte av `/priser` till `getAdminPricing`.
- Ändringar i `pricing.ts` / `computeSystemPrice` (behålls för admin-preview).
- Nya RLS-policies (allt går fortsatt via server functions med service role).