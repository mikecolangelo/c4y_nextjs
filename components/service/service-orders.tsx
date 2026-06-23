"use client";

import { clientLogger } from "@/lib/client-logger";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select";
import {
  ClipboardList,
  ChevronRight,
  Loader2,
  Search,
  Calendar,
  Car,
  Wrench,
  Plus,
  Clock,
  CheckCircle2,
  Play,
  AlertCircle,
  Banknote,
  Trash2,
  X,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ScrollArea } from "@/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CreateServiceOrderDialog } from "./create-service-order-dialog";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useBatchDelete } from "@/hooks/use-batch-delete";

type ServiceOrderStatus = "pendiente" | "en_progreso" | "completado" | "cancelado";

interface ServiceOrder {
  id: string;
  documentId: string;
  code?: string;
  status: ServiceOrderStatus;
  scheduledAt?: string;
  completedAt?: string;
  summary?: string;
  vehicle?: {
    id: string;
    name: string;
    placa?: string;
  };
  services?: Array<{
    id: string;
    name: string;
    price: number;
  }>;
  appointment?: {
    id: string;
    scheduledAt: string;
    status: string;
  };
  laborCost?: number;
  partsCost?: number;
  totalCost?: number;
}

interface ServiceOrdersTimelineProps {
  compact?: boolean;
  tall?: boolean;
}

