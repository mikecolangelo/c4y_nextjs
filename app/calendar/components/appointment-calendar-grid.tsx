"use client";

import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  format,
  setDate,
  isSameDay,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components_shadcn/ui/button";

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];

export interface CalendarGridProps {
  viewType: "monthly" | "weekly";
  currentMonth: Date;
  selectedDay: number;
  onSelectDay: (day: number, isCurrentMonth: boolean) => void;
  onPrevious: () => void;
  onNext: () => void;
  daysWithAppointments: number[];
}

export function AppointmentCalendarGrid({
  viewType,
  currentMonth,
  selectedDay,
  onSelectDay,
  onPrevious,
  onNext,
  daysWithAppointments,
}: CalendarGridProps) {
  const selectedDate = setDate(currentMonth, selectedDay);

  const days = (() => {
    if (viewType === "monthly") {
      const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
      const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  })();

  const title =
    viewType === "monthly"
      ? format(currentMonth, "MMMM yyyy", { locale: es })
      : `Semana del ${format(days[0], "d MMM", { locale: es })}`;

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold capitalize">{title}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onPrevious}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="flex h-8 items-center justify-center text-xs font-semibold text-muted-foreground"
          >
            {d}
          </div>
        ))}

        {days.map((day) => {
          const inCurrentMonth = isSameMonth(day, currentMonth);
          const isSelected = isSameDay(day, selectedDate);
          const hasAppointment = daysWithAppointments.includes(day.getDate()) && inCurrentMonth;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDay(day.getDate(), inCurrentMonth)}
              className={cn(
                "relative flex h-10 flex-col items-center justify-center rounded-lg text-sm transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent",
                !inCurrentMonth && "text-muted-foreground/50"
              )}
            >
              <span>{day.getDate()}</span>
              {hasAppointment && (
                <span
                  className={cn(
                    "mt-0.5 h-1.5 w-1.5 rounded-full",
                    isSelected ? "bg-primary-foreground" : "bg-blue-500"
                  )}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
