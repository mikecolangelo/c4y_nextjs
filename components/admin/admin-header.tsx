"use client";

import Link from "next/link";
import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Filter, Bell, User as UserIcon, X, Calendar, CheckCircle2, Circle } from "lucide-react";

/**
 * Normaliza valores booleanos que pueden venir como booleanos o enteros (0/1)
 * Strapi a veces devuelve 0/1 en lugar de true/false
 */
function normalizeBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true";
  return false;
}
import { Button } from "@/components_shadcn/ui/button";
import { Separator } from "@/components_shadcn/ui/separator";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { typography } from "@/lib/design-system";
import { LogoutButton } from "@/components/ui/logout-button";
import { MobileMenu } from "./mobile-menu";
import { ThemeToggle } from "./theme-toggle";
import { SpotlightSearch } from "./spotlight-search";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components_shadcn/ui/dropdown-menu";
import { Badge } from "@/components_shadcn/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "@/lib/toast";
import {
  REMINDER_EVENTS,
  emitReminderDeleted,
  emitReminderToggleCompleted,
} from "@/lib/reminder-events";
import { useNotificationsStream } from "@/hooks/use-notifications-stream";

interface AdminHeaderProps {
  title: string;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  showFilterAction?: boolean;
  onFilterActionClick?: () => void;
}

