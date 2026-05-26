/**
 * Librería de funciones para Pagos (Billing Records)
 * Pagos individuales vinculados a un Financiamiento
 */

import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";
import { formatCurrency } from "./format";
import {
  calculateLateFee,
  calculateDaysLate,
  processPayment,
  calculateNextDueDate,
  updateFinancingInStrapi,
  normalizeFinancing,
  type PaymentStatus,
  type FinancingCard,
  type FinancingStatus,
} from "./financing";

// ============================================================================
// TIPOS
// ============================================================================

export interface BillingRecordRaw {
  id: number;
  documentId: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  quotaNumber: number;
  quotasCovered: number;
  quotaAmountCovered?: number;
  advanceCredit: number;
  remainingQuotaBalance: number; // Saldo pendiente de la cuota actual
  lateFeeAmount: number;
  daysLate: number;
  dueDate: string;
  paymentDate?: string;
  confirmationNumber?: string;
  verifiedInBank: boolean;
  verifiedBy?: {
    id: number;
    documentId: string;
    displayName: string;
  };
  verifiedAt?: string;
  comments?: string;
  financing?: {
    id: number;
    documentId: string;
    financingNumber: string;
    quotaAmount: number;
    totalQuotas: number;
    paidQuotas: number;
    currentBalance: number;
    status: string;
    vehicle?: {
      id: number;
      documentId: string;
      name: string;
      placa?: string;
    };
    client?: {
      id: number;
      documentId: string;
      displayName: string;
      phone?: string;
      email?: string;
      address?: string;
      identificationNumber?: string;
      billingAddress?: string;
      billingTaxId?: string;
    };
  };
  documents?: Array<{
    id: number;
    documentId: string;
    name: string;
    file?: {
      url: string;
      mime: string;
    };
  }>;
  // Relaciones padre/hijo para anidación de recibos
  parentRecord?: {
    id: number;
    documentId: string;
    receiptNumber: string;
  } | null;
  childRecords?: BillingRecordRaw[];
  // Relaciones para pago multi-cuota (coveredBy = adelanto que cubrió esta cuota)
  coveredBy?: {
    id: number;
    documentId: string;
    receiptNumber: string;
  } | null;
  coveredQuotas?: BillingRecordRaw[];
  createdAt: string;
}

export interface BillingRecordCard {
  id: string;
  documentId: string;
  receiptNumber: string;
  amount: number;
  amountLabel: string;
  currency: string;
  status: PaymentStatus;
  statusLabel: string;
  quotaNumber: number;
  quotasCovered: number;
  quotaAmountCovered?: number;
  advanceCredit: number;
  remainingQuotaBalance: number; // Saldo pendiente de la cuota actual
  lateFeeAmount: number;
  lateFeeAmountLabel: string;
  daysLate: number;
  dueDate: string;
  dueDateLabel: string;
  paymentDate?: string;
  paymentDateLabel?: string;
  confirmationNumber?: string;
  verifiedInBank: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  comments?: string;
  // Financiamiento
  financingId?: string;
  financingDocumentId?: string;
  financingNumber?: string;
  financingQuotaAmount?: number;
  financingTotalQuotas?: number;
  financingPaidQuotas?: number;
  financingCurrentBalance?: number;
  // Vehículo (desde financing)
  vehicleName?: string;
  vehiclePlaca?: string;
  // Cliente (desde financing)
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  clientIdentificationNumber?: string;
  clientBillingAddress?: string;
  clientBillingTaxId?: string;
  // Documentos
  documents: Array<{
    id: string;
    documentId: string;
    name: string;
    url?: string;
    mime?: string;
  }>;
  // Relaciones padre/hijo para anidación de recibos
  parentRecordId?: string;
  parentRecordReceiptNumber?: string;
  childRecords?: BillingRecordCard[];
  // Relaciones para pago multi-cuota
  coveredById?: string;
  coveredByReceiptNumber?: string;
  coveredQuotas?: BillingRecordCard[];
  createdAt: string;
}

export interface BillingRecordCreatePayload {
  amount: number;
  currency?: string;
  quotaNumber: number;
  dueDate: string;
  paymentDate?: string;
  confirmationNumber?: string;
  comments?: string;
  financing: string; // documentId del financiamiento
  parentRecord?: string | null; // documentId del recibo padre (opcional)
  status?: PaymentStatus; // Status opcional (para indicar adelanto/abonado)
}

export interface BillingRecordUpdatePayload {
  amount?: number;
  status?: PaymentStatus;
  paymentDate?: string;
  confirmationNumber?: string;
  verifiedInBank?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  comments?: string;
  parentRecord?: string | null; // documentId del recibo padre o null para desasociar
}

// ============================================================================
// VALIDACIÓN DE ESTADOS (Máquina de estados)
// ============================================================================

/**
 * Transiciones de estado válidas para Billing Records.
 * Cada estado define a cuáles puede transicionar directamente.
 */
const VALID_STATE_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  pendiente: ["pagado", "retrasado", "abonado", "adelanto", "cubierta"],
  retrasado: ["pagado", "abonado", "adelanto", "cubierta"],
  abonado: ["pagado", "retrasado"],
  pagado: [],
  cubierta: ["pendiente", "retrasado", "pagado"],
  adelanto: ["pagado"],
};

/**
 * Determina si una transición de estado es válida.
 * @param from Estado origen
 * @param to Estado destino
 * @returns true si la transición está permitida
 */
export function canTransitionStatus(
  from: PaymentStatus,
  to: PaymentStatus
): boolean {
  if (from === to) return true;
  return VALID_STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Lanza error si una transición de estado no es válida.
 */
export function assertValidTransition(
  from: PaymentStatus,
  to: PaymentStatus,
  context?: string
): void {
  if (!canTransitionStatus(from, to)) {
    throw new Error(
      `Transición de estado inválida${context ? ` (${context})` : ""}: "${from}" → "${to}" no está permitida.`
    );
  }
}

// ============================================================================
// CÁLCULO DE BALANCE
// ============================================================================

/**
 * Calcula el balance pendiente de una cuota considerando todos los escenarios.
 *
 * Reglas:
 * - Cuota "cubierta": balance siempre 0 (pagada por adelanto)
 * - Cuota "pagado": balance siempre 0
 * - Otras: amount - suma de hijos positivos
 */
export function computeQuotaBalance(quota: BillingRecordRaw): number {
  if (quota.status === "cubierta" || quota.status === "pagado") {
    return 0;
  }

  const childPayments = quota.childRecords || [];
  const totalPaid = childPayments.reduce((sum, child) => {
    return sum + (child.amount > 0 ? child.amount : 0);
  }, 0);

  return Math.max(0, (quota.amount || 0) - totalPaid);
}

// ============================================================================
// FUNCIONES DE FORMATEO
// ============================================================================

const formatDate = (dateString?: string): string | undefined => {
  if (!dateString) return undefined;
  try {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return undefined;
  }
};

const getStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    pagado: "Pagado",
    pendiente: "Pendiente",
    adelanto: "Adelanto",
    retrasado: "Retrasado",
    abonado: "Abonado",
    cubierta: "Cubierta",
  };
  return labels[status] || status;
};

// ============================================================================
// NORMALIZACIÓN
// ============================================================================

