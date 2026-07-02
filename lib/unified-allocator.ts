/**
 * Unified FIFO Debt Allocator
 *
 * Unifica cuotas (billing-records) y penalidades (penalty-debts) en una sola cola
 * ordenada por dueDate ASC, con desempate: penalidad antes que cuota.
 *
 * Aplica pagos (adelantos) en cascada hasta agotar el monto o las deudas.
 * Rastrea cada aplicación en payment-application (ledger de auditoría).
 */

import qs from "qs";
import { STRAPI_BASE_URL, STRAPI_API_TOKEN } from "./config";
import { getCurrentUserJwt } from "./auth";
import { applyAdvanceAmountToQuota, checkAndUpdateParentIfPaid } from "./billing";

// ============================================================================
// TIPOS
// ============================================================================

export interface UnifiedDebt {
  kind: "quota" | "penalty";
  documentId: string;
  numericId: number;
  dueDate: string;
  amountPending: number;
  // quota-specific
  quotaNumber?: number;
  originalAmount?: number;
  status?: string;
}

export interface AllocationStep {
  kind: "quota" | "penalty";
  targetDocumentId: string;
  targetNumericId: number;
  amountApplied: number;
  debtBefore: number;
  debtAfter: number;
}

export interface AllocationResult {
  steps: AllocationStep[];
  totalApplied: number;
  leftover: number;
}

// ============================================================================
// FETCHERS
// ============================================================================

/**
 * Obtener penalidades abiertas asociadas a cuotas específicas.
 * Status: pending | partially_paid
 *
 * FIX: Strapi v5 no puebla la relación `financing` en penalty-debt correctamente
 *      desde la API REST. En su lugar, buscamos por `quotaRecord.documentId`
 *      usando la lista de cuotas abiertas del financiamiento.
 */
