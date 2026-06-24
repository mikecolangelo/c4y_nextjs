import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MenuSettingsSection } from "../menu-settings-section";

vi.mock("@/lib/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
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
  const calls: { url: string; method: string; body?: any }[] = [];
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });

    if (url.includes("/api/permissions/matrix") && method === "GET") {
      return { ok: true, json: async () => ({ data: { matrix, modules: [] } }) } as Response;
    }
    if (url.includes("/api/menu-config") && method === "GET") {
      return { ok: true, json: async () => ({ data: { order: ["fleet", "users"] } }) } as Response;
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

    // driver NO ve "users" -> el botón ofrece "Mostrar Contactos".
    const showBtn = await screen.findByRole("button", { name: "Mostrar Contactos" });
    fireEvent.click(showBtn);

    // Tras el click pasa a ser visible -> el botón ahora oculta.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Ocultar Contactos" })).toBeInTheDocument()
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
      expect(matrixPut?.body.matrix).toBeTruthy();
    });
  });
});
