## Varför det inte går

"CT-klämmor" (`atmoce_ct_clamps`) ligger fortfarande som en rad på ESS-sidan i systemet **Atmoce** — `system_component_lines` har en rad med `qty_value = 0`, så den syns inte i kalkylen men finns kvar i databasen. Foreign key blockerar radering av komponenten och felmeddelandet "Kunde inte radera (används av ett system?)" visas.

Idag visas felet alltid generiskt oavsett orsak, vilket gör det svårt att förstå.

## Förslag

1. **Ta bort den dolda raden** för `atmoce_ct_clamps` på systemet `atmoce` (qty_value=0, sort_order=6) så komponenten kan raderas.
2. **Förbättra felhanteringen i `ComponentsTable.tsx`**:
   - Visa Supabase-felets faktiska meddelande istället för fast text.
   - Vid FK-fel (kod `23503`): lista vilka system som fortfarande använder komponenten, så användaren vet var raden ligger kvar.
3. **(Valfritt)** Lägg till en "Visa användning"-knapp på varje komponent som listar system + batterikonfigurationer den ingår i.

Vill du att jag (a) bara rensar bort den dolda raden så CT-klämmor kan raderas, (b) gör det + förbättrar felmeddelandet, eller (c) gör alla tre stegen?