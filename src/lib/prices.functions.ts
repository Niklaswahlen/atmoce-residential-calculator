import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface SystemPriceRow {
  id: string;
  name: string;
  pv_price: number;
  ess_price: number;
  updated_at: string;
}

export const getSystemPrices = createServerFn({ method: "GET" }).handler(
  async (): Promise<SystemPriceRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("system_prices")
      .select("*")
      .order("id");
    if (error) throw new Error(error.message);
    return (data ?? []) as SystemPriceRow[];
  },
);

const updateSchema = z.object({
  id: z.string().min(1).max(64),
  pv_price: z.number().min(0).max(10_000_000),
  ess_price: z.number().min(0).max(10_000_000),
});

export const updateSystemPrice = createServerFn({ method: "POST" })
  .inputValidator((input) => updateSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("system_prices")
      .update({ pv_price: data.pv_price, ess_price: data.ess_price })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DEFAULTS: { id: string; name: string; pv_price: number; ess_price: number }[] = [
  { id: "atmoce", name: "Atmoce", pv_price: 62918.75, ess_price: 60335.16 },
  { id: "solis_dyness", name: "Solis + Dyness Stack100", pv_price: 65062.5, ess_price: 32531.25 },
  { id: "sigenergy", name: "Sigenergy", pv_price: 74265.0, ess_price: 56211.72 },
  { id: "saj_hs3", name: "SAJ HS3", pv_price: 69687.5, ess_price: 40677.34 },
  { id: "solis_qapasity", name: "Solis + Qapasity", pv_price: 65062.5, ess_price: 47937.5 },
  { id: "huawei", name: "Huawei (med Optimerare)", pv_price: 72718.75, ess_price: 50359.38 },
];

export const resetSystemPrices = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (const row of DEFAULTS) {
      const { error } = await supabaseAdmin
        .from("system_prices")
        .upsert(row, { onConflict: "id" });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  },
);