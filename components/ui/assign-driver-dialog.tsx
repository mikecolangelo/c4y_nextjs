"use client";

import { useState, useEffect } from "react";
import { UserPlus, Loader2, X, Car, User, Calendar, TrendingUp } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components_shadcn/ui/dialog";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import { typography } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import Image from "next/image";
import { strapiImages } from "@/lib/strapi-images";

interface Vehicle {
  id: number;
  documentId?: string;
  name: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  currentMileage?: number;
  image?: {
    url?: string;
    alternativeText?: string;
  };
}

interface UserProfile {
  id: number;
  documentId?: string;
  displayName: string;
  role: string;
}

interface AssignDriverDialogProps {
  userId: string | number;
  userName: string;
  currentVehicles?: Vehicle[];
  onAssigned?: () => void;
  trigger?: React.ReactNode;
  className?: string;
}

export function AssignDriverDialog({
  userId,
  userName,
  currentVehicles = [],
  onAssigned,
  trigger,
  className,
}: AssignDriverDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    startDate: new Date().toISOString().split("T")[0],
    mileageStart: "",
    notes: "",
  });

  // Cargar vehículos disponibles
  useEffect(() => {
    if (open) {
      loadVehicles();
    }
  }, [open]);

  const loadVehicles = async () => {
    try {
      const response = await fetch("/api/fleet?limit=100");
      if (!response.ok) throw new Error("Error cargando vehículos");
      const data = await response.json();
      // Filtrar vehículos que ya están en assignedVehicles del usuario
      const assignedIds = new Set(currentVehicles.map(v => v.id));
      const available = (data.data || []).filter((v: Vehicle) => !assignedIds.has(v.id));
      setVehicles(available);
    } catch (err) {
      console.error("Error cargando vehículos:", err);
      setError("No se pudieron cargar los vehículos");
    }
  };

  const filteredVehicles = vehicles.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.vin.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async () => {
    if (!selectedVehicle) {
      setError("Selecciona un vehículo");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Crear entrada en driver-history
      const historyResponse = await fetch("/api/driver-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            driver: userId,
            vehicle: selectedVehicle.documentId || selectedVehicle.id,
            startDate: formData.startDate,
            status: "active",
            notes: formData.notes,
            mileageStart: formData.mileageStart ? parseFloat(formData.mileageStart) : undefined,
          },
        }),
      });

      if (!historyResponse.ok) {
        const errorData = await historyResponse.json();
        throw new Error(errorData.error || "Error creando historial");
      }

      // 2. Actualizar el vehículo para agregarlo a currentDrivers
      // Primero obtener los currentDrivers actuales para no sobrescribirlos
      const vehicleResponse = await fetch(`/api/fleet/${selectedVehicle.documentId || selectedVehicle.id}`);
      let currentDriverIds: (string | number)[] = [];
      
      if (vehicleResponse.ok) {
        const vehicleData = await vehicleResponse.json();
        currentDriverIds = vehicleData.data?.currentDrivers?.map((d: any) => d.id) || [];
      }
      
      // Agregar el nuevo conductor si no está ya
      if (!currentDriverIds.includes(userId)) {
        currentDriverIds.push(userId);
      }
      
      const updateResponse = await fetch(`/api/fleet/${selectedVehicle.documentId || selectedVehicle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            // En Strapi v5, las relaciones many-to-many se envían como array de IDs
            currentDrivers: currentDriverIds,
          },
        }),
      });

      if (!updateResponse.ok) {
        console.warn("Advertencia: No se pudo actualizar currentDrivers del vehículo");
      }

      toast.success(`${userName} asignado como conductor de ${selectedVehicle.name}`);
      setOpen(false);
      onAssigned?.();
      
      // Reset form
      setSelectedVehicle(null);
      setFormData({
        startDate: new Date().toISOString().split("T")[0],
        mileageStart: "",
        notes: "",
      });
    } catch (err) {
      console.error("Error asignando conductor:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (vehicle: Vehicle) => {
    if (!confirm(`¿Quitar a ${userName} como conductor de ${vehicle.name}?`)) return;

    setLoading(true);
    try {
      // Buscar la entrada activa en driver-history
      const response = await fetch(`/api/driver-history?driver=${userId}&vehicle=${vehicle.documentId || vehicle.id}&status=active`);
      if (!response.ok) throw new Error("Error buscando historial");
      
      const data = await response.json();
      const activeEntry = data.data?.[0];

      if (activeEntry) {
        // Cerrar la entrada
        await fetch(`/api/driver-history/${activeEntry.documentId || activeEntry.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              status: "completed",
              endDate: new Date().toISOString().split("T")[0],
              mileageEnd: vehicle.currentMileage,
            },
          }),
        });
      }

      toast.success(`${userName} removido de ${vehicle.name}`);
      onAssigned?.();
    } catch (err) {
      console.error("Error removiendo conductor:", err);
      toast.error("Error al remover asignación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className={cn("gap-2", className)}>
            <UserPlus className="h-4 w-4" />
            Asignar Vehículo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className={typography.h3}>Gestionar Vehículos de {userName}</DialogTitle>
          <DialogDescription>
            Asigna vehículos a los que este contacto conducirá o administra.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Vehículos actuales */}
        {currentVehicles.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Vehículos Actuales</h4>
            <div className="grid gap-2">
              {currentVehicles.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border"
                >
                  {vehicle.image?.url ? (
                    <div className="relative w-12 h-12 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src={strapiImages.getURL(vehicle.image.url)}
                        alt={vehicle.image.alternativeText || vehicle.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-12 h-12 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <Car className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{vehicle.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {vehicle.brand} {vehicle.model} ({vehicle.year})
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => handleRemoveAssignment(vehicle)}
                    disabled={loading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium text-sm mb-3">Asignar Nuevo Vehículo</h4>
          
          {/* Buscador de vehículos */}
          <div className="space-y-3">
            <Input
              placeholder="Buscar vehículo por nombre, marca, modelo o VIN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />

            {/* Lista de vehículos */}
            <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2">
              {filteredVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {searchQuery ? "No se encontraron vehículos" : "Escribe para buscar vehículos..."}
                </p>
              ) : (
                filteredVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={cn(
                      "w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors",
                      selectedVehicle?.id === vehicle.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    )}
                  >
                    {vehicle.image?.url ? (
                      <div className="relative w-10 h-10 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={strapiImages.getURL(vehicle.image.url)}
                          alt={vehicle.image.alternativeText || vehicle.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vehicle.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                    </div>
                    {selectedVehicle?.id === vehicle.id && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Campos adicionales */}
          {selectedVehicle && (
            <div className="mt-4 space-y-4 border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Car className="h-4 w-4" />
                Vehículo seleccionado: {selectedVehicle.name}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Fecha de Inicio
                  </Label>
                  <Input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Kilometraje Inicial
                  </Label>
                  <Input
                    type="number"
                    placeholder={selectedVehicle.currentMileage?.toString() || "0"}
                    value={formData.mileageStart}
                    onChange={(e) => setFormData({ ...formData, mileageStart: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input
                  placeholder="Notas sobre la asignación..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 pt-4">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cerrar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || !selectedVehicle}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Asignando...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Asignar Conductor
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
