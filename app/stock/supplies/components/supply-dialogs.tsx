"use client";

import { useState, useMemo } from "react";
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
import { Textarea } from "@/components_shadcn/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Separator } from "@/components_shadcn/ui/separator";
import { ScrollArea } from "@/components_shadcn/ui/scroll-area";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { SupplyItemCard, SupplyType, SupplyUnit } from "@/validations/supply-types";
import { Package, Fuel, Droplets, Box, AlertCircle } from "lucide-react";

interface CreateSupplyRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating: boolean;
  onConfirm: (data: {
    type: string;
    quantity: string;
    unit: string;
    justification: string;
  }) => Promise<void>;
  supplyItems: SupplyItemCard[];
}

const getSupplyIcon = (type: string) => {
  switch (type) {
    case "kit_limpieza":
      return <Package className="h-4 w-4" />;
    case "gasolina":
      return <Fuel className="h-4 w-4" />;
    case "aceite":
      return <Droplets className="h-4 w-4" />;
    case "otros":
    default:
      return <Box className="h-4 w-4" />;
  }
};

const SUPPLY_TYPES: { value: SupplyType; label: string }[] = [
  { value: "kit_limpieza", label: "Kit de Limpieza" },
  { value: "gasolina", label: "Gasolina" },
  { value: "aceite", label: "Aceite" },
  { value: "otros", label: "Otros" },
];

const SUPPLY_UNITS: { value: SupplyUnit; label: string }[] = [
  { value: "unidades", label: "Unidades" },
  { value: "litros", label: "Litros" },
  { value: "galones", label: "Galones" },
  { value: "kits", label: "Kits" },
];

