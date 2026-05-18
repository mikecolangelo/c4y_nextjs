import { NextResponse } from "next/server";
import {
  fetchFinancingsFromStrapi,
  createFinancingInStrapi,
  type FinancingCreatePayload,
} from "@/lib/financing";

/**
 * GET /api/financing
 * Obtener todos los financiamientos
 */
export async function GET() {
  try {
    const financings = await fetchFinancingsFromStrapi();
    return NextResponse.json({ data: financings });
  } catch (error) {
    console.error("Error fetching financings:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los financiamientos." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/financing
 * Crear un nuevo financiamiento
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body as { data?: FinancingCreatePayload };

    if (!data) {
      return NextResponse.json(
        { error: "Los datos del financiamiento son requeridos." },
        { status: 400 }
      );
    }

    // Validaciones
    if (!data.totalAmount || data.totalAmount <= 0) {
      return NextResponse.json(
        { error: "El monto total debe ser mayor a 0." },
        { status: 400 }
      );
    }

    if (!data.paymentFrequency) {
      return NextResponse.json(
        { error: "La frecuencia de pago es requerida." },
        { status: 400 }
      );
    }

    if (!["semanal", "quincenal", "mensual"].includes(data.paymentFrequency)) {
      return NextResponse.json(
        { error: "La frecuencia de pago debe ser semanal, quincenal o mensual." },
        { status: 400 }
      );
    }

    if (!data.startDate) {
      return NextResponse.json(
        { error: "La fecha de inicio es requerida." },
        { status: 400 }
      );
    }

    if (!data.vehicle) {
      return NextResponse.json(
        { error: "El vehículo es requerido." },
        { status: 400 }
      );
    }

    if (!data.client) {
      return NextResponse.json(
        { error: "El cliente es requerido." },
        { status: 400 }
      );
    }

    const financing = await createFinancingInStrapi(data);
    return NextResponse.json({ data: financing }, { status: 201 });
  } catch (error) {
    console.error("Error creating financing:", error);
    
    let errorMessage = "No se pudo crear el financiamiento.";
    let statusCode = 500;
    let details: string | undefined;

    if (error instanceof Error) {
      const message = error.message;
      details = message;
      
      // Detectar errores específicos de Strapi
      if (message.includes("unique") || message.includes("already exists")) {
        errorMessage = "Ya existe un financiamiento con estos datos.";
        statusCode = 400;
      } else if (message.includes("ValidationError")) {
        errorMessage = "Error de validación: verifica los datos ingresados.";
        statusCode = 400;
      } else if (message.includes("Forbidden")) {
        errorMessage = "No tienes permisos para crear financiamientos.";
        statusCode = 403;
      }
    }

    return NextResponse.json({ error: errorMessage, details }, { status: statusCode });
  }
}
