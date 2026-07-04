# Referenssystem-väljare i "Dina siffror"-kortet

## Mål
Låt användaren välja vilket system som visas i högra kolumnen (referensen), medan Atmoce alltid ligger i vänstra. Kortet under rubriken utökas så att prisöverride följer valt referenssystem, och ett "Eget system"-läge tillåter helt manuella värden.

## UI-ändringar (`src/routes/index.tsx`, "Dina siffror"-kortet)

Layouten blir tre rader:

1. **Antal solpaneler** (oförändrat).
2. **Kostnad Atmoce (ink moms efter GTA)** — som idag, override + "Estimera".
3. **Referenssystem** — ny rad:
   - `Select` med alla icke-Atmoce system från `SYSTEMS`/`buildSystems` + sista alternativet **"Eget system"**.
   - Bredvid: **Batterikapacitet (kWh)** — vid ett listat system förifylls från `batteryKwh`, kan override:as. Vid "Eget system" är fältet tomt/obligatoriskt.
   - Bredvid: **Kostnad (ink GTA)** — auto-fylls från valt systems `pvPrice + essPrice` (batteriuppdaterat), override möjlig. Vid "Eget system" alltid manuellt.
   - Vid "Eget system" fälls extra fält ut:
     - Round-trip effektivitet (%, default 90)
     - Garanti inverter (år, default 10)
     - Garanti batteri (år, default 10)

Knapp **"Estimera kostnad"** nollställer bara prisöverriden (inte val av system eller kWh).

## Statehantering

Nya states i `RouteComponent`:
- `refSystemId: SystemId | "custom"` (default `"solis_dyness"` — första i listan).
- `refBatteryKwhOverride: number | null`
- `refPriceOverride: number | null` (redan finns — behålls)
- `customRoundTrip: number` (default 0.9)
- `customInvWarranty: number` (default 10)
- `customBatWarranty: number` (default 10)

Härledda värden:
- `refSpec` = om `custom` → syntetiskt `SystemSpec` byggt av användarens inputs (namn "Eget system", `productionBonus: 0`, `panelLevelMonitoring: false`, `inverterType: "—"`); annars `systems[refSystemId]` från `buildSystems`.
- `refBatteryKwhEffective = refBatteryKwhOverride ?? refSpec.batteryKwh`
- `refPriceEstimated = refSpec.pvPrice + refSpec.essPrice` (justerat efter batteri via `buildSystems` med anpassad `batteryModules`-map när det är ett listat system).
- `refPriceEffective = refPriceOverride ?? refPriceEstimated`

Den befintliga variabeln `reference` som skickas ned i beräkningen ersätts nu med `refSpec` (med `pvPrice = refPriceEffective`, `essPrice = 0`, `batteryKwh = refBatteryKwhEffective`, m.fl. härledda värden).

## Byggnadsdetaljer

- Återanvänd befintlig `PriceField` för prisfält och `NumField` för kWh.
- Placera dropdownen som en `Select` från `@/components/ui/select`.
- Håll all logik i `src/routes/index.tsx` — ingen ändring i `pricing`/backend.
- Övrig rapport, PDF och `memorize`-nyckel läser redan från `reference`-objektet, så inga följdändringar behövs där utöver att skicka det nya `refSpec`.

## Vad som INTE ändras
- Prismodellen, snösmältningslogiken, PDF-export.
- Vänstra kolumnen — alltid Atmoce.
- Övriga sektioner på sidan.
