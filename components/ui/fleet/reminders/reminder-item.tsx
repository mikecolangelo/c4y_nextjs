"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Bell, Trash2, Edit2, Calendar, Repeat, CalendarCheck, Check, Users, Pause, CheckCircle2, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Card } from "@/components_shadcn/ui/card";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { typography, spacing } from "@/lib/design-system";
import { strapiImages } from "@/lib/strapi-images";
import { RECURRENCE_LABELS, type ReminderItemProps } from "./types";
import { formatTime12Hour, isAllDay } from "./utils";

export function ReminderItem({
  reminder,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleCompleted,
}: ReminderItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  // IMPORTANTE: Usar ID numérico cuando esté disponible (más confiable para actualizaciones)
  // Solo usar documentId como fallback si no hay ID numérico
  const reminderId = (reminder.id && typeof reminder.id === 'number') 
    ? String(reminder.id) 
    : (reminder.documentId || String(reminder.id));
  const scheduledDate = new Date(reminder.scheduledDate);
  const nextTriggerDate = new Date(reminder.nextTrigger);
  
  const isScheduledAllDay = isAllDay(scheduledDate);
  const isNextTriggerAllDay = isAllDay(nextTriggerDate);
  
  const formattedScheduledDate = isScheduledAllDay
    ? `${format(scheduledDate, "d 'de' MMMM, yyyy", { locale: es })} - todo el día`
    : `${format(scheduledDate, "d 'de' MMMM, yyyy 'a las'", { locale: es })} ${formatTime12Hour(scheduledDate)}`;
  
  const formattedNextTrigger = isNextTriggerAllDay
    ? `${format(nextTriggerDate, "d 'de' MMMM, yyyy", { locale: es })} - todo el día`
    : `${format(nextTriggerDate, "d 'de' MMMM, yyyy 'a las'", { locale: es })} ${formatTime12Hour(nextTriggerDate)}`;
  
  const authorName = reminder.author?.displayName || reminder.author?.email || "Usuario";
  const isCompleted = reminder.isCompleted || false;

  const handleDelete = async () => {
    if (!onDelete) return;
    
    // Prevenir múltiples clics
    if (isDeleting) {
      console.warn("⚠️ Eliminación ya en progreso, ignorando clic duplicado");
      return;
    }
    
    setIsDeleting(true);
    
    // Log para depuración
    if (process.env.NODE_ENV === 'development') {
      console.log("🗑️ ReminderItem: Iniciando eliminación:", {
        reminderId,
        title: reminder.title,
      });
    }
    
    try {
      await onDelete(reminderId, async () => {
        // Callback opcional para recargar el vehículo si es necesario
        // Por ahora no hacemos nada aquí
      });
    } catch (error) {
      console.error("❌ Error eliminando recordatorio en ReminderItem:", {
        reminderId,
        error,
      });
      // No necesitamos hacer throw aquí, el error ya se maneja en el hook
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!onToggleActive) return;
    setIsToggling(true);
    try {
      await onToggleActive(reminderId, reminder.isActive);
    } catch (error) {
      console.error("Error cambiando estado del recordatorio:", error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleEdit = () => {
    if (onEdit) onEdit(reminder);
  };

  const handleToggleCompleted = async () => {
    if (!onToggleCompleted) return;
    
    // Validar que tenemos un ID válido antes de intentar actualizar
    if (!reminderId || reminderId === 'null' || reminderId === 'undefined') {
      console.error("❌ ID de recordatorio inválido en ReminderItem:", {
        reminderId,
        reminder: {
          id: reminder.id,
          documentId: reminder.documentId,
        },
      });
      return;
    }
    
    // Log para depuración
    if (process.env.NODE_ENV === 'development') {
      console.log("🔄 ReminderItem: Intentando cambiar estado de completado:", {
        reminderId,
        reminderIdType: typeof reminderId,
        reminderIdValue: reminderId,
        reminder: {
          id: reminder.id,
          idType: typeof reminder.id,
          documentId: reminder.documentId,
          title: reminder.title,
        },
        isCompleted,
        newState: !isCompleted,
      });
    }
    
    try {
      await onToggleCompleted(reminderId, isCompleted);
    } catch (error) {
      console.error("❌ Error cambiando estado de completado del recordatorio en ReminderItem:", {
        reminderId,
        reminder: {
          id: reminder.id,
          documentId: reminder.documentId,
          title: reminder.title,
        },
        error,
      });
    }
  };

  return (
    <Card className="shadow-sm ring-1 ring-inset ring-border/50 relative">
      <div className="absolute top-2 right-2 flex gap-1 z-10">
        {onToggleCompleted && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleCompleted}
            disabled={isDeleting || isToggling}
            title={isCompleted ? "Marcar como pendiente" : "Marcar como completado"}
          >
            {isCompleted ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        )}
        {!onToggleCompleted && isCompleted && (
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-500/10" title="Completado">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
        )}
        {onEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleEdit}
            disabled={isDeleting || isToggling}
            title="Editar"
          >
            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        )}
        {onToggleActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleActive}
            disabled={isDeleting || isToggling}
            title={reminder.isActive ? "Desactivar" : "Activar"}
          >
            {reminder.isActive ? (
              <Check className="h-3.5 w-3.5 text-green-600" />
            ) : (
              <Pause className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </Button>
        )}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting || isToggling}
            title="Eliminar"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <div className={`flex flex-col ${spacing.gap.small} p-4 ${onEdit || onDelete ? "pr-12" : ""}`}>
        <div className="flex items-start gap-3">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2 ring-background ${
            reminder.isActive ? "bg-primary/10" : "bg-muted"
          }`}>
            {reminder.reminderType === "recurring" ? (
              <Repeat className={`h-4 w-4 ${reminder.isActive ? "text-primary" : "text-muted-foreground"}`} />
            ) : (
              <Bell className={`h-4 w-4 ${reminder.isActive ? "text-primary" : "text-muted-foreground"}`} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={`${typography.body.small} font-semibold`}>
                {reminder.title}
              </p>
              <Badge variant={reminder.isActive ? "default" : "secondary"} className="text-xs">
                {reminder.isActive ? "Activo" : "Inactivo"}
              </Badge>
              {reminder.reminderType === "recurring" && (
                <Badge variant="outline" className="text-xs">
                  {RECURRENCE_LABELS[reminder.recurrencePattern || ""] || "Recurrente"}
                </Badge>
              )}
            </div>
            <p className={`${typography.body.small} text-muted-foreground`}>
              Creado por {authorName}
            </p>
          </div>
        </div>

        {reminder.description && (
          <p className={`${typography.body.base} text-muted-foreground`}>
            {reminder.description}
          </p>
        )}

        <div className={`flex flex-col ${spacing.gap.small} pt-2 border-t border-border`}>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className={`${typography.body.small} text-muted-foreground`}>
                Fecha programada:
              </p>
              <p className={typography.body.small}>
                {formattedScheduledDate}
              </p>
            </div>
          </div>
          
          {reminder.reminderType === "recurring" && (
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className={`${typography.body.small} text-muted-foreground`}>
                  Próxima notificación:
                </p>
                <p className={typography.body.small}>
                  {formattedNextTrigger}
                </p>
              </div>
            </div>
          )}

          {reminder.reminderType === "recurring" && reminder.recurrenceEndDate && (
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className={`${typography.body.small} text-muted-foreground`}>
                  Finaliza:
                </p>
                <p className={typography.body.small}>
                  {format(new Date(reminder.recurrenceEndDate), "d 'de' MMMM, yyyy", { locale: es })}
                </p>
              </div>
            </div>
          )}
        </div>

        {reminder.assignedUsers && reminder.assignedUsers.length > 0 && (
          <div className={`flex flex-col ${spacing.gap.small} pt-2 border-t border-border`}>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className={`${typography.body.small} text-muted-foreground`}>
                Contactos asignados:
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {reminder.assignedUsers.map((user) => {
                const userId = user.documentId || user.id;
                const userLink = userId ? `/users/details/${userId}` : null;
                const userContent = (
                  <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                    {user.avatar?.url ? (
                      <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                        <Image
                          src={strapiImages.getURL(user.avatar.url)}
                          alt={user.avatar.alternativeText || user.displayName || user.email || "Usuario"}
                          fill
                          className="object-cover"
                          sizes="24px"
                        />
                      </div>
                    ) : (
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 ring-2 ring-background">
                        <span className={`${typography.body.small} font-semibold text-primary text-xs`}>
                          {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className={`${typography.body.small} text-xs`}>
                      {user.displayName || user.email || "Usuario"}
                    </span>
                  </div>
                );
                
                return (
                  <div key={user.id || user.documentId}>
                    {userLink ? (
                      <Link href={userLink} className="block">
                        {userContent}
                      </Link>
                    ) : (
                      userContent
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}











