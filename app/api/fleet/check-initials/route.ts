import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { requireAdmin } from "@/lib/admin-guard";

/**
 * GET /api/fleet/check-initials?initials=FM&excludeId=xxx
 * Verifica si las siglas de facturación ya existen en otro vehículo
 */
export async function GET(request: Request) {
  try {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(request.url);
    const initials = searchParams.get("initials")?.trim().toUpperCase();
    const excludeId = searchParams.get("excludeId"); // Para excluir el vehículo actual en edición

    if (!initials) {
      return NextResponse.json(
        { error: "Las siglas son requeridas" },
        { status: 400 }
      );
    }

    // Consultar Strapi para verificar si existe
    const query = qs.stringify({
      filters: {
        billingInitials: { $eq: initials },
        ...(excludeId && {
          documentId: { $ne: excludeId },
        }),
      },
      fields: ["id", "documentId", "name", "billingInitials"],
      pagination: { pageSize: 1 },
    }, { encodeValuesOnly: true });

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/fleets?${query}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error checking initials:", {
        status: response.status,
        error: errorText,
      });
      throw new Error("Error verificando siglas");
    }

    const data = await response.json();
    const existing = data.data?.[0] || null;

    return NextResponse.json({
      exists: !!existing,
      existingVehicle: existing
        ? {
            id: existing.id,
            documentId: existing.documentId,
            name: existing.name || existing.attributes?.name,
            billingInitials: existing.billingInitials || existing.attributes?.billingInitials,
          }
        : null,
    });
  } catch (error) {
    console.error("Error checking billing initials:", error);
    return NextResponse.json(
      { error: "Error verificando siglas" },
      { status: 500 }
    );
  }
}
