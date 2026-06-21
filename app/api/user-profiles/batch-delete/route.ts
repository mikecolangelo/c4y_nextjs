import { NextResponse } from "next/server";
import { STRAPI_BASE_URL } from "@/lib/config";
import { getCurrentUserJwt } from "@/lib/auth";
import { logger } from "@/lib/logger";

// POST - Eliminar múltiples perfiles de contacto
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body?.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "Payload inválido. Envía un array de ids dentro de body.ids." },
        { status: 400 }
      );
    }

    const jwt = await getCurrentUserJwt();
    if (!jwt) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesión para realizar esta acción." },
        { status: 401 }
      );
    }
    const authHeader = `Bearer ${jwt}`;

    const results = await Promise.allSettled(
      body.ids.map(async (id: string) => {
        const response = await fetch(`${STRAPI_BASE_URL}/api/user-profiles/${id}`, {
          method: "DELETE",
          headers: {
            Authorization: authHeader,
          },
          cache: "no-store",
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => response.statusText);
          throw new Error(errorText || response.statusText);
        }

        return { id, success: true };
      })
    );

    const succeeded = results
      .filter(
        (r): r is PromiseFulfilledResult<{ id: string; success: boolean }> =>
          r.status === "fulfilled"
      )
      .map((r) => r.value.id);

    const failed = results
      .map((r, index) => ({ r, index }))
      .filter(({ r }) => r.status === "rejected")
      .map(({ r, index }) => ({
        id: body.ids[index],
        error:
          (r as PromiseRejectedResult).reason instanceof Error
            ? (r as PromiseRejectedResult).reason.message
            : String((r as PromiseRejectedResult).reason),
      }));

    if (failed.length > 0 && succeeded.length === 0) {
      return NextResponse.json(
        {
          error: "No se pudo eliminar ningún contacto",
          failed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: succeeded.length,
      failedCount: failed.length,
      succeeded,
      failed,
    });
  } catch (error) {
    logger.error({ error }, "Failed to batch-delete contacts");
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
