## Mål

En enkelsidig webapp där användaren matar in grundparametrar för ett solenergisystem (14 paneler à 460 Wp = 6,44 kWp som default) och får en sida-vid-sida-jämförelse mellan **Atmoce** och ett valbart **referenssystem**. Fokus: ekonomi (LCOE, payback, IRR) och produktion över kalkyltiden.

## System (hårdkodad prislista 2026)

Hex systempriser läggs i `src/data/systems.ts` så de är lätta att redigera:

| System | PV (SEK) | ESS (SEK) | Tot (SEK) |
|---|---|---|---|
| Atmoce | 62 918,75 | 60 335,16 | 123 253,91 |
| Solis+Dyness Stack100 | 65 062,50 | 32 531,25 | 97 593,75 |
| Sigenergy | 74 265,00 | 56 211,72 | 130 476,72 |
| SAJ HS3 | 69 687,50 | 40 677,34 | 110 364,84 |
| Solis + Qapasity | 65 062,50 | 47 937,50 | 113 000,00 |
| Huawei (m. Optimerare) | 72 718,75 | 50 359,38 | 123 078,13 |

Per system lagras även: garantitid växelriktare (år), garantitid batteri (år/cykler), specifik produktionsbonus (%, default 0 för referens, justerbart för Atmoce pga mikroväxelriktare/skuggtolerans), batterieffektivitet (round-trip %), och batterikapacitet (kWh). Default-värden sätts rimligt men kan ändras i koden.

## Input-parametrar (UI)

Vänsterpanel med formulärfält + sliders, gemensamma för båda systemen:

- **Anläggning**: Antal paneler (default 14), Wp/panel (default 460) → kWp beräknas
- **Produktion**: Årsproduktion (kWh/kWp/år, default 950), Atmoce-bonus (%, default 5–8 — justerbart)
- **Elpris**: Köppris (SEK/kWh), Spotpris sälj (SEK/kWh), Årlig prisökning (%)
- **Användning**: Egenanvändning utan batteri (%), Egenanvändning med batteri (%), Batteri round-trip-verkningsgrad (%)
- **Kalkyl**: Kalkyltid (år, default 25), Diskonteringsränta (% för LCOE/NPV), Årlig degradering paneler (%, default 0,5)
- **Val av referenssystem**: dropdown (5 alternativ) — Atmoce är alltid System A

## Beräkningar (ren funktion `calculate(system, params)`)

För varje system per år `t = 1..N`:
- Produktion `kWh_t = kWp × årsprod × (1 + bonus) × (1 − degradering)^(t−1)`
- Egenanvänd el = kWh_t × egenanv% (med batteri) × batteri-ηrt
- Såld el = kWh_t − egenanv
- Besparing_t = egenanv × elpris_t + såld × spotpris_t (elpris_t räknas upp med prisökning)
- Kassaflöde_t = Besparing_t (år 0 = −investering)

Nyckeltal:
- **Total producerad kWh** över kalkyltiden
- **Extra kWh från Atmoce** (Atmoce − referens)
- **Payback** (år då kumulativ besparing ≥ investering, linjärt interpolerat)
- **IRR** (Newton-Raphson på kassaflödesserien)
- **LCOE** = (Investering + Σ drift-NPV) / Σ (kWh_t / (1+r)^t)  [drift = 0 i basversion, kan utökas]
- **NPV @ diskontering**

## UI / sidor

En route: `src/routes/index.tsx` (ersätter placeholder).

Layout:
1. **Header** — titel "Solsystem-jämförelse 2026", undertext.
2. **Input-panel** (vänster, sticky på desktop) — alla parametrar grupperade i kort.
3. **Resultat** (höger):
   - **Sida-vid-sida kort**: Atmoce vs Referens — investering, total produktion, total besparing, payback, IRR, LCOE.
   - **Delta-rad**: "Atmoce ger X kWh mer / Y kr mer / Z år snabbare payback".
   - **Graf**: Recharts LineChart — kumulativ kassaflöde över år för båda systemen + en streckad linje för investering. Andra graf: stapel för årlig produktion.
   - **Parameterjämförelse-tabell**: garantitid växelriktare, garantitid batteri, batterikapacitet, round-trip-effektivitet, kr/Wp, kr/kWh.

Allt beräknas reaktivt via `useMemo` när input ändras — ingen backend behövs.

## Designriktning

Ren, teknisk B2B-känsla — mörk topp/ljus bakgrund, generösa siffror, mono-font för nyckeltal. Atmoce-kolumnen får accent-färg (grön) för att visuellt markera fördelen. Tailwind + shadcn (Card, Tabs, Input, Select, Slider, Table) som redan finns.

## Filer som skapas/ändras

- `src/data/systems.ts` — prislista + per-system-default (garanti, batteri-kWh, etc.)
- `src/lib/calc.ts` — rena beräkningsfunktioner (LCOE, IRR, payback, produktion per år)
- `src/components/InputPanel.tsx` — alla parameterfält
- `src/components/ResultCards.tsx` — Atmoce vs referens-kort
- `src/components/ComparisonChart.tsx` — Recharts kumulativ besparing
- `src/components/ParameterTable.tsx` — teknisk jämförelse
- `src/routes/index.tsx` — sätter ihop allt, ersätter placeholder
- `src/routes/__root.tsx` — uppdatera title/description meta

## Tekniska detaljer

- Bunda `recharts` (`bun add recharts`) — redan vanlig i shadcn-stack.
- All state lokalt med `useState` + `useMemo`. Inga server-funktioner, ingen Lovable Cloud.
- Siffror formateras `sv-SE` med `Intl.NumberFormat` (mellanslag som tusentalsavgränsare, SEK).
- IRR-implementation: iterativ Newton-Raphson, fallback till bisektion om den divergerar.

## Ej med i denna iteration (kan läggas till senare)

- PDF-export
- Sparade scenarier (kräver inloggning/Cloud)
- Faktisk timdata / soltimme-simulering — vi använder årssnitt

Säg till om något ska justeras (t.ex. default-värden för Atmoce-bonus, garantitider, eller om PDF-export ska in direkt) så bygger jag.