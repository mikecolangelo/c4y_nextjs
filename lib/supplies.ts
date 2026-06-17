import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";

function buildAuthHeader(jwt?: string): string {
  return jwt ? `Bearer ${jwt}` : `Bearer ${STRAPI_API_TOKEN}`;
}

import type {
  SupplyItemCard,
  SupplyItemRaw,
  SupplyItemRawAttributes,
  SupplyItemCreatePayload,
  SupplyItemUpdatePayload,
  SupplyRequestCard,
  SupplyRequestRaw,
  SupplyRequestRawAttributes,
  SupplyRequestCreatePayload,
  SupplyRequestUpdatePayload,
  SupplyRequestApprovePayload,
  SupplyRequestRejectPayload,
  SupplyType,
  SupplyUnit,
  SupplyIcon,
} from "@/validations/supply-types";
import { SUPPLY_TYPE_LABELS, SUPPLY_UNIT_LABELS, SUPPLY_STATUS_LABELS } from "@/validations/supply-types";
import type { StrapiResponse } from "@/validations/types";

// ============================================
// Supply Items (Insumos)
// ============================================

const getSupplyStockStatus = (stock: number, minStock?: number): "high" | "medium" | "low" => {
  if (minStock === undefined || minStock === null) {
    return "high";
  }
  if (stock < minStock) {
    return "low";
  }
  if (stock < minStock * 2) {
    return "medium";
  }
  return "high";
};

const extractSupplyItemAttributes = (
  entry: SupplyItemRaw
): SupplyItemRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as SupplyItemRawAttributes),
  };
};

const normalizeSupplyItem = (entry: SupplyItemRaw): SupplyItemCard | null => {
  const attributes = extractSupplyItemAttributes(entry);
  if (!attributes.name) {
    return null;
  }

  const stock = Number(attributes.stock ?? 0) || 0;
  const minStock = attributes.minStock !== undefined ? Number(attributes.minStock) : undefined;
  const idSource = attributes.id ?? attributes.documentId ?? attributes.name;
  const documentId = attributes.documentId ?? String(idSource);

  return {
    id: String(idSource),
    documentId: String(documentId),
    name: attributes.name,
    type: attributes.type,
    typeLabel: SUPPLY_TYPE_LABELS[attributes.type],
    stock,
    unit: attributes.unit,
    unitLabel: SUPPLY_UNIT_LABELS[attributes.unit],
    minStock: minStock ?? undefined,
    description: attributes.description ?? undefined,
    isActive: attributes.isActive ?? true,
    icon: attributes.icon || "box",
    stockStatus: getSupplyStockStatus(stock, minStock),
  };
};

export async function fetchSupplyItemsFromStrapi(jwt?: string): Promise<SupplyItemCard[]> {
  const queryString = qs.stringify(
    {
      fields: ["name", "type", "stock", "unit", "minStock", "description", "isActive", "icon"],
      filters: {
        isActive: {
          $eq: true
        }
      },
      sort: ["name:asc"],
      pagination: {
        pageSize: 100,
      },
    },
    { encodeValuesOnly: true }
  );

  const url = `${STRAPI_BASE_URL}/api/supply-items?${queryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(jwt),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Supply Items request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`Strapi Supply Items request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyItemRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeSupplyItem(item))
    .filter((item): item is SupplyItemCard => Boolean(item));
}

export async function createSupplyItemInStrapi(
  data: SupplyItemCreatePayload,
  jwt?: string
): Promise<SupplyItemCard> {
  const url = `${STRAPI_BASE_URL}/api/supply-items`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(jwt),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Supply Item create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyItemRaw>;
  const item = payload?.data ? normalizeSupplyItem(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

// ============================================
// Supply Requests (Solicitudes)
// ============================================

const extractSupplyRequestAttributes = (
  entry: SupplyRequestRaw
): SupplyRequestRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as SupplyRequestRawAttributes),
  };
};

