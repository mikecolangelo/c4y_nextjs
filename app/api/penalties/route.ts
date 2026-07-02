import { NextResponse } from "next/server";
import qs from "qs";
import { STRAPI_BASE_URL, STRAPI_API_TOKEN } from "@/lib/config";
import { requireModulePermission } from "@/lib/module-guard";

/**
 * GET /api/penalties?financing={financingDocumentId}
 * Devuelve todas las penalty-debts asociadas a un financiamiento.
 *
 * Nota: Strapi v5 no puebla bien la relacion `financing` en penalty-debt,
 * por lo que buscamos primero las cuotas (billing-records) del financiamiento,
 * extraemos sus documentIds, y luego consultamos penalty-debts por quotaRecord.documentId.
 */
export async function GET(request: Request) {
  try {
    try {
      await requireModulePermission("billing", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(request.url);
    const financingDocumentId = searchParams.get("financing");

    if (!financingDocumentId) {
      return NextResponse.json(
        { error: "financing (documentId) es requerido como query param." },
        { status: 400 }
      );
    }

    // 1. Obtener cuotas raiz del financiamiento (solo necesitamos documentId)
    const quotasQuery = qs.stringify(
      {
        filters: {
          financing: { documentId: { $eq: financingDocumentId } },
          parentRecord: { $null: true },
        },
        fields: ["id", "documentId", "quotaNumber"],
        pagination: { pageSize: 500 },
      },
      { encodeValuesOnly: true }
    );

    const quotasRes = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${quotasQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!quotasRes.ok) {
      const text = await quotasRes.text();
      console.error("[Penalties API] Error fetching quotas:", text);
      return NextResponse.json(
        { error: "Error consultando cuotas del financiamiento." },
        { status: 502 }
      );
    }

    const quotasJson = await quotasRes.json();
    const quotas = quotasJson.data || [];
    const quotaDocumentIds = quotas.map((q: any) => q.documentId).filter(Boolean);

    if (quotaDocumentIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // 2. Buscar penalty-debts por quotaRecord.documentId ($in)
    const penaltyQuery = qs.stringify(
      {
        filters: {
          quotaRecord: {
            documentId: { $in: quotaDocumentIds },
          },
        },
        sort: ["dueDate:asc"],
        pagination: { pageSize: 500 },
      },
      { encodeValuesOnly: true }
    );

    const penaltyRes = await fetch(`${STRAPI_BASE_URL}/api/penalty-debts?${penaltyQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!penaltyRes.ok) {
      const text = await penaltyRes.text();
      console.error("[Penalties API] Error fetching penalties:", text);
      return NextResponse.json({ error: "Error consultando penalidades." }, { status: 502 });
    }

    const penaltyJson = await penaltyRes.json();
    const penalties = penaltyJson.data || [];

    // Normalizar flat vs nested
    const normalized = penalties.map((item: any) => {
      const attrs = item.attributes || item;
      const quota = quotas.find((q: any) => {
        const qId = q.documentId;
        // Strapi v5 puede devolver quotaRecord como { data: { documentId } } o directamente
        const related = attrs.quotaRecord?.data || attrs.quotaRecord || item.quotaRecord;
        const relatedId = related?.documentId || related?.id || related;
        return relatedId === qId;
      });

      return {
        documentId: item.documentId,
        amountOriginal: parseFloat(attrs.amountOriginal || item.amountOriginal || 0),
        amountPending: parseFloat(attrs.amountPending || item.amountPending || 0),
        dueDate: attrs.dueDate || item.dueDate,
        status: attrs.status || item.status,
        daysAccrued: parseInt(attrs.daysAccrued || item.daysAccrued || 0),
        dailyRatePercent: parseFloat(attrs.dailyRatePercent || item.dailyRatePercent || 10),
        source: attrs.source || item.source,
        notes: attrs.notes || item.notes,
        quotaNumber: quota?.attributes?.quotaNumber || quota?.quotaNumber || undefined,
      };
    });

    return NextResponse.json({ data: normalized });
  } catch (error) {
    console.error("[Penalties API] Error:", error);
    const message = error instanceof Error ? error.message : "Error interno.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
