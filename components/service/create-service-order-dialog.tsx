"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Badge } from "@/ui/badge";
import { Loader2, Calendar, Clock, Truck, Wrench, X, Plus } from "lucide-react";
import { toast } from "@/lib/toast";
import type { ServiceCard } from "@/validations/types";

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
}

export function CreateServiceOrderDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: CreateServiceOrderDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceCard[]>([]);

  const [formData, setFormData] = useState({
    scheduledDate: "",
    scheduledTime: "09:00",
    fleetVehicleId: "none",
    summary: "",
    status: "pendiente" as "pendiente" | "en_progreso" | "completado",
  });

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
        const vehicleOptions = data.map((v) => ({
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
      // Reset form
      setFormData({
        scheduledDate: "",
        scheduledTime: "09:00",
        fleetVehicleId: "none",
        summary: "",
        status: "pendiente",
      });
      setSelectedServices([]);
    }
  }, [isOpen, loadServices, loadVehicles]);

  const handleAddService = (service: ServiceCard) => {
    if (!selectedServices.find((s) => s.documentId === service.documentId || s.id === service.id)) {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleRemoveService = (serviceId: string | number) => {
    setSelectedServices(selectedServices.filter((s) => s.documentId !== serviceId && s.id !== serviceId));
  };

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

      const payload = {
        scheduledAt: scheduledAt.toISOString(),
        status: formData.status,
        summary: formData.summary || undefined,
        vehicle: formData.fleetVehicleId,
        services: selectedServices.length > 0 
          ? selectedServices.map((s) => s.documentId || s.id)
          : undefined,
      };

      const response = await fetch("/api/service-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al crear la orden de servicio");
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
  const availableServices = services.filter(
    (s) => !selectedServices.find((selected) => selected.documentId === s.documentId || selected.id === s.id)
  );

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Nueva Orden de Servicio
          </DialogTitle>
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
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Servicios a realizar
            </Label>

            {/* Servicios seleccionados */}
            {selectedServices.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedServices.map((service) => (
                  <Badge key={service.documentId || service.id} variant="secondary" className="flex items-center gap-1">
                    {service.name}
                    <button
                      onClick={() => handleRemoveService(service.documentId || service.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Selector de servicios */}
            <Select
              value="none"
              onValueChange={(value) => {
                if (value !== "none") {
                  const service = services.find((s) => (s.documentId || s.id) === value);
                  if (service) handleAddService(service);
                }
              }}
              disabled={isLoadingServices || availableServices.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingServices
                      ? "Cargando..."
                      : availableServices.length === 0
                      ? "No hay más servicios"
                      : "Agregar servicio..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Seleccionar servicio...</SelectItem>
                {availableServices.map((service) => (
                  <SelectItem key={service.documentId || service.id} value={service.documentId || service.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{service.name}</span>
                      {service.price > 0 && (
                        <span className="text-muted-foreground ml-2">${service.price}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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
