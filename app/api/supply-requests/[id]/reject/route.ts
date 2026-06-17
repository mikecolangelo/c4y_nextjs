import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { rejectSupplyRequestInStrapi } from "@/lib/supplies";
import type { SupplyRequestRejectPayload } from "@/validations/supply-types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { data?: SupplyRequestRejectPayload };
    
    // Verificar que el usuario tenga permiso (solo admin)
    const userRole = request.headers.get("x-user-role");
    if (!["admin"].includes(userRole || "")) {
      return NextResponse.json(
        { error: "Solo administradores pueden rechazar solicitudes." },
        { status: 403 }
      );
    }

    const jwt = await getCurrentUserJwt();
    const item = await rejectSupplyRequestInStrapi(id, body.data, jwt || undefined, userRole || undefined);
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error rejecting supply request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo rechazar la solicitud.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
