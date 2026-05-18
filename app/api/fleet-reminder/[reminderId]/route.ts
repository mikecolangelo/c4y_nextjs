import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import type { FleetReminderPayload } from "@/validations/types";
import { requireAdmin } from "@/lib/admin-guard";

interface RouteContext {
  params: Promise<{
    reminderId: string;
  }>;
}

// PATCH - Actualizar un recordatorio
export async function PATCH(request: Request, context: RouteContext) {
  try {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const params = await context.params;
    const { reminderId } = params;
    
    if (!reminderId) {
      return NextResponse.json(
        { error: "reminderId es requerido" },
        { status: 400 }
      );
    }
    
    let body;
    try {
      body = (await request.json()) as { 
        data?: Partial<FleetReminderPayload & { isActive?: boolean; nextTrigger?: string }> 
      };
    } catch (parseError) {
      console.error("Error parseando body:", parseError);
      return NextResponse.json(
        { error: "Body inválido o vacío" },
        { status: 400 }
      );
    }
    
    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del recordatorio son requeridos." },
        { status: 400 }
      );
    }

    const updateData: any = {};
    
    if (body.data.title !== undefined) {
      updateData.title = body.data.title.trim();
    }
    
    if (body.data.description !== undefined) {
      updateData.description = body.data.description?.trim() || null;
    }
    
    if (body.data.reminderType !== undefined) {
      updateData.reminderType = body.data.reminderType;
    }
    
    if (body.data.scheduledDate !== undefined) {
      updateData.scheduledDate = body.data.scheduledDate;
      // Si se actualiza la fecha programada y no hay nextTrigger, actualizar nextTrigger
      if (!body.data.nextTrigger) {
        updateData.nextTrigger = body.data.scheduledDate;
      }
    }
    
    if (body.data.recurrencePattern !== undefined) {
      updateData.recurrencePattern = body.data.recurrencePattern || null;
    }
    
    if (body.data.recurrenceEndDate !== undefined) {
      updateData.recurrenceEndDate = body.data.recurrenceEndDate || null;
    }
    
    if (body.data.isActive !== undefined) {
      updateData.isActive = body.data.isActive;
    }
    
    if (body.data.assignedUserIds !== undefined) {
      updateData.assignedUsers = body.data.assignedUserIds || [];
    }
    
    const updateResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-reminders/${reminderId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: updateData,
        }),
        cache: "no-store",
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${updateResponse.status}` } };
      }
      
      // Si es 404, el tipo de contenido o el recordatorio no existe
      if (updateResponse.status === 404) {
        throw new Error("El recordatorio no fue encontrado o el tipo de contenido 'fleet-reminders' no existe en Strapi.");
      }
      
      throw new Error(errorData.error?.message || errorData.message || `Error ${updateResponse.status}: ${updateResponse.statusText}`);
    }

    const updatedReminder = await updateResponse.json();

    // Obtener el recordatorio actualizado completo
    const reminderQuery = qs.stringify({
      fields: ["id", "documentId", "title", "description", "reminderType", "scheduledDate", "recurrencePattern", "recurrenceEndDate", "isActive", "lastTriggered", "nextTrigger", "authorDocumentId", "createdAt", "updatedAt"],
      populate: {
        assignedUsers: {
          fields: ["id", "documentId", "displayName", "email"],
          populate: {
            avatar: {
              fields: ["url", "alternativeText"],
            },
          },
        },
      },
    });

    const reminderResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-reminders/${reminderId}?${reminderQuery}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (reminderResponse.ok) {
      const reminderDataResponse = await reminderResponse.json();
      const reminderData = reminderDataResponse.data;
      
      // Agregar el autor si está disponible
      if (reminderData.authorDocumentId) {
        try {
          const authorQuery = qs.stringify({
            filters: {
              documentId: { $eq: reminderData.authorDocumentId },
            },
            fields: ["id", "documentId", "displayName", "email"],
            populate: {
              avatar: {
                fields: ["url", "alternativeText"],
              },
            },
          });

          const authorResponse = await fetch(
            `${STRAPI_BASE_URL}/api/user-profiles?${authorQuery}`,
            {
              headers: {
                Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              },
              cache: "no-store",
            }
          );

          if (authorResponse.ok) {
            const authorData = await authorResponse.json();
            if (authorData.data?.[0]) {
              reminderData.author = authorData.data[0];
            }
          }
        } catch (error) {
          console.error("Error obteniendo autor para recordatorio actualizado:", error);
        }
      }
      
      return NextResponse.json({ data: reminderData });
    }

    // Fallback: retornar datos básicos
    return NextResponse.json({ data: updatedReminder.data });
  } catch (error) {
    console.error("Error updating fleet reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar un recordatorio
export async function DELETE(_: Request, context: RouteContext) {
  try {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const params = await context.params;
    const { reminderId } = params;

    if (!reminderId) {
      return NextResponse.json(
        { error: "reminderId es requerido" },
        { status: 400 }
      );
    }

    const deleteResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-reminders/${reminderId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${deleteResponse.status}` } };
      }
      console.error("Error eliminando recordatorio en Strapi:", {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorData,
        reminderId,
      });
      
      // Si es 404, el tipo de contenido o el recordatorio no existe
      if (deleteResponse.status === 404) {
        throw new Error("El recordatorio no fue encontrado o el tipo de contenido 'fleet-reminders' no existe en Strapi.");
      }
      
      throw new Error(errorData.error?.message || `Error ${deleteResponse.status}: ${deleteResponse.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fleet reminder:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
