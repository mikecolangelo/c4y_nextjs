import { NextRequest, NextResponse } from "next/server";

const STRAPI_API_URL = process.env.STRAPI_API_URL || "http://localhost:1337/api";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

async function strapiFetch(url: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (STRAPI_API_TOKEN) {
    headers.Authorization = `Bearer ${STRAPI_API_TOKEN}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// DELETE - Eliminar una nota
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId } = await params;
    console.log("DELETE /api/inventory/notes/", noteId);

    if (!noteId) {
      return NextResponse.json(
        { error: "ID de nota requerido" },
        { status: 400 }
      );
    }

    // Eliminar la nota en Strapi usando documentId
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (STRAPI_API_TOKEN) {
      headers.Authorization = `Bearer ${STRAPI_API_TOKEN}`;
    }

    const url = `${STRAPI_API_URL}/inventory-notes/${noteId}`;
    console.log("Enviando DELETE a Strapi:", url);

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });

    console.log("Respuesta de Strapi:", response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error de Strapi:", errorText);
      let errorMessage = `HTTP ${response.status}`;
      try {
        const error = JSON.parse(errorText);
        errorMessage = error.error?.message || errorMessage;
      } catch {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    return NextResponse.json(
      { message: "Nota eliminada correctamente" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting inventory note:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al eliminar la nota" },
      { status: 500 }
    );
  }
}
