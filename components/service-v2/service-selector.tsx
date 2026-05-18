"use client";

import { Badge } from "@/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { X, Wrench } from "lucide-react";
import { Label } from "@/ui/label";
import type { ServiceTemplateItem, MaintenanceKitCard } from "@/validations/types";

export interface ServiceOption {
  id?: string | number;
  documentId?: string;
  name: string;
  price?: number;
  durationMinutes?: number;
  defaultTemplate?: ServiceTemplateItem[];
  maintenanceKits?: MaintenanceKitCard[];
}

interface ServiceSelectorProps {
  services: ServiceOption[];
  selectedServices: ServiceOption[];
  onAdd: (service: ServiceOption) => void;
  onRemove: (serviceId: string | number) => void;
  isLoading?: boolean;
  label?: string;
}

export function ServiceSelector({
  services,
  selectedServices,
  onAdd,
  onRemove,
  isLoading,
  label = "Servicios a realizar",
}: ServiceSelectorProps) {
  const availableServices = services.filter(
    (s) =>
      !selectedServices.find(
        (selected) => selected.documentId === s.documentId || selected.id === s.id
      )
  );

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Wrench className="h-4 w-4" />
        {label}
      </Label>

      {selectedServices.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {selectedServices.map((service) => (
            <Badge
              key={service.documentId || service.id}
              variant="secondary"
              className="flex items-center gap-1"
            >
              {service.name}
              <button
                onClick={() =>
                  onRemove((service.documentId || service.id)!)
                }
                className="ml-1 hover:text-destructive"
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Select
        value="none"
        onValueChange={(value) => {
          if (value !== "none") {
            const service = services.find(
              (s) => (s.documentId || s.id) === value
            );
            if (service) onAdd(service);
          }
        }}
        disabled={isLoading || availableServices.length === 0}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={
              isLoading
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
            <SelectItem
              key={service.documentId || service.id}
              value={String(service.documentId || service.id)}
            >
              <div className="flex items-center justify-between w-full">
                <span>{service.name}</span>
                {service.price && service.price > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ${service.price}
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
