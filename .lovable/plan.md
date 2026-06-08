## Mål

Bygg in Excel-modellen i appen så att alla priser härleds från en redigerbar komponentlista (ex moms) → marginal → moms → GTA → slutkundpris (ink moms). Användaren ska på /priser kunna ändra komponenter, marginal, moms och GTA, och i kalkylatorn välja antal batterimoduler per system. Antalet solpaneler är gemensamt för alla system.

## Datamodell (ny migration)

Fyra nya tabeller i public, alla med "Anyone can read/insert/update" (samma policy som system_prices idag, ingen auth).

```text
price_settings (en rad, id = 'current')
  margin_pct        numeric  -- 0.25
  vat_pct           numeric  -- 0.25
  gta_pv_pct        numeric  -- 0.20  (avdrag, slutfaktor = 1 - 0.20)
  gta_ess_pct       numeric  -- 0.50
  default_panels    int      -- 14
  default_wp_panel  int      -- 460

components  (global komponent-prislista, ex moms)
  id            text PK           -- "solpanel", "atmoce_microinverter", "dyness_stack100_module", ...
  name          text
  category      text              -- panel | microinverter | string_inverter | battery_module
                                  --   | mounting | scaffolding | cabling | ac_material
                                  --   | electrical_install | panel_install | freight | accessory
  side          text              -- 'pv' | 'ess'  (vilken sida summan landar på)
  unit          text              -- 'st' | 'panel' | 'pair'
  unit_price_ex_vat numeric       -- á-pris ex moms
  unit_kwh      numeric NULL      -- bara för battery_module (7, 5.12, 9, 5, 5.42, 14)

system_configs  (6 fasta system; user kan inte lägga till nya i v1)
  id                       text PK   -- 'atmoce', 'solis_dyness', 'sigenergy', 'saj_hs3', 'solis_qapasity', 'huawei_optimizer'
  name                     text
  short                    text
  battery_module_id        text FK components.id   -- vilken komponent som skalar med antal batterimoduler
  default_battery_modules  int                     -- 2 för Atmoce, 1 för Dyness stack, 2 för Sigenor, 3 för SAJ, 3 för Qapasity, 1 för Huawei S1
  pv_override_inc_vat      numeric NULL            -- om satt, ersätter framräknat PV-pris efter GTA
  ess_override_inc_vat     numeric NULL

system_component_lines  (radposterna per system)
  id              uuid PK
  system_id       text FK
  component_id    text FK
  side            text             -- 'pv' | 'ess'
  qty_kind        text             -- 'fixed' | 'per_panel' | 'half_per_panel' | 'per_battery_module'
  qty_value       numeric          -- multiplikator (oftast 1)
  sort_order      int
```

Migrationen seedar alla rader från Excel-arket (Atmoce, Solis+Dyness, Sigenergy, SAJ HS3, Solis+Qapasity, Huawei+Optimerare) inklusive antal/á-pris och batterimoduler.

## Beräkningskärna

Ny fil `src/lib/pricing.ts` med ren funktion:

```ts
computeSystemPrice({
  systemId, panels, batteryModules, components, lines, settings
}) → {
  pvLines, essLines,           // upplösta rader med qty + radsumma
  pvSubtotal, pvMargin, pvExVat, pvIncVat, pvAfterGta,
  essSubtotal, essMargin, essExVat, essIncVat, essAfterGta,
  pvPrice, essPrice            // efter override-check
}
```

Quantity-resolvern översätter qty_kind till tal:
- `fixed` → qty_value
- `per_panel` → panels × qty_value (Solpaneler, Montagesystem, Montage PPP, Installationskostnad solpaneler, Huawei Optimerare)
- `half_per_panel` → panels/2 × qty_value (Atmoce mikroväxelriktare = 2-i-1)
- `per_battery_module` → batteryModules × qty_value (Dyness stack, Sigenor bat 9kWh, SAJ HS3 5kWh, Qapasity batterimodul, Atmoce ELV batteri)

Sidans formel (per sida pv/ess):
```text
subtotal  = Σ qty × unit_price_ex_vat
margin    = subtotal × margin_pct
ex_vat    = subtotal + margin
inc_vat   = ex_vat × (1 + vat_pct)
after_gta = inc_vat × (1 - gta_pct[side])
price     = override ?? after_gta
```

