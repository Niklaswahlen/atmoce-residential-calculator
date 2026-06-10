## Diagnos

I `src/routes/index.tsx` (rad ~480) använder fältet "Atmoce batterimoduler" `NumField`, vars onChange direkt parsar och clampar:

```ts
onChange={(v) => setAtmoceModulesState(Math.max(1, Math.round(v)))}
```

Och `NumField` i sin tur kör `parseFloat(e.target.value) || 0` på varje tangenttryckning.

När användaren på mobil markerar "12" och raderar "1" blir fältet tomt → parseFloat=NaN → 0 → clampas till 1 → fältet visar "1". Nästa tangent "2" appendas → "12". Det är därför man inte kan ändra till "2".

## Åtgärd

Låt användaren skriva fritt och clampa först vid blur, så de själva kan välja antal batterier utan att inputen tvångsskrivs om mitt i redigeringen.

### `src/routes/index.tsx`

1. Lokal redigerings-state för Atmoce batterimoduler som håller råsträngen medan användaren skriver.
2. Byt ut `NumField` på den raden mot en `Input` (eller en ny `NumFieldEditable`) med:
   - `type="number"`, `inputMode="numeric"`, `min={1}`, `step={1}`
   - `value` = lokal sträng (tom tillåten under redigering)
   - `onChange`: uppdaterar bara den lokala strängen, ingen clamp
   - `onBlur`: parsar, clampar till heltal ≥ 1 och anropar `setAtmoceModulesState`; faller tillbaka till föregående värde om tomt
   - Behåll `suffix` (`{fmtNum(atmoce.batteryKwh, 1)} kWh`) genom samma wrapper-layout som `NumField` använder
3. Synka lokal sträng när `atmoceModules` ändras utifrån (t.ex. när referenssystem byts) via `useEffect`.

Ingen ändring av beräkningar, referenssystem-matchning eller övriga fält. Endast denna input påverkas.

## Verifiering

I 390×844 preview:
- Markera "12", radera, skriv "2" → fältet visar "2" och kWh-suffix uppdateras till `14,0 kWh`.
- Backspace ett tecken i taget från "12" till tomt → fältet förblir tomt under redigering; vid blur återställs till sista giltiga värde (eller 1).
- Skriv "0" eller blanka → vid blur clampas till 1.
