import { SYSTEMS, type SystemId, type SystemSpec } from "@/data/systems";
import {
  computeSystemPrice,
  type BatteryConfig,
  type Component,
  type PriceSettings,
  type SystemConfig,
  type SystemLine,
} from "./pricing";
import { sidePrice, type PublicPricingPayload, type PublicSystemPricing } from "./pricing-public";

export { usePricingData, PRICING_KEY, useCalculatorPricing, CALCULATOR_PRICING_KEY } from "./usePricing";

export interface BatteryModulesMap {
  [systemId: string]: number | undefined;
}

/**
 * Build the live SystemSpec map by combining hardcoded technical specs
 * (warranties, round-trip efficiency, inverter type, …) with prices and
 * battery capacity computed from the components-based pricing model.
 */
export function buildSystems(args: {
  components: Component[];
  systems: SystemConfig[];
  lines: SystemLine[];
  settings: PriceSettings;
  panels: number;
  batteryModules?: BatteryModulesMap;
  batteryConfigs?: BatteryConfig[];
}): Record<SystemId, SystemSpec> {
  const { components, systems, lines, settings, panels, batteryModules = {}, batteryConfigs = [] } = args;
  const out: Record<SystemId, SystemSpec> = { ...SYSTEMS };

  for (const config of systems) {
    const id = config.id as SystemId;
    if (!out[id]) continue;
    const modules = batteryModules[id] ?? config.default_battery_modules;
    const result = computeSystemPrice({
      config,
      lines: lines.filter((l) => l.system_id === config.id),
      components,
      settings,
      panels,
      batteryModules: modules,
      batteryConfigs,
    });
    out[id] = {
      ...out[id],
      name: config.name,
      short: config.short,
      pvPrice: result.pv.price,
      essPrice: result.ess.price,
      batteryKwh: result.batteryKwh || out[id].batteryKwh,
    };
  }
  return out;
}

/** Default battery-modules-per-system map from the loaded configs. */
export function defaultBatteryModules(systems: SystemConfig[] | undefined): BatteryModulesMap {
  const out: BatteryModulesMap = {};
  for (const s of systems ?? []) out[s.id] = s.default_battery_modules;
  return out;
}

/**
 * Build SystemSpec map from the public (client-safe) pricing payload using
 * per-side coefficients. Mirrors buildSystems() but never touches cost basis.
 */
export function buildSystemsPublic(args: {
  pricing: PublicPricingPayload;
  panels: number;
  batteryModules?: BatteryModulesMap;
  /** systemId -> chosen battery config id (battery model). */
  batteryConfigIds?: Record<string, string | undefined>;
}): Record<SystemId, SystemSpec> {
  const { pricing, panels, batteryModules = {}, batteryConfigIds = {} } = args;
  const out: Record<SystemId, SystemSpec> = { ...SYSTEMS };
  for (const s of pricing.systems) {
    const id = s.id as SystemId;
    if (!out[id]) continue;
    const modules = batteryModules[id] ?? s.defaultBatteryModules;
    const chosenId = batteryConfigIds[s.id] ?? s.defaultBatteryConfigId ?? undefined;
    const option = s.batteryOptions?.find((o) => o.configId === chosenId);
    const ess = option?.ess ?? s.ess;
    const kwhPerModule = option?.kwhPerModule ?? s.batteryKwhPerModule;
    out[id] = {
      ...out[id],
      name: s.name,
      short: s.short,
      pvPrice: sidePrice(s.pv, panels, modules),
      essPrice: sidePrice(ess, panels, modules),
      batteryKwh: kwhPerModule * modules || out[id].batteryKwh,
      batteryWarrantyYears: option?.warrantyYears ?? out[id].batteryWarrantyYears,
      batteryWarrantyCycles: option?.warrantyCycles ?? out[id].batteryWarrantyCycles,
    };
  }
  return out;
}

/** kWh per module for a system given the chosen battery model. */
export function unitKwhFor(
  system: PublicSystemPricing | undefined,
  configId?: string,
): number {
  if (!system) return 0;
  const id = configId ?? system.defaultBatteryConfigId ?? undefined;
  return (
    system.batteryOptions?.find((o) => o.configId === id)?.kwhPerModule ??
    system.batteryKwhPerModule
  );
}

export function findPublicSystem(
  pricing: PublicPricingPayload | undefined,
  id: string,
): PublicSystemPricing | undefined {
  return pricing?.systems.find((s) => s.id === id);
}