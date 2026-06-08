
## 1. Branding & header
- Ladda upp `ATMOCE-LOGO.png` och `image-2.png` (bakgrund) via lovable-assets och importera som pointer-JSON.
- Bygg om `<header>` i `src/routes/index.tsx` (och spegla i `priser.tsx`) till en gemensam komponent `src/components/AppHeader.tsx`:
  - Bakgrundsbilden täcker headern med mörk overlay för läsbarhet.
  - Atmoce-loggan till vänster (klickbar → "/").
  - Höger sida: läges-toggle (Enkelt/Avancerat), språkflagga (🇸🇪/🇬🇧), "Ladda ner PDF", "Redigera priser".

## 2. Översättning (i18n)
- Lägg till lättviktig egen i18n (ingen ny lib): `src/lib/i18n.tsx` med `LanguageProvider` + `useT()`-hook, lagring i `localStorage`, default `sv`.
- Strängkatalog `src/lib/i18n/sv.ts` och `en.ts` för all UI-text (rubriker, kortnamn, etiketter, knappar, PDF-rubriker).
- Liten flagg-knapp i header som togglar `sv ↔ en`.
- Provider monteras i `src/routes/__root.tsx` runt `<Outlet/>`.

## 3. Enkelt vs Avancerat läge
- Lägg till `mode: "simple" | "advanced"` i samma provider (eller separat `ModeProvider`), lagrat i localStorage, default `simple`.
- Toggle i header (segmented control: "Enkelt | Avancerat").

### Enkelt läge (slutkund)
Visar endast:
- Anläggning (paneler + Wp/panel)
- Referenssystem-val
- De två system-korten (Atmoce vs referens) med förenklade nyckeltal: Investering, Total besparing, Payback, Mer producerad el.
- Snösmältnings-kort i kompakt form, **alltid optimerat läge** (sätter `snowState.mode = "optimized"` och döljer kontrollerna).
- Endast grafen **Kumulativ besparing** (cashflow).
- Knapp "Ladda ner PDF".

Döljer i enkelt läge:
- Korten "Produktion & elpris", "Användning", "Kalkyl" (använder defaultvärden).
- Panelnivå-bonus-kort, växelriktarbyten-kontroll.
- NPV-grafen, produktionsgrafen, jämförelsetabellen.
- Snösmältnings-detaljer (graf/månadstabell).

### Avancerat läge
- Allt som idag (oförändrad funktionalitet).

## 4. Förenkling av data i enkelt läge
- Större typografi i system-korten, färre rader, tydliga labels på valt språk.
- Delta-strip förenklas till en mening: "Med Atmoce får du ca **+X kWh** och **+Y kr** över Z år."

## 5. Tekniska detaljer
- Filer som skapas: `src/components/AppHeader.tsx`, `src/lib/i18n.tsx`, `src/lib/i18n/sv.ts`, `src/lib/i18n/en.ts`, `src/lib/mode.tsx` (eller del av i18n).
- Filer som ändras: `src/routes/__root.tsx` (providers + header borttagen från sidor → AppHeader), `src/routes/index.tsx` (mode-villkorad rendering, tvinga snowState optimized i simple), `src/routes/priser.tsx` (header), `src/components/SnowMeltCard.tsx` (compact-prop), `src/lib/pdf.ts` (översatta rubriker).
- Inga ändringar i `src/lib/calc.ts`.

Vill du gå vidare med detta, eller justera något (t.ex. behålla någon ytterligare graf i enkelt läge, eller annan default-mode)?
