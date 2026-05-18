import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";
import type {
  InventoryItemCard,
  InventoryItemRaw,
  InventoryItemRawAttributes,
  InventoryItemCreatePayload,
  InventoryItemUpdatePayload,
  StrapiResponse,
  StockStatus,
  InventoryIcon,
} from "@/validations/types";

const listQueryString = qs.stringify(
  {
    fields: ["code", "description", "stock", "assignedTo", "minStock", "maxStock", "unit", "location", "supplier", "lastRestocked", "icon", "unitCost", "salePrice"],
    sort: ["code:asc"],
    pagination: {
      pageSize: 100,
    },
  },
  { encodeValuesOnly: true }
);

const getStockStatus = (stock: number, minStock?: number): StockStatus => {
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

const extractAttributes = (
  entry: InventoryItemRaw
): InventoryItemRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as InventoryItemRawAttributes),
  };
};

const normalizeInventoryItem = (entry: InventoryItemRaw): InventoryItemCard | null => {
  const attributes = extractAttributes(entry);
  if (!attributes.code) {
    return null;
  }

  const stock = Number(attributes.stock ?? 0) || 0;
  const minStock = attributes.minStock !== undefined ? Number(attributes.minStock) : undefined;
  const idSource = attributes.id ?? attributes.documentId ?? attributes.code;
  const documentId = attributes.documentId ?? String(idSource);
  const icon: InventoryIcon = attributes.icon || "filter";

  return {
    id: String(idSource),
    documentId: String(documentId),
    code: attributes.code,
    description: attributes.description || "",
    stock,
    stockStatus: getStockStatus(stock, minStock),
    assignedTo: attributes.assignedTo ?? undefined,
    minStock: minStock ?? undefined,
    maxStock: attributes.maxStock !== undefined ? Number(attributes.maxStock) : undefined,
    unit: attributes.unit ?? undefined,
    location: attributes.location ?? undefined,
    supplier: attributes.supplier ?? undefined,
    lastRestocked: attributes.lastRestocked ?? undefined,
    icon,
    unitCost: attributes.unitCost !== undefined ? Number(attributes.unitCost) : undefined,
    salePrice: attributes.salePrice !== undefined ? Number(attributes.salePrice) : undefined,
  };
};

export async function fetchInventoryItems(): Promise<InventoryItemCard[]> {
  const response = await fetch("/api/inventory-items", { cache: "no-store", credentials: "include" });
  if (!response.ok) {
    throw new Error("Inventory items request failed");
  }
  const payload = (await response.json()) as { data?: InventoryItemRaw[] };
  const items = Array.isArray(payload?.data) ? payload.data : [];
  return items
    .map((item) => normalizeInventoryItem(item))
    .filter((item): item is InventoryItemCard => Boolean(item));
}

export async function fetchInventoryItemsFromStrapi(): Promise<InventoryItemCard[]> {
  const url = `${STRAPI_BASE_URL}/api/inventory-items?${listQueryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Inventory request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`Strapi Inventory request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryItemRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeInventoryItem(item))
    .filter((item): item is InventoryItemCard => Boolean(item));
}

const isNumericId = (value: string | number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && String(parsed) === String(value);
};

const buildInventoryDetailQuery = (id: string | number) => {
  const normalizedId = String(id);
  const filters = isNumericId(id)
    ? {
        $or: [
          { id: { $eq: Number(id) } },
          { documentId: { $eq: normalizedId } },
        ],
      }
    : {
        documentId: { $eq: normalizedId },
      };

  return qs.stringify(
    {
      filters,
      fields: ["code", "description", "stock", "assignedTo", "minStock", "maxStock", "unit", "location", "supplier", "lastRestocked", "icon", "unitCost", "salePrice"],
      pagination: { pageSize: 1 },
    },
    { encodeValuesOnly: true }
  );
};

export async function fetchInventoryItemByIdFromStrapi(
  id: string | number
): Promise<InventoryItemCard | null> {
  const detailQuery = buildInventoryDetailQuery(id);
  const response = await fetch(`${STRAPI_BASE_URL}/api/inventory-items?${detailQuery}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Strapi Inventory details request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryItemRaw[]>;
  const entry = payload?.data?.[0];
  return entry ? normalizeInventoryItem(entry) : null;
}

const resolveInventoryDocumentId = async (id: string | number) => {
  if (!isNumericId(id)) {
    return String(id);
  }

  const item = await fetchInventoryItemByIdFromStrapi(id);
  return item?.documentId ?? null;
};

export async function createInventoryItemInStrapi(
  data: InventoryItemCreatePayload
): Promise<InventoryItemCard> {
  const url = `${STRAPI_BASE_URL}/api/inventory-items`;
  const response = await fetch(url, {
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
    throw new Error(`Strapi Inventory create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryItemRaw>;
  const item = payload?.data ? normalizeInventoryItem(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function updateInventoryItemInStrapi(
  id: string | number,
  data: InventoryItemUpdatePayload
): Promise<InventoryItemCard> {
  const documentId = await resolveInventoryDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar el item de inventario para actualizarlo.");
  }

  const url = `${STRAPI_BASE_URL}/api/inventory-items/${documentId}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = `Error al actualizar el item de inventario (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error?.message || errorData?.error || errorMessage;
    } catch {
      // Si falla, usar el mensaje por defecto
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as StrapiResponse<InventoryItemRaw>;
  const item = payload?.data ? normalizeInventoryItem(payload.data) : null;

  if (!item) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return item;
}

export async function deleteInventoryItemInStrapi(id: string | number): Promise<void> {
  const documentId = await resolveInventoryDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar el item de inventario para eliminarlo.");
  }

  const response = await fetch(`${STRAPI_BASE_URL}/api/inventory-items/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strapi Inventory delete failed with status ${response.status}`);
  }
}
