"use client";

import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

import {
  Car,
  User,
  Banknote,
  Calendar,
  Search,
  Loader2,
  FileText,
  UserPlus,
  Bell,
  AlertTriangle,
  Percent,
} from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import { Calendar as CalendarComponent } from "@/components_shadcn/ui/calendar";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components_shadcn/ui/command";
import { Avatar, AvatarFallback } from "@/components_shadcn/ui/avatar";
import { Badge } from "@/components_shadcn/ui/badge";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import { FinancingCalculator, QuickUserCreate, type CreatedUser } from "@/components/ui/billing";
import type { PaymentFrequency } from "@/lib/financing";

// Tipos
interface VehicleOption {
  id: string;
  documentId: string;
  name: string;
  placa?: string;
  brand?: string;
  hasActiveFinancing?: boolean;
}

interface ClientOption {
  id: string;
  documentId: string;
  displayName: string;
  email?: string;
  cedula?: string;
}

export interface CreateFinancingFormData {
  vehicleId: string;
  vehicleDocumentId: string;
  vehicleName: string;
  clientId: string;
  clientDocumentId: string;
  clientName: string;
  totalAmount: number;
  financingPeriods: number; // Número de períodos según frecuencia (semanas, quincenas, meses)
  paymentFrequency: PaymentFrequency;
  startDate: string;
  notes: string;
}

interface CreateFinancingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const frequencyOptions: { value: PaymentFrequency; label: string }[] = [
  { value: "semanal", label: "Semanal (cada 7 días)" },
  { value: "quincenal", label: "Quincenal (cada 15 días)" },
  { value: "mensual", label: "Mensual (cada 30 días)" },
];

