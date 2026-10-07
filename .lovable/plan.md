# SAJ HS3 i genomströmningsjämförelsen

SAJ garanterar 3,06 MWh per kWh användbar energi. Batterimodulen i prislistan (SAJ HS3 batterimodul 5 kWh, BU3-5.0) räknas som 5 kWh, alltså **15,3 MWh per modul** (5 × 3,06).

## Ändringar
- Lägg till SAJ i jämförelsen av livstidsenergi med 15,3 MWh per modul, med namnet "SAJ BU3".
- Rutan i kalkylatorn och grafen i PDF:en visar då SAJ på samma sätt som Dyness och Sigenergy: värde per modul, antal moduler × MWh = total, och kr/MWh (SAJ finns redan i prislistan).

## Att observera
Om den användbara energin i BU3-5.0 är lägre än 5 kWh (t.ex. 4,6 kWh) blir värdet lägre. Skicka gärna databladets siffra, så justerar jag den.

## Tekniskt
- `src/data/throughput.ts`: `saj_hs3: 15.3` i `REF_THROUGHPUT_MWH`, `saj_hs3: "SAJ BU3"` i `REF_THROUGHPUT_LABEL`.
- Verifiera i förhandsvisningen med SAJ valt: per modul, total, kr/MWh och PDF-grafens namn.
