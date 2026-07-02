import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { logger } from "@/lib/logger";

// POST - Calcular el impacto de eliminar múltiples perfiles de contacto.
// Reenvía al endpoint de Strapi y devuelve el conteo de registros relacionados
// afectados para mostrarlo en el diálogo de confirmación.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "Payload inválido. Envía un array de ids dentro de body.ids." },
        { status: 400 }
      );
    }

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para realizar esta acción." },
        { status: 401 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/deletion-impact`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids: body.ids }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      logger.error({ status: response.status, errorText }, "deletion-impact upstream error");
      return NextResponse.json(
        { error: errorText || "No se pudo calcular el impacto de la eliminación." },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    logger.error({ error }, "Failed to compute deletion impact");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
