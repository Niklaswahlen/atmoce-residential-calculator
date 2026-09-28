# Tre Atmoce-batterimodeller med egen garanti

Idag finns bara en Atmoce-batterikonfiguration (M-ELV, 7 kWh/modul) och garantin (15 år / 8 000 cykler) ligger hårdkodad på systemet. Planen lägger till två nya Atmoce-modeller och gör garanti + cykler till egenskaper på batterikonfigurationen, så att rätt siffror följer med i jämförelsen och i PDF:en.

## Vad användaren får

En rullista "Atmoce batterimodell" i den översta rutan (bredvid antal batterimoduler) med tre val:

| Modell | kWh/modul | Garanti | Cykler |
|---|---|---|---|
| Atmoce M-ELV | 7 kWh | 15 år | 8 000 |
| Atmoce 8 kWh | 8 kWh | 25 år | 10 000 |
| Atmoce 8 kWh PRO | 8 kWh | 25 år | 15 000 |

När modellen byts uppdateras kWh, pris, garanti och cykler direkt i Atmoce-kortet, i jämförelsetabellen och i PDF:en. Antal moduler: 1–6 per combiner.

## Priser

Inköpspriserna för de två nya modulerna och deras bas/BMS är inte kända ännu. De läggs in med 0 kr och fylls i på /priser → Komponenter när priserna kommer. Fram till dess visar kalkylen ett för lågt Atmoce-pris om någon av de nya modellerna väljs — det noteras i admin-fliken.

## Teknisk genomförande

**Databas (migration)**
- `battery_configs`: nya kolumner `warranty_years integer` och `warranty_cycles integer` (nullable).
- Backfill av befintliga konfigurationer med dagens värden (Atmoce M-ELV 15/8000, övriga 10/6000).

**Data (via query-verktyg, ej migration)**
- Nya komponenter: `atmoce_8_module` (8 kWh), `atmoce_8_pro_module` (8 kWh), samt bas-/BMS-artiklar `atmoce_8_base`, `atmoce_8_pro_base` — alla med pris 0 tills priser finns.
- Nya batterikonfigurationer `atmoce_8` och `atmoce_8_pro` (min 1, max 6, garanti 25 år, 10 000 respektive 15 000 cykler).

**Publik prisberäkning** (`pricing-public.ts` / `pricing-public.functions.ts`)
- `PublicSystemPricing` får en lista `batteryOptions: { configId, name, kwhPerModule, minModules, maxModules, warrantyYears, warrantyCycles, pv, ess }` — koefficienterna räknas per batterikonfiguration för system som har alternativ (idag endast Atmoce). Kostnadsbas och marginal fortsätter stanna på servern.

**Kalkylator** (`src/routes/index.tsx`, `usePrices.ts`)
- Ny state `atmoceBatteryConfigId` med M-ELV som default.
- Rullista i översta kortet; vald konfiguration styr `atmoceUnitKwh`, priskoefficienter samt `batteryWarrantyYears` / `batteryWarrantyCycles` i `SystemSpec`.
- Modulantal klampas till vald modells min/max, och auto-matchningen mot referenssystemets kWh använder vald modells kWh.

**Admin** (`BatteryConfigsTab.tsx`)
- Två nya fält per kort: Garanti (år) och Cykler, sparas via befintlig upsert-serverfunktion (fälten läggs till i `adminUpsertBatteryConfig`).
