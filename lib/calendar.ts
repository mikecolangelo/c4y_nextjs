import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";
import { formatCurrency } from "./format";
import { getCurrentUserJwt } from "./auth";
import type {
  AppointmentCard,
  AppointmentRaw,
  AppointmentRawAttributes,
  AppointmentCreatePayload,
  AppointmentUpdatePayload,
  AppointmentType,
  AppointmentStatus,
  StrapiResponse,
} from "@/validations/types";

// Populate config para obtener relaciones
const populateConfig = {
  populate: {
    client: {
      fields: ["id", "documentId", "fullName", "email", "phone"],
    },
    vehicle: {
      fields: ["id", "documentId", "name", "placa"],
    },
    assignedTo: {
      fields: ["id", "documentId", "displayName", "email"],
    },
    deal: {
      fields: ["id", "documentId", "title"],
    },
    serviceOrder: {
      fields: ["id", "documentId"],
    },
  },
};

const listQueryString = qs.stringify(
  {
    fields: [
      "title",
      "type",
      "status",
      "scheduledAt",
      "durationMinutes",
      "description",
      "price",
      "notes",
      "location",
      "contactPhone",
      "contactEmail",
    ],
    ...populateConfig,
    sort: ["scheduledAt:desc"],
    pagination: {
      pageSize: 100,
    },
  },
  { encodeValuesOnly: true }
);

// ============================================
// Helper Functions
// ============================================

