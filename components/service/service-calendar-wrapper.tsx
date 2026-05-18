"use client";

import dynamic from "next/dynamic";
import type { AppointmentCard } from "@/validations/types";

// Import the actual calendar component dynamically with SSR disabled
const ServiceCalendarInner = dynamic(
  () => import("./service-calendar-inner").then((mod) => mod.ServiceCalendarInner),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 w-full">
        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    ),
  }
);

export interface ServiceCalendarProps {
  onEventClick?: (appointment: AppointmentCard) => void;
  className?: string;
}

export function ServiceCalendar({ onEventClick, className }: ServiceCalendarProps) {
  return <ServiceCalendarInner onEventClick={onEventClick} className={className} />;
}
