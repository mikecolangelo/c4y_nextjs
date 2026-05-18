import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// GET - Listar repuestos activos
export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pageSize = searchParams.get("pageSize") || "100";

    const query = qs.stringify(
      {
        filters: {
          isActive: { $eq: true },
        },
        sort: ["code:asc"],
        pagination: {
          pageSize: Number(pageSize),
        },
      },
      { encodeValuesOnly: true }
    );

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/inventory-items?${query}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Strapi error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error("[API /inventory-items GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST - Crear repuesto
export async function POST(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body?.data) {
      return NextResponse.json({ error: "Datos requeridos" }, { status: 400 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/inventory-items`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: body.data }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Strapi error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data }, { status: 201 });
  } catch (error) {
    console.error("[API /inventory-items POST] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
