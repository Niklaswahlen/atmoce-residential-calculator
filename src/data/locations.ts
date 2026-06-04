export interface LocationData {
  id: string;
  name: string;
  // Andel av årsproduktionen per månad (jan..dec), summerar ~1.0
  monthlyIrradiance: number[];
  // Antal dagar/månad där panelerna typiskt är snötäckta
  monthlySnowDays: number[];
}

// Typvärden baserade på SMHI-statistik och svensk solinstrålning.
// Värden är förenklade approximationer för kalkyl, inte exakt metadata.
export const LOCATIONS: LocationData[] = [
  {
    id: "malmo",
    name: "Malmö",
    monthlyIrradiance: [0.018, 0.04, 0.08, 0.12, 0.14, 0.145, 0.14, 0.12, 0.085, 0.05, 0.02, 0.012],
    monthlySnowDays: [4, 3, 1, 0, 0, 0, 0, 0, 0, 0, 1, 3],
  },
  {
    id: "goteborg",
    name: "Göteborg",
    monthlyIrradiance: [0.017, 0.038, 0.078, 0.118, 0.143, 0.148, 0.142, 0.118, 0.083, 0.048, 0.018, 0.011],
    monthlySnowDays: [8, 6, 3, 0, 0, 0, 0, 0, 0, 0, 2, 6],
  },
  {
    id: "jonkoping",
    name: "Jönköping",
    monthlyIrradiance: [0.016, 0.038, 0.08, 0.12, 0.145, 0.15, 0.142, 0.118, 0.082, 0.045, 0.017, 0.01],
    monthlySnowDays: [14, 11, 7, 1, 0, 0, 0, 0, 0, 1, 5, 11],
  },
  {
    id: "stockholm",
    name: "Stockholm",
    monthlyIrradiance: [0.014, 0.036, 0.08, 0.122, 0.148, 0.152, 0.144, 0.118, 0.08, 0.042, 0.014, 0.008],
    monthlySnowDays: [16, 13, 8, 1, 0, 0, 0, 0, 0, 1, 6, 13],
  },
  {
    id: "karlstad",
    name: "Karlstad",
    monthlyIrradiance: [0.014, 0.036, 0.08, 0.122, 0.148, 0.152, 0.144, 0.118, 0.08, 0.042, 0.014, 0.008],
    monthlySnowDays: [18, 15, 9, 2, 0, 0, 0, 0, 0, 1, 7, 14],
  },
  {
    id: "sundsvall",
    name: "Sundsvall",
    monthlyIrradiance: [0.011, 0.033, 0.082, 0.125, 0.152, 0.155, 0.145, 0.118, 0.078, 0.038, 0.011, 0.006],
    monthlySnowDays: [22, 19, 14, 4, 0, 0, 0, 0, 0, 3, 11, 19],
  },
  {
    id: "ostersund",
    name: "Östersund",
    monthlyIrradiance: [0.01, 0.032, 0.082, 0.126, 0.154, 0.158, 0.146, 0.118, 0.076, 0.036, 0.01, 0.005],
    monthlySnowDays: [25, 22, 18, 7, 1, 0, 0, 0, 1, 5, 14, 22],
  },
  {
    id: "kiruna",
    name: "Kiruna",
    monthlyIrradiance: [0.003, 0.025, 0.085, 0.135, 0.165, 0.17, 0.15, 0.115, 0.07, 0.028, 0.005, 0.001],
    monthlySnowDays: [28, 26, 24, 14, 3, 0, 0, 0, 2, 10, 20, 27],
  },
];

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

export const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];