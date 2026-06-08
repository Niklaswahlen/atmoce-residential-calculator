import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtPct, fmtSek } from "@/lib/calc";
import { useT } from "@/lib/app-context";

interface Props {
  bonusPct: number;
  onBonusChange: (n: number) => void;
  panels: number;
  wpPerPanel: number;
  yieldPerKwp: number;
  buyPrice: number;
  sellPrice: number;
  selfUseShare: number;
  years: number;
}

export function PanelLevelBonusCard({
  bonusPct,
  onBonusChange,
  panels,
  wpPerPanel,
  yieldPerKwp,
  buyPrice,
  sellPrice,
  selfUseShare,
  years,
}: Props) {
  const t = useT();
  const kWp = (panels * wpPerPanel) / 1000;
  const baseProd = kWp * yieldPerKwp;
  const extraKwhYear1 = baseProd * (bonusPct / 100);
  const blendedPrice = selfUseShare * buyPrice + (1 - selfUseShare) * sellPrice;
  const extraSavingsYear1 = extraKwhYear1 * blendedPrice;
  const extraSavingsLifetime = extraSavingsYear1 * years;

  return (
    <Card className="border-atmoce/40 bg-atmoce-soft/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{t("Bonus från panelnivå-styrning", "Panel-level control bonus")}</CardTitle>
          <span className="rounded-full bg-atmoce px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            {t("Endast Atmoce", "Atmoce only")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Slider */}
        <div className="rounded-lg border border-atmoce/20 bg-card/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="panel-bonus" className="text-sm font-medium text-foreground">
              {t("Produktionsbonus", "Production bonus")}
            </label>
            <span className="font-display text-3xl font-semibold tabular-nums text-atmoce">
              +{fmtPct(bonusPct / 100, 0)}
            </span>
          </div>
          <input
            id="panel-bonus"
            type="range"
            min={0}
            max={20}
            step={1}
            value={bonusPct}
            onChange={(e) => onBonusChange(Number(e.target.value))}
            className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-atmoce/20 accent-atmoce"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground uppercase tracking-wide">
            <span>0 %</span>
            <span>10 %</span>
            <span>20 %</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div className="grid grid-cols-3 gap-6">
            <Stat
              label={t("Extra kWh / år", "Extra kWh / year")}
              value={`${fmtNum(extraKwhYear1)} kWh`}
            />
            <Stat
              label={t("Extra besparing år 1", "Extra savings year 1")}
              value={fmtSek(extraSavingsYear1)}
            />
            <Stat
              label={t(`Extra besparing över ${years} år`, `Extra savings over ${years} years`)}
              value={fmtSek(extraSavingsLifetime)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-atmoce/20 bg-card/60 p-4 text-sm">
          <p className="font-medium text-foreground">
            {t("Varför ger mikroväxelriktare mer årsproduktion?", "Why do microinverters yield more annual production?")}
          </p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">
                {t("Egen MPPT per panel.", "Dedicated MPPT per panel.")}
              </span>{" "}
              {t(
                "Skugga, smuts eller löv på en panel drar inte ner hela strängen — varje panel arbetar på sin egen optimala punkt.",
                "Shade, dirt or leaves on one panel don't drag down the whole string — each panel operates at its own optimal point.",
              )}
            </li>
            <li>
              <span className="font-semibold text-foreground">
                {t("Ingen panel-mismatch.", "No panel mismatch.")}
              </span>{" "}
              {t(
                "Små olikheter mellan paneler (ålder, tillverkningstolerans, temperatur) kostar produktion i ett strängsystem — inte här.",
                "Small differences between panels (age, manufacturing tolerance, temperature) cost production in a string system — not here.",
              )}
            </li>
            <li>
              <span className="font-semibold text-foreground">
                {t("Panelnivå-monitorering.", "Panel-level monitoring.")}
              </span>{" "}
              {t(
                "Fel och produktionsbortfall syns samma dag istället för efter månader, vilket minimerar förlorad intäkt.",
                "Faults and lost production show up the same day instead of months later, minimizing lost revenue.",
              )}
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          {t(
            "Bonusen är redan inräknad i Atmoces produktion och besparing i kalkylen. Jämförelsesystem antas ha 0 % bonus, förutom Huawei med optimerare (4 %).",
            "The bonus is already included in Atmoce's production and savings in the calculation. Reference systems are assumed to have 0% bonus, except Huawei with optimizers (4%).",
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums">
        {value}
      </div>
    </div>
  );
}