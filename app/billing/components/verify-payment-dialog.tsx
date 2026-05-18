"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  BadgeCheck,
  Loader2,
  Banknote,
  Calendar,
  FileText,
  Receipt,
  AlertTriangle,
  User,
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
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Label } from "@/components_shadcn/ui/label";
import { Separator } from "@/components_shadcn/ui/separator";
import { Badge } from "@/components_shadcn/ui/badge";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import { spacing, typography, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { BillingRecordCard } from "@/lib/billing";

interface VerifyPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  payment: BillingRecordCard | null;
  verifierUserId: string; // ID del admin que verifica
  onSuccess?: () => void;
}

export function VerifyPaymentDialog({
  isOpen,
  onOpenChange,
  payment,
  verifierUserId,
  onSuccess,
}: VerifyPaymentDialogProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "-";
    try {
      return format(new Date(`${dateString}T00:00:00`), "d 'de' MMMM, yyyy", {
        locale: es,
      });
    } catch {
      return dateString;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setError(null);
      setVerificationNotes("");
    }
    onOpenChange(open);
  };

  const handleVerify = async () => {
    if (!payment) return;

    setIsVerifying(true);
    setError(null);

    try {
      const response = await fetch(`/api/billing/${payment.documentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          verifiedBy: verifierUserId,
          verificationNotes: verificationNotes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al verificar el pago");
      }

      onSuccess?.();
      handleOpenChange(false);
    } catch (err) {
      console.error("Error verifying payment:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsVerifying(false);
    }
  };

  if (!payment) return null;

  const statusConfig = {
    pagado: {
      label: "Pagado",
      bgColor: "bg-green-50 dark:bg-green-950/30",
      textColor: "text-green-700 dark:text-green-400",
    },
    pendiente: {
      label: "Pendiente",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
      textColor: "text-yellow-700 dark:text-yellow-400",
    },
    adelanto: {
      label: "Adelanto",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
      textColor: "text-blue-700 dark:text-blue-400",
    },
    retrasado: {
      label: "Retrasado",
      bgColor: "bg-red-50 dark:bg-red-950/30",
      textColor: "text-red-700 dark:text-red-400",
    },
    abonado: {
      label: "Abonado",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
      textColor: "text-purple-700 dark:text-purple-400",
    },
  };

  const status = (payment.status as keyof typeof statusConfig) || "pendiente";
  const config = statusConfig[status];

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className={cn(typography.h2, "flex items-center gap-2")}>
            <BadgeCheck className="h-6 w-6 text-primary" />
            Verificar Pago
          </DialogTitle>
          <DialogDescription className="mt-1.5">
            Confirma que este pago ha sido verificado en el sistema bancario.
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Ya verificado */}
          {payment.verifiedInBank && (
            <Alert className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <BadgeCheck className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700 dark:text-green-400">
                Este pago ya fue verificado
                {payment.verifiedAt && ` el ${formatDate(payment.verifiedAt)}`}
              </AlertDescription>
            </Alert>
          )}

          {/* Detalles del Pago */}
          <Card className={cn(components.card, "overflow-hidden")}>
            <CardContent className="p-5 space-y-5">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className={cn(typography.body.large, "font-semibold")}>{payment.receiptNumber}</p>
                  {payment.financingNumber && (
                    <p className="text-sm text-muted-foreground">
                      Financiamiento: {payment.financingNumber}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={cn("text-xs px-3 py-1", config.bgColor, config.textColor)}
                >
                  {config.label}
                </Badge>
              </div>

              <Separator />

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-5">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Monto</p>
                    <p className={cn(typography.body.large, "font-medium")}>
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs text-muted-foreground">Fecha de Pago</p>
                    <p className={cn(typography.body.large, "font-medium")}>
                      {formatDate(payment.paymentDate)}
                    </p>
                  </div>
                </div>

                {payment.confirmationNumber && (
                  <div className="flex items-start gap-3 col-span-2">
                    <div className="mt-0.5">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        # Confirmación
                      </p>
                      <p className={cn(typography.body.large, "font-mono font-medium")}>
                        {payment.confirmationNumber}
                      </p>
                    </div>
                  </div>
                )}

                {payment.clientName && (
                  <div className="flex items-start gap-3 col-span-2">
                    <div className="mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Cliente</p>
                      <p className={cn(typography.body.large, "font-medium")}>{payment.clientName}</p>
                    </div>
                  </div>
                )}

                {/* Cuotas restantes por pagar */}
                {payment.financingTotalQuotas && (
                  <div className="flex items-start gap-3 col-span-2">
                    <div className="mt-0.5">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">Cuotas restantes por pagar</p>
                      <p className={cn(typography.body.large, "font-medium")}>
                        {(() => {
                          const totalQuotas = payment.financingTotalQuotas || 0;
                          const paidQuotas = payment.financingPaidQuotas || 0;
                          const quotasCovered = payment.quotasCovered || 0;
                          const remainingQuotas = Math.max(0, totalQuotas - paidQuotas - quotasCovered);
                          return (
                            <span>
                              {remainingQuotas} de {totalQuotas}
                              {quotasCovered > 1 && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  (incluye {quotasCovered} cuotas cubiertas por este pago)
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Multa si aplica */}
              {payment.lateFeeAmount && payment.lateFeeAmount > 0 && (
                <>
                  <Separator />
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-red-600" />
                        <span className="text-sm text-red-700 dark:text-red-400">
                          {payment.daysLate} día
                          {payment.daysLate !== 1 ? "s" : ""} de atraso
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                        +{formatCurrency(payment.lateFeeAmount)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Notas de Verificación */}
          {!payment.verifiedInBank && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="verificationNotes" className={cn(typography.label, "flex items-center gap-1.5")}>
                <FileText className="h-4 w-4" />
                Notas de Verificación (opcional)
              </Label>
              <Textarea
                id="verificationNotes"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Añade notas sobre la verificación bancaria..."
                rows={2}
                className="rounded-lg resize-none"
              />
            </div>
          )}
        </div>

        <Separator />

        <DialogFooter className="px-6 py-4 bg-muted/30">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isVerifying}
            className="min-w-[100px]"
          >
            {payment.verifiedInBank ? "Cerrar" : "Cancelar"}
          </Button>
          {!payment.verifiedInBank && (
            <Button
              onClick={handleVerify}
              disabled={isVerifying}
              className="gap-2 min-w-[180px]"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  Confirmar Verificación
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default VerifyPaymentDialog;
