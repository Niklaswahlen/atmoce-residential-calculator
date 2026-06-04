import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PRICES,
  PRICES_KEY,
  useSystemPrices,
  type SystemPriceRow,
} from "@/lib/usePrices";
import { fmtSek } from "@/lib/calc";

export const Route = createFileRoute("/priser")({
  head: () => ({
    meta: [
      { title: "Systempriser 2026 — Redigera" },
      {
        name: "description",
        content:
          "Lista och redigera systempriser för Atmoce och referenssystem. Priser sparas delat för alla användare.",
      },
    ],
  }),
  component: PricesPage,
});

function PricesPage() {
  const { data, isLoading, error } = useSystemPrices();
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: async (row: { id: string; pv_price: number; ess_price: number }) => {
      const { error } = await supabase
        .from("system_prices")
        .update({ pv_price: row.pv_price, ess_price: row.ess_price })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Priser sparade");
      qc.invalidateQueries({ queryKey: PRICES_KEY });
    },
    onError: (e: Error) => toast.error(`Kunde inte spara: ${e.message}`),
  });

  const reset = useMutation({
    mutationFn: async () => {
      for (const d of DEFAULT_PRICES) {
        const { error } = await supabase
          .from("system_prices")
          .update({ pv_price: d.pv_price, ess_price: d.ess_price })
          .eq("id", d.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Återställt till 2026-prislistan");
      qc.invalidateQueries({ queryKey: PRICES_KEY });
    },
    onError: (e: Error) => toast.error(`Misslyckades: ${e.message}`),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Systempriser</h1>
            <p className="mt-1 text-sm text-primary-foreground/70">
              Delad prislista — ändringar syns för alla användare direkt.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-md bg-primary-foreground/10 px-3 py-2 text-sm font-medium hover:bg-primary-foreground/20"
          >
            ← Till kalkylator
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prislista (inkl. 15 % grönt teknikavdrag)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
            >
              Återställ till 2026-priser
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground">Laddar…</p>}
            {error && (
              <p className="text-sm text-destructive">
                Kunde inte hämta priser: {(error as Error).message}
              </p>
            )}
            {data && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>System</TableHead>
                    <TableHead className="text-right">PV (kr)</TableHead>
                    <TableHead className="text-right">ESS (kr)</TableHead>
                    <TableHead className="text-right">Totalt</TableHead>
                    <TableHead className="text-right">Åtgärd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row) => (
                    <PriceRow
                      key={row.id}
                      row={row}
                      onSave={(r) => update.mutate(r)}
                      saving={update.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <p className="mt-4 text-xs text-muted-foreground">
          Tips: ändringar tillämpas direkt i kalkylatorn. PV = panel-/montagepris,
          ESS = batteri + tillhörande utrustning.
        </p>
      </main>
    </div>
  );
}

function PriceRow({
  row,
  onSave,
  saving,
}: {
  row: SystemPriceRow;
  onSave: (r: { id: string; pv_price: number; ess_price: number }) => void;
  saving: boolean;
}) {
  const [pv, setPv] = useState(row.pv_price);
  const [ess, setEss] = useState(row.ess_price);
  const dirty = pv !== row.pv_price || ess !== row.ess_price;

  return (
    <TableRow>
      <TableCell className="font-medium">{row.name}</TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          value={pv}
          step={100}
          onChange={(e) => setPv(parseFloat(e.target.value) || 0)}
          className="ml-auto w-32 text-right font-mono"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          value={ess}
          step={100}
          onChange={(e) => setEss(parseFloat(e.target.value) || 0)}
          className="ml-auto w-32 text-right font-mono"
        />
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {fmtSek(pv + ess)}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          disabled={!dirty || saving}
          onClick={() => onSave({ id: row.id, pv_price: pv, ess_price: ess })}
        >
          Spara
        </Button>
      </TableCell>
    </TableRow>
  );
}