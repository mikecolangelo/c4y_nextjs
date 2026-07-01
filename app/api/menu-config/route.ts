import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";

// GET - Orden actual de los items del menú: { data: { order: string[] } }
export async function GET() {
  try {
    const jwt = (await cookies()).get("jwt")?.value;
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/menu-configs/order`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /menu-config GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener el orden del menú" }, { status: 500 });
  }
}

// PUT - Guarda un nuevo orden (el backend exige rol admin). Body: { order: string[] }
export async function PUT(request: Request) {
  try {
    const jwt = (await cookies()).get("jwt")?.value;
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${STRAPI_BASE_URL}/api/menu-configs/order`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /menu-config PUT] Error:", error);
    return NextResponse.json({ error: "Error al guardar el orden del menú" }, { status: 500 });
  }
}
