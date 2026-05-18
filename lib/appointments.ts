import qs from "qs";
import { STRAPI_BASE_URL } from "./config";
import { formatCurrency } from "./format";
import type {
  AppointmentV2,
  AppointmentCreatePayload,
  AppointmentUpdatePayload,
  AppointmentActivityItem,
  StrapiResponse,
} from "@/validations/types";

const populateConfig = {
  populate: {
    vehicle: {
      fields: ["id", "documentId", "name", "placa", "brand", "model"],
    },
    service: {
      fields: ["id", "documentId", "name", "price", "coverage"],
    },
    assignedTo: {
      fields: ["id", "documentId", "displayName", "email"],
    },
    parentAppointment: {
      fields: ["id", "documentId"],
    },
    childAppointments: {
      fields: ["id", "documentId"],
    },
    owner: {
      fields: ["id", "documentId", "email", "username"],
    },
    serviceOrder: {
      fields: ["id", "documentId", "code", "status"],
    },
  },
};

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function extractTimeFromDate(scheduledAt: string): { time: string; period: "AM" | "PM" } {
  try {
    const date = new Date(scheduledAt);
    if (!isValidDate(date)) return { time: "00:00", period: "AM" };
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const time = `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    return { time, period };
  } catch {
    return { time: "00:00", period: "AM" };
  }
}

function extractDateParts(scheduledAt: string): { day: number; month: number; year: number } {
  try {
    const date = new Date(scheduledAt);
    if (!isValidDate(date)) return { day: 1, month: 1, year: 2024 };
    return {
      day: date.getDate(),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  } catch {
    return { day: 1, month: 1, year: 2024 };
  }
}

function formatScheduledAtLabel(scheduledAt: string): string {
  try {
    const date = new Date(scheduledAt);
    if (!isValidDate(date)) return "";
    return date.toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function getAppointmentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    venta: "Venta",
    prueba: "Prueba de Conducción",
    mantenimiento: "Mantenimiento",
    recordatorio: "Recordatorio",
  };
  return labels[type] || type;
}

function getAppointmentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmada: "Confirmada",
    pendiente: "Pendiente",
    cancelada: "Cancelada",
  };
  return labels[status] || status;
}

function normalizeAppointment(entry: any): AppointmentV2 | null {
  if (!entry) return null;
  const attrs = entry.attributes || entry;
  const id = entry.id ?? entry.documentId;
  const documentId = entry.documentId ?? String(id);
  const numericId = entry.id ?? parseInt(documentId, 10);

  if (!attrs.type || !attrs.scheduledAt) return null;

  const price = attrs.price ? Number(attrs.price) || 0 : undefined;
  const { time, period } = extractTimeFromDate(attrs.scheduledAt);
  const { day, month, year } = extractDateParts(attrs.scheduledAt);

  const vehicleData = attrs.vehicle?.data?.attributes
    ? { ...attrs.vehicle.data.attributes, id: attrs.vehicle.data.id, documentId: attrs.vehicle.data.documentId }
    : attrs.vehicle;

  const serviceData = attrs.service?.data?.attributes
    ? { ...attrs.service.data.attributes, id: attrs.service.data.id, documentId: attrs.service.data.documentId }
    : attrs.service;

  const assignedToData = attrs.assignedTo?.data?.attributes
    ? { ...attrs.assignedTo.data.attributes, id: attrs.assignedTo.data.id, documentId: attrs.assignedTo.data.documentId }
    : attrs.assignedTo;

  const parentData = attrs.parentAppointment?.data
    ? { id: attrs.parentAppointment.data.id, documentId: attrs.parentAppointment.data.documentId }
    : attrs.parentAppointment;

  const childrenData = Array.isArray(attrs.childAppointments?.data)
    ? attrs.childAppointments.data.map((c: any) => ({ id: c.id, documentId: c.documentId }))
    : Array.isArray(attrs.childAppointments)
    ? attrs.childAppointments.map((c: any) => ({ id: c.id, documentId: c.documentId }))
    : undefined;

  return {
    id: String(id),
    numericId: typeof numericId === "number" ? numericId : parseInt(String(numericId), 10),
    documentId: String(documentId),
    title: attrs.title,
    type: attrs.type,
    status: attrs.status || "pendiente",
    scheduledAt: attrs.scheduledAt,
    scheduledAtLabel: formatScheduledAtLabel(attrs.scheduledAt),
    isAllDay: attrs.isAllDay ?? false,
    frequency: attrs.frequency || "unica",
    durationMinutes: attrs.durationMinutes,
    description: attrs.description,
    price,
    priceLabel: price !== undefined ? formatCurrency(price) : undefined,
    notes: attrs.notes,
    location: attrs.location,
    contactPhone: attrs.contactPhone,
    contactEmail: attrs.contactEmail,
    clientName: attrs.clientName,
    clientPhone: attrs.clientPhone,
    clientEmail: attrs.clientEmail,
    time,
    period,
    day,
    month,
    year,
    vehicle: vehicleData,
    service: serviceData,
    assignedTo: assignedToData,
    parentAppointment: parentData,
    childAppointments: childrenData,
    createdAt: attrs.createdAt,
    updatedAt: attrs.updatedAt,
  };
}

function normalizeActivity(entry: any): AppointmentActivityItem | null {
  if (!entry) return null;
  const attrs = entry.attributes || entry;
  const id = entry.id ?? entry.documentId;
  const documentId = entry.documentId ?? String(id);

  if (!attrs.type || !attrs.scheduledAt) return null;

  const vehicleName = attrs.vehicle?.data?.attributes?.name || attrs.vehicle?.name;
  const authorName = attrs.assignedTo?.data?.attributes?.displayName || attrs.assignedTo?.displayName || attrs.owner?.data?.attributes?.username || attrs.owner?.username;

  return {
    id: String(id),
    documentId: String(documentId),
    title: attrs.title,
    type: attrs.type,
    typeLabel: getAppointmentTypeLabel(attrs.type),
    status: attrs.status || "pendiente",
    statusLabel: getAppointmentStatusLabel(attrs.status || "pendiente"),
    scheduledAt: attrs.scheduledAt,
    authorName,
    vehicleName,
    createdAt: attrs.createdAt,
    updatedAt: attrs.updatedAt,
  };
}

function buildAuthHeaders(jwt: string) {
  return {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };
}

export type { AppointmentCreatePayload, AppointmentUpdatePayload };

export interface AppointmentListFilters {
  type?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function fetchAppointments(jwt: string, filters?: AppointmentListFilters): Promise<AppointmentV2[]> {
  const query: any = {
    ...populateConfig,
    sort: ["scheduledAt:desc"],
    pagination: { pageSize: 500 },
  };

  const strapiFilters: any[] = [];

  if (filters?.type && filters.type !== "all" && filters.type !== "recordatorios") {
    strapiFilters.push({ type: { $eq: filters.type } });
  }

  if (filters?.from) {
    strapiFilters.push({ scheduledAt: { $gte: `${filters.from}T00:00:00.000Z` } });
  }

  if (filters?.to) {
    strapiFilters.push({ scheduledAt: { $lte: `${filters.to}T23:59:59.999Z` } });
  }

  if (filters?.search) {
    const search = filters.search;
    strapiFilters.push({
      $or: [
        { title: { $containsi: search } },
        { description: { $containsi: search } },
        { location: { $containsi: search } },
        { clientName: { $containsi: search } },
        { notes: { $containsi: search } },
      ],
    });
  }

  if (strapiFilters.length > 0) {
    query.filters = strapiFilters.length === 1 ? strapiFilters[0] : { $and: strapiFilters };
  }

  const queryString = qs.stringify(query, { encodeValuesOnly: true });
  const res = await fetch(`${STRAPI_BASE_URL}/api/appointments?${queryString}`, {
    headers: buildAuthHeaders(jwt),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error fetching appointments (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as StrapiResponse<any[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items.map(normalizeAppointment).filter((a): a is AppointmentV2 => Boolean(a));
}

export async function fetchAppointmentById(jwt: string, id: string): Promise<AppointmentV2 | null> {
  const queryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const res = await fetch(`${STRAPI_BASE_URL}/api/appointments/${id}?${queryString}`, {
    headers: buildAuthHeaders(jwt),
    cache: "no-store",
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error fetching appointment (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as StrapiResponse<any>;
  return payload?.data ? normalizeAppointment(payload.data) : null;
}

export async function createAppointment(jwt: string, data: AppointmentCreatePayload): Promise<AppointmentV2> {
  const queryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const res = await fetch(`${STRAPI_BASE_URL}/api/appointments?${queryString}`, {
    method: "POST",
    headers: buildAuthHeaders(jwt),
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error creating appointment (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as StrapiResponse<any>;
  const appointment = payload?.data ? normalizeAppointment(payload.data) : null;
  if (!appointment) throw new Error("Failed to normalize created appointment");
  return appointment;
}

export async function updateAppointment(jwt: string, id: string, data: AppointmentUpdatePayload): Promise<AppointmentV2> {
  const queryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const res = await fetch(`${STRAPI_BASE_URL}/api/appointments/${id}?${queryString}`, {
    method: "PUT",
    headers: buildAuthHeaders(jwt),
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error updating appointment (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as StrapiResponse<any>;
  const appointment = payload?.data ? normalizeAppointment(payload.data) : null;
  if (!appointment) throw new Error("Failed to normalize updated appointment");
  return appointment;
}

export async function deleteAppointment(jwt: string, id: string): Promise<void> {
  const res = await fetch(`${STRAPI_BASE_URL}/api/appointments/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(jwt),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error deleting appointment (${res.status}): ${text}`);
  }
}

export async function fetchAppointmentActivity(jwt: string, limit = 20): Promise<AppointmentActivityItem[]> {
  const query = {
    fields: ["title", "type", "status", "scheduledAt", "createdAt", "updatedAt"],
    populate: {
      vehicle: { fields: ["name"] },
      assignedTo: { fields: ["displayName"] },
      owner: { fields: ["username"] },
    },
    sort: ["updatedAt:desc"],
    pagination: { pageSize: limit },
  };

  const queryString = qs.stringify(query, { encodeValuesOnly: true });
  const res = await fetch(`${STRAPI_BASE_URL}/api/appointments?${queryString}`, {
    headers: buildAuthHeaders(jwt),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error fetching activity (${res.status}): ${text}`);
  }

  const payload = (await res.json()) as StrapiResponse<any[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items.map(normalizeActivity).filter((a): a is AppointmentActivityItem => Boolean(a));
}

export { getAppointmentTypeLabel, getAppointmentStatusLabel };