export function ServiceOrders({ compact = false, tall = false }: ServiceOrdersTimelineProps) {
  const router = useRouter();
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ServiceOrderStatus | "all">("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const { confirm, ConfirmDialogComponent } = useConfirmDialog();

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/service-orders?populate=*", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Error al cargar órdenes de servicio");
      }
      const result = await response.json();
      const ordersData = result.data || [];
      setOrders(ordersData);
      setFilteredOrders(ordersData);
      setSelectedOrderIds(new Set());
    } catch (error) {
      clientLogger.error("Error loading service orders:", error);
      toast.error("No se pudieron cargar las órdenes de servicio");
      setOrders([]);
      setFilteredOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const toggleOrderSelection = useCallback((orderId: string) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  }, []);

  const toggleDaySelection = useCallback((dayOrderIds: string[]) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      const allSelected = dayOrderIds.every((id) => next.has(id));
      if (allSelected) {
        dayOrderIds.forEach((id) => next.delete(id));
      } else {
        dayOrderIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedOrderIds(new Set());
  }, []);

  // Batch delete via shared hook: it owns isDeleting + success/partial/error toasts.
  // Deletes are performed sequentially (preserving prior semantics); count ok vs failed.
  const { isDeleting, runDelete } = useBatchDelete({
    deleteBatch: async (ids) => {
      let deletedCount = 0;
      let failedCount = 0;
      for (const orderId of ids) {
        try {
          const res = await fetch(`/api/service-orders/${orderId}`, {
            method: "DELETE",
            cache: "no-store",
          });
          if (res.ok) {
            deletedCount++;
          } else {
            failedCount++;
            clientLogger.error(`Error deleting order ${orderId}:`, res.status);
          }
        } catch (err) {
          failedCount++;
          clientLogger.error(`Error deleting order ${orderId}:`, err);
        }
      }
      return { deletedCount, failedCount };
    },
    labels: { singular: "orden", plural: "órdenes" },
    onSuccess: () => {
      setSelectedOrderIds(new Set());
      loadOrders();
    },
  });

  const handleDeleteSelected = useCallback(async () => {
    if (selectedOrderIds.size === 0) return;

    const confirmed = await confirm({
      title: "¿Eliminar órdenes seleccionadas?",
      description: `Estás a punto de eliminar ${selectedOrderIds.size} orden${selectedOrderIds.size > 1 ? "es" : ""} de servicio. Esta acción no se puede deshacer.`,
      confirmText: "Eliminar",
      cancelText: "Cancelar",
      variant: "destructive",
    });

    if (!confirmed) return;

    await runDelete(Array.from(selectedOrderIds));
  }, [selectedOrderIds, confirm, runDelete]);

  // Filtrar órdenes
  useEffect(() => {
    let filtered = orders;

    // Filtro por estado
    if (statusFilter !== "all") {
      filtered = filtered.filter((o) => o.status === statusFilter);
    }

    // Filtro por búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.code?.toLowerCase().includes(query) ||
          o.vehicle?.name.toLowerCase().includes(query) ||
          o.vehicle?.placa?.toLowerCase().includes(query) ||
          o.summary?.toLowerCase().includes(query) ||
          o.services?.some((s) => s.name.toLowerCase().includes(query))
      );
    }

    // Ordenar por fecha (más recientes primero)
    filtered.sort((a, b) => {
      const parsedA = a.scheduledAt ? new Date(a.scheduledAt) : null;
      const parsedB = b.scheduledAt ? new Date(b.scheduledAt) : null;
      const dateA = parsedA && !isNaN(parsedA.getTime()) ? parsedA.getTime() : 0;
      const dateB = parsedB && !isNaN(parsedB.getTime()) ? parsedB.getTime() : 0;
      return dateB - dateA;
    });

    setFilteredOrders(filtered);
  }, [searchQuery, statusFilter, orders]);

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
        return <AlertCircle className="h-3.5 w-3.5" />;
      case "en_progreso":
        return <Play className="h-3.5 w-3.5" />;
      case "completado":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "cancelado":
        return <AlertCircle className="h-3.5 w-3.5" />;
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
      default:
        return status;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Sin fecha";
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const isYesterday =
        new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

      if (isToday) return `Hoy, ${format(date, "h:mm a", { locale: es })}`;
      if (isYesterday) return `Ayer, ${format(date, "h:mm a", { locale: es })}`;

      return format(date, "dd MMM, h:mm a", { locale: es });
    } catch {
      return "Fecha inválida";
    }
  };

  // Agrupar órdenes por fecha (para timeline)
  const groupedOrders = useCallback(() => {
    const groups: { [key: string]: ServiceOrder[] } = {};

    filteredOrders.forEach((order) => {
      let dateKey = "sin-fecha";
      if (order.scheduledAt) {
        const parsed = new Date(order.scheduledAt);
        if (!isNaN(parsed.getTime())) {
          dateKey = format(parsed, "yyyy-MM-dd");
        }
      }

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(order);
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "sin-fecha") return 1;
      if (b[0] === "sin-fecha") return -1;
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
      const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
      return timeB - timeA;
    });
  }, [filteredOrders]);

  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50">
      <CardHeader className={cn("pb-3", compact && "py-2 px-3")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <CardTitle className={cn("text-sm font-semibold", compact && "text-xs")}>
              Timeline de Órdenes
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {filteredOrders.length}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {selectedOrderIds.size > 0 && (
              <div className="flex items-center gap-2 bg-muted/60 rounded-md px-2 py-1">
                <span className="text-xs font-medium">
                  {selectedOrderIds.size} seleccionada{selectedOrderIds.size > 1 ? "s" : ""}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={clearSelection}
                  disabled={isDeleting}
                >
                  <X className="h-3 w-3" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3 mr-1" />
                  )}
                  Eliminar
                </Button>
              </div>
            )}
            <div className="relative flex-1 sm:w-40">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as ServiceOrderStatus | "all")}
            >
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
                <SelectItem value="en_progreso">En Progreso</SelectItem>
                <SelectItem value="completado">Completado</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7 px-2" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("p-0", compact && "px-2 pb-2")}>
        <ScrollArea
          className={cn(
            "w-full",
            compact && tall ? "h-[420px]" : compact ? "h-[250px]" : "h-[320px]"
          )}
        >
          <div className="p-3 space-y-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="w-0.5 h-16 mt-1" />
                  </div>
                  <Card className="flex-1 shadow-sm">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-3 w-32 mb-1" />
                          <Skeleton className="h-2.5 w-24" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground mb-2 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== "all"
                    ? "No se encontraron órdenes"
                    : "No hay órdenes de servicio"}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Crear orden
                </Button>
              </div>
            ) : (
              // Timeline view
              <div className="relative">
                {/* Línea vertical del timeline */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-border" />

                {groupedOrders().map(([dateKey, dayOrders]) => (
                  <div key={dateKey} className="mb-4">
                    {/* Header de fecha */}
                    <div className="flex items-center gap-2 mb-2 sticky top-0 bg-card/95 backdrop-blur-sm z-10 py-1">
                      <Checkbox
                        className="h-4 w-4"
                        checked={
                          dayOrders.length > 0 &&
                          dayOrders.every((o) => selectedOrderIds.has(o.documentId || o.id))
                        }
                        onCheckedChange={() =>
                          toggleDaySelection(dayOrders.map((o) => o.documentId || o.id))
                        }
                        aria-label="Seleccionar todas las órdenes del día"
                      />
                      <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center relative z-10">
                        <Calendar className="h-2.5 w-2.5 text-primary" />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">
                        {dateKey === "sin-fecha"
                          ? "Sin fecha programada"
                          : format(new Date(dateKey), "EEEE, d 'de' MMMM", { locale: es })}
                      </span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {dayOrders.length}
                      </Badge>
                    </div>

                    {/* Órdenes del día */}
                    <div className="space-y-2 pl-7">
                      {dayOrders.map((order) => (
                        <Card
                          key={order.id}
                          className={cn(
                            "shadow-sm ring-1 ring-inset ring-border/50 cursor-pointer hover:bg-muted/50 transition-colors relative",
                            selectedOrderIds.has(order.documentId || order.id) &&
                              "bg-primary/5 ring-primary/30"
                          )}
                          onClick={() => {
                            const targetId = order.documentId || order.id;
                            if (targetId) {
                              router.push(`/service-orders/${targetId}`);
                            } else {
                              toast.error("Esta orden no tiene un identificador válido");
                            }
                          }}
                        >
                          {/* Punto del timeline */}
                          <div className="absolute -left-[23px] top-4 w-2 h-2 rounded-full bg-border border-2 border-background" />

                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                {/* Checkbox + icono de estado */}
                                <div className="flex flex-col items-center gap-1">
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="cursor-pointer"
                                    title="Seleccionar orden"
                                  >
                                    <Checkbox
                                      className="h-4 w-4"
                                      checked={selectedOrderIds.has(order.documentId || order.id)}
                                      onCheckedChange={() =>
                                        toggleOrderSelection(order.documentId || order.id)
                                      }
                                      aria-label={`Seleccionar orden ${order.code || order.id}`}
                                    />
                                  </div>
                                  <div
                                    className={cn(
                                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                                      order.status === "completado" &&
                                        "bg-green-500/10 text-green-500",
                                      order.status === "en_progreso" &&
                                        "bg-blue-500/10 text-blue-500",
                                      order.status === "pendiente" &&
                                        "bg-orange-500/10 text-orange-500",
                                      order.status === "cancelado" && "bg-red-500/10 text-red-500"
                                    )}
                                  >
                                    {getStatusIcon(order.status)}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-medium truncate">
                                      {order.code || `Orden #${order.id}`}
                                    </h4>
                                    <Badge
                                      className={cn(
                                        "text-[10px] h-5 px-1.5 border",
                                        getStatusBadgeClass(order.status)
                                      )}
                                    >
                                      {getStatusLabel(order.status)}
                                    </Badge>
                                  </div>

                                  {order.vehicle && (
                                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                                      <Car className="h-3 w-3" />
                                      <span className="text-xs truncate">
                                        {order.vehicle.name}
                                        {order.vehicle.placa && ` (${order.vehicle.placa})`}
                                      </span>
                                    </div>
                                  )}

                                  {order.services && order.services.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                                      <Wrench className="h-3 w-3" />
                                      <span className="text-xs truncate">
                                        {order.services.map((s) => s.name).join(", ")}
                                      </span>
                                    </div>
                                  )}

                                  {order.totalCost !== undefined && order.totalCost > 0 && (
                                    <div className="flex items-center gap-1.5 mt-1 text-muted-foreground">
                                      <Banknote className="h-3 w-3" />
                                      <span className="text-xs font-medium">
                                        {new Intl.NumberFormat("es-PA", {
                                          style: "currency",
                                          currency: "PAB",
                                        }).format(order.totalCost)}
                                      </span>
                                    </div>
                                  )}

                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <Clock className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {formatDate(order.scheduledAt)}
                                    </span>
                                  </div>

                                  {order.summary && (
                                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                                      {order.summary}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Dialog para crear nueva orden */}
      <CreateServiceOrderDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          loadOrders();
        }}
      />

      {/* Dialog de confirmación */}
      <ConfirmDialogComponent />
    </Card>
  );
}
