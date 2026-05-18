import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";

/**
 * GET /api/vehicle-selector
 *
 * Devuelve una lista reducida de vehículos para uso en selectores
 * de otros módulos (Billing, Deal, Calendario).
 *
 * Campos devueltos: id, documentId, name, placa, brand, model, year.
 * No requiere rol admin; cualquier usuario autenticado puede usarlo.
 */
export async function GET() {
  try {
    // Validar autenticación (cualquier usuario autenticado)
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const strapiUrl = `${STRAPI_BASE_URL}/api/fleets?fields[0]=name&fields[1]=placa&fields[2]=brand&fields[3]=model&fields[4]=year&sort[0]=name:asc&pagination[pageSize]=1000`;

    const response = await fetch(strapiUrl, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[vehicle-selector] Error de Strapi:", response.status, errorText);
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }

    const result = await response.json();

    // Normalizar respuesta: siempre devolver { data: [...] }
    const vehicles = (result.data || []).map((v: any) => ({
      id: v.id,
      documentId: v.documentId,
      name: v.name,
      placa: v.placa,
      brand: v.brand,
      model: v.model,
      year: v.year,
    }));

    return NextResponse.json({ data: vehicles });
  } catch (error) {
    console.error("[vehicle-selector] GET error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
