import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { fetchFleetVehicleByIdFromStrapi } from "@/lib/fleet";
import { strapiImages } from "@/lib/strapi-images";
import type { VehicleStatusPayload } from "@/validations/types";
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
    id: string;
  }>;
}

// GET - Obtener todos los estados de un vehículo
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

    const vehicle = await fetchFleetVehicleByIdFromStrapi(id);
    if (!vehicle) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

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

    // Obtener los estados del vehículo
    const statusQuery = qs.stringify({
      filters: {
        vehicle: { id: { $eq: vehicleId } },
      },
      fields: ["id", "documentId", "comment", "authorDocumentId", "createdAt", "updatedAt"],
      populate: {
        images: {
          fields: ["id", "url", "alternativeText"],
        },
      },
      sort: ["createdAt:desc"],
    });

    const statusResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-statuses?${statusQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!statusResponse.ok) {
      // Si es 404, el tipo de contenido no existe todavía en Strapi
      // Retornar array vacío en lugar de error
      if (statusResponse.status === 404) {
        console.warn(
          "Tipo de contenido 'fleet-statuses' no encontrado en Strapi. Retornando array vacío."
        );
        return NextResponse.json({ data: [] });
      }

      const errorText = await statusResponse.text();
      console.error("Error obteniendo estados de Strapi:", {
        status: statusResponse.status,
        statusText: statusResponse.statusText,
        errorText,
      });
      throw new Error(
        `No se pudieron obtener los estados: ${errorText || statusResponse.statusText}`
      );
    }

    const statusData = await statusResponse.json();

    // Función helper para normalizar imágenes
    const normalizeImages = (
      imagesData: any
    ): Array<{ id?: number; url?: string; alternativeText?: string }> => {
      if (!imagesData) return [];

      // Si es un array directo
      if (Array.isArray(imagesData)) {
        return imagesData.map((img: any) => {
          let imageUrl: string | undefined;
          let imageId: number | undefined;
          let imageAlt: string | undefined;

          // Si tiene estructura data.attributes
          if (img?.data?.attributes) {
            imageId = img.data.id;
            imageUrl = img.data.attributes.url;
            imageAlt = img.data.attributes.alternativeText;
          }
          // Si es un objeto directo con attributes
          else if (img?.attributes) {
            imageId = img.id;
            imageUrl = img.attributes.url;
            imageAlt = img.attributes.alternativeText;
          }
          // Si ya está normalizado
          else {
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

      // Si es un objeto con data que contiene array
      if (imagesData?.data && Array.isArray(imagesData.data)) {
        return normalizeImages(imagesData.data);
      }

      return [];
    };

    // Buscar el usuario para cada estado usando authorDocumentId
    const statusesWithAuthor = await Promise.all(
      (statusData.data || []).map(async (status: any) => {
        // Normalizar imágenes
        if (status.images) {
          status.images = normalizeImages(status.images);
        }

        if (status.authorDocumentId) {
          try {
            const authorQuery = qs.stringify({
              filters: {
                documentId: { $eq: status.authorDocumentId },
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
                status.author = authorData.data[0];
              }
            }
          } catch (error) {
            console.error("Error obteniendo autor para estado:", error);
          }
        }
        return status;
      })
    );

    return NextResponse.json({ data: statusesWithAuthor || [] });
  } catch (error) {
    console.error("Error fetching vehicle statuses:", error);
    return NextResponse.json({ error: "No pudimos obtener los estados." }, { status: 500 });
  }
}

// POST - Crear un nuevo estado
export async function POST(request: Request, context: RouteContext) {
  console.log("🚀 POST /api/fleet/[id]/status ejecutado");
  try {
    try {
      await requireModulePermission("fleet", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as { data?: VehicleStatusPayload };

    if (!body?.data) {
      return NextResponse.json({ error: "Los datos del estado son requeridos." }, { status: 400 });
    }

    // Validar que al menos haya imágenes o comentario
    if ((!body.data.images || body.data.images.length === 0) && !body.data.comment?.trim()) {
      return NextResponse.json(
        { error: "Debes proporcionar al menos una imagen o un comentario." },
        { status: 400 }
      );
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

    const currentUserProfile = await getCurrentUserProfile();

    let authorDocumentId =
      body.data.authorDocumentId && body.data.authorDocumentId !== null
        ? body.data.authorDocumentId
        : undefined;

    if (!authorDocumentId) {
      authorDocumentId = currentUserProfile?.documentId;
    }

    // Preparar los datos del estado
    const statusData: {
      comment?: string;
      images?: number[];
      authorDocumentId?: string;
      vehicle: number;
    } = {
      vehicle: vehicleId,
    };

    if (body.data.comment) {
      statusData.comment = body.data.comment;
    }

    if (body.data.images && body.data.images.length > 0) {
      statusData.images = body.data.images;
    }

    if (authorDocumentId) {
      statusData.authorDocumentId = authorDocumentId;
    }

    // Verificar si el tipo de contenido existe antes de intentar crear
    const checkContentTypeResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-statuses?pagination[limit]=1`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    // Si el tipo de contenido no existe (404 o 405), informar al usuario
    if (checkContentTypeResponse.status === 404 || checkContentTypeResponse.status === 405) {
      throw new Error(
        "El tipo de contenido 'fleet-statuses' no existe en Strapi. Por favor, créalo en Content-Type Builder con los campos: comment (Text), images (Media múltiple), authorDocumentId (Text), y vehicle (Relation a Fleet)."
      );
    }

    const newStatusResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-statuses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: statusData,
      }),
      cache: "no-store",
    });

    if (!newStatusResponse.ok) {
      const errorText = await newStatusResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${newStatusResponse.status}` } };
      }

      // Si es 404, el tipo de contenido no existe en Strapi
      if (newStatusResponse.status === 404) {
        throw new Error(
          "El tipo de contenido 'fleet-statuses' no existe en Strapi. Por favor, créalo primero en el panel de administración de Strapi."
        );
      }

      // Si es 405 (Method Not Allowed), el tipo de contenido no existe o no tiene permisos
      if (newStatusResponse.status === 405) {
        throw new Error(
          "El tipo de contenido 'fleet-statuses' no existe en Strapi o no tiene permisos configurados. Por favor, créalo y configura los permisos en Settings → Roles → Public/Authenticated → Permissions → fleet-statuses → Create."
        );
      }

      console.error("Error de Strapi al crear estado:", {
        status: newStatusResponse.status,
        statusText: newStatusResponse.statusText,
        errorText,
        errorData,
      });

      throw new Error(
        errorData.error?.message ||
          errorData.message ||
          `Error ${newStatusResponse.status}: ${newStatusResponse.statusText}`
      );
    }

    const newStatus = await newStatusResponse.json();

    if (newStatus.data) {
      // Obtener el estado completo con imágenes
      const statusQuery = qs.stringify({
        fields: ["id", "documentId", "comment", "authorDocumentId", "createdAt", "updatedAt"],
        populate: {
          images: {
            fields: ["id", "url", "alternativeText"],
          },
        },
      });

      const createdStatusResponse = await fetch(
        `${STRAPI_BASE_URL}/api/fleet-statuses/${newStatus.data.id}?${statusQuery}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          },
          cache: "no-store",
        }
      );

      if (createdStatusResponse.ok) {
        const createdStatus = await createdStatusResponse.json();
        const statusData = createdStatus.data;

        // Normalizar imágenes
        if (statusData.images) {
          const normalizeImagesForStatus = (
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
              return normalizeImagesForStatus(imagesData.data);
            }

            return [];
          };

          statusData.images = normalizeImagesForStatus(statusData.images);
        }

        // Agregar el autor si está disponible
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
              console.error("Error obteniendo autor para estado creado:", error);
            }
          }
        }

        return NextResponse.json({ data: statusData }, { status: 201 });
      }

      // Fallback: construir respuesta básica
      const fallbackStatusData = {
        ...newStatus.data,
      };

      // Normalizar imágenes en el fallback también
      if (fallbackStatusData.images) {
        const normalizeImagesForFallback = (
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
            return normalizeImagesForFallback(imagesData.data);
          }

          return [];
        };

        fallbackStatusData.images = normalizeImagesForFallback(fallbackStatusData.images);
      }

      if (
        newStatus.data.authorDocumentId &&
        currentUserProfile &&
        currentUserProfile.documentId === newStatus.data.authorDocumentId
      ) {
        fallbackStatusData.author = {
          id: 0,
          documentId: currentUserProfile.documentId,
          displayName: currentUserProfile.displayName || currentUserProfile.email || "Usuario",
          email: currentUserProfile.email,
          avatar: currentUserProfile.avatar,
        };
      }

      return NextResponse.json({ data: fallbackStatusData }, { status: 201 });
    }

    throw new Error("La respuesta de Strapi no contiene los datos esperados");
  } catch (error) {
    console.error("Error creating vehicle status:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Error desconocido al crear el estado";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
