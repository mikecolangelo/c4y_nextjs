import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the jwt cookie lookup used by the proxy route.
const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@/lib/config", () => ({
  STRAPI_BASE_URL: "http://strapi.test",
}));

import { GET } from "@/app/api/notifications/stream/route";

function makeRequest(): Request {
  return new Request("http://localhost/api/notifications/stream");
}

describe("notifications stream proxy route", () => {
  beforeEach(() => {
    cookieGet.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 401 when there is no jwt cookie", async () => {
    cookieGet.mockReturnValue(undefined);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("proxies the upstream SSE stream with event-stream headers", async () => {
    cookieGet.mockReturnValue({ value: "jwt-token" });
    const body = new ReadableStream();
    const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await GET(makeRequest());

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    // The upstream is called with the JWT as a Bearer token.
    expect(fetchMock).toHaveBeenCalledWith(
      "http://strapi.test/api/notifications/stream",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer jwt-token" }),
      })
    );
  });

  it("returns 502 when the upstream is not ok", async () => {
    cookieGet.mockReturnValue({ value: "jwt-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 }))
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(503);
  });

  it("returns 502 when the upstream connection throws", async () => {
    cookieGet.mockReturnValue({ value: "jwt-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      })
    );

    const res = await GET(makeRequest());
    expect(res.status).toBe(502);
  });
});
