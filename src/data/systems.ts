export type SystemId =
  | "atmoce"
  | "solis_dyness"
  | "sigenergy"
  | "saj_hs3"
  | "solis_qapasity"
  | "huawei";

export interface SystemSpec {
  id: SystemId;
  name: string;
  short: string;
  pvPrice: number; // SEK, efter grönt teknikavdrag
  essPrice: number; // SEK, efter avdrag
  batteryKwh: number; // installerad batterikapacitet
  batteryRoundTrip: number; // 0-1
  productionBonus: number; // ex 0.05 = +5% (Atmoce mikroväxelriktare)
  inverterWarrantyYears: number;
  batteryWarrantyYears: number;
  batteryWarrantyCycles?: number;
  inverterType: string;
  panelLevelMonitoring: boolean;
}

// Prisbas: Systempriser 2026 (inkl. 15% grönt teknikavdrag)
export const SYSTEMS: Record<SystemId, SystemSpec> = {
  atmoce: {
    id: "atmoce",
    name: "Atmoce",
    short: "Atmoce",
    pvPrice: 62918.75,
    essPrice: 60335.16,
    batteryKwh: 10,
    batteryRoundTrip: 0.95,
    productionBonus: 0.08,
    inverterWarrantyYears: 25,
    batteryWarrantyYears: 15,
    batteryWarrantyCycles: 8000,
    inverterType: "Mikroväxelriktare (per panel)",
    panelLevelMonitoring: true,
  },
  solis_dyness: {
    id: "solis_dyness",
    name: "Solis + Dyness Stack100",
    short: "Solis/Dyness",
    pvPrice: 65062.5,
    essPrice: 32531.25,
    batteryKwh: 10,
    batteryRoundTrip: 0.9,
    productionBonus: 0,
    inverterWarrantyYears: 10,
    batteryWarrantyYears: 10,
    batteryWarrantyCycles: 6000,
    inverterType: "Stränginverter",
    panelLevelMonitoring: false,
  },
  sigenergy: {
    id: "sigenergy",
    name: "Sigenergy",
    short: "Sigenergy",
    pvPrice: 74265.0,
    essPrice: 56211.72,
    batteryKwh: 10,
    batteryRoundTrip: 0.92,
    productionBonus: 0,
    inverterWarrantyYears: 10,
    batteryWarrantyYears: 10,
    batteryWarrantyCycles: 6000,
    inverterType: "Hybridinverter",
    panelLevelMonitoring: false,
  },
  saj_hs3: {
    id: "saj_hs3",
    name: "SAJ HS3",
    short: "SAJ HS3",
    pvPrice: 69687.5,
    essPrice: 40677.34,
    batteryKwh: 10,
    batteryRoundTrip: 0.9,
    productionBonus: 0,
    inverterWarrantyYears: 10,
    batteryWarrantyYears: 10,
    batteryWarrantyCycles: 6000,
    inverterType: "Hybridinverter",
    panelLevelMonitoring: false,
  },
  solis_qapasity: {
    id: "solis_qapasity",
    name: "Solis + Qapasity",
    short: "Solis/Qapasity",
    pvPrice: 65062.5,
    essPrice: 47937.5,
    batteryKwh: 10,
    batteryRoundTrip: 0.9,
    productionBonus: 0,
    inverterWarrantyYears: 10,
    batteryWarrantyYears: 10,
    batteryWarrantyCycles: 6000,
    inverterType: "Stränginverter",
    panelLevelMonitoring: false,
  },
  huawei: {
    id: "huawei",
    name: "Huawei (med Optimerare)",
    short: "Huawei",
    pvPrice: 72718.75,
    essPrice: 50359.38,
    batteryKwh: 10,
    batteryRoundTrip: 0.92,
    productionBonus: 0.04,
    inverterWarrantyYears: 10,
    batteryWarrantyYears: 10,
    batteryWarrantyCycles: 6000,
    inverterType: "Hybridinverter + optimerare",
    panelLevelMonitoring: true,
  },
};

export const SYSTEM_ORDER: SystemId[] = [
  "atmoce",
  "solis_dyness",
  "sigenergy",
  "saj_hs3",
  "solis_qapasity",
  "huawei",
];