"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { CheckSquare, Square, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { spacing, typography } from "@/lib/design-system";
import type { FleetVehicleCard } from "@/validations/types";
import type { FleetViewMode } from "./fleet-header-actions";
import { ListVehicleCard } from "./list-vehicle-card";
import { GridVehicleCard } from "./grid-vehicle-card";
import { TableVehicleRow } from "./table-vehicle-row";
import { SelectAllAcrossPagesBanner, type AcrossPagesBannerState } from "@/components/ui/selection";

interface FleetVehicleViewsProps {
  viewMode: FleetViewMode;
  paginatedVehicles: FleetVehicleCard[];
  filteredVehiclesLength: number;
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
  onDuplicateVehicle: (vehicle: FleetVehicleCard) => void;
  onRequestDeleteVehicle: (vehicle: FleetVehicleCard) => void;
  onPageChange: (page: number) => void;
  onRefresh?: () => void;
}

export function FleetVehicleViews({
  viewMode,
  paginatedVehicles,
  filteredVehiclesLength,
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
  onRefresh,
}: FleetVehicleViewsProps) {
  const actionProps = {
    onNavigateToDetails,
    onNavigateToEdit,
    onDuplicateVehicle,
    onRequestDeleteVehicle,
    onRefresh,
  };

  const renderListView = () => (
    <div className={`flex flex-col ${spacing.gap.medium}`}>
      {isSelectMode && (
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button variant="outline" size="sm" onClick={onSelectAll} className="h-8">
            {selectedVehicles.size === paginatedVehicles.length ? (
              <CheckSquare className="h-4 w-4 mr-2" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            Seleccionar todos
          </Button>
          {selectedVehicles.size > 0 && (
            <span className={typography.body.small}>{selectedVehicles.size} seleccionado(s)</span>
          )}
        </div>
      )}

      {paginatedVehicles.map((vehicle) => {
        const vehicleId = vehicle.documentId ?? vehicle.id;
        const isSelected = selectedVehicles.has(vehicleId);
        return (
          <ListVehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            vehicleId={vehicleId}
            isSelectMode={isSelectMode}
            isSelected={isSelected}
            onToggleVehicleSelection={onToggleVehicleSelection}
            actionProps={actionProps}
          />
        );
      })}
    </div>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {paginatedVehicles.map((vehicle) => {
        const vehicleId = vehicle.documentId ?? vehicle.id;
        const isSelected = selectedVehicles.has(vehicleId);
        return (
          <GridVehicleCard
            key={vehicle.id}
            vehicle={vehicle}
            vehicleId={vehicleId}
            isSelectMode={isSelectMode}
            isSelected={isSelected}
            onToggleVehicleSelection={onToggleVehicleSelection}
            actionProps={actionProps}
          />
        );
      })}
    </div>
  );

  const renderTableView = () => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            {isSelectMode && (
              <th className={`${typography.label} text-left p-4 w-12`}>
                <Checkbox
                  checked={
                    selectedVehicles.size === paginatedVehicles.length &&
                    paginatedVehicles.length > 0
                  }
                  onCheckedChange={onSelectAll}
                  className="h-4 w-4"
                />
              </th>
            )}
            <th className={`${typography.label} text-left p-4`}>Imagen</th>
            <th className={`${typography.label} text-left p-4`}>Nombre</th>
            <th className={`${typography.label} text-left p-4`}>VIN</th>
            <th className={`${typography.label} text-left p-4`}>Marca</th>
            <th className={`${typography.label} text-left p-4`}>Modelo</th>
            <th className={`${typography.label} text-left p-4`}>Año</th>
            <th className={`${typography.label} text-left p-4`}>Precio</th>
            <th className={`${typography.label} text-left p-4`}>Estado</th>
            <th className={`${typography.label} text-left p-4`}>Kilometraje</th>
            {!isSelectMode && <th className={`${typography.label} text-left p-4`}>Acciones</th>}
          </tr>
        </thead>
        <tbody>
          {paginatedVehicles.map((vehicle) => {
            const vehicleId = vehicle.documentId ?? vehicle.id;
            const isSelected = selectedVehicles.has(vehicleId);
            return (
              <TableVehicleRow
                key={vehicle.id}
                vehicle={vehicle}
                vehicleId={vehicleId}
                isSelectMode={isSelectMode}
                isSelected={isSelected}
                onToggleVehicleSelection={onToggleVehicleSelection}
                actionProps={actionProps}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const renderPageNumbers = () => {
      const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
        let pageNum: number;
        if (totalPages <= 7) {
          pageNum = i + 1;
        } else if (currentPage <= 4) {
          pageNum = i + 1;
        } else if (currentPage >= totalPages - 3) {
          pageNum = totalPages - 6 + i;
        } else {
          pageNum = currentPage - 3 + i;
        }
        return pageNum;
      });

      return pages.map((pageNum) => (
        <Button
          key={pageNum}
          variant={currentPage === pageNum ? "default" : "outline"}
          size="sm"
          onClick={() => onPageChange(pageNum)}
          className="h-8 w-8 p-0"
        >
          {pageNum}
        </Button>
      ));
    };

    return (
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-2">
          <p className={cn(typography.body.small, "text-muted-foreground")}>
            Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(currentPage * itemsPerPage, filteredVehiclesLength)} de{" "}
            {filteredVehiclesLength} vehículos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-8"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Anterior</span>
          </Button>
          <div className="flex items-center gap-1">{renderPageNumbers()}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-8"
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">Siguiente</span>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {isSelectMode && acrossPagesBanner && (
        <SelectAllAcrossPagesBanner
          show={acrossPagesBanner.show}
          isAllFilteredSelected={acrossPagesBanner.isAllFilteredSelected}
          pageCount={acrossPagesBanner.pageCount}
          totalFiltered={acrossPagesBanner.totalFiltered}
          onSelectAll={() => onSelectAllAcrossPages?.()}
          onRevert={() => onRevertAcrossPages?.()}
        />
      )}
      {viewMode === "list" && renderListView()}
      {viewMode === "grid" && renderGridView()}
      {viewMode === "table" && renderTableView()}
      {renderPagination()}
    </>
  );
}
