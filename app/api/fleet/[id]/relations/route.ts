import { NextResponse } from "next/server";
import { requireModulePermission } from "@/lib/module-guard";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// PUT /api/fleet/[id]/relations - Actualizar relaciones directamente
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
    const body = await request.json();
    const { id } = await context.params;

    const STRAPI_BASE_URL = process.env.STRAPI_BASE_URL || "http://localhost:1337";
    const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN;

    if (!STRAPI_API_TOKEN) {
      return NextResponse.json({ error: "Token no configurado" }, { status: 500 });
    }

    // Construir el payload solo con campos de relación
    const relationPayload: any = {};
    const relationFields = [
      "responsables",
      "assignedDrivers",
      "interestedDrivers",
      "currentDrivers",
    ];

    for (const field of relationFields) {
      if (field in body && Array.isArray(body[field])) {
        const numericIds = body[field]
          .map((id: any) => (typeof id === "number" ? id : parseInt(id, 10)))
          .filter((id: any) => !isNaN(id));

        if (numericIds.length > 0) {
          relationPayload[field] = { connect: numericIds };
        } else {
          relationPayload[field] = { disconnect: [] };
        }
      }
    }

    if (Object.keys(relationPayload).length === 0) {
      return NextResponse.json({ error: "No hay relaciones para actualizar" }, { status: 400 });
    }

    console.log("[fleet/relations] Actualizando relaciones:", {
      id,
      payload: relationPayload,
    });

    // Primero, obtener el documentId del vehículo
    const vehicleResponse = await fetch(
      `${STRAPI_BASE_URL}/api/fleets?filters[id][$eq]=${id}&fields[0]=documentId`,
      {
        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      }
    );

    if (!vehicleResponse.ok) {
      const errorText = await vehicleResponse.text();
      console.error("[fleet/relations] Error buscando vehículo:", errorText);
      return NextResponse.json({ error: "Vehículo no encontrado" }, { status: 404 });
    }

    const vehicleData = await vehicleResponse.json();
    const documentId = vehicleData.data?.[0]?.documentId;

    if (!documentId) {
      return NextResponse.json({ error: "DocumentId no encontrado" }, { status: 404 });
    }

    // Actualizar relaciones usando el endpoint de Strapi
    const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/fleets/${documentId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: relationPayload }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error("[fleet/relations] Error actualizando:", {
        status: updateResponse.status,
        error: errorText,
      });
      return NextResponse.json(
        { error: `Error de Strapi: ${errorText}` },
        { status: updateResponse.status }
      );
    }

    const result = await updateResponse.json();
    return NextResponse.json({ data: result.data });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("[fleet/relations] Error:", error);
    return NextResponse.json({ error: `Error interno: ${errorMessage}` }, { status: 500 });
  }
}
