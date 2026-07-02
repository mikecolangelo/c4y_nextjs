"use client";

import { Button } from "@/components_shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Separator } from "@/components_shadcn/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { Plus, Filter, CircleDot, Zap, Wrench } from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import type { Dispatch, SetStateAction } from "react";
import type { InventoryIcon } from "@/validations/types";

export interface CreateInventoryItemFormData {
  code: string;
  description: string;
  stock: string;
  minStock: string;
  maxStock: string;
  unit: string;
  assignedTo: string;
  location: string;
  supplier: string;
  icon: InventoryIcon;
  unitCost: string;
  salePrice: string;
}

interface CreateInventoryItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateInventoryItemFormData;
  setFormData: Dispatch<SetStateAction<CreateInventoryItemFormData>>;
  isCreating: boolean;
  isFormValid: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const iconOptions: { value: InventoryIcon; label: string; icon: React.ReactNode }[] = [
  { value: "filter", label: "Filtro", icon: <Filter className="h-4 w-4" /> },
  { value: "disc", label: "Disco", icon: <CircleDot className="h-4 w-4" /> },
  { value: "bolt", label: "Bujía", icon: <Zap className="h-4 w-4" /> },
  { value: "tire", label: "Neumático", icon: <Wrench className="h-4 w-4" /> },
];

export function AddInventoryItemButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      className="fixed bottom-6 right-6 z-50 size-14 rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      size="icon"
      onClick={onClick}
      aria-label="Agregar nuevo item al inventario"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}

export function CreateInventoryItemDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  isCreating,
  isFormValid,
  onConfirm,
  onCancel,
}: CreateInventoryItemDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Agregar Pieza al Inventario</DialogTitle>
          <DialogDescription>
            Completa los campos requeridos para agregar una nueva pieza al inventario.
          </DialogDescription>
        </DialogHeader>

        <ScrollAreaPrimitive.Root className="relative flex-1 min-h-0 overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
            <div className="px-6">
              <div className={`flex flex-col ${spacing.gap.medium} py-6`}>
                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Información Básica</h3>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="code" className={typography.label}>
                      Código <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="code"
                      value={formData.code}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                      }
                      placeholder="Ej: FLTR-001"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="description" className={typography.label}>
                      Descripción <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      placeholder="Ej: Filtro de aceite motor 1.6L"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="stock" className={typography.label}>
                        Stock Actual <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, stock: e.target.value }))
                        }
                        placeholder="Ej: 50"
                        className="rounded-lg"
                        min={0}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="unit" className={typography.label}>
                        Unidad
                      </Label>
                      <Input
                        id="unit"
                        value={formData.unit}
                        onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                        placeholder="Ej: unidades, pares, litros"
                        className="rounded-lg"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Límites de Stock</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="minStock" className={typography.label}>
                        Stock Mínimo
                      </Label>
                      <Input
                        id="minStock"
                        type="number"
                        value={formData.minStock}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, minStock: e.target.value }))
                        }
                        placeholder="Ej: 10"
                        className="rounded-lg"
                        min={0}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="maxStock" className={typography.label}>
                        Stock Máximo
                      </Label>
                      <Input
                        id="maxStock"
                        type="number"
                        value={formData.maxStock}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, maxStock: e.target.value }))
                        }
                        placeholder="Ej: 100"
                        className="rounded-lg"
                        min={0}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Precios</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="unitCost" className={typography.label}>
                        Costo Unitario
                      </Label>
                      <Input
                        id="unitCost"
                        type="number"
                        value={formData.unitCost}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, unitCost: e.target.value }))
                        }
                        placeholder="Ej: 25.50"
                        className="rounded-lg"
                        min={0}
                        step="0.01"
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="salePrice" className={typography.label}>
                        Precio de Venta
                      </Label>
                      <Input
                        id="salePrice"
                        type="number"
                        value={formData.salePrice}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, salePrice: e.target.value }))
                        }
                        placeholder="Ej: 45.00"
                        className="rounded-lg"
                        min={0}
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Ubicación y Asignación</h3>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="assignedTo" className={typography.label}>
                      Asignado a
                    </Label>
                    <Input
                      id="assignedTo"
                      value={formData.assignedTo}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, assignedTo: e.target.value }))
                      }
                      placeholder="Ej: Taller Mecánico, Almacén Central"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="location" className={typography.label}>
                      Ubicación
                    </Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, location: e.target.value }))
                      }
                      placeholder="Ej: Almacén A - Estante 3"
                      className="rounded-lg"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="supplier" className={typography.label}>
                      Proveedor
                    </Label>
                    <Input
                      id="supplier"
                      value={formData.supplier}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, supplier: e.target.value }))
                      }
                      placeholder="Ej: Repuestos ABC, Distribuidora XYZ"
                      className="rounded-lg"
                    />
                  </div>
                </div>

                <Separator />

                <div className={`flex flex-col ${spacing.gap.base}`}>
                  <h3 className={typography.h4}>Apariencia</h3>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="icon" className={typography.label}>
                      Icono de la Pieza
                    </Label>
                    <Select
                      value={formData.icon}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, icon: value as InventoryIcon }))
                      }
                    >
                      <SelectTrigger className="rounded-lg">
                        <SelectValue placeholder="Seleccionar icono" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {iconOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              {option.icon}
                              <span>{option.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.ScrollAreaScrollbar
            orientation="vertical"
            className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
          </ScrollAreaPrimitive.ScrollAreaScrollbar>
          <ScrollAreaPrimitive.Corner />
        </ScrollAreaPrimitive.Root>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onCancel} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isCreating || !isFormValid}
            className="font-semibold"
          >
            {isCreating ? "Creando..." : "Crear Pieza"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
