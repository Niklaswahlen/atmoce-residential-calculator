## Diagnos

I avancerat läge renderas `PanelLevelBonusCard` med `grid grid-cols-3 gap-6` (hårdkodat 3 kolumner i alla breakpoints). Värdena ("159 600 SEK" etc.) tvingar 3-kolumnsraden bredare än telefonens 390px, vilket gör att hela huvudkolumnen i sidans grid blir bredare än viewporten. Eftersom mobil-grid använder default-tracking (`auto`, inte `minmax(0,1fr)`) följer även asiden (Anläggning-kortet) med ut till samma bredd. I enkelt läge renderas kortet inte, så layouten håller sig inom skärmen.

## Åtgärder

### 1. `src/routes/index.tsx` — explicit mobile grid
Ändra ytter-griden i `<main>` så mobiltracken inte kan expandera under sina barn:
- `grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]`
- → `grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[320px_minmax(0,1fr)]`

### 2. `src/components/PanelLevelBonusCard.tsx` — responsivt stat-grid
- Wrappern `<div className="flex flex-wrap items-end gap-x-8 gap-y-3">` blir `w-full` och inre statgriden `grid grid-cols-3 gap-6` ändras till `grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6` så de tre stat-rutorna staplas på mobil och bara visas trekolumnsmässigt från `sm:`. Inget innehåll tas bort.
- Bonus-headern (`flex items-center justify-between gap-3`) får `flex-wrap` så lång titel + "Endast Atmoce"-badge wrappar istället för att tvinga bredd.

### 3. Verifiering
- Förhandsvisning i 390×844 i avancerat läge: Anläggning-kortet och PanelLevelBonusCard ska ligga inom skärmens kant och ingen horisontell scroll uppstå.
- Enkelt läge ska se ut som tidigare (PanelLevelBonusCard visas inte där).

Ingen logik eller copy ändras.