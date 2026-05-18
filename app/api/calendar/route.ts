import { NextResponse } from "next/server";
import { getCurrentUserProfile, getCurrentUserJwt } from "@/lib/auth";
import {
  fetchAppointments,
  createAppointment,
  deleteAppointment,
  type AppointmentCreatePayload,
} from "@/lib/appointments";
import { STRAPI_BASE_URL } from "@/lib/config";
import { addDays, addMonths, parseISO, format } from "date-fns";

function generateRecurringDates(baseDate: string, frequency: string): string[] {
  const dates: string[] = [baseDate];
  if (frequency === "unica") return dates;

  const start = parseISO(baseDate);
  const end = addMonths(start, 3);
  let current = start;

  while (true) {
    if (frequency === "semanal") {
      current = addDays(current, 7);
    } else if (frequency === "quincenal") {
      current = addDays(current, 14);
    } else if (frequency === "mensual") {
      current = addMonths(current, 1);
    } else {
      break;
    }

    if (current > end) break;
    dates.push(format(current, "yyyy-MM-dd"));
  }

  return dates;
}

export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || undefined;
    const search = searchParams.get("search") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;

    const appointments = await fetchAppointments(jwt, { type, search, from, to });
    return NextResponse.json({ data: appointments });
  } catch (error) {
    console.error("[API /calendar GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile();
    const userRole = profile?.role;

    const body = (await request.json()) as { data?: any; serviceOrderData?: any };
    if (!body?.data) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const payload = body.data;

    // Validación de rol: driver solo puede crear mantenimiento
    if (userRole === "driver" && payload.type !== "mantenimiento") {
      return NextResponse.json(
        { error: "Los conductores solo pueden crear citas de mantenimiento" },
        { status: 403 }
      );
    }

    if (!payload.type || !payload.scheduledAt) {
      return NextResponse.json(
        { error: "Tipo y fecha programada son requeridos" },
        { status: 400 }
      );
    }

    const frequency: string = payload.frequency || "unica";
    const scheduledDate = payload.scheduledAt.slice(0, 10);
    const recurringDates = generateRecurringDates(scheduledDate, frequency);

    const basePayload: AppointmentCreatePayload = {
      title: payload.title || undefined,
      type: payload.type,
      status: payload.status || "pendiente",
      scheduledAt: payload.scheduledAt,
      isAllDay: payload.isAllDay ?? false,
      frequency: frequency as any,
      durationMinutes: payload.durationMinutes ? Number(payload.durationMinutes) : undefined,
      description: payload.description || undefined,
      price: payload.price ? Number(payload.price) : undefined,
      notes: payload.notes || undefined,
      location: payload.location || undefined,
      contactPhone: payload.contactPhone || undefined,
      contactEmail: payload.contactEmail || undefined,
      clientName: payload.clientName || undefined,
      clientPhone: payload.clientPhone || undefined,
      clientEmail: payload.clientEmail || undefined,
      vehicle: payload.vehicle || undefined,
      service: payload.service || undefined,
      assignedTo: profile?.id || undefined,
    };

    // 1. Crear la primera cita (padre)
    const parent = await createAppointment(jwt, basePayload);

    // 2. Crear orden de servicio vinculada si aplica (solo mantenimiento)
    const serviceOrderData = body.serviceOrderData;
    if (serviceOrderData && payload.type === "mantenimiento") {
      try {
        const orderBody = {
          data: {
            scheduledAt: payload.scheduledAt,
            status: "pendiente",
            vehicle: payload.vehicle,
            laborCost: serviceOrderData.laborCost || 0,
            services: serviceOrderData.services,
            appointment: parent.numericId,
            summary: payload.description || payload.notes || undefined,
          },
          usedItems: serviceOrderData.usedItems,
        };

        const orderRes = await fetch(`${STRAPI_BASE_URL}/api/service-orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${jwt}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(orderBody),
        });

        if (!orderRes.ok) {
          const errorText = await orderRes.text();
          throw new Error(`Strapi error ${orderRes.status}: ${errorText}`);
        }
      } catch (orderError) {
        // ROLLBACK: eliminar cita padre para mantener consistencia
        await deleteAppointment(jwt, parent.id).catch((err) => {
          console.error("[API /calendar] Rollback failed:", err);
        });

        const cause = orderError instanceof Error ? orderError.message : "Error desconocido";
        throw new Error(
          `La orden de servicio no pudo crearse. La cita fue revertida. ${cause}`
        );
      }
    }

    // 3. Crear citas hijas si es recurrente (sin orden de servicio)
    if (frequency !== "unica" && recurringDates.length > 1) {
      const childDates = recurringDates.slice(1);
      const timePart = payload.scheduledAt.slice(10); // "THH:mm:ss.000Z" o similar

      await Promise.all(
        childDates.map((dateStr) =>
          createAppointment(jwt, {
            ...basePayload,
            scheduledAt: `${dateStr}${timePart}`,
            parentAppointment: parent.numericId,
            notes: basePayload.notes
              ? `${basePayload.notes}\n[Cita recurrente - ${frequency}]`.trim()
              : `[Cita recurrente - ${frequency}]`,
          })
        )
      );
    }

    return NextResponse.json({ data: parent }, { status: 201 });
  } catch (error) {
    console.error("[API /calendar POST] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
