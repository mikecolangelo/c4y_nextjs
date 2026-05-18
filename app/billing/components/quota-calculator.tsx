"use client";

import { useState, useMemo } from "react";
import { Calculator, Banknote, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Separator } from "@/components_shadcn/ui/separator";
import { Badge } from "@/components_shadcn/ui/badge";
import { typography, spacing, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";

interface QuotaCalculatorProps {
  initialTotalPrice?: number;
  initialQuotas?: number;
  initialAdvance?: number;
  onCalculate?: (result: QuotaCalculation) => void;
  className?: string;
}

export interface QuotaCalculation {
  totalPrice: number;
  numberOfQuotas: number;
  advancePayment: number;
  weeklyQuota: number;
  dailyLateFee: number;
  totalAfterAdvance: number;
}

export function QuotaCalculator({
  initialTotalPrice = 0,
  initialQuotas = 220,
  initialAdvance = 0,
  onCalculate,
  className,
}: QuotaCalculatorProps) {
  const [totalPrice, setTotalPrice] = useState<string>(initialTotalPrice.toString());
  const [numberOfQuotas, setNumberOfQuotas] = useState<string>(initialQuotas.toString());
  const [advancePayment, setAdvancePayment] = useState<string>(initialAdvance.toString());

  const calculation = useMemo<QuotaCalculation>(() => {
    const price = parseFloat(totalPrice) || 0;
    const quotas = parseInt(numberOfQuotas) || 220;
    const advance = parseFloat(advancePayment) || 0;

    // Total después de adelanto
    const totalAfterAdvance = Math.max(0, price - advance);

    // Letra semanal = (Precio Total - Adelanto) / Número de Cuotas
    const weeklyQuota = quotas > 0 ? totalAfterAdvance / quotas : 0;

    // Multa diaria = 10% del monto de la cuota
    const dailyLateFee = weeklyQuota * 0.10;

    const result: QuotaCalculation = {
      totalPrice: price,
      numberOfQuotas: quotas,
      advancePayment: advance,
      weeklyQuota,
      dailyLateFee,
      totalAfterAdvance,
    };

    onCalculate?.(result);
    return result;
  }, [totalPrice, numberOfQuotas, advancePayment, onCalculate]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("es-PA", {
      style: "currency",
      currency: "PAB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <Card className={cn(components.card, className)}>
      <CardHeader className={spacing.card.header}>
        <CardTitle className={cn(typography.h4, "flex items-center gap-2")}>
          <Calculator className="h-5 w-5" />
          Calculadora de Cuotas
        </CardTitle>
      </CardHeader>
      <CardContent className={cn("flex flex-col", spacing.gap.medium, spacing.card.content)}>
        {/* Inputs */}
        <div className={cn("grid grid-cols-1 md:grid-cols-3", spacing.gap.medium)}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="totalPrice" className={typography.label}>
              Precio Total del Vehículo
            </Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="totalPrice"
                type="number"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
                placeholder="0.00"
                className="pl-9 rounded-lg"
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="numberOfQuotas" className={typography.label}>
              Número de Cuotas
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="numberOfQuotas"
                type="number"
                value={numberOfQuotas}
                onChange={(e) => setNumberOfQuotas(e.target.value)}
                placeholder="220"
                className="pl-9 rounded-lg"
                min={1}
                step="1"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="advancePayment" className={typography.label}>
              Adelanto / Depósito
            </Label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="advancePayment"
                type="number"
                value={advancePayment}
                onChange={(e) => setAdvancePayment(e.target.value)}
                placeholder="0.00"
                className="pl-9 rounded-lg"
                min={0}
                step="0.01"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Results */}
        <div className={cn("grid grid-cols-1 md:grid-cols-2", spacing.gap.medium)}>
          {/* Letra Semanal - Highlighted */}
          <div className="bg-primary/10 dark:bg-primary/20 rounded-xl p-4 flex flex-col items-center justify-center">
            <span className={typography.label}>Letra Semanal</span>
            <span className={cn(typography.metric.large, "text-primary")}>
              {formatCurrency(calculation.weeklyQuota)}
            </span>
            <Badge variant="secondary" className="mt-2">
              {calculation.numberOfQuotas} cuotas
            </Badge>
          </div>

          {/* Detalles */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className={typography.body.small}>Total después de adelanto:</span>
              <span className={typography.body.large}>
                {formatCurrency(calculation.totalAfterAdvance)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className={cn(typography.body.small, "flex items-center gap-1")}>
                <AlertTriangle className="h-3 w-3 text-destructive" />
                Multa diaria (10%):
              </span>
              <span className={cn(typography.body.large, "text-destructive")}>
                {formatCurrency(calculation.dailyLateFee)}
              </span>
            </div>

            <Separator />

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Ejemplo: 3 días de retraso =</span>
              <span className="font-medium text-destructive">
                {formatCurrency(calculation.dailyLateFee * 3)}
              </span>
            </div>

            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>Ejemplo: 7 días de retraso =</span>
              <span className="font-medium text-destructive">
                {formatCurrency(calculation.dailyLateFee * 7)}
              </span>
            </div>
          </div>
        </div>

        {/* Nota informativa */}
        <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
          <p>
            <strong>Nota:</strong> La multa por retraso es del 10% diario sobre el monto de la cuota semanal.
            Si hay adelanto, la multa se calcula sobre el monto restante.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