const formatDateLabel = (dateString?: string): string => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString('es-ES', { 
    day: 'numeric', 
    month: 'long', 
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const normalizeSupplyRequest = (entry: SupplyRequestRaw, currentUserRole?: string): SupplyRequestCard | null => {
  const attributes = extractSupplyRequestAttributes(entry);
  if (!attributes.type || !attributes.requestedAt) {
    return null;
  }

  const idSource = attributes.id ?? attributes.documentId;
  const documentId = attributes.documentId ?? String(idSource);

  // Extraer datos del solicitante
  let requesterName: string | undefined;
  let requesterEmail: string | undefined;
  let requesterId: string | undefined;
  let requesterDocumentId: string | undefined;

  if (attributes.requester) {
    if ("data" in attributes.requester && attributes.requester.data?.attributes) {
      requesterName = attributes.requester.data.attributes.displayName;
      requesterEmail = attributes.requester.data.attributes.email;
      requesterId = String(attributes.requester.data.id);
      requesterDocumentId = attributes.requester.data.documentId;
    } else if ("displayName" in attributes.requester) {
      requesterName = attributes.requester.displayName;
      requesterEmail = attributes.requester.email;
      requesterId = String(attributes.requester.id);
      requesterDocumentId = attributes.requester.documentId;
    }
  }

  // Extraer datos del aprobador
  let approvedByName: string | undefined;
  let approvedByEmail: string | undefined;
  let approvedById: string | undefined;
  let approvedByDocumentId: string | undefined;

  if (attributes.approvedBy) {
    if ("data" in attributes.approvedBy && attributes.approvedBy.data?.attributes) {
      approvedByName = attributes.approvedBy.data.attributes.displayName;
      approvedByEmail = attributes.approvedBy.data.attributes.email;
      approvedById = String(attributes.approvedBy.data.id);
      approvedByDocumentId = attributes.approvedBy.data.documentId;
    } else if ("displayName" in attributes.approvedBy) {
      approvedByName = attributes.approvedBy.displayName;
      approvedByEmail = attributes.approvedBy.email;
      approvedById = String(attributes.approvedBy.id);
      approvedByDocumentId = attributes.approvedBy.documentId;
    }
  }

  // Extraer datos del insumo
  let supplyItemName: string | undefined;
  let supplyItemId: string | undefined;
  let supplyItemDocumentId: string | undefined;
  let supplyItemStock: number | undefined;

  if (attributes.supplyItem) {
    if ("data" in attributes.supplyItem && attributes.supplyItem.data?.attributes) {
      supplyItemName = attributes.supplyItem.data.attributes.name;
      supplyItemId = String(attributes.supplyItem.data.id);
      supplyItemDocumentId = attributes.supplyItem.data.documentId;
      supplyItemStock = attributes.supplyItem.data.attributes.stock;
    } else if ("name" in attributes.supplyItem) {
      supplyItemName = attributes.supplyItem.name;
      supplyItemId = String(attributes.supplyItem.id);
      supplyItemDocumentId = attributes.supplyItem.documentId;
      supplyItemStock = attributes.supplyItem.stock;
    }
  }

  // Determinar si puede aprobar o entregar (solo admin)
  const canApprove = attributes.status === "pendiente" && ["admin"].includes(currentUserRole || "");
  const canDeliver = attributes.status === "aprobado" && ["admin"].includes(currentUserRole || "");

  return {
    id: String(idSource),
    documentId: String(documentId),
    requestNumber: attributes.requestNumber,
    type: attributes.type,
    typeLabel: SUPPLY_TYPE_LABELS[attributes.type],
    quantity: attributes.quantity,
    unit: attributes.unit,
    unitLabel: SUPPLY_UNIT_LABELS[attributes.unit],
    justification: attributes.justification,
    status: attributes.status,
    statusLabel: SUPPLY_STATUS_LABELS[attributes.status],
    notes: attributes.notes,
    requestedAt: attributes.requestedAt,
    requestedAtLabel: formatDateLabel(attributes.requestedAt),
    approvedAt: attributes.approvedAt,
    approvedAtLabel: formatDateLabel(attributes.approvedAt),
    deliveredAt: attributes.deliveredAt,
    deliveredAtLabel: formatDateLabel(attributes.deliveredAt),
    requesterName,
    requesterEmail,
    requesterId,
    requesterDocumentId,
    approvedByName,
    approvedByEmail,
    approvedById,
    approvedByDocumentId,
    supplyItemName,
    supplyItemId,
    supplyItemDocumentId,
    supplyItemStock,
    canApprove,
    canDeliver,
  };
};

export async function fetchSupplyRequestsFromStrapi(jwt?: string, currentUserRole?: string): Promise<SupplyRequestCard[]> {
  const queryString = qs.stringify(
    {
      fields: ["requestNumber", "type", "quantity", "unit", "justification", "status", "notes", "requestedAt", "approvedAt", "deliveredAt"],
      populate: {
        requester: {
          fields: ["displayName", "email"]
        },
        approvedBy: {
          fields: ["displayName", "email"]
        },
        supplyItem: {
          fields: ["name", "stock"]
        }
      },
      sort: ["requestedAt:desc"],
      pagination: {
        pageSize: 100,
      },
    },
    { encodeValuesOnly: true }
  );

  const url = `${STRAPI_BASE_URL}/api/supply-requests?${queryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(jwt),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Supply Requests request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`Strapi Supply Requests request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyRequestRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeSupplyRequest(item, currentUserRole))
    .filter((item): item is SupplyRequestCard => Boolean(item));
}

export async function createSupplyRequestInStrapi(
  data: SupplyRequestCreatePayload,
  userJwt?: string
): Promise<SupplyRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/supply-requests`;
  
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildAuthHeader(userJwt),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Supply Request create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyRequestRaw>;
  const item = payload?.data ? normalizeSupplyRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function approveSupplyRequestInStrapi(
  id: string | number,
  data?: SupplyRequestApprovePayload,
  jwt?: string,
  userRole?: string
): Promise<SupplyRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/supply-requests/${id}/approve`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: buildAuthHeader(jwt),
  };
  
  if (userRole) {
    headers["x-user-role"] = userRole;
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Supply Request approve failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyRequestRaw>;
  const item = payload?.data ? normalizeSupplyRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function rejectSupplyRequestInStrapi(
  id: string | number,
  data?: SupplyRequestRejectPayload,
  jwt?: string,
  userRole?: string
): Promise<SupplyRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/supply-requests/${id}/reject`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: buildAuthHeader(jwt),
  };
  
  if (userRole) {
    headers["x-user-role"] = userRole;
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Supply Request reject failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyRequestRaw>;
  const item = payload?.data ? normalizeSupplyRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function deliverSupplyRequestInStrapi(
  id: string | number,
  jwt?: string,
  userRole?: string
): Promise<SupplyRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/supply-requests/${id}/deliver`;
  const headers: Record<string, string> = {
    Authorization: buildAuthHeader(jwt),
  };
  
  if (userRole) {
    headers["x-user-role"] = userRole;
  }
  
  const response = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Supply Request deliver failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<SupplyRequestRaw>;
  const item = payload?.data ? normalizeSupplyRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}
