import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { strapiImages } from "@/lib/strapi-images";
import { requireAdmin } from "@/lib/admin-guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

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

// GET - Obtener estados de un vehículo
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
    const { id } = await context.params;

    const query = qs.stringify({
      filters: {
        vehicle: { documentId: { $eq: id } },
      },
      fields: [
        "id",
        "documentId",
        "comment",
        "authorDocumentId",
        "mileage",
        "createdAt",
        "updatedAt",
      ],
      populate: {
        images: {
          fields: ["id", "url", "alternativeText"],
        },
      },
      sort: ["createdAt:desc"],
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/vehicle-states?${query}`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ data: [] });
      }
      throw new Error("Error obteniendo estados del vehículo");
    }

    const json = await response.json();
    const data = (json.data || []).map((status: any) => {
      if (status.images) {
        status.images = normalizeImages(status.images);
      }
      return status;
    });

    // Enriquecer con autor
    const enriched = await Promise.all(
      data.map(async (status: any) => {
        if (status.authorDocumentId) {
          try {
            const authorQuery = qs.stringify({
              filters: { documentId: { $eq: status.authorDocumentId } },
              fields: ["id", "documentId", "displayName", "email"],
              populate: { avatar: { fields: ["url", "alternativeText"] } },
            });
            const authorRes = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${authorQuery}`, {
              headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
              cache: "no-store",
            });
            if (authorRes.ok) {
              const authorJson = await authorRes.json();
              if (authorJson.data?.[0]) {
                status.author = authorJson.data[0];
              }
            }
          } catch {
            // noop
          }
        }
        return status;
      })
    );

    return NextResponse.json({ data: enriched });
  } catch (error) {
    console.error("Error fetching vehicle states:", error);
    return NextResponse.json({ error: "No pudimos obtener los estados." }, { status: 500 });
  }
}

// POST - Crear un nuevo estado
export async function POST(request: Request, context: RouteContext) {
  try {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = (await request.json()) as {
      data?: { comment?: string; images?: number[]; authorDocumentId?: string; mileage?: number };
    };
    if (!body?.data) {
      return NextResponse.json({ error: "Los datos del estado son requeridos." }, { status: 400 });
    }

    const { comment, images, authorDocumentId, mileage } = body.data;

    if ((!images || images.length === 0) && !comment?.trim()) {
      return NextResponse.json(
        { error: "Debes proporcionar al menos una imagen o un comentario." },
        { status: 400 }
      );
    }

    if (images && images.length > 10) {
      return NextResponse.json(
        { error: "No se permiten más de 10 imágenes por estado." },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    // Resolver vehículo por documentId (incluye currentMileage para anclar el estado)
    const vehicleQuery = qs.stringify({
      filters: { documentId: { $eq: id } },
      fields: ["id", "currentMileage"],
    });

    const vehicleRes = await fetch(`${STRAPI_BASE_URL}/api/fleets?${vehicleQuery}`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });

    if (!vehicleRes.ok) throw new Error("No se pudo obtener el vehículo");
    const vehicleJson = await vehicleRes.json();
    const vehicleRecord = vehicleJson.data?.[0];
    const vehicleId = vehicleRecord?.id;

    if (!vehicleId) {
      return NextResponse.json({ error: "Vehículo no encontrado." }, { status: 404 });
    }

    // Anclar el estado al kilometraje: usar el enviado o el actual del vehículo
    const resolvedMileage =
      typeof mileage === "number" && !isNaN(mileage)
        ? mileage
        : typeof vehicleRecord?.currentMileage === "number"
          ? vehicleRecord.currentMileage
          : parseInt(vehicleRecord?.currentMileage ?? "", 10);

    const payload: any = {
      vehicle: vehicleId,
      authorDocumentId: authorDocumentId || "system",
    };
    if (comment?.trim()) payload.comment = comment.trim();
    if (images && images.length > 0) payload.images = images;
    if (typeof resolvedMileage === "number" && !isNaN(resolvedMileage)) {
      payload.mileage = resolvedMileage;
    }

    const createRes = await fetch(`${STRAPI_BASE_URL}/api/vehicle-states`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: payload }),
      cache: "no-store",
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(text || `Error ${createRes.status}`);
    }

    const created = await createRes.json();
    const statusData = created.data;
    if (statusData?.images) {
      statusData.images = normalizeImages(statusData.images);
    }

    return NextResponse.json({ data: statusData }, { status: 201 });
  } catch (error) {
    console.error("Error creating vehicle state:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido al crear el estado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
