import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MenuSettingsSection } from "../menu-settings-section";

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/permissions-context", () => ({
  usePermissions: () => ({ can: () => true, loading: false }),
}));

const perm = (canAccess: boolean) => ({
  canAccess,
  canRead: canAccess,
  canCreate: false,
  canUpdate: false,
  canDelete: false,
});

/** Matriz de prueba: driver ve "fleet" pero no "users". */
const matrix = {
  admin: { users: perm(true), fleet: perm(true) },
  driver: { users: perm(false), fleet: perm(true) },
  lead: { users: perm(false), fleet: perm(false) },
};

function mockFetch() {
  const calls: { url: string; method: string; body?: Record<string, unknown> }[] = [];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });

    if (url.includes("/api/permissions/matrix") && method === "GET") {
      return { ok: true, json: async () => ({ data: { matrix, modules: [] } }) } as Response;
    }
    if (url.includes("/api/menu-config") && method === "GET") {
      return {
        ok: true,
        json: async () => ({ data: { order: ["fleet", "users"], hidden: {} } }),
      } as Response;
    }
    // PUTs
    return { ok: true, json: async () => ({ data: {} }) } as Response;
  }) as unknown as typeof fetch;
  return calls;
}

describe("MenuSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carga los items del menú en el orden guardado", async () => {
    mockFetch();
    render(<MenuSettingsSection />);

    expect(await screen.findByText("Flota")).toBeInTheDocument();
    expect(screen.getByText("Contactos")).toBeInTheDocument();
  });

  it("el ojito refleja la visibilidad y se puede alternar", async () => {
    mockFetch();
    render(<MenuSettingsSection />);

    // El admin siempre ve los items -> "Contactos" arranca visible (Ocultar).
    const hideBtn = await screen.findByRole("button", { name: "Ocultar Contactos" });
    fireEvent.click(hideBtn);

    // Tras ocultarlo para todos los roles, el botón ofrece mostrarlo de nuevo.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Mostrar Contactos" })).toBeInTheDocument()
    );
  });

  it("guarda el orden y la matriz al pulsar Guardar", async () => {
    const calls = mockFetch();
    render(<MenuSettingsSection />);

    await screen.findByText("Flota");
    fireEvent.click(screen.getByRole("button", { name: /Guardar menú/i }));

    await waitFor(() => {
      const orderPut = calls.find((c) => c.url.includes("/api/menu-config") && c.method === "PUT");
      const matrixPut = calls.find(
        (c) => c.url.includes("/api/permissions/matrix") && c.method === "PUT"
      );
      expect(orderPut?.body.order).toContain("fleet");
      // El layout ahora persiste también la visibilidad de menú (hidden).
      expect(orderPut?.body).toHaveProperty("hidden");
      expect(matrixPut?.body.matrix).toBeTruthy();
    });
  });
});
