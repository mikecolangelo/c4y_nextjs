"use client";

import { clientLogger } from "@/lib/client-logger";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components_shadcn/ui/dialog";
import { Button } from "@/components_shadcn/ui/button";
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
import { Loader2, Calendar, Clock, Car, Truck } from "lucide-react";
import { toast } from "@/lib/toast";
import { ServiceSelector, type ServiceOption } from "./service-selector";
import { InventoryItemSelector, type UsedItem } from "./inventory-item-selector";
import { CostSummary } from "./cost-summary";

interface FleetVehicleOption {
  id: string;
  documentId: string;
  name: string;
  brand: string;
  model: string;
  placa?: string;
  vin: string;
}

interface CreateServiceAppointmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  onSuccess?: () => void;
  preSelectedServiceId?: string;
}

export function CreateServiceAppointmentDialog({
  isOpen,
  onOpenChange,
  selectedDate,
  onSuccess,
  preSelectedServiceId,
}: CreateServiceAppointmentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [isLoadingInventory, setIsLoadingInventory] = useState(false);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceOption[]>([]);
  const [usedItems, setUsedItems] = useState<UsedItem[]>([]);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: selectedDate,
    time: "09:00",
    durationMinutes: "60",
    serviceId: "none",
    fleetVehicleId: "none",
    location: "",
    laborCost: "",
  });

  // Cargar items de inventario
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
      clientLogger.error("Error loading inventory:", error);
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
      clientLogger.error("Error loading services:", error);
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
      clientLogger.error("Error loading vehicles:", error);
    } finally {
      setIsLoadingVehicles(false);
    }
  }, []);

  // Cargar servicios y pre-seleccionar si hay un serviceId
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        await loadServices();
        await loadVehicles();
        await loadInventory();
      };
      loadData();

      setFormData((prev) => ({
        ...prev,
        date: selectedDate,
        serviceId: preSelectedServiceId || "none",
      }));
      setSelectedServices([]);
      setUsedItems([]);
    }
  }, [isOpen, selectedDate, loadServices, loadVehicles, loadInventory, preSelectedServiceId]);

  // Actualizar título cuando se selecciona un servicio
  useEffect(() => {
    if (preSelectedServiceId && services.length > 0) {
      const service = services.find(
        (s) => s.documentId === preSelectedServiceId || s.id === preSelectedServiceId
      );
      if (service) {
        setFormData((prev) => ({
          ...prev,
          title: service.name,
          durationMinutes: service.durationMinutes ? String(service.durationMinutes) : "60",
        }));
      }
    }
  }, [preSelectedServiceId, services]);

  // Handlers de servicios
  const handleAddService = (service: ServiceOption) => {
    if (!selectedServices.find((s) => s.documentId === service.documentId || s.id === service.id)) {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleRemoveService = (serviceId: string | number) => {
    setSelectedServices(
      selectedServices.filter((s) => s.documentId !== serviceId && s.id !== serviceId)
    );
  };

  // Handlers de inventario
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

  const partsCost = usedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceAtMoment,
    0
  );
  const laborCost = parseFloat(formData.laborCost) || 0;

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error("El título es requerido");
      return;
    }
    if (!formData.date) {
      toast.error("La fecha es requerida");
      return;
    }
    if (!formData.time) {
      toast.error("La hora es requerida");
      return;
    }
    if (formData.fleetVehicleId === "none") {
      toast.error("Debes seleccionar un vehículo de flota para una cita de mantenimiento");
      return;
    }

    setIsLoading(true);
    try {
      const [year, month, day] = formData.date.split("-").map(Number);
      const [hours, minutes] = formData.time.split(":").map(Number);

      const scheduledAt = new Date(year, month - 1, day, hours, minutes);

      const payload = {
        title: formData.title,
        description: formData.description || undefined,
        type: "mantenimiento",
        scheduledAt: scheduledAt.toISOString(),
        durationMinutes: formData.durationMinutes
          ? parseInt(formData.durationMinutes, 10)
          : undefined,
        location: formData.location || undefined,
        service:
          formData.serviceId && formData.serviceId !== "none" ? formData.serviceId : undefined,
        vehicle: formData.fleetVehicleId !== "none" ? formData.fleetVehicleId : undefined,
        status: "pendiente",
      };

      // Datos para la orden de servicio vinculada
      const serviceOrderData = {
        laborCost: laborCost,
        services:
          selectedServices.length > 0
            ? selectedServices.map((s) => s.documentId || s.id)
            : undefined,
        usedItems:
          usedItems.length > 0
            ? usedItems.map((item) => ({
                inventoryItem: item.inventoryItem,
                quantity: item.quantity,
                unitPriceAtMoment: item.unitPriceAtMoment,
              }))
            : undefined,
      };

      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload, serviceOrderData }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al crear la cita");
      }

      toast.success("Cita y orden de servicio creadas exitosamente");

      // Reset form
      setFormData({
        title: "",
        description: "",
        date: selectedDate,
        time: "09:00",
        durationMinutes: "60",
        serviceId: "none",
        fleetVehicleId: "none",
        location: "",
        laborCost: "",
      });
      setSelectedServices([]);
      setUsedItems([]);

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      clientLogger.error("Error creating appointment:", error);
      toast.error(error instanceof Error ? error.message : "Error al crear la cita");
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
            <Calendar className="h-5 w-5" />
            Nueva Cita de Servicio
          </DialogTitle>
          <DialogDescription>
            Programa una nueva cita de mantenimiento. Se creará automáticamente una orden de
            servicio vinculada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Título */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Título <span className="text-red-500">*</span>
            </Label>
            <Input
              id="title"
              placeholder="Ej: Mantenimiento preventivo"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Servicio */}
          <div className="space-y-2">
            <Label htmlFor="service">Tipo de Servicio</Label>
            <Select
              value={formData.serviceId}
              onValueChange={(value) => {
                setFormData({ ...formData, serviceId: value });
                const service = services.find((s) => s.documentId === value || s.id === value);
                if (service && !formData.title) {
                  setFormData((prev) => ({ ...prev, title: service.name }));
                }
              }}
              disabled={isLoadingServices}
            >
              <SelectTrigger id="service">
                <SelectValue
                  placeholder={isLoadingServices ? "Cargando..." : "Seleccionar servicio"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin servicio específico</SelectItem>
                {services.map((service) => (
                  <SelectItem
                    key={service.documentId || service.id}
                    value={service.documentId || String(service.id)}
                  >
                    {service.name} {service.price && service.price > 0 && `- $${service.price}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha y Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">
                Fecha <span className="text-red-500">*</span>
              </Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">
                Hora <span className="text-red-500">*</span>
              </Label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="time"
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>
          </div>

          {/* Duración */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duración estimada (minutos)</Label>
            <Input
              id="duration"
              type="number"
              placeholder="60"
              value={formData.durationMinutes}
              onChange={(e) => setFormData({ ...formData, durationMinutes: e.target.value })}
              min="15"
              step="15"
            />
          </div>

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
                <SelectValue
                  placeholder={isLoadingVehicles ? "Cargando vehículos..." : "Seleccionar vehículo"}
                />
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
              <p className="text-xs text-muted-foreground">VIN: {selectedVehicle.vin}</p>
            )}
          </div>

          {/* Ubicación */}
          <div className="space-y-2">
            <Label htmlFor="location">Ubicación / Taller</Label>
            <Input
              id="location"
              placeholder="Ej: Taller Principal"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          {/* Descripción */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción / Notas</Label>
            <Textarea
              id="description"
              placeholder="Detalles adicionales sobre el servicio..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          {/* ── Campos de Orden de Servicio (nuevos) ── */}
          <div className="border-t pt-4 mt-2">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Car className="h-4 w-4" />
              Datos de la Orden de Servicio
            </h4>

            {/* Servicios a realizar */}
            <ServiceSelector
              services={services}
              selectedServices={selectedServices}
              onAdd={handleAddService}
              onRemove={handleRemoveService}
              isLoading={isLoadingServices}
            />

            {/* Mano de Obra */}
            <div className="space-y-2 mt-4">
              <Label htmlFor="laborCost" className="flex items-center gap-2">
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

            {/* Repuestos / Materiales */}
            <div className="mt-4">
              <InventoryItemSelector
                inventoryItems={inventoryItems}
                usedItems={usedItems}
                onAdd={handleAddInventoryItem}
                onRemove={handleRemoveInventoryItem}
                onUpdateQuantity={handleUpdateItemQuantity}
                onUpdatePrice={handleUpdateItemPrice}
                isLoading={isLoadingInventory}
              />
            </div>

            {/* Resumen de Costos */}
            <div className="mt-4">
              <CostSummary laborCost={laborCost} partsCost={partsCost} />
            </div>
          </div>
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
              "Crear Orden"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
