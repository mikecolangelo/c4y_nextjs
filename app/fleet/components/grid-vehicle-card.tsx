"use client";

import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { spacing, typography } from "@/lib/design-system";
import type { FleetVehicleCard } from "@/validations/types";
import { ConditionBadge } from "./condition-badge";
import { VehicleActionMenu } from "./vehicle-action-menu";
import type { VehicleActionMenuProps } from "./vehicle-action-menu";
import { MileageCounter } from "./mileage-counter";
import { VehicleImage } from "@/components/ui/fleet/vehicle-image";
import type { CSSProperties } from "react";

interface GridVehicleCardProps {
  vehicle: FleetVehicleCard;
  vehicleId: string;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleVehicleSelection: (vehicleId: string) => void;
  actionProps: Omit<VehicleActionMenuProps, "vehicle" | "vehicleId">;
}

export function GridVehicleCard({
  vehicle,
  vehicleId,
  isSelectMode,
  isSelected,
  onToggleVehicleSelection,
  actionProps,
}: GridVehicleCardProps) {
  return (
    <Card
      className={`!bg-transparent shadow-sm backdrop-blur-sm border rounded-lg transition-colors flex flex-col ${isSelectMode ? "cursor-default" : "cursor-pointer hover:opacity-90 active:opacity-80"} ${isSelected ? "ring-2 ring-primary" : ""}`}
      style={{
        backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
        borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
      } as CSSProperties}
      onClick={() => {
        if (isSelectMode) {
          onToggleVehicleSelection(vehicleId);
        } else {
          actionProps.onNavigateToDetails(vehicleId);
        }
      }}
    >
      <CardContent className={`flex flex-col ${spacing.gap.small} ${spacing.card.padding} p-4 relative`}>
        {isSelectMode && (
          <div
            className="absolute -top-2 -right-1 z-20 bg-background/80 backdrop-blur-sm rounded-md p-0.5 shadow-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleVehicleSelection(vehicleId)}
              className="h-5 w-5"
            />
          </div>
        )}
        
        {/* Imagen del vehículo con manejo de errores */}
        <div className="relative h-48 w-full overflow-hidden rounded-lg bg-muted">
          <VehicleImage
            src={vehicle.imageUrl}
            alt={vehicle.imageAlt || vehicle.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            fallbackClassName="h-48 w-full rounded-lg"
          />
        </div>

        <div className={`flex flex-col ${spacing.gap.small}`}>
          <p className={`${typography.body.large} font-bold leading-tight line-clamp-2`}>{vehicle.name}</p>
          <p className={`${typography.body.small} text-muted-foreground leading-normal line-clamp-1`}>VIN: {vehicle.vin}</p>
          <p className={`${typography.body.base} font-semibold leading-normal`}>{vehicle.priceLabel}</p>
          <div className="pt-1">
            <ConditionBadge status={vehicle.condition} />
          </div>
          {/* Contador de Kilometraje */}
          {!isSelectMode && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <MileageCounter
                vehicleId={vehicleId}
                vehicleName={vehicle.name}
                currentMileage={vehicle.currentMileage}
                lastOilChangeMileage={vehicle.lastOilChangeMileage}
                oilChangeNotificationSent={vehicle.oilChangeNotificationSent}
                onMileageUpdated={actionProps.onRefresh}
                variant="full"
              />
            </div>
          )}
          
          {!isSelectMode && (
            <div className="mt-2">
              <VehicleActionMenu
                vehicle={vehicle}
                vehicleId={vehicleId}
                {...actionProps}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
