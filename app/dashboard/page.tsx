"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Separator } from "@/components_shadcn/ui/separator";
import { Badge } from "@/components_shadcn/ui/badge";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components_shadcn/ui/chart";
import { Pie, PieChart, Cell } from "recharts";
import { Car, Wallet, Construction, CalendarClock } from "lucide-react";
import { useState, useEffect } from "react";
import { typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { formatCurrency } from "@/lib/format";

interface FleetVehicle {
  documentId: string;
  condition?: "nuevo" | "usado" | "seminuevo";
  priceNumber?: number;
}

interface InventorySummary {
  total: number;
  nuevos: number;
  seminuevos: number;
  usados: number;
  totalValue: number;
}

const COLORS = {
  nuevos: "oklch(0.73 0.13 75)",
  seminuevos: "oklch(0.7 0.15 50)",
  usados: "oklch(0.85 0.1 75)",
};

const inventoryChartConfig = {
  nuevos: { label: "Nuevos", color: COLORS.nuevos },
  seminuevos: { label: "Seminuevos", color: COLORS.seminuevos },
  usados: { label: "Usados", color: COLORS.usados },
} satisfies ChartConfig;

function computeSummary(vehicles: FleetVehicle[]): InventorySummary {
  return vehicles.reduce<InventorySummary>(
    (acc, v) => {
      acc.total += 1;
      acc.totalValue += v.priceNumber || 0;
      if (v.condition === "nuevo") acc.nuevos += 1;
      else if (v.condition === "seminuevo") acc.seminuevos += 1;
      else if (v.condition === "usado") acc.usados += 1;
      return acc;
    },
    { total: 0, nuevos: 0, seminuevos: 0, usados: 0, totalValue: 0 }
  );
}

/** Tarjeta de sección aún no disponible (depende de módulos en construcción). */
function ConstructionCard({ title, hint }: { title: string; hint: string }) {
  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50">
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-3 px-6 pb-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
          <Construction className="h-6 w-6 text-amber-600 dark:text-amber-400" />
        </div>
        <p className="text-sm font-medium">En construcción</p>
        <p className="text-sm text-muted-foreground max-w-xs">{hint}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardRoute() {
  const [isLoading, setIsLoading] = useState(true);
  const [summary, setSummary] = useState<InventorySummary | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/fleet", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const vehicles: FleetVehicle[] = json.data || [];
          setSummary(computeSummary(vehicles));
        } else {
          setSummary(computeSummary([]));
        }
      } catch (error) {
        console.error("Error cargando inventario:", error);
        setSummary(computeSummary([]));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const pct = (n: number) =>
    summary && summary.total > 0 ? Math.round((n / summary.total) * 100) : 0;

  const inventoryData = summary
    ? [
        { name: "Nuevos", value: summary.nuevos, fill: COLORS.nuevos },
        { name: "Seminuevos", value: summary.seminuevos, fill: COLORS.seminuevos },
        { name: "Usados", value: summary.usados, fill: COLORS.usados },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <AdminLayout title="Resumen General">
      {/* KPIs reales de inventario */}
      <div className="grid grid-cols-2 gap-5">
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Car className="h-4 w-4" />
              <p className="text-sm font-medium">Vehículos en flota</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">{summary?.total ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              <p className="text-sm font-medium">Valor del inventario</p>
            </div>
            {isLoading ? (
              <Skeleton className="h-8 w-28" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">
                {formatCurrency(summary?.totalValue ?? 0)}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Inventario (real) */}
      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle className="text-base font-semibold">Resumen de Inventario</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-6 px-6 pb-6 md:flex-row md:items-center md:justify-center">
          {isLoading ? (
            <Skeleton className="h-[160px] w-[160px] rounded-full" />
          ) : summary && summary.total > 0 ? (
            <div className="relative flex h-[160px] w-[160px] shrink-0 items-center justify-center">
              <ChartContainer config={inventoryChartConfig} className="h-full w-full">
                <PieChart width={160} height={160}>
                  <Pie
                    data={inventoryData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {inventoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-2xl font-bold">{summary.total}</span>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center">
              No hay vehículos registrados en la flota.
            </p>
          )}

          {!isLoading && summary && summary.total > 0 && (
            <div className="flex w-full min-w-0 flex-col justify-center gap-3 md:w-auto">
              <div className="flex items-center gap-2">
                <Badge className="size-2.5 rounded-full p-0 border-0" style={{ backgroundColor: COLORS.nuevos }} />
                <p className="text-sm font-medium">Nuevos: {summary.nuevos} ({pct(summary.nuevos)}%)</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="size-2.5 rounded-full p-0 border-0" style={{ backgroundColor: COLORS.seminuevos }} />
                <p className="text-sm font-medium">Seminuevos: {summary.seminuevos} ({pct(summary.seminuevos)}%)</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="size-2.5 rounded-full p-0 border-0" style={{ backgroundColor: COLORS.usados }} />
                <p className="text-sm font-medium">Usados: {summary.usados} ({pct(summary.usados)}%)</p>
              </div>
              <div className="mt-2 pt-2">
                <Separator className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  Valor total: {formatCurrency(summary.totalValue)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Secciones que dependen de módulos en construcción */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <ConstructionCard
          title="Financiamientos pendientes"
          hint="Disponible cuando se habilite el módulo de Facturación."
        />
        <ConstructionCard
          title="Personas pendientes por pagar"
          hint="Depende de Facturación y Calendario, actualmente en construcción."
        />
      </div>

      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            Próximas citas
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-3 px-6 pb-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
            <Construction className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="text-sm font-medium">En construcción</p>
          <p className={`${typography.body.small} text-muted-foreground max-w-xs`}>
            Se mostrará cuando el módulo de Calendario esté disponible.
          </p>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
