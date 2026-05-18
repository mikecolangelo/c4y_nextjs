"use client";

import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { MoreVertical, Edit, Trash2, Wrench, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { spacing, typography } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import type { FleetVehicleCondition, StrapiImage } from "@/validations/types";
import { VehicleImage } from "@/components/ui/fleet/vehicle-image";

interface VehicleHeaderCardProps {
  name: string;
  condition: FleetVehicleCondition;
  imageUrl: string | null;
  imageAlt: string;
  imageData?: StrapiImage | null; // Datos completos de la imagen con formats
  isDeleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCreateServiceAppointment?: () => void;
}

/**
 * Selecciona el formato de imagen apropiado según el tamaño del contenedor
 * Para un contenedor de 384px (h-96), preferimos large para pantallas Retina,
 * luego medium, luego original
 */
const getOptimalImageUrl = (
  imageUrl: string | null,
  imageData?: StrapiImage | null
): string | null => {
  if (!imageUrl) return null;
  
  // Si es una imagen blob (preview), usar directamente
  if (imageUrl.startsWith("blob:")) {
    return imageUrl;
  }
  
  // Si tenemos los datos completos de la imagen con formats
  if (imageData?.formats) {
    // Para un contenedor de 384px, usar large para pantallas Retina (768px+)
    // o medium para pantallas normales
    if (imageData.formats.large?.url) {
      return strapiImages.getURL(imageData.formats.large.url);
    }
    if (imageData.formats.medium?.url) {
      return strapiImages.getURL(imageData.formats.medium.url);
    }
  }
  
  // Fallback a la URL original (procesada para corregir localhost si es necesario)
  return strapiImages.getURL(imageUrl);
};

const getStatusBadge = (status: FleetVehicleCondition) => {
  switch (status) {
    case "nuevo":
      return (
        <Badge className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-800 dark:text-green-100">
          Nuevo
        </Badge>
      );
    case "usado":
      return (
        <Badge className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800 dark:bg-orange-800 dark:text-orange-100">
          Usado
        </Badge>
      );
    case "seminuevo":
      return (
        <Badge className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-800 dark:text-blue-100">
          Seminuevo
        </Badge>
      );
  }
};

export function VehicleHeaderCard({
  name,
  condition,
  imageUrl,
  imageAlt,
  imageData,
  isDeleting,
  onEdit,
  onDelete,
  onCreateServiceAppointment,
}: VehicleHeaderCardProps) {
  const optimalImageUrl = getOptimalImageUrl(imageUrl, imageData);

  return (
    <Card 
      className="!bg-transparent shadow-sm backdrop-blur-sm border rounded-lg"
      style={{
        backgroundColor: 'color-mix(in oklch, var(--background) 50%, transparent)',
        borderColor: 'color-mix(in oklch, var(--border) 85%, transparent)',
      } as React.CSSProperties}
    >
      <CardContent className={`flex flex-col items-center ${spacing.gap.base} px-12 relative`}>
        <div className="absolute top-4 right-8 flex items-center justify-end z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full flex items-center justify-center"
                aria-label="Acciones"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[12rem]">
              <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Editar Vehículo
              </DropdownMenuItem>
              {onCreateServiceAppointment && (
                <DropdownMenuItem className="cursor-pointer" onClick={onCreateServiceAppointment}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Agendar Servicio
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                className="cursor-pointer text-primary focus:text-primary hover:text-primary"
                onClick={onDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar Vehículo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Imagen del vehículo con manejo de errores */}
        <div className="relative w-full h-96 mt-20 overflow-hidden rounded-lg bg-muted">
          <VehicleImage
            src={optimalImageUrl}
            alt={imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 100vw, 1200px"
            priority
            fallbackClassName="h-96 w-full mt-20"
          />
        </div>

        <div className="flex flex-col items-center text-center">
          <h2 className={typography.h3}>{name}</h2>
          <div className="mt-2">{getStatusBadge(condition)}</div>
        </div>

        <div className={`flex items-center justify-center ${spacing.gap.small} w-full pt-2`}>
          <Button
            variant="default"
            size="icon"
            className="h-10 w-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center"
            onClick={onEdit}
            aria-label="Editar vehículo"
          >
            <Edit className="h-5 w-5" />
          </Button>
          {onCreateServiceAppointment && (
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary/90 border-primary/30 flex items-center justify-center"
              aria-label="Agendar servicio"
              onClick={onCreateServiceAppointment}
            >
              <Wrench className="h-5 w-5" />
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center"
            aria-label="Eliminar vehículo"
            onClick={onDelete}
            disabled={isDeleting}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
