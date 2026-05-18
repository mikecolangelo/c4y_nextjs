import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";
import { cookies } from "next/headers";

// Función para obtener el JWT del usuario desde las cookies
async function getUserJWT(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("jwt")?.value || null;
  } catch {
    return null;
  }
}

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
      },
    },
    { encodeValuesOnly: true }
  );
};

const resolveDocumentId = async (id: string): Promise<string | null> => {
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
    const res = await fetch(`${STRAPI_BASE_URL}/api/service-orders?${query}`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data?.[0]?.documentId ?? null;
  }
  return id;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    if (!id || id === "undefined" || id === "null") {
      return NextResponse.json(
        { error: "ID de orden inválido" },
        { status: 400 }
      );
    }
    const documentId = await resolveDocumentId(id);
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
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      console.error(`[ServiceOrder API] Strapi GET error ${response.status}:`, errorText.substring(0, 500));
      if (response.status === 404) {
        return NextResponse.json(
          { error: "Orden de servicio no encontrada" },
          { status: 404 }
        );
      }
      throw new Error(`Strapi error: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data || null });
  } catch (error) {
    console.error("Error fetching service order:", error);
    return NextResponse.json(
      { error: "No se pudo cargar la orden de servicio" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const documentId = await resolveDocumentId(id);
    if (!documentId) {
      return NextResponse.json(
        { error: "Orden de servicio no encontrada" },
        { status: 404 }
      );
    }

    const rawPayload = await request.json();
    // Soportar formato viejo { data: { ... } } y nuevo { ... }
    const actualPayload = rawPayload.data || rawPayload;
    const { appointment: appointmentId, ...orderPayload } = actualPayload;

    // Intentar usar el JWT del usuario del header Authorization, fallback al token maestro
    const authHeader = request.headers.get("Authorization");
    const userJWT = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    async function updateServiceOrder(token: string) {
      return fetch(
        `${STRAPI_BASE_URL}/api/service-orders/${documentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: orderPayload }),
          cache: "no-store",
        }
      );
    }

    let response: Response;
    let tokenToUse: string;

    if (userJWT) {
      response = await updateServiceOrder(userJWT);
      tokenToUse = userJWT;
      if ((response.status === 401 || response.status === 403) && STRAPI_API_TOKEN) {
        response = await updateServiceOrder(STRAPI_API_TOKEN);
        tokenToUse = STRAPI_API_TOKEN;
      }
    } else if (STRAPI_API_TOKEN) {
      response = await updateServiceOrder(STRAPI_API_TOKEN);
      tokenToUse = STRAPI_API_TOKEN;
    } else {
      return NextResponse.json(
        { error: "No hay token de autenticación" },
        { status: 401 }
      );
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Strapi error response:", errorData);
      const errorMessage = errorData.error?.message || `Error ${response.status}: ${response.statusText}`;
      // Propagar errores de permisos con su código original
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json(
          { error: "Permiso denegado. Verifica los permisos del API token en Strapi." },
          { status: response.status }
        );
      }
      throw new Error(errorMessage);
    }

    const orderData = await response.json();

    // 2. Si se canceló la orden y tiene cita asociada, cancelar la cita también
    if (orderPayload.status === "cancelado" && appointmentId) {
      try {
        const resolvedAppointmentId =
          typeof appointmentId === "string"
            ? appointmentId
            : appointmentId?.documentId || appointmentId?.id;

        if (resolvedAppointmentId) {
          await fetch(`${STRAPI_BASE_URL}/api/appointments/${resolvedAppointmentId}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${tokenToUse}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data: { status: "cancelada" } }),
            cache: "no-store",
          });
        }
      } catch (appointmentError) {
        console.error("Error cancelando cita asociada:", appointmentError);
      }
    }

    return NextResponse.json({ data: orderData.data || orderData });
  } catch (error) {
    console.error("Error updating service order:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al actualizar la orden" },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const documentId = await resolveDocumentId(id);
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
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
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