export async function fetchOpenPenaltyDebts(quotaDocumentIds: string[]): Promise<UnifiedDebt[]> {
  if (!quotaDocumentIds || quotaDocumentIds.length === 0) {
    return [];
  }

  // Build $in filter for quotaRecord.documentId
  const quotaFilter: any = {};
  if (quotaDocumentIds.length === 1) {
    quotaFilter.documentId = { $eq: quotaDocumentIds[0] };
  } else {
    quotaFilter.documentId = { $in: quotaDocumentIds };
  }

  const query = qs.stringify(
    {
      filters: {
        quotaRecord: quotaFilter,
        status: { $in: ["pending", "partially_paid"] },
        amountPending: { $gt: 0 },
      },
      sort: ["dueDate:asc"],
      pagination: { pageSize: 500 },
    },
    { encodeValuesOnly: true }
  );

  const res = await fetch(`${STRAPI_BASE_URL}/api/penalty-debts?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchOpenPenaltyDebts] Error:", await res.text());
    return [];
  }

  const json = await res.json();
  const items = json.data || [];

  return items.map((item: any) => {
    // Strapi v5 may return flat structure (item.dueDate) or nested (item.attributes.dueDate)
    const attrs = item.attributes || item;
    return {
      kind: "penalty" as const,
      documentId: item.documentId,
      numericId: item.id,
      dueDate: attrs.dueDate || item.dueDate,
      amountPending: parseFloat(
        attrs.amountPending ||
          item.amountPending ||
          attrs.amountOriginal ||
          item.amountOriginal ||
          0
      ),
      status: attrs.status || item.status,
    };
  });
}

/**
 * Obtener cuotas abiertas de un financiamiento.
 * Solo raíces (parentRecord null), no hijos.
 * Excluye cubiertas / pagadas completas.
 * Calcula balance real considerando abonos hijos.
 */
export async function fetchOpenQuotas(financingDocumentId: string): Promise<UnifiedDebt[]> {
  const query = qs.stringify(
    {
      filters: {
        financing: { documentId: { $eq: financingDocumentId } },
        status: { $in: ["pendiente", "retrasado", "abonado"] },
        parentRecord: { $null: true },
      },
      sort: ["dueDate:asc"],
      fields: [
        "id",
        "documentId",
        "amount",
        "quotaNumber",
        "dueDate",
        "status",
        "remainingQuotaBalance",
      ],
      populate: {
        childRecords: {
          fields: ["id", "documentId", "amount", "status"],
        },
      },
      pagination: { pageSize: 500 },
    },
    { encodeValuesOnly: true }
  );

  const res = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[fetchOpenQuotas] Error:", await res.text());
    return [];
  }

  const json = await res.json();
  const items = json.data || [];

  return items
    .map((item: any) => {
      const attrs = item.attributes || item;
      const children = attrs.childRecords?.data || attrs.childRecords || [];
      const childrenTotal = children.reduce((sum: number, c: any) => {
        const ca = c.attributes || c;
        return sum + (parseFloat(ca.amount || 0) > 0 ? parseFloat(ca.amount || 0) : 0);
      }, 0);
      const originalAmount = parseFloat(attrs.amount || 0);
      const balance = Math.max(0, originalAmount - childrenTotal);

      return {
        kind: "quota" as const,
        documentId: item.documentId,
        numericId: item.id,
        dueDate: attrs.dueDate,
        amountPending: balance,
        originalAmount,
        quotaNumber: attrs.quotaNumber,
        status: attrs.status,
      };
    })
    .filter((d: UnifiedDebt) => d.amountPending > 0);
}

/**
 * Unificar y ordenar cola de deudas.
 * Orden: dueDate ASC, desempate: penalidad antes que cuota.
 */
export function buildDebtQueue(penalties: UnifiedDebt[], quotas: UnifiedDebt[]): UnifiedDebt[] {
  const all = [...penalties, ...quotas];
  all.sort((a, b) => {
    if (a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    // mismo dueDate: penalidad primero, luego cuota
    // (el conductor percibe que la deuda deja de crecer)
    if (a.kind === "penalty" && b.kind === "quota") return -1;
    if (a.kind === "quota" && b.kind === "penalty") return 1;
    return 0;
  });
  return all;
}

// ============================================================================
// PURE ALLOCATOR
// ============================================================================

/**
 * Construye plan de asignación FIFO unificado (sin side-effects).
 */
export function buildAllocationPlan(paymentAmount: number, debts: UnifiedDebt[]): AllocationResult {
  let left = parseFloat(paymentAmount.toFixed(2));
  const steps: AllocationStep[] = [];

  for (const debt of debts) {
    if (left <= 0.01) break;
    if (debt.amountPending <= 0.01) continue;

    const apply = Math.min(left, debt.amountPending);
    const applyRounded = parseFloat(apply.toFixed(2));

    steps.push({
      kind: debt.kind,
      targetDocumentId: debt.documentId,
      targetNumericId: debt.numericId,
      amountApplied: applyRounded,
      debtBefore: debt.amountPending,
      debtAfter: parseFloat((debt.amountPending - applyRounded).toFixed(2)),
    });

    left = parseFloat((left - applyRounded).toFixed(2));
  }

  return {
    steps,
    totalApplied: parseFloat((paymentAmount - left).toFixed(2)),
    leftover: left,
  };
}

// ============================================================================
// EXECUTORS
// ============================================================================

/**
 * Crear registro de auditoría payment-application.
 */
async function createPaymentApplication(opts: {
  paymentRecordId: string;
  paymentNumericId: number;
  penaltyDebtId?: string;
  penaltyNumericId?: number;
  quotaRecordId?: string;
  quotaNumericId?: number;
  amountApplied: number;
  paymentLeftAfter: number;
  debtLeftAfter: number;
  notes?: string;
}) {
  const body: any = {
    data: {
      amountApplied: opts.amountApplied,
      appliedAt: new Date().toISOString(),
      paymentLeftAfter: opts.paymentLeftAfter,
      debtLeftAfter: opts.debtLeftAfter,
      paymentRecord: opts.paymentNumericId,
      notes: opts.notes || "Aplicación unificada FIFO",
    },
  };

  if (opts.penaltyNumericId) {
    body.data.penaltyDebt = opts.penaltyNumericId;
  }
  if (opts.quotaNumericId) {
    body.data.quotaRecord = opts.quotaNumericId;
  }

  const jwt = await getCurrentUserJwt();
  const res = await fetch(`${STRAPI_BASE_URL}/api/payment-applications`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[createPaymentApplication] Error:", await res.text());
  } else {
    const json = await res.json();
    console.log("[createPaymentApplication] ✓ Ledger record:", json.data?.documentId);
  }
}

/**
 * Aplicar monto a una penalidad abierta.
 */
export async function applyAllocationToPenalty(
  paymentRecord: { documentId: string; numericId: number; amount: number },
  penalty: UnifiedDebt,
  amountToApply: number
): Promise<boolean> {
  try {
    const newPending = parseFloat((penalty.amountPending - amountToApply).toFixed(2));
    const newStatus = newPending <= 0.01 ? "paid" : "partially_paid";

    const jwt = await getCurrentUserJwt();
    const updateRes = await fetch(`${STRAPI_BASE_URL}/api/penalty-debts/${penalty.documentId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          amountPending: newPending,
          status: newStatus,
        },
      }),
      cache: "no-store",
    });

    if (!updateRes.ok) {
      console.error(
        `[applyAllocationToPenalty] Error updating penalty ${penalty.documentId}:`,
        await updateRes.text()
      );
      return false;
    }

    console.log(
      `[applyAllocationToPenalty] ✓ Penalty ${penalty.documentId} updated: pending=$${newPending}, status=${newStatus}`
    );

    await createPaymentApplication({
      paymentRecordId: paymentRecord.documentId,
      paymentNumericId: paymentRecord.numericId,
      penaltyDebtId: penalty.documentId,
      penaltyNumericId: penalty.numericId,
      amountApplied: amountToApply,
      paymentLeftAfter: parseFloat((paymentRecord.amount - amountToApply).toFixed(2)),
      debtLeftAfter: newPending,
      notes: `Aplicación a penalidad ${penalty.documentId}`,
    });

    return true;
  } catch (error) {
    console.error("[applyAllocationToPenalty] Error:", error);
    return false;
  }
}

