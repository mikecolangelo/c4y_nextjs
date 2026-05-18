"use client";

import { Percent } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface CostSummaryProps {
  laborCost: number;
  partsCost: number;
  servicesCost?: number;
}

/** Costo fijo de referencia: agencia oficial (PAB) */
const DEALER_COST = 111.57;

export function CostSummary({
  laborCost,
  partsCost,
  servicesCost = 0,
}: CostSummaryProps) {
  if (partsCost === 0 && laborCost === 0 && servicesCost === 0) return null;

  const totalCost = laborCost + partsCost + servicesCost;
  const savings = DEALER_COST - totalCost;
  const isCheaper = totalCost < DEALER_COST;

  return (
    <div className="space-y-2">
      <div className="p-3 bg-muted/50 rounded-md space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Mano de Obra:</span>
          <span>{formatCurrency(laborCost, { maximumFractionDigits: 2 })}</span>
        </div>
        {servicesCost > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Servicios:</span>
            <span>{formatCurrency(servicesCost, { maximumFractionDigits: 2 })}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Repuestos:</span>
          <span>{formatCurrency(partsCost, { maximumFractionDigits: 2 })}</span>
        </div>
        <div className="flex justify-between font-semibold border-t pt-1 mt-1">
          <span>Total Estimado:</span>
          <span>{formatCurrency(totalCost, { maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {isCheaper ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-md flex items-start gap-3">
          <Percent className="h-5 w-5 text-green-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 space-y-0.5">
            <p className="text-sm font-medium text-green-700">Ahorro vs Agencia Oficial</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(savings, { maximumFractionDigits: 2 })}</p>
            <p className="text-xs text-green-600/80">
              Costo agencia estimado: {formatCurrency(DEALER_COST, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-2 bg-muted/30 rounded-md text-center">
          <p className="text-xs text-muted-foreground">
            Costo estimado alineado con tarifa de agencia oficial
          </p>
        </div>
      )}
    </div>
  );
}
