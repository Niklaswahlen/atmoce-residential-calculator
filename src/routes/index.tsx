import { ThroughputCard } from "@/components/ThroughputCard";
import { ATMOCE_THROUGHPUT_MWH, REF_THROUGHPUT_LABEL, REF_THROUGHPUT_MWH } from "@/data/throughput";
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
import {
  useCalculatorPricing,
  buildSystemsPublic,
  findPublicSystem,
  unitKwhFor,
  type BatteryModulesMap,
} from "@/lib/usePrices";
import {
  SnowMeltCard,
  DEFAULT_SNOWMELT_STATE,
  type SnowMeltState,
} from "@/components/SnowMeltCard";
import { calculateSnowMelt } from "@/lib/snowmelt";
import { PanelLevelBonusCard } from "@/components/PanelLevelBonusCard";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
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

// Format a number with thin space thousand separators when >= 1000.
function formatWithSpaces(n: number, decimals = 0): string {
  if (!Number.isFinite(n)) return "";
  const abs = Math.abs(n);
  const d = decimals;
  if (abs < 1000) {
    return d > 0 ? String(Math.round(n * 10 ** d) / 10 ** d) : String(n);
  }
  return n
    .toLocaleString("sv-SE", { maximumFractionDigits: d, minimumFractionDigits: 0 })
    .replace(/\u00a0/g, " ");
}

function parseSpaced(s: string): number {
  return parseFloat(s.replace(/\s+/g, "").replace(",", "."));
}

