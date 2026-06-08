import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/app-context";
import { usePricingData } from "@/lib/usePricing";
import { GlobalSettingsCard } from "@/components/priser/GlobalSettingsCard";
import { ComponentsTable } from "@/components/priser/ComponentsTable";
import { SystemConfigCard } from "@/components/priser/SystemConfigCard";

export const Route = createFileRoute("/priser")({
  head: () => ({
    meta: [
      { title: "Systempriser 2026 — Atmoce" },
      {
        name: "description",
        content:
          "Komponentprislista, marginal, moms och GTA. Beräknar slutkundspris för Atmoce och referenssystem.",
      },
    ],
  }),
  component: PricesPage,
});

function PricesPage() {
  const t = useT();
  const { data, isLoading, error } = usePricingData();
  const [panels, setPanels] = useState<number>(14);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle={t("Systempriser", "System prices")} showModeToggle={false} />
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {isLoading && (
          <p className="text-sm text-muted-foreground">{t("Laddar…", "Loading…")}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">
            {t("Fel:", "Error:")} {(error as Error).message}
          </p>
        )}
        {data && (
          <>
            <GlobalSettingsCard settings={data.settings} />

            <Card>
              <CardHeader>
                <CardTitle>{t("Förhandsgranska för", "Preview for")}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase text-muted-foreground">
                    {t("Antal paneler", "Number of panels")}
                  </Label>
                  <Input
                    type="number"
                    value={panels}
                    onChange={(e) => setPanels(parseInt(e.target.value) || 0)}
                    className="font-mono"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    {t(
                      "Driver alla per-panel-mängder i systemtabellerna nedan.",
                      "Drives all per-panel quantities in the system tables below.",
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>

            <ComponentsTable components={data.components} />

            <div className="space-y-6">
              <h2 className="text-lg font-semibold">{t("Systemkonfigurationer", "System configurations")}</h2>
              {data.systems.map((sys) => (
                <SystemConfigCard
                  key={sys.id}
                  config={sys}
                  lines={data.lines.filter((l) => l.system_id === sys.id)}
                  components={data.components}
                  settings={data.settings}
                  panels={panels}
                />
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {t(
                "Slutpriserna i systemtabellerna ovan används direkt i kalkylatorn. Komponentpriserna anges exklusive moms.",
                "The final prices in the system tables above are used directly in the calculator. Component prices are excluding VAT.",
              )}
            </p>
          </>
        )}
      </main>
    </div>
  );
}