"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Separator } from "@/components_shadcn/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components_shadcn/ui/toggle-group";
import {
  Star,
  Bell,
  Calendar,
  UserPlus,
  Sparkles,
  Receipt,
  Car,
  ExternalLink,
  Circle,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { spacing, typography, commonClasses } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FleetReminder } from "@/validations/types";
import { toast } from "@/lib/toast";
import { DriverOverview } from "./components/driver-overview";
import { useNotificationsStream } from "@/hooks/use-notifications-stream";

interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  type: "reminder" | "lead" | "sale" | "payment" | "inventory";
  icon:
    | typeof Calendar
    | typeof UserPlus
    | typeof Sparkles
    | typeof Receipt
    | typeof Car
    | typeof Bell;
  iconBgColor: string;
  iconColor: string;
  reminderId?: number;
  reminderDocumentId?: string;
  vehicleDocumentId?: string;
  source: "reminder" | "manual";
  isActive?: boolean;
  isCompleted?: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(Math.abs(diffMs) / 60000);
  const diffHours = Math.floor(Math.abs(diffMs) / 3600000);
  const diffDays = Math.floor(Math.abs(diffMs) / 86400000);
  const isPast = diffMs < 0;

  if (Math.abs(diffMins) < 1) {
    return "Ahora";
  } else if (diffMins < 60) {
    return isPast ? `Hace ${diffMins} min` : `En ${diffMins} min`;
  } else if (diffHours < 24) {
    return isPast
      ? `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`
      : `En ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  } else if (diffDays === 1) {
    return isPast ? "Ayer" : "Mañana";
  } else if (diffDays < 7) {
    return isPast ? `Hace ${diffDays} días` : `En ${diffDays} días`;
  } else {
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
}

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "lead":
      return UserPlus;
    case "sale":
      return Sparkles;
    case "reminder":
      return Calendar;
    case "payment":
      return Receipt;
    case "inventory":
      return Car;
    default:
      return Bell;
  }
}

function getNotificationColors(type: Notification["type"]) {
  switch (type) {
    case "lead":
      return { bg: "bg-primary/10", color: "text-primary" };
    case "sale":
      return { bg: "bg-green-500/10", color: "text-green-600" };
    case "reminder":
      return { bg: "bg-primary/10", color: "text-primary" };
    case "payment":
      return { bg: "bg-red-500/10", color: "text-red-600" };
    case "inventory":
      return { bg: "bg-muted", color: "text-muted-foreground" };
    default:
      return { bg: "bg-muted", color: "text-muted-foreground" };
  }
}

export default function DashboardUserRoute() {
  const router = useRouter();
  const [selectedWeek, setSelectedWeek] = useState("Esta Semana");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);

  const weeks = ["Semana Pasada", "Esta Semana", "Próxima Semana"];

  // Función para obtener notificaciones
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoadingNotifications(true);

      const notificationsResponse = await fetch("/api/notifications", {
        cache: "no-store",
        credentials: "include",
      });

      if (!notificationsResponse.ok) {
        console.warn("Error al obtener notificaciones:", notificationsResponse.statusText);
        return;
      }

      const notificationsData = await notificationsResponse.json();
      const allNotificationsFromDB = notificationsData.data || [];

      const remindersResponse = await fetch("/api/reminders", {
        cache: "no-store",
        credentials: "include",
      });

      const remindersData = remindersResponse.ok ? await remindersResponse.json() : { data: [] };
      const allReminders: FleetReminder[] = remindersData.data || [];

      // Convertir notificaciones de la BD
      const convertedNotifications = allNotificationsFromDB.map((notification: any) => {
        if (notification.type === "reminder") {
          const vehicleName = notification.fleetVehicle?.name || "Vehículo";
          const description = notification.description
            ? `${notification.description} - ${vehicleName}`
            : vehicleName;

          const reminderTimestamp = notification.nextTrigger || notification.timestamp;

          return {
            id: `reminder-${notification.documentId || notification.id}`,
            title: notification.title,
            description,
            timestamp: formatRelativeTime(reminderTimestamp),
            isRead: notification.isRead || false,
            type: "reminder" as const,
            icon: Calendar,
            iconBgColor:
              notification.isActive && !notification.isCompleted ? "bg-primary/10" : "bg-muted",
            iconColor:
              notification.isActive && !notification.isCompleted
                ? "text-primary"
                : "text-muted-foreground",
            reminderId: notification.id,
            reminderDocumentId: notification.documentId || String(notification.id),
            source: "reminder" as const,
            isActive: notification.isActive,
            isCompleted: notification.isCompleted,
            vehicleDocumentId: notification.fleetVehicle?.documentId,
            originalTimestamp: reminderTimestamp,
          };
        }
        const colors = getNotificationColors(notification.type);
        return {
          id: `notification-${notification.documentId || notification.id}`,
          title: notification.title,
          description: notification.description || "",
          timestamp: formatRelativeTime(notification.timestamp),
          isRead: notification.isRead,
          type: notification.type,
          icon: getNotificationIcon(notification.type),
          iconBgColor: colors.bg,
          iconColor: colors.color,
          source: "manual" as const,
          originalTimestamp: notification.timestamp,
        };
      });

      // Convertir recordatorios no sincronizados
      const syncedReminderIds = new Set<string>();
      allNotificationsFromDB
        .filter((n: any) => n.type === "reminder")
        .forEach((n: any) => {
          if (n.documentId) syncedReminderIds.add(n.documentId);
          if (n.id) syncedReminderIds.add(String(n.id));
        });

      const unsyncedRemindersAsNotifications = allReminders
        .filter((reminder) => {
          const hasDocumentId = reminder.documentId && syncedReminderIds.has(reminder.documentId);
          const hasId = reminder.id && syncedReminderIds.has(String(reminder.id));
          return !hasDocumentId && !hasId;
        })
        .map((reminder) => {
          const vehicleName = reminder.vehicle?.name || "Vehículo";
          const description = reminder.description
            ? `${reminder.description} - ${vehicleName}`
            : vehicleName;

          return {
            id: `reminder-${reminder.documentId || reminder.id}`,
            title: reminder.title,
            description,
            timestamp: formatRelativeTime(reminder.nextTrigger),
            isRead: false,
            type: "reminder" as const,
            icon: Calendar,
            iconBgColor: reminder.isActive && !reminder.isCompleted ? "bg-primary/10" : "bg-muted",
            iconColor:
              reminder.isActive && !reminder.isCompleted ? "text-primary" : "text-muted-foreground",
            reminderId: reminder.id,
            reminderDocumentId: reminder.documentId,
            source: "reminder" as const,
            isActive: reminder.isActive,
            isCompleted: reminder.isCompleted,
            vehicleDocumentId: reminder.vehicle?.documentId,
            originalTimestamp: reminder.nextTrigger,
          };
        });

      const allNotifications = [...convertedNotifications, ...unsyncedRemindersAsNotifications];

      // Eliminar duplicados por documentId
      const uniqueNotifications = Array.from(
        new Map(allNotifications.map((n) => [n.reminderDocumentId || n.id, n])).values()
      );

      // Ordenar: no leídas primero, luego por timestamp
      uniqueNotifications.sort((a, b) => {
        if (a.isRead !== b.isRead) {
          return a.isRead ? 1 : -1;
        }
        const dateA = (a as any).originalTimestamp || a.timestamp;
        const dateB = (b as any).originalTimestamp || b.timestamp;
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      });

      setNotifications(uniqueNotifications);
    } catch (err) {
      console.error("Error obteniendo notificaciones:", err);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  // Mostrar toast de acceso denegado si viene redirigido desde middleware
  useEffect(() => {
    const cookies = document.cookie.split(";");
    const accessDenied = cookies.find((c) => c.trim().startsWith("access_denied="));
    if (accessDenied) {
      toast.error("Acceso restringido", {
        description: "Se requieren permisos de administrador para acceder a esa sección.",
      });
      // Limpiar la cookie
      document.cookie = "access_denied=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    }
  }, []);

  // Real-time notifications via SSE, with automatic polling fallback (replaces
  // the previous 60s `setInterval` poller).
  useNotificationsStream({ onRefresh: fetchNotifications });

  useEffect(() => {
    fetchNotifications();

    const handleVisibility = () => {
      if (!document.hidden) fetchNotifications();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchNotifications]);

  // Obtener notificaciones activas (no leídas o no completadas)
  const activeNotifications = useMemo(() => {
    return notifications
      .filter((n) => {
        if (n.source === "reminder") {
          // Excluir explícitamente los completados
          const isCompletedFlag = n.isCompleted === true || Number(n.isCompleted) === 1;
          return n.isActive !== false && !isCompletedFlag;
        }
        return !n.isRead;
      })
      .slice(0, 5); // Solo las primeras 5
  }, [notifications]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => {
      if (n.source === "reminder") {
        // Excluir explícitamente los completados
        const isCompletedFlag = n.isCompleted === true || Number(n.isCompleted) === 1;
        return n.isActive !== false && !isCompletedFlag;
      }
      return !n.isRead;
    }).length;
  }, [notifications]);

  // Datos de ejemplo para los totales
  const weeklyTotals = {
    ventas: { amount: "B/. 150,450", change: "+5.2%", isPositive: true },
    servicios: { amount: "B/. 25,600", change: "-1.8%", isPositive: false },
    citas: { amount: "85", change: "+10%", isPositive: true },
  };

  // Datos de ejemplo para actividad diaria
  const dailyActivity = [
    {
      day: "Lunes",
      date: 18,
      ventas: "B/. 25,300",
      servicios: "B/. 4,800",
      citas: 15,
      isHoliday: false,
    },
    {
      day: "Martes",
      date: 19,
      ventas: "B/. 42,150",
      servicios: "B/. 8,200",
      citas: 22,
      isHoliday: true,
      holidayNote: "Descuento de Feriado Aplicado",
    },
    {
      day: "Miércoles",
      date: 20,
      ventas: "B/. 31,000",
      servicios: "B/. 5,100",
      citas: 18,
      isHoliday: false,
    },
    {
      day: "Jueves",
      date: 21,
      ventas: "B/. 28,500",
      servicios: "B/. 4,500",
      citas: 14,
      isHoliday: false,
    },
    {
      day: "Viernes",
      date: 22,
      ventas: "B/. 23,500",
      servicios: "B/. 3,000",
      citas: 16,
      isHoliday: false,
    },
  ];

  return (
    <AdminLayout title="Resumen Semanal" showFilterAction={false}>
      <DriverOverview />

      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardContent className={`flex flex-col ${spacing.gap.base} p-6`}>
          <ToggleGroup
            type="single"
            value={selectedWeek}
            onValueChange={(value) => value && setSelectedWeek(value)}
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-muted p-1"
          >
            {weeks.map((week) => (
              <ToggleGroupItem
                key={week}
                value={week}
                aria-label={week}
                className="flex-1 data-[state=on]:bg-background data-[state=on]:shadow-sm data-[state=on]:text-primary"
              >
                <span className="truncate text-sm font-medium">{week}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <p className={`${typography.body.base} text-center py-1`}>18-24 Nov, 2024</p>
        </CardContent>
      </Card>

      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className={spacing.card.header}>
          <CardTitle className="text-base font-semibold">Totales de la Semana</CardTitle>
        </CardHeader>
        <CardContent
          className={`grid grid-cols-2 lg:grid-cols-3 ${spacing.gap.medium} ${spacing.card.content}`}
        >
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className="flex flex-col gap-2 p-6">
              <p className={commonClasses.metricLabel}>Total Ventas</p>
              <p className={typography.metric.base}>{weeklyTotals.ventas.amount}</p>
              <p
                className={`text-sm font-medium ${
                  weeklyTotals.ventas.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {weeklyTotals.ventas.change}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50">
            <CardContent className="flex flex-col gap-2 p-6">
              <p className={commonClasses.metricLabel}>Total Servicios</p>
              <p className={typography.metric.base}>{weeklyTotals.servicios.amount}</p>
              <p
                className={`text-sm font-medium ${
                  weeklyTotals.servicios.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {weeklyTotals.servicios.change}
              </p>
            </CardContent>
          </Card>
          <Card className="shadow-sm ring-1 ring-inset ring-border/50 col-span-2 lg:col-span-1">
            <CardContent className="flex flex-col gap-2 p-6">
              <p className={commonClasses.metricLabel}>Citas Programadas</p>
              <p className={typography.metric.base}>{weeklyTotals.citas.amount}</p>
              <p
                className={`text-sm font-medium ${
                  weeklyTotals.citas.isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {weeklyTotals.citas.change}
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className={spacing.card.header}>
          <CardTitle className="text-base font-semibold">Actividad Diaria</CardTitle>
        </CardHeader>
        <CardContent className={`flex flex-col ${spacing.gap.base} ${spacing.card.content}`}>
          {dailyActivity.map((day) => (
            <Card
              key={day.day}
              className={`shadow-sm ring-1 ring-inset ring-border/50 ${
                day.isHoliday ? "border-orange-500" : ""
              }`}
            >
              <CardContent className="p-6">
                <CardHeader className="px-0 pt-0 pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className={`${typography.h4} font-bold`}>
                      {day.day} {day.date}
                    </CardTitle>
                    {day.isHoliday && (
                      <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                        <Star className="h-3 w-3 mr-1" />
                        Día Feriado
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <div className={`grid grid-cols-3 ${spacing.gap.medium} text-center`}>
                  <div className="flex flex-col">
                    <p className="text-xs text-muted-foreground uppercase">Ventas</p>
                    <p className={`${typography.body.base} font-semibold`}>{day.ventas}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs text-muted-foreground uppercase">Servicios</p>
                    <p className={`${typography.body.base} font-semibold`}>{day.servicios}</p>
                  </div>
                  <div className="flex flex-col">
                    <p className="text-xs text-muted-foreground uppercase">Citas</p>
                    <p className={`${typography.body.base} font-semibold`}>{day.citas}</p>
                  </div>
                </div>
                {day.isHoliday && day.holidayNote && (
                  <div className="mt-3 text-center">
                    <Separator className="mb-2" />
                    <p className="text-xs text-orange-600 font-medium">{day.holidayNote}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-center pt-4">
            <Button
              variant="link"
              className="h-12 px-6 text-base font-semibold text-primary no-underline hover:no-underline hover:text-primary/70 hover:scale-105 active:scale-[1.02] transition-all duration-200 ease-in-out"
            >
              Ver Más
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sección de Notificaciones */}
      <Card className="shadow-sm ring-1 ring-inset ring-border/50">
        <CardHeader className={spacing.card.header}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificaciones
            </CardTitle>
            {unreadCount > 0 && (
              <Badge className="bg-primary/10 text-primary">
                {unreadCount} {unreadCount === 1 ? "nueva" : "nuevas"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className={spacing.card.content}>
          {isLoadingNotifications ? (
            <div className="flex items-center justify-center py-8">
              <p className={typography.body.small}>Cargando notificaciones...</p>
            </div>
          ) : activeNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Bell className="h-8 w-8 text-muted-foreground mb-2" />
              <p className={typography.body.small}>No tienes notificaciones nuevas</p>
            </div>
          ) : (
            <div className={`flex flex-col ${spacing.gap.base}`}>
              {activeNotifications.map((notification) => {
                const Icon = notification.icon;
                const handleClick = async () => {
                  if (notification.source === "reminder" && notification.vehicleDocumentId) {
                    // Validar que el vehicleDocumentId no sea 'undefined' o inválido
                    if (
                      notification.vehicleDocumentId === "undefined" ||
                      notification.vehicleDocumentId === "null" ||
                      notification.vehicleDocumentId === ""
                    ) {
                      toast.error("Error de navegación", {
                        description:
                          "El vehículo asociado a esta notificación no tiene un ID válido.",
                      });
                      router.push("/notifications");
                      return;
                    }

                    // Verificar que el vehículo existe antes de redirigir
                    try {
                      const response = await fetch(`/api/fleet/${notification.vehicleDocumentId}`, {
                        method: "HEAD",
                        cache: "no-store",
                      });

                      if (response.ok) {
                        router.push(`/fleet/details/${notification.vehicleDocumentId}`);
                      } else {
                        toast.error("Vehículo no encontrado", {
                          description:
                            "El vehículo asociado a esta notificación ya no existe o ha sido eliminado.",
                        });
                        router.push("/notifications");
                      }
                    } catch {
                      // En caso de error de red, redirigir de todos modos y dejar que la página de destino maneje el error
                      router.push(`/fleet/details/${notification.vehicleDocumentId}`);
                    }
                  } else {
                    router.push("/notifications");
                  }
                };

                return (
                  <Card
                    key={notification.id}
                    className={`shadow-sm ring-1 ring-inset ring-border/50 transition-all hover:bg-muted/50 ${
                      notification.source === "reminder" && notification.vehicleDocumentId
                        ? "cursor-pointer"
                        : ""
                    }`}
                    onClick={handleClick}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div
                        className={`flex shrink-0 items-center justify-center rounded-full ${notification.iconBgColor} ${notification.iconColor} size-10`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`${typography.body.base} font-semibold truncate`}>
                          {notification.title}
                        </p>
                        <p className={`${typography.body.small} text-muted-foreground truncate`}>
                          {notification.description}
                        </p>
                        <p className={`${typography.body.small} text-muted-foreground mt-1`}>
                          {notification.timestamp}
                        </p>
                      </div>
                      {!notification.isRead && notification.source !== "reminder" && (
                        <Circle className="h-2.5 w-2.5 fill-primary text-primary shrink-0" />
                      )}
                      {notification.source === "reminder" && notification.vehicleDocumentId && (
                        <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {unreadCount > 5 && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="link"
                    asChild
                    className="h-10 px-4 text-sm font-medium text-primary no-underline hover:no-underline hover:text-primary/70"
                  >
                    <Link href="/notifications">Ver todas las notificaciones ({unreadCount})</Link>
                  </Button>
                </div>
              )}
              {unreadCount <= 5 && unreadCount > 0 && (
                <div className="flex justify-center pt-2">
                  <Button
                    variant="link"
                    asChild
                    className="h-10 px-4 text-sm font-medium text-primary no-underline hover:no-underline hover:text-primary/70"
                  >
                    <Link href="/notifications">Ver todas las notificaciones</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
