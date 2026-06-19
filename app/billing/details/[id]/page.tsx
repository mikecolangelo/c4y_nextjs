"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Avatar, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { Separator } from "@/components_shadcn/ui/separator";
import {
  User,
  Car,
  Bell,
  Upload,
  FileText,
  Trash2,
  Calendar,
  Loader2,
  ExternalLink,
  Receipt,
  CheckCircle,
  Hash,
  AlertTriangle,
  Eye,
  Image as ImageIcon,
  FileType,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components_shadcn/ui/dialog";
import { Switch } from "@/components_shadcn/ui/switch";
import { InvoicePDFDownload } from "../../components/invoice-pdf";
import { ClientPaymentHistory } from "../../components/client-payment-history";
import { VerifyPaymentDialog } from "../../components/verify-payment-dialog";
import { spacing, typography, commonClasses, colors, components } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { cn } from "@/lib/utils";
import type { BillingRecordCard, BillingDocument, BillingStatus } from "@/validations/types";
import { Badge } from "@/components_shadcn/ui/badge";
import { Progress } from "@/components_shadcn/ui/progress";
import { BadgeCheck, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { History } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components_shadcn/ui/alert-dialog";

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "retrasado":
      return "text-red-600";
    case "pendiente":
      return "text-yellow-600";
    case "adelanto":
      return "text-blue-600";
    case "abonado":
      return "text-purple-600";
    case "pagado":
      return "text-green-600";
    default:
      return "text-muted-foreground";
  }
};

const getAmountColor = (status: BillingStatus): string => {
  switch (status) {
    case "retrasado":
      return "text-red-600";
    case "pendiente":
      return "text-yellow-600";
    case "adelanto":
      return "text-blue-600";
    case "abonado":
      return "text-purple-600";
    case "pagado":
      return "text-green-600";
    default:
      return "text-foreground";
  }
};

const getFileType = (fileName: string): "image" | "pdf" | "other" => {
  const extension = fileName.toLowerCase().split(".").pop() || "";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) {
    return "image";
  }
  if (extension === "pdf") {
    return "pdf";
  }
  return "other";
};

const getFileIcon = (fileName: string) => {
  const type = getFileType(fileName);
  switch (type) {
    case "image":
      return ImageIcon;
    case "pdf":
      return FileType;
    default:
      return FileText;
  }
};

