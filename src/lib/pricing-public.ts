// Client-safe pricing types. NEVER add cost basis, unit prices, margin, VAT,
// or GTA percentages to these types — they must be safe to ship to the
// browser.

export interface SidePriceCoeffs {
  /** Constant SEK component of the final price (after margin, VAT, GTA). */
  base: number;
  /** SEK per solar panel. */
  perPanel: number;
  /** SEK per battery module. */
  perModule: number;
}

export interface PublicSystemPricing {
  id: string;
  name: string;
  short: string;
  pv: SidePriceCoeffs;
  ess: SidePriceCoeffs;
  batteryKwhPerModule: number;
  defaultBatteryModules: number;
  minModules: number;
  maxModules: number;
  sortOrder: number;
}

export interface PublicPricingPayload {
  systems: PublicSystemPricing[];
  defaults: { panels: number; wpPanel: number };
}

export function priceFromCoeffs(
  c: SidePriceCoeffs,
  panels: number,
  modules: number,
): number {
  return c.base + c.perPanel * panels + c.perModule * modules;
}