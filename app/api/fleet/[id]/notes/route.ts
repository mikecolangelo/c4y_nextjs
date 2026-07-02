import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { fetchFleetVehicleByIdFromStrapi } from "@/lib/fleet";
import { requireModulePermission } from "@/lib/module-guard";

// Función helper para obtener el user-profile del usuario actual
async function getCurrentUserProfile() {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      return null;
    }

    // Primero obtener el usuario
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

    // En este proyecto, /api/users/me devuelve el usuario directamente: { id, documentId, username, email, ... }
    // No está envuelto en { data: {...}, meta: {} }
    const userId = userData?.id;

    if (!userId) {
      console.warn("⚠️ No se pudo obtener userId de /api/users/me:", {
        hasId: !!userData?.id,
        topLevelKeys: userData ? Object.keys(userData) : [],
      });
      return null;
    }

    // Buscar el user-profile relacionado usando el email
    // No podemos usar userAccount porque está marcado como private: true
    // Usamos el email que debería coincidir entre admin::user y user-profile
    // Ahora también obtenemos displayName para mostrarlo en el comentario
    const profileQuery = qs.stringify({
      filters: {
        email: { $eq: userData.email },
      },
      fields: ["documentId", "displayName", "email"], // Incluimos displayName para mostrarlo
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
      console.warn("No se pudo obtener el user-profile para el usuario:", userId);
      return null;
    }

    const profileData = await profileResponse.json();
    const profile = profileData.data?.[0];

    if (!profile || !profile.documentId) {
      console.warn("No se encontró user-profile o no tiene documentId para el usuario:", userId);
      return null;
    }

    // Retornar documentId y displayName para usarlo en la respuesta
    const result = {
      documentId: profile.documentId,
      displayName: profile.displayName || profile.email || "Usuario",
      email: profile.email,
      avatar: profile.avatar,
    };

    console.log("✅ Perfil del usuario obtenido:", {
      documentId: result.documentId,
      displayName: result.displayName,
      email: result.email,
      hasAvatar: !!result.avatar,
    });

    return result;
  } catch (error) {
    console.error("Error obteniendo user-profile actual:", error);
    return null;
  }
}

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface FleetNotePayload {
  content: string;
  authorDocumentId?: string; // documentId del usuario logueado enviado desde el frontend
}