const normalizeBillingRecord = (raw: BillingRecordRaw): BillingRecordCard => {
  const currency = raw.currency || "PAB";

  return {
    id: String(raw.id),
    documentId: raw.documentId,
    receiptNumber: raw.receiptNumber,
    amount: raw.amount,
    amountLabel: formatCurrency(raw.amount, { currency }),
    currency,
    status: raw.status,
    statusLabel: getStatusLabel(raw.status),
    quotaNumber: raw.quotaNumber,
    quotasCovered: raw.quotasCovered || 1,
    quotaAmountCovered: raw.quotaAmountCovered,
    advanceCredit: raw.advanceCredit || 0,
    remainingQuotaBalance: raw.remainingQuotaBalance || 0,
    lateFeeAmount: raw.lateFeeAmount || 0,
    lateFeeAmountLabel: formatCurrency(raw.lateFeeAmount || 0, { currency }),
    daysLate: raw.daysLate || 0,
    dueDate: raw.dueDate,
    dueDateLabel: formatDate(raw.dueDate) || "",
    paymentDate: raw.paymentDate,
    paymentDateLabel: formatDate(raw.paymentDate),
    confirmationNumber: raw.confirmationNumber,
    verifiedInBank: raw.verifiedInBank || false,
    verifiedBy: raw.verifiedBy?.displayName,
    verifiedAt: raw.verifiedAt,
    comments: raw.comments,
    // Financiamiento
    financingId: raw.financing ? String(raw.financing.id) : undefined,
    financingDocumentId: raw.financing?.documentId,
    financingNumber: raw.financing?.financingNumber,
    financingQuotaAmount: raw.financing?.quotaAmount,
    financingTotalQuotas: raw.financing?.totalQuotas,
    financingPaidQuotas: raw.financing?.paidQuotas,
    financingCurrentBalance: raw.financing?.currentBalance,
    // Vehículo
    vehicleName: raw.financing?.vehicle?.name,
    vehiclePlaca: raw.financing?.vehicle?.placa,
    // Cliente
    clientName: raw.financing?.client?.displayName,
    clientPhone: raw.financing?.client?.phone,
    clientEmail: raw.financing?.client?.email,
    clientAddress: raw.financing?.client?.address,
    clientIdentificationNumber: raw.financing?.client?.identificationNumber,
    clientBillingAddress: raw.financing?.client?.billingAddress,
    clientBillingTaxId: raw.financing?.client?.billingTaxId,
    // Documentos - Las URLs necesitan el prefijo de Strapi para ser accesibles
    documents: (raw.documents || []).map((doc) => ({
      id: String(doc.id),
      documentId: doc.documentId,
      name: doc.name,
      url: doc.file?.url ? `${STRAPI_BASE_URL}${doc.file.url}` : undefined,
      mime: doc.file?.mime,
    })),
    // Relaciones padre/hijo para anidación de recibos
    parentRecordId: raw.parentRecord?.documentId,
    parentRecordReceiptNumber: raw.parentRecord?.receiptNumber,
    childRecords: raw.childRecords?.map(child => normalizeBillingRecord(child)),
    // Relaciones para pago multi-cuota
    coveredById: raw.coveredBy?.documentId,
    coveredByReceiptNumber: raw.coveredBy?.receiptNumber,
    coveredQuotas: raw.coveredQuotas?.map(child => normalizeBillingRecord(child)),
    createdAt: raw.createdAt,
  };
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

const populateConfig = {
  populate: {
    financing: {
      fields: ["id", "documentId", "financingNumber", "quotaAmount", "totalQuotas", "paidQuotas", "currentBalance", "status"],
      populate: {
        vehicle: {
          fields: ["id", "documentId", "name", "placa"],
        },
        client: {
          fields: ["id", "documentId", "displayName", "phone", "email", "address", "identificationNumber", "billingAddress", "billingTaxId"],
        },
      },
    },
    verifiedBy: {
      fields: ["id", "documentId", "displayName"],
    },
    documents: {
      fields: ["id", "documentId", "name"],
      populate: {
        file: {
          fields: ["url", "mime"],
        },
      },
    },
    // Relaciones padre/hijo para anidación de recibos
    parentRecord: {
      fields: ["id", "documentId", "receiptNumber"],
    },
    childRecords: {
      fields: ["id", "documentId", "receiptNumber", "amount", "status", "quotaNumber", "paymentDate", "dueDate"],
      populate: {
        financing: {
          fields: ["documentId"],
        },
      },
    },
    // Relaciones para pago multi-cuota
    coveredBy: {
      fields: ["id", "documentId", "receiptNumber"],
    },
    coveredQuotas: {
      fields: ["id", "documentId", "receiptNumber", "amount", "status", "quotaNumber", "paymentDate", "dueDate"],
    },
  },
};

// Populate para cuando se consulta desde financing (sin incluir financing para evitar circular)
const populateConfigFromFinancing = {
  populate: {
    verifiedBy: {
      fields: ["id", "documentId", "displayName"],
    },
    documents: {
      fields: ["id", "documentId", "name"],
      populate: {
        file: {
          fields: ["url", "mime"],
        },
      },
    },
    parentRecord: {
      fields: ["id", "documentId", "receiptNumber"],
    },
    childRecords: {
      fields: ["id", "documentId", "receiptNumber", "amount", "status", "quotaNumber", "paymentDate", "dueDate"],
    },
    coveredBy: {
      fields: ["id", "documentId", "receiptNumber"],
    },
    coveredQuotas: {
      fields: ["id", "documentId", "receiptNumber", "amount", "status", "quotaNumber", "paymentDate", "dueDate"],
    },
  },
};

/**
 * Obtener todos los pagos
 */
export async function fetchBillingRecordsFromStrapi(): Promise<BillingRecordCard[]> {
  const query = qs.stringify({
    status: "published",
    ...populateConfig,
    sort: ["createdAt:desc"],
    pagination: { pageSize: 100 },
  }, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error fetching billing records: ${errorText}`);
  }

  const data = await response.json();
  return (data.data || []).map(normalizeBillingRecord);
}

/**
 * Obtener pagos por financiamiento
 * STRATEGIA HÍBRIDA: Intenta obtener via populate, si falla o está vacío, usa fallback
 */
export async function fetchBillingRecordsByFinancingFromStrapi(financingDocumentId: string): Promise<BillingRecordCard[]> {
  // Intentar método 1: Populate desde financing
  // NOTA: Usar populateConfigFromFinancing porque no podemos hacer populate de financing dentro de payments
  const financingQuery = qs.stringify({
    status: "published",
    populate: {
      payments: {
        ...populateConfigFromFinancing.populate,
        sort: ["dueDate:asc"],
      },
    },
  }, { encodeValuesOnly: true });

  console.log(`[Billing] Method 1: Fetching financing with records: ${financingDocumentId}`);
  
  const financingResponse = await fetch(
    `${STRAPI_BASE_URL}/api/financings/${financingDocumentId}?${financingQuery}`,
    {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      },
      cache: "no-store",
    }
  );

  if (financingResponse.ok) {
    const financingData = await financingResponse.json();
    const billingRecords = financingData.data?.payments || [];
    
    console.log(`[Billing] Method 1 result:`, {
      count: billingRecords.length,
      ids: billingRecords.map((r: BillingRecordRaw) => r.documentId),
      withChildren: billingRecords.map((r: BillingRecordRaw) => ({
        id: r.documentId,
        childCount: r.childRecords?.length || 0
      }))
    });
    
    // SIEMPRE usar fallback para asegurar que childRecords se populen correctamente
    // El método 1 (populate desde financing) no trae childRecords correctamente
    console.log(`[Billing] Method 1 encontró ${billingRecords.length} registros, pero usando fallback para mejor populate`);
  }
  
  // SIEMPRE usar método 2: Filtro directo con populate completo
  return fetchBillingRecordsByFinancingFromStrapiFallback(financingDocumentId);
}

/**
 * Fallback: Obtener pagos por financiamiento usando filtro directo
 * Prueba múltiples formatos de filtro para Strapi 5
 */
async function fetchBillingRecordsByFinancingFromStrapiFallback(financingDocumentId: string): Promise<BillingRecordCard[]> {
  console.log(`[Billing] Method 2 (Fallback): Fetching for financing ${financingDocumentId}`);
  
  // Populate simple pero efectivo
  const simplePopulate = {
    populate: {
      parentRecord: { fields: ["id", "documentId", "receiptNumber", "amount", "status"] },
      childRecords: { fields: ["id", "documentId", "receiptNumber", "amount", "status", "quotaNumber", "paymentDate", "dueDate", "currency"] },
      verifiedBy: { fields: ["id", "documentId", "displayName"] },
      documents: { fields: ["id", "documentId", "name"], populate: { file: { fields: ["url", "mime"] } } },
      financing: {
        fields: ["id", "documentId", "financingNumber", "quotaAmount", "totalQuotas", "paidQuotas", "currentBalance", "status"],
        populate: {
          vehicle: { fields: ["id", "documentId", "name", "placa"] },
          client: { fields: ["id", "documentId", "displayName", "phone", "email", "address", "identificationNumber", "billingAddress", "billingTaxId"] },
        },
      },
    }
  };
  
  // Formato 1: Filtro por documentId anidado (formato Strapi 5)
  const query1 = qs.stringify({
    status: "published",
    filters: {
      financing: {
        documentId: {
          $eq: financingDocumentId,
        },
      },
    },
    ...simplePopulate,
    sort: ["dueDate:asc"],
    pagination: { pageSize: 100 },
  }, { encodeValuesOnly: true });

  console.log(`[Billing] Trying format 1 (documentId filter)`);
  
  const response1 = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query1}`, {
    headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
    cache: "no-store",
  });

  if (response1.ok) {
    const data1 = await response1.json();
    console.log(`[Billing] Format 1 result:`, { count: data1.data?.length || 0 });
    
    if (data1.data?.length > 0) {
      return data1.data.map(normalizeBillingRecord);
    }
  } else {
    const errorText = await response1.text();
    console.error(`[Billing] Format 1 error:`, response1.status, errorText.substring(0, 200));
  }

  // Formato 2: Filtro por ID directo (usando el id numérico si existe)
  console.log(`[Billing] Trying format 2 (id filter)`);
  
  // Primero obtener el financing para conseguir su ID numérico
  const financingResp = await fetch(
    `${STRAPI_BASE_URL}/api/financings/${financingDocumentId}?fields[0]=id`,
    { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
  );
  
  if (financingResp.ok) {
    const financingData = await financingResp.json();
    const numericId = financingData.data?.id;
    
    if (numericId) {
      const query2 = qs.stringify({
        status: "published",
        filters: {
          financing: {
            id: {
              $eq: numericId,
            },
          },
        },
        ...simplePopulate,
        sort: ["dueDate:asc"],
        pagination: { pageSize: 100 },
      }, { encodeValuesOnly: true });

      const response2 = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query2}`, {
        headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
        cache: "no-store",
      });

      if (response2.ok) {
        const data2 = await response2.json();
        console.log(`[Billing] Format 2 result:`, { count: data2.data?.length || 0 });
        
        if (data2.data?.length > 0) {
          return data2.data.map(normalizeBillingRecord);
        }
      } else {
        const errorText = await response2.text();
        console.error(`[Billing] Format 2 error:`, response2.status, errorText.substring(0, 200));
      }
    }
  }

  // Si todo falla, devolver array vacío
  console.error(`[Billing] All methods failed for financing ${financingDocumentId}`);
  return [];
}

/**
 * Obtener un pago por ID
 */
export async function fetchBillingRecordByIdFromStrapi(documentId: string): Promise<BillingRecordCard | null> {
  // Strapi v5 GET by documentId defaults to published only.
  // Records created via Content API are drafts. Use list query to find reliably.
  const query = qs.stringify({
    filters: {
      documentId: { $eq: documentId },
    },
    populate: populateConfig.populate,
    pagination: { pageSize: 1 },
  }, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error fetching billing record: ${errorText}`);
  }

  const data = await response.json();
  const record = data.data?.[0];
  return record ? normalizeBillingRecord(record) : null;
}

/**
 * Generar número de recibo único
 */
async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  // Buscar el último recibo del mes
  const query = qs.stringify({
    status: "published",
    filters: {
      receiptNumber: {
        $startsWith: `REC-${year}${month}-`,
      },
    },
    sort: ["createdAt:desc"],
    pagination: { limit: 1 },
  }, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  let nextNumber = 1;
  if (response.ok) {
    const data = await response.json();
    if (data.data && data.data.length > 0) {
      const lastReceipt = data.data[0].receiptNumber;
      const parts = lastReceipt.split("-");
      if (parts.length === 3) {
        nextNumber = parseInt(parts[2], 10) + 1;
      }
    }
  }

  return `REC-${year}${month}-${String(nextNumber).padStart(5, "0")}`;
}

/**
 * Crear un nuevo pago
 */
export async function createBillingRecordInStrapi(
  payload: BillingRecordCreatePayload,
  financing: FinancingCard
): Promise<BillingRecordCard> {
  // Calcular días de atraso y multa si aplica
  const daysLate = calculateDaysLate(payload.dueDate, payload.paymentDate);
  const lateFeeAmount = daysLate > 0 
    ? calculateLateFee(financing.quotaAmount, daysLate, financing.lateFeePercentage)
    : 0;

  // Calcular cuotas cubiertas y crédito usando el crédito parcial acumulado
  const { quotasCovered, advanceCredit, totalApplied, isPartialPayment } = processPayment(
    payload.amount,
    financing.quotaAmount,
    financing.partialPaymentCredit
  );
  
  // Calcular el saldo pendiente de la cuota actual (diferente de advanceCredit)
  // remainingQuotaBalance: lo que falta por pagar de la cuota actual
  // advanceCredit: crédito disponible para cuotas futuras
  const remainingQuotaBalance = isPartialPayment 
    ? Math.max(0, financing.quotaAmount - totalApplied) // Para pagos parciales: cuota - lo aplicado
    : (quotasCovered > 0 && advanceCredit > 0 ? 0 : Math.max(0, financing.quotaAmount - totalApplied));

  // Determinar estado del pago según reglas de negocio:
  // - Adelanto: cubre al menos 1 cuota completa Y tiene excedente para futuro
  // - Abonado: pago aplicado a cuotas generadas con saldo pendiente (pago parcial)
  // - Retrasado: pago con días de atraso
  // - Pagado: pago completo de cuota(s) sin atraso
  let status: PaymentStatus;
  
  if (payload.status === "adelanto" && !payload.parentRecord) {
    // FIX: Respetar adelanto explícito cuando no hay cuota a la cual abonar.
    // Un pago sin cuota pendiente es crédito libre (adelanto), nunca abonado.
    status = "adelanto";
  } else if (isPartialPayment) {
    // Pago parcial con cuota existente: es abonado
    status = "abonado";
  } else if (daysLate > 0) {
    status = "retrasado";
  } else if (quotasCovered >= 1 && advanceCredit > 0) {
    // Cubrió al menos 1 cuota completa Y tiene crédito extra = es adelanto
    status = "adelanto";
  } else {
    status = "pagado";
  }

  // Generar número de recibo
  const receiptNumber = await generateReceiptNumber();

  // Para pagos parciales, quotasCovered se envía como 1 (mínimo requerido por Strapi)
  // pero solo actualizamos paidQuotas en el financiamiento cuando realmente se completan cuotas
  const quotasCoveredForStrapi = Math.max(1, quotasCovered);

  const data: Record<string, unknown> = {
    receiptNumber,
    amount: payload.amount,
    currency: payload.currency || "PAB",
    status,
    quotaNumber: payload.quotaNumber,
    quotasCovered: quotasCoveredForStrapi,
    quotaAmountCovered: isPartialPayment 
      ? payload.amount // Para pagos parciales, el monto cubierto es el pago mismo
      : Math.min(payload.amount, financing.quotaAmount * quotasCovered),
    advanceCredit,
    remainingQuotaBalance,
    lateFeeAmount,
    daysLate,
    dueDate: payload.dueDate,
    paymentDate: payload.paymentDate || new Date().toISOString().split("T")[0],
    confirmationNumber: payload.confirmationNumber,
    comments: payload.comments,
    // Strapi v5 requiere ID numérico para crear relaciones, NO documentId
    financing: financing.numericId,
  };
  
  // Agregar parentRecord si se proporciona
  // Strapi v5 requiere ID numérico para relaciones; payload.parentRecord es documentId,
  // así que debemos obtener el id numérico del billing record padre
  if (payload.parentRecord) {
    try {
      const parentQuery = qs.stringify({
        status: "published",
        filters: { documentId: { $eq: payload.parentRecord } },
        fields: ["id"],
        pagination: { pageSize: 1 },
      }, { encodeValuesOnly: true });
      
      const parentResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records?${parentQuery}`,
        {
          headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
          cache: "no-store",
        }
      );
      
      if (parentResponse.ok) {
        const parentData = await parentResponse.json();
        const parentNumericId = parentData.data?.[0]?.id;
        if (parentNumericId) {
          data.parentRecord = parentNumericId;
        } else {
          console.warn(`[createBillingRecordInStrapi] No se encontró ID numérico para parentRecord documentId=${payload.parentRecord}`);
        }
      }
    } catch (err) {
      console.error(`[createBillingRecordInStrapi] Error obteniendo parentRecord numérico:`, err);
    }
  }

  const query = qs.stringify(populateConfig, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creating billing record: ${errorText}`);
  }

  const result = await response.json();
  const createdRecord = normalizeBillingRecord(result.data);

  // =========================================================================
  // ACTUALIZAR EL FINANCIAMIENTO PADRE
  // =========================================================================
  
  // Solo incrementar paidQuotas cuando realmente se completan cuotas (no para pagos parciales)
  const newPaidQuotas = financing.paidQuotas + quotasCovered; // quotasCovered es 0 para parciales
  const newTotalPaid = financing.totalPaid + payload.amount;
  const newCurrentBalance = Math.max(0, financing.currentBalance - payload.amount);
  const newPartialPaymentCredit = advanceCredit; // El crédito acumulado para la próxima cuota
  const newTotalLateFees = financing.totalLateFees + lateFeeAmount;
  
  // Calcular próxima fecha de vencimiento
  const newNextDueDate = calculateNextDueDate(
    financing.nextDueDate || financing.startDate,
    financing.paymentFrequency,
    quotasCovered
  );
  
  // Determinar nuevo estado del financiamiento
  let newFinancingStatus: FinancingStatus = financing.status as FinancingStatus;
  if (newPaidQuotas >= financing.totalQuotas) {
    newFinancingStatus = "completado";
  } else if (daysLate > 0) {
    newFinancingStatus = "en_mora";
  } else if (financing.status === "en_mora" && daysLate === 0) {
    // Si estaba en mora y ahora pagó a tiempo, vuelve a activo
    newFinancingStatus = "activo";
  }
  
  try {
    // Actualizar el financiamiento
    await updateFinancingInStrapi(financing.documentId, {
      paidQuotas: newPaidQuotas,
      totalPaid: newTotalPaid,
      currentBalance: newCurrentBalance,
      partialPaymentCredit: newPartialPaymentCredit,
      totalLateFees: newTotalLateFees,
      nextDueDate: newNextDueDate,
      status: newFinancingStatus,
    });
  } catch (updateError) {
    console.error("Error updating financing after payment:", updateError);
    // No lanzamos el error para no bloquear la creación del pago
  }

  return createdRecord;
}

/**
 * Actualizar un pago
 */
export async function updateBillingRecordInStrapi(
  documentId: string,
  payload: BillingRecordUpdatePayload
): Promise<BillingRecordCard> {
  const query = qs.stringify(populateConfig, { encodeValuesOnly: true });

  // Transformar payload al formato Strapi 5
  const transformedPayload: Record<string, unknown> = { ...payload };

  // ── VALIDACIÓN DE TRANSICIÓN DE ESTADO ──
  if (payload.status) {
    const currentQuery = qs.stringify({
      filters: { documentId: { $eq: documentId } },
      fields: ["status"],
      pagination: { pageSize: 1 },
    }, { encodeValuesOnly: true });
    const currentResp = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?${currentQuery}`,
      { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
    );

    if (currentResp.ok) {
      const currentData = await currentResp.json();
      const currentStatus = currentData.data?.[0]?.status as PaymentStatus;
      if (currentStatus && !canTransitionStatus(currentStatus, payload.status)) {
        throw new Error(
          `Transición de estado inválida: "${currentStatus}" → "${payload.status}" no está permitida.`
        );
      }
    }
  }

  // Convertir parentRecord al formato correcto de Strapi 5
  if (payload.parentRecord !== undefined) {
    if (payload.parentRecord === null) {
      // Desasociar: usar disconnect
      transformedPayload.parentRecord = { disconnect: [] };
    } else {
      // Asociar: necesitamos obtener el ID numérico primero
      const parentQuery = qs.stringify({
        filters: { documentId: { $eq: payload.parentRecord } },
        fields: ["id"],
        pagination: { pageSize: 1 },
      }, { encodeValuesOnly: true });
      const parentResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records?${parentQuery}`,
        { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
      );

      if (parentResponse.ok) {
        const parentData = await parentResponse.json();
        const parentNumericId = parentData.data?.[0]?.id;

        if (parentNumericId) {
          transformedPayload.parentRecord = { set: [{ id: parentNumericId }] };
        } else {
          delete transformedPayload.parentRecord;
        }
      } else {
        delete transformedPayload.parentRecord;
      }
    }
  }

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${documentId}?${query}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: transformedPayload }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error updating billing record: ${errorText}`);
  }

  const result = await response.json();
  return normalizeBillingRecord(result.data);
}

/**
 * Eliminar un pago
 */
export async function deleteBillingRecordFromStrapi(documentId: string): Promise<void> {
  console.log(`[deleteBillingRecordFromStrapi] Iniciando eliminación de: ${documentId}`);
  
  // 1. Primero obtener el registro para saber si tiene hijos
  console.log(`[deleteBillingRecordFromStrapi] Paso 1: Obteniendo registro...`);
  const record = await fetchBillingRecordByIdFromStrapi(documentId);
  
  if (!record) {
    console.error(`[deleteBillingRecordFromStrapi] Registro no encontrado: ${documentId}`);
    throw new Error("Billing record not found: 404");
  }
  
  console.log(`[deleteBillingRecordFromStrapi] Registro encontrado:`, {
    id: record.id,
    documentId: record.documentId,
    financingDocumentId: record.financingDocumentId,
    amount: record.amount,
    status: record.status,
    childCount: record.childRecords?.length || 0,
  });

  // 2. Si tiene hijos, eliminarlos primero (eliminación en cascada)
  if (record.childRecords && record.childRecords.length > 0) {
    console.log(`[deleteBillingRecordFromStrapi] Paso 2: Eliminando ${record.childRecords.length} hijo(s)...`);
    for (const child of record.childRecords) {
      try {
        console.log(`[deleteBillingRecordFromStrapi] Eliminando hijo: ${child.documentId}`);
        await deleteBillingRecordFromStrapi(child.documentId);
        console.log(`[deleteBillingRecordFromStrapi] ✓ Hijo ${child.documentId} eliminado`);
      } catch (error) {
        console.error(`[deleteBillingRecordFromStrapi] Error eliminando hijo ${child.documentId}:`, error);
        // Continuar con los demás hijos aunque uno falle
      }
    }
  }

  // 3. Eliminar el registro padre
  console.log(`[deleteBillingRecordFromStrapi] Paso 2: Eliminando registro en Strapi...`);
  const deleteUrl = `${STRAPI_BASE_URL}/api/billing-records/${documentId}`;
  console.log(`[deleteBillingRecordFromStrapi] URL: ${deleteUrl}`);
  
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  console.log(`[deleteBillingRecordFromStrapi] Respuesta DELETE:`, {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[deleteBillingRecordFromStrapi] Error en DELETE:`, errorText);
    throw new Error(`Error deleting billing record: ${errorText}`);
  }
  
  console.log(`[deleteBillingRecordFromStrapi] ✓ Registro padre ${documentId} eliminado exitosamente`);

  // 4. Si tiene financiamiento asociado, actualizar el financiamiento padre
  if (record.financingDocumentId) {
    console.log(`[deleteBillingRecordFromStrapi] Paso 3: Actualizando financing ${record.financingDocumentId}...`);
    try {
      // Obtener el financiamiento actual
      const financingUrl = `${STRAPI_BASE_URL}/api/financings/${record.financingDocumentId}?populate=*`;
      console.log(`[deleteBillingRecordFromStrapi] Fetching financing: ${financingUrl}`);
      
      const financingResponse = await fetch(financingUrl, {
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        },
        cache: "no-store",
      });
      
      console.log(`[deleteBillingRecordFromStrapi] Respuesta financing:`, {
        status: financingResponse.status,
        ok: financingResponse.ok,
      });

      if (financingResponse.ok) {
        const financingData = await financingResponse.json();
        const financing = financingData.data;
        
        console.log(`[deleteBillingRecordFromStrapi] Financing obtenido:`, {
          id: financing?.id,
          documentId: financing?.documentId,
          paidQuotas: financing?.paidQuotas,
          totalPaid: financing?.totalPaid,
          status: financing?.status,
        });

        if (financing) {
          // 3.1 Obtener TODOS los billing-records restantes para este financing
          console.log(`[deleteBillingRecordFromStrapi] Paso 4.1: Obteniendo billing-records restantes...`);
          const remainingRecordsUrl = `${STRAPI_BASE_URL}/api/billing-records?filters[financing][documentId][$eq]=${record.financingDocumentId}&pagination[limit]=100`;
          
          const remainingResponse = await fetch(remainingRecordsUrl, {
            headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
            cache: "no-store",
          });
          
          let remainingRecords: any[] = [];
          if (remainingResponse.ok) {
            const remainingData = await remainingResponse.json();
            remainingRecords = remainingData.data || [];
          }
          
          console.log(`[deleteBillingRecordFromStrapi] Registros restantes: ${remainingRecords.length}`);

          // 3.2 Recalcular valores desde los registros restantes
          console.log(`[deleteBillingRecordFromStrapi] Paso 4.2: Recalculando valores...`);
          
          let newPaidQuotas = 0;
          let newTotalPaid = 0;
          let newTotalLateFees = 0;
          let newPartialPaymentCredit = 0;
          let maxCoveredQuota = 0;

          for (const billingRecord of remainingRecords) {
            const recordData = billingRecord.attributes || billingRecord;
            const status = recordData.status;
            const amount = recordData.amount || 0;
            const quotaNumber = recordData.quotaNumber || 0;
            const quotasCovered = recordData.quotasCovered || 1;
            const lateFeeAmount = recordData.lateFeeAmount || 0;
            
            // Sumar multas de todas las cuotas retrasadas
            if (status === "retrasado") {
              newTotalLateFees += lateFeeAmount;
            }
            
            // Para pagos que cubren cuotas (pagado, abonado, adelanto)
            if (status === "pagado" || status === "abonado" || status === "adelanto") {
              // Acumular monto pagado
              newTotalPaid += amount;
              
              // Calcular cuotas cubiertas
              const endQuota = quotaNumber + quotasCovered - 1;
              maxCoveredQuota = Math.max(maxCoveredQuota, endQuota);
              
              // Calcular crédito disponible desde abonos/adelantos
              if (status === "abonado" || status === "adelanto") {
                // El crédito es el excedente del abono sobre el monto de las cuotas cubiertas
                const quotaAmount = financing.quotaAmount || 0;
                const totalQuotasAmount = quotasCovered * quotaAmount;
                const creditFromThisRecord = Math.max(0, amount - totalQuotasAmount);
                newPartialPaymentCredit += creditFromThisRecord;
                
                console.log(`[deleteBillingRecordFromStrapi] Crédito de ${status}: +${creditFromThisRecord} (monto:${amount} - cuotas:${totalQuotasAmount})`);
              }
            }
          }
          
          // Las paidQuotas son el máximo de cuotas cubiertas
          newPaidQuotas = maxCoveredQuota;
          
          // Calcular balance actual
          const newCurrentBalance = (financing.totalAmount || 0) - newTotalPaid;
          
          // Determinar nuevo estado
          let newStatus = financing.status;
          if (newPaidQuotas >= financing.totalQuotas) {
            newStatus = "completado";
          } else if (newPaidQuotas > 0 || remainingRecords.length > 0) {
            newStatus = "activo";
          } else {
            newStatus = "activo"; // Mantener activo si hay cuotas pendientes
          }
          
          console.log(`[deleteBillingRecordFromStrapi] Valores recalculados:`, {
            newPaidQuotas,
            newTotalPaid,
            newCurrentBalance,
            newTotalLateFees,
            newPartialPaymentCredit,
            newStatus,
            remainingRecords: remainingRecords.length,
          });

          // 3.3 Actualizar el financiamiento con valores recalculados
          console.log(`[deleteBillingRecordFromStrapi] Paso 4.3: Actualizando financing...`);
          await updateFinancingInStrapi(record.financingDocumentId, {
            paidQuotas: newPaidQuotas,
            totalPaid: newTotalPaid,
            currentBalance: newCurrentBalance,
            totalLateFees: newTotalLateFees,
            partialPaymentCredit: newPartialPaymentCredit,
            status: newStatus,
          });
          
          console.log(`[deleteBillingRecordFromStrapi] Financing actualizado exitosamente`);

          // 4. Reorganizar los números de cuota de los pagos restantes
          // NOTA: Temporalmente desactivado para debug - puede estar causando problemas
          // await reorganizeQuotaNumbers(record.financingDocumentId);
        }
      } else {
        const errorText = await financingResponse.text();
        console.error(`[deleteBillingRecordFromStrapi] Error obteniendo financing:`, errorText);
      }
    } catch (updateError) {
      console.error("[deleteBillingRecordFromStrapi] Error updating financing after payment deletion:", updateError);
      // No lanzamos el error para no bloquear la eliminación del pago
    }
  } else {
    console.log(`[deleteBillingRecordFromStrapi] No hay financing asociado`);
  }
  
  console.log(`[deleteBillingRecordFromStrapi] Eliminación completada`);
}

