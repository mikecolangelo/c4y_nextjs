import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";

// GET - Obtener todos los tipos de contrato
export async function GET() {
  try {
    const query = qs.stringify({
      fields: ["name", "description", "requiredDocuments", "order", "isActive"],
      sort: ["order:asc", "name:asc"],
      pagination: { pageSize: 100 },
      filters: { isActive: { $eq: true } },
    });

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/contract-types?${query}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo tipos de contrato: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error("Error obteniendo tipos de contrato:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// POST - Crear nuevo tipo de contrato
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, requiredDocuments, order, isActive } = body;

    if (!name) {
      return NextResponse.json(
        { error: "El nombre es requerido" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/contract-types`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: { 
            name, 
            description, 
            requiredDocuments: requiredDocuments || [], 
            order: order || 0, 
            isActive: isActive !== false 
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creando tipo de contrato: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data }, { status: 201 });
  } catch (error) {
    console.error("Error creando tipo de contrato:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
