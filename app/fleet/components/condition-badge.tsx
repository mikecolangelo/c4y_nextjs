"use client";

import { StatusBadge, type StatusTone } from "@/components/ui";
import type { FleetVehicleCondition } from "@/validations/types";

/**
 * Maps a vehicle condition to a shared semantic StatusBadge tone.
 * nuevo → success, seminuevo → info, usado → warning.
 * Single source of truth reused by the detail cards.
 */
export const conditionTone: Record<FleetVehicleCondition, StatusTone> = {
  nuevo: "success",
  seminuevo: "info",
  usado: "warning",
};

const conditionLabel: Record<FleetVehicleCondition, string> = {
  nuevo: "Nuevo",
  seminuevo: "Seminuevo",
  usado: "Usado",
};

export function ConditionBadge({
  status,
  className,
}: {
  status: FleetVehicleCondition;
  className?: string;
}) {
  return (
    <StatusBadge tone={conditionTone[status]} className={className}>
      {conditionLabel[status]}
    </StatusBadge>
  );
}
