import { NextResponse } from "next/server";
import { getCurrentUserJwt } from "@/lib/auth";
import { STRAPI_BASE_URL } from "@/lib/config";

export async function GET(
  request: Request,
  { params }: { params: { batchId: string } }
) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { batchId } = params;
    if (!batchId) {
      return NextResponse.json(
        { error: "Se requiere batchId" },
        { status: 400 }
      );
    }

    const query = new URLSearchParams({
      "filters[importBatch][$eq]": batchId,
      "sort[0]": "createdAt:desc",
      "pagination[pageSize]": "1000",
      "populate[client][fields][0]": "displayName",
      "populate[financing][fields][0]": "financingNumber",
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

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error("[API /weekly-collections/batch/[batchId]] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
