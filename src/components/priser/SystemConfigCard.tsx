import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/app-context";
import { fmtSek, fmtNum } from "@/lib/calc";
import {
  computeSystemPrice,
  type BatteryConfig,
  type Component,
  type PriceSettings,
  type QtyKind,
  type Side,
  type SystemConfig,
  type SystemLine,
  type ResolvedLine,
} from "@/lib/pricing";
import { PRICING_KEY } from "@/lib/usePricing";

interface Props {
  config: SystemConfig;
  lines: SystemLine[];
  components: Component[];
  settings: PriceSettings;
  panels: number;
  batteryConfigs: BatteryConfig[];
}

const QTY_KINDS: { kind: QtyKind; sv: string; en: string }[] = [
  { kind: "fixed", sv: "Fast", en: "Fixed" },
  { kind: "per_panel", sv: "Per panel", en: "Per panel" },
  { kind: "half_per_panel", sv: "Per 2 paneler", en: "Per 2 panels" },
  { kind: "per_battery_module", sv: "Per batterimodul", en: "Per battery module" },
];

export function SystemConfigCard({ config, lines, components, settings, panels, batteryConfigs }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PRICING_KEY });

  const [batteryModules, setBatteryModules] = useState(config.default_battery_modules);
  const [batteryConfigId, setBatteryConfigId] = useState<string | null>(config.battery_config_id);
  const [pvOverride, setPvOverride] = useState<string>(
    config.pv_override_inc_vat === null ? "" : String(config.pv_override_inc_vat),
  );
  const [essOverride, setEssOverride] = useState<string>(
    config.ess_override_inc_vat === null ? "" : String(config.ess_override_inc_vat),
  );

  useEffect(() => {
    setBatteryModules(config.default_battery_modules);
    setBatteryConfigId(config.battery_config_id);
    setPvOverride(config.pv_override_inc_vat === null ? "" : String(config.pv_override_inc_vat));
    setEssOverride(config.ess_override_inc_vat === null ? "" : String(config.ess_override_inc_vat));
  }, [config]);

  const result = computeSystemPrice({
    config: {
      ...config,
      battery_config_id: batteryConfigId,
      pv_override_inc_vat: pvOverride === "" ? null : parseFloat(pvOverride),
      ess_override_inc_vat: essOverride === "" ? null : parseFloat(essOverride),
    },
    lines,
    components,
    settings,
    panels,
    batteryModules,
    batteryConfigs,
  });

  const saveConfig = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("system_configs")
        .update({
          battery_config_id: batteryConfigId,
          default_battery_modules: batteryModules,
          pv_override_inc_vat: pvOverride === "" ? null : parseFloat(pvOverride),
          ess_override_inc_vat: essOverride === "" ? null : parseFloat(essOverride),
        })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("System sparat", "System saved"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty =
    batteryModules !== config.default_battery_modules ||
    batteryConfigId !== config.battery_config_id ||
    (pvOverride === "" ? config.pv_override_inc_vat !== null : parseFloat(pvOverride) !== config.pv_override_inc_vat) ||
    (essOverride === "" ? config.ess_override_inc_vat !== null : parseFloat(essOverride) !== config.ess_override_inc_vat);

  const selectedBatteryConfig = batteryConfigs.find((b) => b.id === batteryConfigId);
  const moduleComponent = selectedBatteryConfig
    ? components.find((c) => c.id === selectedBatteryConfig.module_component_id)
    : undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <CardTitle className="text-base">{config.name}</CardTitle>
          <div className="text-sm text-muted-foreground">
            {t("Slutpris (ink moms efter GTA):", "Final price (incl. VAT after deduction):")}{" "}
            <span className="font-mono font-semibold text-foreground">
              {fmtSek(result.pv.price + result.ess.price)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Per-system controls */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">
              {t("Batterikonfiguration", "Battery configuration")}
            </Label>
            <Select value={batteryConfigId ?? ""} onValueChange={(v) => setBatteryConfigId(v || null)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {batteryConfigs.map((b) => {
                  const m = components.find((c) => c.id === b.module_component_id);
                  return (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({m?.unit_kwh ?? "?"} kWh/modul)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedBatteryConfig && (
              <p className="text-[10px] text-muted-foreground">
                {t("Moduler:", "Modules:")} {selectedBatteryConfig.min_modules}–{selectedBatteryConfig.max_modules}
                {moduleComponent ? ` · ${moduleComponent.unit_kwh} kWh/modul` : ""}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">
              {t("Default antal batterimoduler", "Default # battery modules")}
            </Label>
            <Input
              type="number"
              min={0}
              value={batteryModules}
              onChange={(e) => setBatteryModules(parseInt(e.target.value) || 0)}
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              ={" "}
              {fmtNum(result.batteryKwh, 2)} kWh
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">
              {t("PV override (ink moms)", "PV override (incl. VAT)")}
            </Label>
            <Input
              type="number"
              placeholder={t("auto", "auto")}
              value={pvOverride}
              onChange={(e) => setPvOverride(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase text-muted-foreground">
              {t("ESS override (ink moms)", "ESS override (incl. VAT)")}
            </Label>
            <Input
              type="number"
              placeholder={t("auto", "auto")}
              value={essOverride}
              onChange={(e) => setEssOverride(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <SideTable
          title={t("PV-sida (paneler + växelriktare + montage)", "PV side (panels + inverter + mounting)")}
          side="pv"
          systemId={config.id}
          lines={lines.filter((l) => l.side === "pv")}
          components={components}
          result={result.pv}
          panels={panels}
          batteryModules={batteryModules}
        />
        <SideTable
          title={t("ESS-sida (batteri + tillhörande)", "ESS side (battery + related)")}
          side="ess"
          systemId={config.id}
          lines={lines.filter((l) => l.side === "ess")}
          injectedLines={result.ess.lines.filter((l) => l.source === "battery_config")}
          components={components}
          result={result.ess}
          panels={panels}
          batteryModules={batteryModules}
        />

        <div className="flex justify-end">
          <Button size="sm" disabled={!dirty || saveConfig.isPending} onClick={() => saveConfig.mutate()}>
            {t("Spara system-inställningar", "Save system settings")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SideTable({
  title,
  side,
  systemId,
  lines,
  injectedLines,
  components,
  result,
  panels,
  batteryModules,
}: {
  title: string;
  side: Side;
  systemId: string;
  lines: SystemLine[];
  injectedLines?: ResolvedLine[];
  components: Component[];
  result: {
    subtotal: number;
    margin: number;
    exVat: number;
    incVat: number;
    afterGta: number;
    price: number;
    overrideApplied: boolean;
  };
  panels: number;
  batteryModules: number;
}) {
  const t = useT();
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: PRICING_KEY });

  const updateLine = useMutation({
    mutationFn: async (line: Partial<SystemLine> & { id: string }) => {
      const { error } = await supabase
        .from("system_component_lines")
        .update({
          component_id: line.component_id,
          qty_kind: line.qty_kind,
          qty_value: line.qty_value,
        })
        .eq("id", line.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_component_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const addLine = useMutation({
    mutationFn: async () => {
      const firstComponent = components.find((c) => c.side === side);
      if (!firstComponent) return;
      const { error } = await supabase.from("system_component_lines").insert({
        system_id: systemId,
        component_id: firstComponent.id,
        side,
        qty_kind: "fixed",
        qty_value: 1,
        sort_order: lines.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const sideComponents = components.filter((c) => c.side === side);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <Button size="sm" variant="outline" onClick={() => addLine.mutate()}>
          +{t("Rad", "Row")}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("Komponent", "Component")}</TableHead>
            <TableHead>{t("Mängdtyp", "Qty type")}</TableHead>
            <TableHead className="text-right">{t("Faktor", "Factor")}</TableHead>
            <TableHead className="text-right">{t("Antal", "Qty")}</TableHead>
            <TableHead className="text-right">{t("á-pris", "Unit price")}</TableHead>
            <TableHead className="text-right">{t("Radsumma", "Row total")}</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {injectedLines?.map((r) => (
            <TableRow key={r.line.id} className="bg-muted/30">
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.component.name}</span>
                  <span className="rounded bg-atmoce/15 px-1.5 py-0.5 text-[10px] font-medium uppercase text-atmoce">
                    {t("från batterikonfig", "from battery config")}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {QTY_KINDS.find((k) => k.kind === r.line.qty_kind)?.sv}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                {fmtNum(r.line.qty_value, 2)}
              </TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtNum(r.qty, 2)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtSek(r.component.unit_price_ex_vat)}</TableCell>
              <TableCell className="text-right font-mono tabular-nums">{fmtSek(r.rowTotal)}</TableCell>
              <TableCell />
            </TableRow>
          ))}
          {lines.map((line) => (
            <LineRow
              key={line.id}
              line={line}
              components={sideComponents}
              panels={panels}
              batteryModules={batteryModules}
              onSave={(l) => updateLine.mutate(l)}
              onDelete={(id) => deleteLine.mutate(id)}
            />
          ))}
        </TableBody>
      </Table>
      <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/40 p-3 text-xs sm:grid-cols-5">
        <Cell label={t("Delsumma", "Subtotal")} value={fmtSek(result.subtotal)} />
        <Cell label={t("Marginal", "Margin")} value={fmtSek(result.margin)} />
        <Cell label={t("Ex moms", "Excl. VAT")} value={fmtSek(result.exVat)} />
        <Cell label={t("Ink moms", "Incl. VAT")} value={fmtSek(result.incVat)} />
        <Cell
          label={t("Efter GTA", "After deduction")}
          value={fmtSek(result.price)}
          highlight
          hint={result.overrideApplied ? t("override", "override") : undefined}
        />
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  highlight,
  hint,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label} {hint && <span className="text-atmoce">· {hint}</span>}
      </div>
      <div className={`font-mono tabular-nums ${highlight ? "text-sm font-semibold text-foreground" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function LineRow({
  line,
  components,
  panels,
  batteryModules,
  onSave,
  onDelete,
}: {
  line: SystemLine;
  components: Component[];
  panels: number;
  batteryModules: number;
  onSave: (l: SystemLine) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(line);
  useEffect(() => setDraft(line), [line]);

  const component = components.find((c) => c.id === draft.component_id);
  const qty = resolveQtyLocal(draft.qty_kind, draft.qty_value, panels, batteryModules);
  const rowTotal = qty * (component?.unit_price_ex_vat ?? 0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(line);

  return (
    <TableRow>
      <TableCell>
        <Select
          value={draft.component_id}
          onValueChange={(v) => setDraft({ ...draft, component_id: v })}
        >
          <SelectTrigger className="h-8 min-w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {components.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={draft.qty_kind}
          onValueChange={(v) => setDraft({ ...draft, qty_kind: v as QtyKind })}
        >
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QTY_KINDS.map((k) => (
              <SelectItem key={k.kind} value={k.kind}>
                {t(k.sv, k.en)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step={0.5}
          value={draft.qty_value}
          onChange={(e) => setDraft({ ...draft, qty_value: parseFloat(e.target.value) || 0 })}
          className="ml-auto h-8 w-20 text-right font-mono"
        />
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{fmtNum(qty, 2)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {fmtSek(component?.unit_price_ex_vat ?? 0)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">{fmtSek(rowTotal)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button size="sm" variant={dirty ? "default" : "ghost"} disabled={!dirty} onClick={() => onSave(draft)}>
            {t("Spara", "Save")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDelete(line.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function resolveQtyLocal(kind: QtyKind, value: number, panels: number, batteryModules: number) {
  switch (kind) {
    case "fixed":
      return value;
    case "per_panel":
      return panels * value;
    case "half_per_panel":
      return (panels / 2) * value;
    case "per_battery_module":
      return batteryModules * value;
  }
}