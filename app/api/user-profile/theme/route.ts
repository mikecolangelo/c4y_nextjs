import { NextResponse } from "next/server";
import qs from "qs";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { logger } from "@/lib/logger";

const VALID_THEMES = ["light", "dark", "system"] as const;
type ThemePreference = (typeof VALID_THEMES)[number];

function isValidTheme(value: unknown): value is ThemePreference {
  return typeof value === "string" && (VALID_THEMES as readonly string[]).includes(value);
}

/**
 * Persist the current user's theme preference (light/dark/system) on their
 * user-profile so it follows them across devices. Uses the session JWT — the
 * Authenticated role can update its own profile.
 */
export async function PUT(request: Request) {
  const jwt = await getCurrentUserJwt();
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let themePreference: unknown;
  try {
    ({ themePreference } = await request.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (!isValidTheme(themePreference)) {
    return NextResponse.json(
      { error: "themePreference debe ser 'light', 'dark' o 'system'." },
      { status: 400 }
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${jwt}`,
    "Content-Type": "application/json",
  };

  try {
    // Resolve the current user's profile by email via the session JWT.
    const meResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (!meResponse.ok) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    const me = await meResponse.json();
    if (!me?.email) {
      return NextResponse.json({ error: "Usuario inválido." }, { status: 400 });
    }

    const profileQuery = qs.stringify({
      filters: { email: { $eq: me.email } },
      fields: ["documentId"],
    });
    const profileResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${profileQuery}`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (!profileResponse.ok) {
      throw new Error(await profileResponse.text());
    }
    const profileData = await profileResponse.json();
    const documentId = profileData.data?.[0]?.documentId;
    if (!documentId) {
      return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
    }

    const updateResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/${documentId}`, {
      method: "PUT",
      headers: authHeaders,
      body: JSON.stringify({ data: { themePreference } }),
      cache: "no-store",
    });
    if (!updateResponse.ok) {
      throw new Error(await updateResponse.text());
    }

    return NextResponse.json({ data: { themePreference } });
  } catch (error) {
    logger.error({ error }, "Failed to persist theme preference");
    return NextResponse.json(
      { error: "No pudimos guardar la preferencia de tema." },
      { status: 500 }
    );
  }
}
