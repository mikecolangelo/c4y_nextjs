import { NextResponse } from "next/server";
import {
  fetchBillingRecordsFromStrapi,
  fetchBillingRecordsByFinancingFromStrapi,
  createBillingRecordInStrapi,
  findClosestParentRecord,
  checkAndUpdateParentIfPaid,
  markQuotasAsCovered,
  findAdvanceToCoverQuota,
  autoCoverPendingQuotas,
  recalculateFinancingMetrics,
  type BillingRecordCreatePayload,
} from "@/lib/billing";
import { fetchFinancingByIdFromStrapi, processPayment } from "@/lib/financing";
import { requireModulePermission } from "@/lib/module-guard";

/**
 * GET /api/billing
 * Obtener todos los pagos o filtrar por financing
 */
export async function GET(request: Request) {
  try {
    try {
      await requireModulePermission("billing", "canRead");
    } catch {
      return NextResponse.json(
        { error: "Acceso restringido: Se requieren permisos de administrador" },
        { status: 403 }
      );
    }
    const { searchParams } = new URL(request.url);
    const financingId = searchParams.get("financing");

    if (financingId) {
      // Obtener pagos específicos de un financiamiento
      console.log(`[API Billing] Fetching records for financing: ${financingId}`);
      const records = await fetchBillingRecordsByFinancingFromStrapi(financingId);
      console.log(
        `[API Billing] Found ${records.length} records`,
        records.map((r) => ({
          documentId: r.documentId,
          status: r.status,
          parentRecordId: r.parentRecordId,
          childCount: r.childRecords?.length,
        }))
      );
      return NextResponse.json(
        { data: records },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            Pragma: "no-cache",
          },
        }
      );
    }

    // Obtener todos los pagos
    const records = await fetchBillingRecordsFromStrapi();
    return NextResponse.json({ data: records });
  } catch (error) {
    console.error("Error fetching billing records:", error);
    return NextResponse.json({ error: "No se pudieron obtener los pagos." }, { status: 500 });
  }
}

