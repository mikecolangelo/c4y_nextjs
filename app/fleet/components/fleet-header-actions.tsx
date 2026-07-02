"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Grid3x3, List, Table, Trash2, CheckSquare, Square, Search, Plus } from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import { PageSizeSelect } from "@/components/ui/page-size-select";
import { Can } from "@/components/auth/can";

export type FleetViewMode = "list" | "grid" | "table";

interface FleetHeaderActionsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  viewMode: FleetViewMode;
  onViewModeChange: (mode: FleetViewMode) => void;
  isSelectMode: boolean;
  toggleSelectMode: () => void;
  selectedVehiclesCount: number;
  onDeleteMultiple: () => void;
  isDeleting: boolean;
  hasActiveFilters: boolean;
  activeFiltersCount: number;
  onOpenFilters: () => void;
  itemsPerPage: number;
  onItemsPerPageChange: (value: number) => void;
  onAddVehicle: () => void;
}

const viewButtons: Array<{ mode: FleetViewMode; icon: React.ReactNode; label: string }> = [
  { mode: "list", icon: <List className="h-4 w-4" />, label: "Vista de lista" },
  { mode: "grid", icon: <Grid3x3 className="h-4 w-4" />, label: "Vista de cuadrícula" },
  { mode: "table", icon: <Table className="h-4 w-4" />, label: "Vista de tabla" },
];

export function FleetHeaderActions({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  isSelectMode,
  toggleSelectMode,
  selectedVehiclesCount,
  onDeleteMultiple,
  isDeleting,
  hasActiveFilters,
  activeFiltersCount,
  onOpenFilters,
  itemsPerPage,
  onItemsPerPageChange,
  onAddVehicle,
}: FleetHeaderActionsProps) {
  return (
    <section className={`flex flex-col ${spacing.gap.base}`} suppressHydrationWarning>
      <div className="flex gap-2" suppressHydrationWarning>
        <label className="flex flex-col min-w-40 h-12 flex-1" suppressHydrationWarning>
          <div className="flex w-full flex-1 items-stretch rounded-lg h-full bg-muted dark:bg-muted">
            <div className="text-muted-foreground flex items-center justify-center pl-4 bg-muted dark:bg-muted rounded-l-lg">
              <Search className="h-5 w-5" />
            </div>
            <Input
              type="text"
              suppressHydrationWarning
              className="flex w-full min-w-0 flex-1 border-none bg-muted dark:bg-muted focus-visible:ring-0 focus-visible:outline-none h-full rounded-l-none border-l-0 pl-2 text-base placeholder:text-muted-foreground"
              placeholder="Buscar por nombre, VIN..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </label>
        <Button
          variant="default"
          size="sm"
          onClick={onAddVehicle}
          className="h-12 px-4"
          aria-label="Agregar nuevo vehículo"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Agregar</span>
        </Button>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {viewButtons.map(({ mode, icon, label }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "outline"}
              size="sm"
              onClick={() => onViewModeChange(mode)}
              className="h-8"
              aria-label={label}
              suppressHydrationWarning
            >
              {icon}
            </Button>
          ))}

          <Can module="fleet" action="canDelete">
            <Button
              variant={isSelectMode ? "default" : "outline"}
              size="sm"
              onClick={toggleSelectMode}
              className="h-8"
              aria-label="Modo selección"
            >
              {isSelectMode ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
            </Button>
          </Can>
        </div>

        <div className="flex items-center gap-2">
          {isSelectMode && selectedVehiclesCount > 0 && (
            <Can module="fleet" action="canDelete">
              <Button
                variant="destructive"
                size="sm"
                onClick={onDeleteMultiple}
                disabled={isDeleting}
                className="h-8"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar ({selectedVehiclesCount})
              </Button>
            </Can>
          )}

          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0 whitespace-nowrap flex items-center justify-center gap-2 px-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
              onClick={onOpenFilters}
            >
              <span className={typography.body.base}>{activeFiltersCount} filtro(s) activo(s)</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <PageSizeSelect
          value={itemsPerPage}
          onChange={onItemsPerPageChange}
          options={[5, 7, 10, 20, 50]}
        />
      </div>
    </section>
  );
}
