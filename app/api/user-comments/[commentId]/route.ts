import { NextResponse } from "next/server";
import { STRAPI_API_TOKEN, STRAPI_BASE_URL } from "@/lib/config";
import { requireAdmin } from "@/lib/admin-guard";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ commentId: string }>;
}

// DELETE - Remove a single contact comment by its documentId.
export async function DELETE(_: Request, context: RouteContext) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json(
      { error: "Acceso restringido: se requieren permisos de administrador." },
      { status: 403 }
    );
  }

  try {
    const { commentId } = await context.params;

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${STRAPI_API_TOKEN}` },
      cache: "no-store",
    });

    if (!response.ok && response.status !== 404) {
      const detail = await response.text();
      throw new Error(detail || response.statusText);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ error }, "Failed to delete contact comment");
    return NextResponse.json({ error: "No pudimos eliminar el comentario." }, { status: 500 });
  }
}
