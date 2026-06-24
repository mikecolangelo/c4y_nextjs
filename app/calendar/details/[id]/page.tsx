"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  Pencil,
  MoreVertical,
  Trash2,
  Ban,
  Banknote,
  Car,
  Wrench,
  Bell,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  User,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AdminLayout } from "@/components/admin/admin-layout";
import { BackButton } from "@/components/admin/back-button";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Badge } from "@/components_shadcn/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type {
  AppointmentV2,
  AppointmentType,
  AppointmentStatus,
  AppointmentFrequency,
} from "@/validations/types";
import { useAppointments } from "../../hooks/use-appointments";

const typeMeta: Record<
  AppointmentType,
  { icon: typeof Banknote; label: string; color: string; bg: string }
> = {
  venta: {
    icon: Banknote,
    label: "Venta",
    color: "text-orange-600",
    bg: "bg-orange-100",
  },
  prueba: {
    icon: Car,
    label: "Prueba de Conducción",
    color: "text-green-600",
    bg: "bg-green-100",
  },
  mantenimiento: {
    icon: Wrench,
    label: "Mantenimiento",
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  recordatorio: {
    icon: Bell,
    label: "Recordatorio",
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
};

function statusBadgeClasses(status: AppointmentV2["status"]) {
  switch (status) {
    case "confirmada":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "pendiente":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "cancelada":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    default:
      return "";
  }
}

interface FleetOption {
  documentId: string;
  name: string;
  placa?: string;
}

interface ServiceOption {
  documentId: string;
  name: string;
  price?: number;
}

export default function AppointmentDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [appointment, setAppointment] = useState<AppointmentV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const { updateAppointment, deleteAppointment } = useAppointments();

  // Load appointment
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/calendar/${id}`, { cache: "no-store" });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Error desconocido" }));
          throw new Error(err.error || `Error ${res.status}`);
        }
        const json = await res.json();
        setAppointment(json.data);
        setNoteDraft(json.data?.notes || "");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [id]);

  // Edit form state
  const [editType, setEditType] = useState<AppointmentType>("venta");
  const [editStatus, setEditStatus] = useState<AppointmentStatus>("pendiente");
  const [editFrequency, setEditFrequency] = useState<AppointmentFrequency>("unica");
  const [editTitle, setEditTitle] = useState("");
  const [editDuration, setEditDuration] = useState<number | "">("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrice, setEditPrice] = useState<number | "">("");
  const [editLocation, setEditLocation] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactEmail, setEditContactEmail] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editVehicle, setEditVehicle] = useState("");
  const [editService, setEditService] = useState("");
  const [fleetOptions, setFleetOptions] = useState<FleetOption[]>([]);
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([]);

  useEffect(() => {
    if (!isEditing) return;

    const loadFleet = async () => {
      try {
        const res = await fetch("/api/vehicle-selector", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setFleetOptions(
          (json.data || []).map((v: any) => ({
            documentId: v.documentId || String(v.id),
            name: v.name || "",
            placa: v.placa,
          }))
        );
      } catch {
        // noop
      }
    };

    const loadServices = async () => {
      try {
        const res = await fetch("/api/services", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setServiceOptions(
          (json.data || []).map((s: any) => ({
            documentId: s.documentId || String(s.id),
            name: s.name || "",
            price: s.price,
          }))
        );
      } catch {
        // noop
      }
    };

    loadFleet();
    loadServices();
  }, [isEditing]);

  useEffect(() => {
    if (appointment && isEditing) {
      setEditType(appointment.type);
      setEditStatus(appointment.status);
      setEditFrequency(appointment.frequency);
      setEditTitle(appointment.title || "");
      setEditDuration(appointment.durationMinutes ?? "");
      setEditDescription(appointment.description || "");
      setEditPrice(appointment.price ?? "");
      setEditLocation(appointment.location || "");
      setEditContactPhone(appointment.contactPhone || "");
      setEditContactEmail(appointment.contactEmail || "");
      setEditClientName(appointment.clientName || "");
      setEditVehicle(appointment.vehicle?.documentId || "");
      setEditService(appointment.service?.documentId || "");
    }
  }, [appointment, isEditing]);

  const handleSaveEdit = async () => {
    if (!appointment) return;
    setIsSaving(true);
    try {
      await updateAppointment(appointment.documentId, {
        type: editType,
        status: editStatus,
        frequency: editFrequency,
        title: editTitle.trim() || undefined,
        durationMinutes: editDuration === "" ? undefined : Number(editDuration),
        description: editDescription.trim() || undefined,
        price: editPrice === "" ? undefined : Number(editPrice),
        location: editLocation.trim() || undefined,
        contactPhone: editContactPhone.trim() || undefined,
        contactEmail: editContactEmail.trim() || undefined,
        clientName: editClientName.trim() || undefined,
        vehicle: editVehicle || undefined,
        service: editService || undefined,
      });
      toast.success("Cita actualizada");
      setIsEditing(false);
      // reload local state
      const res = await fetch(`/api/calendar/${id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setAppointment(json.data);
        setNoteDraft(json.data?.notes || "");
      }
    } catch (e: any) {
      toast.error(e.message || "Error al actualizar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!appointment) return;
    setIsSaving(true);
    try {
      await updateAppointment(appointment.documentId, { notes: noteDraft.trim() || undefined });
      toast.success("Notas guardadas");
      const res = await fetch(`/api/calendar/${id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setAppointment(json.data);
        setNoteDraft(json.data?.notes || "");
      }
    } catch (e: any) {
      toast.error(e.message || "Error al guardar notas");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelAppointment = async () => {
    if (!appointment) return;
    if (!confirm("¿Deseas cancelar esta cita?")) return;
    try {
      await updateAppointment(appointment.documentId, { status: "cancelada" });
      toast.success("Cita cancelada");
      const res = await fetch(`/api/calendar/${id}`, { cache: "no-store" });
      if (res.ok) {
        const json = await res.json();
        setAppointment(json.data);
      }
    } catch (e: any) {
      toast.error(e.message || "Error al cancelar");
    }
  };

  const handleDeleteAppointment = async () => {
    if (!appointment) return;
    if (!confirm("¿Estás seguro de eliminar esta cita?")) return;
    try {
      await deleteAppointment(appointment.documentId);
      toast.success("Cita eliminada");
      router.push("/calendar");
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar");
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Cita" leftActions={<BackButton fallbackHref="/calendar" />}>
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !appointment) {
    return (
      <AdminLayout title="Cita" leftActions={<BackButton fallbackHref="/calendar" />}>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <p className="text-muted-foreground">{error || "Cita no encontrada"}</p>
          <Button variant="outline" onClick={() => router.push("/calendar")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al calendario
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const meta = typeMeta[appointment.type];
  const Icon = meta.icon;
  function safeDateFromParts(year?: number, month?: number, day?: number): Date | null {
    if (
      year == null ||
      month == null ||
      day == null ||
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  }

  const aptDate = safeDateFromParts(appointment.year, appointment.month, appointment.day);

  return (
    <AdminLayout
      title={appointment.title || "Detalle de Cita"}
      leftActions={<BackButton fallbackHref="/calendar" />}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header card */}
        <Card className="shadow-sm">
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
                    meta.bg
                  )}
                >
                  <Icon className={cn("h-7 w-7", meta.color)} />
                </div>
                <div>
                  <h1 className={typography.h2}>{appointment.title || "Sin título"}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground">{meta.label}</span>
                    <Badge
                      className={cn("rounded-md text-xs", statusBadgeClasses(appointment.status))}
                    >
                      {appointment.status}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {appointment.contactPhone && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`tel:${appointment.contactPhone}`}>
                      <Phone className="mr-2 h-4 w-4" />
                      Llamar
                    </a>
                  </Button>
                )}
                {appointment.contactEmail && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={`mailto:${appointment.contactEmail}`}>
                      <Mail className="mr-2 h-4 w-4" />
                      Correo
                    </a>
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-9 w-9">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar Cita
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCancelAppointment}>
                      <Ban className="mr-2 h-4 w-4" />
                      Cancelar Cita
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={handleDeleteAppointment}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Cita
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Detalles de la Cita</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={editType}
                      onValueChange={(v) => setEditType(v as AppointmentType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prueba">Prueba de Conducción</SelectItem>
                        <SelectItem value="venta">Venta</SelectItem>
                        <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Select
                      value={editStatus}
                      onValueChange={(v) => setEditStatus(v as AppointmentStatus)}
                    >
                      <SelectTrigger>
                        <SelectValue />
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
                    <Label>Frecuencia</Label>
                    <Select
                      value={editFrequency}
                      onValueChange={(v) => setEditFrequency(v as AppointmentFrequency)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unica">Única</SelectItem>
                        <SelectItem value="semanal">Semanal</SelectItem>
                        <SelectItem value="quincenal">Quincenal</SelectItem>
                        <SelectItem value="mensual">Mensual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duración (min)</Label>
                    <Input
                      type="number"
                      value={editDuration}
                      onChange={(e) =>
                        setEditDuration(e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Vehículo</Label>
                    <Select value={editVehicle} onValueChange={setEditVehicle}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona vehículo" />
                      </SelectTrigger>
                      <SelectContent>
                        {fleetOptions.map((v) => (
                          <SelectItem key={v.documentId} value={v.documentId}>
                            {v.name} {v.placa ? `(${v.placa})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Servicio</Label>
                    <Select value={editService} onValueChange={setEditService}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona servicio" />
                      </SelectTrigger>
                      <SelectContent>
                        {serviceOptions.map((s) => (
                          <SelectItem key={s.documentId} value={s.documentId}>
                            {s.name} {s.price != null ? `- $${s.price}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Precio</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) =>
                        setEditPrice(e.target.value === "" ? "" : Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ubicación</Label>
                    <Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={editContactPhone}
                      onChange={(e) => setEditContactPhone(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      value={editContactEmail}
                      onChange={(e) => setEditContactEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Input
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveEdit} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Hora</p>
                    <p className="text-sm font-medium">
                      {appointment.time} {appointment.period}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="text-sm font-medium">
                      {aptDate
                        ? format(aptDate, "EEEE, d 'de' MMMM, yyyy", { locale: es })
                        : "Fecha no disponible"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="text-sm font-medium">{appointment.clientName || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Car className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Vehículo</p>
                    <p className="text-sm font-medium">
                      {appointment.vehicle
                        ? `${appointment.vehicle.name}${appointment.vehicle.placa ? ` (${appointment.vehicle.placa})` : ""}`
                        : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ubicación</p>
                    <p className="text-sm font-medium">{appointment.location || "—"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Precio</p>
                    <p className="text-sm font-medium">
                      {appointment.priceLabel ||
                        (appointment.price != null ? `$${appointment.price}` : "—")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Asignado a</p>
                    <p className="text-sm font-medium">
                      {appointment.assignedTo?.displayName || "—"}
                    </p>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Descripción</p>
                  <p className="mt-1 text-sm">{appointment.description || "—"}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notes card */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Notas Adicionales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Añade notas sobre esta cita..."
              rows={4}
            />
            <div className="flex justify-end">
              <Button onClick={handleSaveNotes} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Notas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
