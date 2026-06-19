"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components_shadcn/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components_shadcn/ui/alert-dialog";
import { Calendar as CalendarComponent } from "@/components_shadcn/ui/calendar";
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
import { MultiSelectCombobox } from "@/components_shadcn/ui/multi-select-combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";
import Image from "next/image";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, Plus, Upload } from "lucide-react";
import { spacing, typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import type { Dispatch, SetStateAction, ChangeEvent } from "react";
import type { FleetVehicleCondition } from "@/validations/types";

type UserProfile = {
  id: number;
  documentId?: string;
  displayName?: string;
  email?: string;
  avatar?: {
    url?: string;
    alternativeText?: string;
  };
};

export type MaintenanceRecurrencePattern = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";

export interface CreateVehicleFormData {
  name: string;
  vin: string;
  price: string;
  condition: FleetVehicleCondition;
  brand: string;
  model: string;
  year: string;
  color: string;
  currentMileage: string;
  fuelType: string;
  transmission: string;
  imageAlt: string;
  placa: string;
}

interface CreateVehicleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: CreateVehicleFormData;
  setFormData: Dispatch<SetStateAction<CreateVehicleFormData>>;
  handleImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  imagePreview: string | null;
  isCreating: boolean;
  isFormValid: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  maintenanceScheduledDate: string;
  setMaintenanceScheduledDate: Dispatch<SetStateAction<string>>;
  maintenanceScheduledTime: string;
  setMaintenanceScheduledTime: Dispatch<SetStateAction<string>>;
  maintenanceIsAllDay: boolean;
  setMaintenanceIsAllDay: Dispatch<SetStateAction<boolean>>;
  maintenanceRecurrencePattern: MaintenanceRecurrencePattern;
  setMaintenanceRecurrencePattern: Dispatch<SetStateAction<MaintenanceRecurrencePattern>>;
  maintenanceRecurrenceEndDate: string;
  setMaintenanceRecurrenceEndDate: Dispatch<SetStateAction<string>>;
  availableUsers: UserProfile[];
  isLoadingUsers: boolean;
  selectedResponsables: number[];
  selectedAssignedDrivers: number[];
  onResponsablesChange: (values: Array<number | string>) => void;
  onDriversChange: (values: Array<number | string>) => void;
  conditions: FleetVehicleCondition[];
}

interface DeleteVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName?: string | null;
  isDeleting: boolean;
  onDelete: () => Promise<void>;
}

interface DeleteMultipleVehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  isDeleting: boolean;
  onConfirm: () => Promise<void>;
}

export function AddVehicleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 z-50"
      size="icon"
      onClick={onClick}
      aria-label="Agregar nuevo vehículo"
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}

