"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  Banknote,
  Calendar,
  Search,
  Loader2,
  FileText,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Hash,
  CreditCard,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import { Calendar as CalendarComponent } from "@/components_shadcn/ui/calendar";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Separator } from "@/components_shadcn/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components_shadcn/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components_shadcn/ui/command";
import { Badge } from "@/components_shadcn/ui/badge";
import { Progress } from "@/components_shadcn/ui/progress";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { spacing, typography, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import {
  calculateLateFee,
  calculateDaysLate,
  processPayment,
  type FinancingCard,
} from "@/lib/financing";

// Tipos
export interface FinancingOption {
  documentId: string;
  financingNumber: string;
  vehicleName: string;
  vehiclePlaca?: string;
  clientName: string;
  quotaAmount: number;
  paidQuotas: number;
  totalQuotas: number;
  currentBalance: number;
  nextDueDate: string;
  partialPaymentCredit: number;
  lateFeePercentage: number;
  status: string;
}

export interface CreatePaymentFormData {
  financingId: string;
  financingNumber: string;
  amount: number;
  paymentDate: string;
  confirmationNumber: string;
  notes: string;
}

interface CreatePaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedFinancing?: FinancingOption | null;
  onSuccess?: () => void;
}

export function CreatePaymentDialog({
  isOpen,
  onOpenChange,
  preselectedFinancing,
  onSuccess,
}: CreatePaymentDialogProps) {
  // Estado del formulario
  const [formData, setFormData] = useState<CreatePaymentFormData>({
    financingId: "",
    financingNumber: "",
    amount: 0,
    paymentDate: new Date().toISOString().split("T")[0],
    confirmationNumber: "",
    notes: "",
  });

  // Estados de UI
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Financiamientos
  const [financings, setFinancings] = useState<FinancingOption[]>([]);
  const [isLoadingFinancings, setIsLoadingFinancings] = useState(false);
  const [financingSearchOpen, setFinancingSearchOpen] = useState(false);
  const [selectedFinancing, setSelectedFinancing] = useState<FinancingOption | null>(null);

  // Cargar financiamientos activos
  useEffect(() => {
    if (!isOpen) return;

    // Si hay financiamiento preseleccionado, usarlo (siempre actualizar para tener datos frescos)
    if (preselectedFinancing) {
      setSelectedFinancing(preselectedFinancing);
      setFormData((prev) => ({
        ...prev,
        financingId: preselectedFinancing.documentId,
        financingNumber: preselectedFinancing.financingNumber,
      }));
      return;
    }

    const loadFinancings = async () => {
      setIsLoadingFinancings(true);
      try {
        const response = await fetch("/api/financing");
        if (response.ok) {
          const data = await response.json();
          // Filtrar solo financiamientos activos o en mora
          const activeFinancings: FinancingOption[] = (data.data || [])
            .filter((f: FinancingCard) => f.status === "activo" || f.status === "en_mora")
            .map((f: FinancingCard) => ({
              documentId: f.documentId,
              financingNumber: f.financingNumber,
              vehicleName: f.vehicleName || "Sin vehículo",
              vehiclePlaca: f.vehiclePlaca,
              clientName: f.clientName || "Sin cliente",
              quotaAmount: f.quotaAmount,
              paidQuotas: f.paidQuotas,
              totalQuotas: f.totalQuotas,
              currentBalance: f.currentBalance,
              nextDueDate: f.nextDueDate,
              partialPaymentCredit: f.partialPaymentCredit || 0,
              lateFeePercentage: f.lateFeePercentage || 10,
              status: f.status,
            }));
          setFinancings(activeFinancings);
        }
      } catch (err) {
        console.error("Error loading financings:", err);
      } finally {
        setIsLoadingFinancings(false);
      }
    };

    loadFinancings();
  }, [isOpen, preselectedFinancing]);

  // Refrescar datos del financiamiento seleccionado cuando se abre el dialog
  // Esto asegura que el crédito a favor y otros valores estén actualizados
  useEffect(() => {
    if (!isOpen || !selectedFinancing) return;

    const refreshFinancing = async () => {
      try {
        const response = await fetch(`/api/financing/${selectedFinancing.documentId}`);
        if (response.ok) {
          const data = await response.json();
          const freshFinancing = data.data;
          if (freshFinancing) {
            setSelectedFinancing({
              ...selectedFinancing,
              partialPaymentCredit: freshFinancing.partialPaymentCredit || 0,
              paidQuotas: freshFinancing.paidQuotas || 0,
              totalQuotas: freshFinancing.totalQuotas || 0,
              currentBalance: freshFinancing.currentBalance || 0,
              nextDueDate: freshFinancing.nextDueDate,
              lateFeePercentage: freshFinancing.lateFeePercentage || 10,
              status: freshFinancing.status,
            });
          }
        }
      } catch (err) {
        console.error("Error refreshing financing data:", err);
        // No mostrar error al usuario, usar datos que ya tenemos
      }
    };

    refreshFinancing();
  }, [isOpen, selectedFinancing?.documentId]);

  // Cálculos basados en el financiamiento seleccionado
  const paymentCalculations = useMemo(() => {
    // Permitir montos negativos para ajustes/devoluciones
    if (!selectedFinancing || formData.amount === 0) {
      return {
        daysLate: 0,
        lateFeeAmount: 0,
        quotasCovered: 0,
        advanceCredit: 0,
        totalApplied: 0,
        isLate: false,
        status: "pendiente" as const,
      };
    }

    const daysLate = calculateDaysLate(
      selectedFinancing.nextDueDate,
      formData.paymentDate
    );

    const isLate = daysLate > 0;

    // Calcular multa si aplica
    const pendingQuotaAmount = selectedFinancing.quotaAmount - selectedFinancing.partialPaymentCredit;
    const lateFeeAmount = isLate
      ? calculateLateFee(pendingQuotaAmount, daysLate, selectedFinancing.lateFeePercentage)
      : 0;

    // Procesar pago (considerando crédito previo)
    const { quotasCovered, advanceCredit, totalApplied } = processPayment(
      formData.amount,
      selectedFinancing.quotaAmount,
      selectedFinancing.partialPaymentCredit
    );

    // Determinar estado
    let status: "pagado" | "adelanto" | "retrasado" | "pendiente" = "pagado";
    if (isLate) {
      status = "retrasado";
    } else if (quotasCovered > 1 || advanceCredit > 0) {
      status = "adelanto";
    }

    return {
      daysLate,
      lateFeeAmount,
      quotasCovered,
      advanceCredit,
      totalApplied,
      isLate,
      status,
    };
  }, [selectedFinancing, formData.amount, formData.paymentDate]);

  // Validación del formulario (permitir montos negativos para ajustes)
  const isFormValid = useMemo(() => {
    return (
      formData.financingId !== "" &&
      formData.amount !== 0 &&
      formData.paymentDate !== ""
    );
  }, [formData]);

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      financingId: "",
      financingNumber: "",
      amount: 0,
      paymentDate: new Date().toISOString().split("T")[0],
      confirmationNumber: "",
      notes: "",
    });
    setSelectedFinancing(null);
    setError(null);
  };

  // Manejar cierre del diálogo
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  // Seleccionar financiamiento
  const handleSelectFinancing = (financing: FinancingOption) => {
    setSelectedFinancing(financing);
    setFormData((prev) => ({
      ...prev,
      financingId: financing.documentId,
      financingNumber: financing.financingNumber,
      amount: financing.quotaAmount, // Pre-llenar con el monto de cuota
    }));
    setFinancingSearchOpen(false);
  };

  // Crear pago
  const handleCreate = async () => {
    if (!isFormValid || !selectedFinancing) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            financing: formData.financingId,
            amount: formData.amount,
            paymentDate: formData.paymentDate,
            dueDate: selectedFinancing.nextDueDate,
            confirmationNumber: formData.confirmationNumber || undefined,
            notes: formData.notes || undefined,
            status: paymentCalculations.status,
            quotaNumber: selectedFinancing.paidQuotas + 1,
            quotasCovered: paymentCalculations.quotasCovered,
            advanceCredit: paymentCalculations.advanceCredit,
            daysLate: paymentCalculations.daysLate,
            lateFeeAmount: paymentCalculations.lateFeeAmount,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al registrar el pago");
      }

      // Éxito
      onSuccess?.();
      handleOpenChange(false);
    } catch (err) {
      console.error("Error creating payment:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsCreating(false);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(new Date(`${dateString}T00:00:00`), "d 'de' MMMM, yyyy", {
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Registrar Pago</DialogTitle>
          <DialogDescription>
            Registra un nuevo pago asociado a un financiamiento activo.
          </DialogDescription>
        </DialogHeader>

        <ScrollAreaPrimitive.Root className="relative flex-1 min-h-0 overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
            <div className="px-6">
              <div className={`flex flex-col ${spacing.gap.medium} py-6`}>
                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    {error}
                  </div>
                )}

                {/* Selección de Financiamiento */}
                {!preselectedFinancing && (
                  <>
                    <div className={`flex flex-col ${spacing.gap.base}`}>
                      <h3 className={`${typography.h4} flex items-center gap-2`}>
                        <CreditCard className="h-4 w-4" />
                        Financiamiento
                      </h3>

                      <Popover
                        open={financingSearchOpen}
                        onOpenChange={setFinancingSearchOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between h-14 rounded-lg",
                              !formData.financingNumber && "text-muted-foreground"
                            )}
                          >
                            {formData.financingNumber ? (
                              <div className="flex items-center gap-3">
                                <Receipt className="h-5 w-5 text-primary" />
                                <div className="text-left">
                                  <p className={typography.body.large}>
                                    {formData.financingNumber}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {selectedFinancing?.vehicleName} •{" "}
                                    {selectedFinancing?.clientName}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Search className="h-4 w-4" />
                                <span>Buscar financiamiento...</span>
                              </div>
                            )}
                            {isLoadingFinancings && (
                              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[500px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Buscar por número, vehículo o cliente..." />
                            <CommandList>
                              <CommandEmpty>
                                No se encontraron financiamientos activos.
                              </CommandEmpty>
                              <CommandGroup heading="Financiamientos Activos">
                                {financings.map((fin) => (
                                  <CommandItem
                                    key={fin.documentId}
                                    value={`${fin.financingNumber} ${fin.vehicleName} ${fin.clientName}`}
                                    onSelect={() => handleSelectFinancing(fin)}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex items-center gap-3 w-full">
                                      <Receipt className="h-5 w-5 text-muted-foreground" />
                                      <div className="flex flex-col flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className={typography.body.large}>
                                            {fin.financingNumber}
                                          </span>
                                          <Badge
                                            variant={
                                              fin.status === "en_mora"
                                                ? "destructive"
                                                : "secondary"
                                            }
                                            className="text-xs"
                                          >
                                            {fin.status === "en_mora"
                                              ? "En mora"
                                              : "Activo"}
                                          </Badge>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                          {fin.vehicleName}
                                          {fin.vehiclePlaca && ` (${fin.vehiclePlaca})`} •{" "}
                                          {fin.clientName}
                                        </span>
                                      </div>
                                      <div className="text-right">
                                        <p className="text-sm font-semibold">
                                          {formatCurrency(fin.quotaAmount)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {fin.paidQuotas}/{fin.totalQuotas} cuotas
                                        </p>
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                    <Separator />
                  </>
                )}

                {/* Info del Financiamiento Seleccionado */}
                {selectedFinancing && (
                  <>
                    <Card className={cn(components.card, "bg-muted/30")}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className={typography.body.large}>
                              {selectedFinancing.financingNumber}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {selectedFinancing.vehicleName} •{" "}
                              {selectedFinancing.clientName}
                            </p>
                          </div>
                          <Badge
                            variant={
                              selectedFinancing.status === "en_mora"
                                ? "destructive"
                                : "default"
                            }
                          >
                            {selectedFinancing.status === "en_mora"
                              ? "En Mora"
                              : "Activo"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Cuota</p>
                            <p className={typography.body.large}>
                              {formatCurrency(selectedFinancing.quotaAmount)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Próximo Vencimiento
                            </p>
                            <p className={typography.body.large}>
                              {formatDate(selectedFinancing.nextDueDate)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Saldo</p>
                            <p className={typography.body.large}>
                              {formatCurrency(selectedFinancing.currentBalance)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Progreso</span>
                            <span>
                              {selectedFinancing.paidQuotas} de{" "}
                              {selectedFinancing.totalQuotas} cuotas
                            </span>
                          </div>
                          <Progress
                            value={
                              (selectedFinancing.paidQuotas /
                                selectedFinancing.totalQuotas) *
                              100
                            }
                            className="h-2"
                          />
                        </div>

                        {selectedFinancing.partialPaymentCredit > 0 && (
                          <div className="mt-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              Crédito a favor:{" "}
                              {formatCurrency(selectedFinancing.partialPaymentCredit)}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Separator />
                  </>
                )}

                {/* Datos del Pago */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={`${typography.h4} flex items-center gap-2`}>
                    <Banknote className="h-4 w-4" />
                    Datos del Pago
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="amount" className={typography.label}>
                        Monto a Pagar *
                      </Label>
                      <div className="relative">
                        <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="amount"
                          type="number"
                          step={0.01}
                          value={formData.amount || ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              amount: parseFloat(e.target.value) || 0,
                            }))
                          }
                          placeholder="0.00"
                          className="rounded-lg pl-10"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label className={typography.label}>Fecha de Pago *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10 pl-3 rounded-lg",
                              !formData.paymentDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {formData.paymentDate
                              ? formatDate(formData.paymentDate)
                              : "Selecciona una fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-[200]" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={
                              formData.paymentDate
                                ? new Date(`${formData.paymentDate}T00:00:00`)
                                : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                const y = date.getFullYear();
                                const m = String(date.getMonth() + 1).padStart(2, "0");
                                const d = String(date.getDate()).padStart(2, "0");
                                setFormData((prev) => ({
                                  ...prev,
                                  paymentDate: `${y}-${m}-${d}`,
                                }));
                              }
                            }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="confirmationNumber" className={typography.label}>
                      Número de Confirmación
                    </Label>
                    <Input
                      id="confirmationNumber"
                      value={formData.confirmationNumber}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          confirmationNumber: e.target.value,
                        }))
                      }
                      placeholder="Ej: 1234567890"
                      className="rounded-lg"
                    />
                  </div>
                </div>

                {/* Cálculos del Pago / Ajuste */}
                {selectedFinancing && formData.amount !== 0 && (
                  <>
                    <Separator />
                    <div className={`flex flex-col ${spacing.gap.base}`}>
                      <h3 className={`${typography.h4} flex items-center gap-2`}>
                        <Hash className="h-4 w-4" />
                        {formData.amount < 0 ? "Ajuste / Devolución" : "Resumen del Pago"}
                      </h3>

                      <div className="grid grid-cols-2 gap-4">
                        <Card
                          className={cn(
                            "p-4",
                            formData.amount < 0
                              ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                              : paymentCalculations.isLate
                                ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                                : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {formData.amount < 0 ? (
                              <MinusCircle className="h-4 w-4 text-amber-600" />
                            ) : paymentCalculations.isLate ? (
                              <AlertTriangle className="h-4 w-4 text-red-600" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            )}
                            <span
                              className={cn(
                                "text-sm font-medium",
                                formData.amount < 0
                                  ? "text-amber-700 dark:text-amber-400"
                                  : paymentCalculations.isLate
                                    ? "text-red-700 dark:text-red-400"
                                    : "text-green-700 dark:text-green-400"
                              )}
                            >
                              {formData.amount < 0
                                ? "Ajuste Negativo"
                                : paymentCalculations.isLate
                                  ? `${paymentCalculations.daysLate} día${paymentCalculations.daysLate > 1 ? "s" : ""} de atraso`
                                  : "Pago a tiempo"}
                            </span>
                          </div>
                          {formData.amount < 0 ? (
                            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              Monto: {formatCurrency(formData.amount)}
                            </p>
                          ) : paymentCalculations.isLate && (
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                              Multa: {formatCurrency(paymentCalculations.lateFeeAmount)}
                            </p>
                          )}
                        </Card>

                        <Card className="p-4 bg-muted/50">
                          <p className="text-xs text-muted-foreground mb-1">
                            {formData.amount < 0 ? "Tipo de Ajuste" : "Cuotas Cubiertas"}
                          </p>
                          <p className={cn(typography.metric.base, "text-primary")}>
                            {formData.amount < 0 ? "Devolución/Ajuste" : paymentCalculations.quotasCovered}
                          </p>
                          {formData.amount >= 0 && paymentCalculations.advanceCredit > 0 && (
                            <p className="text-xs text-blue-600 mt-1">
                              + {formatCurrency(paymentCalculations.advanceCredit)} de
                              crédito
                            </p>
                          )}
                        </Card>
                      </div>

                      <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground">
                            {formData.amount < 0 ? "Tipo de Registro" : "Estado del Pago"}
                          </p>
                          <Badge
                            variant={
                              formData.amount < 0
                                ? "outline"
                                : paymentCalculations.status === "retrasado"
                                  ? "destructive"
                                  : paymentCalculations.status === "adelanto"
                                    ? "default"
                                    : "secondary"
                            }
                            className="text-sm"
                          >
                            {formData.amount < 0
                              ? "Ajuste"
                              : paymentCalculations.status === "pagado" && "Pagado"}
                            {formData.amount >= 0 && paymentCalculations.status === "adelanto" && "Adelanto"}
                            {formData.amount >= 0 && paymentCalculations.status === "retrasado" && "Retrasado"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                {/* Notas */}
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={`${typography.h4} flex items-center gap-2`}>
                    <FileText className="h-4 w-4" />
                    Notas (opcional)
                  </h3>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    placeholder="Notas adicionales sobre el pago..."
                    rows={2}
                    className="rounded-lg resize-none"
                  />
                </div>
              </div>
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.ScrollAreaScrollbar
            orientation="vertical"
            className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
          </ScrollAreaPrimitive.ScrollAreaScrollbar>
        </ScrollAreaPrimitive.Root>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isCreating}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !isFormValid}
            className={cn(
              "font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              !isCreating &&
                isFormValid &&
                "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 !opacity-100",
              (isCreating || !isFormValid) && "!opacity-50 cursor-not-allowed"
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              "Registrar Pago"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreatePaymentDialog;
