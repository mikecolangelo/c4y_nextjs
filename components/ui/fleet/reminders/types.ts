import type { FleetReminder } from "@/validations/types";

export type { FleetReminder };

export interface ReminderItemProps {
  reminder: FleetReminder;
  onEdit?: (reminder: FleetReminder) => void;
  onDelete?: (reminderId: number | string, loadVehicle?: () => Promise<unknown>) => Promise<void>;
  onToggleActive?: (reminderId: number | string, isActive: boolean) => Promise<void>;
  onToggleCompleted?: (reminderId: number | string, isCompleted: boolean) => Promise<void>;
}

export interface FleetRemindersProps {
  reminders: FleetReminder[];
  isLoading?: boolean;
  onEdit?: (reminder: FleetReminder) => void;
  onDelete?: (reminderId: number | string, loadVehicle?: () => Promise<unknown>) => Promise<void>;
  onToggleActive?: (reminderId: number | string, isActive: boolean) => Promise<void>;
  onToggleCompleted?: (reminderId: number | string, isCompleted: boolean) => Promise<void>;
  vehicleId: string;
  showCompletedButton?: boolean;
  forceShowCompleted?: boolean;
}

export const RECURRENCE_LABELS: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  biweekly: "Bisemanal",
  monthly: "Mensual",
  yearly: "Anual",
};

















