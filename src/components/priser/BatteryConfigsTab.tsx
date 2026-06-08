import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/app-context";
import { fmtNum } from "@/lib/calc";
import type { BatteryConfig, Component } from "@/lib/pricing";
import { PRICING_KEY } from "@/lib/usePricing";

interface Props {
  batteryConfigs: BatteryConfig[];
  components: Component[];
}

const NONE = "__none__";

export function BatteryConfigsTab({ batteryConfigs, components }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PRICING_KEY });

  const baseOpts = components.filter((c) => c.category === "battery_base");
  const moduleOpts = components.filter((c) => c.category === "battery_module");
  const bmsOpts = components.filter((c) => c.category === "battery_bms");

  const add = useMutation({
    mutationFn: async () => {
      const firstModule = moduleOpts[0];
      if (!firstModule) {
        throw new Error(t("Lägg till en batterimodul i komponentlistan först", "Add a battery module to the component list first"));
      }
      const id = `custom_${Date.now()}`;
      const { error } = await supabase.from("battery_configs").insert({
        id,
        name: t("Ny batterikonfiguration", "New battery configuration"),
        short: t("Ny", "New"),
        module_component_id: firstModule.id,
        min_modules: 1,
        max_modules: 10,
        sort_order: (batteryConfigs[batteryConfigs.length - 1]?.sort_order ?? 0) + 10,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t(
            "Varje batterikonfiguration utgör ett torn: 1 st bas + N st batterimoduler + 0–1 st BMS/BDU/HV-box. Modulens kWh läses från komponentlistan.",
            "Each battery configuration is a tower: 1 base + N modules + 0–1 BMS/BDU/HV-box. Module kWh is read from the component list.",
          )}
        </p>
        <Button size="sm" variant="outline" onClick={() => add.mutate()}>
          +{t("Batterikonfiguration", "Battery config")}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {batteryConfigs.map((bc) => (
          <ConfigCard
            key={bc.id}
            config={bc}
            baseOpts={baseOpts}
            moduleOpts={moduleOpts}
            bmsOpts={bmsOpts}
          />
        ))}
      </div>
    </div>
  );
}

function ConfigCard({
  config,
  baseOpts,
  moduleOpts,
  bmsOpts,
}: {
  config: BatteryConfig;
  baseOpts: Component[];
  moduleOpts: Component[];
  bmsOpts: Component[];
}) {
  const t = useT();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PRICING_KEY });
  const [draft, setDraft] = useState(config);
  useEffect(() => setDraft(config), [config]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(config);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("battery_configs")
        .update({
          name: draft.name,
          short: draft.short,
          base_component_id: draft.base_component_id,
          module_component_id: draft.module_component_id,
          bms_component_id: draft.bms_component_id,
          min_modules: draft.min_modules,
          max_modules: draft.max_modules,
        })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Batterikonfiguration sparad", "Battery configuration saved"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("battery_configs").delete().eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Borttagen", "Removed"));
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(t("Kunde inte ta bort (används av ett system?)", "Could not remove (used by a system?)")),
  });

  const moduleComp = moduleOpts.find((c) => c.id === draft.module_component_id);
  const kwhPerModule = moduleComp?.unit_kwh ?? 0;
  const minKwh = kwhPerModule * draft.min_modules;
  const maxKwh = kwhPerModule * draft.max_modules;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <CardTitle className="text-base">{config.name}</CardTitle>
          <span className="font-mono text-xs text-muted-foreground">
            {fmtNum(minKwh, 2)} – {fmtNum(maxKwh, 2)} kWh
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FieldText label={t("Namn", "Name")} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
          <FieldText label={t("Kort", "Short")} value={draft.short} onChange={(v) => setDraft({ ...draft, short: v })} />
        </div>

        <FieldSelect
          label={t("Bas (1 st/torn)", "Base (1 per tower)")}
          value={draft.base_component_id ?? NONE}
          onChange={(v) => setDraft({ ...draft, base_component_id: v === NONE ? null : v })}
          options={[{ id: NONE, name: t("— Ingen bas —", "— No base —") }, ...baseOpts]}
        />

        <FieldSelect
          label={t("Batterimodul (N st)", "Battery module (N)")}
          value={draft.module_component_id}
          onChange={(v) => setDraft({ ...draft, module_component_id: v })}
          options={moduleOpts.map((c) => ({
            id: c.id,
            name: `${c.name}${c.unit_kwh ? ` (${c.unit_kwh} kWh)` : ""}`,
          }))}
        />

        <FieldSelect
          label={t("BMS / BDU / HV-box (0–1 st)", "BMS / BDU / HV box (0–1)")}
          value={draft.bms_component_id ?? NONE}
          onChange={(v) => setDraft({ ...draft, bms_component_id: v === NONE ? null : v })}
          options={[{ id: NONE, name: t("— Ingen BMS —", "— No BMS —") }, ...bmsOpts]}
        />

        <div className="grid grid-cols-2 gap-3">
          <FieldNum
            label={t("Min moduler", "Min modules")}
            value={draft.min_modules}
            onChange={(v) => setDraft({ ...draft, min_modules: v })}
          />
          <FieldNum
            label={t("Max moduler", "Max modules")}
            value={draft.max_modules}
            onChange={(v) => setDraft({ ...draft, max_modules: v })}
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(t(`Ta bort ${config.name}?`, `Remove ${config.name}?`))) remove.mutate();
            }}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {t("Ta bort", "Remove")}
          </Button>
          <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {t("Spara", "Save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FieldText({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </div>
  );
}

function FieldNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="h-8 font-mono"
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}