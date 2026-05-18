"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Separator } from "@/components_shadcn/ui/separator";
import { Badge } from "@/components_shadcn/ui/badge";
import { Avatar, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components_shadcn/ui/chart";
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts";
import { Car, Key, Wrench } from "lucide-react";
import { useState } from "react";
import { typography, spacing } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";

export default function DashboardRoute() {
  const [selectedPeriod, setSelectedPeriod] = useState("Hoy");

  const periods = ["Hoy", "Semana", "Mes", "Año"];

  // Datos para el gráfico de barras
  const salesData = [
    { period: "S1", value: 30 },
    { period: "S2", value: 100 },
    { period: "S3", value: 45 },
    { period: "S4", value: 80 },
    { period: "S5", value: 65 },
    { period: "S6", value: 90 },
  ];

  const salesChartConfig = {
    value: {
      label: "Ventas",
      color: "hsl(var(--primary))",
    },
  } satisfies ChartConfig;

  // Datos para el gráfico de donut (inventario)
  const inventoryData = [
    { name: "Nuevos", value: 150, fill: "oklch(0.73 0.13 75)" },
    { name: "Usados", value: 75, fill: "oklch(0.7 0.15 50)" },
    { name: "En Taller", value: 25, fill: "oklch(0.85 0.1 75)" },
  ];

  const inventoryChartConfig = {
    nuevos: {
      label: "Nuevos",
      color: "oklch(0.73 0.13 75)",
    },
    usados: {
      label: "Usados",
      color: "oklch(0.7 0.15 50)",
    },
    taller: {
      label: "En Taller",
      color: "oklch(0.85 0.1 75)",
    },
  } satisfies ChartConfig;

  return (
    <AdminLayout title="Resumen General">
        <ScrollAreaPrimitive.Root className="relative w-full overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
            <div className="flex gap-2 pb-2 whitespace-nowrap">
              {periods.map((period) => (
                <Button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  variant={selectedPeriod === period ? "default" : "outline"}
                  className={`h-9 shrink-0 rounded-full px-4 flex items-center justify-center ${
                    selectedPeriod === period
                      ? "bg-primary text-primary-foreground"
                      : "bg-card"
                  }`}
                >
                  <span className="text-sm font-semibold">{period}</span>
                </Button>
              ))}
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.ScrollAreaScrollbar
            orientation="horizontal"
            className="flex touch-none select-none transition-colors w-full h-2.5 border-t border-t-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
          </ScrollAreaPrimitive.ScrollAreaScrollbar>
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>

        <div className="grid grid-cols-2 gap-5">
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className="flex flex-col gap-2 p-6">
              <p className="text-sm font-medium text-muted-foreground">Ventas del Mes</p>
              <p className="text-2xl font-bold tracking-tight">42</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className="flex flex-col gap-2 p-6">
              <p className="text-sm font-medium text-muted-foreground">Ingresos Totales</p>
              <p className="text-2xl font-bold tracking-tight">$1.25M</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className="flex min-w-72 flex-1 flex-col gap-5 p-6">
            <div className="flex flex-col">
              <p className="text-base font-semibold">Evolución de Ventas</p>
              <div className="flex items-baseline gap-2">
                <p className="text-[32px] font-bold tracking-tight">$1.2M</p>
                <p className="text-sm font-medium text-green-600">+5.2%</p>
              </div>
              <p className="text-sm text-muted-foreground">respecto al último mes</p>
            </div>
            <div className="grid min-h-[160px] grid-flow-col items-end justify-items-center gap-3 md:gap-4">
              <div className="flex h-full w-full flex-col items-center justify-end gap-2 hidden sm:flex">
                <div className="w-full rounded-lg bg-primary/20" style={{ height: "30%" }}></div>
                <p className="text-xs font-bold text-muted-foreground">S1</p>
              </div>
              <div className="flex h-full w-full flex-col items-center justify-end gap-2">
                <div className="w-full rounded-lg bg-primary" style={{ height: "100%" }}></div>
                <p className="text-xs font-bold text-muted-foreground">S2</p>
              </div>
              <div className="flex h-full w-full flex-col items-center justify-end gap-2 hidden sm:flex">
                <div className="w-full rounded-lg bg-primary/20" style={{ height: "45%" }}></div>
                <p className="text-xs font-bold text-muted-foreground">S3</p>
              </div>
              <div className="flex h-full w-full flex-col items-center justify-end gap-2">
                <div className="w-full rounded-lg bg-primary/20" style={{ height: "80%" }}></div>
                <p className="text-xs font-bold text-muted-foreground">S4</p>
              </div>
              <div className="flex h-full w-full flex-col items-center justify-end gap-2 hidden md:flex">
                <div className="w-full rounded-lg bg-primary/20" style={{ height: "65%" }}></div>
                <p className="text-xs font-bold text-muted-foreground">S5</p>
              </div>
              <div className="flex h-full w-full flex-col items-center justify-end gap-2 hidden md:flex">
                <div className="w-full rounded-lg bg-primary/20" style={{ height: "90%" }}></div>
                <p className="text-xs font-bold text-muted-foreground">S6</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className="text-base font-semibold">Resumen de Inventario</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-6 px-6 pb-6 md:flex-row md:items-center md:justify-center">
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
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-2xl font-bold">250</span>
              </div>
            </div>
            <div className="flex w-full min-w-0 flex-col justify-center gap-3 md:w-auto">
              <div className="flex items-center gap-2">
                <Badge className="size-2.5 rounded-full p-0 border-0" style={{ backgroundColor: "oklch(0.73 0.13 75)" }} />
                <p className="text-sm font-medium">Nuevos: 150 (60%)</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="size-2.5 rounded-full p-0 border-0" style={{ backgroundColor: "oklch(0.7 0.15 50)" }} />
                <p className="text-sm font-medium">Usados: 75 (30%)</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="size-2.5 rounded-full p-0 border-0" style={{ backgroundColor: "oklch(0.85 0.1 75)" }} />
                <p className="text-sm font-medium">En Taller: 25 (10%)</p>
              </div>
              <div className="mt-2 pt-2">
                <Separator className="mb-2" />
                <p className="text-sm text-muted-foreground">
                  Valor del Inventario: $8.5M
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Próximas Citas</CardTitle>
              <Button variant="link" className="h-auto p-0 text-sm font-semibold text-primary">
                Ver Todas
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 px-6 pb-6">
            <div className="flex items-center gap-4 rounded-lg p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="flex items-center justify-center w-full h-full bg-primary/10 text-primary p-0">
                  <Car className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <p className="font-medium">Prueba de Manejo</p>
                <p className="text-sm text-muted-foreground">Ana García</p>
              </div>
              <p className="text-sm font-medium">14:30</p>
            </div>
            <div className="flex items-center gap-4 rounded-lg p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="flex items-center justify-center w-full h-full bg-green-100 text-green-600 p-0">
                  <Key className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <p className="font-medium">Entrega de Vehículo</p>
                <p className="text-sm text-muted-foreground">Carlos Martinez</p>
              </div>
              <p className="text-sm font-medium">16:00</p>
            </div>
            <div className="flex items-center gap-4 rounded-lg p-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="flex items-center justify-center w-full h-full bg-orange-100 text-orange-600 p-0">
                  <Wrench className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <p className="font-medium">Revisión Taller</p>
                <p className="text-sm text-muted-foreground">Lucía Fernández</p>
              </div>
              <p className="text-sm font-medium">17:15</p>
            </div>
          </CardContent>
        </Card>
    </AdminLayout>
  );
}
