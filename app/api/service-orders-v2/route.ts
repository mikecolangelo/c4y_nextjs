import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET - Obtener órdenes de servicio
export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const populate = searchParams.get("populate");

    const queryString = qs.stringify(
      {
        populate:
          populate === "*"
            ? {
                vehicle: {
                  fields: ["id", "documentId", "name", "placa"],
                },
                services: {
                  fields: ["id", "name", "price"],
                },
                appointment: {
                  fields: ["id", "scheduledAt", "status"],
                },
                driver: {
                  fields: ["id", "documentId", "displayName"],
                },
              }
            : undefined,
        sort: ["createdAt:desc"],
        pagination: {
          pageSize: 100,
        },
      },
      { encodeValuesOnly: true }
    );

    const response = await fetch(
      `${STRAPI_BASE_URL}/api/service-orders?${queryString}`,
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
    console.error("Error fetching service orders:", error);
    return NextResponse.json(
      { error: "No se pudieron cargar las órdenes de servicio" },
      { status: 500 }
    );
  }
}

// POST - Crear nueva orden de servicio
export async function POST(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // 1. Crear la orden de servicio (body ya incluye { data: {...}, usedItems: [...] })
    const orderResponse = await fetch(
      `${STRAPI_BASE_URL}/api/service-orders`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error("[API /service-orders-v2 POST] Strapi error:", {
        status: orderResponse.status,
        body: body,
        error: errorData,
      });
      throw new Error(errorData.error?.message || "Error al crear la orden");
    }

    const orderData = await orderResponse.json();
    const orderId = orderData.data?.id || orderData.data?.documentId;
    const orderAttributes = orderData.data?.attributes || orderData.data;

    // 2. Si la orden se creó exitosamente y tiene fecha programada, crear cita automáticamente
    if (orderId && orderAttributes?.scheduledAt) {
      try {
        const vehicleId = body.data?.vehicle;
        let vehicleName = "";
        let vehicleNumericId: number | undefined;

        if (vehicleId) {
          const vehicleResponse = await fetch(
            `${STRAPI_BASE_URL}/api/fleets/${vehicleId}?fields[0]=id&fields[1]=name&fields[2]=brand&fields[3]=model`,
            {
              headers: {
                Authorization: `Bearer ${jwt}`,
              },
            }
          );
          if (vehicleResponse.ok) {
            const vehicleData = await vehicleResponse.json();
            const vData = vehicleData.data;
            const vAttrs = vData?.attributes || vData;
            vehicleName =
              vAttrs?.name || `${vAttrs?.brand} ${vAttrs?.model}` || "";
            // Strapi v5 requiere ID numérico para relaciones en POST
            vehicleNumericId = vData?.id ?? undefined;
          }
        }

        const appointmentPayload = {
          data: {
            title: `Orden de Servicio - ${vehicleName || "Sin vehículo"}`,
            type: "mantenimiento",
            status: mapOrderStatusToAppointment(orderAttributes.status),
            scheduledAt: orderAttributes.scheduledAt,
            description:
              orderAttributes.summary ||
              `Orden de servicio creada automáticamente`,
            serviceOrder: orderId,
            vehicle: vehicleNumericId || undefined,
          },
        };

        const appointmentResponse = await fetch(
          `${STRAPI_BASE_URL}/api/appointments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${jwt}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(appointmentPayload),
          }
        );

        if (!appointmentResponse.ok) {
          console.error(
            "[Service Orders V2] Failed to create appointment:",
            await appointmentResponse.text()
          );
        } else {
          console.log(
            "[Service Orders V2] Appointment created successfully for order:",
            orderId
          );
        }
      } catch (appointmentError) {
        console.error(
          "[Service Orders V2] Error creating appointment:",
          appointmentError
        );
      }
    }

    return NextResponse.json({ data: orderData }, { status: 201 });
  } catch (error) {
    console.error("Error creating service order:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Error al crear la orden",
      },
      { status: 500 }
    );
  }
}

function mapOrderStatusToAppointment(
  orderStatus: string
): "pendiente" | "confirmada" | "cancelada" {
  switch (orderStatus) {
    case "pendiente":
      return "pendiente";
    case "en_progreso":
      return "confirmada";
    case "completado":
      return "confirmada";
    default:
      return "pendiente";
  }
}
