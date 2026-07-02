import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { requireModulePermission } from "@/lib/module-guard";

function extractTimeFromDate(dateStr: string): { time: string; period: "AM" | "PM" } {
  try {
    const date = new Date(dateStr);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const time = `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    return { time, period };
  } catch {
    return { time: "00:00", period: "AM" };
  }
}

function extractDateParts(dateStr: string): { day: number; month: number; year: number } {
  try {
    const date = new Date(dateStr);
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  } catch {
    return { day: 1, month: 1, year: 2024 };
  }
}

function formatScheduledAtLabel(scheduledAt: string): string {
  try {
    const date = new Date(scheduledAt);
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export async function GET(_request: Request) {
  try {
    try {
      await requireModulePermission("calendar", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reminderQuery = qs.stringify({
      filters: {
        type: { $in: ["reminder", "oil_change_reminder"] },
        module: { $eq: "fleet" },
      },
      fields: [
        "id",
        "documentId",
        "title",
        "description",
        "type",
        "scheduledDate",
        "nextTrigger",
        "timestamp",
        "createdAt",
        "isActive",
        "isCompleted",
        "isRead",
        "reminderType",
        "recurrencePattern",
        "tags",
      ],
      populate: {
        fleetVehicle: {
          fields: ["id", "documentId", "name", "placa", "brand", "model"],
        },
      },
      sort: ["nextTrigger:asc", "timestamp:desc"],
      pagination: {
        pageSize: 500,
      },
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/notifications?${reminderQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[API /calendar/reminders] Error fetching from Strapi:", {
        status: response.status,
        error: errorText,
      });
      return NextResponse.json({ data: [] });
    }

    const json = await response.json();
    const rawReminders = json.data || [];

    // Filtrar y deduplicar recordatorios
    const seen = new Set<string>();
    const reminders = [];

    for (const entry of rawReminders) {
      const attrs = entry.attributes || entry;
      const id = entry.id ?? entry.documentId;
      const documentId = entry.documentId ?? String(id);

      // Excluir notificaciones individuales (hijas) que tienen parentReminderId en tags
      if (attrs.tags) {
        try {
          const tags = typeof attrs.tags === "string" ? JSON.parse(attrs.tags) : attrs.tags;
          if (tags && tags.parentReminderId != null) {
            continue;
          }
        } catch {
          // ignore parse error
        }
      }

      // Para recordatorios manuales (type=reminder), solo mostrar activos y no completados
      if (attrs.type === "reminder") {
        if (attrs.isCompleted === true) continue;
        if (attrs.isActive === false) continue;
      }

      // Para oil_change_reminder, solo mostrar no leídas (activas)
      if (attrs.type === "oil_change_reminder") {
        if (attrs.isRead === true) continue;
      }

      // Extraer vehículo
      const fleetVehicleRaw = attrs.fleetVehicle?.data?.attributes
        ? {
            ...attrs.fleetVehicle.data.attributes,
            id: attrs.fleetVehicle.data.id,
            documentId: attrs.fleetVehicle.data.documentId,
          }
        : attrs.fleetVehicle;

      const vehicleId = fleetVehicleRaw?.documentId || fleetVehicleRaw?.id;
      const title = attrs.title || "Recordatorio";

      // Deduplicar por vehículo + título
      const dedupKey = `${vehicleId}-${title}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      // Determinar fecha a mostrar
      const dateStr =
        attrs.nextTrigger || attrs.scheduledDate || attrs.timestamp || attrs.createdAt;
      if (!dateStr) continue;

      const { time, period } = extractTimeFromDate(dateStr);
      const { day, month, year } = extractDateParts(dateStr);

      // Determinar status visual
      let status: "pendiente" | "confirmada" | "cancelada" = "pendiente";
      if (attrs.isCompleted === true) status = "confirmada";
      else if (attrs.isActive === false) status = "cancelada";

      reminders.push({
        id: String(id),
        documentId: String(documentId),
        title,
        type: "recordatorio" as const,
        status,
        scheduledAt: dateStr,
        scheduledAtLabel: formatScheduledAtLabel(dateStr),
        isAllDay: false,
        frequency: "unica" as const,
        description: attrs.description,
        time,
        period,
        day,
        month,
        year,
        vehicle: fleetVehicleRaw
          ? {
              id: String(fleetVehicleRaw.id),
              documentId: fleetVehicleRaw.documentId || String(fleetVehicleRaw.id),
              name: fleetVehicleRaw.name,
              placa: fleetVehicleRaw.placa,
              brand: fleetVehicleRaw.brand,
              model: fleetVehicleRaw.model,
            }
          : undefined,
        _isFleetReminder: true,
      });
    }

    return NextResponse.json({ data: reminders });
  } catch (error) {
    console.error("[API /calendar/reminders] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
