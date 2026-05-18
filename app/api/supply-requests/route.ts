import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import {
  fetchSupplyRequestsFromStrapi,
  createSupplyRequestInStrapi,
} from "@/lib/supplies";
import type { SupplyRequestCreatePayload } from "@/validations/supply-types";

export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para ver las solicitudes." },
        { status: 401 }
      );
    }

    // Obtener el rol del usuario desde los headers (seteado por middleware)
    const userRole = request.headers.get("x-user-role") || undefined;
    
    const items = await fetchSupplyRequestsFromStrapi(jwt, userRole || undefined);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching supply requests:", error);
    return NextResponse.json(
      { error: "No se pudo obtener las solicitudes de insumos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    // Obtener JWT del usuario autenticado
    const jwt = await getCurrentUserJwt();
    
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para crear solicitudes." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { data?: SupplyRequestCreatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos de la solicitud son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campos requeridos
    if (!data.type) {
      return NextResponse.json(
        { error: "El tipo de insumo es requerido." },
        { status: 400 }
      );
    }

    if (!data.quantity || data.quantity < 1) {
      return NextResponse.json(
        { error: "La cantidad debe ser al menos 1." },
        { status: 400 }
      );
    }

    if (!data.unit) {
      return NextResponse.json(
        { error: "La unidad de medida es requerida." },
        { status: 400 }
      );
    }

    if (!data.justification || data.justification.trim().length < 10) {
      return NextResponse.json(
        { error: "La justificación debe tener al menos 10 caracteres." },
        { status: 400 }
      );
    }

    // Crear solicitud pasando el JWT del usuario
    const item = await createSupplyRequestInStrapi(data, jwt);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating supply request:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear la solicitud.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
