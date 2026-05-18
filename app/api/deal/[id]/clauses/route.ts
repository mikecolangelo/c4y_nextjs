import { NextResponse } from "next/server";
import { createDealClauseInStrapi, deleteDealClauseInStrapi } from "@/lib/deal";
import type { DealClauseCreatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: dealId } = await context.params;
    const body = (await request.json()) as { data?: Omit<DealClauseCreatePayload, "deal"> };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos de la cláusula son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campo requerido: title
    if (!data.title) {
      return NextResponse.json(
        { error: "El título de la cláusula es requerido." },
        { status: 400 }
      );
    }

    const clause = await createDealClauseInStrapi({
      ...data,
      deal: dealId,
    });

    return NextResponse.json({ data: clause }, { status: 201 });
  } catch (error) {
    console.error("Error creating deal clause:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear la cláusula.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, _context: RouteContext) {
  try {
    const url = new URL(request.url);
    const clauseId = url.searchParams.get("clauseId");

    if (!clauseId) {
      return NextResponse.json(
        { error: "El ID de la cláusula es requerido (clauseId query param)." },
        { status: 400 }
      );
    }

    await deleteDealClauseInStrapi(clauseId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal clause:", error);
    return NextResponse.json(
      { error: "No pudimos eliminar la cláusula. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
