"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Download,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Loader2,
  FileWarning,
  Table2,
  Trash2,
  History,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components_shadcn/ui/card";
import { Progress } from "@/components_shadcn/ui/progress";
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
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components_shadcn/ui/alert";
import {
  parseWeeklyCollectionFile,
  validateHeaders,
  validateRow,
  generateErrorLogBuffer,
  type WeeklyCollectionRaw,
} from "@/lib/weekly-collection-import";

type ImportPhase = "idle" | "preview" | "uploading" | "success" | "error";

interface ImportResult {
  importBatch: string;
  summary: {
    total: number;
    created: number;
    duplicated: number;
    errors: number;
  };
  details: Array<{
    index: number;
    receiptNumber: string | null;
    status: "created" | "duplicate" | "error";
    message?: string;
  }>;
}

export default function BillingImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [parsedRows, setParsedRows] = useState<WeeklyCollectionRaw[]>([]);
  const [headerValidation, setHeaderValidation] = useState<{
    valid: boolean;
    missing: string[];
    detected: string[];
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setPhase("idle");
    setFileName("");
    setParsedRows([]);
    setHeaderValidation(null);
    setProgress(0);
    setProgressLabel("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const url = "/plantilla_cobranza_semanal.xlsx";
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_cobranza_semanal.xlsx";
    a.click();
    toast.success("Plantilla descargada");
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      try {
        setFileName(file.name);
        const buffer = await file.arrayBuffer();
        const { mappedHeaders, rows } = parseWeeklyCollectionFile(buffer, file.name);

        const headerCheck = validateHeaders(mappedHeaders);
        setHeaderValidation(headerCheck);

        if (!headerCheck.valid) {
          setPhase("error");
          toast.error(`Faltan columnas obligatorias: ${headerCheck.missing.join(", ")}`);
          return;
        }

        // Validate each row and attach errors
        const validatedRows = rows.map((row) => {
          const errors = validateRow(row);
          return { ...row, _errors: errors };
        });

        setParsedRows(validatedRows);
        setPhase("preview");
        toast.success(`Archivo analizado: ${validatedRows.length} registros detectados`);
      } catch (err) {
        console.error(err);
        setPhase("error");
        toast.error(err instanceof Error ? err.message : "Error al leer el archivo");
      }
    },
    []
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleUpload = useCallback(async () => {
    if (parsedRows.length === 0) return;

    const rowsWithErrors = parsedRows.filter((r) => (r._errors?.length ?? 0) > 0);
    if (rowsWithErrors.length > 0) {
      toast.error(`Hay ${rowsWithErrors.length} filas con errores. Corrige antes de subir.`);
      return;
    }

    setPhase("uploading");
    setProgress(0);
    setProgressLabel("Preparando datos...");

    try {
      const batchSize = 100;
      const total = parsedRows.length;
      let created = 0;
      let duplicated = 0;
      let errors = 0;
      const allDetails: ImportResult["details"] = [];
      const importBatch = `batch-${Date.now()}`;

      for (let i = 0; i < total; i += batchSize) {
        const batch = parsedRows.slice(i, i + batchSize);
        const payload = batch.map((row) => ({
          weekNumber: row.weekNumber,
          receiptDate: row.receiptDate,
          receiptNumber: row.receiptNumber,
          paymentDate: row.paymentDate,
          confirmationNumber: row.confirmationNumber,
          weeklyQuota: row.weeklyQuota,
          initialDeposit: row.initialDeposit,
          lateFee: row.lateFee,
          amountPaid: row.amountPaid,
          remainingBalance: row.remainingBalance,
          verifiedInBank: row.verifiedInBank,
          clientIdentification: row.clientIdentification,
          clientName: row.clientName,
        }));

        setProgressLabel(`Procesando ${Math.min(i + batchSize, total)} de ${total}...`);

        const res = await fetch("/api/weekly-collections/batch-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload, importBatch }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          // Mark all in this batch as error
          batch.forEach((row, idx) => {
            errors++;
            allDetails.push({
              index: (row._rowIndex ?? i + idx + 1),
              receiptNumber: row.receiptNumber || null,
              status: "error" as const,
              message: data?.error || `Error HTTP ${res.status}`,
            });
          });
        } else {
          const summary = data?.data?.summary;
          const details = data?.data?.details || [];
          if (summary) {
            created += summary.created;
            duplicated += summary.duplicated;
            errors += summary.errors;
          }
          allDetails.push(...details);
        }

        const pct = Math.round(((i + batch.length) / total) * 100);
        setProgress(pct);
      }

      setResult({
        importBatch,
        summary: { total, created, duplicated, errors },
        details: allDetails,
      });
      setPhase("success");
      toast.success(`Importacion completada: ${created} creados, ${duplicated} duplicados, ${errors} errores`);
    } catch (err) {
      console.error(err);
      setPhase("error");
      toast.error(err instanceof Error ? err.message : "Error durante la importacion");
    }
  }, [parsedRows]);

  const handleDownloadErrorLog = useCallback(() => {
    if (!result) return;
    const buffer = generateErrorLogBuffer(result.details);
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `log_errores_${result.importBatch}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Log de errores descargado");
  }, [result]);

  const previewRows = parsedRows.slice(0, 5);
  const errorCount = parsedRows.filter((r) => (r._errors?.length ?? 0) > 0).length;

  return (
    <AdminLayout title="Importacion Masiva de Cobranza">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/billing")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Importacion Masiva de Cobranza</h1>
              <p className="text-muted-foreground">
                Sube un archivo Excel o CSV con los registros semanales de pago.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => router.push("/billing/imports")}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              Ver Historial
            </Button>
            <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
              <Download className="h-4 w-4" />
              Descargar Plantilla
            </Button>
          </div>
        </div>

        {/* Drop Zone */}
        {phase === "idle" || phase === "error" ? (
          <Card>
            <CardContent className="pt-6">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileInput}
                />
                <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">
                  Arrastra aqui tu archivo Excel o CSV
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Tambien puedes hacer clic para seleccionar el archivo
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Formatos soportados: .xlsx, .xls, .csv | Maximo 1000 filas
                </p>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Header Validation Error */}
        {headerValidation && !headerValidation.valid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error: Faltan columnas obligatorias</AlertTitle>
            <AlertDescription>
              No se encontraron las siguientes columnas requeridas:{" "}
              <strong>{headerValidation.missing.join(", ")}</strong>. Por favor descarga la plantilla
              y verifica los encabezados.
            </AlertDescription>
          </Alert>
        )}

        {/* Preview */}
        {phase === "preview" && headerValidation?.valid && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{parsedRows.length} registros</Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} con errores</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={resetState} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={errorCount > 0}
                  className="gap-1"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Importar Registros
                </Button>
              </div>
            </div>

            {errorCount > 0 && (
              <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/30">
                <FileWarning className="h-4 w-4" />
                <AlertTitle>Se detectaron errores en el archivo</AlertTitle>
                <AlertDescription>
                  Hay {errorCount} filas con errores de validacion. Corrige los valores marcados en
                  rojo antes de continuar con la importacion.
                </AlertDescription>
              </Alert>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Table2 className="h-4 w-4" />
                  Vista previa (primeros 5 registros)
                </CardTitle>
                <CardDescription>
                  Revisa que las columnas se hayan interpretado correctamente antes de importar.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Fila</TableHead>
                      <TableHead>Semana</TableHead>
                      <TableHead>Recibo</TableHead>
                      <TableHead>Fecha Recibo</TableHead>
                      <TableHead>Fecha Pago</TableHead>
                      <TableHead className="text-right">Cuota</TableHead>
                      <TableHead className="text-right">Deposito</TableHead>
                      <TableHead className="text-right">Multa</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Saldo</TableHead>
                      <TableHead>Verif.</TableHead>
                      <TableHead>Cedula</TableHead>
                      <TableHead>Errores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row) => {
                      const hasErrors = (row._errors?.length ?? 0) > 0;
                      return (
                        <TableRow
                          key={row._rowIndex}
                          className={hasErrors ? "bg-red-50/50 dark:bg-red-950/30" : ""}
                        >
                          <TableCell className="font-mono text-xs">{row._rowIndex}</TableCell>
                          <TableCell>{row.weekNumber ?? "—"}</TableCell>
                          <TableCell className="font-medium">{row.receiptNumber || "—"}</TableCell>
                          <TableCell>{row.receiptDate || "—"}</TableCell>
                          <TableCell>{row.paymentDate || "—"}</TableCell>
                          <TableCell className="text-right">
                            {row.weeklyQuota != null ? `$${row.weeklyQuota.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.initialDeposit != null ? `$${row.initialDeposit.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.lateFee != null ? `$${row.lateFee.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.amountPaid != null ? `$${row.amountPaid.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.remainingBalance != null ? `$${row.remainingBalance.toFixed(2)}` : "—"}
                          </TableCell>
                          <TableCell>
                            {row.verifiedInBank ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <XCircle className="h-4 w-4 text-muted-foreground" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{row.clientIdentification || "—"}</TableCell>
                          <TableCell>
                            {hasErrors ? (
                              <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {row._errors?.length} error(es)
                              </div>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Full error list if errors exist */}
            {errorCount > 0 && (
              <Card className="border-red-200 dark:border-red-800">
                <CardHeader>
                  <CardTitle className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Detalle de errores detectados
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                  {parsedRows
                    .filter((r) => (r._errors?.length ?? 0) > 0)
                    .map((row) => (
                      <div
                        key={row._rowIndex}
                        className="text-sm bg-red-50 border border-red-100 dark:bg-red-950/30 dark:border-red-800 rounded-lg p-3"
                      >
                        <span className="font-semibold">Fila {row._rowIndex}</span>
                        {row.receiptNumber && (
                          <span className="text-muted-foreground ml-2">
                            (Recibo: {row.receiptNumber})
                          </span>
                        )}
                        <ul className="mt-1 ml-4 list-disc text-red-700 dark:text-red-400">
                          {row._errors?.map((err, idx) => (
                            <li key={idx}>{err}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Uploading */}
        {phase === "uploading" && (
          <Card className="p-8">
            <div className="space-y-4 text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
              <div>
                <p className="font-medium">{progressLabel}</p>
                <p className="text-sm text-muted-foreground">
                  Por favor no cierres esta ventana
                </p>
              </div>
              <Progress value={progress} className="w-full max-w-md mx-auto" />
              <p className="text-xs text-muted-foreground">{progress}% completado</p>
            </div>
          </Card>
        )}

        {/* Success */}
        {phase === "success" && result && (
          <>
            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30">
              <CardHeader>
                <CardTitle className="text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  Importacion finalizada
                </CardTitle>
                <CardDescription className="text-emerald-700 dark:text-emerald-400">
                  Lote: <strong>{result.importBatch}</strong>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-card rounded-lg border p-4 text-center">
                    <p className="text-2xl font-bold">{result.summary.total}</p>
                    <p className="text-xs text-muted-foreground uppercase">Total Procesados</p>
                  </div>
                  <div className="bg-emerald-100 rounded-lg border border-emerald-200 p-4 text-center dark:bg-emerald-900/50 dark:border-emerald-800">
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{result.summary.created}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase">Creados exitosamente</p>
                  </div>
                  <div className="bg-amber-100 rounded-lg border border-amber-200 p-4 text-center dark:bg-amber-900/50 dark:border-amber-800">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{result.summary.duplicated}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 uppercase">Duplicados omitidos</p>
                  </div>
                  <div className="bg-red-100 rounded-lg border border-red-200 p-4 text-center dark:bg-red-900/50 dark:border-red-800">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{result.summary.errors}</p>
                    <p className="text-xs text-red-600 dark:text-red-400 uppercase">Errores</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {result.summary.errors + result.summary.duplicated > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Registros con problemas</CardTitle>
                    <CardDescription>
                      {result.summary.errors + result.summary.duplicated} filas requieren atencion
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleDownloadErrorLog} className="gap-1">
                    <Download className="h-3.5 w-3.5" />
                    Descargar Log
                  </Button>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Fila</TableHead>
                        <TableHead>Recibo</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.details
                        .filter((d) => d.status === "error" || d.status === "duplicate")
                        .map((d, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-mono">{d.index}</TableCell>
                            <TableCell className="font-medium">{d.receiptNumber || "—"}</TableCell>
                            <TableCell>
                              {d.status === "duplicate" ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400">
                                  Duplicado
                                </Badge>
                              ) : (
                                <Badge variant="destructive">Error</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {d.message}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={resetState}>
                Importar otro archivo
              </Button>
              <Button onClick={() => router.push("/billing")}>Ir a Facturacion</Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
