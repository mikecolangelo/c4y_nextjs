import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { requireModulePermission } from "@/lib/module-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireModulePermission("service-orders", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: vehicleId } = await params;
    const body = await request.json();

    const { maintenanceType, laborCost, notes } = body || {};

    if (!maintenanceType) {
      return NextResponse.json({ error: "Se requiere maintenanceType" }, { status: 400 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/service-orders/create-from-maintenance`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vehicleId,
        maintenanceType,
        laborCost,
        notes,
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || data.message || `Strapi error: ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ data: data.data }, { status: 201 });
  } catch (error) {
    console.error("[API /fleet/[id]/maintenance-order POST] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
