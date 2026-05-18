"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components_shadcn/ui/table";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import { Wrench, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface KitItem {
  inventoryItem: {
    id: number;
    code: string;
    description: string;
    stock: number;
    salePrice?: number;
    unitCost?: number;
  };
  quantity: number;
}

interface MaintenanceKitData {
  id: number;
  name: string;
  type: string;
  defaultLaborCost: number;
  kitItems: KitItem[];
}

interface MaintenanceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleId: string;
  vehicleName: string;
  currentMileage: number;
  maintenanceType: string;
  maintenanceTypeLabel: string;
  onSuccess: () => void;
}

export function MaintenanceOrderDialog({
  open,
  onOpenChange,
  vehicleId,
  vehicleName,
  currentMileage,
  maintenanceType,
  maintenanceTypeLabel,
  onSuccess,
}: MaintenanceOrderDialogProps) {
  const [kit, setKit] = useState<MaintenanceKitData | null>(null);
  const [isLoadingKit, setIsLoadingKit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [laborCost, setLaborCost] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [stockErrors, setStockErrors] = useState<Array<{ code: string; description: string; requested: number; available: number }>>([]);

  const loadKit = useCallback(async () => {
    setIsLoadingKit(true);
    try {
      const query = new URLSearchParams({
        "filters[type][$eq]": maintenanceType,
        "filters[isActive][$eq]": "true",
        "populate[kitItems][populate][inventoryItem]": "true",
      });

      const response = await fetch(`/api/maintenance-kits?${query.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Error cargando kit");

      const result = await response.json();
      const kits = result.data || [];
      const activeKit = kits[0] || null;

      if (activeKit) {
        setKit(activeKit);
        setLaborCost(String(activeKit.defaultLaborCost ?? 0));
      } else {
        setKit(null);
      }
    } catch (error) {
      console.error("Error cargando kit de mantenimiento:", error);
      toast.error("No se pudo cargar el kit de mantenimiento");
    } finally {
      setIsLoadingKit(false);
    }
  }, [maintenanceType]);

  useEffect(() => {
    if (open) {
      loadKit();
      setNotes("");
      setStockErrors([]);
    }
  }, [open, loadKit]);

  useEffect(() => {
    if (!kit) return;

    const errors = [];
    for (const item of kit.kitItems || []) {
      const inv = item.inventoryItem;
      if (!inv) continue;
      const requested = parseFloat(String(item.quantity));
      const available = parseFloat(String(inv.stock));
      if (available < requested) {
        errors.push({
          code: inv.code,
          description: inv.description,
          requested,
          available,
        });
      }
    }
    setStockErrors(errors);
  }, [kit]);

  const handleSubmit = useCallback(async () => {
    if (stockErrors.length > 0) {
      toast.error("No hay stock suficiente para generar la orden");
      return;
    }

    const laborCostValue = parseFloat(laborCost);
    if (isNaN(laborCostValue) || laborCostValue < 0) {
      toast.error("Ingrese un valor válido para la mano de obra");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/fleet/${vehicleId}/maintenance-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceType,
          laborCost: laborCostValue,
          notes: notes || undefined,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const msg = result.error?.message || result.error || result.message || `Error ${response.status}`;
        throw new Error(msg);
      }

      toast.success("Orden de servicio generada y stock actualizado correctamente");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error generando orden de mantenimiento:", error);
      toast.error(error instanceof Error ? error.message : "No se pudo generar la orden");
    } finally {
      setIsSubmitting(false);
    }
  }, [stockErrors, laborCost, vehicleId, maintenanceType, notes, onOpenChange, onSuccess]);

  const formatNumber = (num: number) => {
    return num.toLocaleString("es-PA", { maximumFractionDigits: 2 });
  };

  const hasStockErrors = stockErrors.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Registrar Servicio de Mantenimiento
          </DialogTitle>
          <DialogDescription>
            {vehicleName} — {formatNumber(currentMileage)} km — {maintenanceTypeLabel}
          </DialogDescription>
        </DialogHeader>

        {isLoadingKit ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Cargando kit de repuestos...</span>
          </div>
        ) : !kit ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No existe un kit de mantenimiento activo para <strong>{maintenanceTypeLabel}</strong>.
              Contacte al administrador para configurarlo.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {hasStockErrors && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="space-y-1">
                  <p className="font-medium">Stock insuficiente</p>
                  <ul className="text-sm list-disc list-inside">
                    {stockErrors.map((err) => (
                      <li key={err.code}>
                        {err.description} ({err.code}): requiere {formatNumber(err.requested)}, disponible {formatNumber(err.available)}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <h4 className="text-sm font-medium mb-2">Repuestos a consumir del kit: {kit.name}</h4>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Código</TableHead>
                      <TableHead className="text-xs">Descripción</TableHead>
                      <TableHead className="text-xs text-right">Cantidad</TableHead>
                      <TableHead className="text-xs text-right">Stock</TableHead>
                      <TableHead className="text-xs text-center">OK</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(kit.kitItems || []).map((item) => {
                      const inv = item.inventoryItem;
                      if (!inv) return null;
                      const ok = parseFloat(String(inv.stock)) >= parseFloat(String(item.quantity));
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="text-xs font-mono">{inv.code}</TableCell>
                          <TableCell className="text-xs">{inv.description}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(item.quantity)}</TableCell>
                          <TableCell className="text-xs text-right">{formatNumber(inv.stock)}</TableCell>
                          <TableCell className="text-center">
                            {ok ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="laborCost" className="text-sm font-medium">
                  Mano de Obra (USD)
                </Label>
                <Input
                  id="laborCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={laborCost}
                  onChange={(e) => setLaborCost(e.target.value)}
                  className="h-9"
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Valor sugerido por defecto del kit: ${formatNumber(kit.defaultLaborCost ?? 0)}
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="notes" className="text-sm font-medium">
                  Notas (opcional)
                </Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Observaciones del servicio..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-9"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoadingKit || !kit || hasStockErrors || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Generar Orden de Servicio
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
