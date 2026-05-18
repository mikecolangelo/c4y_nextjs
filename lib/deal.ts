import qs from "qs";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";
import { formatCurrency } from "./format";
import type {
  DealCard,
  DealRaw,
  DealRawAttributes,
  DealCreatePayload,
  DealUpdatePayload,
  DealClause,
  DealClauseRaw,
  DealClauseRawAttributes,
  DealClauseCreatePayload,
  DealDiscount,
  DealDiscountRaw,
  DealDiscountRawAttributes,
  DealDiscountCreatePayload,
  DealType,
  DealStatus,
  DealPaymentAgreement,
  StrapiResponse,
} from "@/validations/types";

// Populate config para obtener relaciones
// Nota: address, engineNumber, passengerCapacity se añadirán después de reiniciar Strapi
const populateConfig = {
  populate: {
    client: {
      fields: ["id", "documentId", "fullName", "email", "phone"],
    },
    vehicle: {
      fields: ["id", "documentId", "name", "placa", "brand", "year", "color", "vin"],
    },
    seller: {
      fields: ["id", "documentId", "displayName", "email"],
    },
    contractType: {
      fields: ["id", "documentId", "name", "description"],
    },
    clauses: {
      fields: ["id", "documentId", "title", "description"],
    },
    discounts: {
      fields: ["id", "documentId", "title", "description", "amount"],
    },
  },
};

const listQueryString = qs.stringify(
  {
    fields: ["title", "status", "generatedAt", "signedAt", "price", "paymentAgreement", "initialDeposit", "quotaAmount", "totalQuotas", "summary"],
    ...populateConfig,
    sort: ["generatedAt:desc"],
    pagination: {
      pageSize: 100,
    },
  },
  { encodeValuesOnly: true }
);

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

const getDealTypeLabel = (type: DealType): string => {
  const labels: Record<DealType, string> = {
    conduccion: "Contrato de Conducción",
    arrendamiento: "Contrato de Arrendamiento",
    servicio: "Contrato de Servicio",
  };
  return labels[type] || type;
};

const getDealStatusLabel = (status: DealStatus): string => {
  const labels: Record<DealStatus, string> = {
    pendiente: "Pendiente de Firma",
    firmado: "Firmado",
    archivado: "Archivado",
  };
  return labels[status] || status;
};

const getPaymentAgreementLabel = (agreement: DealPaymentAgreement): string => {
  const labels: Record<DealPaymentAgreement, string> = {
    semanal: "Semanal",
    quincenal: "Quincenal",
    mensual: "Mensual",
  };
  return labels[agreement] || agreement;
};

const extractAttributes = (
  entry: DealRaw
): DealRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as DealRawAttributes),
  };
};

const extractClauseAttributes = (
  entry: DealClauseRaw
): DealClauseRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as DealClauseRawAttributes),
  };
};

const extractDiscountAttributes = (
  entry: DealDiscountRaw
): DealDiscountRawAttributes & { id?: number | string; documentId?: string } => {
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
    ...(entry as DealDiscountRawAttributes),
  };
};

const getClientData = (client: DealRawAttributes["client"]) => {
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

const getVehicleData = (vehicle: DealRawAttributes["vehicle"]) => {
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

const getSellerData = (seller: DealRawAttributes["seller"]) => {
  if (!seller) return undefined;
  if ("data" in seller && seller.data) {
    const attrs = seller.data.attributes;
    return {
      id: seller.data.id,
      documentId: seller.data.documentId,
      displayName: attrs?.displayName,
      email: attrs?.email,
    };
  }
  return seller as {
    id?: number;
    documentId?: string;
    displayName?: string;
    email?: string;
  };
};

const getClausesData = (clauses: DealRawAttributes["clauses"]): DealClause[] => {
  if (!clauses) return [];

  let clausesArray: DealClauseRaw[] = [];

  if ("data" in clauses && Array.isArray(clauses.data)) {
    clausesArray = clauses.data.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      ...(c.attributes || {}),
    })) as DealClauseRaw[];
  } else if (Array.isArray(clauses)) {
    clausesArray = clauses;
  }

  return clausesArray.map((clause) => {
    const attrs = extractClauseAttributes(clause);
    return {
      id: String(attrs.id ?? attrs.documentId ?? ""),
      documentId: attrs.documentId,
      title: attrs.title || "",
      description: attrs.description,
    };
  });
};

