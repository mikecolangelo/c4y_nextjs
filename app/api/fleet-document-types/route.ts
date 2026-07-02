import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";

// Default document types - used as fallback
const defaultDocumentTypes = [
  {
    id: 1,
    documentId: "poliza-seguro",
    name: "Póliza de Seguro del Vehículo",
    slug: "poliza-seguro",
    description: "Documento de seguro vigente del vehículo",
    isActive: true,
    order: 0,
  },
  {
    id: 2,
    documentId: "factura-compra",
    name: "Factura de Compra del Automóvil",
    slug: "factura-compra",
    description: "Factura de compra del vehículo",
    isActive: true,
    order: 1,
  },
  {
    id: 3,
    documentId: "contrato-compraventa",
    name: "Contrato Compraventa",
    slug: "contrato-compraventa",
    description: "Contrato de compra-venta del vehículo",
    isActive: true,
    order: 2,
  },
  {
    id: 4,
    documentId: "registro-propiedad",
    name: "Registro Único de Propiedad Vehicular",
    slug: "registro-propiedad",
    description: "Registro único de propiedad del vehículo",
    isActive: true,
    order: 3,
  },
  {
    id: 5,
    documentId: "placa",
    name: "Placa",
    slug: "placa",
    description: "Placa o matrícula del vehículo",
    isActive: true,
    order: 4,
  },
  {
    id: 6,
    documentId: "certificado-revisado",
    name: "Certificado de Revisado Vehicular",
    slug: "certificado-revisado",
    description: "Certificado de revisión técnica vehicular",
    isActive: true,
    order: 5,
  },
  {
    id: 7,
    documentId: "revisado",
    name: "Revisado",
    slug: "revisado",
    description: "Documento de revisado del vehículo",
    isActive: true,
    order: 6,
  },
  {
    id: 8,
    documentId: "otros",
    name: "Otros",
    slug: "otros",
    description: "Otros tipos de documentos no listados",
    isActive: true,
    order: 7,
  },
];

// GET - Obtener todos los tipos de documentos
export async function GET(request: Request) {
  try {
    try {
      await requireModulePermission("fleet", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    // Try to get from Strapi using the admin API with proper token
    const response = await fetch(`${STRAPI_BASE_URL}/api/fleet-document-types?sort[0]=order:asc`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    });

    if (response.ok) {
      const result = await response.json();
      // If we got data from Strapi and it has items, use that
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        console.log("✅ Tipos de documento cargados desde Strapi:", result.data.length);
        return NextResponse.json(result);
      }
    }

    console.warn(
      "⚠️ Strapi no devolvió tipos de documento. Usando valores por defecto. Status:",
      response.status
    );

    // Fallback to default document types - these are for UI only
    // The actual saving will not include documentType since Strapi doesn't have this content type
    return NextResponse.json({ data: defaultDocumentTypes });
  } catch (error) {
    console.error("❌ Error fetching fleet document types from Strapi:", error);
    // Fallback to default types on error
    return NextResponse.json({ data: defaultDocumentTypes });
  }
}

// POST - Crear un nuevo tipo de documento
export async function POST(request: Request) {
  try {
    try {
      await requireModulePermission("fleet", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { error: "Los datos del tipo de documento son requeridos" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: "El nombre del tipo de documento es requerido" },
        { status: 400 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/fleet-document-types`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      body: JSON.stringify({ data }),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = errorText ? JSON.parse(errorText) : { error: { message: "Error desconocido" } };
      } catch {
        errorData = { error: { message: errorText || `Error ${response.status}` } };
      }
      console.error("Error creando tipo de documento:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData,
      });

      if (response.status === 404) {
        return NextResponse.json(
          { error: "El tipo de contenido 'fleet-document-types' no existe en Strapi." },
          { status: 404 }
        );
      }

      throw new Error(
        errorData.error?.message || `Error ${response.status}: ${response.statusText}`
      );
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating fleet document type:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
