import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SYSTEMS, SYSTEM_ORDER, type SystemId } from "@/data/systems";
import {
  calculate,
  fmtNum,
  fmtPct,
  fmtSek,
  getReplacementYears,
  INVERTER_REPLACEMENT_COST,
  type CalcParams,
} from "@/lib/calc";
import { usePricingData, buildSystems, type BatteryModulesMap } from "@/lib/usePrices";
import {
  SnowMeltCard,
  DEFAULT_SNOWMELT_STATE,
  type SnowMeltState,
} from "@/components/SnowMeltCard";
import { calculateSnowMelt } from "@/lib/snowmelt";
import { PanelLevelBonusCard } from "@/components/PanelLevelBonusCard";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { useApp, useT } from "@/lib/app-context";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Solsystem-jämförelse 2026 — Atmoce" },
      {
        name: "description",
        content:
          "Jämför Atmoce mikroväxelriktarsystem mot traditionella solenergisystem. LCOE, payback, IRR och produktion sida vid sida.",
      },
      { property: "og:title", content: "Solsystem-jämförelse 2026 — Atmoce" },
      {
        property: "og:description",
        content:
          "Räkna på ekonomi och energiproduktion för Atmoce vs traditionella solsystem.",
      },
    ],
  }),
  component: Index,
});

const DEFAULT_PARAMS: CalcParams = {
  panels: 14,
  wpPerPanel: 460,
  yieldPerKwp: 950,
  buyPrice: 2.2,
  sellPrice: 0.6,
  priceInflation: 0.03,
  selfUseNoBattery: 0.35,
  selfUseWithBattery: 0.75,
  years: 25,
  discountRate: 0.04,
  degradation: 0.005,
};