/**
 * Reorganizar los números de cuota después de eliminar un pago
 */
async function reorganizeQuotaNumbers(financingDocumentId: string): Promise<void> {
  // Obtener todos los pagos del financiamiento ordenados por fecha de pago
  // Usar formato de filtro compatible con Strapi 5
  const query = qs.stringify({
    status: "published",
    filters: {
      financing: {
        id: {
          $eq: financingDocumentId,
        },
      },
    },
    sort: ["paymentDate:asc", "createdAt:asc"],
    fields: ["documentId", "quotaNumber"],
    pagination: {
      pageSize: 100,
    },
  }, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    console.error("Error fetching billing records for reorganization");
    return;
  }

  const data = await response.json();
  const records = data.data || [];

  // Actualizar cada pago con su nuevo número de cuota secuencial
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const newQuotaNumber = i + 1;

    // Solo actualizar si el número cambió
    if (record.quotaNumber !== newQuotaNumber) {
      await fetch(`${STRAPI_BASE_URL}/api/billing-records/${record.documentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ data: { quotaNumber: newQuotaNumber } }),
        cache: "no-store",
      });
    }
  }
}

/**
 * Marcar pago como verificado
 */
export async function verifyBillingRecordInStrapi(
  documentId: string,
  verifiedByDocumentId?: string
): Promise<BillingRecordCard> {
  // Solo incluir verifiedBy si es un documentId válido (no placeholder)
  const isValidDocumentId = verifiedByDocumentId && 
    verifiedByDocumentId !== "admin" && 
    verifiedByDocumentId.length > 10;
  
  return updateBillingRecordInStrapi(documentId, {
    verifiedInBank: true,
    ...(isValidDocumentId && { verifiedBy: verifiedByDocumentId }),
    verifiedAt: new Date().toISOString(),
  });
}

// ============================================================================
// FUNCIONES DE DOCUMENTOS DE BILLING
// ============================================================================

export interface BillingDocument {
  id: string;
  documentId: string;
  name: string;
  url?: string;
  createdAt: string;
}

export interface BillingDocumentCreatePayload {
  name: string;
  file: number; // ID del archivo en Strapi
  record: string | number; // documentId del billing record
}

/**
 * Obtener documentos de un billing record
 */
export async function fetchBillingDocumentsByRecordId(
  billingRecordDocumentId: string
): Promise<BillingDocument[]> {
  const query = qs.stringify({
    filters: {
      record: {
        documentId: {
          $eq: billingRecordDocumentId,
        },
      },
    },
    populate: ["file"],
  }, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-documents?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error fetching billing documents: ${errorText}`);
  }

  const data = await response.json();
  return (data.data || []).map((doc: any) => ({
    id: String(doc.id),
    documentId: doc.documentId,
    name: doc.name,
    url: doc.file?.url ? `${STRAPI_BASE_URL}${doc.file.url}` : undefined,
    createdAt: doc.createdAt,
  }));
}

