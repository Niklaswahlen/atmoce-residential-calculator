import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Component,
  PriceSettings,
  SystemConfig,
  SystemLine,
  Side,
  QtyKind,
} from "./pricing";

export const PRICING_KEY = ["pricing"] as const;

export interface PricingData {
  components: Component[];
  systems: SystemConfig[];
  lines: SystemLine[];
  settings: PriceSettings;
}

export function usePricingData() {
  return useQuery({
    queryKey: PRICING_KEY,
    queryFn: async (): Promise<PricingData> => {
      const [c, s, l, p] = await Promise.all([
        supabase.from("components").select("*").order("category").order("name"),
        supabase.from("system_configs").select("*").order("sort_order"),
        supabase.from("system_component_lines").select("*").order("sort_order"),
        supabase.from("price_settings").select("*").eq("id", "current").maybeSingle(),
      ]);
      if (c.error) throw c.error;
      if (s.error) throw s.error;
      if (l.error) throw l.error;
      if (p.error) throw p.error;

      const settings: PriceSettings = (p.data as PriceSettings | null) ?? {
        id: "current",
        margin_pct: 0.25,
        vat_pct: 0.25,
        gta_pv_pct: 0.2,
        gta_ess_pct: 0.5,
        default_panels: 14,
        default_wp_panel: 460,
      };
      return {
        components: (c.data ?? []) as Component[],
        systems: (s.data ?? []) as SystemConfig[],
        lines: (l.data ?? []) as SystemLine[],
        settings,
      };
    },
    staleTime: 15_000,
  });
}

export type { Component, PriceSettings, SystemConfig, SystemLine, Side, QtyKind };