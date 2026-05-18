/**
 * Librería de funciones para el módulo de Financiamiento
 * Maneja la comunicación con Strapi y cálculos de negocio
 */

import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { formatCurrency } from "./format";

// ============================================================================
// TIPOS
// ============================================================================

export type FinancingStatus = "activo" | "inactivo" | "en_mora" | "completado";
export type PaymentFrequency = "semanal" | "quincenal" | "mensual";
export type PaymentStatus = "pagado" | "pendiente" | "adelanto" | "retrasado" | "abonado" | "cubierta";

export interface FinancingRaw {
  id: number;
  documentId: string;
  financingNumber: string;
  totalAmount: number;
  financingMonths: number;
  paymentFrequency: PaymentFrequency;
  quotaAmount: number;
  totalQuotas: number;
  paidQuotas: number;
  startDate: string;
  nextDueDate?: string;
  status: FinancingStatus;
  maxLateQuotasAllowed: number;
  lateFeePercentage: number;
  currentBalance: number;
  totalPaid: number;
  totalLateFees: number;
  partialPaymentCredit: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  vehicle?: {
    id: number;
    documentId: string;
    name: string;
    placa?: string;
    brand?: string;
    model?: string;
    year?: number;
  };
  client?: {
    id: number;
    documentId: string;
    displayName: string;
    email?: string;
    phone?: string;
    identificationNumber?: string;
  };
  payments?: PaymentRaw[];
}

export interface PaymentRaw {
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
  lateFeeAmount: number;
  daysLate: number;
  dueDate: string;
  paymentDate?: string;
  confirmationNumber?: string;
  verifiedInBank: boolean;
  verifiedAt?: string;
  comments?: string;
  createdAt: string;
}

export interface FinancingCard {
  id: string;
  numericId: number; // ID numérico interno de Strapi, requerido para crear relaciones en POST
  documentId: string;
  financingNumber: string;
  totalAmount: number;
  totalAmountLabel: string;
  financingMonths: number;
  paymentFrequency: PaymentFrequency;
  paymentFrequencyLabel: string;
  quotaAmount: number;
  quotaAmountLabel: string;
  totalQuotas: number;
  paidQuotas: number;
  pendingQuotas: number;
  progressPercentage: number;
  startDate: string;
  startDateLabel: string;
  nextDueDate?: string;
  nextDueDateLabel?: string;
  status: FinancingStatus;
  statusLabel: string;
  maxLateQuotasAllowed: number;
  lateFeePercentage: number;
  currentBalance: number;
  currentBalanceLabel: string;
  totalPaid: number;
  totalPaidLabel: string;
  totalLateFees: number;
  totalLateFeesLabel: string;
  partialPaymentCredit: number;
  notes?: string;
  // Relaciones
  vehicleId?: string;
  vehicleDocumentId?: string;
  vehicleName?: string;
  vehiclePlaca?: string;
  vehicleInfo?: string;
  clientId?: string;
  clientDocumentId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientIdentification?: string;
  // Pagos
  payments: PaymentCard[];
  createdAt: string;
}

export interface PaymentCard {
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
  lateFeeAmount: number;
  lateFeeAmountLabel: string;
  daysLate: number;
  dueDate: string;
  dueDateLabel: string;
  paymentDate?: string;
  paymentDateLabel?: string;
  confirmationNumber?: string;
  verifiedInBank: boolean;
  comments?: string;
  createdAt: string;
}

export interface FinancingCreatePayload {
  totalAmount: number;
  financingMonths?: number;
  totalQuotas?: number; // Si se proporciona, se usa directamente
  paymentFrequency: PaymentFrequency;
  startDate: string;
  maxLateQuotasAllowed?: number;
  lateFeePercentage?: number;
  notes?: string;
  // Strapi v5: relaciones en POST requieren ID numérico.
  // Se acepta number (recomendado), string numérico, o formato connect legacy.
  vehicle: number | string | { connect?: (number | string)[] };
  client: number | string | { connect?: (number | string)[] };
}

export interface PaymentCreatePayload {
  amount: number;
  currency?: string;
  quotaNumber: number;
  dueDate: string;
  paymentDate?: string;
  confirmationNumber?: string;
  comments?: string;
  financing: string; // documentId
}

// ============================================================================
// FUNCIONES DE CÁLCULO
// ============================================================================

/**
 * Calcula el número total de cuotas basado en meses y frecuencia
 */
export function calculateTotalQuotas(months: number, frequency: PaymentFrequency): number {
  switch (frequency) {
    case "semanal":
      return Math.ceil(months * 4.33);
    case "quincenal":
      return months * 2;
    case "mensual":
      return months;
    default:
      return months;
  }
}

/**
 * Calcula el monto de cada cuota
 */
