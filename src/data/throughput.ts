/**
 * Garanterad minsta genomströmning (Minimum Throughput Energy) per batterimodul, i MWh.
 * Källa: tillverkarnas garantidokument.
 */
export const ATMOCE_THROUGHPUT_MWH: Record<string, number> = {
  atmoce_melv: 29.2, // MS-7K-U
  atmoce_8: 33.0, // MS-8K-U
  atmoce_8_pro: 51.0, // MS-8K-U Pro
};

/**
 * Referenssystem → MWh per modul.
 * Dyness Stack100: 45,272 MWh / 3 moduler.
 * Sigenergy SigenStor BAT 10.0 (8,76 kWh användbart): 30,66 MWh.
 * Huawei LUNA2000 (7 kWh modul): 19,23 MWh.
 */
export const REF_THROUGHPUT_MWH: Record<string, number> = {
  solis_dyness: 45.272 / 3,
  sigenergy: 30.66,
  huawei: 19.23, saj_hs3: 15.3,
};

/**
 * Referenssystem → batteriets namn. Genomströmningen är ett batteriegenskap,
 * så rutan nämner bara batterimärket, inte växelriktaren i systemnamnet.
 */
export const REF_THROUGHPUT_LABEL: Record<string, string> = {
  solis_dyness: "Dyness Stack100",
  sigenergy: "Sigenergy SigenStor",
  huawei: "Huawei LUNA2000", saj_hs3: "SAJ BU3",
};

/**
 * Batterimodulens storlek (kWh) för referenssystem som ännu inte har en egen rad
 * i prislistan. Väljs systemet i prislistan används dérifrån i stället.
 */
export const REF_MODULE_KWH: Record<string, number> = {
  huawei: 7,
};