const extractTimeFromDate = (scheduledAt: string): { time: string; period: "AM" | "PM" } => {
  try {
    const date = new Date(scheduledAt);
    // Usar UTC para consistencia con los datos de Strapi
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    const displayHours = hours % 12 || 12;
    const time = `${String(displayHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    return { time, period };
  } catch {
    return { time: "00:00", period: "AM" };
  }
};

const extractDateParts = (scheduledAt: string): { day: number; month: number; year: number } => {
  try {
    const date = new Date(scheduledAt);
    // Usar UTC para consistencia con los datos de Strapi
    return {
      day: date.getUTCDate(),
      month: date.getUTCMonth(),
      year: date.getUTCFullYear(),
    };
  } catch {
    return { day: 1, month: 0, year: 2024 };
  }
};

const formatScheduledAtLabel = (scheduledAt: string): string => {
  try {
    const date = new Date(scheduledAt);
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
};

const getAppointmentTypeLabel = (type: AppointmentType): string => {
  const labels: Record<AppointmentType, string> = {
    venta: "Venta",
    prueba: "Prueba de Conducción",
    mantenimiento: "Mantenimiento",
  };
  return labels[type] || type;
};

const getAppointmentStatusLabel = (status: AppointmentStatus): string => {
  const labels: Record<AppointmentStatus, string> = {
    confirmada: "Confirmada",
    pendiente: "Pendiente",
    cancelada: "Cancelada",
  };
  return labels[status] || status;
};

const extractAttributes = (
  entry: AppointmentRaw
): AppointmentRawAttributes & { id?: number | string; documentId?: string } => {
  if ("attributes" in entry && entry.attributes) {
    return {
      id: entry.id,
      documentId: entry.attributes.documentId ?? entry.documentId,
      ...entry.attributes,
    };
  }

  return {
    id: entry.id,
    documentId: entry.documentId,
    ...(entry as AppointmentRawAttributes),
  };
};

const getClientData = (client: AppointmentRawAttributes["client"]) => {
  if (!client) return undefined;
  if ("data" in client && client.data) {
    const attrs = client.data.attributes;
    return {
      id: client.data.id,
      documentId: client.data.documentId,
      fullName: attrs?.fullName,
      email: attrs?.email,
      phone: attrs?.phone,
    };
  }
  return client as {
    id?: number;
    documentId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  };
};

const getVehicleData = (vehicle: AppointmentRawAttributes["vehicle"]) => {
  if (!vehicle) return undefined;
  if ("data" in vehicle && vehicle.data) {
    const attrs = vehicle.data.attributes;
    return {
      id: vehicle.data.id,
      documentId: vehicle.data.documentId,
      name: attrs?.name,
      placa: attrs?.placa,
    };
  }
  return vehicle as {
    id?: number;
    documentId?: string;
    name?: string;
    placa?: string;
  };
};

const getDealData = (deal: AppointmentRawAttributes["deal"]) => {
  if (!deal) return undefined;
  if ("data" in deal && deal.data) {
    const attrs = deal.data.attributes;
    return {
      id: deal.data.id,
      documentId: deal.data.documentId,
      title: attrs?.title,
    };
  }
  return deal as {
    id?: number;
    documentId?: string;
    title?: string;
  };
};

const getAssignedToData = (assignedTo: AppointmentRawAttributes["assignedTo"]) => {
  if (!assignedTo) return undefined;
  if ("data" in assignedTo && assignedTo.data) {
    const attrs = assignedTo.data.attributes;
    return {
      id: assignedTo.data.id,
      documentId: assignedTo.data.documentId,
      displayName: attrs?.displayName,
      email: attrs?.email,
    };
  }
  return assignedTo as {
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
  };
};

const getServiceOrderData = (serviceOrder: AppointmentRawAttributes["serviceOrder"]) => {
  if (!serviceOrder) return undefined;
  if ("data" in serviceOrder && serviceOrder.data) {
    return {
      id: serviceOrder.data.id,
      documentId: serviceOrder.data.documentId,
    };
  }
  return serviceOrder as {
    id?: number;
    documentId?: string;
  };
};

const normalizeAppointment = (entry: AppointmentRaw): AppointmentCard | null => {
  const attributes = extractAttributes(entry);
  if (!attributes.type || !attributes.scheduledAt) {
    return null;
  }

  const price = attributes.price ? Number(attributes.price) || 0 : undefined;
  const idSource = attributes.id ?? attributes.documentId ?? "";
  const documentId = attributes.documentId ?? String(idSource);

  const { time, period } = extractTimeFromDate(attributes.scheduledAt);
  const { day, month, year } = extractDateParts(attributes.scheduledAt);

  const clientData = getClientData(attributes.client);
  const vehicleData = getVehicleData(attributes.vehicle);
  const dealData = getDealData(attributes.deal);
  const assignedToData = getAssignedToData(attributes.assignedTo);
  const serviceOrderData = getServiceOrderData(attributes.serviceOrder);

  return {
    id: String(idSource),
    documentId: String(documentId),
    title: attributes.title,
    type: attributes.type,
    typeLabel: getAppointmentTypeLabel(attributes.type),
    status: attributes.status || "pendiente",
    statusLabel: getAppointmentStatusLabel(attributes.status || "pendiente"),
    scheduledAt: attributes.scheduledAt,
    scheduledAtLabel: formatScheduledAtLabel(attributes.scheduledAt),
    time,
    period,
    day,
    month,
    year,
    durationMinutes: attributes.durationMinutes,
    description: attributes.description,
    price,
    priceLabel: price !== undefined ? formatCurrency(price) : undefined,
    notes: attributes.notes,
    location: attributes.location,
    contactPhone: attributes.contactPhone || clientData?.phone,
    contactEmail: attributes.contactEmail || clientData?.email,
    clientName: clientData?.fullName,
    clientEmail: clientData?.email,
    clientPhone: clientData?.phone,
    clientId: clientData?.id ? String(clientData.id) : undefined,
    clientDocumentId: clientData?.documentId,
    vehicleName: vehicleData?.name,
    vehiclePlaca: vehicleData?.placa,
    vehicleId: vehicleData?.id ? String(vehicleData.id) : undefined,
    vehicleDocumentId: vehicleData?.documentId,
    dealTitle: dealData?.title,
    dealId: dealData?.id ? String(dealData.id) : undefined,
    dealDocumentId: dealData?.documentId,
    assignedToName: assignedToData?.displayName,
    assignedToEmail: assignedToData?.email,
    assignedToId: assignedToData?.id ? String(assignedToData.id) : undefined,
    assignedToDocumentId: assignedToData?.documentId,
    serviceOrderId: serviceOrderData?.id ? String(serviceOrderData.id) : undefined,
    serviceOrderDocumentId: serviceOrderData?.documentId,
  };
};

// ============================================
// CRUD Functions
// ============================================

export async function fetchAppointmentsFromStrapi(): Promise<AppointmentCard[]> {
  const url = `${STRAPI_BASE_URL}/api/appointments?${listQueryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "force-cache",
    next: { revalidate: 300, tags: ["calendar"] },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Appointments request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(
      `Strapi Appointments request failed with status ${response.status}: ${errorText}`
    );
  }

  const payload = (await response.json()) as StrapiResponse<AppointmentRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeAppointment(item))
    .filter((appointment): appointment is AppointmentCard => Boolean(appointment));
}