## /priser — ny UI

Tre sektioner i ordning:

1. **Globala inställningar** (en card med fyra fält): marginal %, moms %, GTA PV %, GTA ESS %. Standard panels/Wp visas (men styrs från startsidan).
2. **Komponentprislista** (tabell): namn, kategori, sida, enhet, pris ex moms, ev. kWh/modul, [Spara]. Filter/sökning per kategori. Knapp "Lägg till komponent".
3. **Systemkonfigurationer** — accordion med en panel per system (6 st):
   - Header: systemnamn + total efter GTA (PV + ESS).
   - Inuti: Batterimodul-väljare (dropdown av komponenter i `battery_module`), default antal batterimoduler, override-fält för PV resp ESS slutpris.
   - Tabell över PV-rader: komponent (dropdown), qty-kind, qty-värde, beräknad mängd, á-pris, radsumma. Add/remove rad.
   - Samma för ESS-rader.
   - Sammanfattningsrad per sida: Delsumma → Marginal → Ex moms → Ink moms → **Efter GTA** (det som hamnar i kalkylatorn om ingen override).

Alla edits sparas via befintliga `system_prices`-mönstret (mutate + invalidate `useQuery`-cache). Priserna ska tydligt märkas "ex moms" i komponentlistan och "ink moms, efter GTA" i system-sammanställningen.

## Kalkylatorintegration (startsidan)

- Ersätt `useSystemPrices` så den hämtar `components`, `system_component_lines`, `system_configs`, `price_settings` och returnerar en helper `getSystemPrice(systemId, panels, batteryModules)` som anropar pricing-kärnan.
- I `mergeSystems` ersätt `pvPrice`/`essPrice`/`batteryKwh` med live-värden (batteryKwh = batteryModules × unit_kwh från valt batterimodul-komponent, eller fast värde för Huawei S1).
- Lägg till per-system batterimodul-väljare på startsidan: under "Referenssystem"-kortet en liten sektion "Atmoce batterimoduler" och "Referenssystem batterimoduler" (number-input). Default från `default_battery_modules`. Atmoce-systemet kan ha annan modul-count än referensen — antal paneler är alltid samma.
- Eftersom panels redan finns i `params.panels` driver det kvantiteterna i pricing-modellen automatiskt.

## Bakåtkompatibilitet

`system_prices`-tabellen blir oanvänd efter migreringen. Den tas inte bort i v1 (kan rensas senare) — `usePrices.ts` slutar läsa den och pekar mot nya hooken. /priser-rutten byts ut helt.

## Filer

Nya:
- `supabase/migrations/<ts>_pricing_model.sql` — alla 4 tabeller + GRANT + RLS-policies + seeds från Excel.
- `src/lib/pricing.ts` — beräkningskärnan.
- `src/lib/usePricing.ts` — TanStack Query-hooks för components/lines/configs/settings + helpers.
- `src/components/priser/ComponentsTable.tsx`, `SystemConfigCard.tsx`, `GlobalSettingsCard.tsx`.

Ändrade:
- `src/routes/priser.tsx` — ny layout med tre sektioner.
- `src/routes/index.tsx` — använd ny pricing-hook + per-system batterimodul-väljare.
- `src/lib/usePrices.ts` — wrappa nya hooken eller ersätt helt (anropas av `mergeSystems`).
- `src/data/systems.ts` — behåll tekniska fält (warranty, roundTrip, productionBonus, inverterType, panelLevelMonitoring) men släpp pvPrice/essPrice/batteryKwh som nu kommer från DB.

Ingen ändring av `calc.ts`, snösmältningsmodellen, header eller i18n.

## Ut-i-luften-frågor som styr seedningen

Jag seedar med exakt det som står i Excel-arket (alla á-priser ex moms, antal, batterimodul-storlekar). De "shared" rader som upprepas i varje system (Solpaneler 750 kr, Montagesystem 500 kr, Ställning 5 000 kr, Montage PPP 1 000 kr, Kablage & övrigt 2 000 kr) blir gemensamma komponenter som varje system-config refererar till — så ändras t.ex. panelpriset på ett ställe slår det igenom överallt, precis som du vill.
