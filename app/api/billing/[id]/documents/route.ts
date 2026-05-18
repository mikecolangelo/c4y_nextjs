import { NextResponse } from "next/server";
import {
  fetchBillingDocumentsByRecordId,
  createBillingDocumentInStrapi,
  fetchBillingRecordByIdFromStrapi,
} from "@/lib/billing";
import type { BillingDocumentCreatePayload } from "@/validations/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const documents = await fetchBillingDocumentsByRecordId(id);
    return NextResponse.json({ data: documents });
  } catch (error) {
    console.error("Error fetching billing documents:", error);
    return NextResponse.json(
      { error: "No se pudieron obtener los documentos de facturación." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { data?: Omit<BillingDocumentCreatePayload, "record"> };

    if (!body?.data) {
      return NextResponse.json(
        { error: "Los datos del documento son requeridos." },
        { status: 400 }
      );
    }

    const { data } = body;

    // Validar campos requeridos
    if (!data.name) {
      return NextResponse.json(
        { error: "El nombre del documento es requerido." },
        { status: 400 }
      );
    }

    if (!data.file) {
      return NextResponse.json(
        { error: "El archivo es requerido." },
        { status: 400 }
      );
    }

    // Verificar que el registro de facturación existe
    const record = await fetchBillingRecordByIdFromStrapi(id);
    if (!record) {
      return NextResponse.json(
        { error: "Registro de facturación no encontrado." },
        { status: 404 }
      );
    }

    // Crear el documento con la referencia al registro
    const documentData: BillingDocumentCreatePayload = {
      ...data,
      record: record.documentId,
    };

    const document = await createBillingDocumentInStrapi(documentData);
    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    console.error("Error creating billing document:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo crear el documento de facturación.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
