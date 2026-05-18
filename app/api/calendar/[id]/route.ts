import { NextResponse } from "next/server";
import { getCurrentUserProfile, getCurrentUserJwt } from "@/lib/auth";
import {
  fetchAppointmentById,
  updateAppointment,
  deleteAppointment,
  type AppointmentUpdatePayload,
} from "@/lib/appointments";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const appointment = await fetchAppointmentById(jwt, id);

    if (!appointment) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ data: appointment });
  } catch (error) {
    console.error("[API /calendar/[id] GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile();
    const userRole = profile?.role;

    const { id } = await params;
    const body = (await request.json()) as { data?: any };
    if (!body?.data) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const existing = await fetchAppointmentById(jwt, id);
    if (!existing) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    // Validación de rol: driver solo puede modificar mantenimiento
    if (userRole === "driver" && existing.type !== "mantenimiento") {
      return NextResponse.json(
        { error: "No tienes permiso para modificar esta cita" },
        { status: 403 }
      );
    }

    // Si intenta cambiar el tipo y es driver, bloquear
    if (userRole === "driver" && body.data.type && body.data.type !== "mantenimiento") {
      return NextResponse.json(
        { error: "Los conductores solo pueden gestionar citas de mantenimiento" },
        { status: 403 }
      );
    }

    const payload: AppointmentUpdatePayload = {
      title: body.data.title,
      type: body.data.type,
      status: body.data.status,
      scheduledAt: body.data.scheduledAt,
      isAllDay: body.data.isAllDay,
      frequency: body.data.frequency,
      durationMinutes: body.data.durationMinutes ? Number(body.data.durationMinutes) : undefined,
      description: body.data.description,
      price: body.data.price !== undefined ? Number(body.data.price) : undefined,
      notes: body.data.notes,
      location: body.data.location,
      contactPhone: body.data.contactPhone,
      contactEmail: body.data.contactEmail,
      clientName: body.data.clientName,
      clientPhone: body.data.clientPhone,
      clientEmail: body.data.clientEmail,
      vehicle: body.data.vehicle ?? null,
      service: body.data.service ?? null,
      assignedTo: profile?.id || undefined,
    };

    // Limpiar undefined para no enviar campos vacíos
    const cleanedPayload = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== undefined)
    ) as AppointmentUpdatePayload;

    const updated = await updateAppointment(jwt, id, cleanedPayload);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("[API /calendar/[id] PATCH] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getCurrentUserProfile();
    const userRole = profile?.role;

    const { id } = await params;
    const existing = await fetchAppointmentById(jwt, id);
    if (!existing) {
      return NextResponse.json({ error: "Cita no encontrada" }, { status: 404 });
    }

    if (userRole === "driver" && existing.type !== "mantenimiento") {
      return NextResponse.json(
        { error: "No tienes permiso para eliminar esta cita" },
        { status: 403 }
      );
    }

    await deleteAppointment(jwt, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API /calendar/[id] DELETE] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
