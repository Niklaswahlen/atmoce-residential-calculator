import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { useT } from "@/lib/app-context";
import { usePricingData, PRICING_KEY } from "@/lib/usePricing";
import {
  adminUpsertSystemConfig,
  adminDeleteSystemConfig,
} from "@/lib/pricing.functions";
import { setAdminPassword, getAdminPassword } from "@/lib/priser-auth";
import { GlobalSettingsCard } from "@/components/priser/GlobalSettingsCard";
import { ComponentsTable } from "@/components/priser/ComponentsTable";
import { SystemConfigCard } from "@/components/priser/SystemConfigCard";
import { BatteryConfigsTab } from "@/components/priser/BatteryConfigsTab";

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
  component: PricesPageGate,
});

const PRICES_AUTH_KEY = "priser_authed";

function PricesPageGate() {
  const t = useT();
  const [authed, setAuthed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(PRICES_AUTH_KEY) === "1";
  });
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (authed) {
    // Restore the in-memory password if the session is authed but the
    // module-level store was cleared by a reload.
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("priser_pw") : null;
    if (stored) setAdminPassword(stored);
    return <PricesPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showModeToggle={false} />
      <div className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>{t("Lösenordsskyddad", "Password protected")}</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                // Verify server-side by attempting a no-op admin call.
                try {
                  await adminUpsertSystemConfig({
                    data: { password, data: { id: "__probe__" } },
                  });
                } catch (err) {
                  const msg = (err as Error).message || "";
                  if (msg.includes("Unauthorized")) {
                    setError(t("Fel lösenord", "Wrong password"));
                    return;
                  }
                  // Any other error (e.g. row not found) means password was OK.
                }
                setAdminPassword(password);
                sessionStorage.setItem(PRICES_AUTH_KEY, "1");
                sessionStorage.setItem("priser_pw", password);
                setAuthed(true);
              }}
              className="flex flex-col gap-3"
            >
              <Label htmlFor="priser-password">
                {t("Lösenord", "Password")}
              </Label>
              <Input
                id="priser-password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="submit">{t("Logga in", "Sign in")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function PricesPage() {
  const t = useT();
  const { data, isLoading, error } = usePricingData();
  const [panels, setPanels] = useState<number>(14);
  const qc = useQueryClient();
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newShort, setNewShort] = useState("");

  const createSystem = useMutation({
    mutationFn: async () => {
      const id = newId.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
      if (!id || !newName.trim() || !newShort.trim()) {
        throw new Error(t("Fyll i ID, namn och kort namn", "Fill in ID, name and short name"));
      }
      const maxSort = Math.max(0, ...(data?.systems.map((s) => s.sort_order) ?? [0]));
      await adminUpsertSystemConfig({
        data: {
          password: getAdminPassword(),
          data: {
            id,
            insert: true,
            name: newName.trim(),
            short: newShort.trim(),
            sort_order: maxSort + 1,
            default_battery_modules: 1,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success(t("System skapat", "System created"));
      setNewId(""); setNewName(""); setNewShort("");
      qc.invalidateQueries({ queryKey: PRICING_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSystem = useMutation({
    mutationFn: async (id: string) => {
      await adminDeleteSystemConfig({
        data: { password: getAdminPassword(), data: { id } },
      });
    },
    onSuccess: () => {
      toast.success(t("System borttaget", "System deleted"));
      qc.invalidateQueries({ queryKey: PRICING_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

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
          <Tabs defaultValue="components" className="space-y-6">
            <TabsList>
              <TabsTrigger value="components">{t("Komponenter & inställningar", "Components & settings")}</TabsTrigger>
              <TabsTrigger value="batteries">{t("Batterikonfigurationer", "Battery configurations")}</TabsTrigger>
              <TabsTrigger value="systems">{t("Systemkonfigurationer", "System configurations")}</TabsTrigger>
            </TabsList>

            <TabsContent value="components" className="space-y-6">
              <GlobalSettingsCard settings={data.settings} />
              <ComponentsTable components={data.components} />
            </TabsContent>

            <TabsContent value="batteries">
              <BatteryConfigsTab
                batteryConfigs={data.batteryConfigs}
                components={data.components}
              />
            </TabsContent>

            <TabsContent value="systems" className="space-y-6">
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

              {data.systems.map((sys) => (
                <div key={sys.id} className="space-y-1">
                  <SystemConfigCard
                    config={sys}
                    lines={data.lines.filter((l) => l.system_id === sys.id)}
                    components={data.components}
                    settings={data.settings}
                    panels={panels}
                    batteryConfigs={data.batteryConfigs}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(t(`Ta bort "${sys.name}"? Detta tar även bort alla rader.`, `Delete "${sys.name}"? This also removes all lines.`))) {
                          deleteSystem.mutate(sys.id);
                        }
                      }}
                    >
                      {t("Ta bort system", "Delete system")}
                    </Button>
                  </div>
                </div>
              ))}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("Lägg till systemkonfiguration", "Add system configuration")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">ID</Label>
                    <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="t.ex. my_system" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">{t("Namn", "Name")}</Label>
                    <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs uppercase text-muted-foreground">{t("Kort namn", "Short")}</Label>
                    <Input value={newShort} onChange={(e) => setNewShort(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => createSystem.mutate()} disabled={createSystem.isPending}>
                      {t("Skapa", "Create")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <p className="text-xs text-muted-foreground">
                {t(
                  "Slutpriserna i systemtabellerna ovan används direkt i kalkylatorn. Komponentpriserna anges exklusive moms.",
                  "The final prices in the system tables above are used directly in the calculator. Component prices are excluding VAT.",
                )}
              </p>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}