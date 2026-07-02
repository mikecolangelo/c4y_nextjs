import { NextResponse } from "next/server";
import { STRAPI_BASE_URL, STRAPI_API_TOKEN } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-guard";
import { accruePenaltiesForFinancing } from "@/lib/unified-allocator";

// Función auxiliar: Calcula el mapa de cuotas cubiertas por financing
async function getCoveredQuotasMap(
  financingDocumentIds: string[],
  token: string
): Promise<Map<string, Set<number>>> {
  const coveredMap = new Map<string, Set<number>>();

  if (financingDocumentIds.length === 0) return coveredMap;

  try {
    // Obtener todos los billing-records de los financiamientos en una sola query
    // Usar documentId para Strapi 5
    const idsFilter = financingDocumentIds.join(",");
    const response = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[financing][documentId][$in]=${idsFilter}&fields[0]=quotaNumber&fields[1]=status&fields[2]=quotasCovered&fields[3]=financing&pagination[limit]=1000`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error("[getCoveredQuotasMap] Error fetching records:", await response.text());
      return coveredMap;
    }

    const data = await response.json();
    const records = data.data || [];

    console.log(
      `[getCoveredQuotasMap] Encontrados ${records.length} records para financingDocumentIds: [${idsFilter}]`
    );

    for (const record of records) {
      // Manejar formato Strapi v5 (data) o formato plano
      const recordData = record.attributes || record;
      const financingData = recordData.financing?.data || recordData.financing;
      const financingDocumentId = financingData?.documentId || financingData?.id;

      if (!financingDocumentId) {
        console.log(`[getCoveredQuotasMap] Record sin financingDocumentId:`, recordData);
        continue;
      }

      const financingKey = String(financingDocumentId);

      if (!coveredMap.has(financingKey)) {
        coveredMap.set(financingKey, new Set<number>());
      }

      const coveredSet = coveredMap.get(financingKey)!;
      const quotaNumber = recordData.quotaNumber;
      const status = recordData.status;
      const quotasCovered = recordData.quotasCovered;

      if (status === "pagado" && quotaNumber) {
        // Cuota pagada individualmente
        coveredSet.add(quotaNumber);
        console.log(`[getCoveredQuotasMap] F${financingKey} Cuota #${quotaNumber} pagada`);
      } else if ((status === "abonado" || status === "adelanto") && quotaNumber) {
        // Abono/adelanto cubre un rango de cuotas
        const coveredCount = quotasCovered || 1;
        for (let i = 0; i < coveredCount; i++) {
          coveredSet.add(quotaNumber + i);
        }
        console.log(
          `[getCoveredQuotasMap] F${financingKey} Cuotas #${quotaNumber}-${quotaNumber + coveredCount - 1} ${status}`
        );
      }
    }

    return coveredMap;
  } catch (error) {
    console.error("[getCoveredQuotasMap] Error:", error);
    return coveredMap;
  }
}

// Función auxiliar: Verifica si una cuota está cubierta
function isQuotaCovered(
  coveredMap: Map<string, Set<number>>,
  financingDocumentId: string,
  quotaNumber: number
): boolean {
  const coveredSet = coveredMap.get(financingDocumentId);
  if (!coveredSet) {
    console.log(`[isQuotaCovered] No hay datos de cuotas cubiertas para F${financingDocumentId}`);
    return false;
  }

  const isCovered = coveredSet.has(quotaNumber);
  console.log(
    `[isQuotaCovered] F${financingDocumentId} quota #${quotaNumber}: ${isCovered ? "CUBIERTA" : "NO cubierta"} (set: [${Array.from(coveredSet).join(",")}])`
  );
  return isCovered;
}

