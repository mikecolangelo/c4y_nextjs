import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";
import qs from "qs";

// GET - Obtener el user-profile del usuario actual
export async function GET() {
  try {
    const cookieStore = await cookies();
    const jwt = cookieStore.get("jwt")?.value;

    if (!jwt) {
      cookieStore.delete("jwt");
      cookieStore.delete("admin-theme");
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 1. Obtener usuario nativo con JWT de sesion
    const userResponse = await fetch(`${STRAPI_BASE_URL}/api/users/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      if (userResponse.status === 401) {
        cookieStore.delete("jwt");
        cookieStore.delete("admin-theme");
      }
      return NextResponse.json(
        {
          error: "No se pudo obtener el usuario",
          details: errorText || `Error ${userResponse.status}: ${userResponse.statusText}`,
        },
        { status: userResponse.status }
      );
    }

    const userData = await userResponse.json();
    const userId = userData?.id;
    const email = userData?.email;

    if (!userId || !email) {
      return NextResponse.json(
        {
          error: "Usuario no valido",
          details: "La respuesta de Strapi no contiene un ID o email de usuario valido",
        },
        { status: 400 }
      );
    }

    // 2. Buscar user-profile por email usando JWT del usuario (NO token estatico)
    const profileQuery = qs.stringify({
      filters: { email: { $eq: email } },
      fields: ["documentId", "role", "displayName", "email", "themePreference"],
    });

    const profileResponse = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${profileQuery}`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      return NextResponse.json(
        {
          error: "No se pudo obtener el user-profile",
          details: errorText || `Error ${profileResponse.status}`,
        },
        { status: profileResponse.status }
      );
    }

    const profileData = await profileResponse.json();
    const profile = profileData.data?.[0];

    if (!profile || !profile.documentId) {
      console.warn("[API /user-profile/me] Perfil no encontrado para usuario:", {
        userId,
        email,
      });
      return NextResponse.json(
        {
          error: "Perfil no encontrado",
          details:
            "No existe un perfil de contacto vinculado a este usuario. Solicita al administrador que cree o vincule el perfil desde el modulo Contactos.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        documentId: profile.documentId,
        role: profile.role,
        displayName: profile.displayName,
        email: profile.email,
        themePreference: profile.themePreference ?? null,
      },
    });
  } catch (error) {
    console.error("[API /user-profile/me] Error:", error);
    return NextResponse.json(
      {
        error: "Error al obtener el user-profile",
        details: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}
