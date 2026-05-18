import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import {
  fetchInventoryRequestsFromStrapi,
  createInventoryRequestInStrapi,
} from "@/lib/inventory-requests";
import type { InventoryRequestCreatePayload } from "@/validations/inventory-request-types";

export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para ver las solicitudes." },
        { status: 401 }
      );
    }

    const userRole = request.headers.get("x-user-role") || undefined;
    const items = await fetchInventoryRequestsFromStrapi(jwt, userRole || undefined);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching inventory requests:", error);
    return NextResponse.json(
      { error: "No se pudo obtener las solicitudes de piezas." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para crear solicitudes." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { data?: InventoryRequestCreatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos de la solicitud son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    if (!data.inventoryItem) {
      return NextResponse.json(
        { error: "La pieza de inventario es requerida." },
        { status: 400 }
      );
    }

    if (!data.quantity || data.quantity <= 0) {
      return NextResponse.json(
        { error: "La cantidad debe ser mayor a 0." },
        { status: 400 }
      );
    }

    if (!data.justification || data.justification.trim().length < 10) {
      return NextResponse.json(
        { error: "La justificación debe tener al menos 10 caracteres." },
        { status: 400 }
      );
    }

    const item = await createInventoryRequestInStrapi(data, jwt);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear la solicitud.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
