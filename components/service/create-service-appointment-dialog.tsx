"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [services, setServices] = useState<ServiceCard[]>([]);
  const [vehicles, setVehicles] = useState<FleetVehicleOption[]>([]);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    date: selectedDate,
    time: "09:00",
    durationMinutes: "60",
    serviceId: "none",
    fleetVehicleId: "none",
    location: "",
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

  // Cargar servicios y pre-seleccionar si hay un serviceId
  useEffect(() => {
    if (isOpen) {
      const loadData = async () => {
        await loadServices();
        await loadVehicles();
      };
      loadData();
      
      setFormData((prev) => ({
        ...prev,
        date: selectedDate,
        // Pre-seleccionar servicio si viene de catálogo
        serviceId: preSelectedServiceId || "none",
      }));
    }
  }, [isOpen, selectedDate, loadServices, loadVehicles, preSelectedServiceId]);
  
  // Actualizar título cuando se selecciona un servicio
  useEffect(() => {
    if (preSelectedServiceId && services.length > 0) {
      const service = services.find((s) => s.documentId === preSelectedServiceId || s.id === preSelectedServiceId);
      if (service) {
        setFormData((prev) => ({
          ...prev,
          title: service.name,
          durationMinutes: service.durationMinutes ? String(service.durationMinutes) : "60",
        }));
      }
    }
  }, [preSelectedServiceId, services]);

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
        durationMinutes: formData.durationMinutes ? parseInt(formData.durationMinutes, 10) : undefined,
        location: formData.location || undefined,
        service: formData.serviceId && formData.serviceId !== "none" ? formData.serviceId : undefined,
        fleetVehicle: formData.fleetVehicleId && formData.fleetVehicleId !== "none" ? formData.fleetVehicleId : undefined,
        status: "pendiente",
      };

      const response = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al crear la cita");
      }

      toast.success("Cita creada exitosamente");
      
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
      });
      
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating appointment:", error);
      toast.error(error instanceof Error ? error.message : "Error al crear la cita");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedService = services.find((s) => s.documentId === formData.serviceId || s.id === formData.serviceId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Nueva Cita de Servicio
          </DialogTitle>
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
                <SelectValue placeholder={isLoadingServices ? "Cargando..." : "Seleccionar servicio"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin servicio específico</SelectItem>
                {services.map((service) => (
                  <SelectItem key={service.documentId || service.id} value={service.documentId || service.id}>
                    {service.name} {service.price > 0 && `- $${service.price}`}
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
              Vehículo de Flota
            </Label>
            <Select
              value={formData.fleetVehicleId}
              onValueChange={(value) => setFormData({ ...formData, fleetVehicleId: value })}
              disabled={isLoadingVehicles}
            >
              <SelectTrigger id="fleetVehicle">
                <SelectValue placeholder={isLoadingVehicles ? "Cargando vehículos..." : "Seleccionar vehículo de flota"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin vehículo de flota (cliente particular)</SelectItem>
                {vehicles.map((vehicle) => (
                  <SelectItem key={vehicle.documentId} value={vehicle.documentId}>
                    {vehicle.brand} {vehicle.model} {vehicle.placa && `(${vehicle.placa})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
              "Crear Cita"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
