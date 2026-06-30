// TURBOCACHE_INVALIDATION_1743135600
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { logger } from "@/lib/logger";
import {
  dedupeReminders,
  isIndividualReminderNotification,
} from "@/lib/notifications/notification-dedup";
import qs from "qs";

// Función helper para obtener el user-profile del usuario actual
async function getCurrentUserProfile() {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      return null;
    }

    const userResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      return null;
    }

    const userData = await userResponse.json();
    const userId = userData?.id;

    if (!userId) {
      return null;
    }

    const profileQuery = qs.stringify({
      filters: {
        email: { $eq: userData.email },
      },
      fields: ["id", "documentId", "displayName", "email", "role"],
    });

    const profileResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${profileQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      return null;
    }

    const profileData = await profileResponse.json();
    const profile = profileData.data?.[0];

    if (!profile || !profile.documentId) {
      return null;
    }

    return {
      // ID numérico del USER-PROFILE (no del usuario de auth). Las relaciones
      // `recipient`/`author` apuntan a user-profile, así que este es el id que
      // hay que usar para filtrar; el id de auth (userData.id) vive en otro espacio.
      id: profile.id,
      authUserId: userData.id, // id del usuario de auth (/api/users/me), por si se necesita
      documentId: profile.documentId,
      displayName: profile.displayName || profile.email || "Usuario",
      email: profile.email,
      role: profile.role,
    };
  } catch (error) {
    logger.error({ err: error }, "Error obtaining current user-profile for notifications");
    return null;
  }
}

