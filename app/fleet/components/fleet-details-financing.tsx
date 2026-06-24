"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { StatusBadge, type StatusTone } from "@/components/ui";
import { Button } from "@/components_shadcn/ui/button";
import { Progress } from "@/components_shadcn/ui/progress";
import {
  Banknote,
  Calendar,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  CreditCard,
} from "lucide-react";
import { typography, spacing } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import Link from "next/link";

interface FinancingInfo {
  id: number;
  documentId?: string;
  financingNumber?: string;
  status?: string;
  totalAmount?: number;
  paidQuotas?: number;
  totalQuotas?: number;
  quotaAmount?: number;
  currentBalance?: number;
  totalPaid?: number;
  nextDueDate?: string;
  partialPaymentCredit?: number;
}

interface FleetDetailsFinancingCardProps {
  financing?: FinancingInfo;
  vehicleName: string;
}

// Maps each financing status to a shared StatusBadge tone + icon, replacing the
// previous ad-hoc bg/text/border color sets.
const statusConfig: Record<
  string,
  {
    label: string;
    icon: typeof CheckCircle2;
    tone: StatusTone;
  }
> = {
  activo: {
    label: "Activo",
    icon: CheckCircle2,
    tone: "success",
  },
  en_mora: {
    label: "En Mora",
    icon: AlertTriangle,
    tone: "danger",
  },
  completado: {
    label: "Completado",
    icon: CheckCircle2,
    tone: "info",
  },
  inactivo: {
    label: "Inactivo",
    icon: Clock,
    tone: "neutral",
  },
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "PAB",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "No definida";
  try {
    return format(new Date(dateString), "d MMM yyyy", { locale: es });
  } catch {
    return dateString;
  }
};

export function FleetDetailsFinancingCard({
  financing,
  vehicleName,
}: FleetDetailsFinancingCardProps) {
  // Si no hay financiamiento, mostrar estado vacío
  if (!financing) {
    return (
      <Card
        className="shadow-sm backdrop-blur-sm border rounded-lg"
        style={
          {
            backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
            borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
          } as React.CSSProperties
        }
      >
        <CardHeader className="px-6 pt-6 pb-4">
          <CardTitle className={cn(typography.h4, "flex items-center gap-2")}>
            <CreditCard className="h-5 w-5" />
            Financiamiento
          </CardTitle>
        </CardHeader>
        <CardContent
          className={cn(
            "flex flex-col items-center justify-center py-8",
            spacing.gap.base,
            "px-6 pb-6"
          )}
        >
          <Banknote className="h-12 w-12 text-muted-foreground/50" />
          <p className={cn(typography.body.base, "text-muted-foreground text-center")}>
            Este vehículo no tiene un financiamiento activo
          </p>
          <Link href="/billing">
            <Button variant="outline" size="sm" className="mt-2">
              <CreditCard className="h-4 w-4 mr-2" />
              Crear Financiamiento
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const status = financing.status || "activo";
  const config = statusConfig[status] || statusConfig.activo;
  const StatusIcon = config.icon;

  const progressPercentage =
    financing.totalQuotas && financing.paidQuotas
      ? Math.round((financing.paidQuotas / financing.totalQuotas) * 100)
      : 0;

  return (
    <Card
      className="shadow-sm backdrop-blur-sm border rounded-lg"
      style={
        {
          backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
          borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
        } as React.CSSProperties
      }
    >
      <CardHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
        <CardTitle className={cn(typography.h4, "flex items-center gap-2")}>
          <CreditCard className="h-5 w-5" />
          Financiamiento
        </CardTitle>
        <div className="flex items-center gap-2">
          <StatusBadge tone={config.tone}>
            <StatusIcon />
            {config.label}
          </StatusBadge>
          {financing.documentId && (
            <Link href={`/billing/financing/${financing.documentId}`}>
              <Button variant="ghost" size="sm" className="h-8 px-2">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn("flex flex-col", spacing.gap.base, "px-6 pb-6")}>
        {/* Número de financiamiento */}
        {financing.financingNumber && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Número:</span>
            <span className={typography.body.large}>{financing.financingNumber}</span>
          </div>
        )}

        {/* Progreso de cuotas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progreso</span>
            <span className={typography.body.base}>
              {financing.paidQuotas || 0} de {financing.totalQuotas || 0} cuotas (
              {progressPercentage}%)
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Grid de información financiera */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {/* Monto Total */}
          <div className={cn("rounded-lg p-3", "bg-muted/50 border")}>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <Banknote className="h-3 w-3" />
              Monto Total
            </div>
            <p className={typography.body.large}>{formatCurrency(financing.totalAmount || 0)}</p>
          </div>

          {/* Cuota */}
          <div className={cn("rounded-lg p-3", "bg-muted/50 border")}>
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Cuota
            </div>
            <p className={typography.body.large}>{formatCurrency(financing.quotaAmount || 0)}</p>
          </div>

          {/* Saldo Pendiente */}
          <div
            className={cn(
              "rounded-lg p-3",
              status === "en_mora"
                ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800"
                : "bg-muted/50 border"
            )}
          >
            <div
              className={cn(
                "flex items-center gap-1 text-xs mb-1",
                status === "en_mora" ? "text-red-600 dark:text-red-400" : "text-muted-foreground"
              )}
            >
              <AlertTriangle className="h-3 w-3" />
              Saldo Pendiente
            </div>
            <p
              className={cn(
                typography.body.large,
                status === "en_mora" && "text-red-700 dark:text-red-400"
              )}
            >
              {formatCurrency(financing.currentBalance || 0)}
            </p>
          </div>

          {/* Total Pagado */}
          <div
            className={cn(
              "rounded-lg p-3",
              "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
            )}
          >
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-1">
              <CheckCircle2 className="h-3 w-3" />
              Total Pagado
            </div>
            <p className={cn(typography.body.large, "text-green-700 dark:text-green-400")}>
              {formatCurrency(financing.totalPaid || 0)}
            </p>
          </div>
        </div>

        {/* Próximo vencimiento */}
        {financing.nextDueDate && status !== "completado" && (
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
            )}
          >
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-700 dark:text-amber-400">
                Próximo vencimiento
              </span>
            </div>
            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
              {formatDate(financing.nextDueDate)}
            </span>
          </div>
        )}

        {/* Crédito a favor */}
        {financing.partialPaymentCredit && financing.partialPaymentCredit > 0 && (
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800"
            )}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span className="text-sm text-blue-700 dark:text-blue-400">Crédito a favor</span>
            </div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              {formatCurrency(financing.partialPaymentCredit)}
            </span>
          </div>
        )}

        {/* Botón para ver detalles */}
        {financing.documentId && (
          <Link href={`/billing/financing/${financing.documentId}`} className="mt-2">
            <Button variant="outline" className="w-full">
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Detalles del Financiamiento
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
