"use client";

import { Car, User, Calendar, AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { Progress } from "@/components_shadcn/ui/progress";
import { typography, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { FinancingCard as FinancingCardType } from "@/lib/financing";

interface FinancingCardProps {
  financing: FinancingCardType;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

type FinancingStatus = "activo" | "inactivo" | "en_mora" | "completado";

const statusConfig: Record<FinancingStatus, {
  label: string;
  icon: typeof CheckCircle2;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  activo: {
    label: "Activo",
    icon: CheckCircle2,
    bgColor: "bg-green-50 dark:bg-green-950/30",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
  },
  inactivo: {
    label: "Inactivo",
    icon: XCircle,
    bgColor: "bg-gray-50 dark:bg-gray-950/30",
    textColor: "text-gray-700 dark:text-gray-400",
    borderColor: "border-gray-200 dark:border-gray-800",
  },
  en_mora: {
    label: "En Mora",
    icon: AlertTriangle,
    bgColor: "bg-red-50 dark:bg-red-950/30",
    textColor: "text-red-700 dark:text-red-400",
    borderColor: "border-red-200 dark:border-red-800",
  },
  completado: {
    label: "Completado",
    icon: CheckCircle2,
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    textColor: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
  },
};

const frequencyLabels: Record<string, string> = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

export function FinancingCard({
  financing,
  onClick,
  className,
  compact = false,
}: FinancingCardProps) {
  const status = (financing.status as FinancingStatus) || "activo";
  const config = statusConfig[status] || statusConfig.activo;
  const StatusIcon = config.icon;

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
      return new Date(dateString).toLocaleDateString("es-PA", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const progressPercentage = financing.totalQuotas > 0 
    ? (financing.paidQuotas / financing.totalQuotas) * 100 
    : 0;

  const pendingQuotas = financing.totalQuotas - financing.paidQuotas;

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
          <p className={cn(typography.body.large, "truncate")}>
            {financing.financingNumber}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {financing.vehicleName || "Sin vehículo"} • {financing.clientName || "Sin cliente"}
          </p>
        </div>
        <div className="text-right">
          <p className={cn(typography.body.large)}>{formatCurrency(financing.currentBalance)}</p>
          <p className="text-xs text-muted-foreground">{financing.paidQuotas}/{financing.totalQuotas} cuotas</p>
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
                {financing.financingNumber}
              </p>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs mt-1",
                  config.bgColor,
                  config.textColor,
                  config.borderColor
                )}
              >
                {config.label}
              </Badge>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">
            {frequencyLabels[financing.paymentFrequency] || financing.paymentFrequency}
          </Badge>
        </div>

        {/* Info */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Car className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{financing.vehicleName || "Sin vehículo asignado"}</span>
            {financing.vehiclePlaca && (
              <Badge variant="outline" className="text-xs ml-auto">
                {financing.vehiclePlaca}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{financing.clientName || "Sin cliente asignado"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span>Próximo vencimiento: {formatDate(financing.nextDueDate)}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso</span>
            <span className={typography.body.base}>
              {financing.paidQuotas} de {financing.totalQuotas} cuotas ({progressPercentage.toFixed(1)}%)
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Financial Summary */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Cuota</p>
            <p className={cn(typography.body.large, "font-semibold")}>
              {formatCurrency(financing.quotaAmount)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo Pendiente</p>
            <p className={cn(typography.body.large, "font-semibold")}>
              {formatCurrency(financing.currentBalance)}
            </p>
          </div>
        </div>

        {/* Mora indicator */}
        {status === "en_mora" && financing.totalLateFees > 0 && (
          <div className={cn(
            "mt-3 p-2 rounded-lg flex items-center gap-2",
            "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
          )}>
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span className="text-xs text-red-700 dark:text-red-400">
              Multas acumuladas: {formatCurrency(financing.totalLateFees)}
            </span>
          </div>
        )}

        {/* Pending quotas indicator */}
        {pendingQuotas > 0 && pendingQuotas <= 5 && status !== "en_mora" && (
          <div className={cn(
            "mt-3 p-2 rounded-lg flex items-center gap-2",
            "bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800"
          )}>
            <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs text-yellow-700 dark:text-yellow-400">
              Solo {pendingQuotas} cuota{pendingQuotas > 1 ? "s" : ""} restante{pendingQuotas > 1 ? "s" : ""}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FinancingCard;
