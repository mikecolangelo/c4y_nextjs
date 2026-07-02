import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

// POST - Crear una nueva entrada en el historial de conductores
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const { driver, vehicle, startDate, status = "active", ...rest } = body.data;

    if (!driver || !vehicle || !startDate) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: driver, vehicle, startDate" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/driver-histories`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            driver,
            vehicle,
            startDate,
            status,
            ...rest,
          },
        }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creando historial: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error creando historial de conductor:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// GET - Obtener historial de conductores
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const driver = searchParams.get("driver");
    const vehicle = searchParams.get("vehicle");
    const status = searchParams.get("status");

    const filters: any = {};
    if (driver) filters.driver = { id: { $eq: driver } };
    if (vehicle) filters.vehicle = { id: { $eq: vehicle } };
    if (status) filters.status = { $eq: status };

    const query = new URLSearchParams();
    if (Object.keys(filters).length > 0) {
      query.append("filters", JSON.stringify(filters));
    }
    query.append("populate", "driver,vehicle");
    query.append("sort", "startDate:desc");

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/driver-histories?${query.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo historial: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error("Error obteniendo historial de conductores:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
