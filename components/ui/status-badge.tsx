import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge de estado con tonos semánticos compartidos.
 *
 * Centraliza los colores de estado (éxito/alerta/peligro/info/neutral) que hoy
 * están dispersos como clases ad-hoc (`bg-green-*`, `bg-amber-*`, …) por cada
 * módulo. Usar SIEMPRE este componente para estados/etiquetas de color, de modo
 * que el significado de cada color sea consistente en toda la app y dark-safe.
 *
 * Mapa de significado:
 * - success → ok, activo, pagado, al día
 * - warning → pendiente, por vencer, atención
 * - danger  → error, vencido, inactivo, rechazado
 * - info    → informativo, en proceso
 * - neutral → sin estado / por defecto
 */
const statusBadgeVariants = cva(
  "inline-flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium [&>svg]:size-3 [&>svg]:pointer-events-none",
  {
    variants: {
      tone: {
        success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        danger: "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
        info: "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

export type StatusTone = NonNullable<VariantProps<typeof statusBadgeVariants>["tone"]>;

export interface StatusBadgeProps
  extends React.ComponentProps<"span">, VariantProps<typeof statusBadgeVariants> {}

export function StatusBadge({ className, tone, ...props }: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      className={cn(statusBadgeVariants({ tone }), className)}
      {...props}
    />
  );
}

export { statusBadgeVariants };
