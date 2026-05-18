"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Label } from "@/components_shadcn/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components_shadcn/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { MultiSelectCombobox } from "@/components_shadcn/ui/multi-select-combobox";
import { spacing, typography } from "@/lib/design-system";
import type { FleetVehicleCondition } from "@/validations/types";

interface FleetFiltersSheetProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  brands: string[];
  models: string[];
  years: number[];
  conditions: FleetVehicleCondition[];
  selectedBrand: string | null;
  selectedModel: string | null;
  selectedYear: number | null;
  selectedCondition: FleetVehicleCondition | null;
  onBrandChange: (value: string | null) => void;
  onModelChange: (value: string | null) => void;
  onYearChange: (value: number | null) => void;
  onConditionChange: (value: FleetVehicleCondition | null) => void;
  filterSelectedResponsables: number[];
  filterSelectedDrivers: number[];
  onResponsablesChange: (values: number[]) => void;
  onDriversChange: (values: number[]) => void;
  availableUsers: Array<{
    id: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  isLoadingUsers: boolean;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function FleetFiltersSheet({
  isOpen,
  onOpenChange,
  brands,
  models,
  years,
  conditions,
  selectedBrand,
  selectedModel,
  selectedYear,
  selectedCondition,
  onBrandChange,
  onModelChange,
  onYearChange,
  onConditionChange,
  filterSelectedResponsables,
  filterSelectedDrivers,
  onResponsablesChange,
  onDriversChange,
  availableUsers,
  isLoadingUsers,
  clearFilters,
  hasActiveFilters,
}: FleetFiltersSheetProps) {
  const mapUsersForCombobox = () =>
    availableUsers.map((user) => ({
      value: user.id,
      label: user.displayName || user.email || "Usuario",
      email: user.email,
      avatar: user.avatar,
    }));

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[500px] sm:w-[640px] overflow-y-auto px-8">
        <SheetHeader className="px-0">
          <SheetTitle>Filtros</SheetTitle>
          <SheetDescription>Filtra los vehículos por diferentes criterios</SheetDescription>
        </SheetHeader>

        <div className={`flex flex-col ${spacing.gap.base} mt-6 px-0`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label className={typography.label}>Marca</Label>
            <Select
              value={selectedBrand || "all"}
              onValueChange={(value) => onBrandChange(value === "all" ? null : value)}
            >
              <SelectTrigger className="text-right [&>*:first-child]:justify-end">
                <SelectValue placeholder="Todas las marcas" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all" className="text-right">
                  Todas las marcas
                </SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand} value={brand} className="text-right">
                    {brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label className={typography.label}>Modelo</Label>
            <Select
              value={selectedModel || "all"}
              onValueChange={(value) => onModelChange(value === "all" ? null : value)}
            >
              <SelectTrigger className="text-right [&>*:first-child]:justify-end">
                <SelectValue placeholder="Todos los modelos" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all" className="text-right">
                  Todos los modelos
                </SelectItem>
                {models.map((model) => (
                  <SelectItem key={model} value={model} className="text-right">
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label className={typography.label}>Año</Label>
            <Select
              value={selectedYear?.toString() || "all"}
              onValueChange={(value) => onYearChange(value === "all" ? null : Number(value))}
            >
              <SelectTrigger className="text-right [&>*:first-child]:justify-end">
                <SelectValue placeholder="Todos los años" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all" className="text-right">
                  Todos los años
                </SelectItem>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()} className="text-right">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label className={typography.label}>Estado</Label>
            <Select
              value={selectedCondition || "all"}
              onValueChange={(value) => onConditionChange(value === "all" ? null : (value as FleetVehicleCondition))}
            >
              <SelectTrigger className="text-right [&>*:first-child]:justify-end">
                <SelectValue placeholder="Todos los estados" />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="all" className="text-right">
                  Todos los estados
                </SelectItem>
                {conditions.map((status) => (
                  <SelectItem key={status} value={status} className="text-right">
                    <span className="capitalize">{status}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label className={typography.label}>Responsable</Label>
            <MultiSelectCombobox
              options={mapUsersForCombobox()}
              selectedValues={filterSelectedResponsables}
              onSelectionChange={(values) =>
                onResponsablesChange(
                  values
                    .map((v) => (typeof v === "number" ? v : Number(v)))
                    .filter((id) => !Number.isNaN(id))
                )
              }
              placeholder="Selecciona responsables..."
              emptyMessage="No hay usuarios disponibles"
              disabled={isLoadingUsers}
            />
          </div>

          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label className={typography.label}>Conductor Anterior</Label>
            <MultiSelectCombobox
              options={mapUsersForCombobox()}
              selectedValues={filterSelectedDrivers}
              onSelectionChange={(values) =>
                onDriversChange(
                  values
                    .map((v) => (typeof v === "number" ? v : Number(v)))
                    .filter((id) => !Number.isNaN(id))
                )
              }
              placeholder="Selecciona conductores..."
              emptyMessage="No hay usuarios disponibles"
              disabled={isLoadingUsers}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={clearFilters} className="flex-1" disabled={!hasActiveFilters}>
              Limpiar Filtros
            </Button>
            <Button onClick={() => onOpenChange(false)} className="flex-1">
              Aplicar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
