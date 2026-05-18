"use client";

import { Button } from "@/components_shadcn/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components_shadcn/ui/card";
import { Plus, Calendar } from "lucide-react";
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import { spacing, typography } from "@/lib/design-system";
import {
  FleetReminder,
  ReminderType,
  RecurrencePattern,
} from "@/validations/types";
import { FleetReminders } from "@/components/ui/fleet-reminders";
import { Label } from "@/components_shadcn/ui/label";
import { Input } from "@/components_shadcn/ui/input";
import { Textarea } from "@/components_shadcn/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components_shadcn/ui/select";
import { Checkbox } from "@/components_shadcn/ui/checkbox";
import { MultiSelectCombobox } from "@/components_shadcn/ui/multi-select-combobox";

interface FleetDetailsRemindersCardProps {
  vehicleReminders: FleetReminder[];
  isLoadingReminders: boolean;
  showReminderForm: boolean;
  reminderTitle: string;
  reminderDescription: string;
  reminderType: ReminderType;
  reminderScheduledDate: string;
  reminderScheduledTime: string;
  isAllDay: boolean;
  reminderRecurrencePattern: RecurrencePattern;
  reminderRecurrenceEndDate: string;
  selectedResponsables: number[];
  selectedAssignedDrivers: number[];
  isSavingReminder: boolean;
  editingReminderId: number | string | null;
  availableUsers: Array<{
    id: number;
    documentId?: string;
    displayName?: string;
    email?: string;
    role?: string;
    avatar?: { url?: string; alternativeText?: string };
  }>;
  onAddReminder: () => void;
  onCancelReminder: () => void;
  onReminderTitleChange: (value: string) => void;
  onReminderDescriptionChange: (value: string) => void;
  onReminderTypeChange: (value: ReminderType) => void;
  onReminderScheduledDateChange: (value: string) => void;
  onReminderScheduledTimeChange: (value: string) => void;
  onReminderIsAllDayChange: (value: boolean) => void;
  onReminderRecurrencePatternChange: (value: RecurrencePattern) => void;
  onReminderRecurrenceEndDateChange: (value: string) => void;
  onSelectedResponsablesChange: (values: number[]) => void;
  onSelectedAssignedDriversChange: (values: number[]) => void;
  onSaveReminder: () => void;
  onEditReminder: (reminder: FleetReminder) => void;
  onDeleteReminder: (reminderId: number | string) => Promise<void>;
  onToggleReminderActive: (reminderId: number | string, isActive: boolean, loadVehicle?: () => Promise<void>) => Promise<void>;
  onToggleReminderCompleted: (reminderId: number | string, isCompleted: boolean, loadVehicle?: () => Promise<void>) => Promise<void>;
  vehicleId: string;
}