export function calculateQuotaAmount(totalAmount: number, totalQuotas: number): number {
  if (totalQuotas <= 0) return 0;
  return parseFloat((totalAmount / totalQuotas).toFixed(2));
}

/**
 * Obtiene el intervalo de días entre cuotas
 */
export function getDaysInterval(frequency: PaymentFrequency): number {
  switch (frequency) {
    case "semanal":
      return 7;
    case "quincenal":
      return 15;
    case "mensual":
      return 30;
    default:
      return 7;
  }
}

/**
 * Calcula la siguiente fecha de vencimiento
 */
export function calculateNextDueDate(
  startDate: string,
  frequency: PaymentFrequency,
  quotaNumber: number = 1
): string {
  const start = new Date(startDate);
  const daysInterval = getDaysInterval(frequency);
  start.setDate(start.getDate() + daysInterval * quotaNumber);
  return start.toISOString().split("T")[0];
}

/**
 * Calcula la multa por atraso (10% diario sobre monto pendiente)
 */
export function calculateLateFee(
  pendingAmount: number,
  daysLate: number,
  percentage: number = 10
): number {
  if (daysLate <= 0 || pendingAmount <= 0) return 0;
  return parseFloat((pendingAmount * (percentage / 100) * daysLate).toFixed(2));
}

/**
 * Calcula los días de atraso
 */
