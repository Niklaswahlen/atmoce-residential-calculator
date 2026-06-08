import { SYSTEMS, type SystemId, type SystemSpec } from "@/data/systems";
import {
  computeSystemPrice,
  type BatteryConfig,
  type Component,
  type PriceSettings,
  type SystemConfig,
  type SystemLine,
} from "./pricing";

export { usePricingData, PRICING_KEY } from "./usePricing";

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