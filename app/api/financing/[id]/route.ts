import { NextResponse } from "next/server";
import {
  fetchFinancingByIdFromStrapi,
  updateFinancingInStrapi,
  deleteFinancingFromStrapi,
  type FinancingStatus,
} from "@/lib/financing";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/financing/[id]
 * Obtener un financiamiento por ID
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const financing = await fetchFinancingByIdFromStrapi(id);

    if (!financing) {
      return NextResponse.json(
        { error: "Financiamiento no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: financing });
  } catch (error) {
    console.error("Error fetching financing:", error);
    return NextResponse.json(
      { error: "No se pudo obtener el financiamiento." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/financing/[id]
 * Actualizar un financiamiento
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { data } = body as { data?: Partial<{
      status: FinancingStatus;
      paidQuotas: number;
      currentBalance: number;
      totalPaid: number;
      totalLateFees: number;
      partialPaymentCredit: number;
      nextDueDate: string;
      notes: string;
      maxLateQuotasAllowed: number;
    }> };

    if (!data) {
      return NextResponse.json(
        { error: "Los datos de actualización son requeridos." },
        { status: 400 }
      );
    }

    // Validar status si se proporciona
    if (data.status && !["activo", "inactivo", "en_mora", "completado"].includes(data.status)) {
      return NextResponse.json(
        { error: "Estado inválido." },
        { status: 400 }
      );
    }

    const financing = await updateFinancingInStrapi(id, data);
    return NextResponse.json({ data: financing });
  } catch (error) {
    console.error("Error updating financing:", error);
    
    let errorMessage = "No se pudo actualizar el financiamiento.";
    if (error instanceof Error && error.message.includes("404")) {
      return NextResponse.json(
        { error: "Financiamiento no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/financing/[id]
 * Eliminar un financiamiento
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteFinancingFromStrapi(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting financing:", error);
    
    if (error instanceof Error && error.message.includes("404")) {
      return NextResponse.json(
        { error: "Financiamiento no encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "No se pudo eliminar el financiamiento." },
      { status: 500 }
    );
  }
}
