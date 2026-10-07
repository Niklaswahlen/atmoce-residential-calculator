import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum } from "@/lib/calc";
import { useT } from "@/lib/app-context";

interface Props {
  atmoceName: string;
  refName: string;
  throughputA: number;
  throughputB: number;
  modulesA: number;
  modulesB: number;
  investmentA?: number;
  investmentB?: number;
}

export function ThroughputCard({ atmoceName, refName, throughputA, throughputB, modulesA, modulesB, investmentA, investmentB }: Props) {
  const t = useT();
  const diff = throughputA - throughputB;
  const pct = throughputB > 0 ? (diff / throughputB) * 100 : 0;
  const max = Math.max(throughputA, throughputB, 1);
  const hasCost = investmentA != null && investmentB != null && throughputA > 0 && throughputB > 0;
  const krA = hasCost ? investmentA! / throughputA : 0;
  const krB = hasCost ? investmentB! / throughputB : 0;
  const krPct = hasCost && krB > 0 ? ((krB - krA) / krB) * 100 : 0;

  return (
    <Card className="border-atmoce/40 bg-atmoce-soft/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{t("Garanterad genomströmning (livstidsenergi)", "Guaranteed throughput (lifetime energy)")}</CardTitle>
          <span className="rounded-full bg-atmoce px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {t("Batterijämförelse", "Battery comparison")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          <Stat
            label={atmoceName}
            value={`${fmtNum(throughputA, 1)} MWh`}
            sub={`${modulesA} × ${fmtNum(throughputA / modulesA, 1)} MWh`}
            accent
          />
          <Stat
            label={refName}
            value={`${fmtNum(throughputB, 1)} MWh`}
            sub={`${modulesB} × ${fmtNum(throughputB / modulesB, 1)} MWh`}
          />
          <Stat
            label={t("Atmoces fördel", "Atmoce advantage")}
            value={`${diff >= 0 ? "+" : ""}${fmtNum(diff, 1)} MWh`}
            sub={`${pct >= 0 ? "+" : ""}${fmtNum(pct, 0)} %`}
            accent={diff >= 0}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-atmoce/20 bg-card/60 p-4">
          <Bar label={atmoceName} value={throughputA} max={max} accent />
          <Bar label={refName} value={throughputB} max={max} />
        </div>

        {hasCost && (
          <div className="rounded-lg border border-atmoce/20 bg-card/60 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              {t("Kostnad per MWh genomströmning (batteri + installation)", "Cost per MWh throughput (battery + installation)")}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
              <Stat label={atmoceName} value={`${fmtNum(krA)} kr/MWh`} sub={`${fmtNum(investmentA!)} kr ÷ ${fmtNum(throughputA, 1)} MWh`} accent />
              <Stat label={refName} value={`${fmtNum(krB)} kr/MWh`} sub={`${fmtNum(investmentB!)} kr ÷ ${fmtNum(throughputB, 1)} MWh`} />
              <Stat
                label={t("Atmoce billigare per MWh", "Atmoce cheaper per MWh")}
                big
                accent={krPct >= 0}
                value={
                  <>
                    {krPct >= 0 ? "-" : "+"}
                    {fmtNum(Math.abs(krPct), 0)} %{" "}
                    <span className="text-2xl font-semibold">
                      {krPct >= 0 ? t("lägre", "lower") : t("högre", "higher")}
                    </span>
                  </>
                }
                sub={`${fmtNum(Math.abs(krB - krA))} kr/MWh ${krPct >= 0 ? t("lägre", "lower") : t("högre", "higher")}`}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t(
                "Batterisidans pris efter GTA (batteri, installation och kabelage — utan solpaneler och växelriktare) delat med batteriets garanterade livstidsenergi.",
                "Battery-side price after tax credit (battery, installation and cabling — excluding panels and inverter) divided by the battery's guaranteed lifetime energy.",
              )}
            </p>
          </div>
        )}

        <div className="rounded-lg border border-atmoce/20 bg-card/60 p-4 text-sm">
          <p className="font-medium text-foreground">
            {t("Vad betyder genomströmning?", "What does throughput mean?")}
          </p>
          <p className="mt-2 text-muted-foreground">
            {t(
              "Kapaciteten (kWh) säger hur mycket batteriet rymmer. Genomströmningen (MWh) är hur mycket energi tillverkaren garanterar att batteriet levererar under hela sin livslängd, med minst 60 % kvarvarande kapacitet. Ju högre värde, desto mer el får du ut för pengarna.",
              "Capacity (kWh) is how much the battery holds. Throughput (MWh) is how much energy the manufacturer guarantees over the battery's lifetime, with at least 60 % remaining capacity. Higher means more energy for your money.",
            )}
          </p>
          <ul className="mt-3 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">{atmoceName}:</span>{" "}
              {t(
                `en modul har ${fmtNum(throughputA / modulesA, 1)} MWh garanterad genomströmning. ${modulesA} moduler × ${fmtNum(throughputA / modulesA, 1)} MWh = ${fmtNum(throughputA, 1)} MWh totalt.`,
                `one module has ${fmtNum(throughputA / modulesA, 1)} MWh guaranteed throughput. ${modulesA} modules × ${fmtNum(throughputA / modulesA, 1)} MWh = ${fmtNum(throughputA, 1)} MWh total.`,
              )}
            </li>
            <li>
              <span className="font-semibold text-foreground">{refName}:</span>{" "}
              {t(
                `en modul har ${fmtNum(throughputB / modulesB, 1)} MWh garanterad genomströmning. ${modulesB} moduler × ${fmtNum(throughputB / modulesB, 1)} MWh = ${fmtNum(throughputB, 1)} MWh totalt.`,
                `one module has ${fmtNum(throughputB / modulesB, 1)} MWh guaranteed throughput. ${modulesB} modules × ${fmtNum(throughputB / modulesB, 1)} MWh = ${fmtNum(throughputB, 1)} MWh total.`,
              )}
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl font-semibold tabular-nums ${accent ? "text-atmoce" : "text-foreground"}`}>
        {value}
      </div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Bar({ label, value, max, accent }: { label: string; value: number; max: number; accent?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{fmtNum(value, 1)} MWh</span>
      </div>
      <div className="h-3 w-full rounded-full bg-muted">
        <div
          className={`h-3 rounded-full ${accent ? "bg-atmoce" : "bg-foreground/70"}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
    </div>
  );
}
