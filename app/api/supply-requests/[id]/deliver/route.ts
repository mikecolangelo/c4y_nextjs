import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { deliverSupplyRequestInStrapi } from "@/lib/supplies";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    
    // Verificar que el usuario tenga permiso (admin o seller)
    const userRole = request.headers.get("x-user-role");
    if (!["admin", "seller"].includes(userRole || "")) {
      return NextResponse.json(
        { error: "Solo administradores y vendedores pueden marcar como entregado." },
        { status: 403 }
      );
    }

    const jwt = await getCurrentUserJwt();
    const item = await deliverSupplyRequestInStrapi(id, jwt || undefined, userRole || undefined);
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error delivering supply request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo marcar como entregado.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
