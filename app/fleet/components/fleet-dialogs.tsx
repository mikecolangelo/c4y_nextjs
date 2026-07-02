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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components_shadcn/ui/alert-dialog";
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
import { MultiSelectCombobox } from "@/components_shadcn/ui/multi-select-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import Image from "next/image";
import { Plus, Upload } from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { Can } from "@/components/auth/can";
import type { Dispatch, SetStateAction, ChangeEvent } from "react";
import type { FleetVehicleCondition } from "@/validations/types";

type UserProfile = {
  id: number;
  documentId?: string;
  displayName?: string;
  email?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
};

export type MaintenanceRecurrencePattern = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface CreateVehicleFormData {
  name: string;
  vin: string;
  price: string;
  condition: FleetVehicleCondition;
  brand: string;
  model: string;
  year: string;
  color: string;
  currentMileage: string;
  oilChangeInterval: string;
  fuelType: string;
  transmission: string;
  imageAlt: string;
  placa: string;
}

interface CreateVehicleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateVehicleFormData;
  setFormData: Dispatch<SetStateAction<CreateVehicleFormData>>;
  handleImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  imagePreview: string | null;
  isCreating: boolean;
  isFormValid: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  availableUsers: UserProfile[];
  isLoadingUsers: boolean;
  selectedResponsables: number[];
  selectedAssignedDrivers: number[];
  onResponsablesChange: (values: Array<number | string>) => void;
  onDriversChange: (values: Array<number | string>) => void;
  conditions: FleetVehicleCondition[];
}

interface DeleteVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName?: string | null;
  isDeleting: boolean;
  onDelete: () => Promise<void>;
}

interface DeleteMultipleVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
}

export function AddVehicleButton({ onClick }: { onClick: () => void }) {
  return (
    <Can module="fleet" action="canCreate">
      <Button
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 z-50"
        size="icon"
        onClick={onClick}
        aria-label="Agregar nuevo vehículo"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </Can>
  );
}

