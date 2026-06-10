
## Mål

Eliminera all horisontell scroll på mobilen och göra layouten helt stabil i sidled på iOS och Android, utan att ändra funktionalitet eller affärslogik.

## Ändringar

### 1. `src/routes/__root.tsx` — viewport + global overflow-lock
- Uppdatera viewport-metan till `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover` för att hindra oavsiktlig pinch-zoom som destabiliserar layouten i sidled på iOS/Android.
- Lägg till `className="overflow-x-hidden"` på `<html>` och `<body>` i `RootShell` så hela dokumentet är låst i sidled.

### 2. `src/styles.css` — globala skyddsregler
Lägg till i `@layer base`:
```css
html, body {
  max-width: 100%;
  overflow-x: hidden;
  overscroll-behavior-x: none;
  -webkit-text-size-adjust: 100%;
}
#root { max-width: 100%; overflow-x: hidden; }
img, svg, video, canvas { max-width: 100%; height: auto; }
```
Detta säkerställer att inga bilder, ikoner eller absolut-positionerade element kan tvinga fram horisontell scroll.

### 3. `src/routes/index.tsx` — wrappers och tabeller
- Lägg `min-w-0` på flex/grid-barn där lång text annars tvingar förälderns bredd.
- Wrappa breda `<Table>`-element i `<div className="w-full overflow-x-auto">` så själva tabellen kan scrolla internt, men inte sidan.
- Recharts `ResponsiveContainer` får en wrapper `<div className="w-full min-w-0">` för att inte tvinga ut bredden.
- Säkerställ att top-level `main`/section-containers använder `w-full max-w-full overflow-x-hidden` istället för fasta breddar.

### 4. `src/components/AppHeader.tsx` — responsiv header
- Byt `flex flex-wrap` på header-raden mot mönstret från instruktionerna: `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:flex-wrap sm:justify-between`.
- Lägg `min-w-0` på logo-länken och `shrink-0` på språk/läge-knapparna, plus `truncate` på subtitle.
- Reducera horisontellt padding på små skärmar (`px-4 sm:px-6`).

### 5. Snabb verifiering
- Bygget körs automatiskt; efter det öppnar jag förhandsvisningen i mobilviewport (390px) och kontrollerar att inga element överskrider skärmens bredd och att sidan inte kan scrollas i sidled.

## Det jag INTE ändrar

- Ingen logik i `calc.ts`, `pdf.ts`, prismotor eller datakällor.
- Inga ändringar i färgsystem eller typografi.
