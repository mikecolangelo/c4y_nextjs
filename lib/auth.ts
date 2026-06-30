import { cookies } from "next/headers";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "./config";
import qs from "qs";

export interface CurrentUser {
  id: number;
  documentId: string;
  email: string;
  username: string;
}

export interface CurrentUserProfile {
  id: number;
  documentId: string;
  displayName: string;
  email: string;
  role: string;
}

/**
 * Obtiene el usuario actual desde el JWT en las cookies
 * Solo funciona en Route Handlers y Server Components
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      return null;
    }

    const userResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      console.error("Error obteniendo usuario actual:", {
        status: userResponse.status,
        statusText: userResponse.statusText,
      });
      return null;
    }

    const userData = await userResponse.json();

    if (!userData?.id) {
      return null;
    }

    return {
      id: userData.id,
      documentId: userData.documentId,
      email: userData.email,
      username: userData.username,
    };
  } catch (error) {
    console.error("Error en getCurrentUser:", error);
    return null;
  }
}

/**
 * Obtiene el user-profile del usuario actual
 * Solo funciona en Route Handlers y Server Components
 */
export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      return null;
    }

    // Primero obtener el usuario
    const userResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      return null;
    }

    const userData = await userResponse.json();

    if (!userData?.email) {
      return null;
    }

    // Buscar el user-profile relacionado usando el email
    const profileQuery = qs.stringify({
      filters: {
        email: { $eq: userData.email },
      },
      fields: ["id", "documentId", "role", "displayName", "email"],
    });

    const profileResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${profileQuery}`, {
      headers: {
        Authorization: `Bearer ${STRAPI_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      return null;
    }

    const profileData = await profileResponse.json();
    const profile = profileData.data?.[0];

    if (!profile?.documentId) {
      return null;
    }

    return {
      id: profile.id,
      documentId: profile.documentId,
      displayName: profile.displayName,
      email: profile.email,
      role: profile.role,
    };
  } catch (error) {
    console.error("Error en getCurrentUserProfile:", error);
    return null;
  }
}

/**
 * Resolves the current user's profile using the session JWT for every Strapi
 * call (never the static STRAPI_API_TOKEN, which is not configured in every
 * environment). Use this in route handlers that rely on the Authenticated
 * role's permissions rather than a full-access token.
 *
 * Only works in Route Handlers and Server Components.
 */
export async function getCurrentUserProfileViaJwt(): Promise<CurrentUserProfile | null> {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;
    if (!jwt) return null;

    const authHeaders = {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    };

    const userResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (!userResponse.ok) return null;

    const userData = await userResponse.json();
    if (!userData?.email) return null;

    const profileQuery = qs.stringify({
      filters: { email: { $eq: userData.email } },
      fields: ["id", "documentId", "role", "displayName", "email"],
    });

    const profileResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${profileQuery}`, {
      headers: authHeaders,
      cache: "no-store",
    });
    if (!profileResponse.ok) return null;

    const profileData = await profileResponse.json();
    const profile = profileData.data?.[0];
    if (!profile?.documentId) return null;

    return {
      id: profile.id,
      documentId: profile.documentId,
      displayName: profile.displayName,
      email: profile.email,
      role: profile.role,
    };
  } catch (error) {
    console.error("Error en getCurrentUserProfileViaJwt:", error);
    return null;
  }
}

/**
 * Obtiene el JWT raw de la cookie
 * Solo funciona en Route Handlers y Server Components
 */
export async function getCurrentUserJwt(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get("jwt")?.value || null;
  } catch {
    return null;
  }
}

/**
 * Verifica si el usuario está autenticado
 * Solo funciona en Route Handlers y Server Components
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
