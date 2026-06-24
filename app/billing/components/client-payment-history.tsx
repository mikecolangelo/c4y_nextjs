"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  User,
  ChevronRight,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Banknote,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { Avatar, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { ScrollArea } from "@/components_shadcn/ui/scroll-area";
import { Separator } from "@/components_shadcn/ui/separator";
import { Progress } from "@/components_shadcn/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components_shadcn/ui/dialog";
import { typography, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { BillingRecordCard } from "@/validations/types";

interface ClientPaymentHistoryProps {
  clientDocumentId: string;
  clientName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  pagado: {
    label: "Pagado",
    icon: CheckCircle2,
    tone: "success" as StatusTone,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
  },
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    tone: "warning" as StatusTone,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    textColor: "text-yellow-700 dark:text-yellow-400",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  abonado: {
    label: "Abonado",
    icon: Banknote,
    tone: "info" as StatusTone,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  adelanto: {
    label: "Adelanto",
    icon: Banknote,
    tone: "info" as StatusTone,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  retrasado: {
    label: "Retrasado",
    icon: AlertCircle,
    tone: "danger" as StatusTone,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
  },
};

export function ClientPaymentHistory({
  clientDocumentId,
  clientName,
  isOpen,
  onOpenChange,
}: ClientPaymentHistoryProps) {
  const router = useRouter();
  const [payments, setPayments] = useState<BillingRecordCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadClientPayments = useCallback(async () => {
    if (!clientDocumentId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Cargar todos los pagos y filtrar por cliente
      const response = await fetch("/api/billing");
      if (!response.ok) {
        throw new Error("Error al cargar pagos");
      }

      const data = await response.json();
      const allPayments = data.data || [];

      // Filtrar por cliente
      const clientPayments = allPayments.filter(
        (p: BillingRecordCard) => p.clientDocumentId === clientDocumentId
      );

      // Ordenar por fecha (más reciente primero)
      clientPayments.sort((a: BillingRecordCard, b: BillingRecordCard) => {
        const dateA = new Date(a.paymentDate || a.dueDate || 0);
        const dateB = new Date(b.paymentDate || b.dueDate || 0);
        return dateB.getTime() - dateA.getTime();
      });

      setPayments(clientPayments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [clientDocumentId]);

  useEffect(() => {
    if (isOpen && clientDocumentId) {
      loadClientPayments();
    }
  }, [isOpen, clientDocumentId, loadClientPayments]);

  const formatCurrency = (value: number, currency = "PAB"): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "d MMM yyyy", { locale: es });
    } catch {
      return dateString;
    }
  };

  // Calcular estadísticas
  const stats = {
    total: payments.length,
    pagados: payments.filter((p) => p.status === "pagado").length,
    pendientes: payments.filter((p) => p.status === "pendiente").length,
    adelantos: payments.filter((p) => p.status === "adelanto").length,
    retrasados: payments.filter((p) => p.status === "retrasado").length,
    totalPagado: payments
      .filter((p) => p.status === "pagado" || p.status === "adelanto")
      .reduce((sum, p) => sum + p.amount, 0),
    totalPendiente: payments
      .filter((p) => p.status === "pendiente" || p.status === "retrasado")
      .reduce((sum, p) => sum + p.amount, 0),
  };

  const progressPercentage = stats.total > 0 ? Math.round((stats.pagados / stats.total) * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {getInitials(clientName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className={typography.h3}>Historial de Pagos</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <User className="h-3 w-3" />
                {clientName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-destructive">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={loadClientPayments}>
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Resumen */}
              <Card className={components.card}>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    {/* Progreso */}
                    <div className="flex items-center justify-between">
                      <span className={typography.body.small}>Progreso de pagos</span>
                      <span className={cn(typography.body.large, "font-bold")}>
                        {stats.pagados} / {stats.total} cuotas
                      </span>
                    </div>
                    <Progress value={progressPercentage} className="h-2" />

                    {/* Estadísticas */}
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Total Pagado</p>
                          <p className={cn(typography.body.large, "font-bold text-green-600")}>
                            {formatCurrency(stats.totalPagado)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-yellow-600" />
                        <div>
                          <p className="text-xs text-muted-foreground">Pendiente</p>
                          <p className={cn(typography.body.large, "font-bold text-yellow-600")}>
                            {formatCurrency(stats.totalPendiente)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Badges de estado */}
                    <div className="flex flex-wrap gap-2">
                      {stats.pagados > 0 && (
                        <StatusBadge tone={statusConfig.pagado.tone}>
                          {stats.pagados} pagados
                        </StatusBadge>
                      )}
                      {stats.adelantos > 0 && (
                        <StatusBadge tone={statusConfig.adelanto.tone}>
                          {stats.adelantos} adelantos
                        </StatusBadge>
                      )}
                      {stats.pendientes > 0 && (
                        <StatusBadge tone={statusConfig.pendiente.tone}>
                          {stats.pendientes} pendientes
                        </StatusBadge>
                      )}
                      {stats.retrasados > 0 && (
                        <StatusBadge tone={statusConfig.retrasado.tone}>
                          {stats.retrasados} retrasados
                        </StatusBadge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Lista de pagos */}
              <ScrollArea className="h-[300px] pr-4">
                {payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Banknote className="h-12 w-12 mb-2 opacity-50" />
                    <p className={typography.body.base}>
                      No hay pagos registrados para este cliente
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {payments.map((payment) => {
                      const config = statusConfig[payment.status];
                      const StatusIcon = config.icon;

                      return (
                        <div
                          key={payment.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                            config.bgColor,
                            config.borderColor
                          )}
                          onClick={() => {
                            onOpenChange(false);
                            router.push(`/billing/details/${payment.documentId}`);
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center",
                                config.bgColor,
                                "border",
                                config.borderColor
                              )}
                            >
                              <StatusIcon className={cn("h-4 w-4", config.textColor)} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={typography.body.large}>
                                  {payment.invoiceNumber}
                                </span>
                                {payment.currentQuotaNumber && (
                                  <Badge variant="outline" className="text-xs">
                                    Cuota #{payment.currentQuotaNumber}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {payment.paymentDate
                                  ? `Pagado: ${formatDate(payment.paymentDate)}`
                                  : `Vence: ${formatDate(payment.dueDate)}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(typography.body.large, "font-bold", config.textColor)}
                            >
                              {payment.amountLabel}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
