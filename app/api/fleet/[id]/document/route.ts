import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { fetchFleetVehicleByIdFromStrapi } from "@/lib/fleet";
import { strapiImages } from "@/lib/strapi-images";
import type { FleetDocumentPayload } from "@/validations/types";
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

// GET - Obtener todos los documentos de un vehículo
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

    // Obtener los documentos del vehículo
    const documentQuery = qs.stringify({
      filters: {
        vehicle: { id: { $eq: vehicleId } },
      },
      fields: [
        "id",
        "documentId",
        "documentType",
        "otherDescription",
        "authorDocumentId",
        "createdAt",
        "updatedAt",
      ],
      populate: {
        files: {
          fields: ["id", "url", "name", "mime", "size", "alternativeText"],
        },
      },
      sort: ["createdAt:desc"],
    });

    const documentResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-documents?${documentQuery}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!documentResponse.ok) {
      // Si es 404, el tipo de contenido no existe todavía en Strapi
      // Retornar array vacío en lugar de error
      if (documentResponse.status === 404) {
        console.warn(
          "Tipo de contenido 'fleet-documents' no encontrado en Strapi. Retornando array vacío."
        );
        return NextResponse.json({ data: [] });
      }

      const errorText = await documentResponse.text();
      console.error("Error obteniendo documentos de Strapi:", {
        status: documentResponse.status,
        statusText: documentResponse.statusText,
        errorText,
      });
      throw new Error(
        `No se pudieron obtener los documentos: ${errorText || documentResponse.statusText}`
      );
    }

    const documentData = await documentResponse.json();

    // Función helper para normalizar archivos
    const normalizeFiles = (
      filesData: any
    ): Array<{
      id?: number;
      url?: string;
      name?: string;
      mime?: string;
      size?: number;
      alternativeText?: string;
    }> => {
      if (!filesData) return [];

      // Si es un array directo
      if (Array.isArray(filesData)) {
        return filesData.map((file: any) => {
          let fileUrl: string | undefined;
          let fileId: number | undefined;
          let fileName: string | undefined;
          let fileMime: string | undefined;
          let fileSize: number | undefined;
          let fileAlt: string | undefined;

          // Si tiene estructura data.attributes
          if (file?.data?.attributes) {
            fileId = file.data.id;
            fileUrl = file.data.attributes.url;
            fileName = file.data.attributes.name;
            fileMime = file.data.attributes.mime;
            fileSize = file.data.attributes.size;
            fileAlt = file.data.attributes.alternativeText;
          }
          // Si es un objeto directo con attributes
          else if (file?.attributes) {
            fileId = file.id;
            fileUrl = file.attributes.url;
            fileName = file.attributes.name;
            fileMime = file.attributes.mime;
            fileSize = file.attributes.size;
            fileAlt = file.attributes.alternativeText;
          }
          // Si ya está normalizado
          else {
            fileId = file.id;
            fileUrl = file.url;
            fileName = file.name;
            fileMime = file.mime;
            fileSize = file.size;
            fileAlt = file.alternativeText;
          }

          return {
            id: fileId,
            url: fileUrl ? strapiImages.getURL(fileUrl) : undefined,
            name: fileName,
            mime: fileMime,
            size: fileSize,
            alternativeText: fileAlt,
          };
        });
      }

      // Si es un objeto con data que contiene array
      if (filesData?.data && Array.isArray(filesData.data)) {
        return normalizeFiles(filesData.data);
      }

      return [];
    };

    // Buscar el usuario para cada documento usando authorDocumentId
    const documentsWithAuthor = await Promise.all(
      (documentData.data || []).map(async (document: any) => {
        // Normalizar archivos
        if (document.files) {
          document.files = normalizeFiles(document.files);
        }

        if (document.authorDocumentId) {
          try {
            const authorQuery = qs.stringify({
              filters: {
                documentId: { $eq: document.authorDocumentId },
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
                document.author = authorData.data[0];
              }
            }
          } catch (error) {
            console.error("Error obteniendo autor para documento:", error);
          }
        }

        return document;
      })
    );

    return NextResponse.json({ data: documentsWithAuthor });
  } catch (error) {
    console.error("Error obteniendo documentos del vehículo:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST - Crear un nuevo documento
export async function POST(request: Request, context: RouteContext) {
  try {
    await requireModulePermission("fleet", "canCreate");
  } catch {
    return NextResponse.json(
      { error: "Acceso restringido: Se requieren permisos de administrador" },
      { status: 403 }
    );
  }
  console.log("🚀 POST /api/fleet/[id]/document ejecutado");
  try {
    const body = (await request.json()) as { data?: FleetDocumentPayload };
    console.log("📦 Body recibido:", JSON.stringify(body, null, 2));

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del documento son requeridos." },
        { status: 400 }
      );
    }

    // Validar que haya archivos
    if (!body.data.files || body.data.files.length === 0) {
      return NextResponse.json(
        { error: "Debes proporcionar al menos un archivo." },
        { status: 400 }
      );
    }

    // Validar que haya un tipo de documento
    if (!body.data.documentType) {
      return NextResponse.json(
        { error: "Debes seleccionar un tipo de documento." },
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

    // Normalizar documentType a ID numérico — Strapi v5 requiere número para relaciones
    const rawDocumentType = body.data.documentType;
    const documentTypeId =
      typeof rawDocumentType === "number"
        ? rawDocumentType
        : typeof rawDocumentType === "string"
          ? Number(rawDocumentType)
          : NaN;

    if (isNaN(documentTypeId)) {
      return NextResponse.json(
        { error: "El tipo de documento debe proporcionarse como ID numérico." },
        { status: 400 }
      );
    }

    const currentUserProfile = await getCurrentUserProfile();

    let authorDocumentId =
      body.data.authorDocumentId && body.data.authorDocumentId !== null
        ? body.data.authorDocumentId
        : undefined;

    if (!authorDocumentId) {
      authorDocumentId = currentUserProfile?.documentId;
    }

    if (!authorDocumentId) {
      return NextResponse.json(
        {
          error:
            "No se pudo obtener la información del usuario. Por favor, inicia sesión nuevamente.",
        },
        { status: 401 }
      );
    }

    // Preparar los datos del documento
    // Strapi v5 requiere relaciones en formato { connect: [{ id }] }
    const documentData: {
      files: number[];
      authorDocumentId: string;
      vehicle: { connect: [{ id: number }] };
      documentType: { connect: [{ id: number | string }] };
      otherDescription?: string;
    } = {
      files: body.data.files,
      authorDocumentId: authorDocumentId,
      vehicle: { connect: [{ id: vehicleId }] },
      documentType: { connect: [{ id: documentTypeId }] },
    };

    // Construir la descripción adicional si existe
    if (body.data.otherDescription) {
      documentData.otherDescription = body.data.otherDescription;
    }

    console.log("📤 Enviando a Strapi:", JSON.stringify({ data: documentData }, null, 2));

    // Verificar que el tipo de contenido existe antes de crear
    const contentTypeCheck = await fetch(`${STRAPI_BASE_URL}/api/fleet-documents`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (contentTypeCheck.status === 404) {
      return NextResponse.json(
        {
          error:
            "El tipo de contenido 'fleet-documents' no existe en Strapi. Por favor, reinicia el servidor de Strapi.",
        },
        { status: 404 }
      );
    }

    // Crear el documento con timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 segundos timeout

    let createResponse;
    try {
      createResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: documentData,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      if (fetchError.name === "AbortError") {
        throw new Error("La operación tardó demasiado. El servidor no respondió a tiempo.");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${createResponse.status}` } };
      }

      // Si es 404, el tipo de contenido no existe
      if (createResponse.status === 404) {
        throw new Error(
          "El tipo de contenido 'fleet-documents' no existe en Strapi. Por favor, reinicia el servidor de Strapi."
        );
      }

      // Si es 405, el método no está permitido
      if (createResponse.status === 405) {
        throw new Error(
          "El método POST no está permitido en esta ruta. Por favor, reinicia el servidor de desarrollo."
        );
      }

      console.error("❌ Error de Strapi:", {
        status: createResponse.status,
        errorData,
        errorText,
      });

      const errorMessage =
        errorData.error?.message ||
        errorData.message ||
        `Error ${createResponse.status}: ${createResponse.statusText}`;

      throw new Error(errorMessage);
    }

    const createdDocument = await createResponse.json();
    const createdDocumentData = createdDocument.data;

    // Obtener el documento completo con archivos normalizados
    const getDocumentQuery = qs.stringify({
      fields: [
        "id",
        "documentId",
        "documentType",
        "otherDescription",
        "authorDocumentId",
        "createdAt",
        "updatedAt",
      ],
      populate: {
        files: {
          fields: ["id", "url", "name", "mime", "size", "alternativeText"],
        },
      },
    });

    const getDocumentResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleet-documents/${createdDocumentData.id}?${getDocumentQuery}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (getDocumentResponse.ok) {
      const documentDataResponse = await getDocumentResponse.json();
      const fullDocumentData = documentDataResponse.data;

      // Normalizar archivos
      const normalizeFiles = (
        filesData: any
      ): Array<{
        id?: number;
        url?: string;
        name?: string;
        mime?: string;
        size?: number;
        alternativeText?: string;
      }> => {
        if (!filesData) return [];

        if (Array.isArray(filesData)) {
          return filesData.map((file: any) => {
            let fileUrl: string | undefined;
            let fileId: number | undefined;
            let fileName: string | undefined;
            let fileMime: string | undefined;
            let fileSize: number | undefined;
            let fileAlt: string | undefined;

            if (file?.data?.attributes) {
              fileId = file.data.id;
              fileUrl = file.data.attributes.url;
              fileName = file.data.attributes.name;
              fileMime = file.data.attributes.mime;
              fileSize = file.data.attributes.size;
              fileAlt = file.data.attributes.alternativeText;
            } else if (file?.attributes) {
              fileId = file.id;
              fileUrl = file.attributes.url;
              fileName = file.attributes.name;
              fileMime = file.attributes.mime;
              fileSize = file.attributes.size;
              fileAlt = file.attributes.alternativeText;
            } else {
              fileId = file.id;
              fileUrl = file.url;
              fileName = file.name;
              fileMime = file.mime;
              fileSize = file.size;
              fileAlt = file.alternativeText;
            }

            return {
              id: fileId,
              url: fileUrl ? strapiImages.getURL(fileUrl) : undefined,
              name: fileName,
              mime: fileMime,
              size: fileSize,
              alternativeText: fileAlt,
            };
          });
        }

        if (filesData?.data && Array.isArray(filesData.data)) {
          return normalizeFiles(filesData.data);
        }

        return [];
      };

      if (fullDocumentData.files) {
        fullDocumentData.files = normalizeFiles(fullDocumentData.files);
      }

      // Agregar el autor
      if (
        currentUserProfile &&
        currentUserProfile.documentId === fullDocumentData.authorDocumentId
      ) {
        fullDocumentData.author = {
          id: 0,
          documentId: currentUserProfile.documentId,
          displayName: currentUserProfile.displayName || currentUserProfile.email || "Usuario",
          email: currentUserProfile.email,
          avatar: currentUserProfile.avatar,
        };
      } else if (fullDocumentData.authorDocumentId) {
        try {
          const authorQuery = qs.stringify({
            filters: {
              documentId: { $eq: fullDocumentData.authorDocumentId },
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
              fullDocumentData.author = authorData.data[0];
            }
          }
        } catch (error) {
          console.error("Error obteniendo autor para documento creado:", error);
        }
      }

      return NextResponse.json({ data: fullDocumentData });
    }

    // Fallback: retornar datos básicos
    return NextResponse.json({ data: createdDocumentData });
  } catch (error) {
    console.error("Error creando documento del vehículo:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
