"use client";

import { Badge } from "@/components_shadcn/ui/badge";
import { cn } from "@/lib/utils";
import type { FleetVehicleCondition } from "@/validations/types";

const badgeStyles: Record<FleetVehicleCondition, string> = {
  nuevo: "bg-green-100 text-green-800",
  usado: "bg-orange-100 text-orange-800",
  seminuevo: "bg-blue-100 text-blue-800",
};

export function ConditionBadge({
  status,
  className,
}: {
  status: FleetVehicleCondition;
  className?: string;
}) {
  return (
    <Badge
      className={cn(
        "rounded-full px-2 py-0.5 text-xs font-semibold",
        badgeStyles[status],
        className
      )}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}