/**
 * Aplicar monto a una cuota usando la lógica existente de adelantos.
 * Crea un abono hijo y reduce el monto disponible del pago raíz.
 */
export async function applyAllocationToQuota(
  paymentRecord: { documentId: string; numericId: number; amount: number },
  quota: UnifiedDebt,
  amountToApply: number,
  financingNumericId: number
): Promise<boolean> {
  try {
    const applied = await applyAdvanceAmountToQuota(
      {
        documentId: paymentRecord.documentId,
        numericId: paymentRecord.numericId,
        amount: paymentRecord.amount,
      },
      {
        documentId: quota.documentId,
        numericId: quota.numericId,
        amount: quota.originalAmount || quota.amountPending,
        quotaNumber: quota.quotaNumber || 0,
        dueDate: quota.dueDate,
      },
      amountToApply,
      financingNumericId
    );

    if (!applied) {
      console.error(`[applyAllocationToQuota] Error aplicando a cuota ${quota.documentId}`);
      return false;
    }

    // Ledger
    await createPaymentApplication({
      paymentRecordId: paymentRecord.documentId,
      paymentNumericId: paymentRecord.numericId,
      quotaRecordId: quota.documentId,
      quotaNumericId: quota.numericId,
      amountApplied: amountToApply,
      paymentLeftAfter: parseFloat((paymentRecord.amount - amountToApply).toFixed(2)),
      debtLeftAfter: parseFloat((quota.amountPending - amountToApply).toFixed(2)),
      notes: `Aplicación a cuota #${quota.quotaNumber}`,
    });

    return true;
  } catch (error) {
    console.error("[applyAllocationToQuota] Error:", error);
    return false;
  }
}

/**
 * Actualizar el pago raíz después de asignaciones.
 * Si leftover <= 0.01 → status pagado (consumido totalmente).
 * Si leftover > 0.01 → amount = leftover, status adelanto.
 */
