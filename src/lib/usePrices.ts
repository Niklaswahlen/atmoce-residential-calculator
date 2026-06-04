import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SYSTEMS, SYSTEM_ORDER, type SystemId, type SystemSpec } from "@/data/systems";

export interface SystemPriceRow {
  id: string;
  name: string;
  pv_price: number;
  ess_price: number;
  updated_at: string;
}

export const PRICES_KEY = ["system_prices"] as const;

export function useSystemPrices() {
  return useQuery({
    queryKey: PRICES_KEY,
    queryFn: async (): Promise<SystemPriceRow[]> => {
      const { data, error } = await supabase
        .from("system_prices")
        .select("*")
        .order("id");
      if (error) throw error;
      return (data ?? []) as SystemPriceRow[];
    },
    staleTime: 30_000,
  });
}

/**
 * Merge live Cloud-priser into the hardcoded SYSTEMS spec (warranties, batteri etc.
 * stays as defaults). Faller tillbaka till hårdkodade priser om Cloud-data saknas.
 */
export function mergeSystems(prices: SystemPriceRow[] | undefined): Record<SystemId, SystemSpec> {
  const out = { ...SYSTEMS };
  if (!prices) return out;
  for (const row of prices) {
    const id = row.id as SystemId;
    if (!out[id]) continue;
    out[id] = { ...out[id], pvPrice: row.pv_price, essPrice: row.ess_price };
  }
  return out;
}

export const DEFAULT_PRICES: { id: SystemId; pv_price: number; ess_price: number }[] =
  SYSTEM_ORDER.map((id) => ({
    id,
    pv_price: SYSTEMS[id].pvPrice,
    ess_price: SYSTEMS[id].essPrice,
  }));