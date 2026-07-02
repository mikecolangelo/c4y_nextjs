/**
 * Librería de funciones para el módulo de Financiamiento
 * Maneja la comunicación con Strapi y cálculos de negocio
 */

import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { formatCurrency } from "./format";

// Import dinámico: este archivo también lo importan componentes cliente (solo
// por sus tipos/normalizadores), y `lib/auth.ts` usa `next/headers`, que rompe
// el bundle de cliente si se importa de forma estática.
async function getJwtForRequest(): Promise<string | null> {
  const { getCurrentUserJwt } = await import("./auth");
  return getCurrentUserJwt();
}

// ============================================================================
// TIPOS
// ============================================================================

import {
  calculateTotalQuotas,
  calculateQuotaAmount,
  getDaysInterval,
  calculateNextDueDate,
  calculateLateFee,
  calculateDaysLate,
  processPayment,
  calculateFinancingSummary,
  type PaymentFrequency,
} from "./financing-calculations";

export type { PaymentFrequency };
export {
  calculateTotalQuotas,
  calculateQuotaAmount,
  getDaysInterval,
  calculateNextDueDate,
  calculateLateFee,
  calculateDaysLate,
  processPayment,
  calculateFinancingSummary,
};

export type FinancingStatus = "activo" | "inactivo" | "en_mora" | "completado";
export type PaymentStatus =
  | "pagado"
  | "pendiente"
  | "adelanto"
  | "retrasado"
  | "abonado"
  | "cubierta";

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
  const progressPercentage =
    raw.totalQuotas > 0 ? Math.round((raw.paidQuotas / raw.totalQuotas) * 100) : 0;

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
      fields: [
        "id",
        "documentId",
        "receiptNumber",
        "amount",
        "currency",
        "status",
        "quotaNumber",
        "quotasCovered",
        "quotaAmountCovered",
        "advanceCredit",
        "lateFeeAmount",
        "daysLate",
        "dueDate",
        "paymentDate",
        "confirmationNumber",
        "verifiedInBank",
        "comments",
        "createdAt",
      ],
      sort: ["quotaNumber:asc"],
    },
  },
};

/**
 * Obtener todos los financiamientos
 */
export async function fetchFinancingsFromStrapi(): Promise<FinancingCard[]> {
  const query = qs.stringify(
    {
      status: "published",
      ...populateConfig,
      sort: ["createdAt:desc"],
      pagination: { pageSize: 100 },
    },
    { encodeValuesOnly: true }
  );

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "force-cache",
    next: { revalidate: 120, tags: ["financing"] },
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
export async function fetchFinancingByIdFromStrapi(
  documentId: string
): Promise<FinancingCard | null> {
  const query = qs.stringify(populateConfig, { encodeValuesOnly: true });

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings/${documentId}?${query}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "force-cache",
    next: { revalidate: 120, tags: ["financing"] },
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
export async function createFinancingInStrapi(
  payload: FinancingCreatePayload
): Promise<FinancingCard> {
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
  const jwt = await getJwtForRequest();

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings?${query}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
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
  const jwt = await getJwtForRequest();

  const response = await fetch(`${STRAPI_BASE_URL}/api/financings/${documentId}?${query}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
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
  const jwt = await getJwtForRequest();
  const response = await fetch(`${STRAPI_BASE_URL}/api/financings/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error deleting financing: ${errorText}`);
  }
}
