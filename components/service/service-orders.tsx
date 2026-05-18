"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Badge } from "@/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
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
  AlertCircle
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { spacing, typography } from "@/lib/design-system";
import { toast } from "@/lib/toast";
import { Skeleton } from "@/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { cn } from "@/lib/utils";
import { CreateServiceOrderDialog } from "./create-service-order-dialog";

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
    } catch (error) {
      console.error("Error loading service orders:", error);
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
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
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
      const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
      
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
    
    filteredOrders.forEach(order => {
      const dateKey = order.scheduledAt 
        ? format(new Date(order.scheduledAt), "yyyy-MM-dd")
        : "sin-fecha";
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(order);
    });
    
    return Object.entries(groups).sort((a, b) => {
      if (a[0] === "sin-fecha") return 1;
      if (b[0] === "sin-fecha") return -1;
      return new Date(b[0]).getTime() - new Date(a[0]).getTime();
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
            <Button 
              size="sm" 
              className="h-7 px-2"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className={cn("p-0", compact && "px-2 pb-2")}>
        <ScrollAreaPrimitive.Root className={cn("w-full", 
              compact && tall ? "h-[420px]" : 
              compact ? "h-[250px]" : 
              "h-[320px]")}>
          <ScrollAreaPrimitive.Viewport className="h-full w-full">
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
                        <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center relative z-10">
                          <Calendar className="h-2.5 w-2.5 text-primary" />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {dateKey === "sin-fecha" 
                            ? "Sin fecha programada"
                            : format(new Date(dateKey), "EEEE, d 'de' MMMM", { locale: es })
                          }
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
                            className="shadow-sm ring-1 ring-inset ring-border/50 cursor-pointer hover:bg-muted/50 transition-colors relative"
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
                                  <div className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                    order.status === "completado" && "bg-green-500/10 text-green-500",
                                    order.status === "en_progreso" && "bg-blue-500/10 text-blue-500",
                                    order.status === "pendiente" && "bg-orange-500/10 text-orange-500",
                                    order.status === "cancelado" && "bg-red-500/10 text-red-500"
                                  )}>
                                    {getStatusIcon(order.status)}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-medium truncate">
                                        {order.code || `Orden #${order.id}`}
                                      </h4>
                                      <Badge className={cn("text-[10px] h-5 px-1.5 border", getStatusBadgeClass(order.status))}>
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
          </ScrollAreaPrimitive.Viewport>
          <ScrollAreaPrimitive.Scrollbar orientation="vertical">
            <ScrollAreaPrimitive.Thumb />
          </ScrollAreaPrimitive.Scrollbar>
        </ScrollAreaPrimitive.Root>
      </CardContent>

      {/* Dialog para crear nueva orden */}
      <CreateServiceOrderDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          loadOrders();
        }}
      />
    </Card>
  );
}
