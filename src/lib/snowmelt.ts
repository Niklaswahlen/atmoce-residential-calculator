import { LOCATIONS, MONTH_DAYS, MONTH_NAMES, type LocationData } from "@/data/locations";

export type SnowMeltMode = "none" | "optimized" | "full";

/**
 * Snöfallsdagar är typiskt molniga — den "återvinningsbara" produktionen om
 * snön smälts bort motsvarar därför bara en bråkdel av den genomsnittliga
 * dagsproduktionen för månaden (som antar klar himmel).
 */
export const SNOW_DAY_IRRADIANCE_FACTOR = 0.4;

export interface SnowMeltParams {
  locationId: string;
  panels: number;
  wpPerPanel: number;
  yieldPerKwp: number;
  buyPrice: number;
  coverageFactor: number; // 0-1, hur stor andel av panelytan som blockeras vid snö
  meltPowerW: number; // W per panel, t.ex. 200
  meltMinutesPerDay: number; // t.ex. 15
  mode: SnowMeltMode;
}

export interface MonthlySnowRow {
  month: string;
  snowDays: number;
  potentialKwh: number; // återvinningsbar produktion om snöfritt
  meltKwh: number; // åtgången el för smältning
  meltCost: number;
  recoveredValue: number; // värde av återvunnen kWh (egenanv-pris)
  netBenefit: number;
  applied: boolean;
}

export interface SnowMeltResult {
  rows: MonthlySnowRow[];
  totalRecoveredKwh: number;
  totalMeltKwh: number;
  totalMeltCost: number;
  totalRecoveredValue: number;
  totalNetBenefit: number;
  annualProductionKwh: number;
  location: LocationData;
}

export function calculateSnowMelt(p: SnowMeltParams): SnowMeltResult {
  const loc = LOCATIONS.find((l) => l.id === p.locationId) ?? LOCATIONS[0];
  const kWp = (p.panels * p.wpPerPanel) / 1000;
  const annualProduction = kWp * p.yieldPerKwp;
  const meltKwhPerPanelDay = (p.meltPowerW / 1000) * (p.meltMinutesPerDay / 60);

  const rows: MonthlySnowRow[] = loc.monthlyIrradiance.map((frac, m) => {
    const monthProd = annualProduction * frac;
    const dayProd = monthProd / MONTH_DAYS[m];
    const snowDays = loc.monthlySnowDays[m];
    const potentialKwh =
      snowDays * dayProd * p.coverageFactor * SNOW_DAY_IRRADIANCE_FACTOR;
    const meltKwh = p.panels * meltKwhPerPanelDay * snowDays;
    const meltCost = meltKwh * p.buyPrice;
    const recoveredValue = potentialKwh * p.buyPrice;
    const netBenefit = recoveredValue - meltCost;

    let applied = false;
    if (p.mode === "full" && snowDays > 0) applied = true;
    if (p.mode === "optimized" && netBenefit > 0) applied = true;

    return {
      month: MONTH_NAMES[m],
      snowDays,
      potentialKwh: applied ? potentialKwh : 0,
      meltKwh: applied ? meltKwh : 0,
      meltCost: applied ? meltCost : 0,
      recoveredValue: applied ? recoveredValue : 0,
      netBenefit: applied ? netBenefit : 0,
      applied,
    };
  });

  const sum = (k: keyof MonthlySnowRow) =>
    rows.reduce((acc, r) => acc + (r[k] as number), 0);

  return {
    rows,
    totalRecoveredKwh: sum("potentialKwh"),
    totalMeltKwh: sum("meltKwh"),
    totalMeltCost: sum("meltCost"),
    totalRecoveredValue: sum("recoveredValue"),
    totalNetBenefit: sum("netBenefit"),
    annualProductionKwh: annualProduction,
    location: loc,
  };
}