"use client";

import { useState } from "react";
import { Bell, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { typography, spacing } from "@/lib/design-system";
import { ReminderItem } from "./reminder-item";
import type { FleetRemindersProps } from "./types";

export function FleetReminders({ 
  reminders, 
  isLoading, 
  onEdit, 
  onDelete, 
  onToggleActive, 
  onToggleCompleted, 
  showCompletedButton = true, 
  forceShowCompleted = false,
}: FleetRemindersProps) {
  const [showCompleted, setShowCompleted] = useState(false);
  const shouldShowCompleted = forceShowCompleted || showCompleted;

  if (isLoading) {
    return (
      <div className={`flex flex-col ${spacing.gap.small} py-4`}>
        <p className={typography.body.small}>Cargando recordatorios...</p>
      </div>
    );
  }

  const activeReminders = reminders.filter((r) => !r.isCompleted);
  const completedReminders = reminders.filter((r) => r.isCompleted);

  if (reminders.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center ${spacing.gap.small} py-8 text-center`}>
        <Bell className="h-8 w-8 text-muted-foreground" />
        <p className={typography.body.small}>Aún no hay recordatorios para este vehículo</p>
        <p className={`${typography.body.small} text-muted-foreground`}>
          Crea un recordatorio para recibir notificaciones
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${spacing.gap.base} py-2`}>
      {activeReminders.length > 0 && (
        <div className={`flex flex-col ${spacing.gap.base}`}>
          {activeReminders.map((reminder) => (
            <ReminderItem
              key={reminder.id || reminder.documentId}
              reminder={reminder}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              onToggleCompleted={onToggleCompleted}
            />
          ))}
        </div>
      )}

      {completedReminders.length > 0 && (
        <div className={`flex flex-col ${spacing.gap.base} mt-4`}>
          {shouldShowCompleted && (
            <div className={`flex flex-col ${spacing.gap.base}`}>
              {completedReminders.map((reminder) => (
                <ReminderItem
                  key={reminder.id || reminder.documentId}
                  reminder={reminder}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleActive={onToggleActive}
                  onToggleCompleted={onToggleCompleted}
                />
              ))}
            </div>
          )}

          {showCompletedButton && (
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
      )}

      {activeReminders.length === 0 && completedReminders.length > 0 && !shouldShowCompleted && (
        <div className={`flex flex-col items-center justify-center ${spacing.gap.small} py-8 text-center`}>
          <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
          <p className={typography.body.small}>Todos los recordatorios están completados</p>
          {showCompletedButton && (
            <p className={`${typography.body.small} text-muted-foreground`}>
              Usa el botón de abajo para ver los recordatorios completados
            </p>
          )}
        </div>
      )}
    </div>
  );
}

















