/**
 * Services client API.
 *
 * Browser-side fetch wrappers around the app's internal route handlers
 * (`/api/services`, `/api/inventory-items`). Keeping these here lets Client
 * Components and hooks stay free of raw `fetch` plumbing.
 */
import type { ServiceCard, ServiceCreatePayload, InventoryItemRaw } from "@/validations/types";

const SERVICES_ENDPOINT = "/api/services";
const INVENTORY_ENDPOINT = "/api/inventory-items";

/** Loads the full service catalog. */
export async function fetchServices(): Promise<ServiceCard[]> {
  const response = await fetch(SERVICES_ENDPOINT, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Services request failed");
  }
  const { data } = (await response.json()) as { data?: ServiceCard[] };
  return Array.isArray(data) ? data : [];
}

/** Creates a new service in the catalog. */
export async function createService(payload: ServiceCreatePayload): Promise<void> {
  const response = await fetch(SERVICES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: payload }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "No se pudo crear el servicio");
  }
}

/** Loads inventory items used to build a service's parts template. */
export async function fetchInventoryOptions(pageSize = 500): Promise<InventoryItemRaw[]> {
  const response = await fetch(`${INVENTORY_ENDPOINT}?pageSize=${pageSize}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Error al cargar inventario");
  }
  const payload = await response.json();
  return Array.isArray(payload?.data) ? payload.data : [];
}
