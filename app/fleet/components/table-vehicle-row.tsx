"use client";

import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { Can } from "@/components/auth/can";
import Image from "next/image";
import { Car } from "lucide-react";
import { cn } from "@/lib/utils";
import { typography } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import type { FleetVehicleCard } from "@/validations/types";
import { ConditionBadge } from "./condition-badge";
import { VehicleActionMenu } from "./vehicle-action-menu";
import type { VehicleActionMenuProps } from "./vehicle-action-menu";
import { MileageCounter } from "./mileage-counter";
import type { CSSProperties } from "react";

interface TableVehicleRowProps {
  vehicle: FleetVehicleCard;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleVehicleSelection: (vehicleId: string) => void;
  vehicleId: string;
  actionProps: Omit<VehicleActionMenuProps, "vehicle" | "vehicleId">;
}

export function TableVehicleRow({
  vehicle,
  isSelectMode,
  isSelected,
  onToggleVehicleSelection,
  vehicleId,
  actionProps,
}: TableVehicleRowProps) {
  return (
    <tr
      className={cn(
        "border-b transition-colors",
        isSelectMode ? "cursor-default" : "cursor-pointer hover:bg-muted/50",
        isSelected && "bg-primary/5"
      )}
      onClick={() => {
        if (isSelectMode) {
          onToggleVehicleSelection(vehicleId);
        } else {
          actionProps.onNavigateToDetails(vehicleId);
        }
      }}
    >
      {isSelectMode && (
        <Can module="fleet" action="canDelete">
          <td className="p-4" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleVehicleSelection(vehicleId)}
              className="h-4 w-4"
            />
          </td>
        </Can>
      )}
      <td className="p-4" style={{ width: 80 } as CSSProperties}>
        {vehicle.imageUrl ? (
          <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-muted">
            <Image
              src={strapiImages.getURL(vehicle.imageUrl)}
              alt={vehicle.imageAlt || vehicle.name}
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
            <Car className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </td>
      <td className={`p-4 ${typography.body.base} font-medium`}>{vehicle.name}</td>
      <td className={`p-4 ${typography.body.small} text-muted-foreground`}>{vehicle.vin}</td>
      <td className={`p-4 ${typography.body.base}`}>{vehicle.brand}</td>
      <td className={`p-4 ${typography.body.base}`}>{vehicle.model}</td>
      <td className={`p-4 ${typography.body.base}`}>{vehicle.year}</td>
      <td className={`p-4 ${typography.body.base} font-semibold`}>{vehicle.priceLabel}</td>
      <td className="p-4">
        <ConditionBadge status={vehicle.condition} />
      </td>

      {/* Columna de Kilometraje */}
      <td className="p-4" onClick={(e) => e.stopPropagation()}>
        <MileageCounter
          vehicleId={vehicleId}
          vehicleName={vehicle.name}
          currentMileage={vehicle.currentMileage}
          lastOilChangeMileage={vehicle.lastOilChangeMileage}
          oilChangeNotificationSent={vehicle.oilChangeNotificationSent}
          onMileageUpdated={actionProps.onRefresh}
          variant="compact"
        />
      </td>

      {!isSelectMode && (
        <td className="p-4" onClick={(e) => e.stopPropagation()}>
          <VehicleActionMenu vehicle={vehicle} vehicleId={vehicleId} {...actionProps} />
        </td>
      )}
    </tr>
  );
}