/**
 * Crear un documento de billing
 */
export async function createBillingDocumentInStrapi(
  payload: BillingDocumentCreatePayload
): Promise<BillingDocument> {
  // Crear el documento
  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-documents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        name: payload.name,
        file: payload.file,
        record: payload.record,
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error creating billing document: ${errorText}`);
  }

  const result = await response.json();
  const createdDoc = result.data;
  
  // Re-obtener el documento con el archivo populado para tener la URL correcta
  const query = qs.stringify({
    populate: ["file"],
  }, { encodeValuesOnly: true });
  
  const fetchResponse = await fetch(
    `${STRAPI_BASE_URL}/api/billing-documents/${createdDoc.documentId}?${query}`,
    {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );
  
  if (fetchResponse.ok) {
    const fetchResult = await fetchResponse.json();
    const doc = fetchResult.data;
    return {
      id: String(doc.id),
      documentId: doc.documentId,
      name: doc.name,
      url: doc.file?.url ? `${STRAPI_BASE_URL}${doc.file.url}` : undefined,
      createdAt: doc.createdAt,
    };
  }
  
  // Fallback: devolver sin URL si no se pudo re-obtener
  return {
    id: String(createdDoc.id),
    documentId: createdDoc.documentId,
    name: createdDoc.name,
    url: undefined,
    createdAt: createdDoc.createdAt,
  };
}

/**
 * Eliminar un documento de billing
 */
export async function deleteBillingDocumentFromStrapi(
  documentId: string
): Promise<void> {
  const response = await fetch(`${STRAPI_BASE_URL}/api/billing-documents/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error deleting billing document: ${errorText}`);
  }
}

/**
 * Recalcula las métricas de un financiamiento a partir de TODOS sus billing records.
 * Útil después de eliminaciones, auto-cover, o modificaciones masivas.
 *
 * Métricas recalculadas:
 * - paidQuotas: cuotas con status 'pagado' o 'cubierta'
 * - totalPaid: suma de amounts de todos los registros saldados
 * - currentBalance: totalAmount - totalPaid
 * - totalLateFees: suma de lateFeeAmount de retrasados
 * - partialPaymentCredit: saldo disponible en adelantos
 * - status: 'completado' si paidQuotas >= totalQuotas
 *
 * @param financingDocumentId - documentId del financiamiento
 * @returns FinancingCard actualizado
 */
export async function recalculateFinancingMetrics(
  financingDocumentId: string
): Promise<FinancingCard> {
  console.log(`[recalculateFinancingMetrics] Recalculando métricas para financing ${financingDocumentId}`);

  // 1. Obtener financiamiento actual
  const financingResp = await fetch(
    `${STRAPI_BASE_URL}/api/financings/${financingDocumentId}?fields[0]=id&fields[1]=documentId&fields[2]=totalAmount&fields[3]=totalQuotas&fields[4]=quotaAmount`,
    { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
  );

  if (!financingResp.ok) {
    throw new Error(`Financing not found: ${financingDocumentId}`);
  }

  const financingData = await financingResp.json();
  const financing = financingData.data;
  if (!financing) throw new Error("Financing not found");

  const totalAmount = financing.totalAmount || 0;
  const totalQuotas = financing.totalQuotas || 0;

  // 2. Obtener TODOS los billing records del financiamiento
  const recordsQuery = qs.stringify({
    status: "published",
    filters: {
      financing: { documentId: { $eq: financingDocumentId } },
    },
    fields: [
      "documentId", "amount", "status", "quotaNumber", "quotasCovered",
      "advanceCredit", "lateFeeAmount", "paymentDate",
    ],
    populate: {
      childRecords: { fields: ["amount", "status"] },
    },
    pagination: { pageSize: 500 },
  }, { encodeValuesOnly: true });

  const recordsResp = await fetch(
    `${STRAPI_BASE_URL}/api/billing-records?${recordsQuery}`,
    { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
  );

  const recordsData = await recordsResp.json();
  const records = recordsData.data || [];

  // 3. Recalcular métricas
  let paidQuotas = 0;
  let totalPaid = 0;
  let totalLateFees = 0;
  let partialPaymentCredit = 0;

  for (const record of records) {
    const amount = record.amount || 0;
    const status = record.status as PaymentStatus;
    const quotasCovered = record.quotasCovered || 1;

    switch (status) {
      case "pagado":
        paidQuotas += quotasCovered;
        totalPaid += amount;
        break;
      case "cubierta":
        // Cuota cubierta por adelanto: cuenta como 1 cuota pagada
        paidQuotas += 1;
        totalPaid += amount;
        break;
      case "adelanto":
        totalPaid += amount;
        // Crédito disponible = amount - sum(hijos.amount)
        const children = record.childRecords || [];
        const used = children.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
        partialPaymentCredit += Math.max(0, amount - used);
        break;
      case "retrasado":
        totalLateFees += record.lateFeeAmount || 0;
        break;
      case "abonado":
        // Los abonos ya están contados como parte de la cuota padre
        // No sumamos a paidQuotas hasta que la cuota se marque pagada
        break;
      case "pendiente":
        // No se suma nada
        break;
    }
  }

  const currentBalance = Math.max(0, totalAmount - totalPaid);
  let newStatus: FinancingStatus = financing.status;
  if (paidQuotas >= totalQuotas) {
    newStatus = "completado";
  } else if (totalPaid > 0) {
    newStatus = "activo";
  }

  console.log(`[recalculateFinancingMetrics] Resultados:`, {
    paidQuotas, totalPaid, currentBalance, totalLateFees, partialPaymentCredit, status: newStatus,
  });

  // 4. Actualizar financing en Strapi
  const updateResp = await fetch(`${STRAPI_BASE_URL}/api/financings/${financingDocumentId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        paidQuotas,
        totalPaid,
        currentBalance,
        totalLateFees,
        partialPaymentCredit,
        status: newStatus,
      },
    }),
    cache: "no-store",
  });

  if (!updateResp.ok) {
    const errText = await updateResp.text();
    throw new Error(`Error updating financing metrics: ${errText}`);
  }

  const updatedData = await updateResp.json();

  // 5. Re-obtener financing completo para devolver FinancingCard
  const fullFinancingQuery = qs.stringify({
    populate: {
      vehicle: { fields: ["id", "documentId", "name", "placa", "brand", "model", "year"] },
      client: { fields: ["id", "documentId", "displayName", "email", "phone", "identificationNumber"] },
      payments: {
        fields: ["id", "documentId", "receiptNumber", "amount", "currency", "status", "quotaNumber", "quotasCovered", "quotaAmountCovered", "advanceCredit", "lateFeeAmount", "daysLate", "dueDate", "paymentDate", "confirmationNumber", "verifiedInBank", "comments", "createdAt"],
        sort: ["quotaNumber:asc"],
      },
    },
  }, { encodeValuesOnly: true });

  const fullResp = await fetch(
    `${STRAPI_BASE_URL}/api/financings/${financingDocumentId}?${fullFinancingQuery}`,
    { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
  );

  if (!fullResp.ok) {
    throw new Error("Failed to fetch updated financing");
  }

  const fullData = await fullResp.json();
  return normalizeFinancing(fullData.data);
}

