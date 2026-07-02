import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserJwt, getCurrentUserProfile } from "@/lib/auth";
import { requireModulePermission } from "@/lib/module-guard";

const STRAPI_API_URL = process.env.STRAPI_API_URL || "http://localhost:1337/api";
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN || "";

async function strapiFetch(url: string, options: RequestInit = {}, jwt?: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (!headers.Authorization) {
    headers.Authorization = `Bearer ${jwt || STRAPI_API_TOKEN}`;
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

// GET - Obtener notas de una pieza
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireModulePermission("stock", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const populate = searchParams.get("populate") || "*";

    // Primero obtener el documentId del inventory item con sus notas
    const itemResponse = await strapiFetch(
      `${STRAPI_API_URL}/inventory-items/${id}?populate[notes][fields][0]=documentId&populate[notes][fields][1]=content&populate[notes][fields][2]=authorName&populate[notes][fields][3]=createdAt&populate[notes][fields][4]=updatedAt`
    );

    if (!itemResponse.data) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    // Obtener las notas relacionadas y transformar el formato
    const notesRaw = itemResponse.data.notes || [];

    // Transformar las notas al formato esperado por el frontend
    const notes = notesRaw.map((note: any) => ({
      id: note.id,
      documentId: note.documentId,
      content: note.content,
      authorName: note.authorName,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    }));

    return NextResponse.json({ data: notes });
  } catch (error) {
    console.error("Error fetching inventory notes:", error);
    return NextResponse.json({ error: "Error al obtener las notas" }, { status: 500 });
  }
}

// POST - Crear nueva nota
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    try {
      await requireModulePermission("stock", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: "El contenido de la nota es requerido" }, { status: 400 });
    }

    // Obtener el usuario actual con su nombre
    const currentUser = await getCurrentUserProfile();
    const authorName = currentUser?.displayName || currentUser?.email || "Usuario";

    // Obtener el documentId del inventory item
    const itemResponse = await strapiFetch(
      `${STRAPI_API_URL}/inventory-items/${id}?fields[0]=documentId`
    );

    if (!itemResponse.data) {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
    }

    // Strapi v5 requiere ID numérico para relaciones en POST/PUT.
    // El endpoint recibe el documentId del item en la URL, pero la relación
    // debe usar el id numérico interno.
    const itemNumericId = itemResponse.data.id;

    if (!itemNumericId) {
      return NextResponse.json(
        { error: "No se pudo obtener el ID numérico del item" },
        { status: 500 }
      );
    }

    // Crear la nota
    const noteData = {
      data: {
        content: content.trim(),
        authorName: authorName,
        item: itemNumericId,
      },
    };

    const jwt = await getCurrentUserJwt();
    const createResponse = await strapiFetch(
      `${STRAPI_API_URL}/inventory-notes`,
      {
        method: "POST",
        body: JSON.stringify(noteData),
      },
      jwt
    );

    // Transformar la respuesta para incluir documentId
    const createdNote = createResponse.data;
    const note = {
      id: createdNote.id,
      documentId: createdNote.documentId,
      content: createdNote.content,
      authorName: createdNote.authorName,
      createdAt: createdNote.createdAt,
      updatedAt: createdNote.updatedAt,
    };

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (error) {
    console.error("Error creating inventory note:", error);
    return NextResponse.json({ error: "Error al crear la nota" }, { status: 500 });
  }
}
