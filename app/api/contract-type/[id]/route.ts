import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

// GET - Obtener un tipo de contrato por ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/contract-types/${id}`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Tipo de contrato no encontrado" },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      throw new Error(`Error obteniendo tipo de contrato: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error obteniendo tipo de contrato:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar tipo de contrato
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, requiredDocuments, order, isActive } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (requiredDocuments !== undefined) updateData.requiredDocuments = requiredDocuments;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/contract-types/${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: updateData }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Tipo de contrato no encontrado" },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      throw new Error(`Error actualizando tipo de contrato: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error actualizando tipo de contrato:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// DELETE - Eliminar tipo de contrato (soft delete - isActive = false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Soft delete - marcar como inactivo
    const response = await fetch(
      `${STRAPI_BASE_URL}/api/contract-types/${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: { isActive: false } }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Tipo de contrato no encontrado" },
          { status: 404 }
        );
      }
      const errorText = await response.text();
      throw new Error(`Error eliminando tipo de contrato: ${errorText}`);
    }

    return NextResponse.json({ message: "Tipo de contrato eliminado" });
  } catch (error) {
    console.error("Error eliminando tipo de contrato:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
