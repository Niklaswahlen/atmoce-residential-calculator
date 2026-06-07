import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
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
import { useSystemPrices, mergeSystems } from "@/lib/usePrices";
import {
  SnowMeltCard,
  DEFAULT_SNOWMELT_STATE,
  type SnowMeltState,
} from "@/components/SnowMeltCard";
import { calculateSnowMelt } from "@/lib/snowmelt";
import { PanelLevelBonusCard } from "@/components/PanelLevelBonusCard";
import { Button } from "@/components/ui/button";
import { generateSummaryPdf } from "@/lib/pdf";
import { Download } from "lucide-react";
import { toast } from "sonner";

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
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={suffix ? "pr-12 font-mono" : "font-mono"}
        />
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
  const [params, setParams] = useState<CalcParams>(DEFAULT_PARAMS);
  const [referenceId, setReferenceId] = useState<SystemId>("solis_dyness");
  const [snowState, setSnowState] = useState<SnowMeltState>(DEFAULT_SNOWMELT_STATE);
  const [refReplacements, setRefReplacements] = useState<number>(1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const npvChartRef = useRef<HTMLDivElement | null>(null);

  const { data: livePrices } = useSystemPrices();
  const systems = useMemo(() => mergeSystems(livePrices), [livePrices]);
  const atmoce = systems.atmoce;
  const reference = systems[referenceId];

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

  const atmoceParams: CalcParams = {
    ...params,
    extraAnnualSavings: snow.totalNetBenefit,
    extraAnnualKwh: snow.totalRecoveredKwh,
    inverterReplacements: 0,
  };

  const atmoceResult = useMemo(
    () => calculate(atmoce, atmoceParams),
    [atmoce, atmoceParams],
  );
  const refParams: CalcParams = { ...params, inverterReplacements: refReplacements };
  const refResult = useMemo(
    () => calculate(reference, refParams),
    [reference, refParams],
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
        chartElement: npvChartRef.current,
      });
      toast.success("PDF genererad");
    } catch (e) {
      console.error(e);
      toast.error("Kunde inte generera PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Solsystem-jämförelse 2026
              </h1>
              <p className="mt-1 text-sm text-primary-foreground/70">
                Atmoce mikroväxelriktare vs traditionella system — LCOE, payback &
                produktion sida vid sida
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGeneratePdf}
                disabled={pdfLoading}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Download className="mr-1.5" />
                {pdfLoading ? "Genererar…" : "Ladda ner PDF"}
              </Button>
              <Link
                to="/priser"
                className="rounded-md bg-primary-foreground/10 px-3 py-2 text-sm font-medium hover:bg-primary-foreground/20"
              >
                Redigera priser
              </Link>
              <div className="hidden text-right font-mono text-sm text-primary-foreground/80 md:block">
                {fmtNum(kWp, 2)} kWp · {params.years} år kalkyl
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Input panel */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Anläggning
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label="Antal paneler"
                  value={params.panels}
                  onChange={set("panels")}
                />
                <NumField
                  label="Wp/panel"
                  value={params.wpPerPanel}
                  onChange={set("wpPerPanel")}
                  suffix="W"
                />
                <div className="col-span-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Total: </span>
                  <span className="font-mono font-semibold">
                    {fmtNum(kWp, 2)} kWp
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Produktion & elpris
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label="Årsprod."
                  value={params.yieldPerKwp}
                  onChange={set("yieldPerKwp")}
                  suffix="kWh/kWp"
                />
                <NumField
                  label="Degradering"
                  value={params.degradation * 100}
                  onChange={(v) => set("degradation")(v / 100)}
                  step={0.1}
                  suffix="%/år"
                />
                <NumField
                  label="Köppris"
                  value={params.buyPrice}
                  onChange={set("buyPrice")}
                  step={0.1}
                  suffix="kr/kWh"
                />
                <NumField
                  label="Spotpris sälj"
                  value={params.sellPrice}
                  onChange={set("sellPrice")}
                  step={0.1}
                  suffix="kr/kWh"
                />
                <NumField
                  label="Prisökning"
                  value={params.priceInflation * 100}
                  onChange={(v) => set("priceInflation")(v / 100)}
                  step={0.5}
                  suffix="%/år"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Användning
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label="Egenanv. utan batteri"
                  value={params.selfUseNoBattery * 100}
                  onChange={(v) => set("selfUseNoBattery")(v / 100)}
                  suffix="%"
                />
                <NumField
                  label="Egenanv. med batteri"
                  value={params.selfUseWithBattery * 100}
                  onChange={(v) => set("selfUseWithBattery")(v / 100)}
                  suffix="%"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Kalkyl
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                <NumField
                  label="Kalkyltid"
                  value={params.years}
                  onChange={set("years")}
                  suffix="år"
                />
                <NumField
                  label="Diskontering"
                  value={params.discountRate * 100}
                  onChange={(v) => set("discountRate")(v / 100)}
                  step={0.5}
                  suffix="%"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Referenssystem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={referenceId}
                  onValueChange={(v) => setReferenceId(v as SystemId)}
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
                  </SelectContent>
                </Select>
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
              />
            </div>

            {/* Delta strip */}
            <Card className="border-l-4 border-l-atmoce">
              <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                <DeltaItem
                  label="Mer producerad el över kalkyltiden"
                  value={`${extraKwh >= 0 ? "+" : ""}${fmtNum(extraKwh)} kWh`}
                  positive={extraKwh >= 0}
                />
                <DeltaItem
                  label="Mer besparing över kalkyltiden"
                  value={`${extraSavings >= 0 ? "+" : ""}${fmtSek(extraSavings)}`}
                  positive={extraSavings >= 0}
                />
                <DeltaItem
                  label="Snabbare payback"
                  value={
                    paybackDelta === null
                      ? "—"
                      : `${paybackDelta >= 0 ? "+" : ""}${fmtNum(paybackDelta, 1)} år`
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
            />

            <PanelLevelBonusCard
              atmoce={atmoce}
              panels={params.panels}
              wpPerPanel={params.wpPerPanel}
              yieldPerKwp={params.yieldPerKwp}
              buyPrice={params.buyPrice}
              sellPrice={params.sellPrice}
              selfUseShare={params.selfUseWithBattery}
              years={params.years}
            />

            {/* Inverter replacement module */}
            <Card>
              <CardHeader>
                <CardTitle>Växelriktarbyten</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Atmoce har {atmoce.inverterWarrantyYears} års produktgaranti på
                  sina mikroväxelriktare. Traditionella system har ofta kortare
                  garanti, vilket innebär en eller flera bytena under kalkyltiden.
                  Varje byte räknas som {fmtSek(INVERTER_REPLACEMENT_COST)} ink.
                  moms.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>System</TableHead>
                      <TableHead className="text-right">Garanti</TableHead>
                      <TableHead className="text-center">Antal byten</TableHead>
                      <TableHead className="text-right">Bytesår</TableHead>
                      <TableHead className="text-right">Total kostnad</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">{atmoce.name}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {atmoce.inverterWarrantyYears} år
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
                        {reference.inverterWarrantyYears} år
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
                          : refReplacementYears.map((y) => `År ${y}`).join(", ")}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {fmtSek(refResult.totalReplacementCost)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Cumulative NPV chart — like reference image */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>
                    Ackumulerat nuvärde över {params.years} år
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGeneratePdf}
                    disabled={pdfLoading}
                  >
                    <Download className="mr-1.5" />
                    {pdfLoading ? "Genererar…" : "Sammanfattning som PDF"}
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
                          value: "År",
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
                          value: "Ackumulerat nuvärde (kr)",
                          angle: -90,
                          position: "insideLeft",
                          style: { textAnchor: "middle" },
                        }}
                      />
                      <Tooltip
                        formatter={(v) => fmtSek(Number(v))}
                        labelFormatter={(l) => `År ${l}`}
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
                  Startar på −investering år 0 och adderar varje års diskonterade
                  nettokassaflöde. Växelriktarbyten dras av som negativa
                  kassaflöden de år de inträffar.
                </p>
              </CardContent>
            </Card>

            {/* Cashflow chart */}
            <Card>
              <CardHeader>
                <CardTitle>Kumulativ besparing över {params.years} år</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="year"
                        tick={{ fontSize: 12 }}
                        label={{ value: "År", position: "insideBottom", offset: -4 }}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`
                        }
                      />
                      <Tooltip
                        formatter={(v) => fmtSek(Number(v))}
                        labelFormatter={(l) => `År ${l}`}
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
            <Card>
              <CardHeader>
                <CardTitle>Årlig elproduktion (kWh)</CardTitle>
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
                        labelFormatter={(l) => `År ${l}`}
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

            {/* Technical comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Teknisk jämförelse</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead className="text-right">Atmoce</TableHead>
                      <TableHead className="text-right">{reference.short}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <Row
                      label="Växelriktare"
                      a={atmoce.inverterType}
                      b={reference.inverterType}
                    />
                    <Row
                      label="Garanti växelriktare"
                      a={`${atmoce.inverterWarrantyYears} år`}
                      b={`${reference.inverterWarrantyYears} år`}
                    />
                    <Row
                      label="Garanti batteri"
                      a={`${atmoce.batteryWarrantyYears} år / ${atmoce.batteryWarrantyCycles ?? "—"} cykler`}
                      b={`${reference.batteryWarrantyYears} år / ${reference.batteryWarrantyCycles ?? "—"} cykler`}
                    />
                    <Row
                      label="Batterikapacitet"
                      a={`${atmoce.batteryKwh} kWh`}
                      b={`${reference.batteryKwh} kWh`}
                    />
                    <Row
                      label="Round-trip-effektivitet"
                      a={fmtPct(atmoce.batteryRoundTrip, 0)}
                      b={fmtPct(reference.batteryRoundTrip, 0)}
                    />
                    <Row
                      label="Produktionsbonus (skugga/MPPT)"
                      a={fmtPct(atmoce.productionBonus, 0)}
                      b={fmtPct(reference.productionBonus, 0)}
                    />
                    <Row
                      label="Panelnivå-övervakning"
                      a={atmoce.panelLevelMonitoring ? "Ja" : "Nej"}
                      b={reference.panelLevelMonitoring ? "Ja" : "Nej"}
                    />
                    <Row
                      label="Pris PV"
                      a={fmtSek(atmoce.pvPrice)}
                      b={fmtSek(reference.pvPrice)}
                    />
                    <Row
                      label="Pris ESS"
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
                      label="kr/kWh batteri"
                      a={fmtNum(atmoce.essPrice / atmoce.batteryKwh, 0)}
                      b={fmtNum(reference.essPrice / reference.batteryKwh, 0)}
                    />
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground">
              Priser inkl. 15 % grönt teknikavdrag enligt prislista 2026. LCOE
              beräknas med diskonterad produktion. IRR baseras på årliga
              kassaflöden vid given diskonteringsränta. Antaganden kan justeras i
              vänsterpanelen.
            </p>
          </section>
        </div>
      </main>
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
              Rekommenderad
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Metric label="Investering" value={fmtSek(investment)} />
        <Metric label="LCOE" value={`${fmtNum(lcoe, 2)} kr/kWh`} big />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Metric
            label="Payback"
            value={payback === null ? "> kalkyltid" : `${fmtNum(payback, 1)} år`}
          />
          <Metric label="IRR" value={irr === null ? "—" : fmtPct(irr)} />
          <Metric label="Total produktion" value={`${fmtNum(production)} kWh`} />
          <Metric label="Total besparing" value={fmtSek(savings)} />
          <Metric label="NPV" value={fmtSek(npv)} />
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
