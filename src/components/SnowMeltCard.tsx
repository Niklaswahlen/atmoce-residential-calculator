import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LOCATIONS } from "@/data/locations";
import { calculateSnowMelt, type SnowMeltMode } from "@/lib/snowmelt";
import { fmtNum, fmtSek } from "@/lib/calc";
import { useT } from "@/lib/app-context";

export interface SnowMeltState {
  locationId: string;
  mode: SnowMeltMode;
  coverageFactor: number;
  meltPowerW: number;
  meltMinutesPerDay: number;
}

export const DEFAULT_SNOWMELT_STATE: SnowMeltState = {
  locationId: "stockholm",
  mode: "optimized",
  coverageFactor: 0.8,
  meltPowerW: 200,
  meltMinutesPerDay: 15,
};

interface Props {
  state: SnowMeltState;
  onChange: (s: SnowMeltState) => void;
  panels: number;
  wpPerPanel: number;
  yieldPerKwp: number;
  buyPrice: number;
  years: number;
  /** Compact view for end-customer: hides controls and detail toggle, shows summary only. */
  compact?: boolean;
}

export function SnowMeltCard({
  state,
  onChange,
  panels,
  wpPerPanel,
  yieldPerKwp,
  buyPrice,
  years,
  compact = false,
}: Props) {
  const t = useT();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const result = useMemo(
    () =>
      calculateSnowMelt({
        locationId: state.locationId,
        panels,
        wpPerPanel,
        yieldPerKwp,
        buyPrice,
        coverageFactor: state.coverageFactor,
        meltPowerW: state.meltPowerW,
        meltMinutesPerDay: state.meltMinutesPerDay,
        mode: state.mode,
      }),
    [state, panels, wpPerPanel, yieldPerKwp, buyPrice],
  );

  const recoveredLabel = t("Återvunnet", "Recovered");
  const meltingLabel = t("Smältning", "Melting");
  const chartData = result.rows.map((r) => ({
    month: r.month,
    [recoveredLabel]: Math.round(r.potentialKwh),
    [meltingLabel]: Math.round(r.meltKwh),
  }));

  const set = <K extends keyof SnowMeltState>(k: K, v: SnowMeltState[K]) =>
    onChange({ ...state, [k]: v });

  const meltKwhPerPanelDay =
    (state.meltPowerW / 1000) * (state.meltMinutesPerDay / 60);

  return (
    <Card className="border-l-4 border-l-atmoce">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>
              {t("Snösmältning · Atmoce panelnivå-styrning", "Snow melting · Atmoce panel-level control")}
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {compact
                ? t(
                    "Atmoce smälter snö per panel automatiskt — endast när det lönar sig. Resultat: mer producerad el under vintern.",
                    "Atmoce melts snow per panel automatically — only when it pays off. Result: more electricity produced during winter.",
                  )
                : t(
                    `Atmoce-mikroväxelriktarna kan aktivera varje panel individuellt som värmare (${state.meltPowerW} W × ${state.meltMinutesPerDay} min/dag = ${fmtNum(meltKwhPerPanelDay, 3)} kWh/panel·dag). Här jämförs vinst vs. elkostnad per månad.`,
                    `Atmoce microinverters can activate each panel individually as a heater (${state.meltPowerW} W × ${state.meltMinutesPerDay} min/day = ${fmtNum(meltKwhPerPanelDay, 3)} kWh/panel·day). Here we compare gains vs. electricity cost per month.`,
                  )}
            </p>
          </div>
          {!compact && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailsOpen((v) => !v)}
            className="shrink-0"
          >
            {detailsOpen ? (
              <>
                {t("Dölj detaljer", "Hide details")} <ChevronUp className="ml-1.5 h-4 w-4" />
              </>
            ) : (
              <>
                {t("Visa detaljer", "Show details")} <ChevronDown className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        {!compact && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("Ort", "Location")}
            </Label>
            <Select
              value={state.locationId}
              onValueChange={(v) => set("locationId", v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("Styrläge (Atmoce)", "Control mode (Atmoce)")}
            </Label>
            <Tabs
              value={state.mode}
              onValueChange={(v) => set("mode", v as SnowMeltMode)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="none" className="flex-1 text-xs">
                  {t("Ingen", "None")}
                </TabsTrigger>
                <TabsTrigger value="optimized" className="flex-1 text-xs">
                  {t("Optimerad", "Optimized")}
                </TabsTrigger>
                <TabsTrigger value="full" className="flex-1 text-xs">
                  {t("Full", "Full")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("Täckningsgrad", "Coverage")} · {Math.round(state.coverageFactor * 100)}%
            </Label>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[state.coverageFactor * 100]}
              onValueChange={([v]) => set("coverageFactor", v / 100)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              {t("Smälttid", "Melt time")} · {state.meltMinutesPerDay} {t("min/dag", "min/day")}
            </Label>
            <Slider
              min={5}
              max={60}
              step={5}
              value={[state.meltMinutesPerDay]}
              onValueChange={([v]) => set("meltMinutesPerDay", v)}
            />
          </div>
        </div>
        )}

        {/* Summary */}
        {compact ? (
          <>
            <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
              <Summary
                label={t("Återvunnen produktion / år", "Recovered production / year")}
                value={`+${fmtNum(result.totalRecoveredKwh)} kWh`}
                positive
              />
              <Summary
                label={t(`Extra värde över ${years} år`, `Extra value over ${years} years`)}
                value={fmtSek(result.totalNetBenefit * years)}
                positive={result.totalNetBenefit >= 0}
              />
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>
                ✓{" "}
                {t(
                  "Automatisk styrning — aktiveras bara när det är lönsamt.",
                  "Automatic control — activates only when profitable.",
                )}
              </li>
              <li>
                ✓{" "}
                {t(
                  "Per-panel-värme — endast Atmoce mikroväxelriktare klarar detta.",
                  "Per-panel heating — only Atmoce microinverters can do this.",
                )}
              </li>
              <li>
                ✓{" "}
                {t(
                  "Mer producerad el under vintermånaderna utan extra hårdvara.",
                  "More electricity produced during winter months with no extra hardware.",
                )}
              </li>
            </ul>
          </>
        ) : (
          <>
            <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
              <Summary
                label={t("Återvunnen produktion / år", "Recovered production / year")}
                value={`+${fmtNum(result.totalRecoveredKwh)} kWh`}
              />
              <Summary
                label={t("Elåtgång smältning / år", "Electricity used for melting / year")}
                value={`${fmtNum(result.totalMeltKwh, 1)} kWh`}
              />
              <Summary
                label={t("Kostnad smältning / år", "Melting cost / year")}
                value={fmtSek(result.totalMeltCost)}
              />
              <Summary
                label={t("Nettovinst / år", "Net gain / year")}
                value={fmtSek(result.totalNetBenefit)}
                positive={result.totalNetBenefit >= 0}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t(`Över kalkyltiden (${years} år):`, `Over the calculation period (${years} years):`)}{" "}
              <span className="font-mono font-semibold text-foreground">
                {fmtSek(result.totalNetBenefit * years)}
              </span>{" "}
              {t("extra värde och", "extra value and")}{" "}
              <span className="font-mono font-semibold text-foreground">
                +{fmtNum(result.totalRecoveredKwh * years)} kWh
              </span>{" "}
              {t("extra produktion från Atmoce-styrd snösmältning.", "extra production from Atmoce-controlled snow melting.")}
            </p>
          </>
        )}

        {!compact && detailsOpen && (
          <>
            {/* Månadsvis snösmältning – Oct–Apr översikt */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold">
                  {t("Snösäsong okt–apr", "Snow season Oct–Apr")}
                </h4>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-atmoce" />
                    {t("Smältning aktiv", "Melting active")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted" />
                    {t("Inaktiv", "Inactive")}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                {[9, 10, 11, 0, 1, 2, 3].map((mIdx) => {
                  const r = result.rows[mIdx];
                  const active = r.applied;
                  return (
                    <div
                      key={r.month}
                      className={`rounded-lg border-l-4 p-3 transition ${
                        active
                          ? "border-l-atmoce bg-atmoce/5"
                          : "border-l-muted-foreground/30 bg-muted/40 opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{r.month}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                            active
                              ? "bg-atmoce/15 text-atmoce"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {active ? t("På", "On") : t("Av", "Off")}
                        </span>
                      </div>
                      <div className="mt-2 space-y-0.5">
                        <div className="text-xs text-muted-foreground">
                          {t("Återvunnet", "Recovered")}
                        </div>
                        <div className="font-mono text-sm font-semibold tabular-nums">
                          {active ? `+${fmtNum(r.potentialKwh, 0)} kWh` : "—"}
                        </div>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <div className="text-xs text-muted-foreground">
                          {t("Nettovinst", "Net gain")}
                        </div>
                        <div
                          className={`font-mono text-sm font-semibold tabular-nums ${
                            active
                              ? r.netBenefit >= 0
                                ? "text-atmoce"
                                : "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {active ? fmtSek(r.netBenefit) : "—"}
                        </div>
                      </div>
                      {!active && r.snowDays > 0 && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          {t(
                            "Ej lönsamt denna månad",
                            "Not profitable this month",
                          )}
                        </div>
                      )}
                      {!active && r.snowDays === 0 && (
                        <div className="mt-1.5 text-[10px] text-muted-foreground">
                          {t("Inga snödagar", "No snow days")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart */}
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => `${fmtNum(Number(v))} kWh`} />
                  <Legend />
                  <Bar dataKey={recoveredLabel} fill="var(--atmoce)" />
                  <Bar dataKey={meltingLabel} fill="var(--reference)" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Month table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Månad", "Month")}</TableHead>
                  <TableHead className="text-right">{t("Snödagar", "Snow days")}</TableHead>
                  <TableHead className="text-right">{t("Återvunnet (kWh)", "Recovered (kWh)")}</TableHead>
                  <TableHead className="text-right">{t("Smält-el (kWh)", "Melt electricity (kWh)")}</TableHead>
                  <TableHead className="text-right">{t("Kostnad", "Cost")}</TableHead>
                  <TableHead className="text-right">{t("Netto", "Net")}</TableHead>
                  <TableHead className="text-right">{t("Aktiverad", "Active")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.month} className={r.applied ? "" : "opacity-50"}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell className="text-right font-mono">{r.snowDays}</TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtNum(r.potentialKwh, 0)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtNum(r.meltKwh, 1)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtSek(r.meltCost)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono font-semibold ${
                        r.netBenefit >= 0 ? "text-atmoce" : "text-destructive"
                      }`}
                    >
                      {fmtSek(r.netBenefit)}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {r.applied ? t("Ja", "Yes") : t("Nej", "No")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">{t("Styrlägen:", "Control modes:")}</strong>{" "}
              {t(
                "Ingen = ingen snösmältning aktiv (referensfall). Optimerad = Atmoce-appen aktiverar smältning endast de månader där solinstrålningen gör nettonyttan positiv. Full = smältning körs på samtliga snödagar oavsett ekonomi. Endast Atmoce (mikroväxelriktare) kan styra värme per panel — traditionella strängväxelriktare saknar denna funktion.",
                "None = no snow melting active (reference case). Optimized = the Atmoce app activates melting only in months where solar irradiance makes the net benefit positive. Full = melting runs on every snow day regardless of economics. Only Atmoce (microinverters) can control heat per panel — traditional string inverters lack this function.",
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Summary({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`font-mono text-lg font-semibold tabular-nums ${
          positive === false ? "text-destructive" : positive ? "text-atmoce" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}