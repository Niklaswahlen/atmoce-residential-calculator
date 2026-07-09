import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { SYSTEMS, type SystemId, type SystemSpec } from "@/data/systems";
import { getCalculatorPricing } from "./pricing-public.functions";
import {
  priceFromCoeffs,
  type PublicPricingPayload,
  type PublicSystemPricing,
} from "./pricing-public";

export const CALCULATOR_PRICING_KEY = ["pricing-public"] as const;

export interface CalculatorBatteryModules {
  [systemId: string]: number | undefined;
}

export function useCalculatorPricing() {
  const fetchPricing = useServerFn(getCalculatorPricing);
  return useQuery({
    queryKey: CALCULATOR_PRICING_KEY,
    queryFn: () => fetchPricing() as Promise<PublicPricingPayload>,
    staleTime: 15_000,
  });
}

/**
 * Combine hardcoded technical specs (warranties, round-trip, inverter type)
 * with prices/kWh computed from the public pricing coefficients.
 */
export function buildSystemsPublic(args: {
  payload: PublicPricingPayload;
  panels: number;
  batteryModules?: CalculatorBatteryModules;
}): Record<SystemId, SystemSpec> {
  const { payload, panels, batteryModules = {} } = args;
  const out: Record<SystemId, SystemSpec> = { ...SYSTEMS };
  for (const sys of payload.systems) {
    const id = sys.id as SystemId;
    if (!out[id]) continue;
    const modules = batteryModules[id] ?? sys.defaultBatteryModules;
    const pvPrice = priceFromCoeffs(sys.pv, panels, modules);
    const essPrice = priceFromCoeffs(sys.ess, panels, modules);
    const kwh = sys.batteryKwhPerModule * modules;
    out[id] = {
      ...out[id],
      name: sys.name,
      short: sys.short,
      pvPrice,
      essPrice,
      batteryKwh: kwh || out[id].batteryKwh,
    };
  }
  return out;
}

export function findPublicSystem(
  payload: PublicPricingPayload | undefined,
  id: string,
): PublicSystemPricing | undefined {
  return payload?.systems.find((s) => s.id === id);
}

export function useBatteryModulesMap(map: CalculatorBatteryModules) {
  return useMemo(() => map, [JSON.stringify(map)]);
}