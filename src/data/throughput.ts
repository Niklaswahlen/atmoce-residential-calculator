/**
 * Garanterad minsta genomströmning (Minimum Throughput Energy) per batterimodul, i MWh.
 * Källa: tillverkarnas garantidokument.
 */
export const ATMOCE_THROUGHPUT_MWH: Record<string, number> = {
  atmoce_melv: 29.2, // MS-7K-U
  atmoce_8: 33.0, // MS-8K-U
  atmoce_8_pro: 51.0, // MS-8K-U Pro
};

/** Referenssystem → MWh per modul. Dyness Stack100: 45,272 MWh / 3 moduler. */
export const REF_THROUGHPUT_MWH: Record<string, number> = {
  solis_dyness: 45.272 / 3,
};

/**
 * Referenssystem → batteriets namn. Genomströmningen är ett batteriegenskap,
 * så rutan nämner bara batterimärket, inte växelriktaren i systemnamnet.
 */
export const REF_THROUGHPUT_LABEL: Record<string, string> = {
  solis_dyness: "Dyness Stack100",
};
