import { createServerFn } from "@tanstack/react-start";
import type {
  BatteryConfig,
  Component,
  PriceSettings,
  Side,
  SystemConfig,
  SystemLine,
  QtyKind,
} from "./pricing";
import { verifyAdmin } from "./pricing-admin.server";

export interface PricingPayload {
  components: Component[];
  systems: SystemConfig[];
  lines: SystemLine[];
  settings: PriceSettings;
  batteryConfigs: BatteryConfig[];
}

// Public: returns everything the app needs (calculator + admin page).
// Access via service-role client behind a server function — no direct
// Data API exposure. price_settings margins etc. are still returned because
// the calculator needs them to compute displayed prices.
export const getPricingData = createServerFn({ method: "GET" }).handler(
  async (): Promise<PricingPayload> => {
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
      batteryConfigs: (b.data ?? []) as BatteryConfig[],
    };
  },
);

// ---------- Admin mutations (password-gated, server-side) ----------

interface AdminInput<T> {
  password: string;
  data: T;
}

export const adminUpdatePriceSettings = createServerFn({ method: "POST" })
  .inputValidator(
    (v: AdminInput<{ margin_pct: number; vat_pct: number; gta_pv_pct: number; gta_ess_pct: number }>) => v,
  )
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("price_settings")
      .update({
        margin_pct: data.data.margin_pct,
        vat_pct: data.data.vat_pct,
        gta_pv_pct: data.data.gta_pv_pct,
        gta_ess_pct: data.data.gta_ess_pct,
      })
      .eq("id", "current");
    if (error) throw error;
    return { ok: true };
  });

// Components
export const adminUpsertComponent = createServerFn({ method: "POST" })
  .inputValidator(
    (v: AdminInput<{
      id: string;
      name?: string;
      category?: string;
      side?: Side;
      unit?: string;
      unit_price_ex_vat?: number;
      unit_kwh?: number | null;
      insert?: boolean;
    }>) => v,
  )
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, insert, ...rest } = data.data;
    if (insert) {
      const { error } = await supabaseAdmin.from("components").insert({
        id,
        name: rest.name ?? "",
        category: rest.category ?? "accessory",
        side: rest.side ?? "pv",
        unit: rest.unit ?? "st",
        unit_price_ex_vat: rest.unit_price_ex_vat ?? 0,
      });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("components").update(rest).eq("id", id);
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminDeleteComponent = createServerFn({ method: "POST" })
  .inputValidator((v: AdminInput<{ id: string }>) => v)
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("components").delete().eq("id", data.data.id);
    if (error) {
      if ((error as { code?: string }).code === "23503") {
        const [scl, bc, sc] = await Promise.all([
          supabaseAdmin.from("system_component_lines").select("system_id").eq("component_id", data.data.id),
          supabaseAdmin
            .from("battery_configs")
            .select("name, base_component_id, module_component_id, bms_component_id")
            .or(
              `base_component_id.eq.${data.data.id},module_component_id.eq.${data.data.id},bms_component_id.eq.${data.data.id}`,
            ),
          supabaseAdmin.from("system_configs").select("name").eq("battery_module_id", data.data.id),
        ]);
        const refs: string[] = [];
        const systems = Array.from(new Set((scl.data ?? []).map((r: { system_id: string }) => r.system_id)));
        if (systems.length) refs.push(`system: ${systems.join(", ")}`);
        if (bc.data?.length) refs.push(`batterikonfig: ${bc.data.map((b: { name: string }) => b.name).join(", ")}`);
        if (sc.data?.length) refs.push(`system (batterimodul): ${sc.data.map((s: { name: string }) => s.name).join(", ")}`);
        throw new Error(refs.length ? `Används av — ${refs.join(" · ")}` : error.message);
      }
      throw error;
    }
    return { ok: true };
  });

// Battery configs
export const adminUpsertBatteryConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (v: AdminInput<{
      id: string;
      insert?: boolean;
      name?: string;
      short?: string;
      base_component_id?: string | null;
      module_component_id?: string;
      bms_component_id?: string | null;
      min_modules?: number;
      max_modules?: number;
      sort_order?: number;
    }>) => v,
  )
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, insert, ...rest } = data.data;
    if (insert) {
      const { error } = await supabaseAdmin.from("battery_configs").insert({
        id,
        name: rest.name ?? "",
        short: rest.short ?? "",
        module_component_id: rest.module_component_id ?? "",
        min_modules: rest.min_modules ?? 1,
        max_modules: rest.max_modules ?? 10,
        sort_order: rest.sort_order ?? 0,
      });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("battery_configs").update(rest).eq("id", id);
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminDeleteBatteryConfig = createServerFn({ method: "POST" })
  .inputValidator((v: AdminInput<{ id: string }>) => v)
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("battery_configs").delete().eq("id", data.data.id);
    if (error) throw error;
    return { ok: true };
  });

// System configs
export const adminUpsertSystemConfig = createServerFn({ method: "POST" })
  .inputValidator(
    (v: AdminInput<{
      id: string;
      insert?: boolean;
      name?: string;
      short?: string;
      sort_order?: number;
      default_battery_modules?: number;
      battery_config_id?: string | null;
      battery_module_id?: string | null;
      pv_override_inc_vat?: number | null;
      ess_override_inc_vat?: number | null;
    }>) => v,
  )
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, insert, ...rest } = data.data;
    if (insert) {
      const { error } = await supabaseAdmin.from("system_configs").insert({
        id,
        name: rest.name ?? "",
        short: rest.short ?? "",
        sort_order: rest.sort_order ?? 0,
        default_battery_modules: rest.default_battery_modules ?? 1,
      });
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("system_configs").update(rest).eq("id", id);
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminDeleteSystemConfig = createServerFn({ method: "POST" })
  .inputValidator((v: AdminInput<{ id: string }>) => v)
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: e1 } = await supabaseAdmin.from("system_component_lines").delete().eq("system_id", data.data.id);
    if (e1) throw e1;
    const { error } = await supabaseAdmin.from("system_configs").delete().eq("id", data.data.id);
    if (error) throw error;
    return { ok: true };
  });

// System component lines
export const adminUpsertSystemLine = createServerFn({ method: "POST" })
  .inputValidator(
    (v: AdminInput<{
      id?: string;
      insert?: boolean;
      system_id?: string;
      component_id?: string;
      side?: Side;
      qty_kind?: QtyKind;
      qty_value?: number;
      sort_order?: number;
    }>) => v,
  )
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, insert, ...rest } = data.data;
    if (insert) {
      const { error } = await supabaseAdmin.from("system_component_lines").insert({
        system_id: rest.system_id!,
        component_id: rest.component_id!,
        side: rest.side!,
        qty_kind: rest.qty_kind ?? "fixed",
        qty_value: rest.qty_value ?? 1,
        sort_order: rest.sort_order ?? 0,
      });
      if (error) throw error;
    } else {
      if (!id) throw new Error("Missing id");
      const { error } = await supabaseAdmin.from("system_component_lines").update(rest).eq("id", id);
      if (error) throw error;
    }
    return { ok: true };
  });

export const adminDeleteSystemLine = createServerFn({ method: "POST" })
  .inputValidator((v: AdminInput<{ id: string }>) => v)
  .handler(async ({ data }) => {
    verifyAdmin(data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("system_component_lines").delete().eq("id", data.data.id);
    if (error) throw error;
    return { ok: true };
  });