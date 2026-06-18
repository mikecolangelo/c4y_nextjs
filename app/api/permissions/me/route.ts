import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";

// GET - Permisos del usuario autenticado (rol + matriz de su rol)
export async function GET() {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      // Sin sesión: tratar como sin acceso (lead)
      return NextResponse.json(
        { data: { role: "lead", permissions: {} } },
        { status: 200 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/role-permissions/mine`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { data: { role: "lead", permissions: {} } },
        { status: 200 }
      );
    }

    const json = await response.json();
    return NextResponse.json(json, { status: 200 });
  } catch (error) {
    console.error("[API /permissions/me] Error:", error);
    return NextResponse.json(
      { data: { role: "lead", permissions: {} } },
      { status: 200 }
    );
  }
}
