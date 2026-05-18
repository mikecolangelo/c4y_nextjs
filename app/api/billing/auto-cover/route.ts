import { NextResponse } from "next/server";
import { autoCoverPendingQuotas, recalculateFinancingMetrics } from "@/lib/billing";

/**
 * POST /api/billing/auto-cover
 * Ejecuta auto-cover de cuotas pendientes usando adelantos disponibles.
 * 
 * Body: { financingDocumentId: string }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { financingDocumentId } = body;

    if (!financingDocumentId) {
      return NextResponse.json(
        { error: "financingDocumentId es requerido." },
        { status: 400 }
      );
    }

    console.log(`[API AutoCover] Ejecutando auto-cover para financing ${financingDocumentId}`);
    const coveredQuotas = await autoCoverPendingQuotas(financingDocumentId);

    // Recalcular métricas del financing para reflejar cambios en la UI
    if (coveredQuotas.length > 0) {
      try {
        await recalculateFinancingMetrics(financingDocumentId);
        console.log(`[API AutoCover] Métricas recalculadas para financing ${financingDocumentId}`);
      } catch (recalcError) {
        console.error(`[API AutoCover] Error recalculando métricas:`, recalcError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        coveredCount: coveredQuotas.length,
        coveredQuotas,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error("[API AutoCover] Error:", error);
    return NextResponse.json(
      { error: "Error al ejecutar auto-cover." },
      { status: 500 }
    );
  }
}
