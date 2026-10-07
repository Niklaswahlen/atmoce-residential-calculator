# Huawei LUNA2000 in the comparison

Huawei gets the same treatment as Dyness and Sigenergy: a real battery model in the price list, and its guaranteed lifetime energy of **19,23 MWh per 7 kWh module** in the throughput comparison and in the PDF.

## What we know already

- Huawei is selectable in the reference dropdown, but it has no entry in the price list's system table. Its prices today come from a hardcoded fallback that does not follow the number of panels or battery modules, and the calculator assumes its module is 5,12 kWh.
- The price list already has an article "Huawei S1 14 kWh batteri" (54 460 kr exkl. moms). It stays exactly as it is, as you decided.
- The guaranteed-energy figures live in a small file that today only holds Dyness and Sigenergy. Huawei is missing there, which is why the battery comparison box and the PDF chart do not appear when Huawei is selected.

## Step 1 - Prices you will provide

You chose to write in the prices. I need these numbers before I touch the database:

Battery side (ess):
1. Price per 7 kWh module, exkl. moms
2. Base / BMS / HV-box, if any (otherwise none)
3. Installation of the battery
4. Cabling and misc for the battery

Solar side (pv):
5. Huawei hybrid inverter
6. Optimizers, per panel

If you do not have the solar-side numbers, I will keep Huawei's solar price as the fixed figure it uses today so nothing else changes while we wait.

## Step 2 - Huawei becomes a priced system

- A 7 kWh battery module article in the price list, at the price you give.
- A Huawei battery model: 7 kWh per module, 1-8 modules, 10 years / 6000 cycles.
- A Huawei system entry with its battery and installation lines, so its price follows the number of panels and modules like the other systems.
- The 14 kWh article is left untouched and stays out of the calculator's model list.

## Step 3 - The guaranteed-energy figure

- Add 19,23 MWh per module for Huawei.
- Name it "Huawei LUNA2000" in the comparison box and in the PDF, with the module size shown the same way as the others: "Huawei LUNA2000 7 kWh".
- The comparison box, the cost-per-MWh row, the PDF table row and the PDF bar chart all pick this up automatically once Huawei is a priced system.

## Step 4 - Check it

- Typecheck and the running preview.
- Select Huawei in the calculator: the battery comparison box shows 19,2 MWh per module and the correct total, the module count follows Atmoce's capacity in 7 kWh steps, and cost per MWh appears for both systems.
- Generate the PDF and confirm the second page's chart names Huawei LUNA2000 with the right bars.
- Confirm Atmoce, Dyness and Sigenergy still show the numbers they show today, and that the page still has no sideways scrolling on a phone.

## Technical details

- `src/data/throughput.ts`: add `huawei: 19.23` to `REF_THROUGHPUT_MWH` and `huawei: "Huawei LUNA2000"` to `REF_THROUGHPUT_LABEL`. No other code change is needed for the figures to appear: `src/routes/index.tsx` gates the box on `REF_THROUGHPUT_MWH[referenceId]`, and the PDF already receives the reference label.
- Database: one migration inserting rows only, no new tables and no schema or policy changes.
  - `components`: `huawei_luna2000_7` (category `battery_module`, side `ess`, `unit_kwh` 7, your price exkl. moms).
  - `system_configs`: `huawei` with name "Huawei (med Optimerare)", short "Huawei", default 2 modules, sort order 5, pointing at the new battery model.
  - `battery_configs`: `huawei_luna2000`, module `huawei_luna2000_7`, no base or BMS unless you give one, min 1, max 8, 10 years / 6000 cycles.
  - `system_component_lines`: battery-side installation and cabling lines, plus solar-side lines. Inserted in that order because the lines reference the system row.
- Why the solar side matters: with a system row but no solar lines, the calculator would price Huawei's solar side at zero instead of today's fixed figure. So either the solar lines are added, or the existing fixed price is kept as an override on the system row until the numbers arrive.
- The reference module size comes from the price list once the system row exists, so the 5,12 kWh fallback in `src/routes/index.tsx` no longer applies to Huawei and the module count becomes correct.
- Huawei's 4 % production bonus from optimizers is already part of its system spec and is unaffected.
- Out of scope, noted for later: "Solis + Qapasity" is selectable in the dropdown but, like Huawei today, has no entry in the price list.
