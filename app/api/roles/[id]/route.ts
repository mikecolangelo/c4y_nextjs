import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";

// PUT - Actualiza un rol (label/color/isActive/key). El backend exige rol admin.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const jwt = (await cookies()).get("jwt")?.value;
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const response = await fetch(`${STRAPI_BASE_URL}/api/roles/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /roles/[id] PUT] Error:", error);
    return NextResponse.json({ error: "Error al actualizar el rol" }, { status: 500 });
  }
}

// DELETE - Elimina un rol (bloqueado si está en uso o es del sistema). Admin only.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const jwt = (await cookies()).get("jwt")?.value;
    if (!jwt) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    const response = await fetch(`${STRAPI_BASE_URL}/api/roles/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      cache: "no-store",
    });

    const json = await response.json();
    return NextResponse.json(json, { status: response.status });
  } catch (error) {
    console.error("[API /roles/[id] DELETE] Error:", error);
    return NextResponse.json({ error: "Error al eliminar el rol" }, { status: 500 });
  }
}
