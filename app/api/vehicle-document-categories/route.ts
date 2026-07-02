import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";

// GET - Obtener todas las categorías de documentos
export async function GET() {
  try {
    try {
      await requireModulePermission("fleet", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const response = await fetch(
      `${STRAPI_BASE_URL}/api/vehicle-document-categories?sort[0]=order:asc`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[vehicle-document-categories] GET error:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result);
  } catch (error) {
    console.error("[vehicle-document-categories] GET error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Crear una nueva categoría
export async function POST(request: Request) {
  try {
    try {
      await requireModulePermission("fleet", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { data } = body;

    if (!data?.name) {
      return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/vehicle-document-categories`, {
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
      console.error("[vehicle-document-categories] POST error:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[vehicle-document-categories] POST error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
