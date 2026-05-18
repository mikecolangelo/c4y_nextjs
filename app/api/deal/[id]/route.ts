import { NextResponse } from "next/server";
import {
  deleteDealInStrapi,
  fetchDealByIdFromStrapi,
  updateDealInStrapi,
} from "@/lib/deal";
import type { DealUpdatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deal = await fetchDealByIdFromStrapi(id);

    if (!deal) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ data: deal });
  } catch (error) {
    console.error("Error fetching deal:", error);
    return NextResponse.json(
      { error: "No pudimos obtener la información del contrato." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const body = (await request.json()) as { data?: DealUpdatePayload };
    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar tipo de contrato si está presente
    if (data.type && !["conduccion", "arrendamiento", "servicio"].includes(data.type)) {
      return NextResponse.json(
        { error: "El tipo de contrato debe ser 'conduccion', 'arrendamiento' o 'servicio'." },
        { status: 400 }
      );
    }

    // Validar status si está presente
    if (data.status && !["pendiente", "firmado", "archivado"].includes(data.status)) {
      return NextResponse.json(
        { error: "El estado debe ser 'pendiente', 'firmado' o 'archivado'." },
        { status: 400 }
      );
    }

    // Validar paymentAgreement si está presente
    if (data.paymentAgreement && !["semanal", "quincenal"].includes(data.paymentAgreement)) {
      return NextResponse.json(
        { error: "El acuerdo de pago debe ser 'semanal' o 'quincenal'." },
        { status: 400 }
      );
    }

    // Validar price si está presente
    if (data.price !== undefined && data.price < 0) {
      return NextResponse.json(
        { error: "El precio no puede ser negativo." },
        { status: 400 }
      );
    }

    const { id } = await context.params;
    const updated = await updateDealInStrapi(id, body.data);
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("Error updating deal:", error);
    return NextResponse.json(
      { error: "No pudimos actualizar el contrato. Intenta de nuevo." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    await deleteDealInStrapi(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deal:", error);
    return NextResponse.json(
      { error: "No pudimos eliminar el contrato. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
