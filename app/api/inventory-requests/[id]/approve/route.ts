import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { approveInventoryRequestInStrapi } from "@/lib/inventory-requests";
import type { InventoryRequestApprovePayload } from "@/validations/inventory-request-types";

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
    const body = (await request.json()) as { data?: InventoryRequestApprovePayload };

    const item = await approveInventoryRequestInStrapi(
      params.id,
      body?.data,
      jwt,
      userRole || undefined
    );
    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error approving inventory request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo aprobar la solicitud.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
