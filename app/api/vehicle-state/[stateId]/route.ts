import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { strapiImages } from "@/lib/strapi-images";
import { requireModulePermission } from "@/lib/module-guard";

interface RouteContext {
  params: Promise<{ stateId: string }>;
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

// PATCH - Editar comentario y/o añadir imágenes (append-only)
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
    const { stateId } = await context.params;
    const body = (await request.json()) as { data?: { comment?: string; images?: number[] } };
    const { comment, images } = body.data || {};

    if (images && images.length > 10) {
      return NextResponse.json(
        { error: "No se permiten más de 10 imágenes por estado." },
        { status: 400 }
      );
    }

    const payload: any = {};
    if (comment !== undefined) payload.comment = comment.trim();
    if (images !== undefined) payload.images = images;

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/vehicle-states/${encodeURIComponent(stateId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: payload }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Error ${response.status}`);
    }

    const json = await response.json();
    const data = json.data;
    if (data?.images) {
      data.images = normalizeImages(data.images);
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error updating vehicle state:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE - Eliminar estado
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
    const { stateId } = await context.params;

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/vehicle-states/${encodeURIComponent(stateId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Error ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting vehicle state:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
