import { NextResponse } from "next/server";
import { accruePenaltiesForFinancing } from "@/lib/unified-allocator";
import { STRAPI_BASE_URL, STRAPI_API_TOKEN } from "@/lib/config";
import qs from "qs";

/**
 * POST /api/penalties/backfill
 * Genera penalidades acumuladas para TODOS los financiamientos activos,
 * o para un financing específico si se proporciona.
 *
 * Body opcional:
 * {
 *   financingDocumentId?: string; // si se omite, procesa todos activos
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { financingDocumentId } = body.data || body || {};

    if (financingDocumentId) {
      console.log(`[Backfill] Procesando financing específico: ${financingDocumentId}`);
      const count = await accruePenaltiesForFinancing(financingDocumentId, 10);
      return NextResponse.json({
        success: true,
        mode: "single",
        financingDocumentId,
        penaltiesGenerated: count,
      });
    }

    // Obtener todos los financiamientos activos
    const query = qs.stringify(
      {
        filters: {
          status: { $eq: "activo" },
        },
        fields: ["documentId"],
        pagination: { pageSize: 500 },
      },
      { encodeValuesOnly: true }
    );

    const res = await fetch(`${STRAPI_BASE_URL}/api/financings?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[Backfill] Error fetching financings:", await res.text());
      return NextResponse.json(
        { error: "Error obteniendo financiamientos activos" },
        { status: 500 }
      );
    }

    const json = await res.json();
    const financings = (json.data || []) as Array<{ documentId: string }>;

    console.log(`[Backfill] Procesando ${financings.length} financiamientos activos...`);

    const results: Array<{
      financingDocumentId: string;
      penaltiesGenerated: number;
      error?: string;
    }> = [];

    for (const f of financings) {
      try {
        const count = await accruePenaltiesForFinancing(f.documentId, 10);
        results.push({
          financingDocumentId: f.documentId,
          penaltiesGenerated: count,
        });
        console.log(`[Backfill] ✓ ${f.documentId}: ${count} penalidades`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Backfill] ✗ ${f.documentId}: ${msg}`);
        results.push({
          financingDocumentId: f.documentId,
          penaltiesGenerated: 0,
          error: msg,
        });
      }
    }

    const total = results.reduce((sum, r) => sum + r.penaltiesGenerated, 0);
    const errors = results.filter((r) => r.error).length;

    return NextResponse.json({
      success: true,
      mode: "batch",
      totalProcessed: financings.length,
      totalPenaltiesGenerated: total,
      errors,
      results,
    });
  } catch (error) {
    console.error("[Backfill] Error general:", error);
    const msg = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