// GET - Obtener todas las notas de un vehículo
export async function GET(_: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await context.params;

    // Primero obtener el vehículo para obtener su ID numérico
    const vehicle = await fetchFleetVehicleByIdFromStrapi(id);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

    // Buscar el vehículo por documentId para obtener el ID numérico
    const vehicleQuery = qs.stringify({
      filters: {
        documentId: { $eq: id },
      },
      fields: ["id"],
    });

    const vehicleResponse = await fetch(`${STRAPI_BASE_URL}/api/fleets?${vehicleQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!vehicleResponse.ok) {
      throw new Error("No se pudo obtener el vehículo");
    }

    const vehicleData = await vehicleResponse.json();
    const vehicleId = vehicleData.data?.[0]?.id;

    if (!vehicleId) {
      return NextResponse.json(
        { error: "No se pudo obtener el ID del vehículo." },
        { status: 404 }
      );
    }

    // Obtener las notas del vehículo (solo campos básicos, sin relación author)
    const notesQuery = qs.stringify({
      filters: {
        vehicle: { id: { $eq: vehicleId } },
      },
      fields: ["id", "documentId", "content", "authorDocumentId", "createdAt", "updatedAt"],
      sort: ["createdAt:desc"],
    });

    const notesResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-notes?${notesQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!notesResponse.ok) {
      const errorText = await notesResponse.text();
      console.error("Error obteniendo notas de Strapi:", {
        status: notesResponse.status,
        statusText: notesResponse.statusText,
        errorText,
        url: `${STRAPI_BASE_URL}/api/fleet-notes?${notesQuery}`,
      });
      throw new Error(`No se pudieron obtener las notas: ${errorText || notesResponse.statusText}`);
    }

    const notesData = await notesResponse.json();
    console.log("Notas obtenidas de Strapi:", JSON.stringify(notesData.data, null, 2));

    // Buscar el usuario para cada nota usando authorDocumentId
    const notesWithAuthor = await Promise.all(
      (notesData.data || []).map(async (note: any) => {
        // Si tiene authorDocumentId, buscar el usuario
        if (note.authorDocumentId) {
          try {
            const authorQuery = qs.stringify({
              filters: {
                documentId: { $eq: note.authorDocumentId },
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
                note.author = authorData.data[0];
                console.log("✅ Autor encontrado para nota (GET):", {
                  documentId: note.author.documentId,
                  displayName: note.author.displayName,
                  email: note.author.email,
                });
              } else {
                console.warn("⚠️ No se encontró autor con documentId:", note.authorDocumentId);
                // Si no se encuentra, al menos asegurar que tenga email si tenemos el authorDocumentId
                // Esto es un fallback para notas antiguas o con problemas
                if (note.authorDocumentId) {
                  // Intentar extraer email del documentId si es posible, o usar un valor por defecto
                  note.author = {
                    id: 0,
                    documentId: note.authorDocumentId,
                    displayName: null,
                    email: null, // No tenemos el email, pero al menos tenemos el documentId
                  };
                }
              }
            } else {
              console.warn(
                "⚠️ Error al buscar autor (GET):",
                authorResponse.status,
                authorResponse.statusText
              );
              // Si hay error, al menos asegurar que tenga algo
              if (note.authorDocumentId) {
                note.author = {
                  id: 0,
                  documentId: note.authorDocumentId,
                  displayName: null,
                  email: null,
                };
              }
            }
          } catch (error) {
            console.error("Error obteniendo autor para nota:", error);
            // Si hay error, al menos asegurar que tenga algo
            if (note.authorDocumentId) {
              note.author = {
                id: 0,
                documentId: note.authorDocumentId,
                displayName: null,
                email: null,
              };
            }
          }
        } else {
          // Nota antigua sin authorDocumentId - log para debugging
          console.warn("⚠️ Nota sin authorDocumentId válido (nota antigua):", {
            id: note.id,
            documentId: note.documentId,
            authorDocumentId: note.authorDocumentId,
          });
        }
        return note;
      })
    );

    // Log cada nota para verificar que tiene documentId y author
    if (notesWithAuthor && Array.isArray(notesWithAuthor)) {
      notesWithAuthor.forEach((note: any, index: number) => {
        console.log(`Nota ${index}:`, {
          id: note.id,
          documentId: note.documentId,
          authorDocumentId: note.authorDocumentId,
          content: note.content?.substring(0, 50) + "...",
          author: note.author
            ? {
                id: note.author.id,
                documentId: note.author.documentId,
                displayName: note.author.displayName,
                hasAvatar: !!note.author.avatar,
              }
            : null,
        });
      });
    }
    return NextResponse.json({ data: notesWithAuthor || [] });
  } catch (error) {
    console.error("Error fetching fleet notes:", error);
    return NextResponse.json({ error: "No pudimos obtener las notas." }, { status: 500 });
  }
}

// POST - Crear una nueva nota
export async function POST(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as { data?: FleetNotePayload };
    if (!body?.data?.content) {
      return NextResponse.json({ error: "El contenido de la nota es requerido." }, { status: 400 });
    }

    const { id } = await context.params;

    // Obtener el vehículo para obtener su ID numérico
    const vehicleQuery = qs.stringify({
      filters: {
        documentId: { $eq: id },
      },
      fields: ["id"],
    });

    const vehicleResponse = await fetch(`${STRAPI_BASE_URL}/api/fleets?${vehicleQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!vehicleResponse.ok) {
      throw new Error("No se pudo obtener el vehículo");
    }

    const vehicleData = await vehicleResponse.json();
    const vehicleId = vehicleData.data?.[0]?.id;

    if (!vehicleId) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

    // Siempre obtener el perfil completo del usuario para tener el displayName y email
    const currentUserProfile = await getCurrentUserProfile();

    // Obtener el authorDocumentId: primero del body (enviado desde el frontend), si no del usuario logueado
    // Ignorar null o undefined, tratarlos como si no viniera el campo
    let authorDocumentId =
      body.data.authorDocumentId && body.data.authorDocumentId !== null
        ? body.data.authorDocumentId
        : undefined;

    // Si no viene del frontend (o es null), obtenerlo del usuario logueado
    if (!authorDocumentId) {
      console.log(
        "📥 No se recibió authorDocumentId del frontend (o es null), obteniéndolo del usuario logueado..."
      );
      authorDocumentId = currentUserProfile?.documentId;

      if (!authorDocumentId) {
        console.warn(
          "⚠️ No se pudo obtener el documentId del usuario. La nota se creará sin authorDocumentId."
        );
      } else {
        console.log("✅ authorDocumentId obtenido del usuario logueado:", authorDocumentId);
      }
    } else {
      console.log("✅ Usando authorDocumentId enviado desde el frontend:", authorDocumentId);
    }

    // Crear la nota
    console.log("Intentando crear nota con:", {
      content: body.data.content,
      vehicleId,
      authorDocumentId,
      source: body.data.authorDocumentId ? "frontend" : "backend",
    });

    // Preparar los datos de la nota (solo authorDocumentId, sin relación author)
    const noteData: {
      content: string;
      authorDocumentId?: string;
      vehicle: number;
    } = {
      content: body.data.content,
      vehicle: vehicleId,
    };

    // Incluir el documentId del autor si está disponible
    if (authorDocumentId) {
      noteData.authorDocumentId = authorDocumentId;
    } else {
      console.warn("⚠️ No se pudo obtener el authorDocumentId. La nota se creará sin autor.");
    }

    const newNoteResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-notes`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: noteData,
      }),
      cache: "no-store",
    });

    console.log("Respuesta de Strapi:", {
      status: newNoteResponse.status,
      statusText: newNoteResponse.statusText,
      ok: newNoteResponse.ok,
    });

    if (!newNoteResponse.ok) {
      const errorText = await newNoteResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch (parseError) {
        errorData = {
          error: {
            message: errorText || `Error ${newNoteResponse.status}: ${newNoteResponse.statusText}`,
          },
        };
      }
      console.error("Error creando nota en Strapi:", {
        status: newNoteResponse.status,
        statusText: newNoteResponse.statusText,
        errorText,
        errorData,
      });

      // Si es 404, probablemente el tipo de contenido no existe
      if (newNoteResponse.status === 404) {
        throw new Error(
          "El tipo de contenido 'fleet-note' no existe en Strapi. Reinicia Strapi para que reconozca el nuevo tipo."
        );
      }

      // Si es 403, faltan permisos
      if (newNoteResponse.status === 403) {
        throw new Error(
          "No tienes permisos para crear notas. Configura los permisos en Strapi Settings → Roles."
        );
      }

      throw new Error(
        errorData.error?.message ||
          errorData.message ||
          `Error ${newNoteResponse.status}: ${newNoteResponse.statusText}`
      );
    }

    const newNote = await newNoteResponse.json();
    console.log("Nota creada en Strapi:", newNote);

    // Si la respuesta ya incluye los datos completos, retornarla directamente
    if (newNote.data) {
      // Obtener la nota con documentId (sin relación author)
      const noteQuery = qs.stringify({
        fields: ["id", "documentId", "content", "authorDocumentId", "createdAt", "updatedAt"],
      });

      const createdNoteResponse = await fetch(
        `${STRAPI_BASE_URL}/api/fleet-notes/${newNote.data.id}?${noteQuery}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          },
          cache: "no-store",
        }
      );

      if (createdNoteResponse.ok) {
        const createdNote = await createdNoteResponse.json();
        const noteData = createdNote.data;

        // Si tiene authorDocumentId, buscar el usuario
        // Primero intentar usar el perfil del usuario actual si coincide
        if (noteData.authorDocumentId) {
          if (currentUserProfile && currentUserProfile.documentId === noteData.authorDocumentId) {
            // Usar el perfil del usuario actual que ya tenemos
            noteData.author = {
              id: 0, // Placeholder
              documentId: currentUserProfile.documentId,
              displayName: currentUserProfile.displayName || currentUserProfile.email || "Usuario",
              email: currentUserProfile.email,
              avatar: currentUserProfile.avatar,
            };
            console.log("✅ Usando perfil del usuario actual como autor (ya disponible):", {
              documentId: noteData.author.documentId,
              displayName: noteData.author.displayName,
              email: noteData.author.email,
            });
          } else {
            // Si no coincide, buscar en Strapi
            try {
              const authorQuery = qs.stringify({
                filters: {
                  documentId: { $eq: noteData.authorDocumentId },
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
                  noteData.author = authorData.data[0];
                  console.log("✅ Autor encontrado en Strapi para la nota:", {
                    documentId: noteData.author.documentId,
                    displayName: noteData.author.displayName,
                    email: noteData.author.email,
                  });
                } else {
                  console.warn(
                    "⚠️ No se encontró autor con documentId:",
                    noteData.authorDocumentId
                  );
                  // Si no se encuentra, usar el perfil del usuario actual como fallback
                  if (
                    currentUserProfile &&
                    currentUserProfile.documentId === noteData.authorDocumentId
                  ) {
                    noteData.author = {
                      id: 0,
                      documentId: currentUserProfile.documentId,
                      displayName:
                        currentUserProfile.displayName || currentUserProfile.email || "Usuario",
                      email: currentUserProfile.email,
                      avatar: currentUserProfile.avatar,
                    };
                    console.log(
                      "✅ Usando perfil del usuario actual como autor (fallback):",
                      noteData.author
                    );
                  }
                }
              } else {
                console.warn(
                  "⚠️ Error al buscar autor:",
                  authorResponse.status,
                  authorResponse.statusText
                );
                // Si hay error, usar el perfil del usuario actual como fallback
                if (
                  currentUserProfile &&
                  currentUserProfile.documentId === noteData.authorDocumentId
                ) {
                  noteData.author = {
                    id: 0,
                    documentId: currentUserProfile.documentId,
                    displayName:
                      currentUserProfile.displayName || currentUserProfile.email || "Usuario",
                    email: currentUserProfile.email,
                    avatar: currentUserProfile.avatar,
                  };
                  console.log(
                    "✅ Usando perfil del usuario actual como autor (fallback - error):",
                    noteData.author
                  );
                }
              }
            } catch (error) {
              console.error("Error obteniendo autor para nota creada:", error);
              // Si hay error, usar el perfil del usuario actual como fallback
              if (
                currentUserProfile &&
                currentUserProfile.documentId === noteData.authorDocumentId
              ) {
                noteData.author = {
                  id: 0,
                  documentId: currentUserProfile.documentId,
                  displayName:
                    currentUserProfile.displayName || currentUserProfile.email || "Usuario",
                  email: currentUserProfile.email,
                  avatar: currentUserProfile.avatar,
                };
                console.log(
                  "✅ Usando perfil del usuario actual como autor (fallback - excepción):",
                  noteData.author
                );
              }
            }
          }
        }

        // Asegurar que siempre tenga el autor, incluso si no se encontró antes
        if (
          !noteData.author &&
          noteData.authorDocumentId &&
          currentUserProfile &&
          currentUserProfile.documentId === noteData.authorDocumentId
        ) {
          noteData.author = {
            id: 0,
            documentId: currentUserProfile.documentId,
            displayName: currentUserProfile.displayName || currentUserProfile.email || "Usuario",
            email: currentUserProfile.email,
            avatar: currentUserProfile.avatar,
          };
          console.log(
            "✅ Agregando autor del usuario actual (asegurando que esté presente):",
            noteData.author
          );
        }

        console.log("Nota creada con documentId y autor:", {
          documentId: noteData.documentId,
          authorDocumentId: noteData.authorDocumentId,
          authorDisplayName: noteData.author?.displayName,
          authorEmail: noteData.author?.email,
          hasAuthor: !!noteData.author,
        });
        return NextResponse.json({ data: noteData }, { status: 201 });
      }

      // Si no se puede obtener completa, construir la respuesta con el autor del usuario actual
      console.log(
        "⚠️ No se pudo obtener la nota completa, construyendo respuesta con perfil del usuario actual"
      );
      const fallbackNoteData = {
        ...newNote.data,
      };

      // Siempre incluir el autor del usuario actual si coincide
      if (
        newNote.data.authorDocumentId &&
        currentUserProfile &&
        currentUserProfile.documentId === newNote.data.authorDocumentId
      ) {
        fallbackNoteData.author = {
          id: 0,
          documentId: currentUserProfile.documentId,
          displayName: currentUserProfile.displayName || currentUserProfile.email || "Usuario",
          email: currentUserProfile.email,
          avatar: currentUserProfile.avatar,
        };
        console.log(
          "✅ Agregando autor del usuario actual a la respuesta fallback:",
          fallbackNoteData.author
        );
      }

      console.log("Nota creada (con autor del usuario actual):", {
        documentId: fallbackNoteData.documentId,
        authorDocumentId: fallbackNoteData.authorDocumentId,
        authorDisplayName: fallbackNoteData.author?.displayName,
        authorEmail: fallbackNoteData.author?.email,
        hasAuthor: !!fallbackNoteData.author,
      });

      return NextResponse.json({ data: fallbackNoteData }, { status: 201 });
    }

    throw new Error("La respuesta de Strapi no contiene los datos esperados");
  } catch (error) {
    console.error("========== ERROR CREATING FLEET NOTE ==========");
    console.error("Error object:", error);
    console.error("Error type:", typeof error);
    console.error("Error instanceof Error:", error instanceof Error);

    let errorMessage = "Error desconocido al crear la nota";

    if (error instanceof Error) {
      errorMessage = error.message || "Error desconocido";
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    } else if (typeof error === "string") {
      errorMessage = error;
    } else {
      try {
        const errorStr = JSON.stringify(error, null, 2);
        console.error("Error object (stringified):", errorStr);
        errorMessage = errorStr.length > 200 ? "Error desconocido" : errorStr;
      } catch {
        console.error("No se pudo serializar el error");
      }
    }

    console.error("Retornando error:", errorMessage);
    console.error("================================================");

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
