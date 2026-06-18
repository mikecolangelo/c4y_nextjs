import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";

/**
 * Información de contacto de la administración (editable en Configuración →
 * Contacto). La leen los usuarios (incluido el driver) para el botón de
 * WhatsApp y los enlaces. Se sirve con API token de servidor.
 */

const CONTACT_KEYS = {
  CONTACT_PHONE_1: "phone1",
  CONTACT_PHONE_2: "phone2",
  CONTACT_EMAIL: "email",
  CONTACT_TIKTOK: "tiktok",
  CONTACT_INSTAGRAM: "instagram",
  CONTACT_FACEBOOK: "facebook",
} as const;

// Valor por defecto si aún no se ha configurado.
const DEFAULTS: Record<string, string> = {
  phone1: "+507 8337688",
  phone2: "",
  email: "",
  tiktok: "",
  instagram: "",
  facebook: "",
};

export async function GET() {
  try {
    const query = qs.stringify({
      filters: { category: { $eq: "contact" } },
      fields: ["key", "value"],
      pagination: { pageSize: 50 },
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/configurations?${query}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const result: Record<string, string> = { ...DEFAULTS };

    if (response.ok) {
      const json = await response.json();
      const entries = json.data || [];
      for (const entry of entries) {
        const field = CONTACT_KEYS[entry.key as keyof typeof CONTACT_KEYS];
        if (field && entry.value) {
          result[field] = entry.value;
        }
      }
    }

    return NextResponse.json({ data: result }, { status: 200 });
  } catch (error) {
    console.error("[API /contact-info] Error:", error);
    return NextResponse.json({ data: DEFAULTS }, { status: 200 });
  }
}
