## 1. Graf: Ackumulerat nuvärde (NPV) över kalkyltiden

Lägger till en ny linjegraf (Recharts `LineChart`) på `/` som jämför valt referenssystem mot Atmoce sida vid sida.

- X-axel: år 1..kalkyltid (default 25, kan väljas upp till 30)
- Y-axel: ackumulerat diskonterat kassaflöde (kr), börjar på `-investering` vid år 0
- Två linjer: Atmoce och valt referenssystem, distinkta färger från designsystemet
- Nollinje markerad (payback-skärning)
- Tooltip visar år + båda systemens värden

**Implementation:** Utöka `CalcResult.rows` med `cumulativeNpv` (i `src/lib/calc.ts`):
```
cumulativeNpv_t = cumulativeNpv_{t-1} + savings_t / (1+r)^t - investeringskostnader_t
```
År 0 = -investment. Inverter-byten (se nedan) läggs in som negativa kassaflöden de år de inträffar och diskonteras på samma sätt.

## 2. Modul för växelriktarbyten

Ny sektion på `/` ovanför grafen: **"Växelriktarbyten"**.

- Per referenssystem (ej Atmoce): radio/select `0 | 1 | 2 byten`
- Default härleds från garantitid: 
  - om referenssystemets `inverterWarrantyYears` < `years/2` → default 2
  - annars om < `years` → default 1
  - annars 0
- Atmoce visar alltid 0 byten (25 års garanti) och en infotext "Inga byten — 25 års produktgaranti"
- Bytestidpunkt: jämnt fördelat över kalkyltiden. 1 byte = år `round(years/2)`. 2 byten = år `round(years/3)` och `round(2·years/3)`.
- Kostnad per byte: 25 000 kr ink moms (konstant, ej indexerad — kan visas som not). Lägg som konstant `INVERTER_REPLACEMENT_COST = 25000` i `src/lib/calc.ts`.

**Beräkning:** Ny parameter `inverterReplacements: number` (0/1/2) i `CalcParams`. I `calculate()`:
- För varje bytesår `y`: dra av `25000` från `savings_y` (eller separat fält `replacementCost`) innan `cumulativeCashflow`, `npv` och `cumulativeNpv` uppdateras.
- Inkluderas också i `cashflows`-arrayen som används till IRR.
- LCOE: lägg till diskonterade bytena ovanpå investeringen i täljaren.

**UI:**
- Liten kortmodul med en rad per system: "System | Garanti växelriktare | Antal byten (0/1/2) | Total bytekostnad". Användaren kan ändra antalet byten per system.
- Resultat reflekteras direkt i jämförelsetabell, nyckeltal, payback och i den nya NPV-grafen.

## Filer som ändras

- `src/lib/calc.ts` — `inverterReplacements`, `INVERTER_REPLACEMENT_COST`, `cumulativeNpv` per år, replacement-kostnad i kassaflöde/IRR/LCOE
- `src/routes/index.tsx` — ny `InverterReplacementCard`, state per system, ny NPV-jämförelsegraf, skicka `inverterReplacements` till `calculate()`
- (Ev. ny komponent `src/components/NpvChart.tsx` och `src/components/InverterReplacementCard.tsx` för läsbarhet)

Inga DB- eller schema-ändringar. Bytekostnaden är konstant 25 000 kr — säg till om den ska vara redigerbar i UI eller per system.
