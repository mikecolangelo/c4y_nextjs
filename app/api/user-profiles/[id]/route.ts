import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// GET - Obtener un perfil de contacto por ID
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const query = qs.stringify({
      fields: [
        "id",
        "documentId",
        "displayName",
        "email",
        "phone",
        "role",
        "department",
        "bio",
        "address",
        "dateOfBirth",
        "hireDate",
        "identificationNumber",
        "emergencyContactName",
        "emergencyContactPhone",
        "linkedin",
        "workSchedule",
        "specialties",
        "driverLicense",
        "billingName",
        "billingAddress",
        "billingTaxId",
        "billingPhone",
      ],
      populate: {
        avatar: {
          fields: ["url", "alternativeText"],
        },
        assignedVehicles: {
          fields: ["id", "documentId", "name", "vin", "brand", "model", "year"],
          populate: {
            image: {
              fields: ["url", "alternativeText"],
            },
          },
        },
        interestedVehicles: {
          fields: ["id", "documentId", "name", "vin", "brand", "model", "year"],
          populate: {
            image: {
              fields: ["url", "alternativeText"],
            },
          },
        },
        assignedReminders: {
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
          ],
          populate: {
            vehicle: {
              fields: ["id", "documentId", "name"],
            },
          },
        },
        driverHistories: {
          fields: [
            "id",
            "documentId",
            "startDate",
            "endDate",
            "status",
            "notes",
            "mileageStart",
            "mileageEnd",
          ],
          populate: {
            vehicle: {
              fields: [
                "id",
                "documentId",
                "name",
                "vin",
                "brand",
                "model",
                "year",
                "currentMileage",
              ],
              populate: {
                image: {
                  fields: ["url", "alternativeText"],
                },
              },
            },
          },
        },
        registeredVehicles: {
          fields: [
            "id",
            "documentId",
            "name",
            "vin",
            "brand",
            "model",
            "year",
            "currentMileage",
            "createdAt",
          ],
          populate: {
            image: {
              fields: ["url", "alternativeText"],
            },
            currentDrivers: {
              fields: ["id", "documentId", "displayName"],
            },
          },
        },
        serviceNotes: {
          fields: ["id", "documentId", "content", "createdAt"],
        },
        deals: {
          fields: ["id", "documentId", "title", "price"],
          populate: {
            vehicle: {
              fields: ["id", "documentId", "name", "brand", "model", "year"],
            },
            client: {
              fields: ["id", "documentId", "fullName"],
            },
          },
        },
        // userAccount populate eliminado: Strapi v5 rechaza campos custom (isValidated).
        // Se obtiene vía endpoint custom /account después.
      },
    });

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para ver este contacto." },
        { status: 401 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/${id}?${query}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "Contacto no encontrado" }, { status: 404 });
      }
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        errorText = response.statusText || "Error desconocido";
      }
      console.error("Error de Strapi:", {
        status: response.status,
        statusText: response.statusText,
        errorText,
      });
      return NextResponse.json(
        { error: `Error obteniendo perfil de contacto: ${errorText || response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Verificar que la respuesta tenga la estructura esperada
    if (!data || !data.data) {
      console.error("Respuesta de Strapi sin estructura esperada:", data);
      return NextResponse.json(
        { error: "La respuesta del servidor no tiene el formato esperado" },
        { status: 500 }
      );
    }

    const userData = data.data;

    // Enriquecer con datos de userAccount vía endpoint custom (usar localhost para evitar problemas de red con dominio externo)
    try {
      const localStrapiUrl = process.env.STRAPI_BASE_URL?.includes("localhost")
        ? process.env.STRAPI_BASE_URL
        : "http://127.0.0.1:1337";
      const accountRes = await fetch(`${localStrapiUrl}/api/user-profiles/${id}/account`, {
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        cache: "no-store",
      });
      if (accountRes.ok) {
        const accountData = await accountRes.json();
        if (accountData.data) {
          userData.userAccount = accountData.data;
        }
      } else {
        console.error(
          "[API /user-profiles/:id] Error obteniendo account:",
          accountRes.status,
          await accountRes.text().catch(() => "")
        );
      }
    } catch (accountError) {
      console.error("[API /user-profiles/:id] Error obteniendo userAccount:", accountError);
    }

    // Obtener el autor de cada recordatorio si existen
    if (userData.assignedReminders && Array.isArray(userData.assignedReminders)) {
      const remindersWithAuthor = await Promise.all(
        userData.assignedReminders.map(async (reminder: any) => {
          if (reminder.authorDocumentId) {
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
                    Authorization: `Bearer ${jwt}`,
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
              console.error("Error obteniendo autor para recordatorio:", error);
            }
          }

          return reminder;
        })
      );

      userData.assignedReminders = remindersWithAuthor;
    }

    return NextResponse.json({ data: userData });
  } catch (error) {
    console.error("Error obteniendo perfil de contacto:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// PATCH - Actualizar un perfil de contacto
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para editar este contacto." },
        { status: 401 }
      );
    }

    // Limpiar campos vacíos: convertir strings vacías y undefined a null
    // Strapi rechaza strings vacíos en campos como email (type: email)
    const cleanedData = { ...body.data };
    for (const key of Object.keys(cleanedData)) {
      if (cleanedData[key] === "" || cleanedData[key] === undefined) {
        cleanedData[key] = null;
      }
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/${id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: cleanedData }),
      cache: "no-store",
    });

    if (response.status === 403) {
      return NextResponse.json(
        { error: "No tenés permiso para editar este contacto." },
        { status: 403 }
      );
    }

    if (!response.ok) {
      let errorText = "";
      try {
        const errorJson = await response.json();
        if (errorJson?.error?.message) {
          errorText = errorJson.error.message;
        } else if (errorJson?.message) {
          errorText = errorJson.message;
        } else if (errorJson?.error) {
          errorText =
            typeof errorJson.error === "string" ? errorJson.error : JSON.stringify(errorJson.error);
        } else {
          errorText = await response.text();
        }
      } catch {
        errorText = response.statusText || `HTTP ${response.status}`;
      }
      throw new Error(`Error actualizando perfil de contacto: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error actualizando perfil de contacto:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Eliminar un perfil de contacto
export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para eliminar este contacto." },
        { status: 401 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      cache: "no-store",
    });

    if (response.status === 403) {
      return NextResponse.json(
        { error: "No tenés permiso para eliminar este contacto." },
        { status: 403 }
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error eliminando perfil de contacto: ${errorText || response.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error eliminando perfil de contacto:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
