import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";

// GET - Obtener todos los clientes/contactos
export async function GET() {
  try {
    const query = qs.stringify({
      fields: ["id", "documentId", "fullName", "email", "phone", "status", "leadSince"],
      populate: {
        avatar: {
          fields: ["url", "alternativeText"],
        },
      },
      sort: ["fullName:asc"],
      publicationState: "live",
    });

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/clients?${query}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo clientes: ${errorText || response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error("Error obteniendo clientes:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Crear un nuevo cliente/contacto
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body;

    if (!data || !data.fullName) {
      return NextResponse.json(
        { error: "El nombre completo es requerido" },
        { status: 400 }
      );
    }

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/clients`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${response.status}` } };
      }
      throw new Error(errorData.error?.message || `Error ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error("Error creando cliente:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
