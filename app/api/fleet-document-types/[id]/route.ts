import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PUT - Actualizar un tipo de documento
export async function PUT(request: Request, context: RouteContext) {
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
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json({ error: "Datos de actualización requeridos" }, { status: 400 });
    }

    const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-document-types/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({ data }),
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
      console.error("Error actualizando tipo de documento en Strapi:", {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        error: errorData,
        id,
      });

      if (updateResponse.status === 404) {
        return NextResponse.json(
          { error: "El tipo de documento no fue encontrado o el tipo de contenido no existe." },
          { status: 404 }
        );
      }

      throw new Error(
        errorData.error?.message || `Error ${updateResponse.status}: ${updateResponse.statusText}`
      );
    }

    const result = await updateResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating fleet document type:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Eliminar un tipo de documento
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
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: "ID es requerido" }, { status: 400 });
    }

    const deleteResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-document-types/${id}`, {
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
      console.error("Error eliminando tipo de documento en Strapi:", {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorData,
        id,
      });

      if (deleteResponse.status === 404) {
        return NextResponse.json(
          { error: "El tipo de documento no fue encontrado o el tipo de contenido no existe." },
          { status: 404 }
        );
      }

      throw new Error(
        errorData.error?.message || `Error ${deleteResponse.status}: ${deleteResponse.statusText}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fleet document type:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
