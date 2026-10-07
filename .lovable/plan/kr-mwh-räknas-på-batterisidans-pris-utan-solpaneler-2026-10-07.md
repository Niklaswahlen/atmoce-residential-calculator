# Kr/MWh räknas på batterisidans pris (utan solpaneler)

## Problem
Kostnaden per MWh genomströmning räknas idag på hela anläggningspriset
(solpaneler + växelriktare + batteri + installation). Det blir missvisande —
siffran ska spegla vad batteriet kostar per garanterad livstidsenergi.

## Lösning
Räkna kr/MWh på **batterisidans pris** (ESS-sidan: batteri + installation +
kabelage, efter GTA) — utan solpaneler och växelriktare.

Prismodellen har redan sidorna åtskilda (`pv` och `ess` med egna
koefficienter), så vi kan hämta batterisidans pris direkt:

- **Atmoce:** `sidePrice(atmoceSystem.ess, panels, atmoceModules)`
- **Referens (Solis + Dyness):** `sidePrice(refSystem.ess, panels, refModules)`
- **Eget system:** användarens inmatade totalpris används som batteripris
  (det är det enda priset som finns där).
- **Manuell pris-override:** om användaren skrivit in eget pris för Atmoce
  eller referensen används det priset (vi kan inte skilja ut batteridelen
  ur ett eget inmatat pris).

## Ändringar

### src/routes/index.tsx
- Beräkna `essPriceA` / `essPriceB` via `sidePrice(...)` (eller override
  där sådan finns).
- Skicka dessa som `investmentA` / `investmentB` till `ThroughputCard`.
- Skicka samma värden till PDF:en (nya fält i `PdfInput`).

### src/components/ThroughputCard.tsx
- Byt rubrik från "Kostnad per MWh genomströmning (hela anläggningen)"
  till "Kostnad per MWh genomströmning (batteri + installation)".
- Uppdatera förklaringstexten: priset avser batterisidan (batteri,
  installation och kabelage) efter GTA, utan solpaneler och växelriktare.

### src/lib/pdf.ts
- Genomströmningsgrafens kr/MWh-text på sida 2 räknas på batterisidans
  pris, med uppdaterad etikett.

## Verifiering
- Typecheck (`bunx tsgo --noEmit`).
- Testa i förhandsvisningen: välj Solis + Dyness, kontrollera att kr/MWh
  sjunker jämfört med tidigare (eftersom solpanelerna inte längre räknas
  med) och att siffran stämmer mot batterisidans pris.
