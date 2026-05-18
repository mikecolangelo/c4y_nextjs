import { useState, useEffect, useCallback, useMemo } from "react";
import type {
  AppointmentV2,
  AppointmentActivityItem,
  AppointmentType,
  AppointmentStatus,
  AppointmentFrequency,
} from "@/validations/types";

export type AppointmentFilterType = "all" | AppointmentType | "recordatorios";

interface UseAppointmentsOptions {
  initialFilter?: AppointmentFilterType;
}

export function useAppointments(options: UseAppointmentsOptions = {}) {
  const [appointments, setAppointments] = useState<AppointmentV2[]>([]);
  const [fleetReminders, setFleetReminders] = useState<AppointmentV2[]>([]);
  const [activity, setActivity] = useState<AppointmentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingReminders, setIsLoadingReminders] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<AppointmentFilterType>(
    options.initialFilter || "all"
  );
  const [dateRange, setDateRange] = useState<{ from?: string; to?: string }>({});

  const fetchAppointments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterType && filterType !== "all" && filterType !== "recordatorios") {
        params.set("type", filterType);
      }
      if (searchQuery) {
        params.set("search", searchQuery);
      }
      if (dateRange.from) {
        params.set("from", dateRange.from);
      }
      if (dateRange.to) {
        params.set("to", dateRange.to);
      }

      const res = await fetch(`/api/calendar?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      const json = await res.json();
      setAppointments(json.data || []);
    } catch (err) {
      console.error("[useAppointments] fetch error:", err);
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [filterType, searchQuery, dateRange]);

  const fetchActivity = useCallback(async () => {
    try {
      setIsLoadingActivity(true);
      const res = await fetch("/api/calendar/activity", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const json = await res.json();
      setActivity(json.data || []);
    } catch (err) {
      console.error("[useAppointments] activity error:", err);
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  const fetchFleetReminders = useCallback(async () => {
    try {
      setIsLoadingReminders(true);
      const res = await fetch("/api/calendar/reminders", { cache: "no-store" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const json = await res.json();
      setFleetReminders(json.data || []);
    } catch (err) {
      console.error("[useAppointments] reminders error:", err);
    } finally {
      setIsLoadingReminders(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    if (filterType === "recordatorios") {
      fetchFleetReminders();
    }
  }, [filterType, fetchFleetReminders]);

  const createAppointment = useCallback(
    async (payload: {
      title?: string;
      type: AppointmentType;
      status?: AppointmentStatus;
      scheduledDate: string;
      scheduledTime?: string;
      isAllDay?: boolean;
      frequency?: AppointmentFrequency;
      durationMinutes?: number;
      description?: string;
      price?: number;
      notes?: string;
      location?: string;
      contactPhone?: string;
      contactEmail?: string;
      clientName?: string;
      clientPhone?: string;
      clientEmail?: string;
      vehicle?: string;
      service?: string;
    }) => {
      const scheduledAt = payload.isAllDay
        ? `${payload.scheduledDate}T00:00:00.000Z`
        : payload.scheduledTime
        ? `${payload.scheduledDate}T${payload.scheduledTime}:00.000Z`
        : `${payload.scheduledDate}T00:00:00.000Z`;

      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            ...payload,
            scheduledAt,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      await fetchAppointments();
      await fetchActivity();
      return (await res.json()).data as AppointmentV2;
    },
    [fetchAppointments, fetchActivity]
  );

  const updateAppointment = useCallback(
    async (id: string, payload: Partial<Parameters<typeof createAppointment>[0]>) => {
      let scheduledAt = undefined;
      if (payload.scheduledDate) {
        scheduledAt = payload.isAllDay
          ? `${payload.scheduledDate}T00:00:00.000Z`
          : payload.scheduledTime
          ? `${payload.scheduledDate}T${payload.scheduledTime}:00.000Z`
          : `${payload.scheduledDate}T00:00:00.000Z`;
      }

      const body: any = { ...payload };
      if (scheduledAt) body.scheduledAt = scheduledAt;
      delete body.scheduledDate;
      delete body.scheduledTime;

      const res = await fetch(`/api/calendar/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: body }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      await fetchAppointments();
      await fetchActivity();
      return (await res.json()).data as AppointmentV2;
    },
    [fetchAppointments, fetchActivity]
  );

  const deleteAppointment = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/calendar/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${res.status}`);
      }

      await fetchAppointments();
      await fetchActivity();
    },
    [fetchAppointments, fetchActivity]
  );

  const filteredAppointments = useMemo(() => {
    if (filterType === "recordatorios") {
      return fleetReminders;
    }
    return appointments;
  }, [appointments, fleetReminders, filterType]);

  return {
    appointments,
    filteredAppointments,
    activity,
    isLoading: filterType === "recordatorios" ? isLoadingReminders : isLoading,
    isLoadingActivity,
    error,
    searchQuery,
    setSearchQuery,
    filterType,
    setFilterType,
    dateRange,
    setDateRange,
    fetchAppointments,
    fetchActivity,
    createAppointment,
    updateAppointment,
    deleteAppointment,
  };
}
