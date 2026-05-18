import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { deliverInventoryRequestInStrapi } from "@/lib/inventory-requests";

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado." },
        { status: 401 }
      );
    }

    const userRole = request.headers.get("x-user-role") || undefined;

    const item = await deliverInventoryRequestInStrapi(
      params.id,
      jwt,
      userRole || undefined
    );
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error delivering inventory request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo marcar como entregado.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
