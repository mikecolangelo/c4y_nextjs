import { NextResponse } from "next/server";
import {
  fetchInventoryItemsFromStrapi,
  createInventoryItemInStrapi,
} from "@/lib/inventory";
import type { InventoryItemCreatePayload } from "@/validations/types";

export async function GET() {
  try {
    const items = await fetchInventoryItemsFromStrapi();
    return NextResponse.json({ data: items });
  } catch (error) {
    console.error("Error fetching inventory data:", error);
    return NextResponse.json(
      { error: "No se pudo obtener el inventario desde Strapi." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { data?: InventoryItemCreatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del item son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campos requeridos
    if (!data.code) {
      return NextResponse.json(
        { error: "El código del item es requerido." },
        { status: 400 }
      );
    }

    if (!data.description) {
      return NextResponse.json(
        { error: "La descripción del item es requerida." },
        { status: 400 }
      );
    }

    // Validar stock
    if (data.stock === undefined || data.stock === null) {
      return NextResponse.json(
        { error: "El stock del item es requerido." },
        { status: 400 }
      );
    }

    if (typeof data.stock !== "number" || data.stock < 0) {
      return NextResponse.json(
        { error: "El stock debe ser un número válido mayor o igual a 0." },
        { status: 400 }
      );
    }

    // Validar minStock si está presente
    if (data.minStock !== undefined && data.minStock !== null) {
      if (typeof data.minStock !== "number" || data.minStock < 0) {
        return NextResponse.json(
          { error: "El stock mínimo debe ser un número válido mayor o igual a 0." },
          { status: 400 }
        );
      }
    }

    // Validar maxStock si está presente
    if (data.maxStock !== undefined && data.maxStock !== null) {
      if (typeof data.maxStock !== "number" || data.maxStock < 0) {
        return NextResponse.json(
          { error: "El stock máximo debe ser un número válido mayor o igual a 0." },
          { status: 400 }
        );
      }
    }

    // Validar icon si está presente
    if (data.icon !== undefined) {
      if (!["filter", "disc", "bolt", "tire"].includes(data.icon)) {
        return NextResponse.json(
          { error: "El icono debe ser 'filter', 'disc', 'bolt' o 'tire'." },
          { status: 400 }
        );
      }
    }

    const item = await createInventoryItemInStrapi(data);
    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory item:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el item de inventario.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