export function CreateVehicleDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  handleImageChange,
  imagePreview,
  isCreating,
  isFormValid,
  onConfirm,
  onCancel,
  availableUsers,
  isLoadingUsers,
  selectedResponsables,
  selectedAssignedDrivers,
  onResponsablesChange,
  onDriversChange,
  conditions,
}: CreateVehicleDialogProps) {
  const userOptions = availableUsers.map((user) => ({
    value: user.id,
    label: user.displayName || user.email || "Usuario",
    email: user.email,
    avatar: user.avatar,
  }));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className={typography.h3}>Agregar Nuevo Vehículo</DialogTitle>
          <DialogDescription>
            Completa los campos para agregar un nuevo vehículo a la flota. Los campos marcados con *
            son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básica *</TabsTrigger>
            <TabsTrigger value="specs">Especificaciones</TabsTrigger>
            <TabsTrigger value="extra">Adicional</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Información Básica</h3>

              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className={typography.label}>
                  Nombre del Vehículo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Ford Mustang 2023"
                  className="rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="vin" className={typography.label}>
                  VIN <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vin"
                  value={formData.vin}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vin: e.target.value.toUpperCase() }))
                  }
                  placeholder="Ej: 1ZVBP8CM0D5281234"
                  className="rounded-lg"
                  maxLength={17}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brand" className={typography.label}>
                    Marca <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ej: Ford"
                    className="rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="model" className={typography.label}>
                    Modelo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                    placeholder="Ej: Mustang"
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="year" className={typography.label}>
                    Año <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
                    placeholder="Ej: 2023"
                    className="rounded-lg"
                    min={1900}
                    max={2100}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="condition" className={typography.label}>
                    Estado <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        condition: value as FleetVehicleCondition,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]" align="end">
                      {conditions.map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          <span className="capitalize">{condition}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Precio</h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="price" className={typography.label}>
                  Precio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="Ej: 55000"
                  className="rounded-lg"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="specs" className="space-y-4 mt-4">
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Detalles Adicionales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="color" className={typography.label}>
                    Color
                  </Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                    placeholder="Ej: Plata Metálico"
                    className="rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="currentMileage" className={typography.label}>
                    Kilometraje
                  </Label>
                  <Input
                    id="currentMileage"
                    type="number"
                    value={formData.currentMileage}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, currentMileage: e.target.value }))
                    }
                    placeholder="Ej: 35000"
                    className="rounded-lg"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fuelType" className={typography.label}>
                    Tipo de Combustible
                  </Label>
                  <Input
                    id="fuelType"
                    value={formData.fuelType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fuelType: e.target.value }))}
                    placeholder="Ej: Gasolina, Híbrido, Eléctrico"
                    className="rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="transmission" className={typography.label}>
                    Transmisión
                  </Label>
                  <Input
                    id="transmission"
                    value={formData.transmission}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, transmission: e.target.value }))
                    }
                    placeholder="Ej: Automática, Manual, CVT"
                    className="rounded-lg"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extra" className="space-y-4 mt-4">
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Información Adicional</h3>

              <div className="flex flex-col gap-2">
                <Label htmlFor="placa" className={typography.label}>
                  Placa
                </Label>
                <Input
                  id="placa"
                  value={formData.placa}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, placa: e.target.value.toUpperCase() }))
                  }
                  placeholder="Ej: ABC-123"
                  className="rounded-lg"
                />
              </div>

              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="oilChangeInterval" className={typography.label}>
                  Mantenimiento cada (km)
                </Label>
                <Input
                  id="oilChangeInterval"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={formData.oilChangeInterval}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, oilChangeInterval: e.target.value }))
                  }
                  placeholder="Ej: 5000"
                  className="rounded-lg"
                />
                <p className={`${typography.body.small} text-muted-foreground`}>
                  El mantenimiento se controla por kilometraje, no por fecha.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label className={typography.label}>Responsable(s) del Auto</Label>
                <MultiSelectCombobox
                  options={userOptions}
                  selectedValues={selectedResponsables}
                  onSelectionChange={onResponsablesChange}
                  placeholder="Selecciona responsables..."
                  emptyMessage="No hay usuarios disponibles"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className={typography.label}>Conductores anteriores</Label>
                <MultiSelectCombobox
                  options={userOptions}
                  selectedValues={selectedAssignedDrivers}
                  onSelectionChange={onDriversChange}
                  placeholder="Selecciona conductores..."
                  emptyMessage="No hay usuarios disponibles"
                />
              </div>
            </div>

            <Separator />

            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Imagen</h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="image" className={typography.label}>
                  Imagen del Vehículo
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <Label
                    htmlFor="image"
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span className={typography.body.base}>Subir imagen</span>
                  </Label>
                  {imagePreview && (
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="imageAlt" className={typography.label}>
                  Texto Alternativo de la Imagen
                </Label>
                <Input
                  id="imageAlt"
                  value={formData.imageAlt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, imageAlt: e.target.value }))}
                  placeholder="Descripción de la imagen para accesibilidad"
                  className="rounded-lg"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={onCancel} disabled={isCreating}>
            Cancelar
          </Button>
          <Can module="fleet" action="canCreate">
            <Button
              onClick={onConfirm}
              disabled={isCreating || !isFormValid}
              className={cn(
                "font-semibold shadow-md hover:shadow-lg transition-all duration-200",
                !isCreating &&
                  isFormValid &&
                  "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 !opacity-100",
                (isCreating || !isFormValid) && "!opacity-50 cursor-not-allowed"
              )}
            >
              {isCreating ? "Creando..." : "Crear Vehículo"}
            </Button>
          </Can>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteVehicleDialog({
  open,
  onOpenChange,
  vehicleName,
  isDeleting,
  onDelete,
}: DeleteVehicleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClose={() => onOpenChange(false)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{vehicleName}</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar este vehículo? Esta acción eliminará el vehículo de la flota y no se podrá
            deshacer. Confirma si deseas continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Can module="fleet" action="canDelete">
            <AlertDialogAction
              onClick={onDelete}
              disabled={isDeleting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </Can>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteMultipleVehiclesDialog({
  open,
  onOpenChange,
  selectedCount,
  isDeleting,
  onConfirm,
}: DeleteMultipleVehicleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClose={() => onOpenChange(false)}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar vehículos seleccionados?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar {selectedCount} vehículo(s)? Esta acción no se
            puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <Can module="fleet" action="canDelete">
            <AlertDialogAction
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </Can>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