function NumField({
  label,
  value,
  onChange,
  step = 1,
  suffix,
  min,
  editable = false,
  center = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suffix?: string;
  min?: number;
  editable?: boolean;
  center?: boolean;
}) {
  const decimals = step < 1 ? 2 : 0;
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(formatWithSpaces(value, decimals));
  useEffect(() => {
    if (focused) return;
    setDraft(formatWithSpaces(value, decimals));
  }, [value, focused, decimals]);
  const commit = () => {
    setFocused(false);
    const parsed = parseSpaced(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatWithSpaces(value, decimals));
      return;
    }
    let out = parsed;
    if (editable) out = Math.round(out);
    if (min !== undefined) out = Math.max(min, out);
    onChange(out);
    setDraft(formatWithSpaces(out, decimals));
  };
  const stepBy = (dir: 1 | -1) => {
    let next = value + dir * step;
    if (editable) next = Math.round(next);
    if (min !== undefined) next = Math.max(min, next);
    onChange(next);
    if (!focused) setDraft(formatWithSpaces(next, decimals));
  };
  return (
    <div className="min-w-0 space-y-1">
      <Label className={`text-[11px] leading-none font-medium text-muted-foreground${center ? " block text-center" : ""}`}>{label}</Label>
      <div className="relative">
        <Input
          type="text"
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          value={draft}
          onFocus={() => {
            setFocused(true);
            setDraft(String(value));
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          className={`h-8 w-full min-w-0 pr-14 font-mono text-sm${center ? " text-center" : ""}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
            {suffix}
          </span>
        )}
        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 flex-col">
          <button
            type="button"
            aria-label={`Öka ${label}`}
            className="flex h-3.5 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => stepBy(1)}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label={`Minska ${label}`}
            className="flex h-3.5 w-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => stepBy(-1)}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Index() {
  const { mode } = useApp();
  const t = useT();
  const isBase = mode === "base";
  const isSimple = mode !== "advanced";
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

  const { data: pricing } = useCalculatorPricing();
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

  const atmoceConfig = findPublicSystem(pricing, "atmoce");
  const refConfig = findPublicSystem(pricing, referenceId);
  const [atmoceBatteryConfigId, setAtmoceBatteryConfigId] = useState<string | null>(null);
  const atmoceBatteryOptions = atmoceConfig?.batteryOptions ?? [];
  const atmoceBatteryId =
    atmoceBatteryConfigId ?? atmoceConfig?.defaultBatteryConfigId ?? undefined;
  const atmoceUnitKwh = unitKwhFor(atmoceConfig, atmoceBatteryId) || 7;
  const refUnitKwh = refConfig?.batteryKwhPerModule || 5.12;

  const atmoceModulesDefault = atmoceConfig?.defaultBatteryModules ?? 2;
  const atmoceOption = atmoceBatteryOptions.find((o) => o.configId === atmoceBatteryId);
  const atmoceMinModules = atmoceOption?.minModules ?? 1;
  const atmoceMaxModules = atmoceOption?.maxModules ?? 15;
  const atmoceModules = Math.max(
    atmoceMinModules,
    Math.min(atmoceMaxModules, atmoceModulesState ?? atmoceModulesDefault),
  );
  const targetKwh = atmoceModules * atmoceUnitKwh;
  const refModulesAuto = Math.max(1, Math.round(targetKwh / (refUnitKwh || 1)));
  const refKwhAuto = refModulesAuto * refUnitKwh;
  const refKwhEffective = isCustomRef
    ? customBatteryKwh
    : (refKwhOverride ?? refKwhAuto);
  const refModules = isCustomRef
    ? refModulesAuto
    : Math.max(1, Math.round(refKwhEffective / (refUnitKwh || 1)));

  // Auto-match Atmoce battery modules to the reference system's total kWh
  // whenever the user changes the reference side (dropdown, module count,
  // or custom-system kWh). When the reference is auto-following Atmoce
  // (no override, not custom), skip to avoid update loops.
  const refKwhForMatch = isCustomRef ? customBatteryKwh : (refKwhOverride ?? null);
  useEffect(() => {
    if (refKwhForMatch === null) return;
    const matched = Math.max(1, Math.round(refKwhForMatch / (atmoceUnitKwh || 1)));
    setAtmoceModulesState((prev) => (prev === matched ? prev : matched));
  }, [refKwhForMatch, atmoceUnitKwh]);

  const batteryModules: BatteryModulesMap = useMemo(
    () => ({ atmoce: atmoceModules, [referenceId]: refModules }),
    [atmoceModules, refModules, referenceId],
  );

  const systems = useMemo(
    () =>
      pricing
        ? buildSystemsPublic({
            pricing,
            panels: params.panels,
            batteryModules,
            batteryConfigIds: { atmoce: atmoceBatteryId },
          })
        : SYSTEMS,
    [pricing, params.panels, batteryModules, atmoceBatteryId],
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

  // --- Atmoce-fördelar (vinnarkort) ---
  const inverterSavings = refReplacements * INVERTER_REPLACEMENT_COST;
  const bonusKwhPerYear = kWp * params.yieldPerKwp * (panelBonusPct / 100);
  const extraKwhPerYear = bonusKwhPerYear + snow.totalRecoveredKwh;
  const atmoceWarrantyYears =
    atmoceOption?.warrantyYears ?? atmoce.batteryWarrantyYears ?? null;
  const atmoceWarrantyCycles =
    atmoceOption?.warrantyCycles ?? atmoce.batteryWarrantyCycles ?? null;
  const refWarrantyYears = reference.batteryWarrantyYears ?? null;
  const refWarrantyCycles = reference.batteryWarrantyCycles ?? null;
  const tpRefPerModule = !isCustomRef ? REF_THROUGHPUT_MWH[referenceId] : undefined;
  const tpAtmocePerModule = atmoceBatteryId ? ATMOCE_THROUGHPUT_MWH[atmoceBatteryId] : undefined;
  const throughputA =
    tpRefPerModule && tpAtmocePerModule ? tpAtmocePerModule * atmoceModules : null;
  const throughputB = tpRefPerModule && tpAtmocePerModule ? tpRefPerModule * refModules : null;
  // Batterisidans pris (ESS: batteri + installation, efter GTA) — används för kr/MWh.
  // Vid manuell pris-override eller eget system används det inmatade priset.
  const throughputEssPriceA = atmocePriceOverride ?? atmoce.essPrice;
  const throughputEssPriceB = isCustomRef ? customPrice : (refPriceOverride ?? referenceFromModel.essPrice);
  // Batterimodellens namn med kapacitet, alltid i samma form: "Atmoce 8 kWh",
  // "Atmoce M-ELV 7 kWh", "Dyness Stack100 5,12 kWh" — utan parenteser.
  const withKwh = (name: string, kwh: number) =>
    /\d\s*kwh/i.test(name) ? name : `${name} ${fmtNum(kwh, kwh % 1 === 0 ? 0 : 2)} kWh`;
  const atmoceModuleLabel = atmoceOption
    ? withKwh(atmoceOption.name, atmoceOption.kwhPerModule)
    : atmoce.name;
  const refModuleLabel = !isCustomRef
    ? REF_THROUGHPUT_LABEL[referenceId]
      ? withKwh(REF_THROUGHPUT_LABEL[referenceId], refUnitKwh)
      : reference.name
    : reference.name;

  // Applicera en snabbmall: panelantal + rimligt batteri, och låt
  // referenssystemet automatiskt matcha den nya kapaciteten.
  const applyPreset = (panels: number, modules: number) => {
    setParams((p) => ({ ...p, panels }));
    setAtmoceModulesState(
      Math.max(atmoceMinModules, Math.min(atmoceMaxModules, modules)),
    );
    setRefKwhOverride(null);
    setAtmocePriceOverride(null);
    setRefPriceOverride(null);
  };

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
        atmoceBatteryWarrantyYears: atmoceWarrantyYears,
        atmoceBatteryWarrantyCycles: atmoceWarrantyCycles,
        throughputAtmoceMwh: throughputA,
        throughputRefMwh: throughputB,
        throughputEssPriceA,
        throughputEssPriceB,
        throughputRefLabel: refModuleLabel,
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

      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-5">
        {/* Snabb-override: paneler + faktiska offertpriser */}
        <Card className="mb-4 border-l-4 border-l-atmoce">
          <CardHeader className="pb-1 pt-4">
            <CardTitle className="text-center text-sm uppercase tracking-wide text-muted-foreground">
              {t("Dina siffror", "Your numbers")}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="mx-auto grid max-w-5xl gap-2 lg:grid-cols-2">
              {/* Rad 1: Dina siffror / anläggning — centrerad över båda systemen */}
              <div className="mx-auto w-full max-w-sm space-y-2 lg:col-span-2 lg:row-start-1">
                <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Anläggning & Atmoce batteri", "System & Atmoce battery")}
                </div>
                <div className="flex flex-nowrap justify-center gap-1.5">
                  {[
                    { panels: 10, modules: 1 },
                    { panels: 15, modules: 2 },
                    { panels: 20, modules: 2 },
                  ].map((p) => (
                    <Button
                      key={p.panels}
                      type="button"
                      size="sm"
                      variant={params.panels === p.panels ? "default" : "outline"}
                      className="h-7 px-2.5 text-xs"
                      onClick={() => applyPreset(p.panels, p.modules)}
                    >
                      {p.panels} {t("paneler", "panels")}
                      <span className="ml-1 opacity-70">
                        {fmtNum((p.panels * params.wpPerPanel) / 1000, 1)} kWp
                      </span>
                    </Button>
                  ))}
                </div>
                <div className="mx-auto grid max-w-sm grid-cols-2 gap-2">
                  <NumField
                    center
                    label={t("Antal solpaneler", "Number of solar panels")}
                    value={params.panels}
                    onChange={set("panels")}
                    editable
                    min={1}
                  />
                  <NumField
                    center
                    label={t("Wp/panel", "Wp/panel")}
                    value={params.wpPerPanel}
                    onChange={set("wpPerPanel")}
                    editable
                    min={1}
                    suffix="W"
                  />
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  {t("Totalt", "Total")} <b className="text-foreground">{fmtNum(kWp, 2)} kWp</b>
                </p>
              </div>

              {/* Rad 2 vänster: Atmoce batterimodell */}
              {pricing && atmoceBatteryOptions.length > 1 && (
                <div className="min-w-0 space-y-1.5 lg:col-start-1 lg:row-start-2">
                  <Label className="block text-center text-xs font-medium text-muted-foreground">
                    {t("Atmoce batterimodell", "Atmoce battery model")}
                  </Label>
                  <Select
                    value={atmoceBatteryId ?? ""}
                    onValueChange={(v) => {
                      setAtmoceBatteryConfigId(v);
                      // Låt referenssystemet automatiskt matcha nya kapaciteten.
                      setRefKwhOverride(null);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {atmoceBatteryOptions.map((o) => (
                        <SelectItem key={o.configId} value={o.configId}>
                          {o.name} — {fmtNum(o.kwhPerModule, 2)} kWh
                          {o.warrantyYears ? ` · ${o.warrantyYears} ${t("år", "yrs")}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Rad 2 höger: Annat system (referens) + Välj system */}
              <div className="space-y-2 lg:col-start-2 lg:row-start-2">
                <div className="text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("Annat system (referens)", "Other system (reference)")}
                </div>
                <div className="min-w-0 space-y-1.5">

                  <Select
                    value={refChoice}
                    onValueChange={(v) => {
                      setRefChoice(v as SystemId | "custom");
                      setRefPriceOverride(null);
                      setRefKwhOverride(null);
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
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
              </div>

              {/* Rad 3 vänster: Atmoce batterimoduler + jämförelse */}
              <div className="space-y-2 lg:col-start-1 lg:row-start-3">
                {pricing && (
                  <NumField
                    center
                    label={t(
                      `Atmoce batterimoduler (à ${fmtNum(atmoceUnitKwh, 2)} kWh)`,
                      `Atmoce battery modules (each ${fmtNum(atmoceUnitKwh, 2)} kWh)`,
                    )}
                    value={atmoceModules}
                    onChange={(v) =>
                      setAtmoceModulesState(
                        Math.max(
                          atmoceMinModules,
                          Math.min(atmoceMaxModules, Math.round(v)),
                        ),
                      )
                    }
                    editable
                    min={atmoceMinModules}
                    suffix={`${fmtNum(atmoce.batteryKwh, 1)} kWh`}
                  />
                )}
              </div>

              {/* Rad 3 höger: referens batterimoduler */}
              <div className="space-y-2 lg:col-start-2 lg:row-start-3">
                {isCustomRef ? (
                  <div className="grid gap-3 rounded-md border border-dashed bg-muted/30 p-3 sm:grid-cols-2">
                    <NumField
                      center
                      label={t("Batterikapacitet", "Battery capacity")}
                      value={customBatteryKwh}
                      onChange={(v) => setCustomBatteryKwh(Math.max(1, v))}
                      editable
                      min={1}
                      suffix="kWh"
                    />
                    <NumField
                      center
                      label={t("Round-trip effektivitet", "Round-trip efficiency")}
                      value={customRoundTrip}
                      onChange={(v) => setCustomRoundTrip(Math.max(1, Math.min(100, v)))}
                      suffix="%"
                      editable
                      min={1}
                    />
                    <NumField
                      center
                      label={t("Garanti växelriktare", "Inverter warranty")}
                      value={customInvWarranty}
                      onChange={(v) => setCustomInvWarranty(Math.max(0, v))}
                      suffix={t("år", "yrs")}
                      editable
                      min={0}
                    />
                    <NumField
                      center
                      label={t("Garanti batteri", "Battery warranty")}
                      value={customBatWarranty}
                      onChange={(v) => setCustomBatWarranty(Math.max(0, v))}
                      suffix={t("år", "yrs")}
                      editable
                      min={0}
                    />
                  </div>
                ) : (
                  <>
                    <NumField
                      center
                      label={t(
                        `Batterimoduler (à ${fmtNum(refUnitKwh, 2)} kWh)`,
                        `Battery modules (each ${fmtNum(refUnitKwh, 2)} kWh)`,
                      )}
                      value={refModules}
                      onChange={(v) => {
                        const m = Math.max(1, Math.round(v));
                        setRefKwhOverride(m * refUnitKwh);
                      }}
                      editable
                      min={1}
                      suffix={`${fmtNum(reference.batteryKwh, 1)} kWh`}
                    />
                  </>
                )}
              </div>

              {/* Rad 4: prisrutor — Atmoce till vänster, referens till höger */}
              <div className="rounded-md border border-atmoce/40 bg-atmoce/5 px-2.5 py-2 lg:col-start-1 lg:row-start-4">
                <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-atmoce">
                  {t("Atmoce", "Atmoce")}
                </div>
                <PriceField
                  center
                  label={t(
                    "Kostnad (ink moms, efter GTA)",
                    "Cost (incl. VAT, after GTA)",
                  )}
                  value={atmocePriceEffective}
                  estimated={atmoceEstimated}
                  isOverride={atmocePriceOverride !== null}
                  onChange={(n) => setAtmocePriceOverride(n)}
                />
              </div>
              <div className="rounded-md border bg-muted/50 px-2.5 py-2 lg:col-start-2 lg:row-start-4">
                <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {reference.short}
                </div>
                <PriceField
                  center
                  label={t("Kostnad (ink GTA)", "Cost (incl. GTA)")}
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

              <div className="lg:col-span-2 lg:row-start-5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full"
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
          </CardContent>
        </Card>

        {/* Atmoce-fördelar: fyra vinnarkort — döljs i Base */}
        {!isBase && (
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <WinCard
            label={t("Ekonomisk vinst", "Economic gain")}
            value={`${extraSavings >= 0 ? "+" : ""}${fmtSek(extraSavings)}`}
            note={
              paybackDelta === null
                ? t(
                    `mer i plånboken över ${params.years} år`,
                    `more money over ${params.years} years`,
                  )
                : t(
                    `över ${params.years} år · ${fmtNum(Math.abs(paybackDelta), 1)} år ${paybackDelta >= 0 ? "snabbare" : "långsammare"} återbetalning`,
                    `over ${params.years} years · payback ${fmtNum(Math.abs(paybackDelta), 1)} yrs ${paybackDelta >= 0 ? "faster" : "slower"}`,
                  )
            }
            positive={extraSavings >= 0}
          />
          <WinCard
            label={t("Inga växelriktarbyten", "No inverter replacements")}
            value={inverterSavings > 0 ? fmtSek(inverterSavings) : fmtSek(0)}
            note={t(
              `sparat: ${refReplacements} byte${refReplacements === 1 ? "" : "n"} för ${reference.short}, 0 för Atmoce`,
              `saved: ${refReplacements} replacement${refReplacements === 1 ? "" : "s"} for ${reference.short}, 0 for Atmoce`,
            )}
            positive={inverterSavings >= 0}
          />
          <WinCard
            label={t("Mer el varje år", "More electricity each year")}
            value={`+${fmtNum(extraKwhPerYear)} kWh`}
            note={t(
              `${fmtNum(bonusKwhPerYear)} kWh paneloptimering + ${fmtNum(snow.totalRecoveredKwh)} kWh snösmältning`,
              `${fmtNum(bonusKwhPerYear)} kWh panel optimisation + ${fmtNum(snow.totalRecoveredKwh)} kWh snow melting`,
            )}
            positive
          />
          <WinCard
            label={t("Batteriets livslängd", "Battery lifetime")}
            value={
              atmoceWarrantyCycles
                ? `${fmtNum(atmoceWarrantyCycles)} ${t("cykler", "cycles")}`
                : `${atmoceWarrantyYears ?? "—"} ${t("år", "yrs")}`
            }
            note={t(
              `${atmoceWarrantyYears ?? "—"} års garanti · ${reference.short}: ${refWarrantyCycles ? `${fmtNum(refWarrantyCycles)} cykler` : "—"} / ${refWarrantyYears ?? "—"} år`,
              `${atmoceWarrantyYears ?? "—"} yr warranty · ${reference.short}: ${refWarrantyCycles ? `${fmtNum(refWarrantyCycles)} cycles` : "—"} / ${refWarrantyYears ?? "—"} yrs`,
            )}
            positive={
              (atmoceWarrantyCycles ?? 0) >= (refWarrantyCycles ?? 0) &&
              (atmoceWarrantyYears ?? 0) >= (refWarrantyYears ?? 0)
            }
          />
          </div>
        )}


        <div
          className={`grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 ${
            !isSimple ? "lg:grid-cols-[320px_minmax(0,1fr)]" : ""
          }`}
        >
          {/* Input panel */}
          {!isSimple && (
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
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
          </aside>
          )}

          {/* Results */}
          <section className="space-y-6">
            <div className="flex justify-end">
              <PdfButton
                onClick={handleGeneratePdf}
                loading={pdfLoading}
                label={
                  pdfLoading
                    ? t("Genererar…", "Generating…")
                    : t("Sammanfattning som PDF", "Summary as PDF")
                }
              />
            </div>

            {/* Side-by-side metric cards */}
            <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-2">
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
            {!isBase && (
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
            )}

            {!isBase && throughputA !== null && throughputB !== null && (
              <ThroughputCard
                atmoceName={atmoceModuleLabel}
                refName={refModuleLabel}
                throughputA={throughputA}
                throughputB={throughputB}
                modulesA={atmoceModules}
                modulesB={refModules}
                investmentA={throughputEssPriceA}
                investmentB={throughputEssPriceB}
              />
            )}

            {!isBase && (
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
            )}

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
            {(!isSimple || isBase) && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {t(`Ackumulerat nuvärde över ${params.years} år`, `Cumulative present value over ${params.years} years`)}
                </CardTitle>
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
            {!isBase && (
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
            )}

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

            <div className="flex justify-end">
              <PdfButton
                onClick={handleGeneratePdf}
                loading={pdfLoading}
                label={
                  pdfLoading
                    ? t("Genererar…", "Generating…")
                    : t("Sammanfattning som PDF", "Summary as PDF")
                }
              />
            </div>

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
  center = false,
  onChange,
}: {
  label: string;
  value: number;
  estimated: number;
  isOverride: boolean;
  hideEstimate?: boolean;
  center?: boolean;
  onChange: (n: number | null) => void;
}) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(formatWithSpaces(Math.round(value)));
  useEffect(() => {
    if (focused) return;
    setDraft(formatWithSpaces(Math.round(value)));
  }, [value, focused]);
  return (
    <div className="min-w-0 space-y-1">
      <Label className={`text-[11px] leading-none font-medium text-muted-foreground${center ? " block text-center" : ""}`}>{label}</Label>
      <div className="relative">
        <Input
          type="text"
          inputMode="numeric"
          value={draft}
          onFocus={() => {
            setFocused(true);
            setDraft(String(Math.round(value)));
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            const parsed = parseSpaced(draft);
            if (!Number.isFinite(parsed) || parsed < 0) {
              setDraft(formatWithSpaces(Math.round(value)));
              return;
            }
            const rounded = Math.round(parsed);
            if (rounded === Math.round(estimated)) {
              onChange(null);
            } else {
              onChange(rounded);
            }
            setDraft(formatWithSpaces(rounded));
          }}
          className={`h-8 w-full min-w-0 pr-14 font-mono text-sm${center ? " text-center" : ""}`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
          kr
        </span>
      </div>
      {!hideEstimate && isOverride && (
        <div className={`text-[11px] text-muted-foreground${center ? " text-center" : ""}`}>
          {`Estimat: ${fmtSek(estimated)}`}
        </div>
      )}
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
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>(
    formatWithSpaces(Math.round((value ?? 0) * 100) / 100, 2),
  );
  useEffect(() => {
    if (focused) return;
    setDraft(formatWithSpaces(Math.round((value ?? 0) * 100) / 100, 2));
  }, [value, focused]);
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-[11px] leading-none font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={() => {
            setFocused(true);
            setDraft(String(Math.round((value ?? 0) * 100) / 100));
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setFocused(false);
            const parsed = parseSpaced(draft);
            if (!Number.isFinite(parsed) || parsed < 0) {
              setDraft(formatWithSpaces(Math.round((value ?? 0) * 100) / 100, 2));
              return;
            }
            const rounded = Math.round(parsed * 100) / 100;
            if (estimated !== null && Math.abs(rounded - estimated) < 0.005) {
              onChange(null);
            } else {
              onChange(rounded);
            }
            setDraft(formatWithSpaces(rounded, 2));
          }}
          className="h-8 w-full min-w-0 pr-14 font-mono text-sm"
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
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

function PdfButton({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>
      <Download className="mr-1.5" />
      {label}
    </Button>
  );
}

function WinCard({
  label,
  value,
  note,
  positive,
}: {
  label: string;
  value: string;
  note: string;
  positive: boolean;
}) {
  return (
    <Card className={positive ? "border-l-4 border-l-atmoce" : "border-l-4"}>
      <CardContent className="p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 font-mono text-xl font-bold tabular-nums ${positive ? "text-atmoce" : "text-destructive"}`}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</div>
      </CardContent>
    </Card>
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
