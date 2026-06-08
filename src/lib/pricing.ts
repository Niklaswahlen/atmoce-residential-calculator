export type Side = "pv" | "ess";
export type QtyKind = "fixed" | "per_panel" | "half_per_panel" | "per_battery_module";

export interface Component {
  id: string;
  name: string;
  category: string;
  side: Side;
  unit: string;
  unit_price_ex_vat: number;
  unit_kwh: number | null;
}

export interface SystemConfig {
  id: string;
  name: string;
  short: string;
  battery_module_id: string | null;
  battery_config_id: string | null;
  default_battery_modules: number;
  pv_override_inc_vat: number | null;
  ess_override_inc_vat: number | null;
  sort_order: number;
}

export interface BatteryConfig {
  id: string;
  name: string;
  short: string;
  base_component_id: string | null;
  module_component_id: string;
  bms_component_id: string | null;
  min_modules: number;
  max_modules: number;
  sort_order: number;
}

export interface SystemLine {
  id: string;
  system_id: string;
  component_id: string;
  side: Side;
  qty_kind: QtyKind;
  qty_value: number;
  sort_order: number;
}

export interface PriceSettings {
  id: string;
  margin_pct: number;
  vat_pct: number;
  gta_pv_pct: number;
  gta_ess_pct: number;
  default_panels: number;
  default_wp_panel: number;
}

export interface ResolvedLine {
  line: SystemLine;
  component: Component;
  qty: number;
  rowTotal: number; // qty * unit_price_ex_vat (ex moms)
}

export interface SidePrice {
  lines: ResolvedLine[];
  subtotal: number;     // sum of row totals, ex moms
  margin: number;       // subtotal * margin_pct
  exVat: number;        // subtotal + margin
  incVat: number;       // exVat * (1 + vat_pct)
  afterGta: number;     // incVat * (1 - gta_pct)
  price: number;        // override ?? afterGta
  overrideApplied: boolean;
}

export interface SystemPriceResult {
  pv: SidePrice;
  ess: SidePrice;
  batteryKwh: number;   // resolved from battery_module_id × battery modules count
  batteryModules: number;
}

export function resolveQty(
  kind: QtyKind,
  value: number,
  panels: number,
  batteryModules: number,
): number {
  switch (kind) {
    case "fixed":
      return value;
    case "per_panel":
      return panels * value;
    case "half_per_panel":
      return (panels / 2) * value;
    case "per_battery_module":
      return batteryModules * value;
  }
}

function computeSide(
  lines: SystemLine[],
  componentById: Map<string, Component>,
  side: Side,
  panels: number,
  batteryModules: number,
  marginPct: number,
  vatPct: number,
  gtaPct: number,
  override: number | null,
): SidePrice {
  const resolved: ResolvedLine[] = lines
    .filter((l) => l.side === side)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((l) => {
      const component = componentById.get(l.component_id);
      const qty = resolveQty(l.qty_kind, l.qty_value, panels, batteryModules);
      const unit = component?.unit_price_ex_vat ?? 0;
      return {
        line: l,
        component: component ?? {
          id: l.component_id,
          name: "(saknas)",
          category: "unknown",
          side,
          unit: "st",
          unit_price_ex_vat: 0,
          unit_kwh: null,
        },
        qty,
        rowTotal: qty * unit,
      };
    });

  const subtotal = resolved.reduce((s, r) => s + r.rowTotal, 0);
  const margin = subtotal * marginPct;
  const exVat = subtotal + margin;
  const incVat = exVat * (1 + vatPct);
  const afterGta = incVat * (1 - gtaPct);
  const overrideApplied = override !== null && override !== undefined && Number.isFinite(override);
  const price = overrideApplied ? (override as number) : afterGta;
  return { lines: resolved, subtotal, margin, exVat, incVat, afterGta, price, overrideApplied };
}

export interface ComputeArgs {
  config: SystemConfig;
  lines: SystemLine[];
  components: Component[];
  settings: PriceSettings;
  panels: number;
  batteryModules: number;
  batteryConfigs?: BatteryConfig[];
}

export function computeSystemPrice(args: ComputeArgs): SystemPriceResult {
  const { config, lines, components, settings, panels, batteryModules, batteryConfigs } = args;
  const byId = new Map(components.map((c) => [c.id, c] as const));

  const pv = computeSide(
    lines,
    byId,
    "pv",
    panels,
    batteryModules,
    settings.margin_pct,
    settings.vat_pct,
    settings.gta_pv_pct,
    config.pv_override_inc_vat,
  );
  const ess = computeSide(
    lines,
    byId,
    "ess",
    panels,
    batteryModules,
    settings.margin_pct,
    settings.vat_pct,
    settings.gta_ess_pct,
    config.ess_override_inc_vat,
  );

  // Resolve battery kWh: prefer battery_config -> module, fall back to legacy battery_module_id.
  const batteryConfig = config.battery_config_id
    ? batteryConfigs?.find((b) => b.id === config.battery_config_id)
    : undefined;
  const moduleId = batteryConfig?.module_component_id ?? config.battery_module_id ?? null;
  const batteryComponent = moduleId ? byId.get(moduleId) : undefined;
  const batteryKwh = (batteryComponent?.unit_kwh ?? 0) * batteryModules;

  return { pv, ess, batteryKwh, batteryModules };
}