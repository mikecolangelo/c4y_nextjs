"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import { 
  ArrowLeft, 
  Calendar, 
  Car, 
  User, 
  Wrench, 
  Edit,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Play,
  XCircle,
  Save,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components_shadcn/ui/select";
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
import { spacing, typography } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { toast } from "@/lib/toast";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ServiceOrderStatus = "pendiente" | "en_progreso" | "completado" | "cancelado";

interface ServiceItem {
  id: string;
  documentId: string;
  name: string;
  price: number;
}

interface DriverOption {
  id: string;
  documentId: string;
  displayName: string;
}

interface ServiceOrderDetail {
  id: string;
  documentId: string;
  code?: string;
  status: ServiceOrderStatus;
  scheduledAt?: string;
  completedAt?: string;
  summary?: string;
  vehicle?: {
    id: string;
    documentId: string;
    name: string;
    placa?: string;
    brand?: string;
    model?: string;
  };
  driver?: DriverOption;
  services?: ServiceItem[];
  appointment?: {
    id: string;
    documentId: string;
    status: string;
    scheduledAt: string;
  };
}

export default function ServiceOrderDetailsPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "seller" | "driver" | null>(null);
  
  const [availableServices, setAvailableServices] = useState<ServiceItem[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<DriverOption[]>([]);
  
  const [selectedDriverId, setSelectedDriverId] = useState<string>("none");
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);

  const loadOrder = useCallback(async () => {
    if (!orderId || orderId === "undefined" || orderId === "null") {
      console.error("[ServiceOrderDetails] Invalid orderId:", orderId);
      toast.error("ID de orden inválido");
      setOrder(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, { cache: "no-store" });
      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`[ServiceOrderDetails] API error ${response.status}:`, errorText.substring(0, 500));
        if (response.status === 404) {
          setOrder(null);
          return;
        }
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      const result = await response.json();
      const orderData = result.data as ServiceOrderDetail;
      setOrder(orderData);
      
      setSelectedDriverId(orderData.driver?.documentId || "none");
      setSelectedServices(orderData.services || []);
    } catch (error) {
      console.error("Error loading service order:", error);
      toast.error("No se pudo cargar la orden de servicio");
      setOrder(null);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  const loadServices = useCallback(async () => {
    try {
      const response = await fetch("/api/services", { cache: "no-store" });
      if (!response.ok) throw new Error("Error cargando servicios");
      const result = await response.json();
      setAvailableServices(result.data || []);
    } catch (error) {
      console.error("Error loading services:", error);
    }
  }, []);

  const loadDrivers = useCallback(async () => {
    try {
      const response = await fetch("/api/user-profiles", { cache: "no-store" });
      if (!response.ok) throw new Error("Error cargando conductores");
      const result = await response.json();
      const drivers = (result.data || []).filter((u: { role?: string }) => u.role === "driver");
      setAvailableDrivers(drivers.map((d: { id: string; documentId: string; displayName: string }) => ({
        id: String(d.id),
        documentId: d.documentId || String(d.id),
        displayName: d.displayName,
      })));
    } catch (error) {
      console.error("Error loading drivers:", error);
    }
  }, []);

  useEffect(() => {
    loadOrder();
    loadServices();
    loadDrivers();
  }, [loadOrder, loadServices, loadDrivers]);

  // Obtener el rol del usuario actual
  useEffect(() => {
    async function fetchUserRole() {
      try {
        const response = await fetch("/api/user-profile/me", {
          cache: "no-store",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setCurrentUserRole(data.data?.role || null);
        }
      } catch (err) {
        console.error("Error obteniendo rol del usuario:", err);
      }
    }
    fetchUserRole();
  }, []);

  const handleCancelOrder = async () => {
    if (!order) return;
    
    setIsCancelling(true);
    try {
      // Obtener el JWT del usuario de las cookies
      const getCookie = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };
      const userJWT = getCookie('jwt');
      
      const response = await fetch(`/api/service-orders/${order.documentId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          ...(userJWT ? { "Authorization": `Bearer ${userJWT}` } : {})
        },
        body: JSON.stringify({ status: "cancelado" }),
      });

      // Log para diagnosticar
      console.log("Response status:", response.status);

      if (!response.ok) {
        let errorMessage = "Error al cancelar la orden";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || `Error ${response.status}`;
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      toast.success("Orden cancelada exitosamente");
      setShowCancelDialog(false);
      await loadOrder();
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error(error instanceof Error ? error.message : "Error al cancelar la orden");
    } finally {
      setIsCancelling(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!order) return;
    
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        driver: selectedDriverId === "none" ? null : selectedDriverId,
        services: selectedServices.length > 0 
          ? selectedServices.map((s) => s.documentId || s.id)
          : [],
      };

      const response = await fetch(`/api/service-orders/${order.documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar los cambios");
      }

      toast.success("Orden actualizada exitosamente");
      setIsEditing(false);
      await loadOrder();
    } catch (error) {
      console.error("Error saving order:", error);
      toast.error(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadgeClass = (status: ServiceOrderStatus) => {
    switch (status) {
      case "pendiente":
        return "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30";
      case "en_progreso":
        return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "completado":
        return "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30";
      case "cancelado":
        return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: ServiceOrderStatus) => {
    switch (status) {
      case "pendiente":
        return <AlertCircle className="h-4 w-4" />;
      case "en_progreso":
        return <Play className="h-4 w-4" />;
      case "completado":
        return <CheckCircle2 className="h-4 w-4" />;
      case "cancelado":
        return <XCircle className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: ServiceOrderStatus) => {
    switch (status) {
      case "pendiente":
        return "Pendiente";
      case "en_progreso":
        return "En Progreso";
      case "completado":
        return "Completado";
      case "cancelado":
        return "Cancelado";
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Sin fecha";
    try {
      return format(new Date(dateString), "dd MMM yyyy, h:mm a", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  const handleAddService = (service: ServiceItem) => {
    if (!selectedServices.find((s) => s.documentId === service.documentId || s.id === service.id)) {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const handleRemoveService = (serviceId: string) => {
    setSelectedServices(selectedServices.filter((s) => s.documentId !== serviceId && s.id !== serviceId));
  };

  const backButton = (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => router.back()}
      className="h-10 w-10 flex items-center justify-center rounded-full"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );

  if (isLoading) {
    return (
      <AdminLayout title="Cargando orden..." showFilterAction leftActions={backButton}>
        <section className={`flex flex-col ${spacing.gap.large}`}>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className="flex flex-col items-center gap-4 p-6">
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardHeader className="px-6 pt-6 pb-4">
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-6 pb-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        </section>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout title="Orden no encontrada" showFilterAction leftActions={backButton}>
        <section className={`flex flex-col items-center justify-center ${spacing.gap.base} min-h-[400px]`}>
          <p className={typography.body.large}>La orden de servicio solicitada no existe.</p>
          <Button onClick={() => router.push("/adm-services")}>
            Volver a Servicios
          </Button>
        </section>
      </AdminLayout>
    );
  }

  const canEdit = order.status !== "cancelado" && order.status !== "completado";
  const isAdmin = currentUserRole === "admin";
  const canCancel = isAdmin && order.status !== "cancelado" && order.status !== "completado";

  return (
    <AdminLayout 
      title={order.code || `Orden #${order.id}`} 
      showFilterAction 
      leftActions={backButton}
      rightActions={
        canEdit && !isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Editar
          </Button>
        ) : undefined
      }
    >
      <section className={`flex flex-col ${spacing.gap.large}`}>
        {/* Header con estado */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${
              order.status === "completado" ? "bg-green-500/10 text-green-500" :
              order.status === "cancelado" ? "bg-red-500/10 text-red-500" :
              order.status === "en_progreso" ? "bg-blue-500/10 text-blue-500" :
              "bg-orange-500/10 text-orange-500"
            }`}>
              {getStatusIcon(order.status)}
            </div>
            <div className="text-center">
              <h2 className={typography.h3}>{order.code || `Orden #${order.id}`}</h2>
              <Badge className={`mt-2 rounded-full px-3 py-1 text-xs font-medium border ${getStatusBadgeClass(order.status)}`}>
                {getStatusLabel(order.status)}
              </Badge>
            </div>
            {canCancel && (
              <div className="flex items-center gap-2 pt-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isCancelling}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar Orden
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalles */}
        <Card className="shadow-sm ring-1 ring-inset ring-border/50">
          <CardHeader className="px-6 pt-6 pb-4">
            <CardTitle className={typography.h4}>Detalles de la Orden</CardTitle>
          </CardHeader>
          <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
            {/* Vehículo */}
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Car className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Vehículo</p>
                <p className={typography.body.base}>
                  {order.vehicle 
                    ? `${order.vehicle.name}${order.vehicle.placa ? ` (${order.vehicle.placa})` : ""}`
                    : "No asignado"}
                </p>
              </div>
            </div>

            {/* Conductor */}
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <User className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Conductor</p>
                {isEditing ? (
                  <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                    <SelectTrigger className="w-full sm:w-72 mt-1">
                      <SelectValue placeholder="Seleccionar conductor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin conductor asignado</SelectItem>
                      {availableDrivers.map((driver) => (
                        <SelectItem key={driver.documentId} value={driver.documentId}>
                          {driver.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className={typography.body.base}>
                    {order.driver?.displayName || "Sin conductor asignado"}
                  </p>
                )}
              </div>
            </div>

            {/* Servicios */}
            <div className={`flex items-start ${spacing.gap.medium}`}>
              <Wrench className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Servicios</p>
                {isEditing ? (
                  <div className="mt-2 space-y-3">
                    {selectedServices.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedServices.map((service) => (
                          <Badge key={service.documentId || service.id} variant="secondary" className="flex items-center gap-1">
                            {service.name}
                            <button
                              onClick={() => handleRemoveService(service.documentId || service.id)}
                              className="ml-1 hover:text-destructive"
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
                          const service = availableServices.find(
                            (s) => (s.documentId || s.id) === value
                          );
                          if (service) handleAddService(service);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-72">
                        <SelectValue placeholder="Agregar servicio..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar servicio...</SelectItem>
                        {availableServices
                          .filter(
                            (s) =>
                              !selectedServices.find(
                                (selected) =>
                                  selected.documentId === s.documentId || selected.id === s.id
                              )
                          )
                          .map((service) => (
                            <SelectItem key={service.documentId || service.id} value={service.documentId || service.id}>
                              <div className="flex items-center justify-between w-full">
                                <span>{service.name}</span>
                                {service.price > 0 && (
                                  <span className="text-muted-foreground ml-2">${service.price}</span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {order.services && order.services.length > 0 ? (
                      order.services.map((service) => (
                        <Badge key={service.documentId || service.id} variant="secondary">
                          {service.name}
                        </Badge>
                      ))
                    ) : (
                      <p className={typography.body.base}>Sin servicios asignados</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Fecha programada */}
            <div className={`flex items-center ${spacing.gap.medium}`}>
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className={`${typography.body.small} text-muted-foreground`}>Fecha programada</p>
                <p className={typography.body.base}>{formatDate(order.scheduledAt)}</p>
              </div>
            </div>

            {/* Botones de edición */}
            {isEditing && (
              <div className={`flex flex-col sm:flex-row ${spacing.gap.small} pt-4 border-t`}>
                <Button
                  variant="default"
                  size="lg"
                  className="flex-1 min-h-[44px]"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Cambios
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-1 min-h-[44px]"
                  onClick={() => {
                    setIsEditing(false);
                    if (order) {
                      setSelectedDriverId(order.driver?.documentId || "none");
                      setSelectedServices(order.services || []);
                    }
                  }}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Diálogo de confirmación de cancelación de orden */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar orden?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción cancelará la orden de servicio <strong>{order?.code || `#${order?.id}`}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelOrder}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Cancelando...
                </>
              ) : (
                "Sí, cancelar orden"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