// ============================================================================
// UTILIDAD: Resolver ID numérico de Strapi v5
// ============================================================================

/**
 * Obtiene el ID numérico interno de Strapi v5 para un billing record.
 * Strapi v5 requiere ID numérico para crear/actualizar relaciones.
 * @param documentId - documentId del registro
 * @returns ID numérico o null
 */
export async function getStrapiNumericId(documentId: string): Promise<number | null> {
  try {
    const query = qs.stringify({
      filters: { documentId: { $eq: documentId } },
      fields: ["id"],
      pagination: { pageSize: 1 },
    }, { encodeValuesOnly: true });
    const resp = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?${query}`,
      { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
    );
    if (resp.ok) {
      const d = await resp.json();
      return d.data?.[0]?.id ?? null;
    }
  } catch (e) {
    console.error(`[getStrapiNumericId] Error para ${documentId}:`, e);
  }
  return null;
}

// Re-exportar tipos y funciones de financing para compatibilidad
export { calculateLateFee, calculateDaysLate, processPayment };
export type { PaymentStatus };


/**
 * Buscar el padre más cercano para un nuevo pago
 * 
 * Regla:
 * - Mismo financiamiento
 * - Pagos que son raíz (sin parentRecord)
 * - Ordenados por fecha (paymentDate o dueDate) descendente
 * - "Más cercano" = padre con fecha <= fecha del nuevo pago, más reciente de ellos
 * - Si ninguno cumple, usar el más reciente de todos
 * 
 * @param financingDocumentId - ID del financiamiento
 * @param paymentDate - Fecha del nuevo pago (ISO string)
 * @returns documentId del padre más cercano o null si no hay candidatos
 */
export async function findClosestParentRecord(
  financingDocumentId: string,
  paymentDate: string
): Promise<string | null> {
  try {
    // Query para obtener pagos raíz PENDIENTES del financiamiento (sin parentRecord)
    // que necesiten cobertura (tienen balance pendiente)
    const query = qs.stringify({
      filters: {
        financing: {
          documentId: {
            $eq: financingDocumentId,
          },
        },
        parentRecord: {
          $null: true,
        },
        status: {
          $in: ["pendiente", "retrasado", "abonado"],
        },
      },
      sort: ["dueDate:asc"], // Priorizar cuotas más antiguas (vencidas primero)
      populate: {
        childRecords: {
          fields: ["amount", "status"],
        },
      },
      fields: ["documentId", "paymentDate", "dueDate", "status", "amount", "lateFeeAmount", "daysLate"],
      pagination: {
        pageSize: 100,
      },
    }, { encodeValuesOnly: true });

    const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error("[findClosestParentRecord] Error fetching parent candidates:", await response.text());
      return null;
    }

    const data = await response.json();
    
    // Calcular balance real usando computeQuotaBalance centralizado
    const candidates: Array<{
      documentId: string;
      paymentDate?: string;
      dueDate?: string;
      status: PaymentStatus;
      amount: number;
      balanceReal: number;
    }> = (data.data || []).map((raw: any) => {
      const balanceReal = computeQuotaBalance(raw as BillingRecordRaw);
      return {
        documentId: raw.documentId,
        paymentDate: raw.paymentDate,
        dueDate: raw.dueDate,
        status: raw.status as PaymentStatus,
        amount: raw.amount || 0,
        balanceReal,
      };
    });

    // Filtrar solo candidatos que necesiten cobertura (balanceReal > 0)
    const candidatesNeedingCoverage = candidates.filter(c => c.balanceReal > 0);

    if (candidatesNeedingCoverage.length === 0) {
      console.log("[findClosestParentRecord] No pending candidates needing coverage found");
      return null;
    }

    // Ordenar TODOS los candidatos por antigüedad (dueDate asc).
    // Desempate por status: retrasado > abonado > pendiente.
    const statusPriority: Record<string, number> = { retrasado: 0, abonado: 1, pendiente: 2 };
    candidatesNeedingCoverage.sort((a, b) => {
      const dateA = new Date(a.dueDate || a.paymentDate || 0).getTime();
      const dateB = new Date(b.dueDate || b.paymentDate || 0).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return (statusPriority[a.status] ?? 99) - (statusPriority[b.status] ?? 99);
    });

    console.log("[findClosestParentRecord] Candidates sorted:", candidatesNeedingCoverage.map(c => ({
      documentId: c.documentId, status: c.status, dueDate: c.dueDate, balanceReal: c.balanceReal,
    })));

    const selected = candidatesNeedingCoverage[0];
    if (selected) {
      console.log("[findClosestParentRecord] Selected quota:", {
        documentId: selected.documentId,
        status: selected.status,
        dueDate: selected.dueDate,
        balanceReal: selected.balanceReal,
      });
      return selected.documentId;
    }

    // Fallback (no debería llegar aquí)
    return null;
  } catch (error) {
    console.error("[findClosestParentRecord] Error:", error);
    return null;
  }
}


/**
 * Verificar si un padre está saldado por sus hijos y actualizar su status a 'pagado'.
 * Si hay excedente (los hijos pagan más de lo que vale la cuota), crea un adelanto
 * automático con el monto sobrante.
 *
 * Regla:
 * - Si el padre tiene status 'pendiente' o 'retrasado'
 * - Y computeQuotaBalance(parent) === 0 (totalmente cubierto)
 * - Entonces actualizar el padre a status 'pagado'
 * - Si hay excedente (> 0.01), crear adelanto automático
 *
 * @param parentDocumentId - documentId del padre a verificar
 * @returns true si se actualizó o se creó adelanto, false si no
 */
export async function checkAndUpdateParentIfPaid(parentDocumentId: string): Promise<boolean> {
  try {
    // Query para obtener el padre con sus hijos y financiamiento
    // Strapi v5 GET by documentId defaults to published only. Use list query.
    const query = qs.stringify({
      filters: {
        documentId: { $eq: parentDocumentId },
      },
      populate: {
        childRecords: {
          fields: ["amount", "status"],
        },
        financing: {
          fields: ["id", "documentId", "financingNumber", "quotaAmount", "totalQuotas", "paidQuotas", "currentBalance", "status"],
        },
      },
      fields: ["documentId", "amount", "status", "quotaNumber", "dueDate"],
      pagination: { pageSize: 1 },
    }, { encodeValuesOnly: true });

    const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[checkAndUpdateParentIfPaid] Error fetching parent ${parentDocumentId}:`, await response.text());
      return false;
    }

    const result = await response.json();
    const parent = result.data?.[0];

    if (!parent) {
      console.log(`[checkAndUpdateParentIfPaid] Parent ${parentDocumentId} not found`);
      return false;
    }

    // Solo procesar si el status es pendiente, retrasado o abonado
    if (parent.status !== "pendiente" && parent.status !== "retrasado" && parent.status !== "abonado") {
      console.log(`[checkAndUpdateParentIfPaid] Parent ${parentDocumentId} status is '${parent.status}', skipping`);
      return false;
    }

    // Usar computeQuotaBalance centralizado
    const balanceDueParent = computeQuotaBalance(parent as BillingRecordRaw);
    const parentAmount = parent.amount ?? 0;

    // Calcular total pagado por hijos para detectar excedentes
    const childRecords = parent.childRecords || [];
    const positiveChildrenTotal = childRecords.reduce(
      (sum: number, child: { amount: number }) => sum + (child.amount > 0 ? child.amount : 0),
      0
    );
    const excess = positiveChildrenTotal - parentAmount;

    console.log(`[checkAndUpdateParentIfPaid] Parent ${parentDocumentId}:`, {
      parentAmount,
      positiveChildrenTotal,
      balanceDueParent,
      excess,
      childrenCount: childRecords.length,
    });

    // Si los abonos cubren el monto total, cambiar automáticamente a 'pagado'
    if (balanceDueParent === 0 && positiveChildrenTotal > 0) {
      console.log(`[checkAndUpdateParentIfPaid] Parent ${parentDocumentId} is fully covered by children (balance: 0), updating status to 'pagado'`);

      const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${parentDocumentId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            status: "pagado",
          },
        }),
        cache: "no-store",
      });

      if (!updateResponse.ok) {
        console.error(`[checkAndUpdateParentIfPaid] Error updating parent ${parentDocumentId}:`, await updateResponse.text());
        return false;
      }

      console.log(`[checkAndUpdateParentIfPaid] ✓ Parent ${parentDocumentId} updated to 'pagado'`);

      // Si hay excedente significativo, crear adelanto automático
      if (excess > 0.01) {
        const financing = parent.financing;
        if (financing?.documentId) {
          console.log(`[checkAndUpdateParentIfPaid] Excess detected: $${excess.toFixed(2)}. Creating automatic advance.`);

          const receiptNumber = await generateReceiptNumber();
          const advancePayload = {
            receiptNumber,
            amount: parseFloat(excess.toFixed(2)),
            currency: "PAB",
            status: "adelanto",
            quotaNumber: 0,
            quotasCovered: 1,
            quotaAmountCovered: 0,
            advanceCredit: 0,
            remainingQuotaBalance: 0,
            lateFeeAmount: 0,
            daysLate: 0,
            dueDate: new Date().toISOString().split("T")[0],
            paymentDate: new Date().toISOString().split("T")[0],
            comments: `Adelanto automático generado por excedente de cuota ${parentDocumentId}`,
            financing: financing.id, // ID numérico requerido por Strapi v5
          };

          const advanceResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ data: advancePayload }),
            cache: "no-store",
          });

          if (advanceResponse.ok) {
            const advanceResult = await advanceResponse.json();
            console.log(`[checkAndUpdateParentIfPaid] ✓ Automatic advance created: ${advanceResult.data?.documentId} for $${excess.toFixed(2)}`);
          } else {
            console.error(`[checkAndUpdateParentIfPaid] Failed to create automatic advance:`, await advanceResponse.text());
          }
        }
      }

      return true;
    }

    console.log(`[checkAndUpdateParentIfPaid] Parent ${parentDocumentId} is not fully paid yet (balance: ${balanceDueParent})`);
    return false;
  } catch (error) {
    console.error(`[checkAndUpdateParentIfPaid] Error processing parent ${parentDocumentId}:`, error);
    return false;
  }
}

