import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  dedupeReminders,
  isIndividualReminderNotification,
} from "@/lib/notifications/notification-dedup";
import qs from "qs";

// Helper para obtener el user-profile del usuario actual.
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
      fields: ["documentId", "displayName", "email"],
      populate: {
        avatar: {
          fields: ["url", "alternativeText"],
        },
      },
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
      documentId: profile.documentId,
      displayName: profile.displayName || profile.email || "Usuario",
      email: profile.email,
      avatar: profile.avatar,
    };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ECONNREFUSED") {
      logger.error({ baseUrl: STRAPI_BASE_URL }, "Strapi is not reachable while loading reminders");
    } else {
      logger.error({ err: error }, "Error obtaining current user-profile for reminders");
    }
    return null;
  }
}

// GET - Obtener los recordatorios del usuario logueado
export async function GET() {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    const currentUser = await getCurrentUserProfile();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Obtener todos los recordatorios (notificaciones con type='reminder') y
    // filtrarlos por usuario en el código (el filtro $or con relaciones falla en
    // Strapi v5).
    const reminderQuery = qs.stringify({
      filters: {
        type: { $eq: "reminder" },
      },
      fields: [
        "id",
        "documentId",
        "title",
        "description",
        "reminderType",
        "scheduledDate",
        "recurrencePattern",
        "recurrenceEndDate",
        "isActive",
        "isCompleted",
        "lastTriggered",
        "nextTrigger",
        "authorDocumentId",
        "createdAt",
        "updatedAt",
        "module",
        "tags",
      ],
      populate: {
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
        assignedUsers: {
          fields: ["id", "documentId", "displayName", "email"],
          populate: {
            avatar: {
              fields: ["url", "alternativeText"],
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
      },
      sort: ["nextTrigger:asc"],
      pagination: {
        pageSize: 50,
      },
    });

    const reminderResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications?${reminderQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!reminderResponse.ok) {
      if (reminderResponse.status === 404) {
        logger.warn("notifications content-type not found in Strapi; returning empty reminders");
        return NextResponse.json({ data: [] });
      }

      const errorText = await reminderResponse.text();
      throw new Error(
        `No se pudieron obtener los recordatorios: ${errorText || reminderResponse.statusText}`
      );
    }

    const reminderData = await reminderResponse.json();

    // Excluir notificaciones individuales de recordatorios (tienen recipient o
    // parentReminderId en tags); solo queremos el recordatorio principal.
    const filteredReminders = (reminderData.data || []).filter((reminder: any) => {
      if (reminder.type === "reminder" && isIndividualReminderNotification(reminder)) {
        return false;
      }
      return true;
    });

    // Filtrar recordatorios del usuario actual (autor, asignado, responsable o
    // conductor del vehículo), excluyendo los completados.
    const userReminders = filteredReminders.filter((reminder: any) => {
      if (reminder.isCompleted === true || reminder.isCompleted === 1) {
        return false;
      }

      const isAuthor = reminder.authorDocumentId === currentUser.documentId;
      const isAssigned = reminder.assignedUsers?.some(
        (user: any) => user?.documentId === currentUser.documentId
      );
      const isResponsable = reminder.fleetVehicle?.responsables?.some(
        (resp: any) => resp?.documentId === currentUser.documentId
      );
      const isAssignedDriver = reminder.fleetVehicle?.assignedDrivers?.some(
        (driver: any) => driver?.documentId === currentUser.documentId
      );

      return isAuthor || isAssigned || isResponsable || isAssignedDriver;
    });

    const uniqueReminders = dedupeReminders(userReminders);

    logger.debug(
      {
        afterFilter: userReminders.length,
        afterDedup: uniqueReminders.length,
        removed: userReminders.length - uniqueReminders.length,
      },
      "reminders deduplication summary"
    );

    // Completar el autor de cada recordatorio cuando solo tenemos authorDocumentId.
    const remindersWithAuthor = await Promise.all(
      uniqueReminders.map(async (reminder: any) => {
        if (!reminder.author && reminder.authorDocumentId) {
          try {
            const authorQuery = qs.stringify({
              filters: {
                documentId: { $eq: reminder.authorDocumentId },
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
                reminder.author = authorData.data[0];
              }
            }
          } catch (error) {
            logger.error({ err: error }, "Error obtaining author for reminder");
          }
        }

        // Mapear fleetVehicle a vehicle para compatibilidad con código existente.
        if (reminder.fleetVehicle) {
          reminder.vehicle = reminder.fleetVehicle;
        }

        return reminder;
      })
    );

    return NextResponse.json({ data: remindersWithAuthor });
  } catch (error) {
    logger.error({ err: error }, "Error obtaining reminders");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
