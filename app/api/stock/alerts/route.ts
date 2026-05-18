import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// GET - Alertas de reabastecimiento (stock <= minStock)
export async function GET() {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Obtener todos los items activos; el filtrado stock <= minStock se hace aquí
    // porque Strapi v5 REST no soporta comparar campo contra campo directamente.
    const query = qs.stringify(
      {
        filters: {
          isActive: { $eq: true },
        },
        sort: ["stock:asc"],
        pagination: { pageSize: 1000 },
        fields: [
          "code",
          "description",
          "stock",
          "minStock",
          "unit",
          "location",
        ],
      },
      { encodeValuesOnly: true }
    );

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/inventory-items?${query}`,
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
    const items = data.data || [];

    const alerts = items.filter((item: any) => {
      const stock = Number(item.stock ?? 0);
      const minStock = Number(item.minStock ?? 0);
      return minStock > 0 && stock <= minStock;
    });

    return NextResponse.json({ data: alerts });
  } catch (error) {
    console.error("[API /stock/alerts GET] error:", error);
    const message = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
