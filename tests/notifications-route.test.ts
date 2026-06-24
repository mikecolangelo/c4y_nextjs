import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet }),
}));

vi.mock("@/lib/config", () => ({
  STRAPI_BASE_URL: "http://strapi.test",
  STRAPI_API_TOKEN: "api-token",
}));

import { GET, POST } from "@/app/api/notifications/route";

/** Builds a JSON Response for fetch mocks. */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stubs the user-profile resolution chain (users/me + user-profiles lookup). */
function stubAuthenticatedUser() {
  return [
    jsonResponse({ id: 11, email: "user@test.com" }), // /api/users/me
    jsonResponse({
      data: [{ id: 11, documentId: "doc-11", role: "admin", email: "user@test.com" }],
    }), // /api/user-profiles
  ];
}

describe("notifications route", () => {
  beforeEach(() => {
    cookieGet.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("GET", () => {
    it("returns 401 when unauthenticated", async () => {
      cookieGet.mockReturnValue(undefined);
      const res = await GET();
      expect(res.status).toBe(401);
    });

    it("returns deduplicated notifications for an authenticated user", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      const responses = [
        ...stubAuthenticatedUser(),
        // broadcast notifications query
        jsonResponse({
          data: [
            {
              id: 1,
              documentId: "n1",
              type: "lead",
              title: "Lead",
              isRead: false,
              targetAudience: "all",
            },
          ],
        }),
        // recipient-specific notifications query
        jsonResponse({ data: [] }),
      ];
      const fetchMock = vi.fn(async () => responses.shift() as Response);
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Lead");
    });
  });

  describe("POST", () => {
    it("returns 401 when unauthenticated", async () => {
      cookieGet.mockReturnValue(undefined);
      const req = new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ title: "x", type: "lead", recipientType: "all" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });

    it("rejects when required fields are missing", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          const next = stubAuthenticatedUser();
          return next.shift() as Response;
        })
      );
      // Provide the two auth responses then expect a 400 for missing fields.
      const authResponses = stubAuthenticatedUser();
      const fetchMock = vi.fn(async () => authResponses.shift() as Response);
      vi.stubGlobal("fetch", fetchMock);

      const req = new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ description: "no title" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("creates a broadcast notification via targetAudience", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      const responses = [
        ...stubAuthenticatedUser(),
        jsonResponse({ data: { id: 99, documentId: "new-99" } }), // create
      ];
      const fetchMock = vi.fn(async () => responses.shift() as Response);
      vi.stubGlobal("fetch", fetchMock);

      const req = new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({
          title: "Announcement",
          type: "lead",
          recipientType: "all_drivers",
        }),
      });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);

      // The create call targets the notifications collection with a drivers audience.
      const createCall = fetchMock.mock.calls.find(([url]) =>
        String(url).endsWith("/api/notifications")
      );
      expect(createCall).toBeTruthy();
      const createBody = JSON.parse((createCall?.[1] as RequestInit).body as string);
      expect(createBody.data.targetAudience).toBe("drivers");
    });
  });
});
