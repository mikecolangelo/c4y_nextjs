import { NextResponse } from "next/server";
import { fetchDealsFromStrapi, createDealInStrapi } from "@/lib/deal";
import type { DealCreatePayload } from "@/validations/types";

export async function GET() {
  try {
    const deals = await fetchDealsFromStrapi();
    return NextResponse.json({ data: deals });
  } catch (error) {
    console.error("Error fetching deals data:", error);
    return NextResponse.json(
      { error: "No se pudo obtener los contratos desde Strapi." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { data?: DealCreatePayload };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del contrato son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar tipo de contrato legacy si está presente
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

    // Validar paymentAgreement si está presente (ahora incluye mensual)
    if (data.paymentAgreement && !["semanal", "quincenal", "mensual"].includes(data.paymentAgreement)) {
      return NextResponse.json(
        { error: "El acuerdo de pago debe ser 'semanal', 'quincenal' o 'mensual'." },
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

    const deal = await createDealInStrapi(data);
    return NextResponse.json({ data: deal }, { status: 201 });
  } catch (error) {
    console.error("Error creating deal:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el contrato.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
