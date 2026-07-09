import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPricingData } from "./pricing.functions";
import { getCalculatorPricing } from "./pricing-public.functions";
import type { PublicPricingPayload } from "./pricing-public";
import type {
  Component,
  PriceSettings,
  SystemConfig,
  SystemLine,
  Side,
  QtyKind,
  BatteryConfig,
} from "./pricing";

export const PRICING_KEY = ["pricing"] as const;

export interface PricingData {
  components: Component[];
  systems: SystemConfig[];
  lines: SystemLine[];
  settings: PriceSettings;
  batteryConfigs: BatteryConfig[];
}

export function usePricingData() {
  const fetchPricing = useServerFn(getPricingData);
  return useQuery({
    queryKey: PRICING_KEY,
    queryFn: () => fetchPricing() as Promise<PricingData>,
    staleTime: 15_000,
  });
}

export const CALCULATOR_PRICING_KEY = ["calculator-pricing"] as const;

export function useCalculatorPricing() {
  const fetchPricing = useServerFn(getCalculatorPricing);
  return useQuery({
    queryKey: CALCULATOR_PRICING_KEY,
    queryFn: () => fetchPricing() as Promise<PublicPricingPayload>,
    staleTime: 15_000,
  });
}

export type { Component, PriceSettings, SystemConfig, SystemLine, Side, QtyKind, BatteryConfig };