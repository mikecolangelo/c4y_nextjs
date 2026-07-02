import { NextResponse } from "next/server";
import {
  fetchBillingRecordByIdFromStrapi,
  updateBillingRecordInStrapi,
  deleteBillingRecordFromStrapi,
  verifyBillingRecordInStrapi,
  findClosestParentRecord,
  checkAndUpdateParentIfPaid,
  type BillingRecordUpdatePayload,
} from "@/lib/billing";
import { fetchFinancingByIdFromStrapi, processPayment } from "@/lib/financing";
import { requireModulePermission } from "@/lib/module-guard";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/billing/[id]
 * Obtener un pago por ID
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("billing", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const record = await fetchBillingRecordByIdFromStrapi(id);

    if (!record) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("Error fetching billing record:", error);
    return NextResponse.json({ error: "No se pudo obtener el pago." }, { status: 500 });
  }
}

/**
 * PUT /api/billing/[id]
 * Actualizar un pago
 */
export async function PUT(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("billing", "canUpdate");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    const body = await request.json();
    const { data, action } = body as {
      data?: BillingRecordUpdatePayload;
      action?: "verify";
    };

    // Acción especial: verificar pago
    if (action === "verify") {
      const { verifiedBy } = body as { verifiedBy?: string };
      // verifiedBy es opcional - si no hay ID válido, solo se marca como verificado
      const record = await verifyBillingRecordInStrapi(id, verifiedBy);
      return NextResponse.json({ data: record });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Los datos de actualización son requeridos." },
        { status: 400 }
      );
    }

    // Validar monto si está presente (permitir negativos para ajustes de multas)
    if (data.amount !== undefined && data.amount !== null) {
      if (typeof data.amount !== "number") {
        return NextResponse.json({ error: "El monto debe ser un número válido." }, { status: 400 });
      }
    }

    // Validar status si está presente
    if (data.status !== undefined) {
      if (!["pagado", "pendiente", "adelanto", "retrasado", "abonado"].includes(data.status)) {
        return NextResponse.json(
          {
            error: "El estado debe ser 'pagado', 'pendiente', 'adelanto', 'retrasado' o 'abonado'.",
          },
          { status: 400 }
        );
      }
    }

    // Obtener el registro actual antes de actualizar (necesario para varias operaciones)
    const currentRecord = await fetchBillingRecordByIdFromStrapi(id);

    // AUTO-ASOCIAR: Solo abonos parciales (menor a una cuota) se auto-vinculan
    // Si el pago cubre 1+ cuotas, se mantiene como raíz
    if (data.parentRecord === undefined && !currentRecord?.parentRecordId) {
      if (currentRecord?.financingDocumentId) {
        // Obtener financiamiento para calcular si es abono parcial
        const financing = await fetchFinancingByIdFromStrapi(currentRecord.financingDocumentId);
        if (financing) {
          const amount = data.amount ?? currentRecord.amount ?? 0;
          const { quotasCovered } = processPayment(
            amount,
            financing.quotaAmount,
            financing.partialPaymentCredit || 0
          );

          // Solo auto-vincular si NO cubre cuotas completas
          if (quotasCovered === 0) {
            const paymentDate = data.paymentDate || currentRecord.paymentDate;
            if (paymentDate) {
              console.log(`[API Billing PUT] Abono parcial (${amount}), auto-vinculando`);

              const closestParentId = await findClosestParentRecord(
                currentRecord.financingDocumentId,
                paymentDate
              );

              if (closestParentId && closestParentId !== id) {
                data.parentRecord = closestParentId;
              }
            }
          } else {
            console.log(
              `[API Billing PUT] Pago cubre ${quotasCovered} cuota(s), manteniendo como raíz`
            );
          }
        }
      }
    }

    const record = await updateBillingRecordInStrapi(id, data);

    // DESPUÉS DE ACTUALIZAR: Si se asoció/desasoció un hijo (parentRecord cambió),
    // verificar si el padre afectado debe cambiar a "pagado" (si está saldado)
    if (data.parentRecord !== undefined && currentRecord?.financingDocumentId) {
      // Si se asoció a un padre, verificar ese padre
      if (data.parentRecord) {
        console.log(
          `[API Billing PUT] Checking if parent ${data.parentRecord} should be marked as paid`
        );
        await checkAndUpdateParentIfPaid(data.parentRecord);
      }
      // Si se desasoció de un padre anterior, verificar ese padre también
      if (currentRecord.parentRecordId && currentRecord.parentRecordId !== data.parentRecord) {
        console.log(
          `[API Billing PUT] Checking if previous parent ${currentRecord.parentRecordId} should be updated`
        );
        await checkAndUpdateParentIfPaid(currentRecord.parentRecordId);
      }
    }

    return NextResponse.json({ data: record });
  } catch (error) {
    console.error("Error updating billing record:", error);

    if (error instanceof Error && error.message.includes("404")) {
      return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
    }

    return NextResponse.json({ error: "No se pudo actualizar el pago." }, { status: 500 });
  }
}

/**
 * DELETE /api/billing/[id]
 * Eliminar un pago
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    try {
      await requireModulePermission("billing", "canDelete");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { id } = await context.params;
    console.log(`[API DELETE /api/billing/${id}] Iniciando eliminación`);

    await deleteBillingRecordFromStrapi(id);

    console.log(`[API DELETE /api/billing/${id}] Eliminación exitosa`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API DELETE] Error detallado:", error);

    if (error instanceof Error) {
      console.error("[API DELETE] Error message:", error.message);
      console.error("[API DELETE] Error stack:", error.stack);

      if (error.message.includes("404")) {
        return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });
      }

      // Devolver el mensaje de error específico para debugging
      return NextResponse.json({ error: `Error al eliminar: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ error: "No se pudo eliminar el pago." }, { status: 500 });
  }
}
