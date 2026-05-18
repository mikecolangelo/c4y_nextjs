"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, CheckCircle2, Eye, EyeOff, Archive, Inbox } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components_shadcn/ui/tabs";
import { typography, spacing } from "@/lib/design-system";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { REMINDER_EVENTS } from "@/lib/reminder-events";
import { UnifiedReminderItem } from "./unified-reminder-item";
import type { UnifiedRemindersProps, FleetReminder, ReminderModule } from "./types";

type TabValue = "active" | "paused";

export function UnifiedReminders({ 
  reminders: initialReminders, 
  isLoading, 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onToggleCompleted,
  filterModule,
  showModuleTags = true,
  showCompletedButton = true, 
  forceShowCompleted = false,
  showArchivedTab = true,
  compact = false,
  maxHeight = "600px",
}: UnifiedRemindersProps) {
  const [reminders, setReminders] = useState<FleetReminder[]>(initialReminders);
  const [showCompleted, setShowCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("active");
  const shouldShowCompleted = forceShowCompleted || showCompleted;

  // Sincronizar con props cuando cambien
  useEffect(() => {
    setReminders(initialReminders);
  }, [initialReminders]);

  // Escuchar eventos de recordatorios para actualización asíncrona
  useEffect(() => {
    const handleReminderUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { reminderId, isActive, isCompleted } = customEvent.detail || {};
      
      if (reminderId) {
        setReminders(prev => prev.map(r => {
          const id = r.documentId || String(r.id);
          if (id === String(reminderId)) {
            if (typeof isActive === "boolean") {
              return { ...r, isActive };
            }
            if (typeof isCompleted === "boolean") {
              return { ...r, isCompleted };
            }
          }
          return r;
        }));
      }
    };

    const handleReminderDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { reminderId } = customEvent.detail || {};
      
      if (reminderId) {
        setReminders(prev => prev.filter(r => {
          const id = r.documentId || String(r.id);
          return id !== String(reminderId);
        }));
      }
    };

    window.addEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderUpdate);
    window.addEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderUpdate);
    window.addEventListener(REMINDER_EVENTS.UPDATED, handleReminderUpdate);
    window.addEventListener(REMINDER_EVENTS.DELETED, handleReminderDeleted);

    return () => {
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_ACTIVE, handleReminderUpdate);
      window.removeEventListener(REMINDER_EVENTS.TOGGLE_COMPLETED, handleReminderUpdate);
      window.removeEventListener(REMINDER_EVENTS.UPDATED, handleReminderUpdate);
      window.removeEventListener(REMINDER_EVENTS.DELETED, handleReminderDeleted);
    };
  }, []);

  // Filtrar por módulo si se especifica
  const filteredReminders = filterModule 
    ? reminders.filter(r => r.module === filterModule)
    : reminders;

  // Separar por estado
  const activeReminders = filteredReminders.filter((r) => r.isActive && !r.isCompleted);
  const pausedReminders = filteredReminders.filter((r) => !r.isActive && !r.isCompleted);
  const completedReminders = filteredReminders.filter((r) => r.isCompleted);

  // Obtener recordatorios según tab actual
  const getDisplayedReminders = useCallback(() => {
    switch (activeTab) {
      case "paused":
        return pausedReminders;
      case "active":
      default:
        return activeReminders;
    }
  }, [activeTab, activeReminders, pausedReminders]);

  const displayedReminders = getDisplayedReminders();

  if (isLoading) {
    return (
      <div className={`flex flex-col ${spacing.gap.small} py-4`}>
        <p className={typography.body.small}>Cargando recordatorios...</p>
      </div>
    );
  }

  if (reminders.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center ${spacing.gap.small} py-8 text-center`}>
        <Bell className="h-8 w-8 text-muted-foreground" />
        <p className={typography.body.small}>Aún no hay recordatorios</p>
        <p className={`${typography.body.small} text-muted-foreground`}>
          Crea un recordatorio para recibir notificaciones
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${spacing.gap.base}`}>
      {/* Tabs de Activos/Pausados */}
      {showArchivedTab && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
          <TabsList className="flex items-center justify-start w-full bg-transparent p-0 h-auto border-0 shadow-none gap-2">
            <TabsTrigger
              value="active"
              className="flex items-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Inbox className="h-4 w-4" />
              <span className={typography.body.small}>Activos</span>
              {activeReminders.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {activeReminders.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="paused"
              className="flex items-center gap-2 rounded-lg px-3 py-2 data-[state=active]:bg-muted data-[state=active]:shadow-none"
            >
              <Archive className="h-4 w-4" />
              <span className={typography.body.small}>Pausados</span>
              {pausedReminders.length > 0 && (
                <span className="ml-1 rounded-full bg-muted-foreground/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {pausedReminders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Lista de recordatorios */}
      <ScrollAreaPrimitive.Root className="relative overflow-hidden" style={{ height: maxHeight }}>
        <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
          <div className={`flex flex-col ${spacing.gap.small} py-2`}>
            {displayedReminders.length > 0 ? (
              displayedReminders.map((reminder) => (
                <UnifiedReminderItem
                  key={reminder.id || reminder.documentId}
                  reminder={reminder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                  onToggleCompleted={onToggleCompleted}
                  showModule={showModuleTags}
                  compact={compact}
                />
              ))
            ) : (
              <div className={`flex flex-col items-center justify-center ${spacing.gap.small} py-8 text-center`}>
                {activeTab === "paused" ? (
                  <>
                    <Archive className="h-8 w-8 text-muted-foreground" />
                    <p className={typography.body.small}>No hay recordatorios pausados</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                    <p className={typography.body.small}>No hay recordatorios activos</p>
                  </>
                )}
              </div>
            )}

            {/* Recordatorios completados */}
            {shouldShowCompleted && completedReminders.length > 0 && (
              <div className={`flex flex-col ${spacing.gap.small} mt-4 pt-4 border-t border-border`}>
                <p className={`${typography.body.small} text-muted-foreground font-medium`}>
                  Completados ({completedReminders.length})
                </p>
                {completedReminders.map((reminder) => (
                  <UnifiedReminderItem
                    key={reminder.id || reminder.documentId}
                    reminder={reminder}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onToggleActive={onToggleActive}
                    onToggleCompleted={onToggleCompleted}
                    showModule={showModuleTags}
                    compact={compact}
                  />
                ))}
              </div>
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

      {/* Botón para mostrar/ocultar completados */}
      {showCompletedButton && completedReminders.length > 0 && !forceShowCompleted && (
        <div className="flex justify-center pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-muted-foreground hover:text-foreground"
          >
            {showCompleted ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Ocultar completados ({completedReminders.length})
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Ver completados ({completedReminders.length})
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}















