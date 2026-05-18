import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { STRAPI_BASE_URL } from "@/lib/config";

export async function GET() {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use Strapi's standard REST endpoint (find) which has users-permissions configured
    const query = new URLSearchParams({
      "fields[0]": "importBatch",
      "fields[1]": "importStatus",
      "fields[2]": "createdAt",
      "pagination[pageSize]": "1000",
      "sort[0]": "createdAt:desc",
    });

    const res = await fetch(
      `${STRAPI_BASE_URL}/api/weekly-collections?${query.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
      }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error?.message || data?.error || "Error en Strapi" },
        { status: res.status }
      );
    }

    const records = data.data || [];

    // Group by importBatch in memory (clean architecture, no raw SQL)
    const batchMap = new Map<
      string,
      {
        importBatch: string;
        createdAt: string;
        total: number;
        created: number;
        duplicated: number;
        errors: number;
        processed: number;
      }
    >();

    for (const record of records) {
      const batchId = record.importBatch;
      if (!batchId) continue;

      if (!batchMap.has(batchId)) {
        batchMap.set(batchId, {
          importBatch: batchId,
          createdAt: record.createdAt,
          total: 0,
          created: 0,
          duplicated: 0,
          errors: 0,
          processed: 0,
        });
      }

      const batch = batchMap.get(batchId)!;
      batch.total++;

      switch (record.importStatus) {
        case "processed":
          batch.processed++;
          batch.created++;
          break;
        case "duplicate":
          batch.duplicated++;
          break;
        case "error":
          batch.errors++;
          break;
        default:
          batch.processed++;
          batch.created++;
          break;
      }
    }

    const batches = Array.from(batchMap.values());
    batches.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ data: batches }, { status: 200 });
  } catch (error) {
    console.error("[API /weekly-collections/batches] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
