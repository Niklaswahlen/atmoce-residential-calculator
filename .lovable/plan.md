# Flytta ner "Annat system (referens)" så systemvalet ligger centrerat jämte Atmoce

## Mål
I kortet "Dina siffror" på startsidan ska rutan "Annat system (referens)" flyttas ner så att
"Välj system"-rullistan hamnar på samma rad som "Atmoce batterimodell"-rullistan, centrerad
mitt emot Atmoce-kolumnen. Inget innehåll tas bort eller ändras — bara placering.

## Nuvarande läge (verifierat i src/routes/index.tsx ~518–775)
Kortet "Dina siffror" har ett rutnät `lg:grid-cols-2` med två kolumner:
- **Kolumn 1 (Anläggning & Atmoce batteri):** snabbvalsknappar (10/15/20 paneler), antal
  solpaneler + Wp/panel, total-ruta, "Atmoce batterimodell"-rullista + garantitext,
  Atmoce batterimoduler, kWh-jämförelserad, Atmoce-prisruta.
- **Kolumn 2 (Annat system (referens)):** börjar längst upp med "Välj system"-rullistan,
  sedan batterimoduler, prisruta.

Därför ligger systemvalet uppe till höger medan Atmoce:s motsvarande val ligger mitt i
vänsterkolumnen — de två rullistorna ligger inte jämte varandra.

## Ändring
Dela upp de två kolumnerna i horisontella rader (varje rad är en `grid gap-2
lg:grid-cols-2`), så att motsvarande block garanterat hamnar på samma höjd:

```text
Rad 1:  [snabbval + paneler + Wp + total]      (höger sida tom)
Rad 2:  [Atmoce batterimodell + garanti]       [Annat system (referens) + Välj system]
Rad 3:  [Atmoce batterimoduler + kWh-jämförelse] [Batterimoduler referens + kWh-summa]
Rad 4:  [Atmoce-prisruta]                      [Referensprisruta]
Rad 5:  [Estimera kostnad — spänner över båda kolumnerna]
```

- "Eget system…"-fältet (batterikapacitet, effektivitet, garantier) behåller sin plats i
  rad 3/4-området på höger sida när det alternativet är valt.
- På mobil (under lg) staplas allt som idag, ovanpå varandra i samma ordning.
- Endast filen `src/routes/index.tsx` ändras (sektionen "Dina siffror").
- Ingen beräkningslogik, ingen databas, ingen ändring av fält eller värden.
