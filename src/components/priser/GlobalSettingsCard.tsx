import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/app-context";
import type { PriceSettings } from "@/lib/pricing";
import { PRICING_KEY } from "@/lib/usePricing";
import { adminUpdatePriceSettings } from "@/lib/pricing.functions";
import { getAdminPassword } from "@/lib/priser-auth";

interface Props {
  settings: PriceSettings;
}

export function GlobalSettingsCard({ settings }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [margin, setMargin] = useState(settings.margin_pct * 100);
  const [vat, setVat] = useState(settings.vat_pct * 100);
  const [gtaPv, setGtaPv] = useState(settings.gta_pv_pct * 100);
  const [gtaEss, setGtaEss] = useState(settings.gta_ess_pct * 100);

  useEffect(() => {
    setMargin(settings.margin_pct * 100);
    setVat(settings.vat_pct * 100);
    setGtaPv(settings.gta_pv_pct * 100);
    setGtaEss(settings.gta_ess_pct * 100);
  }, [settings]);

  const save = useMutation({
    mutationFn: async () => {
      await adminUpdatePriceSettings({
        data: {
          password: getAdminPassword(),
          data: {
            margin_pct: margin / 100,
            vat_pct: vat / 100,
            gta_pv_pct: gtaPv / 100,
            gta_ess_pct: gtaEss / 100,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success(t("Inställningar sparade", "Settings saved"));
      qc.invalidateQueries({ queryKey: PRICING_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty =
    margin !== settings.margin_pct * 100 ||
    vat !== settings.vat_pct * 100 ||
    gtaPv !== settings.gta_pv_pct * 100 ||
    gtaEss !== settings.gta_ess_pct * 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t("Globala inställningar", "Global settings")}</CardTitle>
        <Button size="sm" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
          {t("Spara", "Save")}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("Marginal", "Margin")} value={margin} onChange={setMargin} suffix="%" />
        <Field label={t("Moms", "VAT")} value={vat} onChange={setVat} suffix="%" />
        <Field
          label={t("Grönt teknikavdrag PV", "Green tech deduction PV")}
          value={gtaPv}
          onChange={setGtaPv}
          suffix="%"
        />
        <Field
          label={t("Grönt teknikavdrag ESS", "Green tech deduction ESS")}
          value={gtaEss}
          onChange={setGtaEss}
          suffix="%"
        />
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={0.5}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={suffix ? "pr-8 font-mono" : "font-mono"}
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