"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Badge } from "@/ui/badge";
import { Skeleton } from "@/ui/skeleton";
import { Textarea } from "@/ui/textarea";
import { Input } from "@/ui/input";
import { Label } from "@/ui/label";
import { Separator } from "@/ui/separator";
import { BackButton } from "@/components/admin/back-button";
import { AdminLayout } from "@/components/admin/admin-layout";
import {
  Car,
  Wrench,
  Loader2,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit,
  Package,
  Banknote,
  Clock,
  AlertTriangle,
  Save,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type ServiceOrderStatus = "pendiente" | "en_progreso" | "completado" | "cancelado";

interface UsedItem {
  id?: string | number;
  inventoryItem?: {
    id: string | number;
    code?: string;
    description?: string;
  };
  inventoryItemId?: string | number;
  quantity: number;
  unitPriceAtMoment: number;
  totalLine?: number;
}

interface ServiceOrderDetail {
  id: string | number;
  documentId?: string;
  code?: string;
  status: ServiceOrderStatus;
  scheduledAt?: string;
  completedAt?: string;
  summary?: string;
  laborCost?: number;
  partsCost?: number;

  totalCost?: number;
  vehicle?: {
    id?: string | number;
    documentId?: string;
    name?: string;
    placa?: string;
    brand?: string;
    model?: string;
  };
  services?: Array<{
    id?: string | number;
    documentId?: string;
    name?: string;
    price?: number;
  }>;
  appointment?: {
    id?: string | number;
    documentId?: string;
    status?: string;
    scheduledAt?: string;
  };
  usedItems?: UsedItem[];
  createdAt?: string;
  updatedAt?: string;
}

function formatCurrency(value?: number) {
  if (value === undefined || value === null) return "B/. 0.00";
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "PAB",
  }).format(value);
}

function formatDateTime(dateString?: string) {
  if (!dateString) return "No especificada";
  try {
    return format(new Date(dateString), "dd MMM yyyy, h:mm a", { locale: es });
  } catch {
    return "Fecha inválida";
  }
}