export function CreateVehicleDialog({
  isOpen,
  onOpenChange,
  formData,
  setFormData,
  handleImageChange,
  imagePreview,
  isCreating,
  isFormValid,
  onConfirm,
  onCancel,
  maintenanceScheduledDate,
  setMaintenanceScheduledDate,
  maintenanceScheduledTime,
  setMaintenanceScheduledTime,
  maintenanceIsAllDay,
  setMaintenanceIsAllDay,
  maintenanceRecurrencePattern,
  setMaintenanceRecurrencePattern,
  maintenanceRecurrenceEndDate,
  setMaintenanceRecurrenceEndDate,
  availableUsers,
  isLoadingUsers,
  selectedResponsables,
  selectedAssignedDrivers,
  onResponsablesChange,
  onDriversChange,
  conditions,
}: CreateVehicleDialogProps) {
  const userOptions = availableUsers.map((user) => ({
    value: user.id,
    label: user.displayName || user.email || "Usuario",
    email: user.email,
    avatar: user.avatar,
  }));

  const resolveMeridiemValue = () => {
    if (!maintenanceScheduledTime) return "AM";
    const [hours] = maintenanceScheduledTime.split(":");
    const hour24 = parseInt(hours, 10);
    return hour24 >= 12 ? "PM" : "AM";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className={typography.h3}>Agregar Nuevo Vehículo</DialogTitle>
          <DialogDescription>
            Completa los campos para agregar un nuevo vehículo a la flota. Los campos marcados con *
            son obligatorios.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Básica *</TabsTrigger>
            <TabsTrigger value="specs">Especificaciones</TabsTrigger>
            <TabsTrigger value="extra">Adicional</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Información Básica</h3>

              <div className="flex flex-col gap-2">
                <Label htmlFor="name" className={typography.label}>
                  Nombre del Vehículo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Ford Mustang 2023"
                  className="rounded-lg"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="vin" className={typography.label}>
                  VIN <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="vin"
                  value={formData.vin}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, vin: e.target.value.toUpperCase() }))
                  }
                  placeholder="Ej: 1ZVBP8CM0D5281234"
                  className="rounded-lg"
                  maxLength={17}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="brand" className={typography.label}>
                    Marca <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="brand"
                    value={formData.brand}
                    onChange={(e) => setFormData((prev) => ({ ...prev, brand: e.target.value }))}
                    placeholder="Ej: Ford"
                    className="rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="model" className={typography.label}>
                    Modelo <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData((prev) => ({ ...prev, model: e.target.value }))}
                    placeholder="Ej: Mustang"
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="year" className={typography.label}>
                    Año <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="year"
                    type="number"
                    value={formData.year}
                    onChange={(e) => setFormData((prev) => ({ ...prev, year: e.target.value }))}
                    placeholder="Ej: 2023"
                    className="rounded-lg"
                    min={1900}
                    max={2100}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="condition" className={typography.label}>
                    Estado <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.condition}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        condition: value as FleetVehicleCondition,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]" align="end">
                      {conditions.map((condition) => (
                        <SelectItem key={condition} value={condition}>
                          <span className="capitalize">{condition}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Precio</h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="price" className={typography.label}>
                  Precio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="Ej: 55000"
                  className="rounded-lg"
                  min={0}
                  step="0.01"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="specs" className="space-y-4 mt-4">
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Detalles Adicionales</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="color" className={typography.label}>
                    Color
                  </Label>
                  <Input
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
                    placeholder="Ej: Plata Metálico"
                    className="rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="currentMileage" className={typography.label}>
                    Kilometraje
                  </Label>
                  <Input
                    id="currentMileage"
                    type="number"
                    value={formData.currentMileage}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, currentMileage: e.target.value }))
                    }
                    placeholder="Ej: 35000"
                    className="rounded-lg"
                    min={0}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="fuelType" className={typography.label}>
                    Tipo de Combustible
                  </Label>
                  <Input
                    id="fuelType"
                    value={formData.fuelType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fuelType: e.target.value }))}
                    placeholder="Ej: Gasolina, Híbrido, Eléctrico"
                    className="rounded-lg"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="transmission" className={typography.label}>
                    Transmisión
                  </Label>
                  <Input
                    id="transmission"
                    value={formData.transmission}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, transmission: e.target.value }))
                    }
                    placeholder="Ej: Automática, Manual, CVT"
                    className="rounded-lg"
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="extra" className="space-y-4 mt-4">
            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Información Adicional</h3>

              <div className="flex flex-col gap-2">
                <Label htmlFor="placa" className={typography.label}>
                  Placa
                </Label>
                <Input
                  id="placa"
                  value={formData.placa}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, placa: e.target.value.toUpperCase() }))
                  }
                  placeholder="Ej: ABC-123"
                  className="rounded-lg"
                />
              </div>

              <div className={`flex flex-col ${spacing.gap.base}`}>
                <h3 className={typography.h4}>Mantenimiento Recurrente</h3>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label>Fecha y Hora Programada</Label>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col lg:flex-row gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full lg:flex-1 justify-start text-left font-normal h-10 pl-3 rounded-lg",
                              !maintenanceScheduledDate && "text-muted-foreground"
                            )}
                          >
                            <Calendar className="mr-2 h-4 w-4" />
                            {maintenanceScheduledDate ? (
                              format(
                                new Date(`${maintenanceScheduledDate}T00:00:00`),
                                "d 'de' MMMM, yyyy",
                                { locale: es }
                              )
                            ) : (
                              <span>Selecciona una fecha</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={
                              maintenanceScheduledDate
                                ? new Date(`${maintenanceScheduledDate}T00:00:00`)
                                : undefined
                            }
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                setMaintenanceScheduledDate(`${year}-${month}-${day}`);
                              }
                            }}
                            disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <div className="flex flex-col sm:flex-row gap-2 lg:flex-1 items-center">
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={
                            maintenanceScheduledTime
                              ? String(
                                  (() => {
                                    const [hours] = maintenanceScheduledTime.split(":");
                                    const hour24 = parseInt(hours, 10);
                                    return hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                                  })()
                                )
                              : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            if (
                              value === "" ||
                              (parseInt(value, 10) >= 1 && parseInt(value, 10) <= 12)
                            ) {
                              const currentMinutes = maintenanceScheduledTime
                                ? maintenanceScheduledTime.split(":")[1] || "00"
                                : "00";
                              const currentHour24 = maintenanceScheduledTime
                                ? parseInt(maintenanceScheduledTime.split(":")[0], 10)
                                : 0;
                              const isPM = currentHour24 >= 12;

                              if (value === "") {
                                setMaintenanceScheduledTime(`00:${currentMinutes}`);
                              } else {
                                const hour12 = parseInt(value, 10);
                                const hour24 =
                                  hour12 === 12 ? (isPM ? 12 : 0) : isPM ? hour12 + 12 : hour12;
                                const newTime = `${String(hour24).padStart(2, "0")}:${currentMinutes}`;

                                // Validar si la fecha es hoy y la hora es menor a 30 minutos después de ahora
                                if (
                                  maintenanceScheduledDate ===
                                  new Date().toISOString().split("T")[0]
                                ) {
                                  const now = new Date();
                                  const minTime = new Date(now.getTime() + 30 * 60000); // 30 minutos después
                                  const selectedDateTime = new Date(
                                    `${maintenanceScheduledDate}T${newTime}`
                                  );

                                  if (selectedDateTime < minTime) {
                                    // Ajustar a la hora mínima permitida
                                    const minHours = String(minTime.getHours()).padStart(2, "0");
                                    const minMinutes = String(minTime.getMinutes()).padStart(
                                      2,
                                      "0"
                                    );
                                    setMaintenanceScheduledTime(`${minHours}:${minMinutes}`);
                                    return;
                                  }
                                }

                                setMaintenanceScheduledTime(newTime);
                              }
                              if (!maintenanceScheduledTime) {
                                setMaintenanceIsAllDay(false);
                              }
                            }
                          }}
                          disabled={maintenanceIsAllDay}
                          className="w-full sm:w-20 h-10 rounded-lg"
                          placeholder="12"
                        />
                        <span className="text-muted-foreground hidden sm:inline">:</span>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={
                            maintenanceScheduledTime
                              ? maintenanceScheduledTime.split(":")[1] || "00"
                              : ""
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            if (
                              value === "" ||
                              (parseInt(value, 10) >= 0 && parseInt(value, 10) <= 59)
                            ) {
                              const currentHours = maintenanceScheduledTime
                                ? maintenanceScheduledTime.split(":")[0] || "00"
                                : "00";
                              const minutes =
                                value === "" ? "00" : String(parseInt(value, 10)).padStart(2, "0");
                              const newTime = `${currentHours}:${minutes}`;

                              // Validar si la fecha es hoy y la hora es menor a 30 minutos después de ahora
                              if (
                                maintenanceScheduledDate === new Date().toISOString().split("T")[0]
                              ) {
                                const now = new Date();
                                const minTime = new Date(now.getTime() + 30 * 60000); // 30 minutos después
                                const selectedDateTime = new Date(
                                  `${maintenanceScheduledDate}T${newTime}`
                                );

                                if (selectedDateTime < minTime) {
                                  // Ajustar a la hora mínima permitida
                                  const minHours = String(minTime.getHours()).padStart(2, "0");
                                  const minMinutes = String(minTime.getMinutes()).padStart(2, "0");
                                  setMaintenanceScheduledTime(`${minHours}:${minMinutes}`);
                                  return;
                                }
                              }

                              setMaintenanceScheduledTime(newTime);
                              if (!maintenanceScheduledTime) {
                                setMaintenanceIsAllDay(false);
                              }
                            }
                          }}
                          disabled={maintenanceIsAllDay}
                          className="w-full sm:w-20 h-10 rounded-lg"
                          placeholder="00"
                        />
                        <Select
                          value={resolveMeridiemValue()}
                          onValueChange={(value) => {
                            const [hours, minutes] = (maintenanceScheduledTime || "00:00").split(
                              ":"
                            );
                            const hour24 = parseInt(hours, 10);
                            let newHour24 = hour24;

                            if (value === "PM" && hour24 < 12) {
                              newHour24 = hour24 + 12;
                            } else if (value === "AM" && hour24 >= 12) {
                              newHour24 = hour24 - 12;
                            }

                            const newTime = `${String(newHour24).padStart(2, "0")}:${minutes}`;

                            // Validar si la fecha es hoy y la hora es menor a 30 minutos después de ahora
                            if (
                              maintenanceScheduledDate === new Date().toISOString().split("T")[0]
                            ) {
                              const now = new Date();
                              const minTime = new Date(now.getTime() + 30 * 60000); // 30 minutos después
                              const selectedDateTime = new Date(
                                `${maintenanceScheduledDate}T${newTime}`
                              );

                              if (selectedDateTime < minTime) {
                                // Ajustar a la hora mínima permitida
                                const minHours = String(minTime.getHours()).padStart(2, "0");
                                const minMinutes = String(minTime.getMinutes()).padStart(2, "0");
                                setMaintenanceScheduledTime(`${minHours}:${minMinutes}`);
                                return;
                              }
                            }

                            setMaintenanceScheduledTime(newTime);
                            if (!maintenanceScheduledTime) {
                              setMaintenanceIsAllDay(false);
                            }
                          }}
                          disabled={maintenanceIsAllDay}
                        >
                          <SelectTrigger className="w-full sm:w-24 h-10 rounded-lg">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="AM">AM</SelectItem>
                            <SelectItem value="PM">PM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="maintenance-all-day-create"
                        checked={maintenanceIsAllDay}
                        onCheckedChange={(checked) => {
                          setMaintenanceIsAllDay(checked === true);
                          if (checked === true) {
                            setMaintenanceScheduledTime("00:00");
                          }
                        }}
                      />
                      <Label htmlFor="maintenance-all-day-create" className="cursor-pointer">
                        Todo el día
                      </Label>
                    </div>
                  </div>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${spacing.gap.small}`}>
                  <div className={`flex flex-col ${spacing.gap.small}`}>
                    <Label htmlFor="maintenance-recurrence-pattern-create">
                      Patrón de Recurrencia
                    </Label>
                    <Select
                      value={maintenanceRecurrencePattern}
                      onValueChange={(value) =>
                        setMaintenanceRecurrencePattern(value as MaintenanceRecurrencePattern)
                      }
                    >
                      <SelectTrigger
                        id="maintenance-recurrence-pattern-create"
                        className="rounded-lg"
                      >
                        <SelectValue placeholder="Selecciona el patrón" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diario</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="biweekly">Bisemanal</SelectItem>
                        <SelectItem value="monthly">Mensual</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={`flex flex-col ${spacing.gap.small}`}>
                    <Label htmlFor="maintenance-recurrence-end-date-create">
                      Fecha de Fin (opcional)
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal h-10 pl-3 rounded-lg",
                            !maintenanceRecurrenceEndDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {maintenanceRecurrenceEndDate ? (
                            format(
                              new Date(`${maintenanceRecurrenceEndDate}T00:00:00`),
                              "d 'de' MMMM, yyyy",
                              { locale: es }
                            )
                          ) : (
                            <span>Sin fecha de fin</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={
                            maintenanceRecurrenceEndDate
                              ? new Date(`${maintenanceRecurrenceEndDate}T00:00:00`)
                              : undefined
                          }
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, "0");
                              const day = String(date.getDate()).padStart(2, "0");
                              setMaintenanceRecurrenceEndDate(`${year}-${month}-${day}`);
                            } else {
                              setMaintenanceRecurrenceEndDate("");
                            }
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label className={typography.label}>Responsable(s) del Auto</Label>
                <MultiSelectCombobox
                  options={userOptions}
                  selectedValues={selectedResponsables}
                  onSelectionChange={onResponsablesChange}
                  placeholder="Selecciona responsables..."
                  emptyMessage="No hay usuarios disponibles"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className={typography.label}>Conductores anteriores</Label>
                <MultiSelectCombobox
                  options={userOptions}
                  selectedValues={selectedAssignedDrivers}
                  onSelectionChange={onDriversChange}
                  placeholder="Selecciona conductores..."
                  emptyMessage="No hay usuarios disponibles"
                />
              </div>
            </div>

            <Separator />

            <div className={`flex flex-col ${spacing.gap.base}`}>
              <h3 className={typography.h4}>Imagen</h3>
              <div className="flex flex-col gap-2">
                <Label htmlFor="image" className={typography.label}>
                  Imagen del Vehículo
                </Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <Label
                    htmlFor="image"
                    className="flex items-center justify-center gap-2 px-4 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    <span className={typography.body.base}>Subir imagen</span>
                  </Label>
                  {imagePreview && (
                    <div className="relative h-20 w-20 rounded-lg overflow-hidden border">
                      <Image src={imagePreview} alt="Preview" fill className="object-cover" />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="imageAlt" className={typography.label}>
                  Texto Alternativo de la Imagen
                </Label>
                <Input
                  id="imageAlt"
                  value={formData.imageAlt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, imageAlt: e.target.value }))}
                  placeholder="Descripción de la imagen para accesibilidad"
                  className="rounded-lg"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={onCancel} disabled={isCreating}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isCreating || !isFormValid}
            className={cn(
              "font-semibold shadow-md hover:shadow-lg transition-all duration-200",
              !isCreating &&
                isFormValid &&
                "bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/95 !opacity-100",
              (isCreating || !isFormValid) && "!opacity-50 cursor-not-allowed"
            )}
          >
            {isCreating ? "Creando..." : "Crear Vehículo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteVehicleDialog({
  open,
  onOpenChange,
  vehicleName,
  isDeleting,
  onDelete,
}: DeleteVehicleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClose={() => onOpenChange(false)}>
        <AlertDialogHeader>
          <AlertDialogTitle>{vehicleName}</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Eliminar este vehículo? Esta acción eliminará el vehículo de la flota y no se podrá
            deshacer. Confirma si deseas continuar.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onDelete}
            disabled={isDeleting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteMultipleVehiclesDialog({
  open,
  onOpenChange,
  selectedCount,
  isDeleting,
  onConfirm,
}: DeleteMultipleVehicleDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent onClose={() => onOpenChange(false)}>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar vehículos seleccionados?</AlertDialogTitle>
          <AlertDialogDescription>
            ¿Estás seguro de que deseas eliminar {selectedCount} vehículo(s)? Esta acción no se
            puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isDeleting ? "Eliminando..." : "Eliminar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
