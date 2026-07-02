"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components_shadcn/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { Calendar as CalendarIcon, Plus, Loader2 } from "lucide-react";
import { Calendar } from "@/components_shadcn/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";

import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/lib/toast";
import { Can } from "@/components/auth/can";
import type { AppointmentType, AppointmentStatus, AppointmentFrequency } from "@/validations/types";

export interface CreatePayload {
  title?: string;
  type: AppointmentType;
  status?: AppointmentStatus;
  scheduledDate: string;
  scheduledTime?: string;
  isAllDay?: boolean;
  frequency?: AppointmentFrequency;
  durationMinutes?: number;
  description?: string;
  price?: number;
  notes?: string;
  location?: string;
  contactPhone?: string;
  contactEmail?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicle?: string;
  service?: string;
}

interface FleetOption {
  id: string;
  documentId: string;
  name: string;
  placa?: string;
}

interface ServiceOption {
  id: string;
  documentId: string;
  name: string;
  price?: number;
  coverage?: "cliente" | "empresa";
}

interface AppointmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreatePayload) => void;
  isSubmitting?: boolean;
  defaultValues?: Partial<CreatePayload>;
  mode?: "create" | "edit";
}

function toISODate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function AppointmentDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isSubmitting,
  defaultValues,
  mode = "create",
}: AppointmentDialogProps) {
  const [fleetOptions, setFleetOptions] = useState<FleetOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);
  const [isLoadingServices, setIsLoadingServices] = useState(false);

  const [type, setType] = useState<AppointmentType>("venta");
  const [frequency, setFrequency] = useState<AppointmentFrequency>("unica");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<AppointmentStatus>("pendiente");
  const [durationMinutes, setDurationMinutes] = useState<number | "">("");
  const [vehicle, setVehicle] = useState<string>("");
  const [service, setService] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("09:00");
  const [isAllDay, setIsAllDay] = useState(false);
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");

  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState<string>("");
  const [isCreatingService, setIsCreatingService] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadFleet = async () => {
      setIsLoadingFleet(true);
      try {
        const res = await fetch("/api/vehicle-selector", { cache: "no-store" });
        if (!res.ok) throw new Error("Error cargando flota");
        const json = await res.json();
        const data = (json.data || []).map((v: any) => ({
          id: String(v.id),
          documentId: v.documentId || String(v.id),
          name: v.name || "",
          placa: v.placa,
        }));
        setFleetOptions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingFleet(false);
      }
    };

    const loadServices = async () => {
      setIsLoadingServices(true);
      try {
        const res = await fetch("/api/services", { cache: "no-store" });
        if (!res.ok) throw new Error("Error cargando servicios");
        const json = await res.json();
        const data = (json.data || []).map((s: any) => ({
          id: String(s.id),
          documentId: s.documentId || String(s.id),
          name: s.name || "",
          price: s.price,
          coverage: s.coverage,
        }));
        setServiceOptions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoadingServices(false);
      }
    };

    loadFleet();
    loadServices();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (mode === "edit" && defaultValues) {
      setType(defaultValues.type || "venta");
      setFrequency(defaultValues.frequency || "unica");
      setTitle(defaultValues.title || "");
      setStatus(defaultValues.status || "pendiente");
      setDurationMinutes(defaultValues.durationMinutes ?? "");
      setVehicle(defaultValues.vehicle || "");
      setService(defaultValues.service || "");
      setScheduledDate(defaultValues.scheduledDate || toISODate(new Date()));
      setScheduledTime(defaultValues.scheduledTime || "09:00");
      setIsAllDay(defaultValues.isAllDay || false);
      setDescription(defaultValues.description || "");
      setPrice(defaultValues.price ?? "");
      setLocation(defaultValues.location || "");
      setContactPhone(defaultValues.contactPhone || "");
      setContactEmail(defaultValues.contactEmail || "");
      setClientName(defaultValues.clientName || "");
      setNotes(defaultValues.notes || "");
    } else {
      setType("venta");
      setFrequency("unica");
      setTitle("");
      setStatus("pendiente");
      setDurationMinutes("");
      setVehicle("");
      setService("");
      setScheduledDate(toISODate(new Date()));
      setScheduledTime("09:00");
      setIsAllDay(false);
      setDescription("");
      setPrice("");
      setLocation("");
      setContactPhone("");
      setContactEmail("");
      setClientName("");
      setNotes("");
    }
  }, [isOpen, mode, defaultValues]);

  const dateObj = useMemo(() => {
    return scheduledDate ? new Date(scheduledDate + "T00:00:00") : undefined;
  }, [scheduledDate]);

  const handleSubmit = () => {
    if (!scheduledDate) {
      toast.error("La fecha es requerida");
      return;
    }

    const payload: CreatePayload = {
      title: title.trim() || undefined,
      type,
      status,
      scheduledDate,
      scheduledTime: isAllDay ? undefined : scheduledTime,
      isAllDay,
      frequency,
      durationMinutes: durationMinutes === "" ? undefined : Number(durationMinutes),
      description: description.trim() || undefined,
      price: price === "" ? undefined : Number(price),
      notes: notes.trim() || undefined,
      location: location.trim() || undefined,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      clientName: clientName.trim() || undefined,
      clientPhone: undefined,
      clientEmail: undefined,
      vehicle: vehicle || undefined,
      service: service || undefined,
    };

    onSubmit(payload);
  };

  const handleCreateService = async () => {
    if (!newServiceName.trim()) {
      toast.error("El nombre del servicio es requerido");
      return;
    }
    setIsCreatingService(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            name: newServiceName.trim(),
            price: newServicePrice ? Number(newServicePrice) : 0,
            coverage: "cliente",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const json = await res.json();
      const created = json.data;
      toast.success("Servicio creado");
      setServiceOptions((prev) => [
        ...prev,
        {
          id: String(created.id),
          documentId: created.documentId || String(created.id),
          name: created.name,
          price: created.price,
          coverage: created.coverage,
        },
      ]);
      setService(created.documentId || String(created.id));
      setIsServiceModalOpen(false);
      setNewServiceName("");
      setNewServicePrice("");
    } catch (e: any) {
      toast.error(e.message || "Error creando servicio");
    } finally {
      setIsCreatingService(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle>{mode === "edit" ? "Editar Cita" : "Agregar Nueva Cita"}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="space-y-4 px-6 py-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo de Cita</Label>
                <Select value={type} onValueChange={(v) => setType(v as AppointmentType)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prueba">Prueba de Conducción</SelectItem>
                    <SelectItem value="venta">Venta</SelectItem>
                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Frecuencia</Label>
                <Select
                  value={frequency}
                  onValueChange={(v) => setFrequency(v as AppointmentFrequency)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona frecuencia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unica">Única</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="quincenal">Quincenal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título opcional"
                />
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as AppointmentStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="confirmada">Confirmada</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Duración (minutos)</Label>
                <Input
                  type="number"
                  min={0}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Ej: 60"
                />
              </div>

              <div className="space-y-2">
                <Label>Vehículo de Flota</Label>
                <Select value={vehicle} onValueChange={setVehicle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona vehículo" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingFleet ? (
                      <div className="p-2 text-sm text-muted-foreground">Cargando...</div>
                    ) : (
                      fleetOptions.map((v) => (
                        <SelectItem key={v.documentId} value={v.documentId}>
                          {v.name} {v.placa ? `(${v.placa})` : ""}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Servicio</Label>
                <Can module="adm-services" action="canCreate">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-auto gap-1 px-2 py-1 text-xs"
                    onClick={() => setIsServiceModalOpen(true)}
                  >
                    <Plus className="h-3 w-3" />
                    Nuevo Servicio
                  </Button>
                </Can>
              </div>
              <Select value={service} onValueChange={setService}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona servicio" />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingServices ? (
                    <div className="p-2 text-sm text-muted-foreground">Cargando...</div>
                  ) : (
                    serviceOptions.map((s) => (
                      <SelectItem key={s.documentId} value={s.documentId}>
                        {s.name} {s.price != null ? `- $${s.price}` : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha y Hora</Label>
              <div className="flex flex-wrap items-center gap-3">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[200px] justify-start text-left font-normal",
                        !dateObj && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateObj ? format(dateObj, "PPP", { locale: es }) : "Selecciona fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateObj}
                      onSelect={(d) => d && setScheduledDate(toISODate(d))}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                {!isAllDay && (
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-[120px]"
                  />
                )}

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="isAllDay"
                    checked={isAllDay}
                    onCheckedChange={(c) => setIsAllDay(Boolean(c))}
                  />
                  <Label htmlFor="isAllDay" className="font-normal">
                    Todo el día
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción de la cita"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Precio / Costo</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label>Ubicación</Label>
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Lugar de la cita"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Teléfono de contacto</Label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+52..."
                />
              </div>

              <div className="space-y-2">
                <Label>Email de contacto</Label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nombre del cliente</Label>
              <Input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Cliente"
              />
            </div>

            <div className="space-y-2">
              <Label>Notas</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionales"
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 shrink-0 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "edit" ? "Guardar" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <Dialog open={isServiceModalOpen} onOpenChange={setIsServiceModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo Servicio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nombre del servicio</Label>
              <Input
                value={newServiceName}
                onChange={(e) => setNewServiceName(e.target.value)}
                placeholder="Ej: Cambio de aceite"
              />
            </div>
            <div className="space-y-2">
              <Label>Precio</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={newServicePrice}
                onChange={(e) => setNewServicePrice(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsServiceModalOpen(false)}
              disabled={isCreatingService}
            >
              Cancelar
            </Button>
            <Button onClick={handleCreateService} disabled={isCreatingService}>
              {isCreatingService && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
