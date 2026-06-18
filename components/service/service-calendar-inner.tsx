"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { 
  Calendar, 
  List, 
  ChevronLeft, 
  ChevronRight,
  Plus,
  Clock,
  MapPin,
  Car,
  Wrench,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { ScrollArea } from "@/components_shadcn/ui/scroll-area";
import { CreateServiceAppointmentDialog } from "./create-service-appointment-dialog";
import type { AppointmentCard, AppointmentStatus } from "@/validations/types";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipo para órdenes de servicio
interface ServiceOrder {
  id: string;
  documentId: string;
  code?: string;
  status: "pendiente" | "en_progreso" | "completado";
  scheduledAt?: string;
  vehicle?: {
    id: string;
    name: string;
    placa?: string;
  };
}

export interface ServiceCalendarInnerProps {
  onEventClick?: (appointment: AppointmentCard) => void;
  className?: string;
}

/**
 * Helper defensivo para construir una fecha válida desde campos de appointment.
 * Retorna null si year/month/day son inválidos o la fecha resultante es inválida.
 */
function createAppointmentDate(
  year?: number | null,
  month?: number | null,
  day?: number | null,
  time?: string | null
): Date | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const date = new Date(y, m, d);
  if (isNaN(date.getTime())) {
    return null;
  }
  if (time) {
    const [h, min] = time.split(":").map(Number);
    if (Number.isFinite(h) && Number.isFinite(min)) {
      date.setHours(h, min);
    }
  }
  return date;
}

