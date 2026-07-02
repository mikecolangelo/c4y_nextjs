import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { strapiImages } from "@/lib/strapi-images";
import { requireModulePermission } from "@/lib/module-guard";

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
    console.error("Error obteniendo user-profile actual:", error);
    return null;
  }
}

interface RouteContext {
  params: Promise<{
    statusId: string;
  }>;
}

// PATCH - Actualizar un estado
export async function PATCH(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const params = await context.params;
    const { statusId } = params;

    if (!statusId) {
      return NextResponse.json({ error: "statusId es requerido" }, { status: 400 });
    }

    let body;
    try {
      body = (await request.json()) as {
        data?: {
          comment?: string;
          vehicleId?: string;
          images?: number[];
        };
      };
    } catch (parseError) {
      console.error("Error parseando body:", parseError);
      return NextResponse.json({ error: "Body inválido o vacío" }, { status: 400 });
    }

    if (!body?.data) {
      return NextResponse.json({ error: "Los datos del estado son requeridos." }, { status: 400 });
    }

    const currentUserProfile = await getCurrentUserProfile();
    const authorDocumentId = currentUserProfile?.documentId;

    if (!authorDocumentId) {
      return NextResponse.json(
        {
          error:
            "No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.",
        },
        { status: 401 }
      );
    }

    const updateData: {
      comment?: string;
      images?: number[];
      authorDocumentId: string;
    } = {
      authorDocumentId: authorDocumentId,
    };

    if (body.data.comment !== undefined) {
      updateData.comment = body.data.comment;
    }

    if (body.data.images !== undefined) {
      updateData.images = body.data.images;
    }

    const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-statuses/${statusId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: updateData,
      }),
      cache: "no-store",
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${updateResponse.status}` } };
      }

      // Si es 404, el tipo de contenido o el estado no existe
      if (updateResponse.status === 404) {
        throw new Error(
          "El estado no fue encontrado o el tipo de contenido 'fleet-statuses' no existe en Strapi."
        );
      }

      throw new Error(
        errorData.error?.message ||
          errorData.message ||
          `Error ${updateResponse.status}: ${updateResponse.statusText}`
      );
    }

    const updatedStatus = await updateResponse.json();

    // Obtener el estado actualizado completo
    const statusQuery = qs.stringify({
      fields: ["id", "documentId", "comment", "authorDocumentId", "createdAt", "updatedAt"],
      populate: {
        images: {
          fields: ["id", "url", "alternativeText"],
        },
      },
    });

    const statusResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-statuses/${statusId}?${statusQuery}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (statusResponse.ok) {
      const statusDataResponse = await statusResponse.json();
      const statusData = statusDataResponse.data;

      // Normalizar imágenes
      const normalizeImages = (
        imagesData: any
      ): Array<{ id?: number; url?: string; alternativeText?: string }> => {
        if (!imagesData) return [];

        if (Array.isArray(imagesData)) {
          return imagesData.map((img: any) => {
            let imageUrl: string | undefined;
            let imageId: number | undefined;
            let imageAlt: string | undefined;

            if (img?.data?.attributes) {
              imageId = img.data.id;
              imageUrl = img.data.attributes.url;
              imageAlt = img.data.attributes.alternativeText;
            } else if (img?.attributes) {
              imageId = img.id;
              imageUrl = img.attributes.url;
              imageAlt = img.attributes.alternativeText;
            } else {
              imageId = img.id;
              imageUrl = img.url;
              imageAlt = img.alternativeText;
            }

            return {
              id: imageId,
              url: imageUrl ? strapiImages.getURL(imageUrl) : undefined,
              alternativeText: imageAlt,
            };
          });
        }

        if (imagesData?.data && Array.isArray(imagesData.data)) {
          return normalizeImages(imagesData.data);
        }

        return [];
      };

      if (statusData.images) {
        statusData.images = normalizeImages(statusData.images);
      }

      // Agregar el autor
      if (statusData.authorDocumentId) {
        if (currentUserProfile && currentUserProfile.documentId === statusData.authorDocumentId) {
          statusData.author = {
            id: 0,
            documentId: currentUserProfile.documentId,
            displayName: currentUserProfile.displayName || currentUserProfile.email || "Usuario",
            email: currentUserProfile.email,
            avatar: currentUserProfile.avatar,
          };
        } else {
          try {
            const authorQuery = qs.stringify({
              filters: {
                documentId: { $eq: statusData.authorDocumentId },
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
                statusData.author = authorData.data[0];
              }
            }
          } catch (error) {
            console.error("Error obteniendo autor para estado actualizado:", error);
          }
        }
      }

      return NextResponse.json({ data: statusData });
    }

    // Fallback: retornar datos básicos
    return NextResponse.json({ data: updatedStatus.data });
  } catch (error) {
    console.error("Error updating vehicle status:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Eliminar un estado
export async function DELETE(_: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("fleet", "canDelete");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const params = await context.params;
    const { statusId } = params;

    if (!statusId) {
      return NextResponse.json({ error: "statusId es requerido" }, { status: 400 });
    }

    const deleteResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-statuses/${statusId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!deleteResponse.ok) {
      const errorText = await deleteResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${deleteResponse.status}` } };
      }
      console.error("Error eliminando estado en Strapi:", {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorData,
        statusId,
      });

      // Si es 404, el tipo de contenido o el estado no existe
      if (deleteResponse.status === 404) {
        throw new Error(
          "El estado no fue encontrado o el tipo de contenido 'fleet-statuses' no existe en Strapi."
        );
      }

      throw new Error(
        errorData.error?.message || `Error ${deleteResponse.status}: ${deleteResponse.statusText}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vehicle status:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
