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
}

export function SnowMeltCard({
  state,
  onChange,
  panels,
  wpPerPanel,
  yieldPerKwp,
  buyPrice,
  years,
}: Props) {
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

  const chartData = result.rows.map((r) => ({
    month: r.month,
    Återvunnet: Math.round(r.potentialKwh),
    Smältning: Math.round(r.meltKwh),
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
            <CardTitle>Snösmältning · Atmoce panelnivå-styrning</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Atmoce-mikroväxelriktarna kan aktivera varje panel individuellt som
              värmare ({state.meltPowerW} W × {state.meltMinutesPerDay} min/dag ={" "}
              {fmtNum(meltKwhPerPanelDay, 3)} kWh/panel·dag). Här jämförs vinst
              vs. elkostnad per månad.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailsOpen((v) => !v)}
            className="shrink-0"
          >
            {detailsOpen ? (
              <>
                Dölj detaljer <ChevronUp className="ml-1.5 h-4 w-4" />
              </>
            ) : (
              <>
                Visa detaljer <ChevronDown className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Controls */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Ort
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
              Styrläge (Atmoce)
            </Label>
            <Tabs
              value={state.mode}
              onValueChange={(v) => set("mode", v as SnowMeltMode)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="none" className="flex-1 text-xs">
                  Ingen
                </TabsTrigger>
                <TabsTrigger value="optimized" className="flex-1 text-xs">
                  Optimerad
                </TabsTrigger>
                <TabsTrigger value="full" className="flex-1 text-xs">
                  Full
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Täckningsgrad · {Math.round(state.coverageFactor * 100)}%
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
              Smälttid · {state.meltMinutesPerDay} min/dag
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

        {/* Summary */}
        <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary
            label="Återvunnen produktion / år"
            value={`+${fmtNum(result.totalRecoveredKwh)} kWh`}
          />
          <Summary
            label="Elåtgång smältning / år"
            value={`${fmtNum(result.totalMeltKwh, 1)} kWh`}
          />
          <Summary
            label="Kostnad smältning / år"
            value={fmtSek(result.totalMeltCost)}
          />
          <Summary
            label="Nettovinst / år"
            value={fmtSek(result.totalNetBenefit)}
            positive={result.totalNetBenefit >= 0}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Över kalkyltiden ({years} år):{" "}
          <span className="font-mono font-semibold text-foreground">
            {fmtSek(result.totalNetBenefit * years)}
          </span>{" "}
          extra värde och{" "}
          <span className="font-mono font-semibold text-foreground">
            +{fmtNum(result.totalRecoveredKwh * years)} kWh
          </span>{" "}
          extra produktion från Atmoce-styrd snösmältning.
        </p>

        {/* Chart */}
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `${fmtNum(Number(v))} kWh`} />
              <Legend />
              <Bar dataKey="Återvunnet" fill="var(--atmoce)" />
              <Bar dataKey="Smältning" fill="var(--reference)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Month table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Månad</TableHead>
              <TableHead className="text-right">Snödagar</TableHead>
              <TableHead className="text-right">Återvunnet (kWh)</TableHead>
              <TableHead className="text-right">Smält-el (kWh)</TableHead>
              <TableHead className="text-right">Kostnad</TableHead>
              <TableHead className="text-right">Netto</TableHead>
              <TableHead className="text-right">Aktiverad</TableHead>
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
                  {r.applied ? "Ja" : "Nej"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">Styrlägen:</strong>{" "}
          <em>Ingen</em> = ingen snösmältning aktiv (referensfall). {" "}
          <em>Optimerad</em> = Atmoce-appen aktiverar smältning endast de månader
          där solinstrålningen gör nettonyttan positiv. {" "}
          <em>Full</em> = smältning körs på samtliga snödagar oavsett ekonomi. {" "}
          Endast Atmoce (mikroväxelriktare) kan styra värme per panel — traditionella
          strängväxelriktare saknar denna funktion.
        </div>
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