export default function BillingDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [record, setRecord] = useState<BillingRecordCard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<BillingDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [status, setStatus] = useState<BillingStatus>("pendiente");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [documents, setDocuments] = useState<BillingDocument[]>([]);
  // Modal de historial de cliente
  const [isClientHistoryOpen, setIsClientHistoryOpen] = useState(false);
  // Modal de verificación
  const [isVerifyDialogOpen, setIsVerifyDialogOpen] = useState(false);
  // Estado para eliminación
  const [isDeleting, setIsDeleting] = useState(false);
  // Nuevos campos Módulo 3
  const [receiptId, setReceiptId] = useState<string>("");
  const [confirmationNumber, setConfirmationNumber] = useState<string>("");
  const [weeklyQuotaAmount, setWeeklyQuotaAmount] = useState<string>("");
  const [totalQuotas, setTotalQuotas] = useState<string>("220");
  const [currentQuotaNumber, setCurrentQuotaNumber] = useState<string>("");
  const [advancePayment, setAdvancePayment] = useState<string>("");
  const [verifiedInBank, setVerifiedInBank] = useState<boolean>(false);
  const [comments, setComments] = useState<string>("");

  const fetchRecord = useCallback(async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/billing/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("Registro de facturación no encontrado");
          return;
        }
        throw new Error("Error al cargar el registro");
      }
      const data = await response.json();
      const recordData = data.data as BillingRecordCard;

      // Bloquear acceso directo a detalles de multas/penalidades separadas
      if (recordData.amount < 0) {
        toast.info("Este registro no está disponible para visualización directa.");
        router.push("/billing");
        return;
      }

      setRecord(recordData);
      setStatus(recordData.status);
      setPaymentDate(recordData.paymentDate || "");
      setNotes(recordData.notes || "");
      setDocuments(recordData.documents || []);
      // Nuevos campos Módulo 3
      setReceiptId(recordData.receiptId || "");
      setConfirmationNumber(recordData.confirmationNumber || "");
      setWeeklyQuotaAmount(recordData.weeklyQuotaAmount?.toString() || "");
      setTotalQuotas(recordData.totalQuotas?.toString() || "220");
      setCurrentQuotaNumber(recordData.currentQuotaNumber?.toString() || "");
      setAdvancePayment(recordData.advancePayment?.toString() || "");
      setVerifiedInBank(recordData.verifiedInBank || false);
      setComments(recordData.comments || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRecord();
  }, [fetchRecord]);

  const backButton = <BackButton fallbackHref="/billing" />;

  const handleDeleteDocument = async (docId: string, docDocumentId?: string) => {
    try {
      // Usar documentId de Strapi si está disponible, de lo contrario usar id
      const idToDelete = docDocumentId || docId;
      const response = await fetch(`/api/billing-document/${idToDelete}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Error al eliminar el documento");
      }
      setDocuments(documents.filter((doc) => doc.id !== docId));
      toast.success("Documento eliminado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el documento");
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !record) return;

    try {
      setIsUploading(true);

      // First upload the file to Strapi
      const formData = new FormData();
      formData.append("files", file);

      const uploadResponse = await fetch("/api/strapi/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error("Error al subir el archivo");
      }

      const uploadData = await uploadResponse.json();
      // La API devuelve { data: { id, url, ... } } - un objeto, no un array
      const uploadedFileId = uploadData.data?.id;

      if (!uploadedFileId) {
        throw new Error("No se pudo obtener el ID del archivo subido");
      }

      // Create the billing document
      const docResponse = await fetch(`/api/billing/${record.documentId}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            name: file.name,
            file: uploadedFileId,
          },
        }),
      });

      if (!docResponse.ok) {
        throw new Error("Error al crear el documento de facturación");
      }

      const docData = await docResponse.json();
      const newDoc = docData.data;
      if (!newDoc || !newDoc.id) {
        throw new Error("El documento creado no tiene el formato esperado");
      }
      setDocuments([...documents, newDoc]);
      toast.success("Documento subido correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir el documento");
    } finally {
      setIsUploading(false);
      // Reset the input
      event.target.value = "";
    }
  };

  // Handlers para drag and drop
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isUploading) {
        setIsDragging(true);
      }
    },
    [isUploading]
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (isUploading || !record) return;

      const file = e.dataTransfer.files?.[0];
      if (!file) return;

      // Validar tipo de archivo
      const validTypes = ["application/pdf", "image/png", "image/jpeg", "image/jpg"];
      if (!validTypes.includes(file.type)) {
        toast.error("Tipo de archivo no válido. Solo se permiten PDF, PNG y JPG.");
        return;
      }

      // Validar tamaño (5MB max)
      if (file.size > 5 * 1024 * 1024) {
        toast.error("El archivo es demasiado grande. Máximo 5MB.");
        return;
      }

      try {
        setIsUploading(true);

        const formData = new FormData();
        formData.append("files", file);

        const uploadResponse = await fetch("/api/strapi/upload", {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          throw new Error("Error al subir el archivo");
        }

        const uploadData = await uploadResponse.json();
        const uploadedFileId = uploadData.data?.id;

        if (!uploadedFileId) {
          throw new Error("No se pudo obtener el ID del archivo subido");
        }

        const docResponse = await fetch(`/api/billing/${record.documentId}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              name: file.name,
              file: uploadedFileId,
            },
          }),
        });

        if (!docResponse.ok) {
          throw new Error("Error al crear el documento de facturación");
        }

        const docData = await docResponse.json();
        const newDoc = docData.data;
        if (!newDoc || !newDoc.id) {
          throw new Error("El documento creado no tiene el formato esperado");
        }
        setDocuments((prev) => [...prev, newDoc]);
        toast.success("Documento subido correctamente");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al subir el documento");
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading, record]
  );

  const handleSaveChanges = async () => {
    if (!record) return;

    try {
      setIsSaving(true);
      const response = await fetch(`/api/billing/${record.documentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            status,
            paymentDate: paymentDate || null,
            confirmationNumber: confirmationNumber || null,
            verifiedInBank,
            comments: comments || null,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar los cambios");
      }

      toast.success("Cambios guardados correctamente");
      router.back();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar los cambios");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!record) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/billing/${record.documentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al eliminar el pago");
      }

      toast.success(`Pago ${record.invoiceNumber} eliminado correctamente`);
      router.push("/billing");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el pago");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSendReminder = async () => {
    if (!record) return;

    try {
      const response = await fetch(`/api/billing/${record.documentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            remindersSent: (record.remindersSent || 0) + 1,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Error al enviar el recordatorio");
      }

      setRecord({
        ...record,
        remindersSent: (record.remindersSent || 0) + 1,
      });
      toast.success("Recordatorio enviado correctamente");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al enviar el recordatorio");
    }
  };

  // Solo mostrar loading state en la carga inicial (cuando no hay datos previos)
  if (isLoading && !record) {
    return (
      <AdminLayout title="Detalle del Pago" showFilterAction leftActions={backButton}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !record) {
    return (
      <AdminLayout title="Detalle del Pago" showFilterAction leftActions={backButton}>
        <Card className={commonClasses.card}>
          <CardContent className={spacing.card.padding}>
            <p className={`${typography.body.base} text-center`}>{error || "Pago no encontrado"}</p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => router.back()}>
              Volver
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  // Título dinámico según el tipo de pago
  const pageTitle =
    record.status === "adelanto"
      ? "Detalle del Adelanto"
      : record.status === "abonado"
        ? "Detalle del Abono"
        : "Detalle del Pago";

  // Calcular saldo faltante dinámicamente a partir de childRecords (abonos)
  const totalPaid = (record.childRecords || []).reduce(
    (sum: number, child: { amount?: number }) =>
      sum + (child.amount && child.amount > 0 ? child.amount : 0),
    0
  );
  const pendingBalance = Math.max(0, (record.amount || 0) - totalPaid);

  return (
    <AdminLayout title={pageTitle} showFilterAction leftActions={backButton}>
      <div className="flex flex-col gap-6 pb-24">
        {/* Información del Cliente */}
        <Card className={commonClasses.card}>
          <CardContent className={spacing.card.padding}>
            <div className={`flex items-center justify-between ${spacing.gap.medium}`}>
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarFallback className="bg-muted">
                    <User className="h-6 w-6 text-muted-foreground" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className={`${typography.body.large} font-bold`}>
                    {record.clientName || "Cliente no asignado"}
                  </p>
                  <div className="flex items-center gap-2">
                    <p className={typography.body.small}>
                      Recibo {record.receiptNumber || `Cuota #${record.quotaNumber || "-"}`}
                    </p>
                    {/* Badge de tipo de pago para adelantos/abonos */}
                    {record.status === "adelanto" && (
                      <Badge
                        variant="secondary"
                        className="bg-blue-100 text-blue-700 border-blue-200"
                      >
                        Adelanto
                      </Badge>
                    )}
                    {record.status === "abonado" && (
                      <Badge
                        variant="secondary"
                        className="bg-purple-100 text-purple-700 border-purple-200"
                      >
                        Abonado
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {record.clientDocumentId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsClientHistoryOpen(true)}
                  className="flex items-center gap-2"
                >
                  <History className="h-4 w-4" />
                  Ver Historial
                </Button>
              )}
            </div>
            {record.vehicleName && (
              <>
                <Separator className="my-4" />
                <div className={`flex items-center ${spacing.gap.base}`}>
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <p className={typography.body.base}>{record.vehicleName}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Modal de Historial del Cliente */}
        {record.clientDocumentId && record.clientName && (
          <ClientPaymentHistory
            clientDocumentId={record.clientDocumentId}
            clientName={record.clientName}
            isOpen={isClientHistoryOpen}
            onOpenChange={setIsClientHistoryOpen}
          />
        )}

        {/* Financiamiento Padre (si existe) */}
        {record.financingDocumentId && (
          <Card className={cn(commonClasses.card, "border-primary/30")}>
            <CardHeader className={spacing.card.header}>
              <div className="flex items-center justify-between">
                <CardTitle className={cn(commonClasses.sectionTitle, "flex items-center gap-2")}>
                  <LinkIcon className="h-4 w-4" />
                  Financiamiento Asociado
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/billing/financing/${record.financingDocumentId}`)}
                >
                  Ver Financiamiento
                </Button>
              </div>
            </CardHeader>
            <CardContent className={spacing.card.content}>
              <div className={`flex flex-col ${spacing.gap.base}`}>
                <div className="flex items-center justify-between">
                  <span className={typography.body.large}>
                    {record.financingNumber || "Sin número"}
                  </span>
                  <Badge variant="outline">
                    Cuota #{record.quotaNumber || record.currentQuotaNumber || "-"}
                  </Badge>
                </div>
                {record.financingQuotaAmount && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Monto de cuota</span>
                    <span className="font-medium">${record.financingQuotaAmount?.toFixed(2)}</span>
                  </div>
                )}
                {record.financingCurrentBalance !== undefined && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Saldo pendiente</span>
                    <span className="font-medium">
                      ${record.financingCurrentBalance?.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detalles del Pago */}
        <Card className={commonClasses.card}>
          <CardHeader className={spacing.card.header}>
            <CardTitle className={commonClasses.sectionTitle}>Detalles del Pago</CardTitle>
          </CardHeader>
          <CardContent className={spacing.card.content}>
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <div className="flex items-center justify-between">
                <span className={typography.label}>
                  {record.status === "retrasado"
                    ? "Monto Base"
                    : record.status === "abonado"
                      ? "Saldo Faltante"
                      : "Monto"}
                </span>
                <div className="text-right">
                  <span
                    className={`${typography.body.large} font-bold ${getAmountColor(record.status)}`}
                  >
                    {record.status === "abonado"
                      ? `$${pendingBalance.toFixed(2)}`
                      : record.amountLabel}
                  </span>
                  {record.status === "abonado" && pendingBalance !== record.amount && (
                    <p className="text-xs text-muted-foreground line-through">
                      Total: {record.amountLabel}
                    </p>
                  )}
                </div>
              </div>
              {record.status === "retrasado" &&
                record.lateFeeAmount &&
                record.lateFeeAmount > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Penalidad por día (10%)</span>
                      <span className="text-red-600">${(record.amount * 0.1).toFixed(2)}/día</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Días de retraso</span>
                      <span className="text-red-600">
                        × {record.daysLate} día{record.daysLate !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-dashed border-red-200">
                      <span className={typography.label}>Total Multa</span>
                      <span className={`${typography.body.large} font-bold text-red-600`}>
                        +${(record.lateFeeAmount || 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
              {record.status === "retrasado" &&
                record.lateFeeAmount &&
                record.lateFeeAmount > 0 && (
                  <div className="flex items-center justify-between border-t border-dashed pt-2 mt-1">
                    <span className={`${typography.label} font-semibold`}>Total a Pagar</span>
                    <span className={`${typography.metric.base} font-bold text-red-600`}>
                      ${(record.amount + (record.lateFeeAmount || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              {record.dueDate && (
                <div className="flex items-center justify-between">
                  <span className={typography.label}>Fecha de Vencimiento</span>
                  <span className={typography.body.base}>{formatDate(record.dueDate)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label htmlFor="status" className={typography.label}>
                  Estado
                </Label>
                <Select value={status} onValueChange={(value) => setStatus(value as BillingStatus)}>
                  <SelectTrigger
                    id="status"
                    className={`w-1/2 ${components.input.base} ${getStatusColor(status)}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retrasado" className="text-red-600">
                      Retrasado
                    </SelectItem>
                    <SelectItem value="pendiente" className="text-yellow-600">
                      Pendiente
                    </SelectItem>
                    <SelectItem value="abonado" className="text-purple-600">
                      Abonado
                    </SelectItem>
                    <SelectItem value="adelanto" className="text-blue-600">
                      Adelanto
                    </SelectItem>
                    <SelectItem value="pagado" className="text-green-600">
                      Pagado
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="payment-date" className={typography.label}>
                  Fecha de Pago
                </Label>
                <div className="relative w-1/2">
                  <Input
                    id="payment-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className={`${components.input.base} pr-10`}
                  />
                  <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              {record.remindersSent > 0 && (
                <div className="flex items-center justify-between">
                  <span className={typography.label}>Recordatorios enviados</span>
                  <span className={typography.body.base}>{record.remindersSent}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Información de Cuotas del Financiamiento */}
        <Card className={commonClasses.card}>
          <CardHeader className={spacing.card.header}>
            <CardTitle className={`${commonClasses.sectionTitle} flex items-center gap-2`}>
              <Hash className="h-4 w-4" />
              Detalle de Cuota
            </CardTitle>
          </CardHeader>
          <CardContent className={spacing.card.content}>
            <div className={`flex flex-col ${spacing.gap.medium}`}>
              {/* Grid de información principal */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Monto de este Pago - NUEVO: destacar el monto real del pago */}
                <div
                  className={cn(
                    "rounded-lg p-4 text-center",
                    record.status === "adelanto" || record.status === "abonado"
                      ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
                      : record.status === "pagado"
                        ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                        : record.status === "retrasado"
                          ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                          : "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
                  )}
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {record.status === "adelanto"
                      ? "Monto del Adelanto"
                      : record.status === "abonado"
                        ? "Saldo Faltante"
                        : "Monto de este Pago"}
                  </p>
                  <p
                    className={cn(
                      typography.metric.base,
                      record.status === "adelanto" || record.status === "abonado"
                        ? "text-blue-600"
                        : record.status === "pagado"
                          ? "text-green-600"
                          : record.status === "retrasado"
                            ? "text-red-600"
                            : "text-yellow-600"
                    )}
                  >
                    {record.status === "abonado"
                      ? `$${pendingBalance.toFixed(2)}`
                      : `$${(record.amount || 0).toFixed(2)}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {record.status === "adelanto"
                      ? "pago adelantado"
                      : record.status === "abonado"
                        ? `$${totalPaid.toFixed(2)} abonado de $${(record.amount || 0).toFixed(2)}`
                        : record.status === "pagado"
                          ? "pagado"
                          : record.status === "retrasado"
                            ? "vencido"
                            : "pendiente"}
                  </p>
                </div>

                {/* Letra/Cuota Asignada - ahora con tooltip aclaratorio */}
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p
                    className="text-xs text-muted-foreground mb-1"
                    title="Monto de cada cuota según el plan de financiamiento"
                  >
                    Letra del Plan
                  </p>
                  <p className={`${typography.metric.base} text-primary`}>
                    $
                    {(
                      record.financingQuotaAmount ||
                      record.weeklyQuotaAmount ||
                      parseFloat(weeklyQuotaAmount) ||
                      0
                    ).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {record.financingFrequency === "semanal"
                      ? "Semanal"
                      : record.financingFrequency === "quincenal"
                        ? "Quincenal"
                        : record.financingFrequency === "mensual"
                          ? "Mensual"
                          : "Semanal"}
                  </p>
                </div>

                {/* Cuota que se paga */}
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Cuota Pagada</p>
                  <p className={`${typography.metric.base} text-primary`}>
                    #{record.quotaNumber || record.currentQuotaNumber || currentQuotaNumber || "-"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">de este pago</p>
                </div>

                {/* Total de Cuotas */}
                <div className="rounded-lg bg-muted/50 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Cuotas</p>
                  <p className={`${typography.metric.base} text-primary`}>
                    {record.financingTotalQuotas || record.totalQuotas || totalQuotas || 234}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">del financiamiento</p>
                </div>
              </div>

              {/* Info adicional para adelantos y abonos */}
              {(record.status === "adelanto" || record.status === "abonado") && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Cuotas cubiertas por este pago */}
                  {record.quotasCovered && record.quotasCovered > 0 && (
                    <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Cuotas Cubiertas</p>
                          <p className={`${typography.body.large} font-semibold text-blue-600`}>
                            {record.quotasCovered} {record.quotasCovered === 1 ? "cuota" : "cuotas"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">
                            {record.status === "adelanto" ? "Desde cuota" : "Aplicado a"}
                          </p>
                          <p className={`${typography.body.large} font-semibold text-blue-600`}>
                            #{record.quotaNumber || "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Crédito disponible para futuras cuotas */}
                  {record.advanceCredit && record.advanceCredit > 0 && (
                    <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Crédito Disponible</p>
                          <p className={`${typography.body.large} font-semibold text-green-600`}>
                            +${record.advanceCredit.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">Para próximas cuotas</p>
                          <p className="text-sm text-green-600">Acumulado</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Saldo pendiente de la cuota actual (para abonos) */}
                  {record.status === "abonado" && pendingBalance > 0 && (
                    <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Saldo Pendiente</p>
                          <p className={`${typography.body.large} font-semibold text-yellow-600`}>
                            ${pendingBalance.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground mb-1">De esta cuota</p>
                          <p className="text-sm text-yellow-600">Por completar</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Barra de progreso del financiamiento */}
              {record.financingDocumentId && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progreso del Financiamiento</span>
                    <span className="font-medium">
                      {record.financingPaidQuotas || 0} de {record.financingTotalQuotas || 234}{" "}
                      cuotas
                    </span>
                  </div>
                  <Progress
                    value={
                      ((record.financingPaidQuotas || 0) / (record.financingTotalQuotas || 234)) *
                      100
                    }
                    className="h-2"
                  />
                </div>
              )}

              {/* Multa por atraso (si aplica) */}
              {(record.lateFeeAmount && record.lateFeeAmount > 0) ||
              (status === "retrasado" && record.daysLate && record.daysLate > 0) ? (
                <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <div>
                      <p
                        className={`${typography.body.base} text-red-700 dark:text-red-400 font-medium`}
                      >
                        {record.daysLate || 0} día{(record.daysLate || 0) !== 1 ? "s" : ""} de
                        atraso
                      </p>
                      <p className="text-xs text-red-600/70">10% diario sobre monto pendiente</p>
                    </div>
                  </div>
                  <span className={`${typography.metric.base} text-red-600`}>
                    +${(record.lateFeeAmount || 0).toFixed(2)}
                  </span>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {/* Verificación Bancaria */}
        <Card className={commonClasses.card}>
          <CardHeader className={spacing.card.header}>
            <CardTitle className={`${commonClasses.sectionTitle} flex items-center gap-2`}>
              <Receipt className="h-4 w-4" />
              Verificación Bancaria
            </CardTitle>
          </CardHeader>
          <CardContent className={spacing.card.content}>
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="receiptId" className={typography.label}>
                    ID de Recibo
                  </Label>
                  <Input
                    id="receiptId"
                    value={receiptId}
                    onChange={(e) => setReceiptId(e.target.value)}
                    placeholder="REC-2025-001"
                    className={components.input.base}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmationNumber" className={typography.label}>
                    # Confirmación
                  </Label>
                  <Input
                    id="confirmationNumber"
                    value={confirmationNumber}
                    onChange={(e) => setConfirmationNumber(e.target.value)}
                    placeholder="123456789"
                    className={components.input.base}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle
                    className={`h-5 w-5 ${verifiedInBank ? "text-green-600" : "text-muted-foreground"}`}
                  />
                  <div>
                    <Label htmlFor="verifiedInBank" className={typography.body.large}>
                      Verificado en Banco
                    </Label>
                    <p className={typography.body.small}>Marcar si el pago fue verificado</p>
                  </div>
                </div>
                <Switch
                  id="verifiedInBank"
                  checked={verifiedInBank}
                  onCheckedChange={setVerifiedInBank}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Comentarios */}
        <Card className={commonClasses.card}>
          <CardContent className={spacing.card.padding}>
            <div>
              <Label htmlFor="comments" className={`mb-2 block ${commonClasses.sectionTitle}`}>
                Comentarios / Notas
              </Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Añade comentarios o notas sobre este pago..."
                rows={3}
                className={components.input.base}
              />
            </div>
          </CardContent>
        </Card>

        {/* Documentos Adjuntos */}
        <Card className={commonClasses.card}>
          <CardHeader className={spacing.card.header}>
            <CardTitle className={commonClasses.sectionTitle}>Documentos Adjuntos</CardTitle>
          </CardHeader>
          <CardContent className={spacing.card.content}>
            <div className={`flex flex-col ${spacing.gap.base}`}>
              {documents.map((doc) => {
                const FileIcon = getFileIcon(doc.name);
                const fileType = getFileType(doc.name);
                const canPreview = fileType !== "other" && doc.url;

                return (
                  <div
                    key={doc.id || `doc-${Math.random()}`}
                    className={cn(
                      "flex items-center justify-between rounded-lg border bg-muted/50 p-3",
                      components.input.base,
                      canPreview && "cursor-pointer hover:bg-muted/80 transition-colors"
                    )}
                    onClick={() => canPreview && setViewingDocument(doc)}
                  >
                    <div className={`flex items-center ${spacing.gap.base}`}>
                      <FileIcon
                        className={cn(
                          "h-4 w-4",
                          fileType === "image"
                            ? "text-green-600"
                            : fileType === "pdf"
                              ? "text-red-600"
                              : "text-muted-foreground"
                        )}
                      />
                      <span className={typography.body.base}>{doc.name}</span>
                      {canPreview && (
                        <Badge variant="outline" className="text-xs">
                          Click para ver
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {canPreview && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingDocument(doc);
                          }}
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {doc.url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a href={doc.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDocument(doc.id, doc.documentId);
                        }}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  if (!isUploading) {
                    document.getElementById("file-upload")?.click();
                  }
                }}
                className={cn(
                  "flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 transition-colors",
                  components.input.base,
                  isDragging
                    ? "border-primary bg-primary/10"
                    : "border-muted-foreground/30 bg-muted/30 hover:bg-muted/50",
                  isUploading && "pointer-events-none opacity-50"
                )}
              >
                <div className={`flex flex-col items-center justify-center ${spacing.gap.small}`}>
                  {isUploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  ) : (
                    <Upload
                      className={cn(
                        "h-8 w-8",
                        isDragging ? "text-primary animate-bounce" : "text-primary"
                      )}
                    />
                  )}
                  <p className={typography.body.base}>
                    {isUploading ? (
                      "Subiendo..."
                    ) : isDragging ? (
                      <span className="font-semibold text-primary">Suelta el archivo aquí</span>
                    ) : (
                      <>
                        <span className="font-semibold">Click para subir</span> o arrastrar
                      </>
                    )}
                  </p>
                  <p className={typography.body.small}>PDF, PNG, JPG (max. 5MB)</p>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="sr-only"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <Card className={commonClasses.card}>
          <CardHeader className={spacing.card.header}>
            <CardTitle className={commonClasses.sectionTitle}>Acciones</CardTitle>
          </CardHeader>
          <CardContent className={spacing.card.content}>
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <InvoicePDFDownload
                company={{
                  name: "CAR 4 YOU PANAMA, S.A.",
                  address:
                    "Avenida Balboa, YOO Panamá & Arts Tower, apartamento 60a, Ciudad de Panamá",
                  phone: "+507 6000-0000",
                }}
                client={{
                  fullName: record.clientName || "Cliente",
                  identificationNumber: record.clientIdentificationNumber,
                  phone: record.clientPhone,
                  email: record.clientEmail,
                  address: record.clientBillingAddress || record.clientAddress,
                }}
                vehicle={
                  record.vehicleName
                    ? {
                        name: record.vehicleName,
                        placa: record.vehiclePlaca,
                      }
                    : undefined
                }
                invoice={{
                  invoiceNumber: record.invoiceNumber,
                  date: record.createdAt || new Date().toISOString(),
                  dueDate: record.dueDate,
                  paymentDate: record.paymentDate,
                  status: record.status,
                  quotaNumber: currentQuotaNumber ? parseInt(currentQuotaNumber) : undefined,
                  totalQuotas: totalQuotas ? parseInt(totalQuotas) : 220,
                  amount: record.amount,
                  weeklyQuotaAmount: weeklyQuotaAmount ? parseFloat(weeklyQuotaAmount) : undefined,
                  advancePayment: advancePayment ? parseFloat(advancePayment) : undefined,
                  currency: record.currency,
                  notes: comments,
                }}
                className="w-full"
                variant="outline"
              />
              <Button
                variant="secondary"
                onClick={handleSendReminder}
                className={`w-full ${components.button.base} flex items-center justify-center ${spacing.gap.small}`}
              >
                <Bell className="h-4 w-4" />
                Enviar Recordatorio
              </Button>

              {/* Botón de Verificación */}
              <Button
                variant={verifiedInBank ? "outline" : "default"}
                onClick={() => setIsVerifyDialogOpen(true)}
                className={cn(
                  `w-full ${components.button.base} flex items-center justify-center ${spacing.gap.small}`,
                  verifiedInBank && "border-green-500 text-green-600 hover:bg-green-50"
                )}
              >
                <BadgeCheck className="h-4 w-4" />
                {verifiedInBank ? "Verificado en Banco" : "Verificar en Banco"}
              </Button>

              <Separator />

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className={`w-full ${components.button.base} flex items-center justify-center ${spacing.gap.small}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Eliminar Pago
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar este pago?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Estás a punto de eliminar el pago <strong>{record.invoiceNumber}</strong>.
                      Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteRecord}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Eliminando...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </>
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Document Viewer Dialog */}
        <Dialog open={!!viewingDocument} onOpenChange={(open) => !open && setViewingDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            <DialogHeader className="p-4 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2">
                  {viewingDocument &&
                    (() => {
                      const FileIcon = getFileIcon(viewingDocument.name);
                      const fileType = getFileType(viewingDocument.name);
                      return (
                        <>
                          <FileIcon
                            className={cn(
                              "h-5 w-5",
                              fileType === "image" ? "text-green-600" : "text-red-600"
                            )}
                          />
                          {viewingDocument.name}
                        </>
                      );
                    })()}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  {viewingDocument?.url && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={viewingDocument.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir en nueva pestaña
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-auto bg-muted/30 flex items-center justify-center min-h-[400px] max-h-[calc(90vh-80px)]">
              {viewingDocument?.url && getFileType(viewingDocument.name) === "image" && (
                <img
                  src={viewingDocument.url}
                  alt={viewingDocument.name}
                  className="max-w-full max-h-full object-contain"
                />
              )}
              {viewingDocument?.url && getFileType(viewingDocument.name) === "pdf" && (
                <div className="w-full h-full min-h-[500px] flex flex-col">
                  {/* Usar object con embed como fallback para mejor compatibilidad con PDFs */}
                  <object
                    data={viewingDocument.url}
                    type="application/pdf"
                    className="w-full flex-1 min-h-[500px]"
                  >
                    {/* Fallback si object no funciona */}
                    <embed
                      src={viewingDocument.url}
                      type="application/pdf"
                      className="w-full h-full min-h-[500px]"
                    />
                  </object>
                  {/* Mensaje de ayuda y botón alternativo */}
                  <div className="bg-muted/50 p-3 text-center border-t">
                    <p className="text-sm text-muted-foreground mb-2">¿No puedes ver el PDF?</p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={viewingDocument.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Abrir PDF en nueva pestaña
                      </a>
                    </Button>
                  </div>
                </div>
              )}
              {(!viewingDocument?.url || getFileType(viewingDocument?.name || "") === "other") && (
                <div className="text-center text-muted-foreground p-8">
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p>No se puede previsualizar este archivo</p>
                  {viewingDocument?.url && (
                    <Button variant="outline" className="mt-4" asChild>
                      <a href={viewingDocument.url} target="_blank" rel="noopener noreferrer">
                        Descargar archivo
                      </a>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Verify Payment Dialog */}
        <VerifyPaymentDialog
          isOpen={isVerifyDialogOpen}
          onOpenChange={setIsVerifyDialogOpen}
          payment={
            record
              ? ({
                  ...record,
                  receiptNumber: record.invoiceNumber || record.receiptId || "",
                  verifiedInBank,
                } as any)
              : null
          }
          verifierUserId="system" // Auth layer removed; system user used for audit trail
          onSuccess={() => {
            setVerifiedInBank(true);
            toast.success("Pago verificado correctamente");
          }}
        />

        {/* Footer Fixed */}
        <footer className="fixed bottom-0 left-0 w-full border-t bg-background/80 p-4 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-7xl px-6">
            <Button
              onClick={handleSaveChanges}
              disabled={isSaving}
              className={`w-full ${components.button.base} flex items-center justify-center py-3.5 text-base font-bold shadow-lg`}
              style={{
                boxShadow: `0 10px 15px -3px ${colors.primary}30, 0 4px 6px -2px ${colors.primary}20`,
              }}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </div>
        </footer>
      </div>
    </AdminLayout>
  );
}
