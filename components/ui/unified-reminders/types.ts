import type { FleetReminder, ReminderModule } from "@/validations/types";

export type { FleetReminder, ReminderModule };

export interface UnifiedReminderItemProps {
  reminder: FleetReminder;
  onEdit?: (reminder: FleetReminder) => void;
  onDelete?: (reminderId: number | string) => Promise<void>;
  onToggleActive?: (reminderId: number | string, isActive: boolean) => Promise<void>;
  onToggleCompleted?: (reminderId: number | string, isCompleted: boolean) => Promise<void>;
  showModule?: boolean;
  compact?: boolean;
}

export interface UnifiedRemindersProps {
  reminders: FleetReminder[];
  isLoading?: boolean;
  onEdit?: (reminder: FleetReminder) => void;
  onDelete?: (reminderId: number | string) => Promise<void>;
  onToggleActive?: (reminderId: number | string, isActive: boolean) => Promise<void>;
  onToggleCompleted?: (reminderId: number | string, isCompleted: boolean) => Promise<void>;
  filterModule?: ReminderModule;
  showModuleTags?: boolean;
  showCompletedButton?: boolean;
  forceShowCompleted?: boolean;
  showArchivedTab?: boolean;
  compact?: boolean;
  maxHeight?: string;
}

export const MODULE_LABELS: Record<ReminderModule, string> = {
  fleet: "Flota",
  calendar: "Calendario",
  billing: "Facturación",
  contracts: "Contratos",
  inventory: "Inventario",
  services: "Servicios",
};

export const MODULE_COLORS: Record<ReminderModule, { bg: string; text: string; border: string }> = {
  fleet: { bg: "bg-blue-500/10", text: "text-blue-600", border: "border-blue-500/30" },
  calendar: { bg: "bg-purple-500/10", text: "text-purple-600", border: "border-purple-500/30" },
  billing: { bg: "bg-green-500/10", text: "text-green-600", border: "border-green-500/30" },
  contracts: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30" },
  inventory: { bg: "bg-cyan-500/10", text: "text-cyan-600", border: "border-cyan-500/30" },
  services: { bg: "bg-rose-500/10", text: "text-rose-600", border: "border-rose-500/30" },
};

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Bisemanal",
  monthly: "Mensual",
  yearly: "Anual",
};















