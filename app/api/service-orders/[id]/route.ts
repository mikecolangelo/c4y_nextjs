import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

const buildDetailQuery = () => {
  return qs.stringify(
    {
      populate: {
        vehicle: {
          fields: ["id", "documentId", "name", "placa", "brand", "model"],
        },
        services: {
          fields: ["id", "documentId", "name", "price"],
        },
        driver: {
          fields: ["id", "documentId", "displayName"],
        },
        appointment: {
          fields: ["id", "documentId", "status", "scheduledAt"],
        },
        notes: {
          fields: ["id", "content", "createdAt"],
        },
        serviceOrderInventoryItems: {
          populate: {
            inventoryItem: {
              fields: ["id", "documentId", "code", "description", "stock"],
            },
          },
        },
      },
    },
    { encodeValuesOnly: true }
  );
};

const resolveDocumentId = async (
  id: string,
  jwt: string
): Promise<string | null> => {
  const numericId = Number(id);
  if (!Number.isNaN(numericId) && String(numericId) === id) {
    const query = qs.stringify(
      {
        filters: { id: { $eq: numericId } },
        fields: ["documentId"],
        pagination: { pageSize: 1 },
      },
      { encodeValuesOnly: true }
    );
    const res = await fetch(
      `${STRAPI_BASE_URL}/api/service-orders?${query}`,
      {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.documentId ?? null;
  }
  return id;
};

function mapServiceOrderInventoryItems(order: any) {
  if (!order) return order;
  const items = order.serviceOrderInventoryItems;
  if (!items || !Array.isArray(items)) {
    order.usedItems = [];
    return order;
  }
  order.usedItems = items.map((item: any) => ({
    id: item.id,
    quantity: parseFloat(item.quantity),
    unitPriceAtMoment: parseFloat(item.unitPriceAtMoment),
    totalLine: parseFloat(item.totalLine),
    inventoryItem: item.inventoryItem || null,
    inventoryItemId: item.inventoryItem?.id ?? null,
  }));
  // Recalculate costs if missing but usedItems exist
  if (
    (order.partsCost === undefined || order.partsCost === null) &&
    order.usedItems.length > 0
  ) {
    const partsCost = order.usedItems.reduce(
      (sum: number, item: any) =>
        sum + item.quantity * item.unitPriceAtMoment,
      0
    );
    const laborCost = parseFloat(order.laborCost || 0);
    const servicesCost = (order.services || []).reduce(
      (sum: number, s: any) => sum + parseFloat(s?.price || 0),
      0
    );
    const subtotal = laborCost + partsCost + servicesCost;
    const totalCost = subtotal;
    order.partsCost = Number(partsCost.toFixed(2));
    order.taxAmount = 0;
    order.totalCost = Number(totalCost.toFixed(2));
  }
  return order;
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!id || id === "undefined" || id === "null") {
      return NextResponse.json(
        { error: "ID de orden inválido" },
        { status: 400 }
      );
    }
    const documentId = await resolveDocumentId(id, jwt);
    if (!documentId) {
      return NextResponse.json(
        { error: "Orden de servicio no encontrada" },
        { status: 404 }
      );
    }

    const query = buildDetailQuery();
    const response = await fetch(
      `${STRAPI_BASE_URL}/api/service-orders/${documentId}?${query}`,
      {
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(
        `[ServiceOrder V2 API] Strapi GET error ${response.status}:`,
        errorText.substring(0, 500)
      );
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Orden de servicio no encontrada" },
          { status: 404 }
        );
      }
      throw new Error(`Strapi error: ${response.status}`);
    }

    const data = await response.json();
    const order = data.data || null;
    if (order) {
      mapServiceOrderInventoryItems(order);
    }

    return NextResponse.json({ data: order });
  } catch (error) {
    console.error("Error fetching service order:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la orden de servicio" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const documentId = await resolveDocumentId(id, jwt);
    if (!documentId) {
      return NextResponse.json(
        { error: "Orden de servicio no encontrada" },
        { status: 404 }
      );
    }

    const rawPayload = await request.json();
    const actualPayload = rawPayload.data || rawPayload;
    const { appointment: appointmentId, ...orderPayload } = actualPayload;

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/service-orders/${documentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: orderPayload }),
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Strapi error response:", errorData);
      const errorMessage =
        errorData.error?.message ||
        `Error ${response.status}: ${response.statusText}`;
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          {
            error:
              "Permiso denegado. Verifica los permisos del API token en Strapi.",
          },
          { status: response.status }
        );
      }
      if (response.status === 409) {
        return NextResponse.json(
          {
            error: errorMessage,
            code: errorData.error?.details?.code || "STOCK_INSUFFICIENT",
          },
          { status: 409 }
        );
      }
      throw new Error(errorMessage);
    }

    const orderData = await response.json();

    if (orderPayload.status === "cancelado" && appointmentId) {
      try {
        const resolvedAppointmentId =
          typeof appointmentId === "string"
            ? appointmentId
            : appointmentId?.documentId || appointmentId?.id;

        if (resolvedAppointmentId) {
          await fetch(
            `${STRAPI_BASE_URL}/api/appointments/${resolvedAppointmentId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${jwt}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ data: { status: "cancelada" } }),
              cache: "no-store",
            }
          );
        }
      } catch (appointmentError) {
        console.error("Error cancelando cita asociada:", appointmentError);
      }
    }

    return NextResponse.json({ data: orderData.data || orderData });
  } catch (error) {
    console.error("Error updating service order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error al actualizar la orden",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const documentId = await resolveDocumentId(id, jwt);
    if (!documentId) {
      return NextResponse.json(
        { error: "Orden de servicio no encontrada" },
        { status: 404 }
      );
    }

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/service-orders/${documentId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      throw new Error(`Strapi error: ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting service order:", error);
    return NextResponse.json(
      { error: "No se pudo eliminar la orden de servicio" },
      { status: 500 }
    );
  }
}
