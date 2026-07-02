import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";
import qs from "qs";

// GET - Obtener todas las configuraciones
export async function GET(request: Request) {
  try {
    try {
      await requireModulePermission("settings", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const query = qs.stringify({
      filters: category ? { category: { $eq: category } } : undefined,
      fields: ["key", "value", "description", "category", "isSecret"],
      sort: ["category:asc", "key:asc"],
      pagination: { pageSize: 100 },
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/configurations?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error obteniendo configuraciones: ${errorText}`);
    }

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("Error parseando respuesta de Strapi:", text.substring(0, 200));
      throw new Error("Respuesta inválida del servidor");
    }

    // Ocultar valores secretos
    const sanitizedData = (data.data || []).map((config: any) => ({
      ...config,
      value: config.isSecret ? "••••••••" : config.value,
    }));

    return NextResponse.json({ data: sanitizedData });
  } catch (error) {
    console.error("Error obteniendo configuraciones:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva configuración
export async function POST(request: Request) {
  try {
    try {
      await requireModulePermission("settings", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description, category, isSecret } = body;

    if (!key || !category) {
      return NextResponse.json({ error: "key y category son requeridos" }, { status: 400 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/configurations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: { key, value, description, category, isSecret: isSecret || false },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error creando configuración: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error creando configuración:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// PUT - Actualizar configuración por key
export async function PUT(request: Request) {
  try {
    try {
      await requireModulePermission("settings", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { key, value, description, isSecret } = body;

    if (!key) {
      return NextResponse.json({ error: "key es requerido" }, { status: 400 });
    }

    // Buscar la configuración por key
    const searchQuery = qs.stringify({
      filters: { key: { $eq: key } },
      fields: ["id", "documentId"],
    });

    const searchResponse = await fetch(`${STRAPI_BASE_URL}/api/configurations?${searchQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!searchResponse.ok) {
      throw new Error("Error buscando configuración");
    }

    const searchData = await searchResponse.json();
    const config = searchData.data?.[0];

    if (!config) {
      return NextResponse.json({ error: "Configuración no encontrada" }, { status: 404 });
    }

    // Actualizar la configuración
    const updateData: any = {};
    if (value !== undefined) updateData.value = value;
    if (description !== undefined) updateData.description = description;
    if (isSecret !== undefined) updateData.isSecret = isSecret;

    const response = await fetch(`${STRAPI_BASE_URL}/api/configurations/${config.documentId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: updateData }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error actualizando configuración: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data });
  } catch (error) {
    console.error("Error actualizando configuración:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
