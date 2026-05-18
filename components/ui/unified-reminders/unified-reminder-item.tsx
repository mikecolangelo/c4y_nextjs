"use client";

import { useState } from "react";
import { Bell, Trash2, Edit2, Repeat, CheckCircle2, Circle, Pause, Play } from "lucide-react";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { typography } from "@/lib/design-system";
import { 
  MODULE_LABELS, 
  MODULE_COLORS, 
  RECURRENCE_LABELS, 
  type UnifiedReminderItemProps 
} from "./types";
import { getRelativeTime, formatShortDate } from "./utils";

export function UnifiedReminderItem({
  reminder,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleCompleted,
  showModule = true,
  compact = false,
}: UnifiedReminderItemProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  // IMPORTANTE: Usar ID numérico cuando esté disponible (más confiable para actualizaciones)
  // Solo usar documentId como fallback si no hay ID numérico
  const reminderId = (reminder.id && typeof reminder.id === 'number') 
    ? String(reminder.id) 
    : (reminder.documentId || String(reminder.id));
  const isCompleted = reminder.isCompleted || false;
  const module = reminder.module || "fleet";
  const moduleColors = MODULE_COLORS[module];

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(reminderId);
    } catch (error) {
      console.error("Error eliminando recordatorio:", error);
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

  const handleToggleCompleted = async () => {
    if (!onToggleCompleted) return;
    setIsToggling(true);
    try {
      await onToggleCompleted(reminderId, isCompleted);
    } catch (error) {
      console.error("Error cambiando estado de completado:", error);
    } finally {
      setIsToggling(false);
    }
  };

  const handleEdit = () => {
    if (onEdit) onEdit(reminder);
  };

  return (
    <div 
      className={`
        flex items-center gap-3 p-3 rounded-lg border transition-all
        ${isCompleted ? "bg-muted/30 opacity-70" : "bg-card hover:bg-muted/50"}
        ${!reminder.isActive && !isCompleted ? "border-dashed border-muted-foreground/30" : "border-border"}
      `}
    >
      {/* Checkbox de completado */}
      {onToggleCompleted && (
        <div className="shrink-0">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleToggleCompleted}
            disabled={isDeleting || isToggling}
            className="h-5 w-5 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
          />
        </div>
      )}

      {/* Icono del tipo */}
      <div className={`
        flex h-8 w-8 shrink-0 items-center justify-center rounded-full
        ${reminder.isActive && !isCompleted ? "bg-primary/10" : "bg-muted"}
      `}>
        {reminder.reminderType === "recurring" ? (
          <Repeat className={`h-4 w-4 ${reminder.isActive && !isCompleted ? "text-primary" : "text-muted-foreground"}`} />
        ) : (
          <Bell className={`h-4 w-4 ${reminder.isActive && !isCompleted ? "text-primary" : "text-muted-foreground"}`} />
        )}
      </div>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`${typography.body.small} font-semibold ${isCompleted ? "line-through text-muted-foreground" : ""}`}>
            {reminder.title}
          </p>
          
          {/* Tag de módulo */}
          {showModule && (
            <Badge 
              variant="outline" 
              className={`text-xs ${moduleColors.bg} ${moduleColors.text} ${moduleColors.border}`}
            >
              {MODULE_LABELS[module]}
            </Badge>
          )}

          {/* Badge de estado */}
          {!reminder.isActive && !isCompleted && (
            <Badge variant="secondary" className="text-xs">
              Pausado
            </Badge>
          )}

          {/* Badge de recurrencia */}
          {reminder.reminderType === "recurring" && !compact && (
            <Badge variant="outline" className="text-xs">
              {RECURRENCE_LABELS[reminder.recurrencePattern || ""] || "Recurrente"}
            </Badge>
          )}
        </div>

        {/* Descripción y vehículo */}
        {!compact && (
          <div className="flex items-center gap-2 mt-1">
            {reminder.description && (
              <p className={`${typography.body.small} text-muted-foreground truncate`}>
                {reminder.description}
              </p>
            )}
            {reminder.vehicle?.name && (
              <span className={`${typography.body.small} text-muted-foreground`}>
                • {reminder.vehicle.name}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Fecha */}
      <div className="shrink-0 text-right">
        <p className={`${typography.body.small} text-muted-foreground`}>
          {getRelativeTime(reminder.nextTrigger)}
        </p>
        {!compact && (
          <p className={`${typography.body.small} text-xs text-muted-foreground`}>
            {formatShortDate(reminder.scheduledDate)}
          </p>
        )}
      </div>

      {/* Indicador de no leído / completado */}
      <div className="shrink-0 w-3 flex justify-center">
        {isCompleted ? (
          <CheckCircle2 className="h-3 w-3 text-green-600" />
        ) : reminder.isActive ? (
          <Circle className="h-2.5 w-2.5 fill-primary text-primary" />
        ) : (
          <Pause className="h-3 w-3 text-muted-foreground" />
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-1 shrink-0">
        {onToggleActive && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleActive}
            disabled={isDeleting || isToggling}
            title={reminder.isActive ? "Pausar" : "Activar"}
          >
            {reminder.isActive ? (
              <Pause className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <Play className="h-3.5 w-3.5 text-green-600" />
            )}
          </Button>
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
    </div>
  );
}









