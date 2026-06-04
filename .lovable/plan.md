## Översikt

Bygger två nya saker ovanpå nuvarande kalkylator:

1. **Prissida** (`/priser`) — lista alla 6 system med redigerbara PV/ESS-priser, sparas delat i Lovable Cloud.
2. **Snösmältningsmodul** på huvudsidan — ortval, månadsvis vinst från snöfria paneler, jämförelse av Atmoce-styrlägen och kostnaden för smältningen.

## 1. Lovable Cloud — delat lager för priser

Aktiverar Cloud. Skapar en tabell:

```text
system_prices
  id (system_id text, primary key — "atmoce" | "solis_dyness" | ...)
  name text
  pv_price numeric
  ess_price numeric
  updated_at timestamptz
```

- RLS på, **SELECT till anon+authenticated** (priser är offentliga), **UPDATE till authenticated**.
- Seedas med dagens prislista (2026).
- Server fn `getSystemPrices()` och `updateSystemPrice({id, pvPrice, essPrice})` (auth-skyddad).
- Frontend hämtar priser via TanStack Query + `useSuspenseQuery`. Faller tillbaka till hårdkodade defaults i `src/data/systems.ts` om Cloud inte svarar.

## 2. Prissida `/priser`

- Ny route `src/routes/priser.tsx`.
- Tabell: System | PV (kr) | ESS (kr) | Totalt (kr) | Uppdaterad.
- Inline-redigering (klick → `Input` → spara-knapp) med optimistic update + `invalidateQueries`.
- "Återställ till 2026-prislistan"-knapp.
- Länk i header från `/`.
- Kräver inloggning för att spara → enkel mejl/lösen-auth via `/auth` (under `_authenticated/priser` om det blir tydligare; alternativt visa "Logga in för att redigera"-CTA på publika sidan). **Default-val**: publik visning, redigering kräver login.

## 3. Snösmältningsmodul

### Datakälla per ort

Hårdkodad tabell i `src/data/locations.ts` baserad på SMHI-typvärden:

```text
LOCATIONS = [
  { id, name, lat,
    monthlySnowDays:   [12 tal]  // dagar/mån med snötäckta paneler
    monthlyIrradiance: [12 tal]  // andel av årsproduktion per mån (0-1, summerar till 1)
  }
]
```

Orter (initialt 8): Malmö, Göteborg, Jönköping, Stockholm, Karlstad, Sundsvall, Östersund, Kiruna.
Värdena dokumenteras som "typvärden, kan justeras". Inga API-anrop.

### Beräkning per månad (enkel modell)

För månad `m` med dagar `D_m` och andel av årsproduktion `f_m`:

```text
dagsproduktion_m = (årsprod_kWh × f_m) / dagar_i_månaden
förlust_m_kWh    = snödagar_m × dagsproduktion_m × täckningsgrad
```

`täckningsgrad` = hur stor andel av panelytan som faktiskt är täckt en snödag (default 0,8, justerbart).

### Atmoce-styrlägen

Användaren väljer mellan tre lägen (radio):

- **Ingen snösmältning** — referensfall, ingen extra vinst, ingen elkostnad.
- **Optimerad** — smälter bara månader där `(vinst − kostnad)` är positiv och över en tröskel. Vinsten räknas månad-för-månad.
- **Full** — smälter alla månader med snödagar > 0.

Endast Atmoce kan styra per panel — referenssystem visas som "Ej möjligt" (eller marginell vinst om strängväxelriktare med optimerare som Huawei, men default 0).

### Energi- och kostnadsberäkning för smältning

Per panel och dag: `200 W × 0,25 h = 0,05 kWh`.
Per månad: `paneler × 0,05 kWh × snödagar_m`.
Kostnad: `energi_m × köppris` (samma som ekonomikalkylen).
Vinst: `återvunnen kWh × köppris` (eller spotpris för exporterad andel, samma egenanvändningsfördelning).

### Visualisering

Ny `SnowMeltCard`-sektion på `/`:

- Toppinfo: ort-dropdown, panelantal (från befintlig input), styrläge-radio, täckningsgrad-slider.
- Tabell + stapeldiagram (12 månader): snödagar, återvunna kWh, åtgången smält-kWh, nettonytta (kr).
- Sammanfattning under tabellen:
  - Total extra produktion (kWh/år) tack vare snösmältning
  - Total smält-energi (kWh/år) och kostnad (kr/år)
  - **Nettovinst snösmältning (kr/år)** + på kalkyltiden
- Textruta: "Styrning Atmoce: per-panel via mikroväxelriktare, schemalagd uppvärmning 200 W × 15 min/dag på snödagar via Atmoce-appen".

Nettovinsten matas in i huvudberäkningen som extra årlig besparing för Atmoce, vilket påverkar payback/IRR/LCOE.

## Filer som skapas/ändras

- `src/data/locations.ts` — orter + typvärden
- `src/lib/snowmelt.ts` — ren beräkningsfunktion
- `src/components/SnowMeltCard.tsx`
- `src/routes/priser.tsx` — prislista + redigering
- `src/lib/prices.functions.ts` — server fns (get/update)
- migrationsfil för `system_prices`-tabellen + RLS + seed
- `src/data/systems.ts` — behåll som fallback, exportera typer
- `src/routes/index.tsx` — sidlänk till `/priser`, integrera SnowMeltCard, använd Cloud-priser
- `src/lib/calc.ts` — addera valfri `extraAnnualSavings`-parameter

## Tekniska noteringar

- Allt UI på svenska, samma designspråk som idag.
- Snösmältnings-energin räknas på **dagligt schema** (200 W × 15 min) endast under månader/dagar med snö enligt orten.
- Prissida och snösmältning är två oberoende leveranser men levereras i samma iteration.

Säg till om något ska justeras, t.ex. fler orter, andra default-täckningsgrader, eller om prisredigering ska vara helt öppen (utan login).