/**
 * Cálculos puros del módulo de Financiamiento (cuotas, mora, pagos).
 *
 * Sin dependencias de Strapi/next/headers: seguro de importar tanto desde
 * Server Components/Route Handlers como desde Client Components. Las
 * funciones que sí necesitan hablar con Strapi (fetch/create/update/delete)
 * viven en `./financing`, que re-exporta todo lo de este archivo para no
 * romper a los importadores existentes.
 */

export type PaymentFrequency = "semanal" | "quincenal" | "mensual";

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
): {
  quotasCovered: number;
  advanceCredit: number;
  totalApplied: number;
  isPartialPayment: boolean;
} {
  // Total disponible = pago actual + crédito acumulado de pagos anteriores
  const totalAvailable = paymentAmount + partialCredit;

  // Tolerancia para errores de punto flotante (0.01 = 1 centavo)
  const EPSILON = 0.01;

  // Cuotas completas cubiertas con el total disponible
  // Usamos una pequeña tolerancia para manejar errores de precisión de punto flotante
  const rawQuotas = totalAvailable / quotaAmount;
  const quotasCovered = Math.floor(rawQuotas + EPSILON);

  // Crédito restante después de cubrir cuotas completas (abono hacia la siguiente cuota)
  const remainder = totalAvailable - quotasCovered * quotaAmount;
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
