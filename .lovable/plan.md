## Plan: säkerhets- och kodkvalitetsfixar

### 1. `src/lib/pricing.functions.ts` — admin-lösenord
- Ta bort konstanten `DEFAULT_ADMIN_PASSWORD`.
- Skriv om `verifyAdmin` så att den kastar `"PRISER_ADMIN_PASSWORD is not configured on the server"` när env-variabeln saknas, och `"Unauthorized"` vid felaktigt lösenord.
- Byt strängjämförelsen mot `crypto.timingSafeEqual`:
  - Importera `timingSafeEqual` och `Buffer` (Node inbyggt).
  - Om `typeof password !== "string"` eller längden skiljer sig från `expected` → `"Unauthorized"` (utan att anropa `timingSafeEqual`, för att undvika throw vid längdmismatch).
  - Annars jämför `Buffer.from(password)` mot `Buffer.from(expected)` med `timingSafeEqual`; false → `"Unauthorized"`.

Notering: användaren måste själv sätta `PRISER_ADMIN_PASSWORD` som server-secret — annars slutar `/priser`-inloggning fungera. Jag flaggar detta i svaret efter implementation.

### 2. `.gitignore` + `.env.example`
- Lägg till raden `.env` i `.gitignore` (efter befintliga `*.local`-block).
- Skapa `.env.example` med samma nycklar som `.env` men tomma värden:
  ```
  SUPABASE_PROJECT_ID=
  SUPABASE_PUBLISHABLE_KEY=
  SUPABASE_URL=
  VITE_SUPABASE_PROJECT_ID=
  VITE_SUPABASE_PUBLISHABLE_KEY=
  VITE_SUPABASE_URL=
  ```
- `.env` behålls i repo-trädet (kan inte tas bort via git-verktyg här); användaren får själv köra `git rm --cached .env` efter push.

### 3. `src/routes/index.tsx` — NumField clamp
- På rad 129 byt:
  ```ts
  const clamped = Math.max(min ?? parsed, Math.round(parsed));
  ```
  till:
  ```ts
  const clamped = Math.max(min ?? -Infinity, Math.round(parsed));
  ```

Inga andra funktionella eller stilmässiga ändringar.
