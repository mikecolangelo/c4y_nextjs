import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// GET - Historial de órdenes de servicio donde se utilizó este repuesto
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

    // Resolver numericId si el id es documentId
    let numericId = id;
    if (isNaN(Number(id))) {
      const itemRes = await fetch(
        `${STRAPI_BASE_URL}/api/inventory-items/${id}?fields=id`,
        {
          headers: { Authorization: `Bearer ${jwt}` },
          cache: "no-store",
        }
      );
      if (itemRes.ok) {
        const itemData = await itemRes.json();
        numericId = itemData.data?.id ?? id;
      }
    }

    const query = qs.stringify(
      {
        filters: {
          inventoryItem: { id: { $eq: numericId } },
        },
        sort: ["createdAt:desc"],
        pagination: { pageSize: 50 },
        populate: {
          serviceOrder: {
            fields: ["id", "documentId", "code", "status", "scheduledAt", "completedAt"],
            populate: {
              vehicle: { fields: ["id", "documentId", "name"] },
              driver: { fields: ["id", "documentId", "displayName"] },
            },
          },
        },
        fields: ["quantity", "unitPriceAtMoment", "totalLine", "createdAt"],
      },
      { encodeValuesOnly: true }
    );

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/service-order-inventory-items?${query}`,
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
    console.error("[API /inventory-items/[id]/history GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
