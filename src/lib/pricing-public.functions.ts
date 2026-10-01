import { createServerFn } from "@tanstack/react-start";
import type {
  BatteryConfig,
  Component,
  PriceSettings,
  QtyKind,
  Side,
  SystemConfig,
  SystemLine,
} from "./pricing";
import type {
  PublicBatteryOption,
  PublicPricingPayload,
  PublicSystemPricing,
  SidePriceCoeffs,
} from "./pricing-public";
import { verifyAdmin } from "./pricing-admin.server";

// ---------------------------------------------------------------------------
// Shared raw loader (server-only). NEVER export the raw payload to the client
// except behind verifyAdmin.
// ---------------------------------------------------------------------------

interface RawPricing {
  components: Component[];
  systems: SystemConfig[];
  lines: SystemLine[];
  settings: PriceSettings;
  batteryConfigs: BatteryConfig[];
}

const DEFAULT_SETTINGS: PriceSettings = {
  id: "current",
  margin_pct: 0.25,
  vat_pct: 0.25,
  gta_pv_pct: 0.2,
  gta_ess_pct: 0.5,
  default_panels: 14,
  default_wp_panel: 460,
};

async function loadRawPricing(): Promise<RawPricing> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [c, s, l, p, b] = await Promise.all([
    supabaseAdmin.from("components").select("*").order("category").order("name"),
    supabaseAdmin.from("system_configs").select("*").order("sort_order"),
    supabaseAdmin.from("system_component_lines").select("*").order("sort_order"),
    supabaseAdmin.from("price_settings").select("*").eq("id", "current").maybeSingle(),
    supabaseAdmin.from("battery_configs").select("*").order("sort_order"),
  ]);
  if (c.error) throw c.error;
  if (s.error) throw s.error;
  if (l.error) throw l.error;
  if (p.error) throw p.error;
  if (b.error) throw b.error;
  return {
    components: (c.data ?? []) as Component[],
    systems: (s.data ?? []) as SystemConfig[],
    lines: (l.data ?? []) as SystemLine[],
    settings: ((p.data as PriceSettings | null) ?? DEFAULT_SETTINGS),
    batteryConfigs: (b.data ?? []) as BatteryConfig[],
  };
}

// ---------------------------------------------------------------------------
// Reduction: raw model -> client-safe coefficients.
// Mirrors computeSide() in pricing.ts but collapses everything into three
// final-SEK coefficients per side. Cost basis and margin never leave here.
// ---------------------------------------------------------------------------

interface InjectedLine {
  component_id: string;
  qty_kind: QtyKind;
  qty_value: number;
}

function reduceSide(
  lines: SystemLine[],
  byId: Map<string, Component>,
  side: Side,
  marginPct: number,
  vatPct: number,
  gtaPct: number,
  override: number | null | undefined,
  injected: InjectedLine[] = [],
): SidePriceCoeffs {
  if (override !== null && override !== undefined && Number.isFinite(override)) {
    return { base: override, perPanel: 0, perModule: 0 };
  }

  let fixedSum = 0;
  let perPanelSum = 0;
  let perModuleSum = 0;

  const all: InjectedLine[] = [
    ...injected,
    ...lines
      .filter((l) => l.side === side)
      .map((l) => ({ component_id: l.component_id, qty_kind: l.qty_kind, qty_value: l.qty_value })),
  ];

  for (const l of all) {
    const unit = byId.get(l.component_id)?.unit_price_ex_vat ?? 0;
    const v = l.qty_value * unit;
    switch (l.qty_kind) {
      case "fixed":
        fixedSum += v;
        break;
      case "per_panel":
        perPanelSum += v;
        break;
      case "half_per_panel":
        perPanelSum += v / 2;
        break;
      case "per_battery_module":
        perModuleSum += v;
        break;
    }
  }

  const k = (1 + marginPct) * (1 + vatPct) * (1 - gtaPct);
  return { base: k * fixedSum, perPanel: k * perPanelSum, perModule: k * perModuleSum };
}

