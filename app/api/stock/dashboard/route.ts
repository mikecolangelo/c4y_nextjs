import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// GET - Métricas del Cuadro de Inventario
export async function GET() {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Obtener todos los items activos para métricas agregadas
    const itemsQuery = qs.stringify(
      {
        filters: { isActive: { $eq: true } },
        pagination: { pageSize: 1000 },
        fields: ["stock", "unitCost", "minStock", "maxStock"],
      },
      { encodeValuesOnly: true }
    );

    const itemsResponse = await fetch(
      `${STRAPI_BASE_URL}/api/inventory-items?${itemsQuery}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!itemsResponse.ok) {
      throw new Error(`Strapi items error: ${itemsResponse.status}`);
    }

    const itemsData = await itemsResponse.json();
    const items = itemsData.data || [];

    // 2. Calcular métricas
    let totalInventoryValue = 0;
    let criticalItemsCount = 0;

    for (const item of items) {
      const stock = Number(item.stock ?? 0);
      const unitCost = Number(item.unitCost ?? 0);
      const minStock = Number(item.minStock ?? 0);

      totalInventoryValue += stock * unitCost;

      if (minStock > 0 && stock <= minStock) {
        criticalItemsCount++;
      }
    }

    // 3. Obtener últimos consumos (salidas)
    const movementsQuery = qs.stringify(
      {
        filters: { type: { $eq: "salida" } },
        sort: ["date:desc"],
        pagination: { pageSize: 10 },
        populate: {
          inventoryItem: {
            fields: ["id", "documentId", "code", "description", "unit"],
          },
          serviceOrder: {
            fields: ["id", "documentId", "code"],
          },
        },
      },
      { encodeValuesOnly: true }
    );

    const movementsResponse = await fetch(
      `${STRAPI_BASE_URL}/api/inventory-movements?${movementsQuery}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    let lastConsumptions: any[] = [];
    if (movementsResponse.ok) {
      const movementsData = await movementsResponse.json();
      lastConsumptions = movementsData.data || [];
    }

    return NextResponse.json({
      data: {
        totalInventoryValue: Number(totalInventoryValue.toFixed(2)),
        criticalItemsCount,
        totalItemsCount: items.length,
        lastConsumptions,
      },
    });
  } catch (error) {
    console.error("[API /stock/dashboard GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
