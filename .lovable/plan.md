# PDF: fler nyckeltal + luftigare tvåsidig layout

## Mål
PDF:en ska innehålla fler viktiga punkter från kalkylatorn och andas mer. Den blir två A4-sidor istället för en trång sida.

## Nya rader i jämförelsetabellen
1. **Batteristorlek (kWh)** — t.ex. 14,0 kWh vs 10,2 kWh, med skillnadskolumn. Högre vinner.
2. **Batterigaranti** — år + cykler per system (t.ex. "15 år / 10 000 cykler"). Hämtas dynamiskt från vald Atmoce-batterimodell (M-ELV/8 kWh/8 kWh PRO) och referenssystemets värden — inte hårdkodat.
3. **Pris per kWh batteri** — ESS-pris delat på batteristorlek, rättvist mått oavsett storlek. Lägre vinner.

## Ny layout: två sidor

**Sida 1 — Sammanfattning och jämförelse**
- Sidhuvud som idag (ATMOCE-ordmärke, coral-linje, plats + datum).
- Tre nyckelvärdes-boxar (kWp, kalkyltid, jämförelse) — något högre och luftigare.
- Jämförelsetabellen med de tre nya raderna (totalt 14 rader), ökad radhöjd och mer mellanrum — vinnarmarkering och skillnadskolumn behålls.
- Resultatkortet (ställning + snösmältning) under tabellen med gott om luft runt.

**Sida 2 — Graf och argument**
- Eget litet sidhuvud (tunn coral-linje + "ATMOCE" diskret).
- NPV-grafen större (kan nu få ~90–100 mm höjd) med takeaway-raden under.
- USP-korten i 2×3-rutnät med mer luft mellan korten.
- Sidfot med disclaimer på båda sidorna.

## Tekniskt
- Endast `src/lib/pdf.ts` ändras, plus att `PdfInput` får nya fält (batteri-garanti år/cykler för båda systemen) som skickas in från `src/routes/index.tsx` vid knapptrycket.
- jsPDF native som idag, inga skärmdumpar. Inget innehåll tas bort, inga beräkningar ändras.
- Verifiering: generera PDF i sandboxen, konvertera till bilder och kontrollera att inget överlappar eller kapas på någon av sidorna.
