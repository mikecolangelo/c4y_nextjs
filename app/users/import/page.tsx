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
  ArrowLeft,
  Loader2,
  FileWarning,
  Table2,
  Trash2,
  Users,
  GripVertical,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components_shadcn/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components_shadcn/ui/card";
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
import { Alert, AlertDescription, AlertTitle } from "@/components_shadcn/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import {
  parseLeadImportFile,
  validateHeaders,
  validateRow,
  checkIntraFileDuplicates,
  generateTemplateBuffer,
  generateErrorLogBuffer,
  FIELD_LABELS,
  REQUIRED_FIELDS,
  type LeadImportRow,
  type ValidationResult,
} from "@/lib/lead-import";

function safeErrorMessage(data: any, fallback: string): string {
  if (typeof data?.error?.message === "string") return data.error.message;
  if (typeof data?.error === "string") return data.error;
  if (typeof data?.message === "string") return data.message;
  return fallback;
}

type ImportPhase = "idle" | "mapping" | "preview" | "uploading" | "success" | "error";

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
    displayName: string | null;
    status: "created" | "duplicate" | "error";
    message?: string;
  }>;
}

export default function UsersImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<(keyof LeadImportRow | null)[]>([]);
  const [parsedRows, setParsedRows] = useState<LeadImportRow[]>([]);
  const [unmappedColumns, setUnmappedColumns] = useState<
    Array<{ header: string; index: number; sampleValues: (string | number | null)[] }>
  >([]);
  const [headerValidation, setHeaderValidation] = useState<ValidationResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const resetState = useCallback(() => {
    setPhase("idle");
    setFileName("");
    setRawHeaders([]);
    setColumnMapping([]);
    setParsedRows([]);
    setUnmappedColumns([]);
    setHeaderValidation(null);
    setProgress(0);
    setProgressLabel("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleDownloadTemplate = useCallback(() => {
    const buffer = generateTemplateBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_importar_leads.xlsx";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Plantilla descargada");
  }, []);

  const handleConfirmMapping = useCallback(() => {
    const headerCheck = validateHeaders(columnMapping);
    setHeaderValidation(headerCheck);

    // Se permite importar aunque falten columnas o datos;
    // solo mostramos advertencia informativa.
    if (!headerCheck.valid) {
      toast.info(
        `Columnas no detectadas: ${headerCheck.missing.map((m) => FIELD_LABELS[m]).join(", ")}. Se importarán con valores vacíos.`
      );
    }

    const validatedRows = parsedRows.map((row) => {
      const errors = validateRow(row);
      return { ...row, _errors: errors };
    });
    checkIntraFileDuplicates(validatedRows);

    setParsedRows(validatedRows);
    setPhase("preview");
    toast.success(`${validatedRows.length} registros listos para importar`);
  }, [columnMapping, parsedRows]);

  const processFile = useCallback(async (file: File) => {
    try {
      setFileName(file.name);
      const buffer = await file.arrayBuffer();
      const {
        headers,
        mappedHeaders,
        rows,
        unmappedColumns: unmapped,
      } = parseLeadImportFile(buffer, file.name);

      setRawHeaders(headers);
      setColumnMapping(mappedHeaders);
      setUnmappedColumns(unmapped);

      const headerCheck = validateHeaders(mappedHeaders);
      setHeaderValidation(headerCheck);

      if (!headerCheck.valid) {
        toast.info(
          `Columnas no detectadas: ${headerCheck.missing.map((m) => FIELD_LABELS[m]).join(", ")}. Se importarán con valores vacíos.`
        );
      }

      const validatedRows = rows.map((row) => {
        const errors = validateRow(row);
        return { ...row, _errors: errors };
      });
      checkIntraFileDuplicates(validatedRows);

      setParsedRows(validatedRows);
      setPhase("preview");
      toast.success(`Archivo analizado: ${validatedRows.length} registros detectados`);
    } catch (err) {
      console.error(err);
      setPhase("error");
      toast.error(err instanceof Error ? err.message : "Error al leer el archivo");
    }
  }, []);

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
      toast.warning(
        `Hay ${rowsWithErrors.length} filas con advertencias (formato). Se importarán de todas formas.`
      );
    }

    setPhase("uploading");
    setProgress(0);
    setProgressLabel("Preparando datos...");

    try {
      const batchSize = 50;
      const total = parsedRows.length;
      let created = 0;
      let duplicated = 0;
      let errors = 0;
      const allDetails: ImportResult["details"] = [];
      const importBatch = `leads-${Date.now()}`;

      for (let i = 0; i < total; i += batchSize) {
        const batch = parsedRows.slice(i, i + batchSize);
        const payload = batch.map((row) => ({
          displayName: row.displayName,
          phone: row.phone,
          email: row.email,
          department: row.department,
          bio: row.bio,
          hireDate: row.hireDate,
          workSchedule: row.workSchedule,
          role: row.role,
          identificationNumber: row.identificationNumber,
          address: row.address,
          dateOfBirth: row.dateOfBirth,
          specialties: row.specialties,
          emergencyContactName: row.emergencyContactName,
          emergencyContactPhone: row.emergencyContactPhone,
          linkedin: row.linkedin,
          driverLicense: row.driverLicense,
        }));

        setProgressLabel(`Procesando ${Math.min(i + batchSize, total)} de ${total}...`);

        const res = await fetch("/api/user-profiles/batch-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: payload, importBatch }),
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          batch.forEach((row, idx) => {
            errors++;
            allDetails.push({
              index: row._rowIndex ?? i + idx + 1,
              displayName: row.displayName || null,
              status: "error" as const,
              message: safeErrorMessage(data, `Error HTTP ${res.status}`),
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
      toast.success(
        `Importación completada: ${created} creados, ${duplicated} duplicados, ${errors} errores`
      );
    } catch (err) {
      console.error(err);
      setPhase("error");
      toast.error(err instanceof Error ? err.message : "Error durante la importación");
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

  const fieldOptions = Object.entries(FIELD_LABELS).map(([key, label]) => ({
    value: key as keyof LeadImportRow,
    label,
    required: REQUIRED_FIELDS.includes(key as keyof LeadImportRow),
  }));

  return (
    <AdminLayout title="Importar Leads">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.push("/users")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Importar Leads</h1>
              <p className="text-muted-foreground">
                Sube un archivo Excel con leads para importarlos masivamente al sistema.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleDownloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Descargar Plantilla
          </Button>
        </div>

        {/* Drop Zone */}
        {(phase === "idle" || phase === "error") && (
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
                <p className="text-lg font-medium">Arrastra aquí tu archivo Excel</p>
                <p className="text-sm text-muted-foreground mt-1">
                  También puedes hacer clic para seleccionar el archivo
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Formatos soportados: .xlsx, .xls, .csv | Máximo recomendado: 1000 filas
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Column Mapping Panel */}
        {phase === "mapping" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <GripVertical className="h-4 w-4" />
                Mapeo de Columnas
              </CardTitle>
              <CardDescription>
                Algunas columnas no fueron detectadas automáticamente. Selecciona a qué campo del
                sistema corresponde cada columna de tu Excel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {headerValidation && headerValidation.missing.length > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Faltan columnas obligatorias</AlertTitle>
                  <AlertDescription>
                    Columnas requeridas no detectadas:{" "}
                    <strong>
                      {headerValidation.missing.map((m) => FIELD_LABELS[m]).join(", ")}
                    </strong>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                {rawHeaders.map((header, idx) => {
                  const mapped = columnMapping[idx];
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{header || `(Columna ${idx + 1})`}</p>
                        <p className="text-xs text-muted-foreground">
                          {mapped ? `Detectado como: ${FIELD_LABELS[mapped]}` : "No detectado"}
                        </p>
                      </div>
                      <Select
                        value={mapped || "unmapped"}
                        onValueChange={(value) => {
                          setColumnMapping((prev) => {
                            const next = [...prev];
                            next[idx] =
                              value === "unmapped" ? null : (value as keyof LeadImportRow);
                            return next;
                          });
                        }}
                      >
                        <SelectTrigger className="w-56">
                          <SelectValue placeholder="Seleccionar campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unmapped">— Ignorar —</SelectItem>
                          {fieldOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label} {opt.required && "*"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button variant="outline" onClick={resetState}>
                  Cancelar
                </Button>
                <Button onClick={handleConfirmMapping}>Confirmar Mapeo y Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Preview */}
        {phase === "preview" && headerValidation?.valid && (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <span className="font-medium">{fileName}</span>
                <Badge variant="secondary">{parsedRows.length} registros</Badge>
                {errorCount > 0 && <Badge variant="destructive">{errorCount} con errores</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={resetState} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" />
                  Limpiar
                </Button>
                <Button size="sm" onClick={handleUpload} className="gap-1">
                  <Upload className="h-3.5 w-3.5" />
                  Importar Leads
                </Button>
              </div>
            </div>

            {errorCount > 0 && (
              <Alert
                variant="default"
                className="bg-amber-50 border-amber-200 dark:bg-amber-950/50 dark:border-amber-800"
              >
                <FileWarning className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="text-amber-800 dark:text-amber-300">
                  Advertencias de formato
                </AlertTitle>
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  Hay {errorCount} filas con advertencias (formato de email o teléfono). Se
                  importarán de todas formas.
                </AlertDescription>
              </Alert>
            )}

            {unmappedColumns.length > 0 && (
              <Alert
                variant="default"
                className="bg-orange-50 border-orange-200 dark:bg-orange-950/50 dark:border-orange-800"
              >
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <AlertTitle className="text-orange-800 dark:text-orange-300">
                  Columnas no reconocidas
                </AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-400">
                  Estas columnas del Excel no fueron detectadas automáticamente y no se importarán:
                  <ul className="mt-1 ml-4 list-disc">
                    {unmappedColumns.map((col, idx) => (
                      <li key={idx}>
                        <strong>{col.header}</strong>
                        {col.sampleValues.length > 0 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            (ej: {col.sampleValues.slice(0, 2).join(", ")})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
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
                  Revisa que los datos se hayan interpretado correctamente antes de importar.
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Fila</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Origen</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Fecha Contacto</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Rol</TableHead>
                      <TableHead>Estado</TableHead>
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
                          <TableCell className="font-medium">{row.displayName || "—"}</TableCell>
                          <TableCell>{row.phone || "—"}</TableCell>
                          <TableCell className="text-xs">{row.email || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.department || "—"}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                            {row.bio || "—"}
                          </TableCell>
                          <TableCell className="text-xs">{row.hireDate || "—"}</TableCell>
                          <TableCell className="text-xs">{row.workSchedule || "—"}</TableCell>
                          <TableCell>
                            {row.role ? (
                              <Badge variant="outline" className="text-xs">
                                {row.role}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
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

            {/* Full error list */}
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
                        {row.displayName && (
                          <span className="text-muted-foreground ml-2">({row.displayName})</span>
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
                <p className="text-sm text-muted-foreground">Por favor no cierres esta ventana</p>
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
                  Importación finalizada
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
                    <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      {result.summary.created}
                    </p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 uppercase">
                      Creados exitosamente
                    </p>
                  </div>
                  <div className="bg-amber-100 rounded-lg border border-amber-200 p-4 text-center dark:bg-amber-900/50 dark:border-amber-800">
                    <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                      {result.summary.duplicated}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 uppercase">
                      Duplicados omitidos
                    </p>
                  </div>
                  <div className="bg-red-100 rounded-lg border border-red-200 p-4 text-center dark:bg-red-900/50 dark:border-red-800">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {result.summary.errors}
                    </p>
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
                      {result.summary.errors + result.summary.duplicated} filas requieren atención
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadErrorLog}
                    className="gap-1"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar Log
                  </Button>
                </CardHeader>
                <CardContent className="max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Fila</TableHead>
                        <TableHead>Nombre</TableHead>
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
                            <TableCell className="font-medium">{d.displayName || "—"}</TableCell>
                            <TableCell>
                              {d.status === "duplicate" ? (
                                <Badge
                                  variant="secondary"
                                  className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
                                >
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
                <Users className="mr-2 h-4 w-4" />
                Importar otro archivo
              </Button>
              <Button onClick={() => router.push("/users")}>Ir a Contactos</Button>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
