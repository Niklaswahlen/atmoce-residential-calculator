## 1. Modul: Bonus från panelnivå-styrning

Ny komponent `src/components/PanelLevelBonusCard.tsx`, placerad direkt under "Växelriktarbyten" på `/`.

Innehåll:
- Stor siffra: bonus i procent (läses från `SYSTEMS.atmoce.productionBonus`, idag 8%)
- Tre nyckeltal under: **extra kWh/år**, **extra besparing kr/år** (år 1), **extra besparing kr över kalkyltiden** (odiskonterad)
- Kort förklarande text: varför mikroväxelriktare ger mer årsproduktion — (a) varje panel arbetar i sin egen MPPT så skuggning/smuts/löv på en panel inte drar ner hela strängen, (b) ingen panel-mismatch, (c) panelnivå-monitorering gör att fel upptäcks samma dag istället för månader senare
- Liten not: "Jämförelsesystemen antas ha 0% bonus, förutom Huawei med optimerare (4%)"

Beräkning: `extraKwhYear1 = kWp × yieldPerKwp × productionBonus`, `extraSavingsYear1 = extraKwhYear1 × (selfUseShare × buyPrice + exportShare × sellPrice)` — använder samma self-use-antaganden som huvudkalkylen. Ingen ändring av `calc.ts` behövs, bonusen är redan inbakad i produktionen där.

## 2. PDF-sammanfattning (max 1 A4)

Genereras klient-sidigt med `jspdf` + `jspdf-autotable` (lägg till via `bun add`). Ingen serverkod.

Layout (A4 stående, 12 mm marginal):
- **Header**: "Atmoce — Investeringskalkyl" + ortsnamn + datum, tunn delningslinje i Atmoce-coral
- **Vänsterkolumn (~55%)**: 
  - Nyckeltal-tabell: rader för Investering, Payback, IRR, NPV (25 år), LCOE — kolumner Atmoce vs valt referenssystem
  - Snösmältnings-rad: ort, läge, årlig nettovinst kr/kWh
- **Högerkolumn (~45%)**:
  - NPV-graf som PNG (renderas via dold off-screen canvas eller via `html2canvas` på den befintliga Recharts-grafen; vi väljer `html2canvas` på chart-divens ref — enklast, ingen omritning)
- **Underst (full bredd)**: 4 korta bullet-rader "Varför Atmoce": 25 års produktgaranti (inga växelriktarbyten), +8% årsproduktion via mikroväxelriktare, panelnivå-monitorering, valbar snösmältning vintertid
- **Footer**: liten disclaimer + "Genererad av Atmoce-kalkylatorn"

Knappar: `<Button>Ladda ner PDF</Button>` i sidhuvudet (bredvid "Priser"-länken) **och** sekundär knapp i nyckeltal-kortet. Båda triggar samma `generatePdf()`-funktion i `src/lib/pdf.ts`.

Beroenden att lägga till: `jspdf`, `jspdf-autotable`, `html2canvas`.

## 3. Atmoce-branding (färger + typsnitt globalt)

Baserat på den bifogade PowerPointens sunset-palett (svart/plommon → korall → lavendel/rosa himmel):

Nya semantiska tokens i `src/styles.css` (oklch):
- `--background`: varmt off-white `oklch(0.98 0.01 30)`
- `--foreground`: djup plommon `oklch(0.18 0.04 350)`
- `--primary`: Atmoce-coral `oklch(0.70 0.18 25)` (varm korall från PPT)
- `--primary-foreground`: vit
- `--accent`: lavendel-rosa `oklch(0.78 0.10 350)` (sunset-himmel)
- `--atmoce`: korall (samma som primary) — ersätter dagens gröna `--atmoce`-token
- `--atmoce-soft`: ljus rosa `oklch(0.95 0.04 25)`
- `--reference`: dovt plommon `oklch(0.45 0.06 350)`
- `--reference-soft`: `oklch(0.94 0.02 350)`
- `--card`, `--border` justeras för att passa den nya bakgrunden
- Dark mode: djup plommon-bakgrund `oklch(0.18 0.04 350)` med samma korall-accent

Typografi (laddas via `<link>` i `__root.tsx`, registreras i `@theme`):
- Display/heading: **Outfit** (geometrisk sans-serif som matchar "ATMOCE"-wordmarken)
- Body: **Inter Tight** (rent, modernt)
- Sätt `--font-display` och `--font-sans` i `@theme`, applicera `font-display` på `h1/h2`, `font-sans` på body

Ingen omarbetning av layout, ingen logotyp, inga nya komponenter — bara tokens + typsnitt. Befintliga shadcn-komponenter, NPV-grafen, knappar och kort ärver automatiskt.

## Filer som ändras / skapas

- **Nya:** `src/components/PanelLevelBonusCard.tsx`, `src/lib/pdf.ts`
- **Ändras:** `src/styles.css` (tokens + fontfamiljer), `src/routes/__root.tsx` (Google Fonts `<link>`), `src/routes/index.tsx` (mounta bonus-kortet, två PDF-knappar, ref till NPV-graf), `package.json` (jspdf, jspdf-autotable, html2canvas)
- **Inga DB-ändringar.** Inga ändringar i `calc.ts`.

## Säg till om

- Du vill ha specifika hex-värden från en officiell Atmoce-brand guide (annars matchar jag PPT-bilderna)
- PDF:en ska vara på engelska istället för svenska
- Bonus-kortet ska visa Huaweis 4% också (nu visar det bara Atmoce)
