"use client";

import { useMemo } from "react";
import { Calculator, Calendar, Banknote, Hash, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Separator } from "@/components_shadcn/ui/separator";
import { typography, components, spacing } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import {
  calculateTotalQuotas,
  calculateQuotaAmount,
  calculateNextDueDate,
  type PaymentFrequency,
} from "@/lib/financing";

interface FinancingCalculatorProps {
  totalAmount: number;
  financingMonths: number;
  paymentFrequency: PaymentFrequency;
  startDate?: string;
  totalQuotas?: number; // Si se proporciona, se usa directamente en lugar de calcularlo
  onTotalAmountChange?: (value: number) => void;
  onFinancingMonthsChange?: (value: number) => void;
  onPaymentFrequencyChange?: (value: PaymentFrequency) => void;
  onStartDateChange?: (value: string) => void;
  readOnly?: boolean;
  showInputs?: boolean;
  className?: string;
}

const frequencyOptions: { value: PaymentFrequency; label: string; description: string }[] = [
  { value: "semanal", label: "Semanal", description: "Cada 7 días" },
  { value: "quincenal", label: "Quincenal", description: "Cada 15 días" },
  { value: "mensual", label: "Mensual", description: "Cada 30 días" },
];

const monthPresets = [12, 24, 36, 48, 54, 60, 72];

export function FinancingCalculator({
  totalAmount,
  financingMonths,
  paymentFrequency,
  startDate,
  totalQuotas: propTotalQuotas,
  onTotalAmountChange,
  onFinancingMonthsChange,
  onPaymentFrequencyChange,
  onStartDateChange,
  readOnly = false,
  showInputs = true,
  className,
}: FinancingCalculatorProps) {
  // Cálculos
  const calculations = useMemo(() => {
    // Usar totalQuotas del prop si está disponible, de lo contrario calcularlo
    const totalQuotas = propTotalQuotas || calculateTotalQuotas(financingMonths, paymentFrequency);
    const quotaAmount = calculateQuotaAmount(totalAmount, totalQuotas);
    
    // Calcular fecha de finalización estimada
    const start = startDate ? new Date(startDate) : new Date();
    const endDateStr = calculateNextDueDate(
      start.toISOString().split("T")[0],
      paymentFrequency,
      totalQuotas
    );

    // Años y meses de duración
    const years = Math.floor(financingMonths / 12);
    const months = financingMonths % 12;
    const durationText = years > 0 
      ? `${years} año${years > 1 ? "s" : ""}${months > 0 ? ` y ${months} mes${months > 1 ? "es" : ""}` : ""}`
      : `${months} mes${months > 1 ? "es" : ""}`;

    return {
      totalQuotas,
      quotaAmount,
      endDate: endDateStr,
      durationText,
      totalToPay: totalAmount, // Sin intereses por ahora
    };
  }, [totalAmount, financingMonths, paymentFrequency, startDate, propTotalQuotas]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("es-PA", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <Card className={cn(components.card, className)}>
      <CardHeader className={spacing.card.header}>
        <CardTitle className={cn(typography.h4, "flex items-center gap-2")}>
          <Calculator className="h-5 w-5" />
          Calculadora de Financiamiento
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-4", spacing.card.content)}>
        {showInputs && (
          <>
            {/* Monto Total */}
            <div className="space-y-2">
              <Label htmlFor="totalAmount" className={typography.label}>
                Monto Total a Financiar
              </Label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="totalAmount"
                  type="number"
                  min={0}
                  step={100}
                  value={totalAmount || ""}
                  onChange={(e) => onTotalAmountChange?.(parseFloat(e.target.value) || 0)}
                  className={cn(components.input.base, "pl-10")}
                  placeholder="0.00"
                  disabled={readOnly}
                />
              </div>
            </div>

            {/* Meses de Financiamiento */}
            <div className="space-y-2">
              <Label htmlFor="financingMonths" className={typography.label}>
                Meses de Financiamiento
              </Label>
              <div className="flex gap-2">
                <Input
                  id="financingMonths"
                  type="number"
                  min={1}
                  max={120}
                  value={financingMonths || ""}
                  onChange={(e) => onFinancingMonthsChange?.(parseInt(e.target.value) || 0)}
                  className={cn(components.input.base, "flex-1")}
                  placeholder="54"
                  disabled={readOnly}
                />
                {!readOnly && (
                  <div className="flex gap-1">
                    {monthPresets.slice(0, 4).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={cn(
                          "px-2 py-1 text-xs rounded-md border transition-colors",
                          financingMonths === preset
                            ? "bg-primary text-primary-foreground border-primary"
                            : "hover:bg-muted border-border"
                        )}
                        onClick={() => onFinancingMonthsChange?.(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Frecuencia de Pago */}
            <div className="space-y-2">
              <Label htmlFor="paymentFrequency" className={typography.label}>
                Frecuencia de Pago
              </Label>
              <Select
                value={paymentFrequency}
                onValueChange={(v) => onPaymentFrequencyChange?.(v as PaymentFrequency)}
                disabled={readOnly}
              >
                <SelectTrigger className={components.input.base}>
                  <SelectValue placeholder="Seleccionar frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  {frequencyOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha de Inicio */}
            <div className="space-y-2">
              <Label htmlFor="startDate" className={typography.label}>
                Fecha de Inicio
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate || ""}
                onChange={(e) => onStartDateChange?.(e.target.value)}
                className={components.input.base}
                disabled={readOnly}
              />
            </div>

            <Separator />
          </>
        )}

        {/* Resultados */}
        <div className="space-y-4">
          <p className={cn(typography.body.small, "font-semibold uppercase tracking-wide")}>
            Resumen del Plan
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* Cuotas Totales */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Hash className="h-4 w-4" />
                <span className="text-xs">Total de Cuotas</span>
              </div>
              <p className={cn(typography.metric.base, "text-primary")}>
                {calculations.totalQuotas}
              </p>
            </div>

            {/* Monto por Cuota */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Banknote className="h-4 w-4" />
                <span className="text-xs">Monto por Cuota</span>
              </div>
              <p className={cn(typography.metric.base, "text-primary")}>
                {formatCurrency(calculations.quotaAmount)}
              </p>
            </div>

            {/* Duración */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Duración</span>
              </div>
              <p className={typography.body.large}>
                {calculations.durationText}
              </p>
            </div>

            {/* Fecha Estimada de Fin */}
            <div className="p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Fecha Estimada de Fin</span>
              </div>
              <p className={typography.body.large}>
                {formatDate(calculations.endDate)}
              </p>
            </div>
          </div>

          {/* Resumen Final */}
          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total a Pagar</p>
                <p className={cn(typography.metric.large, "text-primary")}>
                  {formatCurrency(calculations.totalToPay)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">
                  {calculations.totalQuotas} cuotas de
                </p>
                <p className={cn(typography.h3, "text-primary")}>
                  {formatCurrency(calculations.quotaAmount)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default FinancingCalculator;
