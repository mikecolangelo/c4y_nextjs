"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components_shadcn/ui/dialog";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
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
import {
  Wrench,
  Trash2,
  Save,
  Loader2,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  Clock,
  Tag,
  ClipboardList,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { formatCurrency } from "@/lib/format";
import type { ServiceCard, InventoryItemRaw, ServiceTemplateItem } from "@/validations/types";

interface KitItemState {
  id: string;
  inventoryItemId: string;
  code: string;
  description: string;
  salePrice: number;
  quantity: number;
  stock: number;
}

interface ServiceDetailDialogProps {
  service: ServiceCard | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTemplateSaved?: (service: ServiceCard) => void;
  onCreateOrder?: (data: {
    laborCost: number;
    usedItems: KitItemState[];
  }) => void;
  userRole?: string;
}

export function ServiceDetailDialog({
  service,
  open,
  onOpenChange,
  onTemplateSaved,
  onCreateOrder,
  userRole,
}: ServiceDetailDialogProps) {
  const isAdmin = userRole === "admin" || userRole === "super-admin";
  const [items, setItems] = useState<KitItemState[]>([]);
  const [inventoryOptions, setInventoryOptions] = useState<InventoryItemRaw[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editableBasePrice, setEditableBasePrice] = useState<number>(0);
  const [editableAgencyCost, setEditableAgencyCost] = useState<number>(0);

  // Sincronizar precios editables cuando cambia el servicio
  useEffect(() => {
    if (service) {
      setEditableBasePrice(Number(service.basePrice ?? service.price ?? 0));
      setEditableAgencyCost(Number(service.agencyCost ?? 0));
    }
  }, [service]);

  // Cargar repuestos iniciales desde defaultTemplate (predeterminado guardado)
  // o desde el primer maintenanceKit activo como fallback
  useEffect(() => {
    if (!service) {
      setItems([]);
      return;
    }

    // Prioridad 1: defaultTemplate guardado previamente
    if (service.defaultTemplate && service.defaultTemplate.length > 0) {
      setItems(
        service.defaultTemplate.map((t, idx) => ({
          id: `tpl-${idx}`,
          inventoryItemId: t.inventoryItemId,
          code: t.code,
          description: t.description,
          salePrice: t.salePrice,
          quantity: t.quantity,
          stock: 0, // Se actualizará al cargar inventario si coincide
        }))
      );
      return;
    }

    // Prioridad 2: primer maintenanceKit activo
    const defaultKit = service.maintenanceKits?.find((k) => k.isActive !== false);
    if (defaultKit?.kitItems) {
      setItems(
        defaultKit.kitItems.map((ki) => ({
          id: ki.id,
          inventoryItemId: ki.inventoryItem.id,
          code: ki.inventoryItem.code,
          description: ki.inventoryItem.description,
          salePrice: ki.inventoryItem.salePrice,
          quantity: ki.quantity,
          stock: ki.inventoryItem.stock,
        }))
      );
    } else {
      setItems([]);
    }
  }, [service]);

  // Cargar inventario general para el selector
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    async function loadInventory() {
      setIsLoadingInventory(true);
      setInventoryError(null);
      try {
        const res = await fetch("/api/inventory-items?pageSize=500", { cache: "no-store" });
        if (!res.ok) throw new Error("Error al cargar inventario");
        const payload = await res.json();
        const data = Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled) setInventoryOptions(data);
      } catch (e) {
        if (!cancelled) {
          setInventoryError("No se pudo cargar el inventario. Intenta de nuevo.");
          console.error(e);
        }
      } finally {
        if (!cancelled) setIsLoadingInventory(false);
      }
    }

    loadInventory();
    return () => { cancelled = true; };
  }, [open]);

  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const handleAddItem = useCallback((inventoryItemId: string) => {
    const inv = inventoryOptions.find(
      (i) => String(i.id) === inventoryItemId || String(i.documentId) === inventoryItemId
    );
    if (!inv) return;

    setItems((prev) => {
      const exists = prev.find((p) => p.inventoryItemId === String(inv.id ?? inv.documentId));
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `tmp-${Date.now()}`,
          inventoryItemId: String(inv.documentId ?? inv.id),
          code: inv.code || "",
          description: inv.description || "",
          salePrice: Number(inv.salePrice ?? inv.unitCost ?? 0),
          quantity: 1,
          stock: Number(inv.stock ?? 0),
        },
      ];
    });
  }, [inventoryOptions]);

  const handleQuantityChange = useCallback((id: string, value: string) => {
    const qty = parseFloat(value);
    if (isNaN(qty) || qty < 0) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i)));
  }, []);

  const handlePriceChange = useCallback((id: string, value: string) => {
    const price = parseFloat(value);
    if (isNaN(price) || price < 0) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, salePrice: price } : i)));
  }, []);

  // Cálculos en tiempo real con useMemo
  const calculations = useMemo(() => {
    const basePrice = isAdmin
      ? editableBasePrice
      : Number(service?.basePrice ?? service?.price ?? 0);
    const subtotalParts = items.reduce((sum, item) => sum + item.salePrice * item.quantity, 0);
    const totalCar4You = basePrice + subtotalParts;
    const agencyCost = isAdmin ? editableAgencyCost : Number(service?.agencyCost ?? 0);
    const savings = agencyCost - totalCar4You;
    return {
      basePrice,
      subtotalParts,
      totalCar4You,
      agencyCost,
      savings,
      isCheaper: savings > 0,
      isEqual: savings === 0,
    };
  }, [items, service]);

  const availableInventory = useMemo(() => {
    const usedIds = new Set(items.map((i) => i.inventoryItemId));
    return inventoryOptions.filter(
      (opt) => !usedIds.has(String(opt.id ?? opt.documentId))
    );
  }, [inventoryOptions, items]);

  const handleSaveTemplate = async () => {
    if (!service) return;
    setIsSaving(true);
    try {
      // Guardamos basePrice, agencyCost y el template de repuestos en el servicio.
      const defaultTemplate = items.map((item) => ({
        inventoryItemId: item.inventoryItemId,
        code: item.code,
        description: item.description,
        quantity: item.quantity,
        salePrice: item.salePrice,
      }));

      const payload = {
        basePrice: editableBasePrice,
        agencyCost: editableAgencyCost,
        defaultTemplate,
      };

      const res = await fetch(`/api/services/${service.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Error al guardar");
      }

      const { data } = await res.json();
      toast.success("Plantilla de servicio actualizada");
      onTemplateSaved?.(data);
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "No se pudo guardar la plantilla");
    } finally {
      setIsSaving(false);
    }
  };

  if (!service) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh] sm:max-w-5xl lg:max-w-6xl">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold leading-tight truncate">
                {service.name}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {service.category ? (
                  <span className="inline-flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {service.category}
                  </span>
                ) : null}
                {service.category && service.coverageLabel ? " · " : null}
                {service.coverageLabel}
                {service.durationMinutes ? (
                  <span className="inline-flex items-center gap-1 ml-2">
                    <Clock className="h-3 w-3" />
                    {service.durationMinutes} min
                  </span>
                ) : null}
                {!service.category && !service.coverageLabel && !service.durationMinutes
                  ? (service.description || "Detalle del servicio")
                  : null}
              </DialogDescription>
            </div>
          </div>
          {service.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-2">
              {service.description}
            </p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:h-full">
            {/* Columna Izquierda: Detalles y Repuestos */}
            <div className="p-6 border-r border-border/50 flex flex-col gap-6 min-h-0">
              {/* Detalles del servicio */}
              <div className="space-y-3 shrink-0">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Detalles del Servicio
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {isAdmin ? (
                    <>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <Label className="text-xs text-muted-foreground block mb-1.5">
                          Mano de Obra (Base)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editableBasePrice}
                          onChange={(e) => setEditableBasePrice(parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <Label className="text-xs text-muted-foreground block mb-1.5">
                          Agencia (Referencia)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editableAgencyCost}
                          onChange={(e) => setEditableAgencyCost(parseFloat(e.target.value) || 0)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Mano de Obra (Base)</p>
                        <p className="text-base font-semibold">{formatCurrency(calculations.basePrice)}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-xs text-muted-foreground">Agencia (Referencia)</p>
                        <p className="text-base font-semibold">{formatCurrency(calculations.agencyCost)}</p>
                      </div>
                    </>
                  )}
                </div>
                {service.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                )}
              </div>

              <Separator className="shrink-0" />

              {/* Lista de repuestos editable */}
              <div className="flex flex-col gap-3 min-h-0 flex-1">
                <div className="flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    Repuestos del Kit
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {items.length} ítem{items.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Selector de nuevo repuesto */}
                <div className="shrink-0">
                  <Select
                    value="none"
                    onValueChange={(value) => {
                      if (value !== "none") handleAddItem(value);
                    }}
                    disabled={isLoadingInventory || availableInventory.length === 0}
                  >
                    <SelectTrigger className="h-9 text-sm w-full">
                      <SelectValue
                        placeholder={
                          isLoadingInventory
                            ? "Cargando inventario..."
                            : inventoryError
                            ? "Error al cargar"
                            : availableInventory.length === 0
                            ? "Sin repuestos disponibles"
                            : "Añadir repuesto del inventario..."
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="min-w-[320px] max-w-[90vw] w-[var(--radix-select-trigger-width)]">
                      <SelectItem value="none">Seleccionar repuesto...</SelectItem>
                      {availableInventory.map((inv) => {
                        const itemPrice = Number(inv.salePrice ?? inv.unitCost ?? 0);
                        const displayText = `${inv.code} — ${inv.description || ""}`;
                        return (
                          <SelectItem
                            key={String(inv.id ?? inv.documentId)}
                            value={String(inv.documentId ?? inv.id)}
                            title={displayText}
                          >
                            <div className="flex items-center gap-2 w-full min-w-0">
                              <span className="font-medium shrink-0">{inv.code}</span>
                              <span className="text-muted-foreground truncate flex-1 min-w-0">
                                {inv.description}
                              </span>
                              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                                {itemPrice > 0 ? `$${itemPrice.toFixed(2)}` : "$0.00"}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {inventoryError && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {inventoryError}
                    </p>
                  )}
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-6 bg-muted/30 rounded-lg border border-dashed border-border shrink-0">
                    <Wrench className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Este servicio no tiene repuestos asignados.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2 max-h-[280px]">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col gap-2 p-3 bg-muted/40 rounded-lg border border-border/50"
                        >
                          {/* Fila superior: código + descripción + eliminar */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" title={item.code}>{item.code}</p>
                              <p className="text-xs text-muted-foreground truncate" title={item.description}>
                                {item.description}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              className="p-1.5 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors shrink-0 mt-0.5"
                              title="Eliminar repuesto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          {/* Fila inferior: cantidad y precio con labels */}
                          <div className="flex items-end gap-3">
                            <div className="flex flex-col gap-1">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Cantidad
                              </Label>
                              <Input
                                type="number"
                                min="0.1"
                                step="0.1"
                                value={item.quantity}
                                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                className="w-20 h-8 text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-1">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Precio unitario
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.salePrice}
                                onChange={(e) => handlePriceChange(item.id, e.target.value)}
                                className="w-full h-8 text-sm"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Total
                              </Label>
                              <p className="h-8 flex items-center text-sm font-semibold tabular-nums">
                                {formatCurrency(item.salePrice * item.quantity)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Cuadro de Costos */}
            <div className="p-6 bg-muted/20 flex flex-col gap-6 min-h-0">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                Resumen de Cotización
              </h3>

              <div className="bg-background rounded-xl border border-border shadow-sm p-5 space-y-4 flex-1 min-h-0 overflow-y-auto max-h-[300px]">
                {/* Mano de obra */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mano de Obra</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(calculations.basePrice)}
                  </span>
                </div>

                <Separator />

                {/* Lista de repuestos */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Repuestos
                  </p>
                  {items.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Sin repuestos</p>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground truncate max-w-[60%]">
                            {item.code} × {item.quantity}
                          </span>
                          <span className="font-medium">
                            {formatCurrency(item.salePrice * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Subtotal Repuestos</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(calculations.subtotalParts)}
                  </span>
                </div>

                <Separator />

                {/* Total Car4You */}
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold">Total Car4You</span>
                  <span className="text-xl font-bold text-primary">
                    {formatCurrency(calculations.totalCar4You)}
                  </span>
                </div>

                {/* Comparativa con agencia */}
                <div
                  className={`rounded-lg p-3 border ${
                    calculations.isCheaper
                      ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900"
                      : calculations.isEqual
                      ? "bg-muted/50 border-border"
                      : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-muted-foreground">Costo Agencia Oficial</span>
                    <span className="text-sm font-medium">
                      {formatCurrency(calculations.agencyCost)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {calculations.isCheaper ? (
                      <>
                        <TrendingDown className="h-4 w-4 text-green-600" />
                        <Badge
                          variant="outline"
                          className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900 dark:text-green-200 dark:border-green-700 font-semibold"
                        >
                          Ahorras: {formatCurrency(calculations.savings)}
                        </Badge>
                      </>
                    ) : calculations.isEqual ? (
                      <span className="text-sm text-muted-foreground">
                        Mismo precio que agencia
                      </span>
                    ) : (
                      <>
                        <TrendingUp className="h-4 w-4 text-red-600" />
                        <Badge
                          variant="outline"
                          className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900 dark:text-red-200 dark:border-red-700 font-semibold"
                        >
                          Diferencia: {formatCurrency(Math.abs(calculations.savings))}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Crear Orden desde Cotización */}
              <div className="pt-2">
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    onCreateOrder?.({
                      laborCost: calculations.basePrice,
                      usedItems: items,
                    });
                  }}
                  variant="default"
                  className="w-full"
                >
                  <ClipboardList className="h-4 w-4 mr-2" />
                  Crear Orden
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Genera una orden de servicio con los repuestos y mano de obra cotizados.
                </p>
              </div>

              {/* Acciones de Admin */}
              {isAdmin && (
                <div className="pt-2">
                  <Button
                    onClick={handleSaveTemplate}
                    disabled={isSaving}
                    variant="outline"
                    className="w-full"
                  >
                    {isSaving ? (
                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    {isSaving ? "Guardando..." : "Guardar cambios en Plantilla"}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Solo administradores. Actualiza basePrice y agencyCost en Strapi.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
