import qs from "qs";
import { getCurrentUserJwt } from "./auth";
import { STRAPI_BASE_URL } from "./config";
import { formatCurrency } from "./format";
import type {
  ServiceCard,
  ServiceRaw,
  ServiceRawAttributes,
  ServiceCreatePayload,
  ServiceUpdatePayload,
  StrapiResponse,
  MaintenanceKitCard,
  MaintenanceKitItemCard,
} from "@/validations/types";

const getCoverageLabel = (coverage: string): string => {
  const labels: Record<string, string> = {
    cliente: "Pagado por el cliente",
    empresa: "Cubierto por la empresa",
  };
  return labels[coverage] || coverage;
};

const extractAttributes = (
  entry: ServiceRaw
): ServiceRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as ServiceRawAttributes),
  };
};

const normalizeMaintenanceKitItem = (item: any): MaintenanceKitItemCard | null => {
  if (!item) return null;
  const inv = item.inventoryItem;
  if (!inv) return null;
  return {
    id: String(item.id ?? item.documentId ?? ""),
    documentId: String(item.documentId ?? item.id ?? ""),
    quantity: Number(item.quantity ?? 1),
    inventoryItem: {
      id: String(inv.id ?? inv.documentId ?? ""),
      documentId: String(inv.documentId ?? inv.id ?? ""),
      code: String(inv.code ?? ""),
      description: String(inv.description ?? ""),
      salePrice: Number(inv.salePrice ?? inv.unitCost ?? 0),
      stock: Number(inv.stock ?? 0),
      unit: inv.unit ?? undefined,
    },
  };
};

const normalizeMaintenanceKit = (kit: any): MaintenanceKitCard | null => {
  if (!kit) return null;
  const kitItems = Array.isArray(kit.kitItems)
    ? kit.kitItems.map(normalizeMaintenanceKitItem).filter(Boolean) as MaintenanceKitItemCard[]
    : [];
  return {
    id: String(kit.id ?? kit.documentId ?? ""),
    documentId: String(kit.documentId ?? kit.id ?? ""),
    name: String(kit.name ?? ""),
    type: String(kit.type ?? "oil_change"),
    description: kit.description ?? undefined,
    defaultLaborCost: Number(kit.defaultLaborCost ?? 0),
    isActive: Boolean(kit.isActive ?? true),
    kitItems,
  };
};

const normalizeService = (entry: ServiceRaw): ServiceCard | null => {
  const attributes = extractAttributes(entry);
  if (!attributes.name) {
    return null;
  }

  const price = Number(attributes.price ?? 0) || 0;
  const isFree = price === 0;
  const idSource = attributes.id ?? attributes.documentId ?? String(Date.now());
  const documentId = attributes.documentId ?? String(idSource);

  const rawKits = (entry as any).maintenanceKits;
  const maintenanceKits = Array.isArray(rawKits)
    ? rawKits.map(normalizeMaintenanceKit).filter(Boolean) as MaintenanceKitCard[]
    : undefined;

  const rawTemplate = (entry as any).defaultTemplate || attributes.defaultTemplate;
  const defaultTemplate = Array.isArray(rawTemplate)
    ? rawTemplate.map((t: any) => ({
        inventoryItemId: String(t.inventoryItemId ?? t.inventoryItem?.id ?? t.inventoryItem ?? ""),
        code: String(t.code ?? ""),
        description: String(t.description ?? ""),
        quantity: Number(t.quantity ?? 1),
        salePrice: Number(t.salePrice ?? t.unitPriceAtMoment ?? 0),
      }))
    : undefined;

  return {
    id: String(idSource),
    documentId: String(documentId),
    name: attributes.name,
    price,
    priceLabel: isFree ? "Gratuito" : formatCurrency(price),
    coverage: attributes.coverage || "cliente",
    coverageLabel: getCoverageLabel(attributes.coverage || "cliente"),
    isFree,
    description: attributes.description ?? undefined,
    category: attributes.category ?? undefined,
    durationMinutes: (entry as any).durationMinutes ?? undefined,
    basePrice: Number(attributes.basePrice ?? 0) || undefined,
    agencyCost: Number(attributes.agencyCost ?? 0) || undefined,
    maintenanceKits,
    defaultTemplate,
  };
};

