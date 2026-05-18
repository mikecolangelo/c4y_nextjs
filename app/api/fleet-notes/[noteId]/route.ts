import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { requireAdmin } from "@/lib/admin-guard";

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

    const profileResponse = await fetch(
      `${STRAPI_BASE_URL}/api/user-profiles?${profileQuery}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

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
    
    return result;
  } catch (error) {
    console.error("Error obteniendo user-profile actual:", error);
    return null;
  }
}

interface RouteContext {
  params: Promise<{
    noteId: string;
  }>;
}

// PATCH - Actualizar una nota
export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Acceso restringido: Se requieren permisos de administrador" },
      { status: 403 }
    );
  }
  console.log("🚀 PATCH endpoint ejecutado - Ruta encontrada!");
  try {
    const params = await context.params;
    const { noteId } = params;
    
    console.log("========== PATCH FLEET NOTE ==========");
    console.log("Params recibidos:", params);
    console.log("noteId recibido:", noteId);
    console.log("Tipo de noteId:", typeof noteId);
    console.log("Es numérico?", /^\d+$/.test(noteId));
    
    if (!noteId) {
      return NextResponse.json(
        { error: "noteId es requerido" },
        { status: 400 }
      );
    }
    
    let body;
    try {
      body = (await request.json()) as { 
        data?: { 
          content: string;
          vehicleId?: string;
        } 
      };
    } catch (parseError) {
      console.error("Error parseando body:", parseError);
      return NextResponse.json(
        { error: "Body inválido o vacío" },
        { status: 400 }
      );
    }
    
    if (!body?.data?.content) {
      return NextResponse.json(
        { error: "El contenido de la nota es requerido." },
        { status: 400 }
      );
    }

    // Si se proporciona vehicleId, validar que el vehículo existe
    if (body.data.vehicleId) {
      const vehicleQuery = qs.stringify({
        filters: {
          documentId: { $eq: body.data.vehicleId },
        },
        fields: ["id"],
      });

      const vehicleResponse = await fetch(
        `${STRAPI_BASE_URL}/api/fleets?${vehicleQuery}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          },
          cache: "no-store",
        }
      );

      if (!vehicleResponse.ok) {
        throw new Error("No se pudo obtener el vehículo");
      }

      const vehicleData = await vehicleResponse.json();
      if (!vehicleData.data?.[0]?.id) {
        return NextResponse.json(
          { error: "Vehículo no encontrado." },
          { status: 404 }
        );
      }
    }

    // Obtener el user-profile del usuario actual para asociarlo como autor
    const currentUserProfile = await getCurrentUserProfile();
    const authorDocumentId = currentUserProfile?.documentId;
    
    // Validar que tenemos authorDocumentId antes de continuar
    if (!authorDocumentId || authorDocumentId === null || authorDocumentId === undefined) {
      console.error("❌ No se pudo obtener el authorDocumentId. Rechazando actualización.");
      return NextResponse.json(
        { error: "No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente." },
        { status: 401 }
      );
    }
    
    // En Strapi v5, podemos usar documentId directamente en la URL
    // Similar a como se hace en updateFleetVehicleInStrapi
    const noteIdToUse = noteId; // Usar el noteId tal como viene (puede ser documentId o ID numérico)
    
    console.log("🔄 Actualizando nota en Strapi:");
    console.log("  - URL:", `${STRAPI_BASE_URL}/api/fleet-notes/${noteIdToUse}`);
    console.log("  - ID/DocumentId:", noteIdToUse);
    console.log("  - Author DocumentId:", authorDocumentId);
    console.log("  - Contenido:", body.data.content.substring(0, 50) + "...");
    
    // Preparar los datos de actualización (authorDocumentId siempre debe estar presente y no ser null)
    const updateData: { 
      content: string; 
      authorDocumentId: string; // Requerido, nunca null
    } = {
      content: body.data.content,
      authorDocumentId: authorDocumentId, // Siempre presente y válido
    };
    
    const updateResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-notes/${noteIdToUse}`,
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

    console.log("📥 Respuesta de actualización:", {
      status: updateResponse.status,
      ok: updateResponse.ok,
      statusText: updateResponse.statusText,
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("❌ Error completo de Strapi:", errorText);
      
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${updateResponse.status}` } };
      }
      
      console.error("❌ Detalles del error:", {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        error: errorData,
        noteIdUsado: noteIdToUse,
        urlUsada: `${STRAPI_BASE_URL}/api/fleet-notes/${noteIdToUse}`,
      });
      
      // Si es 404, puede ser que el ID/documentId no sea correcto
      if (updateResponse.status === 404) {
        return NextResponse.json(
          { error: `Nota no encontrada en Strapi con ID/documentId ${noteIdToUse}. Verifica que la nota existe.` },
          { status: 404 }
        );
      }
      
      // Si es 405, el método no está permitido
      if (updateResponse.status === 405) {
        return NextResponse.json(
          { error: `Método no permitido. Strapi puede requerir un método diferente para actualizar esta nota.` },
          { status: 405 }
        );
      }
      
      throw new Error(errorData.error?.message || errorData.message || `Error ${updateResponse.status}: ${updateResponse.statusText}`);
    }

    const updatedNote = await updateResponse.json();
    console.log("Nota actualizada en Strapi:", updatedNote);

    // Obtener la nota actualizada (sin relación author)
    const noteQuery = qs.stringify({
      fields: ["id", "documentId", "content", "authorDocumentId", "createdAt", "updatedAt"],
    });

    const noteResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-notes/${noteIdToUse}?${noteQuery}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (noteResponse.ok) {
      const noteDataResponse = await noteResponse.json();
      const noteData = noteDataResponse.data;
      
      // Si tiene authorDocumentId, buscar el usuario
      if (noteData.authorDocumentId) {
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
            }
          }
        } catch (error) {
          console.error("Error obteniendo autor para nota actualizada:", error);
        }
      }
      
      return NextResponse.json({ data: noteData });
    }

    // Si no se puede obtener, retornar la respuesta directa de Strapi
    console.warn("No se pudo obtener la nota actualizada, retornando respuesta directa");
    if (updatedNote.data) {
      return NextResponse.json({ data: updatedNote.data });
    }

    throw new Error("No se pudo obtener la nota actualizada");
  } catch (error) {
    console.error("========== ERROR UPDATING FLEET NOTE ==========");
    console.error("Error completo:", error);
    console.error("Error type:", typeof error);
    console.error("Error instanceof Error:", error instanceof Error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    console.error("==============================================");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar una nota
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
    const { noteId } = params;

    if (!noteId) {
      return NextResponse.json(
        { error: "noteId es requerido" },
        { status: 400 }
      );
    }

    // Usar documentId directamente, como en PATCH
    console.log("🗑️ Eliminando nota:", noteId);
    
    const deleteResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-notes/${noteId}`,
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
      console.error("❌ Error eliminando nota en Strapi:", {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorData,
        noteId,
        url: `${STRAPI_BASE_URL}/api/fleet-notes/${noteId}`,
      });
      throw new Error(errorData.error?.message || `Error ${deleteResponse.status}: ${deleteResponse.statusText}`);
    }

    console.log("✅ Nota eliminada exitosamente");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fleet note:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Obtener una nota específica (para debugging)
export async function GET(_: Request, context: RouteContext) {
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
    const { noteId } = params;
    
    console.log("========== GET FLEET NOTE ==========");
    console.log("Params recibidos:", params);
    console.log("noteId:", noteId);
    
    return NextResponse.json({ 
      message: "Endpoint encontrado",
      noteId 
    });
  } catch (error) {
    console.error("Error in GET fleet note:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

