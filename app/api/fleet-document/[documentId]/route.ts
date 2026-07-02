import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";

interface RouteContext {
  params: Promise<{
    documentId: string;
  }>;
}

// PUT - Actualizar un documento
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
    const { documentId } = params;

    if (!documentId) {
      return NextResponse.json({ error: "documentId es requerido" }, { status: 400 });
    }

    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json({ error: "Datos de actualización requeridos" }, { status: 400 });
    }

    // Preparar datos para actualizar
    // El documentType se incluye en otherDescription para evitar problemas con relaciones
    const updateData: any = { ...data };

    // Si hay documentType, construir la descripción incluyéndolo
    if (data.documentType) {
      let finalDescription = `[Tipo: ${data.documentType}]`;
      if (data.otherDescription) {
        finalDescription = `${finalDescription} ${data.otherDescription}`;
      }
      updateData.otherDescription = finalDescription;
      // Eliminar documentType del objeto ya que se guarda en otherDescription
      delete updateData.documentType;
    }

    // Timeout para evitar gateway timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    let updateResponse;
    try {
      updateResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-documents/${documentId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        body: JSON.stringify({ data: updateData }),
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

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${updateResponse.status}` } };
      }
      console.error("Error actualizando documento en Strapi:", {
        status: updateResponse.status,
        statusText: updateResponse.statusText,
        error: errorData,
        documentId,
      });

      if (updateResponse.status === 404) {
        throw new Error("El documento no fue encontrado.");
      }

      const errorMessage =
        errorData.error?.message || `Error ${updateResponse.status}: ${updateResponse.statusText}`;
      throw new Error(errorMessage);
    }

    const result = await updateResponse.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error updating fleet document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// DELETE - Eliminar un documento
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
    const { documentId } = params;

    if (!documentId) {
      return NextResponse.json({ error: "documentId es requerido" }, { status: 400 });
    }

    const deleteResponse = await fetch(`${STRAPI_BASE_URL}/api/fleet-documents/${documentId}`, {
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
      console.error("Error eliminando documento en Strapi:", {
        status: deleteResponse.status,
        statusText: deleteResponse.statusText,
        error: errorData,
        documentId,
      });

      // Si es 404, el tipo de contenido o el documento no existe
      if (deleteResponse.status === 404) {
        throw new Error(
          "El documento no fue encontrado o el tipo de contenido 'fleet-documents' no existe en Strapi."
        );
      }

      throw new Error(
        errorData.error?.message || `Error ${deleteResponse.status}: ${deleteResponse.statusText}`
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting fleet document:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