function buildPublicPayload(raw: RawPricing): PublicPricingPayload {
  const { components, systems, lines, settings, batteryConfigs } = raw;
  const byId = new Map(components.map((c) => [c.id, c] as const));

  const out: PublicSystemPricing[] = systems.map((config) => {
    const bc = config.battery_config_id
      ? batteryConfigs.find((x) => x.id === config.battery_config_id)
      : undefined;

    const injectedFor = (b: BatteryConfig | undefined): InjectedLine[] => {
      const inj: InjectedLine[] = [];
      if (!b) return inj;
      if (b.base_component_id)
        inj.push({ component_id: b.base_component_id, qty_kind: "fixed", qty_value: 1 });
      inj.push({ component_id: b.module_component_id, qty_kind: "per_battery_module", qty_value: 1 });
      if (b.bms_component_id)
        inj.push({ component_id: b.bms_component_id, qty_kind: "fixed", qty_value: 1 });
      return inj;
    };

    const sysLines = lines.filter((l) => l.system_id === config.id);
    // Atmoce Combiner hör bara till Atmoce-batterierna — exkludera den ur
    // ESS-koefficienterna för batterialternativ som inte är Atmoce-modeller.
    const essFor = (b: BatteryConfig | undefined) => {
      const includeCombiner = !b || b.id.startsWith("atmoce");
      const essLines = includeCombiner
        ? sysLines
        : sysLines.filter((l) => l.component_id !== "atmoce_combiner");
      return reduceSide(essLines, byId, "ess", settings.margin_pct, settings.vat_pct, settings.gta_ess_pct, config.ess_override_inc_vat, injectedFor(b));
    };

    const pv = reduceSide(sysLines, byId, "pv", settings.margin_pct, settings.vat_pct, settings.gta_pv_pct, config.pv_override_inc_vat);
    const ess = essFor(bc);

    const moduleId = bc?.module_component_id ?? config.battery_module_id ?? null;
    const batteryKwhPerModule = moduleId ? byId.get(moduleId)?.unit_kwh ?? 0 : 0;

    // Selectable battery models: every config belonging to this system's
    // family (id prefixed with the system id), plus the assigned one.
    const family = batteryConfigs.filter(
      (b) => b.id === bc?.id || b.id === config.id || b.id.startsWith(`${config.id}_`),
    );
    const batteryOptions: PublicBatteryOption[] = (family.length ? family : bc ? [bc] : [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((b) => ({
        configId: b.id,
        name: b.name,
        short: b.short,
        kwhPerModule: byId.get(b.module_component_id)?.unit_kwh ?? 0,
        minModules: b.min_modules,
        maxModules: b.max_modules,
        warrantyYears: b.warranty_years ?? null,
        warrantyCycles: b.warranty_cycles ?? null,
        ess: essFor(b),
      }));

    return {
      id: config.id,
      name: config.name,
      short: config.short,
      pv,
      ess,
      batteryKwhPerModule,
      defaultBatteryModules: config.default_battery_modules,
      minModules: bc?.min_modules ?? 1,
      maxModules: bc?.max_modules ?? 15,
      sortOrder: config.sort_order,
      batteryOptions,
      defaultBatteryConfigId: bc?.id ?? null,
    };
  });

  return {
    systems: out,
    defaults: { panels: settings.default_panels, wpPanel: settings.default_wp_panel },
  };
}

// ---------------------------------------------------------------------------
// Public endpoint — safe to call from the calculator. No secrets in response.
// ---------------------------------------------------------------------------

export const getCalculatorPricing = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicPricingPayload> => {
    const raw = await loadRawPricing();
    return buildPublicPayload(raw);
  },
);

// ---------------------------------------------------------------------------
// Admin endpoint — returns the full raw model (cost basis + margin) ONLY after
// the shared admin password is verified. Used by the /priser admin page.
// ---------------------------------------------------------------------------

export const getAdminPricing = createServerFn({ method: "POST" })
  .inputValidator((v: { password: string }) => v)
  .handler(async ({ data }): Promise<RawPricing> => {
    verifyAdmin(data.password);
    return loadRawPricing();
  });