export function FleetDetailsRemindersCard({
  vehicleReminders,
  isLoadingReminders,
  showReminderForm,
  reminderTitle,
  reminderDescription,
  reminderType,
  reminderScheduledDate,
  reminderScheduledTime,
  isAllDay,
  reminderRecurrencePattern,
  reminderRecurrenceEndDate,
  selectedResponsables,
  selectedAssignedDrivers,
  isSavingReminder,
  editingReminderId,
  availableUsers,
  onAddReminder,
  onCancelReminder,
  onReminderTitleChange,
  onReminderDescriptionChange,
  onReminderTypeChange,
  onReminderScheduledDateChange,
  onReminderScheduledTimeChange,
  onReminderIsAllDayChange,
  onReminderRecurrencePatternChange,
  onReminderRecurrenceEndDateChange,
  onSelectedResponsablesChange,
  onSelectedAssignedDriversChange,
  onSaveReminder,
  onEditReminder,
  onDeleteReminder,
  onToggleReminderActive,
  onToggleReminderCompleted,
  vehicleId,
}: FleetDetailsRemindersCardProps) {
  return (
    <Card
      className="shadow-sm backdrop-blur-sm border rounded-lg"
      style={{
        backgroundColor: "color-mix(in oklch, var(--background) 50%, transparent)",
        borderColor: "color-mix(in oklch, var(--border) 85%, transparent)",
      }}
    >
      <CardHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
        <CardTitle className={typography.h4}>Recordatorios del Vehículo</CardTitle>
        {vehicleReminders.length > 0 && !showReminderForm && (
          <Button onClick={onAddReminder} size="sm" variant="outline" className="gap-2">
            <Plus className="h-4 w-4" />
            Agregar Recordatorio
          </Button>
        )}
      </CardHeader>
      <CardContent className={`flex flex-col ${spacing.gap.base} px-6 pb-6`}>
        {vehicleReminders.length === 0 && !showReminderForm && !isLoadingReminders && (
          <div className="flex flex-col items-center justify-center py-16 min-h-[300px] border-2 border-dashed border-border rounded-lg">
            <p className={`${typography.body.base} text-muted-foreground mb-6`}>Añade un recordatorio a tu vehículo</p>
            <Button onClick={onAddReminder} size="lg" className="h-16 w-16 rounded-full">
              <Plus className="h-8 w-8" />
            </Button>
          </div>
        )}

        {vehicleReminders.length > 0 && (
          <ScrollAreaPrimitive.Root className="relative overflow-hidden h-[600px]">
            <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit] scroll-smooth">
              <FleetReminders
                reminders={vehicleReminders}
                isLoading={isLoadingReminders}
                onEdit={onEditReminder}
                onDelete={onDeleteReminder}
                onToggleActive={onToggleReminderActive}
                onToggleCompleted={onToggleReminderCompleted}
                vehicleId={vehicleId}
              />
            </ScrollAreaPrimitive.Viewport>
            <ScrollAreaPrimitive.ScrollAreaScrollbar
              orientation="vertical"
              className="flex touch-none select-none transition-colors h-full w-2.5 border-l border-l-transparent p-[1px]"
            >
              <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-border/75 hover:bg-border/90 dark:bg-border/65 dark:hover:bg-border/85 transition-colors" />
            </ScrollAreaPrimitive.ScrollAreaScrollbar>
            <ScrollAreaPrimitive.Corner />
          </ScrollAreaPrimitive.Root>
        )}

        {showReminderForm && (
          <div className={`flex flex-col ${spacing.gap.small} ${vehicleReminders.length > 0 ? "pt-4 border-t border-border" : ""}`}>
            {vehicleReminders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 min-h-[200px] border-2 border-dashed border-border rounded-lg">
                <p className={`${typography.body.base} text-muted-foreground mb-6`}>Crea un recordatorio para este vehículo</p>
              </div>
            )}

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="reminder-title">Título del Recordatorio</Label>
              <Input id="reminder-title" value={reminderTitle} onChange={(e) => onReminderTitleChange(e.target.value)} placeholder="Ej: Revisar mantenimiento" />
            </div>

            <div className={`flex flex-col ${spacing.gap.small}`}>
              <Label htmlFor="reminder-description">Descripción (opcional)</Label>
              <Textarea
                id="reminder-description"
                value={reminderDescription}
                onChange={(e) => onReminderDescriptionChange(e.target.value)}
                placeholder="Añade una descripción del recordatorio..."
                rows={3}
                className="min-h-20 resize-y"
              />
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${spacing.gap.small}`}>
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="reminder-type">Tipo de Recordatorio</Label>
                <Select value={reminderType} onValueChange={(value) => onReminderTypeChange(value as ReminderType)}>
                  <SelectTrigger id="reminder-type">
                    <SelectValue placeholder="Selecciona el tipo" />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="unique">Único</SelectItem>
                    <SelectItem value="recurring">Recurrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label htmlFor="reminder-scheduled-date">Fecha y Hora Programada</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex flex-col lg:flex-row gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="reminder-scheduled-date"
                        type="date"
                        value={reminderScheduledDate}
                        onChange={(e) => onReminderScheduledDateChange(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="flex flex-row gap-2 lg:flex-1">
                      <Input
                        type="time"
                        value={reminderScheduledTime}
                        onChange={(e) => onReminderScheduledTimeChange(e.target.value)}
                        disabled={isAllDay}
                        min={
                          reminderScheduledDate === new Date().toISOString().split('T')[0]
                            ? (() => {
                                const now = new Date();
                                now.setMinutes(now.getMinutes() + 30);
                                const hours = String(now.getHours()).padStart(2, '0');
                                const minutes = String(now.getMinutes()).padStart(2, '0');
                                return `${hours}:${minutes}`;
                              })()
                            : undefined
                        }
                      />
                      <div className="flex items-center gap-2">
                        <Checkbox id="reminder-all-day" checked={isAllDay} onCheckedChange={(checked) => onReminderIsAllDayChange(checked === true)} />
                        <Label htmlFor="reminder-all-day" className="cursor-pointer select-none">
                          Todo el día
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {reminderType === "recurring" && (
              <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${spacing.gap.small}`}>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="reminder-recurrence-pattern">Patrón de Recurrencia</Label>
                  <Select value={reminderRecurrencePattern} onValueChange={(value) => onReminderRecurrencePatternChange(value as RecurrencePattern)}>
                    <SelectTrigger id="reminder-recurrence-pattern">
                      <SelectValue placeholder="Selecciona el patrón" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Diario</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="biweekly">Bisemanal</SelectItem>
                      <SelectItem value="monthly">Mensual</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className={`flex flex-col ${spacing.gap.small}`}>
                  <Label htmlFor="reminder-recurrence-end-date">Fecha de Finalización (opcional)</Label>
                  <Input
                    id="reminder-recurrence-end-date"
                    type="date"
                    value={reminderRecurrenceEndDate}
                    onChange={(e) => onReminderRecurrenceEndDateChange(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className={`grid gap-4 md:grid-cols-2 ${spacing.gap.small}`}>
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label>Responsable(s) del Auto</Label>
                <MultiSelectCombobox
                  options={availableUsers
                    .filter((user) => user.role !== "lead")
                    .map((user) => ({
                      value: user.id,
                      label: user.displayName || user.email || "Usuario",
                      email: user.email,
                      avatar: user.avatar,
                    }))}
                  selectedValues={selectedResponsables}
                  onSelectionChange={(values) => onSelectedResponsablesChange(values as number[])}
                  placeholder="Selecciona responsables..."
                  searchPlaceholder="Buscar responsables..."
                  emptyMessage="No se encontraron usuarios."
                />
              </div>
              <div className={`flex flex-col ${spacing.gap.small}`}>
                <Label>Conductores anteriores</Label>
                <MultiSelectCombobox
                  options={availableUsers
                    .filter((user) => user.role !== "lead")
                    .map((user) => ({
                      value: user.id,
                      label: user.displayName || user.email || "Usuario",
                      email: user.email,
                      avatar: user.avatar,
                    }))}
                  selectedValues={selectedAssignedDrivers}
                  onSelectionChange={(values) => onSelectedAssignedDriversChange(values as number[])}
                  placeholder="Selecciona conductores..."
                  searchPlaceholder="Buscar conductores..."
                  emptyMessage="No se encontraron usuarios."
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-4">
              <Button 
                onClick={onCancelReminder} 
                variant="outline" 
                size="lg" 
                className="flex-1 min-h-[44px] text-base sm:text-sm font-medium"
              >
                Cancelar
              </Button>
              <Button
                onClick={onSaveReminder}
                variant="default"
                size="lg"
                className="flex-1 min-h-[44px] text-base sm:text-sm font-medium"
                disabled={!reminderTitle.trim() || !reminderScheduledDate || (selectedResponsables.length === 0 && selectedAssignedDrivers.length === 0) || isSavingReminder}
              >
                {isSavingReminder 
                  ? "Guardando..." 
                  : editingReminderId 
                    ? "Guardar Cambios" 
                    : "Crear Recordatorio"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

