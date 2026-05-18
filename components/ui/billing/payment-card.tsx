"use client";

import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Banknote,
  FileText,
  Calendar,
  BadgeCheck,
  Link as LinkIcon
} from "lucide-react";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { typography, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { BillingRecordCard } from "@/lib/billing";

interface PaymentCardProps {
  payment: BillingRecordCard;
  onClick?: () => void;
  onFinancingClick?: (financingId: string) => void;
  className?: string;
  compact?: boolean;
  showFinancingLink?: boolean;
}

type PaymentStatus = "pagado" | "pendiente" | "adelanto" | "retrasado" | "abonado" | "cubierta";

const statusConfig: Record<PaymentStatus, {
  label: string;
  icon: typeof CheckCircle2;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  pagado: {
    label: "Pagado",
    icon: CheckCircle2,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
  },
  pendiente: {
    label: "Pendiente",
    icon: Clock,
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    textColor: "text-yellow-700 dark:text-yellow-400",
    borderColor: "border-yellow-200 dark:border-yellow-800",
  },
  adelanto: {
    label: "Adelanto",
    icon: Banknote,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
  retrasado: {
    label: "Retrasado",
    icon: AlertTriangle,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
  },
  abonado: {
    label: "Abonado",
    icon: Banknote,
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    textColor: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-200 dark:border-purple-800",
  },
  cubierta: {
    label: "Cubierta",
    icon: CheckCircle2,
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    textColor: "text-emerald-700 dark:text-emerald-400",
    borderColor: "border-emerald-200 dark:border-emerald-800",
  },
};

export function PaymentCard({
  payment,
  onClick,
  onFinancingClick,
  className,
  compact = false,
  showFinancingLink = true,
}: PaymentCardProps) {
  const status = (payment.status as PaymentStatus) || "pendiente";
  const config = statusConfig[status] || statusConfig.pendiente;
  const StatusIcon = config.icon;

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: payment.currency || "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  // Calcular balance pendiente considerando abonos (childRecords)
  const calculatePendingBalance = (): number => {
    const totalAmount = payment.amount || 0;
    const children = payment.childRecords || [];
    
    if (children.length === 0) return totalAmount;
    
    const totalAbonos = children.reduce((sum, child) => {
      const childAmount = child.amount || 0;
      return sum + (childAmount > 0 ? childAmount : 0);
    }, 0);
    
    return Math.max(0, totalAmount - totalAbonos);
  };

  const pendingBalance = calculatePendingBalance();
  const lateFeeAmount = payment.lateFeeAmount || 0;
  const totalToPay = pendingBalance + lateFeeAmount;
  
  // DEBUG
  console.log(`[DEBUG card] ${payment.receiptNumber}: amount=${payment.amount}, children=${payment.childRecords?.length}, pendingBalance=${pendingBalance}, lateFee=${lateFeeAmount}, totalToPay=${totalToPay}`);

  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString("es-PA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const handleFinancingClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (payment.financingId && onFinancingClick) {
      onFinancingClick(payment.financingId);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
          config.bgColor,
          config.borderColor,
          className
        )}
        onClick={onClick}
      >
        <div className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center",
          config.bgColor,
          "border",
          config.borderColor
        )}>
          <StatusIcon className={cn("h-4 w-4", config.textColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn(typography.body.large, "truncate")}>
              {payment.receiptNumber}
            </p>
            {payment.quotaNumber && (
              <Badge variant="outline" className="text-xs">
                Cuota #{payment.quotaNumber}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatDate(payment.paymentDate || payment.dueDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <p className={cn(typography.body.large)}>
            {payment.status === 'abonado' ? formatCurrency(pendingBalance) : formatCurrency(payment.amount)}
          </p>
          {payment.verifiedInBank && (
            <BadgeCheck className="h-4 w-4 text-green-600" />
          )}
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        components.card,
        "cursor-pointer transition-all hover:shadow-md",
        onClick && "hover:border-primary/50",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              config.bgColor,
              "border",
              config.borderColor
            )}>
              <StatusIcon className={cn("h-5 w-5", config.textColor)} />
            </div>
            <div>
              <p className={cn(typography.body.large, "font-semibold")}>
                {payment.receiptNumber}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs",
                    config.bgColor,
                    config.textColor,
                    config.borderColor
                  )}
                >
                  {config.label}
                </Badge>
                {payment.quotaNumber && (
                  <Badge variant="secondary" className="text-xs">
                    Cuota #{payment.quotaNumber}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Verificación */}
          {payment.verifiedInBank ? (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <BadgeCheck className="h-5 w-5" />
              <span className="text-xs">Verificado</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
              <Clock className="h-4 w-4" />
              <span className="text-xs">Pendiente</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Fecha de pago: {formatDate(payment.paymentDate)}</span>
          </div>
          {payment.dueDate && (
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Fecha de vencimiento: {formatDate(payment.dueDate)}</span>
            </div>
          )}
          {payment.confirmationNumber && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>Confirmación: {payment.confirmationNumber}</span>
            </div>
          )}
        </div>

        {/* Financial Summary - Monto a pagar (principal) */}
        <div className="pt-3 border-t">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">
                {lateFeeAmount > 0 ? "Total a pagar (incluye penalidad)" : "Monto a pagar"}
              </p>
              <p className={cn(typography.h4, "font-bold text-primary")}>
                {formatCurrency(totalToPay)}
              </p>
            </div>
            {/* Mostrar monto original tachado si es diferente */}
            {totalToPay !== payment.amount && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Monto cuota</p>
                <p className="text-sm line-through text-muted-foreground">
                  {formatCurrency(payment.amount)}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Detalle desglosado - SIEMPRE visible */}
        <div className="mt-3 pt-3 border-t border-dashed space-y-1">
          {/* Monto cuota siempre */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">Monto cuota</span>
            <span>{formatCurrency(payment.amount)}</span>
          </div>
          
          {/* Si tiene abonos, mostrar */}
          {payment.childRecords && payment.childRecords.length > 0 && (
            <>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Abonado</span>
                <span className="text-green-600">-{formatCurrency(payment.amount - pendingBalance)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Pendiente base</span>
                <span>{formatCurrency(pendingBalance)}</span>
              </div>
            </>
          )}
          
          {/* Late fee si aplica */}
          {lateFeeAmount > 0 && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
                <span className="text-red-700 dark:text-red-400">
                  Penalidad ({payment.daysLate} día{payment.daysLate !== 1 ? "s" : ""} × 10%)
                </span>
              </div>
              <span className="font-medium text-red-700 dark:text-red-400">
                +{formatCurrency(lateFeeAmount)}
              </span>
            </div>
          )}
          
          {/* Total resaltado */}
          <div className="flex justify-between items-center pt-2 border-t mt-2">
            <span className="font-semibold">Total a pagar ahora</span>
            <span className={cn(typography.body.large, "font-bold text-primary")}>
              {formatCurrency(totalToPay)}
            </span>
          </div>
        </div>

        {/* Advance credit indicator */}
        {payment.advanceCredit && payment.advanceCredit > 0 && (
          <div className={cn(
            "mt-3 p-2 rounded-lg flex items-center justify-between",
            "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
          )}>
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-700 dark:text-blue-400">
                Crédito a favor
              </span>
            </div>
            <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
              {formatCurrency(payment.advanceCredit)}
            </span>
          </div>
        )}

        {/* Financing Link */}
        {showFinancingLink && payment.financingNumber && (
          <button
            className={cn(
              "mt-3 w-full p-2 rounded-lg flex items-center justify-between",
              "bg-muted/50 hover:bg-muted transition-colors text-left"
            )}
            onClick={handleFinancingClick}
          >
            <div className="flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Financiamiento:</span>
              <span className="text-xs font-medium">{payment.financingNumber}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              Ver
            </Badge>
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default PaymentCard;
