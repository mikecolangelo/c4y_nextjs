"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Textarea } from "@/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { Loader2, Calendar, Clock, Truck, Wrench, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import { ServiceSelector, type ServiceOption } from "./service-selector";
import { InventoryItemSelector, type UsedItem, type InventoryItemOption } from "./inventory-item-selector";
import { CostSummary } from "./cost-summary";
import type { ServiceTemplateItem } from "@/validations/types";

interface FleetVehicleOption {
  id: string;
  documentId: string;
  name: string;
  brand: string;
  model: string;
  placa?: string;
  vin: string;
}

interface CreateServiceOrderDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  preselectedService?: ServiceOption;
  preselectedLaborCost?: number;
  preselectedUsedItems?: Array<{
    inventoryItemId: string | number;
    code: string;
    description: string;
    quantity: number;
    unitPriceAtMoment: number;
  }>;
}

export function CreateServiceOrderDialog({
  isOpen,
  onOpenChange,
  onSuccess,
  preselectedService,
  preselectedLaborCost,
  preselectedUsedItems,
}: CreateServiceOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [usedItems, setUsedItems] = useState<UsedItem[]>([]);

  const [formData, setFormData] = useState({
    scheduledDate: "",
    scheduledTime: "09:00",
    fleetVehicleId: "none",
    summary: "",
    laborCost: "",
    status: "pendiente" as "pendiente" | "en_progreso" | "completado",
  });
  const [presetsApplied, setPresetsApplied] = useState(false);

  // Cargar items de inventario (via API Route JWT, no token estático)
  const loadInventory = useCallback(async () => {
    setIsLoadingInventory(true);
    try {
      const response = await fetch("/api/inventory-items", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Error ${response.status} cargando inventario`);
      }
      const result = await response.json();
      const items = Array.isArray(result.data) ? result.data : Array.isArray(result) ? result : [];
      setInventoryItems(items);
    } catch (error) {
      console.error("Error loading inventory:", error);
      toast.error("No se pudieron cargar los repuestos");
    } finally {
      setIsLoadingInventory(false);
    }
  }, []);

  // Cargar servicios disponibles
  const loadServices = useCallback(async () => {
    setIsLoadingServices(true);
    try {
      const response = await fetch("/api/services", { cache: "no-store" });
      if (!response.ok) throw new Error("Error cargando servicios");
      const { data } = await response.json();
      setServices(data || []);
    } catch (error) {
      console.error("Error loading services:", error);
    } finally {
      setIsLoadingServices(false);
    }
  }, []);

  // Cargar vehículos de flota
  const loadVehicles = useCallback(async () => {
    setIsLoadingVehicles(true);
    try {
      const response = await fetch("/api/fleet", { cache: "no-store" });
      if (!response.ok) throw new Error("Error cargando vehículos");
      const { data } = await response.json();
      if (Array.isArray(data)) {
        const vehicleOptions = data.map((v: any) => ({
          id: String(v.id),
          documentId: v.documentId || String(v.id),
          name: v.name,
          brand: v.brand,
          model: v.model,
          placa: v.placa,
          vin: v.vin,
        }));
        setVehicles(vehicleOptions);
      }
    } catch (error) {
      console.error("Error loading vehicles:", error);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadServices();
      loadVehicles();
      loadInventory();
      // Reset form
      setFormData({
        scheduledDate: "",
        scheduledTime: "09:00",
        fleetVehicleId: "none",
        summary: "",
        laborCost: "",
        status: "pendiente",
      });
      setSelectedServices([]);
      setUsedItems([]);
      setPresetsApplied(false);
    }
  }, [isOpen, loadServices, loadVehicles, loadInventory]);

  // Helper: extrae ítems de plantilla de un servicio (defaultTemplate > maintenanceKits)
  const extractTemplateItems = useCallback((service: ServiceOption): ServiceTemplateItem[] | undefined => {
    if (service.defaultTemplate && service.defaultTemplate.length > 0) {
      return service.defaultTemplate;
    }
    const defaultKit = service.maintenanceKits?.find((k) => k.isActive !== false);
    if (defaultKit?.kitItems && defaultKit.kitItems.length > 0) {
      return defaultKit.kitItems.map((ki) => ({
        inventoryItemId: ki.inventoryItem.id,
        code: ki.inventoryItem.code,
        description: ki.inventoryItem.description,
        quantity: ki.quantity,
        salePrice: ki.inventoryItem.salePrice,
      }));
    }
    return undefined;
  }, []);

  const handleAddService = useCallback((service: ServiceOption, skipTemplateLoad = false) => {
    setSelectedServices((prev) => {
      if (prev.find((s) => s.documentId === service.documentId || s.id === service.id)) {
        return prev;
      }
      return [...prev, service];
    });

    if (skipTemplateLoad) return;

    const templateItems = extractTemplateItems(service);
    if (!templateItems || templateItems.length === 0) return;

    setUsedItems((prev) => {
      const next = [...prev];
      for (const tpl of templateItems) {
        // Buscar en inventario cargado para obtener ID real, stock y precio actual
        const invMatch = inventoryItems.find(
          (inv: InventoryItemOption) =>
            String(inv.id) === String(tpl.inventoryItemId) ||
            String(inv.documentId) === String(tpl.inventoryItemId) ||
            inv.code === tpl.code
        );

        // Usar siempre el id numérico (no documentId) para que el backend
        // pueda vincular la relación correctamente via Query Engine
        const targetId = invMatch
          ? String(invMatch.id)
          : String(tpl.inventoryItemId);

        const existing = next.find((u) => String(u.inventoryItem) === targetId);
        if (existing) {
          existing.quantity += tpl.quantity;
        } else {
          next.push({
            inventoryItem: targetId,
            code: tpl.code || (invMatch?.code ?? ""),
            description: tpl.description || (invMatch?.description ?? ""),
            quantity: tpl.quantity,
            unitPriceAtMoment: invMatch
              ? Number(invMatch.salePrice ?? invMatch.unitCost ?? tpl.salePrice ?? 0)
              : Number(tpl.salePrice ?? 0),
          });
        }
      }
      return next;
    });
  }, [inventoryItems, extractTemplateItems]);

  // Aplicar presets una vez que los datos base estén cargados
  useEffect(() => {
    if (!isOpen || presetsApplied) return;
    if (isLoadingServices || isLoadingInventory) return;
    if (services.length === 0 || inventoryItems.length === 0) return;

    let applied = false;

    if (preselectedService) {
      const match = services.find(
        (s) =>
          s.documentId === preselectedService.documentId ||
          s.id === preselectedService.id ||
          s.id === preselectedService.documentId ||
          s.documentId === preselectedService.id
      );
      if (match) {
        // Si ya vienen preselectedUsedItems, no cargar plantilla automáticamente para evitar duplicados
        const skipTemplate = Boolean(preselectedUsedItems && preselectedUsedItems.length > 0);
        handleAddService(match, skipTemplate);
        applied = true;
      }
    }

    if (preselectedLaborCost !== undefined && preselectedLaborCost >= 0) {
      setFormData((prev) => ({ ...prev, laborCost: String(preselectedLaborCost) }));
      applied = true;
    }

    if (preselectedUsedItems && preselectedUsedItems.length > 0) {
      const mapped: UsedItem[] = [];
      for (const preset of preselectedUsedItems) {
        // Buscar en inventoryItems por id, documentId o código
        const match = inventoryItems.find(
          (inv: InventoryItemOption) =>
            String(inv.id) === String(preset.inventoryItemId) ||
            inv.code === preset.code
        );
        if (match) {
          mapped.push({
            inventoryItem: match.id,
            code: match.code,
            description: match.description,
            quantity: preset.quantity,
            unitPriceAtMoment: preset.unitPriceAtMoment,
          });
        }
      }
      if (mapped.length > 0) {
        setUsedItems(mapped);
        applied = true;
      }
    }

    if (applied) {
      setPresetsApplied(true);
    }
  }, [
    isOpen,
    presetsApplied,
    preselectedService,
    preselectedLaborCost,
    preselectedUsedItems,
    services,
    inventoryItems,
    isLoadingServices,
    isLoadingInventory,
    handleAddService,
  ]);

  const handleRemoveService = (serviceId: string | number) => {
    setSelectedServices(selectedServices.filter((s) => s.documentId !== serviceId && s.id !== serviceId));
  };

  const handleAddInventoryItem = (item: any) => {
    if (!usedItems.find((u) => u.inventoryItem === item.id)) {
      setUsedItems([
        ...usedItems,
        {
          inventoryItem: item.id,
          code: item.code,
          description: item.description,
          quantity: 1,
          unitPriceAtMoment: item.salePrice || item.unitCost || 0,
        },
      ]);
    }
  };

  const handleRemoveInventoryItem = (itemId: string | number) => {
    setUsedItems(usedItems.filter((u) => u.inventoryItem !== itemId));
  };

  const handleUpdateItemQuantity = (itemId: string | number, quantity: string) => {
    setUsedItems(
      usedItems.map((u) =>
        u.inventoryItem === itemId ? { ...u, quantity: parseFloat(quantity) || 0 } : u
      )
    );
  };

  const handleUpdateItemPrice = (itemId: string | number, price: string) => {
    setUsedItems(
      usedItems.map((u) =>
        u.inventoryItem === itemId ? { ...u, unitPriceAtMoment: parseFloat(price) || 0 } : u
      )
    );
  };

  const partsCost = usedItems.reduce((sum, item) => sum + (item.quantity * item.unitPriceAtMoment), 0);
  const laborCost = parseFloat(formData.laborCost) || 0;
  const servicesCost = selectedServices.reduce((sum, s) => sum + (s.price || 0), 0);

  const handleSubmit = async () => {
    if (formData.fleetVehicleId === "none") {
      toast.error("Debes seleccionar un vehículo de flota");
      return;
    }

    if (!formData.scheduledDate) {
      toast.error("La fecha programada es requerida");
      return;
    }

    setIsLoading(true);
    try {
      const [year, month, day] = formData.scheduledDate.split("-").map(Number);
      const [hours, minutes] = formData.scheduledTime.split(":").map(Number);

      const scheduledAt = new Date(year, month - 1, day, hours, minutes);

      const vehicleId = vehicles.find((v) => v.documentId === formData.fleetVehicleId)?.id;

      const payload: Record<string, unknown> = {
        scheduledAt: scheduledAt.toISOString(),
        status: formData.status,
        summary: formData.summary || undefined,
        vehicle: vehicleId ? Number(vehicleId) : undefined,
        laborCost,
        services: selectedServices.length > 0
          ? selectedServices.map((s) => Number(s.id)).filter((id) => !isNaN(id))
          : undefined,
      };

      const body: Record<string, unknown> = { data: payload };
      if (usedItems.length > 0) {
        body.usedItems = usedItems
          .map((item) => {
            // Resolver siempre el id numérico real antes de enviar al backend
            const inv = inventoryItems.find(
              (i) =>
                String(i.id) === String(item.inventoryItem) ||
                String(i.documentId) === String(item.inventoryItem)
            );
            const resolvedId = inv ? Number(inv.id) : Number(item.inventoryItem);
            if (isNaN(resolvedId)) {
              console.warn(
                "[CreateServiceOrder] No se pudo resolver id numérico para inventoryItem:",
                item.inventoryItem
              );
              return null;
            }
            return {
              inventoryItem: resolvedId,
              quantity: item.quantity,
              unitPriceAtMoment: item.unitPriceAtMoment,
            };
          })
          .filter(Boolean) as Array<{
            inventoryItem: number;
            quantity: number;
            unitPriceAtMoment: number;
          }>;
      }

      const response = await fetch("/api/service-orders-v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.error?.message ||
              errorData.message ||
              JSON.stringify(errorData.error || errorData);
        throw new Error(errorMessage);
      }

      toast.success("Orden de servicio creada exitosamente");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating service order:", error);
      toast.error(error instanceof Error ? error.message : "Error al crear la orden de servicio");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedVehicle = vehicles.find((v) => v.documentId === formData.fleetVehicleId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Nueva Orden de Servicio
          </DialogTitle>
          <DialogDescription>
            Completa los datos para generar la orden de servicio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Vehículo de Flota */}
          <div className="space-y-2">
            <Label htmlFor="fleetVehicle" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Vehículo de Flota <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.fleetVehicleId}
              onValueChange={(value) => setFormData({ ...formData, fleetVehicleId: value })}
              disabled={isLoadingVehicles}
            >
              <SelectTrigger id="fleetVehicle">
                <SelectValue placeholder={isLoadingVehicles ? "Cargando vehículos..." : "Seleccionar vehículo"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar vehículo...</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.documentId} value={vehicle.documentId}>
                    {vehicle.brand} {vehicle.model} {vehicle.placa && `(${vehicle.placa})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedVehicle && (
              <p className="text-xs text-muted-foreground">
                VIN: {selectedVehicle.vin}
              </p>
            )}
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="scheduledDate" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Fecha <span className="text-red-500">*</span>
              </Label>
              <Input
                id="scheduledDate"
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduledTime" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Hora
              </Label>
              <Input
                id="scheduledTime"
                type="time"
                value={formData.scheduledTime}
                onChange={(e) => setFormData({ ...formData, scheduledTime: e.target.value })}
              />
            </div>
          </div>

          {/* Estado */}
          <div className="space-y-2">
            <Label htmlFor="status">Estado</Label>
            <Select
              value={formData.status}
              onValueChange={(value: "pendiente" | "en_progreso" | "completado") =>
                setFormData({ ...formData, status: value })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_progreso">En Progreso</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Servicios */}
          <ServiceSelector
            services={services}
            selectedServices={selectedServices}
            onAdd={handleAddService}
            onRemove={handleRemoveService}
            isLoading={isLoadingServices}
          />

          {/* Notas */}
          <div className="space-y-2">
            <Label htmlFor="summary">Notas / Descripción</Label>
            <Textarea
              id="summary"
              placeholder="Detalles adicionales sobre la orden de servicio..."
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={3}
            />
          </div>

          {/* Mano de Obra */}
          <div className="space-y-2">
            <Label htmlFor="laborCost" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Mano de Obra ($)
            </Label>
            <Input
              id="laborCost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.laborCost}
              onChange={(e) => setFormData({ ...formData, laborCost: e.target.value })}
            />
          </div>

          {/* Items de Inventario */}
          <InventoryItemSelector
            inventoryItems={inventoryItems}
            usedItems={usedItems}
            onAdd={handleAddInventoryItem}
            onRemove={handleRemoveInventoryItem}
            onUpdateQuantity={handleUpdateItemQuantity}
            onUpdatePrice={handleUpdateItemPrice}
            isLoading={isLoadingInventory}
          />

          {/* Resumen de Costos */}
          <CostSummary laborCost={laborCost} partsCost={partsCost} servicesCost={servicesCost} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Crear Orden
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
