# Ombyggnad av "Dina siffror" + auto-matchning + tusentalsseparator

Ändringar sker i `src/routes/index.tsx` (och `NumField`-komponenten där). Ingen backend, ingen prismodell, ingen snösmältningslogik rörs.

## 1. Tusentalsseparator i `NumField`

- Ny hjälpare `formatWithSpaces(n)` som returnerar `"98 156"` när `Math.abs(n) >= 1000`, annars vanlig sträng.
- I `editable`-varianten:
  - `<Input type="text" inputMode="numeric">` (byte från `number` för att kunna visa mellanslag).
  - `draft` visas formaterad när fältet inte är fokuserat; vid fokus visas rå siffra (utan mellanslag) så användaren kan redigera.
  - Vid `onBlur`: strippa alla whitespace, `parseFloat`, klämma/avrunda som idag, spara och visa formaterat.
- Icke-`editable` (live) varianten behålls som `type="number"` (kan inte formatera mellanslag i number-inputs) — dessa fält är enkla i sidopanelen och behåller nuvarande beteende, men får max ett decimalseparator-fall via samma visningsformel där så är säkert. **Beslut:** för att uppfylla "alla numeriska fält ≥ 1000" byggs även ickeditable om till `type="text"` med samma format/parse-flöde.
- Suffix-hantering, `min`, `step`, disabled-state oförändrat.

## 2. Ny toppmodul "Dina siffror" — tre kolumner

Layout: `grid gap-4 lg:grid-cols-3` (staplas på mobil). Varje kolumn är ett `div` med rubrik + fält.

### Kolumn 1 — Anläggning + Atmoce batteri
- **Antal solpaneler** (`params.panels`, editable, min 1)
- **Wp/panel** (`params.wpPerPanel`, editable, suffix `W`)
- Liten rad: `Total: {kWp} kWp`
- **Atmoce batterimoduler** (`atmoceModules`, editable, min 1, suffix `{kWh} kWh`) — flyttad hit från sidopanelen

### Kolumn 2 — Annat system (referens)
- Dropdown `Annat system (referens)` — samma alternativ som idag (alla utom Atmoce + "Eget system…").
- **Batterimoduler** (nytt fält) — antal moduler för valt referenssystem. Vid ändring:
  - `setRefKwhOverride(modules * refUnitKwh)` så resten av kalkylen följer.
  - När fältet lämnas oförändrat följer det auto-matchat värde (`refModulesAuto`).
- Läsvärde: `{modules} × {unitKwh} kWh = {totalKwh} kWh`.
- Vid "Eget system" ersätts modulfältet av dagens custom-inputs (kWh, round-trip, garantier).

### Kolumn 3 — Priser
- **Kostnad Atmoce (ink moms efter GTA)** — `PriceField` med override + estimat (som idag).
- **Kostnad annat system (ink GTA)** — `PriceField` med override + estimat.
- Knapp **"Estimera kostnad"** (nollställer prisoverrides + refKwhOverride, som idag).

## 3. Auto-matcha Atmoce-moduler till referensens kWh

Ny effekt / härledd logik:
- Beräkna `refKwhTotal = refModules * refUnitKwh` (eller `customBatteryKwh`).
- Beräkna `atmoceModulesMatched = max(1, round(refKwhTotal / atmoceUnitKwh))`.
- Så länge användaren inte manuellt har rört Atmoce-moduler efter senaste ref-ändring, sätt `atmoceModulesState = atmoceModulesMatched`.
- Implementation: `useEffect` som kör när `refKwhTotal` ändras och uppdaterar `atmoceModulesState` till matchat värde. När användaren själv ändrar Atmoce-fältet är det bara ett vanligt state-set — nästa ref-ändring skriver över igen (samma UX som "auto-fyll").
- Visa i kolumn 1 en liten info-rad: `Atmoce {atmoceKwh} kWh ↔ Annat {refKwh} kWh` så användaren ser jämförelsen.

## 4. Städning av sidopanelen ("Anläggning")

- Ta bort `NumField` för `panels` och `wpPerPanel` från `Anläggning`-kortet (rad ~575–586).
- Ta bort `Total: {kWp} kWp`-raden där (visas nu i toppmodulen).
- Ta bort hela sidopanel-kortet `"Atmoce batteri"` (rad ~691–726) — flyttat till toppmodulen.
- Om `Anläggning`-kortet blir tomt efter borttagning: ta bort hela kortet.

## 5. Övrigt

- `refModulesEffective` blir källa; `refKwhEffective = refModulesEffective * refUnitKwh` när icke-custom.
- `PriceField` / `KwhField` — inga API-ändringar, men interna number-inputs uppdateras via samma format-helper.
- PDF, snösmältning, grafer, nedre resultat — oförändrat.

## Tekniska detaljer (utvecklarnoter)

- `formatWithSpaces` använder `n.toLocaleString('sv-SE').replace(/\u00a0/g, ' ')` för att få vanliga blanksteg (svensk locale ger non-breaking space som default).
- Parse: `parseFloat(str.replace(/\s+/g, '').replace(',', '.'))`.
- Vid fokus behåll rå redigerbar sträng (t.ex. `98156`), formattera först vid blur — undviker markörhopp när användaren skriver.
- Uppdatera `<Input type="text" inputMode="numeric" pattern="[0-9\s.,\-]*">`.
- Auto-match-effekten: guard mot loop genom att endast sätta `atmoceModulesState` om värdet faktiskt skiljer sig från beräknat matchat.
