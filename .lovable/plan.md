## Mål

Inför återanvändbara batterikonfigurationer (torn: 1 bas + N moduler + 1 BMS/BDU/HV box), lägg in alla artiklar från bild 1 i komponentprislistan, och bygg en egen flik på `/priser` för att administrera dem.

## Datamodell

**Ny tabell `battery_configs`** (mall för ett batteritorn):

```text
id text PK            -- t.ex. "dyness_tower_pro", "stack100_pro", "saj_hs3_bu3"
name text             -- "DynESS Tower Pro"
short text            -- "Tower Pro"
base_component_id     -- FK components (1 st)
module_component_id   -- FK components (N st, kWh/modul läses härifrån)
bms_component_id      -- FK components (1 st, nullable)
min_modules int
max_modules int
sort_order int
updated_at
```

**Ändring i `system_configs`**: kolumnen `battery_module_id` ersätts av `battery_config_id` (FK → battery_configs, nullable för Atmoce-baserade system om inget torn definieras). Atmoce M-ELV finns inte i bild 1 — den fortsätter använda existerande Atmoce-modulkomponent via en battery_config av samma struktur (bas+modul+BMS valfria, kWh läses från modul).

Lägger en battery_config även för Atmoce med bara `module_component_id` satt (bas/BMS = null) så datamodellen är enhetlig.

## Komponenter att seeda (pris = 0, side='ess', unit='st')

Från bild 1, alla med `category` enligt nedan:

| Display name | id | category | unit_kwh |
|---|---|---|---|
| Dyness Tower Pro Base + BDU | `dyness_tower_pro_base` | battery_base | — |
| Dyness Tower PRO HV9640 module | `dyness_tower_pro_module` | battery_module | 3.84 |
| Stack100 Pro Battery Module IP66 | `stack100_pro_module` | battery_module | 5.12 |
| Stack100 Pro BDU+BASE IP66 | `stack100_pro_base` | battery_base | — |
| Stack100 Battery Module | `stack100_module` | battery_module | 5.12 |
| Stack100 BDU+BASE | `stack100_base` | battery_base | — |
| SAJ Hybrid Inverter Module HS3 12kW | `saj_hs3_inverter` | string_inverter | — |
| SAJ Battery module 5kWh for HS3 | `saj_hs3_module` | battery_module | 5.0 |
| SAJ Battery Base for BU3 | `saj_bu3_base` | battery_base | — |
| Pylontech Force H3 module 5,12kWh | `pylontech_h3_module` | battery_module | 5.12 |
| Pylontech Force H3 BMS | `pylontech_h3_bms` | battery_bms | — |
| Qapacity HV Control Box + Base (Arctic) | `qapacity_arctic_base` | battery_base | — |
| Qapacity battery module Quintao (Arctic, 5,42 kWh) | `qapacity_arctic_module` | battery_module | 5.42 |
| SolisStor-5kWh-H-ST-66-M | `solisstor_module` | battery_module | 5.0 |
| SolisStor-CB-RH | `solisstor_base` | battery_base | — |
| Qapacity Blizzard module 5,37 kWh | `qapacity_blizzard_module` | battery_module | 5.37 |

Nya kategorier `battery_base` och `battery_bms` läggs till `CATEGORIES`-arrayen i `ComponentsTable.tsx`.

## Battery configs att seeda

| id | bas | modul | bms | min–max |
|---|---|---|---|---|
| `atmoce_melv` | — | `atmoce_module` (befintlig) | — | 1–8 |
| `dyness_tower_pro` | `dyness_tower_pro_base` | `dyness_tower_pro_module` | — | 2–6 |
| `dyness_stack100` | `stack100_base` | `stack100_module` | — | 3–15 |
| `dyness_stack100_pro` | `stack100_pro_base` | `stack100_pro_module` | — | 3–15 |
| `saj_hs3_bu3` | `saj_bu3_base` | `saj_hs3_module` | — | 1–8 |
| `qapacity_arctic` | `qapacity_arctic_base` | `qapacity_arctic_module` | — | 2–7 |
| `pylontech_h3` | — | `pylontech_h3_module` | `pylontech_h3_bms` | 2–15 |

## Migration av befintliga systemkopplingar