export async function finalizePaymentRecord(
  paymentDocumentId: string,
  leftover: number
): Promise<void> {
  try {
    const newAmount = parseFloat(leftover.toFixed(2));
    const newStatus = newAmount <= 0.01 ? "pagado" : "adelanto";

    const jwt = await getCurrentUserJwt();
    const res = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${paymentDocumentId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          amount: newAmount,
          status: newStatus,
          comments: `Asignación unificada finalizada. Remanente: $${newAmount}`,
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[finalizePaymentRecord] Error finalizing ${paymentDocumentId}:`,
        await res.text()
      );
    } else {
      console.log(
        `[finalizePaymentRecord] ✓ Payment ${paymentDocumentId} finalized: amount=$${newAmount}, status=${newStatus}`
      );
    }
  } catch (error) {
    console.error("[finalizePaymentRecord] Error:", error);
  }
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Flujo completo de asignación unificada FIFO.
 *
 * 1. Carga deudas abiertas (penalidades + cuotas).
 * 2. Plan de asignación.
 * 3. Ejecución paso a paso con ledger.
 * 4. Finalización del pago raíz.
 */
export async function unifiedAllocatePayment(
  paymentRecord: { documentId: string; numericId: number; amount: number },
  financingDocumentId: string,
  financingNumericId: number
): Promise<AllocationResult> {
  console.log(
    `[unifiedAllocatePayment] Starting allocation for payment ${paymentRecord.documentId} ($${paymentRecord.amount})`
  );

  // PASO 0: Generar/actualizar penalidades acumuladas antes de cargar deudas.
  // Esto garantiza que toda mora calculada hasta este momento esté
  // registrada como penalty-debt y participe en la cola FIFO unificada.
  console.log(
    `[unifiedAllocatePayment] Step 0: Accruing penalties for financing ${financingDocumentId}...`
  );
  const penaltiesAccrued = await accruePenaltiesForFinancing(financingDocumentId, 10);
  console.log(
    `[unifiedAllocatePayment] Step 0 complete: ${penaltiesAccrued} penalty debt(s) accrued/updated`
  );

  // FIX: Fetch quotas FIRST to get their documentIds, then fetch penalties
  //      by quotaRecord.documentId because Strapi v5 doesn't populate
  //      the financing relation on penalty-debt correctly.
  const quotas = await fetchOpenQuotas(financingDocumentId);
  const quotaDocumentIds = quotas.map((q) => q.documentId);
  const penalties = await fetchOpenPenaltyDebts(quotaDocumentIds);
  const debts = buildDebtQueue(penalties, quotas);

  console.log(
    `[unifiedAllocatePayment] Open debts: ${debts.length} (penalties=${penalties.length}, quotas=${quotas.length})`
  );
  console.log(
    debts.map(
      (d) =>
        `  [${d.kind}] ${d.documentId} #${d.quotaNumber || ""} due=${d.dueDate} pending=$${d.amountPending}`
    )
  );

  const plan = buildAllocationPlan(paymentRecord.amount, debts);

  console.log(
    `[unifiedAllocatePayment] Plan: ${plan.steps.length} steps, applied=$${plan.totalApplied}, leftover=$${plan.leftover}`
  );

  // Ejecutar pasos
  for (const step of plan.steps) {
    const debt = debts.find((d) => d.documentId === step.targetDocumentId);
    if (!debt) continue;

    if (debt.kind === "penalty") {
      await applyAllocationToPenalty(paymentRecord, debt, step.amountApplied);
    } else {
      await applyAllocationToQuota(paymentRecord, debt, step.amountApplied, financingNumericId);
      // After applying payment to a quota, check if the parent is now fully paid
      await checkAndUpdateParentIfPaid(debt.documentId);
    }

    // Reducir monto disponible del pago raíz para pasos subsiguientes
    paymentRecord.amount = parseFloat((paymentRecord.amount - step.amountApplied).toFixed(2));
  }

  await finalizePaymentRecord(paymentRecord.documentId, plan.leftover);

  return plan;
}

// ============================================================================
// PENALTY ACCRUAL
// ============================================================================

