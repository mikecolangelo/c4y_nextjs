import { NextResponse } from "next/server";
import { createDealDiscountInStrapi, deleteDealDiscountInStrapi } from "@/lib/deal";
import type { DealDiscountCreatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: dealId } = await context.params;
    const body = (await request.json()) as { data?: Omit<DealDiscountCreatePayload, "deal"> };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del descuento son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campo requerido: title
    if (!data.title) {
      return NextResponse.json(
        { error: "El título del descuento es requerido." },
        { status: 400 }
      );
    }

    // Validar campo requerido: amount
    if (data.amount === undefined || data.amount === null) {
      return NextResponse.json(
        { error: "El monto del descuento es requerido." },
        { status: 400 }
      );
    }

    // Validar amount no negativo
    if (data.amount < 0) {
      return NextResponse.json(
        { error: "El monto del descuento no puede ser negativo." },
        { status: 400 }
      );
    }

    const discount = await createDealDiscountInStrapi({
      ...data,
      deal: dealId,
    });

    return NextResponse.json({ data: discount }, { status: 201 });
  } catch (error) {
    console.error("Error creating deal discount:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el descuento.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, _context: RouteContext) {
  try {
    const url = new URL(request.url);
    const discountId = url.searchParams.get("discountId");

    if (!discountId) {
      return NextResponse.json(
        { error: "El ID del descuento es requerido (discountId query param)." },
        { status: 400 }
      );
    }

    await deleteDealDiscountInStrapi(discountId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal discount:", error);
    return NextResponse.json(
      { error: "No pudimos eliminar el descuento. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