const isNumericId = (value: string | number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && String(parsed) === String(value);
};

const buildAppointmentDetailQuery = (id: string | number) => {
  const normalizedId = String(id);
  const filters = isNumericId(id)
    ? {
        $or: [{ id: { $eq: Number(id) } }, { documentId: { $eq: normalizedId } }],
      }
    : {
        documentId: { $eq: normalizedId },
      };

  return qs.stringify(
    {
      filters,
      fields: [
        "title",
        "type",
        "status",
        "scheduledAt",
        "durationMinutes",
        "description",
        "price",
        "notes",
        "location",
        "contactPhone",
        "contactEmail",
      ],
      ...populateConfig,
      pagination: { pageSize: 1 },
    },
    { encodeValuesOnly: true }
  );
};

export async function fetchAppointmentByIdFromStrapi(
  id: string | number
): Promise<AppointmentCard | null> {
  const detailQuery = buildAppointmentDetailQuery(id);
  const response = await fetch(`${STRAPI_BASE_URL}/api/appointments?${detailQuery}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "force-cache",
    next: { revalidate: 300, tags: ["calendar"] },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Strapi Appointment details request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StrapiResponse<AppointmentRaw[]>;
  const entry = payload?.data?.[0];
  return entry ? normalizeAppointment(entry) : null;
}

const resolveAppointmentDocumentId = async (id: string | number) => {
  if (!isNumericId(id)) {
    return String(id);
  }

  const appointment = await fetchAppointmentByIdFromStrapi(id);
  return appointment?.documentId ?? null;
};

export async function createAppointmentInStrapi(
  data: AppointmentCreatePayload
): Promise<AppointmentCard> {
  const populateQueryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const url = `${STRAPI_BASE_URL}/api/appointments?${populateQueryString}`;
  const jwt = await getCurrentUserJwt();
  const response = await fetch(url, {
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
    throw new Error(
      `Strapi Appointment create failed with status ${response.status}: ${errorText}`
    );
  }

  const payload = (await response.json()) as StrapiResponse<AppointmentRaw>;
  const appointment = payload?.data ? normalizeAppointment(payload.data) : null;

  if (!appointment) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return appointment;
}

export async function updateAppointmentInStrapi(
  id: string | number,
  data: AppointmentUpdatePayload
): Promise<AppointmentCard> {
  const documentId = await resolveAppointmentDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar la cita para actualizarla.");
  }

  const populateQueryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const url = `${STRAPI_BASE_URL}/api/appointments/${documentId}?${populateQueryString}`;
  const jwt = await getCurrentUserJwt();
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = `Error al actualizar la cita (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error?.message || errorData?.error || errorMessage;
    } catch {
      // Si falla, usar el mensaje por defecto
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as StrapiResponse<AppointmentRaw>;
  const appointment = payload?.data ? normalizeAppointment(payload.data) : null;

  if (!appointment) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return appointment;
}

export async function deleteAppointmentInStrapi(id: string | number): Promise<void> {
  const documentId = await resolveAppointmentDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar la cita para eliminarla.");
  }

  const jwt = await getCurrentUserJwt();
  const response = await fetch(`${STRAPI_BASE_URL}/api/appointments/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt || STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strapi Appointment delete failed with status ${response.status}`);
  }
}

// Export helper functions for use in components
export { getAppointmentTypeLabel, getAppointmentStatusLabel };
