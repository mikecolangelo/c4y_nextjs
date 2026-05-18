/**
 * Utilidad para sincronizar recordatorios entre componentes
 * mediante eventos personalizados del navegador
 */

import type { FleetReminder, ReminderModule } from "@/validations/types";

export const REMINDER_EVENTS = {
  CREATED: 'reminder:created',
  UPDATED: 'reminder:updated',
  DELETED: 'reminder:deleted',
  TOGGLE_COMPLETED: 'reminder:toggle-completed',
  TOGGLE_ACTIVE: 'reminder:toggle-active',
  REFRESH: 'reminder:refresh', // Nuevo evento para forzar recarga
} as const;

export interface ReminderEventDetail {
  reminderId?: string | number;
  reminder?: FleetReminder;
  isActive?: boolean;
  isCompleted?: boolean;
  module?: ReminderModule;
}

/**
 * Emite un evento personalizado cuando se crea un recordatorio
 */
export function emitReminderCreated(reminder?: FleetReminder) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_EVENTS.CREATED, { 
      detail: { reminder, reminderId: reminder?.documentId || reminder?.id } 
    }));
  }
}

/**
 * Emite un evento personalizado cuando se actualiza un recordatorio
 */
export function emitReminderUpdated(reminder?: FleetReminder) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_EVENTS.UPDATED, { 
      detail: { reminder, reminderId: reminder?.documentId || reminder?.id } 
    }));
  }
}

/**
 * Emite un evento personalizado cuando se elimina un recordatorio
 */
export function emitReminderDeleted(reminderId: string | number) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_EVENTS.DELETED, { detail: { reminderId } }));
  }
}

/**
 * Emite un evento personalizado cuando se cambia el estado de completado de un recordatorio
 */
export function emitReminderToggleCompleted(reminderId: string | number, isCompleted: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_EVENTS.TOGGLE_COMPLETED, { 
      detail: { reminderId, isCompleted } 
    }));
  }
}

/**
 * Emite un evento personalizado cuando se cambia el estado activo de un recordatorio
 */
export function emitReminderToggleActive(reminderId: string | number, isActive: boolean) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_EVENTS.TOGGLE_ACTIVE, { 
      detail: { reminderId, isActive } 
    }));
  }
}

/**
 * Emite un evento para forzar la recarga de todos los recordatorios
 */
export function emitReminderRefresh() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_EVENTS.REFRESH));
  }
}/**
 * Hook helper para escuchar eventos de recordatorios
 */
export function subscribeToReminderEvents(
  handlers: {
    onCreated?: (detail: ReminderEventDetail) => void;
    onUpdated?: (detail: ReminderEventDetail) => void;
    onDeleted?: (detail: ReminderEventDetail) => void;
    onToggleCompleted?: (detail: ReminderEventDetail) => void;
    onToggleActive?: (detail: ReminderEventDetail) => void;
    onRefresh?: () => void;
  }
) {
  const createHandler = (handler?: (detail: ReminderEventDetail) => void) => {
    return (event: Event) => {
      const customEvent = event as CustomEvent<ReminderEventDetail>;
      handler?.(customEvent.detail);
    };
  };  if (handlers.onCreated) {
    window.addEventListener(REMINDER_EVENTS.CREATED, createHandler(handlers.onCreated));
  }
  if (handlers.onUpdated) {
    window.addEventListener(REMINDER_EVENTS.UPDATED, createHandler(handlers.onUpdated));
  }
  if (handlers.onDeleted) {
    window.addEventListener(REMINDER_EVENTS.DELETED, createHandler(handlers.onDeleted));
  }
  if (handlers.onToggleCompleted) {
    window.addEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, createHandler(handlers.onToggleCompleted));
  }
  if (handlers.onToggleActive) {
    window.addEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, createHandler(handlers.onToggleActive));
  }
  if (handlers.onRefresh) {
    window.addEventListener(REMINDER_EVENTS.REFRESH, handlers.onRefresh);
  }  // Retorna función de limpieza
  return () => {
    if (handlers.onCreated) {
      window.removeEventListener(REMINDER_EVENTS.CREATED, createHandler(handlers.onCreated));
    }
    if (handlers.onUpdated) {
      window.removeEventListener(REMINDER_EVENTS.UPDATED, createHandler(handlers.onUpdated));
    }
    if (handlers.onDeleted) {
      window.removeEventListener(REMINDER_EVENTS.DELETED, createHandler(handlers.onDeleted));
    }
    if (handlers.onToggleCompleted) {
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, createHandler(handlers.onToggleCompleted));
    }
    if (handlers.onToggleActive) {
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, createHandler(handlers.onToggleActive));
    }
    if (handlers.onRefresh) {
      window.removeEventListener(REMINDER_EVENTS.REFRESH, handlers.onRefresh);
    }
  };
}