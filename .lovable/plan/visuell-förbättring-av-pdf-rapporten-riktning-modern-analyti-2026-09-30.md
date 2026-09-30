# Visuell förbättring av PDF-rapporten (riktning: Modern analytisk)

Målet: en ren, trovärdig säljrapport på en A4-sida — ljus, tydlig hierarki, coral #ED6A4A som enda accentfärg, plum #301E32 för mörka kort. Allt innehåll som finns idag ska vara kvar; inget avsnitt tas bort.

## Förändringar i src/lib/pdf.ts (allt ritas fortfarande med jsPDF, ingen skärmdump)

1. **Sidhuvud** — ljus istället för det tunga mörka bandet: ATMOCE-ordmärket i plum, "Investeringskalkyl — Solenergi" i versaler med bred spärning, plats + datum till höger, tunn coral-linje under hela rubriken.
2. **Nyckelvärden som kort** — dagens långa underrubrikrad blir tre separata boxar: installerad effekt (kWp), kalkyltid, jämförelse (Atmoce vs referens). Tydligare första intryck.
3. **Jämförelsetabellen** — från fulla rutnät till tunna hjälplinjer per rad (ingen yttre grid), diskret rubrikrad, vinnarmarkeringen behålls som ljusgrön cell, nyckelrader (NPV, payback) lyfts med fet stil. Kolumnen "Skillnad" är kvar.
4. **Resultatripen** — från grå rand till ett mörkt plum-kort med rundade hörn: poängställning "Atmoce 10 – 1 SAJ HS3" till vänster, snösmältningsraden till höger.
5. **NPV-grafen** — från att dominera sidan (~55 %) till en tydlig men kompakt graf (~45 mm): ljusare rutnät, tjockare coral serie, plum-referensen tunnare, legenden ovanför, kardinalpunten "Du är +X kr bättre efter 25 år" som rad under grafen.
6. **USP-kortet** — från det stora mörka blocket till ett 2×3-rutnät av ljusa kort med numrerade coral-rubriker (01–06) — lättare längst ner på sidan.
7. **Sidfot** — tunn linje ovanför, disclaimer och "Genererad av Atmoce-kalkylatorn" i diskret stil.

## Ramar

- Allt ska fortfarande rymmas på exakt en A4-sida utan överlapp (mellanrum kontrolleras av fasta mått).
- Inga ändringar i UI-koden (index.tsx), beräkningarna (calc.ts) eller innehållet — endast presentationen i pdf.ts.
- Garantier/cykler som visas i tabellen förblir oförändrade (dynamisk PDF-fix är ett separat ärende).