export function CreateFinancingDialog({
  isOpen,
  onOpenChange,
  onSuccess,
}: CreateFinancingDialogProps) {
  // Estado del formulario
  const [formData, setFormData] = useState<CreateFinancingFormData>({
    vehicleId: "",
    vehicleDocumentId: "",
    vehicleName: "",
    clientId: "",
    clientDocumentId: "",
    clientName: "",
    totalAmount: 0,
    financingPeriods: 220, // 220 semanas ≈ 4.2 años
    paymentFrequency: "semanal",
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Estados de UI
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vehículos
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(false);
  const [vehicleSearchOpen, setVehicleSearchOpen] = useState(false);

  // Clientes
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);

  // Cargar vehículos disponibles
  useEffect(() => {
    if (!isOpen) return;

    const loadVehicles = async () => {
      setIsLoadingVehicles(true);
      try {
        const response = await fetch("/api/vehicle-selector");
        if (response.ok) {
          const data = await response.json();
          // Mapear y filtrar vehículos sin financiamiento activo
          const mappedVehicles: VehicleOption[] = (data.data || []).map(
            (v: {
              id: string;
              documentId: string;
              name: string;
              placa?: string;
              brand?: string;
              financing?: { status?: string };
            }) => ({
              id: v.id,
              documentId: v.documentId,
              name: v.name,
              placa: v.placa,
              brand: v.brand,
              // Solo considerar activo si el financiamiento está en estado "activo" o "en_mora"
              hasActiveFinancing:
                v.financing &&
                (v.financing.status === "activo" || v.financing.status === "en_mora"),
            })
          );
          setVehicles(mappedVehicles);
        }
      } catch (err) {
        console.error("Error loading vehicles:", err);
      } finally {
        setIsLoadingVehicles(false);
      }
    };

    loadVehicles();
  }, [isOpen]);

  // Cargar clientes/contactos
  useEffect(() => {
    if (!isOpen) return;

    const loadClients = async () => {
      setIsLoadingClients(true);
      try {
        const response = await fetch("/api/user-profiles");
        if (response.ok) {
          const data = await response.json();
          const mappedClients: ClientOption[] = (data.data || []).map(
            (u: {
              id: string;
              documentId: string;
              displayName?: string;
              email?: string;
              cedula?: string;
            }) => ({
              id: u.id,
              documentId: u.documentId,
              displayName: u.displayName || "Sin nombre",
              email: u.email,
              cedula: u.cedula,
            })
          );
          setClients(mappedClients);
        }
      } catch (err) {
        console.error("Error loading clients:", err);
      } finally {
        setIsLoadingClients(false);
      }
    };

    loadClients();
  }, [isOpen]);

  // Vehículos disponibles (sin financiamiento activo)
  const availableVehicles = useMemo(() => {
    return vehicles.filter((v) => !v.hasActiveFinancing);
  }, [vehicles]);

  // Validación del formulario
  const isFormValid = useMemo(() => {
    return (
      formData.vehicleDocumentId !== "" &&
      formData.clientDocumentId !== "" &&
      formData.totalAmount > 0 &&
      formData.financingPeriods > 0 &&
      formData.startDate !== ""
    );
  }, [formData]);

  // Resetear formulario
  const resetForm = () => {
    setFormData({
      vehicleId: "",
      vehicleDocumentId: "",
      vehicleName: "",
      clientId: "",
      clientDocumentId: "",
      clientName: "",
      totalAmount: 0,
      financingPeriods: 220,
      paymentFrequency: "semanal",
      startDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setError(null);
  };

  // Convertir períodos (totalQuotas) a meses según frecuencia
  // Nota: los períodos son el número exacto de cuotas (semanas, quincenas, meses)
  const periodsToMonths = (periods: number, frequency: PaymentFrequency): number => {
    switch (frequency) {
      case "semanal":
        // semanas a meses: dividir por 4.33 semanas/mes
        return Math.round(periods / 4.33);
      case "quincenal":
        // quincenas a meses: dividir por 2 quincenas/mes
        return Math.round(periods / 2);
      case "mensual":
        // ya son meses
        return periods;
      default:
        return periods;
    }
  };

  // El número de períodos ES directamente el total de cuotas
  const totalQuotasFromPeriods = formData.financingPeriods;

  // Manejar cierre del diálogo
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
    }
    onOpenChange(open);
  };

  // Seleccionar vehículo
  const handleSelectVehicle = (vehicle: VehicleOption) => {
    setFormData((prev) => ({
      ...prev,
      vehicleId: vehicle.id,
      vehicleDocumentId: vehicle.documentId,
      vehicleName: `${vehicle.name}${vehicle.placa ? ` (${vehicle.placa})` : ""}`,
    }));
    setVehicleSearchOpen(false);
  };

  // Seleccionar cliente
  const handleSelectClient = (client: ClientOption) => {
    setFormData((prev) => ({
      ...prev,
      clientId: client.id,
      clientDocumentId: client.documentId,
      clientName: client.displayName,
    }));
    setClientSearchOpen(false);
  };

  // Callback para usuario creado rápidamente
  const handleUserCreated = (user: CreatedUser) => {
    // Añadir a la lista de clientes
    const newClient: ClientOption = {
      id: "",
      documentId: user.documentId,
      displayName: user.displayName,
      email: user.email,
      cedula: user.cedula,
    };
    setClients((prev) => [newClient, ...prev]);

    // Seleccionar automáticamente
    setFormData((prev) => ({
      ...prev,
      clientId: "",
      clientDocumentId: user.documentId,
      clientName: user.displayName,
    }));
  };

  // Crear financiamiento
  const handleCreate = async () => {
    if (!isFormValid) return;

    setIsCreating(true);
    setError(null);

    try {
      // Convertir períodos a meses para el backend
      const financingMonths = periodsToMonths(formData.financingPeriods, formData.paymentFrequency);

      const payload = {
        data: {
          totalAmount: formData.totalAmount,
          financingMonths: financingMonths,
          totalQuotas: formData.financingPeriods, // Enviar el número exacto de cuotas
          paymentFrequency: formData.paymentFrequency,
          startDate: formData.startDate,
          // Strapi v5: relaciones en POST requieren ID numérico, no documentId
          vehicle: Number(formData.vehicleId),
          client: Number(formData.clientId),
          notes: formData.notes || undefined,
        },
      };
      const response = await fetch("/api/financing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al crear el financiamiento");
      }

      // Éxito
      onSuccess?.();
      handleOpenChange(false);
    } catch (err) {
      console.error("Error creating financing:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] p-0 !flex !flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className={typography.h2}>Crear Nuevo Financiamiento</DialogTitle>
          <DialogDescription>
            Configure los términos del financiamiento vehicular. El sistema calculará
            automáticamente las cuotas según los parámetros seleccionados.
          </DialogDescription>
        </DialogHeader>

        <ScrollAreaPrimitive.Root className="relative flex-1 min-h-0 overflow-hidden">
          <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
            <div className="px-6 py-6">
              {/* Error */}
              {error && (
                <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-6">
                  {error}
                </div>
              )}

              {/* Contenido en una sola columna */}
              <div className="space-y-6">
                {/* Selección de Vehículo */}
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Car className="h-4 w-4 text-primary" />
                    </div>
                    Vehículo
                  </h3>

                  <Popover open={vehicleSearchOpen} onOpenChange={setVehicleSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between h-14 rounded-lg",
                          !formData.vehicleName && "text-muted-foreground"
                        )}
                      >
                        {formData.vehicleName ? (
                          <div className="flex items-center gap-3">
                            <Car className="h-5 w-5 text-primary" />
                            <span>{formData.vehicleName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            <span>Buscar vehículo...</span>
                          </div>
                        )}
                        {isLoadingVehicles && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre o placa..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron vehículos disponibles.</CommandEmpty>
                          <CommandGroup heading="Vehículos Disponibles">
                            {availableVehicles.map((vehicle) => (
                              <CommandItem
                                key={vehicle.documentId}
                                value={`${vehicle.name} ${vehicle.placa || ""}`}
                                onSelect={() => handleSelectVehicle(vehicle)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <Car className="h-5 w-5 text-muted-foreground" />
                                  <div className="flex flex-col flex-1">
                                    <span className={typography.body.large}>{vehicle.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {vehicle.brand || "Sin marca"} •{" "}
                                      {vehicle.placa || "Sin placa"}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs text-green-600">
                                    Disponible
                                  </Badge>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                          {vehicles.filter((v) => v.hasActiveFinancing).length > 0 && (
                            <CommandGroup heading="Vehículos con Financiamiento">
                              {vehicles
                                .filter((v) => v.hasActiveFinancing)
                                .map((vehicle) => (
                                  <CommandItem
                                    key={vehicle.documentId}
                                    disabled
                                    className="opacity-50"
                                  >
                                    <div className="flex items-center gap-3 w-full">
                                      <Car className="h-5 w-5 text-muted-foreground" />
                                      <div className="flex flex-col flex-1">
                                        <span className={typography.body.large}>
                                          {vehicle.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {vehicle.placa || "Sin placa"}
                                        </span>
                                      </div>
                                      <Badge variant="secondary" className="text-xs">
                                        Con financiamiento
                                      </Badge>
                                    </div>
                                  </CommandItem>
                                ))}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Selección de Cliente */}
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-blue-500/10">
                        <User className="h-4 w-4 text-blue-500" />
                      </div>
                      Cliente
                    </h3>
                    <QuickUserCreate
                      onUserCreated={handleUserCreated}
                      trigger={
                        <Button variant="ghost" size="sm" className="gap-1 h-8">
                          <UserPlus className="h-4 w-4" />
                          Crear nuevo
                        </Button>
                      }
                    />
                  </div>

                  <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn(
                          "w-full justify-between h-14 rounded-lg",
                          !formData.clientName && "text-muted-foreground"
                        )}
                      >
                        {formData.clientName ? (
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(formData.clientName)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{formData.clientName}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            <span>Buscar cliente...</span>
                          </div>
                        )}
                        {isLoadingClients && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar por nombre, email o cédula..." />
                        <CommandList>
                          <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                          <CommandGroup heading="Contactos del Sistema">
                            {clients.map((client) => (
                              <CommandItem
                                key={client.documentId}
                                value={`${client.displayName} ${client.email || ""} ${client.cedula || ""}`}
                                onSelect={() => handleSelectClient(client)}
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-3 w-full">
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="bg-muted text-xs">
                                      {getInitials(client.displayName)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className={typography.body.large}>
                                      {client.displayName}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {client.cedula || client.email || "Sin contacto"}
                                    </span>
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Parámetros de Financiamiento */}
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-green-500/10">
                      <Banknote className="h-4 w-4 text-green-500" />
                    </div>
                    Parámetros de Financiamiento
                  </h3>

                  {/* Monto Total */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="totalAmount" className={typography.label}>
                      Monto Total *
                    </Label>
                    <div className="relative">
                      <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="totalAmount"
                        type="number"
                        min={0}
                        step={100}
                        value={formData.totalAmount || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            totalAmount: parseFloat(e.target.value) || 0,
                          }))
                        }
                        placeholder="49500"
                        className="rounded-lg pl-10 h-12"
                      />
                    </div>
                  </div>

                  {/* Frecuencia y Duración en la misma fila */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="paymentFrequency" className={typography.label}>
                        Frecuencia de Pago *
                      </Label>
                      <Select
                        value={formData.paymentFrequency}
                        onValueChange={(v) =>
                          setFormData((prev) => ({
                            ...prev,
                            paymentFrequency: v as PaymentFrequency,
                          }))
                        }
                      >
                        <SelectTrigger className="rounded-lg h-12">
                          <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                          {frequencyOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Label htmlFor="financingDuration" className={typography.label}>
                        {formData.paymentFrequency === "semanal"
                          ? "Semanas de Financiamiento *"
                          : formData.paymentFrequency === "quincenal"
                            ? "Quincenas de Financiamiento *"
                            : "Meses de Financiamiento *"}
                      </Label>
                      <Input
                        id="financingDuration"
                        type="number"
                        min={1}
                        max={
                          formData.paymentFrequency === "semanal"
                            ? 520
                            : formData.paymentFrequency === "quincenal"
                              ? 240
                              : 120
                        }
                        step={1}
                        value={formData.financingPeriods || ""}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setFormData((prev) => ({
                            ...prev,
                            financingPeriods: value,
                          }));
                        }}
                        placeholder={
                          formData.paymentFrequency === "semanal"
                            ? "220"
                            : formData.paymentFrequency === "quincenal"
                              ? "108"
                              : "54"
                        }
                        className="rounded-lg h-12"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label className={typography.label}>Fecha de Inicio *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10 pl-3 rounded-lg",
                            !formData.startDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {formData.startDate
                            ? format(
                                new Date(`${formData.startDate}T00:00:00`),
                                "d 'de' MMMM, yyyy",
                                { locale: es }
                              )
                            : "Selecciona una fecha"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[200]" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={
                            formData.startDate
                              ? new Date(`${formData.startDate}T00:00:00`)
                              : undefined
                          }
                          onSelect={(date) => {
                            if (date) {
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, "0");
                              const d = String(date.getDate()).padStart(2, "0");
                              setFormData((prev) => ({
                                ...prev,
                                startDate: `${y}-${m}-${d}`,
                              }));
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Notas */}
                <div className="rounded-xl border bg-card p-5 space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <FileText className="h-4 w-4 text-amber-500" />
                    </div>
                    Notas (opcional)
                  </h3>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Notas adicionales sobre el financiamiento..."
                    rows={3}
                    className="rounded-lg resize-none"
                  />
                </div>

                {/* Información de Facturación Automática */}
                <div className="rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 p-5 space-y-4">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Bell className="h-4 w-4 text-blue-500" />
                    </div>
                    Ciclo de Facturación Automática
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Día de facturación */}
                    <div className="flex items-start gap-3 p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                      <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Facturación</p>
                        <p className="text-xs text-muted-foreground">Todos los martes</p>
                      </div>
                    </div>

                    {/* Fecha límite */}
                    <div className="flex items-start gap-3 p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                      <div className="p-2 rounded-full bg-amber-100 dark:bg-amber-900/30">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Límite de Pago</p>
                        <p className="text-xs text-muted-foreground">Jueves de cada semana</p>
                      </div>
                    </div>

                    {/* Penalidad */}
                    <div className="flex items-start gap-3 p-3 bg-white/50 dark:bg-white/5 rounded-lg">
                      <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
                        <Percent className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Penalidad por Mora</p>
                        <p className="text-xs text-muted-foreground">10% sobre la cuota</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white/70 dark:bg-white/5 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      <strong>Nota:</strong> Las facturas se generan automáticamente cada martes. El
                      cliente tiene hasta el jueves para realizar el pago. Si el pago no se recibe
                      antes del viernes, se aplicará una penalidad del 10% sobre el monto de la
                      cuota y la factura pasará a estado vencido.
                    </p>
                  </div>
                </div>

                {/* Calculadora */}
                <FinancingCalculator
                  totalAmount={formData.totalAmount}
                  financingMonths={periodsToMonths(
                    formData.financingPeriods,
                    formData.paymentFrequency
                  )}
                  paymentFrequency={formData.paymentFrequency}
                  startDate={formData.startDate}
                  totalQuotas={formData.financingPeriods}
                  showInputs={false}
                  readOnly={true}
                />
              </div>
            </div>
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.ScrollAreaScrollbar
            orientation="vertical"
            className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
          >
            <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
          </ScrollAreaPrimitive.ScrollAreaScrollbar>
        </ScrollAreaPrimitive.Root>

        <DialogFooter className="px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !isFormValid}
            className={cn(
              "font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              !isCreating &&
                isFormValid &&
                "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 !opacity-100",
              (isCreating || !isFormValid) && "!opacity-50 cursor-not-allowed"
            )}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creando...
              </>
            ) : (
              "Crear Financiamiento"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CreateFinancingDialog;
