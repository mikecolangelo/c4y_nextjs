"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { Car, Calendar, Banknote, Settings, FileText, AlertTriangle, Wrench } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { spacing, typography } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import type { FleetVehicleCard, FleetVehicleCondition } from "@/validations/types";

interface VehicleInfoCardProps {
  vehicleData: FleetVehicleCard;
  priceLabel: string;
}

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

// Función para calcular el estado del mantenimiento por kilometraje
const getMaintenanceMileageStatus = (vehicleData: FleetVehicleCard) => {
  const mileage = vehicleData.currentMileage;
  const interval = vehicleData.maintenanceMileageInterval;
  const lastMaintenance = vehicleData.lastMaintenanceMileage;

  if (mileage === undefined || interval === undefined || lastMaintenance === undefined) {
    return null;
  }

  const kmSinceLastMaintenance = mileage - lastMaintenance;
  const kmRemaining = interval - kmSinceLastMaintenance;
  const percentageUsed = (kmSinceLastMaintenance / interval) * 100;

  if (kmSinceLastMaintenance >= interval) {
    return {
      status: "overdue",
      label: "Mantenimiento requerido",
      message: `Se ha superado el límite por ${(kmSinceLastMaintenance - interval).toLocaleString()} km`,
      color: "text-destructive bg-destructive/10",
      icon: "⚠️",
    };
  } else if (percentageUsed >= 80) {
    return {
      status: "soon",
      label: "Mantenimiento próximo",
      message: `Faltan ${kmRemaining.toLocaleString()} km para el mantenimiento`,
      color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
      icon: "🔔",
    };
  } else {
    return {
      status: "ok",
      label: "Mantenimiento al día",
      message: `Faltan ${kmRemaining.toLocaleString()} km para el mantenimiento`,
      color: "text-green-600 bg-green-100 dark:bg-green-900/30",
      icon: "✅",
    };
  }
};