/**
 * Vincula cuotas pendientes como hijas de un pago adelanto (multi-cuota)
 * 
 * Regla:
 * - El pago adelanto es el PADRE
 * - Las cuotas cubiertas son HIJAS del adelanto
 * - Las cuotas cambian a status 'cubierta' (o 'pagado' si se prefiere)
 * 
 * @param advancePaymentId - documentId del pago adelanto (padre)
 * @param financingDocumentId - ID del financiamiento
 * @param quotasToCover - Número de cuotas a cubrir
 * @returns array de cuotas vinculadas
 */
/**
 * Marca cuotas como "cubiertas" por un pago adelanto multi-cuota
 * 
 * NOTA: No usamos parentRecord porque las cuotas pueden ser padres de adelantos.
 * En su lugar, cambiamos el status a "cubierta" y el frontend interpreta esto.
 */
export async function markQuotasAsCovered(
  advancePaymentId: string,
  financingDocumentId: string,
  quotasToCover: number
): Promise<string[]> {
  try {
    console.log(`[markQuotasAsCovered] Marcando ${quotasToCover} cuota(s) como cubiertas por adelanto ${advancePaymentId}`);
    
    // OBTENER ID NUMÉRICO del adelanto — Strapi v5 requiere ID numérico para relaciones en PUT
    const advanceNumericId = await getStrapiNumericId(advancePaymentId);
    
    if (!advanceNumericId) {
      console.error(`[markQuotasAsCovered] No se pudo obtener ID numérico del adelanto ${advancePaymentId}. Abortando.`);
      return [];
    }
    
    console.log(`[markQuotasAsCovered] ID numérico del adelanto: ${advanceNumericId}`);
    
    // Buscar cuotas pendientes/retrasadas del financiamiento
    // NOTA: Excluir adelantos (no marcar pagos multi-cuota como cubiertos)
    const query = qs.stringify({
      filters: {
        financing: {
          documentId: {
            $eq: financingDocumentId,
          },
        },
        documentId: {
          $ne: advancePaymentId, // Excluir el propio adelanto
        },
        status: {
          $in: ["pendiente", "retrasado"], // Solo cuotas pendientes, no adelantos
        },
      },
      sort: ["dueDate:asc"], // Más antiguas primero
      fields: ["documentId", "amount", "status", "dueDate", "quotaNumber"],
      pagination: {
        pageSize: quotasToCover,
      },
    }, { encodeValuesOnly: true });

    const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[markQuotasAsCovered] Error fetching quotas:`, await response.text());
      return [];
    }

    const data = await response.json();
    const quotas = data.data || [];
    
    console.log(`[markQuotasAsCovered] Encontradas ${quotas.length} cuotas para marcar como cubiertas`);
    
    const coveredQuotas: string[] = [];
    
    // Marcar cada cuota como cubierta
    for (const quota of quotas) {
      const quotaId = quota.documentId;
      
      console.log(`[markQuotasAsCovered] Marcando cuota ${quotaId} (quota #${quota.quotaNumber}) como cubierta`);
      
      const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${quotaId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            status: "cubierta",
            paymentDate: new Date().toISOString().split('T')[0],
            parentRecord: advanceNumericId, // Vincular como hija del adelanto (ID numérico requerido por Strapi v5)
            comments: `CUBIERTA_POR_ADELANTO:${advancePaymentId}`,
          },
        }),
        cache: "no-store",
      });
      
      if (updateResponse.ok) {
        coveredQuotas.push(quotaId);
        console.log(`[markQuotasAsCovered] ✓ Cuota ${quotaId} marcada como cubierta`);
      } else {
        console.error(`[markQuotasAsCovered] ERROR marcando cuota ${quotaId}:`, await updateResponse.text());
      }
    }
    
    console.log(`[markQuotasAsCovered] Marcadas ${coveredQuotas.length} cuotas como cubiertas:`, coveredQuotas);
    return coveredQuotas;
  } catch (error) {
    console.error(`[markQuotasAsCovered] Error:`, error);
    return [];
  }
}

/**
 * Busca un adelanto disponible que pueda cubrir una cuota pendiente
 * 
 * Regla:
 * - Busca adelantos en el mismo financiamiento
 * - El adelanto debe tener suficiente monto disponible
 * - Retorna el ID del adelanto o null si no hay ninguno
 */