För varje rad i `system_component_lines` där `qty_kind='per_battery_module'` (dagens modulrad): lämnas oförändrad — den hänvisar redan till modul-komponenten.

Lägg till **två nya rader per system** som har en `battery_config_id` med bas/BMS satt:
- `qty_kind='fixed', qty_value=1, component_id=<base_component_id>`
- `qty_kind='fixed', qty_value=1, component_id=<bms_component_id>` (om satt)

Mappning system → battery_config:
- `atmoce` → `atmoce_melv`
- `solis_dyness` (Stack100) → `dyness_stack100`
- `solis_qapasity` → `qapacity_arctic`
- `saj_hs3` → `saj_hs3_bu3`
- `sigenergy`, `huawei_optim` → behåller dagens battery_module_id-logik (battery_config_id = null, ingen torn-konfig)

## Pricing-motor (`src/lib/pricing.ts`)

- `SystemConfig.battery_module_id` → `battery_config_id: string | null`
- Lägg till `BatteryConfig` interface.
- `computeSystemPrice` tar emot `batteryConfigs: BatteryConfig[]`; löser `batteryKwh` från `config.battery_config_id → battery_configs.module_component_id → components.unit_kwh × batteryModules`.
- Pricing-summan av `system_component_lines` är redan korrekt (bas+BMS+modul ligger nu som separata rader).

## UI på `/priser`

Wrappa innehållet i `<Tabs>` med tre flikar:
1. **Generellt & komponenter** — `GlobalSettingsCard` + `ComponentsTable` (befintligt).
2. **Batterikonfigurationer** — ny `BatteryConfigsTab`:
   - Tabell/kort per config: namn, short, dropdowns för bas/modul/BMS (filtrerade på `category` i `battery_base|battery_module|battery_bms`), min/max moduler, kWh/modul (read-only, hämtad från vald modul), total kWh vid min/max.
   - Spara/Lägg till/Radera.
3. **Systemkonfigurationer** — befintliga `SystemConfigCard` (battery-dropdown ändras till `battery_config_id`-dropdown).

`SystemConfigCard` uppdateras: ersätt "Batterimodul"-väljaren med "Batterikonfiguration"-väljare (lista från `battery_configs`).

## Kalkylator (`src/routes/index.tsx`)

- `usePricingData` returnerar nu även `batteryConfigs`.
- `buildSystems` / Atmoce-väljaren: kWh per modul resolvas via `battery_config → module_component → unit_kwh`. Logik för matchning av referenssystemets antal moduler oförändrad (`round(targetKwh / refUnitKwh)`), men `refUnitKwh` hämtas från battery_config.

## Filer

**Migrationer** (i två separata migration-anrop p.g.a. tool-restriktioner och seed efter schema):
1. Schema: skapa `battery_configs`, lägg `battery_config_id` på `system_configs`, GRANTs, RLS = öppen (matchar resten).
2. Seed (via insert-tool): nya komponenter (pris 0), battery_configs, nya `system_component_lines`-rader, uppdatera `system_configs.battery_config_id`. **Drop `battery_module_id`-kolumnen** i en tredje migration efter att koden uppdaterats.

**Kod**:
- `src/lib/pricing.ts` — nya types, kWh-resolver.
- `src/lib/usePricing.ts` — hämta `battery_configs`.
- `src/lib/usePrices.ts` — vidareskicka battery_configs.
- `src/components/priser/BatteryConfigsTab.tsx` — ny.
- `src/components/priser/SystemConfigCard.tsx` — battery_config_id-väljare.
- `src/components/priser/ComponentsTable.tsx` — nya kategorier.
- `src/routes/priser.tsx` — Tabs-layout.
- `src/routes/index.tsx` — kWh-resolver via battery_config.

## Öppna detaljer

- Inga priser sätts på nya komponenter — du fyller i via UI:t.
- Pylontech Force H3 har BMS men ingen bas i bild 1 → bas = null.
- SAJ HS3 hybrid-inverter (`saj_hs3_inverter`) läggs i komponentlistan men kopplas inte automatiskt till något system (kategorin `string_inverter`, side='pv') — finns redan en inverter-rad för SAJ HS3 idag, du kan välja att byta manuellt.
