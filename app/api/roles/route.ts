import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";

// GET - Lista de roles (base + personalizados). Abierto a usuarios autenticados.
export async function GET() {
  try {
    const jwt = (await cookies()).get("jwt")?.value;
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/roles/list`, {
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /roles GET] Error:", error);
    return NextResponse.json({ error: "Error al obtener los roles" }, { status: 500 });
  }
}

// POST - Crea un rol personalizado (el backend exige rol admin). Body: { label, color?, key? }
export async function POST(request: Request) {
  try {
    const jwt = (await cookies()).get("jwt")?.value;
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();

    const response = await fetch(`${STRAPI_BASE_URL}/api/roles/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /roles POST] Error:", error);
    return NextResponse.json({ error: "Error al crear el rol" }, { status: 500 });
  }
}
