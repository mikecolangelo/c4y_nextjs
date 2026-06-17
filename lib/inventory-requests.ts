import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";
import type {
  InventoryRequestCard,
  InventoryRequestRaw,
  InventoryRequestRawAttributes,
  InventoryRequestCreatePayload,
  InventoryRequestUpdatePayload,
  InventoryRequestApprovePayload,
  InventoryRequestRejectPayload,
} from "@/validations/inventory-request-types";
import { INVENTORY_REQUEST_STATUS_LABELS } from "@/validations/inventory-request-types";
import type { StrapiResponse } from "@/validations/types";

function buildAuthHeader(jwt?: string): string {
  return jwt ? `Bearer ${jwt}` : `Bearer ${STRAPI_API_TOKEN}`;
}

const extractInventoryRequestAttributes = (
  entry: InventoryRequestRaw
): InventoryRequestRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as InventoryRequestRawAttributes),
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

const normalizeInventoryRequest = (entry: InventoryRequestRaw, currentUserRole?: string): InventoryRequestCard | null => {
  const attributes = extractInventoryRequestAttributes(entry);
  if (!attributes.justification || !attributes.requestedAt) {
    return null;
  }

  const idSource = attributes.id ?? attributes.documentId;
  const documentId = attributes.documentId ?? String(idSource);

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

  let inventoryItemCode: string | undefined;
  let inventoryItemDescription: string | undefined;
  let inventoryItemId: string | undefined;
  let inventoryItemDocumentId: string | undefined;
  let inventoryItemStock: number | undefined;

  if (attributes.inventoryItem) {
    if ("data" in attributes.inventoryItem && attributes.inventoryItem.data?.attributes) {
      inventoryItemCode = attributes.inventoryItem.data.attributes.code;
      inventoryItemDescription = attributes.inventoryItem.data.attributes.description;
      inventoryItemId = String(attributes.inventoryItem.data.id);
      inventoryItemDocumentId = attributes.inventoryItem.data.documentId;
      inventoryItemStock = attributes.inventoryItem.data.attributes.stock;
    } else if ("code" in attributes.inventoryItem) {
      inventoryItemCode = attributes.inventoryItem.code;
      inventoryItemDescription = attributes.inventoryItem.description;
      inventoryItemId = String(attributes.inventoryItem.id);
      inventoryItemDocumentId = attributes.inventoryItem.documentId;
      inventoryItemStock = attributes.inventoryItem.stock;
    }
  }

  const canApprove = attributes.status === "pendiente" && ["admin"].includes(currentUserRole || "");
  const canDeliver = attributes.status === "aprobado" && ["admin"].includes(currentUserRole || "");

  return {
    id: String(idSource),
    documentId: String(documentId),
    requestNumber: attributes.requestNumber,
    quantity: attributes.quantity,
    unit: attributes.unit,
    justification: attributes.justification,
    status: attributes.status,
    statusLabel: INVENTORY_REQUEST_STATUS_LABELS[attributes.status],
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
    inventoryItemCode,
    inventoryItemDescription,
    inventoryItemId,
    inventoryItemDocumentId,
    inventoryItemStock,
    canApprove,
    canDeliver,
  };
};

export async function fetchInventoryRequestsFromStrapi(jwt?: string, currentUserRole?: string): Promise<InventoryRequestCard[]> {
  const queryString = qs.stringify(
    {
      fields: ["requestNumber", "quantity", "unit", "justification", "status", "notes", "requestedAt", "approvedAt", "deliveredAt"],
      populate: {
        requester: {
          fields: ["displayName", "email"]
        },
        approvedBy: {
          fields: ["displayName", "email"]
        },
        inventoryItem: {
          fields: ["code", "description", "stock"]
        }
      },
      sort: ["requestedAt:desc"],
      pagination: {
        pageSize: 100,
      },
    },
    { encodeValuesOnly: true }
  );

  const url = `${STRAPI_BASE_URL}/api/inventory-requests?${queryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(jwt),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Inventory Requests request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`Strapi Inventory Requests request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryRequestRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeInventoryRequest(item, currentUserRole))
    .filter((item): item is InventoryRequestCard => Boolean(item));
}

export async function createInventoryRequestInStrapi(
  data: InventoryRequestCreatePayload,
  userJwt?: string
): Promise<InventoryRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/inventory-requests`;

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
    throw new Error(`Strapi Inventory Request create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryRequestRaw>;
  const item = payload?.data ? normalizeInventoryRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function approveInventoryRequestInStrapi(
  id: string | number,
  data?: InventoryRequestApprovePayload,
  jwt?: string,
  userRole?: string
): Promise<InventoryRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/inventory-requests/${id}/approve`;
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
    throw new Error(`Strapi Inventory Request approve failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryRequestRaw>;
  const item = payload?.data ? normalizeInventoryRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function rejectInventoryRequestInStrapi(
  id: string | number,
  data?: InventoryRequestRejectPayload,
  jwt?: string,
  userRole?: string
): Promise<InventoryRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/inventory-requests/${id}/reject`;
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
    throw new Error(`Strapi Inventory Request reject failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryRequestRaw>;
  const item = payload?.data ? normalizeInventoryRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function deliverInventoryRequestInStrapi(
  id: string | number,
  jwt?: string,
  userRole?: string
): Promise<InventoryRequestCard> {
  const url = `${STRAPI_BASE_URL}/api/inventory-requests/${id}/deliver`;
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
    throw new Error(`Strapi Inventory Request deliver failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryRequestRaw>;
  const item = payload?.data ? normalizeInventoryRequest(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}
