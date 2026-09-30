# Flytta PDF-knappen högst upp + en till längst ner

## Nuvarande läge
- "Sammanfattning som PDF"-knappen sitter i rubikraden på diagramkortet "Ackumulerat nuvärde" (index.tsx ~rad 1096–1106).
- Headern har redan en egen "Ladda ner PDF"-knapp — den lämnas orörd.

## Ändringar (src/routes/index.tsx)

1. **Ta bort knappen från diagramkortet** — rubikraden på "Ackumulerat nuvärde"-kortet behåller bara titeln.
2. **Knapp högst upp i resultatsektionen** — en rad direkt ovanför de två systemkorten (Atmoce vs annat system) med knappen högerställd. Samma utseende/ikoner som idag.
3. **Knapp längst ner i resultatsektionen** — efter det sista kortet (teknisk jämförelse), högerställd.
4. Båda knapparna kör samma `handleGeneratePdf` och visar "Genererar…" medan PDF:en skapas (delad `pdfLoading`-state).

## Verifiering
- `bunx tsgo --noEmit -p tsconfig.json`
- Playwright: bekräfta att knappen syns överst och underst i resultatsektionen och att den är borta från diagramkortet; klick genererar PDF utan fel i konsolen.
