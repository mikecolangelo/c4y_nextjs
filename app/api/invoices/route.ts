import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";

// GET - Obtener facturas con filtros
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Construir query con filtros
    const filters: Record<string, any> = {};
    
    if (searchParams.get('financingId')) {
      filters.financing = { documentId: searchParams.get('financingId') };
    }
    
    if (searchParams.get('clientId')) {
      filters.client = searchParams.get('clientId');
    }
    
    if (searchParams.get('status')) {
      filters.status = searchParams.get('status');
    }
    
    if (searchParams.get('fromDate') || searchParams.get('toDate')) {
      filters.dueDate = {};
      if (searchParams.get('fromDate')) {
        filters.dueDate.$gte = searchParams.get('fromDate');
      }
      if (searchParams.get('toDate')) {
        filters.dueDate.$lte = searchParams.get('toDate');
      }
    }

    const query = qs.stringify({
      filters,
      populate: {
        financing: {
          fields: ['financingNumber', 'quotaAmount'],
        },
        client: {
          fields: ['displayName', 'email'],
        },
      },
      sort: ['dueDate:desc'],
    });

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/invoices?${query}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo facturas: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error("Error obteniendo facturas:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Crear nueva factura
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/invoices`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: body.data }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creando factura: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error creando factura:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
