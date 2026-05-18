import { NextResponse } from "next/server";
import { STRAPI_BASE_URL, STRAPI_API_TOKEN } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { autoCoverPendingQuotas } from "@/lib/billing";

/**
 * Workaround para draftAndPublish activo a nivel de BD en Strapi v5.
 * Aunque el schema JSON dice draftAndPublish: false, Strapi no ha sido
 * recompilado, por lo que la BD sigue creando versiones draft + published.
 * La query de lista devuelve el ID del draft en financing.id, pero Strapi
 * rechaza relaciones con el draft. Esta función resuelve el ID numérico
 * del documento PUBLICADO consultando por documentId.
 */
async function resolvePublishedFinancingId(
  documentId: string,
  token: string
): Promise<number | null> {
  try {
    const response = await fetch(
      `${STRAPI_BASE_URL}/api/financings/${documentId}?status=published&fields[0]=id`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    if (!response.ok) {
      console.warn(`[resolvePublishedFinancingId] HTTP ${response.status} para ${documentId}`);
      return null;
    }
    const data = await response.json();
    const numericId = data.data?.id ?? null;
    if (numericId && typeof numericId === "number") {
      return numericId;
    }
    return null;
  } catch (err) {
    console.error(`[resolvePublishedFinancingId] Error para ${documentId}:`, err);
    return null;
  }
}

// POST - Simular generación de facturas (modo martes)
export async function POST(request: Request) {
  try {
    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { success: false, error: "No autenticado" },
        { status: 401 }
      );
    }

    // Usar API token para peticiones internas a Strapi (operación de sistema)
    // Fallback al JWT de usuario si no hay API token configurado
    const strapiToken = STRAPI_API_TOKEN || jwt;

    const body = await request.json();
    const { simulationDate = new Date().toISOString().split('T')[0], currentWeek = 1 } = body;

    // Obtener TODOS los financiamientos y filtrar manualmente (el filtro $in no funciona bien en Strapi 5)
    // IMPORTANTE: incluir 'id' (numérico) porque Strapi v5 requiere ID numérico para crear relaciones,
    // no acepta documentId en el payload de POST de billing-records
    const financingResponse = await fetch(
      `${STRAPI_BASE_URL}/api/financings?status=published&fields[0]=id&fields[1]=documentId&fields[2]=quotaAmount&fields[3]=totalQuotas&fields[4]=status&populate[0]=client&populate[1]=vehicle`,
      {
        headers: { Authorization: `Bearer ${strapiToken}` },
        cache: "no-store",
      }
    );

    if (!financingResponse.ok) {
      const errorStatus = financingResponse.status;
      const errorText = await financingResponse.text().catch(() => "(no body)");
      console.error(`[SimulateGeneration] ERROR obteniendo financiamientos: HTTP ${errorStatus} - ${errorText}`);
      console.error(`[SimulateGeneration] JWT usado (primeros 20 chars): ${jwt?.substring(0, 20)}...`);
      throw new Error(`Error obteniendo financiamientos: HTTP ${errorStatus}`);
    }

    const financingData = await financingResponse.json();
    const allFinancings = financingData.data || [];
    
    // Filtrar solo activos o en_mora
    const financings = allFinancings.filter((f: any) => 
      f.status === "activo" || f.status === "en_mora"
    );
    
    console.log(`[SimulateGeneration] Total financiamientos: ${allFinancings.length}, Filtrados (activo/en_mora): ${financings.length}`);

    // Calcular jueves de la semana de simulación
    const simDate = new Date(simulationDate);
    const currentDay = simDate.getDay();
    const daysUntilThursday = (4 - currentDay + 7) % 7 || 7;
    const thursday = new Date(simDate);
    thursday.setDate(simDate.getDate() + daysUntilThursday);
    const dueDate = thursday.toISOString().split('T')[0];

    const generatedInvoices = [];
    let generatedCount = 0;

    for (const financing of financings) {
      const financingDocumentId = financing.documentId || financing.id;
      
      // WORKAROUND: Resolver el ID numérico del documento PUBLICADO.
      // financing.id puede ser el ID del draft cuando draftAndPublish está
      // activo en BD. Strapi v5 rechaza relaciones con el draft.
      const financingNumericId = await resolvePublishedFinancingId(
        financingDocumentId,
        strapiToken
      );
      if (!financingNumericId) {
        console.warn(`[SimulateGeneration] No se pudo resolver publishedId para ${financingDocumentId}, saltando.`);
        continue;
      }
      
      // Verificar si ya existe una cuota para este financiamiento en esta fecha
      const existingResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[financing][documentId][$eq]=${financingDocumentId}&filters[dueDate][$eq]=${dueDate}&filters[status][$ne]=adelanto`,
        {
          headers: { Authorization: `Bearer ${strapiToken}` },
          cache: "no-store",
        }
      );

      const existingData = await existingResponse.json();
      if (existingData.data && existingData.data.length > 0) {
        console.log(`[SimulateGeneration] Ya existe cuota para financing ${financingDocumentId} en fecha ${dueDate}`);
        continue;
      }

      // Obtener TODOS los billing-records para calcular cuotas cubiertas y adelantos
      const allRecordsResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[financing][documentId][$eq]=${financingDocumentId}&pagination[limit]=100&populate[childRecords][fields][0]=amount`,
        {
          headers: { Authorization: `Bearer ${strapiToken}` },
          cache: "no-store",
        }
      );
      
      const allRecordsData = await allRecordsResponse.json();
      const allRecords = allRecordsData.data || [];
      
      console.log(`[SimulateGeneration] Financing ${financingDocumentId}: Total records: ${allRecords.length}`);
      
      // Calcular cuotas ya pagadas
      const fullyPaidQuotas = new Set<number>();
      
      for (const record of allRecords) {
        if ((record.status === "pagado" || record.status === "cubierta") && record.quotaNumber) {
          fullyPaidQuotas.add(record.quotaNumber);
        }
      }
      
      // Buscar adelantos con saldo disponible
      // BUGFIX: Calcular saldo SIEMPRE dinámicamente: amount - sum(children.amount)
      // NUNCA confiar en advanceCredit persistido en BD.
      const availableAdvances: Array<{id: number; documentId: string; amount: number; consumed: number; available: number}> = [];
      
      for (const record of allRecords) {
        // Incluir TODOS los adelantos con parentRecord null (raíz)
        // Un adelanto es un PADRE, nunca un hijo.
        if (record.status === "adelanto") {
          const consumedAmount = (record.childRecords || []).reduce(
            (sum: number, child: any) => sum + (child.amount || 0), 
            0
          );
          const availableAmount = record.amount - consumedAmount;
          
          if (availableAmount > 0.01) {
            availableAdvances.push({
              id: record.id,
              documentId: record.documentId,
              amount: record.amount,
              consumed: consumedAmount,
              available: availableAmount
            });
            console.log(`[SimulateGeneration] Adelanto disponible: ${record.documentId} (id=${record.id}), total=$${record.amount}, consumido=$${consumedAmount}, disponible=$${availableAmount}`);
          }
        }
      }
      
      // Ordenar adelantos por fecha de creación (FIFO)
      availableAdvances.sort((a, b) => a.documentId.localeCompare(b.documentId));
      
      // La cuota a generar corresponde a la semana actual de simulación
      const quotaNumberToGenerate = currentWeek;
      
      // Verificar que no exceda el total de cuotas del financiamiento
      if (quotaNumberToGenerate > (financing.totalQuotas || 999)) {
        continue;
      }
      
      // Verificar si ya existe una cuota para este número
      const existingQuotaResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records?status=published&filters[financing][documentId][$eq]=${financingDocumentId}&filters[quotaNumber][$eq]=${quotaNumberToGenerate}`,
        {
          headers: { Authorization: `Bearer ${strapiToken}` },
          cache: "no-store",
        }
      );
      
      const existingQuotaData = await existingQuotaResponse.json();
      const existingQuota = existingQuotaData.data?.[0];
      
      if (existingQuota) {
        // Cuota ya existe (cualquier estado), no generar duplicado
        console.log(`[SimulateGeneration] Cuota #${quotaNumberToGenerate} ya existe con status: ${existingQuota.status}, saltando.`);
        continue;
      }
      
      // Si la cuota ya está completamente pagada, no generar
      if (fullyPaidQuotas.has(quotaNumberToGenerate)) {
        console.log(`[SimulateGeneration] Cuota #${quotaNumberToGenerate} ya pagada/cubierta`);
        continue;
      }
      
      // ================================================================
      // CREAR LA CUOTA
      // ================================================================
      const invoicePayload = {
        financing: financingNumericId, // Strapi v5 requiere ID numérico, NO documentId
        receiptNumber: `SIM-${simulationDate.replace(/-/g, '')}-${financingDocumentId}-${quotaNumberToGenerate}`,
        amount: financing.quotaAmount,
        currency: "PAB",
        status: "pendiente",
        dueDate: dueDate,
        quotaNumber: quotaNumberToGenerate,
        lateFeeAmount: 0,
        isSimulated: true,
      };
      
      console.log(`[SimulateGeneration] Creando cuota #${quotaNumberToGenerate}`);

      const createResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${strapiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ data: invoicePayload }),
          cache: "no-store",
        }
      );
      
      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error(`[SimulateGeneration] ERROR creando cuota: ${createResponse.status} - ${errorText}`);
        continue;
      }
      
      const invoiceData = await createResponse.json();
      const newQuotaDocumentId = invoiceData.data.documentId;
      console.log(`[SimulateGeneration] Cuota creada: ${newQuotaDocumentId}`);
      
      generatedInvoices.push({
        id: invoiceData.data.id,
        receiptNumber: invoiceData.data.receiptNumber,
        financingId: financingDocumentId,
        amount: financing.quotaAmount,
        quotaNumber: quotaNumberToGenerate,
      });
      generatedCount++;
      
      // ================================================================
      // VINCULAR CUOTA A ADELANTO DISPONIBLE (SI HAY)
      // ================================================================
      if (availableAdvances.length > 0) {
        // Tomar el primer adelanto disponible (FIFO)
        const advance = availableAdvances[0];
        
        if (advance.available >= financing.quotaAmount) {
          console.log(`[SimulateGeneration] Vinculando cuota ${newQuotaDocumentId} a adelanto ${advance.documentId}`);
          
          // Calcular nuevo saldo disponible
          const newAvailable = advance.available - financing.quotaAmount;
          
          // Actualizar la cuota: vincularla al adelanto como hija
          // BUGFIX: Usar ID numérico (advance.id) para parentRecord, NO documentId
          const updateQuotaResponse = await fetch(
            `${STRAPI_BASE_URL}/api/billing-records/${newQuotaDocumentId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${strapiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                data: {
                  status: "cubierta",
                  parentRecord: advance.id,
                  comments: `Cubierta por adelanto: ${advance.documentId}`,
                },
              }),
              cache: "no-store",
            }
          );
          
          if (updateQuotaResponse.ok) {
            console.log(`[SimulateGeneration] ✓ Cuota vinculada como hija de adelanto ${advance.documentId}`);
            // BUGFIX: NO actualizar advanceCredit ni status del adelanto.
            // El saldo se calcula dinámicamente: amount - sum(childRecords.amount)
            // Un adelanto nace adelanto y muere adelanto (o pagado), NUNCA abonado.
          } else {
            const errorText = await updateQuotaResponse.text();
            console.error(`[SimulateGeneration] ERROR vinculando cuota: ${updateQuotaResponse.status} - ${errorText}`);
          }
        } else if (advance.available > 0) {
          // CASO PARCIAL: El adelanto no cubre la cuota completa
          console.log(`[SimulateGeneration] Adelanto parcial: aplicando $${advance.available} de $${financing.quotaAmount} a cuota ${newQuotaDocumentId}`);
          
          // Calcular saldo pendiente de la cuota
          const remainingBalance = financing.quotaAmount - advance.available;
          
          // Vincular la cuota al adelanto como hija (abonada parcialmente)
          // BUGFIX: Usar ID numérico (advance.id) para parentRecord
          const updateQuotaResponse = await fetch(
            `${STRAPI_BASE_URL}/api/billing-records/${newQuotaDocumentId}`,
            {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${strapiToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                data: {
                  status: "abonado", // Cuota parcialmente pagada
                  parentRecord: advance.id,
                  remainingQuotaBalance: remainingBalance,
                  comments: `Abonado parcialmente por adelanto: ${advance.documentId}. Saldo pendiente: $${remainingBalance}`,
                },
              }),
              cache: "no-store",
            }
          );
          
          if (updateQuotaResponse.ok) {
            console.log(`[SimulateGeneration] ✓ Cuota abonada parcialmente, saldo pendiente: $${remainingBalance}`);
            // BUGFIX: NO actualizar advanceCredit ni mutar el status del adelanto.
            // El saldo se calcula dinámicamente. El adelanto sigue siendo adelanto.
          } else {
            const errorText = await updateQuotaResponse.text();
            console.error(`[SimulateGeneration] ERROR abonando cuota: ${updateQuotaResponse.status} - ${errorText}`);
          }
        }
      }

      // Auto-cover: cubrir cualquier cuota pendiente con adelantos disponibles
      // Se ejecuta al final de cada financing para cubrir cuotas existentes + nuevas
      console.log(`[SimulateGeneration] Ejecutando auto-cover para financing ${financingDocumentId}`);
      const autoCovered = await autoCoverPendingQuotas(financingDocumentId);
      if (autoCovered.length > 0) {
        console.log(`[SimulateGeneration] Auto-cover cubrió ${autoCovered.length} cuota(s):`, autoCovered);
      }
    }

    return NextResponse.json({
      success: true,
      generatedCount,
      invoices: generatedInvoices,
      simulationDate,
      dueDate,
    });
    
  } catch (error) {
    console.error("[SimulateGeneration] Error:", error);
    return NextResponse.json(
      { success: false, error: "Error en simulación" },
      { status: 500 }
    );
  }
}
