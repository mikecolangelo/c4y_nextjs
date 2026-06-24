"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components_shadcn/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import { StatusBadge } from "@/components/ui";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { ScrollArea } from "@/components_shadcn/ui/scroll-area";
import { Button } from "@/components_shadcn/ui/button";
import { spacing, typography } from "@/lib/design-system";
import { toast } from "@/lib/toast";
import { DollarSign, AlertTriangle, Package, TrendingDown } from "lucide-react";
import Link from "next/link";
import type { StockDashboardMetrics, StockAlert, InventoryMovement } from "@/validations/types";

export default function StockDashboardPage() {
  const [metrics, setMetrics] = useState<StockDashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [isLoadingMetrics, setIsLoadingMetrics] = useState(true);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(true);

  const loadDashboard = useCallback(async () => {
    setIsLoadingMetrics(true);
    try {
      const res = await fetch("/api/stock/dashboard", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Dashboard request failed");
      const { data } = await res.json();
      setMetrics(data);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("No se pudieron cargar las métricas del inventario.");
    } finally {
      setIsLoadingMetrics(false);
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const res = await fetch("/api/stock/alerts", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Alerts request failed");
      const { data } = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast.error("No se pudieron cargar las alertas de stock.");
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadAlerts();
  }, [loadDashboard, loadAlerts]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-PA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout title="Cuadro de Inventario">
      <div className={`flex flex-col ${spacing.gap.xlarge}`}>
        {/* Header */}
        <div className={`flex items-center justify-between ${spacing.gap.medium}`}>
          <p className={typography.body.small}>
            Métricas, alertas y consumos recientes de repuestos.
          </p>
          <Link href="/stock">
            <Button variant="outline" className="gap-2">
              <Package className="h-4 w-4" />
              Ver Inventario
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className={`grid ${spacing.gap.medium} md:grid-cols-3`}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={typography.body.base}>Valor Total del Inventario</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetrics ? (
                <Skeleton className="h-8 w-32" />
              ) : (
                <div className={typography.metric.base}>
                  {formatCurrency(metrics?.totalInventoryValue ?? 0)}
                </div>
              )}
              <p className={typography.body.small}>Suma de stock × costo unitario</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={typography.body.base}>Repuestos Críticos</CardTitle>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              {isLoadingMetrics ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={`${typography.metric.base} text-destructive`}>
                  {metrics?.criticalItemsCount ?? 0}
                </div>
              )}
              <p className={typography.body.small}>Items con stock ≤ mínimo</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className={typography.body.base}>Total de Repuestos</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoadingMetrics ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className={typography.metric.base}>{metrics?.totalItemsCount ?? 0}</div>
              )}
              <p className={typography.body.small}>Items activos en catálogo</p>
            </CardContent>
          </Card>
        </div>

        <div className={`grid ${spacing.gap.xlarge} lg:grid-cols-2`}>
          {/* Critical Items Table */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${typography.h4}`}>
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Repuestos Críticos
              </CardTitle>
              <CardDescription>Items que requieren reabastecimiento inmediato.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingAlerts ? (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : alerts.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No hay alertas de stock. Todo está en niveles óptimos.
                </div>
              ) : (
                <ScrollArea className="h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Mínimo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id}>
                          <TableCell className="py-4 font-medium">{alert.code}</TableCell>
                          <TableCell className="max-w-[200px] truncate py-4">
                            {alert.description}
                          </TableCell>
                          <TableCell className="py-4 text-right">
                            <StatusBadge tone="danger" className="ml-auto">
                              {alert.stock} {alert.unit}
                            </StatusBadge>
                          </TableCell>
                          <TableCell className="py-4 text-right text-muted-foreground">
                            {alert.minStock} {alert.unit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Last Consumptions Table */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${typography.h4}`}>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
                Últimos Consumos
              </CardTitle>
              <CardDescription>Movimientos de salida más recientes del inventario.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingMetrics ? (
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : !metrics?.lastConsumptions || metrics.lastConsumptions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No hay consumos registrados recientemente.
                </div>
              ) : (
                <ScrollArea className="h-[320px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Repuesto</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                        <TableHead>Orden</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {metrics.lastConsumptions.map((mov: InventoryMovement) => (
                        <TableRow key={mov.id}>
                          <TableCell className="whitespace-nowrap py-4 text-muted-foreground">
                            {formatDate(mov.date)}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate py-4">
                            {mov.inventoryItem?.description || mov.inventoryItem?.code || "—"}
                          </TableCell>
                          <TableCell className="py-4 text-right font-medium">
                            {mov.quantity}
                          </TableCell>
                          <TableCell className="py-4 text-muted-foreground">
                            {mov.serviceOrder?.code || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
