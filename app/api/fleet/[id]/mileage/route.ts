import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Historial de kilometraje
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

    const response = await fetch(`${STRAPI_BASE_URL}/api/fleets/${encodeURIComponent(id)}/mileage-history`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Error ${response.status}`);
    }

    const json = await response.json();
    return NextResponse.json({ data: json.data || [] });
  } catch (error) {
    console.error("Error fetching mileage history:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST - Actualizar récord de kilometraje
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
    const { id } = await context.params;
    const body = await request.json();

    const response = await fetch(`${STRAPI_BASE_URL}/api/fleets/${encodeURIComponent(id)}/set-mileage-record`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      try {
        const errJson = JSON.parse(text);
        return NextResponse.json({ error: errJson.error?.message || errJson.message || text }, { status: response.status });
      } catch {
        return NextResponse.json({ error: text || `Error ${response.status}` }, { status: response.status });
      }
    }

    const json = await response.json();
    return NextResponse.json(json);
  } catch (error) {
    console.error("Error setting mileage record:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