/**
 * Genera o actualiza penalidades acumuladas para un financiamiento.
 * Por cada cuota raíz vencida con saldo pendiente, crea/actualiza un
 * penalty-debt con 10% diario sobre el saldo pendiente.
 *
 * @returns número de penalidades generadas/actualizadas
 */
export async function accruePenaltiesForFinancing(
  financingDocumentId: string,
  lateFeePercentage: number = 10
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];

  // 1. Obtener cuotas candidatas a penalidad
  // FIX HIBRIDO:
  // - Incluir cuotas marcadas como retrasado/abonado (modo simulacion puede marcar
  //   retrasado aunque dueDate sea futuro respecto al reloj real)
  // - Incluir cuotas pendientes con dueDate <= hoy (mora real sin cambio de status)
  const query = qs.stringify(
    {
      filters: {
        financing: { documentId: { $eq: financingDocumentId } },
        status: { $in: ["pendiente", "retrasado", "abonado"] },
        parentRecord: { $null: true },
        $or: [{ status: { $in: ["retrasado", "abonado"] } }, { dueDate: { $lte: today } }],
      },
      fields: [
        "id",
        "documentId",
        "amount",
        "dueDate",
        "status",
        "quotaNumber",
        "daysLate",
        "lateFeeAmount",
      ],
      populate: {
        childRecords: {
          fields: ["id", "documentId", "amount"],
        },
      },
      pagination: { pageSize: 500 },
    },
    { encodeValuesOnly: true }
  );

  console.log(`[accruePenalties] Query URL: ${STRAPI_BASE_URL}/api/billing-records?${query}`);

  const res = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error("[accruePenalties] Error fetching quotas:", await res.text());
    return 0;
  }

  const json = await res.json();
  const quotas = json.data || [];
  console.log(
    `[accruePenalties] Found ${quotas.length} overdue quota(s) with balance > 0 for financing ${financingDocumentId}`
  );
  if (quotas.length === 0) {
    console.log(
      "[accruePenalties] No overdue quotas found. Possible reasons: all quotas are future-dated, fully paid, or query mismatch."
    );
  }
  let count = 0;

  for (const q of quotas) {
    const attrs = q.attributes || q;
    const children = attrs.childRecords?.data || attrs.childRecords || [];
    const childrenTotal = children.reduce((sum: number, c: any) => {
      const ca = c.attributes || c;
      return sum + (parseFloat(ca.amount || 0) > 0 ? parseFloat(ca.amount || 0) : 0);
    }, 0);
    const pendingBalance = Math.max(0, parseFloat(attrs.amount || 0) - childrenTotal);

    if (pendingBalance <= 0.01) continue;

    // HOTFIX: Always recalculate penaltyAmount from LIVE pendingBalance.
    // The lateFeeAmount snapshot in Strapi is stale (does not decrease when
    // the quota is partially paid). Use daysLate from Strapi cron if present,
    // fallback to date diff.
    let daysLate = parseInt(attrs.daysLate || 0);
    if (!daysLate || daysLate <= 0) {
      const due = new Date(attrs.dueDate);
      const now = new Date(today);
      const diffTime = now.getTime() - due.getTime();
      daysLate = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    if (daysLate <= 0) {
      console.log(
        `[accruePenalties] Quota #${attrs.quotaNumber} due=${attrs.dueDate} is NOT late (daysLate=0), skipping`
      );
      continue;
    }

    // Recalculate penalty from LIVE balance and daysLate.
    // Do NOT use attrs.lateFeeAmount — it is a stale snapshot.
    const penaltyAmount = parseFloat(
      (pendingBalance * (lateFeePercentage / 100) * daysLate).toFixed(2)
    );

    console.log(
      `[accruePenalties] Quota #${attrs.quotaNumber} due=${attrs.dueDate} pendingBalance=$${pendingBalance} daysLate=${daysLate} penaltyAmount=$${penaltyAmount}`
    );

    // HOTFIX: Buscar CUALQUIER penalty existente para esta cuota (incluido pagado)
    // para evitar recreación después de que se pague completamente.
    const existingQuery = qs.stringify(
      {
        filters: {
          quotaRecord: { documentId: { $eq: q.documentId } },
        },
        sort: ["createdAt:desc"],
        pagination: { pageSize: 1 },
      },
      { encodeValuesOnly: true }
    );

    const existingRes = await fetch(`${STRAPI_BASE_URL}/api/penalty-debts?${existingQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    let existingPenalty: any = null;
    if (existingRes.ok) {
      const existingJson = await existingRes.json();
      if (existingJson.data && existingJson.data.length > 0) {
        existingPenalty = existingJson.data[0];
      }
    }

    if (existingPenalty) {
      // HOTFIX: Normalize flat vs nested Strapi v5 response
      const epAttrs = existingPenalty.attributes || existingPenalty;
      const oldOriginal = parseFloat(epAttrs.amountOriginal || existingPenalty.amountOriginal || 0);
      const oldPending = parseFloat(epAttrs.amountPending || existingPenalty.amountPending || 0);
      const alreadyPaid = Math.max(0, parseFloat((oldOriginal - oldPending).toFixed(2)));

      // Calculate new pending preserving alreadyPaid
      const newPending = Math.max(0, parseFloat((penaltyAmount - alreadyPaid).toFixed(2)));
      const newStatus =
        newPending <= 0 ? "paid" : newPending < penaltyAmount ? "partially_paid" : "pending";

      // Idempotency guard: skip update if nothing meaningful changed
      const oldDays = parseInt(epAttrs.daysAccrued || existingPenalty.daysAccrued || 0);
      if (
        Math.abs(oldOriginal - penaltyAmount) < 0.01 &&
        Math.abs(oldPending - newPending) < 0.01 &&
        oldDays === daysLate &&
        (epAttrs.status || existingPenalty.status) === newStatus
      ) {
        console.log(
          `[accruePenalties] ⏭ Penalty ${existingPenalty.documentId} for quota #${attrs.quotaNumber} unchanged (original=${penaltyAmount}, pending=${newPending}, days=${daysLate}, status=${newStatus}). Skipping update.`
        );
        continue;
      }

      const jwt = await getCurrentUserJwt();
      const updateRes = await fetch(
        `${STRAPI_BASE_URL}/api/penalty-debts/${existingPenalty.documentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              amountOriginal: penaltyAmount,
              amountPending: newPending,
              daysAccrued: daysLate,
              status: newStatus,
            },
          }),
          cache: "no-store",
        }
      );

      if (updateRes.ok) {
        console.log(
          `[accruePenalties] ✓ Updated penalty ${existingPenalty.documentId} for quota #${attrs.quotaNumber}: original=${penaltyAmount}, pending=${newPending}, days=${daysLate}, status=${newStatus}`
        );
        count++;
      } else {
        console.error(`[accruePenalties] Error updating penalty:`, await updateRes.text());
      }
    } else {
      // Crear nuevo penalty
      // FIX: Use documentId (not numericId) for relations in Strapi v5 REST API
      const createRes = await fetch(`${STRAPI_BASE_URL}/api/penalty-debts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            amountOriginal: penaltyAmount,
            amountPending: penaltyAmount,
            dueDate: attrs.dueDate, // mismo dueDate que la cuota para orden FIFO
            status: "pending",
            daysAccrued: daysLate,
            dailyRatePercent: lateFeePercentage,
            source: "auto_accrual",
            notes: `Penalidad acumulada por ${daysLate} días de mora sobre cuota #${attrs.quotaNumber}`,
            financing: financingDocumentId,
            quotaRecord: q.documentId,
          },
        }),
        cache: "no-store",
      });

      if (createRes.ok) {
        const createJson = await createRes.json();
        console.log(
          `[accruePenalties] ✓ Created penalty ${createJson.data?.documentId} for quota #${attrs.quotaNumber}: amount=${penaltyAmount}, days=${daysLate}`
        );
        count++;
      } else {
        console.error(`[accruePenalties] Error creating penalty:`, await createRes.text());
      }
    }
  }

  return count;
}
