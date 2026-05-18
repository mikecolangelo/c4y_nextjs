import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { approveSupplyRequestInStrapi } from "@/lib/supplies";
import type { SupplyRequestApprovePayload } from "@/validations/supply-types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { data?: SupplyRequestApprovePayload };
    
    // Verificar que el usuario tenga permiso (admin o seller)
    const userRole = request.headers.get("x-user-role");
    if (!["admin", "seller"].includes(userRole || "")) {
      return NextResponse.json(
        { error: "Solo administradores y vendedores pueden aprobar solicitudes." },
        { status: 403 }
      );
    }

    const jwt = await getCurrentUserJwt();
    const item = await approveSupplyRequestInStrapi(id, body.data, jwt || undefined, userRole || undefined);
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error approving supply request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo aprobar la solicitud.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
