import { NextResponse } from "next/server";
import {
  createBillingRecordInStrapi,
  getStrapiNumericId,
  type BillingRecordCreatePayload,
} from "@/lib/billing";
import { fetchFinancingByIdFromStrapi } from "@/lib/financing";
import { unifiedAllocatePayment } from "@/lib/unified-allocator";
import { requireModulePermission } from "@/lib/module-guard";

/**
 * POST /api/billing/unified
 * Crea un pago raíz y lo asigna automáticamente mediante FIFO unificado
 * (penalidades + cuotas ordenadas por dueDate).
 *
 * Body: {
 *   data: {
 *     financingDocumentId: string;
 *     amount: number;
 *     paymentDate?: string;
 *     dueDate?: string;
 *     comments?: string;
 *     confirmationNumber?: string;
 *     receiptNumber?: string; // opcional, si no se genera automáticamente
 *   }
 * }
 */
export async function POST(request: Request) {
  try {
    try {
      await requireModulePermission("billing", "canCreate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const body = await request.json();
    const { data } = body as {
      data?: {
        financingDocumentId: string;
        amount: number;
        paymentDate?: string;
        dueDate?: string;
        comments?: string;
        confirmationNumber?: string;
        receiptNumber?: string;
      };
    };

    if (!data) {
      return NextResponse.json({ error: "Los datos del pago son requeridos." }, { status: 400 });
    }

    if (!data.financingDocumentId) {
      return NextResponse.json(
        { error: "El ID del financiamiento es requerido." },
        { status: 400 }
      );
    }

    if (data.amount === undefined || data.amount === null || data.amount === 0) {
      return NextResponse.json(
        { error: "El monto es requerido y no puede ser 0." },
        { status: 400 }
      );
    }

    const financing = await fetchFinancingByIdFromStrapi(data.financingDocumentId);
    if (!financing) {
      return NextResponse.json({ error: "Financiamiento no encontrado." }, { status: 404 });
    }

    if (financing.status === "completado" || financing.status === "inactivo") {
      return NextResponse.json({ error: "El financiamiento no está activo." }, { status: 400 });
    }

    const dueDate = data.dueDate || new Date().toISOString().split("T")[0];
    const paymentDate = data.paymentDate || dueDate;

    const payload: BillingRecordCreatePayload = {
      amount: data.amount,
      currency: "PAB",
      quotaNumber: 0,
      dueDate,
      paymentDate,
      comments: data.comments || "Pago con asignación unificada FIFO",
      confirmationNumber: data.confirmationNumber,
      financing: data.financingDocumentId,
      status: "adelanto",
      parentRecord: null,
    };

    console.log(
      `[API Billing Unified] Creando pago raíz de $${data.amount} para financing ${data.financingDocumentId}`
    );

    const rootRecord = await createBillingRecordInStrapi(payload, financing);

    console.log(`[API Billing Unified] Pago raíz creado: ${rootRecord.documentId}`);

    const numericId = await getStrapiNumericId(rootRecord.documentId);
    if (!numericId) {
      return NextResponse.json(
        { error: "No se pudo obtener ID numérico del pago creado." },
        { status: 500 }
      );
    }

    const allocation = await unifiedAllocatePayment(
      {
        documentId: rootRecord.documentId,
        numericId,
        amount: data.amount,
      },
      data.financingDocumentId,
      financing.numericId || numericId // fallback
    );

    return NextResponse.json(
      {
        data: {
          paymentRecord: rootRecord,
          allocation,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[API Billing Unified] Error:", error);
    const message = error instanceof Error ? error.message : "Error procesando pago unificado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
