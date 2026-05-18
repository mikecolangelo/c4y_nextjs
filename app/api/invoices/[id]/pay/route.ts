import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";

// POST - Marcar factura como pagada
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { paymentDate, paymentMethod } = body;

    if (!paymentDate) {
      return NextResponse.json(
        { error: "La fecha de pago es requerida" },
        { status: 400 }
      );
    }

    // Obtener la factura actual
    const getResponse = await fetch(
      `${STRAPI_BASE_URL}/api/invoices/${id}?populate=*`,
      {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      }
    );

    if (!getResponse.ok) {
      throw new Error("Error obteniendo factura");
    }

    const invoiceData = await getResponse.json();
    const invoice = invoiceData.data;

    if (!invoice) {
      return NextResponse.json(
        { error: "Factura no encontrada" },
        { status: 404 }
      );
    }

    // Actualizar factura a pagada
    const updateResponse = await fetch(
      `${STRAPI_BASE_URL}/api/invoices/${id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            status: "paid",
            paymentDate,
            paymentMethod: paymentMethod || "cash",
            notes: `${invoice.notes || ""} | Pagado el ${paymentDate}`
          }
        }),
        cache: "no-store",
      }
    );

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`Error actualizando factura: ${errorText}`);
    }

    // Actualizar el financiamiento relacionado
    if (invoice.financing?.id) {
      const financingId = invoice.financing.id;
      
      // Obtener financiamiento actual
      const financingResponse = await fetch(
        `${STRAPI_BASE_URL}/api/financings/${financingId}`,
        {
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          },
          cache: "no-store",
        }
      );
      
      if (financingResponse.ok) {
        const financingData = await financingResponse.json();
        const financing = financingData.data;
        
        const newPaidQuotas = (financing.paidQuotas || 0) + 1;
        const newBalance = Math.max(0, (financing.currentBalance || 0) - invoice.amount);
        const newTotalPaid = (financing.totalPaid || 0) + invoice.amount;
        
        // Determinar nuevo estado
        let newStatus = financing.status;
        if (newBalance <= 0) {
          newStatus = "completado";
        }
        
        await fetch(
          `${STRAPI_BASE_URL}/api/financings/${financingId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: {
                paidQuotas: newPaidQuotas,
                currentBalance: newBalance,
                totalPaid: newTotalPaid,
                status: newStatus
              }
            }),
            cache: "no-store",
          }
        );
      }
    }

    const updatedData = await updateResponse.json();
    return NextResponse.json({ data: updatedData.data });
  } catch (error) {
    console.error("Error pagando factura:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
