## Diagnos

På mobil (390px) blir headerns högerkolumn (Enkelt/Avancerat-växel + språkknapp + "Ladda ner PDF" + "Priser") bredare än skärmen. Eftersom den ligger i ett `grid-cols-[minmax(0,1fr)_auto]` med `shrink-0` på högerblocket, tvingar den dokumentets layoutbredd över viewporten. `overflow-x: hidden` klipper då scrollen — men `max-w-7xl mx-auto`-containrarna nedanför centreras inom den bredare layoutbredden, vilket gör att kort och inputfält "skjuts ut" till höger och ser kapade ut.

## Åtgärder

### 1. `src/components/AppHeader.tsx` — header får aldrig överskrida viewporten
- På mobil: stacka logo och kontroller i två rader med `flex-col` så ingen rad behöver vara bredare än skärmen. På `sm:` återgår vi till den horisontella layouten.
- Högerblocket blir `flex flex-wrap items-center justify-end gap-2 min-w-0` (utan `shrink-0`) så barnen kan brytas till ny rad.
- "Ladda ner PDF"-knappen visar full text endast på `sm:`; på mobil bara ikon + kort label (t.ex. "PDF") och `size="sm"` med kompakt padding. `aria-label` sätts till hela texten.
- "Priser"-länken får mindre padding på mobil och får också wrappa.
- Logo-bilden behåller `shrink-0`; texten `min-w-0 truncate`.

### 2. `src/routes/index.tsx` — säkerställ att aside-innehållet ryms
- Lägg `min-w-0` på `<aside>` så att grid-cellen kan krympa under sitt minsta innehåll utan att tvinga sidan bredare.
- `CardContent` med `grid grid-cols-2 gap-3` kompletteras med `min-w-0` på själva grid-containern, och NumField-roten får `min-w-0` så att `<Input>` (`w-full`) faktiskt krymper i smala kolumner.
- Reducera input-padding på mobil där `pr-12` + sufix gör fältet trångt: behåll `pr-12` men säkerställ att Input's `min-w-0` gör att det krymper istället för att svämma över.

### 3. Verifiering
- Efter ändringarna: öppna preview i 390×844 och kontrollera att (a) ingen horisontell scroll uppstår, (b) header-knappar wrappar snyggt, (c) alla input-fält och kort ligger inom skärmens kanter.

Inga affärslogik- eller stilsystemändringar — bara responsiv layout.