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
import type { InventoryItemCard } from "@/validations/types";
import { AlertCircle } from "lucide-react";

interface CreateInventoryRequestDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  isCreating: boolean;
  onConfirm: (data: {
    inventoryItem: string;
    quantity: string;
    unit: string;
    justification: string;
  }) => Promise<void>;
  inventoryItems: InventoryItemCard[];
}

export function CreateInventoryRequestDialog({
  isOpen,
  onOpenChange,
  isCreating,
  onConfirm,
  inventoryItems,
}: CreateInventoryRequestDialogProps) {
  const [formData, setFormData] = useState({
    inventoryItem: "",
    quantity: "",
    unit: "",
    justification: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedItem = useMemo(() => {
    return inventoryItems.find((item) => item.documentId === formData.inventoryItem);
  }, [inventoryItems, formData.inventoryItem]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.inventoryItem) {
      newErrors.inventoryItem = "Selecciona una pieza";
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      newErrors.quantity = "La cantidad debe ser mayor a 0";
    }

    if (!formData.unit) {
      newErrors.unit = "La unidad es requerida";
    }

    if (!formData.justification || formData.justification.trim().length < 10) {
      newErrors.justification = "La justificación debe tener al menos 10 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    await onConfirm(formData);
    setFormData({ inventoryItem: "", quantity: "", unit: "", justification: "" });
    setErrors({});
  };

  const handleCancel = () => {
    setFormData({ inventoryItem: "", quantity: "", unit: "", justification: "" });
    setErrors({});
    onOpenChange(false);
  };

  const isFormValid =
    formData.inventoryItem &&
    formData.quantity &&
    formData.unit &&
    formData.justification.length >= 10;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Solicitar Pieza</DialogTitle>
          <DialogDescription>
            Completa los datos para solicitar una pieza del inventario.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="relative flex-1 min-h-0 overflow-hidden">
          <div className="px-6">
            <div className={`flex flex-col ${spacing.gap.medium} py-6`}>
              {/* Pieza */}
              <div className={`flex flex-col ${spacing.gap.base}`}>
                <h3 className={typography.h4}>Pieza de Inventario</h3>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="inventoryItem" className={typography.label}>
                    Pieza <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.inventoryItem}
                    onValueChange={(value) => {
                      const item = inventoryItems.find((i) => i.documentId === value);
                      setFormData((prev) => ({
                        ...prev,
                        inventoryItem: value,
                        unit: item?.unit || "",
                        quantity: "",
                      }));
                      setErrors((prev) => ({ ...prev, inventoryItem: "", quantity: "" }));
                    }}
                  >
                    <SelectTrigger
                      className={cn("rounded-lg", errors.inventoryItem && "border-destructive")}
                    >
                      <SelectValue placeholder="Seleccionar pieza" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {inventoryItems.map((item) => (
                        <SelectItem key={item.documentId} value={item.documentId}>
                          <div className="flex items-center gap-2">
                            <span>{item.code}</span>
                            <span className="text-muted-foreground">— {item.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.inventoryItem && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {errors.inventoryItem}
                    </p>
                  )}
                </div>

                {selectedItem && (
                  <div className="bg-muted/50 rounded-lg p-3 mt-2">
                    <p className={`${typography.body.small} font-medium`}>Stock disponible:</p>
                    <p className={`${typography.body.small} text-muted-foreground`}>
                      {selectedItem.stock} {selectedItem.unit || "unidades"}
                    </p>
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
                      min={0.01}
                      step={0.01}
                      value={formData.quantity}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, quantity: e.target.value }));
                        setErrors((prev) => ({ ...prev, quantity: "" }));
                      }}
                      placeholder="Ej: 2"
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
                    <Input
                      id="unit"
                      value={formData.unit}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, unit: e.target.value }));
                        setErrors((prev) => ({ ...prev, unit: "" }));
                      }}
                      placeholder="Ej: unidades"
                      className={cn("rounded-lg", errors.unit && "border-destructive")}
                    />
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
                    ¿Por qué necesitas esta pieza? <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="justification"
                    value={formData.justification}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, justification: e.target.value }));
                      setErrors((prev) => ({ ...prev, justification: "" }));
                    }}
                    placeholder="Ej: Necesito esta pieza para la reparación del vehículo asignado..."
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
