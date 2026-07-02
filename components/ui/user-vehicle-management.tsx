"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components_shadcn/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components_shadcn/ui/card";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Badge } from "@/components_shadcn/ui/badge";
import { Alert, AlertDescription } from "@/components_shadcn/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components_shadcn/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { Plus, Car, History, FolderPlus, X, Loader2, Calendar, TrendingUp } from "lucide-react";
import { toast } from "@/lib/toast";
import { typography } from "@/lib/design-system";
import Image from "next/image";
import { strapiImages } from "@/lib/strapi-images";
import { Can } from "@/components/auth/can";

interface Vehicle {
  id: number;
  documentId?: string;
  name: string;
  vin: string;
  brand: string;
  model: string;
  year: number;
  currentMileage?: number;
  price?: number;
  condition?: string;
  image?: {
    url?: string;
    alternativeText?: string;
  };
}

interface DriverHistory {
  id: number;
  documentId?: string;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "suspended";
  notes?: string;
  mileageStart?: number;
  mileageEnd?: number;
  vehicle: Vehicle;
}

interface UserVehicleManagementProps {
  userId: string | number;
}

export function UserVehicleManagement({ userId }: UserVehicleManagementProps) {
  const [activeTab, setActiveTab] = useState("history");
  const [loading, setLoading] = useState(false);

  // Data states
  const [myVehicles, setMyVehicles] = useState<Vehicle[]>([]);
  const [driverHistory, setDriverHistory] = useState<DriverHistory[]>([]);
  const [registeredVehicles, setRegisteredVehicles] = useState<Vehicle[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);

  // Dialog states
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // Form states
  const [assignForm, setAssignForm] = useState({
    startDate: new Date().toISOString().split("T")[0],
    mileageStart: "",
    notes: "",
  });

  const [registerForm, setRegisterForm] = useState({
    name: "",
    vin: "",
    brand: "",
    model: "",
    year: new Date().getFullYear(),
    price: "",
    condition: "usado",
    color: "",
  });

  useEffect(() => {
    loadData();
  }, [userId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user profile with all relations
      const response = await fetch(`/api/user-profiles/${userId}`);
      if (!response.ok) throw new Error("Error cargando datos");

      const { data } = await response.json();

      setMyVehicles(data.assignedVehicles || []);
      setDriverHistory(data.driverHistories || []);
      setRegisteredVehicles(data.registeredVehicles || []);
    } catch (err) {
      console.error("Error cargando datos:", err);
      toast.error("Error al cargar datos de vehículos");
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableVehicles = async () => {
    try {
      const response = await fetch("/api/fleet?limit=100");
      if (!response.ok) throw new Error("Error cargando vehículos");

      const { data } = await response.json();
      // Filter out vehicles already assigned to this user
      const assignedIds = new Set(myVehicles.map((v) => v.id));
      const available = (data || []).filter((v: Vehicle) => !assignedIds.has(v.id));
      setAvailableVehicles(available);
    } catch (err) {
      console.error("Error cargando vehículos disponibles:", err);
    }
  };

  const handleAssignVehicle = async () => {
    if (!selectedVehicle) return;

    setLoading(true);
    try {
      const response = await fetch("/api/driver-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            driver: userId,
            vehicle: selectedVehicle.documentId || selectedVehicle.id,
            startDate: assignForm.startDate,
            status: "active",
            notes: assignForm.notes,
            mileageStart: assignForm.mileageStart ? parseFloat(assignForm.mileageStart) : undefined,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error asignando vehículo");
      }

      toast.success(`Te has asignado como conductor de ${selectedVehicle.name}`);
      setShowAssignDialog(false);
      setSelectedVehicle(null);
      setAssignForm({
        startDate: new Date().toISOString().split("T")[0],
        mileageStart: "",
        notes: "",
      });
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al asignar vehículo");
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterVehicle = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/fleet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...registerForm,
            price: parseFloat(registerForm.price),
            createdBy: userId,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error registrando vehículo");
      }

      toast.success("Vehículo registrado exitosamente");
      setShowRegisterDialog(false);
      setRegisterForm({
        name: "",
        vin: "",
        brand: "",
        model: "",
        year: new Date().getFullYear(),
        price: "",
        condition: "usado",
        color: "",
      });
      loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar vehículo");
    } finally {
      setLoading(false);
    }
  };

  const handleEndAssignment = async (historyEntry: DriverHistory) => {
    if (!confirm(`¿Confirmas que ya no eres conductor de ${historyEntry.vehicle.name}?`)) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/driver-history/${historyEntry.documentId || historyEntry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: {
              status: "completed",
              endDate: new Date().toISOString().split("T")[0],
              mileageEnd: historyEntry.vehicle.currentMileage,
            },
          }),
        }
      );

      if (!response.ok) throw new Error("Error finalizando asignación");

      toast.success("Asignación finalizada");
      loadData();
    } catch (err) {
      toast.error("Error al finalizar asignación");
    } finally {
      setLoading(false);
    }
  };

  const openAssignDialog = () => {
    loadAvailableVehicles();
    setShowAssignDialog(true);
  };

  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={`${typography.h4} flex items-center gap-2`}>
              <Car className="h-5 w-5" />
              Mis Vehículos
            </CardTitle>
            <CardDescription>Gestiona los vehículos que has registrado o conducido</CardDescription>
          </div>
          <div className="flex gap-2">
            <Can module="fleet" action="canCreate">
              <Button variant="outline" size="sm" onClick={openAssignDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Ser Conductor
              </Button>
            </Can>
            <Can module="fleet" action="canCreate">
              <Button variant="outline" size="sm" onClick={() => setShowRegisterDialog(true)}>
                <FolderPlus className="h-4 w-4 mr-2" />
                Registrar Vehículo
              </Button>
            </Can>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="history" className="gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
            <TabsTrigger value="current" className="gap-2">
              <Car className="h-4 w-4" />
              Actuales ({myVehicles.length})
            </TabsTrigger>
            <TabsTrigger value="registered" className="gap-2">
              <FolderPlus className="h-4 w-4" />
              Registrados ({registeredVehicles.length})
            </TabsTrigger>
          </TabsList>

          {/* Historial de Conducción */}
          <TabsContent value="history" className="space-y-4 mt-4">
            {driverHistory.length === 0 ? (
              <Alert>
                <AlertDescription>
                  No tienes historial de conducción. Asignate como conductor de un vehículo para
                  comenzar.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-3">
                {driverHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border-l-4 border-l-primary"
                  >
                    {entry.vehicle?.image?.url ? (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={strapiImages.getURL(entry.vehicle.image.url)}
                          alt={entry.vehicle.image.alternativeText || entry.vehicle.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.vehicle?.name}</span>
                        <Badge
                          className={
                            entry.status === "active"
                              ? "bg-green-100 text-green-800"
                              : entry.status === "completed"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {entry.status === "active"
                            ? "Conductor Actual"
                            : entry.status === "completed"
                              ? "Conductor Anterior"
                              : "Suspendido"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {entry.vehicle?.brand} {entry.vehicle?.model} ({entry.vehicle?.year})
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {entry.startDate}
                          {entry.endDate && ` - ${entry.endDate}`}
                        </span>
                        {(entry.mileageStart || entry.mileageEnd) && (
                          <span className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {entry.mileageStart?.toLocaleString()} km
                            {entry.mileageEnd && ` - ${entry.mileageEnd.toLocaleString()} km`}
                          </span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
                      )}
                    </div>
                    {entry.status === "active" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEndAssignment(entry)}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Vehículos Actuales */}
          <TabsContent value="current" className="space-y-4 mt-4">
            {myVehicles.length === 0 ? (
              <Alert>
                <AlertDescription>No tienes vehículos asignados actualmente.</AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {myVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    {vehicle.image?.url ? (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={strapiImages.getURL(vehicle.image.url)}
                          alt={vehicle.image.alternativeText || vehicle.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vehicle.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                      <Badge className="mt-1 bg-green-100 text-green-800 text-xs">
                        Conductor Actual
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Vehículos Registrados */}
          <TabsContent value="registered" className="space-y-4 mt-4">
            {registeredVehicles.length === 0 ? (
              <Alert>
                <AlertDescription>No has registrado ningún vehículo aún.</AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {registeredVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border"
                  >
                    {vehicle.image?.url ? (
                      <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-lg">
                        <Image
                          src={strapiImages.getURL(vehicle.image.url)}
                          alt={vehicle.image.alternativeText || vehicle.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                        <Car className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vehicle.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registrado: {new Date(vehicle.createdAt || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog para Asignarse como Conductor */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Asignarme como Conductor</DialogTitle>
            <DialogDescription>Selecciona un vehículo para conducir.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-64 overflow-y-auto space-y-2 border rounded-lg p-2">
              {availableVehicles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No hay vehículos disponibles
                </p>
              ) : (
                availableVehicles.map((vehicle) => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                      selectedVehicle?.id === vehicle.id
                        ? "bg-primary/10 border border-primary"
                        : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-muted flex items-center justify-center">
                      <Car className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{vehicle.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {vehicle.brand} {vehicle.model} ({vehicle.year})
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedVehicle && (
              <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
                <p className="text-sm font-medium">Vehículo seleccionado: {selectedVehicle.name}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Fecha de Inicio</Label>
                    <Input
                      type="date"
                      value={assignForm.startDate}
                      onChange={(e) => setAssignForm({ ...assignForm, startDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Kilometraje Inicial</Label>
                    <Input
                      type="number"
                      placeholder={selectedVehicle.currentMileage?.toString() || "0"}
                      value={assignForm.mileageStart}
                      onChange={(e) =>
                        setAssignForm({ ...assignForm, mileageStart: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Notas</Label>
                  <Input
                    placeholder="Notas sobre la asignación..."
                    value={assignForm.notes}
                    onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAssignVehicle} disabled={!selectedVehicle || loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                "Asignarme como Conductor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog para Registrar Vehículo */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Vehículo</DialogTitle>
            <DialogDescription>
              Ingresa los datos del vehículo que deseas registrar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                placeholder="Ej: Toyota Corolla 2020"
                value={registerForm.name}
                onChange={(e) => setRegisterForm({ ...registerForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>VIN *</Label>
                <Input
                  placeholder="Número VIN"
                  value={registerForm.vin}
                  onChange={(e) => setRegisterForm({ ...registerForm, vin: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Año *</Label>
                <Input
                  type="number"
                  value={registerForm.year}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, year: parseInt(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Marca *</Label>
                <Input
                  placeholder="Ej: Toyota"
                  value={registerForm.brand}
                  onChange={(e) => setRegisterForm({ ...registerForm, brand: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Modelo *</Label>
                <Input
                  placeholder="Ej: Corolla"
                  value={registerForm.model}
                  onChange={(e) => setRegisterForm({ ...registerForm, model: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio *</Label>
                <Input
                  type="number"
                  placeholder="Ej: 15000"
                  value={registerForm.price}
                  onChange={(e) => setRegisterForm({ ...registerForm, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Condición *</Label>
                <Select
                  value={registerForm.condition}
                  onValueChange={(value) => setRegisterForm({ ...registerForm, condition: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="usado">Usado</SelectItem>
                    <SelectItem value="seminuevo">Seminuevo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                placeholder="Ej: Rojo"
                value={registerForm.color}
                onChange={(e) => setRegisterForm({ ...registerForm, color: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleRegisterVehicle}
              disabled={
                !registerForm.name ||
                !registerForm.vin ||
                !registerForm.brand ||
                !registerForm.model ||
                !registerForm.price ||
                loading
              }
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar Vehículo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
