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

    if (body.data.length > 50) {
      return NextResponse.json(
        { error: "Limite maximo de 50 registros por lote" },
        { status: 400 }
      );
    }

    const res = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/batch-import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage =
        typeof data?.error?.message === "string"
          ? data.error.message
          : typeof data?.error === "string"
            ? data.error
            : "Error en Strapi";
      return NextResponse.json(
        { error: errorMessage },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[API /user-profiles/batch-import] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