function NumField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  min,
  editable = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suffix?: string;
  min?: number;
  editable?: boolean;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  useEffect(() => {
    if (!editable) return;
    setDraft(String(value));
  }, [value, editable]);
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {editable ? (
          <Input
            type="number"
            inputMode="numeric"
            step={step}
            min={min}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              const parsed = parseFloat(draft);
              if (!Number.isFinite(parsed)) {
                setDraft(String(value));
                return;
              }
              const clamped = Math.max(min ?? -Infinity, Math.round(parsed));
              onChange(clamped);
              setDraft(String(clamped));
            }}
            className={suffix ? "w-full min-w-0 pr-12 font-mono" : "w-full min-w-0 font-mono"}
          />
        ) : (
          <Input
            type="number"
            inputMode="decimal"
            step={step}
            min={min}
            value={Number.isFinite(value) ? value : ""}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className={suffix ? "w-full min-w-0 pr-12 font-mono" : "w-full min-w-0 font-mono"}
          />
        )}
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Index() {
  const { mode } = useApp();
  const t = useT();
  const isSimple = mode === "simple";
  const [params, setParams] = useState<CalcParams>(DEFAULT_PARAMS);
  const [refChoice, setRefChoice] = useState<SystemId | "custom">("solis_dyness");
  const isCustomRef = refChoice === "custom";
  const referenceId: SystemId = isCustomRef ? "solis_dyness" : refChoice;
  const [snowStateAdv, setSnowStateAdv] = useState<SnowMeltState>(DEFAULT_SNOWMELT_STATE);
  // In simple mode snowmelt is always optimized.
  const snowState: SnowMeltState = isSimple
    ? { ...snowStateAdv, mode: "optimized" }
    : snowStateAdv;
  const setSnowState = setSnowStateAdv;
  const [refReplacements, setRefReplacements] = useState<number>(2);
  const [panelBonusPct, setPanelBonusPct] = useState<number>(8);
  const [pdfLoading, setPdfLoading] = useState(false);
  const npvChartRef = useRef<HTMLDivElement | null>(null);

  const { data: pricing } = usePricingData();
  const [atmoceModulesState, setAtmoceModulesState] = useState<number | null>(null);
  // Prisöverride: null = använd modellens estimerade pris; annars fast pris (ink moms).
  const [atmocePriceOverride, setAtmocePriceOverride] = useState<number | null>(null);
  const [refPriceOverride, setRefPriceOverride] = useState<number | null>(null);
  const [refKwhOverride, setRefKwhOverride] = useState<number | null>(null);
  // Eget-system inputs
  const [customBatteryKwh, setCustomBatteryKwh] = useState<number>(10);
  const [customPrice, setCustomPrice] = useState<number>(100000);
  const [customRoundTrip, setCustomRoundTrip] = useState<number>(90);
  const [customInvWarranty, setCustomInvWarranty] = useState<number>(10);
  const [customBatWarranty, setCustomBatWarranty] = useState<number>(10);

  const atmoceConfig = pricing?.systems.find((s) => s.id === "atmoce");
  const refConfig = pricing?.systems.find((s) => s.id === referenceId);
  const moduleIdFor = (cfg: typeof atmoceConfig) => {
    if (!cfg) return null;
    const bc = pricing?.batteryConfigs.find((b) => b.id === cfg.battery_config_id);
    return bc?.module_component_id ?? cfg.battery_module_id ?? null;
  };
  const atmoceUnitKwh =
    pricing?.components.find((c) => c.id === moduleIdFor(atmoceConfig))?.unit_kwh ?? 7;
  const refUnitKwh =
    pricing?.components.find((c) => c.id === moduleIdFor(refConfig))?.unit_kwh ?? 5.12;

  const atmoceModulesDefault = atmoceConfig?.default_battery_modules ?? 2;
  const atmoceModules = atmoceModulesState ?? atmoceModulesDefault;
  const targetKwh = atmoceModules * atmoceUnitKwh;
  const refModulesAuto = Math.max(1, Math.round(targetKwh / (refUnitKwh || 1)));
  const refKwhAuto = refModulesAuto * refUnitKwh;
  const refKwhEffective = isCustomRef
    ? customBatteryKwh
    : (refKwhOverride ?? refKwhAuto);
  const refModules = isCustomRef
    ? refModulesAuto
    : Math.max(1, Math.round(refKwhEffective / (refUnitKwh || 1)));

  const batteryModules: BatteryModulesMap = useMemo(
    () => ({ atmoce: atmoceModules, [referenceId]: refModules }),
    [atmoceModules, refModules, referenceId],
  );

  const systems = useMemo(
    () =>
      pricing
        ? buildSystems({
            components: pricing.components,
            systems: pricing.systems,
            lines: pricing.lines,
            settings: pricing.settings,
            panels: params.panels,
            batteryModules,
            batteryConfigs: pricing.batteryConfigs,
          })
        : SYSTEMS,
    [pricing, params.panels, batteryModules],
  );

  const atmoce = systems.atmoce;
  const referenceFromModel = systems[referenceId];
  const referenceBase = useMemo(() => {
    if (!isCustomRef) return referenceFromModel;
    return {
      ...referenceFromModel,
      id: referenceId, // keep a valid SystemId to satisfy typing
      name: t("Eget system", "Own system"),
      short: t("Eget", "Own"),
      pvPrice: customPrice,
      essPrice: 0,
      batteryKwh: customBatteryKwh,
      batteryRoundTrip: Math.max(0, Math.min(1, customRoundTrip / 100)),
      productionBonus: 0,
      inverterWarrantyYears: customInvWarranty,
      batteryWarrantyYears: customBatWarranty,
      batteryWarrantyCycles: undefined,
      inverterType: "—",
      panelLevelMonitoring: false,
    };
  }, [isCustomRef, referenceFromModel, referenceId, customPrice, customBatteryKwh, customRoundTrip, customInvWarranty, customBatWarranty, t]);

  // Modellens estimerade totalpris (pv + ess, ink moms efter GTA).
  const atmoceEstimated = atmoce.pvPrice + atmoce.essPrice;
  const refEstimated = isCustomRef
    ? customPrice
    : referenceFromModel.pvPrice + referenceFromModel.essPrice;

  // Effektiv pris som används i kalkylen (override eller estimat).
  const atmocePriceEffective = atmocePriceOverride ?? atmoceEstimated;
  const refPriceEffective = isCustomRef
    ? customPrice
    : (refPriceOverride ?? refEstimated);

  // Apply battery kWh override to the reference object used downstream.
  const reference = useMemo(
    () => ({ ...referenceBase, batteryKwh: refKwhEffective }),
    [referenceBase, refKwhEffective],
  );

  // Applicera prisoverride genom att ersätta pvPrice och nolla essPrice på systemobjektet
  // som calc() summerar (investment = pvPrice + essPrice).
  const atmoceForCalc = useMemo(
    () => ({ ...atmoce, pvPrice: atmocePriceEffective, essPrice: 0 }),
    [atmoce, atmocePriceEffective],
  );
  const referenceForCalc = useMemo(
    () => ({ ...reference, pvPrice: refPriceEffective, essPrice: 0 }),
    [reference, refPriceEffective],
  );

  const set = <K extends keyof CalcParams>(k: K) => (v: number) =>
    setParams((p) => ({ ...p, [k]: v }));

  // Snösmältnings-vinst — endast Atmoce
  const snow = useMemo(
    () =>
      calculateSnowMelt({
        locationId: snowState.locationId,
        panels: params.panels,
        wpPerPanel: params.wpPerPanel,
        yieldPerKwp: params.yieldPerKwp,
        buyPrice: params.buyPrice,
        coverageFactor: snowState.coverageFactor,
        meltPowerW: snowState.meltPowerW,
        meltMinutesPerDay: snowState.meltMinutesPerDay,
        mode: snowState.mode,
      }),
    [snowState, params.panels, params.wpPerPanel, params.yieldPerKwp, params.buyPrice],
  );

  const atmoceWithBonus = useMemo(
    () => ({ ...atmoceForCalc, productionBonus: panelBonusPct / 100 }),
    [atmoceForCalc, panelBonusPct],
  );

  const atmoceParams: CalcParams = {
    ...params,
    extraAnnualSavings: snow.totalNetBenefit,
    extraAnnualKwh: snow.totalRecoveredKwh,
    inverterReplacements: 0,
  };

  const atmoceResult = useMemo(
    () => calculate(atmoceWithBonus, atmoceParams),
    [atmoceWithBonus, atmoceParams],
  );
  const refParams: CalcParams = { ...params, inverterReplacements: refReplacements };
  const refResult = useMemo(
    () => calculate(referenceForCalc, refParams),
    [referenceForCalc, refParams],
  );

  const chartData = useMemo(
    () =>
      atmoceResult.rows.map((r, i) => ({
        year: r.year,
        Atmoce: Math.round(r.cumulativeCashflow),
        [reference.short]: Math.round(refResult.rows[i].cumulativeCashflow),
      })),
    [atmoceResult, refResult, reference.short],
  );

  const npvChartData = useMemo(() => {
    const zero = {
      year: 0,
      Atmoce: Math.round(-atmoceResult.investment),
      [reference.short]: Math.round(-refResult.investment),
    };
    const rows = atmoceResult.rows.map((r, i) => ({
      year: r.year,
      Atmoce: Math.round(r.cumulativeNpv),
      [reference.short]: Math.round(refResult.rows[i].cumulativeNpv),
    }));
    return [zero, ...rows];
  }, [atmoceResult, refResult, reference.short]);

  const productionData = useMemo(
    () =>
      atmoceResult.rows.map((r, i) => ({
        year: r.year,
        Atmoce: Math.round(r.production),
        [reference.short]: Math.round(refResult.rows[i].production),
      })),
    [atmoceResult, refResult, reference.short],
  );

  const extraKwh = atmoceResult.totalProduction - refResult.totalProduction;
  const extraSavings = atmoceResult.totalSavings - refResult.totalSavings;
  const paybackDelta =
    atmoceResult.payback !== null && refResult.payback !== null
      ? refResult.payback - atmoceResult.payback
      : null;

  const kWp = (params.panels * params.wpPerPanel) / 1000;
  const refReplacementYears = useMemo(
    () => getReplacementYears(params.years, refReplacements),
    [params.years, refReplacements],
  );

  const handleGeneratePdf = async () => {
    setPdfLoading(true);
    try {
      const { generateSummaryPdf } = await import("@/lib/pdf");
      await generateSummaryPdf({
        atmoce,
        reference,
        atmoceResult,
        refResult,
        snow,
        snowMode: snowState.mode,
        years: params.years,
        panels: params.panels,
        wpPerPanel: params.wpPerPanel,
          chartElement: npvChartRef.current ?? null,
      });
      toast.success(t("PDF genererad", "PDF generated"));
    } catch (e) {
      console.error(e);
      toast.error(t("Kunde inte generera PDF", "Could not generate PDF"));
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        subtitle={t("Solsystem-kalkylator", "Solar system calculator")}
        right={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleGeneratePdf}
              disabled={pdfLoading}
              aria-label={t("Ladda ner PDF", "Download PDF")}
            >
              <Download className="sm:mr-1.5" />
              <span className="hidden sm:inline">
                {pdfLoading
                  ? t("Genererar…", "Generating…")
                  : t("Ladda ner PDF", "Download PDF")}
              </span>
              <span className="sm:hidden">PDF</span>
            </Button>
            <a
              href="/priser"
              className="rounded-md border border-white/30 bg-white/10 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/20 sm:px-3"
            >
              {t("Priser", "Prices")}
            </a>
          </>
        }
      />

      <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
        {/* Snabb-override: paneler + faktiska offertpriser */}
        <Card className="mb-6 border-l-4 border-l-atmoce">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
              {t("Dina siffror", "Your numbers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
              <NumField
                label={t("Antal solpaneler", "Number of solar panels")}
                value={params.panels}
                onChange={set("panels")}
                editable
                min={1}
              />
              <PriceField
                label={t("Kostnad Atmoce (ink moms, efter GTA)", "Atmoce cost (incl. VAT, after GTA)")}
                value={atmocePriceEffective}
                estimated={atmoceEstimated}
                isOverride={atmocePriceOverride !== null}
                onChange={(n) => setAtmocePriceOverride(n)}
              />
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setAtmocePriceOverride(null);
                    setRefPriceOverride(null);
                    setRefKwhOverride(null);
                  }}
                  disabled={
                    atmocePriceOverride === null &&
                    refPriceOverride === null &&
                    refKwhOverride === null
                  }
                >
                  {t("Estimera kostnad", "Estimate cost")}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  {t("Annat system (referens)", "Other system (reference)")}
                </Label>
                <Select
                  value={refChoice}
                  onValueChange={(v) => {
                    setRefChoice(v as SystemId | "custom");
                    setRefPriceOverride(null);
                    setRefKwhOverride(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ORDER.filter((id) => id !== "atmoce").map((id) => (
                      <SelectItem key={id} value={id}>
                        {SYSTEMS[id].name}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">
                      {t("Eget system…", "Own system…")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <KwhField
                label={t("Batterikapacitet (kWh)", "Battery capacity (kWh)")}
                value={refKwhEffective}
                estimated={isCustomRef ? null : refKwhAuto}
                isOverride={!isCustomRef && refKwhOverride !== null}
                onChange={(n) => {
                  if (isCustomRef) {
                    if (n !== null) setCustomBatteryKwh(n);
                  } else {
                    setRefKwhOverride(n);
                  }
                }}
              />
              <PriceField
                label={t("Kostnad annat system (ink GTA)", "Other system cost (incl. GTA)")}
                value={refPriceEffective}
                estimated={refEstimated}
                isOverride={isCustomRef ? true : refPriceOverride !== null}
                hideEstimate={isCustomRef}
                onChange={(n) => {
                  if (isCustomRef) {
                    if (n !== null) setCustomPrice(n);
                  } else {
                    setRefPriceOverride(n);
                  }
                }}
              />
            </div>

            {isCustomRef && (
              <div className="grid gap-3 rounded-md border border-dashed bg-muted/30 p-3 sm:grid-cols-3">
                <NumField
                  label={t("Round-trip effektivitet", "Round-trip efficiency")}
                  value={customRoundTrip}
                  onChange={(v) => setCustomRoundTrip(Math.max(1, Math.min(100, v)))}
                  suffix="%"
                  step={1}
                  editable
                  min={1}
                />
                <NumField
                  label={t("Garanti växelriktare", "Inverter warranty")}
                  value={customInvWarranty}
                  onChange={(v) => setCustomInvWarranty(Math.max(0, v))}
                  suffix={t("år", "yrs")}
                  step={1}
                  editable
                  min={0}
                />
                <NumField
                  label={t("Garanti batteri", "Battery warranty")}
                  value={customBatWarranty}
                  onChange={(v) => setCustomBatWarranty(Math.max(0, v))}
                  suffix={t("år", "yrs")}
                  step={1}
                  editable
                  min={0}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Input panel */}
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {t("Anläggning", "System size")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label={t("Antal paneler", "Number of panels")}
                  value={params.panels}
                  onChange={set("panels")}
                />
                <NumField
                  label={t("Wp/panel", "Wp/panel")}
                  value={params.wpPerPanel}
                  onChange={set("wpPerPanel")}
                  suffix="W"
                />
                <div className="col-span-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{t("Total:", "Total:")} </span>
                  <span className="font-mono font-semibold">
                    {fmtNum(kWp, 2)} kWp
                  </span>
                </div>
              </CardContent>
            </Card>

            {!isSimple && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {t("Produktion & elpris", "Production & electricity price")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label={t("Årsprod.", "Annual prod.")}
                  value={params.yieldPerKwp}
                  onChange={set("yieldPerKwp")}
                  suffix="kWh/kWp"
                />
                <NumField
                  label={t("Degradering", "Degradation")}
                  value={params.degradation * 100}
                  onChange={(v) => set("degradation")(v / 100)}
                  step={0.1}
                  suffix={t("%/år", "%/yr")}
                />
                <NumField
                  label={t("Köppris", "Buy price")}
                  value={params.buyPrice}
                  onChange={set("buyPrice")}
                  step={0.1}
                  suffix="kr/kWh"
                />
                <NumField
                  label={t("Spotpris sälj", "Spot sell price")}
                  value={params.sellPrice}
                  onChange={set("sellPrice")}
                  step={0.1}
                  suffix="kr/kWh"
                />
                <NumField
                  label={t("Prisökning", "Price inflation")}
                  value={params.priceInflation * 100}
                  onChange={(v) => set("priceInflation")(v / 100)}
                  step={0.5}
                  suffix={t("%/år", "%/yr")}
                />
              </CardContent>
            </Card>
            )}

            {!isSimple && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {t("Användning", "Usage")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label={t("Egenanv. utan batteri", "Self-use w/o battery")}
                  value={params.selfUseNoBattery * 100}
                  onChange={(v) => set("selfUseNoBattery")(v / 100)}
                  suffix="%"
                />
                <NumField
                  label={t("Egenanv. med batteri", "Self-use w/ battery")}
                  value={params.selfUseWithBattery * 100}
                  onChange={(v) => set("selfUseWithBattery")(v / 100)}
                  suffix="%"
                />
              </CardContent>
            </Card>
            )}

            {!isSimple && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {t("Kalkyl", "Calculation")}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label={t("Kalkyltid", "Period")}
                  value={params.years}
                  onChange={set("years")}
                  suffix={t("år", "yrs")}
                />
                <NumField
                  label={t("Diskontering", "Discount rate")}
                  value={params.discountRate * 100}
                  onChange={(v) => set("discountRate")(v / 100)}
                  step={0.5}
                  suffix="%"
                />
              </CardContent>
            </Card>
            )}

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  {t("Atmoce batteri", "Atmoce battery")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pricing && (
                  <div className="space-y-2 pt-1">
                    <NumField
                      label={t(
                        `Atmoce batterimoduler (à ${fmtNum(atmoceUnitKwh, 2)} kWh)`,
                        `Atmoce battery modules (each ${fmtNum(atmoceUnitKwh, 2)} kWh)`,
                      )}
                      value={atmoceModules}
                      onChange={(v) => setAtmoceModulesState(Math.max(1, Math.round(v)))}
                      step={1}
                      min={1}
                      editable
                      suffix={`${fmtNum(atmoce.batteryKwh, 1)} kWh`}
                    />
                    {!isCustomRef && refKwhOverride === null && (
                    <div className="rounded-md bg-muted px-3 py-2 text-xs">
                      <div className="text-muted-foreground">
                        {t("Referenssystem matchas automatiskt", "Reference system matched automatically")}
                      </div>
                      <div className="font-mono">
                        {refModules} × {fmtNum(refUnitKwh, 2)} kWh ={" "}
                        <span className="font-semibold">{fmtNum(reference.batteryKwh, 2)} kWh</span>
                      </div>
                    </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>

          {/* Results */}
          <section className="space-y-6">
            {/* Side-by-side metric cards */}
            <div className="grid gap-4 md:grid-cols-2">
              <SystemCard
                title={atmoce.name}
                isAtmoce
                investment={atmoceResult.investment}
                production={atmoceResult.totalProduction}
                savings={atmoceResult.totalSavings}
                payback={atmoceResult.payback}
                irr={atmoceResult.irr}
                lcoe={atmoceResult.lcoe}
                npv={atmoceResult.npv}
                kWp={atmoceResult.kWp}
                batteryKwh={atmoce.batteryKwh}
                t={t}
              />
              <SystemCard
                title={reference.name}
                investment={refResult.investment}
                production={refResult.totalProduction}
                savings={refResult.totalSavings}
                payback={refResult.payback}
                irr={refResult.irr}
                lcoe={refResult.lcoe}
                npv={refResult.npv}
                kWp={refResult.kWp}
                batteryKwh={reference.batteryKwh}
                t={t}
              />
            </div>

            {/* Delta strip */}
            <Card className="border-l-4 border-l-atmoce">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                <DeltaItem
                  label={t("Mer producerad el över kalkyltiden", "More electricity produced over the period")}
                  value={`${extraKwh >= 0 ? "+" : ""}${fmtNum(extraKwh)} kWh`}
                  positive={extraKwh >= 0}
                />
                <DeltaItem
                  label={t("Mer besparing över kalkyltiden", "More savings over the period")}
                  value={`${extraSavings >= 0 ? "+" : ""}${fmtSek(extraSavings)}`}
                  positive={extraSavings >= 0}
                />
                <DeltaItem
                  label={t("Snabbare payback", "Faster payback")}
                  value={
                    paybackDelta === null
                      ? "—"
                      : `${paybackDelta >= 0 ? "+" : ""}${fmtNum(paybackDelta, 1)} ${t("år", "yrs")}`
                  }
                  positive={(paybackDelta ?? 0) >= 0}
                />
              </CardContent>
            </Card>

            <SnowMeltCard
              state={snowState}
              onChange={setSnowState}
              panels={params.panels}
              wpPerPanel={params.wpPerPanel}
              yieldPerKwp={params.yieldPerKwp}
              buyPrice={params.buyPrice}
              years={params.years}
              compact={isSimple}
            />

            {!isSimple && (
            <PanelLevelBonusCard
              bonusPct={panelBonusPct}
              onBonusChange={setPanelBonusPct}
              panels={params.panels}
              wpPerPanel={params.wpPerPanel}
              yieldPerKwp={params.yieldPerKwp}
              buyPrice={params.buyPrice}
              sellPrice={params.sellPrice}
              selfUseShare={params.selfUseWithBattery}
              years={params.years}
            />
            )}

            {/* Inverter replacement module */}
            {!isSimple && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Växelriktarbyten", "Inverter replacements")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  {t(
                    `Atmoce har ${atmoce.inverterWarrantyYears} års produktgaranti på sina mikroväxelriktare. Traditionella system har ofta kortare garanti, vilket innebär ett eller flera byten under kalkyltiden. Varje byte räknas som ${fmtSek(INVERTER_REPLACEMENT_COST)} ink. moms.`,
                    `Atmoce has ${atmoce.inverterWarrantyYears} years product warranty on its microinverters. Traditional systems often have a shorter warranty, meaning one or more replacements during the calculation period. Each replacement counts as ${fmtSek(INVERTER_REPLACEMENT_COST)} incl. VAT.`,
                  )}
                </p>
                <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>System</TableHead>
                      <TableHead className="text-right">{t("Garanti", "Warranty")}</TableHead>
                      <TableHead className="text-center">{t("Antal byten", "# replacements")}</TableHead>
                      <TableHead className="text-right">{t("Bytesår", "Replacement years")}</TableHead>
                      <TableHead className="text-right">{t("Total kostnad", "Total cost")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{atmoce.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {atmoce.inverterWarrantyYears} {t("år", "yrs")}
                      </TableCell>
                      <TableCell className="text-center font-mono">0</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        —
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtSek(0)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">{reference.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {reference.inverterWarrantyYears} {t("år", "yrs")}
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={String(refReplacements)}
                          onValueChange={(v) => setRefReplacements(Number(v))}
                        >
                          <SelectTrigger className="mx-auto w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0</SelectItem>
                            <SelectItem value="1">1</SelectItem>
                            <SelectItem value="2">2</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {refReplacementYears.length === 0
                          ? "—"
                          : refReplacementYears.map((y) => `${t("År", "Year")} ${y}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtSek(refResult.totalReplacementCost)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Cumulative NPV chart — like reference image */}
            {!isSimple && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>
                    {t(`Ackumulerat nuvärde över ${params.years} år`, `Cumulative present value over ${params.years} years`)}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={pdfLoading}
                  >
                    <Download className="mr-1.5" />
                    {pdfLoading
                      ? t("Genererar…", "Generating…")
                      : t("Sammanfattning som PDF", "Summary as PDF")}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div ref={npvChartRef} className="h-80 w-full bg-card">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={npvChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 12 }}
                        label={{
                          value: t("År", "Year"),
                          position: "insideBottom",
                          offset: -4,
                        }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) =>
                          Math.abs(v) >= 1000
                            ? `${Math.round(v / 1000)}k`
                            : `${v}`
                        }
                        label={{
                          value: t("Ackumulerat nuvärde (kr)", "Cumulative present value (kr)"),
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle" },
                        }}
                      />
                      <Tooltip
                        formatter={(v) => fmtSek(Number(v))}
                        labelFormatter={(l) => `${t("År", "Year")} ${l}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Atmoce"
                        stroke="var(--atmoce)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey={reference.short}
                        stroke="var(--reference)"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t(
                    "Startar på −investering år 0 och adderar varje års diskonterade nettokassaflöde. Växelriktarbyten dras av som negativa kassaflöden de år de inträffar.",
                    "Starts at −investment in year 0 and adds each year's discounted net cash flow. Inverter replacements are deducted as negative cash flows in the years they occur.",
                  )}
                </p>
              </CardContent>
            </Card>
            )}

            {/* Cashflow chart */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {t("Kumulativ besparing över", "Cumulative savings over")} {params.years} {t("år", "years")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 12 }}
                        label={{ value: t("År", "Year"), position: "insideBottom", offset: -4 }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                        }
                      />
                      <Tooltip
                        formatter={(v) => fmtSek(Number(v))}
                        labelFormatter={(l) => `${t("År", "Year")} ${l}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Atmoce"
                        stroke="var(--atmoce)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={reference.short}
                        stroke="var(--reference)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Production chart */}
            {!isSimple && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Årlig elproduktion (kWh)", "Annual electricity production (kWh)")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={productionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(v) => `${fmtNum(Number(v))} kWh`}
                        labelFormatter={(l) => `${t("År", "Year")} ${l}`}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="Atmoce"
                        stroke="var(--atmoce)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={reference.short}
                        stroke="var(--reference)"
                        strokeWidth={2.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Technical comparison */}
            {!isSimple && (
            <Card>
              <CardHeader>
                <CardTitle>{t("Teknisk jämförelse", "Technical comparison")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Parameter", "Parameter")}</TableHead>
                      <TableHead className="text-right">Atmoce</TableHead>
                      <TableHead className="text-right">{reference.short}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Row
                      label={t("Växelriktare", "Inverter")}
                      a={atmoce.inverterType}
                      b={reference.inverterType}
                    />
                    <Row
                      label={t("Garanti växelriktare", "Inverter warranty")}
                      a={`${atmoce.inverterWarrantyYears} ${t("år", "yrs")}`}
                      b={`${reference.inverterWarrantyYears} ${t("år", "yrs")}`}
                    />
                    <Row
                      label={t("Garanti batteri", "Battery warranty")}
                      a={`${atmoce.batteryWarrantyYears} ${t("år", "yrs")} / ${atmoce.batteryWarrantyCycles ?? "—"} ${t("cykler", "cycles")}`}
                      b={`${reference.batteryWarrantyYears} ${t("år", "yrs")} / ${reference.batteryWarrantyCycles ?? "—"} ${t("cykler", "cycles")}`}
                    />
                    <Row
                      label={t("Batterikapacitet", "Battery capacity")}
                      a={`${atmoce.batteryKwh} kWh`}
                      b={`${reference.batteryKwh} kWh`}
                    />
                    <Row
                      label={t("Round-trip-effektivitet", "Round-trip efficiency")}
                      a={fmtPct(atmoce.batteryRoundTrip, 0)}
                      b={fmtPct(reference.batteryRoundTrip, 0)}
                    />
                    <Row
                      label={t("Produktionsbonus (skugga/MPPT)", "Production bonus (shade/MPPT)")}
                      a={fmtPct(atmoce.productionBonus, 0)}
                      b={fmtPct(reference.productionBonus, 0)}
                    />
                    <Row
                      label={t("Panelnivå-övervakning", "Panel-level monitoring")}
                      a={atmoce.panelLevelMonitoring ? t("Ja", "Yes") : t("Nej", "No")}
                      b={reference.panelLevelMonitoring ? t("Ja", "Yes") : t("Nej", "No")}
                    />
                    <Row
                      label={t("Pris PV", "PV price")}
                      a={fmtSek(atmoce.pvPrice)}
                      b={fmtSek(reference.pvPrice)}
                    />
                    <Row
                      label={t("Pris ESS", "ESS price")}
                      a={fmtSek(atmoce.essPrice)}
                      b={fmtSek(reference.essPrice)}
                    />
                    <Row
                      label="kr/Wp"
                      a={fmtNum(atmoce.pvPrice / (params.panels * params.wpPerPanel), 2)}
                      b={fmtNum(
                        reference.pvPrice / (params.panels * params.wpPerPanel),
                        2,
                      )}
                    />
                    <Row
                      label={t("kr/kWh batteri", "kr/kWh battery")}
                      a={fmtNum(atmoce.essPrice / atmoce.batteryKwh, 0)}
                      b={fmtNum(reference.essPrice / reference.batteryKwh, 0)}
                    />
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
            )}

            {!isSimple && (
            <p className="text-xs text-muted-foreground">
              {t(
                "Priser inkl. 15 % grönt teknikavdrag enligt prislista 2026. LCOE beräknas med diskonterad produktion. IRR baseras på årliga kassaflöden vid given diskonteringsränta. Antaganden kan justeras i vänsterpanelen.",
                "Prices incl. 15% green tech deduction per 2026 price list. LCOE is computed with discounted production. IRR is based on annual cash flows at the given discount rate. Assumptions can be adjusted in the left panel.",
              )}
            </p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function PriceField({
  label,
  value,
  estimated,
  isOverride,
  hideEstimate,
  onChange,
}: {
  label: string;
  value: number;
  estimated: number;
  isOverride: boolean;
  hideEstimate?: boolean;
  onChange: (n: number | null) => void;
}) {
  const [draft, setDraft] = useState<string>(String(Math.round(value)));
  useEffect(() => {
    setDraft(String(Math.round(value)));
  }, [value]);
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="numeric"
          step={100}
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(draft);
            if (!Number.isFinite(parsed) || parsed < 0) {
              setDraft(String(Math.round(value)));
              return;
            }
            const rounded = Math.round(parsed);
            if (rounded === Math.round(estimated)) {
              onChange(null);
            } else {
              onChange(rounded);
            }
          }}
          className="w-full min-w-0 pr-14 font-mono"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          kr
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {hideEstimate
          ? "\u00A0"
          : isOverride
          ? `Estimat: ${fmtSek(estimated)}`
          : "Använder modellens estimat"}
      </div>
    </div>
  );
}

function KwhField({
  label,
  value,
  estimated,
  isOverride,
  onChange,
}: {
  label: string;
  value: number;
  estimated: number | null;
  isOverride: boolean;
  onChange: (n: number | null) => void;
}) {
  const [draft, setDraft] = useState<string>(String(Math.round((value ?? 0) * 100) / 100));
  useEffect(() => {
    setDraft(String(Math.round((value ?? 0) * 100) / 100));
  }, [value]);
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step={0.1}
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const parsed = parseFloat(draft);
            if (!Number.isFinite(parsed) || parsed < 0) {
              setDraft(String(Math.round((value ?? 0) * 100) / 100));
              return;
            }
            const rounded = Math.round(parsed * 100) / 100;
            if (estimated !== null && Math.abs(rounded - estimated) < 0.005) {
              onChange(null);
            } else {
              onChange(rounded);
            }
          }}
          className="w-full min-w-0 pr-14 font-mono"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          kWh
        </span>
      </div>
      <div className="text-[11px] text-muted-foreground">
        {estimated === null
          ? "\u00A0"
          : isOverride
            ? `Auto: ${fmtNum(estimated, 2)} kWh`
            : "Auto (matchas till Atmoce)"}
      </div>
    </div>
  );
}

function SystemCard({
  title,
  isAtmoce,
  investment,
  production,
  savings,
  payback,
  irr,
  lcoe,
  npv,
  kWp: _kWp,
  batteryKwh,
  t,
}: {
  title: string;
  isAtmoce?: boolean;
  investment: number;
  production: number;
  savings: number;
  payback: number | null;
  irr: number | null;
  lcoe: number;
  npv: number;
  kWp: number;
  batteryKwh?: number;
  t: (sv: string, en: string) => string;
}) {
  return (
    <Card
      className={
        isAtmoce
          ? "border-atmoce/40 bg-atmoce-soft/40 ring-1 ring-atmoce/20"
          : "bg-reference-soft/30"
      }
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {isAtmoce && (
            <span className="rounded-full bg-atmoce px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground">
              {t("Rekommenderad", "Recommended")}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Metric label={t("Investering", "Investment")} value={fmtSek(investment)} />
        <Metric label="LCOE" value={`${fmtNum(lcoe, 2)} kr/kWh`} big />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Metric
            label={t("Payback", "Payback")}
            value={payback === null ? t("> kalkyltid", "> period") : `${fmtNum(payback, 1)} ${t("år", "yrs")}`}
          />
          <Metric label="IRR" value={irr === null ? "—" : fmtPct(irr)} />
          <Metric label={t("Total produktion", "Total production")} value={`${fmtNum(production)} kWh`} />
          <Metric label={t("Total besparing", "Total savings")} value={fmtSek(savings)} />
          <Metric label="NPV" value={fmtSek(npv)} />
          {typeof batteryKwh === "number" && (
            <Metric
              label={t("Batteri", "Battery")}
              value={`${fmtNum(batteryKwh, 2)} kWh`}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  big,
}: {
  label: string;
  value: string;
  big?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          big
            ? "font-mono text-2xl font-semibold tabular-nums"
            : "font-mono text-base font-medium tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}

function DeltaItem({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-mono text-lg font-semibold tabular-nums ${positive ? "text-atmoce" : "text-destructive"}`}
      >
        {value}
      </div>
    </div>
  );
}

function Row({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{a}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{b}</TableCell>
    </TableRow>
  );
}
