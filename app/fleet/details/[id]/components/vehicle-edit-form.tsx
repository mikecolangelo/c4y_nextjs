"use client";

import type { ChangeEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { ImagePlus, Upload, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components_shadcn/ui/select";
import { MultiSelectCombobox } from "@/components_shadcn/ui/multi-select-combobox";
import { Calendar as CalendarComponent } from "@/components_shadcn/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components_shadcn/ui/popover";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Función helper para formatear fechas de forma segura
const formatDateSafe = (dateString: string, fallback: string = "Fecha inválida"): string => {
  if (!dateString) return fallback;
  try {
    const date = new Date(dateString + "T00:00:00");
    if (isNaN(date.getTime())) return fallback;
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  } catch {
    return fallback;
  }
};
import { spacing, typography } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import { cn } from "@/lib/utils";
import type { FleetVehicleCard, FleetVehicleCondition, RecurrencePattern } from "@/validations/types";

interface FormData {
  name: string;
  vin: string;
  price: string;
  currentMileage: string;
  color: string;
  fuelType: string;
  transmission: string;
  condition: FleetVehicleCondition;
  brand: string;
  model: string;
  year: string;
  imageAlt: string;
  nextMaintenanceDate: string;
  placa: string;
  billingInitials: string;
  maintenanceMileageInterval: string;
  lastMaintenanceMileage: string;
}

interface AvailableUser {
  id: number;
  documentId?: string;
  displayName?: string;
  email?: string;
  role?: string;
  avatar?: { url?: string; alternativeText?: string };
}

interface VehicleEditFormProps {
  vehicleData: FleetVehicleCard;
  formData: FormData;
  imagePreview: string | null;
  selectedImageFile: File | null;
  shouldRemoveImage: boolean;
  isSaving: boolean;
  maintenanceScheduledDate: string;
  maintenanceScheduledTime: string;
  maintenanceIsAllDay: boolean;
  maintenanceRecurrencePattern: RecurrencePattern;
  maintenanceRecurrenceEndDate: string;
  selectedResponsables: number[];
  selectedAssignedDrivers: number[];
  selectedInterestedDrivers: number[];
  selectedCurrentDrivers: number[];
  availableUsers: AvailableUser[];
  isLoadingUsers: boolean;
  onFormDataChange: (data: FormData) => void;
  onImageInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onRestoreOriginalImage: () => void;
  onMaintenanceScheduledDateChange: (date: string) => void;
  onMaintenanceScheduledTimeChange: (time: string) => void;
  onMaintenanceIsAllDayChange: (isAllDay: boolean) => void;
  onMaintenanceRecurrencePatternChange: (pattern: RecurrencePattern) => void;
  onMaintenanceRecurrenceEndDateChange: (date: string) => void;
  onSelectedResponsablesChange: (ids: number[]) => void;
  onSelectedAssignedDriversChange: (ids: number[]) => void;
  onSelectedInterestedDriversChange: (ids: number[]) => void;
  onSelectedCurrentDriversChange: (ids: number[]) => void;
  onSave: () => void;
  onCancel: () => void;
}

export function VehicleEditForm({
  vehicleData,
  formData,
  imagePreview,
  selectedImageFile,
  shouldRemoveImage,
  isSaving,
  maintenanceScheduledDate,
  maintenanceScheduledTime,
  maintenanceIsAllDay,
  maintenanceRecurrencePattern,
  maintenanceRecurrenceEndDate,
  selectedResponsables,
  selectedAssignedDrivers,
  selectedInterestedDrivers,
  selectedCurrentDrivers,
  availableUsers,
  isLoadingUsers,
  onFormDataChange,
  onImageInputChange,
  onRemoveImage,
  onRestoreOriginalImage,
  onMaintenanceScheduledDateChange,
  onMaintenanceScheduledTimeChange,
  onMaintenanceIsAllDayChange,
  onMaintenanceRecurrencePatternChange,
  onMaintenanceRecurrenceEndDateChange,
  onSelectedResponsablesChange,
  onSelectedAssignedDriversChange,
  onSelectedInterestedDriversChange,
  onSelectedCurrentDriversChange,
  onSave,
  onCancel,
}: VehicleEditFormProps) {
  const router = useRouter();
  const displayImageUrl = imagePreview ?? vehicleData.imageUrl ?? null;
  const displayImageAlt = formData.imageAlt || vehicleData.imageAlt || vehicleData.name;

  return (
    <Card 
      className="shadow-sm backdrop-blur-sm border rounded-lg"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--background) 50%, transparent)',
        borderColor: 'color-mix(in oklch, var(--border) 85%, transparent)',
      } as React.CSSProperties}
    >
      <CardHeader className="px-6 pt-6 pb-4">
        <CardTitle className={typography.h4}>Información del Vehículo</CardTitle>
      </CardHeader>
      <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
        <div className={`flex flex-col ${spacing.gap.small}`}>
          <Label htmlFor="vehicle-image-upload">Imagen del vehículo</Label>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <div className="relative flex h-96 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40">
              {displayImageUrl ? (
                <img src={displayImageUrl} alt={displayImageAlt} className="h-full w-full object-cover" />
              ) : (
                <div className={`flex flex-col items-center justify-center text-muted-foreground ${spacing.gap.small}`}>
                  <ImagePlus className="h-8 w-8" />
                  <p className={typography.body.small}>Aún no has seleccionado una imagen</p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Label
                htmlFor="vehicle-image-upload"
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary/40 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                <Upload className="mr-2 h-4 w-4" />
                Seleccionar imagen
              </Label>
              {(displayImageUrl || selectedImageFile || shouldRemoveImage) && (
                <Button variant="ghost" size="sm" type="button" onClick={onRemoveImage}>
                  Quitar imagen
                </Button>
              )}
              {vehicleData.imageUrl && (selectedImageFile || shouldRemoveImage) && (
                <Button variant="outline" size="sm" type="button" onClick={onRestoreOriginalImage}>
                  Restaurar original
                </Button>
              )}
            </div>
            <Input
              id="vehicle-image-upload"
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onImageInputChange}
            />
          </div>
        </div>
        <div className={`flex flex-col ${spacing.gap.small}`}>
          <Label htmlFor="imageAlt">Texto alternativo</Label>
          <Input
            id="imageAlt"
            value={formData.imageAlt}
            onChange={(e) => onFormDataChange({ ...formData, imageAlt: e.target.value })}
            placeholder="Ej. SUV blanco con techo panorámico"
          />
        </div>
        <div className={`grid gap-4 md:grid-cols-2`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="name">Nombre del vehículo</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="Ej. Toyota Corolla 2020"
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="vin">VIN</Label>
            <Input
              id="vin"
              value={formData.vin}
              onChange={(e) => onFormDataChange({ ...formData, vin: e.target.value })}
              placeholder="1HGBH41JXMN109186"
            />
          </div>
        </div>
        <div className={`grid gap-4 md:grid-cols-2`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="price">Precio (PAB)</Label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-muted-foreground">
                $
              </span>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => onFormDataChange({ ...formData, price: e.target.value })}
                className="pl-7"
                placeholder="55000"
              />
            </div>
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <div className="flex items-center justify-between">
              <Label htmlFor="currentMileage">Nuevo Record de Kilometraje</Label>
              {vehicleData.currentMileage !== undefined && (
                <span className="text-xs text-muted-foreground">
                  Actual: {vehicleData.currentMileage.toLocaleString()} km
                </span>
              )}
            </div>
            <Input
              id="currentMileage"
              type="number"
              value={formData.currentMileage}
              onChange={(e) => onFormDataChange({ ...formData, currentMileage: e.target.value })}
              placeholder="35000"
              min={vehicleData.currentMileage ?? 0}
              className={
                formData.currentMileage && vehicleData.currentMileage !== undefined && 
                Number(formData.currentMileage) < vehicleData.currentMileage 
                  ? "border-destructive focus-visible:ring-destructive" 
                  : ""
              }
            />
            {formData.currentMileage && vehicleData.currentMileage !== undefined && 
             Number(formData.currentMileage) < vehicleData.currentMileage && (
              <p className="text-xs text-destructive">
                El nuevo kilometraje debe ser mayor o igual al actual ({vehicleData.currentMileage.toLocaleString()} km)
              </p>
            )}
          </div>
        </div>
        <div className={`grid gap-4 md:grid-cols-2`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={formData.color}
              onChange={(e) => onFormDataChange({ ...formData, color: e.target.value })}
              placeholder="Plata Metálico"
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="fuelType">Combustible</Label>
            <Input
              id="fuelType"
              value={formData.fuelType}
              onChange={(e) => onFormDataChange({ ...formData, fuelType: e.target.value })}
              placeholder="Gasolina"
            />
          </div>
        </div>
        <div className={`grid gap-4 md:grid-cols-2`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="transmission">Transmisión</Label>
            <Input
              id="transmission"
              value={formData.transmission}
              onChange={(e) => onFormDataChange({ ...formData, transmission: e.target.value })}
              placeholder="Automática"
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label>Estado</Label>
            <Select
              value={formData.condition}
              onValueChange={(value: FleetVehicleCondition) =>
                onFormDataChange({ ...formData, condition: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nuevo">Nuevo</SelectItem>
                <SelectItem value="usado">Usado</SelectItem>
                <SelectItem value="seminuevo">Seminuevo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="brand">Marca</Label>
            <Input
              id="brand"
              value={formData.brand}
              onChange={(e) => onFormDataChange({ ...formData, brand: e.target.value })}
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="model">Modelo</Label>
            <Input
              id="model"
              value={formData.model}
              onChange={(e) => onFormDataChange({ ...formData, model: e.target.value })}
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="year">Año</Label>
            <Input
              id="year"
              type="number"
              value={formData.year}
              onChange={(e) => onFormDataChange({ ...formData, year: e.target.value })}
            />
          </div>
        </div>
        <div className={`grid gap-4 md:grid-cols-2`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="placa">Placa</Label>
            <Input
              id="placa"
              value={formData.placa}
              onChange={(e) => onFormDataChange({ ...formData, placa: e.target.value.toUpperCase() })}
              placeholder="Ej: ABC-123"
              maxLength={20}
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label htmlFor="billingInitials">Siglas Facturación</Label>
            <Input
              id="billingInitials"
              value={formData.billingInitials}
              onChange={(e) => onFormDataChange({ ...formData, billingInitials: e.target.value.toUpperCase() })}
              placeholder={`Ej: ${formData.brand?.charAt(0)?.toUpperCase() || 'F'}${formData.model?.charAt(0)?.toUpperCase() || 'M'}`}
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Se calcula automáticamente si se deja vacío (ej: {formData.brand?.charAt(0)?.toUpperCase() || 'F'}{formData.model?.charAt(0)?.toUpperCase() || 'M'})
            </p>
          </div>
        </div>
        
        {/* Fecha y Hora Programada de Mantenimiento */}
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
                        "w-full lg:flex-1 justify-start text-left font-normal h-10 pl-3",
                        !maintenanceScheduledDate && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {maintenanceScheduledDate ? (
                        formatDateSafe(maintenanceScheduledDate, "Selecciona una fecha")
                      ) : (
                        <span>Selecciona una fecha</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={maintenanceScheduledDate ? new Date(maintenanceScheduledDate + "T00:00:00") : undefined}
                      onSelect={(date) => {
                        if (date) {
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, "0");
                          const day = String(date.getDate()).padStart(2, "0");
                          onMaintenanceScheduledDateChange(`${year}-${month}-${day}`);
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
                    value={(() => {
                      if (!maintenanceScheduledTime) return "";
                      const [hours] = maintenanceScheduledTime.split(":");
                      const hour24 = parseInt(hours, 10);
                      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
                      return hour12.toString();
                    })()}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || (parseInt(value, 10) >= 1 && parseInt(value, 10) <= 12)) {
                        const currentMinutes = maintenanceScheduledTime ? maintenanceScheduledTime.split(":")[1] || "00" : "00";
                        const currentHour24 = maintenanceScheduledTime ? parseInt(maintenanceScheduledTime.split(":")[0], 10) : 0;
                        const isPM = currentHour24 >= 12;
                        
                        if (value === "") {
                          onMaintenanceScheduledTimeChange(`00:${currentMinutes}`);
                        } else {
                          const hour12 = parseInt(value, 10);
                          const hour24 = hour12 === 12 ? (isPM ? 12 : 0) : (isPM ? hour12 + 12 : hour12);
                          const newTime = `${String(hour24).padStart(2, "0")}:${currentMinutes}`;
                          
                          // Validar si la fecha es hoy y la hora es menor a 30 minutos después de ahora
                          if (maintenanceScheduledDate === new Date().toISOString().split('T')[0]) {
                            const now = new Date();
                            const minTime = new Date(now.getTime() + 30 * 60000); // 30 minutos después
                            const selectedDateTime = new Date(`${maintenanceScheduledDate}T${newTime}`);
                            
                            if (selectedDateTime < minTime) {
                              // Ajustar a la hora mínima permitida
                              const minHours = String(minTime.getHours()).padStart(2, '0');
                              const minMinutes = String(minTime.getMinutes()).padStart(2, '0');
                              onMaintenanceScheduledTimeChange(`${minHours}:${minMinutes}`);
                              return;
                            }
                          }
                          
                          onMaintenanceScheduledTimeChange(newTime);
                        }
                        if (!maintenanceScheduledTime) {
                          onMaintenanceIsAllDayChange(false);
                        }
                      }
                    }}
                    disabled={maintenanceIsAllDay}
                    className="w-full sm:w-20 h-10"
                    placeholder="12"
                  />
                  <span className="text-muted-foreground hidden sm:inline">:</span>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={maintenanceScheduledTime ? maintenanceScheduledTime.split(":")[1] || "00" : ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || (parseInt(value, 10) >= 0 && parseInt(value, 10) <= 59)) {
                        const currentHours = maintenanceScheduledTime ? maintenanceScheduledTime.split(":")[0] || "00" : "00";
                        const minutes = value === "" ? "00" : String(parseInt(value, 10)).padStart(2, "0");
                        const newTime = `${currentHours}:${minutes}`;
                        
                        // Validar si la fecha es hoy y la hora es menor a 30 minutos después de ahora
                        if (maintenanceScheduledDate === new Date().toISOString().split('T')[0]) {
                          const now = new Date();
                          const minTime = new Date(now.getTime() + 30 * 60000); // 30 minutos después
                          const selectedDateTime = new Date(`${maintenanceScheduledDate}T${newTime}`);
                          
                          if (selectedDateTime < minTime) {
                            // Ajustar a la hora mínima permitida
                            const minHours = String(minTime.getHours()).padStart(2, '0');
                            const minMinutes = String(minTime.getMinutes()).padStart(2, '0');
                            onMaintenanceScheduledTimeChange(`${minHours}:${minMinutes}`);
                            return;
                          }
                        }
                        
                        onMaintenanceScheduledTimeChange(newTime);
                        if (!maintenanceScheduledTime) {
                          onMaintenanceIsAllDayChange(false);
                        }
                      }
                    }}
                    disabled={maintenanceIsAllDay}
                    className="w-full sm:w-20 h-10"
                    placeholder="00"
                  />
                  <Select
                    value={(() => {
                      if (!maintenanceScheduledTime) return "AM";
                      const [hours] = maintenanceScheduledTime.split(":");
                      const hour24 = parseInt(hours, 10);
                      return hour24 >= 12 ? "PM" : "AM";
                    })()}
                    onValueChange={(value) => {
                      const currentTime = maintenanceScheduledTime || "00:00";
                      const [hours, minutes] = currentTime.split(":");
                      const hour24 = parseInt(hours, 10);
                      let newHour24 = hour24;
                      
                      if (value === "PM" && hour24 < 12) {
                        newHour24 = hour24 + 12;
                      } else if (value === "AM" && hour24 >= 12) {
                        newHour24 = hour24 - 12;
                      }
                      
                      const newTime = `${String(newHour24).padStart(2, "0")}:${minutes}`;
                      
                      // Validar si la fecha es hoy y la hora es menor a 30 minutos después de ahora
                      if (maintenanceScheduledDate === new Date().toISOString().split('T')[0]) {
                        const now = new Date();
                        const minTime = new Date(now.getTime() + 30 * 60000); // 30 minutos después
                        const selectedDateTime = new Date(`${maintenanceScheduledDate}T${newTime}`);
                        
                        if (selectedDateTime < minTime) {
                          // Ajustar a la hora mínima permitida
                          const minHours = String(minTime.getHours()).padStart(2, '0');
                          const minMinutes = String(minTime.getMinutes()).padStart(2, '0');
                          onMaintenanceScheduledTimeChange(`${minHours}:${minMinutes}`);
                          return;
                        }
                      }
                      
                      onMaintenanceScheduledTimeChange(newTime);
                      if (!maintenanceScheduledTime) {
                        onMaintenanceIsAllDayChange(false);
                      }
                    }}
                    disabled={maintenanceIsAllDay}
                  >
                    <SelectTrigger className="w-full sm:w-24 h-10">
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
                  id="maintenance-all-day"
                  checked={maintenanceIsAllDay}
                  onCheckedChange={(checked) => {
                    onMaintenanceIsAllDayChange(checked === true);
                    if (checked === true) {
                      onMaintenanceScheduledTimeChange("00:00");
                    }
                  }}
                  className="h-4 w-4 border-2 border-border"
                />
                <Label
                  htmlFor="maintenance-all-day"
                  className="text-sm font-normal cursor-pointer select-none"
                >
                  Todo el día
                </Label>
              </div>
            </div>
          </div>

          {/* Patrón de Recurrencia */}
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${spacing.gap.small}`}>
            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="maintenance-recurrence-pattern">Patrón de Recurrencia</Label>
              <Select value={maintenanceRecurrencePattern} onValueChange={(value: RecurrencePattern) => onMaintenanceRecurrencePatternChange(value)}>
                <SelectTrigger id="maintenance-recurrence-pattern">
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

            {/* Fecha de fin de recurrencia (opcional) */}
            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="maintenance-recurrence-end-date">Fecha de Fin (opcional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10 pl-3",
                      !maintenanceRecurrenceEndDate && "text-muted-foreground"
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    {maintenanceRecurrenceEndDate ? (
                      formatDateSafe(maintenanceRecurrenceEndDate, "Sin fecha de fin")
                    ) : (
                      <span>Sin fecha de fin</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={maintenanceRecurrenceEndDate ? new Date(maintenanceRecurrenceEndDate + "T00:00:00") : undefined}
                    onSelect={(date) => {
                      if (date) {
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, "0");
                        const day = String(date.getDate()).padStart(2, "0");
                        onMaintenanceRecurrenceEndDateChange(`${year}-${month}-${day}`);
                      } else {
                        onMaintenanceRecurrenceEndDateChange("");
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
        
        {/* Configuración de Mantenimiento por Kilometraje */}
        <div className={`flex flex-col ${spacing.gap.base}`}>
          <h3 className={typography.h4}>Mantenimiento por Kilometraje</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="maintenanceMileageInterval">Intervalo de Mantenimiento (km)</Label>
              <Input
                id="maintenanceMileageInterval"
                type="number"
                value={formData.maintenanceMileageInterval}
                onChange={(e) => onFormDataChange({ ...formData, maintenanceMileageInterval: e.target.value })}
                placeholder="Ej: 5000"
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                Cada cuántos kilómetros se debe realizar el mantenimiento
              </p>
            </div>
            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="lastMaintenanceMileage">Kilometraje del Último Mantenimiento</Label>
              <Input
                id="lastMaintenanceMileage"
                type="number"
                value={formData.lastMaintenanceMileage}
                onChange={(e) => onFormDataChange({ ...formData, lastMaintenanceMileage: e.target.value })}
                placeholder="Ej: 45000"
                min={0}
              />
              <p className="text-xs text-muted-foreground">
                Kilometraje registrado cuando se realizó el último mantenimiento
              </p>
            </div>
          </div>
        </div>
        
        {/* Mostrar responsables y conductores actuales */}
        {(vehicleData.responsables && vehicleData.responsables.length > 0) || (vehicleData.assignedDrivers && vehicleData.assignedDrivers.length > 0) || (vehicleData.interestedDrivers && vehicleData.interestedDrivers.length > 0) || ((vehicleData as any).currentDrivers && (vehicleData as any).currentDrivers.length > 0) ? (
          <div className={`flex flex-col ${spacing.gap.small} p-4 bg-muted/50 rounded-lg border`}>
            <p className={`${typography.body.small} font-semibold text-muted-foreground mb-2`}>
              Asignaciones actuales:
            </p>
            {vehicleData.responsables && vehicleData.responsables.length > 0 && (
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <p className={`${typography.body.small} text-muted-foreground`}>Responsables actuales:</p>
                <div className="flex flex-wrap gap-2">
                  {vehicleData.responsables.map((resp) => (
                    <div 
                      key={resp.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/users/details/${resp.documentId || resp.id}`);
                      }}
                    >
                      {resp.avatar?.url ? (
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(resp.avatar.url)}
                            alt={resp.avatar.alternativeText || resp.displayName || resp.email || `Avatar de ${resp.id}`}
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(resp.displayName || resp.email || `U${resp.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm">
                        {resp.displayName || resp.email || `Usuario ${resp.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {vehicleData.assignedDrivers && vehicleData.assignedDrivers.length > 0 && (
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <p className={`${typography.body.small} text-muted-foreground`}>Conductores anteriores:</p>
                <div className="flex flex-wrap gap-2">
                  {vehicleData.assignedDrivers.map((driver) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/users/details/${driver.documentId || driver.id}`);
                      }}
                    >
                      {driver.avatar?.url ? (
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(driver.avatar.url)}
                            alt={driver.avatar.alternativeText || driver.displayName || driver.email || `Avatar de ${driver.id}`}
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(driver.displayName || driver.email || `U${driver.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm">
                        {driver.displayName || driver.email || `Usuario ${driver.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {vehicleData.interestedDrivers && vehicleData.interestedDrivers.length > 0 && (
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <p className={`${typography.body.small} text-muted-foreground`}>Conductores interesados actualmente:</p>
                <div className="flex flex-wrap gap-2">
                  {vehicleData.interestedDrivers.map((driver) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/users/details/${driver.documentId || driver.id}`);
                      }}
                    >
                      {driver.avatar?.url ? (
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(driver.avatar.url)}
                            alt={driver.avatar.alternativeText || driver.displayName || driver.email || `Avatar de ${driver.id}`}
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(driver.displayName || driver.email || `U${driver.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm">
                        {driver.displayName || driver.email || `Usuario ${driver.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(vehicleData as any).currentDrivers && (vehicleData as any).currentDrivers.length > 0 && (
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <p className={`${typography.body.small} text-muted-foreground`}>Conductores actuales:</p>
                <div className="flex flex-wrap gap-2">
                  {(vehicleData as any).currentDrivers.map((driver: any) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/users/details/${driver.documentId || driver.id}`);
                      }}
                    >
                      {driver.avatar?.url ? (
                        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(driver.avatar.url)}
                            alt={driver.avatar.alternativeText || driver.displayName || driver.email || `Avatar de ${driver.id}`}
                            fill
                            className="object-cover"
                            sizes="24px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(driver.displayName || driver.email || `U${driver.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm">
                        {driver.displayName || driver.email || `Usuario ${driver.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
        
        <div className={`grid gap-4 md:grid-cols-2`}>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label>Responsable(s) del Auto</Label>
            <MultiSelectCombobox
              options={availableUsers
                .filter((user) => user.role !== "lead")
                .map((user) => ({
                  value: user.id,
                  label: user.displayName || user.email || "Usuario",
                  email: user.email,
                  avatar: user.avatar,
                }))}
              selectedValues={selectedResponsables}
              onSelectionChange={(values) => {
                const numericValues = values.map((v) => typeof v === 'number' ? v : Number(v)).filter((id) => !isNaN(id));
                onSelectedResponsablesChange(numericValues);
              }}
              placeholder="Selecciona responsables..."
              emptyMessage="No hay usuarios disponibles"
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label>Conductores anteriores</Label>
            <MultiSelectCombobox
              options={availableUsers
                .filter((user) => user.role !== "lead")
                .map((user) => ({
                  value: user.id,
                  label: user.displayName || user.email || "Usuario",
                  email: user.email,
                  avatar: user.avatar,
                }))}
              selectedValues={selectedAssignedDrivers}
              onSelectionChange={(values) => {
                const numericValues = values.map((v) => typeof v === 'number' ? v : Number(v)).filter((id) => !isNaN(id));
                onSelectedAssignedDriversChange(numericValues);
              }}
              placeholder="Selecciona conductores..."
              emptyMessage="No hay usuarios disponibles"
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label>Conductores interesados</Label>
            <MultiSelectCombobox
              options={availableUsers.map((user) => ({
                value: user.id,
                label: user.displayName || user.email || "Usuario",
                email: user.email,
                avatar: user.avatar,
              }))}
              selectedValues={selectedInterestedDrivers}
              onSelectionChange={(values) => {
                const numericValues = values.map((v) => typeof v === 'number' ? v : Number(v)).filter((id) => !isNaN(id));
                onSelectedInterestedDriversChange(numericValues);
              }}
              placeholder="Selecciona conductores interesados..."
              emptyMessage="No hay usuarios disponibles"
            />
          </div>
          <div className={`flex flex-col ${spacing.gap.small}`}>
            <Label>Conductores actuales</Label>
            <MultiSelectCombobox
              options={availableUsers
                .filter((user) => user.role !== "lead")
                .map((user) => ({
                  value: user.id,
                  label: user.displayName || user.email || "Usuario",
                  email: user.email,
                  avatar: user.avatar,
                }))}
              selectedValues={selectedCurrentDrivers}
              onSelectionChange={(values) => {
                const numericValues = values.map((v) => typeof v === 'number' ? v : Number(v)).filter((id) => !isNaN(id));
                onSelectedCurrentDriversChange(numericValues);
              }}
              placeholder="Selecciona conductores actuales..."
              emptyMessage="No hay usuarios disponibles"
            />
          </div>
        </div>
        <div className={`flex flex-col md:flex-row ${spacing.gap.small} mt-4`}>
          <Button variant="default" size="lg" className="flex-1 min-h-[44px]" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Guardando..." : "Guardar Cambios"}
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="flex-1 min-h-[44px]"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