export function VehicleInfoCard({ vehicleData, priceLabel }: VehicleInfoCardProps) {
  const router = useRouter();

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
        <div className="grid gap-4 md:grid-cols-2">
          <div className={`flex items-center ${spacing.gap.medium}`}>
            <Banknote className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground`}>Precio</p>
              <p className={`${typography.body.large} font-semibold`}>{priceLabel}</p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.medium}`}>
            <Car className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground`}>VIN</p>
              <p className={typography.body.base}>{vehicleData.vin}</p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.medium}`}>
            <Car className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground`}>Marca</p>
              <p className={typography.body.base}>{vehicleData.brand}</p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.medium}`}>
            <Car className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground`}>Modelo</p>
              <p className={typography.body.base}>{vehicleData.model}</p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.medium}`}>
            <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground`}>Año</p>
              <p className={typography.body.base}>{vehicleData.year}</p>
            </div>
          </div>
          <div className={`flex items-center ${spacing.gap.medium}`}>
            <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground`}>Estado</p>
              <div className="mt-1">{getStatusBadge(vehicleData.condition)}</div>
            </div>
          </div>
          {vehicleData.currentMileage !== undefined && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Kilometraje</p>
                <p className={typography.body.base}>{vehicleData.currentMileage.toLocaleString()} km</p>
              </div>
            </div>
          )}
          {vehicleData.color && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Car className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Color</p>
                <p className={typography.body.base}>{vehicleData.color}</p>
              </div>
            </div>
          )}
          {vehicleData.fuelType && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Combustible</p>
                <p className={typography.body.base}>{vehicleData.fuelType}</p>
              </div>
            </div>
          )}
          {vehicleData.transmission && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Settings className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Transmisión</p>
                <p className={typography.body.base}>{vehicleData.transmission}</p>
              </div>
            </div>
          )}
          {(vehicleData as any).placa && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Car className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Placa</p>
                <p className={typography.body.base}>{(vehicleData as any).placa}</p>
              </div>
            </div>
          )}
          {vehicleData.billingInitials && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Siglas Facturación</p>
                <p className={`${typography.body.base} font-semibold text-primary`}>{vehicleData.billingInitials}</p>
              </div>
            </div>
          )}
          {vehicleData.nextMaintenanceDate && (
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Próxima fecha de mantenimiento</p>
                <p className={typography.body.base}>
                  {format(new Date(vehicleData.nextMaintenanceDate), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
          )}
          
          {/* Estado de Mantenimiento por Kilometraje */}
          {(() => {
            const maintenanceStatus = getMaintenanceMileageStatus(vehicleData);
            if (!maintenanceStatus) return null;
            return (
              <div className={`flex items-start ${spacing.gap.medium} p-3 rounded-lg ${maintenanceStatus.color}`}>
                <Wrench className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className={`${typography.body.small} font-semibold`}>
                    {maintenanceStatus.icon} {maintenanceStatus.label}
                  </p>
                  <p className={typography.body.base}>
                    {maintenanceStatus.message}
                  </p>
                  {vehicleData.maintenanceMileageInterval && (
                    <p className={`${typography.body.small} opacity-75`}>
                      Intervalo: cada {vehicleData.maintenanceMileageInterval.toLocaleString()} km
                      {vehicleData.lastMaintenanceMileage !== undefined && (
                        <> • Último: {vehicleData.lastMaintenanceMileage.toLocaleString()} km</>
                      )}
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
          
          <div className={`flex items-start ${spacing.gap.medium}`}>
            <Car className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground mb-2`}>Conductores anteriores</p>
              {vehicleData.assignedDrivers && vehicleData.assignedDrivers.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {vehicleData.assignedDrivers.map((driver) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => router.push(`/users/details/${driver.documentId || driver.id}`)}
                    >
                      {driver.avatar?.url ? (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(driver.avatar.url)}
                            alt={driver.avatar.alternativeText || driver.displayName || driver.email || `Avatar de ${driver.id}`}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(driver.displayName || driver.email || `U${driver.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {driver.displayName || driver.email || `Usuario ${driver.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No hay conductores anteriores</p>
              )}
            </div>
          </div>
          <div className={`flex items-start ${spacing.gap.medium}`}>
            <Settings className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground mb-2`}>Responsables</p>
              {vehicleData.responsables && vehicleData.responsables.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {vehicleData.responsables.map((resp) => (
                    <div 
                      key={resp.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => router.push(`/users/details/${resp.documentId || resp.id}`)}
                    >
                      {resp.avatar?.url ? (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(resp.avatar.url)}
                            alt={resp.avatar.alternativeText || resp.displayName || resp.email || `Avatar de ${resp.id}`}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(resp.displayName || resp.email || `U${resp.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {resp.displayName || resp.email || `Usuario ${resp.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No hay responsables asignados</p>
              )}
            </div>
          </div>
          <div className={`flex items-start ${spacing.gap.medium}`}>
            <Car className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground mb-2`}>Conductores interesados</p>
              {vehicleData.interestedDrivers && vehicleData.interestedDrivers.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {vehicleData.interestedDrivers.map((driver) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => router.push(`/users/details/${driver.documentId || driver.id}`)}
                    >
                      {driver.avatar?.url ? (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(driver.avatar.url)}
                            alt={driver.avatar.alternativeText || driver.displayName || driver.email || `Avatar de ${driver.id}`}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(driver.displayName || driver.email || `U${driver.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {driver.displayName || driver.email || `Usuario ${driver.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No hay conductores interesados</p>
              )}
            </div>
          </div>
          <div className={`flex items-start ${spacing.gap.medium}`}>
            <Car className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
            <div className="flex-1">
              <p className={`${typography.body.small} text-muted-foreground mb-2`}>Conductores actuales</p>
              {(vehicleData as any).currentDrivers && (vehicleData as any).currentDrivers.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {(vehicleData as any).currentDrivers.map((driver: any) => (
                    <div 
                      key={driver.id} 
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => router.push(`/users/details/${driver.documentId || driver.id}`)}
                    >
                      {driver.avatar?.url ? (
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                          <Image
                            src={strapiImages.getURL(driver.avatar.url)}
                            alt={driver.avatar.alternativeText || driver.displayName || driver.email || `Avatar de ${driver.id}`}
                            fill
                            className="object-cover"
                            sizes="32px"
                          />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-background overflow-hidden">
                          <span className="text-xs font-medium text-muted-foreground">
                            {(driver.displayName || driver.email || `U${driver.id}`).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-medium">
                        {driver.displayName || driver.email || `Usuario ${driver.id}`}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No hay conductores actuales</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