export async function findAdvanceToCoverQuota(
  quotaAmount: number,
  financingDocumentId: string,
  quotaDocumentId?: string
): Promise<string | null> {
  try {
    console.log(`[findAdvanceToCoverQuota] Buscando adelanto para cuota de $${quotaAmount}`);
    
    // Buscar adelantos en el financiamiento
    const query = qs.stringify({
      filters: {
        financing: {
          documentId: { $eq: financingDocumentId },
        },
        status: { $eq: "adelanto" },
        // Excluir el propio record si se proporciona
        ...(quotaDocumentId ? { documentId: { $ne: quotaDocumentId } } : {}),
      },
      sort: ["createdAt:asc"], // Más antiguos primero (FIFO)
      fields: ["documentId", "amount", "quotaAmountCovered"],
      populate: {
        childRecords: {
          fields: ["amount"],
        },
      },
      pagination: { pageSize: 10 },
    }, { encodeValuesOnly: true });

    const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[findAdvanceToCoverQuota] Error:`, await response.text());
      return null;
    }

    const data = await response.json();
    const advances = data.data || [];
    
    console.log(`[findAdvanceToCoverQuota] Encontrados ${advances.length} adelantos`);

    for (const advance of advances) {
      // Calcular monto ya consumido por hijos
      const consumedAmount = (advance.childRecords || []).reduce(
        (sum: number, child: any) => sum + (child.amount || 0), 
        0
      );
      
      // Calcular monto disponible
      const availableAmount = advance.amount - consumedAmount;
      
      console.log(`[findAdvanceToCoverQuota] Adelanto ${advance.documentId}: total=$${advance.amount}, consumido=$${consumedAmount}, disponible=$${availableAmount}`);
      
      // Si tiene suficiente disponible, retornarlo
      if (availableAmount >= quotaAmount) {
        console.log(`[findAdvanceToCoverQuota] ✓ Adelanto disponible encontrado: ${advance.documentId}`);
        return advance.documentId;
      }
    }
    
    console.log(`[findAdvanceToCoverQuota] No hay adelantos con suficiente monto disponible`);
    return null;
  } catch (error) {
    console.error(`[findAdvanceToCoverQuota] Error:`, error);
    return null;
  }
}

export async function linkQuotasToAdvancePayment(
  advancePaymentId: string,
  financingDocumentId: string,
  quotasToCover: number
): Promise<string[]> {
  try {
    console.log(`[linkQuotasToAdvancePayment] ==================================================`);
    console.log(`[linkQuotasToAdvancePayment] Vinculando ${quotasToCover} cuota(s) al adelanto ${advancePaymentId}`);
    console.log(`[linkQuotasToAdvancePayment] FinancingDocumentId: ${financingDocumentId}`);
    
    // Obtener ID numérico del adelanto (requerido por Strapi v5 para relaciones)
    const advanceNumericId = await getStrapiNumericId(advancePaymentId);
    
    if (!advanceNumericId) {
      console.error(`[linkQuotasToAdvancePayment] No se pudo obtener ID numérico para el adelanto ${advancePaymentId}`);
      return [];
    }
    
    // DEBUG: Primero obtener TODOS los records del financiamiento sin filtros
    const debugQuery = qs.stringify({
      filters: {
        financing: {
          documentId: {
            $eq: financingDocumentId,
          },
        },
      },
      fields: ["documentId", "amount", "status", "dueDate", "receiptNumber"],
      pagination: { pageSize: 100 },
    }, { encodeValuesOnly: true });
    
    const debugResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${debugQuery}`, {
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });
    
    if (debugResponse.ok) {
      const debugData = await debugResponse.json();
      const allRecords = debugData.data || [];
      console.log(`[linkQuotasToAdvancePayment] DEBUG - Total records en financing: ${allRecords.length}`);
      console.log(`[linkQuotasToAdvancePayment] DEBUG - Records:`, allRecords.map((r: any) => ({
        id: r.documentId,
        receipt: r.receiptNumber,
        status: r.status,
        amount: r.amount,
        parentId: r.parentRecord?.documentId || null,
        financing: r.financing?.documentId || r.financing?.id || r.financing,
      })));
    } else {
      console.log(`[linkQuotasToAdvancePayment] DEBUG - Error en query:`, await debugResponse.text());
    }
    
    // Buscar cuotas pendientes del financiamiento
    const query = qs.stringify({
      filters: {
        financing: {
          documentId: {
            $eq: financingDocumentId,
          },
        },
        documentId: {
          $ne: advancePaymentId,
        },
        parentRecord: {
          $null: true,
        },
        status: {
          $in: ["pendiente", "retrasado", "adelanto"],
        },
      },
      sort: ["dueDate:asc"],
      fields: ["documentId", "amount", "status", "dueDate"],
      pagination: { pageSize: quotasToCover },
    }, { encodeValuesOnly: true });

    const response = await fetch(`${STRAPI_BASE_URL}/api/billing-records?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(`[linkQuotasToAdvancePayment] Error fetching quotas:`, await response.text());
      return [];
    }

    const data = await response.json();
    const allRecords = data.data || [];
    console.log(`[linkQuotasToAdvancePayment] Total records encontrados: ${allRecords.length}`);
    console.log(`[linkQuotasToAdvancePayment] Records:`, allRecords.map((r: any) => ({ id: r.documentId, status: r.status, amount: r.amount })));
    
    const quotas = allRecords;
    
    if (quotas.length === 0) {
      console.log(`[linkQuotasToAdvancePayment] No hay cuotas pendientes para vincular`);
      console.log(`[linkQuotasToAdvancePayment] Query usada:`, query);
      console.log(`[linkQuotasToAdvancePayment] Respuesta completa:`, JSON.stringify(data, null, 2));
      return [];
    }
    
    console.log(`[linkQuotasToAdvancePayment] Encontradas ${quotas.length} cuotas para vincular`);
    
    const linkedQuotas: string[] = [];
    
    // Vincular cada cuota como hija del adelanto
    for (const quota of quotas) {
      const quotaId = quota.documentId;
      
      // Seguridad: nunca vincular una cuota a sí misma
      if (quotaId === advancePaymentId) {
        console.log(`[linkQuotasToAdvancePayment] ⚠ Ignorando cuota ${quotaId} (es el mismo adelanto)`);
        continue;
      }
      
      console.log(`[linkQuotasToAdvancePayment] Vinculando cuota ${quotaId} al adelanto ${advancePaymentId}`);
      
      const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records/${quotaId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            parentRecord: advanceNumericId,
            status: "cubierta", // Nuevo estado: cubierta por adelanto
          },
        }),
        cache: "no-store",
      });
      
      if (updateResponse.ok) {
        linkedQuotas.push(quotaId);
        console.log(`[linkQuotasToAdvancePayment] ✓ Cuota ${quotaId} vinculada`);
      } else {
        console.error(`[linkQuotasToAdvancePayment] ✗ Error vinculando cuota ${quotaId}:`, await updateResponse.text());
      }
    }
    
    console.log(`[linkQuotasToAdvancePayment] Vinculadas ${linkedQuotas.length} cuotas:`, linkedQuotas);
    return linkedQuotas;
  } catch (error) {
    console.error(`[linkQuotasToAdvancePayment] Error:`, error);
    return [];
  }
}

/**
 * Aplica el saldo restante de un adelanto como abono parcial a una cuota.
 * Crea un nuevo billing record "abonado" vinculado como hijo de la cuota,
 * y marca el adelanto original como "pagado" (consumido).
 */
export async function applyAdvanceAsPartialPayment(
  advance: { documentId: string; numericId: number; amount?: number; available: number },
  quota: { documentId: string; numericId: number; amount: number; quotaNumber: number; dueDate?: string },
  financingNumericId: number
): Promise<boolean> {
  try {
    console.log(`[applyAdvanceAsPartialPayment] Adelanto ${advance.documentId} ($${advance.available}) → Cuota #${quota.quotaNumber} ($${quota.amount})`);

    // 1. Generar número de recibo para el abono parcial
    const receiptNumber = await generateReceiptNumber();

    // 2. Crear abono parcial como hijo de la cuota
    const abonoPayload = {
      receiptNumber,
      amount: parseFloat(advance.available.toFixed(2)),
      currency: "PAB",
      status: "abonado",
      quotaNumber: quota.quotaNumber,
      quotasCovered: 1,
      quotaAmountCovered: advance.available,
      advanceCredit: 0,
      remainingQuotaBalance: Math.max(0, quota.amount - advance.available),
      lateFeeAmount: 0,
      daysLate: 0,
      dueDate: quota.dueDate || new Date().toISOString().split("T")[0],
      paymentDate: new Date().toISOString().split("T")[0],
      comments: `Abono parcial generado automáticamente desde adelanto ${advance.documentId} (saldo restante)`,
      financing: financingNumericId,
      parentRecord: quota.numericId, // Vinculado como hijo de la cuota
    };

    const abonoResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: abonoPayload }),
      cache: "no-store",
    });

    if (!abonoResponse.ok) {
      console.error(`[applyAdvanceAsPartialPayment] Error creando abono:`, await abonoResponse.text());
      return false;
    }

    const abonoResult = await abonoResponse.json();
    console.log(`[applyAdvanceAsPartialPayment] ✓ Abono creado: ${abonoResult.data?.documentId} por $${advance.available}`);

    // 3. Actualizar la cuota padre a "abonado" para reflejar que tiene un pago parcial
    try {
      const quotaUpdateResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records/${quota.documentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              status: "abonado",
              remainingQuotaBalance: Math.max(0, quota.amount - advance.available),
            },
          }),
          cache: "no-store",
        }
      );
      if (quotaUpdateResponse.ok) {
        console.log(`[applyAdvanceAsPartialPayment] ✓ Cuota ${quota.documentId} actualizada a status 'abonado'`);
      } else {
        console.error(`[applyAdvanceAsPartialPayment] ⚠ Error actualizando cuota padre:`, await quotaUpdateResponse.text());
      }
    } catch (quotaUpdateError) {
      console.error(`[applyAdvanceAsPartialPayment] ⚠ Error en update de cuota padre:`, quotaUpdateError);
    }

    // BUGFIX: Marcar el adelanto como consumido reduciendo su amount a 0.
    // El abono queda como hijo de la cuota (para calcular balance pendiente).
    // El adelanto original queda como registro histórico con monto 0 para
    // evitar que aparezca nuevamente en auto-cover.
    try {
      const consumeResponse = await fetch(
        `${STRAPI_BASE_URL}/api/billing-records/${advance.documentId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${STRAPI_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            data: {
              amount: 0,
              status: "pagado",
              comments: `Consumido parcialmente: $${advance.available} aplicados a cuota #${quota.quotaNumber} (abono ${abonoResult.data?.documentId}). Monto original: $${advance.amount}.`,
            },
          }),
          cache: "no-store",
        }
      );
      if (consumeResponse.ok) {
        console.log(`[applyAdvanceAsPartialPayment] ✓ Adelanto ${advance.documentId} marcado como consumido (amount=0)`);
      } else {
        console.error(`[applyAdvanceAsPartialPayment] ⚠ Error marcando adelanto como consumido:`, await consumeResponse.text());
      }
    } catch (consumeError) {
      console.error(`[applyAdvanceAsPartialPayment] ⚠ Error en consumo de adelanto:`, consumeError);
    }

    return true;
  } catch (error) {
    console.error(`[applyAdvanceAsPartialPayment] Error:`, error);
    return false;
  }
}

/**
 * Aplica una cantidad específica de un adelanto a una cuota como abono.
 * Crea un billing record hijo de la cuota y reduce el monto disponible del adelanto.
 * No modifica el status de la cuota (eso debe hacerse externamente).
 *
 * @returns true si se aplicó exitosamente
 */
async function applyAdvanceAmountToQuota(
  advance: { documentId: string; numericId: number; amount: number },
  quota: { documentId: string; numericId: number; amount: number; quotaNumber: number; dueDate?: string },
  amountToApply: number,
  financingNumericId: number
): Promise<boolean> {
  try {
    console.log(`[applyAdvanceAmountToQuota] Adelanto ${advance.documentId} → Cuota #${quota.quotaNumber}: aplicando $${amountToApply}`);

    const receiptNumber = await generateReceiptNumber();

    const abonoPayload = {
      receiptNumber,
      amount: parseFloat(amountToApply.toFixed(2)),
      currency: "PAB",
      status: "abonado",
      quotaNumber: quota.quotaNumber,
      quotasCovered: 1,
      quotaAmountCovered: amountToApply,
      advanceCredit: 0,
      remainingQuotaBalance: 0,
      lateFeeAmount: 0,
      daysLate: 0,
      dueDate: quota.dueDate || new Date().toISOString().split("T")[0],
      paymentDate: new Date().toISOString().split("T")[0],
      comments: `Abono parcial de $${amountToApply} desde adelanto ${advance.documentId}`,
      financing: financingNumericId,
      parentRecord: quota.numericId,
    };

    const abonoResponse = await fetch(`${STRAPI_BASE_URL}/api/billing-records`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: abonoPayload }),
      cache: "no-store",
    });

    if (!abonoResponse.ok) {
      console.error(`[applyAdvanceAmountToQuota] Error creando abono:`, await abonoResponse.text());
      return false;
    }

    const abonoResult = await abonoResponse.json();
    console.log(`[applyAdvanceAmountToQuota] ✓ Abono creado: ${abonoResult.data?.documentId} por $${amountToApply}`);

    // Reducir el monto disponible del adelanto
    const newAdvanceAmount = Math.max(0, advance.amount - amountToApply);
    const consumeResponse = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records/${advance.documentId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${STRAPI_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            amount: parseFloat(newAdvanceAmount.toFixed(2)),
            status: newAdvanceAmount <= 0.01 ? "pagado" : undefined,
            comments: `Consumido parcialmente: $${amountToApply} aplicados a cuota #${quota.quotaNumber} (abono ${abonoResult.data?.documentId}). Saldo restante: $${newAdvanceAmount}.`,
          },
        }),
        cache: "no-store",
      }
    );

    if (consumeResponse.ok) {
      console.log(`[applyAdvanceAmountToQuota] ✓ Adelanto ${advance.documentId} reducido a $${newAdvanceAmount}`);
    } else {
      console.error(`[applyAdvanceAmountToQuota] ⚠ Error reduciendo adelanto:`, await consumeResponse.text());
    }

    return true;
  } catch (error) {
    console.error(`[applyAdvanceAmountToQuota] Error:`, error);
    return false;
  }
}

