import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";

// GET - Listar documentos de un vehículo (filtrado por vehicleDocumentId)
export async function GET(request: Request) {
  try {
    await requireModulePermission("fleet", "canRead");

    const { searchParams } = new URL(request.url);
    const vehicleDocumentId = searchParams.get("vehicleDocumentId");

    if (!vehicleDocumentId) {
      return NextResponse.json({ error: "vehicleDocumentId es requerido" }, { status: 400 });
    }

    const strapiUrl = `${STRAPI_BASE_URL}/api/vehicle-documents?vehicleDocumentId=${encodeURIComponent(
      vehicleDocumentId
    )}`;

    const response = await fetch(strapiUrl, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[vehicle-documents-v2] Error de Strapi:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === "ModulePermissionError") {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    console.error("[vehicle-documents-v2] GET error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Crear un nuevo documento vehicular
export async function POST(request: Request) {
  try {
    await requireModulePermission("fleet", "canCreate");

    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    if (!data.vehicleDocumentId || !data.category) {
      return NextResponse.json(
        { error: "vehicleDocumentId y category son requeridos" },
        { status: 400 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/vehicle-documents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({ data }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[vehicle-documents-v2] POST error:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "ModulePermissionError") {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    console.error("[vehicle-documents-v2] POST error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