export async function fetchServicesFromStrapi(): Promise<ServiceCard[]> {
  const jwt = await getCurrentUserJwt();
  const url = `${STRAPI_BASE_URL}/api/services?${qs.stringify(
    {
      fields: ["name", "price", "coverage", "description", "category", "basePrice", "agencyCost", "defaultTemplate"],
      sort: ["name:asc"],
      pagination: { pageSize: 100 },
      populate: {
        maintenanceKits: {
          populate: {
            kitItems: {
              populate: {
                inventoryItem: {
                  fields: ["code", "description", "salePrice", "unitCost", "stock", "unit"],
                },
              },
            },
          },
        },
      },
    },
    { encodeValuesOnly: true }
  )}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt ?? ""}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Services request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`Strapi Services request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<ServiceRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeService(item))
    .filter((service): service is ServiceCard => Boolean(service));
}

const isNumericId = (value: string | number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && String(parsed) === String(value);
};

const buildServiceDetailQuery = (id: string | number) => {
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
      fields: ["name", "price", "coverage", "description", "category", "basePrice", "agencyCost", "defaultTemplate"],
      populate: {
        maintenanceKits: {
          populate: {
            kitItems: {
              populate: {
                inventoryItem: {
                  fields: ["code", "description", "salePrice", "unitCost", "stock", "unit"],
                },
              },
            },
          },
        },
      },
      pagination: { pageSize: 1 },
    },
    { encodeValuesOnly: true }
  );
};

export async function fetchServiceByIdFromStrapi(
  id: string | number
): Promise<ServiceCard | null> {
  const jwt = await getCurrentUserJwt();
  const detailQuery = buildServiceDetailQuery(id);
  const response = await fetch(`${STRAPI_BASE_URL}/api/services?${detailQuery}`, {
    headers: {
      Authorization: `Bearer ${jwt ?? ""}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Strapi Service details request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StrapiResponse<ServiceRaw[]>;
  const entry = payload?.data?.[0];
  return entry ? normalizeService(entry) : null;
}

const resolveServiceDocumentId = async (id: string | number) => {
  if (!isNumericId(id)) {
    return String(id);
  }

  const service = await fetchServiceByIdFromStrapi(id);
  return service?.documentId ?? null;
};

export async function createServiceInStrapi(
  data: ServiceCreatePayload
): Promise<ServiceCard> {
  const jwt = await getCurrentUserJwt();
  const url = `${STRAPI_BASE_URL}/api/services`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Service create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<ServiceRaw>;
  const service = payload?.data ? normalizeService(payload.data) : null;

  if (!service) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return service;
}

export async function updateServiceInStrapi(
  id: string | number,
  data: ServiceUpdatePayload
): Promise<ServiceCard> {
  const jwt = await getCurrentUserJwt();
  const documentId = await resolveServiceDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar el servicio para actualizarlo.");
  }

  const url = `${STRAPI_BASE_URL}/api/services/${documentId}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${jwt ?? ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data }),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = `Error al actualizar el servicio (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error?.message || errorData?.error || errorMessage;
    } catch {
      // Si falla, usar el mensaje por defecto
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as StrapiResponse<ServiceRaw>;
  const service = payload?.data ? normalizeService(payload.data) : null;

  if (!service) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return service;
}

export async function deleteServiceInStrapi(id: string | number): Promise<void> {
  const jwt = await getCurrentUserJwt();
  const documentId = await resolveServiceDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar el servicio para eliminarlo.");
  }

  const response = await fetch(`${STRAPI_BASE_URL}/api/services/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${jwt ?? ""}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strapi Service delete failed with status ${response.status}`);
  }
}
