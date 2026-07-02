import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt, getCurrentUserProfileViaJwt } from "@/lib/auth";
import { requireModulePermission } from "@/lib/module-guard";
import { logger } from "@/lib/logger";

interface RouteContext {
  params: Promise<{ commentId: string }>;
}

// DELETE - Remove a single contact comment by its documentId.
export async function DELETE(_: Request, context: RouteContext) {
  const jwt = await getCurrentUserJwt();
  if (!jwt) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const author = await getCurrentUserProfileViaJwt();
  if (!author) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    await requireModulePermission("users", "canDelete");
  } catch {
    return NextResponse.json(
      { error: "No tenés permiso para eliminar este comentario." },
      { status: 403 }
    );
  }

  try {
    const { commentId } = await context.params;

    const response = await fetch(`${STRAPI_BASE_URL}/api/user-comments/${commentId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jwt}` },
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
