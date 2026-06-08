## Problem

NPV-grafen saknas i PDF:n eftersom:
1. Grafen i UI:t renderas bara i avancerat läge (`{!isSimple && ...}`). I enkelt läge är `npvChartRef.current` `null` → ingen bild i PDF:n.
2. Även i avancerat läge kan html2canvas ha problem med Recharts (SVG, CSS-variabler, oklch-färger).

## Lösning

Skippa html2canvas. Rita linjediagrammet direkt i jsPDF utifrån de befintliga NPV-raderna. Då fungerar det i alla lägen och behöver ingen DOM-graf.

## Ändringar

**`src/lib/pdf.ts`**
- Ta bort html2canvas-anropet och `chartElement`-användningen i NPV-sektionen.
- Lägg till en ny hjälpare `drawNpvChart(doc, { x, y, w, h, atmoceSeries, refSeries, atmoceLabel, refLabel, years })` som ritar:
  - Ramad ruta med titel "Ackumulerat nuvärde över N år".
  - Y-axel med 4–5 ticks (auto-skalade till min/max över båda serierna, inkl. år 0 = −investering), formaterade som "120k" / "−50k".
  - X-axel med ticks var 5:e år (0, 5, 10, …, N).
  - Horisontell nollinje (streckad, grå).
  - Två polylines i Atmoce-coral och referensgrå/plommon, med tunna prickar vid varje datapunkt.
  - Liten legend uppe till höger med färgrutor + systemnamn.
- Bygg dataserierna i `generateSummaryPdf` från `atmoceResult` och `refResult` (samma data som `npvChartData` i `index.tsx`: börja år 0 med −investering, sedan `cumulativeNpv` per år).
- Behåll övrig layout (jämförelsetabell, resultatremsa, USP-kort) på samma A4-sida.

**`src/routes/index.tsx`**
- Sluta skicka `chartElement` till `generateSummaryPdf` (parametern kan tas bort från `PdfInput`).
- `npvChartRef` kan tas bort.

## Teknisk skiss

```text
+----------------------------------------------------------+
| Ackumulerat nuvärde över 25 år           ■ Atmoce ■ Ref |
|                                                          |
|  150k |                              .─────              |
|       |                       ─────'                     |
|   0k  |───────────────────.───────────────────           |
|       |              ___.'                               |
| -100k |       ___.─'                                     |
|       └──┬────┬────┬────┬────┬────┬                      |
|          0    5   10   15   20   25                      |
+----------------------------------------------------------+
```

Implementeras med `doc.line`, `doc.setDrawColor`, `doc.setLineWidth` och `doc.text`. Inga nya bibliotek.

## Acceptanskriterier

- PDF:n innehåller NPV-grafen både i enkelt och avancerat läge.
- Grafen visar båda systemen, en nollinje, och år 0…N på x-axeln.
- Allt ryms fortfarande på en A4 utan överlapp.
