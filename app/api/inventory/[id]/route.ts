import { NextResponse } from "next/server";
import {
  fetchInventoryItemByIdFromStrapi,
  updateInventoryItemInStrapi,
  deleteInventoryItemInStrapi,
} from "@/lib/inventory";
import type { InventoryItemUpdatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const item = await fetchInventoryItemByIdFromStrapi(id);

    if (!item) {
      return NextResponse.json(
        { error: "Item de inventario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    return NextResponse.json(
      { error: "No pudimos obtener la información del item de inventario." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = (await request.json()) as { data?: InventoryItemUpdatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const { id } = await context.params;

    // Validar stock si está presente
    if (body.data.stock !== undefined) {
      if (typeof body.data.stock !== "number" || body.data.stock < 0) {
        return NextResponse.json(
          { error: "El stock debe ser un número válido mayor o igual a 0." },
          { status: 400 }
        );
      }
    }

    // Validar minStock si está presente
    if (body.data.minStock !== undefined && body.data.minStock !== null) {
      if (typeof body.data.minStock !== "number" || body.data.minStock < 0) {
        return NextResponse.json(
          { error: "El stock mínimo debe ser un número válido mayor o igual a 0." },
          { status: 400 }
        );
      }
    }

    // Validar maxStock si está presente
    if (body.data.maxStock !== undefined && body.data.maxStock !== null) {
      if (typeof body.data.maxStock !== "number" || body.data.maxStock < 0) {
        return NextResponse.json(
          { error: "El stock máximo debe ser un número válido mayor o igual a 0." },
          { status: 400 }
        );
      }
    }

    // Validar icon si está presente
    if (body.data.icon !== undefined) {
      if (!["filter", "disc", "bolt", "tire"].includes(body.data.icon)) {
        return NextResponse.json(
          { error: "El icono debe ser 'filter', 'disc', 'bolt' o 'tire'." },
          { status: 400 }
        );
      }
    }

    const updated = await updateInventoryItemInStrapi(id, body.data);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating inventory item:", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el item de inventario. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  // PUT funciona igual que PATCH para compatibilidad
  return PATCH(request, context);
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteInventoryItemInStrapi(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    return NextResponse.json(
      { error: "No pudimos eliminar el item de inventario. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
