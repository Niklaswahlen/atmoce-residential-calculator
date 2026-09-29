# Byt lösenord för prissidan

## Mål
Byta lösenordet som skyddar `/priser` till ett nytt som du själv anger.

## Bakgrund
Lösenordet lagras som server-hemlighet `PRISER_ADMIN_PASSWORD` och verifieras server-side (timing-safe) av `src/lib/pricing-admin.server.ts`. Inloggningsskärmen på `/priser` testar lösenordet mot servern, så inget lösenord finns i koden.

## Åtgärd
1. Öppna det säkra formuläret för att uppdatera hemligheten `PRISER_ADMIN_PASSWORD` — du skriver in det nya lösenordet direkt i formuläret (det passerar aldrig genom chatten).
2. Klart. Inga kodändringar behövs.

## Effekt
- Gamla lösenordet (`S3nergia!`) slutar fungera direkt.
- Den som redan är inloggad i en flik (sessionStorage) kan fortsätta titta, men alla ändringar (Spara/Radera) kräver det nya lösenordet eftersom varje ändring verifieras mot servern.
- Vid nästa inloggning på `/priser` används det nya lösenordet.
