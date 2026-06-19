import { NextResponse } from "next/server";
import qs from "qs";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt, getCurrentUserProfileViaJwt } from "@/lib/auth";
import { isAdminRole } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const COMMENT_FIELDS = [
  "id",
  "documentId",
  "content",
  "authorDocumentId",
  "authorName",
  "createdAt",
] as const;

/** Resolve the numeric id of a user-profile from its documentId, via JWT. */
async function resolveProfileId(documentId: string, jwt: string): Promise<number | null> {
  const query = qs.stringify({
    filters: { documentId: { $eq: documentId } },
    fields: ["id"],
  });

  const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles?${query}`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });

  if (!response.ok) return null;
  const data = await response.json();
  return data.data?.[0]?.id ?? null;
}

// GET - List the comment timeline of a contact (newest first).
export async function GET(_: Request, context: RouteContext) {
  const jwt = await getCurrentUserJwt();
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const profileId = await resolveProfileId(id, jwt);
    if (!profileId) {
      return NextResponse.json({ error: "Contacto no encontrado." }, { status: 404 });
    }

    const query = qs.stringify({
      filters: { subject: { id: { $eq: profileId } } },
      fields: COMMENT_FIELDS as unknown as string[],
      sort: ["createdAt:desc"],
      pagination: { pageSize: 200 },
    });

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-comments?${query}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || response.statusText);
    }

    const data = await response.json();
    return NextResponse.json({ data: data.data ?? [] });
  } catch (error) {
    logger.error({ error }, "Failed to list contact comments");
    return NextResponse.json({ error: "No pudimos obtener los comentarios." }, { status: 500 });
  }
}

// POST - Add a comment to a contact's timeline, attributed to the current admin.
export async function POST(request: Request, context: RouteContext) {
  const jwt = await getCurrentUserJwt();
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const author = await getCurrentUserProfileViaJwt();
  if (!author || !isAdminRole(author.role)) {
    return NextResponse.json(
      { error: "Acceso restringido: se requieren permisos de administrador." },
      { status: 403 }
    );
  }

  try {
    const body = (await request.json()) as { content?: string };
    const content = body?.content?.trim();
    if (!content) {
      return NextResponse.json({ error: "El comentario no puede estar vacío." }, { status: 400 });
    }

    const { id } = await context.params;
    const profileId = await resolveProfileId(id, jwt);
    if (!profileId) {
      return NextResponse.json({ error: "Contacto no encontrado." }, { status: 404 });
    }

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-comments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          content,
          authorDocumentId: author.documentId,
          authorName: author.displayName || author.email || "Usuario",
          subject: profileId,
        },
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || response.statusText);
    }

    const created = await response.json();
    return NextResponse.json({ data: created.data }, { status: 201 });
  } catch (error) {
    logger.error({ error }, "Failed to create contact comment");
    return NextResponse.json({ error: "No pudimos guardar el comentario." }, { status: 500 });
  }
}