// Función auxiliar: Calcula el balance pendiente de una cuota considerando abonos
function calculatePendingBalance(invoiceData: any): number {
  const totalAmount = parseFloat(invoiceData.amount) || 0;

  // Obtener childRecords (abonos) - pueden estar en diferentes formatos
  const childRecords = invoiceData.childRecords?.data || invoiceData.childRecords || [];

  if (!childRecords || childRecords.length === 0) {
    return totalAmount; // Sin abonos, el pendiente es el total
  }

  // Sumar todos los abonos positivos
  const totalAbonos = childRecords.reduce((sum: number, child: any) => {
    const childData = child.attributes || child;
    const childAmount = parseFloat(childData.amount) || 0;
    // Solo sumar abonos positivos (no ajustes negativos)
    return sum + (childAmount > 0 ? childAmount : 0);
  }, 0);

  const pendingBalance = Math.max(0, totalAmount - totalAbonos);

  console.log(
    `[calculatePendingBalance] Cuota ${invoiceData.receiptNumber || "N/A"}: Total=$${totalAmount}, Abonos=$${totalAbonos}, Pendiente=$${pendingBalance}`
  );

  return pendingBalance;
}

// POST - Simular vencimiento de facturas
// Modo normal (viernes): marca pendientes como retrasadas + actualiza existentes
// Modo update-existing (martes): solo actualiza cuotas ya retrasadas
export async function POST(request: Request) {
  try {
    try {
      await requireAdmin();
    } catch {
      return NextResponse.json(
        { success: false, error: "Se requieren permisos de administrador." },
        { status: 403 }
      );
    }

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const strapiToken = STRAPI_API_TOKEN || jwt;
    const body = await request.json();
    const { simulationDate = new Date().toISOString().split("T")[0], mode = "normal" } = body;

    // Obtener configuración de penalidad
    const configResponse = await fetch(`${STRAPI_BASE_URL}/api/configurations`, {
      headers: { Authorization: `Bearer ${strapiToken}` },
      cache: "no-store",
    });

    const configData = await configResponse.json();
    const configs = configData.data || [];
    const penaltyConfig = configs.find(
      (c: { key?: string; value?: string }) => c.key === "billing-penalty-percentage"
    );
    const penaltyPercentage = penaltyConfig?.value ? parseFloat(penaltyConfig.value) : 10;

    // Modo "update-existing": solo actualizar cuotas ya retrasadas (para Simular Martes)
    // Modo "normal": marcar pendientes como retrasadas + actualizar existentes (para Simular Viernes)

    let pendingInvoices: any[] = [];
    let existingOverdue: any[] = [];

    if (mode === "normal") {
      // Buscar CUOTAS PENDIENTES para marcarlas como retrasadas
      // populate[financing] para obtener el financingDocumentId
      // populate[childRecords] para calcular el balance real considerando abonos
      const pendingQueryUrl = `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[status][$eq]=pendiente&filters[dueDate][$lte]=${simulationDate}&populate[financing]=true&populate[childRecords]=true`;

      const pendingResponse = await fetch(pendingQueryUrl, {
        headers: { Authorization: `Bearer ${strapiToken}` },
        cache: "no-store",
      });

      if (!pendingResponse.ok) {
        throw new Error("Error obteniendo cuotas pendientes");
      }

      const pendingData = await pendingResponse.json();
      pendingInvoices = pendingData.data || [];
      console.log(`[SimulateOverdue] Pendientes encontrados: ${pendingInvoices.length}`);
      if (pendingInvoices.length > 0) {
        console.log(
          `[SimulateOverdue] Primer pendiente:`,
          JSON.stringify(pendingInvoices[0], null, 2)
        );
      }
    }

    // Buscar CUOTAS YA RETRASADAS para recalcular multas (siempre, en ambos modos)
    // populate[childRecords] para calcular el balance real considerando abonos
    const overdueQueryUrl = `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[status][$eq]=retrasado&filters[dueDate][$lte]=${simulationDate}&populate[financing]=true&populate[childRecords]=true`;

    const overdueResponse = await fetch(overdueQueryUrl, {
      headers: { Authorization: `Bearer ${strapiToken}` },
      cache: "no-store",
    });

    const overdueData = overdueResponse.ok ? await overdueResponse.json() : { data: [] };
    existingOverdue = overdueData.data || [];
    console.log(`[SimulateOverdue] Retrasadas encontradas: ${existingOverdue.length}`);
    if (existingOverdue.length > 0) {
      console.log(
        `[SimulateOverdue] Primera retrasada:`,
        JSON.stringify(existingOverdue[0], null, 2)
      );
    }

    // Combinar resultados
    let invoices: any[] = [...pendingInvoices, ...existingOverdue];
    if (!Array.isArray(invoices)) {
      invoices = [];
    }
    console.log(`[SimulateOverdue] Total invoices a procesar: ${invoices.length}`);

    // Obtener todos los financingDocumentIds únicos para calcular cuotas cubiertas de una vez
    const financingDocumentIds = new Set<string>();
    for (const invoice of invoices) {
      const invoiceData = invoice.attributes || invoice;
      const financingData = invoiceData.financing?.data || invoiceData.financing;
      const financingDocumentId = financingData?.documentId || financingData?.id;

      if (financingDocumentId) {
        financingDocumentIds.add(String(financingDocumentId));
        console.log(`[SimulateOverdue] FinancingDocumentId extraído: ${financingDocumentId}`);
      } else {
        console.log(
          `[SimulateOverdue] No se pudo extraer financingDocumentId de:`,
          invoiceData.financing
        );
      }
    }

    console.log(
      `[SimulateOverdue] FinancingDocumentIds encontrados: [${Array.from(financingDocumentIds).join(",")}]`
    );

    // Calcular mapa de cuotas cubiertas por financing (una sola llamada)
    const coveredQuotasMap = await getCoveredQuotasMap(
      Array.from(financingDocumentIds),
      strapiToken
    );

    // Log detallado del mapa
    console.log(`[SimulateOverdue] Mapa de cuotas cubiertas:`);
    for (const [id, set] of coveredQuotasMap.entries()) {
      const quotas = Array.from(set).sort((a, b) => a - b);
      console.log(`  F${id}: [${quotas.join(",")}]`);
    }

    const updatedInvoices = [];
    let totalPenaltyAmount = 0;

    for (const invoice of invoices) {
      const invoiceData = invoice.attributes || invoice;

      // Verificar nuevamente que no esté pagada (doble verificación)
      if (invoiceData.status === "pagado" || invoiceData.status === "adelanto") {
        continue;
      }

      // Obtener el financingDocumentId asociado al record
      const financingData = invoiceData.financing?.data || invoiceData.financing;
      const financingDocumentId = financingData?.documentId || financingData?.id;
      const quotaNumber = invoiceData.quotaNumber;

      console.log(
        `[SimulateOverdue] Procesando record: quotaNumber=${quotaNumber}, status=${invoiceData.status}, financingDocumentId=${financingDocumentId}`
      );

      // Si hay financing y quotaNumber, verificar si está cubierta por abono
      if (financingDocumentId && quotaNumber) {
        const isCovered = isQuotaCovered(
          coveredQuotasMap,
          String(financingDocumentId),
          quotaNumber
        );
        if (isCovered) {
          console.log(
            `[SimulateOverdue]   → SKIPPED: Cuota #${quotaNumber} de financing ${financingDocumentId} está cubierta por abono/adelanto`
          );
          continue; // No marcar como retrasado si está cubierta
        }
      } else {
        console.log(
          `[SimulateOverdue]   → No se pudo verificar: financingDocumentId=${financingDocumentId}, quotaNumber=${quotaNumber}`
        );
      }

      // Calcular el balance pendiente considerando abonos (childRecords)
      const pendingBalance = calculatePendingBalance(invoiceData);

      // Calcular días de vencimiento (días naturales DESPUÉS del dueDate)
      // dueDate = jueves, simulationDate = viernes → 1 día de atraso
      const dueParts = invoiceData.dueDate.split("-").map(Number);
      const simParts = simulationDate.split("-").map(Number);

      // Crear fechas en UTC para evitar problemas de timezone
      const dueDate = Date.UTC(dueParts[0], dueParts[1] - 1, dueParts[2]);
      const simDate = Date.UTC(simParts[0], simParts[1] - 1, simParts[2]);

      // Diferencia en días completos
      const msPerDay = 24 * 60 * 60 * 1000;
      const rawDaysOverdue = Math.round((simDate - dueDate) / msPerDay);

      // Mínimo 1 día de retraso si ya está vencida
      const daysOverdue = Math.max(1, rawDaysOverdue);

      // Penalidad: 10% por día de retraso sobre el MONTO PENDIENTE (acumulativo)
      // Ejemplo: Si cuota es $225 y tiene $100 abonado, pendiente = $125
      // $125 × 10% × 2 días = $25.00
      const penaltyPerDay = (pendingBalance * penaltyPercentage) / 100;
      const penaltyAmount = penaltyPerDay * daysOverdue;
      const totalAmount = parseFloat(invoiceData.amount) || 0;
      // Total a pagar = monto pendiente + penalidad (NO el total de la cuota)
      const totalWithPenalty = pendingBalance + penaltyAmount;

      const recordId = invoice.documentId || invoiceData.documentId || invoice.id;

      // Determinar si debemos cambiar el status
      // En modo "normal", marcar pendientes como retrasado
      // En modo "update-existing", mantener el status existente (ya está retrasado)
      const newStatus =
        mode === "normal" && invoiceData.status === "pendiente" ? "retrasado" : invoiceData.status;

      // Actualizar cuota con penalidad (y nuevo status si aplica)
      const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${recordId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${strapiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            status: newStatus,
            lateFeeAmount: penaltyAmount,
            daysLate: daysOverdue,
          },
        }),
        cache: "no-store",
      });

      if (!updateResponse.ok) {
        continue;
      }

      // HOTFIX: Auto-generar penalty-debt cuando una cuota se marca como retrasada
      if (financingDocumentId) {
        try {
          const penaltiesCount = await accruePenaltiesForFinancing(financingDocumentId, 10);
          if (penaltiesCount > 0) {
            console.log(
              `[SimulateOverdue] ✓ Generated ${penaltiesCount} penalty debt(s) for financing ${financingDocumentId}`
            );
          }
        } catch (penaltyErr) {
          console.error(
            `[SimulateOverdue] ⚠ Penalty accrual failed for financing ${financingDocumentId}:`,
            penaltyErr
          );
          // No bloquear el flujo principal si el accrual falla
        }
      }

      updatedInvoices.push({
        id: invoice.id,
        documentId: invoice.documentId,
        receiptNumber: invoiceData.receiptNumber,
        financingId: financingDocumentId,
        amount: totalAmount,
        pendingBalance: pendingBalance,
        penaltyPerDay: penaltyPerDay,
        daysOverdue: daysOverdue,
        penaltyAmount: penaltyAmount,
        totalWithPenalty: totalWithPenalty,
        dueDate: invoiceData.dueDate,
        quotaNumber: quotaNumber,
      });
      totalPenaltyAmount += penaltyAmount;
    }

    return NextResponse.json({
      success: true,
      overdueCount: updatedInvoices.length,
      totalPenaltyAmount,
      simulationDate,
      penaltyPercentage,
      invoices: updatedInvoices,
    });
  } catch (error) {
    console.error("[Simulate Overdue] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}

// GET - Solo consultar cuotas vencidas sin actualizar
export async function GET(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    }

    const strapiToken = STRAPI_API_TOKEN || jwt;
    const { searchParams } = new URL(request.url);
    const simulationDate =
      searchParams.get("simulationDate") || new Date().toISOString().split("T")[0];

    // Obtener configuración de penalidad
    const configResponse = await fetch(`${STRAPI_BASE_URL}/api/configurations`, {
      headers: { Authorization: `Bearer ${strapiToken}` },
      cache: "no-store",
    });

    const configData = await configResponse.json();
    const configs = configData.data || [];
    const penaltyConfig = configs.find(
      (c: { key?: string; value?: string }) => c.key === "billing-penalty-percentage"
    );
    const penaltyPercentage = penaltyConfig?.value ? parseFloat(penaltyConfig.value) : 10;

    // Buscar cuotas pendientes que estarían vencidas
    // populate[childRecords] para calcular el balance real considerando abonos
    const pendingResponse = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[status][$eq]=pendiente&filters[dueDate][$lt]=${simulationDate}&populate[financing]=true&populate[childRecords]=true`,
      {
        headers: { Authorization: `Bearer ${strapiToken}` },
        cache: "no-store",
      }
    );

    if (!pendingResponse.ok) {
      throw new Error("Error obteniendo cuotas");
    }

    const pendingData = await pendingResponse.json();

    // Buscar cuotas ya retrasadas
    // populate[childRecords] para calcular el balance real considerando abonos
    const overdueResponse = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[status][$eq]=retrasado&filters[dueDate][$lt]=${simulationDate}&populate[financing]=true&populate[childRecords]=true`,
      {
        headers: { Authorization: `Bearer ${strapiToken}` },
        cache: "no-store",
      }
    );

    const overdueData = overdueResponse.ok ? await overdueResponse.json() : { data: [] };

    // Combinar resultados
    const invoices = [...(pendingData.data || []), ...(overdueData.data || [])];

    // Obtener todos los financingDocumentIds únicos
    const financingDocumentIds = new Set<string>();
    for (const invoice of invoices) {
      const invoiceData = invoice.attributes || invoice;
      const financingData = invoiceData.financing?.data || invoiceData.financing;
      const financingDocumentId = financingData?.documentId || financingData?.id;
      if (financingDocumentId) {
        financingDocumentIds.add(String(financingDocumentId));
      }
    }

    // Calcular mapa de cuotas cubiertas por financing
    const coveredQuotasMap = await getCoveredQuotasMap(
      Array.from(financingDocumentIds),
      strapiToken
    );

    const overdueInvoices = [];
    let totalPenaltyAmount = 0;

    for (const invoice of invoices) {
      const invoiceData = invoice.attributes || invoice;

      // Excluir pagadas
      if (invoiceData.status === "pagado" || invoiceData.status === "adelanto") {
        continue;
      }

      // Obtener el financingDocumentId y quotaNumber
      const financingData = invoiceData.financing?.data || invoiceData.financing;
      const financingDocumentId = financingData?.documentId || financingData?.id;
      const quotaNumber = invoiceData.quotaNumber;

      // Si hay financing y quotaNumber, verificar si está cubierta por abono
      if (financingDocumentId && quotaNumber) {
        const isCovered = isQuotaCovered(
          coveredQuotasMap,
          String(financingDocumentId),
          quotaNumber
        );
        if (isCovered) {
          continue; // No incluir en consulta si está cubierta
        }
      }

      // Calcular el balance pendiente considerando abonos (childRecords)
      const pendingBalance = calculatePendingBalance(invoiceData);

      // Calcular días de vencimiento (días naturales DESPUÉS del dueDate)
      const dueParts = invoiceData.dueDate.split("-").map(Number);
      const simParts = simulationDate.split("-").map(Number);

      const dueDate = Date.UTC(dueParts[0], dueParts[1] - 1, dueParts[2]);
      const simDate = Date.UTC(simParts[0], simParts[1] - 1, simParts[2]);

      const msPerDay = 24 * 60 * 60 * 1000;
      const rawDaysOverdue = Math.round((simDate - dueDate) / msPerDay);
      const daysOverdue = Math.max(1, rawDaysOverdue);

      // Penalidad: 10% por día de retraso sobre el MONTO PENDIENTE (acumulativo)
      const penaltyPerDay = (pendingBalance * penaltyPercentage) / 100;
      const penaltyAmount = penaltyPerDay * daysOverdue;
      const totalAmount = parseFloat(invoiceData.amount) || 0;
      // Total a pagar = monto pendiente + penalidad (NO el total de la cuota)
      const totalWithPenalty = pendingBalance + penaltyAmount;

      overdueInvoices.push({
        id: invoice.id,
        documentId: invoice.documentId,
        receiptNumber: invoiceData.receiptNumber,
        financingId: financingDocumentId,
        amount: totalAmount,
        pendingBalance: pendingBalance,
        penaltyPerDay: penaltyPerDay,
        daysOverdue: daysOverdue,
        penaltyAmount: penaltyAmount,
        totalWithPenalty: totalWithPenalty,
        dueDate: invoiceData.dueDate,
        quotaNumber: quotaNumber,
      });

      totalPenaltyAmount += penaltyAmount;
    }

    return NextResponse.json({
      success: true,
      overdueCount: overdueInvoices.length,
      totalPenaltyAmount,
      simulationDate,
      penaltyPercentage,
      invoices: overdueInvoices,
    });
  } catch (error) {
    console.error("Error consultando vencidos:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