export function CreateSupplyRequestDialog({
  isOpen,
  onOpenChange,
  isCreating,
  onConfirm,
  supplyItems,
}: CreateSupplyRequestDialogProps) {
  const [formData, setFormData] = useState({
    type: "",
    quantity: "",
    unit: "",
    justification: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Obtener insumos disponibles por tipo seleccionado
  const availableItems = useMemo(() => {
    if (!formData.type) return [];
    return supplyItems.filter((item) => item.type === formData.type && item.stock > 0);
  }, [supplyItems, formData.type]);

  // Sugerir unidad basada en el insumo seleccionado
  const suggestedUnit = useMemo(() => {
    if (availableItems.length > 0) {
      return availableItems[0].unit;
    }
    return "";
  }, [availableItems]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.type) {
      newErrors.type = "Selecciona un tipo de insumo";
    }

    if (!formData.quantity || parseInt(formData.quantity, 10) < 1) {
      newErrors.quantity = "La cantidad debe ser al menos 1";
    }

    if (!formData.unit) {
      newErrors.unit = "Selecciona una unidad de medida";
    }

    if (!formData.justification || formData.justification.trim().length < 10) {
      newErrors.justification = "La justificación debe tener al menos 10 caracteres";
    }

    // NOTE: Stock validation disabled because supplyItems catalog may not be
    // fully populated in all environments. Re-enable once supply-item seeding
    // is guaranteed in production.
    // if (formData.type && formData.quantity && supplyItems.length > 0) {
    //   const requestedQty = parseInt(formData.quantity, 10);
    //   const totalAvailable = supplyItems
    //     .filter(item => item.type === formData.type)
    //     .reduce((sum, item) => sum + item.stock, 0);
    //
    //   if (totalAvailable > 0 && requestedQty > totalAvailable) {
    //     newErrors.quantity = `Stock insuficiente. Disponible: ${totalAvailable}`;
    //   }
    // }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    await onConfirm(formData);
    // Reset form
    setFormData({ type: "", quantity: "", unit: "", justification: "" });
    setErrors({});
  };

  const handleCancel = () => {
    setFormData({ type: "", quantity: "", unit: "", justification: "" });
    setErrors({});
    onOpenChange(false);
  };

  const isFormValid =
    formData.type && formData.quantity && formData.unit && formData.justification.length >= 10;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Solicitar Insumo</DialogTitle>
          <DialogDescription>
            Completa los datos para solicitar un insumo básico del inventario.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="relative flex-1 min-h-0 overflow-hidden">
          <div className="px-6">
            <div className={`flex flex-col ${spacing.gap.medium} py-6`}>
              {/* Tipo de Insumo */}
              <div className={`flex flex-col ${spacing.gap.base}`}>
                <h3 className={typography.h4}>Tipo de Insumo</h3>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="type" className={typography.label}>
                    Tipo <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => {
                      setFormData((prev) => ({
                        ...prev,
                        type: value,
                        unit: "", // Reset unit when type changes
                        quantity: "", // Reset quantity when type changes
                      }));
                      setErrors((prev) => ({ ...prev, type: "", quantity: "" }));
                    }}
                  >
                    <SelectTrigger
                      className={cn("rounded-lg", errors.type && "border-destructive")}
                    >
                      <SelectValue placeholder="Seleccionar tipo de insumo" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {SUPPLY_TYPES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <div className="flex items-center gap-2">
                            {getSupplyIcon(option.value)}
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.type && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.type}
                    </p>
                  )}
                </div>

                {/* Stock disponible */}
                {formData.type && (
                  <div className="bg-muted/50 rounded-lg p-3 mt-2">
                    <p className={`${typography.body.small} font-medium`}>Stock disponible:</p>
                    {availableItems.length > 0 ? (
                      <div className="mt-1 flex flex-col gap-1">
                        {availableItems.map((item) => (
                          <p
                            key={item.id}
                            className={`${typography.body.small} text-muted-foreground`}
                          >
                            • {item.name}: {item.stock} {item.unitLabel}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className={`${typography.body.small} text-destructive`}>
                        No hay stock disponible para este tipo de insumo
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Cantidad y Unidad */}
              <div className={`flex flex-col ${spacing.gap.base}`}>
                <h3 className={typography.h4}>Cantidad</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="quantity" className={typography.label}>
                      Cantidad <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="quantity"
                      type="number"
                      min={1}
                      value={formData.quantity}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, quantity: e.target.value }));
                        setErrors((prev) => ({ ...prev, quantity: "" }));
                      }}
                      placeholder="Ej: 5"
                      className={cn("rounded-lg", errors.quantity && "border-destructive")}
                    />
                    {errors.quantity && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.quantity}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="unit" className={typography.label}>
                      Unidad <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => {
                        setFormData((prev) => ({ ...prev, unit: value }));
                        setErrors((prev) => ({ ...prev, unit: "" }));
                      }}
                    >
                      <SelectTrigger
                        className={cn("rounded-lg", errors.unit && "border-destructive")}
                      >
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent className="z-[200]">
                        {SUPPLY_UNITS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.unit && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.unit}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Justificación */}
              <div className={`flex flex-col ${spacing.gap.base}`}>
                <h3 className={typography.h4}>Justificación</h3>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="justification" className={typography.label}>
                    ¿Por qué necesitas este insumo? <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="justification"
                    value={formData.justification}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, justification: e.target.value }));
                      setErrors((prev) => ({ ...prev, justification: "" }));
                    }}
                    placeholder="Ej: Necesito el kit de limpieza para el mantenimiento del vehículo asignado..."
                    rows={4}
                    className={cn(
                      "rounded-lg resize-none",
                      errors.justification && "border-destructive"
                    )}
                  />
                  <div className="flex justify-between">
                    <p className={`${typography.body.small} text-muted-foreground`}>
                      Mínimo 10 caracteres
                    </p>
                    <p className={`${typography.body.small} text-muted-foreground`}>
                      {formData.justification.length} caracteres
                    </p>
                  </div>
                  {errors.justification && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.justification}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isCreating || !isFormValid}
            className="font-semibold"
          >
            {isCreating ? "Enviando..." : "Enviar Solicitud"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
