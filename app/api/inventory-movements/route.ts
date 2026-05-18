import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// GET - Listar movimientos de inventario
export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const inventoryItem = searchParams.get("inventoryItem");
    const type = searchParams.get("type");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const pageSize = searchParams.get("pageSize") || "50";

    const filters: any = {};
    if (inventoryItem) {
      filters.inventoryItem = { id: { $eq: inventoryItem } };
    }
    if (type) {
      filters.type = { $eq: type };
    }
    if (dateFrom || dateTo) {
      filters.date = {};
      if (dateFrom) filters.date.$gte = dateFrom;
      if (dateTo) filters.date.$lte = dateTo;
    }

    const query = qs.stringify(
      {
        filters,
        sort: ["date:desc"],
        pagination: {
          pageSize: Number(pageSize),
        },
        populate: {
          inventoryItem: {
            fields: ["id", "documentId", "code", "description", "unit"],
          },
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
    console.error("[API /inventory-movements GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