// GET - Obtener notificaciones del usuario logueado
export async function GET() {
  try {
    const currentUser = await getCurrentUserProfile();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    logger.debug(
      { id: currentUser.id, documentId: currentUser.documentId, role: currentUser.role },
      "notifications: authenticated user"
    );

    // Audiencia broadcast que le corresponde al rol del usuario. Alineado con
    // `audienceMatchesClient` del SSE (backend event-hub): admin/super-admin →
    // "admins"; cualquier otro rol → "drivers".
    const userRoleAudience =
      currentUser.role === "admin" || currentUser.role === "super-admin" ? "admins" : "drivers";

    // SOLUCIÓN 1: traer notificaciones broadcast y filtrar duplicados en el front;
    // evita duplicar N notificaciones en BD.
    // targetAudience es un campo string (NO relación), así que `$in` es seguro y
    // no dispara el error 500 de Strapi v5 con `$or` sobre relaciones.
    const notificationQuery = qs.stringify({
      filters: {
        // Traer broadcasts "all" + las dirigidas al rol del usuario ("admins"/"drivers").
        targetAudience: { $in: ["all", userRoleAudience] },
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
        "module",
        "tags",
        "reminderType",
        "scheduledDate",
        "recurrencePattern",
        "recurrenceEndDate",
        "isActive",
        "isCompleted",
        "lastTriggered",
        "nextTrigger",
        "authorDocumentId",
        "durationDays",
        "isPinned",
        "expiresAt",
        "isDismissible",
        "targetAudience",
      ],
      populate: {
        recipient: {
          fields: ["id", "documentId", "displayName", "email"],
        },
        assignedUsers: {
          fields: ["id", "documentId", "displayName", "email"],
          populate: {
            avatar: {
              fields: ["url", "alternativeText"],
            },
          },
        },
        fleetVehicle: {
          fields: ["id", "documentId", "name"],
          populate: {
            responsables: {
              fields: ["id", "documentId", "displayName", "email"],
            },
            assignedDrivers: {
              fields: ["id", "documentId", "displayName", "email"],
            },
          },
        },
        author: {
          fields: ["id", "documentId", "displayName", "email"],
          populate: {
            avatar: {
              fields: ["url", "alternativeText"],
            },
          },
        },
        // Mantener fleetReminder para compatibilidad con código legacy
        fleetReminder: {
          fields: [
            "id",
            "documentId",
            "title",
            "description",
            "isActive",
            "isCompleted",
            "nextTrigger",
          ],
          populate: {
            vehicle: {
              fields: ["id", "documentId", "name"],
            },
          },
        },
      },
      sort: ["timestamp:desc"],
      pagination: {
        pageSize: 100,
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
      throw new Error(`Error obteniendo notificaciones: ${errorText || response.statusText}`);
    }

    const data = await response.json();

    // Segunda consulta: notificaciones dirigidas específicamente al usuario actual
    // (incluye oil_change_reminder y otras notificaciones individuales)
    const recipientQuery = qs.stringify({
      filters: {
        recipient: {
          id: {
            $eq: currentUser.id,
          },
        },
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
        "module",
        "tags",
        "reminderType",
        "scheduledDate",
        "recurrencePattern",
        "recurrenceEndDate",
        "isActive",
        "isCompleted",
        "lastTriggered",
        "nextTrigger",
        "authorDocumentId",
        "durationDays",
        "isPinned",
        "expiresAt",
        "isDismissible",
        "targetAudience",
      ],
      populate: {
        recipient: {
          fields: ["id", "documentId", "displayName", "email"],
        },
        assignedUsers: {
          fields: ["id", "documentId", "displayName", "email"],
          populate: {
            avatar: {
              fields: ["url", "alternativeText"],
            },
          },
        },
        fleetVehicle: {
          fields: ["id", "documentId", "name"],
          populate: {
            responsables: {
              fields: ["id", "documentId", "displayName", "email"],
            },
            assignedDrivers: {
              fields: ["id", "documentId", "displayName", "email"],
            },
          },
        },
        author: {
          fields: ["id", "documentId", "displayName", "email"],
          populate: {
            avatar: {
              fields: ["url", "alternativeText"],
            },
          },
        },
        fleetReminder: {
          fields: [
            "id",
            "documentId",
            "title",
            "description",
            "isActive",
            "isCompleted",
            "nextTrigger",
          ],
          populate: {
            vehicle: {
              fields: ["id", "documentId", "name"],
            },
          },
        },
      },
      sort: ["timestamp:desc"],
      pagination: {
        pageSize: 100,
      },
    });

    let recipientData: any = { data: [] };
    try {
      const recipientResponse = await fetch(
        `${STRAPI_BASE_URL}/api/notifications?${recipientQuery}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        }
      );
      if (recipientResponse.ok) {
        recipientData = await recipientResponse.json();
      }
    } catch (err) {
      logger.error({ err }, "notifications: error obtaining recipient-specific notifications");
    }

    // Fusionar ambas listas y eliminar duplicados exactos por ID
    const mergedMap = new Map<string | number, any>();
    for (const notification of [...(data.data || []), ...(recipientData.data || [])]) {
      if (!mergedMap.has(notification.id)) {
        mergedMap.set(notification.id, notification);
      }
    }
    const mergedData = Array.from(mergedMap.values());

    // Detectar notificaciones individuales de broadcast (creadas cuando un usuario marca como leída una broadcast)
    // y construir un mapa para proyectar el estado isRead sobre la notificación original
    const broadcastReadMap = new Map<string | number, boolean>();
    (mergedData || []).forEach((notification: any) => {
      try {
        const tags =
          typeof notification.tags === "string" ? JSON.parse(notification.tags) : notification.tags;
        if (tags?.parentBroadcastId) {
          broadcastReadMap.set(tags.parentBroadcastId, notification.isRead);
        }
      } catch {
        // Ignorar errores parseando tags
      }
    });

    // Separar notificaciones manuales de recordatorios
    // IMPORTANTE: Las notificaciones manuales con type='reminder' (sin reminderType ni module)
    // deben tratarse como notificaciones manuales, no como recordatorios
    const manualNotifications = (mergedData || []).filter((notification: any) => {
      // Si no es tipo reminder, es manual
      if (notification.type !== "reminder") {
        return true;
      }
      // Si es tipo reminder pero NO tiene reminderType ni module, es una notificación manual
      // (simplemente usa 'reminder' como categoría, no es un recordatorio completo)
      const hasReminderType =
        notification.reminderType &&
        typeof notification.reminderType === "string" &&
        notification.reminderType.trim() !== "";
      const hasModule =
        notification.module &&
        typeof notification.module === "string" &&
        notification.module.trim() !== "";
      return !hasReminderType && !hasModule;
    });

    // Los recordatorios completos son los que tienen type='reminder' Y (reminderType o module)
    const allReminders = (mergedData || []).filter((notification: any) => {
      if (notification.type !== "reminder") {
        return false;
      }
      const hasReminderType =
        notification.reminderType &&
        typeof notification.reminderType === "string" &&
        notification.reminderType.trim() !== "";
      const hasModule =
        notification.module &&
        typeof notification.module === "string" &&
        notification.module.trim() !== "";
      return hasReminderType || hasModule;
    });

    // Filtrar recordatorios: excluir notificaciones individuales y filtrar por usuario
    // Filtrar notificaciones individuales que tienen parentReminderId en tags
    // Estas son las notificaciones creadas por syncReminderNotifications para usuarios asignados
    // Solo queremos mostrar el recordatorio principal, no las notificaciones individuales
    const filteredReminders = allReminders.filter(
      (reminder: any) => !isIndividualReminderNotification(reminder)
    );

    // Filtrar recordatorios que pertenecen al usuario actual:
    // 1. Tengan al usuario actual en assignedUsers, O
    // 2. El usuario actual sea el autor (authorDocumentId), O
    // 3. El usuario actual sea responsable del vehículo, O
    // 4. El usuario actual sea conductor anterior del vehículo
    // IMPORTANTE: Incluir TODOS los recordatorios (completados y no completados) para que aparezcan en la pestaña "completed"
    const userReminders = filteredReminders.filter((reminder: any) => {
      // Verificar si el usuario actual es el autor del recordatorio
      const isAuthor = reminder.authorDocumentId === currentUser.documentId;

      // Verificar si el usuario actual está en la lista de usuarios asignados
      const isAssigned = reminder.assignedUsers?.some(
        (user: any) => user?.documentId === currentUser.documentId
      );

      // Verificar si el usuario actual es responsable del vehículo
      const isResponsable = reminder.fleetVehicle?.responsables?.some(
        (resp: any) => resp?.documentId === currentUser.documentId
      );

      // Verificar si el usuario actual es conductor anterior del vehículo
      const isAssignedDriver = reminder.fleetVehicle?.assignedDrivers?.some(
        (driver: any) => driver?.documentId === currentUser.documentId
      );

      const shouldInclude = isAuthor || isAssigned || isResponsable || isAssignedDriver;

      return shouldInclude;
    });

    // Filtrar notificaciones manuales: incluir solo las que pertenecen al usuario actual
    // Excluir notificaciones individuales de recordatorios (tienen parentReminderId en tags)
    const filteredManualNotifications = manualNotifications.filter((notification: any) => {
      // Verificar si es una notificación broadcast (sin recipient específico)
      const hasRecipient = notification.recipient !== null && notification.recipient !== undefined;
      const hasTargetAudience =
        notification.targetAudience !== null &&
        notification.targetAudience !== undefined &&
        notification.targetAudience !== "";

      // Si tiene recipient, verificar que sea el usuario actual
      if (hasRecipient) {
        const recipientDocId =
          typeof notification.recipient === "object" ? notification.recipient.documentId : null;
        if (recipientDocId !== currentUser.documentId) {
          return false;
        }
      }

      // Si no tiene recipient pero tiene targetAudience, verificar que coincida con el rol del usuario
      // (reusa `userRoleAudience`, ya alineado con la lógica de audiencias del SSE).
      if (!hasRecipient && hasTargetAudience) {
        if (
          notification.targetAudience !== userRoleAudience &&
          notification.targetAudience !== "all"
        ) {
          return false;
        }
      }

      // Si no tiene recipient ni targetAudience, es una notificación creada desde admin
      // Se considera broadcast para todos (permitir)

      // Excluir notificaciones individuales de recordatorios (tienen parentReminderId en tags)
      try {
        const tags =
          typeof notification.tags === "string" ? JSON.parse(notification.tags) : notification.tags;
        if (tags && tags.parentReminderId !== undefined && tags.parentReminderId !== null) {
          return false; // Es una notificación individual de recordatorio
        }
        if (tags && tags.parentBroadcastId !== undefined && tags.parentBroadcastId !== null) {
          return false; // Es una notificación individual de broadcast (lectura de broadcast)
        }
      } catch {
        // Si hay error parseando tags, continuar
      }

      return true;
    });

    // Combinar notificaciones manuales filtradas con recordatorios filtrados
    const filteredNotifications = [...filteredManualNotifications, ...userReminders];

    // Proyectar estado de lectura de broadcasts: si existe una notificación individual de lectura
    // para este usuario, la notificación broadcast original debe aparecer como leída
    filteredNotifications.forEach((notification: any) => {
      const broadcastId = notification.documentId || notification.id;
      if (broadcastReadMap.has(broadcastId)) {
        notification.isRead = broadcastReadMap.get(broadcastId);
      }
    });

    // Colapsar recordatorios duplicados (mismo título + vehículo) manteniendo el
    // más reciente; las notificaciones no-recordatorio pasan sin cambios.
    const uniqueNotifications = dedupeReminders(filteredNotifications);

    logger.debug(
      {
        afterFilter: filteredNotifications.length,
        afterDedup: uniqueNotifications.length,
        removed: filteredNotifications.length - uniqueNotifications.length,
      },
      "notifications deduplication summary"
    );

    return NextResponse.json({ data: uniqueNotifications });
  } catch (error) {
    logger.error({ err: error }, "Error obtaining notifications");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST - Crear notificaciones
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUserProfile();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Todos los roles pueden crear notificaciones (admin, driver)
    // Pero solo los admins pueden fijar notificaciones

    const body = await request.json();
    const { title, description, type, recipientType, recipientId } = body;

    if (!title || !type || !recipientType) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: title, type, recipientType" },
        { status: 400 }
      );
    }

    // Calcular duración y fechas
    const { durationDays = 7, isPinned = false } = body;
    const timestamp = new Date().toISOString();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (durationDays || 7));

    // Solo los administradores pueden fijar notificaciones
    const shouldPin = isPinned && currentUser.role === "admin";

    // SOLUCIÓN 1: Usar targetAudience para evitar duplicados en BD
    // Solo crear notificación individual si es "specific", de lo contrario usar targetAudience

    if (recipientType === "specific" && recipientId) {
      // Usuario específico - crear notificación con recipient
      const userQuery = qs.stringify({
        filters: {
          documentId: { $eq: recipientId },
        },
        fields: ["id"],
      });

      const userResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${userQuery}`, {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (!userResponse.ok || !userResponse.body) {
        return NextResponse.json({ error: "No se encontró el destinatario" }, { status: 400 });
      }

      const userData = await userResponse.json();
      const recipientUserId = userData.data?.[0]?.id;

      if (!recipientUserId) {
        return NextResponse.json({ error: "No se encontró el destinatario" }, { status: 400 });
      }

      // Crear notificación individual
      const notificationData = {
        title,
        description: description || null,
        type,
        isRead: false,
        timestamp,
        recipient: recipientUserId,
        durationDays: shouldPin ? null : durationDays || 7,
        isPinned: shouldPin,
        expiresAt: shouldPin ? null : expiresAt.toISOString(),
        isDismissible: !shouldPin,
        author: { connect: [{ documentId: currentUser.documentId }] }, // Strapi 5: relación por documentId
        authorDocumentId: currentUser.documentId, // documentId para referencia
      };

      const createResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: notificationData }),
        cache: "no-store",
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        logger.error({ errorText }, "Error creating notification");
        return NextResponse.json({ error: "Error al crear notificación" }, { status: 500 });
      }

      const result = await createResponse.json();

      return NextResponse.json({
        success: true,
        message: "Notificación creada exitosamente",
        data: result,
      });
    } else {
      // Para grupos (all_admins, all_drivers): usar targetAudience
      // Esto crea UNA sola notificación en BD, no N duplicadas

      const targetAudience =
        recipientType === "all_admins"
          ? "admins"
          : recipientType === "all_drivers"
            ? "drivers"
            : "all";

      const notificationData = {
        title,
        description: description || null,
        type,
        isRead: false,
        timestamp,
        targetAudience, // ← Usar targetAudience en lugar de recipient
        durationDays: shouldPin ? null : durationDays || 7,
        isPinned: shouldPin,
        expiresAt: shouldPin ? null : expiresAt.toISOString(),
        isDismissible: !shouldPin,
        author: { connect: [{ documentId: currentUser.documentId }] }, // Strapi 5: relación por documentId
        authorDocumentId: currentUser.documentId, // documentId para referencia
        // No incluir recipient - es broadcast
      };

      logger.debug(
        { type, targetAudience, title },
        "notifications: creating broadcast notification"
      );

      const createResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: notificationData }),
        cache: "no-store",
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        logger.error({ errorText }, "Error creating broadcast notification");
        return NextResponse.json({ error: "Error al crear notificación" }, { status: 500 });
      }

      const result = await createResponse.json();

      return NextResponse.json({
        success: true,
        message: `Notificación creada para ${targetAudience}`,
        data: result,
      });
    }
  } catch (error) {
    logger.error({ err: error }, "Error creating notifications");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// CACHE_INVALIDATION_$(date +%s)
// FORCE_REBUILD
export const dynamic = "force-dynamic";
