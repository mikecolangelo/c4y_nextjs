"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startOfWeek,
  endOfWeek,
  subMonths,
  addMonths,
  subDays,
  addDays,
  setDate,
  format,
} from "date-fns";
import { Banknote, Car, Wrench, Bell, MoreVertical, Plus, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/admin-layout";
import { Button } from "@/components_shadcn/ui/button";
import { Badge } from "@/components_shadcn/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components_shadcn/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import { typography, spacing, components } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { useAppointments, AppointmentFilterType } from "./hooks/use-appointments";
import { AppointmentCalendarGrid } from "./components/appointment-calendar-grid";
import { ActivityFeed } from "./components/activity-feed";
import { AppointmentDialog, CreatePayload } from "./components/appointment-dialog";
import { Can } from "@/components/auth/can";
import type { AppointmentV2, AppointmentType } from "@/validations/types";

const filterButtons: { label: string; value: AppointmentFilterType }[] = [
  { label: "Todos", value: "all" },
  { label: "Venta", value: "venta" },
  { label: "Prueba", value: "prueba" },
  { label: "Mantenimiento", value: "mantenimiento" },
  { label: "Recordatorio", value: "recordatorios" },
];

const typeMeta: Record<
  AppointmentType,
  { icon: typeof Banknote; label: string; color: string; bg: string }
> = {
  venta: {
    icon: Banknote,
    label: "Venta",
    color: "text-orange-600",
    bg: "bg-orange-100",
  },
  prueba: {
    icon: Car,
    label: "Prueba",
    color: "text-green-600",
    bg: "bg-green-100",
  },
  mantenimiento: {
    icon: Wrench,
    label: "Mantenimiento",
    color: "text-blue-600",
    bg: "bg-blue-100",
  },
  recordatorio: {
    icon: Bell,
    label: "Recordatorio",
    color: "text-purple-600",
    bg: "bg-purple-100",
  },
};

function statusBadgeClasses(status: AppointmentV2["status"]) {
  switch (status) {
    case "confirmada":
      return "bg-green-100 text-green-800 hover:bg-green-100";
    case "pendiente":
      return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
    case "cancelada":
      return "bg-red-100 text-red-800 hover:bg-red-100";
    default:
      return "";
  }
}

export default function CalendarPage() {
  const router = useRouter();
  const filtersRef = useRef<HTMLDivElement>(null);
  const [viewType, setViewType] = useState<"monthly" | "weekly">("monthly");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogDefaultValues, setDialogDefaultValues] = useState<Partial<CreatePayload>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    appointments,
    filteredAppointments,
    activity,
    isLoading,
    isLoadingActivity,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  } = useAppointments();

  const activeList = filterType === "recordatorios" ? filteredAppointments : appointments;

  const daysWithAppointments = useMemo(() => {
    const set = new Set<number>();
    activeList.forEach((a) => {
      if (a.month === currentMonth.getMonth() + 1 && a.year === currentMonth.getFullYear()) {
        set.add(a.day);
      }
    });
    return Array.from(set);
  }, [activeList, currentMonth]);

  const selectedDate = setDate(currentMonth, selectedDay);

  const displayedAppointments = useMemo(() => {
    let list = activeList;
    if (viewType === "monthly") {
      list = activeList.filter(
        (a) =>
          a.day === selectedDay &&
          a.month === currentMonth.getMonth() + 1 &&
          a.year === currentMonth.getFullYear()
      );
    } else {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 });
      list = activeList.filter((a) => {
        const y = a.year,
          m = a.month,
          d = a.day;
        if (
          y == null ||
          m == null ||
          d == null ||
          Number.isNaN(y) ||
          Number.isNaN(m) ||
          Number.isNaN(d)
        )
          return false;
        const aptDate = new Date(y, m - 1, d);
        return !Number.isNaN(aptDate.getTime()) && aptDate >= weekStart && aptDate <= weekEnd;
      });
    }
    return list.sort((a, b) => a.time.localeCompare(b.time));
  }, [activeList, viewType, selectedDay, currentMonth, selectedDate]);

  const handleSelectDay = (day: number, isCurrentMonth: boolean) => {
    if (isCurrentMonth) {
      setSelectedDay(day);
      return;
    }
    // Heurística para determinar mes anterior o siguiente
    if (day > 15) {
      setCurrentMonth((m) => subMonths(m, 1));
    } else {
      setCurrentMonth((m) => addMonths(m, 1));
    }
    setSelectedDay(day);
  };

  const handlePrevious = () => {
    if (viewType === "monthly") {
      setCurrentMonth((m) => subMonths(m, 1));
    } else {
      const prev = subDays(selectedDate, 7);
      setCurrentMonth(prev);
      setSelectedDay(prev.getDate());
    }
  };

  const handleNext = () => {
    if (viewType === "monthly") {
      setCurrentMonth((m) => addMonths(m, 1));
    } else {
      const next = addDays(selectedDate, 7);
      setCurrentMonth(next);
      setSelectedDay(next.getDate());
    }
  };

  const scrollToFilters = () => {
    filtersRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const openCreateDialog = () => {
    setDialogMode("create");
    setDialogDefaultValues({
      scheduledDate: format(selectedDate, "yyyy-MM-dd"),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (apt: AppointmentV2) => {
    setDialogMode("edit");
    setDialogDefaultValues({
      title: apt.title,
      type: apt.type,
      status: apt.status,
      frequency: apt.frequency,
      durationMinutes: apt.durationMinutes,
      description: apt.description,
      price: apt.price,
      notes: apt.notes,
      location: apt.location,
      contactPhone: apt.contactPhone,
      contactEmail: apt.contactEmail,
      clientName: apt.clientName,
      scheduledDate: (() => {
        const y = apt.year,
          m = apt.month,
          d = apt.day;
        if (
          y != null &&
          m != null &&
          d != null &&
          !Number.isNaN(y) &&
          !Number.isNaN(m) &&
          !Number.isNaN(d)
        ) {
          const date = new Date(y, m - 1, d);
          if (!Number.isNaN(date.getTime())) return format(date, "yyyy-MM-dd");
        }
        return format(new Date(), "yyyy-MM-dd");
      })(),
      scheduledTime: apt.time,
      isAllDay: apt.isAllDay,
      vehicle: apt.vehicle?.documentId,
      service: apt.service?.documentId,
    });
    setDialogOpen(true);
  };

  const handleDialogSubmit = async (payload: CreatePayload) => {
    setIsSubmitting(true);
    try {
      if (dialogMode === "create") {
        await createAppointment(payload);
        toast.success("Cita creada exitosamente");
      } else if (dialogDefaultValues) {
        // Necesitamos el id de la cita en edición. Como el dialog no lo tiene,
        // debemos guardar el documentId de la cita en edición en un estado separado.
        // Para simplificar, no implementamos edición desde el diálogo general en la página principal
        // (la edición principal ocurre en la página de detalle).
        // Sin embargo, el menú contextual de cada card puede editar.
        // Agreguemos un estado editingDocumentId.
      }
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar la cita");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estado para saber qué cita estamos editando desde el menú contextual
  const [editingDocumentId, setEditingDocumentId] = useState<string | null>(null);

  const handleMenuEdit = (apt: AppointmentV2) => {
    setEditingDocumentId(apt.documentId);
    openEditDialog(apt);
  };

  const handleDialogSubmitWithEdit = async (payload: CreatePayload) => {
    setIsSubmitting(true);
    try {
      if (dialogMode === "create") {
        await createAppointment(payload);
        toast.success("Cita creada exitosamente");
      } else if (editingDocumentId) {
        await updateAppointment(editingDocumentId, payload);
        toast.success("Cita actualizada exitosamente");
      }
      setDialogOpen(false);
      setEditingDocumentId(null);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar la cita");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta cita?")) return;
    try {
      await deleteAppointment(id);
      toast.success("Cita eliminada");
    } catch (e: any) {
      toast.error(e.message || "Error al eliminar la cita");
    }
  };

  const listTitle = viewType === "monthly" ? `Citas del ${selectedDay}` : `Citas de la semana`;

  return (
    <AdminLayout title="Calendario" showFilterAction onFilterActionClick={scrollToFilters}>
      <div className={cn(spacing.gap.xlarge, "flex flex-col lg:flex-row")}>
        {/* Main content */}
        <div className="flex-1 space-y-5">
          {/* View switcher + search */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant={viewType === "monthly" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("monthly")}
              >
                Mensual
              </Button>
              <Button
                variant={viewType === "weekly" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewType("weekly")}
              >
                Semanal
              </Button>
            </div>
            <div className="w-full sm:w-72">
              <SearchInput
                placeholder="Buscar citas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Calendar grid */}
          <AppointmentCalendarGrid
            viewType={viewType}
            currentMonth={currentMonth}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            onPrevious={handlePrevious}
            onNext={handleNext}
            daysWithAppointments={daysWithAppointments}
          />

          {/* Quick filters — debajo del calendario, afectan las citas */}
          <div ref={filtersRef} className="flex flex-wrap gap-2">
            {filterButtons.map((btn) => {
              const active = filterType === btn.value;
              return (
                <button
                  key={btn.value}
                  onClick={() => setFilterType(btn.value)}
                  className={cn(
                    components.periodButton.base,
                    components.periodButton.text,
                    active ? components.periodButton.active : components.periodButton.inactive
                  )}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Appointments list */}
          <div className="space-y-3">
            <h4 className={typography.h4}>{listTitle}</h4>
            {isLoading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : displayedAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay citas para mostrar.</p>
            ) : (
              <div className="space-y-3">
                {displayedAppointments.map((apt) => {
                  const meta = typeMeta[apt.type];
                  const Icon = meta.icon;
                  const isReminder = apt._isFleetReminder;
                  const handleClick = () => {
                    if (isReminder && apt.vehicle?.documentId) {
                      router.push(`/fleet/details/${apt.vehicle.documentId}?tab=reminders`);
                    } else {
                      router.push(`/calendar/details/${apt.documentId}`);
                    }
                  };
                  return (
                    <div
                      key={apt.id}
                      onClick={handleClick}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            meta.bg
                          )}
                        >
                          <Icon className={cn("h-5 w-5", meta.color)} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {apt.time} {apt.vehicle?.name || apt.title || "Sin título"}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{meta.label}</span>
                            {apt.clientName && <span>• {apt.clientName}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={cn("rounded-md text-xs", statusBadgeClasses(apt.status))}>
                          {apt.status}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isReminder ? (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (apt.vehicle?.documentId) {
                                    router.push(
                                      `/fleet/details/${apt.vehicle.documentId}?tab=reminders`
                                    );
                                  }
                                }}
                              >
                                Ver vehículo
                              </DropdownMenuItem>
                            ) : (
                              <>
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.push(`/calendar/details/${apt.documentId}`);
                                  }}
                                >
                                  Ver detalle
                                </DropdownMenuItem>
                                <Can module="calendar" action="canUpdate">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMenuEdit(apt);
                                    }}
                                  >
                                    Editar
                                  </DropdownMenuItem>
                                </Can>
                                <Can module="calendar" action="canDelete">
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(apt.documentId);
                                    }}
                                  >
                                    Eliminar
                                  </DropdownMenuItem>
                                </Can>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <aside className="w-full shrink-0 lg:w-80">
          <ActivityFeed items={activity} isLoading={isLoadingActivity} />
        </aside>
      </div>

      {/* Floating action button */}
      <Can module="calendar" action="canCreate">
        <Button
          size="icon"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
          onClick={openCreateDialog}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </Can>

      <AppointmentDialog
        isOpen={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingDocumentId(null);
        }}
        onSubmit={handleDialogSubmitWithEdit}
        isSubmitting={isSubmitting}
        defaultValues={dialogDefaultValues}
        mode={dialogMode}
      />
    </AdminLayout>
  );
}
