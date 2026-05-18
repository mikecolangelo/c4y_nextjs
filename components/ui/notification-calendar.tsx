"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Calendar as CalendarIcon, List, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Badge } from "@/components_shadcn/ui/badge";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  allDay?: boolean;
  type: "reminder" | "manual";
  isCompleted?: boolean;
  isRead?: boolean;
  isActive?: boolean;
  source: "reminder" | "manual";
  vehicleName?: string;
  notificationId?: number;
  reminderId?: number;
}

interface NotificationCalendarProps {
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent) => void;
  className?: string;
}

export function NotificationCalendar({
  events,
  onEventClick,
  className,
}: NotificationCalendarProps) {
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const isCompact = className?.includes("compact-calendar");
  const calendarRef = useRef<FullCalendar | null>(null);

  // Actualizar el mes/año actual cuando el calendario cambia
  const updateCurrentMonth = useCallback(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      const date = calendarApi.getDate();
      setCurrentMonth(
        date.toLocaleDateString("es-ES", {
          month: "long",
          year: "numeric",
        })
      );
    }
  }, []);

  // Inicializar el mes actual al montar el componente
  useEffect(() => {
    updateCurrentMonth();
  }, [updateCurrentMonth]);

  const calendarEvents = useMemo(() => {
    return events.map((event) => ({
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end,
      allDay: event.allDay ?? false,
      extendedProps: {
        ...event,
      },
      backgroundColor: getEventColor(event),
      borderColor: getEventColor(event),
      textColor: "#fff",
      classNames: [
        event.isCompleted ? "opacity-60 line-through" : "",
        event.type === "reminder" && !event.isActive ? "opacity-70" : "",
      ].filter(Boolean),
    }));
  }, [events]);

  const handleEventClick = (info: any) => {
    if (onEventClick) {
      onEventClick(info.event.extendedProps);
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

  const stats = useMemo(() => {
    const now = new Date();
    const total = events.length;
    const completed = events.filter((e) => e.isCompleted).length;
    const pending = events.filter((e) => !e.isCompleted && new Date(e.start) >= now).length;
    const overdue = events.filter((e) => !e.isCompleted && new Date(e.start) < now).length;
    return { total, completed, pending, overdue };
  }, [events]);

  // Función para obtener el estado de un día (vencido, pendiente, completado, mixto)
  const getDayStatus = (date: Date): { hasOverdue: boolean; hasPending: boolean; hasCompleted: boolean } => {
    const dateStr = date.toISOString().split('T')[0];
    const now = new Date();
    
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.start).toISOString().split('T')[0];
      return eventDate === dateStr;
    });

    const hasOverdue = dayEvents.some(e => !e.isCompleted && new Date(e.start) < now);
    const hasPending = dayEvents.some(e => !e.isCompleted && new Date(e.start) >= now);
    const hasCompleted = dayEvents.some(e => e.isCompleted);

    return { hasOverdue, hasPending, hasCompleted };
  };

  // Componente personalizado para el contenido de la celda con color según estado
  const DayCellContent = (cellInfo: any) => {
    const date = cellInfo.date;
    const { hasOverdue, hasPending, hasCompleted } = getDayStatus(date);

    // Determinar el color de fondo (prioridad: vencido > pendiente > completado)
    let bgColorClass = "";
    let textColorClass = "";
    let hoverBgClass = "";
    
    if (hasOverdue) {
      // Color para vencidos
      bgColorClass = "bg-red-500/20";
      textColorClass = "text-red-700 dark:text-red-400";
      hoverBgClass = "hover:bg-red-500/30";
    } else if (hasPending) {
      // Color para pendientes
      bgColorClass = "bg-primary/20";
      textColorClass = "text-primary";
      hoverBgClass = "hover:bg-primary/30";
    } else if (hasCompleted) {
      // Color sutil para completados
      bgColorClass = "bg-green-500/15";
      textColorClass = "text-green-700 dark:text-green-400";
      hoverBgClass = "hover:bg-green-500/25";
    }

    return (
      <span 
        className={cn(
          "font-medium leading-none cursor-pointer",
          isCompact ? "text-xs" : "text-sm",
          hasOverdue && "font-bold",
          hasPending && "font-semibold",
          textColorClass,
          cellInfo.isToday && !textColorClass && "text-primary font-bold"
        )}
      >
        {cellInfo.dayNumberText}
      </span>
    );
  };

  return (
    <Card className={cn("overflow-hidden border-0 shadow-none bg-transparent", className)}>
      <CardHeader className={cn("pb-2", isCompact && "pb-2 px-2 py-2")}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <CalendarIcon className={cn("text-primary", isCompact ? "h-4 w-4" : "h-5 w-5")} />
            <CardTitle className={cn(isCompact ? "text-sm" : "text-lg")}>Calendario</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={view === "calendar" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("calendar")}
              className={cn(isCompact && "h-7 px-2 text-xs")}
            >
              <CalendarIcon className="h-3 w-3 mr-1" />
              <span className={cn(isCompact && "hidden sm:inline")}>Cal</span>
            </Button>
            <Button
              variant={view === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("list")}
              className={cn(isCompact && "h-7 px-2 text-xs")}
            >
              <List className="h-3 w-3 mr-1" />
              <span className={cn(isCompact && "hidden sm:inline")}>Lista</span>
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className={cn("flex flex-wrap gap-2", isCompact ? "mt-2" : "mt-3")}>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {stats.total}
          </Badge>
          <Badge 
            variant="default" 
            className="text-[10px] bg-primary hover:bg-primary/90 px-1.5 py-0"
          >
            {stats.pending} pend
          </Badge>
          {stats.overdue > 0 && (
            <Badge 
              variant="destructive" 
              className="text-[10px] bg-destructive hover:bg-destructive/90 px-1.5 py-0"
            >
              {stats.overdue} venc
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {view === "calendar" ? (
          <>
            {/* Contenedor para el calendario - altura fija para evitar estiramiento */}
            <div className={cn("relative w-full", isCompact ? "h-[280px] p-1" : "h-[320px] p-2")}>
              <FullCalendar
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={false}
                events={calendarEvents}
                eventClick={handleEventClick}
                height="100%"
                contentHeight="auto"
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
                dayMaxEvents={false}
                noEventsText="No hay notificaciones"
                showNonCurrentDates={false}
                fixedWeekCount={false}
                dayCellClassNames="calendar-day-cell"
                dayCellContent={(cellInfo) => <DayCellContent {...cellInfo} />}
                eventContent={() => null}
              />
            </div>
            {/* Botones de navegación debajo */}
            <div className="flex items-center justify-center gap-2 mt-8 pb-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center capitalize">
                {currentMonth}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className={cn("overflow-y-auto", isCompact ? "p-2 max-h-[250px]" : "p-4 max-h-[400px]")}>
            {events.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No hay notificaciones para mostrar
              </div>
            ) : (
              <div className="space-y-2">
                {[...events]
                  .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime())
                  .map((event) => (
                    <div
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md",
                        event.isCompleted
                          ? "bg-muted/50 opacity-60"
                          : "bg-card hover:bg-accent",
                        event.type === "reminder" && !event.isActive && "opacity-70"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-3 h-3 rounded-full shrink-0 mt-1",
                            getEventColorClass(event) === "primary" && "bg-primary",
                            getEventColorClass(event) === "green" && "bg-green-500",
                            getEventColorClass(event) === "amber" && "bg-amber-500",
                            getEventColorClass(event) === "destructive" && "bg-destructive",
                            getEventColorClass(event) === "gray" && "bg-gray-500"
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <h4
                            className={cn(
                              "font-medium text-sm truncate",
                              event.isCompleted && "line-through"
                            )}
                          >
                            {event.title}
                          </h4>
                          {event.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-muted-foreground">
                              {formatEventDate(event.start)}
                            </span>
                            {event.type === "reminder" && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                Recordatorio
                              </Badge>
                            )}
                            {event.isCompleted && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-5 bg-green-100 text-green-700"
                              >
                                Completado
                              </Badge>
                            )}
                            {event.type === "reminder" && !event.isActive && !event.isCompleted && (
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-5 bg-gray-100 text-gray-600"
                              >
                                Pausado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getEventColor(event: CalendarEvent): string {
  if (event.isCompleted) return "#22c55e"; // Verde para completados
  if (event.type === "reminder" && !event.isActive) return "#6b7280"; // Gris para pausados
  
  const now = new Date();
  const eventDate = new Date(event.start);
  
  // Usar destructive color para vencidos (basado en el color del sitio)
  if (eventDate < now) return "hsl(var(--destructive))"; 
  
  // Usar primary color para pendientes (basado en el color del sitio)
  return "hsl(var(--primary))";
}

function getEventColorClass(event: CalendarEvent): string {
  if (event.isCompleted) return "green";
  if (event.type === "reminder" && !event.isActive) return "gray";
  
  const now = new Date();
  const eventDate = new Date(event.start);
  
  if (eventDate < now) return "destructive";
  
  switch (event.type) {
    case "reminder":
      return "primary";
    case "manual":
      return "amber";
    default:
      return "gray";
  }
}

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
  
  if (isToday) return "Hoy";
  if (isYesterday) return "Ayer";
  
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}