export function ServiceCalendarInner({
  onEventClick,
  className,
}: ServiceCalendarInnerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const calendarRef = useRef<any>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [isCompact] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  
  // Estado para pre-seleccionar servicio desde URL
  const [preSelectedServiceId, setPreSelectedServiceId] = useState<string>("");

  // Actualizar el mes/año actual cuando el calendario cambia
  const updateCurrentMonth = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      const date = calendarApi.getDate();
      setCurrentMonth(
        date
          .toLocaleDateString("es-ES", {
            month: "long",
            year: "numeric",
          })
          .replace(" de ", " ")
      );
    }
  }, []);

  // Inicializar el mes actual al montar el componente
  useEffect(() => {
    updateCurrentMonth();
  }, [updateCurrentMonth]);
  
  // Estados para datos
  const [appointments, setAppointments] = useState<AppointmentCard[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  
  // Leer parámetros de URL para pre-seleccionar servicio
  useEffect(() => {
    const serviceId = searchParams.get("serviceId");
    const serviceName = searchParams.get("serviceName");
    const fromService = searchParams.get("fromService");
    
    if (fromService === "true" && serviceId) {
      setPreSelectedServiceId(serviceId);
      // Abrir el diálogo automáticamente
      const today = format(new Date(), "yyyy-MM-dd");
      setSelectedDate(today);
      setIsCreateDialogOpen(true);
      
      // Limpiar los parámetros de URL para evitar re-apertura al recargar
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("serviceId");
      newParams.delete("serviceName");
      newParams.delete("fromService");
      const newUrl = `${window.location.pathname}?${newParams.toString()}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, [searchParams]);

  // Fetch de citas de mantenimiento
  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/calendar?type=mantenimiento");
      if (!response.ok) {
        throw new Error("Error al cargar las citas");
      }
      const result = await response.json();
      setAppointments(result.data || []);
    } catch (err) {
      console.error("Error fetching appointments:", err);
      toast.error("No se pudieron cargar las citas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch de órdenes de servicio
  const fetchServiceOrders = useCallback(async () => {
    try {
      const response = await fetch("/api/service-orders?populate=*", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Error al cargar órdenes de servicio");
      }
      const result = await response.json();
      const ordersData = result.data || [];
      
      // Mapear órdenes al formato ServiceOrder
      const mappedOrders: ServiceOrder[] = ordersData.map((order: any) => ({
        id: order.id,
        documentId: order.documentId,
        code: order.code,
        status: order.status,
        scheduledAt: order.scheduledAt,
        vehicle: order.vehicle,
      }));
      
      setServiceOrders(mappedOrders);
    } catch (error) {
      console.error("Error loading service orders:", error);
      setServiceOrders([]);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchServiceOrders();
  }, [fetchAppointments, fetchServiceOrders]);

  // Filtrar solo citas de mantenimiento
  const maintenanceAppointments = appointments.filter(
    (apt) => apt.type === "mantenimiento"
  );
  
  // Filtrar órdenes de servicio con fecha programada
  const scheduledOrders = serviceOrders.filter(
    (order) => order.scheduledAt
  );

  // Convertir citas a eventos de calendario
  const calendarEvents = useMemo(() => {
    return maintenanceAppointments
      .map((apt) => {
        const date = createAppointmentDate(apt.year, apt.month, apt.day, apt.time);
        if (!date) {
          console.warn("[ServiceCalendar] Fecha inválida omitida:", apt.id, apt.year, apt.month, apt.day);
          return null;
        }

        return {
          id: apt.id,
          title: apt.title,
          start: date.toISOString(),
          allDay: false,
          extendedProps: {
            ...apt,
          },
          backgroundColor: getEventColor(apt),
          borderColor: getEventColor(apt),
          textColor: "#fff",
          classNames: [
            apt.status === "completada" ? "opacity-60" : "",
            apt.status === "cancelada" ? "opacity-40" : "",
          ].filter(Boolean),
        };
      })
      .filter(Boolean);
  }, [maintenanceAppointments]);

  // Estadísticas (incluyen citas y órdenes de servicio)
  const stats = useMemo(() => {
    const now = new Date();
    
    // Estadísticas de citas
    const totalAppointments = maintenanceAppointments.length;
    const completedAppointments = maintenanceAppointments.filter((a) => a.status === "completada").length;
    const pendingAppointments = maintenanceAppointments.filter(
      (a) => {
        if (a.status === "completada" || a.status === "cancelada") return false;
        const d = createAppointmentDate(a.year, a.month, a.day);
        return d ? d >= now : false;
      }
    ).length;
    const overdueAppointments = maintenanceAppointments.filter(
      (a) => {
        if (a.status === "completada" || a.status === "cancelada") return false;
        const d = createAppointmentDate(a.year, a.month, a.day);
        return d ? d < now : false;
      }
    ).length;

    // Estadísticas de órdenes de servicio
    const totalOrders = scheduledOrders.length;
    const completedOrders = scheduledOrders.filter((o) => o.status === "completado").length;
    const pendingOrders = scheduledOrders.filter((o) => o.status === "pendiente").length;
    const inProgressOrders = scheduledOrders.filter((o) => o.status === "en_progreso").length;
    const overdueOrders = scheduledOrders.filter(
      (o) => (o.status === "pendiente" || o.status === "en_progreso") && 
      o.scheduledAt && new Date(o.scheduledAt) < now
    ).length;

    return { 
      total: totalAppointments + totalOrders, 
      completed: completedAppointments + completedOrders, 
      pending: pendingAppointments + pendingOrders + inProgressOrders, 
      overdue: overdueAppointments + overdueOrders,
      inProgress: inProgressOrders,
    };
  }, [maintenanceAppointments, scheduledOrders]);

  const handleEventClick = (info: any) => {
    const appointment: AppointmentCard = info.event.extendedProps;
    if (onEventClick) {
      onEventClick(appointment);
    }
  };

  const handleDateClick = (info: any) => {
    const date = info.date;
    setSelectedDate(format(date, "yyyy-MM-dd"));
    setPreSelectedServiceId(""); // Limpiar pre-selección al abrir manualmente
    setIsCreateDialogOpen(true);
  };
  
  // Handler para cerrar el diálogo y limpiar pre-selección
  const handleDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setPreSelectedServiceId(""); // Limpiar al cerrar
    }
  };

  const handlePrevMonth = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.prev();
      updateCurrentMonth();
    }
  };

  const handleNextMonth = () => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.next();
      updateCurrentMonth();
    }
  };

  // Función para obtener el estado de un día (incluye citas y órdenes de servicio)
  const getDayStatus = (date: Date): { 
    hasOverdue: boolean; 
    hasPending: boolean; 
    hasCompleted: boolean;
    hasOrderPending: boolean;
    hasOrderInProgress: boolean;
    hasOrderCompleted: boolean;
  } => {
    // Revisar citas del día
    const dayAppointments = maintenanceAppointments.filter(apt => {
      const aptDate = createAppointmentDate(apt.year, apt.month, apt.day);
      return aptDate ? aptDate.toDateString() === date.toDateString() : false;
    });

    // Revisar órdenes de servicio del día
    const dayOrders = scheduledOrders.filter(order => {
      if (!order.scheduledAt) return false;
      const orderDate = new Date(order.scheduledAt);
      return orderDate.toDateString() === date.toDateString();
    });

    const now = new Date();
    
    // Estado de citas
    const hasOverdue = dayAppointments.some(a => {
      if (a.status === "completada" || a.status === "cancelada") return false;
      const d = createAppointmentDate(a.year, a.month, a.day);
      return d ? d < now : false;
    });
    const hasPending = dayAppointments.some(a => {
      if (a.status === "completada" || a.status === "cancelada") return false;
      const d = createAppointmentDate(a.year, a.month, a.day);
      return d ? d >= now : false;
    });
    const hasCompleted = dayAppointments.some(a => a.status === "completada");

    // Estado de órdenes de servicio
    const hasOrderPending = dayOrders.some(o => o.status === "pendiente");
    const hasOrderInProgress = dayOrders.some(o => o.status === "en_progreso");
    const hasOrderCompleted = dayOrders.some(o => o.status === "completado");

    return { hasOverdue, hasPending, hasCompleted, hasOrderPending, hasOrderInProgress, hasOrderCompleted };
  };

  // Componente personalizado para el contenido de la celda
  const DayCellContent = (cellInfo: any) => {
    const date = cellInfo.date;
    const { hasOverdue, hasPending, hasCompleted, hasOrderPending, hasOrderInProgress, hasOrderCompleted } = getDayStatus(date);

    let bgColorClass = "";
    let textColorClass = "";
    let hoverBgClass = "";
    let borderClass = "";
    
    // Prioridad: Overdue > In Progress > Pending > Completed
    if (hasOverdue) {
      bgColorClass = "bg-red-500/20";
      textColorClass = "text-red-700 dark:text-red-400";
      hoverBgClass = "hover:bg-red-500/30";
    } else if (hasOrderInProgress) {
      // Orden en progreso - azul
      bgColorClass = "bg-blue-500/20";
      textColorClass = "text-blue-700 dark:text-blue-400";
      hoverBgClass = "hover:bg-blue-500/30";
      borderClass = "ring-1 ring-blue-500/40";
    } else if (hasPending || hasOrderPending) {
      // Citas pendientes o órdenes pendientes - naranja/primary
      bgColorClass = "bg-orange-500/20";
      textColorClass = "text-orange-700 dark:text-orange-400";
      hoverBgClass = "hover:bg-orange-500/30";
    } else if (hasCompleted || hasOrderCompleted) {
      // Completadas - verde
      bgColorClass = "bg-green-500/15";
      textColorClass = "text-green-700 dark:text-green-400";
      hoverBgClass = "hover:bg-green-500/25";
    }

    return (
      <span 
        className={cn(
          "text-xs font-medium leading-none text-center cursor-pointer",
          hasOverdue && "font-bold",
          (hasPending || hasOrderPending || hasOrderInProgress) && "font-semibold",
          textColorClass,
          cellInfo.isToday && !textColorClass && "text-primary font-bold"
        )}
      >
        {cellInfo.dayNumberText}
      </span>
    );
  };

  const getStatusBadge = (status: AppointmentStatus) => {
    switch (status) {
      case "confirmada":
        return <Badge className="text-[10px] bg-primary hover:bg-primary/90">Confirmada</Badge>;
      case "pendiente":
        return <Badge className="text-[10px] bg-orange-500 hover:bg-orange-500/90">Pendiente</Badge>;
      case "cancelada":
        return <Badge className="text-[10px] bg-red-500 hover:bg-red-500/90">Cancelada</Badge>;
      case "completada":
        return <Badge className="text-[10px] bg-green-500 hover:bg-green-500/90">Completada</Badge>;
      default:
        return null;
    }
  };

  return (
    <>
      <Card className={cn("overflow-hidden border shadow-sm w-full", className)}>
        <CardHeader className="p-2 pb-1">
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <CardTitle className="text-xs font-semibold">Calendario</CardTitle>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant={view === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("calendar")}
                className="h-6 px-1.5 text-[10px]"
              >
                <Calendar className="h-3 w-3 mr-0.5" />
                <span className="hidden sm:inline">Cal</span>
              </Button>
              <Button
                variant={view === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setView("list")}
                className="h-6 px-1.5 text-[10px]"
              >
                <List className="h-3 w-3 mr-0.5" />
                <span className="hidden sm:inline">Lista</span>
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedDate(format(new Date(), "yyyy-MM-dd"));
                  setIsCreateDialogOpen(true);
                }}
                className="h-7 px-2 text-xs"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-1 mt-1 justify-center">
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4" title="Total">
              {stats.total}
            </Badge>
            {stats.pending > 0 && (
              <Badge 
                variant="default" 
                className="text-[9px] bg-orange-500 hover:bg-orange-500/90 px-1 py-0 h-4"
                title="Pendientes"
              >
                {stats.pending}
              </Badge>
            )}
            {stats.inProgress > 0 && (
              <Badge 
                variant="default" 
                className="text-[9px] bg-blue-500 hover:bg-blue-500/90 px-1 py-0 h-4"
                title="En Progreso"
              >
                {stats.inProgress}
              </Badge>
            )}
            {stats.overdue > 0 && (
              <Badge 
                variant="destructive" 
                className="text-[9px] bg-destructive hover:bg-destructive/90 px-1 py-0 h-4"
                title="Vencidas"
              >
                {stats.overdue}
              </Badge>
            )}
            {stats.completed > 0 && (
              <Badge 
                variant="secondary" 
                className="text-[9px] bg-green-100 text-green-700 px-1 py-0 h-4"
                title="Completadas"
              >
                {stats.completed}
              </Badge>
            )}
          </div>

          {/* Leyenda de colores */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2 text-[9px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500/60"></span>
              <span>Pendiente</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/60"></span>
              <span>En Progreso</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500/60"></span>
              <span>Vencida</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500/40"></span>
              <span>Completada</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {view === "calendar" ? (
            <>
              {/* Contenedor para el calendario - altura fija para evitar estiramiento */}
              <div className="relative w-full h-[280px]">
                <FullCalendar
                  ref={calendarRef}
                  plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                  initialView="dayGridMonth"
                  headerToolbar={false}
                  events={calendarEvents}
                  eventClick={handleEventClick}
                  dateClick={handleDateClick}
                  height="100%"
                  locale="en"
                  firstDay={0}
                  dayHeaders={true}
                  dayHeaderFormat={{ weekday: 'narrow' }}
                  titleFormat={{ month: 'short', year: 'numeric' }}
                  eventTimeFormat={{
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }}
                  dayMaxEvents={2}
                  moreLinkText="+"
                  noEventsText="No hay citas"
                  showNonCurrentDates={false}
                  fixedWeekCount={false}
                  dayCellClassNames="calendar-day-cell service-calendar-cell"
                  dayCellContent={(cellInfo) => <DayCellContent {...cellInfo} />}
                  eventContent={(eventInfo) => (
                    <div className="flex items-center gap-1 w-full overflow-hidden">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0" />
                      <span className="text-[10px] leading-tight truncate">
                        {eventInfo.timeText && <span className="opacity-80 mr-1">{eventInfo.timeText}</span>}
                        {eventInfo.event.title}
                      </span>
                    </div>
                  )}
                />
              </div>
              {/* Estilos CSS para el calendario */}
              <style dangerouslySetInnerHTML={{ __html: `
                .service-calendar-cell,
                .service-calendar-cell .fc-daygrid-day-frame,
                .service-calendar-cell .fc-daygrid-day-top {
                  background: transparent !important;
                  border: none !important;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                }
                .service-calendar-cell .fc-daygrid-day-frame {
                  display: flex !important;
                  flex-direction: column !important;
                  min-height: 32px !important;
                }
                .service-calendar-cell .fc-daygrid-day-top {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  text-align: center !important;
                  padding: 2px 0 !important;
                  min-height: 20px !important;
                }
                .fc-daygrid-day-events {
                  margin-top: 1px !important;
                  min-height: 16px !important;
                }
                .fc-daygrid-event-harness {
                  margin-top: 1px !important;
                }
                .fc-daygrid-event {
                  border-radius: 3px !important;
                  padding: 0 3px !important;
                  font-size: 10px !important;
                  line-height: 1.2 !important;
                  white-space: nowrap !important;
                  overflow: hidden !important;
                  text-overflow: ellipsis !important;
                }
                .fc-daygrid-body tbody tr {
                  height: auto !important;
                }
                .fc-col-header-cell {
                  text-align: center !important;
                }
                .fc-col-header-cell-cushion {
                  display: flex !important;
                  align-items: center !important;
                  justify-content: center !important;
                  text-align: center !important;
                  padding: 2px 0 !important;
                  font-size: 11px !important;
                  font-weight: 600 !important;
                }
                .fc-daygrid-day-top {
                  justify-content: center !important;
                }
                .fc-daygrid-day-number {
                  text-align: center !important;
                  float: none !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .fc-daygrid-more-link {
                  font-size: 9px !important;
                  line-height: 1 !important;
                  padding: 0 2px !important;
                  color: hsl(var(--primary)) !important;
                  font-weight: 600 !important;
                }
              `}} />
              {/* Botones de navegación debajo */}
              <div className="flex items-center justify-center gap-1.5 mt-6 pb-1.5 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevMonth}
                  className="h-6 w-6 p-0"
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs font-medium min-w-[100px] text-center capitalize">
                  {currentMonth}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNextMonth}
                  className="h-6 w-6 p-0"
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </>
          ) : (
            <ScrollArea className="h-[420px] p-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : maintenanceAppointments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay citas para mostrar</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {[...maintenanceAppointments]
                    .sort((a, b) => {
                      const dateA = createAppointmentDate(a.year, a.month, a.day, a.time);
                      const dateB = createAppointmentDate(b.year, b.month, b.day, b.time);
                      if (!dateA || !dateB) return 0;
                      return dateB.getTime() - dateA.getTime();
                    })
                    .map((apt) => (
                      <div
                        key={apt.id}
                        onClick={() => onEventClick?.(apt)}
                        className={cn(
                          "p-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                          apt.status === "completada"
                            ? "bg-muted/50 opacity-60"
                            : "bg-card hover:bg-accent",
                          apt.status === "cancelada" && "opacity-40"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={cn(
                              "w-2.5 h-2.5 rounded-full shrink-0 mt-1",
                              getEventColorClass(apt) === "primary" && "bg-primary",
                              getEventColorClass(apt) === "orange" && "bg-orange-500",
                              getEventColorClass(apt) === "green" && "bg-green-500",
                              getEventColorClass(apt) === "red" && "bg-red-500",
                              getEventColorClass(apt) === "gray" && "bg-gray-500"
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-medium text-sm truncate">
                                {apt.title}
                              </h4>
                              {getStatusBadge(apt.status)}
                            </div>
                            
                            <div className="flex items-center gap-1 text-muted-foreground text-xs mt-1">
                              <Clock className="h-3 w-3" />
                              <span>{apt.time}</span>
                              {apt.durationMinutes && (
                                <span>({apt.durationMinutes} min)</span>
                              )}
                            </div>

                            {apt.fleetVehiclePlate && (
                              <div 
                                className="flex items-center gap-1 text-xs mt-1.5 p-1.5 bg-muted/50 rounded cursor-pointer hover:bg-muted transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  apt.fleetVehicleDocumentId && router.push(`/fleet/details/${apt.fleetVehicleDocumentId}`);
                                }}
                              >
                                <Car className="h-3 w-3 text-primary" />
                                <span className="font-medium truncate">
                                  {apt.fleetVehicleBrand} {apt.fleetVehicleModel}
                                </span>
                                <span className="text-muted-foreground">• {apt.fleetVehiclePlate}</span>
                              </div>
                            )}

                            {apt.location && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{apt.location}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Diálogo para crear cita */}
      <CreateServiceAppointmentDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={handleDialogOpenChange}
        selectedDate={selectedDate}
        onSuccess={fetchAppointments}
        preSelectedServiceId={preSelectedServiceId}
      />
    </>
  );
}

function getEventColor(apt: AppointmentCard): string {
  if (apt.status === "completada") return "#22c55e";
  if (apt.status === "cancelada") return "#6b7280";

  const now = new Date();
  const aptDate = createAppointmentDate(apt.year, apt.month, apt.day);

  if (aptDate && aptDate < now && apt.status !== "completada") return "hsl(var(--destructive))";

  switch (apt.status) {
    case "confirmada":
      return "hsl(var(--primary))";
    case "pendiente":
      return "#f97316";
    default:
      return "hsl(var(--primary))";
  }
}

function getEventColorClass(apt: AppointmentCard): string {
  if (apt.status === "completada") return "green";
  if (apt.status === "cancelada") return "gray";

  const now = new Date();
  const aptDate = createAppointmentDate(apt.year, apt.month, apt.day);

  if (aptDate && aptDate < now && apt.status !== "completada") return "red";

  switch (apt.status) {
    case "confirmada":
      return "primary";
    case "pendiente":
      return "orange";
    default:
      return "primary";
  }
}
