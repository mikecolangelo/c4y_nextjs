import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { STRAPI_BASE_URL } from "@/lib/config";

export async function POST(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    if (!body?.data || !Array.isArray(body.data)) {
      return NextResponse.json(
        { error: "Se requiere un array de registros en 'data'" },
        { status: 400 }
      );
    }

    if (body.data.length > 1000) {
      return NextResponse.json(
        { error: "Limite maximo de 1000 registros por lote" },
        { status: 400 }
      );
    }

    const res = await fetch(`${STRAPI_BASE_URL}/api/weekly-collections/batch-import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || data?.error || "Error en Strapi" },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[API /weekly-collections/batch-import] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
