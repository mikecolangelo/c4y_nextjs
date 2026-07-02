"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { StatusBadge } from "@/components/ui";
import { Can } from "@/components/auth/can";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";

interface ImportBatch {
  importBatch: string;
  createdAt: string;
  total: number;
  created: number;
  duplicated: number;
  errors: number;
  processed: number;
}

export default function BillingImportsPage() {
  const router = useRouter();
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBatches = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/weekly-collections/batches");
      if (!res.ok) throw new Error("Error al cargar historial de importaciones");
      const data = await res.json();
      setBatches(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("es-PA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <AdminLayout
      title="Historial de Importaciones"
      leftActions={<BackButton fallbackHref="/billing" />}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Historial de Importaciones</h1>
              <p className="text-muted-foreground">
                Consulta todos los lotes de cobranza semanal importados.
              </p>
            </div>
          </div>
          <Can module="billing" action="canCreate">
            <Button
              variant="outline"
              onClick={() => router.push("/billing/import")}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Nueva Importacion
            </Button>
          </Can>
        </div>

        {/* Stats Summary */}
        {batches.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold">{batches.length}</p>
                <p className="text-xs text-muted-foreground uppercase">Lotes Totales</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-emerald-700">
                  {batches.reduce((sum, b) => sum + b.created, 0)}
                </p>
                <p className="text-xs text-emerald-600 uppercase">Registros Creados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-amber-700">
                  {batches.reduce((sum, b) => sum + b.duplicated, 0)}
                </p>
                <p className="text-xs text-amber-600 uppercase">Duplicados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-red-700">
                  {batches.reduce((sum, b) => sum + b.errors, 0)}
                </p>
                <p className="text-xs text-red-600 uppercase">Errores</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Lotes de Importacion
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : batches.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="text-muted-foreground">No hay importaciones registradas.</p>
                <Can module="billing" action="canCreate">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/billing/import")}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Importar primer lote
                  </Button>
                </Can>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Creados</TableHead>
                      <TableHead className="text-right">Duplicados</TableHead>
                      <TableHead className="text-right">Errores</TableHead>
                      <TableHead className="w-16">Accion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.importBatch}>
                        <TableCell className="font-mono text-xs">{batch.importBatch}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-sm">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                            {formatDate(batch.createdAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{batch.total}</TableCell>
                        <TableCell className="text-right">
                          <StatusBadge tone="success">
                            <CheckCircle2 />
                            {batch.created}
                          </StatusBadge>
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.duplicated > 0 ? (
                            <StatusBadge tone="warning">
                              <AlertTriangle />
                              {batch.duplicated}
                            </StatusBadge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {batch.errors > 0 ? (
                            <StatusBadge tone="danger">
                              <XCircle />
                              {batch.errors}
                            </StatusBadge>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              router.push(
                                `/billing/imports/${encodeURIComponent(batch.importBatch)}`
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
