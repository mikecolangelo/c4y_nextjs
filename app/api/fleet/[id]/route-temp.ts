// Endpoint temporal mientras se reconstruye el proyecto
import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    
    // Usar endpoint directo de Strapi v5 para documentId
    const response = await fetch(`${STRAPI_BASE_URL}/api/fleets/${id}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    if (!response.ok) {
      throw new Error(`Strapi error: ${response.status}`);
    }

    const payload = await response.json();
    return NextResponse.json({ data: payload.data });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "No pudimos obtener la información del vehículo." },
      { status: 500 }
    );
  }
}
