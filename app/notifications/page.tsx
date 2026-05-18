"use client";

import { Card, CardContent } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Input } from "@/components_shadcn/ui/input";
import { Label } from "@/components_shadcn/ui/label";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components_shadcn/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components_shadcn/ui/dialog";
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
import { Tabs, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { Archive, CheckCheck, Calendar, Plus, UserPlus, Sparkles, Receipt, Car, Bell, Inbox, CheckCircle2, Circle, Pause, Play, ExternalLink, Trash2, Pin, Clock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { commonClasses, spacing, typography, colors } from "@/lib/design-system";
import { AdminLayout } from "@/components/admin/admin-layout";
import { FleetReminder, ReminderModule } from "@/validations/types";
import { toast } from "@/lib/toast";
import { REMINDER_EVENTS, emitReminderToggleCompleted, emitReminderToggleActive, emitReminderDeleted } from "@/lib/reminder-events";
import { MODULE_LABELS, MODULE_COLORS } from "@/components/ui/unified-reminders";
import { NotificationCalendar } from "@/components/ui/notification-calendar";
import type { CalendarEvent } from "@/components/ui/notification-calendar";

interface UserProfile {
  id: number;
  documentId: string;
  displayName: string;
  email?: string;
  role: "admin" | "seller" | "driver";
}

interface ManualNotification {
  id: number;
  documentId?: string;
  title: string;
  description?: string;
  type: "lead" | "sale" | "reminder" | "payment" | "inventory" | "oil_change_reminder";
  isRead: boolean;
  timestamp: string;
  createdAt: string;
  module?: string;
  reminderType?: "unique" | "recurring";
  scheduledDate?: string;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
  isActive?: boolean;
  isCompleted?: boolean;
  lastTriggered?: string;
  nextTrigger?: string;
  authorDocumentId?: string;
  // Nuevos campos para duración y fijado
  durationDays?: number;
  isPinned?: boolean;
  expiresAt?: string;
  isDismissible?: boolean;
  assignedUsers?: Array<{
    id: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: {
      url?: string;
      alternativeText?: string;
    };
  }>;
  fleetVehicle?: {
    id: number;
    documentId?: string;
    name: string;
  };
  author?: {
    id: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    avatar?: {
      url?: string;
      alternativeText?: string;
    };
  };
  // Mantener fleetReminder para compatibilidad con código legacy
  fleetReminder?: {
    id: number;
    documentId?: string;
    title: string;
    description?: string;
    isActive: boolean;
    isCompleted: boolean;
    nextTrigger: string;
    vehicle?: {
      id: number;
      documentId?: string;
      name: string;
    };
  };
}

interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  isRead: boolean;
  type: "reminder" | "lead" | "sale" | "payment" | "inventory" | "oil_change_reminder";
  icon: typeof Calendar | typeof UserPlus | typeof Sparkles | typeof Receipt | typeof Car | typeof Bell;
  iconBgColor: string;
  iconColor: string;
  reminderId?: number;
  reminderDocumentId?: string;
  notificationId?: number;
  notificationDocumentId?: string;
  source: "reminder" | "manual";
  // Campos adicionales para recordatorios
  isActive?: boolean;
  isCompleted?: boolean;
  module?: ReminderModule;
  vehicleName?: string;
  vehicleDocumentId?: string;
  // Campos para notificaciones fijadas
  isPinned?: boolean;
  isDismissible?: boolean;
  expiresAt?: string;
  authorDocumentId?: string;
  // Campo interno para ordenamiento
  originalTimestamp?: string;
}

// Función para obtener el icono según el tipo
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
    case "oil_change_reminder":
      return Car;
    default:
      return Bell;
  }
}

// Función para obtener los colores según el tipo
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
    case "oil_change_reminder":
      return { bg: "bg-amber-500/10", color: "text-amber-600" };
    default:
      return { bg: "bg-muted", color: "text-muted-foreground" };
  }
}

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

// Función para formatear la fecha relativa
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
      hour: date.getHours() !== 0 || date.getMinutes() !== 0 ? "2-digit" : undefined,
      minute: date.getHours() !== 0 || date.getMinutes() !== 0 ? "2-digit" : undefined,
    });
  }
}

// Función para convertir recordatorios en notificaciones
function remindersToNotifications(reminders: FleetReminder[]): Notification[] {
  return reminders.map((reminder) => {
    const vehicleName = reminder.vehicle?.name || "Vehículo";
    const description = reminder.description 
      ? `${reminder.description} - ${vehicleName}`
      : vehicleName;
    const isActive = normalizeBoolean(reminder.isActive);
    const isCompleted = normalizeBoolean(reminder.isCompleted);
    
    return {
      id: `reminder-${reminder.documentId || reminder.id}`,
      title: reminder.title,
      description,
      timestamp: formatRelativeTime(reminder.nextTrigger),
      isRead: !isActive || new Date(reminder.nextTrigger) < new Date(),
      type: "reminder" as const,
      icon: Calendar,
      iconBgColor: isActive && !isCompleted ? "bg-primary/10" : "bg-muted",
      iconColor: isActive && !isCompleted ? "text-primary" : "text-muted-foreground",
      reminderId: reminder.id,
      reminderDocumentId: reminder.documentId,
      source: "reminder",
      isActive,
      isCompleted,
    };
  });
}

