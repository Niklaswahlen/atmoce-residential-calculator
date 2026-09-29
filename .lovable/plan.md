# Nya inköpspriser för Atmoce-batterimoduler

## Ändring
Uppdatera inköpspriset (exkl. moms) på de tre Atmoce-batterimodulerna i komponentlistan:

| Modell | Komponent | Nytt pris (ex moms) |
|---|---|---|
| Atmoce 7 kWh (M-ELV) | M-ELV-modulen | 27 331 kr |
| Atmoce 8 kWh | `atmoce_8_module` | 29 722 kr |
| Atmoce 8 kWh PRO | `atmoce_8_pro_module` | 36 532 kr |

## Genomförande
1. Slå upp exakt komponent-id för M-ELV-modulen (via `battery_configs.module_component_id` för konfigurationen `atmoce`) så rätt rad uppdateras.
2. Uppdatera `unit_price_ex_vat` för de tre komponenterna via databasverktyget (dataändring, ingen migration).
3. Verifiera med en läsfråga att alla tre priser stämmer.

## Resultat
Kalkylatorn räknar automatiskt om Atmoce-priset (och PDF:en) för alla tre modellerna i rullistan, eftersom priserna hämtas från komponentlistan. Ingen kodändring behövs.
