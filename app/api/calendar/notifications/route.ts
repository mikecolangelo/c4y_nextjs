import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { requireModulePermission } from "@/lib/module-guard";

// GET - Obtener notificaciones de citas (activity feed)
export async function GET() {
  try {
    try {
      await requireModulePermission("calendar", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    // Calcular fecha de hace 48 horas para mostrar actividad reciente
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    const notificationQuery = qs.stringify({
      filters: {
        $and: [
          {
            type: {
              $in: [
                "appointment_created",
                "appointment_cancelled",
                "appointment_rescheduled",
                "appointment_updated",
              ],
            },
          },
          {
            timestamp: {
              $gte: fortyEightHoursAgo.toISOString(),
            },
          },
        ],
      },
      fields: [
        "id",
        "documentId",
        "title",
        "description",
        "type",
        "isRead",
        "timestamp",
        "createdAt",
        "tags",
      ],
      populate: {
        appointment: {
          fields: ["id", "documentId", "title", "type", "scheduledAt", "status"],
        },
        author: {
          fields: ["id", "documentId", "displayName", "email"],
        },
      },
      sort: ["timestamp:desc"],
      pagination: {
        pageSize: 50,
      },
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/notifications?${notificationQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ data: [] });
      }
      const errorText = await response.text();
      console.error("Error obteniendo notificaciones de calendario:", errorText);
      throw new Error(`Error obteniendo notificaciones: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    const notifications = data.data || [];

    // Normalizar las notificaciones para el frontend
    const normalizedNotifications = notifications.map((notification: any) => {
      let parsedTags = {};
      try {
        parsedTags =
          typeof notification.tags === "string"
            ? JSON.parse(notification.tags)
            : notification.tags || {};
      } catch {
        // Si falla el parseo, usar objeto vacío
      }

      return {
        id: notification.id,
        documentId: notification.documentId,
        title: notification.title,
        description: notification.description,
        type: notification.type,
        isRead: notification.isRead,
        timestamp: notification.timestamp,
        createdAt: notification.createdAt,
        tags: parsedTags,
        appointment: notification.appointment
          ? {
              id: notification.appointment.id,
              documentId: notification.appointment.documentId,
              title: notification.appointment.title,
              type: notification.appointment.type,
              scheduledAt: notification.appointment.scheduledAt,
              status: notification.appointment.status,
            }
          : null,
        author: notification.author
          ? {
              id: notification.author.id,
              documentId: notification.author.documentId,
              displayName: notification.author.displayName,
              email: notification.author.email,
            }
          : null,
      };
    });

    return NextResponse.json({ data: normalizedNotifications });
  } catch (error) {
    console.error("Error en /api/calendar/notifications:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
