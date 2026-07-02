import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";
import { requireModulePermission } from "@/lib/module-guard";

interface RouteContext {
  params: Promise<{
    notificationId: string;
  }>;
}

// PUT - Actualizar una notificación/recordatorio (campos genéricos como isCompleted, isActive, etc.)
export async function PUT(request: Request, context: RouteContext) {
  let notificationId: string | undefined;
  try {
    try {
      await requireModulePermission("notifications", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const jwt = await getCurrentUserJwt();
    const params = await context.params;
    notificationId = params.notificationId;

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId es requerido" }, { status: 400 });
    }

    const body = await request.json();
    const data = body?.data;

    if (!data || typeof data !== "object") {
      return NextResponse.json(
        {
          error:
            "El cuerpo de la petición debe incluir un objeto 'data' con los campos a actualizar",
        },
        { status: 400 }
      );
    }

    // Buscar la notificación por documentId o ID numérico
    let idToUpdate: string | null = null;

    // Si es numérico, usar directamente
    if (/^\d+$/.test(notificationId)) {
      idToUpdate = notificationId;
      console.log("✅ ID numérico detectado, usando directamente:", {
        notificationId,
        idToUpdate,
      });

      // Verificar que la notificación existe antes de intentar actualizar
      try {
        const verifyQuery = qs.stringify({
          filters: {
            id: { $eq: parseInt(notificationId, 10) },
          },
          fields: ["id", "documentId", "type", "tags"],
        });

        const verifyResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications?${verifyQuery}`, {
          headers: {
            Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (verifyResponse.ok) {
          const verifyData = await verifyResponse.json();
          if (verifyData.data && verifyData.data.length > 0) {
            const foundNotification = verifyData.data[0];
            console.log("✅ Notificación verificada:", {
              id: foundNotification.id,
              documentId: foundNotification.documentId,
              type: foundNotification.type,
            });

            // Verificar si es una notificación individual (con parentReminderId)
            try {
              const tags =
                typeof foundNotification.tags === "string"
                  ? JSON.parse(foundNotification.tags)
                  : foundNotification.tags;
              if (tags?.parentReminderId) {
                console.log(
                  "⚠️ Es una notificación individual, redirigiendo al recordatorio principal:",
                  {
                    parentReminderId: tags.parentReminderId,
                  }
                );
                // Redirigir al recordatorio principal
                const parentId =
                  typeof tags.parentReminderId === "number"
                    ? tags.parentReminderId
                    : parseInt(String(tags.parentReminderId), 10);
                if (!isNaN(parentId)) {
                  idToUpdate = String(parentId);
                  console.log("✅ Redirigido al recordatorio principal:", idToUpdate);
                }
              }
            } catch {
              // Ignorar errores parseando tags
            }
          } else {
            console.error("❌ Notificación no encontrada en Strapi con ID:", notificationId);
            return NextResponse.json(
              {
                error: "Notificación no encontrada",
                message: `No se encontró la notificación con ID: ${notificationId}. Puede haber sido eliminada.`,
              },
              { status: 404 }
            );
          }
        } else {
          console.error("❌ Error verificando notificación:", {
            status: verifyResponse.status,
            statusText: verifyResponse.statusText,
          });
        }
      } catch (verifyError) {
        console.error("❌ Error al verificar notificación:", verifyError);
      }
    } else {
      // Buscar por documentId - intentar primero con GET directo usando documentId como parámetro
      // Strapi puede soportar documentId directamente en la ruta
      let found: any = null;

      // Intentar GET directo con documentId
      try {
        const directGetResponse = await fetch(
          `${STRAPI_BASE_URL}/api/notifications/${notificationId}`,
          {
            headers: {
              Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        if (directGetResponse.ok) {
          const directGetData = await directGetResponse.json();
          if (directGetData.data) {
            found = directGetData.data;
            console.log("✅ Notificación encontrada con GET directo por documentId:", {
              documentId: notificationId,
              id: found.id,
            });
          }
        } else if (directGetResponse.status !== 404) {
          console.warn("GET directo falló con status:", directGetResponse.status);
        }
      } catch (directGetError) {
        console.warn(
          "Error en GET directo por documentId, intentando búsqueda con filtro:",
          directGetError
        );
      }

      // Si no se encontró con GET directo, intentar búsqueda con filtro
      if (!found) {
        try {
          const directSearchQuery = qs.stringify({
            filters: {
              documentId: { $eq: notificationId },
            },
            fields: ["id", "documentId", "tags", "type"],
          });

          const directSearchResponse = await fetch(
            `${STRAPI_BASE_URL}/api/notifications?${directSearchQuery}`,
            {
              headers: {
                Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              cache: "no-store",
            }
          );

          if (directSearchResponse.ok) {
            const directSearchData = await directSearchResponse.json();
            if (directSearchData.data && directSearchData.data.length > 0) {
              found = directSearchData.data[0];
              console.log("✅ Notificación encontrada con filtro por documentId:", {
                documentId: notificationId,
                id: found.id,
              });
            } else {
              console.warn("⚠️ Filtro por documentId no devolvió resultados:", {
                documentId: notificationId,
                responseData: directSearchData,
              });
            }
          } else {
            console.warn("⚠️ Búsqueda con filtro falló con status:", directSearchResponse.status);
          }
        } catch (directSearchError) {
          console.warn(
            "Error en búsqueda directa por documentId, intentando búsqueda manual:",
            directSearchError
          );
        }
      }

      // Si no se encontró con búsqueda directa, buscar manualmente
      let allNotifications: any[] = []; // Declarar fuera del if para poder usarlo después

      if (!found) {
        console.log("🔍 Iniciando búsqueda manual por documentId:", notificationId);
        // Buscar en todas las notificaciones (aumentar pageSize o buscar en múltiples páginas)
        let page = 1;
        const pageSize = 250; // Aumentar el tamaño de página
        let hasMore = true;
        let totalSearched = 0;

        while (hasMore && page <= 5) {
          // Buscar en máximo 5 páginas (1250 notificaciones)
          const searchQuery = qs.stringify({
            fields: ["id", "documentId", "tags", "type"],
            pagination: {
              page,
              pageSize,
            },
          });

          const searchResponse = await fetch(
            `${STRAPI_BASE_URL}/api/notifications?${searchQuery}`,
            {
              headers: {
                Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
                "Content-Type": "application/json",
              },
              cache: "no-store",
            }
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const notifications = searchData.data || [];
            allNotifications = allNotifications.concat(notifications);
            totalSearched += notifications.length;

            // Buscar en esta página
            found = notifications.find((n: any) => n.documentId === notificationId);

            if (found) {
              console.log("✅ Notificación encontrada en búsqueda manual:", {
                documentId: notificationId,
                id: found.id,
                page,
                totalSearched,
              });
            }

            // Si encontramos o no hay más resultados, salir del loop
            if (found || notifications.length < pageSize) {
              hasMore = false;
            } else {
              page++;
            }
          } else {
            console.warn(
              "⚠️ Error en búsqueda manual, página:",
              page,
              "status:",
              searchResponse.status
            );
            hasMore = false;
          }
        }

        // Si aún no se encontró, buscar en todas las notificaciones acumuladas
        if (!found) {
          found = allNotifications.find((n: any) => n.documentId === notificationId);
          if (found) {
            console.log("✅ Notificación encontrada en notificaciones acumuladas:", {
              documentId: notificationId,
              id: found.id,
              totalSearched: allNotifications.length,
            });
          } else {
            console.error("❌ Notificación NO encontrada después de buscar:", {
              documentId: notificationId,
              totalSearched: allNotifications.length,
              sampleDocumentIds: allNotifications.slice(0, 5).map((n: any) => n.documentId),
            });
          }
        }
      }

      if (found && found.id) {
        // Verificar si es notificación individual (con parentReminderId)
        try {
          const tags = typeof found.tags === "string" ? JSON.parse(found.tags) : found.tags;
          if (tags?.parentReminderId) {
            // Es una notificación individual - buscar el recordatorio principal
            const parentId =
              typeof tags.parentReminderId === "number"
                ? tags.parentReminderId
                : parseInt(String(tags.parentReminderId), 10);

            if (!isNaN(parentId)) {
              // Usar el ID numérico del recordatorio principal
              idToUpdate = String(parentId);
            } else {
              // Si no es numérico, buscar por documentId
              // Si tenemos allNotifications, buscar ahí, sino hacer otra búsqueda
              let parentReminder: any = null;

              if (allNotifications.length > 0) {
                parentReminder = allNotifications.find(
                  (n: any) =>
                    n.documentId === tags.parentReminderId ||
                    String(n.id) === String(tags.parentReminderId)
                );
              }

              // Si no se encontró en allNotifications, hacer búsqueda directa
              if (!parentReminder) {
                try {
                  const parentSearchQuery = qs.stringify({
                    filters: {
                      $or: [
                        { documentId: { $eq: tags.parentReminderId } },
                        { id: { $eq: parseInt(String(tags.parentReminderId), 10) } },
                      ],
                    },
                    fields: ["id"],
                  });

                  const parentSearchResponse = await fetch(
                    `${STRAPI_BASE_URL}/api/notifications?${parentSearchQuery}`,
                    {
                      headers: {
                        Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
                        "Content-Type": "application/json",
                      },
                      cache: "no-store",
                    }
                  );

                  if (parentSearchResponse.ok) {
                    const parentSearchData = await parentSearchResponse.json();
                    if (parentSearchData.data && parentSearchData.data.length > 0) {
                      parentReminder = parentSearchData.data[0];
                    }
                  }
                } catch {
                  // Ignorar errores en búsqueda del parent
                }
              }

              if (parentReminder && parentReminder.id) {
                idToUpdate = String(parentReminder.id);
              } else {
                idToUpdate = String(found.id);
              }
            }
          } else {
            // Es un recordatorio principal - usar su ID directamente
            idToUpdate = String(found.id);
          }
        } catch {
          // Si hay error parseando tags, usar el ID encontrado
          idToUpdate = String(found.id);
        }
      }
    }

    if (!idToUpdate) {
      console.error("No se pudo encontrar el ID numérico para actualizar:", {
        notificationId,
        isNumeric: /^\d+$/.test(notificationId),
      });
      return NextResponse.json(
        {
          error: "Notificación no encontrada",
          message: `No se pudo encontrar la notificación con ID: ${notificationId}. Puede haber sido eliminada o el ID es inválido.`,
        },
        { status: 404 }
      );
    }

    // Obtener el recordatorio actual para incluir responsables/conductores si es necesario
    const currentReminderQuery = qs.stringify({
      filters: {
        id: { $eq: parseInt(idToUpdate, 10) },
      },
      fields: ["id", "type", "module", "fleetVehicle"],
      populate: {
        fleetVehicle: {
          fields: ["id"],
          populate: {
            responsables: { fields: ["id"] },
            assignedDrivers: { fields: ["id"] },
          },
        },
      },
    });

    const currentReminderResponse = await fetch(
      `${STRAPI_BASE_URL}/api/notifications?${currentReminderQuery}`,
      {
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    // Si es un recordatorio de tipo fleet y se están actualizando assignedUsers, incluir responsables y conductores
    if (currentReminderResponse.ok && data.assignedUsers !== undefined) {
      const currentReminderData = await currentReminderResponse.json();
      const reminder = currentReminderData.data?.[0];

      if (
        reminder &&
        reminder.type === "reminder" &&
        reminder.module === "fleet" &&
        reminder.fleetVehicle
      ) {
        const vehicle = reminder.fleetVehicle;
        const allAssignedUserIds = new Set<number>();

        // 1. Agregar usuarios seleccionados manualmente
        if (Array.isArray(data.assignedUsers)) {
          data.assignedUsers.forEach((id: any) => {
            const numId = typeof id === "string" ? parseInt(id, 10) : id;
            if (!isNaN(numId)) {
              allAssignedUserIds.add(numId);
            }
          });
        }

        // 2. Agregar responsables del vehículo automáticamente
        if (vehicle.responsables && Array.isArray(vehicle.responsables)) {
          vehicle.responsables.forEach((resp: any) => {
            if (resp.id) {
              allAssignedUserIds.add(resp.id);
            }
          });
        }

        // 3. Agregar conductores anteriores del vehículo automáticamente
        if (vehicle.assignedDrivers && Array.isArray(vehicle.assignedDrivers)) {
          vehicle.assignedDrivers.forEach((driver: any) => {
            if (driver.id) {
              allAssignedUserIds.add(driver.id);
            }
          });
        }

        // Actualizar data.assignedUsers con la lista combinada
        if (allAssignedUserIds.size > 0) {
          data.assignedUsers = Array.from(allAssignedUserIds);
        }
      }
    }

    // Verificar que la notificación existe antes de actualizar
    console.log("🔍 Verificando que la notificación existe antes de actualizar:", {
      notificationId,
      idToUpdate,
    });

    const verifyBeforeUpdateQuery = qs.stringify({
      filters: {
        id: { $eq: parseInt(idToUpdate, 10) },
      },
      fields: ["id", "documentId", "type"],
    });

    const verifyBeforeUpdateResponse = await fetch(
      `${STRAPI_BASE_URL}/api/notifications?${verifyBeforeUpdateQuery}`,
      {
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!verifyBeforeUpdateResponse.ok) {
      console.error("❌ Error verificando notificación antes de actualizar:", {
        status: verifyBeforeUpdateResponse.status,
        statusText: verifyBeforeUpdateResponse.statusText,
        idToUpdate,
      });
      return NextResponse.json(
        {
          error: "Error al verificar la notificación",
          message: `No se pudo verificar la notificación con ID: ${idToUpdate}`,
        },
        { status: verifyBeforeUpdateResponse.status }
      );
    }

    const verifyData = await verifyBeforeUpdateResponse.json();
    if (!verifyData.data || verifyData.data.length === 0) {
      console.error("❌ Notificación no encontrada antes de actualizar:", {
        idToUpdate,
        notificationId,
      });
      return NextResponse.json(
        {
          error: "Notificación no encontrada",
          message: `La notificación con ID: ${idToUpdate} no existe. Puede haber sido eliminada.`,
        },
        { status: 404 }
      );
    }

    const verifiedNotification = verifyData.data[0];
    console.log("✅ Notificación verificada, procediendo a actualizar:", {
      id: verifiedNotification.id,
      documentId: verifiedNotification.documentId,
      type: verifiedNotification.type,
    });

    // En Strapi v5, intentar usar documentId primero, luego ID numérico como fallback
    const identifierToUse = verifiedNotification.documentId || idToUpdate;

    // ACTUALIZAR usando documentId (preferido en Strapi v5) o ID numérico como fallback
    console.log("🔄 Intentando actualizar notificación en Strapi:", {
      notificationId,
      idToUpdate,
      identifierToUse,
      usingDocumentId: !!verifiedNotification.documentId,
      dataKeys: Object.keys(data),
      data,
    });

    const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications/${identifierToUse}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
      cache: "no-store",
    });

    console.log("📡 Respuesta de Strapi:", {
      status: updateResponse.status,
      statusText: updateResponse.statusText,
      ok: updateResponse.ok,
      idToUpdate,
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      let errorData: any;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = {
          error: {
            message: errorText || `Error ${updateResponse.status}: ${updateResponse.statusText}`,
          },
        };
      }

      // Verificar si es un error de conexión
      if (updateResponse.status === 404 && !errorText) {
        console.error(
          "❌ Error 404: Posible problema de conexión con Strapi o notificación no encontrada:",
          {
            status: updateResponse.status,
            notificationId,
            idToUpdate,
            identifierToUse,
            url: `${STRAPI_BASE_URL}/api/notifications/${identifierToUse}`,
            suggestion: "Verifica que Strapi esté corriendo en " + STRAPI_BASE_URL,
          }
        );
      } else {
        console.error("❌ Error actualizando notificación en Strapi:", {
          status: updateResponse.status,
          statusText: updateResponse.statusText,
          error: errorData,
          errorText,
          notificationId,
          idToUpdate,
          identifierToUse,
          url: `${STRAPI_BASE_URL}/api/notifications/${identifierToUse}`,
        });
      }

      if (updateResponse.status === 404) {
        return NextResponse.json(
          {
            error: "La notificación no fue encontrada",
            message: "La notificación puede haber sido eliminada o el ID es inválido.",
          },
          { status: 404 }
        );
      }

      const errorMessage =
        errorData.error?.message ||
        errorData.message ||
        `Error ${updateResponse.status}: ${updateResponse.statusText}`;
      return NextResponse.json(
        {
          error: errorMessage,
          message: errorMessage,
        },
        { status: updateResponse.status }
      );
    }

    const updatedNotification = await updateResponse.json();

    return NextResponse.json({
      success: true,
      data: updatedNotification.data,
    });
  } catch (error) {
    // Verificar si es un error de conexión
    const isConnectionError =
      error instanceof Error &&
      (("code" in error && (error as any).code === "ECONNREFUSED") ||
        (typeof error.message === "string" && error.message.includes("fetch failed")));

    if (isConnectionError) {
      console.error("❌ Error de conexión con Strapi:", {
        notificationId,
        error,
        suggestion:
          "Verifica que Strapi esté corriendo en " +
          STRAPI_BASE_URL +
          " (cd backend && npm run develop)",
      });

      return NextResponse.json(
        {
          error: "Error de conexión con el servidor",
          message:
            "No se pudo conectar con Strapi. Por favor, verifica que el servidor esté corriendo.",
        },
        { status: 503 }
      );
    }

    console.error("Error en PUT /api/notifications/[notificationId]:", {
      notificationId,
      error,
      errorType: typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Error desconocido al actualizar la notificación";

    return NextResponse.json(
      {
        error: errorMessage,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

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
        Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
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
      id: profile.id,
      documentId: profile.documentId,
      displayName: profile.displayName || profile.email || "Usuario",
      email: profile.email,
      role: profile.role,
    };
  } catch (error) {
    console.error("Error obteniendo user-profile actual:", error);
    return null;
  }
}

// PATCH - Marcar notificación como leída/no leída
export async function PATCH(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("notifications", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const jwt = await getCurrentUserJwt();
    const params = await context.params;
    const { notificationId } = params;

    if (!notificationId) {
      return NextResponse.json({ error: "notificationId es requerido" }, { status: 400 });
    }

    const currentUser = await getCurrentUserProfile();

    if (!currentUser) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { isRead } = body;

    if (typeof isRead !== "boolean") {
      return NextResponse.json({ error: "isRead debe ser un booleano" }, { status: 400 });
    }

    // Determinar si el ID es numérico o documentId
    const isNumericId = /^\d+$/.test(notificationId);

    // Buscar la notificación por ID (sin filtrar por recipient para incluir broadcast)
    let notificationQuery;

    if (isNumericId) {
      notificationQuery = qs.stringify({
        filters: {
          id: { $eq: parseInt(notificationId, 10) },
        },
        populate: {
          recipient: {
            fields: ["id", "documentId"],
          },
        },
      });
    } else {
      // Buscar por documentId
      notificationQuery = qs.stringify({
        filters: {
          documentId: { $eq: notificationId },
        },
        populate: {
          recipient: {
            fields: ["id", "documentId"],
          },
        },
      });
    }

    const notificationCheckResponse = await fetch(
      `${STRAPI_BASE_URL}/api/notifications?${notificationQuery}`,
      {
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!notificationCheckResponse.ok) {
      return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
    }

    const notificationData = await notificationCheckResponse.json();
    const notification = notificationData.data?.[0];

    if (!notification) {
      // La notificación no existe en la BD - devolver 410 Gone para que el frontend la elimine del estado
      return NextResponse.json(
        { error: "Notificación no encontrada", code: "NOTIFICATION_NOT_FOUND", shouldRemove: true },
        { status: 410 }
      );
    }

    // Verificar que el usuario tiene acceso a esta notificación
    const userRoleAudience = currentUser.role === "admin" ? "admins" : "drivers";

    // La notificación es accesible si:
    // 1. Tiene recipient que coincide con el usuario actual (por documentId o ID numérico), O
    // 2. Es broadcast (targetAudience coincide con el rol del usuario), O
    // 3. Es broadcast para "all", O
    // 4. No tiene recipient ni targetAudience (creada desde admin, tratar como broadcast para todos)
    const recipientDocId = notification.recipient?.documentId;
    const recipientId = notification.recipient?.id;
    const hasRecipient = notification.recipient !== null && notification.recipient !== undefined;
    const hasTargetAudience =
      notification.targetAudience !== null &&
      notification.targetAudience !== undefined &&
      notification.targetAudience !== "";

    // Verificar si el usuario es el recipient (por documentId o por ID numérico)
    const isRecipientByDocId = recipientDocId === currentUser.documentId;
    const isRecipientById = recipientId === currentUser.id;
    const isRecipient = isRecipientByDocId || isRecipientById;

    const isBroadcastForRole = notification.targetAudience === userRoleAudience;
    const isBroadcastForAll = notification.targetAudience === "all";
    const isAdminCreatedWithoutAudience = !hasRecipient && !hasTargetAudience;

    // Logging para depuración
    console.log("🔍 [PATCH] Verificación de permisos:", {
      notificationId: notification.id,
      notificationDocumentId: notification.documentId,
      recipientDocId,
      recipientId,
      currentUserDocId: currentUser.documentId,
      currentUserId: currentUser.id,
      isRecipientByDocId,
      isRecipientById,
      isRecipient,
      isBroadcastForRole,
      isBroadcastForAll,
      isAdminCreatedWithoutAudience,
      hasRecipient,
      hasTargetAudience,
      targetAudience: notification.targetAudience,
    });

    if (
      !isRecipient &&
      !isBroadcastForRole &&
      !isBroadcastForAll &&
      !isAdminCreatedWithoutAudience
    ) {
      return NextResponse.json(
        { error: "No tienes permisos para marcar esta notificación como leída" },
        { status: 403 }
      );
    }

    // Para notificaciones broadcast, crear una notificación individual marcada como leída
    // ya que no podemos modificar la original (afectaría a todos los usuarios)
    // Esto incluye: broadcast por rol, broadcast para todos, o notificaciones sin recipient/targetAudience
    if (
      !recipientDocId &&
      (isBroadcastForRole || isBroadcastForAll || isAdminCreatedWithoutAudience)
    ) {
      // Es una notificación broadcast - crear entrada individual para este usuario
      const individualNotificationData = {
        title: notification.title,
        description: notification.description || null,
        type: notification.type,
        isRead: isRead,
        timestamp: notification.timestamp,
        recipient: currentUser.id, // ID numérico del user-profile
        durationDays: null,
        isPinned: false,
        expiresAt: null,
        isDismissible: true,
        author: currentUser.id, // ID numérico del user-profile (relación)
        authorDocumentId: currentUser.documentId, // documentId para referencia
        // Tag para identificar que es una lectura de broadcast
        tags: JSON.stringify({
          parentBroadcastId: notification.documentId || notification.id,
          markedAsReadBy: currentUser.documentId,
        }),
      };

      const createResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: individualNotificationData }),
        cache: "no-store",
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error("Error creando notificación de lectura:", errorText);
        throw new Error(
          `Error marcando notificación como leída: ${errorText || createResponse.statusText}`
        );
      }

      const createdNotification = await createResponse.json();

      return NextResponse.json({
        success: true,
        data: createdNotification.data,
      });
    }

    // Para notificaciones individuales, actualizar directamente.
    // Strapi v5 solo resuelve documentId en la URL (un id numérico devuelve 404).
    const updateResponse = await fetch(
      `${STRAPI_BASE_URL}/api/notifications/${notification.documentId || notification.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            isRead,
          },
        }),
        cache: "no-store",
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("❌ [PATCH] Error actualizando en Strapi:", {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        errorText,
        notificationId: notification.id,
      });

      // Si Strapi devuelve 404, la notificación fue eliminada
      if (updateResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Notificación no encontrada",
            code: "NOTIFICATION_NOT_FOUND",
            shouldRemove: true,
          },
          { status: 410 }
        );
      }

      throw new Error(`Error actualizando notificación: ${errorText || updateResponse.statusText}`);
    }

    const updatedNotification = await updateResponse.json();

    return NextResponse.json({
      success: true,
      data: updatedNotification.data,
    });
  } catch (error) {
    console.error("Error actualizando notificación:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Eliminar una notificación/recordatorio
export async function DELETE(_: Request, context: RouteContext) {
  const startTime = Date.now();
  try {
    try {
      await requireModulePermission("notifications", "canDelete");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const jwt = await getCurrentUserJwt();
    const params = await context.params;
    const { notificationId } = params;

    console.log("🗑️ DELETE /api/notifications/[notificationId] - INICIO:", {
      notificationId,
      isNumeric: /^\d+$/.test(notificationId),
      timestamp: new Date().toISOString(),
    });

    if (!notificationId) {
      console.error("❌ DELETE: notificationId es requerido");
      return NextResponse.json({ error: "notificationId es requerido" }, { status: 400 });
    }

    // Determinar si notificationId es numérico (id) o es un documentId
    const isNumericId = /^\d+$/.test(notificationId);
    let idToDelete = notificationId;

    // Si no es numérico, buscar por documentId para obtener el id numérico
    if (!isNumericId) {
      console.log("🔍 Buscando notificación por documentId:", notificationId);

      const searchQuery = qs.stringify({
        filters: {
          documentId: { $eq: notificationId },
        },
        fields: ["id", "documentId", "type"],
      });

      const searchResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications?${searchQuery}`, {
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        if (searchData.data?.[0]?.id) {
          idToDelete = String(searchData.data[0].id);
          console.log("✅ Notificación encontrada, usando ID numérico:", {
            documentId: notificationId,
            numericId: idToDelete,
            type: searchData.data[0].type,
          });
        } else {
          console.error("❌ Notificación no encontrada por documentId:", notificationId);
          return NextResponse.json({ error: "Notificación no encontrada" }, { status: 404 });
        }
      } else {
        console.error("❌ Error buscando notificación:", {
          status: searchResponse.status,
          statusText: searchResponse.statusText,
        });
        return NextResponse.json({ error: "Error al buscar la notificación" }, { status: 500 });
      }
    } else {
      console.log("✅ ID numérico detectado, usando directamente:", idToDelete);
    }

    // Eliminar la notificación directamente en Strapi usando el id numérico
    console.log("🔄 Eliminando notificación en Strapi:", {
      notificationId,
      idToDelete,
      url: `${STRAPI_BASE_URL}/api/notifications/${idToDelete}`,
    });

    let deleteResponse: Response;
    try {
      deleteResponse = await fetch(`${STRAPI_BASE_URL}/api/notifications/${idToDelete}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      });
    } catch (fetchError: any) {
      // Error de conexión (fetch failed)
      const isConnectionError =
        fetchError?.message?.includes("fetch failed") ||
        fetchError?.code === "ECONNREFUSED" ||
        fetchError?.message?.includes("ECONNREFUSED") ||
        fetchError?.name === "TypeError";

      if (isConnectionError) {
        console.error("❌ DELETE: Error de conexión con Strapi:", {
          notificationId,
          idToDelete,
          error: fetchError,
          suggestion: "Verifica que Strapi esté corriendo en " + STRAPI_BASE_URL,
        });

        return NextResponse.json(
          {
            error: "Error de conexión con el servidor",
            message:
              "No se pudo conectar con Strapi. Por favor, verifica que el servidor esté corriendo.",
          },
          { status: 503 }
        );
      }

      // Otro tipo de error
      throw fetchError;
    }

    console.log("📡 Respuesta de Strapi DELETE:", {
      status: deleteResponse.status,
      statusText: deleteResponse.statusText,
      ok: deleteResponse.ok,
      idToDelete,
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      let errorData: any = {};
      try {
        errorData = errorText ? JSON.parse(errorText) : {};
      } catch {
        // Si no se puede parsear, usar el texto como mensaje
        errorData = { error: { message: errorText || "Error desconocido" } };
      }

      // Extraer mensaje de error de diferentes estructuras posibles
      const errorMessage =
        errorData?.error?.message ||
        errorData?.message ||
        errorData?.error ||
        errorText ||
        `Error ${deleteResponse.status}: ${deleteResponse.statusText}`;

      console.error("❌ Error eliminando notificación en Strapi:", {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        errorText: errorText || "Sin texto de error",
        errorData: errorData || {},
        errorMessage,
        notificationId,
        idToDelete,
      });

      // Si es 404, la notificación no existe
      if (deleteResponse.status === 404) {
        return NextResponse.json(
          {
            error: "La notificación no fue encontrada",
            message: "La notificación puede haber sido eliminada o el ID es inválido.",
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: errorMessage,
          message: errorMessage,
        },
        { status: deleteResponse.status }
      );
    }

    // Verificar que el recordatorio fue realmente eliminado
    // Esperar un momento para que Strapi procese la eliminación
    await new Promise((resolve) => setTimeout(resolve, 500));

    const verifyDeleteQuery = qs.stringify({
      filters: {
        id: { $eq: parseInt(idToDelete, 10) },
      },
      fields: ["id", "documentId", "title"],
    });

    const verifyDeleteResponse = await fetch(
      `${STRAPI_BASE_URL}/api/notifications?${verifyDeleteQuery}`,
      {
        headers: {
          Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (verifyDeleteResponse.ok) {
      const verifyData = await verifyDeleteResponse.json();
      if (verifyData.data && verifyData.data.length > 0) {
        console.error("❌ DELETE: El recordatorio aún existe después de eliminarlo:", {
          notificationId,
          idToDelete,
          foundRecords: verifyData.data.length,
          foundRecordsData: verifyData.data.map((r: any) => ({
            id: r.id,
            documentId: r.documentId,
            title: r.title,
          })),
        });

        // Si el recordatorio aún existe, intentar eliminarlo directamente con entityService
        // Esto puede ser necesario si el controlador personalizado no se ejecutó
        console.warn(
          "⚠️ DELETE: El recordatorio aún existe. Esto puede indicar que el controlador personalizado no se ejecutó."
        );

        // Retornar error para que el frontend sepa que hubo un problema
        return NextResponse.json(
          {
            error: "El recordatorio no fue eliminado correctamente",
            message:
              "El recordatorio aún existe después de intentar eliminarlo. Puede haber un problema con el servidor.",
          },
          { status: 500 }
        );
      } else {
        console.log(
          "✅ DELETE: Verificación confirmada - el recordatorio fue eliminado correctamente"
        );
      }
    } else {
      console.warn("⚠️ DELETE: No se pudo verificar la eliminación:", {
        status: verifyDeleteResponse.status,
        statusText: verifyDeleteResponse.statusText,
      });
    }

    const elapsedTime = Date.now() - startTime;
    console.log("✅ DELETE /api/notifications/[notificationId] - ÉXITO:", {
      notificationId,
      idToDelete,
      elapsedTime: `${elapsedTime}ms`,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const elapsedTime = Date.now() - startTime;
    let notificationId = "unknown";
    try {
      const params = await context.params;
      notificationId = params.notificationId;
    } catch {
      // Ignorar error al obtener params
    }

    // Verificar si es un error de conexión
    const isConnectionError =
      (error instanceof Error &&
        (error.message?.includes("fetch failed") ||
          error.message?.includes("ECONNREFUSED") ||
          error.name === "TypeError")) ||
      (typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "ECONNREFUSED");

    if (isConnectionError) {
      console.error("❌ DELETE: Error de conexión con Strapi:", {
        notificationId,
        error,
        elapsedTime: `${elapsedTime}ms`,
        timestamp: new Date().toISOString(),
        suggestion:
          "Verifica que Strapi esté corriendo en " +
          STRAPI_BASE_URL +
          " (cd backend && npm run develop)",
      });

      return NextResponse.json(
        {
          error: "Error de conexión con el servidor",
          message:
            "No se pudo conectar con Strapi. Por favor, verifica que el servidor esté corriendo.",
        },
        { status: 503 }
      );
    }

    console.error("❌ DELETE /api/notifications/[notificationId] - ERROR:", {
      notificationId,
      error,
      errorType: typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      elapsedTime: `${elapsedTime}ms`,
      timestamp: new Date().toISOString(),
    });

    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Error desconocido al eliminar la notificación";

    return NextResponse.json(
      {
        error: errorMessage,
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