/**
 * POST /api/billing
 * Crear un nuevo pago
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
    const { data } = body as { data?: BillingRecordCreatePayload };

    if (!data) {
      return NextResponse.json({ error: "Los datos del pago son requeridos." }, { status: 400 });
    }

    // Validaciones
    if (!data.financing) {
      return NextResponse.json({ error: "El financiamiento es requerido." }, { status: 400 });
    }

    // Permitir montos negativos para ajustes/devoluciones, pero no 0
    if (data.amount === undefined || data.amount === null || data.amount === 0) {
      return NextResponse.json(
        { error: "El monto es requerido y no puede ser 0." },
        { status: 400 }
      );
    }

    // Validar número de cuota (0 permitido para adelantos)
    if (data.quotaNumber === undefined || data.quotaNumber === null || data.quotaNumber < 0) {
      return NextResponse.json({ error: "El número de cuota es requerido." }, { status: 400 });
    }

    if (!data.dueDate) {
      return NextResponse.json({ error: "La fecha de vencimiento es requerida." }, { status: 400 });
    }

    // Obtener el financiamiento para calcular multas y cuotas
    const financing = await fetchFinancingByIdFromStrapi(data.financing);
    if (!financing) {
      return NextResponse.json({ error: "Financiamiento no encontrado." }, { status: 404 });
    }

    // Validar que el financiamiento esté activo
    if (financing.status === "completado") {
      return NextResponse.json(
        { error: "Este financiamiento ya está completado." },
        { status: 400 }
      );
    }

    if (financing.status === "inactivo") {
      return NextResponse.json({ error: "Este financiamiento está inactivo." }, { status: 400 });
    }

    // Calcular cuotas cubiertas por el monto del pago PRIMERO
    const { quotasCovered } = processPayment(data.amount, financing.quotaAmount, 0);

    console.log(
      `[API Billing POST] Monto: ${data.amount}, quotaAmount: ${financing.quotaAmount}, quotasCovered: ${quotasCovered}`
    );

    // Calcular información del pago
    const paymentInfo = processPayment(data.amount, financing.quotaAmount, 0);
    console.log(
      `[API Billing POST] Monto: $${data.amount}, quotaAmount: $${financing.quotaAmount}, quotasCovered: ${paymentInfo.quotasCovered}, advanceCredit: $${paymentInfo.advanceCredit}`
    );

    // Si el pago cubre múltiples cuotas (>= 2) Y no tiene quotaNumber específico,
    // es un ADELANTO PADRE que cubrirá múltiples cuotas futuras
    let isMultiQuotaPayment = quotasCovered >= 2 && !data.quotaNumber;

    // AUTO-ASOCIAR: Buscar cuota pendiente para vincular el pago
    // SIEMPRE vincular si hay una cuota pendiente, independientemente del monto
    if (!data.parentRecord && !isMultiQuotaPayment) {
      const paymentDate = data.paymentDate || data.dueDate;
      console.log(
        `[API Billing POST] Buscando cuota pendiente para vincular pago de $${data.amount}`
      );

      const closestParentId = await findClosestParentRecord(data.financing, paymentDate);

      if (closestParentId) {
        console.log(`[API Billing POST] ✓ Vinculando a cuota: ${closestParentId}`);
        data.parentRecord = closestParentId;

        // Si el pago cubre al menos 1 cuota completa Y tiene excedente,
        // el excedente queda disponible como crédito para futuras cuotas
        // y el status debe ser 'adelanto' para reflejar que tiene saldo disponible.
        // NOTA: Un pago parcial (quotasCovered === 0) NO es adelanto,
        // es un abono sobre la cuota actual.
        if (paymentInfo.quotasCovered >= 1 && paymentInfo.advanceCredit > 0) {
          console.log(
            `[API Billing POST] Pago con excedente ($${paymentInfo.advanceCredit}), marcando como adelanto`
          );
          data.status = "adelanto";
        }
      } else {
        console.log(`[API Billing POST] ⚠ No hay cuota pendiente, creando como raíz`);
        // FIX: Si no hay cuota pendiente, cualquier pago parcial es ADELANTO, no abonado.
        // Un abono requiere una cuota existente. Sin cuota, es crédito libre para futuro.
        data.status = "adelanto";
        data.quotaNumber = 0;
        data.parentRecord = null;
        console.log(
          `[API Billing POST] Forzando status=adelanto, quotaNumber=0, parentRecord=null`
        );
      }
    } else if (isMultiQuotaPayment) {
      console.log(
        `[API Billing POST] Pago multi-cuota sin quotaNumber específico (${quotasCovered} cuotas), será padre de las cuotas`
      );
    }

    // BUGFIX: Si el status es adelanto, FORZAR que sea raíz (parentRecord = null)
    // Un adelanto es un nodo PADRE que cubre múltiples cuotas, nunca un hijo.
    // ESTE BLOQUE VA DESPUÉS de la auto-asociación para capturar adelantos
    // detectados por excedente de pago.
    if (data.status === "adelanto") {
      console.log(
        `[API Billing POST] Adelanto detectado, forzando parentRecord = null y modo multi-cuota`
      );
      data.parentRecord = null;
      isMultiQuotaPayment = true;
    }

    const record = await createBillingRecordInStrapi(data, financing);

    // Si se auto-asoció a un padre, verificar si el padre debe cambiar a "pagado"
    if (data.parentRecord) {
      console.log(
        `[API Billing POST] Checking if parent ${data.parentRecord} should be marked as paid after auto-association`
      );
      await checkAndUpdateParentIfPaid(data.parentRecord);
    }

    // Si es un pago multi-cuota (>= 2 cuotas), marcar las cuotas como cubiertas
    if (quotasCovered >= 2 && !data.parentRecord && record.documentId) {
      console.log(
        `[API Billing POST] Pago multi-cuota (${quotasCovered} cuotas), marcando cuotas como cubiertas`
      );

      const coveredQuotas = await markQuotasAsCovered(
        record.documentId,
        data.financing,
        quotasCovered
      );

      console.log(
        `[API Billing POST] Marcadas ${coveredQuotas.length} cuotas como cubiertas por adelanto ${record.documentId}`
      );
    }

    // Si es una cuota pendiente nueva, buscar si hay un adelanto disponible que la pueda cubrir
    if (record.status === "pendiente" && !data.parentRecord && record.documentId) {
      console.log(`[API Billing POST] Cuota pendiente creada, buscando adelanto disponible...`);

      const availableAdvanceId = await findAdvanceToCoverQuota(
        record.amount,
        data.financing,
        record.documentId
      );

      if (availableAdvanceId) {
        console.log(
          `[API Billing POST] Vinculando cuota ${record.documentId} a adelanto ${availableAdvanceId}`
        );

        try {
          // Actualizar la cuota para vincularla al adelanto
          const { updateBillingRecordInStrapi } = await import("@/lib/billing");
          const updated = await updateBillingRecordInStrapi(record.documentId, {
            parentRecord: availableAdvanceId,
            status: "cubierta",
            comments: `Cubierta por adelanto: ${availableAdvanceId}`,
          });

          console.log(`[API Billing POST] Cuota actualizada:`, {
            id: updated.documentId,
            parentId: updated.parentRecordId,
            status: updated.status,
          });

          return NextResponse.json({ data: updated }, { status: 201 });
        } catch (updateError) {
          console.error(`[API Billing POST] Error actualizando cuota:`, updateError);
        }
      }
    }

    // AUTO-COVER GENERAL: Intentar cubrir cualquier cuota pendiente con adelantos disponibles
    // Se ejecuta después de crear cualquier pago (adelanto, abonado, pagado, etc.)
    // para asegurar que las cuotas existentes queden cubiertas si hay saldo disponible
    console.log(`[API Billing POST] Ejecutando auto-cover para financing ${data.financing}`);
    const autoCovered = await autoCoverPendingQuotas(data.financing);
    if (autoCovered.length > 0) {
      console.log(
        `[API Billing POST] Auto-cover cubrió ${autoCovered.length} cuota(s):`,
        autoCovered
      );
    }

    // RECALCULAR MÉTRICAS: Asegurar que paidQuotas, totalPaid y balance
    // reflejen el estado real tras todos los cambios (pago, auto-cover, excedentes)
    try {
      console.log(`[API Billing POST] Recalculando métricas de financing ${data.financing}`);
      await recalculateFinancingMetrics(data.financing);
      console.log(`[API Billing POST] ✓ Métricas recalculadas`);
    } catch (recalcError) {
      console.error(`[API Billing POST] Error recalculando métricas:`, recalcError);
      // No bloquear la respuesta por error de recálculo
    }

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("Error creating billing record:", error);

    let errorMessage = "No se pudo crear el pago.";
    let statusCode = 500;

    if (error instanceof Error) {
      const message = error.message;

      if (message.includes("Transición de estado inválida")) {
        errorMessage = message;
        statusCode = 400;
      } else if (message.includes("unique") || message.includes("already exists")) {
        errorMessage = "Ya existe un pago con este número de recibo.";
        statusCode = 400;
      } else if (message.includes("ValidationError")) {
        errorMessage = "Error de validación: verifica los datos ingresados.";
        statusCode = 400;
      }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
}
