"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Filter,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { Button } from "@/components_shadcn/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components_shadcn/ui/dropdown-menu";

interface WeeklyCollectionRecord {
  id: number;
  documentId: string;
  weekNumber?: number;
  receiptDate?: string;
  receiptNumber?: string;
  paymentDate?: string;
  confirmationNumber?: string;
  weeklyQuota?: number;
  initialDeposit?: number;
  lateFee?: number;
  amountPaid?: number;
  remainingBalance?: number;
  verifiedInBank?: boolean;
  clientIdentification?: string;
  clientName?: string;
  importBatch?: string;
  importStatus?: string;
  importError?: string;
  createdAt: string;
  client?: { displayName?: string } | null;
  financing?: { financingNumber?: string } | null;
}

type StatusFilter = "all" | "processed" | "duplicate" | "error";

export default function BillingImportDetailPage() {
  const params = useParams();
  const batchId = decodeURIComponent(params.batchId as string);

  const [records, setRecords] = useState<WeeklyCollectionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const fetchRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/weekly-collections/batch/${encodeURIComponent(batchId)}`);
      if (!res.ok) throw new Error("Error al cargar registros del lote");
      const data = await res.json();
      setRecords(data.data || []);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    if (batchId) fetchRecords();
  }, [batchId, fetchRecords]);

  const filteredRecords = records.filter((r) => {
    if (statusFilter === "all") return true;
    return r.importStatus === statusFilter;
  });

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString("es-PA", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (value?: number) => {
    if (value == null) return "—";
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const statusBadge = (status?: string) => {
    switch (status) {
      case "processed":
        return (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Creado
          </Badge>
        );
      case "duplicate":
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Duplicado
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Procesado
          </Badge>
        );
    }
  };

  const stats = {
    total: records.length,
    processed: records.filter((r) => r.importStatus === "processed").length,
    duplicated: records.filter((r) => r.importStatus === "duplicate").length,
    errors: records.filter((r) => r.importStatus === "error").length,
  };

  const handleExport = () => {
    const rows = filteredRecords.map((r) => ({
      Semana: r.weekNumber ?? "",
      "Fecha Recibo": r.receiptDate ?? "",
      Recibo: r.receiptNumber ?? "",
      "Fecha Pago": r.paymentDate ?? "",
      Confirmacion: r.confirmationNumber ?? "",
      Cuota: r.weeklyQuota ?? "",
      "Deposito Inicial": r.initialDeposit ?? "",
      Multa: r.lateFee ?? "",
      Pagos: r.amountPaid ?? "",
      Saldo: r.remainingBalance ?? "",
      "Verificado Banco": r.verifiedInBank ? "Si" : "No",
      Cedula: r.clientIdentification ?? "",
      Cliente: r.clientName ?? "",
      Estado: r.importStatus ?? "",
      Error: r.importError ?? "",
    }));

    if (rows.length === 0) {
      toast.error("No hay registros para exportar");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((h) => {
            const val = (row as any)[h];
            const str = val == null ? "" : String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lote_${batchId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Archivo CSV descargado");
  };

  return (
    <AdminLayout
      title={`Lote: ${batchId}`}
      leftActions={<BackButton fallbackHref="/billing/imports" />}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Detalle del Lote</h1>
              <p className="text-muted-foreground font-mono text-sm">{batchId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground uppercase">Total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-700">{stats.processed}</p>
              <p className="text-xs text-emerald-600 uppercase">Creados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-700">{stats.duplicated}</p>
              <p className="text-xs text-amber-600 uppercase">Duplicados</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-700">{stats.errors}</p>
              <p className="text-xs text-red-600 uppercase">Errores</p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Registros del Lote
              </CardTitle>
              <CardDescription>
                {filteredRecords.length} de {records.length} registros
                {statusFilter !== "all" && ` · filtrado por estado`}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Filter className="h-4 w-4" />
                  {statusFilter === "all"
                    ? "Todos"
                    : statusFilter === "processed"
                      ? "Creados"
                      : statusFilter === "duplicate"
                        ? "Duplicados"
                        : "Errores"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filtrar por Estado</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter("all")}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Todos
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("processed")}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                  Creados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("duplicate")}>
                  <AlertTriangle className="h-4 w-4 mr-2 text-amber-600" />
                  Duplicados
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter("error")}>
                  <XCircle className="h-4 w-4 mr-2 text-red-600" />
                  Errores
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  No hay registros con el filtro seleccionado.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Recibo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Cedula</TableHead>
                      <TableHead className="text-right">Cuota</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Fecha Recibo</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record, idx) => (
                      <TableRow key={record.documentId || record.id}>
                        <TableCell className="font-mono text-xs">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{record.receiptNumber || "—"}</TableCell>
                        <TableCell>
                          {record.clientName || record.client?.displayName || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.clientIdentification || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.weeklyQuota)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.amountPaid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(record.remainingBalance)}
                        </TableCell>
                        <TableCell>{formatDate(record.receiptDate)}</TableCell>
                        <TableCell>{statusBadge(record.importStatus)}</TableCell>
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