// Función para convertir notificaciones manuales en notificaciones
function manualNotificationsToNotifications(notifications: ManualNotification[]): Notification[] {
  return notifications.map((notification) => {
    const colors = getNotificationColors(notification.type);
    return {
      id: `notification-${notification.documentId || notification.id}`,
      title: notification.title,
      description: notification.description || "",
      timestamp: formatRelativeTime(notification.timestamp),
      isRead: normalizeBoolean(notification.isRead),
      type: notification.type,
      icon: getNotificationIcon(notification.type),
      iconBgColor: colors.bg,
      iconColor: colors.color,
      notificationId: notification.id,
      notificationDocumentId: notification.documentId,
      source: "manual",
      // Campos para notificaciones fijadas
      isPinned: normalizeBoolean(notification.isPinned),
      isDismissible: notification.isDismissible,
      expiresAt: notification.expiresAt,
      authorDocumentId: notification.authorDocumentId,
    };
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"notifications" | "paused" | "completed">("notifications");

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"admin" | "seller" | "driver" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [togglingCompleted, setTogglingCompleted] = useState<Set<string>>(new Set());
  const [locallyUpdatedReminders, setLocallyUpdatedReminders] = useState<Set<string>>(new Set());
  const [deletingReminders, setDeletingReminders] = useState<Set<string>>(new Set());
  const [recentlyDeletedReminders, setRecentlyDeletedReminders] = useState<Set<string>>(new Set());
  // Refs para prevenir múltiples clics de forma síncrona
  const togglingCompletedRef = useRef<Set<string>>(new Set());
  const togglingActiveRef = useRef<Set<string>>(new Set());
  const deletingRemindersRef = useRef<Set<string>>(new Set());
  // Refs para tracking sin causar re-renders en useEffect
  const recentlyDeletedRef = useRef<Set<string>>(new Set());
  const locallyUpdatedRef = useRef<Set<string>>(new Set());
  // Ref para IDs eliminados permanentemente (persiste durante la sesión)
  const permanentlyDeletedIdsRef = useRef<Set<string>>(new Set());
  // Ref para controlar auto-refresh y prevenir race conditions
  const isUserInteractingRef = useRef<boolean>(false);
  // Queue para eventos pendientes (reemplaza debounce)
  const pendingEventQueueRef = useRef<Set<string>>(new Set());
  const isProcessingQueueRef = useRef<boolean>(false);
  const lastUserActionRef = useRef<number>(0);
  // Ref para debounce de fetchNotifications (prevenir múltiples llamadas simultáneas)
  const fetchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const [showDeleteReminderDialog, setShowDeleteReminderDialog] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
  
  // Formulario
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formType, setFormType] = useState<"lead" | "sale" | "reminder" | "payment" | "inventory">("lead");
  const [formRecipientType, setFormRecipientType] = useState<"specific" | "all_sellers" | "all_admins" | "all_drivers">("specific");
  const [formRecipientId, setFormRecipientId] = useState("");
  const [formDurationDays, setFormDurationDays] = useState<number>(7);
  const [formIsPinned, setFormIsPinned] = useState<boolean>(false);

  // Estado único fusionado - Map para O(1) acceso y deduplicación
  const [notificationMap, setNotificationMap] = useState<Map<string, Notification>>(new Map());

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

  // Obtener usuarios para el selector
  useEffect(() => {
    async function fetchUsers() {
      try {
        const response = await fetch("/api/user-profiles", {
          cache: "no-store",
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setUsers(data.data || []);
        }
      } catch (err) {
        console.error("Error obteniendo usuarios:", err);
      }
    }
    fetchUsers();
  }, []);

  // Helper: Generar llave única consistente para cada notificación
  const getNotificationKey = useCallback((item: any): string => {
    // Prioridad: documentId > notificationId > reminderId > id + source
    if (item.documentId) return `doc:${item.documentId}`;
    if (item.notificationDocumentId) return `doc:${item.notificationDocumentId}`;
    if (item.reminderDocumentId) return `doc:${item.reminderDocumentId}`;
    if (item.notificationId) return `num:${item.notificationId}`;
    if (item.reminderId) return `num:${item.reminderId}`;
    if (item.id && typeof item.id === 'string' && item.id.includes('-')) {
      // Ya es un ID compuesto como "reminder-123" o "notification-abc"
      const parts = item.id.split('-');
      if (parts.length === 2) return `num:${parts[1]}`;
    }
    return `temp:${item.id || Date.now()}`;
  }, []);
  
  // Helper: Fusionar dos notificaciones (prioriza datos más completos)
  const mergeNotificationData = useCallback((existing: Notification, incoming: any): Notification => {
    // Si el incoming tiene documentId y el existing no, el incoming es más "oficial"
    const shouldPreferIncoming = incoming.documentId && !existing.notificationDocumentId && !existing.reminderDocumentId;
    
    return {
      ...existing,
      ...incoming,
      // Preservar campos críticos si el existing los tiene y el incoming no
      id: existing.id, // Mantener ID estable para React key
      vehicleName: incoming.vehicleName || existing.vehicleName,
      vehicleDocumentId: incoming.vehicleDocumentId || existing.vehicleDocumentId,
      // Fusionar booleanos (si cualquiera es true, queda true)
      isPinned: normalizeBoolean(incoming.isPinned) || normalizeBoolean(existing.isPinned),
      isRead: normalizeBoolean(incoming.isRead !== undefined ? incoming.isRead : existing.isRead),
      isCompleted: normalizeBoolean(incoming.isCompleted !== undefined ? incoming.isCompleted : existing.isCompleted),
      isActive: normalizeBoolean(incoming.isActive !== undefined ? incoming.isActive : existing.isActive),
    };
  }, []);

  // Función para obtener notificaciones del usuario (YA SINCRONIZADAS desde la BD)
  // NOTA: Los recordatorios se sincronizan automáticamente en el backend como notificaciones
  // No necesitamos fetch separado a /api/reminders - eso causaba duplicados
  // 
  // DEBOUNCE: Si se llama múltiples veces en 300ms, solo se ejecuta una vez
  const fetchNotifications = useCallback(async () => {
    // Si ya está corriendo, ignorar esta llamada
    if (isFetchingRef.current) {
      return;
    }
    
    // Limpiar timer anterior si existe
    if (fetchDebounceTimerRef.current) {
      clearTimeout(fetchDebounceTimerRef.current);
    }
    
    // Crear nuevo timer para debounce
    fetchDebounceTimerRef.current = setTimeout(async () => {
      isFetchingRef.current = true;
      
    try {
      setIsLoading(true);
      setError(null);
        
        // ÚNICA FUENTE DE VERDAD: /api/notifications ya incluye recordatorios sincronizados
        const notificationsResponse = await fetch("/api/notifications", {
          cache: "no-store",
          credentials: "include",
        });

        if (!notificationsResponse.ok) {
          throw new Error(`Error al obtener notificaciones: ${notificationsResponse.statusText}`);
        }

        const notificationsData = await notificationsResponse.json();
        const allNotificationsFromDB: ManualNotification[] = notificationsData.data || [];

        // Map único - sin duplicados porque el backend ya consolidó todo
        const newMap = new Map<string, Notification>();
        
        // Procesar notificaciones (que ya incluyen recordatorios sincronizados)
        allNotificationsFromDB.forEach((notification) => {
          const isActive = normalizeBoolean(notification.isActive);
          const isCompleted = normalizeBoolean(notification.isCompleted);
          const isRead = normalizeBoolean(notification.isRead);
          const isPinned = normalizeBoolean(notification.isPinned);
          
          let incomingNotification: Notification;
          
          if (notification.type === "reminder") {
            const vehicleName = notification.fleetVehicle?.name || "Vehículo";
            const description = notification.description 
              ? `${notification.description} - ${vehicleName}`
              : vehicleName;
            const reminderTimestamp = notification.nextTrigger || notification.timestamp;
            
            incomingNotification = {
              id: `reminder-${notification.documentId || notification.id}`,
              title: notification.title,
              description,
              timestamp: formatRelativeTime(reminderTimestamp),
              isRead: isRead || false,
              type: "reminder" as const,
              icon: Calendar,
              iconBgColor: isActive && !isCompleted ? "bg-primary/10" : "bg-muted",
              iconColor: isActive && !isCompleted ? "text-primary" : "text-muted-foreground",
              reminderId: notification.id,
              reminderDocumentId: notification.documentId || String(notification.id),
              notificationId: notification.id,
              notificationDocumentId: notification.documentId || String(notification.id),
              source: "reminder" as const,
              originalTimestamp: reminderTimestamp,
              isActive,
              isCompleted,
              module: (notification.module as ReminderModule) || "fleet",
              vehicleName,
              vehicleDocumentId: notification.fleetVehicle?.documentId,
            };
          } else {
            const colors = getNotificationColors(notification.type);
            incomingNotification = {
              id: `notification-${notification.documentId || notification.id}`,
              title: notification.title,
              description: notification.description || "",
              timestamp: formatRelativeTime(notification.timestamp),
              isRead,
              type: notification.type,
              icon: getNotificationIcon(notification.type),
              iconBgColor: colors.bg,
              iconColor: colors.color,
              notificationId: notification.id,
              notificationDocumentId: notification.documentId,
              source: "manual" as const,
              originalTimestamp: notification.timestamp,
              isPinned,
              isDismissible: notification.isDismissible,
              expiresAt: notification.expiresAt,
              authorDocumentId: notification.authorDocumentId,
            };
          }
          
          const key = getNotificationKey(incomingNotification);
          
          if (newMap.has(key)) {
            // Fusionar con existente
            const existing = newMap.get(key)!;
            newMap.set(key, mergeNotificationData(existing, incomingNotification));
          } else {
            newMap.set(key, incomingNotification);
          }
        });
        
        setNotificationMap(newMap);
    } catch (err) {
      console.error("Error obteniendo notificaciones:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
    }, 300); // Debounce: esperar 300ms antes de ejecutar
  }, []);

  // Lista computada a partir del Map (siempre actualizada)
  const notificationList = useMemo(() => {
    // Filtrar eliminados y convertir a array
    const list = Array.from(notificationMap.values()).filter(n => {
      const docId = n.reminderDocumentId || n.notificationDocumentId;
      if (docId && permanentlyDeletedIdsRef.current.has(docId)) return false;
      if (n.reminderId && permanentlyDeletedIdsRef.current.has(String(n.reminderId))) return false;
      if (n.notificationId && permanentlyDeletedIdsRef.current.has(String(n.notificationId))) return false;
      return true;
    });
    
    // Ordenar: no leídas primero, luego por timestamp
    list.sort((a, b) => {
      if (a.isRead !== b.isRead) {
        return a.isRead ? 1 : -1;
      }
      const dateA = (a as any).originalTimestamp || a.timestamp;
      const dateB = (b as any).originalTimestamp || b.timestamp;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    
    return list;
  }, [notificationMap]);

  // Obtener notificaciones del usuario (ya sincronizadas desde la BD)
  useEffect(() => {
    fetchNotifications();
    
    // Procesador de cola de eventos para evitar pérdida de actualizaciones
    const processEventQueue = async () => {
      if (isProcessingQueueRef.current || pendingEventQueueRef.current.size === 0) return;
      
      isProcessingQueueRef.current = true;
      
      // Esperar un poco para acumular eventos relacionados
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Limpiar la cola y hacer un solo fetch
      pendingEventQueueRef.current.clear();
      
      // Solo hacer fetch si el usuario no está interactuando
      const timeSinceLastAction = Date.now() - lastUserActionRef.current;
      if (!isUserInteractingRef.current && timeSinceLastAction > 2000) {
        await fetchNotifications();
      }
      
      isProcessingQueueRef.current = false;
      
      // Si llegaron más eventos mientras procesábamos, procesar de nuevo
      if (pendingEventQueueRef.current.size > 0) {
        setTimeout(processEventQueue, 50);
      }
    };
    
    // Escuchar eventos de cambios en recordatorios para sincronización automática
    const handleReminderChange = (event?: Event) => {
      const customEvent = event as CustomEvent<{ reminderId?: string | number }>;
      const eventType = customEvent?.type;
      
      // GUARDA UNIVERSAL: Ignorar cualquier evento si usuario acaba de interactuar (< 5 segundos)
      const timeSinceLastAction = Date.now() - lastUserActionRef.current;
      if (timeSinceLastAction < 5000) {
        return;
      }
      
      // Para DELETE, verificar si lo eliminamos recientemente desde aquí
      if (eventType === REMINDER_EVENTS.DELETED) {
        if (customEvent?.detail?.reminderId) {
          const reminderId = String(customEvent.detail.reminderId);
          // Si lo eliminamos recientemente desde aquí, ya recargamos manualmente
          // Solo recargar si viene de otro lugar (página de detalles)
          if (recentlyDeletedRef.current.has(reminderId)) {
            // Lo eliminamos desde aquí, ya recargamos, no hacer nada
            return;
          }
          // Verificar también en locallyUpdatedRef (por si acaso)
          if (locallyUpdatedRef.current.has(`doc:${reminderId}`) || 
              locallyUpdatedRef.current.has(`num:${reminderId}`)) {
            return;
          }
        }
        // Viene de otro lugar, agregar a cola y procesar
        pendingEventQueueRef.current.add(`delete:${Date.now()}`);
        processEventQueue();
        return;
      }
      
      // Para otros eventos, verificar si lo actualizamos localmente (ID matching)
      if (customEvent?.detail?.reminderId) {
        const reminderId = String(customEvent.detail.reminderId);
        // Verificar en todas las formas posibles de ID
        if (locallyUpdatedRef.current.has(reminderId) ||
            locallyUpdatedRef.current.has(`doc:${reminderId}`) ||
            locallyUpdatedRef.current.has(`num:${reminderId}`)) {
          // Ya lo actualizamos localmente, no recargar para evitar el parpadeo
          return;
        }
      }
      
      // Agregar evento a la cola en lugar de hacer fetch inmediato
      const eventKey = `${eventType}:${customEvent?.detail?.reminderId || Date.now()}`;
      pendingEventQueueRef.current.add(eventKey);
      processEventQueue();
    };
    
    window.addEventListener(REMINDER_EVENTS.CREATED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.UPDATED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.DELETED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderChange);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderChange);
    
    // Recargar cuando la ventana vuelve a tener foco (usando cola para evitar sobrecarga)
    const handleFocus = () => {
      const timeSinceLastAction = Date.now() - lastUserActionRef.current;
      // Solo agregar a cola si no hay interacción reciente
      if (!isUserInteractingRef.current && timeSinceLastAction > 3000) {
        pendingEventQueueRef.current.add(`focus:${Date.now()}`);
        processEventQueue();
      }
    };
    window.addEventListener('focus', handleFocus);
    
    // Recargar cada minuto como respaldo, pero solo si el usuario no está interactuando
    const interval = setInterval(() => {
      const timeSinceLastAction = Date.now() - lastUserActionRef.current;
      // Solo recargar si no hay interacción reciente (últimos 5 segundos)
      if (!isUserInteractingRef.current && timeSinceLastAction > 5000) {
        fetchNotifications();
      }
    }, 60000);
    
    return () => {
      clearInterval(interval);
      // Limpiar debounce timer al desmontar
      if (fetchDebounceTimerRef.current) {
        clearTimeout(fetchDebounceTimerRef.current);
      }
      window.removeEventListener(REMINDER_EVENTS.CREATED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.UPDATED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.DELETED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderChange);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchNotifications]);

  const handleMarkAllAsRead = async () => {
    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();
    
    try {
      // Obtener todas las notificaciones no leídas
      const unreadNotifications = notificationList.filter((n) => !n.isRead);
      
      // 1. REGISTRAR TODOS los IDs para ignorar futuros fetches de estos eventos
      const unreadKeys = unreadNotifications.map(n => getNotificationKey(n));
      unreadKeys.forEach(key => locallyUpdatedRef.current.add(key));
      
      // Actualizar TODAS localmente primero (optimista inmediata)
      setNotificationMap((prev) => {
        const newMap = new Map(prev);
        unreadNotifications.forEach((notification) => {
          const key = getNotificationKey(notification);
          const existing = newMap.get(key);
          if (existing) {
            newMap.set(key, { ...existing, isRead: true });
          }
        });
        return newMap;
      });
      
      // 2. Procesar en batches de 5 para evitar saturar conexiones HTTP
      const BATCH_SIZE = 5;
      const apiNotifications = unreadNotifications.filter(
        (n) => n.notificationId || n.notificationDocumentId
      );
      
      for (let i = 0; i < apiNotifications.length; i += BATCH_SIZE) {
        const batch = apiNotifications.slice(i, i + BATCH_SIZE);
        
        // Procesar batch concurrentemente (máximo 5)
        await Promise.all(
          batch.map(async (notification) => {
            const notificationId = notification.notificationId || notification.notificationDocumentId;
            try {
              await fetch(`/api/notifications/${notificationId}`, {
                method: "PATCH",
                credentials: "include",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ isRead: true }),
              });
            } catch (error) {
              console.error(`Error marcando notificación ${notificationId} como leída:`, error);
            }
          })
        );
        
        // Pequeña pausa entre batches para no saturar
        if (i + BATCH_SIZE < apiNotifications.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      toast.success("Todas las notificaciones han sido marcadas como leídas");
      
      // 3. LIMPIAR registros después de un tiempo para evitar fugas de memoria
      setTimeout(() => {
        unreadKeys.forEach(key => locallyUpdatedRef.current.delete(key));
        isUserInteractingRef.current = false;
      }, 2000);
    } catch (error) {
      console.error("Error marcando todas las notificaciones como leídas:", error);
      toast.error("Error al marcar las notificaciones como leídas");
      isUserInteractingRef.current = false;
      // En caso de error, recargar para sincronizar estado
      fetchNotifications();
    }
  };

  // Marcar notificación individual como leída
  const handleMarkAsRead = async (notification: Notification) => {
    // Solo aplica a notificaciones manuales (no recordatorios)
    if (notification.source !== "manual") return;
    
    const notificationId = notification.notificationId || notification.notificationDocumentId;
    if (!notificationId) {
      console.error("No se pudo obtener el ID de la notificación");
      return;
    }
    
    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();
    
    // 1. REGISTRAR ID inmediatamente para ignorar futuros fetches de este evento
    const notificationKey = getNotificationKey(notification);
    locallyUpdatedRef.current.add(notificationKey);
    
    // Actualización optimista: remover la notificación del Map (ya que al marcarla como leída
    // deja de ser "activa" y no debe mostrarse en la pestaña de activas)
    setNotificationMap((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(notificationKey);
      if (existing) {
        // Actualizar isRead a true - esto hará que isNotificationActive retorne false
        // y la notación se filtre automáticamente de la lista de activas
        newMap.set(notificationKey, { ...existing, isRead: true });
      }
      return newMap;
    });
    
    // Forzar actualización inmediata de la UI
    // Esto asegura que la notificación desaparezca de la lista de activas inmediatamente
    
    // Limpiar el registro después de un tiempo para evitar fugas de memoria
    setTimeout(() => {
      locallyUpdatedRef.current.delete(notificationKey);
    }, 5000);
    
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isRead: true }),
      });

      if (response.status === 410) {
        // La notificación no existe en la BD - eliminarla del estado local
        console.log('Notificación no existe en BD, eliminando del estado local:', notificationId);
        setNotificationMap((prev) => {
          const newMap = new Map(prev);
          newMap.delete(notificationKey);
          return newMap;
        });
        toast.success("Notificación eliminada");
        isUserInteractingRef.current = false;
        return;
      }

      if (!response.ok) {
        throw new Error("Error al marcar como leída");
      }

      toast.success("Notificación marcada como leída");
      
      // Éxito: confiar en la actualización optimista
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 500);
    } catch (error) {
      console.error("Error marcando notificación como leída:", error);
      toast.error("Error al marcar como leída");
      isUserInteractingRef.current = false;
      // En caso de error, recargar para sincronizar estado
      fetchNotifications();
    }
  };

  // Marcar recordatorio como completado
  const handleToggleCompleted = async (notification: Notification) => {
    if (notification.source !== "reminder") return;
    
    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();
    
    // Usar reminderDocumentId si existe, sino usar reminderId o notificationId
    const reminderId = notification.reminderDocumentId || 
                       (notification.reminderId ? String(notification.reminderId) : null) ||
                       (notification.notificationId ? String(notification.notificationId) : null);
    
    if (!reminderId) {
      console.error("No se pudo obtener el ID del recordatorio para actualizar:", notification);
      toast.error("Error: No se pudo identificar el recordatorio");
      isUserInteractingRef.current = false;
      return;
    }
    
    const notificationId = notification.id;
    
    // Prevenir múltiples clics de forma síncrona usando ref
    if (togglingCompletedRef.current.has(notificationId)) {
      isUserInteractingRef.current = false;
      return;
    }
    
    // Agregar inmediatamente al ref (síncrono)
    togglingCompletedRef.current.add(notificationId);
    
    // También actualizar el estado para el disabled del botón
    setTogglingCompleted((prev) => new Set(prev).add(notificationId));
    
    const newCompletedState = !notification.isCompleted;
    
    // Actualización optimista del estado ANTES de la petición
    const previousState = notification.isCompleted;
    const notificationKey = getNotificationKey(notification);
    
    // Actualizar el Map directamente
    setNotificationMap((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(notificationKey);
      if (existing) {
        const isActive = existing.isActive !== false;
        newMap.set(notificationKey, {
          ...existing,
          isCompleted: newCompletedState,
          iconBgColor: isActive && !newCompletedState ? "bg-primary/10" : "bg-muted",
          iconColor: isActive && !newCompletedState ? "text-primary" : "text-muted-foreground",
        });
      }
      return newMap;
    });
    
    try {
      // Log para depuración
      if (process.env.NODE_ENV === 'development') {
        console.log("Actualizando recordatorio:", {
          reminderId,
          notificationId: notification.id,
          reminderDocumentId: notification.reminderDocumentId,
          reminderIdNum: notification.reminderId,
          notificationIdNum: notification.notificationId,
          newCompletedState,
        });
      }
      
      const response = await fetch(`/api/notifications/${encodeURIComponent(reminderId)}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { isCompleted: newCompletedState },
        }),
      });

      if (!response.ok) {
        let errorMessage = "Error al actualizar el recordatorio";
        try {
          // Clonar la respuesta para poder leer el body múltiples veces si es necesario
          const responseClone = response.clone();
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.error?.message || errorMessage;
        } catch (parseError) {
          // Si no se puede parsear como JSON, intentar leer como texto
          try {
            const errorText = await response.text();
            if (errorText) {
              try {
                const parsed = JSON.parse(errorText);
                errorMessage = parsed.error || parsed.error?.message || errorMessage;
              } catch {
                errorMessage = errorText || errorMessage;
              }
            }
          } catch (textError) {
            // Si tampoco se puede leer como texto, usar el mensaje por defecto
            console.error("Error leyendo respuesta del servidor:", textError);
            errorMessage = `Error ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      // Marcar que actualizamos este recordatorio localmente (ID simple y key completa)
      setLocallyUpdatedReminders((prev) => new Set(prev).add(reminderId));
      locallyUpdatedRef.current.add(reminderId);
      locallyUpdatedRef.current.add(notificationKey); // Registrar también la key completa
      
      // Emitir evento para sincronización con otros componentes
      emitReminderToggleCompleted(reminderId, newCompletedState);
      
      // Limpiar la marca después de un tiempo para permitir futuras actualizaciones desde otros componentes
      setTimeout(() => {
        setLocallyUpdatedReminders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reminderId);
          return newSet;
        });
        locallyUpdatedRef.current.delete(reminderId);
        locallyUpdatedRef.current.delete(notificationKey); // Limpiar también la key completa
      }, 2000);
      
      toast.success(newCompletedState ? "Recordatorio completado" : "Recordatorio marcado como pendiente");
    } catch (error) {
      console.error("Error actualizando recordatorio:", error);
      // Revertir el estado optimista en caso de error
      setNotificationMap((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(notificationKey);
        if (existing) {
          const isActive = existing.isActive !== false;
          newMap.set(notificationKey, {
            ...existing,
            isCompleted: previousState,
            iconBgColor: isActive && !previousState ? "bg-primary/10" : "bg-muted",
            iconColor: isActive && !previousState ? "text-primary" : "text-muted-foreground",
          });
        }
        return newMap;
      });
      
      const errorMessage = error instanceof Error ? error.message : "Error al actualizar el recordatorio";
      toast.error(errorMessage);
    } finally {
      // Remover de la lista de procesando (tanto del ref como del estado)
      togglingCompletedRef.current.delete(notificationId);
      setTogglingCompleted((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
      // Liberar el bloqueo de interacción después de un tiempo
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 1000);
    }
  };

  // Pausar/Activar recordatorio
  const handleToggleActive = async (notification: Notification) => {
    if (notification.source !== "reminder") return;
    
    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();
    
    // Usar reminderDocumentId si existe, sino usar reminderId o notificationId
    const reminderId = notification.reminderDocumentId || 
                       (notification.reminderId ? String(notification.reminderId) : null) ||
                       (notification.notificationId ? String(notification.notificationId) : null);
    
    if (!reminderId) {
      console.error("No se pudo obtener el ID del recordatorio para actualizar:", notification);
      toast.error("Error: No se pudo identificar el recordatorio");
      isUserInteractingRef.current = false;
      return;
    }
    
    const notificationId = notification.id;
    
    // Prevenir múltiples clics de forma síncrona usando ref
    if (togglingActiveRef.current.has(notificationId)) {
      return;
    }
    
    // Agregar inmediatamente al ref (síncrono)
    togglingActiveRef.current.add(notificationId);
    
    const newActiveState = !notification.isActive;
    
    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(reminderId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { isActive: newActiveState },
        }),
      });

      if (!response.ok) {
        let errorMessage = "Error al actualizar el recordatorio";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.error?.message || errorMessage;
        } catch {
          const errorText = await response.text().catch(() => "");
          if (errorText) {
            try {
              const parsed = JSON.parse(errorText);
              errorMessage = parsed.error || parsed.error?.message || errorMessage;
            } catch {
              errorMessage = errorText || errorMessage;
            }
          }
        }
        throw new Error(errorMessage);
      }

      // Actualizar estado local en el Map
      const notificationKey = getNotificationKey(notification);
      setNotificationMap((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(notificationKey);
        if (existing) {
          newMap.set(notificationKey, { ...existing, isActive: newActiveState });
        }
        return newMap;
      });
      
      // REGISTRAR ID para ignorar futuros fetches de este evento
      locallyUpdatedRef.current.add(reminderId);
      locallyUpdatedRef.current.add(notificationKey);

      // Emitir evento para sincronización
      emitReminderToggleActive(reminderId, newActiveState);
      toast.success(newActiveState ? "Recordatorio activado" : "Recordatorio pausado");
      
      // Limpiar registros después de un tiempo
      setTimeout(() => {
        locallyUpdatedRef.current.delete(reminderId);
        locallyUpdatedRef.current.delete(notificationKey);
      }, 2000);
    } catch (error) {
      console.error("Error actualizando recordatorio:", error);
      const errorMessage = error instanceof Error ? error.message : "Error al actualizar el recordatorio";
      toast.error(errorMessage);
    } finally {
      // Remover de la lista de procesando
      togglingActiveRef.current.delete(notificationId);
      // Liberar el bloqueo de interacción después de un tiempo
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 1000);
    }
  };

  const handleRequestDeleteReminder = (notification: Notification) => {
    if (notification.source !== "reminder") return;
    
    // Usar reminderDocumentId si existe, sino usar reminderId o notificationId
    const reminderId = notification.reminderDocumentId || 
                       (notification.reminderId ? String(notification.reminderId) : null) ||
                       (notification.notificationId ? String(notification.notificationId) : null);
    
    if (!reminderId) {
      console.error("No se pudo obtener el ID del recordatorio para eliminar:", notification);
      toast.error("Error: No se pudo identificar el recordatorio");
      return;
    }
    
    if (deletingReminders.has(notification.id)) return;
    setNotificationToDelete(notification);
    setShowDeleteReminderDialog(true);
  };

  // Eliminar recordatorio (lógica real, llamada desde el modal de confirmación)
  // Solicitar eliminación de notificación manual (abrir modal de confirmación)
  const handleRequestDeleteManual = (notification: Notification) => {
    console.log('🗑️ [handleRequestDeleteManual] Iniciando:', {
      id: notification.id,
      notificationId: notification.notificationId,
      notificationDocumentId: notification.notificationDocumentId,
      source: notification.source,
      title: notification.title,
    });
    
    if (notification.source !== "manual") {
      console.log('❌ [handleRequestDeleteManual] No es notificación manual');
      return;
    }
    
    if (deletingReminders.has(notification.id)) {
      console.log('❌ [handleRequestDeleteManual] Ya se está eliminando');
      return;
    }
    
    const notificationId = notification.notificationId || notification.notificationDocumentId;
    if (!notificationId) {
      console.error('❌ [handleRequestDeleteManual] No hay ID de notificación:', notification);
      toast.error("Error: No se pudo identificar la notificación");
      return;
    }
    
    console.log('✅ [handleRequestDeleteManual] Abriendo diálogo de confirmación');
    setNotificationToDelete(notification);
    setShowDeleteReminderDialog(true);
  };
  
  // Eliminar notificación manual (lógica real)
  const handleDeleteManual = async (notification: Notification) => {
    console.log('🗑️ [handleDeleteManual] Iniciando eliminación:', {
      id: notification.id,
      notificationId: notification.notificationId,
      notificationDocumentId: notification.notificationDocumentId,
      source: notification.source,
    });
    
    if (notification.source !== "manual") {
      console.log('❌ [handleDeleteManual] No es notificación manual');
      return;
    }
    
    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();
    
    const notificationId = notification.notificationId || notification.notificationDocumentId;
    
    if (!notificationId) {
      isUserInteractingRef.current = false;
      console.error("❌ [handleDeleteManual] No se pudo obtener el ID de la notificación:", notification);
      toast.error("Error: No se pudo identificar la notificación");
      return;
    }
    
    console.log('✅ [handleDeleteManual] ID a eliminar:', notificationId);
    
    const id = notification.id;
    
    // Prevenir múltiples clics
    if (deletingRemindersRef.current.has(id)) {
      console.log('❌ [handleDeleteManual] Ya se está eliminando');
      return;
    }
    
    deletingRemindersRef.current.add(id);
    setDeletingReminders((prev) => new Set(prev).add(id));
    
    // Actualización optimista: remover del Map
    const notificationKey = getNotificationKey(notification);
    const previousNotification = notificationMap.get(notificationKey);
    
    setNotificationMap((prev) => {
      const newMap = new Map(prev);
      newMap.delete(notificationKey);
      return newMap;
    });
    
    try {
      const url = `/api/notifications/${encodeURIComponent(String(notificationId))}`;
      console.log('📤 [handleDeleteManual] Enviando DELETE a:', url);
      
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      console.log('📥 [handleDeleteManual] Respuesta:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [handleDeleteManual] Error en respuesta:', errorText);
        throw new Error(`Error al eliminar la notificación: ${errorText}`);
      }

      // Marcar como eliminado permanentemente
      permanentlyDeletedIdsRef.current.add(String(notificationId));
      
      console.log('✅ [handleDeleteManual] Notificación eliminada exitosamente');
      toast.success("Notificación eliminada");
    } catch (error) {
      console.error("❌ [handleDeleteManual] Error eliminando notificación:", error);
      // Revertir el estado optimista
      if (previousNotification) {
        setNotificationMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(notificationKey, previousNotification);
          return newMap;
        });
      }
      toast.error("Error al eliminar la notificación");
    } finally {
      deletingRemindersRef.current.delete(id);
      setDeletingReminders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 500);
    }
  };

  const handleDeleteReminder = async (notification: Notification) => {
    if (notification.source !== "reminder") return;
    
    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();
    
    // Usar reminderDocumentId si existe, sino usar reminderId o notificationId
    const reminderId = notification.reminderDocumentId || 
                       (notification.reminderId ? String(notification.reminderId) : null) ||
                       (notification.notificationId ? String(notification.notificationId) : null);
    
    if (!reminderId) {
      isUserInteractingRef.current = false;
      console.error("No se pudo obtener el ID del recordatorio para eliminar:", notification);
      toast.error("Error: No se pudo identificar el recordatorio");
      return;
    }
    
    const notificationId = notification.id;
    
    // Prevenir múltiples clics de forma síncrona usando ref
    if (deletingRemindersRef.current.has(notificationId)) {
      return;
    }
    
    // Agregar inmediatamente al ref (síncrono)
    deletingRemindersRef.current.add(notificationId);
    
    // También actualizar el estado para el disabled del botón
    setDeletingReminders((prev) => new Set(prev).add(notificationId));
    
    // Actualización optimista: remover del Map inmediatamente
    const notificationKey = getNotificationKey(notification);
    const previousNotification = notificationMap.get(notificationKey);
    
    setNotificationMap((prev) => {
      const newMap = new Map(prev);
      newMap.delete(notificationKey);
      return newMap;
    });
    
    try {
      // Obtener información del recordatorio antes de eliminarlo para verificar si es de mantenimiento
      const reminderResponse = await fetch(`/api/notifications/${encodeURIComponent(reminderId)}`, {
        cache: "no-store",
        credentials: "include",
      });
      
      let isMaintenanceReminder = false;
      let vehicleId: string | null = null;
      
      if (reminderResponse.ok) {
        const reminderData = await reminderResponse.json();
        const reminder = reminderData.data;
        isMaintenanceReminder = 
          reminder.title?.toLowerCase().includes("mantenimiento") || 
          reminder.title === "Mantenimiento completo del vehículo";
        
        // Usar fleetVehicle en lugar de vehicle
        if (reminder.fleetVehicle?.documentId) {
          vehicleId = reminder.fleetVehicle.documentId;
        } else if (reminder.fleetVehicle?.id) {
          vehicleId = String(reminder.fleetVehicle.id);
        } else if (reminder.vehicle?.documentId) {
          vehicleId = reminder.vehicle.documentId;
        } else if (reminder.vehicle?.id) {
          vehicleId = String(reminder.vehicle.id);
        }
      }
      
      // Eliminar el recordatorio
      const response = await fetch(`/api/notifications/${encodeURIComponent(reminderId)}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar el recordatorio");
      }

      // Si es un recordatorio de mantenimiento, eliminar también nextMaintenanceDate del vehículo
      if (isMaintenanceReminder && vehicleId) {
        try {
          await fetch(`/api/fleet/${vehicleId}`, {
            method: "PATCH",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: {
                nextMaintenanceDate: null,
              },
            }),
          });
        } catch (error) {
          console.error("Error actualizando fecha de mantenimiento del vehículo:", error);
          // No fallar la eliminación si falla la actualización del vehículo
        }
      }

      // Marcar como eliminado permanentemente para filtrarlo de futuras cargas
      permanentlyDeletedIdsRef.current.add(reminderId);
      
      // Marcar como eliminado recientemente para evitar recarga duplicada del evento
      setRecentlyDeletedReminders((prev) => new Set(prev).add(reminderId));
      recentlyDeletedRef.current.add(reminderId);
      
      // Emitir evento para sincronización con otros componentes
      emitReminderDeleted(reminderId);
      
      // No recargar inmediatamente - confiar en la actualización optimista
      // El recordatorio ya fue removido del estado local arriba
      // La próxima recarga natural (intervalo/focus) verificará permanentDeletedIdsRef
      
      // Limpiar la marca de "reciente" después de un tiempo (pero mantener en permanent)
      setTimeout(() => {
        setRecentlyDeletedReminders((prev) => {
          const newSet = new Set(prev);
          newSet.delete(reminderId);
          return newSet;
        });
        recentlyDeletedRef.current.delete(reminderId);
      }, 5000);
      
      toast.success("Recordatorio eliminado", {
        description: isMaintenanceReminder 
          ? "El recordatorio de mantenimiento y la fecha han sido eliminados"
          : "El recordatorio ha sido eliminado correctamente",
      });
    } catch (error) {
      console.error("Error eliminando recordatorio:", error);
      // Revertir el estado optimista en caso de error
      if (previousNotification) {
        setNotificationMap((prev) => {
          const newMap = new Map(prev);
          newMap.set(notificationKey, previousNotification);
          return newMap;
        });
      }
      toast.error("Error al eliminar el recordatorio", {
        description: error instanceof Error ? error.message : "Error desconocido",
      });
    } finally {
      // Remover de la lista de procesando (tanto del ref como del estado)
      deletingRemindersRef.current.delete(notificationId);
      setDeletingReminders((prev) => {
        const newSet = new Set(prev);
        newSet.delete(notificationId);
        return newSet;
      });
      // Liberar el bloqueo de interacción después de un tiempo
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 1000);
    }
  };

  const handleCreateNotification = async () => {
    if (!formTitle.trim()) {
      toast.error("El título es requerido");
      return;
    }

    // Validar que si es tipo "specific", tenga un usuario seleccionado
    if (formRecipientType === "specific" && !formRecipientId) {
      toast.error("Por favor selecciona un usuario");
      return;
    }

    // PREVENIR BUG DE SINCRONIZACIÓN: Registrar interacción del usuario
    isUserInteractingRef.current = true;
    lastUserActionRef.current = Date.now();

    setIsCreating(true);
    
    const requestData = {
      title: formTitle.trim(),
      description: formDescription.trim() || null,
      type: formType,
      recipientType: formRecipientType,
      recipientId: formRecipientType === "specific" ? formRecipientId : null,
      durationDays: formDurationDays,
      isPinned: formIsPinned, // Solo se fija si el admin marca el checkbox
    };

    console.log('📤 [notifications] Enviando petición para crear notificación:', requestData);

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      console.log('📥 [notifications] Respuesta recibida:', {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
      });

      if (!response.ok) {
        let errorMessage = "Error al crear notificación";
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
          console.error('❌ [notifications] Error del servidor:', error);
        } catch (parseError) {
          const errorText = await response.text();
          console.error('❌ [notifications] Error al parsear respuesta:', errorText);
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ [notifications] Notificación creada exitosamente:', result);
      toast.success(result.message || "Notificación creada exitosamente");
      
      // Limpiar formulario
      setFormTitle("");
      setFormDescription("");
      setFormType("lead"); // Cambiar el valor por defecto a "lead" en lugar de "reminder"
      setFormRecipientType("specific");
      setFormRecipientId("");
      setFormDurationDays(7);
      setFormIsPinned(false);
      setIsDialogOpen(false);

      // Recargar notificaciones
      await fetchNotifications();
    } catch (err) {
      console.error("❌ [notifications] Error creando notificación:", err);
      toast.error(err instanceof Error ? err.message : "Error al crear notificación");
    } finally {
      setIsCreating(false);
      // Liberar el bloqueo de interacción
      setTimeout(() => {
        isUserInteractingRef.current = false;
      }, 1000);
    }
  };

  // Función auxiliar para verificar si una notificación ha expirado
  const isExpired = (n: Notification) => {
    if (!n.expiresAt) return false; // Sin fecha de expiración = no expira
    return new Date(n.expiresAt) < new Date();
  };

  // FUNCIÓN ÚNICA DE ESTADO: Define qué es una notificación "Activa"
  // Usada TANTO en contadores como en filtros para garantizar consistencia
  const isNotificationActive = useCallback((n: Notification): boolean => {
    const read = normalizeBoolean(n.isRead);
    const pinned = normalizeBoolean(n.isPinned);
    const completed = normalizeBoolean(n.isCompleted);
    const expired = isExpired(n);
    
    // Una notificación es "Activa" (debe aparecer en badge y tab Activas) si:
    // - NO está leída
    // - NO está fijada (las fijadas van en sección separada)
    // - NO está completada
    // - NO está expirada
    return !read && !pinned && !completed && !expired;
  }, []);

  // FUNCIÓN ÚNICA DE ESTADO: Define qué es una notificación "Completada"
  const isNotificationCompleted = useCallback((n: Notification): boolean => {
    const read = normalizeBoolean(n.isRead);
    const completed = normalizeBoolean(n.isCompleted);
    const expired = isExpired(n);
    
    // Una notificación es "Completada" si:
    // - Está marcada como completada (recordatorios)
    // - O está leída (notificaciones manuales)
    // - Y NO está expirada
    return (completed || read) && !expired;
  }, []);

  // FUNCIÓN ÚNICA DE ESTADO: Define qué es una notificación "Pausada"
  const isNotificationPaused = useCallback((n: Notification): boolean => {
    const active = normalizeBoolean(n.isActive);
    const completed = normalizeBoolean(n.isCompleted);
    const expired = isExpired(n);
    
    // Solo los recordatorios pueden estar pausados
    // Debe estar inactivo, no completado, y no expirado
    return n.source === "reminder" && !active && !completed && !expired;
  }, []);

  // Filtrar notificaciones según el tab
  // USA LAS FUNCIONES UNIFICADAS para garantizar consistencia con contadores
  const getDisplayedNotifications = () => {
    switch (activeTab) {
      case "completed":
        // Usar función unificada de completadas (excluye fijadas y expiradas)
        return notificationList.filter((n) => 
          !normalizeBoolean(n.isPinned) && isNotificationCompleted(n)
        );
      case "paused":
        // Usar función unificada de pausadas
        return notificationList.filter(isNotificationPaused);
      case "notifications":
      default:
        // Usar función unificada de activas
        return notificationList.filter(isNotificationActive);
    }
  };

  // Obtener notificaciones del tab activo (sin fijadas)
  const displayedNotifications = getDisplayedNotifications();
  
  // Las notificaciones fijadas son SIEMPRE visibles en su propia sección, independiente del tab
  // Se excluyen de los tabs Active/Completed/Paused para evitar duplicación visual
  const pinnedNotifications = notificationList.filter(n => 
    normalizeBoolean(n.isPinned) && !isExpired(n)
  );
  
  // Las notificaciones regulares son las del tab actual (ya filtradas sin fijadas)
  const regularNotifications = displayedNotifications;

  // CONTADORES CONSISTENTES: Usan las mismas funciones que los filtros de tabs
  const unreadCount = notificationList.filter(isNotificationActive).length;
  
  const pausedCount = notificationList.filter(isNotificationPaused).length;
  
  const completedCount = notificationList.filter(isNotificationCompleted).length;
  
  const isAdmin = currentUserRole === "admin";

  // Convertir notificaciones a eventos de calendario
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    return notificationList.map((notification) => {
      // Para recordatorios, usar nextTrigger o timestamp
      // Para notificaciones manuales, usar timestamp
      const startDate = notification.source === "reminder" 
        ? (notification as any).originalTimestamp || notification.timestamp
        : (notification as any).originalTimestamp || notification.timestamp;
      
      // Parsear la fecha (formatRelativeTime devuelve strings como "Hace 2 días")
      // Intentar obtener la fecha original del timestamp
      let eventDate: Date;
      try {
        // Si es una fecha ISO válida, usarla directamente
        eventDate = new Date(startDate);
        if (isNaN(eventDate.getTime())) {
          // Si no es válida, usar la fecha actual como fallback
          eventDate = new Date();
        }
      } catch {
        eventDate = new Date();
      }

      return {
        id: notification.id,
        title: notification.title,
        description: notification.description,
        start: eventDate.toISOString(),
        allDay: true,
        type: notification.source,
        isCompleted: normalizeBoolean(notification.isCompleted),
        isRead: normalizeBoolean(notification.isRead),
        isActive: normalizeBoolean(notification.isActive),
        source: notification.source,
        vehicleName: notification.vehicleName,
        notificationId: notification.notificationId,
        reminderId: notification.reminderId,
      };
    });
  }, [notificationList]);

  // Función auxiliar para validar y redirigir a vehículo de forma segura
  const navigateToVehicle = async (vehicleDocumentId: string | undefined, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!vehicleDocumentId || 
        vehicleDocumentId === 'undefined' || 
        vehicleDocumentId === 'null' || 
        vehicleDocumentId === '') {
      toast.error("Error de navegación", {
        description: "El vehículo asociado a esta notificación no tiene un ID válido."
      });
      return;
    }

    // Solo los administradores pueden navegar al detalle de flota
    if (!isAdmin) {
      toast.error("Acceso restringido", {
        description: "Se requieren permisos de administrador para ver el detalle del vehículo."
      });
      return;
    }
    
    // Verificar que el vehículo existe antes de redirigir
    try {
      const response = await fetch(`/api/fleet/${vehicleDocumentId}`, {
        method: 'HEAD',
        cache: 'no-store'
      });
      
      if (response.ok) {
        router.push(`/fleet/details/${vehicleDocumentId}`);
      } else {
        toast.error("Vehículo no encontrado", {
          description: "El vehículo asociado a esta notificación ya no existe o ha sido eliminado."
        });
      }
    } catch {
      // En caso de error de red, redirigir de todos modos y dejar que la página de destino maneje el error
      router.push(`/fleet/details/${vehicleDocumentId}`);
    }
  };

  const handleCalendarEventClick = (event: CalendarEvent) => {
    // Encontrar la notificación correspondiente y navegar si es de un vehículo
    if (event.source === "reminder" && event.vehicleName) {
      const notification = notificationList.find(n => n.id === event.id);
      if (notification?.vehicleDocumentId) {
        navigateToVehicle(notification.vehicleDocumentId);
      }
    }
  };

  return (
    <AdminLayout title="Centro de Notificaciones">
      {/* Header con botón de crear (todos los roles pueden crear) */}
      <div className="flex justify-end mb-4">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Crear Notificación
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md h-[90vh] p-0 !flex !flex-col overflow-hidden">
              <DialogHeader className={`${spacing.card.header} border-b shrink-0`}>
                <DialogTitle className={typography.h2}>Crear Nueva Notificación</DialogTitle>
              </DialogHeader>
              
              <ScrollAreaPrimitive.Root className="relative flex-1 min-h-0 overflow-hidden">
                <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
                  <div className={`flex flex-col ${spacing.gap.medium} ${spacing.card.content} pt-6`}>
                    <div className={`flex flex-col ${spacing.gap.small}`}>
                      <Label htmlFor="title" className={typography.label}>
                        Título <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="title"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="Ej: Reunión importante"
                        className="rounded-lg"
                      />
                    </div>
                    <div className={`flex flex-col ${spacing.gap.small}`}>
                      <Label htmlFor="description" className={typography.label}>
                        Descripción
                      </Label>
                      <Textarea
                        id="description"
                        value={formDescription}
                        onChange={(e) => setFormDescription(e.target.value)}
                        placeholder="Descripción de la notificación..."
                        rows={3}
                        className="rounded-lg resize-none"
                      />
                    </div>
                    <div className={`flex flex-col ${spacing.gap.small}`}>
                      <Label htmlFor="type" className={typography.label}>
                        Tipo
                      </Label>
                      <Select value={formType} onValueChange={(value: any) => setFormType(value)}>
                        <SelectTrigger id="type" className="rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="sale">Venta</SelectItem>
                          <SelectItem value="payment">Pago</SelectItem>
                          <SelectItem value="inventory">Inventario</SelectItem>
                          <SelectItem value="reminder">Aviso/Recordatorio</SelectItem>
                        </SelectContent>
                      </Select>
                      {formType === "reminder" && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Nota: Esta es una notificación manual. Los recordatorios completos con fecha programada se crean desde la sección de Flota.
                        </p>
                      )}
                    </div>
                    <div className={`flex flex-col ${spacing.gap.small}`}>
                      <Label htmlFor="recipientType" className={typography.label}>
                        Destinatario
                      </Label>
                      <Select value={formRecipientType} onValueChange={(value: any) => setFormRecipientType(value)}>
                        <SelectTrigger id="recipientType" className="rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="specific">Usuario específico</SelectItem>
                          <SelectItem value="all_sellers">Todos los vendedores</SelectItem>
                          <SelectItem value="all_admins">Todos los administradores</SelectItem>
                          <SelectItem value="all_drivers">Todos los conductores</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {formRecipientType === "specific" && (
                      <div className={`flex flex-col ${spacing.gap.small}`}>
                        <Label htmlFor="recipientId" className={typography.label}>
                          Usuario
                        </Label>
                        <Select value={formRecipientId} onValueChange={setFormRecipientId}>
                          <SelectTrigger id="recipientId" className="rounded-lg">
                            <SelectValue placeholder="Selecciona un usuario" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map((user) => (
                              <SelectItem key={user.documentId} value={user.documentId}>
                                {user.displayName} ({user.role === "admin" ? "Admin" : user.role === "seller" ? "Vendedor" : "Conductor"})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    
                    {/* Campo de duración */}
                    <div className={`flex flex-col ${spacing.gap.small}`}>
                      <Label htmlFor="durationDays" className={typography.label}>
                        Duración (días)
                      </Label>
                      <Select 
                        value={String(formDurationDays)} 
                        onValueChange={(value) => setFormDurationDays(Number(value))}
                      >
                        <SelectTrigger id="durationDays" className="rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 día</SelectItem>
                          <SelectItem value="3">3 días</SelectItem>
                          <SelectItem value="7">1 semana</SelectItem>
                          <SelectItem value="14">2 semanas</SelectItem>
                          <SelectItem value="30">1 mes</SelectItem>
                          <SelectItem value="90">3 meses</SelectItem>
                          <SelectItem value="365">1 año</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        La notificación expirará automáticamente después de este período
                      </p>
                    </div>
                    
                    {/* Checkbox para fijar notificación - solo visible y permitido para admins */}
                    {currentUserRole === "admin" && (
                      <div className={`flex flex-col ${spacing.gap.small} p-3 bg-muted/50 rounded-lg border`}>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="isPinned"
                            checked={formIsPinned}
                            onChange={(e) => setFormIsPinned(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                          <Label htmlFor="isPinned" className={`${typography.label} cursor-pointer flex items-center gap-2`}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                              <line x1="12" y1="17" x2="12" y2="22"></line>
                              <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                            </svg>
                            Fijar notificación
                          </Label>
                        </div>
                        <p className="text-xs text-muted-foreground ml-6">
                          Las notificaciones fijadas no se pueden descartar y no tienen fecha de expiración
                        </p>
                      </div>
                    )}
                    
                    {/* Info para usuarios no-admin sobre restricciones */}
                    {currentUserRole !== "admin" && (
                      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 mt-0.5 shrink-0">
                          <circle cx="12" cy="12" r="10"></circle>
                          <path d="M12 16v-4"></path>
                          <path d="M12 8h.01"></path>
                        </svg>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Solo los administradores pueden fijar notificaciones. Tu notificación expirará según la duración seleccionada.
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollAreaPrimitive.Viewport>
                <ScrollAreaPrimitive.Scrollbar
                  className="flex touch-none select-none transition-colors h-2 bg-transparent p-[2px] group relative"
                  orientation="vertical"
                >
                  <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-border" />
                </ScrollAreaPrimitive.Scrollbar>
              </ScrollAreaPrimitive.Root>
              
              <DialogFooter className={`${spacing.card.header} border-t shrink-0`}>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="rounded-lg">
                  Cancelar
                </Button>
                <Button onClick={handleCreateNotification} disabled={isCreating} className="rounded-lg">
                  {isCreating ? "Creando..." : "Crear"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

      <div className="px-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "notifications" | "paused" | "completed")}>
          <TabsList className="flex items-center justify-start w-full bg-transparent p-0 h-auto border-0 shadow-none gap-2">
            <TabsTrigger
              value="notifications"
              className="flex items-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Inbox className="h-4 w-4" />
              <span className={typography.body.base}>Activas</span>
              {unreadCount > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="paused"
              className="flex items-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Pause className="h-4 w-4" />
              <span className={typography.body.base}>Pausadas</span>
              {pausedCount > 0 && (
                <span className="ml-1 rounded-full bg-muted-foreground/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {pausedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="completed"
              className="flex items-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className={typography.body.base}>Completadas</span>
              {completedCount > 0 && (
                <span className="ml-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600">
                  {completedCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Layout de Timeline con Sidebar de Notificaciones Fijadas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 px-0 pb-28">
        {/* Panel Principal - Timeline */}
        <div className="lg:col-span-8 xl:col-span-9">
          {isLoading ? (
            <Card className={commonClasses.card}>
              <CardContent className={`flex flex-col items-center justify-center text-center ${spacing.card.padding}`}>
                <div className="flex items-center justify-center bg-muted rounded-full size-24 mb-6">
                  <Calendar className="h-10 w-10 text-muted-foreground animate-pulse" />
                </div>
                <h3 className={typography.h3}>Cargando notificaciones...</h3>
                <p className={`${typography.body.small} mt-2 text-muted-foreground`}>
                  Obteniendo tus notificaciones...
                </p>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className={commonClasses.card}>
              <CardContent className={`flex flex-col items-center justify-center text-center ${spacing.card.padding}`}>
                <div className="flex items-center justify-center bg-red-500/10 rounded-full size-24 mb-6">
                  <Calendar className="h-10 w-10 text-red-600" />
                </div>
                <h3 className={typography.h3}>Error al cargar</h3>
                <p className={`${typography.body.small} mt-2 text-muted-foreground`}>
                  {error}
                </p>
              </CardContent>
            </Card>
          ) : regularNotifications.length === 0 ? (
            <Card className={commonClasses.card}>
              <CardContent className={`flex flex-col items-center justify-center text-center ${spacing.card.padding}`}>
                <div className="flex items-center justify-center bg-muted rounded-full size-24 mb-6">
                  <Archive className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className={typography.h3}>¡Todo al día!</h3>
                <p className={`${typography.body.small} mt-2`}>
                  {activeTab === "completed"
                    ? "No tienes notificaciones completadas. Las notificaciones marcadas como leídas aparecerán aquí hasta que expiren."
                    : activeTab === "paused"
                    ? "No tienes ninguna tarea pausada de momento."
                    : "No tienes notificaciones nuevas."}
                </p>
              </CardContent>
            </Card>
          ) : (
            /* Timeline de Notificaciones */
            <div className="relative">
              {/* Línea vertical del timeline */}
              <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/50 via-primary/30 to-transparent hidden md:block" />
              
              <div className={`flex flex-col ${spacing.gap.large}`}>
                {regularNotifications.map((notification, index) => {
                  const Icon = notification.icon;
                  const isReminder = notification.source === "reminder";
                  const moduleColors = notification.module ? MODULE_COLORS[notification.module] : null;
                  
                  const handleCardClick = () => {
                    if (deletingReminders.has(notification.id)) return;
                    if (isReminder && notification.vehicleDocumentId) {
                      navigateToVehicle(notification.vehicleDocumentId);
                    }
                  };

                  return (
                    <div key={notification.id} className="relative flex gap-4 group">
                      {/* Marcador del timeline */}
                      <div className="hidden md:flex flex-col items-center shrink-0">
                        <div 
                          className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-background shadow-lg z-10 transition-all group-hover:scale-110 ${
                            notification.isCompleted 
                              ? "bg-green-500 text-white" 
                              : notification.isPinned
                              ? "bg-amber-500 text-white"
                              : `${notification.iconBgColor} ${notification.iconColor}`
                          }`}
                        >
                          {notification.isCompleted ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : notification.isPinned ? (
                            <Pin className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        {/* Fecha del timeline */}
                        <div className="mt-2 text-xs text-muted-foreground font-medium whitespace-nowrap rotate-0">
                          {notification.timestamp}
                        </div>
                      </div>

                      {/* Contenido de la notificación */}
                      <div className="flex-1 min-w-0">
                        <Card
                          className={`${commonClasses.card} transition-all hover:shadow-md hover:border-primary/30 w-full ${
                            notification.isCompleted ? "opacity-60" : ""
                          } ${!notification.isActive && isReminder ? "border-dashed" : ""} ${
                            isReminder && notification.vehicleDocumentId ? "cursor-pointer" : ""
                          } ${notification.isPinned ? "border-amber-300/50 shadow-amber-100/50" : ""}`}
                          onClick={handleCardClick}
                        >
                          <CardContent className={`${spacing.card.padding}`}>
                            <div className="flex items-start gap-3">
                              {/* Icono móvil */}
                              <div className="md:hidden shrink-0">
                                <div 
                                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    notification.isCompleted 
                                      ? "bg-green-500 text-white" 
                                      : `${notification.iconBgColor} ${notification.iconColor}`
                                  }`}
                                >
                                  {notification.isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                                </div>
                              </div>

                              <div className="flex-1 min-w-0">
                                {/* Header */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className={`font-semibold text-base ${
                                      notification.isCompleted ? "line-through text-muted-foreground" : ""
                                    }`}>
                                      {notification.title}
                                    </h4>
                                    {isReminder && (
                                      <Badge variant="outline" className="text-xs">
                                        Recordatorio
                                      </Badge>
                                    )}
                                    {isReminder && notification.module && moduleColors && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-xs ${moduleColors.bg} ${moduleColors.text} ${moduleColors.border}`}
                                      >
                                        {MODULE_LABELS[notification.module]}
                                      </Badge>
                                    )}
                                    {isReminder && notification.isActive === false && !notification.isCompleted && (
                                      <Badge variant="secondary" className="text-xs">
                                        Pausado
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {/* Acciones */}
                                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                    {isReminder && notification.vehicleDocumentId && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        title="Ver en vehículo"
                                        onClick={(e) => {
                                          navigateToVehicle(notification.vehicleDocumentId, e);
                                        }}
                                      >
                                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                      </Button>
                                    )}
                                    {isReminder && !notification.isCompleted && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleToggleActive(notification);
                                        }}
                                        title={notification.isActive ? "Pausar" : "Activar"}
                                      >
                                        {notification.isActive ? (
                                          <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                                        ) : (
                                          <Play className="h-3.5 w-3.5 text-green-600" />
                                        )}
                                      </Button>
                                    )}
                                    {isReminder && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRequestDeleteReminder(notification);
                                        }}
                                        title="Eliminar"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {/* Botón para marcar como leída - solo para notificaciones manuales no leídas */}
                                    {!isReminder && !notification.isRead && activeTab === "notifications" && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-primary hover:text-primary"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleMarkAsRead(notification);
                                        }}
                                        title="Marcar como leída"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                    {/* Botón para eliminar - solo para notificaciones manuales */}
                                    {!isReminder && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRequestDeleteManual(notification);
                                        }}
                                        title="Eliminar notificación"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>

                                {/* Descripción */}
                                <p className={`text-sm text-muted-foreground mb-3 ${
                                  notification.isCompleted ? "line-through" : ""
                                }`}>
                                  {notification.description}
                                </p>

                                {/* Footer con metadatos */}
                                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                  <span className="md:hidden">{notification.timestamp}</span>
                                  {notification.isCompleted && (
                                    <span className="text-green-600 font-medium flex items-center gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      Completado
                                    </span>
                                  )}
                                  {isReminder && notification.isActive === false && !notification.isCompleted && (
                                    <span className="flex items-center gap-1">
                                      <Pause className="h-3 w-3" />
                                      Pausado
                                    </span>
                                  )}
                                  {/* Mostrar fecha de expiración para notificaciones manuales no fijadas */}
                                  {!isReminder && notification.expiresAt && !notification.isPinned && (
                                    <span className="flex items-center gap-1 text-amber-600">
                                      <Clock className="h-3 w-3" />
                                      Expira {formatRelativeTime(notification.expiresAt)}
                                    </span>
                                  )}
                                  {/* Mostrar que no expira para notificaciones fijadas */}
                                  {!isReminder && notification.isPinned && (
                                    <span className="flex items-center gap-1 text-amber-600">
                                      <Pin className="h-3 w-3" />
                                      No expira
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Checkbox de completado */}
                              {isReminder && (
                                <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      handleToggleCompleted(notification);
                                    }}
                                    disabled={togglingCompleted.has(notification.id)}
                                    className="h-6 w-6 shrink-0 flex items-center justify-center disabled:opacity-50"
                                    title={notification.isCompleted ? "Marcar como pendiente" : "Marcar como completado"}
                                  >
                                    {notification.isCompleted ? (
                                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                                    ) : (
                                      <Circle className="h-6 w-6 text-muted-foreground/40 hover:text-primary transition-colors" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Notificaciones Fijadas */}
        <div className="lg:col-span-4 xl:col-span-3">
          <div className="sticky top-4 space-y-4">
            {/* Header del panel */}
            <div className="flex items-center gap-2 pb-3 border-b">
              <Pin className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold text-lg">Fijadas por Admin</h3>
              {pinnedNotifications.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {pinnedNotifications.length}
                </Badge>
              )}
            </div>

            {/* Lista de notificaciones fijadas */}
            {pinnedNotifications.length === 0 ? (
              <div className="text-center py-8 px-4 bg-muted/30 rounded-lg border border-dashed">
                <Pin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No hay notificaciones fijadas
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Los administradores pueden fijar notificaciones importantes
                </p>
              </div>
            ) : (
              <div className={`flex flex-col ${spacing.gap.medium}`}>
                {pinnedNotifications.map((notification) => {
                  const Icon = notification.icon;
                  const isReminder = notification.source === "reminder";
                  
                  return (
                    <Card
                      key={notification.id}
                      className={`border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10 hover:shadow-md transition-all ${
                        notification.isCompleted ? "opacity-70" : ""
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${notification.iconBgColor} ${notification.iconColor}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Pin className="h-3 w-3 text-amber-500 shrink-0" />
                              <h5 className={`font-medium text-sm ${
                                notification.isCompleted ? "line-through text-muted-foreground" : ""
                              }`}>
                                {notification.title}
                              </h5>
                            </div>
                            
                            <p className={`text-xs text-muted-foreground mb-2 ${
                              notification.isCompleted ? "line-through" : ""
                            }`}>
                              {notification.description}
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground/70">
                                {notification.timestamp}
                              </span>
                              
                              {isReminder && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleToggleCompleted(notification)}
                                    disabled={togglingCompleted.has(notification.id)}
                                    className="p-1 rounded hover:bg-muted transition-colors"
                                    title={notification.isCompleted ? "Marcar pendiente" : "Completar"}
                                  >
                                    {notification.isCompleted ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    ) : (
                                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Info sobre notificaciones fijadas */}
            {pinnedNotifications.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  Las notificaciones fijadas permanecen visibles indefinidamente (solo pueden eliminarlas los administradores)
                </span>
              </div>
            )}

            {/* Calendario de Notificaciones - Compacto debajo de fijadas */}
            {!isLoading && !error && calendarEvents.length > 0 && (
              <div className="mt-6">
                <NotificationCalendar 
                  events={[]}
                  onEventClick={handleCalendarEventClick}
                  className="compact-calendar"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Diálogo de confirmación para eliminar recordatorios/notificaciones */}
      <AlertDialog
        open={showDeleteReminderDialog}
        onOpenChange={(open) => {
          setShowDeleteReminderDialog(open);
          if (!open) {
            setNotificationToDelete(null);
          }
        }}
      >
        <AlertDialogContent
          onClose={() => {
            setShowDeleteReminderDialog(false);
            setNotificationToDelete(null);
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {notificationToDelete?.source === "manual"
                ? "¿Eliminar esta notificación?"
                : "¿Eliminar este recordatorio?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {notificationToDelete?.source === "manual"
                ? "Esta acción no se puede deshacer. Se eliminará la notificación de forma permanente."
                : "Esta acción no se puede deshacer. Se eliminará el recordatorio de forma permanente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                notificationToDelete ? deletingReminders.has(notificationToDelete.id) : false
              }
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (notificationToDelete) {
                  if (notificationToDelete.source === "manual") {
                    void handleDeleteManual(notificationToDelete);
                  } else {
                    void handleDeleteReminder(notificationToDelete);
                  }
                }
                setShowDeleteReminderDialog(false);
                setNotificationToDelete(null);
              }}
              disabled={
                notificationToDelete ? deletingReminders.has(notificationToDelete.id) : false
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {notificationToDelete && deletingReminders.has(notificationToDelete.id)
                ? "Eliminando..."
                : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Floating Action Button */}
      {activeTab === "notifications" && unreadCount > 0 && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            onClick={handleMarkAllAsRead}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
            size="icon"
          >
            <CheckCheck className="h-6 w-6" />
          </Button>
        </div>
      )}
    </AdminLayout>
  );
}

