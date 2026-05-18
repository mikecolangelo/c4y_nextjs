import { STRAPI_BASE_URL } from "@/lib/config";

export interface EmailSmtpConfig {
  host: string;
  port: number;
  user: string;
  from: string;
  secure: boolean;
  hasCustomConfig: boolean;
  hasPass: boolean;
}

export interface EmailTemplate {
  key: string;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
}

export interface EmailConfigResponse {
  data: {
    smtp: EmailSmtpConfig;
    templates: EmailTemplate[];
  };
}

/**
 * Variables disponibles para templates de financiamiento.
 */
export const FINANCING_EMAIL_VARIABLES = [
  { key: "clientName", label: "Nombre del cliente", example: "Juan Pérez" },
  { key: "clientEmail", label: "Email del cliente", example: "juan@example.com" },
  { key: "clientPhone", label: "Teléfono del cliente", example: "+507 6000-0000" },
  { key: "clientCedula", label: "Cédula del cliente", example: "8-123-456" },
  { key: "clientAddress", label: "Dirección del cliente", example: "Ciudad de Panamá" },
  { key: "financingNumber", label: "Número de financiamiento", example: "FIN-2024-001" },
  { key: "totalAmount", label: "Monto total", example: "15000.00" },
  { key: "currentBalance", label: "Saldo actual", example: "8500.00" },
  { key: "totalPaid", label: "Total pagado", example: "6500.00" },
  { key: "quotaAmount", label: "Monto de cuota", example: "277.78" },
  { key: "paidQuotas", label: "Cuotas pagadas", example: "24" },
  { key: "totalQuotas", label: "Total de cuotas", example: "54" },
  { key: "status", label: "Estado", example: "activo" },
  { key: "startDate", label: "Fecha de inicio", example: "2024-01-15" },
  { key: "nextDueDate", label: "Próxima fecha de vencimiento", example: "2024-02-15" },
  { key: "paymentFrequency", label: "Frecuencia de pago", example: "semanal" },
  { key: "lateQuotasCount", label: "Cuotas en mora", example: "0" },
  { key: "totalLateFees", label: "Recargos acumulados", example: "0.00" },
  { key: "vehicleInfo", label: "Info del vehículo", example: "Toyota RAV4 2022" },
  { key: "vehiclePlate", label: "Placa del vehículo", example: "AB12345" },
  { key: "vehicleVin", label: "VIN del vehículo", example: "JTMBK32V795123456" },
  { key: "companyName", label: "Nombre de la empresa", example: "Car4youpanama" },
  { key: "currentDate", label: "Fecha actual", example: "15 de enero de 2024" },
];

/**
 * Templates por defecto para financiamiento.
 * Nota: se usa String.raw para evitar que TypeScript interprete ${...} como interpolación.
 */
export const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    key: "financing-created",
    name: "Financiamiento Creado",
    subject: "Bienvenido a Car4youpanama — Financiamiento {{financingNumber}}",
    body: String.raw`<p>Hola {{clientName}},</p>
<p>Tu financiamiento <strong>{{financingNumber}}</strong> ha sido creado exitosamente.</p>
<ul>
  <li>Monto total: &#36;{{totalAmount}}</li>
  <li>Cuota: &#36;{{quotaAmount}}</li>
  <li>Frecuencia: {{paymentFrequency}}</li>
  <li>Total de cuotas: {{totalQuotas}}</li>
</ul>
<p>Gracias por confiar en nosotros.</p>`,
    enabled: true,
  },
  {
    key: "payment-reminder",
    name: "Recordatorio de Pago",
    subject: "Recordatorio de pago — Financiamiento {{financingNumber}}",
    body: String.raw`<p>Hola {{clientName}},</p>
<p>Te recordamos que tu próxima cuota del financiamiento <strong>{{financingNumber}}</strong> vence el <strong>{{nextDueDate}}</strong>.</p>
<ul>
  <li>Cuota: &#36;{{quotaAmount}}</li>
  <li>Saldo actual: &#36;{{currentBalance}}</li>
</ul>
<p>Por favor realiza tu pago a tiempo para evitar recargos.</p>`,
    enabled: true,
  },
  {
    key: "payment-received",
    name: "Pago Recibido",
    subject: "Pago recibido — Financiamiento {{financingNumber}}",
    body: String.raw`<p>Hola {{clientName}},</p>
<p>Hemos recibido tu pago correspondiente al financiamiento <strong>{{financingNumber}}</strong>.</p>
<ul>
  <li>Cuotas pagadas: {{paidQuotas}} de {{totalQuotas}}</li>
  <li>Saldo actual: &#36;{{currentBalance}}</li>
</ul>
<p>Gracias por tu puntualidad.</p>`,
    enabled: true,
  },
  {
    key: "quota-overdue",
    name: "Cuota Vencida",
    subject: "Cuota vencida — Financiamiento {{financingNumber}}",
    body: String.raw`<p>Hola {{clientName}},</p>
<p>Tu financiamiento <strong>{{financingNumber}}</strong> tiene cuotas vencidas.</p>
<ul>
  <li>Cuotas en mora: {{lateQuotasCount}}</li>
  <li>Recargos acumulados: &#36;{{totalLateFees}}</li>
  <li>Saldo actual: &#36;{{currentBalance}}</li>
</ul>
<p>Contacta con nosotros para regularizar tu situación.</p>`,
    enabled: true,
  },
  {
    key: "account-statement",
    name: "Estado de Cuenta",
    subject: "Estado de cuenta — Financiamiento {{financingNumber}}",
    body: String.raw`<p>Hola {{clientName}},</p>
<p>A continuación el resumen de tu financiamiento <strong>{{financingNumber}}</strong> a la fecha {{currentDate}}:</p>
<ul>
  <li>Monto total: &#36;{{totalAmount}}</li>
  <li>Total pagado: &#36;{{totalPaid}}</li>
  <li>Saldo actual: &#36;{{currentBalance}}</li>
  <li>Cuotas pagadas: {{paidQuotas}} de {{totalQuotas}}</li>
</ul>
<p>Gracias por preferir Car4youpanama.</p>`,
    enabled: true,
  },
];

/**
 * Obtiene la configuración de email desde el backend.
 */
export async function fetchEmailConfig(): Promise<EmailConfigResponse> {
  const response = await fetch("/api/billing/email-config", {
    cache: "no-store",
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Error obteniendo configuración de email");
  }

  return response.json();
}

/**
 * Guarda la configuración de email en el backend.
 */
export async function updateEmailConfig(config: {
  smtp: Partial<EmailSmtpConfig> & { pass?: string };
  templates: EmailTemplate[];
}): Promise<{ success: boolean; message: string }> {
  const response = await fetch("/api/billing/email-config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Error guardando configuración de email");
  }

  return response.json();
}

/**
 * Envía un email de prueba.
 */
export async function sendTestEmail(payload: {
  to?: string;
  subject?: string;
  body?: string;
}): Promise<{ success: boolean; message: string }> {
  const response = await fetch("/api/billing/send-test-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Error enviando email de prueba");
  }

  return response.json();
}

/**
 * Envía un email manual desde un financiamiento.
 */
export async function sendFinancingEmail(
  financingId: string,
  payload: {
    templateKey?: string;
    to?: string;
    customSubject?: string;
    customBody?: string;
  }
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/financing/${financingId}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || "Error enviando email");
  }

  return response.json();
}

/**
 * Renderiza un template reemplazando variables {{key}}.
 */
export function renderEmailTemplate(
  template: string,
  variables: Record<string, string>
): string {
  if (!template) return "";
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? String(variables[key]) : match;
  });
}