/**
 * Auto-cubre cuotas pendientes/retrasadas usando adelantos disponibles.
 * Consume TODOS los adelantos disponibles (FIFO) hasta cubrir cada cuota.
 * Si una cuota queda completamente cubierta por múltiples adelantos, pasa a status 'pagado'.
 *
 * Regla:
 * - Busca TODOS los adelantos del financiamiento
 * - Calcula saldo disponible de cada uno (amount - sum(hijos.amount))
 * - Busca TODAS las cuotas pendientes/retrasadas/abonadas del financiamiento
 * - Calcula balance real de cada cuota considerando abonos existentes
 * - Aplica adelantos FIFO hasta cubrir la cuota o agotar adelantos
 * - Cuota cubierta completamente → status 'pagado'
 * - Cuota parcialmente cubierta → status 'abonado'
 *
 * @param financingDocumentId - documentId del financiamiento
 * @returns array de cuotas procesadas (cubiertas o abonadas)
 */
export async function autoCoverPendingQuotas(
  financingDocumentId: string
): Promise<string[]> {
  try {
    console.log(`[autoCoverPendingQuotas] Iniciando auto-cover para financing ${financingDocumentId}`);

    // 1. Buscar todos los adelantos del financiamiento con sus hijos
    const advanceQuery = qs.stringify({
      filters: {
        financing: { documentId: { $eq: financingDocumentId } },
        status: { $eq: "adelanto" },
      },
      sort: ["createdAt:asc"],
      fields: ["id", "documentId", "amount"],
      populate: {
        childRecords: {
          fields: ["id", "documentId", "amount"],
        },
      },
      pagination: { pageSize: 100 },
    }, { encodeValuesOnly: true });

    const advanceResponse = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?${advanceQuery}`,
      { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
    );

    if (!advanceResponse.ok) {
      console.error(`[autoCoverPendingQuotas] Error buscando adelantos:`, await advanceResponse.text());
      return [];
    }

    const advanceData = await advanceResponse.json();
    const advances = (advanceData.data || []).map((adv: any) => {
      const attrs = adv.attributes || adv;
      const children = attrs.childRecords?.data || attrs.childRecords || [];
      const consumed = children.reduce((sum: number, c: any) => {
        const ca = c.attributes || c;
        return sum + (ca.amount || 0);
      }, 0);
      return {
        documentId: adv.documentId,
        numericId: adv.id,
        amount: attrs.amount || 0,
        consumed,
        available: (attrs.amount || 0) - consumed,
      };
    }).filter((adv: any) => adv.available > 0);

    console.log(`[autoCoverPendingQuotas] Adelantos con saldo: ${advances.length}`, advances.map((a: any) => ({ docId: a.documentId, available: a.available })));

    if (advances.length === 0) {
      console.log(`[autoCoverPendingQuotas] No hay adelantos con saldo disponible`);
      return [];
    }

    // 2. Buscar TODAS las cuotas pendientes/retrasadas/abonadas (incluir abonado para acumular adelantos)
    const quotaQuery = qs.stringify({
      filters: {
        financing: { documentId: { $eq: financingDocumentId } },
        status: { $in: ["pendiente", "retrasado", "abonado"] },
        parentRecord: { $null: true }, // Solo cuotas raíz, nunca abonos hijos
      },
      sort: ["dueDate:asc"],
      fields: ["id", "documentId", "amount", "quotaNumber", "dueDate", "status"],
      populate: {
        childRecords: {
          fields: ["id", "documentId", "amount", "status"],
        },
      },
      pagination: { pageSize: 100 },
    }, { encodeValuesOnly: true });

    const quotaResponse = await fetch(
      `${STRAPI_BASE_URL}/api/billing-records?${quotaQuery}`,
      { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
    );

    if (!quotaResponse.ok) {
      console.error(`[autoCoverPendingQuotas] Error buscando cuotas:`, await quotaResponse.text());
      return [];
    }

    const quotaData = await quotaResponse.json();
    const pendingQuotas = (quotaData.data || []).map((q: any) => {
      const attrs = q.attributes || q;
      const children = attrs.childRecords?.data || attrs.childRecords || [];
      const childrenTotal = children.reduce((sum: number, c: any) => {
        const ca = c.attributes || c;
        return sum + (ca.amount > 0 ? ca.amount : 0);
      }, 0);
      const balance = Math.max(0, (attrs.amount || 0) - childrenTotal);
      return {
        documentId: q.documentId,
        numericId: q.id,
        amount: attrs.amount || 0,
        quotaNumber: attrs.quotaNumber,
        dueDate: attrs.dueDate,
        status: attrs.status,
        balance,
      };
    }).filter((q: any) => q.balance > 0);

    console.log(`[autoCoverPendingQuotas] Cuotas con balance pendiente: ${pendingQuotas.length}`, pendingQuotas.map((q: any) => `#${q.quotaNumber}=$${q.amount} balance=$${q.balance}`));

    if (pendingQuotas.length === 0) {
      console.log(`[autoCoverPendingQuotas] No hay cuotas con saldo pendiente`);
      return [];
    }

    // Obtener financing numérico para crear abonos parciales
    let financingNumericId = 0;
    try {
      const financingResp = await fetch(
        `${STRAPI_BASE_URL}/api/financings/${financingDocumentId}?fields[0]=id`,
        { headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` }, cache: "no-store" }
      );
      if (financingResp.ok) {
        const financingData = await financingResp.json();
        financingNumericId = financingData.data?.id || 0;
      }
    } catch (e) {
      console.error(`[autoCoverPendingQuotas] Error obteniendo financing numericId:`, e);
    }

    if (financingNumericId === 0) {
      console.error(`[autoCoverPendingQuotas] No se pudo obtener financing numericId, abortando auto-cover`);
      return [];
    }

    // 3. Aplicar adelantos FIFO a cada cuota hasta cubrirla o agotar adelantos
    const coveredQuotas: string[] = [];

    for (const quota of pendingQuotas) {
      let remainingBalance = quota.balance;
      console.log(`[autoCoverPendingQuotas] Procesando cuota #${quota.quotaNumber}, balance pendiente: $${remainingBalance}`);

      // 3a. Cobertura completa: un solo adelanto cubre toda la cuota.
      // SOLO usar esta rama si la cuota está completamente sin pagar (no tiene abonos previos).
      // Si la cuota ya tiene abonos parciales, forzar la rama parcial (3b) para crear
      // un abono exacto por el balance faltante, evitando que el adelanto consuma
      // el monto completo de la cuota y deje saldo incorrecto.
      const fullAdvance = advances.find((a: any) => a.available >= remainingBalance);
      if (fullAdvance && remainingBalance >= quota.amount - 0.01) {
        console.log(`[autoCoverPendingQuotas] Vinculando cuota #${quota.quotaNumber} ($${remainingBalance}) a adelanto ${fullAdvance.documentId} (saldo: $${fullAdvance.available})`);

        const updateResponse = await fetch(
          `${STRAPI_BASE_URL}/api/billing-records/${quota.documentId}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${STRAPI_API_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              data: {
                status: "cubierta",
                paymentDate: new Date().toISOString().split("T")[0],
                parentRecord: fullAdvance.numericId,
                comments: `AUTO_CUBIERTA_POR_ADELANTO:${fullAdvance.documentId}`,
              },
            }),
            cache: "no-store",
          }
        );

        if (updateResponse.ok) {
          fullAdvance.available -= remainingBalance;
          fullAdvance.consumed += remainingBalance;
          if (!coveredQuotas.includes(quota.documentId)) {
            coveredQuotas.push(quota.documentId);
          }
          console.log(`[autoCoverPendingQuotas] ✓ Cuota #${quota.quotaNumber} cubierta. Saldo restante adelanto: $${fullAdvance.available}`);
        } else {
          console.error(`[autoCoverPendingQuotas] ✗ Error cubriendo cuota #${quota.quotaNumber}:`, await updateResponse.text());
        }
        continue;
      }

      // 3b. Cobertura parcial: aplicar TODOS los adelantos disponibles FIFO
      for (const advance of advances) {
        if (remainingBalance <= 0.01) break;
        if (advance.available <= 0.01) continue;

        const amountToApply = Math.min(remainingBalance, advance.available);
        console.log(`[autoCoverPendingQuotas] Aplicando $${amountToApply} de adelanto ${advance.documentId} a cuota #${quota.quotaNumber}`);

        const applied = await applyAdvanceAmountToQuota(
          { documentId: advance.documentId, numericId: advance.numericId, amount: advance.amount },
          { documentId: quota.documentId, numericId: quota.numericId, amount: quota.amount, quotaNumber: quota.quotaNumber, dueDate: quota.dueDate },
          amountToApply,
          financingNumericId
        );

        if (applied) {
          advance.available -= amountToApply;
          advance.amount -= amountToApply;
          remainingBalance -= amountToApply;
          if (!coveredQuotas.includes(quota.documentId)) {
            coveredQuotas.push(quota.documentId);
          }
          console.log(`[autoCoverPendingQuotas] ✓ Aplicados $${amountToApply}. Balance restante cuota: $${remainingBalance}, adelanto: $${advance.available}`);
        } else {
          console.error(`[autoCoverPendingQuotas] ✗ Error aplicando adelanto ${advance.documentId}`);
        }
      }

      // 3c. Actualizar status de la cuota según balance final
      if (remainingBalance <= 0.01) {
        // Cubierta completamente por múltiples adelantos
        await updateBillingRecordInStrapi(quota.documentId, {
          status: "pagado",
        });
        console.log(`[autoCoverPendingQuotas] ✓ Cuota #${quota.quotaNumber} cubierta completamente por múltiples adelantos. Status: pagado`);
      } else if (remainingBalance < quota.balance) {
        // Parcialmente cubierta
        await updateBillingRecordInStrapi(quota.documentId, {
          status: "abonado",
        });
        console.log(`[autoCoverPendingQuotas] ✓ Cuota #${quota.quotaNumber} abonada parcialmente. Balance pendiente: $${remainingBalance}`);
      } else {
        console.log(`[autoCoverPendingQuotas] Cuota #${quota.quotaNumber} no recibió adelantos (balance: $${remainingBalance})`);
      }
    }

    console.log(`[autoCoverPendingQuotas] Total cuotas cubiertas/abonadas: ${coveredQuotas.length}`);
    return coveredQuotas;
  } catch (error) {
    console.error(`[autoCoverPendingQuotas] Error:`, error);
    return [];
  }
}
