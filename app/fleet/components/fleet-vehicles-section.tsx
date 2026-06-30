"use client";

import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { Car } from "lucide-react";
import type { CSSProperties } from "react";
import { spacing, typography } from "@/lib/design-system";
import type { FleetVehicleCard } from "@/validations/types";
import type { FleetViewMode } from "./fleet-header-actions";
import { FleetVehicleViews } from "./fleet-vehicle-views";
import type { AcrossPagesBannerState } from "@/components/ui/selection";

interface FleetVehiclesSectionProps {
  isLoading: boolean;
  skeletonCount: number;
  errorMessage: string | null;
  filteredVehiclesLength: number;
  paginatedVehicles: FleetVehicleCard[];
  viewMode: FleetViewMode;
  totalPages: number;
  currentPage: number;
  itemsPerPage: number;
  isSelectMode: boolean;
  selectedVehicles: Set<string>;
  onToggleVehicleSelection: (vehicleId: string) => void;
  onSelectAll: () => void;
  acrossPagesBanner?: AcrossPagesBannerState;
  onSelectAllAcrossPages?: () => void;
  onRevertAcrossPages?: () => void;
  onNavigateToDetails: (vehicleId: string) => void;
  onNavigateToEdit: (vehicleId: string) => void;
  onDuplicateVehicle: (vehicle: FleetVehicleCard) => Promise<void>;
  onRequestDeleteVehicle: (vehicle: FleetVehicleCard) => void;
  onPageChange: (page: number) => void;
  onRetry: () => void;
  onRefresh?: () => void;
}

const glassStyle: CSSProperties = {
  backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
  borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
};

export function FleetVehiclesSection({
  isLoading,
  skeletonCount,
  errorMessage,
  filteredVehiclesLength,
  paginatedVehicles,
  viewMode,
  totalPages,
  currentPage,
  itemsPerPage,
  isSelectMode,
  selectedVehicles,
  onToggleVehicleSelection,
  onSelectAll,
  acrossPagesBanner,
  onSelectAllAcrossPages,
  onRevertAcrossPages,
  onNavigateToDetails,
  onNavigateToEdit,
  onDuplicateVehicle,
  onRequestDeleteVehicle,
  onPageChange,
  onRetry,
  onRefresh,
}: FleetVehiclesSectionProps) {
  if (isLoading) {
    return (
      <div className={`flex flex-col ${spacing.gap.medium}`}>
        {[...Array(skeletonCount)].map((_, index) => (
          <Card
            key={`loader-${index}`}
            className="!bg-transparent shadow-sm backdrop-blur-sm border rounded-lg"
            style={glassStyle}
          >
            <CardContent
              className={`flex items-start ${spacing.gap.medium} ${spacing.card.padding}`}
            >
              <Skeleton className="h-24 w-24 shrink-0 rounded-lg sm:h-28 sm:w-28" />
              <div className={`flex flex-1 flex-col ${spacing.gap.small}`}>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-48" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-10 rounded-md" />
                    <Skeleton className="h-5 w-5 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (errorMessage) {
    return (
      <Card
        className="!bg-transparent shadow-sm backdrop-blur-sm border rounded-lg"
        style={glassStyle}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 text-center gap-2">
          <p className={`${typography.h3} text-destructive`}>No pudimos cargar la flota</p>
          <p className={typography.body.small}>{errorMessage}</p>
          <Button className="mt-4" onClick={onRetry}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (filteredVehiclesLength === 0) {
    return (
      <Card
        className="!bg-transparent shadow-sm backdrop-blur-sm border rounded-lg"
        style={glassStyle}
      >
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <Car className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className={`mt-4 ${typography.h3} text-foreground`}>No se encontraron vehículos</h3>
          <p className={`mt-1 ${typography.body.small}`}>
            Prueba a cambiar los filtros o añade un nuevo vehículo al inventario.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <FleetVehicleViews
      viewMode={viewMode}
      paginatedVehicles={paginatedVehicles}
      filteredVehiclesLength={filteredVehiclesLength}
      totalPages={totalPages}
      currentPage={currentPage}
      itemsPerPage={itemsPerPage}
      isSelectMode={isSelectMode}
      selectedVehicles={selectedVehicles}
      onToggleVehicleSelection={onToggleVehicleSelection}
      onSelectAll={onSelectAll}
      acrossPagesBanner={acrossPagesBanner}
      onSelectAllAcrossPages={onSelectAllAcrossPages}
      onRevertAcrossPages={onRevertAcrossPages}
      onNavigateToDetails={onNavigateToDetails}
      onNavigateToEdit={onNavigateToEdit}
      onDuplicateVehicle={onDuplicateVehicle}
      onRequestDeleteVehicle={onRequestDeleteVehicle}
      onPageChange={onPageChange}
      onRefresh={onRefresh}
    />
  );
}