const getDiscountsData = (discounts: DealRawAttributes["discounts"]): DealDiscount[] => {
  if (!discounts) return [];

  let discountsArray: DealDiscountRaw[] = [];

  if ("data" in discounts && Array.isArray(discounts.data)) {
    discountsArray = discounts.data.map((d) => ({
      id: d.id,
      documentId: d.documentId,
      ...(d.attributes || {}),
    })) as DealDiscountRaw[];
  } else if (Array.isArray(discounts)) {
    discountsArray = discounts;
  }

  return discountsArray.map((discount) => {
    const attrs = extractDiscountAttributes(discount);
    const amount = Number(attrs.amount ?? 0) || 0;
    return {
      id: String(attrs.id ?? attrs.documentId ?? ""),
      documentId: attrs.documentId,
      title: attrs.title || "",
      description: attrs.description,
      amount,
      amountLabel: formatCurrency(amount),
    };
  });
};

const getContractTypeData = (contractType: DealRawAttributes["contractType"]) => {
  if (!contractType) return undefined;
  if ("data" in contractType && contractType.data) {
    const attrs = contractType.data.attributes;
    return {
      id: contractType.data.id,
      documentId: contractType.data.documentId,
      name: attrs?.name,
      description: attrs?.description,
    };
  }
  return contractType as {
    id?: number;
    documentId?: string;
    name?: string;
    description?: string;
  };
};

const normalizeDeal = (entry: DealRaw): DealCard | null => {
  const attributes = extractAttributes(entry);
  
  const price = attributes.price ? Number(attributes.price) || 0 : undefined;
  const idSource = attributes.id ?? attributes.documentId ?? "";
  const documentId = attributes.documentId ?? String(idSource);

  const clientData = getClientData(attributes.client);
  const vehicleData = getVehicleData(attributes.vehicle);
  const sellerData = getSellerData(attributes.seller);
  const contractTypeData = getContractTypeData(attributes.contractType);
  const clausesData = getClausesData(attributes.clauses);
  const discountsData = getDiscountsData(attributes.discounts);

  const paymentAgreement = attributes.paymentAgreement || "semanal";

  return {
    id: String(idSource),
    documentId: String(documentId),
    title: attributes.title,
    type: attributes.type,
    typeLabel: attributes.type ? getDealTypeLabel(attributes.type) : undefined,
    contractTypeId: contractTypeData?.id ? String(contractTypeData.id) : undefined,
    contractTypeDocumentId: contractTypeData?.documentId,
    contractTypeName: contractTypeData?.name,
    contractTypeDescription: contractTypeData?.description,
    status: attributes.status || "pendiente",
    statusLabel: getDealStatusLabel(attributes.status || "pendiente"),
    generatedAt: attributes.generatedAt,
    generatedAtLabel: formatDate(attributes.generatedAt),
    signedAt: attributes.signedAt,
    signedAtLabel: formatDate(attributes.signedAt),
    price,
    priceLabel: price !== undefined ? formatCurrency(price) : undefined,
    paymentAgreement,
    paymentAgreementLabel: getPaymentAgreementLabel(paymentAgreement),
    initialDeposit: attributes.initialDeposit ? Number(attributes.initialDeposit) || 0 : undefined,
    quotaAmount: attributes.quotaAmount ? Number(attributes.quotaAmount) || 0 : undefined,
    totalQuotas: attributes.totalQuotas,
    summary: attributes.summary,
    clientName: clientData?.fullName,
    clientEmail: clientData?.email,
    clientPhone: clientData?.phone,
    clientId: clientData?.id ? String(clientData.id) : undefined,
    clientDocumentId: clientData?.documentId,
    vehicleName: vehicleData?.name,
    vehiclePlaca: vehicleData?.placa,
    vehicleId: vehicleData?.id ? String(vehicleData.id) : undefined,
    vehicleDocumentId: vehicleData?.documentId,
    sellerName: sellerData?.displayName,
    sellerEmail: sellerData?.email,
    sellerId: sellerData?.id ? String(sellerData.id) : undefined,
    sellerDocumentId: sellerData?.documentId,
    clauses: clausesData,
    discounts: discountsData,
  };
};

export async function fetchDealsFromStrapi(): Promise<DealCard[]> {
  const url = `${STRAPI_BASE_URL}/api/deals?${listQueryString}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Strapi Deals request failed:", {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      url,
    });
    throw new Error(`Strapi Deals request failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<DealRaw[]>;
  const items = Array.isArray(payload?.data) ? payload.data : [];

  return items
    .map((item) => normalizeDeal(item))
    .filter((deal): deal is DealCard => Boolean(deal));
}

const isNumericId = (value: string | number) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && String(parsed) === String(value);
};

const buildDealDetailQuery = (id: string | number) => {
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
      fields: ["title", "status", "generatedAt", "signedAt", "price", "paymentAgreement", "initialDeposit", "quotaAmount", "totalQuotas", "summary"],
      ...populateConfig,
      pagination: { pageSize: 1 },
    },
    { encodeValuesOnly: true }
  );
};

