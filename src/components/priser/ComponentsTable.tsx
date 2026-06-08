import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/app-context";
import type { Component, Side } from "@/lib/pricing";
import { PRICING_KEY } from "@/lib/usePricing";
import { fmtSek } from "@/lib/calc";

const CATEGORIES = [
  "panel",
  "microinverter",
  "string_inverter",
  "battery_module",
  "mounting",
  "scaffolding",
  "cabling",
  "ac_material",
  "electrical_install",
  "panel_install",
  "freight",
  "accessory",
] as const;

interface Props {
  components: Component[];
}

export function ComponentsTable({ components }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: PRICING_KEY });

  const update = useMutation({
    mutationFn: async (row: Partial<Component> & { id: string }) => {
      const { error } = await supabase
        .from("components")
        .update({
          name: row.name,
          category: row.category,
          side: row.side,
          unit_price_ex_vat: row.unit_price_ex_vat,
          unit_kwh: row.unit_kwh,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Komponent sparad", "Component saved"));
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("components").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("Komponent raderad", "Component deleted"));
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(t("Kunde inte radera (används av ett system?)", "Could not delete (used by a system?)")),
  });

  const add = useMutation({
    mutationFn: async () => {
      const id = `custom_${Date.now()}`;
      const { error } = await supabase.from("components").insert({
        id,
        name: t("Ny komponent", "New component"),
        category: "accessory",
        side: "pv",
        unit: "st",
        unit_price_ex_vat: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return components.filter((c) => {
      if (filter !== "all" && c.category !== filter) return false;
      if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [components, filter, search]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>
          {t("Komponentprislista (ex moms)", "Component price list (excl. VAT)")}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("Sök…", "Search…")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-40"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Alla kategorier", "All categories")}</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => add.mutate()}>
            +{t("Komponent", "Component")}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Namn", "Name")}</TableHead>
              <TableHead>{t("Kategori", "Category")}</TableHead>
              <TableHead>{t("Sida", "Side")}</TableHead>
              <TableHead className="text-right">{t("Pris ex moms", "Price excl. VAT")}</TableHead>
              <TableHead className="text-right">{t("kWh/modul", "kWh/module")}</TableHead>
              <TableHead className="text-right">{t("Åtgärd", "Action")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((c) => (
              <Row
                key={c.id}
                component={c}
                onSave={(r) => update.mutate(r)}
                onDelete={(id) => remove.mutate(id)}
              />
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          {t(
            "Alla priser anges exklusive moms. Systemkonfigurationerna nedan beräknar slutkundspris (ink moms efter grönt teknikavdrag).",
            "All prices are excluding VAT. The system configurations below compute the customer price (incl. VAT, after green tech deduction).",
          )}
        </p>
      </CardContent>
    </Card>
  );
}

function Row({
  component,
  onSave,
  onDelete,
}: {
  component: Component;
  onSave: (c: Component) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(component);
  const dirty = JSON.stringify(draft) !== JSON.stringify(component);

  return (
    <TableRow>
      <TableCell>
        <Input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="h-8"
        />
      </TableCell>
      <TableCell>
        <Select
          value={draft.category}
          onValueChange={(v) => setDraft({ ...draft, category: v })}
        >
          <SelectTrigger className="h-8 w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={draft.side}
          onValueChange={(v) => setDraft({ ...draft, side: v as Side })}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pv">PV</SelectItem>
            <SelectItem value="ess">ESS</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step={50}
          value={draft.unit_price_ex_vat}
          onChange={(e) =>
            setDraft({ ...draft, unit_price_ex_vat: parseFloat(e.target.value) || 0 })
          }
          className="ml-auto h-8 w-28 text-right font-mono"
        />
      </TableCell>
      <TableCell className="text-right">
        {draft.category === "battery_module" ? (
          <Input
            type="number"
            step={0.01}
            value={draft.unit_kwh ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                unit_kwh: e.target.value === "" ? null : parseFloat(e.target.value),
              })
            }
            className="ml-auto h-8 w-24 text-right font-mono"
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant={dirty ? "default" : "ghost"}
            disabled={!dirty}
            onClick={() => onSave(draft)}
          >
            {t("Spara", "Save")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (confirm(t(`Radera ${component.name}?`, `Delete ${component.name}?`))) {
                onDelete(component.id);
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}