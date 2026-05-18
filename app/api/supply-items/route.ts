import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import {
  fetchSupplyItemsFromStrapi,
  createSupplyItemInStrapi,
} from "@/lib/supplies";
import type { SupplyItemCreatePayload } from "@/validations/supply-types";

export async function GET() {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para ver el catálogo." },
        { status: 401 }
      );
    }
    const items = await fetchSupplyItemsFromStrapi(jwt);
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching supply items:", error);
    return NextResponse.json(
      { error: "No se pudo obtener el catálogo de insumos." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { data?: SupplyItemCreatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del insumo son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campos requeridos
    if (!data.name) {
      return NextResponse.json(
        { error: "El nombre del insumo es requerido." },
        { status: 400 }
      );
    }

    if (!data.type) {
      return NextResponse.json(
        { error: "El tipo de insumo es requerido." },
        { status: 400 }
      );
    }

    if (data.stock === undefined || data.stock === null) {
      return NextResponse.json(
        { error: "El stock del insumo es requerido." },
        { status: 400 }
      );
    }

    if (typeof data.stock !== "number" || data.stock < 0) {
      return NextResponse.json(
        { error: "El stock debe ser un número válido mayor o igual a 0." },
        { status: 400 }
      );
    }

    if (!data.unit) {
      return NextResponse.json(
        { error: "La unidad de medida es requerida." },
        { status: 400 }
      );
    }

    const jwt = await getCurrentUserJwt();
    const item = await createSupplyItemInStrapi(data, jwt || undefined);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating supply item:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el insumo.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
