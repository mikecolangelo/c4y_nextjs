import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// GET - Movimientos de inventario específicos de un repuesto
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const pageSize = searchParams.get("pageSize") || "50";

    const filters: any = {
      inventoryItem: { id: { $eq: id } },
    };
    if (type) {
      filters.type = { $eq: type };
    }

    const query = qs.stringify(
      {
        filters,
        sort: ["date:desc"],
        pagination: { pageSize: Number(pageSize) },
        populate: {
          serviceOrder: {
            fields: ["id", "documentId", "code"],
          },
          performedBy: {
            fields: ["id", "email", "username"],
          },
        },
      },
      { encodeValuesOnly: true }
    );

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/inventory-movements?${query}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Strapi error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || [] });
  } catch (error) {
    console.error("[API /inventory-items/[id]/movements GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