export function AdminHeader({
  title,
  leftActions,
  rightActions,
  showFilterAction = false,
  onFilterActionClick,
}: AdminHeaderProps) {
  const [reminders, setReminders] = useState<any[]>([]);
  const [manualNotifications, setManualNotifications] = useState<any[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [showCompletedReminders, setShowCompletedReminders] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [canAccessProfile, setCanAccessProfile] = useState(true);
  // Ref para evitar recargar cuando el toggle fue disparado localmente
  const skipNextReloadRef = useRef(false);

  // Obtener rol del usuario
  useEffect(() => {
    const fetchRole = async () => {
      try {
        const response = await fetch("/api/user-profile/me", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          setUserRole(data.data?.role || null);
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchRole();
  }, []);

  // Obtener permisos del usuario (para ocultar accesos no permitidos como Perfil)
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const response = await fetch("/api/permissions/me", { cache: "no-store" });
        if (response.ok) {
          const data = await response.json();
          const perms = data.data?.permissions;
          if (perms) setCanAccessProfile(!!perms.profile?.canAccess);
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
      }
    };
    fetchPermissions();
  }, []);

  // Cargar recordatorios y notificaciones manuales
  const loadNotifications = useCallback(async () => {
    setIsLoadingReminders(true);
    try {
      // Cargar recordatorios desde /api/reminders
      const remindersResponse = await fetch("/api/reminders", { cache: "no-store" });
      if (remindersResponse.ok) {
        const { data } = await remindersResponse.json();
        // Filtrar recordatorios activos y no completados
        const activeReminders = (data || []).filter(
          (r: any) => normalizeBoolean(r.isActive) && !normalizeBoolean(r.isCompleted)
        );

        // Aplicar deduplicación adicional en el frontend
        const remindersByKey = new Map<string, any>();
        for (const reminder of activeReminders) {
          const normalizedTitle = (reminder.title?.trim() || "").toLowerCase();
          const vehicleId =
            reminder.vehicle?.documentId ||
            reminder.vehicle?.id ||
            (reminder.vehicle?.name ? reminder.vehicle.name.toLowerCase().trim() : "unknown");
          const key = `${normalizedTitle}-${vehicleId}`;

          const existing = remindersByKey.get(key);
          if (!existing) {
            remindersByKey.set(key, reminder);
          } else {
            const existingDate = existing.createdAt ? new Date(existing.createdAt).getTime() : 0;
            const newDate = reminder.createdAt ? new Date(reminder.createdAt).getTime() : 0;
            const existingId = existing.id || 0;
            const newId = reminder.id || 0;

            if (newDate > existingDate || (newDate === existingDate && newId > existingId)) {
              remindersByKey.set(key, reminder);
            }
          }
        }

        let uniqueReminders = Array.from(remindersByKey.values());

        // Filtrar recordatorios de vehículo para no-admins
        const isAdminUser = userRole === "admin" || userRole === "super-admin";
        if (!isAdminUser) {
          uniqueReminders = uniqueReminders.filter((r: any) => !r.vehicle);
        }

        // Ordenar: primero los que ya pasaron (urgentes), luego por fecha próxima
        const now = new Date();
        uniqueReminders.sort((a: any, b: any) => {
          const dateA = new Date(a.nextTrigger);
          const dateB = new Date(b.nextTrigger);
          const isPastA = dateA < now;
          const isPastB = dateB < now;

          if (isPastA && !isPastB) return -1;
          if (!isPastA && isPastB) return 1;

          return dateA.getTime() - dateB.getTime();
        });
        setReminders(uniqueReminders);
      }

      // Cargar notificaciones manuales desde /api/notifications
      const notificationsResponse = await fetch("/api/notifications", { cache: "no-store" });
      if (notificationsResponse.ok) {
        const { data } = await notificationsResponse.json();
        // Filtrar solo notificaciones manuales (no recordatorios) que no estén leídas
        const unreadManualNotifications = (data || []).filter((n: any) => {
          // Solo notificaciones manuales (excluir recordatorios que también vienen en esta API)
          const isManual = n.type !== "reminder" || (!n.reminderType && !n.module);
          // No leídas y no expiradas
          const isUnread = !normalizeBoolean(n.isRead);
          // No completadas
          const isNotCompleted = !normalizeBoolean(n.isCompleted);
          return isManual && isUnread && isNotCompleted;
        });

        setManualNotifications(unreadManualNotifications);
      }
    } catch (error) {
      console.error("Error cargando notificaciones:", error);
    } finally {
      setIsLoadingReminders(false);
    }
  }, [userRole]);

  // Real-time notifications via SSE, with automatic polling fallback. This
  // replaces the previous 60s `setInterval` poller: a single stream now drives
  // refreshes for the whole app instead of three overlapping timers.
  useNotificationsStream({ onRefresh: loadNotifications });

  useEffect(() => {
    loadNotifications();

    // Escuchar eventos de cambios en recordatorios
    const handleReminderChange = () => {
      // Si el toggle fue disparado localmente, no recargar inmediatamente
      if (skipNextReloadRef.current) {
        skipNextReloadRef.current = false;
        return;
      }
      loadNotifications();
    };

    window.addEventListener(REMINDER_EVENTS.CREATED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.UPDATED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.DELETED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderChange);

    // Recargar cuando la ventana vuelve a tener foco o la pestaña se hace visible.
    const handleFocus = () => {
      loadNotifications();
    };
    const handleVisibility = () => {
      if (!document.hidden) loadNotifications();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener(REMINDER_EVENTS.CREATED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.UPDATED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.DELETED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderChange);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [loadNotifications]);

  const handleDeleteReminder = async (reminderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // La API ahora acepta tanto id numérico como documentId, así que podemos pasar directamente reminderId
      const response = await fetch(`/api/notifications/${encodeURIComponent(reminderId)}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // Actualizar el estado local inmediatamente removiendo el recordatorio eliminado
        setReminders((prev) => {
          return prev.filter((r) => {
            const rId = r.documentId || String(r.id);
            const rIdNum = String(r.id);
            // Comparar tanto documentId como id numérico para asegurar que se elimine correctamente
            return rId !== reminderId && rIdNum !== reminderId;
          });
        });

        toast.success("Recordatorio eliminado");

        // Marcar que el próximo evento de reload debe ser ignorado (fue disparado localmente)
        skipNextReloadRef.current = true;
        // Emitir evento de eliminación después de actualizar el estado local
        emitReminderDeleted(reminderId);

        // Recargar después de un pequeño delay para asegurar que el servidor procesó la eliminación
        setTimeout(() => {
          const loadReminders = async () => {
            try {
              const response = await fetch("/api/reminders", { cache: "no-store" });
              if (response.ok) {
                const { data } = await response.json();
                const activeReminders = (data || []).filter(
                  (r: any) => normalizeBoolean(r.isActive) && !normalizeBoolean(r.isCompleted)
                );
                const now = new Date();
                activeReminders.sort((a: any, b: any) => {
                  const dateA = new Date(a.nextTrigger);
                  const dateB = new Date(b.nextTrigger);
                  const isPastA = dateA < now;
                  const isPastB = dateB < now;
                  if (isPastA && !isPastB) return -1;
                  if (!isPastA && isPastB) return 1;
                  return dateA.getTime() - dateB.getTime();
                });
                setReminders(activeReminders.slice(0, 5));
              }
            } catch (error) {
              console.error("Error recargando recordatorios después de eliminar:", error);
            }
          };
          loadReminders();
        }, 500);
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = errorText ? JSON.parse(errorText) : { error: "Error desconocido" };
        } catch {
          errorData = { error: errorText || `Error ${response.status}` };
        }
        const errorMessage =
          errorData.error?.message ||
          errorData.error ||
          `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error eliminando recordatorio:", error);
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo eliminar el recordatorio";
      toast.error(errorMessage);
    }
  };

  const handleToggleCompleted = async (
    reminderId: string,
    isCompleted: boolean,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(reminderId)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            isCompleted: !isCompleted,
          },
        }),
      });

      if (response.ok) {
        toast.success(
          isCompleted
            ? "Recordatorio marcado como pendiente"
            : "Recordatorio marcado como completado"
        );
        // Actualizar el estado local
        setReminders((prev) => {
          return prev.map((r) => {
            const rId = r.documentId || String(r.id);
            const match = rId === reminderId;
            if (match) {
              return { ...r, isCompleted: !isCompleted };
            }
            return r;
          });
        });
        // Marcar que el próximo evento de reload debe ser ignorado (fue disparado localmente)
        skipNextReloadRef.current = true;
        // Emitir evento de cambio de estado completado
        emitReminderToggleCompleted(reminderId, !isCompleted);
      } else {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = errorText ? JSON.parse(errorText) : { error: "Error desconocido" };
        } catch {
          errorData = { error: errorText || `Error ${response.status}` };
        }
        const errorMessage =
          errorData.error?.message ||
          errorData.error ||
          `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error("Error actualizando recordatorio:", error);
      const errorMessage =
        error instanceof Error ? error.message : "No se pudo actualizar el recordatorio";
      toast.error(errorMessage);
    }
  };

  // Marcar notificación manual como leída
  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      });

      if (response.ok) {
        // Actualizar estado local removiendo la notificación marcada como leída
        setManualNotifications((prev) =>
          prev.filter((n) => (n.documentId || String(n.id)) !== notificationId)
        );
      }
    } catch (error) {
      console.error("Error marcando notificación como leída:", error);
    }
  };

  const formatReminderTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (diffInHours < 24) {
        return formatDistanceToNow(date, { addSuffix: true, locale: es });
      } else {
        return format(date, "d 'de' MMMM, yyyy 'a las' HH:mm", { locale: es });
      }
    } catch {
      return "Fecha inválida";
    }
  };

  // Combinar recordatorios y notificaciones manuales para el contador
  const totalNotifications = [...reminders, ...manualNotifications];
  const unreadCount = totalNotifications.length;

  const defaultRightActions = (
    <>
      <SpotlightSearch />
      {/* Only show the filter icon when a page actually wires a handler.
          Many screens pass `showFilterAction` without `onFilterActionClick`,
          which used to render a dead button that did nothing on click. */}
      {showFilterAction && onFilterActionClick && (
        <Button
          variant="ghost"
          size="icon"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          onClick={onFilterActionClick}
          aria-label="Abrir filtros"
        >
          <Filter className="h-5 w-5" />
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="flex h-10 w-10 items-center justify-center rounded-full relative"
            aria-label="Ver notificaciones"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Notificaciones</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollAreaPrimitive.Root className="relative overflow-hidden max-h-[300px] min-h-[120px]">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <div className="py-1">
                {isLoadingReminders ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Cargando notificaciones...
                  </div>
                ) : totalNotifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No hay notificaciones nuevas
                  </div>
                ) : (
                  <>
                    {/* Notificaciones manuales primero */}
                    {manualNotifications.length > 0 && (
                      <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase">
                        Nuevas
                      </div>
                    )}
                    {manualNotifications.map((notification) => {
                      const notificationId = notification.documentId || String(notification.id);
                      const createdAt = new Date(notification.createdAt || notification.timestamp);

                      return (
                        <div key={`manual-${notificationId}`}>
                          <DropdownMenuItem asChild className="p-0">
                            <div
                              className="flex items-start gap-2 w-full p-3 hover:bg-accent cursor-pointer"
                              onClick={() => handleMarkAsRead(notificationId)}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-col items-start gap-1">
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <Circle className="h-2 w-2 shrink-0 fill-primary text-primary" />
                                      <span className="font-medium text-sm line-clamp-1">
                                        {notification.title}
                                      </span>
                                    </div>
                                  </div>
                                  {notification.description && (
                                    <span className="text-xs text-muted-foreground line-clamp-2">
                                      {notification.description}
                                    </span>
                                  )}
                                  <span className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(createdAt, {
                                      addSuffix: true,
                                      locale: es,
                                    })}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </div>
                      );
                    })}

                    {/* Recordatorios */}
                    {reminders.length > 0 && manualNotifications.length > 0 && (
                      <div className="px-3 py-1 text-xs font-medium text-muted-foreground uppercase mt-2">
                        Recordatorios
                      </div>
                    )}
                    {reminders.map((reminder) => {
                      // IMPORTANTE: Usar ID numérico cuando esté disponible (más confiable para actualizaciones)
                      // Solo usar documentId como fallback si no hay ID numérico
                      const reminderId =
                        reminder.id && typeof reminder.id === "number"
                          ? String(reminder.id)
                          : reminder.documentId || String(reminder.id);
                      const vehicleName = reminder.vehicle?.name || "Vehículo";
                      const nextTrigger = new Date(reminder.nextTrigger);
                      const isAllDay =
                        nextTrigger.getHours() === 0 && nextTrigger.getMinutes() === 0;

                      const isCompleted = normalizeBoolean(reminder.isCompleted);

                      return (
                        <div key={reminderId}>
                          <DropdownMenuItem asChild className="p-0">
                            <div className="flex items-start gap-2 w-full p-3 hover:bg-accent">
                              <div className="flex-1 min-w-0">
                                <Link
                                  href={
                                    reminder.vehicle?.documentId
                                      ? `/fleet/details/${reminder.vehicle.documentId}`
                                      : "#"
                                  }
                                  className="flex flex-col items-start gap-1 cursor-pointer"
                                  onClick={(e) => {
                                    if (!reminder.vehicle?.documentId) {
                                      e.preventDefault();
                                    }
                                  }}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {isCompleted ? (
                                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                                      ) : (
                                        <button
                                          onClick={(e) => {
                                            handleToggleCompleted(reminderId, isCompleted, e);
                                          }}
                                          onPointerDown={(e) => {
                                            e.stopPropagation();
                                          }}
                                          className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/30 hover:border-primary transition-colors flex items-center justify-center"
                                          aria-label="Marcar como completado"
                                          title="Marcar como completado"
                                        >
                                          <Circle className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                      )}
                                      <Calendar
                                        className={`h-4 w-4 shrink-0 ${isCompleted ? "text-muted-foreground/50" : "text-muted-foreground"}`}
                                      />
                                      <span
                                        className={`font-medium text-sm line-clamp-1 ${isCompleted ? "line-through text-muted-foreground/70" : ""}`}
                                      >
                                        {reminder.title}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {isCompleted && (
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-primary"
                                          onClick={(e) =>
                                            handleToggleCompleted(reminderId, isCompleted, e)
                                          }
                                          aria-label="Marcar como pendiente"
                                          title="Marcar como pendiente"
                                        >
                                          <Circle className="h-3 w-3" />
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                                        onClick={(e) => {
                                          handleDeleteReminder(reminderId, e);
                                        }}
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                        }}
                                        aria-label="Eliminar recordatorio"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  <span className="text-xs text-muted-foreground line-clamp-1">
                                    {vehicleName}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {isAllDay
                                      ? format(nextTrigger, "d 'de' MMMM, yyyy", { locale: es }) +
                                        " - todo el día"
                                      : format(nextTrigger, "d 'de' MMMM, yyyy 'a las' HH:mm", {
                                          locale: es,
                                        })}
                                  </span>
                                  {reminder.description && (
                                    <span className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                      {reminder.description}
                                    </span>
                                  )}
                                </Link>
                              </div>
                            </div>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.ScrollAreaScrollbar
              orientation="vertical"
              className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
            >
              <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
            </ScrollAreaPrimitive.ScrollAreaScrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link
              href="/notifications"
              className="w-full text-center justify-center text-primary hover:text-primary focus:text-primary font-medium"
            >
              Ver todas las notificaciones
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {canAccessProfile && (
        <Button
          variant="ghost"
          size="icon"
          className="flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="Ir al perfil"
          asChild
        >
          <Link href="/profile">
            <UserIcon className="h-5 w-5" />
            <span className="sr-only">Ir al perfil</span>
          </Link>
        </Button>
      )}
      <LogoutButton />
    </>
  );

  return (
    <header
      className="sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm rounded-b-lg"
      suppressHydrationWarning
      style={
        {
          backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
          borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
        } as React.CSSProperties
      }
    >
      <MobileMenu />
      {leftActions && (
        <>
          {leftActions}
          <Separator orientation="vertical" className="mr-2 h-4" />
        </>
      )}
      {!leftActions && <Separator orientation="vertical" className="mr-2 h-4" />}
      <h1 className={`${typography.h3} hidden md:block`}>{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        {rightActions ?? defaultRightActions}
      </div>
    </header>
  );
}
