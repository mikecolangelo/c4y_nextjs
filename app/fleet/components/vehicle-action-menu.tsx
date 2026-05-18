"use client";

import { Button } from "@/components_shadcn/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";
import type { FleetVehicleCard } from "@/validations/types";

export interface VehicleActionMenuProps {
  vehicle: FleetVehicleCard;
  vehicleId: string;
  onNavigateToDetails: (id: string) => void;
  onNavigateToEdit: (id: string) => void;
  onDuplicateVehicle: (vehicle: FleetVehicleCard) => void;
  onRequestDeleteVehicle: (vehicle: FleetVehicleCard) => void;
  disabled?: boolean;
  onRefresh?: () => void;
}

export function VehicleActionMenu({
  vehicle,
  vehicleId,
  onNavigateToDetails,
  onNavigateToEdit,
  onDuplicateVehicle,
  onRequestDeleteVehicle,
  disabled,
}: VehicleActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={disabled}
          aria-label="Opciones del vehículo"
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToDetails(vehicleId);
          }}
        >
          Ver detalles
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onNavigateToEdit(vehicleId);
          }}
        >
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onDuplicateVehicle(vehicle);
          }}
        >
          Duplicar
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRequestDeleteVehicle(vehicle);
          }}
        >
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