export function calculateDaysLate(dueDate: string, paymentDate?: string): number {
  const due = new Date(dueDate);
  const payment = paymentDate ? new Date(paymentDate) : new Date();
  const diffTime = payment.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Procesa un pago y calcula cuotas cubiertas y crédito
 */
export function processPayment(
  paymentAmount: number,
  quotaAmount: number,
  partialCredit: number = 0
): { quotasCovered: number; advanceCredit: number; totalApplied: number; isPartialPayment: boolean } {
  // Total disponible = pago actual + crédito acumulado de pagos anteriores
  const totalAvailable = paymentAmount + partialCredit;
  
  // Tolerancia para errores de punto flotante (0.01 = 1 centavo)
  const EPSILON = 0.01;
  
  // Cuotas completas cubiertas con el total disponible
  // Usamos una pequeña tolerancia para manejar errores de precisión de punto flotante
  const rawQuotas = totalAvailable / quotaAmount;
  const quotasCovered = Math.floor(rawQuotas + EPSILON);
  
  // Crédito restante después de cubrir cuotas completas (abono hacia la siguiente cuota)
  const remainder = totalAvailable - (quotasCovered * quotaAmount);
  // Si el resto es muy pequeño (error de precisión), considerarlo como 0
  const advanceCredit = Math.abs(remainder) < EPSILON ? 0 : parseFloat(remainder.toFixed(2));
  
  // Total aplicado a cuotas completas
  const totalApplied = quotasCovered * quotaAmount;
  
  // Es un pago parcial si no se completa ninguna cuota nueva
  const isPartialPayment = quotasCovered === 0;

  return { quotasCovered, advanceCredit, totalApplied, isPartialPayment };
}

/**
 * Calcula el resumen de un financiamiento
 */
export function calculateFinancingSummary(
  totalAmount: number,
  months: number,
  frequency: PaymentFrequency
): {
  totalQuotas: number;
  quotaAmount: number;
  endDate: string;
  daysInterval: number;
} {
  const totalQuotas = calculateTotalQuotas(months, frequency);
  const quotaAmount = calculateQuotaAmount(totalAmount, totalQuotas);
  const daysInterval = getDaysInterval(frequency);

  // Calcular fecha estimada de finalización
  const today = new Date();
  const totalDays = totalQuotas * daysInterval;
  today.setDate(today.getDate() + totalDays);
  const endDate = today.toISOString().split("T")[0];

  return { totalQuotas, quotaAmount, endDate, daysInterval };
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

const getStatusLabel = (status: FinancingStatus): string => {
  const labels: Record<FinancingStatus, string> = {
    activo: "Activo",
    inactivo: "Inactivo",
    en_mora: "En Mora",
    completado: "Completado",
  };
  return labels[status] || status;
};

const getPaymentStatusLabel = (status: PaymentStatus): string => {
  const labels: Record<PaymentStatus, string> = {
    pagado: "Pagado",
    pendiente: "Pendiente",
    abonado: "Abonado",
    adelanto: "Adelanto",
    retrasado: "Retrasado",
    cubierta: "Cubierta",
  };
  return labels[status] || status;
};

const getFrequencyLabel = (frequency: PaymentFrequency): string => {
  const labels: Record<PaymentFrequency, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };
  return labels[frequency] || frequency;
};

// ============================================================================
// NORMALIZACIÓN
// ============================================================================

const normalizePayment = (raw: PaymentRaw): PaymentCard => {
  return {
    id: String(raw.id),
    documentId: raw.documentId,
    receiptNumber: raw.receiptNumber,
    amount: raw.amount,
    amountLabel: formatCurrency(raw.amount, { currency: raw.currency || "PAB" }),
    currency: raw.currency || "PAB",
    status: raw.status,
    statusLabel: getPaymentStatusLabel(raw.status),
    quotaNumber: raw.quotaNumber,
    quotasCovered: raw.quotasCovered || 1,
    quotaAmountCovered: raw.quotaAmountCovered,
    advanceCredit: raw.advanceCredit || 0,
    lateFeeAmount: raw.lateFeeAmount || 0,
    lateFeeAmountLabel: formatCurrency(raw.lateFeeAmount || 0, { currency: raw.currency || "PAB" }),
    daysLate: raw.daysLate || 0,
    dueDate: raw.dueDate,
    dueDateLabel: formatDate(raw.dueDate) || "",
    paymentDate: raw.paymentDate,
    paymentDateLabel: formatDate(raw.paymentDate),
    confirmationNumber: raw.confirmationNumber,
    verifiedInBank: raw.verifiedInBank || false,
    comments: raw.comments,
    createdAt: raw.createdAt,
  };
};

export const normalizeFinancing = (raw: FinancingRaw): FinancingCard => {
  const pendingQuotas = raw.totalQuotas - raw.paidQuotas;
  const progressPercentage = raw.totalQuotas > 0 
    ? Math.round((raw.paidQuotas / raw.totalQuotas) * 100) 
    : 0;

  const vehicleInfo = raw.vehicle
    ? `${raw.vehicle.brand || ""} ${raw.vehicle.model || ""} ${raw.vehicle.year || ""}`.trim()
    : undefined;

  return {
    id: String(raw.id),
    numericId: raw.id,
    documentId: raw.documentId,
    financingNumber: raw.financingNumber,
    totalAmount: raw.totalAmount,
    totalAmountLabel: formatCurrency(raw.totalAmount, { currency: "PAB" }),
    financingMonths: raw.financingMonths,
    paymentFrequency: raw.paymentFrequency,
    paymentFrequencyLabel: getFrequencyLabel(raw.paymentFrequency),
    quotaAmount: raw.quotaAmount,
    quotaAmountLabel: formatCurrency(raw.quotaAmount, { currency: "PAB" }),
    totalQuotas: raw.totalQuotas,
    paidQuotas: raw.paidQuotas,
    pendingQuotas,
    progressPercentage,
    startDate: raw.startDate,
    startDateLabel: formatDate(raw.startDate) || "",
    nextDueDate: raw.nextDueDate,
    nextDueDateLabel: formatDate(raw.nextDueDate),
    status: raw.status,
    statusLabel: getStatusLabel(raw.status),
    maxLateQuotasAllowed: raw.maxLateQuotasAllowed,
    lateFeePercentage: raw.lateFeePercentage,
    currentBalance: raw.currentBalance,
    currentBalanceLabel: formatCurrency(raw.currentBalance, { currency: "PAB" }),
    totalPaid: raw.totalPaid,
    totalPaidLabel: formatCurrency(raw.totalPaid, { currency: "PAB" }),
    totalLateFees: raw.totalLateFees,
    totalLateFeesLabel: formatCurrency(raw.totalLateFees, { currency: "PAB" }),
    partialPaymentCredit: raw.partialPaymentCredit || 0,
    notes: raw.notes,
    // Vehículo
    vehicleId: raw.vehicle ? String(raw.vehicle.id) : undefined,
    vehicleDocumentId: raw.vehicle?.documentId,
    vehicleName: raw.vehicle?.name,
    vehiclePlaca: raw.vehicle?.placa,
    vehicleInfo,
    // Cliente
    clientId: raw.client ? String(raw.client.id) : undefined,
    clientDocumentId: raw.client?.documentId,
    clientName: raw.client?.displayName,
    clientEmail: raw.client?.email,
    clientPhone: raw.client?.phone,
    clientIdentification: raw.client?.identificationNumber,
    // Pagos
    payments: (raw.payments || []).map(normalizePayment),
    createdAt: raw.createdAt,
  };
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

const populateConfig = {
  populate: {
    vehicle: {
      fields: ["id", "documentId", "name", "placa", "brand", "model", "year"],
    },
    client: {
      fields: ["id", "documentId", "displayName", "email", "phone", "identificationNumber"],
    },
    payments: {
      fields: ["id", "documentId", "receiptNumber", "amount", "currency", "status", "quotaNumber", "quotasCovered", "quotaAmountCovered", "advanceCredit", "lateFeeAmount", "daysLate", "dueDate", "paymentDate", "confirmationNumber", "verifiedInBank", "comments", "createdAt"],
      sort: ["quotaNumber:asc"],
    },
  },
};

/**
 * Obtener todos los financiamientos
 */
export async function fetchFinancingsFromStrapi(): Promise<FinancingCard[]> {
  const query = qs.stringify({
    status: "published",
    ...populateConfig,
    sort: ["createdAt:desc"],
    pagination: { pageSize: 100 },
  }, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error fetching financings: ${errorText}`);
  }

  const data = await response.json();
  return (data.data || []).map(normalizeFinancing);
}

/**
 * Obtener un financiamiento por ID
 */
export async function fetchFinancingByIdFromStrapi(documentId: string): Promise<FinancingCard | null> {
  const query = qs.stringify(populateConfig, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings/${documentId}?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    const errorText = await response.text();
    throw new Error(`Error fetching financing: ${errorText}`);
  }

  const data = await response.json();
  return data.data ? normalizeFinancing(data.data) : null;
}

/**
 * Normaliza una relación de Strapi v5 a un ID numérico.
 * Soporta: número directo, string numérico, o formato { connect: [...] }.
 * Los documentId string no numéricos NO son válidos aquí; el frontend debe
 * resolverlos antes de llamar (los selectores ya exponen `id` numérico).
 */
function normalizeRelationId(
  value: number | string | { connect?: (number | string)[] } | undefined
): number | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  if (typeof value === "object" && "connect" in value && Array.isArray(value.connect)) {
    const first = value.connect[0];
    if (typeof first === "number") return first;
    if (typeof first === "string") {
      const num = Number(first);
      return isNaN(num) ? undefined : num;
    }
  }

  return undefined;
}

/**
 * Genera un número de financiamiento único.
 * Formato: FIN-YYYYMMDD-XXXXX (ej: FIN-20260125-12345)
 * Usa timestamp para garantizar unicidad.
 */
function generateFinancingNumber(prefix: string = "FIN"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const timestamp = now.getTime().toString().slice(-5);
  return `${prefix}-${year}${month}${day}-${timestamp}`;
}

/**
 * Crear un nuevo financiamiento
 */
export async function createFinancingInStrapi(payload: FinancingCreatePayload): Promise<FinancingCard> {
  // Normalizar relaciones a IDs numéricos — Strapi v5 requiere id numérico en POST/PUT
  const vehicleId = normalizeRelationId(payload.vehicle);
  const clientId = normalizeRelationId(payload.client);

  if (vehicleId === undefined) {
    throw new Error("El vehículo es requerido y debe proporcionarse como ID numérico.");
  }
  if (clientId === undefined) {
    throw new Error("El cliente es requerido y debe proporcionarse como ID numérico.");
  }

  // Generar financingNumber en el frontend — Strapi v5 valida required ANTES del lifecycle
  // Si no enviamos este campo, Strapi devuelve ValidationError antes de ejecutar beforeCreate
  const financingNumber = generateFinancingNumber("FIN");

  // Calcular valores automáticamente
  const months = payload.financingMonths || 54;
  const totalQuotas = payload.totalQuotas || calculateTotalQuotas(months, payload.paymentFrequency);
  const quotaAmount = calculateQuotaAmount(payload.totalAmount, totalQuotas);
  const nextDueDate = calculateNextDueDate(payload.startDate, payload.paymentFrequency);

  const data = {
    ...payload,
    financingNumber,
    totalQuotas,
    quotaAmount,
    currentBalance: payload.totalAmount,
    nextDueDate,
    status: "activo",
    vehicle: vehicleId,
    client: clientId,
  };

  const query = qs.stringify(populateConfig, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings?${query}`, {
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
    throw new Error(`Error creating financing: ${errorText}`);
  }

  const result = await response.json();
  return normalizeFinancing(result.data);
}

/**
 * Actualizar un financiamiento
 */
export async function updateFinancingInStrapi(
  documentId: string,
  payload: Partial<FinancingCreatePayload> & { 
    status?: FinancingStatus; 
    paidQuotas?: number; 
    currentBalance?: number; 
    totalPaid?: number; 
    partialPaymentCredit?: number;
    totalLateFees?: number;
    nextDueDate?: string;
  }
): Promise<FinancingCard> {
  const query = qs.stringify(populateConfig, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings/${documentId}?${query}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: payload }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error updating financing: ${errorText}`);
  }

  const result = await response.json();
  return normalizeFinancing(result.data);
}

/**
 * Eliminar un financiamiento
 */
export async function deleteFinancingFromStrapi(documentId: string): Promise<void> {
  const response = await fetch(`${STRAPI_BASE_URL}/api/financings/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error deleting financing: ${errorText}`);
  }
}
