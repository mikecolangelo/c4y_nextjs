import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import qs from "qs";

// Strapi caps page size at `maxLimit` (config/api.ts → 100), so a single large
// request silently truncates the contact list. We page through every result so
// the UI always receives the full set without raising the global limit.
const PROFILE_FIELDS = [
  "id",
  "documentId",
  "displayName",
  "email",
  "phone",
  "role",
  "department",
  "bio",
  "address",
  "dateOfBirth",
  "hireDate",
  "identificationNumber",
  "emergencyContactName",
  "emergencyContactPhone",
  "linkedin",
  "workSchedule",
  "specialties",
  "driverLicense",
  "billingName",
  "billingAddress",
  "billingTaxId",
  "billingPhone",
];
const PROFILE_POPULATE = {
  avatar: { fields: ["url", "alternativeText"] },
  registeredVehicles: { fields: ["id"] },
  driverHistories: { fields: ["id"] },
  assignedVehicles: { fields: ["id"] },
};
const PAGE_SIZE = 100;

// GET - Obtener todos los perfiles de contacto
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const excludeLeads = searchParams.get("excludeLeads") === "true";

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para ver contactos." },
        { status: 401 }
      );
    }

    let profiles: any[] = [];
    let page = 1;
    let pageCount = 1;

    do {
      const query = qs.stringify({
        fields: PROFILE_FIELDS,
        populate: PROFILE_POPULATE,
        sort: ["displayName:asc"],
        pagination: { page, pageSize: PAGE_SIZE },
      });

      const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${query}`, {
        headers: { Authorization: `Bearer ${jwt}` },
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Error obteniendo perfiles de contacto: ${errorText || response.statusText}`
        );
      }

      const data = await response.json();
      profiles = profiles.concat(data.data || []);
      pageCount = data.meta?.pagination?.pageCount ?? 1;
      page += 1;
    } while (page <= pageCount);

    // Algunos módulos (como Flota) deben excluir Leads de las asignaciones
    if (excludeLeads) {
      profiles = profiles.filter((profile: any) => profile.role !== "lead");
    }

    return NextResponse.json({ data: profiles });
  } catch (error) {
    console.error("Error obteniendo perfiles de contacto:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

// POST - Crear un nuevo perfil de contacto
// El backend Strapi maneja automaticamente la creacion de cuenta nativa
// cuando el rol no es 'lead' y se proporciona un email.
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.data) {
      return NextResponse.json(
        { error: "Payload inválido. Envía los campos dentro de data." },
        { status: 400 }
      );
    }

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para crear contactos." },
        { status: 401 }
      );
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorPayload: any = await response.json().catch(() => ({}));
      const errorMessage =
        typeof errorPayload.error?.message === "string"
          ? errorPayload.error.message
          : typeof errorPayload.message === "string"
            ? errorPayload.message
            : typeof errorPayload.error === "string"
              ? errorPayload.error
              : `Error creando perfil de contacto: ${response.statusText}`;
      return NextResponse.json({ error: errorMessage }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error creando perfil de contacto:", error);
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