export async function fetchDealByIdFromStrapi(
  id: string | number
): Promise<DealCard | null> {
  const detailQuery = buildDealDetailQuery(id);
  const response = await fetch(`${STRAPI_BASE_URL}/api/deals?${detailQuery}`, {
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Strapi Deal details request failed with status ${response.status}`);
  }

  const payload = (await response.json()) as StrapiResponse<DealRaw[]>;
  const entry = payload?.data?.[0];
  return entry ? normalizeDeal(entry) : null;
}

const resolveDealDocumentId = async (id: string | number) => {
  if (!isNumericId(id)) {
    return String(id);
  }

  const deal = await fetchDealByIdFromStrapi(id);
  return deal?.documentId ?? null;
};

export async function createDealInStrapi(
  data: DealCreatePayload
): Promise<DealCard> {
  // Filtrar campos que ya no existen en el schema de Strapi
  // El campo 'type' fue reemplazado por 'contractType' (relación)
  const { type, ...cleanData } = data;
  
  const populateQueryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const url = `${STRAPI_BASE_URL}/api/deals?${populateQueryString}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: cleanData }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strapi Deal create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<DealRaw>;
  const deal = payload?.data ? normalizeDeal(payload.data) : null;

  if (!deal) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return deal;
}

export async function updateDealInStrapi(
  id: string | number,
  data: DealUpdatePayload
): Promise<DealCard> {
  const documentId = await resolveDealDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar el contrato para actualizarlo.");
  }

  // Filtrar campos que ya no existen en el schema de Strapi
  const { type, ...cleanData } = data;

  const populateQueryString = qs.stringify(populateConfig, { encodeValuesOnly: true });
  const url = `${STRAPI_BASE_URL}/api/deals/${documentId}?${populateQueryString}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ data: cleanData }),
    cache: "no-store",
  });

  if (!response.ok) {
    let errorMessage = `Error al actualizar el contrato (${response.status})`;
    try {
      const errorData = await response.json();
      errorMessage = errorData?.error?.message || errorData?.error || errorMessage;
    } catch {
      // Si falla, usar el mensaje por defecto
    }
    throw new Error(errorMessage);
  }

  const payload = (await response.json()) as StrapiResponse<DealRaw>;
  const deal = payload?.data ? normalizeDeal(payload.data) : null;

  if (!deal) {
    throw new Error("No pudimos normalizar la respuesta de Strapi.");
  }

  return deal;
}

export async function deleteDealInStrapi(id: string | number): Promise<void> {
  const documentId = await resolveDealDocumentId(id);

  if (!documentId) {
    throw new Error("No pudimos encontrar el contrato para eliminarlo.");
  }

  const response = await fetch(`${STRAPI_BASE_URL}/api/deals/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strapi Deal delete failed with status ${response.status}`);
  }
}

// ============================================
// Deal Clauses CRUD
// ============================================

export async function createDealClauseInStrapi(
  data: DealClauseCreatePayload
): Promise<DealClause> {
  const url = `${STRAPI_BASE_URL}/api/deal-clauses`;
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
    throw new Error(`Strapi Deal Clause create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<DealClauseRaw>;
  const clauseData = payload?.data;

  if (!clauseData) {
    throw new Error("No pudimos crear la cláusula.");
  }

  const attrs = extractClauseAttributes(clauseData);

  return {
    id: String(attrs.id ?? attrs.documentId ?? ""),
    documentId: attrs.documentId,
    title: attrs.title || "",
    description: attrs.description,
  };
}

export async function deleteDealClauseInStrapi(documentId: string): Promise<void> {
  const response = await fetch(`${STRAPI_BASE_URL}/api/deal-clauses/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strapi Deal Clause delete failed with status ${response.status}`);
  }
}

// ============================================
// Deal Discounts CRUD
// ============================================

export async function createDealDiscountInStrapi(
  data: DealDiscountCreatePayload
): Promise<DealDiscount> {
  const url = `${STRAPI_BASE_URL}/api/deal-discounts`;
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
    throw new Error(`Strapi Deal Discount create failed with status ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as StrapiResponse<DealDiscountRaw>;
  const discountData = payload?.data;

  if (!discountData) {
    throw new Error("No pudimos crear el descuento.");
  }

  const attrs = extractDiscountAttributes(discountData);
  const amount = Number(attrs.amount ?? 0) || 0;

  return {
    id: String(attrs.id ?? attrs.documentId ?? ""),
    documentId: attrs.documentId,
    title: attrs.title || "",
    description: attrs.description,
    amount,
    amountLabel: formatCurrency(amount),
  };
}

export async function deleteDealDiscountInStrapi(documentId: string): Promise<void> {
  const response = await fetch(`${STRAPI_BASE_URL}/api/deal-discounts/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Strapi Deal Discount delete failed with status ${response.status}`);
  }
}