export default function ServiceOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;

  const [order, setOrder] = useState<ServiceOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [laborCostDraft, setLaborCostDraft] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("Orden de servicio no encontrada");
          setOrder(null);
          return;
        }
        throw new Error("Error al cargar la orden");
      }
      const result = await response.json();
      const data = result.data;
      if (!data) {
        setOrder(null);
        return;
      }
      setOrder(data);
      setNotesDraft(data.summary || "");
      setLaborCostDraft(String(data.laborCost || ""));
    } catch (error) {
      console.error("Error loading order:", error);
      toast.error("No se pudo cargar la orden de servicio");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      loadOrder();
    }
  }, [orderId, loadOrder]);

  const handleUpdateNotes = async () => {
    if (!order) return;
    setIsProcessing(true);
    try {
      const laborCost = parseFloat(laborCostDraft) || 0;
      const response = await fetch(`/api/service-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            summary: notesDraft.trim() || undefined,
            laborCost,
          },
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error al actualizar");
      }
      toast.success("Orden actualizada");
      setIsEditingNotes(false);
      await loadOrder();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al actualizar");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinalize = async () => {
    if (!order) return;
    setIsProcessing(true);
    try {
      const laborCost = parseFloat(laborCostDraft) || order.laborCost || 0;
      const response = await fetch(`/api/service-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            status: "completado",
            laborCost,
          },
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 409) {
          throw new Error(err.error || "Stock insuficiente para finalizar la orden");
        }
        throw new Error(err.error || "Error al finalizar la orden");
      }
      toast.success("Orden finalizada exitosamente");
      setShowFinalizeDialog(false);
      await loadOrder();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al finalizar");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            status: "cancelado",
          },
          appointment: order.appointment?.documentId || order.appointment?.id,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error al cancelar la orden");
      }
      toast.success("Orden cancelada");
      setShowCancelDialog(false);
      await loadOrder();
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al cancelar");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/service-orders/${orderId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Error al eliminar");
      }
      toast.success("Orden eliminada");
      router.push("/adm-services");
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : "Error al eliminar");
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: ServiceOrderStatus) => {
    switch (status) {
      case "pendiente":
        return "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30";
      case "en_progreso":
        return "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30";
      case "completado":
        return "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30";
      case "cancelado":
        return "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
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

  if (isLoading) {
    return (
      <AdminLayout
        title="Orden de servicio"
        leftActions={<BackButton fallbackHref="/service-orders" />}
      >
        <section className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </section>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout
        title="Orden no encontrada"
        leftActions={<BackButton fallbackHref="/service-orders" />}
      >
        <Card>
          <CardContent className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <h2 className="text-lg font-medium">Orden no encontrada</h2>
            <p className="text-sm text-muted-foreground mt-1">
              La orden de servicio que buscas no existe o fue eliminada.
            </p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const canFinalize = order.status === "pendiente" || order.status === "en_progreso";
  const canCancel = order.status !== "cancelado";
  const isCompleted = order.status === "completado";
  const isCancelled = order.status === "cancelado";

  return (
    <AdminLayout
      title={order.code ? `Orden ${order.code}` : "Orden de servicio"}
      leftActions={<BackButton fallbackHref="/service-orders" />}
    >
      <section className="space-y-4">
        {/* Header actions (back lives in the menu) */}
        <div className="flex items-center justify-end gap-4">
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs border", getStatusBadge(order.status))}>
              {getStatusLabel(order.status)}
            </Badge>
            {!isEditingNotes ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingNotes(true)}
                disabled={isProcessing || isCancelled}
              >
                <Edit className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleUpdateNotes}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Save className="h-3.5 w-3.5 mr-1" />
                )}
                Guardar
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isProcessing}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Eliminar
            </Button>
          </div>
        </div>

        <h1 className="text-xl font-semibold">{order.code || `Orden #${order.id}`}</h1>

        {/* Info general */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              Información General
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.vehicle && (
              <div className="flex items-center gap-2 text-sm">
                <Car className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Vehículo:</span>
                <span>
                  {order.vehicle.brand} {order.vehicle.model} {order.vehicle.name}
                  {order.vehicle.placa && ` (${order.vehicle.placa})`}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Programada:</span>
              <span className="text-muted-foreground">{formatDateTime(order.scheduledAt)}</span>
            </div>
            {order.completedAt && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="font-medium">Completada:</span>
                <span className="text-muted-foreground">{formatDateTime(order.completedAt)}</span>
              </div>
            )}
            {order.services && order.services.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <Wrench className="h-4 w-4 text-muted-foreground mt-0.5" />
                <span className="font-medium">Servicios:</span>
                <span className="text-muted-foreground">
                  {order.services.map((s) => s.name).join(", ")}
                </span>
              </div>
            )}

            {/* Notas / Resumen */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notas / Resumen</Label>
              {isEditingNotes ? (
                <Textarea
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Descripción del trabajo realizado..."
                  rows={3}
                />
              ) : (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {order.summary || "Sin notas"}
                </p>
              )}
            </div>

            {/* Mano de obra (editable) */}
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Banknote className="h-3.5 w-3.5" />
                Costo de Mano de Obra
              </Label>
              {isEditingNotes ? (
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={laborCostDraft}
                  onChange={(e) => setLaborCostDraft(e.target.value)}
                  placeholder="0.00"
                  className="max-w-xs"
                />
              ) : (
                <p className="text-sm text-muted-foreground">{formatCurrency(order.laborCost)}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Desglose de Costos con Repuestos Detallados */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Banknote className="h-4 w-4 text-primary" />
              Desglose de Costos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mano de Obra */}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Mano de Obra</span>
              <span className="font-medium">{formatCurrency(order.laborCost)}</span>
            </div>

            {/* Servicios */}
            {order.services && order.services.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Servicios</span>
                </div>
                <div className="pl-6 space-y-1">
                  {order.services.map((svc, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{svc.name || "Servicio"}</span>
                      <span className="font-medium">{formatCurrency(svc.price)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-sm pl-6">
                  <span className="text-muted-foreground">Subtotal Servicios</span>
                  <span className="font-medium">
                    {formatCurrency(order.services.reduce((sum, s) => sum + (s.price || 0), 0))}
                  </span>
                </div>
              </div>
            )}

            {/* Repuestos / Materiales detallados */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Repuestos / Materiales</span>
              </div>

              {!order.usedItems || order.usedItems.length === 0 ? (
                <p className="text-sm text-muted-foreground pl-6">
                  Sin repuestos / materiales registrados.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          Código
                        </th>
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">
                          Descripción
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                          Cant.
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                          P. Unit.
                        </th>
                        <th className="text-right py-2 px-3 font-medium text-muted-foreground">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.usedItems.map((item, idx) => {
                        const inventoryItem = item.inventoryItem;
                        const lineTotal = item.totalLine ?? item.quantity * item.unitPriceAtMoment;
                        return (
                          <tr
                            key={item.id ?? idx}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="py-2 px-3 font-mono text-xs">
                              {inventoryItem?.code || "N/A"}
                            </td>
                            <td className="py-2 px-3">
                              {inventoryItem?.description || "Sin descripción"}
                            </td>
                            <td className="py-2 px-3 text-right">{item.quantity}</td>
                            <td className="py-2 px-3 text-right">
                              {formatCurrency(item.unitPriceAtMoment)}
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Subtotal repuestos */}
              {order.usedItems && order.usedItems.length > 0 && (
                <div className="flex justify-between text-sm pl-0">
                  <span className="text-muted-foreground">Subtotal Repuestos</span>
                  <span className="font-medium">{formatCurrency(order.partsCost)}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Totales */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">
                  {formatCurrency(
                    (order.laborCost || 0) +
                      (order.partsCost || 0) +
                      (order.services?.reduce((sum, s) => sum + (s.price || 0), 0) || 0)
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total</span>
                <span>{formatCurrency(order.totalCost)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        {!isCancelled && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {canFinalize && (
                <Button
                  onClick={() => setShowFinalizeDialog(true)}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Finalizar Orden
                </Button>
              )}
              {canCancel && (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelDialog(true)}
                  disabled={isProcessing}
                  className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Cancelar Orden
                </Button>
              )}
              {isCompleted && (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Orden completada — inventario deducido
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dialog: Finalizar */}
        <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalizar Orden de Servicio</AlertDialogTitle>
              <AlertDialogDescription>
                Al finalizar la orden, se deducirá el stock de los items de inventario utilizados y
                se registrará un movimiento de salida. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Costo de Mano de Obra</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={laborCostDraft}
                  onChange={(e) => setLaborCostDraft(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              {order.usedItems && order.usedItems.length > 0 && (
                <div className="rounded-md bg-muted p-3 text-xs space-y-1">
                  <p className="font-medium">Items a deducir:</p>
                  {order.usedItems.map((item, idx) => (
                    <p key={idx} className="text-muted-foreground">
                      • {item.inventoryItem?.code || "N/A"} — {item.quantity} unidad(es)
                    </p>
                  ))}
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleFinalize}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Confirmar Finalización
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Cancelar */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar Orden de Servicio</AlertDialogTitle>
              <AlertDialogDescription>
                {isCompleted
                  ? "Esta orden ya fue completada. Al cancelarla, se revertirá el stock de los items de inventario utilizados (movimiento de reversión)."
                  : "¿Estás seguro de que deseas cancelar esta orden de servicio?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Volver</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Sí, Cancelar Orden
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Eliminar */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Eliminar Orden</AlertDialogTitle>
              <AlertDialogDescription>
                ¿Estás seguro de que deseas eliminar permanentemente esta orden de servicio? Esta
                acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isProcessing}>Volver</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isProcessing}
                className="bg-red-600 hover:bg-red-700"
              >
                {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </AdminLayout>
  );
}
