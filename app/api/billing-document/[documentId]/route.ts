import { NextResponse } from "next/server";
import { deleteBillingDocumentFromStrapi } from "@/lib/billing";

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { documentId } = await context.params;
    await deleteBillingDocumentFromStrapi(documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting billing document:", error);
    const errorMessage = error instanceof Error ? error.message : "No se pudo eliminar el documento de facturación.";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
