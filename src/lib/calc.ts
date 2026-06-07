import type { SystemSpec } from "@/data/systems";

export interface CalcParams {
  panels: number;
  wpPerPanel: number;
  yieldPerKwp: number; // kWh/kWp/år
  buyPrice: number; // SEK/kWh
  sellPrice: number; // SEK/kWh
  priceInflation: number; // 0.03 = 3%
  selfUseNoBattery: number; // 0-1
  selfUseWithBattery: number; // 0-1
  years: number;
  discountRate: number; // 0-1
  degradation: number; // 0-1 per år
  /** Extra årlig besparing (kr) som adderas till varje års kassaflöde — t.ex. snösmältning. */
  extraAnnualSavings?: number;
  /** Extra årlig produktion (kWh) som adderas till total produktion — t.ex. snösmältning. */
  extraAnnualKwh?: number;
  /** Antal växelriktarbyten under kalkyltiden (0, 1 eller 2). */
  inverterReplacements?: number;
}

export interface YearRow {
  year: number;
  production: number;
  selfUsed: number;
  exported: number;
  savings: number;
  cumulativeCashflow: number;
  /** Bytekostnad detta år (positivt = utgift). */
  replacementCost: number;
  /** Ackumulerat diskonterat nuvärde (kr), inkluderar investering år 0. */
  cumulativeNpv: number;
}

export interface CalcResult {
  kWp: number;
  investment: number;
  totalProduction: number;
  totalSavings: number;
  payback: number | null; // år, null om aldrig
  irr: number | null;
  npv: number;
  lcoe: number; // SEK/kWh
  rows: YearRow[];
  /** År där växelriktarbyte sker. */
  replacementYears: number[];
  /** Total odiscontterad bytekostnad. */
  totalReplacementCost: number;
}

export const INVERTER_REPLACEMENT_COST = 25_000;

export function getReplacementYears(years: number, replacements: number): number[] {
  if (replacements <= 0) return [];
  if (replacements === 1) return [Math.round(years / 2)];
  return [Math.round(years / 3), Math.round((2 * years) / 3)];
}

export function calculate(system: SystemSpec, p: CalcParams): CalcResult {
  const kWp = (p.panels * p.wpPerPanel) / 1000;
  const investment = system.pvPrice + system.essPrice;

  const rows: YearRow[] = [];
  let cum = -investment;
  let totalProduction = 0;
  let totalSavings = 0;
  const cashflows: number[] = [-investment];
  let npv = -investment;
  let cumNpv = -investment;

  const replacements = p.inverterReplacements ?? 0;
  const replacementYears = getReplacementYears(p.years, replacements);
  const replacementSet = new Set(replacementYears);
  let totalReplacementCost = 0;

  for (let t = 1; t <= p.years; t++) {
    const degr = Math.pow(1 - p.degradation, t - 1);
    const production = kWp * p.yieldPerKwp * (1 + system.productionBonus) * degr;

    // Andel av produktionen som kan användas i huset (med batteri och round-trip)
    const directSelfUse = production * p.selfUseNoBattery;
    const remaining = production - directSelfUse;
    const batteryUseGross = Math.min(
      remaining,
      production * (p.selfUseWithBattery - p.selfUseNoBattery),
    );
    const batteryUseNet = batteryUseGross * system.batteryRoundTrip;
    const selfUsed = directSelfUse + batteryUseNet;
    const exported = Math.max(0, production - selfUsed);

    const priceFactor = Math.pow(1 + p.priceInflation, t - 1);
    const buy = p.buyPrice * priceFactor;
    const sell = p.sellPrice * priceFactor;
    const extraSavings = (p.extraAnnualSavings ?? 0) * priceFactor;
    const savings = selfUsed * buy + exported * sell + extraSavings;
    const extraKwh = p.extraAnnualKwh ?? 0;

    const replacementCost = replacementSet.has(t) ? INVERTER_REPLACEMENT_COST : 0;
    totalReplacementCost += replacementCost;
    const netCashflow = savings - replacementCost;

    cum += netCashflow;
    totalProduction += production + extraKwh;
    totalSavings += savings;
    cashflows.push(netCashflow);
    const discounted = netCashflow / Math.pow(1 + p.discountRate, t);
    npv += discounted;
    cumNpv += discounted;

    rows.push({
      year: t,
      production: production + extraKwh,
      selfUsed,
      exported,
      savings,
      cumulativeCashflow: cum,
      replacementCost,
      cumulativeNpv: cumNpv,
    });
  }

  // Payback (linjär interpolation)
  let payback: number | null = null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].cumulativeCashflow >= 0) {
      const prevCum = i === 0 ? -investment : rows[i - 1].cumulativeCashflow;
      const thisCum = rows[i].cumulativeCashflow;
      const frac = (0 - prevCum) / (thisCum - prevCum);
      payback = i + frac;
      break;
    }
  }

  // LCOE = investering / Σ (kWh_t / (1+r)^t)
  let discountedKwh = 0;
  for (let t = 1; t <= p.years; t++) {
    const degr = Math.pow(1 - p.degradation, t - 1);
    const prod = kWp * p.yieldPerKwp * (1 + system.productionBonus) * degr;
    discountedKwh += prod / Math.pow(1 + p.discountRate, t);
  }
  let discountedReplacements = 0;
  for (const yr of replacementYears) {
    discountedReplacements += INVERTER_REPLACEMENT_COST / Math.pow(1 + p.discountRate, yr);
  }
  const lcoe =
    discountedKwh > 0 ? (investment + discountedReplacements) / discountedKwh : 0;

  const irr = calculateIrr(cashflows);

  return {
    kWp,
    investment,
    totalProduction,
    totalSavings,
    payback,
    irr,
    npv,
    lcoe,
    rows,
    replacementYears,
    totalReplacementCost,
  };
}

function npvAt(cashflows: number[], rate: number): number {
  let v = 0;
  for (let i = 0; i < cashflows.length; i++) {
    v += cashflows[i] / Math.pow(1 + rate, i);
  }
  return v;
}

export function calculateIrr(cashflows: number[]): number | null {
  // Måste ha minst ett negativt och ett positivt
  const hasNeg = cashflows.some((c) => c < 0);
  const hasPos = cashflows.some((c) => c > 0);
  if (!hasNeg || !hasPos) return null;

  // Bisektion mellan -0.99 och 1.0
  let lo = -0.99;
  let hi = 1.0;
  let fLo = npvAt(cashflows, lo);
  let fHi = npvAt(cashflows, hi);

  // Utöka hi om båda har samma tecken
  let tries = 0;
  while (fLo * fHi > 0 && tries < 20) {
    hi *= 2;
    fHi = npvAt(cashflows, hi);
    tries++;
  }
  if (fLo * fHi > 0) return null;

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npvAt(cashflows, mid);
    if (Math.abs(fMid) < 1e-6) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export const fmtSek = (n: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(n);

export const fmtNum = (n: number, digits = 0) =>
  new Intl.NumberFormat("sv-SE", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);

export const fmtPct = (n: number, digits = 1) =>
  new Intl.NumberFormat("sv-SE", {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);