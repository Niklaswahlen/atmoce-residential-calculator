import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtPct, fmtSek } from "@/lib/calc";

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
          <CardTitle>Bonus från panelnivå-styrning</CardTitle>
          <span className="rounded-full bg-atmoce px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Endast Atmoce
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Slider */}
        <div className="rounded-lg border border-atmoce/20 bg-card/60 p-4">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="panel-bonus" className="text-sm font-medium text-foreground">
              Produktionsbonus
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
              label="Extra kWh / år"
              value={`${fmtNum(extraKwhYear1)} kWh`}
            />
            <Stat
              label="Extra besparing år 1"
              value={fmtSek(extraSavingsYear1)}
            />
            <Stat
              label={`Extra besparing över ${years} år`}
              value={fmtSek(extraSavingsLifetime)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-atmoce/20 bg-card/60 p-4 text-sm">
          <p className="font-medium text-foreground">
            Varför ger mikroväxelriktare mer årsproduktion?
          </p>
          <ul className="mt-2 space-y-1.5 text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Egen MPPT per panel.</span>{" "}
              Skugga, smuts eller löv på en panel drar inte ner hela strängen — varje
              panel arbetar på sin egen optimala punkt.
            </li>
            <li>
              <span className="font-semibold text-foreground">Ingen panel-mismatch.</span>{" "}
              Små olikheter mellan paneler (ålder, tillverkningstolerans, temperatur)
              kostar produktion i ett strängsystem — inte här.
            </li>
            <li>
              <span className="font-semibold text-foreground">Panelnivå-monitorering.</span>{" "}
              Fel och produktionsbortfall syns samma dag istället för efter månader,
              vilket minimerar förlorad intäkt.
            </li>
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          Bonusen är redan inräknad i Atmoces produktion och besparing i kalkylen.
          Jämförelsesystem antas ha 0 % bonus, förutom Huawei med optimerare (4 %).
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