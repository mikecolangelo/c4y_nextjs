import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";

// GET - Matriz completa de permisos + módulos (para el editor de Configuración)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/role-permissions/matrix`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /permissions/matrix GET] Error:", error);
    return NextResponse.json(
      { error: "Error al obtener la matriz de permisos" },
      { status: 500 }
    );
  }
}

// PUT - Guardar la matriz de permisos (el backend exige rol admin)
export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${STRAPI_BASE_URL}/api/role-permissions/matrix`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /permissions/matrix PUT] Error:", error);
    return NextResponse.json(
      { error: "Error al guardar la matriz de permisos" },
      { status: 500 }
    );
  }
}
