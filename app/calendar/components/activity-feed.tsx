"use client";

import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Banknote, Car, Wrench, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components_shadcn/ui/skeleton";
import type { AppointmentActivityItem, AppointmentType } from "@/validations/types";

interface ActivityFeedProps {
  items: AppointmentActivityItem[];
  isLoading?: boolean;
}

const typeMeta: Record<
  AppointmentType,
  { icon: typeof Banknote; color: string; bg: string }
> = {
  venta: {
    icon: Banknote,
    color: "text-orange-600",
    bg: "bg-orange-100",
  },
  prueba: {
    icon: Car,
    color: "text-green-600",
    bg: "bg-green-100",
  },
  mantenimiento: {
    icon: Wrench,
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  recordatorio: {
    icon: Bell,
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
};

export function ActivityFeed({ items, isLoading }: ActivityFeedProps) {
  const router = useRouter();

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">Actividad Reciente</h3>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin actividad reciente</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item) => {
            const meta = typeMeta[item.type];
            const Icon = meta.icon;
            const timeText = item.createdAt
              ? formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: es })
              : "";

            return (
              <li
                key={item.id}
                onClick={() => router.push(`/calendar/details/${item.documentId}`)}
                className="flex cursor-pointer items-start gap-3 rounded-lg p-2 transition-colors hover:bg-accent/50"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    meta.bg
                  )}
                >
                  <Icon className={cn("h-4 w-4", meta.color)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.title || "Sin título"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.authorName || "Sistema"} • {item.typeLabel}
                  </p>
                  {timeText && (
                    <p className="text-xs text-muted-foreground/70">{timeText}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
