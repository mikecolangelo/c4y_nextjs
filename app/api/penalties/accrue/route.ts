import { NextResponse } from "next/server";
import { accruePenaltiesForFinancing } from "@/lib/unified-allocator";

/**
 * POST /api/penalties/accrue
 * Genera o actualiza penalidades acumuladas para un financiamiento.
 *
 * Body: {
 *   data: {
 *     financingDocumentId: string;
 *     lateFeePercentage?: number; // default 10
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body as {
      data?: {
        financingDocumentId: string;
        lateFeePercentage?: number;
      };
    };

    if (!data?.financingDocumentId) {
      return NextResponse.json(
        { error: "financingDocumentId es requerido." },
        { status: 400 }
      );
    }

    const count = await accruePenaltiesForFinancing(
      data.financingDocumentId,
      data.lateFeePercentage ?? 10
    );

    return NextResponse.json({
      success: true,
      penaltiesGenerated: count,
      financingDocumentId: data.financingDocumentId,
    });
  } catch (error) {
    console.error("[API Penalties Accrue] Error:", error);
    const message = error instanceof Error ? error.message : "Error generando penalidades.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
