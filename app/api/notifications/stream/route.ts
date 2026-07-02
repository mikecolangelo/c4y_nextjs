import { cookies } from "next/headers";
import { STRAPI_BASE_URL } from "@/lib/config";
import { logger } from "@/lib/logger";

/**
 * Server-Sent Events proxy for real-time notifications.
 *
 * The browser's `EventSource` cannot attach an `Authorization` header, so the
 * stream is authenticated here using the `jwt` cookie and proxied to the Strapi
 * SSE endpoint (`/api/notifications/stream`). The upstream `text/event-stream`
 * body is piped straight back to the client unchanged.
 */
export const dynamic = "force-dynamic";
// SSE must not be buffered or statically optimised.
export const runtime = "nodejs";
export const fetchCache = "force-no-store";

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies();
  const jwt = cookieStore.get("jwt")?.value;

  if (!jwt) {
    return new Response("No autenticado", { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${STRAPI_BASE_URL}/api/notifications/stream`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: "text/event-stream",
      },
      // Forward client disconnects so the upstream connection is torn down.
      signal: request.signal,
      cache: "no-store",
    });
  } catch (error) {
    // AbortError simply means the client navigated away; nothing to report.
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 204 });
    }
    logger.error({ err: error }, "notifications stream: upstream connection failed");
    return new Response("Stream no disponible", { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return new Response("Stream no disponible", { status: upstream.status || 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
