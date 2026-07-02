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

/**
 * Stubs the user-profile resolution chain (users/me + user-profiles lookup).
 * Auth-user id (34) and user-profile id (58) are intentionally DIFFERENT — they
 * live in separate id-spaces and the route must use the profile id for relations.
 */
function stubAuthenticatedUser(role = "admin") {
  return [
    jsonResponse({ id: 34, email: "user@test.com" }), // /api/users/me (auth id)
    jsonResponse({
      data: [{ id: 58, documentId: "doc-58", role, email: "user@test.com" }],
    }), // /api/user-profiles (profile id)
  ];
}

/**
 * Stubs the `requireModulePermission` guard's own JWT-based auth resolution
 * (getCurrentUserProfileViaJwt: users/me + user-profiles). This runs BEFORE
 * the route's own `getCurrentUserProfile()` cookie-based check, so it
 * consumes the front of the fetch-mock queue independently. Non-admin roles
 * also trigger a role-permissions/mine lookup that must grant the requested
 * module/action or the guard returns 403.
 */
function stubModuleGuard(role = "admin", moduleKey = "notifications", action = "canRead") {
  const responses = [
    jsonResponse({ id: 34, email: "user@test.com" }), // /api/users/me (module-guard)
    jsonResponse({
      data: [{ id: 58, documentId: "doc-58", role, email: "user@test.com" }],
    }), // /api/user-profiles (module-guard)
  ];
  if (role !== "admin" && role !== "super-admin") {
    responses.push(
      jsonResponse({ data: { permissions: { [moduleKey]: { [action]: true } } } }) // /api/role-permissions/mine
    );
  }
  return responses;
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
    it("returns 403 when the module-permission guard rejects an unauthenticated caller", async () => {
      cookieGet.mockReturnValue(undefined);
      const res = await GET();
      expect(res.status).toBe(403);
    });

    it("returns deduplicated notifications for an authenticated user", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      const responses = [
        ...stubModuleGuard("admin", "notifications", "canRead"),
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

    it("shows an 'admins' broadcast to an admin and queries the role audience", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      const responses = [
        ...stubModuleGuard("admin", "notifications", "canRead"),
        ...stubAuthenticatedUser("admin"),
        // broadcast query: a notification targeted at admins only
        jsonResponse({
          data: [
            {
              id: 2,
              documentId: "n2",
              type: "announcement",
              title: "Solo admins",
              isRead: false,
              targetAudience: "admins",
            },
          ],
        }),
        jsonResponse({ data: [] }), // recipient query
      ];
      const fetchMock = vi.fn(async () => responses.shift() as Response);
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET();
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Solo admins");

      // The broadcast query must include the role audience, not just "all".
      const broadcastUrl = String(fetchMock.mock.calls[4]?.[0]);
      expect(broadcastUrl).toContain("admins");
    });

    it("hides a role-mismatched broadcast from a driver", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      const responses = [
        ...stubModuleGuard("driver", "notifications", "canRead"),
        ...stubAuthenticatedUser("driver"),
        // broadcast query returns one drivers + one admins notification;
        // the admins one must be filtered out for a driver.
        jsonResponse({
          data: [
            {
              id: 3,
              documentId: "n3",
              type: "announcement",
              title: "Para drivers",
              isRead: false,
              targetAudience: "drivers",
            },
            {
              id: 4,
              documentId: "n4",
              type: "announcement",
              title: "Para admins",
              isRead: false,
              targetAudience: "admins",
            },
          ],
        }),
        jsonResponse({ data: [] }), // recipient query
      ];
      const fetchMock = vi.fn(async () => responses.shift() as Response);
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET();
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Para drivers");
    });

    it("matches an individual notification by profile id (not auth id)", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      const responses = [
        ...stubModuleGuard("admin", "notifications", "canRead"),
        ...stubAuthenticatedUser("admin"),
        jsonResponse({ data: [] }), // broadcast query
        // recipient query: notification addressed to profile id 58
        jsonResponse({
          data: [
            {
              id: 5,
              documentId: "n5",
              type: "lead",
              title: "Para vos",
              isRead: false,
              recipient: { id: 58, documentId: "doc-58" },
            },
          ],
        }),
      ];
      const fetchMock = vi.fn(async () => responses.shift() as Response);
      vi.stubGlobal("fetch", fetchMock);

      const res = await GET();
      const json = await res.json();
      expect(json.data).toHaveLength(1);
      expect(json.data[0].title).toBe("Para vos");

      // The recipient query must filter by the PROFILE id (58), never the auth id (34).
      const recipientUrl = decodeURIComponent(String(fetchMock.mock.calls[5]?.[0]));
      expect(recipientUrl).toContain("58");
      expect(recipientUrl).not.toContain("][$eq]=34");
    });
  });

  describe("POST", () => {
    it("returns 403 when the module-permission guard rejects an unauthenticated caller", async () => {
      cookieGet.mockReturnValue(undefined);
      const req = new Request("http://localhost/api/notifications", {
        method: "POST",
        body: JSON.stringify({ title: "x", type: "lead", recipientType: "all" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(403);
    });

    it("rejects when required fields are missing", async () => {
      cookieGet.mockReturnValue({ value: "jwt" });
      // Provide the module-guard + auth responses then expect a 400 for missing fields.
      const authResponses = [
        ...stubModuleGuard("admin", "notifications", "canCreate"),
        ...stubAuthenticatedUser(),
      ];
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
        ...stubModuleGuard("admin", "notifications", "canCreate"),
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
